import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Option {
  label: string
  value: string
}

interface SelectProps {
  value: string
  onChange: (val: string) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder

  return (
    <div className={cn('relative w-full', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-all',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        <span className={cn(value ? '' : 'text-muted-foreground')}>{selectedLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={cn(
            'size-5 text-muted-foreground transition-transform',
            open ? 'rotate-180' : ''
          )}
        >
          <path
            fillRule="evenodd"
            d="M12 14.5a1 1 0 0 1-.707-.293l-5-5a1 1 0 1 1 1.414-1.414L12 12.086l4.293-4.293a1 1 0 0 1 1.414 1.414l-5 5A1 1 0 0 1 12 14.5Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-md border bg-background shadow-md"
        >
          <div className="max-h-56 overflow-auto py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors',
                  value === opt.value
                    ? 'bg-secondary text-secondary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                )}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
              >
                <span>{opt.label}</span>
                {value === opt.value && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-4"
                  >
                    <path fillRule="evenodd" d="M10.5 15.5 6 11l1.5-1.5 3 3 6-6L18 8l-7.5 7.5z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
