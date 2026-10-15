import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Node, Graph } from '@antv/x6'

// 菜单项类型
export type MenuItem = {
  id: string
  title: string
  icon?: React.ReactNode
  disabled?: boolean
  shortcut?: string
  onClick?: (node: Node, graph: Graph) => void // 同时传入 node 和 graph
  children?: MenuItem[]
}

// 菜单组类型
export type MenuGroup = {
  id: string
  group: string
  items: MenuItem[]
}

// 菜单位置类型
interface MenuPosition {
  left: number
  top: number
}

/**
 * 计算菜单的最佳显示位置
 * 确保菜单不会超出视口边界
 */
function calculateMenuPosition(
  mouseX: number,
  mouseY: number,
  menuWidth: number,
  menuHeight: number
): MenuPosition {
  const padding = 4 // 距离边界的最小间距

  // 获取视口尺寸
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let left = mouseX
  let top = mouseY

  // 水平方向：检查右侧是否有足够空间
  if (mouseX + menuWidth + padding > viewportWidth) {
    // 右侧空间不足，显示在鼠标左侧
    left = mouseX - menuWidth

    // 如果左侧也不够，则贴右边界
    if (left < padding) {
      left = viewportWidth - menuWidth - padding
    }
  }

  // 垂直方向：检查下方是否有足够空间
  if (mouseY + menuHeight + padding > viewportHeight) {
    // 下方空间不足，显示在鼠标上方
    top = mouseY - menuHeight

    // 如果上方也不够，则贴下边界
    if (top < padding) {
      top = viewportHeight - menuHeight - padding
    }
  }

  // 确保不超出左边界和上边界
  left = Math.max(padding, left)
  top = Math.max(padding, top)

  return { left, top }
}

interface ContextMenuProps {
  visible: boolean
  x: number
  y: number
  menuGroups: MenuGroup[]
  node?: Node
  graph?: Graph
  onClose: () => void
}

/**
 * 自定义右键菜单组件
 * 支持手动控制位置和显示，自动计算最佳位置避免超出视口
 */
export function ContextMenuBasic({
  visible,
  x,
  y,
  menuGroups,
  node,
  graph,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<MenuPosition>({ left: x, top: y })

  // 计算菜单位置
  useEffect(() => {
    if (!visible || !menuRef.current) return

    // 获取菜单的实际尺寸
    const menuRect = menuRef.current.getBoundingClientRect()
    const menuWidth = menuRect.width
    const menuHeight = menuRect.height

    // 计算最佳位置
    const newPosition = calculateMenuPosition(x, y, menuWidth, menuHeight)
    setPosition(newPosition)
  }, [visible, x, y])

  // 点击外部关闭菜单
  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose()
      }
    }

    // 延迟绑定，避免立即触发
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [visible, onClose])

  // ESC 键关闭菜单
  useEffect(() => {
    if (!visible) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [visible, onClose])

  if (!visible) return null

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
    >
      {menuGroups.map((group, groupIndex) => (
        <div key={group.id}>
          {/* 分组标题（可选） */}
          {group.group && (
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              {group.group}
            </div>
          )}
          {/* 菜单项 */}
          {group.items.map((item) => (
            <button
              key={item.id}
              disabled={item.disabled}
              onClick={() => {
                if (node && graph && item.onClick) {
                  item.onClick(node, graph)
                  onClose()
                }
              }}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              {item.icon && <span className="mr-2">{item.icon}</span>}
              <span className="flex-1 text-left">{item.title}</span>
              {item.shortcut && (
                <span className="ml-auto text-xs text-muted-foreground">{item.shortcut}</span>
              )}
            </button>
          ))}
          {/* 分隔线 */}
          {groupIndex < menuGroups.length - 1 && <div className="my-1 h-px bg-border" />}
        </div>
      ))}
    </div>
  )

  // 使用 createPortal 将菜单渲染到 document.body 下
  return createPortal(menuContent, document.body)
}
