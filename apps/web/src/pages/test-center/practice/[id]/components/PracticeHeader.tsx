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

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '简单'
      case 'medium':
        return '中等'
      case 'hard':
        return '困难'
      default:
        return difficulty
    }
  }

  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'default' as const
      case 'medium':
        return 'secondary' as const
      case 'hard':
        return 'destructive' as const
      default:
        return 'default' as const
    }
  }

  return (
    <div className="border-b px-4 py-2 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <h1 className="text-lg font-semibold truncate">{question.title}</h1>
        <Badge variant={getDifficultyVariant(question.difficulty)} className="shrink-0">
          {getDifficultyText(question.difficulty)}
        </Badge>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Clock className="h-4 w-4" />
        <span className="text-sm">{formatTime(timeSpent)}</span>
      </div>
    </div>
  )
}
