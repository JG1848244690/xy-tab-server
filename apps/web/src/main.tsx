import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Providers } from '@/components/providers'
import { AuthBootstrap } from '@/components/auth-bootstrap'
import { router } from '@/router'
import { initSentry } from '@/lib/sentry'
import '@/styles/globals.css'

// 必须在 React 挂载前初始化,才能捕获首屏渲染错误
initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <AuthBootstrap>
        <RouterProvider router={router} />
      </AuthBootstrap>
    </Providers>
  </StrictMode>
)
