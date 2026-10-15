# Drawer 组件 Wiki

## 概述

Drawer 是一个基于 AntV X6 的可视化绘图组件，专为代码学习场景设计。它提供了丰富的数据结构可视化节点（链表、数组、二叉树、栈、哈希表等），帮助开发者在编码过程中便捷地绘制图表，更好地理解算法和数据结构。

## 组件架构

```
/src/components/drawer/
├── index.tsx           # 组件入口，主要逻辑和状态管理
├── custom-nodes.tsx    # 自定义 React 组件节点定义
├── menu.tsx           # 右键菜单组件
├── nodes.ts           # 侧边栏节点配置
├── sider.tsx          # 自定义侧边栏
├── utils.tsx          # 图相关工具函数
└── README.md          # 本文档
```

---

## 核心设计逻辑

### 1. 组件入口 (`index.tsx`)

#### 1.1 状态管理

组件使用 React Hooks 管理多个关键状态：

```typescript
// 核心实例引用
const graphRef = useRef<Graph | null>(null)      // X6 Graph 实例
const dndRef = useRef<Dnd | null>(null)          // 拖拽实例
const containerRef = useRef<HTMLDivElement>(null) // 画布容器
const wrapperRef = useRef<HTMLDivElement>(null)   // 外层容器

// 状态
const [graph, setGraph] = useState<Graph | null>(null)
const [dnd, setDnd] = useState<Dnd | null>(null)
const [mounted, setMounted] = useState(false)     // 客户端挂载标志

// 编辑相关状态
const [editingNode, setEditingNode] = useState<Node | null>(null)
const [editValue, setEditValue] = useState('')
const [editPosition, setEditPosition] = useState({ x: 0, y: 0 })

// 右键菜单状态
const [contextMenuNode, setContextMenuNode] = useState<Node | null>(null)
const [contextMenuVisible, setContextMenuVisible] = useState(false)
const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
```

#### 1.2 生命周期管理

**阶段 1: 客户端挂载检测**
```typescript
useEffect(() => {
  setMounted(true)
}, [])
```
- 确保组件在客户端环境下运行（Next.js SSR 兼容）

**阶段 2: Graph 初始化**
```typescript
useEffect(() => {
  if (!containerRef.current || !wrapperRef.current || !mounted) return

  // 1. 创建 Graph 实例
  const graphInstance = createGraphInstance({
    container: containerRef.current,
    isDark: resolvedTheme === 'dark',
  })

  // 2. 注册自定义 React 组件节点
  registerCustomNodes(graphInstance)

  // 3. 初始化插件和事件
  initializeGraphFeatures(graphInstance, containerRef, {
    onNodeContextMenu: (node, x, y) => { /* 右键菜单回调 */ },
    onStartEdit: (node, value, position) => { /* 编辑回调 */ },
  })

  // 4. 创建拖拽实例
  const dndInstance = createDndInstance(graphInstance)

  // 5. 监听容器尺寸变化
  const resizeObserver = setupResizeObserver(wrapperRef.current, graphRef)

  // 6. 清理函数
  return () => {
    resizeObserver.disconnect()
    if (graphRef.current) {
      const graphToDispose = graphRef.current
      // 延迟到下一个事件循环，避免 React 渲染期间卸载导致的竞态条件
      setTimeout(() => {
        graphToDispose.dispose()
      }, 0)
    }
  }
}, [mounted, resolvedTheme])
```

**阶段 3: 主题切换**
```typescript
useEffect(() => {
  if (!graph || !mounted) return
  updateGraphTheme(graph, resolvedTheme === 'dark')
}, [resolvedTheme, graph, mounted])
```

#### 1.3 交互功能

**双击编辑节点**
- 支持普通节点和 React 组件节点的编辑
- 根据节点类型提供不同的编辑提示
- 支持 Enter 保存、Escape 取消

**右键菜单**
- 删除节点
- 复制节点
- 可扩展更多操作

