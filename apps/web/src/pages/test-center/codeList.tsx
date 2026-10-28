import MyTable from '@/components/myTable'
import { store } from './store'
import { columns } from './codeCol'
import { useQuery } from '@tanstack/react-query'
import { questionsApi } from '@/services/questions-api'
import { useDebounce } from 'ahooks'
import { useState, useEffect } from 'react'

const List = () => {
  const { filter, updates } = store()
  const [searchInput, setSearchInput] = useState(filter.search || '')

  // 防抖后的搜索值（500ms 延迟）
  const debouncedSearch = useDebounce(searchInput, { wait: 500 })

  // 当防抖后的搜索值变化时，更新 filter
  useEffect(() => {
    if (debouncedSearch !== filter.search) {
      const data = { ...filter }
      if (debouncedSearch) {
        data.search = debouncedSearch
      } else {
        delete data.search
      }
      data.page = 1 // 搜索时重置到第一页
      updates({ filter: data })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // 构建查询参数
  const queryParams = {
    type: 'markdown' as const,
    page: filter.page || 1,
    size: filter.size || 20,
    ...(filter.ordering && { ordering: filter.ordering }),
    ...(filter.difficulty && { difficulty: filter.difficulty as 'easy' | 'medium' | 'hard' }),
    ...(filter.visibility && { visibility: filter.visibility as 'shared' | 'private' }),
    ...(filter.status && { status: filter.status as 'not_started' | 'in_progress' | 'completed' }),
    ...(filter.tag && { tag: filter.tag }),
    ...(filter.direction && { direction: filter.direction }),
    ...(filter.stack && { stack: filter.stack }),
    ...(filter.point && { point: filter.point }),
    ...(filter.search && { search: filter.search }),
  }

  // 使用 React Query 获取数据
  const { data, isPending } = useQuery({
    queryKey: ['questions', 'markdown', queryParams],
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
    if (field === 'search') {
      // 搜索字段使用防抖，只更新本地状态
      setSearchInput(value)
    } else {
      // 其他筛选字段立即生效
      const data: any = { ...filter }
      if (value) {
        data[field] = value
      } else {
        delete data[field]
      }
      data.page = 1 // 所有筛选都重置页码
      updates({ filter: data })
    }
  }

  return (
    <div className="w-full">
      <MyTable
        columns={columns}
        data={questions}
        totalCount={totalCount}
        loading={isPending}
        filter={{ ...filter, search: searchInput }} // 使用本地状态显示输入，保证输入框实时响应
        onPaginationChange={changePages}
        onSort={handleSort}
        onFilterChange={handleFilterChange}
      />
    </div>
  )
}

export default List
