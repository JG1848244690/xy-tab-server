# 生产级工程化审查报告(HLS 学习平台 / xy-tab-server)

- **审查日期**:2026-10-16
- **审查范围**:后端 `src/`(Hono + Drizzle + PostgreSQL)、前端 `web/`(React 19 + Vite 8 + react-router 7 + TanStack Query + Zustand + Tailwind 4)、CI(`.github/workflows/`)、部署(`Dockerfile`、`docker-compose.yml`、`deploy/nginx/`)
- **审查方法**:全量通读 + 双路并行深挖(后端 34 个文件逐个确认路由鉴权、错误处理、SQL;前端全 src 扫描 + 构建产物实测),所有结论带 `文件:行号` 证据;关键结论已人工复核(0 处 `db.transaction`、0 处 `lazy(`、onError 裸返回、限流无条件信任 XFF、无 SIGTERM 处理)
- **定位**:本项目目前是「功能完整的单实例内部工具」,本报告回答的问题是——把它当成一个真正的生产级多用户项目,还差什么。

---

## 0. 总体判断

功能层面完整,安全基础(visibility 隔离、登录限流、CORS 白名单、bcrypt)高于同规模项目平均水平。真正的差距集中在四个维度:

1. **可靠性** —— 核心业务写路径(做题提交/判分)没有事务,统计与流水可能永久失配;
2. **可观测性** —— 无健康检查、无优雅停机、错误处理泄露内部信息且绕过日志体系;
3. **质量防线** —— 后端测试只覆盖 auth,前端零测试零钩子,lint 防线被主动关掉;
4. **前端性能** —— 零代码分割,主包 2.4MB,直接放大已知的 Cloudflare 链路慢的痛感。

每一条都有明确、低风险的修法,详见第 4 节路线图。

---

## 1. 后端(src/)

### 1.1 可靠性与数据一致性

#### B1 🔴 跨表写全部没有事务
- **证据**:`src/routes/questions/questions.handlers.ts:335-369`(submit:先 insert `questionAttempts`,再 upsert `questionStats`)
  ```ts
  const [attempt] = await db.insert(questionAttempts).values({...}).returning()
  // ... 中间无事务
  const [updatedStat] = await db.insert(questionStats).values({...}).onConflictDoUpdate({...}).returning()
  ```
  `questions.handlers.ts:405-439`(markCorrect 同病)。全 src/ 无任何 `db.transaction` 调用(grep 确认)。
- **为什么是问题**:两步之间任何一步失败(网络抖动、约束冲突、进程被杀),`question_attempts` 流水与 `question_stats` 汇总永久失配——`attemptCount`/`totalAttempts`/`correctAttempts` 是用户核心指标。另外 `attempt.attemptCount: prevAttempts + 1`(`:342`)是 JS 侧读旧值计算,并发下会丢计数(stats 表已改成 SQL 侧 `totalAttempts + 1`,attempt 表没有)。
- **建议**:submit / markCorrect 包进 `db.transaction(async (tx) => ...)`;attempt 的 attemptCount 一并改为 SQL 侧自增。

#### B2 🔴 注册接口 check-then-insert 竞态,唯一冲突变 500
- **证据**:`src/routes/auth/auth.handlers.ts:69-81`
  ```ts
  const [existing] = await db.select(...).where(eq(users.email, email)).limit(1)
  if (existing) return c.json({ message: 'User already exists' }, 409)
  const [created] = await db.insert(users).values({ email, ... }).returning()
  ```
- **为什么是问题**:并发注册同一邮箱,两边都过查重,后到者撞 `users_email_idx`(`src/db/schema.ts:67`)抛 23505 → 被 onError 吃成 500,且把 PG 错误信息泄露给客户端(见 B7)。
- **建议**:`insert ... onConflictDoNothing({ target: users.email }).returning()`,returning 为空再查一次决定 409。

#### B3 🟡 错误响应格式四分五裂,无统一错误码
- **证据**:同一系统内至少 4 种错误形状——
  - `src/middlewares/auth.ts:32` `{ error: 'Unauthorized' }`
  - `src/routes/auth/auth.handlers.ts:45` `{ message: 'Invalid credentials' }`
  - `src/lib/middlewares.ts:24` `{ error: 'not found' }`
  - `src/routes/todos/todos.handlers.ts:120,133,147` 未找到返回 **400** 而非 404
  - zod 校验失败又是 `{ success: false, error: { issues } }`(`src/lib/openapi.ts:145-157`)
