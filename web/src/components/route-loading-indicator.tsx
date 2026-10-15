import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export function RouteLoadingIndicator() {
  const { pathname } = useLocation()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-primary/20">
      <div
        className="h-full bg-primary animate-[loading_1s_ease-in-out_infinite]"
        style={{ width: '30%' }}
      />
    </div>
  )
}
