# 审核工作流 + 权限系统 设计文档

> 2026-10-20。基于现有实现(apps/api 的 review 模块 + review_status 枚举 + review_logs
> + 后台 SPA apps/web)的增量设计。
>
> **决策修订**:原 plan(interview-site-mvp-plan.md §2.3)是「AI ≥85 自动 approved 发布」;
> 本设计按 2026-10-20 指示改为 —— **AI 只是前置筛选,人工审核强制,人工通过才发布**。
> 原「阈值自动发布」作废。

---

## 1. 状态机(修订后)

```
draft ──触发审核──> pending_review ──AI 完成──┬─ AI 分 ≥60 ──> human_pending ──人工通过──> approved ──> 公开站可见
                                            └─ AI 分 <60 ──> rejected ───┐
                                                                        │
draft/any ──创建者改内容(contentHash 变)──重新触发──> pending_review <─┘(回到 AI 前置)
approved ──人工驳回(可事后)──> rejected
```

- **pending_review**:AI 审核中(AI 是前置,人不可跳过)
- **human_pending**(新枚举值):AI 完成、分数 ≥60,等人工裁决 —— 这就是「人工审核列表」
- **rejected**:人工驳回 或 AI 打回(都留记录,见 §3)
- **approved**:人工通过;publishedAt 在此时落值 → 公开站可见
- AI 的 85 分「高置信」阈值保留为**展示性指标**(队列里高置信排前),不再有发布语义

## 2. 权限系统(迁移 0004 前半)

```sql
CREATE TYPE "user_role" AS ENUM('user','admin');
ALTER TABLE "users" ADD COLUMN "role" user_role DEFAULT 'user' NOT NULL;
-- 存量回填:omen@123.com → admin(迁移内 WHERE email = 指定,写死在 SQL)
```

- `schema.ts`:users.role 列;`selectUserSchema` 含 role(前端菜单显隐用)
- `middlewares/auth.ts`:现有查库补 `role`,注入 `c.set('userRole')`;types.ts Variables 同步
- 新 `middlewares/admin.ts`:`requireAdmin()` —— `userRole !== 'admin'` → 403
  `{ message:'Forbidden', code:'FORBIDDEN' }`(统一错误体)
- **前端显隐只是体验,后端强校验才是边界**(role 永远以服务端查库为准,JWT 不放 role
  —— 改角色即时生效,不用重签 token)

## 3. AI 打回记录(修订后)

现状:AI 每跑一次落一行 review_logs(含 verdict/score/report)——记录已有,补三列:

```sql
ALTER TYPE "review_status" ADD VALUE IF NOT EXISTS 'human_pending';
ALTER TABLE "review_logs"
  ADD COLUMN "source" varchar(10) DEFAULT 'ai' NOT NULL,      -- 'ai' | 'human'
  ADD COLUMN "reviewer_id" uuid REFERENCES users(id) ON DELETE set null,  -- 人工裁决人
  ADD COLUMN "note" text;                                     -- 人工意见/驳回理由
```

- **AI 打回** = verdict='rejected' + source='ai' + 完整 report(含修改建议)——
  工作台「被 AI 打回」tab 可见;创建者改内容(hash 变)→ 重新触发 → 回 AI 前置
- **人工驳回** = verdict='rejected' + source='human' + reviewer_id + note
- 全部历史轨迹在「审计」tab 按 question 汇总展示

## 4. 接口设计(review 模块增量)

现有接口权限调整:

| 接口 | 现权限 | 新权限 |
|---|---|---|
| POST /review/:id(触发 AI) | 仅创建者 | **创建者 或 admin**(admin 可代触发任意题) |
| POST /review/batch | 仅创建者(自己的题) | 不变;admin 走 /review/queue 全量 |
| GET /review/:id/result | 仅创建者 | 创建者 或 admin |
| GET /review/stale | 仅创建者 | 不变(自己的) |

新增(admin-only,`requireAdmin` 挂路径级中间件):

| 接口 | 语义 |
|---|---|
| `GET /review/queue?tab=pending\|rejected&size&page` | 人工审核队列:pending = human_pending(AI 分降序,高置信排前);rejected = AI 打回(带最近报告) |
| `POST /review/:id/human` | body `{ decision:'approve'\|'reject', note? }`:approve → status=approved + publishedAt=COALESCE(published_at, now()) + 落日志(source=human, reviewer);reject → status=rejected + 落日志 |
| `GET /review/logs?question_id=` | 单题审计轨迹(可选,MVP 用 result 即可) |