- **建议**:定义唯一 `AppError { code, message, status }` + 统一 envelope `{ error: { code, message, requestId? } }`;todos 的 not-found 改 404。

#### B4 🟡 查询性能隐患
- `questions.handlers.ts:469` `getStats` 全量拉 stats 行进 JS 内存 filter/reduce,应改为一条 `GROUP BY status` 聚合;
- `questions.handlers.ts:453-459` `getAttempts` 无 limit 返回全部作答历史;
- `questions.handlers.ts:214-231` `getOne` 三条顺序 await 可 `Promise.all`;
- `stats.handlers.ts:136,145-146` dashboard 对 `startDate` 列做 `::text` cast(`eq(sql\`${todos.startDate}::text\`, todayStr)`),**索引失效**全扫;schema 里就是 date 模式字符串,直接 `eq(todos.startDate, todayStr)` 即可;
- 深分页:`questions.handlers.ts:146`、`stats.handlers.ts:354/409/448` 均 `offset((page-1)*size)`,数据量大后换 keyset(cursor)。

### 1.2 安全

#### B5 🔴 登录限流可被伪造绕过 + 可被用来限流 DoS 他人
- **证据**:`src/middlewares/rate-limit.ts:50-51`
  ```ts
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  const key = `${c.req.path}:${forwarded || 'unknown'}`
  ```
  无任何「信任代理」判断。`docker-compose.yml:62-65` 把 app 端口直接发布到宿主机(`"${PORT:-9999}:9999"`),绕过 nginx 直连宿主机端口时,攻击者每次换一个 XFF 即可无限绕过 30 req/min 暴力破解限流;反向也能故意带受害者真实 IP 打 `/auth/login`,把受害者顶进限流桶。
  另外 nginx `$proxy_add_x_forwarded_for`(`deploy/nginx/kskbl.com.cn-api-hls.conf:17`)是**追加**而非覆盖,前面还有 Cloudflare 一跳,XFF 取第一段取到的是 CF 看到的客户端 IP 还是伪造值,语义并不严谨。
- **建议**:取 XFF 倒数第 N 段(N = 可信代理层数),或按 REMOTE_ADDR + 信任列表判断;compose 的 app/PG 端口不发布到公网(本地调试用 `profiles:`)。

#### B6 🔴 `/doc` 与 `/reference` 生产公开暴露
- **证据**:`src/lib/configure-open-api.ts:14-35` 无条件注册 Scalar API 文档;`src/app.ts` 未做环境过滤。
- **为什么是问题**:给攻击者免费提供完整 API 面(参数、字段、错误形状)。
- **建议**:`NODE_ENV === 'production'` 且未显式 `ENABLE_API_DOCS=true` 时不注册。

#### B7 🟡 JWT 无服务端失效能力,账号不可封禁
- **证据**:
  - logout 只清 cookie:`auth.handlers.ts:87-90`,token 剩余有效期(~1 天)内照常可用;
  - payload 只有 `{ email, sub }`,无 `jti`/版本号:`src/lib/auth.ts:27-33`;
  - users 表无 `status`/`tokenVersion` 列(`schema.ts:48-68`),`middlewares/auth.ts:49-57` 只查「用户是否存在」——被盗号无法止损。
- **建议**:users 加 `tokenVersion` 列,签发时写入、cookieAuth 校验,改密码/封禁时 +1 立即失效所有旧 token;加 `status` 枚举支持禁用。**(动 schema,需决策)**

#### B8 🟡 安全头缺失
- **证据**:`src/lib/create-app.ts:20-38` 无 `hono/secure-headers`;nginx 配置也没有 `X-Content-Type-Options`/HSTS/`Referrer-Policy`。
- **建议**:app 挂 `secureHeaders()`;HSTS 放 nginx。

#### B9 🟡 基础设施口令与暴露面
- **证据**:`docker-compose.yml:16-17,24-25` PG `postgres/postgres` 弱口令且端口发布到宿主机(`5433:5432`),仅靠服务器防火墙兜底。
- **建议**:口令走 `.env`;PG 端口默认不发布。

