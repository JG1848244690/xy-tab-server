# 题库清理:语雀导入的 OCR 垃圾题(2026-11-13)

## 问题

后台「理论题」里有一批题,答案里的代码没有格式:

```
.FOREACH(CALLBACKFN:(VALUE:NUMBER,INDEX: METHOD 1)>VOID,THISARG?:ANY):VOID
TYPE PARTIAL [P IN KEYOF T[P] 子 B:STRING;C:BOOLEAN
```

## 根因

2026-10-28 从语雀批量导入了 238 道题(213 理论 + 25 代码)。其中约 30 道是**直接把截图里的内容 OCR 成文字**:

1. **代码块变成纯文本** —— 语雀里的代码块在导入时丢了 ``` 围栏,缩进也乱了,Markdown 渲染时被当成普通段落,空格全部折叠
2. **OCR 把标识符写成全大写** —— `foreach` → `FOREACH`,`interface` → `INTERFACE`,还混入 `-->`、`子`、`解释:` 这类噪声
3. **正文只有图片** —— 题目本身就是截图,`content` 等于标题,答案只有一串 `![](uploads/...)`

`tech_stack` 标的是 JavaScript / TypeScript,但问题本质是「导入时没有保留 Markdown 结构」,不是某一门语言的问题。

## 处理

### 删除(9 道 + 44 张图)

答案由「图片 + OCR 乱码」组成、无法修复的:

| 标题 | 技术栈 |
| --- | --- |
| 类型声明文件的使用说明 | JavaScript |
| TypeScript 枚举（Enum）怎么用？ | TypeScript |
| TypeScript 泛型（Generic）怎么用？ | TypeScript |
| 交叉类型 | TypeScript |
| 映射类型 | TypeScript |
| 类型兼容性 | TypeScript |
| 类型推论 | TypeScript |
| 索引签名类型 | TypeScript |
| 浏览器渲染页面的过程 | 浏览器(与另一道「浏览器是如何渲染页面的」重复,且是残段) |

同时删除:
- 44 条 `media_assets` 记录
- `/data/uploads/2026/10/*` 对应文件(删除前已确认没有被其他题/文章引用)

### 重写(3 道)

内容有价值、只是代码没围栏的,补成规范 Markdown:

- TypeScript 接口（interface）是什么？
- TypeScript 的类（class）怎么用？
- provide和inject(Vue)

## 验证

```
sitemap 题目数  289
被删题目 URL   404
被删图片 URL   404
修复后页面     接口 1 个 <pre> / 类 4 个 <pre> / provide 7 个 <pre>
```

## 备份

删除前的完整行(含 answer 原文)存在服务器:

```
/root/backups/questions-ocr-garbage-20261113.json
```

## 遗留

- `draft` 里还有 8 道「纯图片无正文」的题(any 类型、typeof、Axios 原理等),不对外,但建议后续补正文或删除
- 全库还有 9 道题用「缩进列表」写答案(HTTP 状态码、DOM/BOM、tcp/udp 等),这些是嵌套列表、渲染正常,不是代码块,不用处理
- 导入流程缺一道校验:**答案里出现连续大写标识符 / 没有围栏却有缩进代码 / 正文只有图片**,应当在入库前拦下
