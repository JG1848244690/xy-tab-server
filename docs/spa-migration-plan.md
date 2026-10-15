# hlsEdu 前端:Next.js → Vite SPA 重写 + 部署 工作指令

> 这是给**执行重写的 AI** 的工作指令(work order),不是给最终用户看的文档。
> 请严格按本文件的决策执行;遇到本文件没覆盖的取舍,先把问题列出来问,不要自行扩大范围。
>
> 撰写人已实地核对过:源码结构、Next 专有 API 的每一处调用、后端已实现/未实现的接口、
> 服务器现状(nginx / 证书 / DNS / 目录 / 端口)、CI 现状。文中"已核对"的部分不要重新猜。

---

## 0. 摘要:要做什么

把**已经存在的** Next.js 前端(`C:\Users\xy\Desktop\hlsEdu\web-front`)重写成
**Vite + React Router 的纯静态 SPA**,放进后端仓库 `xy-tab-server` 的 `web/` 子目录,
并加一条 CI 把它部署到服务器的 `/opt/hls-web`(与后端 `/opt/hls-api` 同一父目录),
对外入口是新子域名 `hls.kskbl.com.cn`。

**已定决策(不要改):**

| # | 决策 | 说明 |
|---|------|------|
| 1 | 目标形态:**Vite + React Router** | 不是 `next output: 'export'`。彻底不要 Node 运行时 |
| 2 | **砍掉** 练习 / 课程 / 上传 三个模块 | 新后端没有 `videos` / `recommendations` / `/users/avatar` 接口 |
| 3 | 前端放进**后端仓库**的 `web/` 子目录 | 复用同一份 CI secrets;分支用 `hls-api` |
| 4 | 上传文件**只拷 avatars** | 你本机 `uploads/` 有 1.6GB,绝大部分是被砍的视频 HLS 切片 |
| 5 | 入口:**新子域名** `hls.kskbl.com.cn` | 不动 `kskbl.com.cn` 现有文档站和它的 `/api` |

**不要碰的东西:**

- 后端 `src/**` 一行都不要改(除了 `.dockerignore`、`.github/workflows/ci.yml` 的两处 path 过滤,见 §9)
- `/opt/tasks-api`、kskbl.com.cn 的现有站点和 vhost
- 已有的 `/opt/hls-api` 部署方式

---

## 1. 现状盘点

### 1.1 源码位置

- **源码(唯一来源)**:`C:\Users\xy\Desktop\hlsEdu\web-front`
- 它属于 `C:\Users\xy\Desktop\hlsEdu` 这个 monorepo(还有个老的 `web-backend` NestJS,与本任务无关,不要动)
- 该 repo **没有 remote**,所以是"搬家"而不是"迁移历史"
- 未提交的本地改动:`web-front/src/app/layout.tsx`(无关紧要,直接以工作区内容为准)

### 1.2 技术栈(已核对 `package.json`)

Next **16.0.10** / React 19.2.1 / TypeScript 5 / Tailwind **v4**(`@tailwindcss/postcss`,CSS 里是 `@import 'tailwindcss'`)、
状态用 zustand(+persist)、数据用 @tanstack/react-query、表格 react-table、
UI 是 shadcn 风格 + radix、图表 recharts、日历 fullcalendar、编辑器 monaco + md-editor-rt、
画板 @antv/x6、图标 lucide + iconify、主题 next-themes、HTTP axios。

### 1.3 Next 专有接触面(**全量清单,这就是改造范围的边界**)

已逐个核对,除下列之外**没有任何** Next 专有代码:

| 类别 | 位置 | 处置 |
|---|---|---|
| `next/headers` 的 `cookies()` + SSR fetch | `src/app/layout.tsx` | **重写**成客户端启动逻辑(§5) |
| `redirect()`(服务端/渲染期) | `src/app/page.tsx`、`src/app/register/page.tsx` | 删;改用 `<Navigate>` |
| middleware(空实现) | `src/proxy.ts` | 删 |
| `next/link` | `src/app/(dashboard)/layout.tsx`、`src/components/dashboard-nav.tsx` | 换 `react-router` 的 `Link` |
| `next/navigation` 的 `useRouter` | 9 个文件(见 §4 表) | 换 `useNavigate` |
| `next/navigation` 的 `usePathname` | `breadcrumb.tsx`、`dashboard-nav.tsx`、`route-loading-indicator.tsx` | 换 `useLocation().pathname` |
| `next/navigation` 的 `useParams` | `courses/[id]`(要删)、`test-center/practice/[id]` | react-router 同名 API,基本不用改 |
| `Metadata` 类型 | `src/app/layout.tsx` | 挪到 `index.html` 的 `<title>`/`<meta>` |
| `next-themes` | 7 处 | **可以保留**(纯客户端库,不依赖 Next 运行时) |
| `next.config.ts` 的 rewrites | 全项目 | 删;改由 nginx / Vite dev proxy 承担(§6) |
| `components.json` 里的 `rsc: true` | shadcn 配置 | 改成 `false`(仅影响以后 shadcn add) |

**确认过没有的**(所以改造量小):`next/image`、`next/font`、`next/dynamic`、
route handler(`route.ts`)、server action(`'use server'`)、`generateStaticParams`、
`generateMetadata`、`revalidate`、`export const dynamic`、自定义 404/error 边界。