#### B10 🟢 小项
- JWT 无 issuer/audience(`lib/auth.ts:27-33`),现在加上成本为零;
- `CORS_ORIGINS` 留空 = 全放行(`create-app.ts:29-32`),应在生产模式强制必填(见 B13);
- 前端 CodeEditor 用 `new Function` 执行用户代码 + 全局劫持 console 且异常路径不恢复(见 F10,与后端同源风险联动);
- `users.avatarPath` 为遗留字段,`/uploads/` 由 nginx 直接静态服务,本服务无上传接口(grep 确认),未来加头像上传时注意类型白名单与目录隔离。

### 1.3 可观测性与运维

#### B11 🔴 无 /health、无优雅停机、连接池无参数
- **证据**:
  - `src/index.ts:26-32`:`serve(...)` 后无 `SIGTERM/SIGINT` 处理、无 `server.close()`/`client.end()`——`docker stop` 后在途请求全部腰斩;
  - `docker-compose.yml:66-68` 注释自认:`# Hono 没自带 /health,沿用 / 当存活探针`——探针打 `/` 不查 DB,PG 挂了容器仍 healthy;
  - `src/db/index.ts:8-11`:`postgres(env.DATABASE_URL, { ssl })` 未配 `max/idle_timeout/connect_timeout/max_lifetime`,也没有 statement timeout——慢查询可占满池子拖垮整个服务。
- **建议**:加 `GET /health`(200 + `SELECT 1`);SIGTERM 时 `server.close()` + `client.end()`(`@hono/node-server` 自带 `closeAllConnections`);连接池显式 `max: 10, idle_timeout: 30, connect_timeout: 10`;compose healthcheck 改打 /health。

#### B12 🟡 启动即迁移 + console.log
- **证据**:`src/index.ts:18-37`:启动流程同步跑 `migrate()`,全程 `console.log/error` 而非 pino。
- **为什么是问题**:多实例扩容时同时启动会竞争迁移;日志无结构化。
- **建议**:迁移挪到部署 entrypoint / CI deploy 步骤(`node dist/migrate.js`),应用容器只读 schema;启动日志走 pino。

#### B13 🟡 onError 泄露内部错误信息且绕过 pino
- **证据**:`src/lib/middlewares.ts:26-28`
  ```ts
  export const onError: ErrorHandler = (err, c) => {
      console.error('[onError]', err)
      return c.json({ error: err.message }, 500) as Response
  }
  ```
- **为什么是问题**:`err.message` 原样返回,数据库驱动错误会直接暴露表名/列名/SQL 片段;用 console.error 而非注入 context 的 pino(`lib/types.ts:6` 定义了 `logger: PinoLogger` 却没用上),无 requestId 无法反查链路。
- **建议**:已知错误(HonoException/AppError)按状态码返回;未知错误一律 `{ error: 'Internal Server Error', requestId }`,细节只进日志;postgres 错误码映射(23505→409 等)。

### 1.4 API 契约与一致性

#### B14 🟡 契约与实现漂移,响应 schema 手写第二份
- **证据**:
  - `questions.routes.ts:30-35` 的 `statsSchema` 只有 4 个字段,但 `questions.handlers.ts:245` 详情接口实际返回 `questionStats` 全行(含 `bestTime`、`firstCorrectAt`、`userId`)——文档撒谎且内部字段外泄;
  - `questions.handlers.ts:217` `return c.json({ message: 'Not Found' } as never, ...)`——`as never` 是为绕过类型检查,说明 handler 与 route 声明已经对不上;
  - 响应 schema(`listItemSchema`/`detailSchema` 等)全部手写,无运行时校验,漂移无人发现。
- **建议**:响应 schema 一律从 `createSelectSchema()` 派生 + `pick/omit`;删掉 `as never`;CI 加契约测试(handler 输出 ⊆ route schema)。

