/**
 * 首页「今日一题 / 编辑精选」的种子题。
 *
 * 收录标准(2026-11-14 重挑):
 *   1. 答案有实质内容:讲机制、给取舍,不是名词解释;
 *   2. 覆盖从浏览器到框架、工程、手写、算法的完整链路;
 *   3. 按「阅读顺序」排,不按热度 —— 首页这 10 道应该能串成一条线。
 *
 * 换题时只改数组;slug 必须存在且已过审,否则会被自动跳过。
 */
export const FEATURED_SLUGS = [
    'q-127bf3d2dccb', // 浏览器 · 渲染流程(整条链路的地基)
    'q-a30e20e2689d', // 浏览器 · 缓存(请求层)
    'q-be9da61f5609', // JS · async/await 输出顺序(事件循环)
    'q-fddfba530906', // JS · 手写并发调度器(异步控制)
    'q-ffa09116638a', // React · 手写 Fiber(框架原理)
    'q-0fc206740599', // React · Commit 为什么必须同步(框架细节)
    'q-715cb0bf8528', // Vue · diff 算法(框架对比)
    'q-1eeaab842c91', // 工程 · webpack 打包全流程
    'handwritten-mini-sentry-sdk', // 工程 · 手写错误监控 SDK(线上闭环)
    'q-abbc9e0c2436', // JS · 内存泄漏(长期运行的代价)
] as const

/** 首页卡片的一句话导读。题目详情接口的 summary 可能为空,这里人工兜底。 */
export const FEATURED_BLURBS: Record<string, string> = {
    'q-127bf3d2dccb': '从 HTML 到像素:解析、样式、布局、绘制、合成,以及每一步为什么慢。',
    'q-a30e20e2689d': '强缓存、协商缓存、from disk 与 from memory 的真实差别。',
    'q-be9da61f5609': 'async 函数被拆成几段、每段进哪个队列,一串输出顺序全讲清。',
    'q-fddfba530906': '限制并发数、保持完成顺序、错误不拖垮整批,手写一遍调度器。',
    'q-ffa09116638a': '不用 React,自己写一个能中断、能恢复的 Fiber 渲染器。',
    'q-0fc206740599': 'Commit 阶段为什么不能被打断,以及打断之后 DOM 会烂成什么样。',
    'q-715cb0bf8528': '同层比较、key 的作用、双端 diff 的移动策略。',
    'q-1eeaab842c91': '入口 → 依赖图 → chunk → 产物,loader 与 plugin 各自挂在哪一步。',
    'handwritten-mini-sentry-sdk': '采集、组装、缓冲、上报四步,自己写一个不依赖第三方的错误监控。',
    'q-abbc9e0c2436': '闭包、定时器、监听器、缓存:内存是怎么一点点涨上去的,又怎么定位。',
}
