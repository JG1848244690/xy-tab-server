# 站点走查报告(2026-10-29)

## 方法

- Playwright + Chromium(headless),从首页出发按**站内链接图** BFS,不依赖 sitemap。
- 实际访问 **396** 个 URL:322 道题 + 64 个标签页 + 题库/文章/荟萃/关于等页面。
- 每个页面记录:HTTP 状态、是否渲染成 404、h1/title、题干/参考答案文本长度、控制台错误、页面异常。
- 图片单独校验:题目里出现的 102 个图片 URL 全部 GET 校验。

## 本轮结果(修复后)

| 指标 | 结果 |
| --- | --- |
| 访问页面 | 396 |
| 404 / 渲染成 404 | **0** |
| 导航失败 | **0** |
| JS 运行时错误 | **0** |
| 图片 404 | **0**(102/102 可访问) |
| 标题为空的页面 | 0 |

逐题台账(Playwright MCP 一道一道跑):**322 题 → PASS 257 / WARN 65 / FAIL 0**,明细见
[2026-10-29-playwright-question-ledger.md](./2026-10-29-playwright-question-ledger.md)。

### 本轮已修复

1. **43 个中文标签页其实是 404**
   - 原因:Next `output: export` 对非 ASCII 动态段(如 `/tag/前端`)导出出来的是 404 页面,HTTP 状态却是 200,普通爬虫扫不出来。
   - 修复:标签 slug 全部改成 ASCII(`前端→frontend`、`B+树→b-plus-tree`、`数据结构→data-structure`…),标签注册表已迁移;题目页标签链接改为读注册表 slug。
   - 旧的中文标签 URL 现在返回真 404(如需保留历史权重可再加 301,见文末)。
2. **5 道题页面内联脚本 SyntaxError**
   - 原因:答案里有 `<script>` 代码示例,JSON-LD 序列化时 `</script>` 提前闭合了 script 标签。
   - 修复:JSON-LD 统一转义 `<` 为 `\u003c`。
3. **167 道题共用一句假题干**
   - 原文:"请说明「X」的核心要点、实现原理和常见考点。"
   - 修复:content 改为标题本身;页面在 content 与标题一致时不再渲染「题干」块,避免标题下面又出现一句重复的空话。
4. **14 个残缺/过泛标题**
   - `类 / 元组 / 泛型 / 接口 / 枚举 / 输出 / 总结 / 自定义属性 / 字面量类型` → 补成可读题目;
   - ```` 是什么 → `<\!DOCTYPE html>` 是什么;
   - `和useNavigate以及` → React Router 中 Link 和 useNavigate 的区别;
   - `后处理器的功能和优势:`、`结合实际场景` → 补全主语。

## 仍然不全的题目(需要内容侧处理)

### A. 答案严重偏薄(少于 60 字,基本只有图)

| 答案字数 | 标题 | 链接 |
| --- | --- | --- |
| 4 | TypeScript 字面量类型是什么？ | https://code.kskbl.com.cn/question/q-63e93be91898 |
| 7 | Vue 中如何阻止事件冒泡？ | https://code.kskbl.com.cn/question/q-33ad31910529 |
| 12 | any类型 | https://code.kskbl.com.cn/question/q-2d8237fcd274 |
| 13 | typeof | https://code.kskbl.com.cn/question/q-11a9b245032e |
| 19 | TS中两种不同的文件类型 | https://code.kskbl.com.cn/question/q-9166c2826f78 |
| 29 | Axios原理 | https://code.kskbl.com.cn/question/q-a2c0c36c32c3 |
| 35 | class类 | https://code.kskbl.com.cn/question/q-289d6fb4c8df |
| 48 | a = a && b | https://code.kskbl.com.cn/question/q-35f17eb0792b |
| 52 | setTimeout/Promise/Async/Await 的区别 | https://code.kskbl.com.cn/question/q-b04745ffe67f |
| 54 | `mixins`有几个生命周期阶段？ | https://code.kskbl.com.cn/question/q-1910cd2cb293 |
| 55 | Vue的监听属性和计算属性有什么区别？ | https://code.kskbl.com.cn/question/q-9649aa2f8a0f |