---

### 2. 工具函数 (`utils.tsx`)

#### 2.1 Graph 实例创建

```typescript
export function createGraphInstance({ container, isDark }: GraphConfig): Graph {
  return new Graph({
    container,
    width: container.clientWidth,
    height: container.clientHeight,
    background: {
      color: isDark ? '#0f0f14' : '#ffffff',
    },
    grid: {
      size: 20,
      visible: true,
      type: 'dot',
      args: {
        color: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e5e5',
        thickness: 2,
      },
    },
    panning: {
      enabled: true,
      eventTypes: ['rightMouseDown'], // 右键拖拽画布
    },
    mousewheel: {
      enabled: true, // 滚轮缩放
    },
    connecting: {
      snap: true,
      allowBlank: false,
      allowLoop: true,
      connector: 'rounded',
      router: { name: 'manhattan' },
      // ... 连接配置
    },
  })
}
```

#### 2.2 插件注册

```typescript
export function registerGraphPlugins(graph: Graph) {
  // 对齐线插件
  graph.use(new Snapline({ enabled: true }))
  
  // 选择插件（支持多选、框选）
  graph.use(new Selection({
    enabled: true,
    multiple: true,
    rubberband: true,
    movable: true,
  }))
  
  // 剪贴板插件
  graph.use(new Clipboard({ enabled: true }))
  
  // 键盘插件
  graph.use(new Keyboard({ enabled: true, global: true }))
  
  // Transform 插件（调整大小、旋转）
  graph.use(new Transform({
    resizing: { enabled: true },
    rotating: { enabled: true },
  }))
}
```

#### 2.3 事件绑定

**节点样式事件**
- `node:selected` - 选中时高亮边框
- `node:unselected` - 取消选中时恢复样式

**连接桩显示/隐藏**
- `node:mouseenter` - 鼠标移入显示连接桩
- `node:mouseleave` - 鼠标移出隐藏连接桩

**快捷键**
- `Ctrl+C` - 复制
- `Ctrl+V` - 粘贴
- `Delete/Backspace` - 删除
- `Ctrl+A` - 全选
- `Ctrl+Z` - 撤销
- `Ctrl+Y` - 重做

---

### 3. 自定义节点 (`custom-nodes.tsx`)

#### 3.1 React 组件节点

使用 `@antv/x6-react-shape` 的 `register` 函数注册自定义 React 组件节点：

```typescript
register({
  shape: 'linked-list-node',
  width: 100,
  height: 40,
  component: LinkedListNode,
  ports: {
    groups: { left: {...}, right: {...} },
    items: [
      { id: 'left', group: 'left' },
      { id: 'right', group: 'right' },
    ],
  },
})
```

#### 3.2 数据结构节点

**链表节点 (`LinkedListNode`)**
```typescript
const LinkedListNode = ({ node }: { node: any }) => {
  const data = node.getData() || {}
  const value = data.value || 'val'
  const next = data.next || 'next'
  
  return (
    <div className="flex h-full w-full items-center border-2 border-blue-500 bg-blue-50">
      <div className="flex-1 border-r-2 border-blue-500 text-center font-semibold">
        {value}
      </div>
      <div className="flex-1 text-center text-xs text-gray-600">{next}</div>
    </div>
  )
}
```

**数组节点 (`ArrayNode`)**
- 支持多个元素显示
- 支持高亮特定索引

**二叉树节点 (`BinaryTreeNode`)**
- 圆形显示
- 支持高亮状态

**栈节点 (`StackNode`)**
- 垂直布局
- 顶部元素高亮


**指针标记 (`PointerMarker`)**
- 小圆形标记
- 支持多种颜色

---

### 4. 侧边栏 (`sider.tsx`)

#### 4.1 节点库展示