app.ts 挂载顺序(精确路径优先,与 /review/:id 不冲突):

```ts
app.use('/review/queue', cookieAuth(), requireAdmin())
app.use('/review/*', cookieAuth())          // 现有
// human 接口路径用 /review/{id}/human —— handler 内再查 role(adminOnly helper)
```

> 说明:`/review/:id/human` 是参数路由,路径级挂 requireAdmin 会误伤 trigger,
> 因此 human/queue 两类里:**queue 走路径中间件,human 在 handler 开头显式
> adminOnly(c) 助手**(查 c.get('userRole')),两者都有集成测试锁定。

## 5. agent.ts 行为修订

- `verdictOf(total)`:
  - `total >= REVIEW_THRESHOLDS.MIN(60)` → **'human_pending'**(不再有自动 approved)
  - `total < MIN` → 'rejected'(AI 打回)
- 审核完成回写:status = human_pending / rejected;reviewScore/reviewResult/contentHash 照旧;
  publishedAt **不再由 AI 触碰**
- LLM 挂了/超时:仍留在 pending_review + 失败日志 + /review/stale 兜底(不变)
- 幂等:contentHash 不变且 status ∈ {approved} → skip;human_pending 状态重触发 → 允许重跑

## 6. 后台 SPA(apps/web)增量

1. `auth-service` 的 me/login 响应带 role → `auth-store` 存 role
2. 侧边导航:**仅 role=admin 渲染「审核工作台」入口**(非 admin 直接访问路由 → 空态页)
3. 新页面 `/review`(后台):
   - Tab「待人审」:human_pending 列表,AI 分数徽章(≥85 显示"高置信")、五维报告
     折叠展开;每行操作:通过 / 驳回(驳回必填 note)
   - Tab「被 AI 打回」:rejected 列表 + AI 报告的修改建议;操作:重新触发(改完内容后)/
     admin 强行通过
   - Tab「审计」:最近 review_logs 流水(AI/人工来源标识)
4. `services/review-api.ts`(react-query,queue 拉 + human mutation + invalidate)

## 7. 公开站影响

- 零变化:仍然只渲染 approved(人工通过才有 publishedAt)
- 后续「发布即触发重建」(repository_dispatch)在通过动作里追加,不在本次范围

## 8. 测试计划(集成,真 PG)

- 权限矩阵:非 admin 访问 queue/human → 403;admin 访问 creator 的题 → 放行;
  第三用户触发他人题 → 404(不泄露)
- 状态机:AI(mock fetch)返回高分 → human_pending(而非 approved!);
  低分 → rejected;human approve → approved + publishedAt 落值;reject 带 note 落日志
- 打回记录:AI 打回的题在 queue rejected tab 可见 + 有 report
- 幂等:human_pending 状态下重触发 → 重跑;approved + hash 不变 → skip

## 9. 实施顺序(文件清单)

1. `apps/api/src/db/schema.ts` + 迁移 0004(role / human_pending / review_logs 三列)
2. `middlewares/auth.ts` 注入 userRole;新增 `middlewares/admin.ts`
3. `lib/constants.ts`:REVIEW_THRESHOLDS 注释修订(85 = 高置信展示阈值)
4. `review/agent.ts`:verdictOf + 回写调整
5. `review/review.routes.ts + handlers.ts`:queue / human 新增;trigger 权限放宽
6. `app.ts`:路径级中间件
7. `apps/web`:auth-store.role + 导航显隐 + /review 工作台 + review-api
8. 集成测试(§8)+ 既有测试修订(verdictOf 行为变化)
9. 部署:先手动备份 → push → CI(迁移自动跑)→ 存量 approved 81 题不受影响
   (已是终态,无状态迁移;只有"之后新增的题"走新流程)

预估:后端半天、前端工作台半天、测试半天,共一天到一天半。

---

## 10. 2026-10-26 产品化迭代(已实现)

### 10.1 一键应用 AI 改进版

- AI 输出契约新增 `revised: { title?, content, answer, tags? }`:总分 <60 或
  completeness <12 时必须给可直接替换原题的完整版本(见 `prompts/output.ts`)。
- 实测模型偶发遗漏 → `agent.ts` 兜底:打回且缺 `revised` 时,用
  `prompts/revision.ts` 单独再调用一次(失败不改变打回结论)。
