# MyTable 组件 Wiki

## 概述

MyTable 是一个基于 TanStack Table (React Table v8) 封装的通用表格组件，专为数据列表场景设计。它提供了开箱即用的分页、排序、筛选、搜索等功能，并与 React Query 完美集成，支持服务端分页和数据缓存。

---

## 为什么要重新封装表格组件？

### 传统方案的痛点

在使用传统的 **Zustand + Ant Design Table** 方案时，我们遇到了以下问题：

#### 1. 数据同步问题

**痛点**：删除、编辑操作后需要手动重新获取数据

```typescript
// ❌ 传统方案：手动调用 getData
const handleDelete = async (id: string) => {
  await api.delete(id)
  // 必须手动调用 getData 刷新列表
  getData({ filter })
}

const handleEdit = async (id: string, data: any) => {
  await api.update(id, data)
  // 又要手动调用 getData
  getData({ filter })
}
```

**问题**：
- 容易忘记调用 `getData()`，导致数据不同步
- 每次操作都要写重复的刷新逻辑
- 多个操作点分散，维护困难

**我们的方案**：使用 React Query 自动管理数据

```typescript
//  新方案：React Query 自动失效缓存
const deleteMutation = useMutation({
  mutationFn: (id: string) => api.delete(id),
  onSuccess: () => {
    // 自动失效相关查询，触发重新获取
    queryClient.invalidateQueries({ queryKey: ['questions'] })
  },
})

const handleDelete = (id: string) => {
  deleteMutation.mutate(id)
  // 不需要手动刷新，React Query 自动处理
}
```

#### 2. 组件库体积问题

**痛点**：Ant Design 组件库过于庞大

```
antd: ~2.5MB (gzipped)
@ant-design/icons: ~500KB (gzipped)
```

**问题**：
- 打包体积大，影响首屏加载速度
- Tree-shaking 效果有限，很多用不到的组件也被打包
- 样式文件庞大，CSS-in-JS 运行时开销

**我们的方案**：使用轻量级的 shadcn/ui

```
shadcn/ui: 按需复制组件到项目中，只打包用到的代码
体积减少约 70%，性能提升明显
```

#### 3. 状态管理复杂

**痛点**：Zustand 管理表格状态时逻辑分散

```typescript
// ❌ 传统方案：状态和逻辑分散在 store 中
export const store = create<StoreState>((set, get) => ({
  payments: [],
  totalCount: 0,
  filter: { page: 1, size: 10 },
  loading: {},
  
  getData: async (params) => {
    set({ loading: { table: true } })
    const res = await api.getList(params)
    set({ 
      payments: res.data,
      totalCount: res.total,
      loading: { table: false }
    })
  },
  
  deleteItem: async (id) => {
    await api.delete(id)
    // 删除后要重新获取数据
    const { filter } = get()
    get().getData({ filter })
  },
  
  // ... 更多操作
}))
```

**问题**：
- 数据获取逻辑和业务逻辑耦合在 store 中
- 缺少缓存机制，每次切换页面都要重新请求
- 错误处理、重试逻辑需要手动实现
- 加载状态管理繁琐

**我们的方案**：Zustand 只管理筛选状态，React Query 管理数据

```typescript
//  新方案：职责分离
// Zustand：只管理筛选状态
export const store = create<FilterState>((set) => ({
  filter: { page: 1, size: 10 },
  updates: (params) => set({ ...params }),
}))

// React Query：管理数据获取、缓存、错误处理
const { data, isPending, error } = useQuery({
  queryKey: ['questions', filter],
  queryFn: () => api.getList(filter),
  staleTime: 5 * 60 * 1000,  // 5分钟内使用缓存
  retry: 3,  // 自动重试3次
})
```

#### 4. 缺少智能缓存

**痛点**：每次切换页面都要重新请求数据

```typescript
// ❌ 传统方案：无缓存
// 用户操作：列表页 → 详情页 → 返回列表页
// 结果：列表页数据重新请求，用户看到 loading

useEffect(() => {
  getData({ filter })
}, [filter])
```

