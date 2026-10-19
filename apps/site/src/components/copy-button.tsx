'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { track } from '@/lib/track'

/** 复制答案到剪贴板(题目页唯一的客户端交互之一) */
export function CopyButton({ text, slug }: { text: string; slug: string }) {
    const [copied, setCopied] = useState(false)

    return (
        <button
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm text-foreground/85 transition-colors hover:border-accent hover:text-accent"
            onClick={() => {
                void navigator.clipboard.writeText(text).then(() => {
                    setCopied(true)
                    track('copy_answer', { slug })
                    setTimeout(() => setCopied(false), 2000)
                })
            }}
        >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? '已复制' : '复制答案'}
        </button>
    )
}
