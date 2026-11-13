# 注册邮箱验证:实现与上线手册

面向「序言」后台(React SPA + Hono/Postgres API)。记录实现思路、接口契约,以及从零把真邮件发出去的每一步。

---

## 1. 一句话说清这个流程

> 注册时建号(`email_verified_at = null`)→ 签发一个签名 token → 发到用户邮箱 → 用户点链接回到前端 → 前端把 token 交还给 API → API 验签、写库 → 用户变成「已验证」。

关键在于:**token 不落库**。签名(MAC)+ 过期时间就能证明「这个链接是我们发的」。

---

## 2. 时序图

```
用户                    前端 SPA                  API                     邮件服务
 │                         │                      │                         │
 ├─ 填表(用户名/邮箱/密码)─▶│                      │                         │
 │                         ├─ POST /auth/register ▶│                         │
 │                         │                      ├─ 建号(null)              │
 │                         │                      ├─ 签发 token(HMAC)       │
 │                         │◀── 200 user ─────────┤                         │
 │                         │                      ├─ 发信(不阻塞)───────────▶│
 │◀─「去邮箱完成验证」──────┤                      │                         │
 │                                                                          │
 │◀──────────────── 收到邮件,点链接 ────────────────────────────────────────┤
 │                         │                      │                         │
 ├─ 打开 /verify-email?token=xxx ─▶                │                         │
 │                         ├─ POST /auth/email/verify {token}               │
 │                         │                      ├─ 验签 + 查过期            │
 │                         │                      ├─ 比对邮箱(改过则失效)     │
 │                         │                      ├─ 写 email_verified_at   │
 │                         │◀── { user, alreadyVerified } ──┤               │
 │◀──「验证成功 / 去登录」──┤                      │                         │
```

---

## 3. 关键设计决策(以及为什么)

| 决策 | 原因 | 代价 |
| --- | --- | --- |
| token 用 HMAC 签名,**不落库** | 少一张表、少一次读写、不用定时清理;签名本身就能证明来源 | 签发后无法单独撤销,只能换密钥让全部失效 |
| token 里绑定邮箱 | 用户改邮箱后,旧链接自动作废 | token 变长几十字节,无所谓 |
| 有效期 24h | 注册验证不急;太长会留下长期可用的链接 | 需要「重新发送」兜底 |
| 注册**不等待**发信完成 | 邮件服务超时不该让注册失败(账号其实已经建好,重试反而 409) | 用户可能「注册成功但没收到邮件」,靠重发解决 |
| 重发接口对任何邮箱都返回同一句话 | 否则变成「查这个邮箱注册过没有」的探测器 | 用户拿不到明确反馈,需要文案解释 |
| 未验证**不阻断**登录 | 验证是引导;真正的权限边界在后端 `requireAdmin` | 未验证账号也能用基础功能 |
| 历史账号在迁移里直接标记为已验证 | 新规则不追溯惩罚存量账号 | 老账号永远不需要验证 |
| 发信通道可切换 `log` / `smtp` | 本地零依赖就能跑通完整流程 | 生产误配 `log` 会「假发信」,日志里能看到 |

---

## 4. 代码落在哪

### API

| 文件 | 作用 |
| --- | --- |
| `src/lib/email-token.ts` | 签发 / 校验 token(`base64url(payload).hmac`) |
| `src/lib/mailer.ts` | `log` / `smtp` 两种通道 + 邮件模板 + 验证链接拼接 |
| `src/routes/auth/auth.routes.ts` | 两个新接口的 OpenAPI 契约 |
| `src/routes/auth/auth.handlers.ts` | 注册后发信、验证、重发(含 60s 冷却) |
| `src/app.ts` | `/auth/email/verify` 20/min、`/auth/email/resend` 5/hour 的限流 |
| `src/db/schema.ts` | `users.email_verified_at` |
| `src/db/migrations/0009_*.sql` | 加列 + 存量账号回填 |

### 前端

| 文件 | 作用 |
| --- | --- |
| `src/pages/verify-email/page.tsx` | 邮件链接落地页(公开路由) |
| `src/components/auth/register-form.tsx` | 注册成功后停在「去邮箱」页 + 重发倒计时 |
| `src/components/email-verification-banner.tsx` | 后台顶部「邮箱未验证」提示条(可关闭) |
| `src/services/auth-service.ts` | `verifyEmail` / `resendVerification` |

