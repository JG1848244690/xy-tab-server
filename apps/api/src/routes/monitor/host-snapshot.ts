import { readFile } from 'node:fs/promises'
import { z } from '@hono/zod-openapi'
import env from '../../env.js'

const date = z.string().datetime({ offset: true })
const bytes = z.number().int().nonnegative()
const backupResult = z.object({ at: date, status: z.enum(['ok', 'failed']) }).nullable()
const snapshot = z.object({
    source: z.enum(['host', 'demo']),
    at: date,
    disk: z.object({ totalBytes: bytes.positive(), availableBytes: bytes }),
    storage: z.object({ uploadsBytes: bytes.nullable(), backupsBytes: bytes.nullable(), logsBytes: bytes.nullable() }),
    service: z.object({ status: z.enum(['healthy', 'starting', 'unhealthy', 'stopped', 'unknown']), release: z.string().max(64).nullable(), startedAt: date.nullable() }),
    backup: z.object({ latestSuccessAt: date.nullable(), latest: backupResult, restoreDrill: backupResult }),
})

export async function readHostSnapshot() {
    if (!env.SYSTEM_MONITOR_SNAPSHOT) return { state: 'unconfigured' as const, snapshot: null }
    try {
        const parsed = snapshot.parse(JSON.parse(await readFile(env.SYSTEM_MONITOR_SNAPSHOT, 'utf8')))
        const age = Date.now() - Date.parse(parsed.at)
        if (age < -60_000 || (env.NODE_ENV === 'production' && parsed.source === 'demo')) throw new Error('Invalid sample')
        return { state: age > 12 * 60_000 ? 'stale' as const : 'current' as const, snapshot: parsed }
    } catch {
        return { state: 'unavailable' as const, snapshot: null }
    }
}