**问题**：
- 用户体验差，频繁看到 loading
- 浪费带宽，重复请求相同数据
- 服务器压力大

**我们的方案**：React Query 自动缓存

```typescript
//  新方案：智能缓存
const { data, isPending } = useQuery({
  queryKey: ['questions', filter],
  queryFn: () => api.getList(filter),
  staleTime: 5 * 60 * 1000,  // 5分钟内直接使用缓存
  gcTime: 10 * 60 * 1000,    // 10分钟后清理缓存
})

// 用户操作：列表页 → 详情页 → 返回列表页
// 结果：列表页立即显示缓存数据，后台静默更新
```

#### 5. 防抖处理不统一

**痛点**：搜索防抖逻辑散落各处

```typescript
// ❌ 传统方案：每个搜索框都要写防抖
const [timer, setTimer] = useState<NodeJS.Timeout>()

const handleSearch = (value: string) => {
  if (timer) clearTimeout(timer)
  const newTimer = setTimeout(() => {
    updates({ filter: { ...filter, search: value } })
  }, 500)
  setTimer(newTimer)
}
```

**问题**：
- 代码重复，每个搜索框都要写一遍
- 容易出错，忘记清理 timer 导致内存泄漏
- 不统一，有的地方防抖，有的地方不防抖

**我们的方案**：使用 ahooks 统一处理

```typescript
//  新方案：使用 useDebounce
const [searchInput, setSearchInput] = useState('')
const debouncedSearch = useDebounce(searchInput, { wait: 500 })

useEffect(() => {
  updates({ filter: { ...filter, search: debouncedSearch } })
}, [debouncedSearch])
```

#### 6. 类型安全问题

**痛点**：Ant Design Table 的类型定义不够严格

```typescript
// ❌ 传统方案：类型推断不准确
const columns = [
  {
    title: '标题',
    dataIndex: 'title',
    render: (text, record) => {
      // record 类型是 any，没有类型提示
      return <div>{record.title}</div>
    }
  }
]
```

**问题**：
- 缺少类型提示，容易写错字段名
- 重构时难以发现问题
- IDE 无法提供智能补全

**我们的方案**：TanStack Table 完整的泛型支持

```typescript
//  新方案：完整的类型推断
export const columns: ColumnDef<Question>[] = [
  {
    accessorKey: 'title',
    cell: ({ row }) => {
      // row.original 有完整的 Question 类型
      // IDE 提供智能补全和类型检查
      return <div>{row.original.title}</div>
    }
  }
]
```

#### 7. 表头交互不灵活

**痛点**：Ant Design Table 的表头自定义能力有限

```typescript
// ❌ 传统方案：表头排序和筛选需要额外配置
const columns = [
  {
    title: '标题',
    dataIndex: 'title',
    sorter: true,  // 只能开启/关闭，无法自定义UI
    filters: [...], // 筛选UI固定，无法自定义
  }
]
```

**问题**：
- 排序和筛选的 UI 样式固定，难以定制
- 无法使用自定义组件（如 shadcn/ui 的 DropdownMenu）
- 交互逻辑受限于 Ant Design 的设计

**我们的方案**：完全自定义的表头

```typescript
//  新方案：表头完全自定义
{
  accessorKey: 'difficulty',
  header: ({ table }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            难度
            <Filter className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {/* 完全自定义的筛选UI */}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  },
}
```

### 方案对比总结

| 特性 | 传统方案 (Zustand + Ant Design) | 新方案 (React Query + TanStack Table) |
|------|--------------------------------|--------------------------------------|
| **数据同步** | ❌ 手动调用 getData | ✅ 自动失效缓存 |
| **组件体积** | ❌ ~3MB (gzipped) | ✅ ~1MB (gzipped) |
| **状态管理** | ❌ 逻辑耦合在 store | ✅ 职责分离 |
| **缓存机制** | ❌ 无缓存 | ✅ 智能缓存 |
| **防抖处理** | ❌ 手动实现 | ✅ ahooks 统一处理 |
| **类型安全** | ❌ 类型推断弱 | ✅ 完整泛型支持 |
| **表头自定义** | ❌ 受限于 Ant Design | ✅ 完全自定义 |
| **错误处理** | ❌ 手动实现 | ✅ React Query 内置 |
| **重试机制** | ❌ 手动实现 | ✅ React Query 内置 |
| **加载状态** | ❌ 手动管理 | ✅ 自动管理 |

