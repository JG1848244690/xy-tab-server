import { request } from '@/lib/request'

export interface Todo {
  id: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  content: string
  color: string
  description?: string
  allDay: boolean
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface MonthStatus {
  completed: string[]
  incomplete: string[]
}

export const todosApi = {
  // 获取月度状态
  getMonthStatus: async (year: number, month: number): Promise<MonthStatus> => {
    const res = await request.get('/todos/month-status', {
      params: { year, month },
    })
    return res.data
  },

  // 获取指定日期的 todos
  getTodosByDate: async (date: string): Promise<Todo[]> => {
    const res = await request.get('/todos/by-date', {
      params: { date },
    })
    return res.data
  },

  // 获取指定月份的所有 todos（批量获取，替代多次请求）
  getTodosByMonth: async (year: number, month: number): Promise<Todo[]> => {
    const res = await request.get('/todos/by-month', {
      params: { year, month },
    })
    return res.data
  },

  // 创建 todo
  create: async (data: {
    startDate: string
    endDate: string
    startTime: string
    endTime: string
    content: string
    color?: string
    description?: string
    allDay?: boolean
  }): Promise<Todo> => {
    const res = await request.post('/todos', data)
    return res.data
  },

  // 更新 todo
  update: async (
    id: string,
    data: {
      startDate: string
      endDate: string
      startTime: string
      endTime: string
      content: string
      color?: string
      description?: string
      allDay?: boolean
    }
  ): Promise<Todo> => {
    const res = await request.patch(`/todos/${id}`, data)
    return res.data
  },

  // 删除 todo
  delete: async (id: string): Promise<void> => {
    await request.delete(`/todos/${id}`)
  },

  // 切换完成状态
  toggleComplete: async (id: string): Promise<{ id: string; completed: boolean }> => {
    const res = await request.patch(`/todos/${id}/toggle`)
    return res.data
  },
}
