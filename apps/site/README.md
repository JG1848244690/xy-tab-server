# 面试站(apps/site)

Next.js 15 App Router + `output: 'export'` 纯静态导出。构建期从 API 的
`/public/*` 接口拉数据,预生成全部页面;线上是 nginx 静态服务,零 Node 进程。

## 环境变量

| 变量 | 用途 | 默认 |
|---|---|---|
| `SITE_API_BASE` | 构建期数据源(API 地址)。CI 里走 SSH 隧道 `http://127.0.0.1:8080` | `https://hls.kskbl.com.cn/api-hls` |
| `NEXT_PUBLIC_SITE_URL` | 站点对外 URL(canonical/sitemap/OG) | `https://code.kskbl.com.cn` |
| `NEXT_PUBLIC_BA_ID` | 百度统计 ID,不配则不注入脚本 | 无 |
| `NEXT_PUBLIC_ICP` | 备案号(页脚) | 无 |
| `NEXT_PUBLIC_WEB_URL` | 「我要出题」跳转的后台 SPA 地址 | `https://hls.kskbl.com.cn/test-center` |

## 页面

| 路由 | 数据源 |
|---|---|
| `/` 首页(热门题+题库入口) | `/public/questions` + `/public/banks` + `/public/tags` |
| `/banks`、`/bank/[slug]` | `/public/banks(/:slug)` |
| `/question/[slug]`(QAPage JSON-LD + 相关题) | `/public/questions/:slug` |
| `/tag/[slug]`、`/tags` | `/public/tags`(<240 字介绍 → noindex) |
| `/articles`、`/article/[slug]`(Article JSON-LD) | `/public/articles(/:slug)` |
| `/digest`、`/digest/[issue]`(curated 按 ISO 周分期) | `/public/articles?kind=curated` |
| `/sitemap.xml`、`/robots.txt`、`/rss.xml`、`/llms.txt` | `/public/sitemap-data` |

## 构建

```bash
pnpm --filter hls-site build     # 产物在 apps/site/out/
```

- 构建期每个页面都会打 API(81 题 ×2 请求),内置 3 次重试 + 30s 超时
- **空集合有兜底**:`banks/tags/articles/curated` 为空时动态路由生成 `_empty`
  占位页(output:export 不允许 generateStaticParams 返回空数组)
- 已知 Windows 本地构建坑:worker 随机崩报 "missing generateStaticParams",
  已用 `experimental.cpus: 1` 规避;CI(Linux)无此问题

## 上线手动步骤(nginx,一次性)

1. 域名 `code.kskbl.com.cn` 在 DNS 加解析(A 记录指 47.94.85.91,或走 CF 橙云)
2. 宝塔建站 + 证书,把 `deploy/nginx/site.kskbl.com.cn.conf` 内容按实际域名/证书路径改好
   放到 `/www/server/panel/vhost/nginx/extension/kskbl.com.cn/hls-site.conf`
3. `nginx -t && nginx -s reload`
4. 服务器 `/opt/hls-api/.env` 的 `CORS_ORIGINS` 追加站点域名(浏览计数要跨域 POST)
5. site.yml 推送后自动部署;之后每次 push `apps/site/**` 或后端 public 接口变更自动重建

## 之后(计划里还没做的)

- OG 分享图(ImageResponse 构建期生成)—— SEO 清单第 6 项
- sitemap 5000/片分片(generateSitemaps)
- 百度站长主动推送脚本
- P2 的「发布」按钮(repository_dispatch 触发重建)