- `POST /review/:id/apply-revision`(admin 或创建者):把 `revised` 写回**原题**
  (不新建)→ 扣配额(admin 豁免)→ 同一题目 id 自动重审。

### 10.2 审核中心(导航名 = 审核)

**2026-10-26 二次改版:四个 tab → 单列表 + 状态筛选 + 行内四步进度。**

`GET /review/queue?status=all|reviewing|pending|rejected|approved`:

| status | 对应库状态 | 说明 |
|---|---|---|
| reviewing | pending_review | AI 审核中 |
| pending | human_pending | AI 已通过,等待人工裁决 |
| rejected | rejected | 未通过(AI 打回或人工驳回) |
| approved | approved | 已通过并发布 |
| all(默认) | — | 全部,排序:待人工 > 审核中 > 未通过 > 已通过,同组按最近更新 |

响应额外带 `counts`(各状态数量),筛选按钮直接显示;分页 20/页。
每行用四步进度展示「AI 审核中 → AI 审核通过 → 待人工审核 → 已通过」:
done 绿色、进行中蓝色(带 spinner)、失败红色;人工驳回时失败标在「待人工审核」
这一步而不是 AI 那步。列表里还有 `pending_review` 的题时前端 4s 自动轮询,
刷新按钮在请求中禁用(防连点),所有写操作 mutation pending 防抖。

### 10.3 题库列表口径

- `GET /questions` 只返回 `status='approved'`(新题先进审核中心,过审才进题库);
  `/questions/stats` 的 total 同口径。
- 新增 `visibility=shared|private` 筛选;前端「可见性」独立成列(共享/私有)并可筛选,
  不再在标题后缀「私有」;列表默认每页 20 条。

### 10.4 LLM 成本与稳定性

- DeepSeek V4.1 默认开启 thinking:实测同一题 reasoning 2229 tokens / 15s;
  关闭后 7.7s、输出 1/3,且 JSON 契约更稳定。默认下发
  `thinking:{"type":"disabled"}`,可用 `LLM_THINKING=enabled|auto` 覆盖。
- 请求强制 `response_format: {"type":"json_object"}`。
- **围栏误伤修复**:`revised.answer` 内常含 ```js 代码块,旧解析器会把代码块当
  JSON 抠出来 → "Expected property name ... position 1"。现在优先整段解析,
  失败再依次尝试 ```json 围栏、其它围栏(见 `llm.ts extractJson`);已加集成
  回归用例(报告内嵌 ```js 仍能落库)。

### 10.5 面试站定时重建

`.github/workflows/site.yml` 增加 `schedule: '0 */6 * * *'`(UTC 0/6/12/18 =
北京 8/14/20/2 点)。**注意**:GitHub 只调度默认分支上的 workflow,本仓库默认分支
是 `pgsql`(无 site.yml),需把默认分支切到 `hls-api` 后定时任务才生效;
切换前仍可用 Actions 里手动 Run workflow。

### 10.6 AI 自动出题(粘贴知识点 → 完整题目)

`POST /review/generate`(登录用户,消耗 1 次 AI 配额,admin 豁免):

- 入参 `{ source: 20-8000 字, type?, difficulty? }`;出参
  `{ title, content, answer, tags, difficulty, type }`(**不落库**)。
- 落库仍走 `POST /questions`(创建即自动送审),保持唯一入口。
- 前端「添加题目」对话框顶部新增面板:
  - 「AI 生成题目」→ 填进表单,用户可编辑后再提交;
  - 「生成并提交审核」→ 生成 + 创建 + 自动送审一步完成。
- 提示词见 `prompts/generate.ts`;与审核共用 json_object + zod + 重试。
- 实测:粘贴 200 字 useEffect 知识点 → 生成题干/分层答案/4 个标签 →
  自动审核 98 分 → 待人审 → 通过 → 题库可见。

### 10.7 标签收敛(轻量,暂不做标签管理后台)

- 提示词:tags 限定 **2-4 个**,并注入「平台已有标签」候选(热门 24 个),
  引导复用而不是自造小众标签。
- 代码:`review/tags.ts` 统一 `normalizeTags()`:常见别名归一(js→JavaScript、
  vue3→Vue、事件循环机制→事件循环…)、忽略大小写去重、单标签 ≤20 字、
  最多 4 个;审核、应用改进版、AI 出题三处共用。
- 存量 81 题的标签仍是历史数据,等审核清洗那一轮一并重打;
  标签合并/重命名/后台管理 UI 优先级低,后续需要再做。
