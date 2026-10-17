import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  initialName: string
  title?: string
  confirmText?: string
  cancelText?: string
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => void
}

export default function RenameDialog({
  open,
  initialName,
  title = '重命名',
  confirmText = '保存',
  cancelText = '取消',
  onOpenChange,
  onConfirm,
}: Props) {
  const [name, setName] = useState(initialName)

  useEffect(() => {
    if (open) setName(initialName)
  }, [open, initialName])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>请输入新的名称</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入名称" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button onClick={() => onConfirm(name.trim())} disabled={!name.trim()}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