---

## 技术栈

- **TanStack Table v8**: 无头表格库，提供强大的表格逻辑
- **React 18**: UI 框架
- **TypeScript**: 类型安全
- **shadcn/ui**: UI 组件库（Table、Button、Input、Skeleton 等）
- **React Query**: 数据获取和缓存
- **ahooks**: React Hooks 工具库（防抖等）
- **Zustand**: 状态管理

## 组件架构

```
/src/components/myTable/
├── index.tsx           # 表格组件主体
├── columns.tsx         # 列配置示例（可选）
├── use.md             # 使用文档（旧版）
└── README.md          # 本文档

使用示例：
/src/app/(dashboard)/test-center/
├── codeList.tsx       # 代码测试列表（使用 MyTable）
├── strList.tsx        # 理论测试列表（使用 MyTable）
├── codeCol.tsx        # 代码测试列配置
├── strCol.tsx         # 理论测试列配置
└── store.ts           # Zustand 状态管理
```

---

## 核心设计思想

### 1. 关注点分离

MyTable 组件采用了清晰的职责分离设计：

```
┌─────────────────────────────────────────────────────────┐
│                    业务层 (Page)                         │
│  - 数据获取 (React Query)                                │
│  - 状态管理 (Zustand)                                    │
│  - 业务逻辑 (防抖、筛选、排序)                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  列配置层 (columns.tsx)                   │
│  - 列定义 (ColumnDef)                                    │
│  - 表头渲染 (排序按钮、筛选下拉)                          │
│  - 单元格渲染 (格式化、样式、交互)                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  表格组件 (MyTable)                       │
│  - 表格渲染 (TanStack Table)                             │
│  - 通用功能 (分页、加载、空状态)                          │
│  - 回调接口 (onSort, onFilterChange, onPaginationChange) │
└─────────────────────────────────────────────────────────┘
```

### 2. 受控组件模式

MyTable 是一个**完全受控**的组件，所有状态由父组件管理：

- **数据**: 由父组件通过 `data` prop 传入
- **筛选**: 由父组件通过 `filter` prop 传入
- **交互**: 通过回调函数通知父组件状态变化

这种设计的优势：
- ✅ 状态可预测，易于调试
- ✅ 支持 URL 同步（可将筛选条件同步到 URL）
- ✅ 支持多表格联动
- ✅ 易于集成状态管理库（Zustand、Redux 等）

### 3. 泛型设计

使用 TypeScript 泛型确保类型安全：

```typescript
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  // ...
}

export default function MyTable<TData, TValue>({ ... }: DataTableProps<TData, TValue>) {
  // ...
}
```

- `TData`: 数据行的类型（如 `Question`、`Payment`）
- `TValue`: 单元格值的类型（自动推断）

### 4. Meta 扩展机制

通过扩展 TanStack Table 的 `TableMeta` 类型，将回调函数传递到列配置中：

```typescript
declare module '@tanstack/react-table' {
  interface TableMeta<TData> {
    onSort?: (field: string) => void
    onFilterChange?: (field: string, value: string) => void
    currentFilter?: Record<string, any>
  }
}

const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  meta: {
    onSort,
    onFilterChange,
    currentFilter: filter,
  },
})
```

这样在列配置中就可以访问这些回调：

```typescript
header: ({ table }) => {
  return (
    <Button onClick={() => table.options.meta?.onSort?.('title')}>
      排序
    </Button>
  )
}
```

---

## 组件实现详解

### 1. MyTable 组件 (`index.tsx`)

#### 1.1 Props 接口

