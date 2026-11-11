/**
 * 用当前规则重算所有题目的三级标签(方向 / 技术栈 / 知识点)。
 *
 * 用法:
 *   DRY_RUN=1 npx tsx scripts/reclassify-taxonomy.ts   # 只打印差异
 *   npx tsx scripts/reclassify-taxonomy.ts             # 写库
 *
 * 注意:只会改 direction / tech_stack / knowledge_points / tags,
 * 不动标题、正文、状态。
 */
import 'dotenv/config'
import postgres from 'postgres'
import { classifyQuestion } from '../src/routes/questions/taxonomy.js'

const DRY_RUN = process.env.DRY_RUN === '1'
const sql = postgres(process.env.DATABASE_URL!, { max: 4 })

type Row = {
    id: string
    slug: string | null
    title: string
    direction: string | null
    tech_stack: string | null
    knowledge_points: string[] | null
    tags: string[] | null
    bank_slug: string | null
}

const rows = await sql<Row[]>`
  select q.id, q.slug, q.title, q.direction, q.tech_stack,
         q.knowledge_points, q.tags, b.slug as bank_slug
  from questions q
  left join banks b on b.id = q.bank_id
  where q.status = 'approved'
  order by q.title
`

let changed = 0
const samples: string[] = []

for (const row of rows) {
    const next = classifyQuestion({
        title: row.title,
        tags: row.tags,
        bankSlug: row.bank_slug,
    })

    const same =
        row.direction === next.direction &&
        row.tech_stack === next.techStack &&
        JSON.stringify(row.knowledge_points ?? []) === JSON.stringify(next.knowledgePoints) &&
        JSON.stringify(row.tags ?? []) === JSON.stringify(next.tags)

    if (same) continue
    changed++

    if (samples.length < 25) {
        samples.push(
            [
                row.title,
                `  旧: ${row.tech_stack ?? '-'} | ${(row.knowledge_points ?? []).join(' ')}`,
                `  新: ${next.techStack} | ${next.knowledgePoints.join(' ')}`,
            ].join('\n'),
        )
    }

    if (!DRY_RUN) {
        await sql`
          update questions set
            direction = ${next.direction},
            tech_stack = ${next.techStack},
            knowledge_points = ${sql.json(next.knowledgePoints)},
            tags = ${sql.json(next.tags)},
            updated_at = now()
          where id = ${row.id}
        `
    }
}

console.log(`${DRY_RUN ? '[dry-run] ' : ''}总计 ${rows.length} 题,需要更新 ${changed} 题`)
console.log(samples.join('\n\n'))

await sql.end()
