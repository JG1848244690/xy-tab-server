import React, { useState, useEffect, useMemo } from 'react'
import { Pie, PieChart as RechartsPieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import './pieChart.css'

interface PieChartProps {
  data: Array<{ name: string; value: number; count: number }>
}

// 定义丰富的颜色方案（20种颜色）
const COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#06b6d4',
  '#f43f5e',
  '#a855f7',
  '#22c55e',
  '#eab308',
  '#0ea5e9',
  '#d946ef',
  '#64748b',
  '#fb923c',
  '#4ade80',
]

const PieChart = React.memo(({ data }: PieChartProps) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // 防抖处理窗口大小变化
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      }, 150)
    }

    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    })

    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // 使用 useMemo 缓存标签渲染函数
  const renderCustomLabel = useMemo(() => {
    return (entry: any) => {
      if (entry.value >= 5) {
        return `${entry.value}%`
      }
      return ''
    }
  }, [])

  // 使用 useMemo 缓存 Tooltip 内容
  const tooltipContent = useMemo(() => {
    return ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        const data = payload[0].payload
        return (
          <div className="rounded-lg border bg-background p-2 shadow-sm">
            <div className="grid gap-1">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground">{data.name}</span>
                <span className="text-sm font-bold text-foreground">
                  {data.value}% ({data.count}题)
                </span>
              </div>
            </div>
          </div>
        )
      }
      return null
    }
  }, [])

  return (
    <div className="h-full w-full flex gap-4">
      {/* 左侧：饼图 */}
      <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height="100%" debounce={150}>
          <RechartsPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius="75%"
              dataKey="value"
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={tooltipContent} />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>

      {/* 右侧：滚动列表 */}
      <div className="w-48 shrink-0 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
        {data.map((entry, index) => (
          <div
            key={`list-${index}`}
            className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <div
              className="w-4 h-4 rounded shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate" title={entry.name}>
                {entry.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {entry.value}% · {entry.count}题
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

PieChart.displayName = 'PieChart'

export default PieChart