> 全项目 **71/109** 个文件带 `'use client'` —— 说明它本质就是客户端应用,
> 唯一的服务端逻辑就是 §1.3 第一行那个 `cookies()`。

### 1.4 路由清单与处置(已核对 `src/app` 目录树)

| Next 路由 | 新路由 | 页面文件 | 处置 |
|---|---|---|---|
| `/` | `/` | `app/page.tsx` | 改成 `<Navigate>`,见 §4 |
| `/login` | `/login` | `app/login/page.tsx` | 保留 |
| `/register` | `/register` | `app/register/page.tsx` | 内容只有一句 `redirect('/login')`,改成 `<Navigate to="/login" replace>` |
| `/home` | `/home` | `(dashboard)/home/page.tsx` | 保留(**要清掉 videos/courses 相关渲染**) |
| `/todos` | `/todos` | `(dashboard)/todos/page.tsx` | 保留 |
| `/test-center` | `/test-center` | `(dashboard)/test-center/page.tsx` | 保留(题库) |
| `/test-center/practice/[id]` | `/test-center/practice/:id` | `(dashboard)/test-center/practice/[id]/page.tsx` | 保留 |
| `/statistics` | `/statistics` | `(dashboard)/statistics/page.tsx` | 保留 |
| `/settings` | `/settings` | `(dashboard)/settings/page.tsx` | 保留但要**卸掉推荐 tab + 头像上传**,见 §5.4 |
| `/drawer` | `/drawer` | `(dashboard)/drawer/page.tsx` | 保留(纯前端 x6 画板) |
| `/practice` | — | `(dashboard)/practice/page.tsx` | **删**(依赖 `recommendations`) |
| `/courses`、`/courses/[id]` | — | `(dashboard)/courses/**` | **删**(依赖 `videos`) |
| `/upload` | — | `(dashboard)/upload/**` | **删**(依赖 `/videos/upload/*`) |
| `/test` | — | `(dashboard)/test/page.tsx` | **删**(开发者 playground,导航里没有) |
| `/testList` | — | `(dashboard)/testList/**` | **删**(虚拟列表 demo,导航里没有) |

### 1.5 前端调的接口 vs 新后端能力(已核对两边)

**能用**(新后端已实现,契约见后端 `README.md`):
`POST /auth/login`、`POST /auth/logout`、`GET /auth/me`、
`/questions`(CRUD + `submit` + `attempts` + 判分)、
`/stats/*`(7 个)、`/todos/*`(7 个)。

**不能用**(新后端没有,所以 §1.4 里对应页面要删):
`/videos/*`(video 模块当初就从重写范围里砍了)、`/recommendations/*`(5 个)、
`POST /users/avatar`、以及 `/uploads/**` 静态文件(后端压根不服务)。

> 头像:数据库里 `users.avatarPath` 的值形如 `/uploads/avatars/xxx.jpg`(已随数据迁移过来)。
> 新方案是 **nginx 直接 serve `/uploads/`**(§9.4),所以前端只要把
> `env.apiUrl + avatarPath` 改成"同源相对路径"即可,不要删头像显示。

---

## 2. 目标产物

### 2.1 仓库布局

```
xy-tab-server/                 (git 仓库,分支 hls-api)
├─ src/ scripts/ deploy/       # 后端,不要动
├─ docs/
│  └─ spa-migration-plan.md    # 本文档
├─ web/                        # ★ 新增:前端 SPA(独立 npm 工程)
│  ├─ index.html
│  ├─ vite.config.ts
│  ├─ tsconfig.json  tsconfig.node.json
│  ├─ package.json   package-lock.json
│  ├─ .env.example  .env.local(gitignore)
│  ├─ eslint.config.mjs  .prettierrc  .prettierignore
│  └─ src/
│     ├─ main.tsx                # 入口:createRoot + RouterProvider
│     ├─ router.tsx              # ★ 路由表(替代文件系统路由)
│     ├─ layouts/
│     │  └─ dashboard-layout.tsx # 原 (dashboard)/layout.tsx,children → <Outlet/>
│     ├─ pages/                  # 原 src/app/(dashboard)/* 与 login 原样搬过来
│     ├─ components/             # 原样搬
│     ├─ services/  store/  lib/ # 原样搬
│     └─ styles/
│        ├─ globals.css          # 原 src/app/globals.css
│        └─ themes.css           # 原 src/app/themes.css
└─ .github/workflows/
   ├─ ci.yml                     # 后端(只加 path 过滤)
   └─ web.yml                    # ★ 新增:前端 build + scp 部署
```

> **关键:目录结构原样保留**,包括文件名 `page.tsx` 和那个 `[id]` 目录名。
> React Router 的路由完全由 `router.tsx` 决定,和文件路径无关;
> 原样保留能保证**文件夹内的相对 import(如 `./components/QuestionPanel`)一个都不用改**。
> 唯一搬动位置的是 `(dashboard)/layout.tsx` → `src/layouts/dashboard-layout.tsx`。

### 2.2 `web/` 是独立 npm 工程,不要并进 pnpm workspace

根目录 `pnpm-workspace.yaml` 里没有 `packages:` 全局匹配(只有 `allowBuilds`),
但仍然**明确使用 npm**(有自己的 `package-lock.json`),这样后端的
`pnpm install --frozen-lockfile` 完全不受影响。**不要**在根 `package.json` 里加 workspace。

