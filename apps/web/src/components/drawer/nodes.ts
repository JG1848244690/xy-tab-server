// 节点配置类型
export interface NodeConfig {
  id: string
  label: string
  shape: string
  width: number
  height: number
  attrs?: any
  ports?: any
  data?: any // 添加 data 属性，用于 React 组件节点
}

// 节点组类型
export interface NodeGroup {
  id: string
  title: string
  nodes: NodeConfig[]
}

// 定义连接桩组
const portGroups = {
  top: {
    position: 'top',
    attrs: {
      circle: {
        r: 4,
        magnet: true,
        stroke: '#5F95FF',
        strokeWidth: 1,
        fill: '#fff',
        style: {
          visibility: 'hidden',
        },
      },
    },
  },
  right: {
    position: 'right',
    attrs: {
      circle: {
        r: 4,
        magnet: true,
        stroke: '#5F95FF',
        strokeWidth: 1,
        fill: '#fff',
        style: {
          visibility: 'hidden',
        },
      },
    },
  },
  bottom: {
    position: 'bottom',
    attrs: {
      circle: {
        r: 4,
        magnet: true,
        stroke: '#5F95FF',
        strokeWidth: 1,
        fill: '#fff',
        style: {
          visibility: 'hidden',
        },
      },
    },
  },
  left: {
    position: 'left',
    attrs: {
      circle: {
        r: 4,
        magnet: true,
        stroke: '#5F95FF',
        strokeWidth: 1,
        fill: '#fff',
        style: {
          visibility: 'hidden',
        },
      },
    },
  },
}

// 定义连接桩配置
const ports = {
  groups: portGroups,
  items: [
    { id: 'top', group: 'top' },
    { id: 'right', group: 'right' },
    { id: 'bottom', group: 'bottom' },
    { id: 'left', group: 'left' },
  ],
}

// 预设节点配置
export const nodeGroups: NodeGroup[] = [
  {
    id: 'basic',
    title: '基础节点',
    nodes: [
      {
        id: 'rect',
        label: '矩形',
        shape: 'rect',
        width: 100,
        height: 40,
        attrs: {
          body: {
            stroke: '#5F95FF',
            strokeWidth: 1,
            fill: '#EFF4FF',
            rx: 6,
            ry: 6,
          },
          label: {
            text: '矩形',
            fill: '#262626',
            fontSize: 14,
          },
        },
        ports,
      },
      {
        id: 'circle',
        label: '圆形',
        shape: 'circle',
        width: 60,
        height: 60,
        attrs: {
          body: {
            stroke: '#5F95FF',
            strokeWidth: 1,
            fill: '#EFF4FF',
          },
          label: {
            text: '圆形',
            fill: '#262626',
            fontSize: 14,
          },
        },
        ports,
      },
      {
        id: 'ellipse',
        label: '椭圆',
        shape: 'ellipse',
        width: 100,
        height: 60,
        attrs: {
          body: {
            stroke: '#5F95FF',
            strokeWidth: 1,
            fill: '#EFF4FF',
          },
          label: {
            text: '椭圆',
            fill: '#262626',
            fontSize: 14,
          },
        },
        ports,
      },
      {
        id: 'polygon',
        label: '菱形',
        shape: 'polygon',
        width: 80,
        height: 80,
        attrs: {
          body: {
            stroke: '#5F95FF',
            strokeWidth: 1,
            fill: '#EFF4FF',
            refPoints: '0,10 10,0 20,10 10,20',
          },
          label: {
            text: '菱形',
            fill: '#262626',
            fontSize: 14,
          },
        },
        ports,
      },
    ],
  },
  //   {
  //     id: 'flowchart',
  //     title: '流程图',
  //     nodes: [
  //       {
  //         id: 'start',
  //         label: '开始',
  //         shape: 'ellipse',
  //         width: 100,
  //         height: 50,
  //         attrs: {
  //           body: {
  //             stroke: '#52C41A',
  //             strokeWidth: 2,
  //             fill: '#F6FFED',
  //           },
  //           label: {
  //             text: '开始',
  //             fill: '#262626',
  //             fontSize: 14,
  //           },
  //         },
  //         ports,
  //       },
  //       {
  //         id: 'process',
  //         label: '处理',
  //         shape: 'rect',
  //         width: 100,
  //         height: 50,
  //         attrs: {
  //           body: {
  //             stroke: '#1890FF',
  //             strokeWidth: 2,
  //             fill: '#E6F7FF',
  //             rx: 4,
  //             ry: 4,
  //           },
  //           label: {
  //             text: '处理',
  //             fill: '#262626',
  //             fontSize: 14,
  //           },
  //         },
  //         ports,
  //       },
  //       {
  //         id: 'decision',
  //         label: '判断',
  //         shape: 'polygon',
  //         width: 100,
  //         height: 60,
  //         attrs: {
  //           body: {
  //             stroke: '#FAAD14',
  //             strokeWidth: 2,
  //             fill: '#FFFBE6',
  //             refPoints: '0,10 10,0 20,10 10,20',
  //           },
  //           label: {
  //             text: '判断',
  //             fill: '#262626',
  //             fontSize: 14,
  //           },
  //         },
  //         ports,
  //       },
  //       {
  //         id: 'end',
  //         label: '结束',
  //         shape: 'ellipse',
  //         width: 100,
  //         height: 50,
  //         attrs: {
  //           body: {
  //             stroke: '#FF4D4F',
  //             strokeWidth: 2,
  //             fill: '#FFF1F0',
  //           },
  //           label: {
  //             text: '结束',
  //             fill: '#262626',
  //             fontSize: 14,
  //           },
  //         },
  //         ports,
  //       },
  //     ],
  //   },
  {
    id: 'reactComponents',
    title: 'React组件',
    nodes: [
      {
        id: 'linkedListNode',
        label: '链表节点',
        shape: 'linked-list-node',
        width: 100,
        height: 40,
        data: {
          value: 'val',
          next: 'next',
        },
      },
      {
        id: 'arrayNode',
        label: '数组',
        shape: 'array-node',
        width: 250,
        height: 50,
        data: {
          items: ['0', '1', '2', '3', '4'],
          highlight: [],
        },
      },
      {
        id: 'binaryTreeNode',
        label: '二叉树节点',
        shape: 'binary-tree-node',
        width: 50,
        height: 50,
        data: {
          value: '1',
          highlight: false,
        },
      },
      {
        id: 'stackNode',
        label: '栈',
        shape: 'stack-node',
        width: 80,
        height: 120,
        data: {
          items: ['top', 'item2', 'item3'],
        },
      },
      {
        id: 'pointerMarker',
        label: '指针标记',
        shape: 'pointer-marker',
        width: 40,
        height: 40,
        data: {
          label: 'ptr',
          color: 'blue',
        },
      },
    ],
  },
]

// 导出连接桩配置供外部使用
export { ports, portGroups }
