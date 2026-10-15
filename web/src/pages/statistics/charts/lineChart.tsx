import React, { useMemo } from 'react'
import {
  Line,
  LineChart as RechartsLineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface LineChartProps {
  data: Array<{ date: string; value: number }>
  yAxisLabel?: string
}

const LineChart = React.memo(({ data, yAxisLabel = '数值' }: LineChartProps) => {
  // 使用 useMemo 缓存 Tooltip 内容
  const tooltipContent = useMemo(() => {
    return ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="rounded-lg border bg-background p-2 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col">
                <span className="text-[0.70rem] uppercase text-muted-foreground">日期</span>
                <span className="font-bold text-muted-foreground">{payload[0].payload.date}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[0.70rem] uppercase text-muted-foreground">{yAxisLabel}</span>
                <span className="font-bold">{payload[0].value}</span>
              </div>
            </div>
          </div>
        )
      }
      return null
    }
  }, [yAxisLabel])

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={150}>
      <RechartsLineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="stroke-border" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 12, fill: 'currentColor' }}
          className="text-muted-foreground"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 12, fill: 'currentColor' }}
          className="text-muted-foreground"
        />
        <Tooltip content={tooltipContent} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="currentColor"
          className="stroke-primary"
          strokeWidth={2}
          dot={{ fill: 'currentColor', r: 4, className: 'fill-primary' }}
          activeDot={{ r: 6 }}
          // isAnimationActive={false}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  )
})

LineChart.displayName = 'LineChart'

export default LineChart
