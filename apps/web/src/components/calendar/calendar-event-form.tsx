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
import dayjs from 'dayjs'
import { useId, useState, type FormEvent } from 'react'

export type CalendarEventFormFieldType = {
  id: string
  title: string
  description: string
  allDay: boolean
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  color: string
  completed: boolean
}

type Props = {
  type: 'edit' | 'add'
  onCancel: () => void
  onSave: (event: CalendarEventFormFieldType) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  initValues: CalendarEventFormFieldType
}

const COLORS = ['#00a76f', '#8e33ff', '#00b8d9', '#003768', '#22c55e', '#ffab00', '#ff5630', '#7a0916']
const DURATIONS = [{ minutes: 30, label: '30 分钟' }, { minutes: 60, label: '1 小时' }]

export default function CalendarEventForm({ type, onCancel, initValues, onSave, onDelete }: Props) {
  const id = useId()
  const [draft, setDraft] = useState(initValues)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ text: string; field?: keyof CalendarEventFormFieldType }>()
  const isNew = type === 'add'

  function change<K extends keyof CalendarEventFormFieldType>(field: K, value: CalendarEventFormFieldType[K]) {
    setError(undefined)
    setDraft((previous) => ({ ...previous, [field]: value }))
  }

  function changeStartDate(value: string) {
    setError(undefined)
    setDraft((previous) => ({
      ...previous,
      startDate: value,
      endDate: value && (previous.endDate === previous.startDate || previous.endDate < value)
        ? value
        : previous.endDate,
    }))
  }

  function setDuration(minutes: number) {
    if (!draft.startDate || !draft.startTime) return
    const [hours, minute] = draft.startTime.split(':').map(Number)
    const end = hours * 60 + minute + minutes
    const endDate = end < 1440 ? draft.startDate : dayjs(draft.startDate).add(1, 'day').format('YYYY-MM-DD')
    const endTime = [Math.floor(end / 60) % 24, end % 60].map((value) => String(value).padStart(2, '0')).join(':')
    setError(undefined)
    setDraft((previous) => ({ ...previous, endDate, endTime }))
  }

  async function run(action: () => Promise<unknown>, errorText: string) {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      await action()
      onCancel()
    } catch {
      setError({ text: errorText })
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draft.title.trim()
    const issue = !title ? { field: 'title', text: '请输入待办标题。' }
      : draft.endDate < draft.startDate ? { field: 'endDate', text: '结束日期不能早于开始日期。' }
      : !draft.allDay && draft.endDate === draft.startDate && draft.endTime < draft.startTime
        ? { field: 'endTime', text: '同一天的结束时间不能早于开始时间。' } : undefined
    if (issue) {
      setError(issue as { field: keyof CalendarEventFormFieldType; text: string })
      const input = event.currentTarget.elements.namedItem(issue.field)
      if (input instanceof HTMLInputElement) input.focus()
      return
    }
    void run(() => onSave({ ...draft, title }), '保存失败，请重试。')
  }

  const fieldError = (field: keyof CalendarEventFormFieldType) => ({
    'aria-invalid': error?.field === field || undefined,
    'aria-describedby': error?.field === field ? id + '-error' : undefined,
  })

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel() }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[31rem]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isNew ? '添加待办' : '编辑待办'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <legend className="sr-only">待办详情</legend>
            <div className="space-y-2">
              <Label htmlFor={id + '-title'}>标题</Label>
              <Input id={id + '-title'} name="title" required value={draft.title} {...fieldError('title')}
                onChange={(event) => change('title', event.target.value)} placeholder="输入待办标题" />
            </div>

            {!isNew && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <Label htmlFor={id + '-completed'} className="cursor-pointer">已完成</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">勾选后日历上会显示删除线</p>
                </div>
                <Switch
                  id={id + '-completed'}
                  name="completed"
                  checked={draft.completed}
                  onCheckedChange={(checked) => change('completed', checked)}
                />
              </div>
            )}

            <fieldset className="space-y-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">安排时间</legend>
              <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                {[{ allDay: true, label: '全天' }, { allDay: false, label: '指定时间' }].map(({ allDay, label }) => (
                  <label key={label} className="cursor-pointer">
                    <input className="peer sr-only" type="radio" name={id + '-mode'} checked={draft.allDay === allDay}
                      onChange={() => change('allDay', allDay)} />
                    <span className="block rounded-sm px-2 py-2 text-center text-sm text-muted-foreground peer-checked:bg-background peer-checked:font-medium peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring">{label}</span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={id + '-start-date'}>开始日期</Label>
                  <Input id={id + '-start-date'} type="date" name="startDate" required value={draft.startDate}
                    onChange={(event) => changeStartDate(event.target.value)} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={id + '-end-date'}>结束日期</Label>
                  <Input id={id + '-end-date'} type="date" name="endDate" required value={draft.endDate}
                    {...fieldError('endDate')} onChange={(event) => change('endDate', event.target.value)} />
                </div>
              </div>
              {!draft.allDay && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor={id + '-start-time'}>开始时间</Label>
                      <Input id={id + '-start-time'} type="time" name="startTime" required value={draft.startTime}
                        onChange={(event) => change('startTime', event.target.value)} />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor={id + '-end-time'}>结束时间</Label>
                      <Input id={id + '-end-time'} type="time" name="endTime" required value={draft.endTime}
                        {...fieldError('endTime')} onChange={(event) => change('endTime', event.target.value)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-xs text-muted-foreground">快捷时长</span>
                    {DURATIONS.map(({ minutes, label }) => (
                      <Button key={minutes} variant="outline" size="sm" type="button" className="h-8"
                        disabled={!draft.startDate || !draft.startTime} onClick={() => setDuration(minutes)}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor={id + '-description'}>备注</Label>
              <Textarea id={id + '-description'} name="description" rows={2} value={draft.description}
                onChange={(event) => change('description', event.target.value)} placeholder="添加备注（可选）" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id + '-color'}>颜色</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input id={id + '-color'} type="color" name="color" className="w-11 px-1" value={draft.color}
                  onChange={(event) => change('color', event.target.value)} />
                {COLORS.map((color) => (
                  <button key={color} type="button" aria-label={color} aria-pressed={draft.color === color}
                    className="size-6 rounded-full border aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2"
                    style={{ backgroundColor: color }} onClick={() => change('color', color)} />
                ))}
              </div>
            </div>
          </fieldset>

          {error && <p id={id + '-error'} className="text-sm text-destructive" role="alert">{error.text}</p>}
          <DialogFooter className="flex-row justify-between sm:justify-between">
            {!isNew && (
              <Button variant="ghost" size="icon" type="button" aria-label="删除待办" disabled={busy}
                onClick={() => void run(() => onDelete(initValues.id), '删除失败，请重试。')}>
                <Icon icon="fluent:delete-16-filled" size={20} className="text-destructive" />
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" type="button" onClick={onCancel} disabled={busy}>取消</Button>
              <Button type="submit" disabled={busy}>{busy ? '处理中…' : '保存待办'}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
