import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, gt } from 'drizzle-orm'
import db from '../../db/index.js'
import { mcpKeys, users } from '../../db/schema.js'

const keyMetadata = {
    id: mcpKeys.id,
    name: mcpKeys.name,
    canWrite: mcpKeys.canWrite,
    createdAt: mcpKeys.createdAt,
    expiresAt: mcpKeys.expiresAt,
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function listMcpKeys(userId: string) {
    return db.select(keyMetadata).from(mcpKeys)
        .where(eq(mcpKeys.userId, userId)).orderBy(desc(mcpKeys.createdAt))
}

export async function createMcpKey(userId: string, input: { name: string; access: 'read' | 'read_write'; expiresInDays: number }) {
    const token = `hlse_mcp_${randomBytes(32).toString('base64url')}`
    return db.transaction(async (tx) => {
        // Serialize creation for this account so concurrent requests share the same limit.
        const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update')
        if (!user) return null
        const existing = await tx.select({ id: mcpKeys.id }).from(mcpKeys)
            .where(eq(mcpKeys.userId, userId)).limit(20)
        if (existing.length === 20) return null

        const [key] = await tx.insert(mcpKeys).values({
            userId,
            name: input.name,
            canWrite: input.access === 'read_write',
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
        }).returning(keyMetadata)
        return { ...key!, token }
    })
}

export async function revokeMcpKey(userId: string, id: string) {
    const [removed] = await db.delete(mcpKeys)
        .where(and(eq(mcpKeys.id, id), eq(mcpKeys.userId, userId)))
        .returning({ id: mcpKeys.id })
    return removed
}

export async function authenticateMcpKey(authorization: string | undefined) {
    const match = /^Bearer (hlse_mcp_[A-Za-z0-9_-]{43})$/i.exec(authorization ?? '')
    if (!match) return undefined
    const [key] = await db.select({
        id: mcpKeys.id, userId: mcpKeys.userId, canWrite: mcpKeys.canWrite,
    }).from(mcpKeys).where(and(
        eq(mcpKeys.tokenHash, hashToken(match[1]!)),
        gt(mcpKeys.expiresAt, new Date()),
    )).limit(1)
    return key
}