```typescript
export type FilterType = {
  page: number
  size: number
  ordering?: string      // 排序字段，如 'title' 或 '-title'（倒序）
  status?: string        // 状态筛选
  search?: string        // 搜索关键词
  // ... 其他筛选字段
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]        // 列配置
  data: TData[]                              // 数据数组
  totalCount: number                         // 总条数（用于分页）
  loading: boolean                           // 加载状态
  filter: FilterType                         // 筛选参数
  onPaginationChange: (page: number, size: number) => void  // 分页回调
  onSort: (field: string) => void            // 排序回调
  onFilterChange: (field: string, value: string) => void    // 筛选回调
}
```

#### 1.2 核心功能

**搜索框**
```typescript
<div className="relative max-w-sm">
  <Input
    placeholder="输入搜索内容"
    value={filter.search ?? ''}
    onChange={(e) => onFilterChange('search', e.target.value)}
    className="pr-8"
  />
  {filter.search && (
    <X
      className="absolute right-2 top-2.5 h-4 w-4 cursor-pointer"
      onClick={() => onFilterChange('search', '')}
    />
  )}
</div>
```

**加载骨架屏**
```typescript
{loading ? (
  Array.from({ length: filter.size }).map((_, i) => (
    <TableRow key={i}>
      {columns.map((_, j) => (
        <TableCell key={j}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  ))
) : (
  // 数据渲染
)}
```

**空状态**
```typescript
{table.getRowModel().rows?.length ? (
  // 渲染数据
) : (
  <TableRow>
    <TableCell colSpan={columns.length} className="h-24 text-center">
      暂无数据。
    </TableCell>
  </TableRow>
)}
```

**分页组件**
```typescript
<div className="flex items-center justify-between py-4">
  <div className="text-sm text-muted-foreground">
    第 {filter.page} 页，共 {totalPages} 页 | 总计 {totalCount} 条
  </div>
  <div className="flex items-center space-x-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => onPaginationChange(filter.page - 1, filter.size)}
      disabled={filter.page <= 1}
    >
      上一页
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => onPaginationChange(filter.page + 1, filter.size)}
      disabled={filter.page >= totalPages}
    >
      下一页
    </Button>
  </div>
</div>
```

---

### 2. 列配置 (`codeCol.tsx`)

#### 2.1 排序列

```typescript
{
  accessorKey: 'title',
  header: ({ table }) => {
    const ordering = (table.options.meta as any)?.currentFilter?.ordering
    const isAsc = ordering === 'title'
    const isDesc = ordering === '-title'
    return (
      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => table.options.meta?.onSort?.('title')}>
          题目标题
          <ArrowUpDown className={`ml-2 h-4 w-4 ${isAsc || isDesc ? 'text-blue-500' : ''}`} />
        </Button>
      </div>
    )
  },
  cell: ({ row }) => {
    return <div className="text-center font-medium">{row.getValue('title')}</div>
  },
}
```

**关键点**:
- 从 `table.options.meta.currentFilter` 获取当前排序状态
- 根据排序状态高亮排序图标
- 点击时调用 `table.options.meta.onSort`

#### 2.2 筛选列

```typescript
{
  accessorKey: 'difficulty',
  header: ({ table }) => {
    const currentFilter = (table.options.meta as any)?.currentFilter?.difficulty
    return (
      <div className="flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost">
              难度
              <Filter className={`ml-2 h-4 w-4 ${currentFilter ? 'text-blue-500' : ''}`} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuLabel>筛选难度</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => table.options.meta?.onFilterChange?.('difficulty', '')}
            >
              全部
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => table.options.meta?.onFilterChange?.('difficulty', 'easy')}
            >
              简单
            </DropdownMenuItem>
            {/* ... 其他选项 */}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  },
  cell: ({ row }) => {
    const difficulty = row.getValue('difficulty') as string
    const difficultyMap = {
      easy: { text: '简单', color: 'bg-green-100 text-green-800' },
      medium: { text: '中等', color: 'bg-yellow-100 text-yellow-800' },
      hard: { text: '困难', color: 'bg-red-100 text-red-800' },
    }
    const diff = difficultyMap[difficulty]
    return (
      <div className="text-center">
        <span className={`px-2 py-1 rounded text-xs font-medium ${diff.color}`}>
          {diff.text}
        </span>
      </div>
    )
  },
}
```

