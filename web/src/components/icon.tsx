import { Icon as IconifyIcon } from '@iconify/react'

interface IconProps {
  icon: string
  size?: number
  className?: string
}

export function Icon({ icon, size = 24, className }: IconProps) {
  return <IconifyIcon icon={icon} width={size} height={size} className={className} />
}
