import { create } from 'zustand'

export type BoardType = {
  id: string
  groupName: string
}

type Payment = {
  id: string
  amount: number
  status: 'pending' | 'processing' | 'success' | 'failed'
  email: string
}

export type FilterType = {
  page: number
  size: number
  ordering?: string
  status?: string
  difficulty?: string
  visibility?: string
  tag?: string
  search?: string
}

type StoreState = {
  payments: Payment[]
  totalCount: number
  filter: FilterType
  open: Record<string, unknown>
  loading: Record<string, unknown>
  errMsg: Record<string, unknown>
  getData: (params: Record<string, unknown>) => void
  updates: (params: Partial<StoreState>) => void
  clearStore: () => void
}

export const store = create<StoreState>((set, get) => ({
  payments: [],
  totalCount: 0,
  // 列表默认每页 20 条(2026-10-26 UX 调整)
  filter: { page: 1, size: 20 },
  open: { modal: false },
  loading: {},
  errMsg: {},

  getData: async (params) => {
    console.log(params)

    const { filter } = get()
    set({ loading: { table: true } })

    // 模拟后端接口，实际使用时替换为真实接口
    const allData = [
      { id: '1', amount: 100, status: 'pending' as const, email: 'user1@example.com' },
      { id: '2', amount: 125, status: 'processing' as const, email: 'user2@example.com' },
      { id: '3', amount: 150, status: 'success' as const, email: 'user3@example.com' },
      { id: '4', amount: 200, status: 'failed' as const, email: 'user4@example.com' },
      { id: '5', amount: 175, status: 'pending' as const, email: 'user5@example.com' },
      { id: '6', amount: 300, status: 'success' as const, email: 'user6@example.com' },
      { id: '7', amount: 250, status: 'processing' as const, email: 'user7@example.com' },
      { id: '8', amount: 180, status: 'pending' as const, email: 'user8@example.com' },
      { id: '9', amount: 220, status: 'success' as const, email: 'user9@example.com' },
      { id: '10', amount: 190, status: 'failed' as const, email: 'user10@example.com' },
      { id: '11', amount: 160, status: 'pending' as const, email: 'user11@example.com' },
      { id: '12', amount: 280, status: 'processing' as const, email: 'user12@example.com' },
      { id: '13', amount: 210, status: 'success' as const, email: 'user13@example.com' },
      { id: '14', amount: 195, status: 'failed' as const, email: 'user14@example.com' },
      { id: '15', amount: 165, status: 'pending' as const, email: 'user15@example.com' },
      { id: '16', amount: 310, status: 'processing' as const, email: 'user16@example.com' },
      { id: '17', amount: 240, status: 'success' as const, email: 'user17@example.com' },
      { id: '18', amount: 185, status: 'failed' as const, email: 'user18@example.com' },
      { id: '19', amount: 270, status: 'pending' as const, email: 'user19@example.com' },
      { id: '20', amount: 320, status: 'success' as const, email: 'user20@example.com' },
    ]

    await new Promise((resolve) => setTimeout(resolve, 1000)) // 模拟延迟

    const start = (filter.page - 1) * filter.size
    const end = start + filter.size
    const data = allData.slice(start, end)

    set({
      payments: data,
      totalCount: allData.length,
      loading: { table: false },
    })
  },

  updates: (params) => {
    set({ ...params })
  },
  clearStore: () => {
    set({
      filter: { page: 1, size: 20 },
      payments: [],
      totalCount: 0,
      open: {},
      loading: {},
      errMsg: {},
    })
  },
}))