```typescript
const Sider: React.FC<SiderProps> = ({ graph, dnd }) => {
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(nodeGroups.map((g) => g.id)) // 默认全部展开
  )
  
  // 使用 Collapsible 组件实现折叠面板
  return (
    <div className="h-full border-r overflow-y-auto">
      {nodeGroups.map((group) => (
        <Collapsible key={group.id} open={openGroups.has(group.id)}>
          <CollapsibleTrigger>{group.title}</CollapsibleTrigger>
          <CollapsibleContent>
            {group.nodes.map((node) => (
              <div onMouseDown={(e) => startDrag(node, e)}>
                <NodePreview node={node} />
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}
```

#### 4.2 拖拽实现

```typescript
const startDrag = (nodeConfig: NodeConfig, e: React.MouseEvent<HTMLDivElement>) => {
  if (!graph || !dnd) return

  const nodeOptions: any = {
    shape: nodeConfig.shape,
    width: nodeConfig.width,
    height: nodeConfig.height,
    attrs: nodeConfig.attrs,
    ports: nodeConfig.ports,
  }

  // React 组件节点需要传递 data
  if (nodeConfig.data) {
    nodeOptions.data = nodeConfig.data
  }

  const node = graph.createNode(nodeOptions)
  dnd.start(node, e.nativeEvent)
}
```

#### 4.3 节点预览

为每种节点类型提供缩略预览：
- React 组件节点：使用简化版组件渲染
- 普通节点：根据 shape 和 attrs 动态生成样式

---

### 5. 右键菜单 (`menu.tsx`)

#### 5.1 Portal 渲染

使用 `createPortal` 将菜单渲染到 `document.body`，避免父元素 `transform` 等 CSS 属性导致的定位问题：

```typescript
export function ContextMenuBasic({ visible, x, y, menuGroups, node, graph, onClose }) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<MenuPosition>({ left: x, top: y })

  // 计算最佳位置，避免超出视口
  useEffect(() => {
    if (!visible || !menuRef.current) return
    const menuRect = menuRef.current.getBoundingClientRect()
    const newPosition = calculateMenuPosition(x, y, menuRect.width, menuRect.height)
    setPosition(newPosition)
  }, [visible, x, y])

  const menuContent = (
    <div ref={menuRef} className="fixed z-50" style={{ left, top }}>
      {/* 菜单内容 */}
    </div>
  )

  return createPortal(menuContent, document.body)
}
```

#### 5.2 动态定位

```typescript
function calculateMenuPosition(mouseX, mouseY, menuWidth, menuHeight): MenuPosition {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  let left = mouseX
  let top = mouseY

  // 右侧空间不足，显示在左侧
  if (mouseX + menuWidth > viewportWidth) {
    left = mouseX - menuWidth
  }

  // 下方空间不足，显示在上方
  if (mouseY + menuHeight > viewportHeight) {
    top = mouseY - menuHeight
  }

  return { left: Math.max(4, left), top: Math.max(4, top) }
}
```

#### 5.3 交互处理

- 点击外部关闭菜单
- ESC 键关闭菜单
- 点击菜单项执行操作并关闭

---

### 6. 节点配置 (`nodes.ts`)

#### 6.1 配置结构

```typescript
export interface NodeConfig {
  id: string
  label: string
  shape: string
  width: number
  height: number
  attrs?: any    // 普通节点的样式属性
  ports?: any    // 连接桩配置
  data?: any     // React 组件节点的数据
}

export interface NodeGroup {
  id: string
  title: string
  nodes: NodeConfig[]
}
```

#### 6.2 连接桩配置

```typescript
const portGroups = {
  top: {
    position: 'top',
    attrs: {
      circle: {
        r: 4,
        magnet: true,
        stroke: '#5F95FF',
        fill: '#fff',
        style: { visibility: 'hidden' }, // 默认隐藏
      },
    },
  },
  // right, bottom, left...
}

const ports = {
  groups: portGroups,
  items: [
    { id: 'top', group: 'top' },
    { id: 'right', group: 'right' },
    { id: 'bottom', group: 'bottom' },
    { id: 'left', group: 'left' },
  ],
}
```

