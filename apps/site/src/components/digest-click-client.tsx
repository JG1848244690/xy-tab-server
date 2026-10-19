'use client'

import { ArrowUpRight } from 'lucide-react'
import { track } from '@/lib/track'

/** digest 期内的点击埋点 */
export function DigestClickClient({ slug }: { slug: string }) {
    return (
        <button
            className="flex cursor-pointer items-center gap-0.5 border-none bg-none p-0 font-sans text-muted-foreground hover:text-accent"
            onClick={() => track('digest_click', { slug })}
        >
            站内导读
            <ArrowUpRight className="size-3.5" />
        </button>
    )
}
