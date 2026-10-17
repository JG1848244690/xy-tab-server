import { useEffect, useState } from 'react'

/**
 * 移动端断点检测(< 768px,与 Tailwind 的 md 对齐)。
 * 用 matchMedia 而不是监听 resize,浏览器自行去抖,无滚动性能问题。
 */
const QUERY = '(max-width: 767px)'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    // 不给回调标参数类型:lint 的 no-undef 不认识 MediaQueryListEvent
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
