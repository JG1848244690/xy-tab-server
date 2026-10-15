import React from 'react'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Dnd, Graph } from '@antv/x6'
import type { Node } from '@antv/x6'
//侧边栏
import Sider from './sider'
//自定义节点
import { registerCustomNodes } from './custom-nodes'
//菜单
import type { MenuGroup } from './menu'
import { ContextMenuBasic } from './menu'
//工具函数
import {
  createGraphInstance,
  createDndInstance,
  updateGraphTheme,
  setupResizeObserver,
  initializeGraphFeatures,
} from './utils'

// 创建菜单配置的函数
const createMenuGroups = (node: Node, graph: Graph): MenuGroup[] => {
  return [
    {
      id: 'basic',
      group: '基础操作',
      items: [
        {
          id: 'delete',
          title: '删除节点',
          shortcut: 'Del',
          onClick: (node, graph) => {
            graph.removeNode(node)
          },
        },
        {
          id: 'copy',
          title: '复制节点',
          shortcut: '⌘C',
          onClick: (node, graph) => {
            graph.copy([node])
          },
        },
      ],
    },
  ]
}
const Index = () => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const dndRef = useRef<Dnd | null>(null)
  const [graph, setGraph] = useState<Graph | null>(null)
  const [dnd, setDnd] = useState<Dnd | null>(null)
  const [mounted, setMounted] = useState(false)
  const [editingNode, setEditingNode] = useState<Node | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editPosition, setEditPosition] = useState({ x: 0, y: 0 })
  const { resolvedTheme } = useTheme()

  // 存储右键点击的节点和菜单位置
  const [contextMenuNode, setContextMenuNode] = useState<Node | null>(null)
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  // 等待客户端挂载
  useEffect(() => {
    setMounted(true)
  }, [])

  // 初始化 Graph（只在首次挂载时执行）
  useEffect(() => {
    if (!containerRef.current || !wrapperRef.current || !mounted) return

    const isDark = resolvedTheme === 'dark'

    // 创建 Graph 实例
    const graphInstance = createGraphInstance({
      container: containerRef.current,
      isDark,
    })

    // 注册自定义 React 组件节点
    registerCustomNodes(graphInstance)

    // 初始化所有插件和事件
    initializeGraphFeatures(graphInstance, containerRef, {
      //针对节点的右键菜单回调
      onNodeContextMenu: (node, x, y) => {
        setContextMenuNode(node)
        setContextMenuVisible(true)
        setContextMenuPosition({ x, y })
      },
      onStartEdit: (node, value, position) => {
        setEditingNode(node)
        setEditValue(value)
        setEditPosition(position)
      },
    })

    // 创建 Dnd 实例
    const dndInstance = createDndInstance(graphInstance)

    // 保存实例
    graphRef.current = graphInstance
    dndRef.current = dndInstance
    setGraph(graphInstance)
    setDnd(dndInstance)

    // 监听容器尺寸变化
    const resizeObserver = setupResizeObserver(wrapperRef.current, graphRef)

    // 清理函数
    return () => {
      resizeObserver.disconnect()
      // 使用 setTimeout 将 dispose 延迟到下一个事件循环
      // 避免在 React 渲染期间同步卸载导致的竞态条件
      if (graphRef.current) {
        const graphToDispose = graphRef.current
        setTimeout(() => {
          graphToDispose.dispose()
        }, 0)
      }
    }
  }, [mounted]) // 添加 resolvedTheme 依赖

  // 监听主题变化，更新背景和网格颜色
  useEffect(() => {
    if (!graph || !mounted) return

    const isDark = resolvedTheme === 'dark'
    updateGraphTheme(graph, isDark)
  }, [resolvedTheme, graph, mounted])

  // 在客户端挂载前显示加载状态
  if (!mounted) {
    return (
      <div className="flex h-full w-full min-w-0 items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingNode || !editValue.trim()) {
      setEditingNode(null)
      setEditValue('')
      return
    }

    const shape = editingNode.shape
    const isReactNode = [
      'linked-list-node',
      'array-node',
      'binary-tree-node',
      'stack-node',
      'hash-node',
      'pointer-marker',
    ].includes(shape)

    if (isReactNode) {
      // React 组件节点，更新 data
      const currentData = editingNode.getData() || {}
      if (shape === 'linked-list-node') {
        editingNode.setData({
          ...currentData,
          value: editValue.trim(),
        })
      } else if (shape === 'array-node') {
        const items = editValue.split(',').map((item) => item.trim())
        editingNode.setData({
          ...currentData,
          items,
        })
      } else if (shape === 'binary-tree-node') {
        editingNode.setData({
          ...currentData,
          value: editValue.trim(),
        })
      } else if (shape === 'stack-node') {
        const items = editValue.split(',').map((item) => item.trim())
        editingNode.setData({
          ...currentData,
          items,
        })
      } else if (shape === 'pointer-marker') {
        editingNode.setData({
          ...currentData,
          label: editValue.trim(),
        })
      }
    } else {
      // 普通节点，更新 label
      editingNode.attr('label/text', editValue.trim())
    }
    setEditingNode(null)
    setEditValue('')
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingNode(null)
    setEditValue('')
  }

  // 处理输入框的键盘事件
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
    }
  }

  return (
    <div className="flex h-full w-full min-w-0">
      {/* 侧边栏 */}
      <Sider graph={graph || undefined} dnd={dnd || undefined} />

      {/* 画布容器 */}
      <div ref={wrapperRef} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }}></div>

        {/* 右键菜单 */}
        <ContextMenuBasic
          visible={contextMenuVisible}
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          menuGroups={contextMenuNode && graph ? createMenuGroups(contextMenuNode, graph) : []}
          node={contextMenuNode || undefined}
          graph={graph || undefined}
          onClose={() => setContextMenuVisible(false)}
        />
        {/* 编辑节点文本的输入框 */}
        {editingNode && (
          <div
            style={{
              position: 'absolute',
              left: editPosition.x,
              top: editPosition.y,
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
            }}
          >
            <div className="flex items-center gap-2 rounded-lg border bg-background p-2 shadow-lg">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={handleSaveEdit}
                autoFocus
                className="w-48 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={
                  editingNode.shape === 'array-node' || editingNode.shape === 'stack-node'
                    ? '用逗号分隔，如: 1,2,3'
                    : editingNode.shape === 'hash-node'
                      ? '格式: key:value'
                      : '输入节点文本'
                }
              />
              <button
                onClick={handleSaveEdit}
                className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
              >
                确定
              </button>
              <button
                onClick={handleCancelEdit}
                className="rounded bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Index
