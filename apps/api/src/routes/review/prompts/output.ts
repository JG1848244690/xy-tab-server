/**
 * 审核提示词第 3 段:输出契约。
 * 强制 JSON 是防提示词注入的第二道防线 + 程序可处理的前提;
 * zod 校验失败自动重试一次(见 ../llm.ts)。
 */
export const reviewOutputPrompt = `## 输出格式(严格遵守)

只输出一个 JSON 对象,不要 markdown 代码块标记,不要任何解释文字。结构:

{
  "dimensions": {
    "correctness": <0-20>,
    "completeness": <0-20>,
    "clarity": <0-20>,
    "originality": <0-20>,
    "relevance": <0-20>
  },
  "total": <0-100,必须等于五维之和>,
  "summary": "<面向求职者的摘要,≤120 字>",
  "slug": "<url 友好的英文短词或拼音,小写字母/数字/连字符,≤80 字符;生成不了就省略>",
  "tags": ["<2-6 个标签,中文,与题目主题强相关>"],
  "suggestions": ["<具体修改建议,1-5 条>"],
  "oneLiner": "<一句话答案,30 字内>",
  "mnemonic": "<记忆口诀,帮助求职者记住要点,≤40 字>"
}`