#### 6.3 节点分组

```typescript
export const nodeGroups: NodeGroup[] = [
  {
    id: 'basic',
    title: '基础节点',
    nodes: [
      { id: 'rect', label: '矩形', shape: 'rect', ... },
      { id: 'circle', label: '圆形', shape: 'circle', ... },
      { id: 'ellipse', label: '椭圆', shape: 'ellipse', ... },
      { id: 'polygon', label: '菱形', shape: 'polygon', ... },
    ],
  },
  {
    id: 'reactComponents',
    title: 'React组件',
    nodes: [
      { id: 'linkedListNode', label: '链表节点', shape: 'linked-list-node', data: {...} },
      { id: 'arrayNode', label: '数组', shape: 'array-node', data: {...} },
      // ...
    ],
  },
]
```

---

## 核心特性

### 1. 主题支持

- 自动适配 Light/Dark 主题
- 背景色、网格色、边框色动态切换
- 使用 `next-themes` 管理主题状态

### 2. 响应式布局

- 使用 `ResizeObserver` 监听容器尺寸变化
- 自动调整画布大小
- 支持窗口缩放

### 3. 交互体验

- **拖拽添加节点**: 从侧边栏拖拽到画布
- **节点移动**: 直接拖拽节点
- **节点连接**: 拖拽连接桩创建连线
- **多选**: 框选或 Ctrl+点击
- **右键菜单**: 快捷操作
- **双击编辑**: 修改节点内容
- **快捷键**: 复制、粘贴、删除、撤销、重做

### 4. 性能优化

- 使用 `useRef` 避免不必要的重渲染
- 延迟 `dispose()` 调用避免竞态条件
- 连接桩按需显示/隐藏

---

## 使用示例

```tsx
import Drawer from '@/components/drawer'

export default function Page() {
  return (
    <div className="h-screen w-screen">
      <Drawer />
    </div>
  )
}
```

---

## 扩展指南

### 添加新的自定义节点

1. **在 `custom-nodes.tsx` 中定义组件**:
```typescript
export const MyCustomNode = ({ node }: { node: any }) => {
  const data = node.getData() || {}
  return <div>{/* 自定义渲染 */}</div>
}
```

2. **在 `registerCustomNodes` 中注册**:
```typescript
register({
  shape: 'my-custom-node',
  width: 100,
  height: 50,
  component: MyCustomNode,
  ports: { /* 连接桩配置 */ },
})
```

3. **在 `nodes.ts` 中添加配置**:
```typescript
{
  id: 'myCustomNode',
  label: '我的节点',
  shape: 'my-custom-node',
  width: 100,
  height: 50,
  data: { /* 初始数据 */ },
}
```

### 添加右键菜单项

在 `index.tsx` 的 `createMenuGroups` 函数中添加：

```typescript
{
  id: 'myAction',
  title: '我的操作',
  shortcut: '⌘M',
  onClick: (node, graph) => {
    // 自定义操作
  },
}
```

---

## 常见问题

### Q1: 切换页面时报错 "React cannot finish unmounting"

**原因**: 在 React 渲染期间同步调用 `dispose()` 导致竞态条件。

**解决**: 使用 `setTimeout` 延迟清理：
```typescript
setTimeout(() => {
  graphToDispose.dispose()
}, 0)
```

### Q2: 右键菜单位置偏移

**原因**: 父元素使用了 `transform`、`perspective`、`filter` 等 CSS 属性。

**解决**: 使用 `createPortal` 将菜单渲染到 `document.body`。

### Q3: 主题切换后节点样式不更新

**原因**: React 组件节点需要手动触发重渲染。

**解决**: 在主题切换时调用 `node.setData()` 强制更新。

### Q4: 为什么要自己封装侧边栏（Sider），而不使用 X6 的 Stencil 插件？

