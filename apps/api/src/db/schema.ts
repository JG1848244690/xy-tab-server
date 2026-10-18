/**
 * hlsEdu 数据库 schema
 *
 * 对应旧 NestJS + MySQL 项目的 6 张表(视频相关的 videos / collections /
 * learning_progress 本轮不迁)。差异点见每张表的注释。
 */
import {
    boolean,
    date,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    vector,
    varchar,
} from 'drizzle-orm/pg-core';
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
/** questions.status / articles.status:公开站的内容审核状态(面试站 P0)。
 *  与 question_status(练习进度)是两回事 —— 一个管内容能不能见公网,一个管用户练没练 */
export const reviewStatusEnum = pgEnum('review_status', [
    'draft',
    'pending_review',
    'approved',
    'rejected',
]);

// ============================================================
// users
// 旧表 password 存 bcrypt hash(Nest 侧 bcrypt.hash(pw, 10)),原样保留以便搬存量数据
// ============================================================

export const users = pgTable(
    'users',
    {
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
    },
    (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

export const selectUsersSchema = createSelectSchema(users);
// 密码哈希绝不能进响应体,这里直接 omit
export const selectUserSchema = selectUsersSchema.omit({ password: true });
export const insertUsersSchema = createInsertSchema(users).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

// ============================================================
// banks —— 题库/合集(面试站 P0):聚合页是铺页面主力
// ============================================================

export const banks = pgTable(
    'banks',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: varchar('slug', { length: 255 }).notNull(),
        title: varchar('title', { length: 255 }).notNull(),
        description: text('description'),
        // 封面路径(本地 static;图片上传 P3 才有,先存路径)
        cover: varchar('cover', { length: 500 }),
        tags: jsonb('tags').$type<string[]>(),
        // 归属与 questions 同口径:创建者可管理,删号级联
        createdBy: uuid('created_by')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [uniqueIndex('banks_slug_idx').on(t.slug)],
);

export const selectBanksSchema = createSelectSchema(banks);
export const insertBanksSchema = createInsertSchema(banks).omit({
    id: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
});

// ============================================================
// questions —— 题库
// ============================================================

export const questions = pgTable(
    'questions',
    {
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
        tags: jsonb('tags').$type<string[]>(),
        // 题库可见性:shared = 所有登录用户可见可练;private = 仅创建者。
        // 默认 shared —— 存量数据语义即共享,ALTER TABLE 加列时一并带上默认值
        visibility: questionVisibilityEnum('visibility').default('shared').notNull(),
        // 创建者,由 handler 注入、客户端不可传。
        // NOT NULL + FK CASCADE:本库历史题目已完成归属(见 docs runbook),
        // "无主人人可删"的宽容逻辑删除 —— 删号经 CASCADE 连带删掉名下题目
        createdBy: uuid('created_by')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),

        // ===== 面试站 P0:公开发布链(见 docs/interview-site-mvp-plan.md §2.1)=====
        // 审核状态:draft 建完没送审;pending_review 在 agent/人审队列;
        // approved 才会出现在公开读接口;rejected 不对外
        status: reviewStatusEnum('status').default('draft').notNull(),
        // AI 审核总分 0-100(agent 五维加权和)
        reviewScore: integer('review_score'),
        // 完整审核报告(分维度得分 + 修改建议),后台直接渲染
        reviewResult: jsonb('review_result').$type<Record<string, unknown>>(),
        // 内容指纹:agent 幂等 —— 题目没改(contentHash 不变)就不重审
        contentHash: varchar('content_hash', { length: 64 }),
        // SEO URL。由标题生成;存量题在迁移里给 q-<md5> 兜底,agent 清洗时再美化
        slug: varchar('slug', { length: 255 }),
        // 列表/meta/OG 摘要,agent 生成
        summary: text('summary'),
        publishedAt: timestamp('published_at', { mode: 'date' }),
        // 热榜计数(MVP 不做严格去重,P3 再按 IP+天去重)
        viewCount: integer('view_count').default(0).notNull(),
        // pgvector 语义向量:爬取管线 P3.5 的向量去重用(HNSW + cosine)
        embedding: vector('embedding', { dimensions: 1536 }),
        // 所属题库/合集;一题可不属于任何 bank
        bankId: uuid('bank_id').references(() => banks.id, { onDelete: 'set null' }),

        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [
        index('questions_created_at_idx').on(t.createdAt),
        // 支持 tags 的 @> 包含查询走 GIN 索引
        index('questions_tags_idx').using('gin', t.tags),
        // 可见性过滤(shared OR created_by = me)与 owner 权限校验都会扫这个
        index('questions_created_by_idx').on(t.createdBy),
        // 公开站按 slug 读详情
        uniqueIndex('questions_slug_idx').on(t.slug),
        // 公开列表:status + 发布时间排序
        index('questions_status_published_idx').on(t.status, t.publishedAt),
        // HNSW 向量索引(cosine 距离),P3.5 向量去重 top-k 用
        index('questions_embedding_idx').using(
            'hnsw',
            t.embedding.op('vector_cosine_ops'),
        ),
    ],
);

export const selectQuestionsSchema = createSelectSchema(questions);
export const insertQuestionsSchema = createInsertSchema(questions)
    // createdBy 同样由中间件注入(handler 里总会用当前用户覆盖),
    // 不 omit 掉的话会出现在 OpenAPI 契约里,让人以为可以伪造归属
    .omit({
        id: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        // 发布链字段全部系统管理(审核 agent / 发布动作),不走创建表单
        status: true,
        reviewScore: true,
        reviewResult: true,
        contentHash: true,
        slug: true,
        summary: true,
        publishedAt: true,
        viewCount: true,
        embedding: true,
    })
    .extend({
        // visibility 由前端出题/编辑表单选择,默认进共享题库
        visibility: z.enum(['shared', 'private']).default('shared'),
        // 前端 CreateQuestionDto 里 type/difficulty 是可选的,带默认值
        type: z.enum(['markdown', 'text']).default('text'),
        difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
        title: z.string().min(1),
        content: z.string(),
        answer: z.string(),
        bankId: z.string().uuid().optional(),
    });
export const updateQuestionsSchema = insertQuestionsSchema.partial();

// ============================================================
// question_stats —— 每用户每题的练习状态(复合主键)
// ============================================================

export const questionStats = pgTable(
    'question_stats',
    {
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
    },
    (t) => [
        primaryKey({ columns: [t.userId, t.questionId] }),
        // 统计页大量按 user_id + status 查询
        index('question_stats_user_status_idx').on(t.userId, t.status),
        // 最近完成列表按 first_correct_at 倒序
        index('question_stats_user_first_correct_idx').on(t.userId, t.firstCorrectAt),
    ],
);

export const selectQuestionStatsSchema = createSelectSchema(questionStats);

// ============================================================
// question_attempts —— 每次答题的明细流水
// is_correct: MySQL 是 tinyint 当布尔用,这里换 PG 真 boolean
// ============================================================

export const questionAttempts = pgTable(
    'question_attempts',
    {
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
    },
    (t) => [
        // 答题历史按 user + question 倒序
        index('question_attempts_user_question_idx').on(t.userId, t.questionId, t.createdAt),
        // 练习趋势图:某用户近 N 天的答题记录(按天 group by)
        index('question_attempts_user_created_idx').on(t.userId, t.createdAt),
    ],
);

export const selectQuestionAttemptsSchema = createSelectSchema(questionAttempts);
export const insertQuestionAttemptsSchema = createInsertSchema(questionAttempts).omit({
    id: true,
    createdAt: true,
});

// ============================================================
// todos —— 日历打卡,支持跨天事件(start_date ~ end_date)
// ============================================================

export const todos = pgTable(
    'todos',
    {
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
    },
    (t) => [
        // 按月查 / 按天查都按 start_date 范围扫
        index('todos_user_start_date_idx').on(t.userId, t.startDate),
    ],
);

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

// ============================================================
// 以下为面试站 P0 新增(见 docs/interview-site-mvp-plan.md §2.1)
// ============================================================

// ============================================================
// question_views —— 浏览去重流水(面试站 S4 反爬)
// 同一 IP 哈希 + 同一天 + 同一题 = 一行;unique 约束兜底重复插入
// ============================================================

export const questionViews = pgTable(
    'question_views',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        questionId: uuid('question_id')
            .notNull()
            .references(() => questions.id, { onDelete: 'cascade' }),
        // YYYY-MM-DD(UTC);按天分位,便于定期清理
        day: date('day').notNull(),
        // sha256(ip + day) 截断 32 位:不存裸 IP,保留去重能力
        ipHash: varchar('ip_hash', { length: 32 }).notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    },
    (t) => [
        uniqueIndex('question_views_dedup_idx').on(t.questionId, t.day, t.ipHash),
        index('question_views_day_idx').on(t.day),
    ],
);

// ============================================================
// articles —— 原创图文 / 荐文卡(kind 区分)
// ============================================================

/** articles.kind:own = 站内原创;curated = 外链导读(评论必填) */
export const articleKindEnum = pgEnum('article_kind', ['own', 'curated']);

export const articles = pgTable(
    'articles',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: varchar('slug', { length: 255 }).notNull(),
        title: varchar('title', { length: 255 }).notNull(),
        cover: varchar('cover', { length: 500 }),
        kind: articleKindEnum('kind').default('own').notNull(),
        // own:正文 markdown
        contentMd: text('content_md'),
        // curated:外链导读
        externalUrl: varchar('external_url', { length: 1000 }),
        sourceDomain: varchar('source_domain', { length: 255 }),
        // curated 必填 2-3 句点评(why worth reading)
        comment: text('comment'),
        excerpt: text('excerpt'),
        // 关联的题目 id(内链:文章 ↔ 题目互挂)
        relatedQuestionIds: jsonb('related_question_ids').$type<string[]>(),
        tags: jsonb('tags').$type<string[]>(),
        // 审核链与 questions 同构:agent 评分 + 阈值
        status: reviewStatusEnum('status').default('draft').notNull(),
        reviewScore: integer('review_score'),
        reviewResult: jsonb('review_result').$type<Record<string, unknown>>(),
        contentHash: varchar('content_hash', { length: 64 }),
        publishedAt: timestamp('published_at', { mode: 'date' }),
        viewCount: integer('view_count').default(0).notNull(),
        createdBy: uuid('created_by')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [
        uniqueIndex('articles_slug_idx').on(t.slug),
        index('articles_status_published_idx').on(t.status, t.publishedAt),
    ],
);

export const selectArticlesSchema = createSelectSchema(articles);
export const insertArticlesSchema = createInsertSchema(articles).omit({
    id: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
    status: true,
    reviewScore: true,
    reviewResult: true,
    contentHash: true,
    publishedAt: true,
    viewCount: true,
});

// ============================================================
// tag_registry —— 标签聚合页的介绍文案登记
// 有 ≥240 字介绍才允许聚合页被搜索引擎收录,空页 noindex(防薄内容惩罚)
// ============================================================

export const tagRegistry = pgTable(
    'tag_registry',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: varchar('slug', { length: 255 }).notNull(),
        name: varchar('name', { length: 100 }).notNull(),
        description: text('description'),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [uniqueIndex('tag_registry_slug_idx').on(t.slug)],
);

export const selectTagRegistrySchema = createSelectSchema(tagRegistry);

// ============================================================
// review_logs —— AI 审核轨迹审计:agent 每跑一次落一行
// ============================================================

export const reviewLogs = pgTable(
    'review_logs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        questionId: uuid('question_id')
            .notNull()
            .references(() => questions.id, { onDelete: 'cascade' }),
        // 触发时的内容指纹,便于回放"当时审的是什么版本"
        contentHash: varchar('content_hash', { length: 64 }),
        // agent 写回的状态判定
        verdict: reviewStatusEnum('verdict').notNull(),
        score: integer('score'),
        // 完整报告(五维得分 + 建议 + 口诀)
        report: jsonb('report').$type<Record<string, unknown>>(),
        model: varchar('model', { length: 100 }),
        latencyMs: integer('latency_ms'),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    },
    (t) => [index('review_logs_question_idx').on(t.questionId, t.createdAt)],
);