#### B15 🟢 HTTP 语义
- 创建资源返回 200 而非 201(`auth.handlers.ts:84`、`questions.handlers.ts:266`、`todos.handlers.ts:106`);
- 删除他人题目返回 404 但消息自相矛盾(`questions.handlers.ts:297-302`,message 直接说破无权限,与防探测意图打架);
- LIKE 搜索通配符未转义(`questions.handlers.ts:54`,参数是绑定的无注入,但 `%`/`_` 可被当通配符);
- bcrypt cost=10 且无透明 rehash 路径(`lib/auth.ts:16`,login 成功后检测旧 cost 顺手升 12)。

### 1.5 代码组织(重复 = 事故温床)

| # | 重复项 | 证据 |
|---|---|---|
| B16 | `visibleBank`(私有题安全口径!)定义了两份,一字不差 | `questions.handlers.ts:43-44` ≈ `stats.handlers.ts:54-55` |
| B17 | JWT 校验逻辑两遍实现,secret 编码两处 | `lib/auth.ts:36-43` vs `middlewares/auth.ts:36-46` |
| B18 | user 裸 SQL 查询三处,无 service 层 | `auth.handlers.ts:41,95`、`middlewares/auth.ts:49-53` |
| B19 | 分页/枚举/IdParams schema 多份手写 | `questions.routes.ts:79-80` ≈ `stats.routes.ts:156-159`;`lib/openapi.ts:117-119` 还有死代码版 |
| B20 | `ymd`/`startOfWeek` 日期助手重复 | `todos.handlers.ts:17-18` ≈ `stats.handlers.ts:40-41` |

- **为什么重要**:尤其 B16——这是私有题泄露防线的核心口径,双份意味着未来改一处漏一处。
- **建议**:不必过度抽象,引入轻量 service 层(每模块一个 `*.service.ts` 直接持有 drizzle),共享口径函数、分页、日期助手收敛到 `src/lib/`。目标结构见附录 A。

### 1.6 测试现状(后端)

#### B21 🔴 核心业务逻辑零测试
- **证据**:`vitest.config.ts:7` include 全 src;唯一测试文件 `src/routes/auth/auth.test.ts`(196 行)。questions(493 行)、stats(473 行)、todos(156 行)全部无测试。
- **为什么是问题**:最容易出安全/正确性事故的代码(visibility 口径、markCorrect 的复杂 upsert SQL、list 的 status/join 组合)没有回归保护。
- **另**:`auth.test.ts:21-45` 的 db mock 是手搓 chainable 对象,与真实 drizzle API 形状不符——handler 改用其他方法时 mock 会静默给出错误结果而不是报错。
- **建议**:优先补 questions 的 private 可见性 + submit/markCorrect 并发语义测试;引入 Testcontainers 连真 PG 跑少量集成测试(SQL 正确性目前全靠手工验证);mock 改用统一工厂;CI 加覆盖率阈值。

---

## 2. 前端(web/)

### 2.1 构建与性能

#### F1 🔴 零代码分割,主包 2.4MB
- **证据**:
  - `web/src/router.tsx:1-10`:全部 7 个页面 + layout 静态 import,grep 全 src 无任何 `lazy(`/`Suspense`/`import(`;
  - 构建产物实测:`dist/assets/index-B6vFqcdH.js` = **2473 KB**——monaco、md-editor-rt、@antv/x6、fullcalendar、recharts、@tanstack/table 全在首屏主包;
  - `web/vite.config.ts:9-13`:无 `manualChunks`,且 `chunkSizeWarningLimit: 1500` 抬高阈值「消除」警告。
- **为什么是问题**:登录页用户也要下载 2.4MB;首屏 TTI 与发版缓存成本都被放大——**这直接放大已知的 Cloudflare 链路慢的痛感**。
- **建议**:router 全部 `lazy(() => import(...))` + loading fallback;vite 按 monaco/x6/fullcalendar/recharts/radix 拆 `manualChunks`;`chunkSizeWarningLimit` 恢复默认暴露真实问题。目标主包 < 800KB。

#### F2 🔴 运行时依赖两个第三方域名
- **证据**:
  - `web/src/components/icon.tsx:1,10`:`@iconify/react` 按名字在线渲染,运行时向 `api.iconify.design` 请求图标——弱网/内网图标消失;
  - `web/package.json:44`:`monaco-editor@0.55.1` 装了但全 src 无直接 import,`@monaco-editor/react` 的 loader **默认从 jsDelivr CDN 动态加载 monaco**——离线/内网编辑器挂,CDN 还有 SRI/合规问题。