### 2.3 三条不能破的契约(与后端 README 对偶)

1. **后端路由不带前缀**。前端 axios 的 `baseURL` 必须是 `/api-hls`(生产走 nginx 子路径,
   本地走 Vite dev proxy),由外层剥掉前缀打到后端根路径。**前端不要自己去拼 `/api-hls/questions` 之外的怪东西**。
2. **`/auth/me` 返回的字段是 `name`**(不是 `username`)。`auth-store` 的 `User` 就爱读 `name`,保持。
3. **cookie 是 HttpOnly + 同源**。生产是同源(`hls.kskbl.com.cn` 自己反代 `/api-hls`),
   所以 `withCredentials: true` 保持不变,不要改成 token 放 localStorage。

---

## 3. 阶段 A:搬源码 + 搭 Vite 骨架

### A1. 复制源码(排除构建产物)

从 `C:\Users\xy\Desktop\hlsEdu\web-front` 复制到 `xy-tab-server\web`,**排除**
`node_modules/`、`.next/`、`next-env.d.ts`、`next.config.ts`、`.env.local`、`hls_edu.sql`。

复制:`src/`、`public/`(可只留有用图标,见 A6)、`postcss.config.mjs`(可删,见 A4)、
`eslint.config.mjs`、`.prettierrc`、`.prettierignore`、`components.json`、`LICENSE`。

### A2. 目录改名

```
web/src/app/(dashboard)/*   →  web/src/pages/*
web/src/app/login           →  web/src/pages/login
web/src/app/globals.css     →  web/src/styles/globals.css
web/src/app/themes.css      →  web/src/styles/themes.css
web/src/app/(dashboard)/layout.tsx → web/src/layouts/dashboard-layout.tsx
删除:web/src/app/layout.tsx、web/src/app/page.tsx、web/src/app/register/page.tsx、web/src/proxy.ts
```

### A3. `web/package.json`

沿用现有依赖的版本号(**不要顺手升级**),按下面规则增删:

- **删**:`next`
- **加**:`react-router-dom`(v7;若装到的是 `react-router` v7 单包版也行,import 路径统一用 `react-router-dom`)
- **加 dev**:`vite`、`@vitejs/plugin-react`、`@tailwindcss/vite`
- **删 dev**:`babel-plugin-react-compiler`(Next 里本来就是注释掉没启用)、`@types/node` 保留
- **删**(随模块砍掉):`hls.js`、`react-player`
- 其余全保留(`@antv/x6*`、`@fullcalendar/*`、`recharts`、`monaco-editor`、`@monaco-editor/react`、
  `md-editor-rt`、`next-themes`、`radix-ui` 及各 `@radix-ui/*`、`zustand`、`axios`、`dayjs`、`date-fns`、
  `react-day-picker`、`react-resizable-panels`、`ahooks`、`@iconify/react`、`lucide-react`、
  `@tanstack/*`、`class-variance-authority`、`clsx`、`tailwind-merge`、`tw-animate-css`)

scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 4173",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx"
  }
}
```

> 注意:`tsc --noEmit` 放在 `vite build` 前(CI 要挡住类型错误)。
> `type: "module"` 记得加。

### A4. `web/vite.config.ts`

```ts
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // 本地开发时模拟生产 nginx:剥掉 /api-hls 前缀再打后端
      '/api-hls': {
        target: process.env.VITE_DEV_BACKEND ?? 'http://127.0.0.1:9999',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api-hls/, ''),
      },
      // 头像等上传文件:新后端不服务 /uploads,本地看头像会 404,属预期
      '/uploads': {
        target: process.env.VITE_DEV_BACKEND ?? 'http://127.0.0.1:9999',
        changeOrigin: true,
      },
    },
  },
})
```

用了 `@tailwindcss/vite` 之后 **`postcss.config.mjs` 可以删掉**(不要两边都留)。
`globals.css` 里的 `@import 'tailwindcss'` 原样保留即可(Tailwind v4 语法)。

### A5. `web/index.html`

```html
<!doctype html>
<html lang="en" suppressHydrationWarning>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Athena Learning Platform</title>
    <meta name="description" content="AI-Powered Adaptive Learning System" />
  </head>
  <body class="w-screen h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

> 原 `app/layout.tsx` 的 `<html lang="en" suppressHydrationWarning>` 和
> `<body className="w-screen h-screen">` 就搬到这里。

### A6. `web/tsconfig.json`

基于原来的改:`include` 去掉 `next-env.d.ts`、`.next/**`;`plugins` 里的 `{ "name": "next" }` 删掉;
`jsx` 保持 `react-jsx`;`paths` 的 `"@/*": ["./src/*"]` 保留;
新增 `types: ["vite/client"]`(用 `import.meta.env` 需要)。

`public/` 里的 `next.svg` / `vercel.svg` 可以删,其余保留。

---

## 4. 阶段 B:路由

新建 `web/src/router.tsx`,用 `createBrowserRouter`:

```tsx
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import DashboardLayout from '@/layouts/dashboard-layout'
import LoginPage from '@/pages/login/page'
import HomePage from '@/pages/home/page'
import TodosPage from '@/pages/todos/page'
import TestCenterPage from '@/pages/test-center/page'
import PracticePage from '@/pages/test-center/practice/[id]/page'
import StatisticsPage from '@/pages/statistics/page'
import SettingsPage from '@/pages/settings/page'
import DrawerPage from '@/pages/drawer/page'
import { useAuthStore } from '@/store/auth-store'

function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  return <Navigate to={user ? '/home' : '/login'} replace />
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <Navigate to="/login" replace /> },
  {
    element: <RequireAuth><DashboardLayout /></RequireAuth>,
    children: [
      { path: '/home', element: <HomePage /> },
      { path: '/todos', element: <TodosPage /> },
      { path: '/test-center', element: <TestCenterPage /> },
      { path: '/test-center/practice/:id', element: <PracticePage /> },
      { path: '/statistics', element: <StatisticsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/drawer', element: <DrawerPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
```

**改动点:**

1. 原 `(dashboard)/layout.tsx` 的 `children` prop → `<Outlet />`
   (它现在是 `src/layouts/dashboard-layout.tsx`)。
2. `app/page.tsx` 的行为是"永远去 /login";上面 `RootRedirect` 改成"已登录去 /home"
   —— 这是**有意的行为改进**(原来已登录访问 `/` 也会被踢到 /login)。如不想要,直接
   `<Navigate to="/login" replace />`。
3. 动态段用 `:id`(`courses/[id]` 已删,只剩 practice 一个)。

`web/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AuthBootstrap } from '@/components/auth-bootstrap'
import { router } from '@/router'
import '@/styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthBootstrap>
      <RouterProvider router={router} />
    </AuthBootstrap>
  </StrictMode>,
)
```

---

## 5. 阶段 C:逐文件替换(照抄这张表)

**先做一遍机械替换,再逐个人工过一遍。**

### 5.1 全局机械替换

| 原文 | 换成 |
|---|---|
| `import Link from 'next/link'` | `import { Link } from 'react-router-dom'` |
| `<Link href={x}>` | `<Link to={x}>` |
| `import { useRouter } from 'next/navigation'` | `import { useNavigate } from 'react-router-dom'` |
| `const router = useRouter()` | `const navigate = useNavigate()` |
| `router.push(x)` | `navigate(x)` |
| `router.replace(x)` | `navigate(x, { replace: true })` |
| `router.back()` | `navigate(-1)` |
| `import { usePathname } from 'next/navigation'` | `import { useLocation } from 'react-router-dom'` |
| `const pathname = usePathname()` | `const { pathname } = useLocation()` |
| `import { useParams } from 'next/navigation'` | `import { useParams } from 'react-router-dom'`(同名,调用不用改) |

**顺带把全部 `'use client'` / `"use client"` 指令行删掉**(共 71 个文件,SPA 里没有意义)。

### 5.2 `router.push/replace/back` 的全部 17 处(已核对,逐处确认)

- `components/auth/login-form.tsx:29` `push('/home')`
- `components/user-nav.tsx:35` `replace('/login')`、`:61` `push('/settings')`
- `pages/home/page.tsx:77`(→ `/courses`,**删**)、`:149`、`:239`(→ `/test-center/practice/:id`,保留)、
  `:195`(→ `/courses`,**删**)
- `pages/test-center/codeCol.tsx:25`、`strCol.tsx:25`
- `pages/statistics/components/IncompleteQuestionsList.tsx:76`、`RecentQuestionsList.tsx:110`
- `pages/test-center/practice/[id]/components/PracticeHeader.tsx:52` `back()`
- `pages/courses/**`、`pages/practice/page.tsx:220` → 整个文件要删,不用管

### 5.3 `next/headers` 的 SSR 认证 → 客户端启动

原 `src/app/layout.tsx` 干了两件事:服务端 `cookies()` 读 `Authentication`、SSR `fetch(BACKEND_URL/auth/me)`、
把 user 塞给 `StoreInitializer`。SPA 里改成:

新增 `web/src/components/auth-bootstrap.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { authService } from '@/services/auth-service'
import { useAuthStore } from '@/store/auth-store'

/**
 * 替代原 Next 根 layout 的 SSR 取用户逻辑。
 * 放在 RouterProvider 外层:先确定登录态,再渲染任何路由,避免"先闪一下 dashboard 再跳登录"。
 * 注意 auth-store 用了 persist,刷新时 localStorage 里已有 user,这里只是拿服务端真值校准。
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    authService
      .me()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [setUser])

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }
  return <>{children}</>
}
```

新增 `RequireAuth`(放 `web/src/components/require-auth.tsx`):

```tsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth-store'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}
```

然后**删掉** `web/src/components/store-initializer.tsx`(没有 SSR 就不需要这个桥了)。

`lib/request.ts` 的 401 拦截器保留;可选改进:把 `window.location.href = '/login'` 保留即可
(SPA 里整页跳转也能用,代价是多一次加载,不值得为此引入 router 依赖)。

### 5.4 `pages/settings/page.tsx` 要卸掉两块

已核对:它有两个 Tab,`profile` 和 `recommendations`。

- **删掉 `recommendations` 整个 Tab**(`recommendationsApi.getPreferences/getStrategies/updatePreferences`
  依赖的接口新后端没有)
- **删掉头像上传**:`const [avatar, setAvatar] = useState<File|null>(null)`、`FormData` / `POST /users/avatar` 那段
  (新后端没有该接口)。**头像显示要留**,把 `src={`${env.apiUrl}${user.avatarPath}`}` 改成 `src={assetUrl(user.avatarPath)}`(§6)
