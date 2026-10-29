# 题目逐题 Playwright 走查台账(2026-10-29)

## 结论

| 判定 | 数量 | 含义 |
| --- | ---: | --- |
| PASS | 257 | 页面 200、无 404/报错、JSON-LD 合法、图片正常、答案文字 ≥150 字 |
| WARN | 65 | 能打开,但答案偏薄、图片型答案、教程碎片或一次性 hydration 警告 |
| FAIL | 0 | 打不开 / 渲染成 404 / 裂图 / 结构化数据损坏 |

- 逐题方式:Playwright MCP 一道一道执行 `page.goto`,滚动触发懒加载图片,再读 DOM。
- 每题检查:HTTP 状态、h1、是否 404 占位、题干/参考答案文本长度、裂图数量、可见文案里的空反引号、页面异常、JSON-LD 能否 `JSON.parse`。
- 首轮 29 个"异常"里有 28 个是误报:空反引号匹配到了 `<script>` 里的 RSC 数据;已用可见文本节点复检,0 个真实空反引号。
- 图片另外单独校验过 102 个 URL,全部 200。

## 需要内容侧处理的 WARN(65)

### 答案文字极少(<60 字,基本只有图)
- [any类型](https://code.kskbl.com.cn/question/q-2d8237fcd274) — 12 字
- [Vue的监听属性和计算属性有什么区别？](https://code.kskbl.com.cn/question/q-9649aa2f8a0f) — 55 字
- [`mixins`有几个生命周期阶段？](https://code.kskbl.com.cn/question/q-1910cd2cb293) — 54 字
- [a = a && b](https://code.kskbl.com.cn/question/q-35f17eb0792b) — 48 字
- [Vue 中如何阻止事件冒泡？](https://code.kskbl.com.cn/question/q-33ad31910529) — 7 字
- [setTimeout/Promise/Async/Await 的区别](https://code.kskbl.com.cn/question/q-b04745ffe67f) — 52 字
- [Axios原理](https://code.kskbl.com.cn/question/q-a2c0c36c32c3) — 29 字
- [typeof](https://code.kskbl.com.cn/question/q-11a9b245032e) — 13 字
- [class类](https://code.kskbl.com.cn/question/q-289d6fb4c8df) — 35 字
- [TypeScript 字面量类型是什么？](https://code.kskbl.com.cn/question/q-63e93be91898) — 4 字
- [TS中两种不同的文件类型](https://code.kskbl.com.cn/question/q-9166c2826f78) — 19 字

### 教程碎片(语义不完整,建议合并或下架)
- [使用星期枚举](https://code.kskbl.com.cn/question/q-4fb9509b143a)
- [打印一周的日程](https://code.kskbl.com.cn/question/q-689996be6c4e)
- [定义星期枚举](https://code.kskbl.com.cn/question/q-8070d8a39c86)
- [TypeScript 枚举的输出示例](https://code.kskbl.com.cn/question/q-ab83900714a0)

### 答案偏薄(60–149 字)
- [什么是repaint](https://code.kskbl.com.cn/question/q-ea9eabc9dc73) — 98 字
- [有效的字母异位词](https://code.kskbl.com.cn/question/q-70a4bcce9f69) — 109 字
- [Vue2.0和Vue3.0有什么区别？](https://code.kskbl.com.cn/question/q-6da169887a33) — 99 字
- [vite预构建](https://code.kskbl.com.cn/question/q-893b84f317c9) — 148 字
- [为什么 Vue 要求组件模板只能有一个根元素？](https://code.kskbl.com.cn/question/q-6ce5489631f6) — 82 字
- [vuex的优势](https://code.kskbl.com.cn/question/q-5f48527b797d) — 123 字
- [vuex如何赋值](https://code.kskbl.com.cn/question/q-3d00e106aaa7) — 125 字
- [Redux 的核心概念有哪些？请分别说明。](https://code.kskbl.com.cn/question/q-cda2b15c6434) — 101 字
- [Reducer](https://code.kskbl.com.cn/question/q-eaa362ee4fdc) — 92 字
- [父元素高度塌陷](https://code.kskbl.com.cn/question/q-8d12ff590c07) — 143 字
- [为什么transform的效率高](https://code.kskbl.com.cn/question/q-f21366656829) — 124 字
- [类型注解](https://code.kskbl.com.cn/question/q-fe1786cfcbf5) — 121 字
- [什么是HTTP协议？](https://code.kskbl.com.cn/question/q-12d5c20bce00) — 103 字
- [说一下防抖和节流。怎么实现？](https://code.kskbl.com.cn/question/q-a567634dea1b) — 85 字
- [v-if和v-show有什么区别？](https://code.kskbl.com.cn/question/q-cbfa5d0f587f) — 134 字
- [CSS 后处理器有什么作用和优势？](https://code.kskbl.com.cn/question/q-acec9663ee21) — 143 字
- [promise题目](https://code.kskbl.com.cn/question/q-51262885ef71) — 137 字
- [Vue常用的指令有哪些？](https://code.kskbl.com.cn/question/q-5627ea246817) — 65 字
- [v-for为什么要加一个key？](https://code.kskbl.com.cn/question/q-b388c4acb616) — 80 字
- [在 Vue 组件中如何访问根实例？](https://code.kskbl.com.cn/question/q-d93df488e774) — 97 字
- [raf在事件循环中的执行时机](https://code.kskbl.com.cn/question/q-a480df1df50c) — 125 字
- [HTTP与HTTPS有什么区别？](https://code.kskbl.com.cn/question/q-8bc770e11df4) — 111 字
- [在 Redux 中，如何实现状态的持久化？](https://code.kskbl.com.cn/question/q-aa34a8ea0662) — 116 字
- [如何使用属性的默认值](https://code.kskbl.com.cn/question/q-25ff91dc3f7c) — 75 字
- [Vue 中怎么获取 DOM 节点？](https://code.kskbl.com.cn/question/q-2e26d0103280) — 122 字
- [如何实现单行文本溢出隐藏](https://code.kskbl.com.cn/question/q-722431355ff1) — 109 字
- [Vue的导航守卫有哪些？](https://code.kskbl.com.cn/question/q-7070d10ebc6e) — 118 字
- [如何实现登录拦截？](https://code.kskbl.com.cn/question/q-8d0b0e7eb52b) — 75 字
- [你是如何封装一个组件的？](https://code.kskbl.com.cn/question/q-b3f4ab0d564b) — 123 字
- [vuex持久化](https://code.kskbl.com.cn/question/q-794ab4110475) — 110 字
- [Dispatch的返回值](https://code.kskbl.com.cn/question/q-e8d69be9b806) — 79 字
- [请描述一下Redux的数据流](https://code.kskbl.com.cn/question/q-2f564eb6c8e5) — 103 字
- [什么是 Middleware？请举例说明它在 Redux 中的作用。](https://code.kskbl.com.cn/question/q-e75e1a564e46) — 137 字
- [什么是 Store？Redux Store 主要负责哪些功能？](https://code.kskbl.com.cn/question/q-627e31126633) — 84 字
- [如何优化 Redux 应用的性能？有哪些常见的方法？](https://code.kskbl.com.cn/question/q-7452b76adca5) — 147 字
- [请谈谈您在项目中使用 Redux 的经历，有遇到过哪些挑战？您是如何解决的？](https://code.kskbl.com.cn/question/q-46aa56dc23d0) — 102 字
- [如果一个组件需要从多个不同的 Redux slice 中读取状态，你会如何处理？](https://code.kskbl.com.cn/question/q-a5dabf78b82c) — 87 字
- [Reducer 必须是纯函数吗？如果不是会有什么后果？请解释原因。](https://code.kskbl.com.cn/question/q-24fd2d918b22) — 111 字
- [与其他状态管理库（如 MobX、React Context、Pinia 等）相比，您认为 Redux 的优缺点是什么？](https://code.kskbl.com.cn/question/q-3aafd0e4fc57) — 114 字
- [常用伪元素有哪些？](https://code.kskbl.com.cn/question/q-41b5df936b34) — 132 字
- [JavaScript的数据类型？](https://code.kskbl.com.cn/question/q-6ea1481ecd34) — 73 字
- [为什么 JavaScript 是单线程的？](https://code.kskbl.com.cn/question/q-48cca6d20f09) — 102 字
- [为什么 JavaScript 能做异步操作？](https://code.kskbl.com.cn/question/q-181d7b4688b9) — 130 字
- [null 和 undefined 的区别是什么？](https://code.kskbl.com.cn/question/q-95595cb1c20a) — 129 字
- [防抖和节流的应用场景总结](https://code.kskbl.com.cn/question/q-26b516e7d2c4) — 143 字
- [判断脚本的运行环境是浏览器还是Node](https://code.kskbl.com.cn/question/q-c1910e1a38ae) — 140 字
- [Object.keys和Object.entries](https://code.kskbl.com.cn/question/q-ef94b5e90c73) — 140 字
- [Express文档地址](https://code.kskbl.com.cn/question/q-775f182eca10) — 62 字
- [本地存储有哪一些？它们三者有什么区别？](https://code.kskbl.com.cn/question/q-40710ca4dfa8) — 124 字
- [打印一周的日程](https://code.kskbl.com.cn/question/q-689996be6c4e) — 118 字

### 一次性页面异常(复测未复现)
- [手写ReactFiber-基础版](https://code.kskbl.com.cn/question/q-ffa09116638a) — React hydration #418,复测 0 报错

## 全部题目台账(按判定 + 标题排序)

| 题目 | slug | 判定 | 答案字数 | 备注 |
| --- | --- | --- | ---: | --- |
| 什么是repaint | [q-ea9eabc9dc73](https://code.kskbl.com.cn/question/q-ea9eabc9dc73) | WARN | 98 | 答案偏薄(98 字) |
| 有效的字母异位词 | [q-70a4bcce9f69](https://code.kskbl.com.cn/question/q-70a4bcce9f69) | WARN | 109 | 答案偏薄(109 字) |
| Vue2.0和Vue3.0有什么区别？ | [q-6da169887a33](https://code.kskbl.com.cn/question/q-6da169887a33) | WARN | 99 | 答案偏薄(99 字) |
| vite预构建 | [q-893b84f317c9](https://code.kskbl.com.cn/question/q-893b84f317c9) | WARN | 148 | 答案偏薄(148 字) |
| 为什么 Vue 要求组件模板只能有一个根元素？ | [q-6ce5489631f6](https://code.kskbl.com.cn/question/q-6ce5489631f6) | WARN | 82 | 答案偏薄(82 字) |
| vuex的优势 | [q-5f48527b797d](https://code.kskbl.com.cn/question/q-5f48527b797d) | WARN | 123 | 答案偏薄(123 字) |
| vuex如何赋值 | [q-3d00e106aaa7](https://code.kskbl.com.cn/question/q-3d00e106aaa7) | WARN | 125 | 答案偏薄(125 字) |
| Redux 的核心概念有哪些？请分别说明。 | [q-cda2b15c6434](https://code.kskbl.com.cn/question/q-cda2b15c6434) | WARN | 101 | 答案偏薄(101 字) |
| Reducer | [q-eaa362ee4fdc](https://code.kskbl.com.cn/question/q-eaa362ee4fdc) | WARN | 92 | 答案偏薄(92 字) |
| 父元素高度塌陷 | [q-8d12ff590c07](https://code.kskbl.com.cn/question/q-8d12ff590c07) | WARN | 143 | 答案偏薄(143 字) |
| 为什么transform的效率高 | [q-f21366656829](https://code.kskbl.com.cn/question/q-f21366656829) | WARN | 124 | 答案偏薄(124 字) |
| 使用星期枚举 | [q-4fb9509b143a](https://code.kskbl.com.cn/question/q-4fb9509b143a) | WARN | 607 | 教程被拆成碎片,单独看语义不完整 |
| 类型注解 | [q-fe1786cfcbf5](https://code.kskbl.com.cn/question/q-fe1786cfcbf5) | WARN | 121 | 答案偏薄(121 字) |
| 什么是HTTP协议？ | [q-12d5c20bce00](https://code.kskbl.com.cn/question/q-12d5c20bce00) | WARN | 103 | 答案偏薄(103 字) |
| 说一下防抖和节流。怎么实现？ | [q-a567634dea1b](https://code.kskbl.com.cn/question/q-a567634dea1b) | WARN | 85 | 答案偏薄(85 字) |
| v-if和v-show有什么区别？ | [q-cbfa5d0f587f](https://code.kskbl.com.cn/question/q-cbfa5d0f587f) | WARN | 134 | 答案偏薄(134 字) |
| any类型 | [q-2d8237fcd274](https://code.kskbl.com.cn/question/q-2d8237fcd274) | WARN | 12 | 答案文字极少(12 字),基本只有图 |
| CSS 后处理器有什么作用和优势？ | [q-acec9663ee21](https://code.kskbl.com.cn/question/q-acec9663ee21) | WARN | 143 | 答案偏薄(143 字) |
| promise题目 | [q-51262885ef71](https://code.kskbl.com.cn/question/q-51262885ef71) | WARN | 137 | 答案偏薄(137 字) |
| Vue的监听属性和计算属性有什么区别？ | [q-9649aa2f8a0f](https://code.kskbl.com.cn/question/q-9649aa2f8a0f) | WARN | 55 | 答案文字极少(55 字),基本只有图 |
| Vue常用的指令有哪些？ | [q-5627ea246817](https://code.kskbl.com.cn/question/q-5627ea246817) | WARN | 65 | 答案偏薄(65 字) |
| v-for为什么要加一个key？ | [q-b388c4acb616](https://code.kskbl.com.cn/question/q-b388c4acb616) | WARN | 80 | 答案偏薄(80 字) |
| 在 Vue 组件中如何访问根实例？ | [q-d93df488e774](https://code.kskbl.com.cn/question/q-d93df488e774) | WARN | 97 | 答案偏薄(97 字) |
| `mixins`有几个生命周期阶段？ | [q-1910cd2cb293](https://code.kskbl.com.cn/question/q-1910cd2cb293) | WARN | 54 | 答案文字极少(54 字),基本只有图 |
| raf在事件循环中的执行时机 | [q-a480df1df50c](https://code.kskbl.com.cn/question/q-a480df1df50c) | WARN | 125 | 答案偏薄(125 字) |
| 手写ReactFiber-基础版 | [q-ffa09116638a](https://code.kskbl.com.cn/question/q-ffa09116638a) | WARN | 2074 | 首轮页面异常:Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= f;复测未复现 |
| HTTP与HTTPS有什么区别？ | [q-8bc770e11df4](https://code.kskbl.com.cn/question/q-8bc770e11df4) | WARN | 111 | 答案偏薄(111 字) |
| 在 Redux 中，如何实现状态的持久化？ | [q-aa34a8ea0662](https://code.kskbl.com.cn/question/q-aa34a8ea0662) | WARN | 116 | 答案偏薄(116 字) |
| 如何使用属性的默认值 | [q-25ff91dc3f7c](https://code.kskbl.com.cn/question/q-25ff91dc3f7c) | WARN | 75 | 答案偏薄(75 字) |
| a = a && b | [q-35f17eb0792b](https://code.kskbl.com.cn/question/q-35f17eb0792b) | WARN | 48 | 答案文字极少(48 字),基本只有图 |
| Vue 中怎么获取 DOM 节点？ | [q-2e26d0103280](https://code.kskbl.com.cn/question/q-2e26d0103280) | WARN | 122 | 答案偏薄(122 字) |
| 如何实现单行文本溢出隐藏 | [q-722431355ff1](https://code.kskbl.com.cn/question/q-722431355ff1) | WARN | 109 | 答案偏薄(109 字) |
| Vue 中如何阻止事件冒泡？ | [q-33ad31910529](https://code.kskbl.com.cn/question/q-33ad31910529) | WARN | 7 | 答案文字极少(7 字),基本只有图 |
| Vue的导航守卫有哪些？ | [q-7070d10ebc6e](https://code.kskbl.com.cn/question/q-7070d10ebc6e) | WARN | 118 | 答案偏薄(118 字) |
| 如何实现登录拦截？ | [q-8d0b0e7eb52b](https://code.kskbl.com.cn/question/q-8d0b0e7eb52b) | WARN | 75 | 答案偏薄(75 字) |
| 你是如何封装一个组件的？ | [q-b3f4ab0d564b](https://code.kskbl.com.cn/question/q-b3f4ab0d564b) | WARN | 123 | 答案偏薄(123 字) |
| vuex持久化 | [q-794ab4110475](https://code.kskbl.com.cn/question/q-794ab4110475) | WARN | 110 | 答案偏薄(110 字) |
| Dispatch的返回值 | [q-e8d69be9b806](https://code.kskbl.com.cn/question/q-e8d69be9b806) | WARN | 79 | 答案偏薄(79 字) |
| 请描述一下Redux的数据流 | [q-2f564eb6c8e5](https://code.kskbl.com.cn/question/q-2f564eb6c8e5) | WARN | 103 | 答案偏薄(103 字) |
| 什么是 Middleware？请举例说明它在 Redux 中的作用。 | [q-e75e1a564e46](https://code.kskbl.com.cn/question/q-e75e1a564e46) | WARN | 137 | 答案偏薄(137 字) |
| 什么是 Store？Redux Store 主要负责哪些功能？ | [q-627e31126633](https://code.kskbl.com.cn/question/q-627e31126633) | WARN | 84 | 答案偏薄(84 字) |
| 如何优化 Redux 应用的性能？有哪些常见的方法？ | [q-7452b76adca5](https://code.kskbl.com.cn/question/q-7452b76adca5) | WARN | 147 | 答案偏薄(147 字) |
| 请谈谈您在项目中使用 Redux 的经历，有遇到过哪些挑战？您是如何解决的？ | [q-46aa56dc23d0](https://code.kskbl.com.cn/question/q-46aa56dc23d0) | WARN | 102 | 答案偏薄(102 字) |
| 如果一个组件需要从多个不同的 Redux slice 中读取状态，你会如何处理？ | [q-a5dabf78b82c](https://code.kskbl.com.cn/question/q-a5dabf78b82c) | WARN | 87 | 答案偏薄(87 字) |
| Reducer 必须是纯函数吗？如果不是会有什么后果？请解释原因。 | [q-24fd2d918b22](https://code.kskbl.com.cn/question/q-24fd2d918b22) | WARN | 111 | 答案偏薄(111 字) |
| 与其他状态管理库（如 MobX、React Context、Pinia 等）相比，您认为 Redux 的优缺点是什么？ | [q-3aafd0e4fc57](https://code.kskbl.com.cn/question/q-3aafd0e4fc57) | WARN | 114 | 答案偏薄(114 字) |
| 常用伪元素有哪些？ | [q-41b5df936b34](https://code.kskbl.com.cn/question/q-41b5df936b34) | WARN | 132 | 答案偏薄(132 字) |
| JavaScript的数据类型？ | [q-6ea1481ecd34](https://code.kskbl.com.cn/question/q-6ea1481ecd34) | WARN | 73 | 答案偏薄(73 字) |
| 为什么 JavaScript 是单线程的？ | [q-48cca6d20f09](https://code.kskbl.com.cn/question/q-48cca6d20f09) | WARN | 102 | 答案偏薄(102 字) |
| 为什么 JavaScript 能做异步操作？ | [q-181d7b4688b9](https://code.kskbl.com.cn/question/q-181d7b4688b9) | WARN | 130 | 答案偏薄(130 字) |
| null 和 undefined 的区别是什么？ | [q-95595cb1c20a](https://code.kskbl.com.cn/question/q-95595cb1c20a) | WARN | 129 | 答案偏薄(129 字) |
| 防抖和节流的应用场景总结 | [q-26b516e7d2c4](https://code.kskbl.com.cn/question/q-26b516e7d2c4) | WARN | 143 | 答案偏薄(143 字) |
| 判断脚本的运行环境是浏览器还是Node | [q-c1910e1a38ae](https://code.kskbl.com.cn/question/q-c1910e1a38ae) | WARN | 140 | 答案偏薄(140 字) |
| setTimeout/Promise/Async/Await 的区别 | [q-b04745ffe67f](https://code.kskbl.com.cn/question/q-b04745ffe67f) | WARN | 52 | 答案文字极少(52 字),基本只有图 |
| Object.keys和Object.entries | [q-ef94b5e90c73](https://code.kskbl.com.cn/question/q-ef94b5e90c73) | WARN | 140 | 答案偏薄(140 字) |
| Express文档地址 | [q-775f182eca10](https://code.kskbl.com.cn/question/q-775f182eca10) | WARN | 62 | 答案偏薄(62 字) |
| 本地存储有哪一些？它们三者有什么区别？ | [q-40710ca4dfa8](https://code.kskbl.com.cn/question/q-40710ca4dfa8) | WARN | 124 | 答案偏薄(124 字) |
| Axios原理 | [q-a2c0c36c32c3](https://code.kskbl.com.cn/question/q-a2c0c36c32c3) | WARN | 29 | 答案文字极少(29 字),基本只有图 |
| 打印一周的日程 | [q-689996be6c4e](https://code.kskbl.com.cn/question/q-689996be6c4e) | WARN | 118 | 教程被拆成碎片,单独看语义不完整;答案偏薄(118 字) |
| 定义星期枚举 | [q-8070d8a39c86](https://code.kskbl.com.cn/question/q-8070d8a39c86) | WARN | 160 | 教程被拆成碎片,单独看语义不完整 |
| TypeScript 枚举的输出示例 | [q-ab83900714a0](https://code.kskbl.com.cn/question/q-ab83900714a0) | WARN | 468 | 教程被拆成碎片,单独看语义不完整 |
| typeof | [q-11a9b245032e](https://code.kskbl.com.cn/question/q-11a9b245032e) | WARN | 13 | 答案文字极少(13 字),基本只有图 |
| class类 | [q-289d6fb4c8df](https://code.kskbl.com.cn/question/q-289d6fb4c8df) | WARN | 35 | 答案文字极少(35 字),基本只有图 |
| TypeScript 字面量类型是什么？ | [q-63e93be91898](https://code.kskbl.com.cn/question/q-63e93be91898) | WARN | 4 | 答案文字极少(4 字),基本只有图 |
| TS中两种不同的文件类型 | [q-9166c2826f78](https://code.kskbl.com.cn/question/q-9166c2826f78) | WARN | 19 | 答案文字极少(19 字),基本只有图 |
| ::before 和 :after 的双冒号和单冒号有什么区别？ | [q-c7b40f4ad95b](https://code.kskbl.com.cn/question/q-c7b40f4ad95b) | PASS | 328 |  |
| `<!DOCTYPE html>` 是什么？它的作用是什么？ | [q-d7635a3d8250](https://code.kskbl.com.cn/question/q-d7635a3d8250) | PASS | 329 |  |
| `0.1 + 0.2` 等于 `0.3`吗？为什么？如何解决？ | [q-8e5828a22853](https://code.kskbl.com.cn/question/q-8e5828a22853) | PASS | 488 |  |
| `Set`和`Map`各是什么？ | [q-222813bada8f](https://code.kskbl.com.cn/question/q-222813bada8f) | PASS | 821 |  |
| 包装类型 | [q-04bc74125b27](https://code.kskbl.com.cn/question/q-04bc74125b27) | PASS | 918 |  |
| 暴露子组件中的属性或者方法 | [q-1a6981c911ce](https://code.kskbl.com.cn/question/q-1a6981c911ce) | PASS | 1697 |  |
| 闭包是什么？如何实现？ | [javascript-closure-basics](https://code.kskbl.com.cn/question/javascript-closure-basics) | PASS | 1009 |  |
| 变量提升与函数提升总结 | [q-858dfd778f10](https://code.kskbl.com.cn/question/q-858dfd778f10) | PASS | 1154 |  |
| 表格数据插槽渲染 | [q-32fe8a77a926](https://code.kskbl.com.cn/question/q-32fe8a77a926) | PASS | 780 |  |
| 不建议在 Vue 中同时使用 v-if 和 v-for？ | [q-95c50d99fa76](https://code.kskbl.com.cn/question/q-95c50d99fa76) | PASS | 322 |  |
| 操作数组的方式 | [q-708dd3c61dec](https://code.kskbl.com.cn/question/q-708dd3c61dec) | PASS | 1969 |  |
| 插入排序 | [q-96c23c07f0cd](https://code.kskbl.com.cn/question/q-96c23c07f0cd) | PASS | 811 |  |
| 常见的CSS布局单位有哪些？ | [q-ca5e06c8c55f](https://code.kskbl.com.cn/question/q-ca5e06c8c55f) | PASS | 478 |  |
| 常用基础类型概述 | [q-7df289de056f](https://code.kskbl.com.cn/question/q-7df289de056f) | PASS | 168 |  |
| 初始化时立即调用Vue的watch函数 | [q-833838ab5465](https://code.kskbl.com.cn/question/q-833838ab5465) | PASS | 238 |  |
| 代理和反射讲解视频 | [q-e73098b0c97b](https://code.kskbl.com.cn/question/q-e73098b0c97b) | PASS | 1681 |  |
| 第一次加载 Vue 页面时会触发哪些生命周期钩子？ | [q-6579a1cb1687](https://code.kskbl.com.cn/question/q-6579a1cb1687) | PASS | 216 |  |
| 堆和栈 | [q-bec8e1b69681](https://code.kskbl.com.cn/question/q-bec8e1b69681) | PASS | 354 |  |
| 对象类型 | [q-bf27c4d8a85b](https://code.kskbl.com.cn/question/q-bf27c4d8a85b) | PASS | 173 |  |
| 对Flex布局的理解 | [q-e0e0119aa7ce](https://code.kskbl.com.cn/question/q-e0e0119aa7ce) | PASS | 1348 |  |
| 对JSON的理解 | [q-d25d95499017](https://code.kskbl.com.cn/question/q-d25d95499017) | PASS | 309 |  |
| 对Vue的理解 | [q-04c567e6d91f](https://code.kskbl.com.cn/question/q-04c567e6d91f) | PASS | 399 |  |
| 二分查找 | [q-27b63c842444](https://code.kskbl.com.cn/question/q-27b63c842444) | PASS | 1282 |  |
| 反转字符串 | [q-68cedeae9df4](https://code.kskbl.com.cn/question/q-68cedeae9df4) | PASS | 1150 |  |
| 泛型（Ts高级类型） | [q-19e2c8c6367b](https://code.kskbl.com.cn/question/q-19e2c8c6367b) | PASS | 2721 |  |
| 防抖（Debouncing） | [q-0fd4873dc167](https://code.kskbl.com.cn/question/q-0fd4873dc167) | PASS | 746 |  |
| 防抖与节流的区别 | [q-17f9efe49b64](https://code.kskbl.com.cn/question/q-17f9efe49b64) | PASS | 211 |  |
| 防抖在实际场景中怎么用？ | [q-cde07a381431](https://code.kskbl.com.cn/question/q-cde07a381431) | PASS | 903 |  |
| 封装简单组件实现状态变化执行回调 | [q-fb9c0be33bb5](https://code.kskbl.com.cn/question/q-fb9c0be33bb5) | PASS | 1675 |  |
| 父子组件生命周期执行顺序 | [q-cf398e8734d0](https://code.kskbl.com.cn/question/q-cf398e8734d0) | PASS | 675 |  |
| 改变this指向call，bind，apply | [q-65d28ce0ae7a](https://code.kskbl.com.cn/question/q-65d28ce0ae7a) | PASS | 1311 |  |
| 高级类型 | [q-46c80b6f04d2](https://code.kskbl.com.cn/question/q-46c80b6f04d2) | PASS | 290 |  |
| 过滤器它有哪些应用场景？ | [q-59e18ee84595](https://code.kskbl.com.cn/question/q-59e18ee84595) | PASS | 797 |  |
| 哈希路由和历史路由模式 | [q-86daedf0a4a4](https://code.kskbl.com.cn/question/q-86daedf0a4a4) | PASS | 621 |  |
| 函数柯里化 | [q-db09ca9e0c40](https://code.kskbl.com.cn/question/q-db09ca9e0c40) | PASS | 729 |  |
| 函数类型 | [q-158ffb8873ed](https://code.kskbl.com.cn/question/q-158ffb8873ed) | PASS | 501 |  |
| 函数与 JavaScript 函数的区别？ | [q-a3ee035f2463](https://code.kskbl.com.cn/question/q-a3ee035f2463) | PASS | 319 |  |
| 盒模型 | [q-832f2607ade6](https://code.kskbl.com.cn/question/q-832f2607ade6) | PASS | 788 |  |
| 宏任务和微任务 | [q-30c683665896](https://code.kskbl.com.cn/question/q-30c683665896) | PASS | 685 |  |
| 箭头函数和普通函数的区别 | [q-4096d50a0356](https://code.kskbl.com.cn/question/q-4096d50a0356) | PASS | 160 |  |
| 交叉类型 | [q-39b936bb7728](https://code.kskbl.com.cn/question/q-39b936bb7728) | PASS | 204 |  |
| 接口（常用类型） | [q-8f1f0389243b](https://code.kskbl.com.cn/question/q-8f1f0389243b) | PASS | 220 |  |
| 节流（Throttling） | [q-b0ee73b28e4b](https://code.kskbl.com.cn/question/q-b0ee73b28e4b) | PASS | 701 |  |
| 块级和行内以及行内块元素 | [q-67d48143a521](https://code.kskbl.com.cn/question/q-67d48143a521) | PASS | 272 |  |
| 快慢指针 | [q-56f62d06fe8e](https://code.kskbl.com.cn/question/q-56f62d06fe8e) | PASS | 176 |  |
| 懒加载 | [q-bf8a2ea20841](https://code.kskbl.com.cn/question/q-bf8a2ea20841) | PASS | 302 |  |
| 类型别名 | [q-f66f07192779](https://code.kskbl.com.cn/question/q-f66f07192779) | PASS | 241 |  |
| 类型断言 | [q-2775f5920455](https://code.kskbl.com.cn/question/q-2775f5920455) | PASS | 348 |  |
| 类型兼容性 | [q-8cc38d71008e](https://code.kskbl.com.cn/question/q-8cc38d71008e) | PASS | 455 |  |
| 类型声明文件的使用说明 | [q-282b4f9cd30f](https://code.kskbl.com.cn/question/q-282b4f9cd30f) | PASS | 644 |  |
| 类型推论 | [q-2c85068e4a46](https://code.kskbl.com.cn/question/q-2c85068e4a46) | PASS | 178 |  |
| 浏览器的每一帧都发生了什么 | [q-3062da218895](https://code.kskbl.com.cn/question/q-3062da218895) | PASS | 1440 |  |
| 浏览器缓存 | [q-a30e20e2689d](https://code.kskbl.com.cn/question/q-a30e20e2689d) | PASS | 1483 |  |
| 浏览器是如何渲染页面的 | [q-127bf3d2dccb](https://code.kskbl.com.cn/question/q-127bf3d2dccb) | PASS | 2022 |  |
| 浏览器渲染页面的过程 | [browser-rendering-pipeline](https://code.kskbl.com.cn/question/browser-rendering-pipeline) | PASS | 774 |  |
| 路由守卫 | [q-f3fcce9c2b3c](https://code.kskbl.com.cn/question/q-f3fcce9c2b3c) | PASS | 195 |  |
| 路由跳转传参的两种方式 | [q-c6a04f972bdb](https://code.kskbl.com.cn/question/q-c6a04f972bdb) | PASS | 2466 |  |
| 路由之间是如何跳转的？有哪些跳转方式？ | [q-e64b3a1a56e6](https://code.kskbl.com.cn/question/q-e64b3a1a56e6) | PASS | 417 |  |
| 媒体查询的理解 | [q-f1520ff4e38b](https://code.kskbl.com.cn/question/q-f1520ff4e38b) | PASS | 471 |  |
| 命名空间与模块 | [q-ecae5e6632d5](https://code.kskbl.com.cn/question/q-ecae5e6632d5) | PASS | 431 |  |
| 内存泄漏引起的原因及解决方式 | [q-abbc9e0c2436](https://code.kskbl.com.cn/question/q-abbc9e0c2436) | PASS | 2397 |  |
| 内置对象 | [q-822aea45188e](https://code.kskbl.com.cn/question/q-822aea45188e) | PASS | 1208 |  |
| 判断快乐数 | [happy-number](https://code.kskbl.com.cn/question/happy-number) | PASS | 1024 |  |
| 判断真假：空数组是 truthy 吗 | [q-5f68e4bb08fc](https://code.kskbl.com.cn/question/q-5f68e4bb08fc) | PASS | 1362 |  |
| 判断js变量是数组？ | [q-e44b16992006](https://code.kskbl.com.cn/question/q-e44b16992006) | PASS | 765 |  |
| 平时发送异步请求一般在哪个生命周期 | [q-b785c35a64cb](https://code.kskbl.com.cn/question/q-b785c35a64cb) | PASS | 221 |  |
| 前端冒烟测试在 CI/CD 中如何落地？ | [frontend-smoke-test-cicd](https://code.kskbl.com.cn/question/frontend-smoke-test-cicd) | PASS | 1460 |  |
| 前端实现截图 | [q-a99bc86ec7c5](https://code.kskbl.com.cn/question/q-a99bc86ec7c5) | PASS | 890 |  |
| 请求报文和响应报文的组成 | [q-4595cfdc7d35](https://code.kskbl.com.cn/question/q-4595cfdc7d35) | PASS | 228 |  |
| 请求竞态 | [q-6be2dda4801a](https://code.kskbl.com.cn/question/q-6be2dda4801a) | PASS | 1618 |  |
| 如何处理 Redux 中的异步操作？请举例说明你熟悉的库，比如 Redux Thunk 或 Redux Saga。 | [q-d32577969551](https://code.kskbl.com.cn/question/q-d32577969551) | PASS | 167 |  |
| 如何对 Vue 项目进行搜索引擎优化（SEO） | [q-64a634dfde69](https://code.kskbl.com.cn/question/q-64a634dfde69) | PASS | 367 |  |
| 如何根据设计稿来进行移动端适配 | [q-536c946e00f1](https://code.kskbl.com.cn/question/q-536c946e00f1) | PASS | 221 |  |
| 如何获取 Vue 页面中的 hash 变化？ | [q-d8c4a87aaad5](https://code.kskbl.com.cn/question/q-d8c4a87aaad5) | PASS | 291 |  |
| 如何获取当前的路由信息？ | [q-6fc55c4aa540](https://code.kskbl.com.cn/question/q-6fc55c4aa540) | PASS | 1126 |  |
| 如何监听VUEX数据的变化 | [q-fc2887912ced](https://code.kskbl.com.cn/question/q-fc2887912ced) | PASS | 1244 |  |
| 如何开启watch的深度监听 | [q-7e1c4455b00d](https://code.kskbl.com.cn/question/q-7e1c4455b00d) | PASS | 513 |  |
| 如何理解异步 | [q-1acd15385597](https://code.kskbl.com.cn/question/q-1acd15385597) | PASS | 343 |  |
| 如何判断属性是否在原型链上 | [q-e74e0dfd3765](https://code.kskbl.com.cn/question/q-e74e0dfd3765) | PASS | 1379 |  |
| 如何判断网页元素是否到达可视区域？ | [q-3bec7ba0bec9](https://code.kskbl.com.cn/question/q-3bec7ba0bec9) | PASS | 2061 |  |
| 如何实现单多行文本移除隐藏 | [q-a83311f64d79](https://code.kskbl.com.cn/question/q-a83311f64d79) | PASS | 1018 |  |
| 如何实现的fiber | [q-c2ebf35144d2](https://code.kskbl.com.cn/question/q-c2ebf35144d2) | PASS | 2218 |  |
| 如何实现水平垂直居中 | [q-2b1a655a88e8](https://code.kskbl.com.cn/question/q-2b1a655a88e8) | PASS | 806 |  |
| 如何在前端解决跨域问题 | [q-ce2a0d36ea77](https://code.kskbl.com.cn/question/q-ce2a0d36ea77) | PASS | 1072 |  |
| 深拷贝和浅拷贝 | [q-fde87368da9d](https://code.kskbl.com.cn/question/q-fde87368da9d) | PASS | 484 |  |
| 什么是 DOM 和 BOM？ | [q-66ec48ea2bae](https://code.kskbl.com.cn/question/q-66ec48ea2bae) | PASS | 1126 |  |
| 什么是 Vue 中的 slot？ | [q-bdbf75dafb10](https://code.kskbl.com.cn/question/q-bdbf75dafb10) | PASS | 1223 |  |
| 什么是html语义化？ | [q-eccd5c5797f3](https://code.kskbl.com.cn/question/q-eccd5c5797f3) | PASS | 553 |  |
| 什么是HTTP状态码？列举常见的状态码及含义。 | [q-5d6e4b7737d3](https://code.kskbl.com.cn/question/q-5d6e4b7737d3) | PASS | 283 |  |
| 什么是reflow | [q-6127b21a1e3b](https://code.kskbl.com.cn/question/q-6127b21a1e3b) | PASS | 199 |  |
| 生成器 | [q-7fee1ea1a68b](https://code.kskbl.com.cn/question/q-7fee1ea1a68b) | PASS | 357 |  |
| 生命周期 | [q-f4ed0f08b784](https://code.kskbl.com.cn/question/q-f4ed0f08b784) | PASS | 591 |  |
| 剩余参数和argments | [q-3865b4dd7e71](https://code.kskbl.com.cn/question/q-3865b4dd7e71) | PASS | 814 |  |
| 时间基动画 | [q-da6fa68f480b](https://code.kskbl.com.cn/question/q-da6fa68f480b) | PASS | 1880 |  |
| 实现水平垂直居中的方式？ | [css-horizontal-vertical-center](https://code.kskbl.com.cn/question/css-horizontal-vertical-center) | PASS | 328 |  |
| 实现状态变化触发回调(类似 useEffect) | [q-20343b7ace39](https://code.kskbl.com.cn/question/q-20343b7ace39) | PASS | 683 |  |
| 事件捕获和冒泡 | [q-cf7d28e51349](https://code.kskbl.com.cn/question/q-cf7d28e51349) | PASS | 1908 |  |
| 事件循环 | [q-2fffd2e4b9a1](https://code.kskbl.com.cn/question/q-2fffd2e4b9a1) | PASS | 339 |  |
| 手写懒加载 | [q-d7a4f21b11f1](https://code.kskbl.com.cn/question/q-d7a4f21b11f1) | PASS | 1608 |  |
| 手写深拷贝 | [q-d52853acb143](https://code.kskbl.com.cn/question/q-d52853acb143) | PASS | 2001 |  |
| 手写题：实现一个并发调度器 | [q-fddfba530906](https://code.kskbl.com.cn/question/q-fddfba530906) | PASS | 1680 |  |
| 手写arr.flat() | [q-59bcbd72de1f](https://code.kskbl.com.cn/question/q-59bcbd72de1f) | PASS | 1355 |  |
| 手写bind | [q-82085f24ce2b](https://code.kskbl.com.cn/question/q-82085f24ce2b) | PASS | 1418 |  |
| 手写call | [q-3947226cfeb7](https://code.kskbl.com.cn/question/q-3947226cfeb7) | PASS | 987 |  |
| 手写filter | [q-78c1ecda5dcb](https://code.kskbl.com.cn/question/q-78c1ecda5dcb) | PASS | 882 |  |
| 手写forEach | [q-6feb892113b1](https://code.kskbl.com.cn/question/q-6feb892113b1) | PASS | 957 |  |
| 手写instanceof | [q-59fba50713a5](https://code.kskbl.com.cn/question/q-59fba50713a5) | PASS | 290 |  |
| 手写js继承 | [q-c71473b30c54](https://code.kskbl.com.cn/question/q-c71473b30c54) | PASS | 271 |  |
| 手写map | [q-20c36c58a33a](https://code.kskbl.com.cn/question/q-20c36c58a33a) | PASS | 354 |  |
| 手写new | [q-7c6cb10a9907](https://code.kskbl.com.cn/question/q-7c6cb10a9907) | PASS | 1016 |  |
| 手写promise | [q-446ca128de5e](https://code.kskbl.com.cn/question/q-446ca128de5e) | PASS | 1144 |  |
| 手写promise.all | [handwrite-promise-all](https://code.kskbl.com.cn/question/handwrite-promise-all) | PASS | 773 |  |
| 手写promise.all和race | [q-0f2f39572521](https://code.kskbl.com.cn/question/q-0f2f39572521) | PASS | 447 |  |
| 手写reduce | [q-e68afb4fbfa1](https://code.kskbl.com.cn/question/q-e68afb4fbfa1) | PASS | 1074 |  |
| 手写render：虚拟 DOM 转真实 DOM | [q-38cf90e521d0](https://code.kskbl.com.cn/question/q-38cf90e521d0) | PASS | 1566 |  |
| 赎金信 | [q-019132e34826](https://code.kskbl.com.cn/question/q-019132e34826) | PASS | 413 |  |
| 属性描述符 | [q-a3e84505220b](https://code.kskbl.com.cn/question/q-a3e84505220b) | PASS | 241 |  |
| 数据类型 | [q-93595081e414](https://code.kskbl.com.cn/question/q-93595081e414) | PASS | 682 |  |
| 数组扁平化 | [q-66602afee5b4](https://code.kskbl.com.cn/question/q-66602afee5b4) | PASS | 1139 |  |
| 数组方法 | [q-72c6f9e5a745](https://code.kskbl.com.cn/question/q-72c6f9e5a745) | PASS | 1216 |  |
| 数组去重有哪些方法？ | [q-67cbb7c51a00](https://code.kskbl.com.cn/question/q-67cbb7c51a00) | PASS | 202 |  |
| 双向绑定原理 | [q-468b4b484901](https://code.kskbl.com.cn/question/q-468b4b484901) | PASS | 935 |  |
| 说说 px、em、rem 的区别及使用场景 | [q-bf7236ab1323](https://code.kskbl.com.cn/question/q-bf7236ab1323) | PASS | 425 |  |
| 算法：堆排序 | [q-bdfc75454506](https://code.kskbl.com.cn/question/q-bdfc75454506) | PASS | 1142 |  |
| 算法：记忆函数 | [q-4846e016fa06](https://code.kskbl.com.cn/question/q-4846e016fa06) | PASS | 286 |  |
| 算法：检查是否是类的对象实例 | [q-c68c551207a1](https://code.kskbl.com.cn/question/q-c68c551207a1) | PASS | 613 |  |
| 算法：两数之和 | [q-7f005c22a3a5](https://code.kskbl.com.cn/question/q-7f005c22a3a5) | PASS | 772 |  |
| 算法：两数之和(哈希表版) | [q-e0a7005caafe](https://code.kskbl.com.cn/question/q-e0a7005caafe) | PASS | 886 |  |
| 算法：三数之和 | [q-a10aa58a90b9](https://code.kskbl.com.cn/question/q-a10aa58a90b9) | PASS | 666 |  |
| 算法：生成斐波那契数列 | [q-1f14353dcea2](https://code.kskbl.com.cn/question/q-1f14353dcea2) | PASS | 267 |  |
| 算法：实现字符串匹配 indexOf | [q-ca04a0d5f50b](https://code.kskbl.com.cn/question/q-ca04a0d5f50b) | PASS | 1306 |  |
| 算法：数组原型对象的最后一个元素 | [q-3bfa62ed60c0](https://code.kskbl.com.cn/question/q-3bfa62ed60c0) | PASS | 210 |  |
| 算法：学生分数的最小差值 | [q-c8c07d6d0c09](https://code.kskbl.com.cn/question/q-c8c07d6d0c09) | PASS | 366 |  |
| 算法：有时间限制的缓存 | [q-53b55f742053](https://code.kskbl.com.cn/question/q-53b55f742053) | PASS | 982 |  |
| 算法：只允许一次函数调用 | [q-d182ba15da65](https://code.kskbl.com.cn/question/q-d182ba15da65) | PASS | 602 |  |
| 算法：最小绝对差 | [q-b1e82948ee30](https://code.kskbl.com.cn/question/q-b1e82948ee30) | PASS | 516 |  |
| 算法：heapify | [q-87c8ce893ba3](https://code.kskbl.com.cn/question/q-87c8ce893ba3) | PASS | 895 |  |
| 索引签名类型 | [q-a395115d208a](https://code.kskbl.com.cn/question/q-a395115d208a) | PASS | 175 |  |
| 谈谈Fiber | [q-0e23145d1ead](https://code.kskbl.com.cn/question/q-0e23145d1ead) | PASS | 2505 |  |
| 统计字符串中字符出现次数 | [q-0fad1876df2b](https://code.kskbl.com.cn/question/q-0fad1876df2b) | PASS | 1244 |  |
| 伪类和伪元素的区别 | [q-7b8c087d732c](https://code.kskbl.com.cn/question/q-7b8c087d732c) | PASS | 270 |  |
| 伪数组的转化方式 | [q-dbb7c2f158e9](https://code.kskbl.com.cn/question/q-dbb7c2f158e9) | PASS | 296 |  |
| 为什么 JavaScript 中 0.1 + 0.2 !== 0.3，如何让其相等？ | [q-71eb2b59aa72](https://code.kskbl.com.cn/question/q-71eb2b59aa72) | PASS | 522 |  |
| 为什么 React 的 Commit 阶段只能同步执行 | [q-0fc206740599](https://code.kskbl.com.cn/question/q-0fc206740599) | PASS | 1120 |  |
| 为什么 Vue 使用异步的方式更新组件 | [q-1b47c10ac995](https://code.kskbl.com.cn/question/q-1b47c10ac995) | PASS | 273 |  |
| 为什么使用fetch而不使用sse或者websocket | [q-1639ad09f896](https://code.kskbl.com.cn/question/q-1639ad09f896) | PASS | 251 |  |
| 为什么要清除浮动？如何清除 | [q-35d825350358](https://code.kskbl.com.cn/question/q-35d825350358) | PASS | 917 |  |
| 为什么mutation中不能做异步操作 | [q-15ecc7b05c5a](https://code.kskbl.com.cn/question/q-15ecc7b05c5a) | PASS | 741 |  |
| 文件下载的方式 | [q-e5a99120c5c3](https://code.kskbl.com.cn/question/q-e5a99120c5c3) | PASS | 1823 |  |
| 响应式设计的概念和基本原理 | [q-9feb998598de](https://code.kskbl.com.cn/question/q-9feb998598de) | PASS | 452 |  |
| 消息推送常见方式 | [q-c9d2d9d18457](https://code.kskbl.com.cn/question/q-c9d2d9d18457) | PASS | 2165 |  |
| 移动端如何适配不同屏幕尺寸？ | [q-adf99c866c7c](https://code.kskbl.com.cn/question/q-adf99c866c7c) | PASS | 228 |  |
| 映射类型 | [q-b97c4644fed0](https://code.kskbl.com.cn/question/q-b97c4644fed0) | PASS | 364 |  |
| 用 Proxy 实现一个对象拦截器 | [q-90b71ddc6d89](https://code.kskbl.com.cn/question/q-90b71ddc6d89) | PASS | 1597 |  |
| 有序数组的平方-双指针 | [q-d3d4c1f5edd9](https://code.kskbl.com.cn/question/q-d3d4c1f5edd9) | PASS | 346 |  |
| 预处理器 / 后处理器是什么？为什么要使用它们？ | [q-64c3d84f2f4d](https://code.kskbl.com.cn/question/q-64c3d84f2f4d) | PASS | 178 |  |
| 原型？原型链是什么？ | [q-9b3fda438e03](https://code.kskbl.com.cn/question/q-9b3fda438e03) | PASS | 1164 |  |
| 长度最小的子数组 | [q-29bd0ee05a5a](https://code.kskbl.com.cn/question/q-29bd0ee05a5a) | PASS | 1060 |  |
| 自定义指令 | [q-f4194bcb9f8b](https://code.kskbl.com.cn/question/q-f4194bcb9f8b) | PASS | 622 |  |
| 组件、插件、插槽三个概念的区别 | [q-272f988b02a8](https://code.kskbl.com.cn/question/q-272f988b02a8) | PASS | 170 |  |
| 组件通讯方式 | [q-434ff63f3832](https://code.kskbl.com.cn/question/q-434ff63f3832) | PASS | 201 |  |
| 作用域 | [q-1ca2412be776](https://code.kskbl.com.cn/question/q-1ca2412be776) | PASS | 256 |  |
| await行为 | [q-3118e75751db](https://code.kskbl.com.cn/question/q-3118e75751db) | PASS | 300 |  |
| computed 和 watch 的区别是什么？ | [q-4ab5b86f2fdd](https://code.kskbl.com.cn/question/q-4ab5b86f2fdd) | PASS | 154 |  |
| created 和 mounted 区别 | [q-d6a93909c31d](https://code.kskbl.com.cn/question/q-d6a93909c31d) | PASS | 536 |  |
| CSS3 中的 transform 有哪些属性？ | [q-45d91c250d5d](https://code.kskbl.com.cn/question/q-45d91c250d5d) | PASS | 995 |  |
| Css属性值的计算过程 | [q-3ef7acbe9cb6](https://code.kskbl.com.cn/question/q-3ef7acbe9cb6) | PASS | 423 |  |
| css隐藏元素的方法 | [q-0c15e6b7c749](https://code.kskbl.com.cn/question/q-0c15e6b7c749) | PASS | 270 |  |
| Css优化和提高性能的方法有哪些？ | [q-30343761a4d0](https://code.kskbl.com.cn/question/q-30343761a4d0) | PASS | 820 |  |
| display：none和visibility：hidden的区别 | [q-23bb6041ac50](https://code.kskbl.com.cn/question/q-23bb6041ac50) | PASS | 386 |  |
| domToJson：把 DOM 转成 JSON 对象 | [q-058ef42fdaf3](https://code.kskbl.com.cn/question/q-058ef42fdaf3) | PASS | 1547 |  |
| ES6的新特性有哪些？ | [q-fe5440cdd305](https://code.kskbl.com.cn/question/q-fe5440cdd305) | PASS | 181 |  |
| ES6模块化和Commonjs的优势 | [q-6acd59372509](https://code.kskbl.com.cn/question/q-6acd59372509) | PASS | 1096 |  |
| flex：1是什么意思 | [q-52f1ac4ed162](https://code.kskbl.com.cn/question/q-52f1ac4ed162) | PASS | 409 |  |
| for in和for of | [q-a040ca53afe3](https://code.kskbl.com.cn/question/q-a040ca53afe3) | PASS | 563 |  |
| getBoundingClientRect() | [q-b4d4dcbf3895](https://code.kskbl.com.cn/question/q-b4d4dcbf3895) | PASS | 1398 |  |
| H5相对于H4有什么变化 | [q-30a44d9b059b](https://code.kskbl.com.cn/question/q-30a44d9b059b) | PASS | 449 |  |
| HD列表转树 | [q-0d52a787606f](https://code.kskbl.com.cn/question/q-0d52a787606f) | PASS | 828 |  |
| HD树扁平化 | [q-423eff62adf4](https://code.kskbl.com.cn/question/q-423eff62adf4) | PASS | 207 |  |
| HTML 自定义属性（data-*）怎么用？ | [q-4a3c3e3dfa3d](https://code.kskbl.com.cn/question/q-4a3c3e3dfa3d) | PASS | 2995 |  |
| https的三次握手 | [q-bcf3248dd1c7](https://code.kskbl.com.cn/question/q-bcf3248dd1c7) | PASS | 512 |  |
| Instanceof原理 | [q-8693e4e0f709](https://code.kskbl.com.cn/question/q-8693e4e0f709) | PASS | 1377 |  |
| JavaScript 的 == 和 === 有什么区别？ | [q-5905d5f751de](https://code.kskbl.com.cn/question/q-5905d5f751de) | PASS | 150 |  |
| JavaScript 的 splice 和 slice 函数会改变原数组吗？ | [q-8284005552bd](https://code.kskbl.com.cn/question/q-8284005552bd) | PASS | 716 |  |
| JavaScript 中如何合并对象？ | [q-111693a859f8](https://code.kskbl.com.cn/question/q-111693a859f8) | PASS | 472 |  |
| JS 中怎么阻止事件冒泡和事件默认行为？ | [q-19af557dd385](https://code.kskbl.com.cn/question/q-19af557dd385) | PASS | 920 |  |
| js创建对象的方式 | [q-c78d7d8de9f8](https://code.kskbl.com.cn/question/q-c78d7d8de9f8) | PASS | 1952 |  |
| js继承（原型链） | [q-e427bcec023a](https://code.kskbl.com.cn/question/q-e427bcec023a) | PASS | 1347 |  |
| js垃圾回收机制 | [q-a45fe99377a6](https://code.kskbl.com.cn/question/q-a45fe99377a6) | PASS | 718 |  |
| js懒加载 | [q-16d5790f785d](https://code.kskbl.com.cn/question/q-16d5790f785d) | PASS | 1187 |  |
| js预编译 | [q-7d3c3902b79d](https://code.kskbl.com.cn/question/q-7d3c3902b79d) | PASS | 390 |  |
| JS中的计时器能做到精确计时吗 | [q-d2ecb076de69](https://code.kskbl.com.cn/question/q-d2ecb076de69) | PASS | 185 |  |
| js中for和foreach的区别 | [q-a3472cb0317c](https://code.kskbl.com.cn/question/q-a3472cb0317c) | PASS | 395 |  |
| js中foreach和map的区别 | [q-d66363c21fde](https://code.kskbl.com.cn/question/q-d66363c21fde) | PASS | 472 |  |
| keepalive中的声明周期 | [q-fdbbd089067c](https://code.kskbl.com.cn/question/q-fdbbd089067c) | PASS | 255 |  |
| Let、const、var三者有什么区别？ | [q-ab542195be41](https://code.kskbl.com.cn/question/q-ab542195be41) | PASS | 1214 |  |
| map和object的区别 | [q-cab217c3aed9](https://code.kskbl.com.cn/question/q-cab217c3aed9) | PASS | 862 |  |
| mouseover 和 mouseenter 事件的区别是什么？ | [q-987b0a315883](https://code.kskbl.com.cn/question/q-987b0a315883) | PASS | 856 |  |
| MySQL（InnoDB）底层使用了哪些数据结构？ | [mysql-innodb-data-structures](https://code.kskbl.com.cn/question/mysql-innodb-data-structures) | PASS | 867 |  |
| nextTick有什么作用？ | [q-ceac0c08db3b](https://code.kskbl.com.cn/question/q-ceac0c08db3b) | PASS | 1093 |  |
| params 和 query 有什么区别？ | [q-2cf76ae2d33b](https://code.kskbl.com.cn/question/q-2cf76ae2d33b) | PASS | 1126 |  |
| POST 请求常见数据格式有哪些？如何选择？ | [post-body-content-type](https://code.kskbl.com.cn/question/post-body-content-type) | PASS | 1407 |  |
| promise.allSettled | [q-f1372fe0727f](https://code.kskbl.com.cn/question/q-f1372fe0727f) | PASS | 190 |  |
| promise.catch | [q-a44ad79d4fb7](https://code.kskbl.com.cn/question/q-a44ad79d4fb7) | PASS | 164 |  |
| promise.finally | [q-03b3d5b20971](https://code.kskbl.com.cn/question/q-03b3d5b20971) | PASS | 252 |  |
| promise.race | [q-330ba3463bc8](https://code.kskbl.com.cn/question/q-330ba3463bc8) | PASS | 211 |  |
| Promise.resolve() | [q-b3405dd8addd](https://code.kskbl.com.cn/question/q-b3405dd8addd) | PASS | 400 |  |
| promise.then()题目 | [q-ba087825c759](https://code.kskbl.com.cn/question/q-ba087825c759) | PASS | 1340 |  |
| Promise/A+ 规范与 ES 规范的关系 | [q-b1f511664ba1](https://code.kskbl.com.cn/question/q-b1f511664ba1) | PASS | 1396 |  |
| promise的then catch finally综合题目 | [q-6073189a60a3](https://code.kskbl.com.cn/question/q-6073189a60a3) | PASS | 1606 |  |
| Promise语法糖：async/await 的输出顺序 | [q-be9da61f5609](https://code.kskbl.com.cn/question/q-be9da61f5609) | PASS | 969 |  |
| promiseA+规范 | [q-36bcf2f19c97](https://code.kskbl.com.cn/question/q-36bcf2f19c97) | PASS | 2049 |  |
| provide和inject | [q-7092476f609b](https://code.kskbl.com.cn/question/q-7092476f609b) | PASS | 227 |  |
| Proxy 相较于 Object.defineProperty 的优势 | [q-8e5ca9c2256e](https://code.kskbl.com.cn/question/q-8e5ca9c2256e) | PASS | 207 |  |
| Proxy 与 Object.defineProperty 的区别 | [q-0620848df188](https://code.kskbl.com.cn/question/q-0620848df188) | PASS | 1773 |  |
| React Hooks 为什么不能写在条件判断中 | [q-0bfbbed962cb](https://code.kskbl.com.cn/question/q-0bfbbed962cb) | PASS | 1554 |  |
| React Router 中 Link 和 useNavigate 有什么区别？ | [q-c19722af0d13](https://code.kskbl.com.cn/question/q-c19722af0d13) | PASS | 2322 |  |
| React懒加载 | [react-lazy-loading](https://code.kskbl.com.cn/question/react-lazy-loading) | PASS | 1053 |  |
| React异步闭包问题 | [q-df3e8bda0213](https://code.kskbl.com.cn/question/q-df3e8bda0213) | PASS | 1572 |  |
| react原理简述 | [q-0a1e8bb131b3](https://code.kskbl.com.cn/question/q-0a1e8bb131b3) | PASS | 398 |  |
| ref和reactive | [q-9116f7c0df90](https://code.kskbl.com.cn/question/q-9116f7c0df90) | PASS | 779 |  |
| Reflect 的作用与使用场景 | [q-e93cd86c90ab](https://code.kskbl.com.cn/question/q-e93cd86c90ab) | PASS | 1757 |  |
| requestAnimationFrame 的 timestamp | [q-d32e5f011940](https://code.kskbl.com.cn/question/q-d32e5f011940) | PASS | 1471 |  |
| requestIdleCallback 和 requestAnimationFrame | [q-cdd4b4cd840f](https://code.kskbl.com.cn/question/q-cdd4b4cd840f) | PASS | 1851 |  |
| route和router的区别 | [q-55ebfeef99ca](https://code.kskbl.com.cn/question/q-55ebfeef99ca) | PASS | 245 |  |
| setup | [q-da2581c0a26b](https://code.kskbl.com.cn/question/q-da2581c0a26b) | PASS | 582 |  |
| SSE-react实现 | [q-554e5297fd80](https://code.kskbl.com.cn/question/q-554e5297fd80) | PASS | 705 |  |
| tcp和udp的区别 | [q-36df43dd1543](https://code.kskbl.com.cn/question/q-36df43dd1543) | PASS | 706 |  |
| this.$set的用法 | [q-9a7e8163a5ea](https://code.kskbl.com.cn/question/q-9a7e8163a5ea) | PASS | 372 |  |
| Ts常用类型 | [q-48ec9f4f7f9b](https://code.kskbl.com.cn/question/q-48ec9f4f7f9b) | PASS | 335 |  |
| typeof 和 instanceof 有什么区别？ | [q-bfbe490ad51a](https://code.kskbl.com.cn/question/q-bfbe490ad51a) | PASS | 1469 |  |
| TypeScript 的类（class）怎么用？ | [q-2ffb4812cff4](https://code.kskbl.com.cn/question/q-2ffb4812cff4) | PASS | 416 |  |
| TypeScript 泛型（Generic）是什么？ | [q-2f0be2416c53](https://code.kskbl.com.cn/question/q-2f0be2416c53) | PASS | 263 |  |
| TypeScript 接口（interface）是什么？ | [q-ae0986684dc0](https://code.kskbl.com.cn/question/q-ae0986684dc0) | PASS | 166 |  |
| TypeScript 枚举（Enum）怎么用？ | [q-219518516eb6](https://code.kskbl.com.cn/question/q-219518516eb6) | PASS | 272 |  |
| TypeScript 与 JavaScript 的区别？ | [q-31270f10dd1d](https://code.kskbl.com.cn/question/q-31270f10dd1d) | PASS | 538 |  |
| TypeScript 元组（Tuple）是什么？ | [q-b172b5749309](https://code.kskbl.com.cn/question/q-b172b5749309) | PASS | 337 |  |
| TypeScript 装饰器 | [q-6f4db38ca20f](https://code.kskbl.com.cn/question/q-6f4db38ca20f) | PASS | 204 |  |
| URL到浏览器的一个过程有哪些步骤？ | [q-ab65c4776905](https://code.kskbl.com.cn/question/q-ab65c4776905) | PASS | 313 |  |
| url到页面呈现的过程 | [q-e1170f64179f](https://code.kskbl.com.cn/question/q-e1170f64179f) | PASS | 334 |  |
| useEffect的三种依赖类型 | [q-f80e093b12f0](https://code.kskbl.com.cn/question/q-f80e093b12f0) | PASS | 223 |  |
| Vue 的 v-cloak 和 v-pre 指令有什么作用？ | [q-07dc5913c968](https://code.kskbl.com.cn/question/q-07dc5913c968) | PASS | 837 |  |
| Vue 的单向数据流和双向数据流 | [q-4c5885c776c9](https://code.kskbl.com.cn/question/q-4c5885c776c9) | PASS | 444 |  |
| Vue 中 MVVM、MVC 和 MVP 模式的区别是什么？ | [vue-mvvm-mvc-mvp-difference](https://code.kskbl.com.cn/question/vue-mvvm-mvc-mvp-difference) | PASS | 1207 |  |
| Vue Router 如何配置 404 页面？ | [q-31cd6b759d2a](https://code.kskbl.com.cn/question/q-31cd6b759d2a) | PASS | 855 |  |
| Vue Router 中如何获取路由传递过来的参数？ | [q-298cd3555c9d](https://code.kskbl.com.cn/question/q-298cd3555c9d) | PASS | 604 |  |
| vue的优缺点 | [q-b79ad2f57faf](https://code.kskbl.com.cn/question/q-b79ad2f57faf) | PASS | 343 |  |
| Vue的diff算法 | [q-715cb0bf8528](https://code.kskbl.com.cn/question/q-715cb0bf8528) | PASS | 1103 |  |
| vue中的data属性是函数而不是一个对象 | [q-f9a498470dc0](https://code.kskbl.com.cn/question/q-f9a498470dc0) | PASS | 263 |  |
| vuex的流程 | [q-f0ab0ae708e5](https://code.kskbl.com.cn/question/q-f0ab0ae708e5) | PASS | 1152 |  |
| vuex和单纯的全局对象有什么区别 | [q-8998ea4830a1](https://code.kskbl.com.cn/question/q-8998ea4830a1) | PASS | 194 |  |
| vuex是什么怎么用 | [q-9f7ca4d15b2f](https://code.kskbl.com.cn/question/q-9f7ca4d15b2f) | PASS | 274 |  |
| vuex为什么要加命名空间和分割模块 | [q-a7d60d016d9a](https://code.kskbl.com.cn/question/q-a7d60d016d9a) | PASS | 155 |  |
| vuex有哪几种属性？vuex的store有几个属性值？分别讲讲它们的作用是什么？ | [q-5894fa3e79d7](https://code.kskbl.com.cn/question/q-5894fa3e79d7) | PASS | 508 |  |
| webp和cdn加速 | [q-a18a518e71ae](https://code.kskbl.com.cn/question/q-a18a518e71ae) | PASS | 331 |  |
| webpack 打包全流程 | [q-1eeaab842c91](https://code.kskbl.com.cn/question/q-1eeaab842c91) | PASS | 1877 |  |
| webpack 和 vite 的区别 | [q-c7e132154a12](https://code.kskbl.com.cn/question/q-c7e132154a12) | PASS | 1175 |  |
