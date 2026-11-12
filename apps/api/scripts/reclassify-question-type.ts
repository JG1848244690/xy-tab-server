/**
 * 重算题目的「代码题 / 理论题」类型。
 *
 *   DRY_RUN=1 npx tsx scripts/reclassify-question-type.ts
 *   npx tsx scripts/reclassify-question-type.ts
 */
import 'dotenv/config'
import postgres from 'postgres'
import { detectQuestionType } from '../src/lib/question-type.js'

const DRY_RUN = process.env.DRY_RUN === '1'
const sql = postgres(process.env.DATABASE_URL!, { max: 4 })

type Row = {
    id: string
    title: string
    type: string
    content: string | null
    answer: string | null
}

const rows = await sql<Row[]>`
  select id, title, type, content, answer
  from questions
  where status = 'approved'
  order by title
`

let changed = 0
const toCode: string[] = []
const toTheory: string[] = []

for (const row of rows) {
    const next = detectQuestionType(row)
    if (next === row.type) continue
    changed++

    if (next === 'markdown' && toCode.length < 10) toCode.push(`  + ${row.title}`)
    if (next === 'text' && toTheory.length < 10) toTheory.push(`  - ${row.title}`)

    if (!DRY_RUN) {
        await sql`update questions set type = ${next}, updated_at = now() where id = ${row.id}`
    }
}

const counts = await sql<{ type: string; n: number }[]>`
  select type, count(*)::int as n from questions where status = 'approved' group by 1 order by 2 desc
`

console.log(`${DRY_RUN ? '[dry-run] ' : ''}共 ${rows.length} 题,需要调整 ${changed} 题`)
console.log('调整后分布:', counts.map((c) => `${c.type}=${c.n}`).join(' '))
console.log('\n改为代码题(示例):\n' + toCode.join('\n'))
console.log('\n改为理论题(示例):\n' + toTheory.join('\n'))

await sql.end()