- 用户信息来自 `useAuthStore`,不用改

### 5.5 `pages/home/page.tsx` 要清 videos/courses

已核对:它读了 `stats.videos.*`,还有两处 `navigate('/courses')`("开始学习"按钮)。

- 删掉"开始学习/继续学习"这类跳 `/courses` 的入口(整块卡片,连同 `stats.videos` 的读取)
- 问题列表、最近作答等用 `/questions`、`/stats/*` 的部分保留

> 后端 `/stats/dashboard` 仍然返回结构完整的 `videos` 空对象(这是给老前端的兼容契约,
> 见后端 README)。SPA 不再需要它,但**不需要后端改**,前端不读就行。

### 5.6 要删的文件清单

```
web/src/proxy.ts
web/src/pages/courses/**                 (含 [id]/、components/、loading.tsx)
web/src/pages/practice/**
web/src/pages/upload/**
web/src/pages/test/**
web/src/pages/testList/**
web/src/components/HlsPlayer.tsx
web/src/services/videos-api.ts
web/src/services/recommendations-api.ts
web/src/lib/chunk-uploader-with-worker.ts
web/src/components/store-initializer.tsx
web/src/app/layout.tsx                   (若 A2 还没处理)
next.config.ts / next-env.d.ts / .next/
postcss.config.mjs                       (改用 @tailwindcss/vite 后)
```

`web/src/components/dashboard-nav.tsx` 里 `navItems` **删掉三项**:
`练习(/practice)`、`课程(/courses)`、`上传(/upload)`;保留
`首页 / 打卡 / 题库 / 画板 / 统计 / 设置`。
`breadcrumb.tsx` 依赖 `navItems` 的 `children` 映射,**题库那项的 `children` 要保留**
(`'practice/[id]'` 这个 key 的形状是给 breadcrumb 用的,别动)。

`components/auth/register-form.tsx` 疑似死代码(注册页只有一句 redirect)—— 确认没人引用后删。

---

## 6. 阶段 D:接口地址与环境变量

`web/src/lib/env.ts` 改成:

```ts
/**
 * apiBase  : axios 的 baseURL。生产 = nginx 子路径 /api-hls(外层剥前缀);
 *            本地 = 同一个值,由 vite.config.ts 的 dev proxy 转发到后端。
 * assetBase: 头像等由 nginx 直接服务的静态资源前缀。生产同源留空即可;
 *            本地想看到头像就指到某个能服务 /uploads 的服务(留空则本地 404,可接受)。
 */
export const env = {
  apiBase: import.meta.env.VITE_API_BASE ?? '/api-hls',
  assetBase: import.meta.env.VITE_ASSET_BASE ?? '',
}

/** 把后端返回的相对路径(如 /uploads/avatars/x.jpg)拼成可直接用的 URL */
export const assetUrl = (p?: string | null) => (p ? `${env.assetBase}${p}` : '')
```

- `lib/request.ts`:`baseURL: '/api'` → `baseURL: env.apiBase`
- `components/user-nav.tsx`、`pages/settings/page.tsx`:`${env.apiUrl}${user.avatarPath}` → `assetUrl(user.avatarPath)`
- `web/.env.example`:
  ```
  # 生产由 nginx 把 /api-hls 反代到后端;一般不用改
  VITE_API_BASE=/api-hls
  # 头像等静态资源前缀;同源部署留空
  VITE_ASSET_BASE=
  ```
- `.gitignore` 里加上 `web/node_modules`、`web/dist`、`web/.env.local`、`web/.env`

> ⚠️ 注意 `import.meta.env` 只在构建时替换:`VITE_*` 的值会**打进 bundle**,
> 所以它只能放非机密的东西。这里恰好都是非机密。

---

## 7. 阶段 E:跑起来 + 自测

```powershell
cd D:\code-gh\xy-tab-server\web
npm install
npm run typecheck
npm run lint
npm run dev        # http://localhost:3000
```

自测前提:后端本地已起(默认 `9999`,见后端 README 的 `pnpm dev`);
或把 `VITE_DEV_BACKEND` 指到服务器 `http://127.0.0.1:4000`(需要 SSH 隧道,见 §9.5)。

自测项见 §11 验收清单的前半部分。

**构建产物要检查**:`npm run build` 后 `web/dist/index.html` 存在,
且 `dist/assets/*.js` 里有 hash 文件名(用于 nginx 长缓存)。

**体积**:monaco / x6 / recharts 都属于重依赖。如果 `dist/` 超过警戒,
用 `React.lazy` + `<Suspense>` 把 `/drawer`(x6)、`/test-center/practice/:id`(monaco)、
`/statistics`(recharts)三个路由改成懒加载。**这是可选优化,不要为了它改业务代码结构。**

---

## 8. 阶段 F:部署(服务器侧)

### 8.1 目标布局

```
/opt/hls-api/            # 已有:后端 compose 项目
/opt/hls-web/            # ★ 新增(与 hls-api 同一父目录)
├─ releases/
│  └─ <git-sha>/         # 每次部署一份完整 dist,保留最近 5 份
├─ current -> releases/<git-sha>   # 原子切换的符号链接
└─ uploads/
   └─ avatars/           # 旧上传文件(只拷 avatars),**不在 releases 里**,部署不覆盖
```

