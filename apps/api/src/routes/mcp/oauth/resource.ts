import { and, eq, gt, isNull } from 'drizzle-orm'
import db from '../../../db/index.js'
import { mcpOAuthGrants } from '../../../db/schema.js'
import { PgOAuthAdapter } from './adapter.js'
import { oauth, scopes } from './config.js'

const accessTokens = new PgOAuthAdapter('AccessToken')

export function oauthChallenge(error?: 'invalid_token' | 'insufficient_scope') {
    if (!oauth) return 'Bearer realm="hlsedu-mcp"'
    const required = error === 'insufficient_scope' ? scopes[1] : scopes.join(' ')
    return `Bearer resource_metadata="${oauth.issuer}${oauth.metadataPath}", scope="${required}"${error ? `, error="${error}"` : ''}`
}

export async function authenticateOAuth(authorization: string | undefined) {
    if (!oauth) return undefined
    const token = /^Bearer ([A-Za-z0-9_-]{20,256})$/i.exec(authorization ?? '')?.[1]
    if (!token || token.startsWith('hlse_mcp_')) return undefined
    const access = await accessTokens.find(token)
    if (!access?.grantId || !access.accountId || !access.clientId || access.kind !== 'AccessToken'
        || access.aud !== oauth.resource || typeof access.exp !== 'number' || access.exp * 1000 <= Date.now()) return undefined
    const [grant] = await db.select().from(mcpOAuthGrants).where(and(
        eq(mcpOAuthGrants.grantId, access.grantId),
        eq(mcpOAuthGrants.userId, access.accountId),
        eq(mcpOAuthGrants.clientId, access.clientId),
        gt(mcpOAuthGrants.expiresAt, new Date()),
        isNull(mcpOAuthGrants.revokedAt),
    )).limit(1)
    const permissions = new Set(access.scope?.split(' '))
    if (!grant?.scopes.includes(scopes[0]) || !permissions.has(scopes[0])) return undefined
    return { id: grant.id, userId: grant.userId, canWrite: grant.scopes.includes(scopes[1]) && permissions.has(scopes[1]) }
}
