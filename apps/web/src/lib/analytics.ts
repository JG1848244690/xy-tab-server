/**
 * Google Analytics 4(后台 SPA)。
 *
 * SPA 只有一个 HTML,路由切换不会触发新的 page_view,
 * 所以这里关掉自动 page_view,改成监听 router 导航手动上报。
 *
 * ID 走 VITE_GA_ID(.env.production 里是公开值,可入库)。
 */

const GA_ID = import.meta.env.VITE_GA_ID as string | undefined

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/** 上报一次页面浏览 */
function pageview(path: string) {
  if (!GA_ID || typeof window.gtag !== 'function') return
  window.gtag('event', 'page_view', {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title,
  })
}

export function initAnalytics(router: { subscribe: (fn: (state: { location: { pathname: string; search: string } }) => void) => () => void }) {
  if (!GA_ID) return

  // gtag 引导代码(必须在脚本加载前定义)
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { send_page_view: false, anonymize_ip: true })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)

  // 首屏 + 后续每次路由变化
  pageview(window.location.pathname)
  router.subscribe((state) => {
    pageview(state.location.pathname + state.location.search)
  })
}
