import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Providers } from '@/components/providers'
import { AuthBootstrap } from '@/components/auth-bootstrap'
import { router } from '@/router'
import '@/styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <AuthBootstrap>
        <RouterProvider router={router} />
      </AuthBootstrap>
    </Providers>
  </StrictMode>
)