- **建议**:monaco 用 `loader.config({ monaco })` 指向本地包(依赖已装,配套正好);iconify 换 `@iconify-json/*` 离线集合,或统一收敛到已有的 lucide-react(目前双图标体系并存)。

#### F3 🟡 静态资源死重与配置
- `src/assets/*.png` 约 **1.4MB**(video.png 373KB、sum.png 211KB 等),grep 无任何引用——纯仓库死重;
- `web/tsconfig.tsbuildinfo` 提交在仓库中,应 ignore;
- `VITE_DEV_BACKEND` 未写进 `.env.example`,且本地无 `.env`,新人无从得知。

### 2.2 架构与状态管理

#### F4 🔴 日历页绕过 react-query,「双份真相」
- **证据**:`web/src/components/calendar/index.tsx`
  - :93-105 `useEffect` 里直接 `todosApi.getTodosByMonth(...)` → `setAllTodos(todos)`——服务端状态塞 useState,不走 useQuery;
  - :126/135/144 三个 mutation 的 `onSuccess` 却 `invalidateQueries({ queryKey: ['monthStatus'] })`——日历根本不监听这个 key,**invalidate 是无效调用**,实际靠手动 `setAllTodos` 补;
  - 对比 `src/components/todos-dropdown.tsx:41-44`:那里正确用了 `useQuery(['todos', today])`。
- **为什么是问题**:同一服务端资源(todos)两处两种范式;顶部下拉打卡后日历不刷新,跨组件一致性靠巧合;也没有 loading/error 态。
- **建议**:日历改 `useQuery(['todos','month',y,m])`;建集中式 queryKey 工厂(`src/lib/query-keys.ts`,目前 20+ 处 key 字符串散落:`['dashboard-stats']`、`['questions','markdown',…]`、`['question', id]`…);mutation 只 invalidate 不手写本地镜像。

#### F5 🟡 认证三个真相源
- **证据**:
  - `store/auth-store.ts:16-25`:zustand persist 把整个 user 存 localStorage(注释自认「以免刷新头像消失」);伪造 localStorage 可让 `RequireAuth`(`require-auth.tsx:4-8`,只读 store)先渲染受保护页,等 401 才被踢;
  - `login-form.tsx:24-26`:登录成功后又调 `me()`——login 接口已返回 user,多一次往返;
  - `main.tsx:12`:`AuthBootstrap` 全局阻塞首屏(全屏 spinner 等 `/auth/me`),失败(网络抖动)直接踢到登录页,无重试。
- **建议**:`me()` 走 `useQuery(['me'], { staleTime: 5*60, retry: 1 })`,`RequireAuth` 依赖该 query;persist 只留展示字段或干脆去掉。

#### F6 🟡 服务端状态塞进 zustand + demo 遗留进生产
- **证据**:`web/src/pages/test-center/store.ts`:37-86 `getData` 内含 **20 条硬编码假数据** + `setTimeout` 模拟延迟 + `console.log(params)`;该 mock store 被 `test-center/page.tsx:6` 引用。
- **建议**:删除;payments 相关 demo(myTable 示例)移出示例目录;筛选状态改 URL search params。

#### F7 🟡 大文件与成对复制的页面
- `components/calendar/index.tsx` **499 行**(日历+mutations+DOM 清理混在一起);
- **`pages/test-center/codeCol.tsx` 与 `strCol.tsx` 逐字节相同**(各 233 行,diff=0);`codeList.tsx` vs `strList.tsx` 仅差 `type` 参数;
- `drawer/utils.tsx` 439 行、`custom-nodes.tsx` 352 行、`addtest.tsx` 346 行。
- **建议**:`codeCol/strCol` 合并为带 props 的通用列定义;calendar 拆 `useTodosMonth` hook + 子组件。

### 2.3 错误处理与用户体验

