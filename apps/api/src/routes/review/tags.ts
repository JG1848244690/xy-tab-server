/**
 * tags.ts —— 标签收敛(2026-10-26)
 *
 * 现状:AI 每次自由发挥,标签数量多、同义词重复(js/JavaScript)、还有大量
 * 一次性小众标签。完整标签管理(合并/重命名/后台 UI)优先级低,先做三件
 * 成本最低的事:
 *   1. 提示词里给「平台已有标签」候选,引导模型复用;
 *   2. 输出后统一规范化:去重(忽略大小写)、限长、常见别名归一、最多 4 个;
 *   3. 生成类接口(AI 出题)共用同一套规则。
 *
 * 存量 81 题的标签清洗等审核清洗那一轮一起做。
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
    '事件循环机制': '事件循环',
}

/**
 * 标签规范化:清洗 + 别名归一 + 忽略大小写去重 + 截断到 MAX_TAGS。
 * 传入任意值都安全(模型/历史数据可能给 null、字符串、超长数组)。
 */
export function normalizeTags(input: unknown): string[] {
    if (!Array.isArray(input)) return []
    const out: string[] = []
    for (const raw of input) {
        if (typeof raw !== 'string') continue
        const cleaned = raw
            .trim()
            // 去掉模型偶尔加的前缀/结尾标点:#Vue、Vue,、Vue。
            .replace(/^[#\s]+/, '')
            .replace(/[，,;；。\s]+$/, '')
            .slice(0, MAX_TAG_LEN)
        if (!cleaned) continue
        const normalized = TAG_ALIASES[cleaned.toLowerCase()] ?? cleaned
        if (out.some((t) => t.toLowerCase() === normalized.toLowerCase())) continue
        out.push(normalized)
        if (out.length >= MAX_TAGS) break
    }
    return out
}

/**
 * 平台高频标签(只统计已过审的题),作为提示词候选 —— 让模型优先复用,
 * 而不是每次自造新词。查询失败返回空数组:标签候选只是增强项。
 */
export async function popularTags(limit = 24): Promise<string[]> {
    try {
        const rows = (await db.execute(sql`
            select tag
            from (
                select jsonb_array_elements_text(tags) as tag
                from questions
                where tags is not null and status = 'approved'
            ) t
            group by tag
            order by count(*) desc, tag
            limit ${limit}
        `)) as unknown as Array<{ tag: string }>
        return rows.map((r) => r.tag).filter((t) => typeof t === 'string' && t.length > 0)
    } catch {
        return []
    }
}
