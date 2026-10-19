'use client'

import { track } from '@/lib/track'

/** digest 期内的点击埋点 */
export function DigestClickClient({ slug }: { slug: string }) {
    return (
        <button
            className="cursor-pointer border-none bg-none p-0 text-muted-foreground hover:text-accent"
            onClick={() => track('digest_click', { slug })}
        >
            站内导读 ↗
        </button>
    )
}
