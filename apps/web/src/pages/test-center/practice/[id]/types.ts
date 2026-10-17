// 练习页面的类型定义
export interface Question {
  id: string
  type: 'markdown' | 'text'
  title: string
  content?: string
  answer?: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags?: string[]
  createdAt: string
  updatedAt: string
  stats: {
    totalAttempts: number
    correctAttempts: number
    status: 'not_started' | 'in_progress' | 'completed'
    lastAttemptAt: string | null
  }
}

export interface Attempt {
  id: string
  questionId: string
  userId: string
  userAnswer: string
  isCorrect: number | null
  timeSpent: number
  attemptCount: number
  createdAt: string
}
