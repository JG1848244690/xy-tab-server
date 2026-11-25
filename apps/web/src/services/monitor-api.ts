import { request } from '@/lib/request'

export interface MonitorUser {
  id: string
  name: string | null
  email: string
  role: 'admin' | 'user'
  createdAt: string
  verifiedAt: string | null
  lastLogin?: string | null
}

export interface MonitorEvent {
  id: string
  action: string
  status: number
  createdAt: string
  actor?: string | null
  actorId?: string | null
  targetId?: string | null
  requestId?: string | null
  source?: string | null
}

interface BackupResult { at: string; status: 'ok' | 'failed' }
export interface HostSnapshot {
  source: 'host' | 'demo'
  at: string
  disk: { totalBytes: number; availableBytes: number }
  storage: { uploadsBytes: number | null; backupsBytes: number | null; logsBytes: number | null }
  service: { status: 'healthy' | 'starting' | 'unhealthy' | 'stopped' | 'unknown'; release: string | null; startedAt: string | null }
  backup: { latestSuccessAt: string | null; latest: BackupResult | null; restoreDrill: BackupResult | null }
}

export interface MonitorSummary {
  registrations: number
  failedLogins: number
  registrationBlocks: number
  errors: number
  maxFailuresFromSource: number
  databaseBytes: number
  host: { state: 'unconfigured' | 'unavailable' | 'current' | 'stale'; snapshot: HostSnapshot | null }
}

interface Page<T> { data: T[]; hasMore: boolean }

export const monitorApi = {
  summary: async () => (await request.get<MonitorSummary>('/admin/monitor/summary')).data,
  users: async (params: { page: number; filter: string; q: string }) =>
    (await request.get<Page<MonitorUser>>('/admin/monitor/users', { params })).data,
  user: async (id: string) =>
    (await request.get<{ user: MonitorUser; activity: MonitorEvent[] }>(`/admin/monitor/users/${id}`)).data,
  events: async (params: { page: number; action: string }) =>
    (await request.get<Page<MonitorEvent>>('/admin/monitor/events', { params })).data,
}
