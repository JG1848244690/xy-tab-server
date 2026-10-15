import { Icon } from '@/components/icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import dayjs from 'dayjs'
import { type ReactNode, useMemo } from 'react'

export type HandleMoveArg = 'next' | 'prev' | 'today'
export type ViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'
type ViewTypeMenu = {
  key: string
  label: string
  view: ViewType
  icon: ReactNode
}

type Props = {
  now: Date
  view: ViewType
  onMove: (action: HandleMoveArg) => void
  onCreate: () => void
  onViewTypeChange: (view: ViewType) => void
}

export default function CalendarHeader({ now, view, onMove, onCreate, onViewTypeChange }: Props) {
  const items = useMemo<ViewTypeMenu[]>(
    () => [
      {
        key: '1',
        label: '月',
        view: 'dayGridMonth',
        icon: <Icon icon="mdi:calendar-month-outline" size={18} />,
      },
      {
        key: '2',
        label: '周',
        view: 'timeGridWeek',
        icon: <Icon icon="mdi:calendar-weekend-outline" size={18} />,
      },
      {
        key: '3',
        label: '日',
        view: 'timeGridDay',
        icon: <Icon icon="mdi:calendar-today-outline" size={18} />,
      },
      {
        key: '4',
        label: '列表',
        view: 'listWeek',
        icon: <Icon icon="mdi:view-agenda-outline" size={18} />,
      },
    ],
    []
  )

  const handleMenuClick = (e: { key: string }) => {
    const selectedViewType = items.find((item) => item.key === e.key)
    if (selectedViewType) {
      onViewTypeChange(selectedViewType.view)
    }
  }

  const viewTypeMenu = (view: ViewType) => {
    const viewTypeItem = items.find((item) => item.view === view)
    if (!viewTypeItem) {
      return null
    }
    const { icon, label } = viewTypeItem
    return (
      <div className="flex items-center">
        {icon}
        <span className="mx-1 text-sm font-medium">{label}</span>
        <Icon icon="solar:alt-arrow-down-outline" size={20} />
      </div>
    )
  }

  return (
    <div className="relative flex items-center justify-between py-5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            {viewTypeMenu(view)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {items.map((item) => (
            <DropdownMenuItem key={item.key} onClick={() => handleMenuClick({ key: item.key })}>
              <div className="flex items-center gap-2">
                {item.icon}
                {item.label}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex cursor-pointer items-center justify-center">
        <Button variant="ghost" size="icon" onClick={() => onMove('prev')}>
          <Icon icon="solar:alt-arrow-left-outline" size={20} />
        </Button>
        <span className="mx-2 text-base font-bold">{dayjs(now).format('YYYY年MM月DD日')}</span>
        <Button variant="ghost" size="icon" onClick={() => onMove('next')}>
          <Icon icon="solar:alt-arrow-right-outline" size={20} />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => onMove('today')}>
          今天
        </Button>
        <Button onClick={() => onCreate()}>
          <div className="flex items-center justify-center gap-1">
            <Icon icon="material-symbols:add" size={20} />
            新建事件
          </div>
        </Button>
      </div>
    </div>
  )
}