目录由 CI 自己 `mkdir -p`,不需要手工建。**但 nginx 以 `www` 用户跑**,
所以部署脚本末尾必须 `chmod -R a+rX /opt/hls-web/releases /opt/hls-web/current`。

### 8.2 DNS —— **已完成,无需再做**

已加好 **A 记录 `hls` → `47.94.85.91`,代理开启(橙云)**。实测:

- 公网(DoH @1.1.1.1):`188.114.96.2` / `188.114.97.2`
- 服务器上:`2606:4700:3035::6815:1179`(`104.21.17.121`)等,与 `kskbl.com.cn` 同一组边缘
- `http://` 返回 `301 → https://`(CF 的 Always Use HTTPS 生效)

> 橙云是硬要求:`kskbl.com.cn` 的 SSL 用的是 Cloudflare **Origin 证书**,
> 不是公信证书;灰云(仅 DNS)会让浏览器直接拿到 origin 证书而报错。

### 8.3 证书 —— **无需申请,已实测确认**

服务器上 `/www/server/panel/vhost/cert/cloudflare/origin.pem` 的 SAN 是
**`DNS:*.kskbl.com.cn, DNS:kskbl.com.cn`**,有效期到 **2041-10-08** ——
新子域名直接复用这一对。

已实测验证:现在访问 `https://hls.kskbl.com.cn/` 能完成 TLS 握手并返回 `308`
(而不是 `525`/`526`),说明 CF 的 SSL 模式是 完全(严格)、且它接受这张 Origin 证书。
**不要**去改成 Flexible,也不要去签新证书。

### 8.4 nginx vhost

新建 `/www/server/panel/vhost/nginx/hls.kskbl.com.cn.conf`
(可直接手写,结构照抄现有 `html_kskbl.com.cn.conf`;宝塔面板里不会显示它,这没关系):

```nginx
server {
    listen 80;
    listen 443 ssl;
    listen 443 quic;
    http2 on;
    server_name hls.kskbl.com.cn;

    root /opt/hls-web/current;
    index index.html;

    # 复用通配的 Cloudflare Origin 证书
    ssl_certificate     /www/server/panel/vhost/cert/cloudflare/origin.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/cloudflare/origin.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    error_page 497  https://$host$request_uri;

    # ---- SPA:静态文件优先,未命中一律回 index.html,交给客户端路由 ----
    location / {
        try_files $uri $uri/ /index.html;
    }

    # index.html 不缓存(否则发版后用户还拿旧壳)
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # 带 hash 的静态资源长缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ---- 后端 API:和 kskbl.com.cn/api-hls 指向同一个容器(宿主 4000)----
    # proxy_pass 末尾的 / 会剥掉 /api-hls 前缀;后端路由本来就是根路径
    location /api-hls/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
    location = /api-hls {
        return 301 /api-hls/;
    }

    # ---- 旧上传文件(头像)。alias 末尾斜杠必须和 location 一致 ----
    location /uploads/ {
        alias /opt/hls-web/uploads/;
        expires 7d;
        access_log off;
    }

    access_log /www/wwwlogs/hls.kskbl.com.cn.log;
    error_log  /www/wwwlogs/hls.kskbl.com.cn.error.log;
}
```

另把这份配置**存一份进仓库** `deploy/nginx/hls.kskbl.com.cn.conf`(和后端那份
`deploy/nginx/kskbl.com.cn-api-hls.conf` 并列),保持基础设施可追溯。

生效:

```bash
nginx -t && nginx -s reload
```

> ⚠️ 后端已有的 `/api-hls` 是在 `kskbl.com.cn` 的 vhost 里配的,那是**另一个入口**,
> 两个入口指向同一个容器,**不冲突也不用改**。

### 8.5 拷头像(在本地机器执行)

```powershell
ssh root@47.94.85.91 "mkdir -p /opt/hls-web/uploads"
scp -r "C:\Users\xy\Desktop\hlsEdu\web-backend\uploads\avatars" root@47.94.85.91:/opt/hls-web/uploads/
```

**只拷 avatars**(几 MB)。`uploads/` 里另有 `hls/`、`chunks/`、`covers/`、`temp/`
合计约 1.6GB,是已砍掉的视频模块的切片,**不要拷**(服务器磁盘只剩不到 10G)。

数据库里 `users.avatarPath` 就是 `/uploads/avatars/<file>`,所以 nginx 那条 `location /uploads/`
配上之后头像即生效。

### 8.6 首次部署(手工,先于 CI)

CI 首次跑之前目录不存在也没关系(CI 会建),但建议先手工跑一次把路径打通:

```bash
# 本地
cd D:\code-gh\xy-tab-server\web
npm run build
# 传到服务器
ssh root@47.94.85.91 "mkdir -p /opt/hls-web/releases/manual"
scp -r dist\* root@47.94.85.91:/opt/hls-web/releases/manual/
ssh root@47.94.85.91 "cd /opt/hls-web && ln -sfn releases/manual current.tmp && mv -Tf current.tmp current && chmod -R a+rX releases current && ls -l current"
```

---

## 9. 阶段 G:CI

### 9.1 新增 `.github/workflows/web.yml`

secrets 用**仓库里已有的**那三个(后端已经在用):`SERVER_HOST` / `SERVER_USER` / `SERVER_SSH_KEY`。