> 说明:这几道的图片本身都能打开(102/102 张 200),但文字几乎没有。图片型答案对搜索/无障碍都不友好,建议补 1-2 句结论。

### B. 答案偏薄(60–149 字)

共 50 道,完整列表:

| 答案字数 | 标题 | 链接 |
| --- | --- | --- |
| 62 | Express文档地址 | https://code.kskbl.com.cn/question/q-775f182eca10 |
| 65 | Vue常用的指令有哪些？ | https://code.kskbl.com.cn/question/q-5627ea246817 |
| 73 | JavaScript的数据类型？ | https://code.kskbl.com.cn/question/q-6ea1481ecd34 |
| 75 | 如何实现登录拦截？ | https://code.kskbl.com.cn/question/q-8d0b0e7eb52b |
| 75 | 如何使用属性的默认值 | https://code.kskbl.com.cn/question/q-25ff91dc3f7c |
| 79 | Dispatch的返回值 | https://code.kskbl.com.cn/question/q-e8d69be9b806 |
| 80 | v-for为什么要加一个key？ | https://code.kskbl.com.cn/question/q-b388c4acb616 |
| 82 | 为什么 Vue 要求组件模板只能有一个根元素？ | https://code.kskbl.com.cn/question/q-6ce5489631f6 |
| 84 | 什么是 Store？Redux Store 主要负责哪些功能？ | https://code.kskbl.com.cn/question/q-627e31126633 |
| 85 | 说一下防抖和节流。怎么实现？ | https://code.kskbl.com.cn/question/q-a567634dea1b |
| 87 | 如果一个组件需要从多个不同的 Redux slice 中读取状态，你会如何处理？ | https://code.kskbl.com.cn/question/q-a5dabf78b82c |
| 92 | Reducer | https://code.kskbl.com.cn/question/q-eaa362ee4fdc |
| 97 | 在 Vue 组件中如何访问根实例？ | https://code.kskbl.com.cn/question/q-d93df488e774 |
| 98 | 什么是repaint | https://code.kskbl.com.cn/question/q-ea9eabc9dc73 |
| 99 | Vue2.0和Vue3.0有什么区别？ | https://code.kskbl.com.cn/question/q-6da169887a33 |
| 101 | Redux 的核心概念有哪些？请分别说明。 | https://code.kskbl.com.cn/question/q-cda2b15c6434 |
| 102 | 请谈谈您在项目中使用 Redux 的经历，有遇到过哪些挑战？您是如何解决的？ | https://code.kskbl.com.cn/question/q-46aa56dc23d0 |
| 102 | 为什么 JavaScript 是单线程的？ | https://code.kskbl.com.cn/question/q-48cca6d20f09 |
| 103 | 请描述一下Redux的数据流 | https://code.kskbl.com.cn/question/q-2f564eb6c8e5 |
| 103 | 什么是HTTP协议？ | https://code.kskbl.com.cn/question/q-12d5c20bce00 |
| 107 | Vue 中怎么获取 DOM 节点？ | https://code.kskbl.com.cn/question/q-2e26d0103280 |
| 109 | 有效的字母异位词 | https://code.kskbl.com.cn/question/q-70a4bcce9f69 |
| 109 | 如何实现单行文本溢出隐藏 | https://code.kskbl.com.cn/question/q-722431355ff1 |
| 110 | vuex持久化 | https://code.kskbl.com.cn/question/q-794ab4110475 |
| 111 | HTTP与HTTPS有什么区别？ | https://code.kskbl.com.cn/question/q-8bc770e11df4 |
| 111 | Reducer 必须是纯函数吗？如果不是会有什么后果？请解释原因。 | https://code.kskbl.com.cn/question/q-24fd2d918b22 |
| 114 | 与其他状态管理库（如 MobX、React Context、Pinia 等）相比，您认为 Redux 的优缺点是什么？ | https://code.kskbl.com.cn/question/q-3aafd0e4fc57 |
| 116 | 在 Redux 中，如何实现状态的持久化？ | https://code.kskbl.com.cn/question/q-aa34a8ea0662 |
| 118 | 打印一周的日程 | https://code.kskbl.com.cn/question/q-689996be6c4e |
| 118 | Vue的导航守卫有哪些？ | https://code.kskbl.com.cn/question/q-7070d10ebc6e |
| 121 | 类型注解 | https://code.kskbl.com.cn/question/q-fe1786cfcbf5 |
| 123 | vuex的优势 | https://code.kskbl.com.cn/question/q-5f48527b797d |
| 123 | 你是如何封装一个组件的？ | https://code.kskbl.com.cn/question/q-b3f4ab0d564b |
| 124 | 本地存储有哪一些？它们三者有什么区别？ | https://code.kskbl.com.cn/question/q-40710ca4dfa8 |
| 124 | 为什么transform的效率高 | https://code.kskbl.com.cn/question/q-f21366656829 |
| 125 | vuex如何赋值 | https://code.kskbl.com.cn/question/q-3d00e106aaa7 |
| 125 | raf在事件循环中的执行时机 | https://code.kskbl.com.cn/question/q-a480df1df50c |
| 129 | null 和 undefined 的区别是什么？ | https://code.kskbl.com.cn/question/q-95595cb1c20a |
| 130 | 为什么 JavaScript 能做异步操作？ | https://code.kskbl.com.cn/question/q-181d7b4688b9 |
| 132 | 常用伪元素有哪些？ | https://code.kskbl.com.cn/question/q-41b5df936b34 |
| 134 | v-if和v-show有什么区别？ | https://code.kskbl.com.cn/question/q-cbfa5d0f587f |
| 137 | 什么是 Middleware？请举例说明它在 Redux 中的作用。 | https://code.kskbl.com.cn/question/q-e75e1a564e46 |
| 137 | promise题目 | https://code.kskbl.com.cn/question/q-51262885ef71 |
| 140 | Object.keys和Object.entries | https://code.kskbl.com.cn/question/q-ef94b5e90c73 |
| 140 | 判断脚本的运行环境是浏览器还是Node | https://code.kskbl.com.cn/question/q-c1910e1a38ae |
| 143 | 父元素高度塌陷 | https://code.kskbl.com.cn/question/q-8d12ff590c07 |
| 143 | 防抖和节流的应用场景总结 | https://code.kskbl.com.cn/question/q-26b516e7d2c4 |
| 143 | CSS 后处理器有什么作用和优势？ | https://code.kskbl.com.cn/question/q-acec9663ee21 |
| 147 | 如何优化 Redux 应用的性能？有哪些常见的方法？ | https://code.kskbl.com.cn/question/q-7452b76adca5 |
| 148 | vite预构建 | https://code.kskbl.com.cn/question/q-893b84f317c9 |

