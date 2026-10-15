import { request } from '@/lib/request'

export interface CreateQuestionDto {
  type: 'markdown' | 'text'
  title: string
  content: string
  answer: string
  difficulty?: 'easy' | 'medium' | 'hard'
  tags?: string[]
}

export interface QuestionStats {
  totalAttempts: number
  correctAttempts: number
  status: 'not_started' | 'in_progress' | 'completed'
  lastAttemptAt: string | null
}

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
  stats: QuestionStats
}

export interface QuestionsListParams {
  type?: 'markdown' | 'text'
  difficulty?: 'easy' | 'medium' | 'hard'
  tag?: string
  status?: 'not_started' | 'in_progress' | 'completed'
  page?: number
  size?: number
  ordering?: string
  search?: string
}

export interface QuestionsListResponse {
  data: Question[]
  total: number
  page: number
  size: number
}

export const questionsApi = {
  // 创建题目
  create: async (data: CreateQuestionDto): Promise<Question> => {
    const res = await request.post('/questions', data)
    return res.data
  },

  // 获取题目列表
  getList: async (params: QuestionsListParams): Promise<QuestionsListResponse> => {
    const res = await request.get('/questions', { params })
    return res.data
  },

  // 获取题目详情
  getOne: async (id: string): Promise<Question> => {
    const res = await request.get(`/questions/${id}`)
    return res.data
  },

  // 更新题目
  update: async (id: string, data: CreateQuestionDto): Promise<Question> => {
    const res = await request.put(`/questions/${id}`, data)
    return res.data
  },

  // 删除题目
  delete: async (id: string): Promise<void> => {
    await request.delete(`/questions/${id}`)
  },

  // 提交答案
  submitAnswer: async (id: string, data: { userAnswer: string; timeSpent: number }) => {
    const res = await request.post(`/questions/${id}/submit`, data)
    return res.data
  },

  // 标记答案对错
  markCorrect: async (questionId: string, attemptId: string, isCorrect: boolean) => {
    const res = await request.patch(`/questions/${questionId}/attempts/${attemptId}`, { isCorrect })
    return res.data
  },

  // 获取答题历史
  getAttempts: async (id: string) => {
    const res = await request.get(`/questions/${id}/attempts`)
    return res.data
  },
}
