# Spec 05 · 面栈(MianStack)内容导入

> 状态:执行中 · 2026-11-20 启动
> 来源:github.com/didilili/mianstack(MIT)· mianstack.com
> 性质:内容扩充,不涉及代码变更(除 tag/bank 数据行)

## 许可边界(先划清楚)

| 目录 | 许可 | 可用性 |
| --- | --- | --- |
| `questions/`(题目+参考答案) | **MIT** | ✅ 可用,逐题保留署名链接 |
| `interviews/`(真实面经) | 第三方,明确不随 MIT | ❌ 禁止导入 |
| `collections/`(公开题集) | 第三方,明确不随 MIT | ❌ 禁止导入 |

每题答案开头自带「在面栈阅读:原文链接」引用块——**保留原文,即履行 MIT 署名义务**,不加额外脚注。

## 池子(2026-11-20 实测)

- 全仓 13,927 题,`answerStatus: ready` 仅 **739 道**;其余 95% 有题无答,不导入(薄页红线)
- 用户拍板范围:**AI 方向 492 道**(agent 197 / ai_engineering 128 / rag 80 / training 47 / llm 40)+ **网络净新增 3 道**(HTTP 缓存 Q-0007 / TLS Q-0228 / OSI Q-0649)
- 体积:430 道 1500–3000 字、272 道 3000–6000 字,与站内「分层解析」规格一致

## 编辑纪律

1. **排除 `type=经历介绍`**(13 道):纯个人经历口吻,与知识站定位冲突
2. **一批只收纯文本**(无 mermaid、无图片):约 440 − 经历 ≈ 430 道;
   含 mermaid(37)/图片(19)的留二批,处理方案待定(渲染器支持 mermaid 或改写)
3. **与站内 289 题撞题的 14 道**(TCP/UDP、事件循环、跨域、状态码等)不导入——
   留作 P1 体检的**补写参考材料**(改编 + 标注,不是照搬)
4. `status='approved'` 直接入库;`published_at` 取面栈的 `updatedAt`(溯源+新鲜度都真实)

## 字段映射

| 面栈 frontmatter | 我们的 questions | 说明 |
| --- | --- | --- |
| `id`(Q-0036) | `slug` = `q-0036` | ASCII,唯一索引安全,可反查原文 |
| `title` | `title` | 知识口吻,直接用 |
| — | `content` = `''` | 无独立题干,页面自动不渲染题干块 |
| 正文 md | `answer` | 原样保留(含开头署名引用块) |
| `focus` | `summary` | 一句话考点,天然是摘要 |
| `level` | `difficulty` | 基础→easy / 进阶→medium / 深入→hard |
| **标题启发式** | `type` | ⚠️ enum 命名反直觉:`markdown`=代码题(Monaco)、`text`=理论题。**必须用 `apps/api/src/lib/question-type.ts` 的 `detectQuestionType`(标题判定)**,不能照抄存量样例——2026-11-20 一批曾因此把 427 道全标成代码题,同 277/297 历史事故重演,已修正为 424 text / 3 markdown |
| `category` | `bank_id` + `direction` | 5 个新 AI 题库(见下) |
| `topic` | `knowledge_points` + `tags` | 未注册 tag 显示为纯文本,可接受 |

### 新增题库(5 个)

| slug | title | 来源 category | ready 数 |
| --- | --- | --- | --- |
| `llm` | 模型基础与推理 | llm | 40 |
| `rag` | RAG 与知识系统 | rag | 80 |
| `agent` | Agent 原理与系统 | agent | 197 |
| `ai-engineering` | AI 应用工程 | ai_engineering | 128 |
| `training` | 模型训练与对齐 | training | 47 |

网络 3 道挂现有 `engineering` 题库。`sortBanks` 未知 slug 自动排尾部,首页目录无需改代码。

### 新增 direction 标签(tag_registry,kind=direction)

`LLM`(llm) · `RAG`(rag) · `Agent`(agent,已存在) · `AI 工程`(ai-engineering) · `模型训练`(training)

## 验收

- [ ] 一批约 430 道入库,`status='approved'`,每题可从 `q-xxxx` 反查面栈原文
- [ ] sitemap 409 → ~840 URL;Site CI 定时重建自动跟进(每 6h),或手动构建部署
- [ ] 抽查 3 个页面:题干不渲染、答案分层完整、署名链接可达、面包屑/JSON-LD 正常
- [ ] 百度推送按日配额补新 URL(入口页优先)
- [ ] GSC「已抓取-尚未编入索引」占比不恶化(2 周后复查)

## 风险与对策

- **大量新页涌入**:内容全部 1500+ 字且有来源,不是薄页;观察 GSC 两周
- **主题聚焦变化**:站点定位从纯 Web → Web + AI 应用;title/description 后续在
  metadata 层面跟进(单独 PR,不在本次范围)
- **撞题 14 道**:不导入,只做补写材料;补写动作记在 P1 名单里
