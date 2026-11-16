#!/usr/bin/env node
/**
 * 把本次构建新增/更新的 URL 推送给百度(普通收录 API)。
 *
 * 为什么需要它:
 *   - sitemap 是一次性登记,百度自己来抓,慢(几天到几周)
 *   - API 主动推送当天进队列,配额 10 条/天(API 与手动提交共享)
 *   - 发版通常新增 20–30 个 URL,超过配额,所以要按优先级截断
 *
 * 用法:
 *   BAIDU_TOKEN=xxx node scripts/baidu-push.mjs apps/site/out/sitemap.xml
 *
 * 只在 push 触发的部署里跑,定时重建不跑(否则会重复推同一批 URL 浪费配额)。
 */

import fs from 'node:fs'

const SITE = 'code.kskbl.com.cn'
const MAX = Number(process.env.BAIDU_MAX || 10)
const WINDOW_HOURS = Number(process.env.BAIDU_WINDOW_HOURS || 48)

const token = process.env.BAIDU_TOKEN
const sitemapPath = process.argv[2]

if (!token) {
    console.log('[baidu] 没配置 BAIDU_TOKEN,跳过')
    process.exit(0)
}
if (!sitemapPath || !fs.existsSync(sitemapPath)) {
    console.log('[baidu] 找不到 sitemap:', sitemapPath)
    process.exit(0)
}

const xml = fs.readFileSync(sitemapPath, 'utf8')
const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => {
    const block = m[1]
    const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1]
    const lastmod = (block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1]
    return { loc, lastmod: lastmod ? new Date(lastmod) : null }
})

const cutoff = Date.now() - WINDOW_HOURS * 3600 * 1000
const recent = entries.filter((e) => e.lastmod && e.lastmod.getTime() >= cutoff)

/** 优先级:入口页 > 文章/合集 > 题目 */
function bucket(url) {
    const p = new URL(url).pathname
    if (p === '/') return 0
    if (['/banks', '/articles', '/tags'].includes(p)) return 1
    if (p.startsWith('/collection/')) return 2
    if (p.startsWith('/article/')) return 3
    if (p.startsWith('/bank/')) return 4
    if (p.startsWith('/tag/')) return 5
    if (p.startsWith('/question/')) return 6
    return 7
}

const pick = [...recent]
    .sort((a, b) => bucket(a.loc) - bucket(b.loc) || (b.lastmod - a.lastmod))
    .slice(0, MAX)

// 兜底:如果这次没有任何"新"页面,至少保证入口页被推过一次
if (!pick.length) {
    const entriesTop = entries.filter((e) => bucket(e.loc) <= 2).slice(0, MAX)
    pick.push(...entriesTop)
    console.log('[baidu] 本次没有 48h 内更新的页面,改推入口页')
}

if (!pick.length) {
    console.log('[baidu] 没有可推送的 URL')
    process.exit(0)
}

const body = pick.map((p) => p.loc).join('\n')
console.log(`[baidu] 待推送 ${pick.length} 条:\n` + pick.map((p) => '  ' + p.loc).join('\n'))

const endpoint = `http://data.zz.baidu.com/urls?site=${SITE}&token=${token}`

try {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
    })
    const text = await res.text()
    console.log('[baidu] 返回', res.status, text)

    if (!res.ok) {
        // 推送失败不影响部署:百度接口抖动不该阻断发布
        console.log('::warning::百度推送返回非 200,已跳过')
    }
} catch (e) {
    console.log('::warning::百度推送请求失败:', String(e).slice(0, 200))
}