```yaml
name: Web CI

on:
  push:
    branches: [hls-api]
    paths:
      - 'web/**'
      - '.github/workflows/web.yml'
  workflow_dispatch:

concurrency:
  group: web-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-deploy:
    name: build · deploy static
    runs-on: ubuntu-latest
    timeout-minutes: 15

    env:
      DEPLOY_DIR: /opt/hls-web

    defaults:
      run:
        working-directory: web

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - name: Install
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

      - name: Upload dist to server
        # 传到 releases/<sha>/,此时还没切 current,线上不受影响
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          source: 'web/dist/*'
          target: '${{ env.DEPLOY_DIR }}/releases/${{ github.sha }}'
          strip_components: 2
          overwrite: true

      - name: Atomic switch + cleanup
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          # 必须显式声明:script 是原样发到远端执行的,不声明的话远端读不到
          envs: DEPLOY_DIR,SHA
          script: |
            set -e
            cd "$DEPLOY_DIR"
            # nginx 以 www 用户跑,必须有读权限
            chmod -R a+rX "releases/$SHA"
            # 原子切换:先建临时链接再 mv -Tf,避免出现半个链接
            ln -sfn "releases/$SHA" current.tmp
            mv -Tf current.tmp current
            echo "=== current -> $(readlink current) ==="
            # 只保留最近 5 份
            ls -1dt releases/*/ | tail -n +6 | xargs -r rm -rf
            ls -1dt releases/*/ | head -6
        env:
          DEPLOY_DIR: ${{ env.DEPLOY_DIR }}
          SHA: ${{ github.sha }}
```

> `appleboy/scp-action` 的 tag 若 `v0.1.7` 不可用,换成仓库当时可用的最新 tag
> (后端 `ci.yml` 用的是 `appleboy/ssh-action@v1`,两处保持一致风格即可)。

### 9.2 后端 `ci.yml` 的 path 过滤 —— **已完成,无需再做**

前端进同一个仓库后,只改前端也会触发后端 workflow(重新 build 镜像、
甚至在 hls-api 分支上重启后端容器)。这个过滤已经加好了:

```yaml
on:
  push:
    branches: ['**']
    paths-ignore:
      - 'web/**'
      - 'docs/**'
      - '**.md'
  pull_request:
    branches: [master, main, hls-api]
    paths-ignore:
      - 'web/**'
      - 'docs/**'
      - '**.md'
```

语义是「本次 diff **全**落在这些路径里才跳过」,前后端混改时照常触发。
已用一次纯 docs 提交实测验证:workflow 不运行、GHCR 不出新 tag、容器不重启。

> ⚠️ 唯一前提:仓库不能把 `ci` 设成 branch protection 的必需检查,
> 否则只改前端的 PR 会因 `ci` 未运行而卡住。个人仓库一般没开;
> 若开了,就在 `web.yml` 里补一个同名 job。

### 9.3 `.dockerignore` 加 `web` / `docs` —— **已完成,无需再做**

后端镜像的 Dockerfile 有 `COPY . .`,不排除 `web/` 的话每次前端改动都会让这层
缓存失效(白跑一次后端构建)。`web` 和 `docs` 已经加进 `.dockerignore` 了。

---

## 10. 交付顺序(建议 commit 粒度)

1. `chore(web): 从 web-front 搬入 Vite SPA 骨架`(只搬 + Vite 骨架,先能 `npm run dev` 起来)
2. `refactor(web): Next 路由/API 替换为 React Router`(§4、§5 的机械部分)
3. `refactor(web): 认证改为客户端 bootstrap`(§5.3)
4. `refactor(web): 砍掉练习/课程/上传模块`(§5.4-5.6)
5. `feat(web): 接口地址改 /api-hls + 头像走同源`(§6)
6. `ci(web): 新增 web.yml`(§9.1;后端的 path 过滤与 `.dockerignore` 已提前做好)
7. `docs: 前端部署说明`(§8 的 nginx/目录结论写进 README 或 HANDOFF)

---

## 11. 验收清单

**本地(§7)**

- [ ] `npm run typecheck`、`npm run lint`、`npm run build` 三条都过
- [ ] `npm run dev` → `/` 跳转正确;未登录访问 `/home` 被踢到 `/login`
- [ ] 登录成功 → `/home` 显示(用户名/头像来自 `/auth/me`)
- [ ] 刷新任意深层页面(如 `/test-center/practice/<真实id>`)不白屏、不 404
- [ ] `/todos` 日历能读能写(`/todos/by-month`、`toggle`)
- [ ] `/test-center` 列表、搜索、按标签筛(`?tag=算法`)、进题目详情、提交作答、判分
- [ ] `/statistics` 六个统计接口都有数据(recharts 正常渲染)
- [ ] `/settings` 只剩 profile tab,头像显示正常,没有推荐相关 UI
- [ ] `/drawer` 画板能用(x6 正常加载)
- [ ] 导航里**没有** 练习/课程/上传 三项
- [ ] 控制台无 React/React Router 报错
- [ ] 搜索产物里没有 `next`(grep `web/src` 与 `web/dist`)

**线上(§8/§9)**

