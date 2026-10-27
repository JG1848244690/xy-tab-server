/**
 * llm.ts —— OpenAI 兼容协议的最小客户端
 *
 * 为什么手写 fetch 不装 openai SDK:只用 chat/completions 一个端点,
 * SDK 多几百 KB 依赖;兼容网关(DashScope/DeepSeek/自建 vLLM)都吃这个协议。
 *
 * 失败语义(见 plan §2.3 护栏):超时 30s、HTTP 非 2xx、JSON 解析失败
 * → 统一抛 LlmError,由 agent 决定"重试一次"还是"留在 pending_review"。
 */
import { z } from 'zod'
import { LLM_TIMEOUT_MS } from '../../lib/constants.js'

/**
 * LLM 配置读取:调用时读 process.env 而非 env.ts 的快照 ——
 * env.ts 在模块加载时 parse,测试里来不及注入;这里每次调用现读,
 * 生产语义不变(容器 env / .env 都在 process.env 里)。
 */
/** LLM 配置读取:调用时读 process.env 而非 env.ts 的快照 ——
 * env.ts 在模块加载时 parse,测试里来不及注入;这里每次调用现读,
 * 生产语义不变(容器 env / .env 都在 process.env 里)。 */
export function llmConfig() {
    return {
        baseUrl: (process.env.LLM_BASE_URL ?? '').replace(/\/$/, ''),
        model: process.env.LLM_MODEL ?? '',
        apiKey: process.env.LLM_API_KEY ?? '',
    }
}

/** LLM 不可用(没配)/不可达/超时/非 JSON 的统一错误 */
export class LlmError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'LlmError'
    }
}

/** agent 输出契约:五维 + 总分 + 差异化素材。失败自动重试一次也过不了就放弃 */
export const agentReportSchema = z
    .object({
        dimensions: z.object({
            correctness: z.number().min(0).max(20),
            completeness: z.number().min(0).max(20),
            clarity: z.number().min(0).max(20),
            originality: z.number().min(0).max(20),
            relevance: z.number().min(0).max(20),
        }),
        total: z.number().min(0).max(100),
        summary: z.string().min(5).max(500),
        slug: z
            .string()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .max(80)
            .optional(),
        tags: z.array(z.string().min(1).max(30)).max(6).optional(),
        suggestions: z.array(z.string()).max(5).optional(),
        oneLiner: z.string().max(100).optional(),
        mnemonic: z.string().max(80).optional(),
        /**
         * 改进版题目:当题目无意义 / 答案不充分时,agent 给出可直接落库的
         * 完整版本(2026-10-26)。后台可「一键应用」:写回题目 → 自动重审
         *
         * 注意:模型有时用 `{"title":"","content":"","answer":""}` 表示"不需要
         * 改进"(实测),这里允许空串,由 agent 归一成「没有 revised」——
         * 否则整个审核会被 zod 判失败、题卡在 pending_review。
         */
        revised: z
            .object({
                title: z.string().max(255).optional(),
                content: z.string(),
                answer: z.string(),
                tags: z.array(z.string()).max(8).optional(),
            })
            .optional(),
    })
    // 总分与五维之和一致:防止模型算术漂移导致阈值判定失真
    .refine((r) => {
        const sum = Object.values(r.dimensions).reduce((a, b) => a + b, 0)
        return Math.abs(sum - r.total) <= 1
    }, { message: 'total 必须等于五维得分之和(±1)' })

export type AgentReport = z.infer<typeof agentReportSchema>

/**
 * 兜底修订的契约:主报告漏了 revised 时单独调用一次(见 prompts/revision.ts)
 */
export const revisionSchema = z.object({
    revised: z.object({
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(10),
        answer: z.string().min(10),
        tags: z.array(z.string().min(1).max(30)).max(6).optional(),
    }),
})

export type RevisionReport = z.infer<typeof revisionSchema>