**原因**:

1. **样式和主题控制**
   - X6 的 Stencil 插件样式定制能力有限，难以完美适配项目的 Light/Dark 主题
   - 自定义侧边栏可以使用 Tailwind CSS 和 shadcn/ui 组件，保持与整体 UI 风格一致
   - 可以精确控制节点预览的渲染方式和交互效果

2. **可扩展性**
   - 自定义侧边栏可以轻松添加搜索、过滤、分类等功能
   - 可以为不同节点类型提供自定义的预览组件（如 `NodePreview`）
   - 支持折叠面板、拖拽排序等高级交互

3. **React 生态集成**
   - 使用 React Hooks 管理状态，与组件生命周期无缝集成
   - 可以使用 shadcn/ui 的 `Collapsible` 等组件，提供更好的用户体验
   - 更容易与其他 React 组件（如搜索框、筛选器）组合使用

**实现方式**:
```typescript
// 自定义拖拽逻辑
const startDrag = (nodeConfig: NodeConfig, e: React.MouseEvent) => {
  const node = graph.createNode(nodeOptions)
  dnd.start(node, e.nativeEvent)
}
```

### Q5: 为什么不使用 shadcn/ui 的 ContextMenu 组件，而是自己封装右键菜单？

**原因**:

1. **X6 阻止了默认右键菜单行为**
   - X6 在画布上监听了 `contextmenu` 事件并调用了 `e.preventDefault()`
   - shadcn/ui 的 `ContextMenu` 依赖浏览器原生的右键菜单事件机制
   - 由于事件被 X6 拦截，shadcn/ui 的 `ContextMenu` 无法正常触发

2. **需要手动控制菜单的显示和位置**
   - 必须通过 X6 的 `node:contextmenu` 事件监听右键点击
   - 需要手动获取鼠标位置（`e.clientX`, `e.clientY`）并传递给菜单组件
   - shadcn/ui 的 `ContextMenu` 是声明式的，不支持这种命令式的调用方式

3. **定位问题**
   - 画布容器可能使用了 `transform` 等 CSS 属性，导致 `fixed` 定位偏移
   - 自定义菜单使用 `createPortal` 渲染到 `document.body`，避免定位问题
   - 实现了智能定位算法，确保菜单不会超出视口边界

**实现方式**:
```typescript
// 监听 X6 的右键事件
graph.on('node:contextmenu', ({ node, e }) => {
  e.preventDefault()
  setContextMenuNode(node)
  setContextMenuVisible(true)
  setContextMenuPosition({ x: e.clientX, y: e.clientY })
})

// 使用 Portal 渲染菜单
return createPortal(menuContent, document.body)
```

---

## 技术亮点

1. **架构清晰**: 职责分离，每个文件专注一个功能
2. **类型安全**: 完整的 TypeScript 类型定义
3. **可扩展性**: 易于添加新节点和功能
4. **用户体验**: 丰富的交互和视觉反馈
5. **性能优化**: 合理使用 React Hooks 和事件监听
6. **主题适配**: 完美支持 Light/Dark 模式
7. **Portal 渲染**: 解决复杂布局下的定位问题

---

## 未来规划

- [ ] 支持节点分组
- [ ] 支持图表导出（PNG、SVG、JSON）
- [ ] 支持图表导入
- [ ] 添加更多数据结构节点（队列、图、堆等）
- [ ] 支持节点动画效果
- [ ] 支持撤销/重做历史记录面板
- [ ] 支持节点搜索和过滤
- [ ] 支持快捷键自定义

---

## 参考资料

- [AntV X6 官方文档](https://x6.antv.antgroup.com/)
- [React 官方文档](https://react.dev/)
- [Next.js 官方文档](https://nextjs.org/)
- [Tailwind CSS 官方文档](https://tailwindcss.com/)

---

**最后更新**: 2026-02-06
**维护者**: dxy
