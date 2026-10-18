/**
 * 埋点封装(plan §3.4):≤100 行,只依赖 window.dataLayer。
 * 百度统计为主(GA4 缓做);事件:view_question / click_contribute /
 * search / copy_answer / digest_click。
 *
 * 用法:<button onClick={() => track('copy_answer', { slug })}>
 * 百度统计的统计脚本在 layout.tsx 里按 NEXT_PUBLIC_BA_ID 注入,没配就跳过。
 */

export type TrackEvent =
    | 'view_question'
    | 'click_contribute'
    | 'search'
    | 'copy_answer'
    | 'digest_click'

type Payload = Record<string, string | number | boolean | undefined>

declare global {
    interface Window {
        dataLayer?: Array<Record<string, unknown>>
    }
}

export function track(event: TrackEvent, payload: Payload = {}) {
    if (typeof window === 'undefined') return
    window.dataLayer = window.dataLayer ?? []
    window.dataLayer.push({ event, ...payload, ts: Date.now() })
}
