'use client'

// https://www.shadcn.com.cn/docs/components/data-table

// 导入store
import { store } from './store'

import { columns } from "./columns"
import { DataTable } from "./data-table"
import { useDebounceEffect } from 'ahooks'

export default function Index() {
const { getData, payments, totalCount, loading, filter, updates } = store()

    useDebounceEffect(() => {
        const params = {
            // filter,
            // 其他参数 比如id

        }
        getData(params)
    }, [filter], { wait: 200 })

    const changePages = (page: number, size: number) => {
        let data = { ...filter }
        if (filter.size !== size) {
            data.page = 1
            data.size = size
        } else {
            data.page = page
        }
        updates({ filter: data })
    }

    const handleSort = (field: string) => {
        let data = { ...filter }
        // 如果当前排序字段是该字段，切换排序方向
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

    const handleFilterChange = (field: string, value: string) => {
        const data: any = { ...filter }
        if (value) {
            data[field] = value
        } else {
            delete data[field]
        }
        data.page = 1  // 所有筛选都重置页码
        updates({ filter: data })
    }


    const queryString = new URLSearchParams(
        Object.entries(filter).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null) {
                acc[key] = String(value)
            }
            return acc
        }, {} as Record<string, string>)
    ).toString()

    return (
        <div className=" w-full ">
            <DataTable
                columns={columns}
                data={payments}
                totalCount={totalCount}
                loading={loading.table as boolean}
                filter={filter}
                onPaginationChange={changePages}
                onSort={handleSort}
                onFilterChange={handleFilterChange}
            />
            <div className="mt-4 p-4 bg-gray-100 rounded-md">
                <div className="text-sm font-semibold mb-2">URL 查询字符串：</div>
                <code className="text-sm text-blue-600">?{queryString}</code>
            </div>
        </div>
    )

}
