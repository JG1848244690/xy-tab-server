import { Graph, Snapline, Selection, Clipboard, Keyboard, Transform, Dnd } from '@antv/x6'
import type { Node } from '@antv/x6'

/**
 * Graph 配置选项
 */
export interface GraphConfig {
  container: HTMLDivElement
  isDark?: boolean
}

/**
 * 创建 Graph 实例
 */
export function createGraphInstance({ container, isDark = false }: GraphConfig): Graph {
  return new Graph({
    container,
    width: container.clientWidth,
    height: container.clientHeight,
    // 设置画布背景颜色
    background: {
      color: isDark ? '#0f0f14' : '#ffffff',
    },
    grid: {
      size: 20,
      visible: true,
      type: 'dot', // 使用点状网格
      args: {
        color: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e5e5', // 网格颜色
        thickness: 2, // 网格点大小
      },
    },
    // 右键拖拽平移画布
    panning: {
      enabled: true,
      eventTypes: ['rightMouseDown'], // 只允许右键拖拽
    },
    // 禁用画布的默认拖拽手势
    preventDefaultBlankAction: false,
    // 滚轮缩放
    mousewheel: {
      enabled: true,
    },
    // 启用交互
    interacting: {
      nodeMovable: true, // 节点可移动
    },
    // 连接配置
    connecting: {
      snap: true, // 自动吸附
      allowBlank: false, // 不允许连接到空白位置
      allowLoop: true, // 允许自环
      allowNode: true, // 允许连接到节点
      allowEdge: false, // 不允许连接到边
      allowPort: true, // 允许连接到连接桩
      highlight: true, // 高亮显示可用的连接桩
      connector: 'rounded', // 圆角连接线
      router: {
        name: 'manhattan', // 曼哈顿路由
        args: {
          padding: 10,
        },
      },
      createEdge() {
        return this.createEdge({
          attrs: {
            line: {
              stroke: '#8f8f8f',
              strokeWidth: 2,
              targetMarker: {
                name: 'classic',
                size: 8,
              },
            },
          },
          zIndex: 0,
        })
      },
      validateConnection({ sourceView, targetView, sourceMagnet, targetMagnet }) {
        // 不能连接自己
        if (sourceView === targetView) {
          return false
        }
        // 必须连接到连接桩
        if (!sourceMagnet || !targetMagnet) {
          return false
        }
        return true
      },
    },
  })
}

/**
 * 创建 Dnd 实例
 */
export function createDndInstance(graph: Graph): Dnd {
  return new Dnd({
    target: graph,
    scaled: false,
  })
}

/**
 * 更新 Graph 主题
 */
export function updateGraphTheme(graph: Graph, isDark: boolean) {
  // 更新背景颜色
  graph.drawBackground({
    color: isDark ? '#0f0f14' : '#ffffff',
  })

  // 更新网格颜色
  graph.drawGrid({
    type: 'dot',
    args: {
      color: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e5e5',
      thickness: 2,
    },
  })
}

/**
 * 设置 ResizeObserver 监听容器尺寸变化
 */
export function setupResizeObserver(
  container: HTMLDivElement,
  graphRef: React.MutableRefObject<Graph | null>
): any {
  // eslint-disable-next-line no-undef
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      if (graphRef.current && width > 0 && height > 0) {
        graphRef.current.resize(width, height)
      }
    }
  })

  resizeObserver.observe(container)
  return resizeObserver
}

/**
 * 注册 Graph 插件
 */
export function registerGraphPlugins(graph: Graph) {
  // 使用对齐线插件
  graph.use(
    new Snapline({
      enabled: true,
    })
  )

  // 使用选择插件
  graph.use(
    new Selection({
      enabled: true,
      multiple: true, // 允许多选
      rubberband: true, // 启用框选
      movable: true, // 选中的节点可以移动
      showNodeSelectionBox: true, // 显示节点选择框
      rubberEdge: true,
      rubberNode: true,
      strict: false,
      selectCellOnMoved: true, // 移动后保持选中状态
    })
  )

  // 使用剪贴板插件
  graph.use(
    new Clipboard({
      enabled: true,
      useLocalStorage: true,
    })
  )

  // 使用键盘插件
  graph.use(
    new Keyboard({
      enabled: true,
      global: true,
    })
  )

  // 使用 Transform 插件（调整节点大小）
  graph.use(
    new Transform({
      resizing: {
        enabled: true,
        minWidth: 40,
        maxWidth: 400,
        minHeight: 30,
        maxHeight: 300,
        orthogonal: false, // 是否显示正交调整手柄
        restrict: false, // 是否限制在父节点内
        preserveAspectRatio: false, // 是否保持宽高比
      },
      rotating: {
        enabled: true, // 启用旋转
        grid: 15, // 旋转角度的步进
      },
    })
  )
}

