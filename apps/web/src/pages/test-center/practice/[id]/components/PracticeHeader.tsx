import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Question } from '../types'

interface PracticeHeaderProps {
  question: Question
  timeSpent: number
}

export function PracticeHeader({ question, timeSpent }: PracticeHeaderProps) {
  const navigate = useNavigate()

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const difficulty =
    question.difficulty === 'easy'
      ? { label: '简单', className: 'text-emerald-700 dark:text-emerald-400' }
      : question.difficulty === 'hard'
        ? { label: '困难', className: 'text-red-700 dark:text-red-400' }
        : { label: '中等', className: 'text-amber-700 dark:text-amber-400' }

  return (
    <div className="flex flex-none items-center justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="h-8 flex-none text-muted-foreground"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          返回
        </Button>

        <span className="h-4 w-px flex-none bg-border" />

        <h1 className="truncate font-serif text-[16px] font-medium leading-snug">
          {question.title}
        </h1>
        <span className={`flex-none font-mono text-[10.5px] ${difficulty.className}`}>
          {difficulty.label}
        </span>
        {question.type === 'text' ? (
          <Badge variant="outline" className="flex-none text-[10px]">
            理论题
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-none items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span className="tabular-nums">{formatTime(timeSpent)}</span>
      </div>
    </div>
  )
}
