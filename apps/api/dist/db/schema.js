/**
 * hlsEdu 数据库 schema
 *
 * 对应旧 NestJS + MySQL 项目的 6 张表(视频相关的 videos / collections /
 * learning_progress 本轮不迁)。差异点见每张表的注释。
 */
import { boolean, date, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar, jsonb, } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
// ============================================================
// enum 类型
// MySQL 的 enum(...) → PG 的 pgEnum,建表时约束住取值,与原行为一致
// ============================================================
/** questions.type */
export const questionTypeEnum = pgEnum('question_type', ['markdown', 'text']);
/** questions.difficulty */
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);
/** questions.visibility:shared = 所有登录用户可见可练;private = 仅创建者 */
export const questionVisibilityEnum = pgEnum('question_visibility', ['shared', 'private']);
/** question_stats.status */
export const questionStatusEnum = pgEnum('question_status', [
    'not_started',
    'in_progress',
    'completed',
]);
// ============================================================
// users
// 旧表 password 存 bcrypt hash(Nest 侧 bcrypt.hash(pw, 10)),原样保留以便搬存量数据
// ============================================================
export const users = pgTable('users', {
    // MySQL 是 varchar(36) 存 uuid 字符串;这里换 PG 原生 uuid。
    // 存量数据不一定都是合法 uuid(旧代码是应用生成 id,没约束),
    // 由 scripts/migrate-mysql-to-pg.ts 统一检查并重映射
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    // bcrypt hash,不返回给前端
    password: varchar('password', { length: 255 }).notNull(),
    username: varchar('username', { length: 100 }),
    // 头像存储路径(不含域名)。本轮没有 /users/avatar 接口,先保留字段
    avatarPath: varchar('avatar_path', { length: 500 }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
}, (t) => [uniqueIndex('users_email_idx').on(t.email)]);
export const selectUsersSchema = createSelectSchema(users);
// 密码哈希绝不能进响应体,这里直接 omit
export const selectUserSchema = selectUsersSchema.omit({ password: true });
export const insertUsersSchema = createInsertSchema(users).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// ============================================================
// questions —— 题库
// ============================================================
export const questions = pgTable('questions', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 255 }).notNull(),
    type: questionTypeEnum('type').default('text').notNull(),
    content: text('content').notNull(),
    answer: text('answer').notNull(),
    difficulty: difficultyEnum('difficulty').default('medium').notNull(),
    /**
     * 标签数组。MySQL 是 json 列,这里用 jsonb —— 支持 @> 包含操作符,
     * 正好替换掉旧代码里的 JSON_CONTAINS(q.tags, '"x"')
     */
    tags: jsonb('tags').$type(),
    // 题库可见性:shared = 所有登录用户可见可练;private = 仅创建者。
    // 默认 shared —— 存量数据语义即共享,ALTER TABLE 加列时一并带上默认值
    visibility: questionVisibilityEnum('visibility').default('shared').notNull(),
    // 创建者,由 handler 注入、客户端不可传。
    // NOT NULL + FK CASCADE:本库历史题目已完成归属(见 docs runbook),
    // "无主人人可删"的宽容逻辑删除 —— 删号经 CASCADE 连带删掉名下题目
    createdBy: uuid('created_by')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
}, (t) => [
    index('questions_created_at_idx').on(t.createdAt),
    // 支持 tags 的 @> 包含查询走 GIN 索引
    index('questions_tags_idx').using('gin', t.tags),
    // 可见性过滤(shared OR created_by = me)与 owner 权限校验都会扫这个
    index('questions_created_by_idx').on(t.createdBy),
]);
export const selectQuestionsSchema = createSelectSchema(questions);
export const insertQuestionsSchema = createInsertSchema(questions)
    // createdBy 同样由中间件注入(handler 里总会用当前用户覆盖),
    // 不 omit 掉的话会出现在 OpenAPI 契约里,让人以为可以伪造归属
    .omit({ id: true, createdBy: true, createdAt: true, updatedAt: true })
    .extend({
    // visibility 由前端出题/编辑表单选择,默认进共享题库
    visibility: z.enum(['shared', 'private']).default('shared'),
    // 前端 CreateQuestionDto 里 type/difficulty 是可选的,带默认值
    type: z.enum(['markdown', 'text']).default('text'),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    title: z.string().min(1),
    content: z.string(),
    answer: z.string(),
});
export const updateQuestionsSchema = insertQuestionsSchema.partial();
// ============================================================
// question_stats —— 每用户每题的练习状态(复合主键)
// ============================================================
export const questionStats = pgTable('question_stats', {
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
        .notNull()
        .references(() => questions.id, { onDelete: 'cascade' }),
    totalAttempts: integer('total_attempts').default(0).notNull(),
    correctAttempts: integer('correct_attempts').default(0).notNull(),
    lastAttemptAt: timestamp('last_attempt_at', { mode: 'date' }),
    firstCorrectAt: timestamp('first_correct_at', { mode: 'date' }),
    // 历史最快用时(秒),null = 还没答对过
    bestTime: integer('best_time'),
    status: questionStatusEnum('status').default('not_started').notNull(),
}, (t) => [
    primaryKey({ columns: [t.userId, t.questionId] }),
    // 统计页大量按 user_id + status 查询
    index('question_stats_user_status_idx').on(t.userId, t.status),
    // 最近完成列表按 first_correct_at 倒序
    index('question_stats_user_first_correct_idx').on(t.userId, t.firstCorrectAt),
]);
export const selectQuestionStatsSchema = createSelectSchema(questionStats);
// ============================================================
// question_attempts —— 每次答题的明细流水
// is_correct: MySQL 是 tinyint 当布尔用,这里换 PG 真 boolean
// ============================================================
export const questionAttempts = pgTable('question_attempts', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
        .notNull()
        .references(() => questions.id, { onDelete: 'cascade' }),
    userAnswer: text('user_answer'),
    isCorrect: boolean('is_correct').default(false).notNull(),
    // 本次作答用时(秒)
    timeSpent: integer('time_spent'),
    // 第几次尝试,从 1 开始
    attemptCount: integer('attempt_count').default(1).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (t) => [
    // 答题历史按 user + question 倒序
    index('question_attempts_user_question_idx').on(t.userId, t.questionId, t.createdAt),
    // 练习趋势图:某用户近 N 天的答题记录(按天 group by)
    index('question_attempts_user_created_idx').on(t.userId, t.createdAt),
]);
export const selectQuestionAttemptsSchema = createSelectSchema(questionAttempts);
export const insertQuestionAttemptsSchema = createInsertSchema(questionAttempts).omit({
    id: true,
    createdAt: true,
});
// ============================================================
// todos —— 日历打卡,支持跨天事件(start_date ~ end_date)
// ============================================================
export const todos = pgTable('todos', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    // MySQL 是 date 类型(无时分秒),这里保持 date
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    /**
     * MySQL 的 time 类型在 drizzle-pg 上支持不佳,且前端本来就当字符串用
     * ('HH:mm'),直接存 text 'HH:mm' 最省事,也避免驱动层的时区转换
     */
    startTime: varchar('start_time', { length: 8 }).default('00:00').notNull(),
    endTime: varchar('end_time', { length: 8 }).default('23:59').notNull(),
    content: text('content').notNull(),
    color: varchar('color', { length: 20 }).default('#00a76f').notNull(),
    description: text('description'),
    allDay: boolean('all_day').default(false).notNull(),
    completed: boolean('completed').default(false).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
}, (t) => [
    // 按月查 / 按天查都按 start_date 范围扫
    index('todos_user_start_date_idx').on(t.userId, t.startDate),
]);
export const selectTodosSchema = createSelectSchema(todos);
export const insertTodosSchema = createInsertSchema(todos)
    // userId 由 cookieAuth 中间件注入,不让客户端传 ——
    // 否则就是越权往别人名下写数据;而且它是 notNull,不 omit 掉校验必挂
    .omit({ id: true, userId: true, createdAt: true, updatedAt: true })
    .extend({
    // 前端可能传完整 ISO 时间串("2026-01-15T00:00:00.000Z"),
    // 这里只取日期部分,跟旧代码 new Date(dto.startDate) 的最终效果一致
    startDate: z.coerce.string().transform((v) => v.slice(0, 10)),
    endDate: z.coerce.string().transform((v) => v.slice(0, 10)),
    content: z.string().min(1),
    color: z.string().default('#00a76f'),
    startTime: z.string().default('00:00'),
    endTime: z.string().default('23:59'),
    allDay: z.boolean().default(false),
    completed: z.boolean().default(false),
    description: z.string().optional(),
});
