import React, { useState, useEffect } from 'react'
import { Graph } from '@antv/x6'
import { Dnd } from '@antv/x6'
import { useTheme } from 'next-themes'
import { nodeGroups, type NodeConfig } from './nodes'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'

interface SiderProps {
  graph: Graph | undefined
  dnd: Dnd | undefined
}

// 节点预览组件
const NodePreview: React.FC<{ node: NodeConfig }> = ({ node }) => {
  // React 组件节点的特殊预览
  const getReactComponentPreview = () => {
    switch (node.shape) {
      case 'linked-list-node':
        return (
          <div className="flex h-8 w-16 items-center border-2 border-blue-500 bg-blue-50 text-[8px]">
            <div className="flex-1 border-r border-blue-500 text-center font-semibold">val</div>
            <div className="flex-1 text-center text-gray-600">→</div>
          </div>
        )
      case 'array-node':
        return (
          <div className="flex h-6 w-20 gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-1 items-center justify-center border border-purple-500 bg-purple-50 text-[8px]"
              >
                {i}
              </div>
            ))}
          </div>
        )
      case 'binary-tree-node':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-green-500 bg-green-50 text-xs font-bold">
            1
          </div>
        )
      case 'stack-node':
        return (
          <div className="flex h-12 w-10 flex-col gap-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`flex flex-1 items-center justify-center border ${
                  i === 0 ? 'border-orange-500 bg-orange-100' : 'border-orange-400 bg-orange-50'
                } text-[6px]`}
              >
                {i === 0 ? 'top' : ''}
              </div>
            ))}
          </div>
        )
      case 'hash-node':
        return (
          <div className="flex h-8 w-12 flex-col border-2 border-pink-500 bg-pink-50 text-[8px]">
            <div className="flex-1 border-b border-pink-300 px-1 font-semibold">key</div>
            <div className="flex-1 px-1">val</div>
          </div>
        )
      case 'pointer-marker':
        return (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">
            ptr
          </div>
        )
      default:
        return null
    }
  }

  // 如果是 React 组件节点，使用特殊预览
  const reactPreview = getReactComponentPreview()
  if (reactPreview) {
    return reactPreview
  }

  // 普通节点的预览
  const getPreviewStyle = () => {
    const baseStyle: React.CSSProperties = {
      width: Math.min(node.width / 2, 40),
      height: Math.min(node.height / 2, 40),
      border: `2px solid ${node.attrs?.body?.stroke || '#5F95FF'}`,
      backgroundColor: node.attrs?.body?.fill || '#EFF4FF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s',
    }

    // 根据形状设置样式
    switch (node.shape) {
      case 'circle':
        return { ...baseStyle, borderRadius: '50%' }
      case 'ellipse':
        return { ...baseStyle, borderRadius: '50%' }
      case 'polygon':
        return {
          ...baseStyle,
          transform: 'rotate(45deg)',
          borderRadius: '4px',
        }
      case 'rect':
      default:
        return {
          ...baseStyle,
          borderRadius: node.attrs?.body?.rx ? `${node.attrs.body.rx}px` : '6px',
        }
    }
  }

  return <div style={getPreviewStyle()} />
}

const Sider: React.FC<SiderProps> = ({ graph, dnd }) => {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(nodeGroups.map((g) => g.id))) // 默认全部展开
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // 等待客户端挂载
  useEffect(() => {
    setMounted(true)
  }, [])

  // 切换分组展开/折叠状态
  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  // 开始拖拽
  const startDrag = (nodeConfig: NodeConfig, e: React.MouseEvent<HTMLDivElement>) => {
    if (!graph || !dnd) return

    // 创建节点配置
    const nodeOptions: any = {
      shape: nodeConfig.shape,
      width: nodeConfig.width,
      height: nodeConfig.height,
      attrs: nodeConfig.attrs,
      ports: nodeConfig.ports,
    }

    // 如果节点有 data 属性（React 组件节点），添加到配置中
    if ((nodeConfig as any).data) {
      nodeOptions.data = (nodeConfig as any).data
    }

    // 创建节点
    const node = graph.createNode(nodeOptions)

    // 开始拖拽
    dnd.start(node, e.nativeEvent)
  }

  // 在客户端挂载前不渲染依赖主题的样式
  if (!mounted) {
    return (
      <div className="h-full border-r overflow-y-auto custom-scrollbar" style={{ width: '240px' }}>
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-4">节点库</h3>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-full border-r overflow-y-auto custom-scrollbar"
      style={{
        width: '240px',
        backgroundColor: isDark ? '#1a1a1f' : '#fafafa',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e5e5',
      }}
    >
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">节点库</h3>

        {nodeGroups.map((group) => (
          <Collapsible
            key={group.id}
            open={openGroups.has(group.id)}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-md hover:bg-accent transition-colors group">
              <span className="text-sm font-medium text-foreground">{group.title}</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  openGroups.has(group.id) ? 'transform rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>

            <CollapsibleContent className="pt-2">
              <div className="grid grid-cols-2 gap-2 px-2">
                {group.nodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border cursor-move hover:border-primary hover:shadow-lg hover:scale-105 transition-all duration-200 group"
                    style={{
                      backgroundColor: isDark ? '#262626' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e5e5',
                      minHeight: '90px',
                    }}
                    onMouseDown={(e) => startDrag(node, e)}
                  >
                    {/* 节点预览 */}
                    <div className="mb-2 group-hover:scale-110 transition-transform duration-200">
                      <NodePreview node={node} />
                    </div>

                    {/* 节点标签 */}
                    <span className="text-xs text-center text-foreground font-medium">
                      {node.label}
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  )
}

export default Sider