/**
 * 绑定节点样式相关事件
 */
export function bindNodeStyleEvents(graph: Graph) {
  // 配置节点选中样式
  graph.on('node:selected', ({ node }) => {
    node.attr('body/stroke', '#1890FF')
    node.attr('body/strokeWidth', 3)
  })

  graph.on('node:unselected', ({ node }) => {
    // 恢复原始样式
    const originalAttrs = node.getData()?.originalAttrs
    if (originalAttrs?.body) {
      node.attr('body/stroke', originalAttrs.body.stroke || '#5F95FF')
      node.attr('body/strokeWidth', originalAttrs.body.strokeWidth || 1)
    }
  })
}

/**
 * 绑定节点变换事件（调整大小、旋转）
 */
export function bindNodeTransformEvents(graph: Graph) {
  // 监听节点调整大小事件
  graph.on('node:resizing', ({ node }) => {
    const size = node.size()
    console.log('节点调整大小中:', node.id, size)
  })

  graph.on('node:resized', ({ node }) => {
    const size = node.size()
    console.log('节点调整大小完成:', node.id, size)
  })

  // 监听节点旋转事件
  graph.on('node:rotating', ({ node }) => {
    const angle = node.angle()
    console.log('节点旋转中:', node.id, angle)
  })

  graph.on('node:rotated', ({ node }) => {
    const angle = node.angle()
    console.log('节点旋转完成:', node.id, angle)
  })
}

/**
 * 绑定节点交互事件（点击、添加）
 */
export function bindNodeInteractionEvents(graph: Graph) {
  // 点击节点选中（使用 mousedown 事件，在 Selection 插件之前触发）
  graph.on('node:mousedown', ({ node, e }) => {
    // 如果没有按住 Ctrl/Cmd 键，则清除其他选中
    if (!e.ctrlKey && !e.metaKey) {
      graph.cleanSelection()
      graph.select(node)
    }
  })

  // 点击画布空白处取消选中
  graph.on('blank:mousedown', () => {
    graph.cleanSelection()
  })

  // 监听节点添加事件
  graph.on('node:added', ({ node }) => {
    console.log('节点已添加:', node.id, node.position())
    // 保存原始样式，用于恢复
    node.setData({
      originalAttrs: node.getAttrs(),
    })
  })
}

/**
 * 绑定连接桩显示/隐藏事件
 */
export function bindPortVisibilityEvents(graph: Graph) {
  // 鼠标移入节点时显示连接桩
  graph.on('node:mouseenter', ({ node }) => {
    const ports = node.getPorts()
    ports.forEach((port) => {
      node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible')
    })
  })

  // 鼠标移出节点时隐藏连接桩
  graph.on('node:mouseleave', ({ node }) => {
    const ports = node.getPorts()
    ports.forEach((port) => {
      node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden')
    })
  })
}

/**
 * 绑定边连接事件
 */
export function bindEdgeEvents(graph: Graph) {
  // 监听边的连接事件
  graph.on('edge:connected', ({ edge }) => {
    console.log('边已连接:', edge.id)
  })
}

/**
 * 绑定右键菜单事件
 */
export function bindContextMenuEvents(
  graph: Graph,
  callbacks: {
    onNodeContextMenu: (node: Node, x: number, y: number) => void
  }
) {
  graph.on('node:contextmenu', ({ node, e }) => {
    e.preventDefault() // 阻止浏览器默认右键菜单
    console.log('右键监听:', node)
    callbacks.onNodeContextMenu(node, e.clientX, e.clientY)
  })
}

/**
 * 绑定双击编辑事件
 */
