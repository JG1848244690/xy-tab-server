import { Check } from 'lucide-react'

export function PracticeCompletionFeedback({ checkIn }: { checkIn?: { streak: number } }) {
  return (
    <p role="status" className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <Check aria-hidden="true" className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
      <span>本题已完成{checkIn && ` · 今日已打卡 · 连续 ${checkIn.streak} 天`}</span>
    </p>
  )
}
