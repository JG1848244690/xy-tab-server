'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/react'

/**
 * 前台是 Next 静态导出(`output: export`),没有 Node 运行时,
 * 所以只用浏览器 SDK 做客户端监控;不做 server/edge 初始化。
 *
 * DSN 是公开标识,内置兜底;需要换项目时用 NEXT_PUBLIC_SENTRY_DSN 覆盖。
 */
const DSN =
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    'https://80d53f0c3728f7aa263d8ee228c677b7@o4511579672346624.ingest.us.sentry.io/4512418353119232'

let initialized = false

export function SentryInit() {
    useEffect(() => {
        if (initialized || !DSN) return
        initialized = true

        Sentry.init({
            dsn: DSN,
            environment: process.env.NODE_ENV,
            release: process.env.NEXT_PUBLIC_APP_VERSION,
            tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
            replaysSessionSampleRate: process.env.NODE_ENV === 'development' ? 0.1 : 0.05,
            replaysOnErrorSampleRate: 1.0,
            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
            ],
        })

        // 验证用:本地带 ?sentry-test=1 时抛一条真实错误
        if (
            process.env.NODE_ENV === 'development' &&
            new URLSearchParams(window.location.search).has('sentry-test')
        ) {
            window.setTimeout(() => {
                throw new Error(`Sentry test error site ${Date.now()}`)
            }, 1500)
        }
    }, [])

    return null
}
