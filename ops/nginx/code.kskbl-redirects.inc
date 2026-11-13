# 2026-11-06 旧 URL 301/410
# 由 tag slug 从中文改成 ASCII、以及 2026-10-30 下架 25 道题产生。
# 只匹配精确路径,不影响当前页面。

# ===== 旧标签(中文) → 新 ASCII 标签 =====
location = /tag/前端 { return 301 /tag/frontend; }
location = /tag/前端/ { return 301 /tag/frontend; }
location = /tag/后端 { return 301 /tag/backend; }
location = /tag/算法 { return 301 /tag/algorithm; }
location = /tag/计算机基础 { return 301 /tag/computer-fundamentals; }
location = /tag/工程化 { return 301 /tag/engineering; }
location = /tag/数据结构 { return 301 /tag/data-structure; }
location = /tag/浏览器 { return 301 /tag/browser; }
location = /tag/Node.js { return 301 /tag/nodejs; }
location = /tag/node.js { return 301 /tag/nodejs; }
location = /tag/B+树 { return 301 /tag/b-plus-tree; }
location = /tag/b+树 { return 301 /tag/b-plus-tree; }
location = /tag/HTML基础 { return 301 /tag/html-basics; }
location = /tag/html基础 { return 301 /tag/html-basics; }
location = /tag/事件循环 { return 301 /tag/event-loop; }
location = /tag/事务 { return 301 /tag/transaction; }
location = /tag/二分查找 { return 301 /tag/binary-search; }
location = /tag/元编程 { return 301 /tag/metaprogramming; }
location = /tag/动态规划 { return 301 /tag/dynamic-programming; }
location = /tag/原型链 { return 301 /tag/prototype-chain; }
location = /tag/双指针 { return 301 /tag/two-pointers; }
location = /tag/哈希表 { return 301 /tag/hash-table; }
location = /tag/响应式原理 { return 301 /tag/reactivity; }
location = /tag/响应式布局 { return 301 /tag/responsive-layout; }
location = /tag/图 { return 301 /tag/graph; }
location = /tag/图片优化 { return 301 /tag/image-optimization; }
location = /tag/存储 { return 301 /tag/storage; }
location = /tag/安全 { return 301 /tag/security; }
location = /tag/布局 { return 301 /tag/layout; }
location = /tag/异步编程 { return 301 /tag/async-programming; }
location = /tag/性能优化 { return 301 /tag/performance; }
location = /tag/手写实现 { return 301 /tag/hand-written; }
location = /tag/排序 { return 301 /tag/sorting; }
location = /tag/数据库基础 { return 301 /tag/database-basics; }
location = /tag/数组方法 { return 301 /tag/array-methods; }
location = /tag/框架基础 { return 301 /tag/framework-basics; }
location = /tag/浏览器缓存 { return 301 /tag/browser-cache; }
location = /tag/渲染原理 { return 301 /tag/rendering; }
location = /tag/滑动窗口 { return 301 /tag/sliding-window; }
location = /tag/状态管理 { return 301 /tag/state-management; }
location = /tag/生命周期 { return 301 /tag/lifecycle; }
location = /tag/类型系统 { return 301 /tag/type-system; }
location = /tag/类型转换 { return 301 /tag/type-coercion; }
location = /tag/索引 { return 301 /tag/index; }
location = /tag/组件通信 { return 301 /tag/component-communication; }
location = /tag/虚拟DOM { return 301 /tag/virtual-dom; }
location = /tag/虚拟dom { return 301 /tag/virtual-dom; }
location = /tag/设计模式 { return 301 /tag/design-patterns; }
location = /tag/语言基础 { return 301 /tag/language-basics; }
location = /tag/跨域 { return 301 /tag/cors; }
location = /tag/路由 { return 301 /tag/routing; }
location = /tag/递归 { return 301 /tag/recursion; }
location = /tag/锁 { return 301 /tag/lock; }
location = /tag/闭包 { return 301 /tag/closure; }

