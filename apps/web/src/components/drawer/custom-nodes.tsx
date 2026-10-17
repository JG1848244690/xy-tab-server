import React from 'react'
import { Graph } from '@antv/x6'
import { register } from '@antv/x6-react-shape'

// 链表节点组件
export const LinkedListNode = ({ node }: { node: any }) => {
  const data = node.getData() || {}
  const value = data.value || 'val'
  const next = data.next || 'next'

  return (
    <div className="flex h-full w-full items-center border-2 border-blue-500 bg-blue-50">
      <div className="flex-1 border-r-2 border-blue-500 text-center font-semibold">{value}</div>
      <div className="flex-1 text-center text-xs text-gray-600">{next}</div>
    </div>
  )
}

// 数组节点组件
export const ArrayNode = ({ node }: { node: any }) => {
  const data = node.getData() || {}
  const items = data.items || ['0', '1', '2', '3', '4']
  const highlight = data.highlight || []

  return (
    <div className="flex h-full w-full gap-0.5">
      {items.map((item: string, index: number) => (
        <div
          key={index}
          className={`flex flex-1 items-center justify-center border-2 text-sm font-semibold ${
            highlight.includes(index)
              ? 'border-red-500 bg-red-100 text-red-700'
              : 'border-purple-500 bg-purple-50 text-purple-700'
          }`}
        >
          {item}
        </div>
      ))}
    </div>
  )
}

// 二叉树节点组件
export const BinaryTreeNode = ({ node }: { node: any }) => {
  const data = node.getData() || {}
  const value = data.value || '1'
  const isHighlight = data.highlight || false

  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded-full border-3 text-lg font-bold ${
        isHighlight
          ? 'border-yellow-500 bg-yellow-100 text-yellow-700'
          : 'border-green-500 bg-green-50 text-green-700'
      }`}
    >
      {value}
    </div>
  )
}

// 栈节点组件
export const StackNode = ({ node }: { node: any }) => {
  const data = node.getData() || {}
  const items = data.items || ['top', 'item2', 'item3']

  return (
    <div className="flex h-full w-full flex-col gap-0.5">
      {items.map((item: string, index: number) => (
        <div
          key={index}
          className={`flex flex-1 items-center justify-center border-2 text-xs font-semibold ${
            index === 0
              ? 'border-orange-500 bg-orange-100 text-orange-700'
              : 'border-orange-400 bg-orange-50 text-orange-600'
          }`}
        >
          {item}
        </div>
      ))}
    </div>
  )
}

// 哈希表节点组件
export const HashNode = ({ node }: { node: any }) => {
  const data = node.getData() || {}
  const key = data.key || 'key'
  const value = data.value || 'value'

  return (
    <div className="flex h-full w-full flex-col border-2 border-pink-500 bg-pink-50">
      <div className="flex-1 border-b border-pink-300 px-2 text-xs font-semibold text-pink-700">
        {key}
      </div>
      <div className="flex-1 px-2 text-xs text-pink-600">{value}</div>
    </div>
  )
}

// 指针标记组件
export const PointerMarker = ({ node }: { node: any }) => {
  const data = node.getData() || {}
  const label = data.label || 'ptr'
  const color = data.color || 'blue'

  const colorClasses = {
    blue: 'bg-blue-500 text-white',
    red: 'bg-red-500 text-white',
    green: 'bg-green-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    purple: 'bg-purple-500 text-white',
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded-full text-xs font-bold ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`}
    >
      {label}
    </div>
  )
}

// 注册自定义节点到 Graph
export const registerCustomNodes = (graph: Graph) => {
  // 注册链表节点
  register({
    shape: 'linked-list-node',
    width: 100,
    height: 40,
    component: LinkedListNode,
    ports: {
      groups: {
        left: {
          position: 'left',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#1890FF',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
        right: {
          position: 'right',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#1890FF',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
      },
      items: [
        { id: 'left', group: 'left' },
        { id: 'right', group: 'right' },
      ],
    },
  })

  // 注册数组节点
  register({
    shape: 'array-node',
    width: 250,
    height: 50,
    component: ArrayNode,
    ports: {
      groups: {
        top: {
          position: 'top',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#722ED1',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
        bottom: {
          position: 'bottom',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#722ED1',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
      },
      items: [
        { id: 'top', group: 'top' },
        { id: 'bottom', group: 'bottom' },
      ],
    },
  })

  // 注册二叉树节点
  register({
    shape: 'binary-tree-node',
    width: 50,
    height: 50,
    component: BinaryTreeNode,
    ports: {
      groups: {
        top: {
          position: 'top',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#52C41A',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
        left: {
          position: 'left',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#52C41A',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
        right: {
          position: 'right',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#52C41A',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
        bottom: {
          position: 'bottom',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#52C41A',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
      },
      items: [
        { id: 'top', group: 'top' },
        { id: 'left', group: 'left' },
        { id: 'right', group: 'right' },
        { id: 'bottom', group: 'bottom' },
      ],
    },
  })

  // 注册栈节点
  register({
    shape: 'stack-node',
    width: 80,
    height: 120,
    component: StackNode,
    ports: {
      groups: {
        top: {
          position: 'top',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#FA8C16',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
        bottom: {
          position: 'bottom',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#FA8C16',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
      },
      items: [
        { id: 'top', group: 'top' },
        { id: 'bottom', group: 'bottom' },
      ],
    },
  })

  // 注册哈希表节点
  register({
    shape: 'hash-node',
    width: 80,
    height: 50,
    component: HashNode,
    ports: {
      groups: {
        left: {
          position: 'left',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#EB2F96',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
        right: {
          position: 'right',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#EB2F96',
              strokeWidth: 1,
              fill: '#fff',
              style: { visibility: 'hidden' },
            },
          },
        },
      },
      items: [
        { id: 'left', group: 'left' },
        { id: 'right', group: 'right' },
      ],
    },
  })

  // 注册指针标记
  register({
    shape: 'pointer-marker',
    width: 40,
    height: 40,
    component: PointerMarker,
  })
}
