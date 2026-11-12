/**
 * Sentry 初始化(后台 SPA)。
 *
 * DSN 是公开标识,直接内置兜底;需要换环境时用 VITE_SENTRY_DSN 覆盖。
 * 采样:本地全采(traces 1.0),生产 10%;Session Replay 只对报错会话全量录。
 */
import * as Sentry from '@sentry/react'

const DSN =
    (import.meta.env.VITE_SENTRY_DSN as string | undefined) ??
    'https://328a6069513e2ae276baf4d63207f9d9@o4511579672346624.ingest.us.sentry.io/4512418356133888'

const isDev = import.meta.env.DEV

/** 验证用:带 ?sentry-test=1 打开页面会抛一条真实错误(仅本地开发) */
function maybeTriggerTestError() {
    if (!isDev) return
    if (!new URLSearchParams(window.location.search).has('sentry-test')) return

    window.setTimeout(() => {
        throw new Error(`Sentry test error web ${Date.now()}`)
    }, 1500)
}

export function initSentry() {
    if (!DSN) return

    Sentry.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        // 生产由 CI 注入 commit SHA 时可用;没注入就是 undefined,Sentry 会忽略
        release: import.meta.env.VITE_APP_VERSION as string | undefined,
        tracesSampleRate: isDev ? 1.0 : 0.1,
        replaysSessionSampleRate: isDev ? 0.1 : 0.05,
        replaysOnErrorSampleRate: 1.0,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
        ],
    })

    maybeTriggerTestError()
}
