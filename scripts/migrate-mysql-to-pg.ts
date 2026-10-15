/**
 * MySQL → PostgreSQL 数据迁移(hlsEdu 旧库 → 新库)
 *
 * 用法:
 *   pnpm db:import --dry-run     只检查不写入(强烈建议先跑这个)
 *   pnpm db:import                实际导入
 *   pnpm db:import --truncate     导入前清空目标表(默认不清空)
 *
 * MySQL 连接信息从环境变量读,密码没设默认值的会交互式询问(不回显、不落盘):
 *   MYSQL_HOST(默认 localhost) MYSQL_PORT(默认 3306)
 *   MYSQL_USER(默认 root)       MYSQL_PASSWORD(无默认,交互式问)
 *   MYSQL_DATABASE(默认 hls_edu)
 *   DATABASE_URL 目标 PG 连接串(复用 .env)
 *
 * 主要类型转换(对照旧 TypeORM 实体):
 *   varchar(36) 主键 → PG uuid。⚠ 旧代码用 @PrimaryColumn 而非
 *     @PrimaryGeneratedColumn,id 是应用生成的,不保证是合法 uuid ——
 *     非法的一律生成新 uuid,并同步改写所有引用它的外键值。
 *   enum(...)      → pgEnum,取值兼容,直接搬
 *   json tags      → jsonb,需重新序列化
 *   tinyint(0/1)   → boolean
 *   date           → date
 *   time           → varchar(8) 的 'HH:mm'(截掉秒)
 *   timestamp      → timestamp
 *
 * 密码字段原样搬 —— 旧项目就是 bcrypt hash,bcryptjs 直接兼容。
 */

import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import mysql from 'mysql2/promise'
import postgres from 'postgres'

// 只借 .env 里的 DATABASE_URL,不 import src/env.ts ——
// 那个模块要求 JWT_SECRET 等全量变量齐备,迁移脚本没必要依赖它
expand(config())

/** mysql2 返回的动态行:列名不能静态知道,统一按 unknown 处理 */
type Row = Record<string, unknown>

// ---------- 命令行参数 ----------
const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const TRUNCATE = argv.includes('--truncate')