#### F8 🔴 无全局 ErrorBoundary / 错误页 / 统一反馈
- **证据**:grep `ErrorBoundary|componentDidCatch|errorElement` 全 src 无匹配;`router.tsx:39` 通配 404 只是静默 `Navigate to="/"`;错误反馈三套并存(login 局部红条、`practice/[id]/page.tsx:80` 原生 `alert`、calendar 静默 console.error);`providers.tsx:9-17` QueryClient 无全局 mutation onError。
- **为什么是问题**:React 19 渲染异常默认卸载整棵树=白屏;mutation 失败用户无感知(`practice/[id]/page.tsx:49-66` 的 submit mutation 就没有 onError)。
- **建议**:router 根路由 `errorElement` + 500 页;引入 sonner 全局 toast,providers 里全局兜底;替换 alert。

#### F9 🟡 401 处理硬跳转 + 错误未归一化
- **证据**:`web/src/lib/request.ts:13-24`:401 时 `window.location.href = '/login'`(整页刷新丢 SPA 状态,不带 `state.from` 回跳);无 401 去重(并发 5 个请求 401 触发 5 次跳转判断);axios 原始 error 直接 reject,错误文案提取逻辑(`err.response?.data?.message || '…'`)散落各组件各写各的。
- **建议**:拦截器归一化为 `ApiError{status, code, message}`;401 改 `queryClient.clear()` + router 导航(保留 from)并加节流。

#### F10 🔴 CodeEditor 的执行沙箱问题(兼安全问题)
- **证据**:`web/src/pages/test-center/practice/[id]/components/CodeEditor.tsx`
  - :66-70 **全局 console 五个方法被整体替换**;
  - :74 `const func = new Function(userAnswer); const result = func()`——等价 eval,与页面同源;
  - :78-106 异步「等待输出」是 setTimeout 轮询 5 秒的 hack,组件若在这 5 秒内卸载,`console.*` **永远不会被恢复**——运行过一次代码后整站日志(含 ErrorBoundary 上报)被永久吞掉。
- **建议**:改 iframe sandbox / Web Worker 执行并捕获输出;至少把劫持放进 try/finally 并绑定到实例生命周期。

### 2.4 工程化(前端)

#### F11 🔴 零测试、零 git 钩子、lint 防线被主动关掉
- **证据**:
  - glob `**/*.{test,spec}.*` 无匹配;devDeps 无 vitest/testing-library;`package.json:8` `"build": "tsc --noEmit && vite build"`——唯一质量门是 typecheck,lint 不在链上;
  - `eslint.config.mjs:113-114`:`no-unused-vars`、`no-explicit-any` 全部 **off**(:104-121 与 :130-138 还重复声明两遍);
  - `eslint.config.mjs:146-150`:`rules-of-hooks: 'warn'`(**违反 Hooks 规则只是警告**)、`set-state-in-effect`/`purity` 关;
  - `eslint.config.mjs:18-21` ignores 排除了所有 `*.config.ts`(vite.config 不被 lint);
  - :39-96 手写 60 行 browser globals 白名单(还含 ESM 项目不存在的 `require`/`module`),而非用 `globals` 包。
- **建议**:`rules-of-hooks` 必须 error;`no-unused-vars` 用 `argsIgnorePattern: '^_'` 开启;换 `globals` 包;引入 husky + lint-staged(pre-commit: eslint --fix + prettier + tsc);build 脚本加 `lint &&`;vitest 先覆盖 services/api 层与工具函数。
- **现状量化**:当前 `npx eslint .` = 0 errors / 21 warnings(20 条 prettier 集中在 `ui/tabs.tsx`,1 条 hooks deps 在 `drawer/index.tsx:126`)。

#### F12 🟡 radix 双份依赖
- **证据**:`package.json:46` `"radix-ui": "^1.4.3"` 统一包与 :24-33 的 10 个 `@radix-ui/react-*` 散包并存(package-lock 里 @radix-ui 条目 164 个);`ui/` 下约一半组件 import 统一包(`breadcrumb.tsx`、`collapsible.tsx`、`tabs.tsx`),另一半 import 散包(`button.tsx`、`dialog.tsx`、`dropdown-menu.tsx`…)。
- **为什么是问题**:同一 primitive 可能解析成两份实例(React context 跨包不互通、重复打包);升级维护两套。
- **建议**:统一迁到 `radix-ui` 单一来源(shadcn 生成物一次性重生成即可)。

