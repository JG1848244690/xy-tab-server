import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { request } from '@/lib/request'

export interface QuotaState {
    used: number
    limit: number
    remaining: number
    limited: boolean
    resetAt: string
    exempt: boolean
}

/** 今日 AI 审核配额(防滥用:次数用户可见) */
export async function fetchQuota(): Promise<QuotaState> {
    return (await request.get<QuotaState>('/review/quota')).data
}

/**
 * 「今日 AI 审核 x/20」徽章:
 * - admin 显示「豁免」;配额尽显示红色 + 重置时间
 * - queryKey ['ai-quota']:触发审核的 mutation 成功后 invalidate 即刷新
 */
export function QuotaBadge() {
    const { data } = useQuery({
        queryKey: ['ai-quota'],
        queryFn: fetchQuota,
    })

    if (!data) return null

    if (data.exempt) {
        return (
            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                AI 审核:admin 不限次
            </span>
        )
    }

    const exhausted = data.remaining === 0
    const resetTime = data.resetAt ? new Date(data.resetAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''

    return (
        <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                exhausted ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
            }`}
            title={exhausted ? `${resetTime} 后重置` : undefined}
        >
            <Sparkles className="h-3.5 w-3.5" />
            今日 AI 审核
            <span className="font-mono font-semibold">
                {data.used}/{data.limit}
            </span>
            {exhausted ? <span>({resetTime} 后重置)</span> : null}
        </span>
    )
}