// ============================================================
// 爬取管线占位表(P3.5 才写逻辑,P0 建表定形状)
// 链路:source → crawl_run → staging_question →(agent 出题/审核)→ 正式表
// ============================================================

export const sources = pgTable(
    'sources',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        // 稳定标识,如 'juejin-rss' / 'zhihu-rss' / 'jd-mining'
        key: varchar('key', { length: 100 }).notNull(),
        name: varchar('name', { length: 255 }).notNull(),
        // 适配器类型:P3.5 的源适配器接口按这个分发
        kind: varchar('kind', { length: 50 }).notNull(),
        url: varchar('url', { length: 1000 }),
        enabled: boolean('enabled').default(true).notNull(),
        // robots 检查时间与结论,合规红线留痕
        robotsCheckedAt: timestamp('robots_checked_at', { mode: 'date' }),
        robotsAllowed: boolean('robots_allowed'),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    },
    (t) => [uniqueIndex('sources_key_idx').on(t.key)],
);

export const crawlRuns = pgTable(
    'crawl_runs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        sourceId: uuid('source_id')
            .notNull()
            .references(() => sources.id, { onDelete: 'cascade' }),
        status: varchar('status', { length: 20 }).default('running').notNull(),
        itemCount: integer('item_count').default(0).notNull(),
        notes: text('notes'),
        startedAt: timestamp('started_at', { mode: 'date' }).defaultNow().notNull(),
        finishedAt: timestamp('finished_at', { mode: 'date' }),
    },
);

export const stagingQuestions = pgTable(
    'staging_questions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        runId: uuid('run_id').references(() => crawlRuns.id, { onDelete: 'set null' }),
        sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'set null' }),
        // 原始情报:标题/链接只做选题线索,全链路原创化后不落原文(版权红线)
        rawTitle: text('raw_title'),
        rawUrl: varchar('raw_url', { length: 1000 }),
        // 近似去重指纹(simhash/minhash 的十六进制),管线②用
        fingerprint: varchar('fingerprint', { length: 128 }),
        // 适配器吐出的原始结构化载荷
        payload: jsonb('payload').$type<Record<string, unknown>>(),
        status: varchar('status', { length: 20 }).default('pending').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    },
    (t) => [index('staging_questions_status_idx').on(t.status, t.createdAt)],
);