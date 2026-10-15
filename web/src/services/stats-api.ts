import { request } from '@/lib/request'

export interface RecentQuestion {
  id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  createdAt: string
}

export interface RecentAttempt {
  id: string
  questionId: string
  questionTitle: string
  isCorrect: number
  createdAt: string
}

export interface RecentVideo {
  id: string
  title: string
  status: string
  createdAt: string
}

export interface RecentWatchedVideo {
  id: number
  videoId: string
  videoTitle: string
  progressPercent: number
  lastWatchedAt: string
}

export interface DashboardStats {
  questions: {
    recentAdded: RecentQuestion[]
    recentAttempted: RecentAttempt[]
    totalAttempts: number
    totalCorrect: number
    accuracy: number
    thisWeekAdded: number
    thisWeekAttempted: number
  }
  videos: {
    recentAdded: RecentVideo[]
    recentWatched: RecentWatchedVideo[]
    totalVideos: number
    inProgress: number
    thisWeekAdded: number
  }
  todos: {
    todayCompleted: number
    todayTotal: number
    thisWeekCompleted: number
    thisWeekTotal: number
    completionRate: number
  }
  summary: {
    thisWeekQuestionsAdded: number
    thisWeekQuestionsAttempted: number
    thisWeekVideosAdded: number
    thisWeekTodosCompleted: number
  }
}

export interface PracticeTrendData {
  date: string
  value: number
}

export interface PracticeTrendParams {
  days?: 7 | 15 | 30
  type?: 'frequency' | 'duration'
}

export interface DistributionData {
  name: string
  value: number
  count: number
  difficulty?: string
}

export interface IncompleteQuestion {
  id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags?: string[]
  createdAt: string
  stats: {
    totalAttempts: number
    correctAttempts: number
    status: 'not_started' | 'in_progress' | 'completed'
  }
}

export interface IncompleteQuestionsResponse {
  data: IncompleteQuestion[]
  total: number
  page: number
  size: number
  hasMore: boolean
}

// 重复定义已删除，使用上面的 RecentQuestion 接口

export interface CompletedQuestion {
  id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags?: string[]
  completedAt: string
  totalAttempts: number
}

export interface RecentQuestionsResponse {
  data: RecentQuestion[]
  total: number
  page: number
  size: number
  hasMore: boolean
}

export interface CompletedQuestionsResponse {
  data: CompletedQuestion[]
  total: number
  page: number
  size: number
  hasMore: boolean
}

export const statsApi = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    const res = await request.get('/stats/dashboard')
    return res.data
  },

  getPracticeTrend: async (params: PracticeTrendParams): Promise<PracticeTrendData[]> => {
    const res = await request.get('/stats/practice-trend', { params })
    return res.data
  },

  getTagDistribution: async (): Promise<DistributionData[]> => {
    const res = await request.get('/stats/tag-distribution')
    return res.data
  },

  getDifficultyDistribution: async (): Promise<DistributionData[]> => {
    const res = await request.get('/stats/difficulty-distribution')
    return res.data
  },

  getIncompleteQuestions: async (
    page: number = 1,
    size: number = 10
  ): Promise<IncompleteQuestionsResponse> => {
    const res = await request.get('/stats/incomplete-questions', {
      params: { page, size },
    })
    return res.data
  },

  getRecentAddedQuestions: async (
    page: number = 1,
    size: number = 10
  ): Promise<RecentQuestionsResponse> => {
    const res = await request.get('/stats/recent-added-questions', {
      params: { page, size },
    })
    return res.data
  },

  getRecentCompletedQuestions: async (
    page: number = 1,
    size: number = 10
  ): Promise<CompletedQuestionsResponse> => {
    const res = await request.get('/stats/recent-completed-questions', {
      params: { page, size },
    })
    return res.data
  },
}
