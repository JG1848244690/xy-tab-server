import { Card, CardContent } from '@/components/ui/card'
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayjs from 'dayjs'
import { useLayoutEffect, useRef, useState, useEffect } from 'react'
import CalendarEvent from './calendar-event'
import CalendarEventForm, { type CalendarEventFormFieldType } from './calendar-event-form'
import CalendarHeader, { type HandleMoveArg, type ViewType } from './calendar-header'
import { generateEventId } from './event-utils'
import { todosApi, type Todo } from '@/services/todos-api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const DefaultEventInitValue: CalendarEventFormFieldType = {
  id: generateEventId(),
  title: '',
  description: '',
  allDay: false,
  start: dayjs(),
  end: dayjs(),
  color: '#00a76f',
}

// 将 Todo 转换为 FullCalendar Event
function todoToEvent(todo: Todo): EventInput {
  // 处理后端返回的日期字段（统一转换为 YYYY-MM-DD 格式）
  // 后端可能返回 ISO 字符串 "2026-02-04T00:00:00.000Z" 或简单字符串 "2026-02-04"
  const startDateStr = dayjs(todo.startDate).format('YYYY-MM-DD')
  const endDateStr = dayjs(todo.endDate).format('YYYY-MM-DD')

  // 支持跨天事件
  const startDateTime = `${startDateStr}T${todo.startTime}`
  const endDateTime = `${endDateStr}T${todo.endTime}`

  return {
    id: todo.id,
    title: todo.content,
    start: startDateTime,
    end: endDateTime,
    allDay: todo.allDay,
    color: todo.color || '#00a76f',
    extendedProps: {
      completed: todo.completed,
      description: todo.description || todo.content,
    },
  }
}

// 将 FullCalendar Event 转换为 Todo 数据
function eventToTodo(event: CalendarEventFormFieldType) {
  const startDate = event.start || dayjs()
  const endDate = event.end || dayjs()

  // 支持跨天事件：分别保存开始日期和结束日期
  const startDateStr = startDate.format('YYYY-MM-DD')
  const endDateStr = endDate.format('YYYY-MM-DD')
  const startTime = startDate.format('HH:mm')
  const endTime = endDate.format('HH:mm')

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    startTime,
    endTime,
    content: event.title || '',
    color: event.color || '#00a76f',
    description: event.description,
    allDay: event.allDay || false,
  }
}