### 接口

```
POST /auth/register          建号 → 发验证邮件(200)
POST /auth/email/verify      { token } → { user, alreadyVerified }
POST /auth/email/resend      { email } → { message }(永远 200)
GET  /auth/me                返回体里多一个 emailVerifiedAt(null = 未验证)
```

---

## 5. 本地跑通(不需要任何邮件账号)

**前提**:本地 PG 起着。`apps/api/.env` 的 `DATABASE_URL` 决定连哪个库
(仓库里的 compose 默认把 PG 映射到 `127.0.0.1:5433`)。

```bash
# 1. 起数据库(app 容器不用起)
docker compose up -d postgres

# 2. 起 API —— 启动时会自动跑迁移,0009 会被应用
pnpm --filter hlse-api dev

# 3. 起前端
pnpm --filter web-front dev
```

`.env` 里确认这两行(默认值就够):

```
MAIL_TRANSPORT=log
APP_PUBLIC_URL=http://localhost:3000
```

**验证步骤**:

1. 打开 http://localhost:3000/register 注册一个账号
2. 页面停在「去邮箱完成验证」
3. 看 API 控制台,找到:

   ```
   [mail:log] to=new@test.com subject=验证你的邮箱 · 序言
   ...
   http://localhost:3000/verify-email?token=eyJ1aWQiOi...
   ```

4. 复制那个链接到浏览器 → 显示「验证成功」
5. 登录后台,顶部不再有「邮箱尚未验证」提示条
6. 重复点同一个链接 → 显示「邮箱已验证」(幂等)

> 想快速验证接口而不点 UI:
> `curl -X POST localhost:9999/auth/email/verify -H 'Content-Type: application/json' -d '{"token":"..."}'`

---

## 6. 上线:接通真邮件

### Step 1 开通邮件推送服务

以**阿里云邮件推送(DirectMail)**为例(和服务器同厂商,出网最省事):

1. 控制台搜索「邮件推送」→ 开通
2. 免费额度按天计,小站完全够用(额度以官网为准)

### Step 2 绑定发信域名

控制台 → 邮件推送 → 发信域名 → 新增域名。建议用**子域名**,例如 `mail.kskbl.com.cn`,而不是主域名:

- 万一发信信誉受损,不连累 `kskbl.com.cn` 的正常邮件
- `noreply@mail.kskbl.com.cn` 看起来也够正规

### Step 3 配 DNS(这一步决定邮件进不进垃圾箱)

按控制台给的记录逐条添加,通常包含:

| 类型 | 名称示例 | 作用 |
| --- | --- | --- |
| TXT | `mail.kskbl.com.cn` | 域名所有权验证 |
| TXT | `mail.kskbl.com.cn` | SPF:声明哪些 IP 有权代发 |
| CNAME/TXT | `xxx._domainkey.mail...` | DKIM:签名,防篡改 |
| TXT | `_dmarc.mail.kskbl.com.cn` | DMARC:验证失败策略 |

三者的分工:

- **SPF**:「谁能代表我发信」—— 不配,QQ 邮箱会直接判伪造
- **DKIM**:「这封信有没有被改过」—— 不配,容易进垃圾箱
- **DMARC**:「验证失败时怎么办」—— 不配,Gmail 会降权

DNS 生效通常几分钟到几小时,以控制台的「验证通过」为准。

### Step 4 建发信地址并拿 SMTP 密码

控制台 → 发信地址 → 新建(如 `noreply@mail.kskbl.com.cn`)→ 设置 SMTP 密码(只显示一次,记下来)。

### Step 5 写服务器 `.env`

```bash
ssh root@47.94.85.91
cd /opt/hls-api          # compose 项目目录
vi .env
```

追加:

```ini
APP_PUBLIC_URL=https://hls.kskbl.com.cn
MAIL_TRANSPORT=smtp
MAIL_FROM=noreply@mail.kskbl.com.cn
MAIL_FROM_NAME=序言

SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@mail.kskbl.com.cn
SMTP_PASS=<Step 4 的密码>
```