### C. 教程被拆成多道"题"(语义不完整)

| slug | 标题 | 问题 |
| --- | --- | --- |
| `q-8070d8a39c86` | 定义星期枚举 | 教程第 1 段,只有 enum 定义 |
| `q-4fb9509b143a` | 使用星期枚举 | 教程第 2 段,只有 printSchedule 函数 |
| `q-689996be6c4e` | 打印一周的日程 | 教程第 3 段,只有 for 循环 |
| `q-ab83900714a0` | TypeScript 枚举的输出示例 | 教程第 4 段,只有运行输出 |
| `q-775f182eca10` | Express文档地址 | 答案只有一个文档外链 |
| `q-2d8237fcd274` | any类型 | 答案只有一张图 |
| `q-11a9b245032e` | typeof | 答案只有一张图 |
| `q-9166c2826f78` | TS中两种不同的文件类型 | 答案只有一张图 |
| `q-63e93be91898` | TypeScript 字面量类型是什么？ | 答案只有两张图 |
| `q-33ad31910529` | Vue 中如何阻止事件冒泡？ | 答案只有一张图 |

> 建议:合并成 1 道「TypeScript 枚举:定义、使用与输出」,或直接从题库下架。

## 其他

- **逐题复核**:322 道题用 Playwright MCP 逐页打开(见逐题台账),其中 1 道(手写ReactFiber-基础版)首轮出现一次 React hydration #418,复测未复现,记为 WARN;其余页面无异常。
- 旧中文标签 URL(`/tag/前端` 等 43 个)已 404。如果担心 GSC 里已有记录,可以在 nginx 加 301 到新的 ASCII slug;本轮未加,避免维护两份映射。
- 首页/题库/文章/荟萃页均正常,无 404、无 JS 错误。
