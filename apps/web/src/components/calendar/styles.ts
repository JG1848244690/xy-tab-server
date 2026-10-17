// FullCalendar 样式覆盖
// 在你的 globals.css 中添加这些样式，或者在组件中使用 style 标签

export const calendarStyles = `
  .calendar-wrapper {
    width: 100%;
    height: 100%;
    overflow: auto;
    -ms-overflow-style: none;
    scrollbar-width: none;
    overflow-y: scroll;
  }

  .calendar-wrapper::-webkit-scrollbar {
    display: none;
  }

  .fc {
    width: 100%;
    height: 100%;
    --fc-border-color: hsl(var(--border));
    --fc-now-indicator-color: hsl(var(--primary));
    --fc-today-bg-color: hsl(var(--accent));
    --fc-page-bg-color: hsl(var(--background));
    --fc-neutral-bg-color: hsl(var(--background));
    --fc-list-event-hover-bg-color: hsl(var(--accent));
    --fc-highlight-color: hsl(var(--accent));
  }

  .fc a {
    color: hsl(var(--foreground));
  }

  .fc .fc-col-header {
    box-shadow: inset 0 -1px 0 hsl(var(--border));
  }

  .fc .fc-col-header th {
    border-color: transparent;
  }

  .fc .fc-col-header-cell-cushion {
    font-weight: 600;
    font-size: 0.875rem;
    padding: 8px 0px;
  }

  .fc .fc-daygrid-day-number {
    line-height: 1.57143;
    font-size: 0.875rem;
    font-weight: 400;
    padding: 8px 8px 0px;
  }

  .fc .fc-daygrid-event {
    margin-top: 4px;
  }

  .fc .fc-event {
    border-color: transparent !important;
    background-color: transparent !important;
  }

  .fc .fc-event-main-wrapper {
    border-radius: 6px;
    width: 100%;
    background-color: #fff;
    position: relative;
  }

  .fc .fc-event-main-wrapper::before {
    top: 0px;
    left: 0px;
    width: 100%;
    content: '';
    opacity: 0.24;
    height: 100%;
    border-radius: 6px;
    position: absolute;
    background-color: currentcolor;
    transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  }

  .fc .fc-event-main-frame {
    font-size: 13px;
    line-height: 20px;
    filter: brightness(0.48);
    display: flex;
    width: 100%;
  }

  .fc .fc-event-time {
    overflow: unset;
    font-weight: 700;
  }

  .fc .fc-event-title-container {
    min-width: 0px;
  }

  .fc .fc-event-title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .fc .fc-list-day th {
    z-index: 100;
  }

  .fc .fc-list-day-text,
  .fc .fc-list-day-side-text {
    line-height: 1.57143;
    font-size: 0.875rem;
    font-weight: 400;
  }

  .fc .fc-list-event-time {
    color: hsl(var(--muted-foreground));
  }

  .fc .fc-list-table th,
  .fc .fc-list-table td {
    border-color: transparent;
  }
`