**关键点**:
- 使用 `DropdownMenu` 提供筛选选项
- 根据筛选状态高亮筛选图标
- 单元格中使用徽章样式显示状态

#### 2.3 操作列

```typescript
{
  header: '操作',
  id: 'actions',
  cell: ({ row }) => {
    return <ActionsCell question={row.original} />
  },
}
```

---

### 3. 业务层 (`codeList.tsx`)

#### 3.1 状态管理

```typescript
const { filter, updates } = store()  // Zustand store
const [searchInput, setSearchInput] = useState(filter.search || '')
```

#### 3.2 搜索防抖

```typescript
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
}, [debouncedSearch])
```

**为什么需要防抖？**
- 用户输入 "react" 时，如果不防抖会发送 5 次请求（r、re、rea、reac、react）
- 使用防抖后，只在用户停止输入 500ms 后发送 1 次请求
- 提升性能，减少服务器压力

#### 3.3 数据获取

```typescript
// 构建查询参数
const queryParams = {
  type: 'markdown' as const,
  page: filter.page || 1,
  size: filter.size || 10,
  ...(filter.ordering && { ordering: filter.ordering }),
  ...(filter.difficulty && { difficulty: filter.difficulty }),
  ...(filter.status && { status: filter.status }),
  ...(filter.search && { search: filter.search }),
}

// 使用 React Query 获取数据
const { data, isPending } = useQuery({
  queryKey: ['questions', 'markdown', queryParams],
  queryFn: () => questionsApi.getList(queryParams),
})
```

**React Query 的优势**:
-  自动缓存：相同 queryKey 的请求会复用缓存
-  自动重试：请求失败时自动重试
-  后台更新：数据过期时自动重新获取
-  加载状态：自动管理 loading 状态

#### 3.4 回调处理

**分页回调**
```typescript
const changePages = (page: number, size: number) => {
  const data = { ...filter }
  if (filter.size !== size) {
    data.page = 1  // 改变每页条数时，重置到第一页
    data.size = size
  } else {
    data.page = page
  }
  updates({ filter: data })
}
```

**排序回调**
```typescript
const handleSort = (field: string) => {
  const data = { ...filter }
  // 三态切换：正序 → 倒序 → 取消排序
  if (data.ordering === field) {
    data.ordering = `-${field}`  // 倒序
  } else if (data.ordering === `-${field}`) {
    delete data.ordering  // 取消排序
  } else {
    data.ordering = field  // 正序
  }
  data.page = 1  // 排序后回到第一页
  updates({ filter: data })
}
```

**筛选回调**
```typescript
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
    data.page = 1  // 所有筛选都重置页码
    updates({ filter: data })
  }
}
```

#### 3.5 渲染表格

```typescript
return (
  <div className="w-full">
    <MyTable
      columns={columns}
      data={questions}
      totalCount={totalCount}
      loading={isPending}
      filter={{ ...filter, search: searchInput }}  // 使用本地状态显示输入
      onPaginationChange={changePages}
      onSort={handleSort}
      onFilterChange={handleFilterChange}
    />
  </div>
)
```

---

## 核心特性

### 1. 服务端分页

- 所有分页、排序、筛选都在服务端完成
- 前端只负责展示当前页数据
- 支持大数据量场景

### 2. 搜索防抖

- 使用 `useDebounce` 实现搜索防抖
- 输入框实时响应，请求延迟发送
- 减少不必要的 API 调用

### 3. 状态同步

- 使用 Zustand 管理筛选状态
- 支持多个列表共享状态
- 可扩展为 URL 同步

### 4. 类型安全

- 完整的 TypeScript 类型定义
- 泛型支持任意数据类型
- 编译时类型检查

### 5. 加载体验

- 骨架屏加载效果
- 空状态提示
- 禁用状态处理

---

