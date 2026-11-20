import type { EventContentArg } from '@fullcalendar/core'

export default function CalendarEvent(eventInfo: EventContentArg) {
  const { timeText, event, backgroundColor } = eventInfo
  const completed = Boolean(event.extendedProps?.completed)

  return (
    <div
      className="fc-event-main-wrapper"
      style={{
        color: backgroundColor,
        // 已完成的 todo 整体弱化,和侧栏「今日待办」的视觉一致
        opacity: completed ? 0.65 : 1,
      }}
    >
      <div className="fc-event-main-frame">
        <div className="fc-event-time">{timeText}</div>
        <div className="fc-event-title-container">
          <div
            className="fc-event-title fc-sticky"
            style={completed ? { textDecoration: 'line-through' } : undefined}
          >
            {event.title}
          </div>
        </div>
      </div>
    </div>
  )
}
