/**
 * 抓 Google id_token JWKS 公钥,写到 src/modules/auth/google-jwks.json。
 *
 * 服务器部署在国内 ECS 屏蔽 HTTPS 出站,不能在线拉 JWKS,所以每月一次
 * 把 Google 的 OAuth 公钥列表 hardcode 到代码里(.github/workflows/jwks-update.yml
 * 自动跑这个脚本 + 自动 commit)。
 *
 * 用法:
 *   pnpm fetch:jwks                      # 抓最新 + 写到默认路径
 *   pnpm fetch:jwks -- --output <path>   # 写到自定义路径
 *
 * Google 公钥几个月到一年轮换一次,过期时 jose 会报 JOSEError 找不到 kid,
 * 那时手动跑一次这个脚本 + commit。
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const DEFAULT_OUTPUT = join(__dirname, '..', 'src', 'modules', 'auth', 'google-jwks.json')

interface JWKS {
  keys: Array<Record<string, unknown>>
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  let outputPath = DEFAULT_OUTPUT

  // 简单 CLI 解析: --output <path>
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1]
      i++
    }
  }

  console.log(`[fetch-google-jwks] fetching ${JWKS_URL} ...`)
  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) {
    throw new Error(`JWKS fetch failed: ${res.status} ${res.statusText}`)
  }
  const jwks = (await res.json()) as JWKS

  if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
    throw new Error('JWKS response has no keys (unexpected shape)')
  }

  // 输出紧凑 JSON(2KB 左右,git diff 友好)
  const formatted = JSON.stringify(jwks, null, 2) + '\n'
  writeFileSync(outputPath, formatted, 'utf-8')

  console.log(`[fetch-google-jwks] wrote ${jwks.keys.length} keys to ${outputPath}`)
  console.log(`[fetch-google-jwks] kids: ${jwks.keys.map((k) => String(k.kid).slice(0, 16) + '…').join(', ')}`)
}

main().catch((err) => {
  console.error('[fetch-google-jwks] FAILED:', err)
  process.exit(1)
})