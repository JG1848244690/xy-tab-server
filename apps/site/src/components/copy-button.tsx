'use client'

import { useState } from 'react'
import { track } from '@/lib/track'

/** 复制答案到剪贴板(唯一的题目页客户端交互;浏览计数由独立的 client 埋点组件负责) */
export function CopyButton({ text, slug }: { text: string; slug: string }) {
    const [copied, setCopied] = useState(false)

    return (
        <button
            className="card"
            style={{ cursor: 'pointer', width: '100%', marginTop: 12 }}
            onClick={() => {
                void navigator.clipboard.writeText(text).then(() => {
                    setCopied(true)
                    track('copy_answer', { slug })
                    setTimeout(() => setCopied(false), 2000)
                })
            }}
        >
            {copied ? '已复制 ✓' : '复制答案'}
        </button>
    )
}
