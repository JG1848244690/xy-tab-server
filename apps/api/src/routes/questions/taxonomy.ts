/**
 * 三级标签分类器(2026-10-28)
 *
 * 每题:
 *   direction        方向:前端 / 后端 / 算法 / Agent / 计算机基础
 *   techStack        技术栈:Vue / React / JavaScript / TypeScript / HTML / CSS / 浏览器 / 工程化 / MySQL / Java / Redis / 数据结构 / LLM ...
 *   knowledgePoints  知识点:闭包 / 原型链 / 事件循环 / B+树 / 索引 ...(1-4 个)
 *
 * tags 继续保留:三者并集 + 旧标签,兼容旧的 tags @> 搜索和旧标签页。
 * 纯规则,不调 LLM。
 */

export const DIRECTIONS = ['前端', '后端', '算法', 'Agent', '计算机基础'] as const
export type Direction = (typeof DIRECTIONS)[number]

export const TECH_STACKS = [
    'JavaScript',
    'TypeScript',
    'Vue',
    'React',
    'HTML',
    'CSS',
    '浏览器',
    '工程化',
    'Node.js',
    'Java',
    'MySQL',
    'Redis',
    'Spring',
    '数据结构',
    'LLM',
    'RAG',
] as const
export type TechStack = (typeof TECH_STACKS)[number]

export const KNOWLEDGE_POINTS = [
    // JavaScript
    '闭包',
    '原型链',
    '事件循环',
    'Promise',
    '异步编程',
    'this',
    '手写实现',
    '数组方法',
    '类型转换',
    '元编程',
    '语言基础',
    '类型系统',
    // Vue / React
    '响应式原理',
    '生命周期',
    '组件通信',
    '路由',
    '状态管理',
    '渲染原理',
    '虚拟DOM',
    'Fiber',
    'Hooks',
    '框架基础',
    // HTML / CSS
    '布局',
    'BFC',
    '响应式布局',
    '图片优化',
    'HTML基础',
    // 浏览器 / 网络
    '浏览器缓存',
    '跨域',
    '存储',
    '安全',
    'HTTP',
    'HTTPS',
    'TCP',
    'DNS',
    'CDN',
    // 工程
    'Webpack',
    'Vite',
    'CI/CD',
    '工程化',
    '性能优化',
    // 后端
    '索引',
    'B+树',
    '事务',
    '锁',
    'JVM',
    'Spring',
    '数据库基础',
    // 算法
    '数据结构',
    '哈希表',
    '双指针',
    '滑动窗口',
    '二分查找',
    '排序',
    '递归',
    '动态规划',
    '图',
    // Agent
    'LLM',
    'RAG',
    'Function Calling',
    'Prompt',
    // 通用
    '设计模式',
] as const
export type KnowledgePoint = (typeof KNOWLEDGE_POINTS)[number]

const POINT_SET = new Set<string>(KNOWLEDGE_POINTS)
const STOP_TAGS = new Set(['hd', 'doc', '场景', '面试题', '前端面试'])

export interface ClassifyInput {
    title: string
    content?: string | null
    answer?: string | null
    tags?: string[] | null
    bankSlug?: string | null
}

export interface Classification {
    direction: Direction
    techStack: TechStack
    knowledgePoints: string[]
    /** 方向 + 技术栈 + 知识点 + 旧标签(旧标签用于兼容旧标签页) */
    tags: string[]
}

const includesTag = (tags: string[], ...names: string[]) => {
    const set = new Set(tags.map((t) => t.toLowerCase()))
    return names.some((n) => set.has(n.toLowerCase()))
}

function uniq<T>(arr: T[]): T[] {
    return [...new Set(arr)]
}

