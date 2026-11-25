import { siteApi, SITE_URL, SITE_NAME } from '@/lib/site-api'

/**
 * llms.txt(AI 爬虫偏好文件,plan §3.3 "便宜有效"):
 * 给 LLM 爬虫一个干净的目录说明,提升 AEO/GEO 引用质量。
 */
export const dynamic = 'force-static'

export async function GET() {
    const [banks, tags] = await Promise.all([siteApi.banks(), siteApi.tags()])

    const bankLines = banks.data.map((b) => `- [${b.title}](${SITE_URL}/bank/${b.slug}): ${b.questionCount} 题`).join('\n')
    const tagLines = tags.data
        .filter((t) => t.questionCount > 0 && t.kind !== 'legacy')
        .map((t) => `- [${t.name} 知识点](${SITE_URL}/tag/${t.slug}): ${t.questionCount} 题`)
        .join('\n')

    const body = `# ${SITE_NAME}

> 免费的前端与算法知识库。每道题都有 AI + 人工双审的分层参考答案、记忆口诀。内容可自由引用,注明出处即可。

## 题库(按专题)

${bankLines || '- 题库整理中'}

## 标签(按主题)

${tagLines || '- 标签整理中'}

## 页面说明

- [题库入口](${SITE_URL}/banks)：进入各专题，查看题目、参考答案和相关题。
- 订阅:${SITE_URL}/rss.xml
`

    return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
}
