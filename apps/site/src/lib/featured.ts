/**
 * 首页「今日一题 / 编辑精选」的种子题。
 *
 * 之前按 viewCount 取第一页最新题 —— 全站 viewCount 都是 0 时等于随机,
 * 首屏很容易出现冷门或答案偏薄的题。这里人工挑 10 道答案完整、主题经典、
 * 覆盖不同技术栈的题,首页每天从中轮换一道,并完整展示这 10 道。
 *
 * 换题时只改这个数组;slug 必须存在且已过审,否则会被自动跳过。
 */
export const FEATURED_SLUGS = [
    'javascript-closure-basics', // JS · 闭包
    'q-446ca128de5e', // JS · 手写 Promise
    'q-0e23145d1ead', // React · Fiber
    'q-468b4b484901', // Vue · 双向绑定
    'q-127bf3d2dccb', // 浏览器 · 渲染流程
    'q-ce2a0d36ea77', // 网络 · 跨域
    'q-1eeaab842c91', // 工程化 · webpack
    'q-19e2c8c6367b', // TypeScript · 泛型
    'q-e0e0119aa7ce', // CSS · Flex
    'q-27b63c842444', // 算法 · 二分查找
] as const

/** 首页卡片的一句话导读。题目详情接口的 summary 可能为空,这里人工兜底。 */
export const FEATURED_BLURBS: Record<string, string> = {
    'javascript-closure-basics': '从作用域、内存到经典循环陷阱,一次讲透闭包的定义与实现。',
    'q-446ca128de5e': '从 A+ 规范到手写实现,覆盖 then 链、状态机与微任务。',
    'q-0e23145d1ead': 'React 为什么要重构协调器?Fiber 的时间切片与优先级。',
    'q-468b4b484901': 'Vue 2 的 defineProperty 与 Vue 3 的 Proxy,依赖收集全过程。',
    'q-127bf3d2dccb': '从 HTML 到像素:解析、样式、布局、绘制、合成。',
    'q-ce2a0d36ea77': 'CORS、代理、JSONP、postMessage 的适用边界。',
    'q-1eeaab842c91': '从入口到产物:模块图、loader、plugin 与 tree shaking。',
    'q-19e2c8c6367b': '从函数泛型到条件类型,TypeScript 泛型的常见用法。',
    'q-e0e0119aa7ce': '主轴/交叉轴、flex-grow 与常见布局坑。',
    'q-27b63c842444': '边界条件、循环不变量与二分查找的四种变体。',
}
