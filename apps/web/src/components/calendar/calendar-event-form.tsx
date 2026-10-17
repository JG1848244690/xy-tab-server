import { Icon } from '@/components/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { EventInput } from '@fullcalendar/core'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useEffect, useState } from 'react'

export type CalendarEventFormFieldType = Pick<EventInput, 'title' | 'allDay' | 'color'> & {
  id: string
  description?: string
  start?: Dayjs
  end?: Dayjs
}

type Props = {
  type: 'edit' | 'add'
  open: boolean
  onCancel: () => void
  onEdit: (event: CalendarEventFormFieldType) => void
  onCreate: (event: CalendarEventFormFieldType) => void
  onDelete: (id: string) => void
  initValues: CalendarEventFormFieldType
}

const COLORS = [
  '#00a76f',
  '#8e33ff',
  '#00b8d9',
  '#003768',
  '#22c55e',
  '#ffab00',
  '#ff5630',
  '#7a0916',
]

export default function CalendarEventForm({
  type,
  open,
  onCancel,
  initValues,
  onEdit,
  onCreate,
  onDelete,
}: Props) {
  const title = type === 'add' ? '添加事件' : '编辑事件'

  // 将 Date 转换为本地时间字符串（用于 datetime-local input）
  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const [formData, setFormData] = useState({
    title: initValues.title || '',
    description: initValues.description || '',
    allDay: initValues.allDay || false,
    start: initValues.start?.toDate() || new Date(),
    end: initValues.end?.toDate() || new Date(),
    color: initValues.color || COLORS[0],
  })

  useEffect(() => {
    if (open) {
      setFormData({
        title: initValues.title || '',
        description: initValues.description || '',
        allDay: initValues.allDay || false,
        start: initValues.start?.toDate() || new Date(),
        end: initValues.end?.toDate() || new Date(),
        color: initValues.color || COLORS[0],
      })
    }
  }, [initValues, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    const { id } = initValues
    const event: CalendarEventFormFieldType = {
      ...formData,
      id,
      start: dayjs(formData.start),
      end: dayjs(formData.end),
    }
    if (type === 'add') onCreate(event)
    if (type === 'edit') onEdit(event)
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>标题</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="输入事件标题"
            />
          </div>

          <div className="space-y-2">
            <Label>描述</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="输入事件描述"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>全天</Label>
            <Switch
              checked={formData.allDay}
              onCheckedChange={(checked) => setFormData({ ...formData, allDay: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label>开始时间</Label>
            <Input
              type="datetime-local"
              value={formatDateTimeLocal(formData.start)}
              onChange={(e) => setFormData({ ...formData, start: new Date(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label>结束时间</Label>
            <Input
              type="datetime-local"
              value={formatDateTimeLocal(formData.end)}
              onChange={(e) => setFormData({ ...formData, end: new Date(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label>颜色</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
              <div className="flex gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="size-6 rounded-full border"
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            {type === 'edit' && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => {
                  onDelete(initValues.id)
                  onCancel()
                }}
              >
                <Icon icon="fluent:delete-16-filled" size={20} className="text-destructive" />
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={onCancel}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