#### F13 🟡 类型无共享、服务层边界被绕过
- **证据**:
  - `services/*.ts` 的 `Question`/`Todo`/`DashboardStats` 全部手写 interface(`stats-api.ts:33-63`),与后端无 OpenAPI/类型共享;`stats-api.ts:103` 残留「重复定义已删除」考古注释,证明漂移发生过;
  - `components/auth/register-form.tsx:22` 直接 `request.post('/auth/register', …)` 绕过 `services/auth-service.ts`。
- **建议**:后端已是 TS + zod-openapi,用 openapi-typescript 从 `/doc` 生成前端类型(或共享 zod schema 包);register 移入 authService。
- (注:API 路径收敛本身是好的——`request.` 调用只在 services 层 + register-form 一处。)

---

## 3. 做得好的地方(重构时保留)

- 登录时序均衡 dummy-hash 防 timing 攻击(`auth.handlers.ts:21,48`);
- 私有题统一 404 不泄露存在性(`questions.handlers.ts:216`);
- list 排序字段白名单防注入(`questions.handlers.ts:93-121`);
- stats 大量 SQL 下推 + jsonb GIN 索引利用(`stats.handlers.ts` 文件头注释);
- CI 的 dummy-env 注释与部署健康检查等待逻辑(`ci.yml:181-200`);
- Dockerfile 多阶段 + 非 root 用户;`.env` 已正确 gitignore;
- 后端注释质量高,「为什么」都写清楚了——重构时这些注释应随代码迁移;
- 前端 `lib/env.ts` 环境变量集中、API base 唯一出处;`router.tsx` 有 RequireAuth 守卫;react-query 覆盖率整体较高(除日历页)。

---

## 4. 落地路线图

| 阶段 | 内容 | 对应条目 | 工作量 | 收益 |
|---|---|---|---|---|
| **P0 止血** | onError 不泄内部错误+接 pino+requestId;生产关 /doc;限流信任代理修正+compose 收端口;/health+SIGTERM+连接池参数;注册 onConflict | B2 B5 B6 B7(off-doc 部分) B11 B13 | 1-2 天,每项 <1h | 堵住所有「能被绕过/会泄露/会假活」的口子 |
| **P1 数据正确性** | submit/markCorrect 加事务+attemptCount SQL 化;统一错误格式+错误码(todos 404);getStats 聚合化/getAttempts 限流/dashboard 去掉 ::text cast | B1 B3 B4 | 2-3 天 | 核心指标不再可能失配 |
| **P2 前端性能** | 路由 lazy+manualChunks;monaco 本地化+iconify 离线;删 1.4MB 死资源 | F1 F2 F3 | 1-2 天 | 主包 2.4MB→<800KB,弱网体验质变,缓解 CF 慢的痛感 |
| **P3 质量防线** | questions 可见性+判分测试(Testcontainers);前端 vitest 起步+husky+lint-staged+eslint 收紧;响应 schema 从 createSelectSchema 派生 | B14 B21 F11 | 3-5 天 | 之后所有改动有回归保护 |
| **P4 架构升级** | 后端按模块加 service 层(visibleBank/查询/日期助手收敛);前端 features/ 垂直切分+queryKey 工厂;日历迁回 react-query;radix 统一包;codeCol/strCol 合并 | B16-B20 F4 F7 F12 F13 | 随迭代分批 | 可维护性 |

**依赖关系**:P0 全部独立可并行;P1 的事务改造建议与 P3 的测试同步写(先有测试再改事务);P2 与后端完全独立可穿插;P4 依赖 P1/P3 落地后再动,避免在无保护的重构。

---

## 5. 待决策点(需拍板)

1. **JWT 服务端失效 + 账号封禁(B7)**:users 表加 `tokenVersion` + `status` 列,需迁移。唯一动 schema 的安全增强。做 / 不做 / 缓做?
2. **前端测试起步范围(F11)**:只测 services/api 层和工具函数(便宜,先有防线),还是连组件 Testing Library 一起上(贵,覆盖 UI 交互)?
3. **契约共享方案(F13)**:openapi-typescript 自动生成(依赖 /doc,生产关文档后需 CI 内部访问)vs 手工维护共享 zod 包 vs 维持现状仅加 zod 运行时校验?
4. **P0 止血包**是否立即开工(改完即部署)?

