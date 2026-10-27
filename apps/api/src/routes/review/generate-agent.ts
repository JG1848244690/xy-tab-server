/**
 * AI 自动出题 agent(2026-10-27,基于 Vercel AI SDK 7)
 *
 * 为什么要多次调用:单次生成"看着像题"但容易补充原文没有的细节。
 * 这里拆成三步,让模型先质疑自己:
 *
 *   1. 草稿   —— 只依据原文起草题目
 *   2. 核查   —— 逐条找"原文没有依据 / 矛盾 / 偏题 / 含糊"的地方(不重写)
 *   3. 终稿   —— 按核查意见删改,收窄范围,把不确定点写进 caveats
 *
 * 如果核查阶段认为需要外部资料,会调用 research.ts 注册的搜索工具
 * (目前未接入,后续补);没有工具时不会假装查过,而是明确提示人工核实。
 *
 * 与审核共用 DeepSeek(OpenAI 兼容协议);thinking 默认关闭(LLM_THINKING)。
 */
import { generateObject, type LanguageModel } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import { LLM_TIMEOUT_MS } from '../../lib/constants.js'
import { llmConfig, LlmError } from './llm.js'
import {
    auditSystemPrompt,
    draftSystemPrompt,
    finalSystemPrompt,
} from './prompts/generate.js'
import { runResearch, type ResearchNotes } from './research.js'

/** generateObject 的 providerOptions 类型(ai 包未直接导出) */
type ProviderOptions = NonNullable<
    Parameters<typeof generateObject>[0]['providerOptions']
>

const questionFields = {
    title: z.string().min(4).max(120),
    content: z.string().min(10).max(20_000),
    answer: z.string().min(10).max(20_000),
    tags: z.array(z.string().min(1).max(30)).max(8).default([]),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    type: z.enum(['markdown', 'text']),
}

const draftSchema = z.object(questionFields)

const auditSchema = z.object({
    verdict: z.enum(['ok', 'revise']),
    issues: z
        .array(
            z.object({
                severity: z.enum(['blocking', 'warning']),
                kind: z.enum(['unsupported', 'wrong', 'off_topic', 'unclear', 'missing']),
                detail: z.string().min(1).max(500),
                fix: z.string().min(1).max(500),
            }),
        )
        .max(8)
        .default([]),
    needsResearch: z.boolean().default(false),
    researchQueries: z.array(z.string().min(1).max(100)).max(3).default([]),
    sourceCoverage: z.enum(['full', 'partial', 'thin']).default('partial'),
})

const finalSchema = z.object({
    ...questionFields,
    grounded: z.boolean().default(false),
    caveats: z.array(z.string().min(1).max(300)).max(3).default([]),
})

export type GeneratedDraft = z.infer<typeof draftSchema>
export type GeneratedAudit = z.infer<typeof auditSchema>
export type GeneratedFinal = z.infer<typeof finalSchema>

export interface GenerateAgentInput {
    /** 用户粘贴的原文(唯一事实来源) */
    source: string
    /** 平台已有标签,注入提示词 + 归一化 */
    vocabulary: string[]
    type?: 'markdown' | 'text'
    difficulty?: 'easy' | 'medium' | 'hard'
}

export interface GenerateAgentResult {
    question: {
        title: string
        content: string
        answer: string
        tags: string[]
        difficulty: 'easy' | 'medium' | 'hard'
        type: 'markdown' | 'text'
    }
    /** 面向用户的"不确定/需核实"提示;空数组表示模型认为完全有据 */
    caveats: string[]
    grounded: boolean
    meta: {
        /** 实际模型调用轮数(3 = 草稿+核查+终稿;有检索资料时 +1 步) */
        steps: number
        model: string
        latencyMs: number
        needsResearch: boolean
        researchQueries: string[]
        sourceCoverage: string
        issueCount: number
    }
}

/** DeepSeek thinking 档位:默认关闭;auto = 不下发(兼容不认该参数的网关) */
function providerOptionsForThinking(): ProviderOptions | undefined {
    const mode = (process.env.LLM_THINKING ?? 'disabled').toLowerCase()
    if (mode === 'auto') return undefined
    return {
        deepseek: {
            thinking: { type: mode === 'enabled' ? 'enabled' : 'disabled' },
        },
    }
}

function buildModel(): { model: LanguageModel; modelId: string } {
    const cfg = llmConfig()
    if (!cfg.baseUrl || !cfg.model || !cfg.apiKey) {
        throw new LlmError('LLM 未配置')
    }
    const provider = createOpenAICompatible({
        name: 'deepseek',
        baseURL: cfg.baseUrl,
        apiKey: cfg.apiKey,
    })
    return { model: provider(cfg.model), modelId: cfg.model }
}