- [ ] `https://hls.kskbl.com.cn/` 打开是 SPA,证书有效(CF 边缘证书 + origin 通配证书)
- [ ] 深链接直接访问(不是从首页点进去)也能打开,例:`https://hls.kskbl.com.cn/todos`
- [ ] 登录 → HttpOnly cookie 由 `hls.kskbl.com.cn/api-hls/auth/login` 下发,
      刷新后 `/auth/me` 仍是 200(同源,无 CORS/同站问题)
- [ ] 头像能显示(`https://hls.kskbl.com.cn/uploads/avatars/xxx.jpg` 200)
- [ ] `GET https://hls.kskbl.com.cn/api-hls/stats/tag-distribution` 带 cookie 返回 200,数值与
      `https://kskbl.com.cn/api-hls/stats/tag-distribution` 一致
- [ ] 后端老入口没被影响:`https://kskbl.com.cn/api/` 200、`:9999` 容器仍 healthy
- [ ] CI:推一次 `web/` 改动 → web.yml 跑通 → `current` 指向新 SHA;
      旧 releases 只留 5 份;`current` 切换后页面立即是新版本
- [ ] 回滚:把 `current` 手动指回上一个 release 目录,页面即可回滚

---

## 12. 已知坑(照做能避开)

1. **深链接刷新 404** —— 忘了 `try_files ... /index.html`。这是 SPA 部署最常见的翻车点。
2. **发版后用户还在看旧页面** —— `index.html` 必须 `no-cache`,带 hash 的 `/assets/*` 才长缓存。
3. **nginx 403/404 但文件明明在** —— nginx 以 `www` 跑,`/opt/hls-web` 下必须有 `a+rX`。
4. **`mv -Tf` 才是原子切换**。`ln -sfn` 单独用对已存在的链接会变成"在链接目录里建链接"。
5. **`/api-hls` 的 `proxy_pass` 末尾必须带 `/`**(剥前缀),否则后端收到 `/api-hls/questions` 全 404。
6. **头像不显示**,别去改后端:是 nginx 的 `/uploads/` alias 没配,或忘了拷 avatars。
7. **别在 SPA 里引 `next-themes` 之外的任何 `next/*`**(包括 `next/navigation` 的类型):
   `npm run build` 会直接报模块找不到,当作验收项 grep 一遍。
8. **`import.meta.env` 是构建期替换**,改 `.env` 后必须重新 build;别指望运行时改。
9. **旧入口 `kskbl.com.cn` 的文档站和 `/api` 是本任务的红线**,不要为了"顺手统一"去改它的 vhost。
10. **PNPM**:`web/` 用 npm,不要去动根 `pnpm-workspace.yaml`,否则后端 `--frozen-lockfile` 会失败。
11. **进度条/路由 loading**:原 `route-loading-indicator.tsx` 是靠 pathname 变化 + 300ms 定时假装出来的,
    搬到 React Router 后照样能用;想更真实可换 `useNavigation().state === 'loading'`,属可选优化。
12. **`dashboard-nav.tsx` 的 `navItems`** 同时被 `breadcrumb.tsx` 消费,
    删导航项时**只删数组元素**,不要改动 `children` 的结构。
13. **`/opt/hls-web/current` 必须是符号链接,不能是普通目录。**
    CI 的切换是 `ln -sfn releases/$SHA current.tmp && mv -Tf current.tmp current`;
    如果 `current` 是个**非空目录**,`mv -Tf` 直接报 `Directory not empty` 失败 ——
    也就是"部署前先建个占位目录"这种好心操作,会把之后的自动部署搞挂。
    想要占位内容就照 §8.6 那样先建一个 release 目录再链过去,别建实体目录。
14. **新 vhost 落地前,该子域名会落到 443 端口的默认 vhost。**
    实测:`https://hls.kskbl.com.cn/` 返回 `308 → /content`,那是按文件名顺序第一个
    `listen 443 ssl`(`doc.kskbl.com.cn`)在响 —— 也就是说 DNS 配好了但 vhost 还没建时,
    访问这个子域会看到**别的站点的内容**。不是报错但显然不对,尽快按 §8.4 把 vhost 落上。
    (顺带:这也说明回源 TLS 是通的,§8.3 复用通配证书的假设已被实测证实。)

---

## 附录:写作本文件时已提前做完的事

执行者不需要再做这些,知道基线即可:

| commit | 内容 |
|---|---|
| `3f4c7fd` | 本文件入库 |
| `56e1f97` | §9.2 的 `ci.yml` path 过滤 + §9.3 的 `.dockerignore` |

也就是说,你从 §3 开始做即可,§9 里只剩 `web.yml` 一件新事。
**§8.2 的 DNS 和 §8.3 的证书也都已经就绪**(已实测),§8 里只剩 vhost、头像、首次部署。

另外,写本文件时的实测环境事实(万一你复现时对不上):

- 服务器 `root@47.94.85.91`,宝塔面板,内存 1.6G,`/` 剩约 9.7G
- 后端容器 `hls-api-app-1` 发布在宿主 **4000**,PG 在 **5434**;老服务 `tasks-api` 占 9999/5433
- nginx 以 **`www` 用户**运行(所以 `/opt/hls-web` 必须有 `a+rX`)
- `kskbl.com.cn` 根目录是 VitePress 文档站(`/DxyProject/docFont/dist`),不是本 SPA 的位置
- 已迁入生产 PG 的存量数据:users 4 / questions 81 / question_stats 57 /
  question_attempts 100 / todos 102(来自开发机本机 MySQL,非服务器)

