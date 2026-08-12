/**
 * Google id_token 验签(jose + 本地静态 JWKS)
 *
 * 服务器部署在国内 ECS,NAT 网关屏蔽 HTTPS 出站,不能在线拉 Google JWKS,
 * 所以把 JWKS 静态 hardcode 在 src/modules/auth/google-jwks.json。
 * scripts/fetch-google-jwks.ts + .github/workflows/jwks-update.yml 自动更新
 * 这个文件(每月一次)。
 *
 * 验签要点:
 *   - iss 必须是 https://accounts.google.com(或 accounts.google.com)
 *   - aud 必须是我们注册 OAuth client 时 Google Console 给的 client_id
 *   - 签名 RS256,用 kid 从本地 JWKS 里挑公钥
 *   - exp / iat 自动校验(jose 内置)
 *
 * 验证通过后从 payload 拿 sub / email / name / picture 等可信字段。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  createLocalJWKSet,
  jwtVerify,
  errors as joseErrors,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose'
import env from '../../env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 启动时一次性读 JWKS,缓存 jose 的 local JWKS function。
// Google 公钥几个月到一年才轮换一次,定时跑 fetch-google-jwks.ts 更新即可。
const JWKS_PATH = join(__dirname, 'google-jwks.json')

function loadJwks(): JWTVerifyGetKey {
  const raw = readFileSync(JWKS_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as { keys: Array<Record<string, unknown>> }
  return createLocalJWKSet(parsed)
}

const jwks = loadJwks()

/** Google id_token 验签后 payload 形状 */
export interface GoogleIdTokenPayload extends JWTPayload {
  sub: string
  email: string
  email_verified?: boolean
  name?: string
  picture?: string
  nonce?: string
}

/**
 * 验签 Google id_token。
 * 成功返回 payload;失败抛 Error(message 描述失败原因)。
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedNonce?: string,
): Promise<GoogleIdTokenPayload> {
  // Google 颁发的 id_token,issuer 是 https://accounts.google.com
  // (兼容旧的 accounts.google.com — 老 token 可能用裸 host)
  const validIssuers = ['https://accounts.google.com', 'accounts.google.com']

  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: validIssuers,
      audience: env.GOOGLE_CLIENT_ID,
      algorithms: ['RS256'],
    })

    // 二次校验 email_verified(Google 颁发的可能 false,如 alias email)
    if (payload.email_verified === false) {
      throw new Error('Google account email not verified')
    }

    // 可选:校验 nonce(防 replay)。扩展没传 nonce 就不校验。
    if (expectedNonce && payload.nonce !== expectedNonce) {
      throw new Error('id_token nonce mismatch (replay attempt?)')
    }

    return payload as GoogleIdTokenPayload
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new Error('id_token expired')
    }
    if (err instanceof joseErrors.JWTClaimValidationFailed) {
      throw new Error(`id_token claim invalid: ${err.claim} ${err.reason}`)
    }
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      throw new Error('id_token signature verification failed')
    }
    if (err instanceof joseErrors.JOSEError) {
      throw new Error(`id_token verify failed: ${err.message}`)
    }
    throw err
  }
}