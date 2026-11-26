import { useEffect, useState, type ReactNode } from 'react'
import { Move } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent, PopoverDescription, PopoverTitle } from '@/components/ui/popover'

export function CalendarDragGuide({ userId, children }: { userId: string; children: ReactNode }) {
  const storageKey = `todos-drag-guide:${userId}`
  const [open, setOpen] = useState(() => !localStorage.getItem(storageKey))

  useEffect(() => {
    if (open) localStorage.setItem(storageKey, 'seen')
  }, [open, storageKey])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild><div>{children}</div></PopoverAnchor>
      <PopoverContent aria-labelledby="todo-drag-title" align="start" sideOffset={-5} onOpenAutoFocus={(event) => event.preventDefault()}>
        <PopoverTitle id="todo-drag-title" className="flex items-center gap-2 text-sm">
          <Move aria-hidden="true" className="size-4 text-primary" /> 拖动待办重新排期
        </PopoverTitle>
        <PopoverDescription className="mt-1 text-sm">把待办拖到新的日期或时段，松开后自动保存。触屏上先长按再拖动。</PopoverDescription>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => setOpen(false)}>知道了</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
