/**
 * digest 期数计算:curated 荐文按"发布 ISO 周"分组,
 * 一周一期,期号形如 2026-W42(URL 友好)。
 */
import type { ArticleListItem } from './site-api'

export type DigestIssue = {
    /** 期号,如 2026-W42 */
    issue: string
    /** 期内的 curated 文章 */
    articles: ArticleListItem[]
}

export function weekOf(dateStr: string | null): string {
    const d = dateStr ? new Date(dateStr) : new Date()
    // ISO 周:周四所在年
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNumber = (target.getUTCDay() + 6) % 7
    target.setUTCDate(target.getUTCDate() - dayNumber + 3)
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
    const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3)
    const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
    return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function groupIntoIssues(curated: ArticleListItem[]): DigestIssue[] {
    const map = new Map<string, DigestIssue>()
    for (const a of curated) {
        const issue = weekOf(a.publishedAt)
        if (!map.has(issue)) map.set(issue, { issue, articles: [] })
        map.get(issue)!.articles.push(a)
    }
    // 新的期在前
    return [...map.values()].sort((a, b) => b.issue.localeCompare(a.issue))
}
