/**
 * 审核提示词第 2 段:评分五维(各 0-20,满分 100)。
 * 权重 implicitly 由各维描述引导;总分必须等于五维之和(zod 里也校验)。
 */
export const reviewRubricPrompt = `## 评分标准(每维 0-20 分,总分 100)

1. correctness 正确性:技术事实是否正确,答案是否与主流实践/官方文档一致。有硬伤 → ≤5。
2. completeness 完整性:答案是否覆盖了题目的完整考查点,有无关键遗漏;追问空间是否被考虑。
3. clarity 结构清晰:题干表述是否清楚无歧义,答案是否分层、可读、适合面试场景复述。
4. originality 原创性:是否是原创表述。与网上流传的"八股原文"高度雷同(逐字背诵体)要扣分;平台要求全链路原创化。
5. relevance 题意匹配:题目标题/难度标签与内容是否匹配,是否真的像一道面试题而非随笔笔记。`

export const REVIEW_DIMENSIONS = [
    'correctness',
    'completeness',
    'clarity',
    'originality',
    'relevance',
] as const
