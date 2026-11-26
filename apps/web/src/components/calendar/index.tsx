import { Card, CardContent } from '@/components/ui/card'
import type { DatesSetArg, DateSelectArg, EventChangeArg, EventClickArg, EventInput } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayjs from 'dayjs'
import { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react'
import CalendarEvent from './calendar-event'
import CalendarEventForm, { type CalendarEventFormFieldType } from './calendar-event-form'
import CalendarHeader, { type HandleMoveArg, type ViewType } from './calendar-header'
import { generateEventId } from './event-utils'
import { todosApi, type Todo, type TodoUpdate } from '@/services/todos-api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDragGuide } from './calendar-drag-guide'
import { useAuthStore } from '@/store/auth-store'

const DEFAULT_COLOR = '#00a76f'
const DATE_FORMAT = 'YYYY-MM-DD'
const EMPTY_TODOS: Todo[] = []

async function getCalendarTodos(firstMonth: string, lastMonth: string) {
  const months = []
  for (let month = dayjs(firstMonth); month.format('YYYY-MM') <= lastMonth; month = month.add(1, 'month')) {
    months.push(todosApi.getTodosByMonth(month.year(), month.month() + 1))
  }
  const todos = (await Promise.all(months)).flat()
  return [...new Map(todos.map((todo) => [todo.id, todo])).values()]
}

function newTodo(startDate: string): CalendarEventFormFieldType {
  return {
    id: generateEventId(),
    title: '',
    description: '',
    allDay: true,
    startDate,
    endDate: startDate,
    startTime: '09:00',
    endTime: '10:00',
    color: DEFAULT_COLOR,
    completed: false,
  }
}

function todoToEvent(todo: Todo): EventInput {
  const startDate = todo.startDate.slice(0, 10)
  const endDate = todo.endDate.slice(0, 10)

  return {
    id: todo.id,
    title: todo.content,
    start: todo.allDay ? startDate : startDate + 'T' + todo.startTime,
    // The API stores the last included date. FullCalendar expects the following day.
    end: todo.allDay ? dayjs(endDate).add(1, 'day').format(DATE_FORMAT) : endDate + 'T' + todo.endTime,
    allDay: todo.allDay,
    color: todo.color || DEFAULT_COLOR,
    extendedProps: {
      completed: todo.completed,
      description: todo.description || todo.content,
    },
  }
}

function eventToTodo(event: CalendarEventFormFieldType) {
  return {
    content: event.title,
    description: event.description,
    color: event.color,
    allDay: event.allDay,
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.allDay ? '00:00' : event.startTime,
    endTime: event.allDay ? '23:59:59' : event.endTime,
    completed: event.completed,
  }
}

export default function Calendar() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id ?? '')
  const fullCalendarRef = useRef<FullCalendar>(null)
  const movingEvents = useRef(new Set<string>())
  const [view, setView] = useState<ViewType>('dayGridMonth')
  const [date, setDate] = useState(new Date())
  const [visibleMonths, setVisibleMonths] = useState<[string, string] | null>(null)
  const [moveFeedback, setMoveFeedback] = useState<'saved' | 'error' | null>(null)
  const [open, setOpen] = useState(false)
  const [eventInitValue, setEventInitValue] =
    useState<CalendarEventFormFieldType | null>(null)
  const [eventFormType, setEventFormType] = useState<'add' | 'edit'>('add')

  const { data: allTodos = EMPTY_TODOS } = useQuery({
    queryKey: ['todos', 'calendar', userId, visibleMonths],
    enabled: Boolean(userId && visibleMonths),
    queryFn: () => getCalendarTodos(...visibleMonths!),
  })
  const events = useMemo(() => allTodos.map(todoToEvent), [allTodos])

  const handleDatesSet = ({ start, end }: DatesSetArg) => {
    const first = dayjs(start).format('YYYY-MM')
    const last = dayjs(end).subtract(1, 'day').format('YYYY-MM')
    setVisibleMonths((previous) => previous?.[0] === first && previous[1] === last ? previous : [first, last])
  }

  useEffect(() => {
    if (moveFeedback !== 'saved') return
    const timer = window.setTimeout(() => setMoveFeedback(null), 2500)
    return () => window.clearTimeout(timer)
  }, [moveFeedback])

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

  const refreshTodos = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['monthStatus'] }),
    queryClient.invalidateQueries({ queryKey: ['todos'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
  ])

  const createMutation = useMutation({
    mutationFn: todosApi.create,
    onSuccess: refreshTodos,
  })

  // 更新 todo
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TodoUpdate }) => todosApi.update(id, data),
    onSuccess: refreshTodos,
  })

  // 删除 todo
  const deleteMutation = useMutation({
    mutationFn: todosApi.delete,
    onSuccess: refreshTodos,
  })

  const handleEventReschedule = async ({ event, revert }: EventChangeArg) => {
    if (!event.start || !event.end || movingEvents.current.has(event.id)) {
      revert()
      return
    }
    const { id, allDay } = event
    const start = dayjs(event.start)
    const end = dayjs(event.end)
    const endDate = allDay ? end.subtract(1, 'day') : end
    movingEvents.current.add(id)
    setMoveFeedback(null)
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          allDay,
          startDate: start.format(DATE_FORMAT),
          endDate: endDate.format(DATE_FORMAT),
          startTime: allDay ? '00:00' : start.format('HH:mm:ss'),
          endTime: allDay ? '23:59:59' : end.format('HH:mm:ss'),
        },
      })
      setMoveFeedback('saved')
    } catch {
      revert()
      setMoveFeedback('error')
    } finally {
      movingEvents.current.delete(id)
    }
  }

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
    const timer = setTimeout(() => {
      calendarApi.changeView(view)
    })
    return () => clearTimeout(timer)
  }, [view])

  /**
   * calendar grid events
   */
  const handleDateSelect = (selection: DateSelectArg) => {
    selection.view.calendar.unselect()
    const draft = newTodo(dayjs(selection.start).format(DATE_FORMAT))
    if (selection.allDay) {
      draft.endDate = dayjs(selection.end).subtract(1, 'day').format(DATE_FORMAT)
    } else {
      const start = dayjs(selection.start)
      const end = dayjs(selection.end)
      draft.allDay = false
      draft.startTime = start.format('HH:mm')
      draft.endDate = end.format(DATE_FORMAT)
      draft.endTime = end.format('HH:mm')
    }
    setEventInitValue(draft)
    setEventFormType('add')
    setOpen(true)
  }

  const handleEventClick = (arg: EventClickArg) => {
    const todo = allTodos.find((item) => item.id === arg.event.id)
    if (!todo || movingEvents.current.has(arg.event.id)) return
    arg.jsEvent.stopPropagation()

    setEventInitValue({
      id: todo.id,
      title: todo.content,
      description: todo.description ?? '',
      allDay: todo.allDay,
      color: todo.color || DEFAULT_COLOR,
      startDate: todo.startDate.slice(0, 10),
      endDate: todo.endDate.slice(0, 10),
      startTime: todo.allDay ? '09:00' : todo.startTime.slice(0, 5),
      endTime: todo.allDay ? '10:00' : todo.endTime.slice(0, 5),
      completed: todo.completed,
    })
    setEventFormType('edit')
    setOpen(true)
  }

  const handleCancel = () => {
    setEventInitValue(null)
    setOpen(false)
  }

  const handleSave = (values: CalendarEventFormFieldType) => {
    const data = eventToTodo(values)
    return eventFormType === 'edit'
      ? updateMutation.mutateAsync({ id: values.id, data })
      : createMutation.mutateAsync(data)
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
        /* 移动端压缩格子高度,整月塞进视口,消除内部滚动条 */
        @media (max-width: 767px) {
          .fc .fc-daygrid-day-frame {
            min-height: 56px;
          }
          .fc .fc-daygrid-day-number {
            padding: 4px 4px 0px;
            font-size: 0.75rem;
          }
          .fc .fc-col-header-cell-cushion {
            font-size: 0.75rem;
            padding: 4px 0px;
          }
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
            <CalendarDragGuide key={userId} userId={userId}>
              <CalendarHeader
                now={date}
                view={view}
                onMove={handleMove}
                onCreate={() => {
                  setEventFormType('add')
                  setEventInitValue(newTodo(dayjs(date).format(DATE_FORMAT)))
                  setOpen(true)
                }}
                onViewTypeChange={handleViewTypeChange}
              />
            </CalendarDragGuide>
            <FullCalendar
              ref={fullCalendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialDate={date}
              initialView={view}
              events={events}
              eventContent={CalendarEvent}
              editable
              forceEventDuration
              datesSet={handleDatesSet}
              eventAllow={(_, event) => Boolean(event && !movingEvents.current.has(event.id))}
              eventDrop={(arg) => void handleEventReschedule(arg)}
              eventResize={(arg) => void handleEventReschedule(arg)}
              selectable
              selectMirror
              dayMaxEvents
              headerToolbar={false}
              // 只显示日期数字:zh-cn 的 dayNumberText 自带"日"字,窄格子被挤成竖排
              dayCellContent={(arg) => String(arg.date.getDate())}
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
      {moveFeedback && (
        <p role={moveFeedback === 'error' ? 'alert' : 'status'} className="fixed right-4 bottom-4 z-40 rounded-md border border-border bg-popover px-4 py-2 text-sm shadow-md text-popover-foreground">
          {moveFeedback === 'saved' ? '待办时间已保存' : '保存失败，待办已恢复到原时间。'}
        </p>
      )}
      {open && eventInitValue && (
        <CalendarEventForm
          type={eventFormType}
          initValues={eventInitValue}
          onCancel={handleCancel}
          onDelete={deleteMutation.mutateAsync}
          onSave={handleSave}
        />
      )}
    </>
  )
}