# ===== 旧别名 / 已隐藏标签 → 有内容的页面或标签总览 =====
location = /tag/innodb { return 301 /tag/mysql; }
location = /tag/promise.all { return 301 /tag/promise; }
location = /tag/floyd判环 { return 301 /tag/two-pointers; }
location = /tag/快慢指针 { return 301 /tag/two-pointers; }
location = /tag/快乐数 { return 301 /tag/two-pointers; }
location = /tag/算法面试 { return 301 /tag/algorithm; }
location = /tag/网络 { return 301 /tag/browser; }
location = /tag/hash-legacy { return 301 /tags; }
location = /tag/engineering-legacy { return 301 /tags; }
location = /tag/concurrency-control { return 301 /tags; }
location = /tag/hand-written-legacy { return 301 /tags; }
location = /tag/hand-written-instanceof { return 301 /tags; }
location = /tag/scenario { return 301 /tags; }
location = /tag/network { return 301 /tags; }
location = /tag/hd { return 301 /tags; }
location = /tag/doc { return 301 /tags; }
location = /tag/map { return 301 /tags; }
location = /tag/js { return 301 /tags; }
location = /tag/call { return 301 /tags; }
location = /tag/hash { return 301 /tags; }
location = /tag/场景 { return 301 /tags; }
location = /tag/工程 { return 301 /tags; }
location = /tag/哈希 { return 301 /tags; }
location = /tag/并发控制 { return 301 /tags; }
location = /tag/手写 { return 301 /tags; }
location = /tag/手写instanceof { return 301 /tags; }
location = /tag/java { return 301 /tags; }
location = /tag/agent { return 301 /tags; }

# ===== 已合并/下架的题目 → 保留的对应题目 =====
location = /question/q-289d6fb4c8df { return 301 /question/q-2ffb4812cff4; }
location = /question/q-8f1f0389243b { return 301 /question/q-ae0986684dc0; }
location = /question/q-7df289de056f { return 301 /question/q-93595081e414; }
location = /question/q-6ea1481ecd34 { return 301 /question/q-93595081e414; }
location = /question/q-708dd3c61dec { return 301 /question/q-72c6f9e5a745; }
location = /question/q-51262885ef71 { return 301 /question/q-446ca128de5e; }
location = /question/q-8e5ca9c2256e { return 301 /question/q-0620848df188; }
location = /question/q-2f0be2416c53 { return 301 /question/q-19e2c8c6367b; }
location = /question/q-9649aa2f8a0f { return 301 /question/q-4ab5b86f2fdd; }
location = /question/q-7070d10ebc6e { return 301 /question/q-f3fcce9c2b3c; }
location = /question/q-26b516e7d2c4 { return 301 /question/q-17f9efe49b64; }
location = /question/q-11a9b245032e { return 301 /question/q-bfbe490ad51a; }
location = /question/q-33ad31910529 { return 301 /question/q-19af557dd385; }

# 纯碎片/无意义,不再保留
location = /question/q-35f17eb0792b { return 410; }
location = /question/q-775f182eca10 { return 410; }
location = /question/q-4fb9509b143a { return 410; }
location = /question/q-63e93be91898 { return 410; }
location = /question/q-689996be6c4e { return 410; }
location = /question/q-2d8237fcd274 { return 410; }
location = /question/q-a2c0c36c32c3 { return 410; }
location = /question/q-9166c2826f78 { return 410; }
location = /question/q-b04745ffe67f { return 410; }
location = /question/q-fe1786cfcbf5 { return 410; }
location = /question/q-8070d8a39c86 { return 410; }
location = /question/q-ab83900714a0 { return 410; }
location = /question/q-db490722c87e { return 410; }
location = /question/q-b899d8cbb399 { return 410; }

# 2026-11-13:「荟萃」模块下线,并入文章页的荐文 tab
location = /digest { return 301 /articles; }
location ^~ /digest/ { return 301 /articles; }
