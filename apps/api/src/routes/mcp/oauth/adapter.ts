import { createHash } from 'node:crypto'
import { and, eq, gt, isNull, lte } from 'drizzle-orm'
import { errors, type Adapter, type AdapterPayload } from 'oidc-provider'
import db from '../../../db/index.js'
import { mcpOAuthGrants, mcpOAuthRecords } from '../../../db/schema.js'

const hashId = (id: string) => createHash('sha256').update(id).digest('hex')
const credentialModels = new Set(['AuthorizationCode', 'AccessToken', 'RefreshToken'])
const hostedCallbacks = new Set([
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.com/api/mcp/auth_callback',
    'https://chatgpt.com/connector/oauth/callback',
])

function allowedRedirect(value: string) {
    if (hostedCallbacks.has(value)) return true
    const url = URL.parse(value)
    return url?.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        && !url.username && !url.password && !url.hash
}

export async function revokeGrant(grantId: string, owner?: string) {
    return db.transaction(async (tx) => {
        const [revoked] = await tx.update(mcpOAuthGrants).set({ revokedAt: new Date() }).where(and(
            eq(mcpOAuthGrants.grantId, grantId),
            owner ? eq(mcpOAuthGrants.userId, owner) : undefined,
            isNull(mcpOAuthGrants.revokedAt),
        )).returning({ id: mcpOAuthGrants.id })
        if (revoked || !owner) await tx.delete(mcpOAuthRecords).where(eq(mcpOAuthRecords.grantId, grantId))
        return revoked
    })
}

export class PgOAuthAdapter implements Adapter {
    constructor(private readonly model: string) {}

    private key(id: string) {
        return and(eq(mcpOAuthRecords.model, this.model), eq(mcpOAuthRecords.idHash, hashId(id)))
    }

    async upsert(id: string, payload: AdapterPayload, expiresIn?: number) {
        if (this.model === 'Client') {
            const redirects = payload.redirect_uris
            if (!Array.isArray(redirects) || !redirects.length || redirects.length > 6
                || redirects.some((uri) => typeof uri !== 'string' || !allowedRedirect(uri))) {
                throw new errors.InvalidClientMetadata('Only registered hosted or local loopback redirect URIs are allowed')
            }
        }
        const data: Record<string, unknown> = { ...payload }
        if (credentialModels.has(this.model)) delete data.jti
        const values = {
            payload: data,
            grantId: this.model === 'Grant' ? id : payload.grantId ?? null,
            uid: payload.uid ?? null,
            expiresAt: new Date(Date.now() + (expiresIn ?? 180 * 86_400) * 1000),
        }
        await db.insert(mcpOAuthRecords).values({ model: this.model, idHash: hashId(id), ...values })
            .onConflictDoUpdate({ target: [mcpOAuthRecords.model, mcpOAuthRecords.idHash], set: values })
    }

    private async findRecord(where: ReturnType<PgOAuthAdapter['key']>, id?: string) {
        const [row] = await db.select().from(mcpOAuthRecords)
            .where(and(where, gt(mcpOAuthRecords.expiresAt, new Date()))).limit(1)
        if (!row) return undefined
        const payload: AdapterPayload = { ...row.payload }
        if (id && credentialModels.has(this.model)) payload.jti = id
        if (row.consumedAt) payload.consumed = Math.floor(row.consumedAt.getTime() / 1000)
        return payload
    }

    find(id: string) { return this.findRecord(this.key(id), id) }
    findByUid(uid: string) {
        return this.findRecord(and(eq(mcpOAuthRecords.model, this.model), eq(mcpOAuthRecords.uid, uid)))
    }
    async findByUserCode() { return undefined }

    async consume(id: string) {
        const [consumed] = await db.update(mcpOAuthRecords).set({ consumedAt: new Date() }).where(and(
            this.key(id), isNull(mcpOAuthRecords.consumedAt), gt(mcpOAuthRecords.expiresAt, new Date()),
        )).returning({ grantId: mcpOAuthRecords.grantId })
        if (consumed) return
        const [record] = await db.select({ grantId: mcpOAuthRecords.grantId }).from(mcpOAuthRecords).where(this.key(id))
        if (record?.grantId) await revokeGrant(record.grantId)
        throw new errors.InvalidGrant('Authorization credential already consumed or expired')
    }

    async destroy(id: string) { await db.delete(mcpOAuthRecords).where(this.key(id)) }
    async revokeByGrantId(grantId: string) { await revokeGrant(grantId) }
}

export function startOAuthRetention() {
    const prune = () => {
        const now = new Date()
        void Promise.all([
            db.delete(mcpOAuthRecords).where(lte(mcpOAuthRecords.expiresAt, now)),
            db.delete(mcpOAuthGrants).where(lte(mcpOAuthGrants.expiresAt, now)),
        ]).catch(() => console.warn('MCP OAuth retention could not run'))
    }
    prune()
    setInterval(prune, 60 * 60_000).unref()
}
