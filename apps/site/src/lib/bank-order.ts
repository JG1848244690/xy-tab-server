/** 首页/题库页的展示顺序:先语言,再类型与样式,再框架/算法/工程。 */
export const BANK_ORDER = [
    'javascript',
    'typescript',
    'css-html',
    'framework',
    'algorithm',
    'engineering',
] as const

export function sortBanks<T extends { slug: string }>(banks: T[]): T[] {
    const index = (slug: string) => {
        const i = BANK_ORDER.indexOf(slug as (typeof BANK_ORDER)[number])
        return i === -1 ? 999 : i
    }
    return [...banks].sort((a, b) => index(a.slug) - index(b.slug))
}
