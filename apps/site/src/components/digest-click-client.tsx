'use client'

import { track } from '@/lib/track'

/** digest 期内的点击埋点(click_contribute 同款轻事件) */
export function DigestClickClient({ slug }: { slug: string }) {
    return (
        <button
            style={{ all: 'unset', cursor: 'pointer', color: 'var(--muted)' }}
            onClick={() => track('digest_click', { slug })}
        >
            站内导读 ↗
        </button>
    )
}
