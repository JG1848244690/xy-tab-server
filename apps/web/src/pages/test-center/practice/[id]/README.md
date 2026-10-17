# 练习页面重构说明

## 📁 新的文件结构

```
practice/[id]/
├── page.tsx                      # 主页面（重构后）
├── types.ts                      # 类型定义
└── components/
    ├── index.ts                  # 组件统一导出
    ├── PracticeHeader.tsx        # 顶部导航栏
    ├── QuestionPanel.tsx         # 题目面板（题目内容 + 参考答案 Tab）
    ├── MarkdownEditor.tsx        # Markdown 编辑器（理论题）
    ├── CodeEditor.tsx            # 代码编辑器（代码题）
    └── HistoryDialog.tsx         # 答题历史对话框
```

## 🎯 重构目标

### 1. **组件化拆分**

将原来 663 行的单文件拆分为 6 个独立组件：

- ✅ 每个组件职责单一，易于维护
- ✅ 代码行数控制在 100-200 行
- ✅ 组件可复用性强
- ✅ 使用 Tab 统一左右两侧的交互模式

### 2. **逻辑清晰**

- ✅ 主页面只负责状态管理和数据流转
- ✅ 各组件独立处理自己的 UI 逻辑
- ✅ 类型定义统一管理

### 3. **易于扩展**

- ✅ 新增编辑器类型只需添加新组件
- ✅ 修改某个功能不影响其他部分
- ✅ 便于团队协作开发

## 📦 组件说明

### 1. PracticeHeader.tsx

**职责**：顶部导航栏

- 显示题目标题
- 显示难度标签
- 显示答题计时器
- 返回按钮

**Props**:

```typescript
{
  question: Question
  timeSpent: number
}
```

### 2. QuestionPanel.tsx

**职责**：题目面板（题目内容 + 参考答案）

- Tab 切换题目内容和参考答案
- 使用 Markdown 渲染内容
- 支持深色/浅色主题
- 打开答题历史对话框
- 处理空内容状态

**Props**:

```typescript
{
  question: Question
  questionId: string
  editorTheme: 'dark' | 'light'
  onOpenHistory: () => void
}
```

**特性**:

- 统一左右两侧的交互模式（都使用 Tab）
- 更紧凑的布局，节省垂直空间
- 更直观的内容切换体验

### 3. MarkdownEditor.tsx

**职责**：理论题答题编辑器

- Markdown 编辑和预览
- 提交正确/错误按钮
- 重新答题功能
- 只读模式（提交后）

**Props**:

```typescript
{
  userAnswer: string
  onAnswerChange: (value: string) => void
  editorTheme: 'dark' | 'light'
  isSubmitted: boolean
  isSubmitting: boolean
  onSubmitCorrect: () => void
  onSubmitWrong: () => void
  onRestart: () => void
}
```

### 4. CodeEditor.tsx

**职责**：代码题答题编辑器

- Monaco 代码编辑器
- 多语言支持（9种语言）
- 代码运行功能（JavaScript）
- 运行结果展示
- 提交和重新答题

**Props**:

```typescript
{
  userAnswer: string
  onAnswerChange: (value: string) => void
  monacoTheme: 'vs-dark' | 'light'
  isSubmitted: boolean
  isSubmitting: boolean
  onSubmitCorrect: () => void
  onSubmitWrong: () => void
  onRestart: () => void
}
```

**特性**:

- 支持 9 种编程语言
- JavaScript 代码实时运行
- 捕获 console 输出
- 错误处理和显示

### 5. HistoryDialog.tsx

**职责**：答题历史对话框

- 展示所有答题记录
- 显示答题时间、正确性
- 回顾历史答案功能
- 空状态提示

**Props**:

```typescript
{
  open: boolean
  onOpenChange: (open: boolean) => void
  attempts: Attempt[]
  onReviewHistory: (attempt: Attempt) => void
}
```

### 6. types.ts

**职责**：类型定义

- `Question` - 题目类型
- `Attempt` - 答题记录类型
- 统一管理所有类型定义

## 🔄 数据流

```
page.tsx (主页面)
    ↓
    ├─→ PracticeHeader (显示题目信息)
    ├─→ QuestionPanel (题目内容 ⇄ 参考答案 Tab 切换)
    ├─→ MarkdownEditor / CodeEditor (答题区域)
    └─→ HistoryDialog (答题历史)
```

## 💡 重构亮点

### 1. **单一职责原则**

每个组件只负责一个功能模块，降低耦合度

### 2. **Props 驱动**

所有组件通过 Props 接收数据和回调，便于测试

### 3. **类型安全**

使用 TypeScript 严格类型定义，减少运行时错误

### 4. **状态提升**

状态管理集中在主页面，子组件无状态或局部状态

### 5. **代码复用**

公共逻辑（如时间格式化）可以抽取到 utils

## 🚀 使用方式

### 导入组件

```typescript
import {
  QuestionPanel,
  MarkdownEditor,
  CodeEditor,
  HistoryDialog,
  PracticeHeader,
} from './components'
```

### 使用组件

```typescript
<PracticeHeader question={question} timeSpent={timeSpent} />

<QuestionPanel
  question={question}
  questionId={questionId}
  editorTheme={editorTheme}
  onOpenHistory={() => setHistoryDialogOpen(true)}
/>

<MarkdownEditor
  userAnswer={userAnswer}
  onAnswerChange={setUserAnswer}
  editorTheme={editorTheme}
  isSubmitted={isSubmitted}
  isSubmitting={isSubmitting}
  onSubmitCorrect={() => handleSubmit(true)}
  onSubmitWrong={() => handleSubmit(false)}
  onRestart={handleRestart}
/>
```

## 📊 代码行数对比

| 文件               | 重构前     | 重构后     |
| ------------------ | ---------- | ---------- |
| page.tsx           | 663 行     | 140 行     |
| PracticeHeader.tsx | -          | 50 行      |
| QuestionPanel.tsx  | -          | 70 行      |
| MarkdownEditor.tsx | -          | 80 行      |
| CodeEditor.tsx     | -          | 200 行     |
| HistoryDialog.tsx  | -          | 120 行     |
| types.ts           | -          | 30 行      |
| **总计**           | **663 行** | **690 行** |

虽然总行数略有增加，但：

- ✅ 代码结构更清晰
- ✅ 每个文件更易理解
- ✅ 维护成本大幅降低
- ✅ 团队协作更高效

## 🔧 后续优化建议

### 短期

- [ ] 抽取公共 hooks（useTimer, useSubmit）
- [ ] 添加组件单元测试
- [ ] 优化代码运行的安全性

### 中期

- [ ] 支持更多编程语言运行
- [ ] 添加代码格式化功能
- [ ] 实现代码片段保存

### 长期

- [ ] AI 辅助答题提示
- [ ] 代码性能分析
- [ ] 协同答题功能

---

**重构完成时间**: 2026-02-04  
**重构人**: Athena Team