export function bindNodeEditEvents(
  graph: Graph,
  containerRef: React.RefObject<HTMLDivElement | null>,
  callbacks: {
    onStartEdit: (node: Node, value: string, position: { x: number; y: number }) => void
  }
) {
  graph.on('node:dblclick', ({ node }) => {
    // 检查是否是 React 组件节点
    const shape = node.shape
    const isReactNode = [
      'linked-list-node',
      'array-node',
      'binary-tree-node',
      'stack-node',
      'hash-node',
      'pointer-marker',
    ].includes(shape)

    let currentValue = ''

    if (isReactNode) {
      // ===== React 组件节点的数据读取 =====
      const data = node.getData() // 获取节点的 data 对象

      // 根据不同类型，从 data 中提取不同的字段
      if (shape === 'linked-list-node') {
        currentValue = data?.value || 'val'
      } else if (shape === 'array-node') {
        currentValue = data?.items?.join(',') || '0,1,2,3,4'
      } else if (shape === 'binary-tree-node') {
        currentValue = data?.value || '1'
      } else if (shape === 'stack-node') {
        currentValue = data?.items?.join(',') || 'top,item2,item3'
      } else if (shape === 'hash-node') {
        currentValue = `${data?.key || 'key'}:${data?.value || 'value'}`
      } else if (shape === 'pointer-marker') {
        currentValue = data?.label || 'ptr'
      }
    } else {
      // 普通节点，编辑 label
      const currentLabel = node.attr('label/text')
      currentValue = typeof currentLabel === 'string' ? currentLabel : ''
    }

    // 获取节点在画布中的位置
    const bbox = node.getBBox()
    const graphContainer = containerRef.current
    if (graphContainer) {
      const position = {
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2,
      }
      callbacks.onStartEdit(node, currentValue, position)
    }
  })
}

/**
 * 绑定快捷键
 */
export function bindKeyboardShortcuts(graph: Graph) {
  // 绑定快捷键：复制
  graph.bindKey('ctrl+c', () => {
    const cells = graph.getSelectedCells()
    if (cells.length) {
      graph.copy(cells)
      console.log('已复制节点:', cells.length)
    }
    return false
  })

  // 绑定快捷键：粘贴
  graph.bindKey('ctrl+v', () => {
    if (!graph.isClipboardEmpty()) {
      const cells = graph.paste({ offset: 32 })
      graph.cleanSelection()
      graph.select(cells)
      console.log('已粘贴节点:', cells.length)
    }
    return false
  })

  // 绑定快捷键：删除
  graph.bindKey(['delete', 'backspace'], () => {
    const cells = graph.getSelectedCells()
    if (cells.length) {
      graph.removeCells(cells)
      console.log('已删除节点:', cells.length)
    }
    return false
  })

  // 绑定快捷键：全选
  graph.bindKey('ctrl+a', () => {
    const nodes = graph.getNodes()
    if (nodes.length) {
      graph.select(nodes)
      console.log('已全选节点:', nodes.length)
    }
    return false
  })

  // 绑定快捷键：撤销
  graph.bindKey('ctrl+z', () => {
    if (graph.canUndo()) {
      graph.undo()
      console.log('撤销操作')
    }
    return false
  })

  // 绑定快捷键：重做
  graph.bindKey('ctrl+y', () => {
    if (graph.canRedo()) {
      graph.redo()
      console.log('重做操作')
    }
    return false
  })
}

/**
 * 初始化所有事件和插件
 */
export function initializeGraphFeatures(
  graph: Graph,
  containerRef: React.RefObject<HTMLDivElement | null>,
  callbacks: {
    onNodeContextMenu: (node: Node, x: number, y: number) => void
    onStartEdit: (node: Node, value: string, position: { x: number; y: number }) => void
  }
) {
  // 注册插件
  registerGraphPlugins(graph)

  // 绑定所有事件
  bindNodeStyleEvents(graph)
  bindNodeTransformEvents(graph)
  bindNodeInteractionEvents(graph)
  bindPortVisibilityEvents(graph)
  bindEdgeEvents(graph)
  bindContextMenuEvents(graph, { onNodeContextMenu: callbacks.onNodeContextMenu })
  bindNodeEditEvents(graph, containerRef, { onStartEdit: callbacks.onStartEdit })
  bindKeyboardShortcuts(graph)
}
