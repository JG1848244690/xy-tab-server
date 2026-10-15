import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'

import { X } from 'lucide-react'
import Select from '@/components/ui/select'
// 扩展 TableMeta 类型
declare module '@tanstack/react-table' {
  interface TableMeta<TData> {
    onSort?: (field: string) => void
    onFilterChange?: (field: string, value: string) => void
    currentFilter?: Record<string, any>
  }
}

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'

export type FilterType = {
  page: number
  size: number
  ordering?: string
  status?: string
  search?: string
}
import { useState } from 'react'
//泛型接口 两个泛型
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[] //列配置数组
  data: TData[] //数据数组
  totalCount: number //总条数
  loading: boolean //加载状态
  filter: FilterType //分页参数
  onPaginationChange: (page: number, size: number) => void //分页变化回调
  onSort: (field: string) => void //排序回调
  onFilterChange: (field: string, value: string) => void //筛选回调
}

//泛型函数 返回值是DataTableProps
export default function MyTable<TData, TValue>({
  columns,
  data,
  totalCount,
  loading,
  filter,
  onPaginationChange,
  onSort,
  onFilterChange,
}: DataTableProps<TData, TValue>) {
  /**
   * useReactTable 把数据和列配置传进去
   * 返回一个table对象 里面有很多处理表格的方法
   * getCoreRowModel() 是必须的，告诉表格如何处理数据
   */
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

  // 分页大小选项
  const pageSizeOptions = [
    { label: '10 条/页', value: '10' },
    { label: '20 条/页', value: '20' },
    { label: '50 条/页', value: '50' },
    { label: '100 条/页', value: '100' },
  ]

  const totalPages = Math.ceil(totalCount / filter.size)

  // 处理分页大小变化
  const handlePageSizeChange = (newSize: string) => {
    const size = parseInt(newSize, 10)
    // 切换分页大小时，回到第一页
    onPaginationChange(1, size)
  }

  /**
     * 把数据和列配置给 useReactTable
    
    用 map 遍历表头、行、单元格
    
    用 flexRender 渲染内容
     */
  return (
    <div>
      <div className="flex items-center py-4">
        <div className="relative max-w-sm">
          <Input
            placeholder="输入搜索内容"
            value={filter.search ?? ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="pr-8"
          />
          {filter.search && (
            <X
              className="absolute right-2 top-2.5 h-4 w-4 cursor-pointer text-gray-400 hover:text-gray-600"
              onClick={() => onFilterChange('search', '')}
            />
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
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
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  暂无数据。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页组件 */}
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
          <Select
            value={filter.size.toString()}
            onChange={handlePageSizeChange}
            options={pageSizeOptions}
            className="w-32"
          />
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
    </div>
  )
}