/**
 * 单步结构化调用:JSON 解析失败/模型不守契约时重试一次。
 * 超时给 60s(终稿答案可能较长),避免 30s 卡断长题。
 */
async function callObject<S extends z.ZodTypeAny>(opts: {
    model: LanguageModel
    schema: S
    system: string
    prompt: string
    providerOptions: ProviderOptions | undefined
}): Promise<z.output<S>> {
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const { object } = await generateObject({
                model: opts.model,
                schema: opts.schema,
                system: opts.system,
                prompt: opts.prompt,
                temperature: 0.2,
                maxOutputTokens: 6000,
                maxRetries: 1,
                abortSignal: AbortSignal.timeout(Math.max(LLM_TIMEOUT_MS, 60_000)),
                providerOptions: opts.providerOptions,
            })
            return object as z.output<S>
        } catch (err) {
            lastError = err
        }
    }
    throw lastError instanceof Error ? lastError : new LlmError('LLM 调用失败')
}

function researchBlock(research: ResearchNotes): string {
    const notes = research.notes.map((n) => `- ${n}`).join('\n')
    const sources = research.sources
        .map((s) => `- ${s.title}: ${s.url}`)
        .join('\n')
    return `【检索资料】\n${notes || '(无要点)'}\n${sources ? `\n来源:\n${sources}` : ''}`
}

export async function runGenerateAgent(
    input: GenerateAgentInput,
): Promise<GenerateAgentResult> {
    const { model, modelId } = buildModel()
    const providerOptions = providerOptionsForThinking()
    const started = Date.now()

    const constraintLines = [
        input.type ? `【指定题型】${input.type}(必须遵守)` : '',
        input.difficulty ? `【指定难度】${input.difficulty}(必须遵守)` : '',
        `【平台已有标签(2-4 个,优先用原词)】${input.vocabulary.join('、') || '无'}`,
    ].filter(Boolean)

    const call = <S extends z.ZodTypeAny>(schema: S, system: string, prompt: string) =>
        callObject({ model, schema, system, prompt, providerOptions })

    // 1) 草稿
    const draft = await call(
        draftSchema,
        draftSystemPrompt,
        `${constraintLines.join('\n')}\n\n【用户粘贴的内容】\n${input.source}`,
    )

    // 2) 事实核查:先质疑,只挑问题
    const audit = await call(
        auditSchema,
        auditSystemPrompt,
        `${constraintLines.join('\n')}\n\n【原文】\n${input.source}\n\n【草稿题目】\n${JSON.stringify(draft, null, 2)}`,
    )

    // 2.5) 需要时检索(工具未接入时 runResearch 返回 null,绝不假装查过)
    const research = audit.needsResearch ? await runResearch(audit.researchQueries) : null

    // 3) 终稿:按核查意见删改 + 明确不确定点
    const final = await call(
        finalSchema,
        finalSystemPrompt,
        [
            constraintLines.join('\n'),
            '',
            '【原文】',
            input.source,
            '',
            '【草稿题目】',
            JSON.stringify(draft, null, 2),
            '',
            '【核查意见】',
            JSON.stringify(audit, null, 2),
            ...(research ? ['', researchBlock(research)] : []),
        ].join('\n'),
    )

    const caveats = [...final.caveats]
    if (audit.needsResearch && !research) {
        const queries = audit.researchQueries.length
            ? `(${audit.researchQueries.join('、')})`
            : ''
        caveats.push(
            `AI 标记了需要外部资料核实的点${queries},当前未接入联网搜索,提交前请人工确认。`,
        )
    }
    if (!final.grounded && caveats.length === 0) {
        caveats.push('题目包含原文未直接覆盖的内容,提交前请核对。')
    }

    const uniqueCaveats = [...new Set(caveats.map((c) => c.trim()).filter(Boolean))].slice(0, 4)

    return {
        question: {
            title: final.title,
            content: final.content,
            answer: final.answer,
            tags: final.tags,
            difficulty: final.difficulty,
            type: final.type,
        },
        caveats: uniqueCaveats,
        grounded: final.grounded,
        meta: {
            steps: research ? 4 : 3,
            model: modelId,
            latencyMs: Date.now() - started,
            needsResearch: audit.needsResearch,
            researchQueries: audit.researchQueries,
            sourceCoverage: audit.sourceCoverage,
            issueCount: audit.issues.length,
        },
    }
}