export default function Calendar() {
  const queryClient = useQueryClient()
  const fullCalendarRef = useRef<FullCalendar>(null)
  const [view, setView] = useState<ViewType>('dayGridMonth')
  const [date, setDate] = useState(new Date())
  const [open, setOpen] = useState(false)
  const [eventInitValue, setEventInitValue] =
    useState<CalendarEventFormFieldType>(DefaultEventInitValue)
  const [eventFormType, setEventFormType] = useState<'add' | 'edit'>('add')

  // 获取当前月份的所有 todos
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  // 获取当前月份的所有日期的 todos
  const [allTodos, setAllTodos] = useState<Todo[]>([])

  // 使用批量接口获取月度 todos（替代 30+ 次单独请求）
  useEffect(() => {
    const fetchMonthTodos = async () => {
      try {
        const todos = await todosApi.getTodosByMonth(year, month)
        setAllTodos(todos)
      } catch (error) {
        console.error('Failed to fetch month todos:', error)
        setAllTodos([])
      }
    }

    fetchMonthTodos()
  }, [year, month])

  // 将 todos 转换为 events
  const events: EventInput[] = allTodos.map(todoToEvent)

  // 当对话框打开时，关闭所有 popover
  useEffect(() => {
    if (open) {
      const popovers = document.querySelectorAll('.fc-popover')
      popovers.forEach((popover) => {
        const htmlElement = popover as HTMLElement
        htmlElement.style.display = 'none'
        popover.remove()
      })
    }
  }, [open])

  // 创建 todo
  const createMutation = useMutation({
    mutationFn: todosApi.create,
    onSuccess: (newTodo) => {
      queryClient.invalidateQueries({ queryKey: ['monthStatus'] })
      setAllTodos((prev) => [...prev, newTodo])
    },
  })

  // 更新 todo
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => todosApi.update(id, data),
    onSuccess: (updatedTodo) => {
      queryClient.invalidateQueries({ queryKey: ['monthStatus'] })
      setAllTodos((prev) => prev.map((t) => (t.id === updatedTodo.id ? updatedTodo : t)))
    },
  })

  // 删除 todo
  const deleteMutation = useMutation({
    mutationFn: todosApi.delete,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['monthStatus'] })
      setAllTodos((prev) => prev.filter((t) => t.id !== deletedId))
    },
  })

  /**
   * calendar header events
   */
  const handleMove = (action: HandleMoveArg) => {
    const calendarApi = fullCalendarRef.current?.getApi()
    if (!calendarApi) return
    switch (action) {
      case 'prev':
        calendarApi.prev()
        break
      case 'next':
        calendarApi.next()
        break
      case 'today':
        calendarApi.today()
        break
      default:
        break
    }
    setDate(calendarApi.getDate())
  }

  const handleViewTypeChange = (view: ViewType) => {
    setView(view)
  }

  useLayoutEffect(() => {
    const calendarApi = fullCalendarRef.current?.getApi()
    if (!calendarApi) return
    setTimeout(() => {
      calendarApi.changeView(view)
    })
  }, [view])

  /**
   * calendar grid events
   */
  // select date range
  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const calendarApi = selectInfo.view.calendar
    calendarApi.unselect() // clear date selection
    setOpen(true)
    setEventFormType('add')
    let startDate: dayjs.Dayjs
    let endDate: dayjs.Dayjs
    if (selectInfo.allDay) {
      const dateStr = selectInfo.startStr
      startDate = dayjs(dateStr).hour(9).minute(0).second(0)
      endDate = dayjs(dateStr).hour(10).minute(0).second(0)
    } else {
      startDate = dayjs(selectInfo.start)
      endDate = dayjs(selectInfo.end)
    }

    setEventInitValue({
      id: generateEventId(),
      title: '',
      description: '',
      start: startDate,
      end: endDate,
      allDay: selectInfo.allDay,
      color: '#00a76f',
    })
  }

  /**
   * calendar event events
   */
  // click event and open modal
  const handleEventClick = (arg: EventClickArg) => {
    arg.jsEvent.stopPropagation()

    const { title, extendedProps, allDay, start, end, backgroundColor, id } = arg.event

    setTimeout(() => {
      const popovers = document.querySelectorAll('.fc-popover')
      popovers.forEach((popover) => {
        const htmlElement = popover as HTMLElement
        htmlElement.style.display = 'none'
        setTimeout(() => popover.remove(), 100)
      })
    }, 0)

    setOpen(true)
    setEventFormType('edit')
    const newEventValue: CalendarEventFormFieldType = {
      id,
      title,
      allDay,
      color: backgroundColor,
      description: extendedProps.description,
    }
    if (start) {
      newEventValue.start = dayjs(start)
    }

    if (end) {
      newEventValue.end = dayjs(end)
    }
    setEventInitValue(newEventValue)
  }

  const handleCancel = () => {
    setEventInitValue(DefaultEventInitValue)
    setOpen(false)
  }

  // edit event - 现在支持编辑功能
  const handleEdit = async (values: CalendarEventFormFieldType) => {
    const todoData = eventToTodo(values)
    updateMutation.mutate({ id: values.id, data: todoData })
    handleCancel()
  }

  // create event
  const handleCreate = async (values: CalendarEventFormFieldType) => {
    const todoData = eventToTodo(values)
    createMutation.mutate(todoData)
    handleCancel()
  }

  // delete event
  const handleDelete = async (id: string) => {
    deleteMutation.mutate(id)
    handleCancel()
  }

  return (
    <>
      <style>{`
        .calendar-wrapper {
          width: 100%;
          height: 100%;
          overflow: auto;
        }
        .fc {
          width: 100%;
          height: 100%;
          --fc-border-color: rgba(255, 255, 255, 0.2);
          --fc-now-indicator-color: hsl(var(--primary));
          --fc-today-bg-color: rgba(255, 255, 255, 0.05);
          --fc-page-bg-color: hsl(var(--background));
          --fc-neutral-bg-color: hsl(var(--background));
          --fc-list-event-hover-bg-color: hsl(var(--accent));
          --fc-highlight-color: hsl(var(--accent));
        }
        .fc a {
          color: hsl(var(--foreground));
        }
        /* 强制显示所有边框 */
        .fc table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }
        .fc .fc-scrollgrid {
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        .fc .fc-scrollgrid td,
        .fc .fc-scrollgrid th {
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        .fc .fc-daygrid-day {
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        .fc .fc-daygrid-day-frame {
          min-height: 100px;
        }
        .fc .fc-col-header {
          background: rgba(255, 255, 255, 0.05);
        }
        .fc .fc-col-header th {
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        .fc .fc-col-header-cell-cushion {
          font-weight: 600;
          font-size: 0.875rem;
          padding: 8px 0px;
          color: hsl(var(--foreground));
        }
        .fc .fc-daygrid-day-number {
          font-size: 0.875rem;
          padding: 8px 8px 0px;
          color: hsl(var(--foreground));
        }
        .fc .fc-daygrid-day-top {
          justify-content: flex-start;
        }
        .fc .fc-daygrid-event {
          margin-top: 4px;
          margin-left: 2px;
          margin-right: 2px;
        }
        .fc .fc-event {
          border-color: transparent !important;
          background-color: transparent !important;
          cursor: pointer;
        }
        .fc .fc-event-main {
          color: #fff !important;
        }
        .fc .fc-event-main-wrapper {
          border-radius: 4px;
          width: 100%;
          position: relative;
          overflow: hidden;
          background-color: currentColor;
        }
        .fc .fc-event-main-frame {
          font-size: 12px;
          line-height: 18px;
          display: flex;
          width: 100%;
          padding: 2px 6px;
          position: relative;
          z-index: 1;
          color: #fff;
        }
        .fc .fc-event-time {
          font-weight: 600;
          flex-shrink: 0;
          margin-right: 4px;
          color: #fff;
        }
        .fc .fc-event-title-container {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }
        .fc .fc-event-title {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          display: block;
          color: #fff;
          font-weight: 500;
        }
        /* 更多事件链接 */
        .fc .fc-daygrid-more-link {
          color: hsl(var(--primary)) !important;
          font-weight: 500;
        }
        /* 弹出层样式 */
        .fc .fc-popover {
          background: hsl(var(--background)) !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          border-radius: 8px !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8) !important;
          z-index: 9999 !important;
          backdrop-filter: blur(10px);
        }
        .fc .fc-popover-header {
          background: rgba(255, 255, 255, 0.08) !important;
          padding: 12px 16px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 8px 8px 0 0 !important;
        }
        .fc .fc-popover-title {
          color: hsl(var(--foreground)) !important;
          font-weight: 600 !important;
          font-size: 14px !important;
        }
        .fc .fc-popover-close {
          color: hsl(var(--foreground)) !important;
          opacity: 0.7 !important;
          font-size: 20px !important;
          cursor: pointer !important;
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          width: 24px !important;
          height: 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .fc .fc-popover-close:hover {
          opacity: 1 !important;
          background: rgba(255, 255, 255, 0.1) !important;
          border-radius: 4px !important;
        }
        .fc .fc-popover-body {
          padding: 8px !important;
          max-height: 400px !important;
          overflow-y: auto !important;
          background: hsl(var(--background)) !important;
        }
        /* 弹出层中的事件 */
        .fc .fc-popover .fc-daygrid-event {
          margin: 4px 0 !important;
        }
        .fc .fc-popover .fc-event-main-wrapper {
          border-radius: 4px !important;
        }
        /* 亮色主题 */
        .light .fc {
          --fc-border-color: rgba(0, 0, 0, 0.1);
        }
        .light .fc .fc-scrollgrid,
        .light .fc .fc-scrollgrid td,
        .light .fc .fc-scrollgrid th,
        .light .fc .fc-daygrid-day,
        .light .fc .fc-col-header th {
          border-color: rgba(0, 0, 0, 0.1) !important;
        }
        .light .fc .fc-col-header {
          background: rgba(0, 0, 0, 0.02);
        }
        .light .fc .fc-popover {
          border-color: rgba(0, 0, 0, 0.1) !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1) !important;
        }
        .light .fc .fc-popover-header {
          background: rgba(0, 0, 0, 0.02) !important;
          border-bottom-color: rgba(0, 0, 0, 0.05) !important;
        }
      `}</style>
      <Card className="h-full w-full">
        <CardContent className="h-full w-full p-4">
          <div className="calendar-wrapper">
            <CalendarHeader
              now={date}
              view={view}
              onMove={handleMove}
              onCreate={() => {
                setEventFormType('add')
                setEventInitValue(DefaultEventInitValue)
                setOpen(true)
              }}
              onViewTypeChange={handleViewTypeChange}
            />
            <FullCalendar
              ref={fullCalendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialDate={date}
              initialView={view}
              events={events}
              eventContent={CalendarEvent}
              editable
              selectable
              selectMirror
              dayMaxEvents
              headerToolbar={false}
              select={handleDateSelect}
              eventClick={handleEventClick}
              height="calc(100% - 80px)"
              locale="zh-cn"
              timeZone="local"
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              allDaySlot={true}
              moreLinkClick="popover"
            />
          </div>
        </CardContent>
      </Card>
      <CalendarEventForm
        open={open}
        type={eventFormType}
        initValues={eventInitValue}
        onCancel={handleCancel}
        onDelete={handleDelete}
        onCreate={handleCreate}
        onEdit={handleEdit}
      />
    </>
  )
}
