/**
 * 邮箱验证 token:无状态 HMAC 签名,不落库。
 *
 * 为什么不用「数据库存随机 token」:
 *   - 少一张表、少一次读写、不用定时清理过期行
 *   - 校验只需要「签名对不对 + 有没有过期」,这两件事 HMAC 都能做
 *   - 和 lib/human-challenge.ts 同一套思路,项目里保持一致
 *
 * 代价:签发后无法单独撤销(只能改密钥让全部失效)。
 * 对「注册后验证邮箱」这种五分钟就过期的场景,完全可以接受;
 * 如果将来要做「改邮箱」「重置密码」并要求一次性,再换落库方案。
 *
 * token 结构:<base64url(payload)>.<hmac-sha256(payload)>
 * payload:{ uid, em, exp } —— uid 定位用户,em 绑定邮箱(改邮箱后旧链接自动失效),exp 毫秒时间戳
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import env from '../env.js'

const TTL_MS = env.EMAIL_VERIFY_TTL_HOURS * 3_600_000
const secret = env.EMAIL_VERIFY_SECRET || env.JWT_SECRET

interface TokenPayload {
    uid: string
    em: string
    exp: number
}

function sign(payloadB64: string): string {
    return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

export interface EmailVerifyToken {
    token: string
    expiresAt: number
}

export function createEmailVerifyToken(
    userId: string,
    email: string,
    now: number = Date.now(),
): EmailVerifyToken {
    const payload: TokenPayload = { uid: userId, em: email, exp: now + TTL_MS }
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
    return { token: `${payloadB64}.${sign(payloadB64)}`, expiresAt: payload.exp }
}

export function verifyEmailVerifyToken(
    token: string | undefined | null,
): { userId: string; email: string } | null {
    if (!token) return null
    const dot = token.lastIndexOf('.')
    if (dot <= 0) return null

    const payloadB64 = token.slice(0, dot)
    const providedSig = token.slice(dot + 1)

    // 先比签名再解析 JSON:签名不对的内容根本不该进 JSON.parse
    const expected = Buffer.from(sign(payloadB64))
    const provided = Buffer.from(providedSig)
    if (expected.length !== provided.length) return null
    if (!timingSafeEqual(expected, provided)) return null

    let payload: TokenPayload
    try {
        payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    } catch {
        return null
    }

    if (typeof payload?.uid !== 'string' || typeof payload?.em !== 'string') return null
    if (typeof payload?.exp !== 'number' || Date.now() > payload.exp) return null

    return { userId: payload.uid, email: payload.em }
}
