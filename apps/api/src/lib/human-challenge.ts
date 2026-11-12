/**
 * 本地人机验证(无外网依赖)。
 *
 * 背景:CF Turnstile 的脚本在 `challenges.cloudflare.com`,国内未开代理时经常
 * 加载不出来,注册入口就废了。这里提供一个纯本地兜底:
 *
 *   GET /auth/challenge  → { id, question, sig, expiresAt }
 *   用户回答 question(简单算术),注册时把 { id, answer, sig, expiresAt } 一起提交
 *
 * 服务端用 HMAC 对 (id, answer, expiresAt) 签名,无需落库,天然无状态;
 * 前端看不到答案,sig 又不能伪造。有效期 5 分钟。
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import env from '../env.js'

const TTL_MS = 5 * 60_000
const secret = env.JWT_SECRET

export interface HumanChallenge {
    id: string
    question: string
    sig: string
    expiresAt: number
}

export interface HumanChallengeAnswer {
    id?: string
    answer?: string
    sig?: string
    expiresAt?: number
}

function sign(id: string, answer: string, expiresAt: number): string {
    return createHmac('sha256', secret).update(`${id}.${answer}.${expiresAt}`).digest('hex')
}

export function createChallenge(): HumanChallenge {
    const id = randomUUID()
    // 两位数加法:机器可解,但配合限流足够挡掉批量脚本
    const a = 2 + Math.floor(Math.random() * 8)
    const b = 2 + Math.floor(Math.random() * 8)
    const answer = String(a + b)
    const expiresAt = Date.now() + TTL_MS
    return {
        id,
        question: `${a} + ${b} = ?`,
        sig: sign(id, answer, expiresAt),
        expiresAt,
    }
}

export function verifyChallenge(input: HumanChallengeAnswer | undefined): boolean {
    if (!input?.id || !input.answer || !input.sig || !input.expiresAt) return false
    const expiresAt = Number(input.expiresAt)
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false

    const expected = sign(input.id, String(input.answer).trim(), expiresAt)
    const a = Buffer.from(expected)
    const b = Buffer.from(String(input.sig))
    return a.length === b.length && timingSafeEqual(a, b)
}
