/**
 * tags.ts —— 标签收敛(2026-10-26,2026-10-27 改为"优先复用")
 *
 * 现状:AI 每次自由发挥,标签数量多、同义词重复(js/JavaScript)、还有大量
 * 一次性小众标签。完整标签管理(合并/重命名/后台 UI)优先级低,先做三件
 * 成本最低的事:
 *   1. 提示词里给「平台已有标签」候选,引导模型复用;
 *   2. 输出后统一规范化:去重(忽略大小写)、限长、常见别名归一、最多 4 个;
 *   3. 生成类接口(AI 出题)共用同一套规则。
 *
 * 2026-10-27:
 *   - 候选从"热门 24 个"扩到"全部已有标签"(tag_registry + 已过审题目),
 *     否则冷门但合法的标签模型永远看不到;
 *   - normalizeTags 支持传入候选词表:命中已有标签时强制用已有写法,
 *     未命中最多保留 maxNew 个(默认不限,AI 出题/审核传 1);
 *   - 过滤"面试题/场景/总结"这类没有检索价值的泛词。
 */
import { sql } from 'drizzle-orm'
import db from '../../db/index.js'

/** 一道题最多保留的标签数(2026-10-26:从"不限"收紧到 4) */
export const MAX_TAGS = 4
/** 单个标签最大长度 */
const MAX_TAG_LEN = 20

/**
 * 常见别名 → 规范写法。只收确定无歧义的:宁可不合并,也不要合错。
 */
const TAG_ALIASES: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    vue: 'Vue',
    vue2: 'Vue',
    vue3: 'Vue',
    'vue 2': 'Vue',
    'vue 3': 'Vue',
    vuejs: 'Vue',
    react: 'React',
    reactjs: 'React',
    node: 'Node.js',
    nodejs: 'Node.js',
    'node.js': 'Node.js',
    html: 'HTML',
    css: 'CSS',
    dom: 'DOM',
    bom: 'BOM',
    ajax: 'Ajax',
    json: 'JSON',
    http: 'HTTP',
    https: 'HTTP',
    http2: 'HTTP/2',
    'http/2': 'HTTP/2',
    es6: 'ES6',
    es2015: 'ES6',
    webpack: 'Webpack',
    vite: 'Vite',
    promise: 'Promise',
    异步: '异步编程',
    async: '异步编程',
    eventloop: '事件循环',
    事件循环机制: '事件循环',
    hash: '哈希',
    算法面试: '算法',
    手写: '手写实现',
    手写题: '手写实现',
}

/**
 * 泛词黑名单:对检索/关联没有价值的标签,模型给了也丢掉。
 * 只收"确定没用"的整词,不做模糊匹配(避免误杀"响应式原理"这类有效标签)。
 */
const TAG_STOPWORDS = new Set([
    '面试',
    '面试题',
    '前端面试',
    '场景',
    '总结',
    '笔记',
    '个人笔记',
    '学习总结',
    '知识点',
    '基础',
    '进阶',
    '原理',
    'hd',
    'doc',
])

/** 清洗单个标签:去前缀 #/空白、去尾部标点、别名归一、过滤泛词 */
function canonicalTag(raw: string): string | null {
    const cleaned = raw
        .trim()
        // 去掉模型偶尔加的前缀/结尾标点:#Vue、Vue,、Vue。
        .replace(/^[#\s]+/, '')
        .replace(/[，,;；。\s]+$/, '')
        .slice(0, MAX_TAG_LEN)
    if (!cleaned) return null
    const normalized = TAG_ALIASES[cleaned.toLowerCase()] ?? cleaned
    if (TAG_STOPWORDS.has(normalized.toLowerCase())) return null
    return normalized
}

export interface NormalizeTagOptions {
    /** 平台已有标签(原词);命中时强制用已有写法 */
    vocabulary?: string[]
    /** 允许新建的标签数上限(默认不限) */
    maxNew?: number
}

/**
 * 标签规范化:清洗 + 别名归一 + 忽略大小写去重 + 截断到 MAX_TAGS。
 * 传入任意值都安全(模型/历史数据可能给 null、字符串、超长数组)。
 *
 * 传 vocabulary 时:大小写/别名不同的标签会归到平台已有写法;
 * 不在词表里的标签记为新标签,超过 maxNew 的直接丢弃。
 */
export function normalizeTags(input: unknown, options: NormalizeTagOptions = {}): string[] {
    if (!Array.isArray(input)) return []

    const byLower = new Map<string, string>()
    for (const t of options.vocabulary ?? []) {
        const canonical = canonicalTag(t)
        if (canonical) byLower.set(canonical.toLowerCase(), canonical)
    }
    const maxNew = options.maxNew ?? Number.POSITIVE_INFINITY

    // 先把输入清洗成规范词(保留原顺序),再判断用不用限"新建数"。
    // 只有"至少命中一个已有标签"时才收紧 —— 否则说明词表没覆盖这个话题
    // (或词表为空),这时硬砍成 1 个会把题目标注得过于贫瘠。
    const cleaned = input
        .filter((raw): raw is string => typeof raw === 'string')
        .map((raw) => canonicalTag(raw))
        .filter((t): t is string => !!t)
    const hasExistingMatch = cleaned.some((t) => byLower.has(t.toLowerCase()))
    const limitNew = byLower.size > 0 && hasExistingMatch

    const out: string[] = []
    let newCount = 0
    for (const canonical of cleaned) {
        let normalized = canonical
        const existing = byLower.get(normalized.toLowerCase())
        if (existing) {
            normalized = existing
        } else if (limitNew) {
            if (newCount >= maxNew) continue
            newCount++
        }

        if (out.some((t) => t.toLowerCase() === normalized.toLowerCase())) continue
        out.push(normalized)
        if (out.length >= MAX_TAGS) break
    }
    return out
}

/**
 * 平台已有标签:tag_registry(SEO 标签页的权威词表)+ 已过审题目的标签。
 * 按使用次数排序;做别名归一/去重/过滤泛词后返回。
 *
 * 查询失败返回空数组:标签候选只是增强项,不能拖垮出题/审核。
 */
export async function existingTags(limit = 80): Promise<string[]> {
    try {
        const rows = (await db.execute(sql`
            select tag
            from (
                -- registry 里的词权重高:它们是公开标签页的入口,优先复用
                select name as tag, 10 as weight from tag_registry
                union all
                select jsonb_array_elements_text(
                    case when jsonb_typeof(tags) = 'array' then tags else '[]'::jsonb end
                ) as tag, 1 as weight
                from questions
                where status = 'approved' and tags is not null
            ) t
            group by tag
            order by sum(weight) desc, tag
            limit ${limit * 2}
        `)) as unknown as Array<{ tag: string }>

        const out: string[] = []
        const seen = new Set<string>()
        for (const row of rows) {
            if (typeof row?.tag !== 'string') continue
            const canonical = canonicalTag(row.tag)
            if (!canonical) continue
            const key = canonical.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            out.push(canonical)
            if (out.length >= limit) break
        }
        return out
    } catch {
        return []
    }
}
