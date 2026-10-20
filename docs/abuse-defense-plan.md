# 防滥用防御设计(AI 配额 / 防多号 / CF Turnstile)

> 2026-10-20。基于现有实现(rate-limit 中间件、question_views 去重表、
> CF-Connecting-IP 取 IP 规则、注册开关 REGISTRATION_ENABLED)的增量设计。

---

## 1. AI 审核每日配额(防 AI 被刷爆)

### 规则
- **每个用户每天最多 20 次 AI 审核触发**(triggerOne 每题 1 次;triggerBatch 按题数扣)
- **admin 豁免**(平台运营者自己人)
- **按触发计,不按成功计**——LLM 挂了的失败调用同样花钱,失败也扣
- 跨天重置:按 UTC 日期分桶(与 question_views 的 day 口径一致)

### 数据模型(迁移 0005)
```sql
CREATE TABLE "ai_quota" (
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
    "day" date NOT NULL,
    "used" integer DEFAULT 0 NOT NULL,
    PRIMARY KEY ("user_id", "day")
);
```
- 扣减 = `INSERT ... ON CONFLICT (user_id, day) DO UPDATE SET used = used + 1 RETURNING used`
  (SQL 侧自增,并发安全;used 就是最新的已用数)
- 返回的 used > LIMIT → 抛 429(事务回滚这次扣减?不:扣了就是扣了——失败的触发也算次数;
  但 429 的那次**不扣**(还没执行 AI)。顺序:先查 used ≥ LIMIT → 429;否则扣减再触发)

### 接口与可见性
| 接口 | 语义 |
|---|---|
| `GET /review/quota` | `{ used, limit, remaining, resetAt }` —— 出题人自己可见;admin 返回 `exempt: true` |
| 触发超限 | **429** `{ message: '今日 AI 审核次数已用完(20 次),明天重置', code: 'QUOTA_EXCEEDED' }` + `Retry-After`(到明天 0 点的秒数) |

### 前端可见
- 出题/编辑表单角标:「今日 AI 审核 3/20」(GET /review/quota,react-query)
- 触发按钮在 remaining = 0 时禁用 + tooltip 说明重置时间
- 429 时 toast 明示

### 阈值
- 20 走 `lib/constants.ts`(AI_DAILY_LIMIT = 20);要运行时可调再升 env

---

## 2. 防同 IP 批量注册多号

### 分层防御(由松到紧)
1. **注册专用限流收紧**(现有):register 30/min 太松,单独收紧到 **5/hour/IP**
   (rate-limit 中间件加新实例,key 已按真实 IP)
2. **同 IP 账号数硬顶**:
   - users 表加 `created_ip_hash varchar(32)`(sha256(ip+固定盐) 截断,不存裸 IP)
   - 注册时检查:同 ip_hash 当天注册 ≥2 个 或 全量 ≥5 个 → **403**
     `{ message: '该网络注册过于频繁', code: 'REGISTER_LIMIT' }`
   - 判定用一次 COUNT 查询(有索引:created_ip_hash + created_at)
3. **CF Turnstile 真人验证**(§3):注册必挂——机器过不了,上面两条是纵深
4. **邮件验证**(后期,备选):需要 SMTP;先把 1-3 做了,不够再上

### 为什么不用"封 IP"
NAT/校园网/公司网出口一堆真人;只限"注册动作"频次+人数,误伤最小。

---

## 3. CF Turnstile(真人验证)

### 接入点(按优先级)
| 场景 | 做 | 理由 |
|---|---|---|
| **注册** | ✅ 必挂 | 防批量注册的主防线 |
| 登录 | 连续失败 N 次后要求(进阶,MVP 不做) | 现有 30/min 限流够用 |
| 公开站表单(将来荐文等) | 挂 | UGC 入口 |

### 实现
- **env**:`TURNSTILE_SECRET_KEY`(留空 = 验证关闭,本地/测试直通;生产在 CF 后台拿 key)
- **后端**:register handler 在创建用户前校验:
  `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`
  (secret + response=前端 token + remoteip)→ 失败 403 `{ code: 'TURNSTILE_FAILED' }`
  - 校验逻辑独立 `src/lib/turnstile.ts`,便于测试 mock
- **前端**(apps/web 的 register-form):插入 Turnstile widget
  (`https://challenges.cloudflare.com/turnstile/v0/api.js` + div.site-key),
  提交时把 token 塞进 body;sitekey 走 `VITE_TURNSTILE_SITE_KEY`
- **国内可用性**:Turnstile 的 challenges.cloudflare.com 在国内一般可达(CF 有国内 presence);
  真被墙的替代品(自建图形验证码)记入 backlog,不预支

### 测试
- SECRET 未配 → 注册照旧(向后兼容,测试环境零负担)
- SECRET 已配 + 前端没传 token → 403
- SECRET 已配 + mock siteverify 失败 → 403;成功 → 放行
- IP 上限:同 ip_hash 第 3 个/天 → 403

---

## 4. 实施顺序

| 步 | 内容 | 量 |
|---|---|---|
| 1 | 迁移 0005:ai_quota 表 + users.created_ip_hash(+索引);注册时落 ip_hash | 0.5h |
| 2 | 注册限流收紧(5/hour/IP)+ 同 IP 账号数硬顶 | 1h |
| 3 | AI 配额:扣减/查询/429 + GET /review/quota + trigger 双接口接入 | 2h |
| 4 | Turnstile:lib/turnstile.ts + register 接入 + web register-form widget | 2h |
| 5 | 集成测试:配额 21 次 429、quota 可见、IP 硬顶、turnstile mock 三态 | 2h |
| 6 | 部署:CF 后台建 Turnstile site/secret key(用户操作,10 分钟)→ 填进服务器 .env | 用户 10min |

## 5. 需要用户做的(一次性)

1. CF Dashboard → Turnstile → Add Site:域名填 `hls.kskbl.com.cn`(注册页所在),
   拿 **Site Key**(进 web 的 VITE_ 变量)和 **Secret Key**(进服务器 .env)
2. 顺手可开:Security → Bots → Bot Fight Mode(免费,打一遍全站机器人)
