import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, PieChart } from './charts'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Select from '@/components/ui/select'
import { statsApi } from '@/services/stats-api'
import IncompleteQuestionsList from './components/IncompleteQuestionsList'
import RecentQuestionsList from './components/RecentQuestionsList'

const Statistics = () => {
  // 折线图类型：frequency（练习频次）或 duration（练习时长）
  const [chartType, setChartType] = useState<'frequency' | 'duration'>('frequency')

  // 日期范围选择：7天、15天、30天
  const [dateRangeType, setDateRangeType] = useState<'7' | '15' | '30'>('15')

  // 饼图类型：tags（标签占比）或 difficulty（难度占比）
  const [pieChartType, setPieChartType] = useState<'tags' | 'difficulty'>('tags')

  // 使用 React Query 获取折线图数据
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['practice-trend', dateRangeType, chartType],
    queryFn: () =>
      statsApi.getPracticeTrend({
        days: parseInt(dateRangeType) as 7 | 15 | 30,
        type: chartType,
      }),
  })

  // 使用 React Query 获取饼图数据
  const { data: pieData, isLoading: isPieLoading } = useQuery({
    queryKey: ['distribution', pieChartType],
    queryFn: () =>
      pieChartType === 'tags'
        ? statsApi.getTagDistribution()
        : statsApi.getDifficultyDistribution(),
  })

  const currentData = chartData || []
  const currentPieData = pieData || []
  const yAxisLabel = chartType === 'frequency' ? '做题次数' : '时长（分钟）'

  return (
    <div className="flex flex-col w-full h-full ">
      <div className="section1 h-[50%] flex">
        {/* 折线图 tab切换*/}
        <div className="line flex flex-col w-[50%] h-full ">
          <div className="chartHeader flex items-center justify-between h-12 px-4 gap-4">
            {/* tab 切换 */}
            <Tabs
              value={chartType}
              onValueChange={(value) => setChartType(value as 'frequency' | 'duration')}
            >
              <TabsList variant="line">
                <TabsTrigger value="frequency">练习频次</TabsTrigger>
                <TabsTrigger value="duration">练习时长</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* 日期范围下拉选择 */}
            <Select
              value={dateRangeType}
              onChange={(value) => setDateRangeType(value as '7' | '15' | '30')}
              options={[
                { label: '最近7天', value: '7' },
                { label: '最近15天', value: '15' },
                { label: '最近30天', value: '30' },
              ]}
              placeholder="选择时间范围"
              className="w-[140px]"
            />
          </div>

          {/* 根据tab切换具体chart */}
          <div className="chart flex flex-col flex-1 h-0 px-4 pb-4">
            <div className="title text-2xl font-bold h-10 flex pl-4 items-center">
              {chartType === 'frequency' ? '最近练习频次' : '题目练习时长统计'}
            </div>
            <div className="chartDom flex-1 h-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-muted-foreground">加载中...</div>
                </div>
              ) : (
                <LineChart data={currentData} yAxisLabel={yAxisLabel} />
              )}
            </div>
          </div>
        </div>

        {/* 饼图 tab切换 */}
        <div className="pie flex flex-col w-[50%] h-full">
          <div className="chartHeader flex items-center justify-between h-12 px-4 gap-4">
            {/* tab 切换 */}
            <Tabs
              value={pieChartType}
              onValueChange={(value) => setPieChartType(value as 'tags' | 'difficulty')}
            >
              <TabsList>
                <TabsTrigger value="tags">标签占比</TabsTrigger>
                <TabsTrigger value="difficulty">难度占比</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* 饼图内容 */}
          <div className="chart flex flex-col flex-1 h-0 px-4 pb-4">
            <div className="title text-2xl font-bold h-10 flex pl-4 items-center">
              {pieChartType === 'tags' ? '题库标签分布' : '题库难度分布'}
            </div>
            <div className="chartDom flex-1 h-0">
              {isPieLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-muted-foreground">加载中...</div>
                </div>
              ) : currentPieData.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-muted-foreground">暂无数据</div>
                </div>
              ) : (
                <PieChart data={currentPieData} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="section2 flex flex-1 h-0 gap-4 p-4">
        <div className="list1 flex-1 border rounded-lg p-4 bg-card">
          <IncompleteQuestionsList />
        </div>
        <div className="list2 flex-1 border rounded-lg p-4 bg-card">
          <RecentQuestionsList />
        </div>
      </div>
    </div>
  )
}

export default Statistics