## 使用指南

### 快速开始

#### 1. 定义数据类型

```typescript
export interface Question {
  id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  status: 'not_started' | 'in_progress' | 'completed'
  tags: string[]
  stats: {
    totalAttempts: number
    status: string
  }
}
```

#### 2. 创建列配置

```typescript
// columns.tsx
import { type ColumnDef } from '@tanstack/react-table'
import { Question } from '@/types'

export const columns: ColumnDef<Question>[] = [
  {
    accessorKey: 'title',
    header: ({ table }) => {
      return (
        <Button onClick={() => table.options.meta?.onSort?.('title')}>
          标题
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div>{row.getValue('title')}</div>
    },
  },
  // ... 其他列
]
```

#### 3. 创建列表组件

```typescript
// list.tsx
'use client'
import MyTable from '@/components/myTable'
import { columns } from './columns'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

export default function List() {
  const [filter, setFilter] = useState({ page: 1, size: 10 })

  const { data, isPending } = useQuery({
    queryKey: ['questions', filter],
    queryFn: () => api.getList(filter),
  })

  const handleSort = (field: string) => {
    // 处理排序逻辑
  }

  const handleFilterChange = (field: string, value: string) => {
    // 处理筛选逻辑
  }

  const handlePaginationChange = (page: number, size: number) => {
    setFilter({ ...filter, page, size })
  }

  return (
    <MyTable
      columns={columns}
      data={data?.data || []}
      totalCount={data?.total || 0}
      loading={isPending}
      filter={filter}
      onSort={handleSort}
      onFilterChange={handleFilterChange}
      onPaginationChange={handlePaginationChange}
    />
  )
}
```

---

## 高级用法

### 1. 嵌套字段访问

```typescript
{
  accessorKey: 'stats.totalAttempts',  // 访问嵌套字段
  header: '尝试次数',
  cell: ({ row }) => {
    const stats = row.original.stats
    return <div>{stats.totalAttempts}</div>
  },
}
```

### 2. 自定义单元格渲染

```typescript
{
  accessorKey: 'tags',
  header: '标签',
  cell: ({ row }) => {
    const tags = row.getValue('tags') as string[]
    return (
      <div className="flex gap-1">
        {tags.map((tag) => (
          <span key={tag} className="px-2 py-1 bg-blue-100 rounded">
            {tag}
          </span>
        ))}
      </div>
    )
  },
}
```

### 3. 操作列

```typescript
{
  header: '操作',
  id: 'actions',
  cell: ({ row }) => {
    const item = row.original
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleEdit(item)}>
            编辑
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDelete(item)}>
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  },
}
```

### 4. 条件样式

```typescript
{
  accessorKey: 'difficulty',
  header: '难度',
  cell: ({ row }) => {
    const difficulty = row.getValue('difficulty') as string
    const colorMap = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`px-2 py-1 rounded ${colorMap[difficulty]}`}>
        {difficulty}
      </span>
    )
  },
}
```

---

## 常见问题

### Q1: 为什么不使用 TanStack Table 的内置分页？

**原因**:

1. **服务端分页需求**
   - 项目使用服务端分页，数据量可能很大
   - 前端只获取当前页数据，不是全量数据
   - TanStack Table 的内置分页是客户端分页，需要全量数据

2. **更灵活的控制**
   - 自定义分页逻辑可以与 URL 同步
   - 可以与 React Query 的缓存策略配合
   - 支持更复杂的分页场景（如无限滚动）

### Q2: 为什么搜索要单独处理防抖？

**原因**:

1. **用户体验**
   - 搜索框需要实时响应用户输入，不能有延迟
   - 但 API 请求需要防抖，避免频繁调用

2. **实现方式**
   - 使用本地状态 `searchInput` 控制输入框，保证实时响应
   - 使用 `useDebounce` 对搜索值防抖
   - 防抖后的值变化时才更新 filter，触发 API 请求

3. **其他筛选不需要防抖**
   - 下拉选择、单选框等筛选是离散操作，不需要防抖
   - 这些筛选可以立即生效

