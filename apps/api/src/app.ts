import configureOpenAPI from './lib/configure-open-api.js'
import createApp from './lib/create-app.js'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { uploadDir } from './routes/media/config.js'
import index from './routes/index.route.js'
import auth from './routes/auth/auth.index.js'
import questions from './routes/questions/questions.index.js'
import todos from './routes/todos/todos.index.js'
import stats from './routes/stats/stats.index.js'
import review from './routes/review/review.index.js'
import media from './routes/media/media.index.js'
import publicRoutes from './routes/public/public.index.js'
import { cookieAuth } from './middlewares/auth.js'
import { rateLimit } from './middlewares/rate-limit.js'

const app = createApp()

/**
 * 本地上传文件的静态托管(2026-10-26)
 *
 * 生产由 nginx 直接服务 static 子域,不走这里;本地开发把
 * UPLOAD_PUBLIC_BASE 指向 http://127.0.0.1:9999/uploads,靠这条路由看图。
 * 免登录:图片本身就是公开资源(URL 里是随机 uuid,不可枚举)。
 */
const UPLOAD_MIME: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
}

app.get('/uploads/*', async (c) => {
    const rel = decodeURIComponent(c.req.path.slice('/uploads/'.length))
    const root = uploadDir()
    const full = resolve(root, rel)
    // 目录穿越防御:/uploads/../../etc/passwd 之类
    if (full !== root && !full.startsWith(root + sep)) return c.notFound()
    try {
        const data = await readFile(full)
        c.header(
            'Content-Type',
            UPLOAD_MIME[extname(full).toLowerCase()] ?? 'application/octet-stream',
        )
        c.header('Cache-Control', 'public, max-age=31536000, immutable')
        return c.body(data)
    } catch {
        return c.notFound()
    }
})

/**
 * 鉴权中间件按路径应用
 *
 * 公开: POST /auth/login, POST /auth/register, POST /auth/logout
 * 鉴权: /auth/me 及 questions / todos / stats 全部子树
 *
 * 服务路径不带 /api 前缀 —— 前端 Next 的 rewrite 会把 /api/x 剥成 /x 再打到这,
 * 服务器上的 nginx 也用同样的规则剥 /api。
 */
// 登录/注册是唯一对全网裸奔的写入口,先过限流再进 handler
// 登录:固定窗口 30 req/min/IP(nginx 反代会带真实 IP)
// 注册:更紧 —— 5 req/hour/IP,配合同 IP 账号数硬顶(防多号,见
// docs/abuse-defense-plan.md);注册是低频动作,5/小时对真人绰绰有余
app.use('/auth/login', rateLimit({ windowMs: 60_000, max: 30 }))
app.use('/auth/register', rateLimit({ windowMs: 3_600_000, max: 5 }))
app.use('/auth/me', cookieAuth())
app.use('/questions', cookieAuth())
app.use('/questions/*', cookieAuth())
app.use('/todos', cookieAuth())
app.use('/todos/*', cookieAuth())
app.use('/stats', cookieAuth())
app.use('/stats/*', cookieAuth())
// 审核 agent 是写操作(改题目状态/回写报告),必须登录;创建者校验在 handler 里
app.use('/review', cookieAuth())
app.use('/review/*', cookieAuth())
// 图片上传 / 图库管理(列表与删除在 handler 里再判 admin)
app.use('/media', cookieAuth())
app.use('/media/*', cookieAuth())
// /public/** 免登录:公开站数据源,审核链(approved)就是它的安全边界

const routes = [
    index,
    auth,
    questions,
    todos,
    stats,
    review,
    media,
    publicRoutes,
] as const

routes.forEach((route) => {
    app.route('/', route)
})

configureOpenAPI(app)

type AppType = typeof routes[number]

export default app