> `SMTP_SECURE=true` 对应 465(SSL);587 要改成 `false`(STARTTLS)。
> 阿里云 ECS **封 25 端口**,不要用 25。

### Step 6 发版

代码要先合入并构建镜像(CI 或手动),然后:

```bash
cd /opt/hls-api
export IMAGE_TAG=<完整 commit SHA>   # 必须显式指定,否则回落到旧镜像
docker compose up -d app
docker compose logs -f app | grep -i mail
```

**注意**:`docker compose up -d` 不带 `IMAGE_TAG` 会拉 `.env` 里旧的 tag,曾因此回退过版本。

迁移会在容器启动时自动执行(`src/index.ts` 里跑 `migrate()`),日志里能看到
`Running migrations...`。

前端也要重新构建发布(`/verify-email` 是新路由)。

### Step 7 验收清单

- [ ] `docker compose logs app` 里没有 `MAIL_TRANSPORT=smtp 但 ... 没配全`
- [ ] 用一个真实邮箱注册,收到邮件(不是垃圾箱)
- [ ] 邮件里的按钮指向 `https://hls.kskbl.com.cn/verify-email?token=...`
- [ ] 点开 → 「验证成功」
- [ ] 再点一次 → 「邮箱已验证」
- [ ] 把 token 改一个字符 → 「链接无效或已过期」
- [ ] 后台顶部提示条在验证后消失
- [ ] 数据库确认:`select email, email_verified_at from users order by created_at desc limit 5;`
- [ ] 邮件在 QQ / 163 邮箱里不是垃圾邮件(重点看 QQ)
- [ ] 查看 `Authentication-Results` 头,SPF / DKIM / DMARC 都应是 `pass`

---

## 7. 上线时踩过的三个坑(2026-11-13)

**1. 401 全局跳转误伤公开页(已修 `a8a3ce0`)**

`request.ts` 的拦截器遇到 401 就 `location.href = '/login'`,只排除了 `/login`。
页面加载时 `AuthBootstrap` 会请求 `/auth/me`,未登录必然 401 →
**在未登录的浏览器里点邮件链接,会先跳登录页,验证页根本不显示**。
现在改成 `PUBLIC_PATHS` 白名单(`/login`、`/register`、`/verify-email`)。

**2. `docker-compose.yml` 的 environment 是白名单**

只写进 `.env` 不够 —— `MAIL_*` / `SMTP_*` 不在 compose 的 `environment:` 里,
容器根本收不到,mailer 会静默回落到 `log` 模式,邮件链接还会是 `localhost:3000`。
新加环境变量时,`.env` 和 `docker-compose.yml` 两处都要改。

**3. 阿里云「发信地址未认证」不影响 SMTP 发信**

控制台显示「未认证 / 状态异常」,点「验证发信地址」要求收验证码,
但邮件推送不提供收信服务,`noreply@` 永远收不到。
实测**未认证状态下 SMTP 仍可发信**(`235 Authentication successful` → `250 Data Ok`),
所以不必卡在这一步。

## 8. 已知限制(刻意留的,不是漏)

1. **`resend` 的 60 秒冷却是进程内 `Map`** —— 单实例够用,多副本会各算各的。
   要上多副本时换 Redis 或数据库计数。
2. **token 无法单独撤销** —— 只能等过期或换 `EMAIL_VERIFY_SECRET`(会作废所有未用链接)。
   如果以后要做「改邮箱」「重置密码」的一次性链接,换成落库 + 随机 token。
3. **未验证不阻断任何功能** —— 想让「未验证」有限制,应该在后端加中间件,
   而不是靠前端提示条。
4. **发信失败只记日志** —— 用户看不到失败原因,只能点「重新发送」。
   如果后续要排查率高,可以加一条 `email_send_log` 表。

---

## 9. 学习用:这个流程可以复用到哪

同一套「无状态签名 token」可以支撑:

- 邮箱验证(token 里 `purpose: verify`)
- 重置密码(`purpose: reset`,有效期 30 分钟)
- 邀请链接(`purpose: invite`,绑定邮箱 + 角色)
- 一次性下载链接

只需要在 payload 里加 `purpose`,校验时按用途区分,不要让验证链接能当重置密码用。