/** 知识点匹配规则:按顺序命中,最多 4 个 */
const POINT_RULES: Array<{ point: string; test: (text: string, tags: string[]) => boolean }> = [
    { point: '闭包', test: (t, tags) => includesTag(tags, '闭包') || /闭包|closure/i.test(t) },
    { point: '原型链', test: (t, tags) => includesTag(tags, '原型链') || /原型链|prototype|__proto__/i.test(t) },
    { point: '事件循环', test: (t, tags) => includesTag(tags, '事件循环') || /事件循环|宏任务|微任务|event\s*loop/i.test(t) },
    { point: 'Promise', test: (t, tags) => includesTag(tags, 'promise', 'promise.all') || /promise|then\s*\(|catch\s*\(/i.test(t) },
    { point: '异步编程', test: (t, tags) => includesTag(tags, '异步编程', '并发控制') || /异步|async|await|防抖|节流/i.test(t) },
    { point: 'this', test: (t) => /\bthis\b|call\s*\(|apply\s*\(|bind\s*\(/i.test(t) },
    { point: '手写实现', test: (t, tags) => includesTag(tags, '手写实现', '手写', 'call') || /手写|实现一个|实现\s*\w+/i.test(t) },
    { point: '数组方法', test: (t, tags) => includesTag(tags, '数组方法') || /数组方法|\.map\(|\.filter\(|\.reduce\(|\.flat\(|foreach/i.test(t) },
    { point: '类型转换', test: (t, tags) => includesTag(tags, '类型转换') || /类型转换|隐式转换|显式转换|truthy/i.test(t) },
    { point: '元编程', test: (t, tags) => includesTag(tags, '元编程') || /proxy|reflect|元编程/i.test(t) },
    { point: '响应式原理', test: (t) => /响应式|双向绑定|mvvm|defineproperty|依赖收集/i.test(t) },
    { point: '生命周期', test: (t) => /生命周期|beforecreate|created|mounted|updated|destroyed/i.test(t) },
    { point: '组件通信', test: (t) => /组件通信|组件通讯|props|emit|provide|inject|eventbus/i.test(t) },
    { point: '路由', test: (t) => /路由|router|route|导航守卫|hash\s*路由|history\s*路由/i.test(t) },
    { point: '状态管理', test: (t) => /状态管理|vuex|redux|store|mutation|dispatch/i.test(t) },
    { point: '虚拟DOM', test: (t) => /虚拟\s*d[o0]m|virtual\s*dom|\bdiff\b/i.test(t) },
    { point: 'Fiber', test: (t, tags) => includesTag(tags, 'fiber') || /fiber/i.test(t) },
    { point: 'Hooks', test: (t, tags) => includesTag(tags, 'hooks') || /hooks?|usestate|useeffect/i.test(t) },
    { point: '渲染原理', test: (t, tags) => includesTag(tags, '渲染原理') || /渲染原理|渲染流程|重绘|回流|合成|render/i.test(t) },
    { point: '布局', test: (t, tags) => includesTag(tags, 'css') && /布局|居中|flex|grid|定位/i.test(t) },
    { point: 'BFC', test: (t) => /bfc|块级格式化/i.test(t) },
    { point: '响应式布局', test: (t) => /响应式布局|媒体查询|rem|vw|适配/i.test(t) },
    { point: '图片优化', test: (t) => /webp|图片优化|懒加载|图片/i.test(t) },
    { point: '浏览器缓存', test: (t) => /缓存|强缓存|协商缓存|cache-control|etag/i.test(t) },
    { point: '跨域', test: (t) => /跨域|cors|同源/i.test(t) },
    { point: '存储', test: (t) => /cookie|localstorage|sessionstorage|indexeddb|存储/i.test(t) },
    { point: '安全', test: (t) => /安全|xss|csrf|注入|https/i.test(t) },
    { point: 'HTTP', test: (t) => /http\/|http\s|请求方法|状态码|报文/i.test(t) },
    { point: 'HTTPS', test: (t) => /https|tls|ssl|证书/i.test(t) },
    { point: 'TCP', test: (t) => /tcp|三次握手|四次挥手/i.test(t) },
    { point: 'DNS', test: (t) => /\bdns\b|域名解析/i.test(t) },
    { point: 'CDN', test: (t) => /\bcdn\b|内容分发/i.test(t) },
    { point: 'Webpack', test: (t, tags) => includesTag(tags, 'webpack') || /webpack/i.test(t) },
    { point: 'Vite', test: (t, tags) => includesTag(tags, 'vite') || /\bvite\b/i.test(t) },
    { point: 'CI/CD', test: (t) => /ci\/cd|持续集成|持续部署|流水线/i.test(t) },
    { point: '工程化', test: (t, tags) => includesTag(tags, '工程') || /工程化|构建|模块化/i.test(t) },
    { point: '性能优化', test: (t, tags) => includesTag(tags, '性能优化') || /性能优化|性能|防抖|节流|懒加载/i.test(t) },
    { point: '索引', test: (t) => /索引|index|explain/i.test(t) },
    { point: 'B+树', test: (t, tags) => includesTag(tags, 'b+树') || /b\+树/i.test(t) },
    { point: '事务', test: (t) => /事务|acid|隔离级别/i.test(t) },
    { point: '锁', test: (t) => /锁|死锁|并发控制|mvcc/i.test(t) },
    { point: 'JVM', test: (t) => /jvm|垃圾回收|gc|类加载/i.test(t) },
    { point: 'Spring', test: (t) => /spring|ioc|aop|bean/i.test(t) },
    { point: '哈希表', test: (t, tags) => includesTag(tags, '哈希表', '哈希', 'hash') || /哈希表|哈希|hash\s*map/i.test(t) },
    { point: '双指针', test: (t, tags) => includesTag(tags, '双指针', '快慢指针', 'floyd判环') || /双指针|快慢指针/i.test(t) },
    { point: '滑动窗口', test: (t, tags) => includesTag(tags, '滑动窗口') || /滑动窗口/i.test(t) },
    { point: '二分查找', test: (t) => /二分查找|二分法|binary\s*search/i.test(t) },
    { point: '排序', test: (t) => /排序|快速排序|归并排序|堆排序|冒泡/i.test(t) },
    { point: '递归', test: (t) => /递归/i.test(t) },
    { point: '动态规划', test: (t) => /动态规划|\bdp\b/i.test(t) },
    { point: '图', test: (t) => /图论|广度优先|深度优先|\bbfs\b|\bdfs\b/i.test(t) },
    { point: '数据结构', test: (t, tags) => includesTag(tags, '算法', '数据结构', '算法面试') || /数据结构|链表|栈|队列|二叉树/i.test(t) },
    { point: 'LLM', test: (t, tags) => includesTag(tags, 'llm') || /大模型|llm|transformer/i.test(t) },
    { point: 'RAG', test: (t, tags) => includesTag(tags, 'rag') || /\brag\b|检索增强/i.test(t) },
    { point: 'Function Calling', test: (t) => /function\s*calling|工具调用|tool\s*call/i.test(t) },
    { point: 'Prompt', test: (t) => /prompt|提示词/i.test(t) },
    { point: '设计模式', test: (t) => /设计模式|单例|观察者模式|工厂模式/i.test(t) },
]

function defaultPoint(stack: TechStack): string {
    switch (stack) {
        case 'Vue':
        case 'React':
            return '框架基础'
        case 'JavaScript':
        case 'Node.js':
            return '语言基础'
        case 'TypeScript':
            return '类型系统'
        case 'CSS':
            return '布局'
        case 'HTML':
            return 'HTML基础'
        case '浏览器':
            return '渲染原理'
        case '工程化':
            return '工程化'
        case 'MySQL':
        case 'Redis':
            return '索引'
        case 'Java':
        case 'Spring':
            return 'JVM'
        case '数据结构':
            return '数据结构'
        case 'LLM':
        case 'RAG':
            return 'LLM'
        default:
            return '语言基础'
    }
}

/**
 * 规则分类:不调模型,用于历史数据回填、新题创建、AI 生成结果兜底。
 */
export function classifyQuestion(input: ClassifyInput): Classification {
    const rawTags = (input.tags ?? []).filter((t) => typeof t === 'string' && t.trim())
    const text = [input.title, input.content, input.answer, rawTags.join(' '), input.bankSlug]
        .filter(Boolean)
        .join('\n')
        .toLowerCase()

    // 方向
    let direction: Direction = '前端'
    if (
        input.bankSlug === 'algorithm' ||
        includesTag(rawTags, '算法', '数据结构', '双指针', '滑动窗口', 'floyd判环', '快乐数', '快慢指针')
    ) {
        direction = '算法'
    }
    if (
        includesTag(rawTags, 'mysql', 'innodb', 'b+树', 'java', 'spring', 'redis', 'jvm') ||
        /mysql|innodb|b\+树|\bjava\b|\bspring\b|\bjvm\b|数据库|后端/.test(text)
    ) {
        direction = '后端'
    }
    if (
        includesTag(rawTags, 'agent', 'llm', 'rag') ||
        /\bagent\b|llm|rag|大模型|智能体|prompt|function\s*calling|工具调用/.test(text)
    ) {
        direction = 'Agent'
    }
    if (
        includesTag(rawTags, '操作系统', '计算机组成', '进程', '线程', '内存管理') ||
        /操作系统|计算机组成|进程调度|虚拟内存/.test(text)
    ) {
        direction = '计算机基础'
    }

    // 技术栈(单主栈)
    let techStack: TechStack = 'JavaScript'
    if (direction === '算法') {
        techStack = '数据结构'
    } else if (direction === 'Agent') {
        techStack = includesTag(rawTags, 'rag') ? 'RAG' : 'LLM'
    } else if (direction === '后端') {
        if (includesTag(rawTags, 'java', 'spring', 'jvm') || /\bjava\b|\bspring\b|\bjvm\b/.test(text)) techStack = 'Java'
        else if (includesTag(rawTags, 'redis') || /\bredis\b/.test(text)) techStack = 'Redis'
        else if (includesTag(rawTags, 'mysql', 'innodb', 'b+树') || /mysql|innodb|b\+树/.test(text)) techStack = 'MySQL'
        else techStack = 'MySQL'
    } else if (includesTag(rawTags, 'vue', 'vuex') || /\bvue\b|vuex/i.test(text)) {
        techStack = 'Vue'
    } else if (includesTag(rawTags, 'react', 'redux', 'fiber', 'hooks') || /\breact\b|redux|fiber|hooks/i.test(text)) {
        techStack = 'React'
    } else if (includesTag(rawTags, 'typescript', 'ts') || /typescript|\bts\b|类型体操/i.test(text)) {
        techStack = 'TypeScript'
    } else if (includesTag(rawTags, 'css') || /\bcss\b|flex|grid|bfc|居中/i.test(text)) {
        techStack = 'CSS'
    } else if (includesTag(rawTags, 'html') || /\bhtml\b|语义化|dom/i.test(text)) {
        techStack = 'HTML'
    } else if (includesTag(rawTags, 'webpack', 'vite', '工程') || /webpack|vite|工程化|构建工具/i.test(text)) {
        techStack = '工程化'
    } else if (includesTag(rawTags, '网络') || /http|https|tcp|dns|cdn|跨域|浏览器缓存/.test(text)) {
        techStack = '浏览器'
    } else if (includesTag(rawTags, 'node', 'nodejs') || /\bnode\.?js\b|express|koa/i.test(text)) {
        techStack = 'Node.js'
    }

    // 知识点
    const points: string[] = []
    for (const rule of POINT_RULES) {
        if (points.includes(rule.point)) continue
        if (rule.test(text, rawTags)) points.push(rule.point)
        if (points.length >= 4) break
    }
    if (points.length === 0) points.push(defaultPoint(techStack))

    // 方向/技术栈本身也是标签;旧标签保留用于旧标签页兼容
    const canonical = uniq([direction, techStack, ...points].filter((t) => !STOP_TAGS.has(t.toLowerCase())))
    const legacy = rawTags
        .map((t) => t.trim())
        .filter((t) => t && !STOP_TAGS.has(t.toLowerCase()))
    const tags = uniq([...canonical, ...legacy]).slice(0, 16)

    return {
        direction,
        techStack,
        knowledgePoints: points.filter((p) => POINT_SET.has(p)),
        tags,
    }
}
