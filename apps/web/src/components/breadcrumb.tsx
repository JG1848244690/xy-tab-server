import React from 'react'
import { useLocation } from 'react-router-dom'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

// 导入导航配置
import { navItems } from './dashboard-nav'

export default function DynamicBreadcrumb() {
  const { pathname } = useLocation()

  const breadcrumbs = generateBreadcrumbs(pathname, navItems)
  if (breadcrumbs.length < 1) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((item, index) => (
          <React.Fragment key={item.href}>
            <BreadcrumbItem>
              {index < breadcrumbs.length - 1 ? (
                <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function generateBreadcrumbs(pathname: string, items: any[]) {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs = []

  // 一级路由
  const firstPath = `/${segments[0]}`
  const firstItem = items.find((item) => item.href === firstPath)

  if (firstItem) {
    breadcrumbs.push({ href: firstPath, label: firstItem.title })

    // 二级路由
    if (segments.length > 1 && firstItem.children) {
      const childPath = segments.slice(1).join('/')
      const childKey = Object.keys(firstItem.children).find((key) => matchPath(childPath, key))

      if (childKey) {
        const childConfig = firstItem.children[childKey]
        const dynamicId = segments[segments.length - 1]
        const label =
          typeof childConfig.breadcrumb === 'function'
            ? childConfig.breadcrumb(dynamicId)
            : childConfig.breadcrumb

        breadcrumbs.push({ href: pathname, label })
      }
    }
  }

  return breadcrumbs
}

function matchPath(path: string, pattern: string) {
  const pathParts = path.split('/')
  const patternParts = pattern.split('/')

  if (pathParts.length !== patternParts.length) return false

  return patternParts.every((part, i) => part.startsWith('[') || part === pathParts[i])
}