/** agent 是否已配置(三项 env 齐全才算) */
export function llmConfigured(): boolean {
    const cfg = llmConfig()
    return Boolean(cfg.baseUrl && cfg.model && cfg.apiKey)
}

/**
 * 从回复里抠 JSON。
 *
 * 关键坑(2026-10-26):`revised.answer` 里常含 ```js 代码块,旧实现先匹配
 * ```json 围栏(语言标签可选)就会把答案里的 JS 当成 JSON 抠出来 →
 * "Expected property name ... position 1" 偶发审核失败。
 * 现在优先整段解析(json_object 模式的常态),再按围栏兜底。
 */
function extractJson(text: string): unknown {
    const tryParse = (raw: string): unknown | undefined => {
        const start = raw.indexOf('{')
        const end = raw.lastIndexOf('}')
        if (start === -1 || end <= start) return undefined
        try {
            return JSON.parse(raw.slice(start, end + 1))
        } catch {
            return undefined
        }
    }

    // 1. 整段就是 JSON(response_format=json_object 时最常见)
    const direct = tryParse(text)
    if (direct !== undefined) return direct

    // 2. 显式 ```json 围栏
    for (const m of text.matchAll(/```json\s*([\s\S]*?)```/gi)) {
        const parsed = tryParse(m[1])
        if (parsed !== undefined) return parsed
    }

    // 3. 其它围栏(模型用 ``` 包了 JSON)
    for (const m of text.matchAll(/```[a-zA-Z]*\s*([\s\S]*?)```/g)) {
        const parsed = tryParse(m[1])
        if (parsed !== undefined) return parsed
    }

    // 4. 没救:带上片段,线上排查"模型没按契约输出"时能直接看到原因
    throw new LlmError(`回复里没有可解析的 JSON 对象: ${text.slice(0, 120)}`)
}

/**
 * thinking 档位(2026-10-26):DeepSeek V4.1 默认会思考 —— 实测同一道题
 * thinking 开启时 reasoning_tokens≈2200、耗时 15s,关闭后 7.7s、输出量 1/3,
 * 且 JSON 契约更稳定。默认关闭省成本;需要更强推理时用 LLM_THINKING=enabled,
 * 接别的网关不认该参数时用 LLM_THINKING=auto(不下发)。
 */
function thinkingParam(): Record<string, unknown> {
    const mode = (process.env.LLM_THINKING ?? 'disabled').toLowerCase()
    if (mode === 'auto') return {}
    return { thinking: { type: mode === 'enabled' ? 'enabled' : 'disabled' } }
}

type ChatMessage = { role: 'system' | 'user'; content: string }

/** 单次调用:返回解析+校验后的报告。zod 失败由调用方重试 */
export async function chatJson<T>(
    messages: ChatMessage[],
    schema: z.ZodType<T>,
): Promise<{ report: T; latencyMs: number }> {
    const started = Date.now()
    const cfg = llmConfig()
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
            model: cfg.model,
            messages,
            temperature: 0.2,
            // 强制合法 JSON(DeepSeek/OpenAI 兼容网关都支持):实测能根治
            // 模型偶发输出单引号/半截 JSON 导致的审核失败
            response_format: { type: 'json_object' },
            ...thinkingParam(),
        }),
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    })

    if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new LlmError(`LLM HTTP ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new LlmError('LLM 回复为空')

    const report = schema.parse(extractJson(content))
    return { report, latencyMs: Date.now() - started }
}

/**
 * 带重试的调用:zod 校验失败/超时共重试 retries 次(plan §2.3"校验失败自动重试一次")。
 * 全部失败抛最后一次的错,由 agent 落失败审计。
 */
export async function chatJsonWithRetry<T>(
    messages: ChatMessage[],
    schema: z.ZodType<T>,
    retries: number,
): Promise<{ report: T; latencyMs: number }> {
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await chatJson(messages, schema)
        } catch (e) {
            lastError = e
        }
    }
    throw lastError
}
