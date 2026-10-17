import { type ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, ArrowUpDown, Filter } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Payment = {
  id: string
  amount: number
  status: 'pending' | 'processing' | 'success' | 'failed'
  email: string
}

export const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: 'status',
    header: ({ table }) => {
      const currentFilter = (table.options.meta as any)?.currentFilter?.status
      return (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost">
                Status
                <Filter className={`ml-2 h-4 w-4 ${currentFilter ? 'text-blue-500' : ''}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>筛选状态</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => table.options.meta?.onFilterChange?.('status', '')}>
                全部
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => table.options.meta?.onFilterChange?.('status', 'pending')}
              >
                pending
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => table.options.meta?.onFilterChange?.('status', 'processing')}
              >
                processing
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => table.options.meta?.onFilterChange?.('status', 'success')}
              >
                success
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => table.options.meta?.onFilterChange?.('status', 'failed')}
              >
                failed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
    cell: ({ row }) => {
      return <div className="text-center font-medium">{row.getValue('status')}</div>
    },
  },

  {
    accessorKey: 'amount',
    header: ({ table }) => {
      const ordering = (table.options.meta as any)?.currentFilter?.ordering
      const isAsc = ordering === 'amount'
      const isDesc = ordering === '-amount'
      return (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => table.options.meta?.onSort?.('amount')}>
            Amount
            <ArrowUpDown className={`ml-2 h-4 w-4 ${isAsc || isDesc ? 'text-blue-500' : ''}`} />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'))
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount)

      return <div className="text-center font-medium">{formatted}</div>
    },
  },
  {
    accessorKey: 'email',
    header: ({ table }) => {
      const ordering = (table.options.meta as any)?.currentFilter?.ordering
      const isAsc = ordering === 'email'
      const isDesc = ordering === '-email'
      return (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => table.options.meta?.onSort?.('email')}>
            Email
            <ArrowUpDown className={`ml-2 h-4 w-4 ${isAsc || isDesc ? 'text-blue-500' : ''}`} />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      return <div className="text-center font-medium">{row.getValue('email') || '--'}</div>
    },
  },
  {
    header: '操作',
    id: 'actions',
    cell: ({ row }) => {
      const payment = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">打开菜单</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>操作</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(payment.id)}>
              复制付款 ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>查看客户</DropdownMenuItem>
            <DropdownMenuItem>查看支付详情</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
