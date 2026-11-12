/**
 * 题目归库:技术栈 → 题库 slug。
 *
 * 之前创建 / 审核通过的题不写 bank_id,新题不会出现在任何题库页,
 * 「AI 审过入库」也等于进了黑洞。这里给一份确定的映射,
 * 由调用方去查 banks.id。
 */
import { eq } from 'drizzle-orm'
import db from '../db/index.js'
import { banks } from '../db/schema.js'

export const BANK_BY_STACK: Record<string, string> = {    JavaScript: 'javascript',
    TypeScript: 'typescript',
    CSS: 'css-html',
    HTML: 'css-html',
    Vue: 'framework',
    React: 'framework',
    'Node.js': 'framework',
    LLM: 'framework',
    RAG: 'framework',
    数据结构: 'algorithm',
    浏览器: 'engineering',
    工程化: 'engineering',
    MySQL: 'engineering',
    Redis: 'engineering',
    Java: 'engineering',
    Spring: 'engineering',
}

export function bankSlugFor(
    techStack?: string | null,
    direction?: string | null,
): string {
    if (direction === '算法') return 'algorithm'
    if (techStack && BANK_BY_STACK[techStack]) return BANK_BY_STACK[techStack]
    return 'javascript'
}

/** 题库是静态数据(6 条),直接按 slug 查一次即可 */
export async function resolveBankId(
    techStack?: string | null,
    direction?: string | null,
): Promise<string | null> {
    const [bank] = await db
        .select({ id: banks.id })
        .from(banks)
        .where(eq(banks.slug, bankSlugFor(techStack, direction)))
        .limit(1)
    return bank?.id ?? null
}
