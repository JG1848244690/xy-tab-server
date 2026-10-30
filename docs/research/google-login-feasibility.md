# 后台接入 Google 登录可行性调研(2026-10-30)

## 结论

**代码本身不难,1–2 天能做完;但在当前部署环境里直接接 Google 登录不可用。**

两个硬事实:

1. **生产服务器访问不了 Google**
   在阿里云北京机器上实测:

   | 地址 | 结果 |
   | --- | --- |
   | `oauth2.googleapis.com/token` | 超时(8s 无响应) |
   | `accounts.google.com/.well-known/openid-configuration` | 超时 |
   | `www.googleapis.com/oauth2/v3/certs` | 超时 |
   | `github.com` | 200 / 0.9s |
   | `api.github.com` | 200 / 0.4s |
   | `www.cloudflare.com` | 200 / 0.7s |

   DNS 能解析出 Google 的 IP,但 TCP/TLS 被阻断。也就是说:授权码换 token、校验 id_token 这两步在服务器上必然失败。

2. **大陆用户浏览器打不开 `accounts.google.com`**
   没有代理时连登录页都出不来。后台使用者主要在国内,这一步就卡死了。

因此:除非「服务器 + 使用者」都有稳定代理,否则 Google 登录只能服务海外用户。

## 现有登录架构(改造点很少)

- 后端:Hono + Drizzle + PG,`POST /auth/login` 校验 bcrypt 后签 JWT,写 **HttpOnly Cookie** `Authentication`(`SameSite=Lax`,`Secure` 生产开启)。
- 前端:React + axios(`withCredentials`),`authService.login/me/logout`,zustand 持久化用户信息。
- 部署:`hls.kskbl.com.cn` 的 SPA 和 `/api-hls/*` 反代到同一个容器,**同源**,Cookie 不需要跨域处理。
- `users` 表:`email` 唯一、`password NOT NULL`(bcrypt)、`username`、`role`、`createdIpHash`。
- 目前代码里没有任何 OAuth 相关实现。

Google 登录要动的地方:

| 改动 | 内容 |
| --- | --- |
| 迁移 | `users` 加 `google_sub varchar(255)`(唯一,可空) |
| 后端 | `GET /auth/google`(生成 state + PKCE,302 到 Google) |
| 后端 | `GET /auth/google/callback`(校验 state、换 token、验 id_token、按 `google_sub`/已验证邮箱找用户、签 JWT Cookie、302 回前端) |
| 配置 | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` |
| 前端 | 登录页加「使用 Google 登录」按钮 → 跳 `/api-hls/auth/google`;处理 `?error=` |
| Google Cloud | 建项目 → OAuth consent screen → Web client → 授权回调 URI |

`users.password NOT NULL` 不是问题:Google 新用户写一个随机 bcrypt hash 即可,不用改列。

## Google 侧配置与政策(2026)

1. Google Cloud Console 建项目 → **Google Auth Platform**
2. 填 Branding:应用名、支持邮箱、首页、**隐私政策链接**
3. Audience 选 External;Scopes 只勾 `openid`、`email`、`profile`
4. 建 OAuth Client(Web application):
   - Authorized JavaScript origins:`https://hls.kskbl.com.cn`
   - Authorized redirect URI:`https://hls.kskbl.com.cn/api-hls/auth/google/callback`
5. 发布状态:
   - **Testing**:只勾基础身份 scope 时任何 Google 用户都能登录(不必加白名单),但会显示「应用未验证/测试中」警告;不申请 `offline` 就没有 7 天 refresh token 问题。
   - **Published + 未验证**:任何用户可以登录,但同意屏不展示应用名/logo,且敏感 scope 有 100 用户上限。
   - 只用了 `openid/email/profile` 这三个非敏感 scope,**不需要敏感 scope 审核**;但要在同意屏展示名称/logo,需要做品牌验证(首页 + 隐私政策 + 域名归属)。

**现有缺口**:站点没有 `/privacy`、`/terms` 页面,登录页底部那两个按钮是死链。上 Google 登录前要补两个静态页(半小时的事)。

## 工作量估算(不含翻墙/中转)

| 项 | 时间 |
| --- | --- |
| Google Cloud 配置 + 隐私政策页 | 1–2 小时 |
| 后端两条路由 + 用户关联 + 测试 | 0.5–1 天 |
| 前端按钮 + 错误态 | 2–3 小时 |
| 合计 | **1–2 天** |

如果加「Cloudflare Worker 中转 Google API」(服务器能连 Cloudflare,实测 200):

| 项 | 时间 |
| --- | --- |
| Worker 代理 token + JWKS,密钥只放 Worker | +0.5 天 |
| 多一个要维护的线上组件、排障链路变长 | 长期成本 |

注意:中转只解决**服务器出网**,解决不了**用户浏览器打不开 Google**。所以中转 + 国内用户仍然无解,除非用户自己挂代理。

## 安全注意点(如果做)

- 必须校验 `state`(HttpOnly Cookie + 10 分钟过期),建议加 PKCE。
- id_token 必须校验 `iss`、`aud`、`exp`、`nonce`,签名用 Google JWKS。
- 只在 `email_verified === true` 时才允许按邮箱关联已有账号;否则可能被抢注邮箱。
- `google_sub` 才是稳定主键,邮箱可能变。
- 回调 URL 必须和 Cloud Console 完全一致(协议/大小写/结尾斜杠)。
- 登录回调要限流,避免被刷。

## 替代方案对比

| 方案 | 服务器可达 | 大陆浏览器 | 工作量 | 评价 |
| --- | --- | --- | --- | --- |
| Google OAuth | ❌ 需中转 | ❌ 需代理 | 1–2 天(+0.5 中转) | 只适合海外用户 |
| **GitHub OAuth** | ✅ 200 | ✅ 一般可直连 | 1 天 | **最推荐**:后台是开发者工具,用户都有 GitHub |
| Gitee OAuth | ✅ 200 | ✅ | 1 天 | 国内可用,但开发者覆盖不如 GitHub |
| 微信扫码 | ✅ | ✅ | 2–3 天(需要企业主体/开放平台审核) | 适合面向大众用户,不适合后台 |
| 继续邮箱密码 | — | — | 0 | 后台人少,现状够用 |

## 建议

1. **短期**:后台继续用邮箱密码,不接 Google。
2. **要做社交登录**:优先 **GitHub OAuth**——服务器直连、国内一般可用、目标用户匹配,改造量和 Google 几乎一样。
3. **一定要 Google**:只作为「海外用户可选登录」,并接受:
   - 服务器加 Cloudflare Worker 中转(或香港跳板);
   - 国内使用者必须自备代理;
   - 补隐私政策/服务条款页 + 品牌验证。
4. 如果只是想让管理员登录更方便,更划算的是:邮箱密码 + 更长登录态 / 2FA,而不是社交登录。