### Q3: 为什么使用 Meta 扩展而不是 Context？

**原因**:

1. **TanStack Table 的设计**
   - TanStack Table 提供了 `meta` 机制用于传递自定义数据
   - 这是官方推荐的方式，与表格实例紧密集成

2. **类型安全**
   - 通过扩展 `TableMeta` 类型，可以获得完整的类型提示
   - Context 需要额外的类型定义和类型断言

3. **作用域清晰**
   - Meta 数据只在表格和列配置中可见，作用域明确
   - Context 的作用域更广，可能导致不必要的依赖

### Q4: 为什么不把排序、筛选逻辑放在 MyTable 内部？

**原因**:

1. **关注点分离**
   - MyTable 只负责表格的渲染和基础交互
   - 业务逻辑（如何排序、如何筛选）由父组件决定

2. **灵活性**
   - 不同的业务场景可能有不同的排序规则
   - 有的项目可能需要同步到 URL，有的不需要
   - 父组件可以自由决定如何处理这些逻辑

3. **可测试性**
   - 业务逻辑在父组件中，更容易单独测试
   - MyTable 作为纯展示组件，测试更简单

### Q5: 如何实现多选功能？

**答案**:

TanStack Table 内置了多选功能，可以这样实现：

```typescript
// 在列配置中添加选择列
{
  id: 'select',
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
    />
  ),
}

// 在 MyTable 中启用行选择
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  enableRowSelection: true,  // 启用行选择
  onRowSelectionChange: setRowSelection,  // 选择状态变化回调
  state: {
    rowSelection,  // 选择状态
  },
})

// 获取选中的行
const selectedRows = table.getSelectedRowModel().rows
```

---

## 设计亮点

1. **受控组件模式**: 状态由父组件管理，可预测、易调试
2. **泛型设计**: 支持任意数据类型，类型安全
3. **Meta 扩展**: 优雅地将回调传递到列配置
4. **关注点分离**: 表格渲染、列配置、业务逻辑清晰分离
5. **防抖优化**: 搜索防抖提升性能和用户体验
6. **加载体验**: 骨架屏、空状态、禁用状态完善
7. **React Query 集成**: 自动缓存、重试、后台更新

---

## 最佳实践

### 1. 状态管理

推荐使用 Zustand 管理筛选状态：

```typescript
// store.ts
import { create } from 'zustand'

interface FilterState {
  filter: FilterType
  updates: (params: Partial<FilterState>) => void
}

export const store = create<FilterState>((set) => ({
  filter: { page: 1, size: 10 },
  updates: (params) => set({ ...params }),
}))
```

### 2. API 设计

后端 API 应支持以下查询参数：

```
GET /api/questions?page=1&size=10&ordering=-title&difficulty=easy&search=react
```

- `page`: 页码（从 1 开始）
- `size`: 每页条数
- `ordering`: 排序字段（`-` 前缀表示倒序）
- 其他字段: 筛选条件

返回格式：

```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "size": 10
}
```

### 3. 列配置组织

将列配置单独放在 `columns.tsx` 文件中：

```typescript
// columns.tsx
export const columns: ColumnDef<Question>[] = [...]

// list.tsx
import { columns } from './columns'
```

### 4. 防抖时间

- 搜索框: 300-500ms
- 自动保存: 1000-2000ms
- 实时预览: 100-200ms

---

## 未来规划

- [ ] 支持客户端分页模式
- [ ] 支持多选功能
- [ ] 支持列拖拽排序
- [ ] 支持列显示/隐藏
- [ ] 支持导出功能（CSV、Excel）
- [ ] 支持虚拟滚动（大数据量）
- [ ] 支持行展开（嵌套数据）
- [ ] 支持列固定（冻结列）

---

## 参考资料

- [TanStack Table 官方文档](https://tanstack.com/table/latest)
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/data-table)
- [React Query 官方文档](https://tanstack.com/query/latest)
- [ahooks 官方文档](https://ahooks.js.org/)

---

**最后更新**: 2026-02-06  
**维护者**: dxy