// ---------- 交互式读取密码 ----------
function askSecret(prompt: string): Promise<string> {
    // 交互终端下不回显;CI/管道下没有 TTY,直接报错让人用环境变量
    if (!process.stdin.isTTY) {
        throw new Error(`非交互环境:请用环境变量提供 ${prompt.replace(/[:：].*/, '')}`)
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    return new Promise((resolve) => {
        process.stdout.write(prompt)
        rl.question('', (answer) => {
            rl.close()
            process.stdout.write('\n')
            resolve(answer)
        })
        // 关掉 echo
        ;(rl as unknown as { _writeToOutput?: (s: string) => void })._writeToOutput = (
            _s: string,
        ) => {}
    })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

// ---------- MySQL → JS 的字段转换 ----------

/** MySQL date 列,mysql2 默认返回 JS Date;只取日期部分 */
const toDateString = (v: unknown): string | null => {
    if (v === null || v === undefined) return null
    if (typeof v === 'string') return v.slice(0, 10)
    if (v instanceof Date) {
        // 用本地日期分量,不要 toISOString(会按时区偏移,差一天)
        const y = v.getFullYear()
        const m = String(v.getMonth() + 1).padStart(2, '0')
        const d = String(v.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
    }
    return String(v).slice(0, 10)
}

/** MySQL time 列('HH:mm:ss')→ 'HH:mm' */
const toTimeString = (v: unknown): string | null => {
    if (v === null || v === undefined) return null
    if (typeof v === 'string') return v.slice(0, 5)
    if (v instanceof Date) {
        return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`
    }
    return String(v).slice(0, 5)
}

/** MySQL tinyint(0/1) → PG boolean。已是 boolean 或 0/1 数字都兼容 */
const toBoolean = (v: unknown): boolean => v === true || v === 1 || v === '1'

/** MySQL timestamp → Date;mysql2 已按本地时区解析,这里不再加工 */
const toTimestamp = (v: unknown): Date | null => {
    if (v === null || v === undefined) return null
    return v instanceof Date ? v : new Date(String(v))
}

/**
 * MySQL `json` 列 → PG jsonb。
 *
 * ⚠ 这里**绝对不能** JSON.stringify。
 * mysql2 会把 json 列直接解析成 JS 值(数组/对象),而 postgres.js 对 jsonb
 * 参数**自己会 JSON.stringify 一次** —— 我们再 stringify 就变成双重编码,
 * PG 里存的是 JSON 字符串 `"[\"Promise\"]"` 而不是数组 `["Promise"]`。
 *
 * 症状(都已在真实数据上复现过):
 *   - `/stats/tag-distribution` 直接 500:cannot extract elements from a scalar
 *   - `/questions?tag=算法` 的 `tags @> '["算法"]'` 永远为假 → **静默返回空集**,
 *     比 500 更难发现
 * 注意老的 MySQL 数据本身是对的(json_type = ARRAY),坏的是迁移这一步。
 *
 * 所以:数组/对象原样透传给 postgres.js;字符串只在能解析出数组/对象时才
 * 解析(兼容 mysql2 未自动解析、或列为 TEXT 的情况)。
 */
/**
 * postgres.js 对 jsonb 参数接受的 JS 值(对应 node_modules/postgres/types 里的
 * JSONValue,只是那个类型没有单独导出)。用精确类型而不是 any,和仓库约定一致。
 */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const toJsonb = (v: unknown): JsonValue | null => {
    if (v === null || v === undefined) return null
    if (typeof v === 'string') {
        try {
            const parsed: unknown = JSON.parse(v)
            return typeof parsed === 'object' && parsed !== null ? (parsed as JsonValue) : v
        } catch {
            return v
        }
    }
    return v as JsonValue
}

/** 统一取出 string[] —— 兼容已解析的数组和(可能双重编码的)JSON 字符串 */
const toStringArray = (v: unknown): string[] => {
    const arr = Array.isArray(v) ? v : typeof v === 'string' ? safeParseArray(v) : []
    return arr.filter((x): x is string => typeof x === 'string')
}

const safeParseArray = (s: string): unknown[] => {
    try {
        const p: unknown = JSON.parse(s)
        return Array.isArray(p) ? p : []
    } catch {
        return []
    }
}

// ---------- 主流程 ----------

async function main() {
    const MYSQL_HOST = process.env.MYSQL_HOST ?? 'localhost'
    const MYSQL_PORT = Number(process.env.MYSQL_PORT ?? 3306)
    const MYSQL_USER = process.env.MYSQL_USER ?? 'root'
    const MYSQL_DATABASE = process.env.MYSQL_DATABASE ?? 'hls_edu'
    const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD ?? (await askSecret('MySQL 密码: '))

    const DATABASE_URL = process.env.DATABASE_URL
    if (!DATABASE_URL) {
        throw new Error('缺少 DATABASE_URL —— 先 cp .env.example .env 并填写')
    }

    console.log(`\n源      : mysql://${MYSQL_USER}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`)
    console.log(`目标    : ${DATABASE_URL.replace(/:[^:@/]+@/, ':***@')}`)
    console.log(`模式    : ${DRY_RUN ? 'dry-run(不写入)' : '实际写入'}${TRUNCATE ? ' + 先清空目标表' : ''}\n`)

    // 连不上源库/目标库是最常见的失败,给一句能照着做的话,而不是甩原始堆栈
    let my: mysql.Connection
    try {
        my = await mysql.createConnection({
            host: MYSQL_HOST,
            port: MYSQL_PORT,
            user: MYSQL_USER,
            password: MYSQL_PASSWORD,
            database: MYSQL_DATABASE,
            // date 列要拿字符串自己转:mysql2 默认会按本地时区解析成 JS Date,
            // 再用 getDate() 取分量时容易差一天。(TIME 列本来就返回字符串。)
            dateStrings: ['DATE'],
        })
    } catch (err) {
        console.error(
            `\n✗ 连不上源 MySQL(${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}):` +
                `\n  ${err instanceof Error ? err.message : String(err)}\n` +
                `  检查:MySQL 服务是否在跑、库名对不对、密码是否正确` +
                `(用 MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE 覆盖默认值)\n`,
        )
        process.exit(1)
    }

    const pg = postgres(DATABASE_URL, { max: 1 })
    try {
        await pg`SELECT 1`
    } catch (err) {
        console.error(
            `\n✗ 连不上目标 PostgreSQL(DATABASE_URL):` +
                `\n  ${err instanceof Error ? err.message : String(err)}\n` +
                `  检查:.env 里的 DATABASE_URL,以及 docker compose ps -a 看库是否在跑\n`,
        )
        await my.end()
        process.exit(1)
    }

    try {
        // ---------- 1. 读源数据(只查一遍,后面的计数/id 检查都从内存里算) ----------
        console.log('── 读取源数据 ──')

        /** 表不存在就当空表 —— 首次迁移时可能只建了部分表 */
        const readTable = async (table: string): Promise<Row[]> => {
            try {
                const [rows] = await my.query(`SELECT * FROM \`${table}\``)
                return rows as Row[]
            } catch {
                console.log(`  ⚠ 表 ${table} 不存在,按空表处理`)
                return []
            }
        }

        const users = await readTable('users')
        const questions = await readTable('questions')
        const stats = await readTable('question_stats')
        const attempts = await readTable('question_attempts')
        const todos = await readTable('todos')
        for (const [name, rows] of [
            ['users', users],
            ['questions', questions],
            ['question_stats', stats],
            ['question_attempts', attempts],
            ['todos', todos],
        ] as const) {
            console.log(`  ${name.padEnd(20)} ${rows.length}`)
        }

        // ---------- 2. 主键合法性检查,建 id 映射表 ----------
        console.log('\n── id 合法性检查 ──')
        // 旧库用 @PrimaryColumn(varchar 36) 而非 @PrimaryGeneratedColumn,
        // id 由应用生成,不保证是合法 uuid。PG 的 uuid 列会直接拒绝非法值,
        // 所以非法的必须换成新 uuid,并且所有引用它的地方都要跟着改。
        const idMap = new Map<string, string>() // 旧 id → 新 uuid

        const scanIds = (rows: Row[], label: string) => {
            const ids = new Set(rows.map((r) => String(r.id)))
            let legal = 0
            for (const old of ids) {
                if (isUuid(old)) legal++
                else idMap.set(old, randomUUID())
            }
            console.log(`  ${label.padEnd(20)} 合法 ${legal} / 需重映射 ${ids.size - legal}`)
        }
        scanIds(users, 'users.id')
        scanIds(questions, 'questions.id')
        scanIds(attempts, 'question_attempts.id')

        if (idMap.size > 0) {
            console.log(`\n  ⚠ ${idMap.size} 个 id 不是合法 uuid,已生成新值,所有引用会同步改写:`)
            for (const [oldId, newId] of [...idMap].slice(0, 5)) {
                console.log(`     ${oldId}  →  ${newId}`)
            }
            if (idMap.size > 5) console.log(`     ... 另有 ${idMap.size - 5} 个`)
        } else if (users.length + questions.length + attempts.length > 0) {
            console.log('  ✓ 全部 id 都是合法 uuid,可原样保留')
        } else {
            console.log('  · 源库没有任何数据,跳过 id 检查')
        }

        /** 旧 id → 新 uuid(合法则原样返回) */
        const remap = (old: unknown): string | null =>
            old === null || old === undefined ? null : (idMap.get(String(old)) ?? String(old))

        // ---------- 3. 转换 ----------
        console.log('\n── 转换 ──')

        // 行对象的键直接用 PG 的 snake_case 列名 —— postgres.js 的批量 insert
        // 会拿第一行的键当列名,不用另外传列名数组,也就不会写错列映射。
        const pgUsers = users.map((r) => ({
            id: remap(r.id)!,
            email: String(r.email),
            password: String(r.password), // bcrypt hash 原样搬
            username: r.username === null ? null : String(r.username),
            avatar_path: r.avatar_path === null ? null : String(r.avatar_path),
            created_at: toTimestamp(r.created_at)!,
            updated_at: toTimestamp(r.updated_at)!,
        }))

        const pgQuestions = questions.map((r) => ({
            id: remap(r.id)!,
            title: String(r.title),
            type: String(r.type ?? 'text') as 'markdown' | 'text',
            content: String(r.content),
            answer: String(r.answer),
            difficulty: String(r.difficulty ?? 'medium') as 'easy' | 'medium' | 'hard',
            tags: toJsonb(r.tags),
            created_by: remap(r.created_by),
            created_at: toTimestamp(r.created_at)!,
            updated_at: toTimestamp(r.updated_at)!,
        }))

        // 关联行只有在两端 id 都存在于 users/questions 时才导入,
        // 否则 PG 的 uuid 类型会直接拒绝 —— 这也是一份完整性检查
        const knownUsers = new Set(pgUsers.map((u) => u.id))
        const knownQuestions = new Set(pgQuestions.map((q) => q.id))

        const pgStats = stats
            .map((r) => ({
                user_id: remap(r.user_id)!,
                question_id: remap(r.question_id)!,
                total_attempts: Number(r.total_attempts ?? 0),
                correct_attempts: Number(r.correct_attempts ?? 0),
                last_attempt_at: toTimestamp(r.last_attempt_at),
                first_correct_at: toTimestamp(r.first_correct_at),
                best_time: r.best_time === null ? null : Number(r.best_time),
                status: String(r.status ?? 'not_started') as
                    | 'not_started'
                    | 'in_progress'
                    | 'completed',
            }))
            .filter((s) => knownUsers.has(s.user_id) && knownQuestions.has(s.question_id))

        const pgAttempts = attempts
            .map((r) => ({
                id: remap(r.id)!,
                user_id: remap(r.user_id)!,
                question_id: remap(r.question_id)!,
                user_answer: r.user_answer === null ? null : String(r.user_answer),
                is_correct: toBoolean(r.is_correct),
                time_spent: r.time_spent === null ? null : Number(r.time_spent),
                attempt_count: Number(r.attempt_count ?? 1),
                created_at: toTimestamp(r.created_at)!,
            }))
            .filter((a) => knownUsers.has(a.user_id) && knownQuestions.has(a.question_id))

        const pgTodos = todos
            .map((r) => ({
                id: remap(r.id)!,
                user_id: remap(r.user_id)!,
                start_date: toDateString(r.start_date)!,
                end_date: toDateString(r.end_date)!,
                start_time: toTimeString(r.start_time) ?? '00:00',
                end_time: toTimeString(r.end_time) ?? '23:59',
                content: String(r.content),
                color: String(r.color ?? '#00a76f'),
                description: r.description === null ? null : String(r.description),
                all_day: toBoolean(r.all_day),
                completed: toBoolean(r.completed),
                created_at: toTimestamp(r.created_at)!,
                updated_at: toTimestamp(r.updated_at)!,
            }))
            .filter((t) => knownUsers.has(t.user_id))

        console.log(`  users=${pgUsers.length}`)
        console.log(`  questions=${pgQuestions.length}`)
        console.log(`  question_stats=${pgStats.length}${pgStats.length !== stats.length ? ` (丢弃 ${stats.length - pgStats.length} 条孤儿引用)` : ''}`)
        console.log(`  question_attempts=${pgAttempts.length}${pgAttempts.length !== attempts.length ? ` (丢弃 ${attempts.length - pgAttempts.length} 条孤儿引用)` : ''}`)
        console.log(`  todos=${pgTodos.length}${pgTodos.length !== todos.length ? ` (丢弃 ${todos.length - pgTodos.length} 条孤儿引用)` : ''}`)

        // 标签分布:打出来方便核对 jsonb 转换是否正确(中文标签在这最容易被搞坏)
        const tagCount = new Map<string, number>()
        for (const q of pgQuestions) {
            for (const t of toStringArray(q.tags)) {
                tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
            }
        }
        if (tagCount.size > 0) {
            console.log(`\n  标签分布(共 ${tagCount.size} 个):`)
            for (const [t, n] of [...tagCount].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
                console.log(`    ${String(n).padStart(4)}  ${t}`)
            }
        }

        if (DRY_RUN) {
            console.log('\n── dry-run 结束,未写入任何数据 ──')
            console.log('去掉 --dry-run 即可实际导入\n')
            return
        }

        // ---------- 5. 写入(单事务,失败整体回滚)----------
        console.log('\n── 写入 PostgreSQL ──')
        await pg.begin(async (tx) => {
            if (TRUNCATE) {
                console.log('  清空目标表…')
                await tx`TRUNCATE question_attempts, question_stats, questions, todos, users CASCADE`
            }

            // 按依赖顺序:users → questions → stats/attempts → todos。
            // 行对象的键就是列名(见上面第 3 步的注释)
            if (pgUsers.length) {
                await tx`INSERT INTO users ${tx(pgUsers)}`
                console.log(`  ✓ users ${pgUsers.length}`)
            }
            if (pgQuestions.length) {
                await tx`INSERT INTO questions ${tx(pgQuestions)}`
                console.log(`  ✓ questions ${pgQuestions.length}`)
            }
            if (pgStats.length) {
                await tx`INSERT INTO question_stats ${tx(pgStats)}`
                console.log(`  ✓ question_stats ${pgStats.length}`)
            }
            if (pgAttempts.length) {
                await tx`INSERT INTO question_attempts ${tx(pgAttempts)}`
                console.log(`  ✓ question_attempts ${pgAttempts.length}`)
            }
            if (pgTodos.length) {
                await tx`INSERT INTO todos ${tx(pgTodos)}`
                console.log(`  ✓ todos ${pgTodos.length}`)
            }
        })
        console.log('\n✓ 迁移完成(已提交事务)\n')
    } catch (err) {
        // 23505 = unique violation。重复导入时最常见的失败:
        // users.email 和 question_stats 的复合主键都会撞
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
            console.error(
                '\n✗ 目标库已有数据,唯一键冲突。事务已回滚,目标库未被改动。' +
                    '\n  重跑并加上 --truncate 清空目标表:\n' +
                    '    pnpm db:import --truncate\n' +
                    `  冲突详情: ${(err as Error).message}\n`,
            )
        } else {
            console.error('\n✗ 迁移失败,事务已回滚,目标库未被改动:', err)
        }
        process.exitCode = 1
    } finally {
        await my.end()
        await pg.end()
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
