import { Check, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useThemeColor } from '@/components/theme-color-provider'
import { cn } from '@/lib/utils'

const themes = [
  {
    name: 'Zinc',
    value: 'zinc' as const,
    color: 'oklch(0.7 0.15 85)',
  },
  {
    name: 'Slate',
    value: 'slate' as const,
    color: 'oklch(0.45 0.08 256)',
  },
  {
    name: 'Rose',
    value: 'rose' as const,
    color: 'oklch(0.6 0.22 20)',
  },
  {
    name: 'Blue',
    value: 'blue' as const,
    color: 'oklch(0.55 0.2 260)',
  },
  {
    name: 'Green',
    value: 'green' as const,
    color: 'oklch(0.55 0.15 150)',
  },
  {
    name: 'Orange',
    value: 'orange' as const,
    color: 'oklch(0.65 0.2 45)',
  },
  {
    name: 'Purple',
    value: 'purple' as const,
    color: 'oklch(0.55 0.2 300)',
  },
]

export function ThemeColorToggle() {
  const { theme, setTheme } = useThemeColor()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Palette className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-3">
        <div className="text-sm font-medium mb-3 text-primary ">切换主题色</div>
        <div className="flex flex-wrap gap-2">
          {themes.map((t) => (
            <button
              key={t.value}
              type="button"
              className={cn(
                'relative flex h-14 cursor-pointer items-center justify-center rounded-md transition-all duration-300 ease-in-out p-1 border-0 bg-transparent',
                theme === t.value ? 'w-14' : 'w-6'
              )}
              style={{ backgroundColor: t.color }}
              onClick={() => setTheme(t.value)}
              title={t.name}
            >
              <div
                className={cn(
                  'w-full h-full flex items-center justify-center hover:bg-white/30 transition-all duration-300 ease-in-out rounded',
                  theme === t.value && 'bg-white/30'
                )}
              >
                {theme === t.value && <Check className="w-6 h-6 text-white" strokeWidth={3} />}
              </div>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