---

## 附录 A:建议的后端目标结构

当前是「routes 文件 = route 定义 + handler 内联 SQL」两层。建议轻量三层(service 直接持有 drizzle,repository 按需合并进 service,不过度抽象):

```
src/
├── index.ts                  # 启动:迁移入口分离 + 交给 server.ts
├── server.ts                 # serve() + SIGTERM 优雅停机(可测试)
├── app.ts                    # 只做装配:中间件顺序 + 路由挂载
├── env.ts                    # + 生产模式 superRefine(CORS 必填、JWT_SECRET 强度)
├── db/                       # index.ts 连接池参数显式化;schema.ts 单一事实源(保留)
├── lib/                      # 纯技术设施,零业务
│   ├── errors.ts             # AppError + 错误码枚举        ← 新增(B3)
│   ├── http.ts               # ok()/fail() 响应助手        ← 新增
│   ├── pagination.ts         # pageQuerySchema + buildPage ← 新增(B19)
│   ├── date.ts               # ymd / startOfWeek / monthBounds ← 新增(B20)
│   ├── auth.ts               # signToken/verifyToken(中间件复用,B17)
│   └── middlewares.ts        # onError 改造(B13)
├── middlewares/              # auth(查库改调 userService)、rate-limit(+信任代理,B5)
└── modules/                  # 按业务域垂直切分 ← 核心变化
    ├── auth/                 # auth.routes.ts / auth.handlers.ts(薄)/ auth.service.ts
    ├── questions/            # visibleBank 在 questions.service.ts 定义一次(B16)
    │                         # submit/markCorrect 用 db.transaction(B1)
    ├── todos/
    └── stats/                # date 列直比(B4)
```

配套:响应 schema 全部 `createSelectSchema().pick(...)` 派生(B14);`/health` 进 `routes/index.route.ts`;迁移独立 entrypoint(B12)。

## 附录 B:建议的前端目标结构

```
web/src/
├── app/                      # main / providers(QueryClient+Toaster+ErrorBoundary) / router(全 lazy+errorElement)
├── lib/
│   ├── query-keys.ts         # 集中 queryKey 工厂(F4)
│   └── request.ts            # axios + ApiError 归一化 + 401 拦截(F9)
├── services/ → api/          # 按领域分文件 + 类型自动生成(F13);register 归位
├── stores/                   # zustand 只放真客户端状态(F5/F6)
├── features/                 # 按业务域垂直切分,页面入口为可 lazy 的薄壳
│   ├── auth/  home/  todos/(calendar 拆 use-todos-month)/
│   ├── test-center/(codeCol+strCol → question-column;CodeEditor 沙箱化 F10)/
│   ├── statistics/  settings/  drawer/
├── components/
│   ├── ui/                   # shadcn,统一 radix-ui 单一来源(F12)
│   └── layout/
└── hooks/
```

## 附录 C:落地进度

| 日期 | 提交 | 内容 |
|---|---|---|
| 2026-10-16 | `e281c34` | B1(事务)、B2(注册竞态)、B3(错误统一)、B4(查询修复)、B11(/health+停机+连接池)、B13(onError)、B14(契约派生)、B21(14 例真 PG 集成测试 + CI postgres service) |
| 2026-10-17 | `fadcfa3` | B5(限流 key:cf-connecting-ip → x-real-ip → 对端地址;compose app/PG 端口只绑 127.0.0.1;新增限流单测;全链路验证 31 次登录 30×401+1×429)、B6(生产默认关闭 /doc 与 /reference,ENABLE_API_DOCS 开关) |

**已验证**:`/health` 线上 200;`/doc`、`/reference` 线上 404;app 端口 `127.0.0.1:4000`、hls-api 端口 `127.0.0.1:5434`(0.0.0.0:5433 是 tasks-api 的 PG,非本服务);测试 26/26 通过(12 mock 单测 + 14 集成)。

**未落地**(按优先级):B7(JWT 服务端失效/账号封禁,待拍板)、B8/B9(安全头、口令)、B12(迁移挪出启动流程)、B14 之外的 B15-B20(随手清理)、F 全系列(前端 P2 性能 → P3 前端防线 → P4 架构)。



