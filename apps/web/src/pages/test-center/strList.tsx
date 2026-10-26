import MyTable from '@/components/myTable'
import { store } from './store'
import { columns } from './strCol'
import { useQuery } from '@tanstack/react-query'
import { questionsApi } from '@/services/questions-api'

const List = () => {
  const { filter, updates } = store()

  // 构建查询参数
  const queryParams = {
    type: 'text' as const,
    page: filter.page || 1,
    size: filter.size || 20,
    ...(filter.ordering && { ordering: filter.ordering }),
    ...(filter.difficulty && { difficulty: filter.difficulty as 'easy' | 'medium' | 'hard' }),
    ...(filter.visibility && { visibility: filter.visibility as 'shared' | 'private' }),
    ...(filter.status && { status: filter.status as 'not_started' | 'in_progress' | 'completed' }),
    ...(filter.tag && { tag: filter.tag }),
    ...(filter.search && { search: filter.search }),
  }

  // 使用 React Query 获取数据
  const { data, isPending } = useQuery({
    queryKey: ['questions', 'text', queryParams],
    queryFn: () => questionsApi.getList(queryParams),
  })

  const questions = data?.data || []
  const totalCount = data?.total || 0

  const changePages = (page: number, size: number) => {
    const data = { ...filter }
    if (filter.size !== size) {
      data.page = 1
      data.size = size
    } else {
      data.page = page
    }
    updates({ filter: data })
  }

  const handleSort = (field: string) => {
    const data = { ...filter }
    // 如果当前排序字段是该字段，切换排序方向
    if (data.ordering === field) {
      data.ordering = `-${field}` // 倒序
    } else if (data.ordering === `-${field}`) {
      delete data.ordering // 取消排序
    } else {
      data.ordering = field // 正序
    }
    data.page = 1 // 排序后回到第一页
    updates({ filter: data })
  }

  const handleFilterChange = (field: string, value: string) => {
    const data: any = { ...filter }
    if (value) {
      data[field] = value
    } else {
      delete data[field]
    }
    data.page = 1 // 所有筛选都重置页码
    updates({ filter: data })
  }

  return (
    <div className="w-full">
      <MyTable
        columns={columns}
        data={questions}
        totalCount={totalCount}
        loading={isPending}
        filter={filter}
        onPaginationChange={changePages}
        onSort={handleSort}
        onFilterChange={handleFilterChange}
      />
    </div>
  )
}

export default List
