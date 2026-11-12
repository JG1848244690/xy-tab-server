/**
 * 判定一道题该用「代码编辑器」还是「理论作答」。
 *
 * 历史数据里 277/297 都被标成了代码题(导入时默认值),导致
 * 「Vue 生命周期」「什么是语义化」这类纯理论题也打开代码编辑器。
 *
 * 判定顺序(命中即返回):
 *  1. 正文/答案里有围栏代码块 ```  → 代码题
 *  2. 标题明确要求写代码            → 代码题
 *  3. 正文/答案里代码特征行 ≥3 行   → 代码题
 *  4. 其余                          → 理论题
 *
 * 注意:数据库 enum 沿用历史命名,
 *   'markdown' = 代码题(用 Monaco 作答)
 *   'text'     = 理论题(用 Markdown 作答)
 */
export type QuestionType = 'markdown' | 'text'

const CODE_IN_TITLE =
    /(^实现|^封装|^编写|手写|算法[:：]|写出|输出顺序|输出什么|输出结果|以下代码|这段代码|代码输出|写一个|实现一个|模拟实现|二分查找|插入排序|快速排序|堆排序|遍历|递归实现)/

const CODE_LINE =
    /(^\s*(function|const|let|var|class|return|if\s*\(|for\s*\(|while\s*\(|import\s|export\s|def\s|public\s|private\s|SELECT\s|INSERT\s|UPDATE\s|CREATE\s|package\s|interface\s|type\s+\w+\s*=)\b|=>|console\.log|<\/?[a-z][\w-]*[\s>])/i

export function detectQuestionType(input: {
    title: string
    content?: string | null
    answer?: string | null
}): QuestionType {
    // 只按标题判定。题干里常贴示例代码、答案里常贴实现,
    // 都不能说明「这题要求你写代码」。
    if (CODE_IN_TITLE.test(input.title)) return 'markdown'
    return 'text'
}
