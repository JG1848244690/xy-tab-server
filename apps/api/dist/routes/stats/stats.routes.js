import { createRoute, z } from '@hono/zod-openapi';
import { HttpStatusCodes, createErrorSchema, jsonContent, } from '../../lib/openapi.js';
const tags = ['Stats'];
const difficultySchema = z.enum(['easy', 'medium', 'hard']);
const statusSchema = z.enum(['not_started', 'in_progress', 'completed']);
// ============================================================
// dashboard
// ============================================================
/**
 * videos 是必填字段 —— 旧 Nest 接口一直返回它,前端 home/page.tsx 直接读
 * stats.videos.totalVideos 等,缺字段会崩。
 *
 * 本轮视频模块不迁,这里返回结构完整的空数据。等视频接口做好后,
 * 把 videosSchema 换成真实数据即可,前端无需改动。
 */
const emptyVideosSchema = z.object({
    recentAdded: z.array(z.object({
        id: z.string().uuid(),
        title: z.string(),
        status: z.string(),
        createdAt: z.date(),
    })),
    recentWatched: z.array(z.object({
        id: z.number(),
        videoId: z.string(),
        videoTitle: z.string(),
        progressPercent: z.number(),
        lastWatchedAt: z.string(),
    })),
    totalVideos: z.number(),
    inProgress: z.number(),
    thisWeekAdded: z.number(),
});
const dashboardSchema = z.object({
    questions: z.object({
        recentAdded: z.array(z.object({
            id: z.string().uuid(),
            title: z.string(),
            difficulty: difficultySchema,
            createdAt: z.date(),
        })),
        recentAttempted: z.array(z.object({
            id: z.string().uuid(),
            questionId: z.string().uuid(),
            questionTitle: z.string(),
            isCorrect: z.boolean(),
            createdAt: z.date(),
        })),
        totalAttempts: z.number(),
        totalCorrect: z.number(),
        accuracy: z.number(),
        thisWeekAdded: z.number(),
        thisWeekAttempted: z.number(),
    }),
    videos: emptyVideosSchema,
    todos: z.object({
        todayCompleted: z.number(),
        todayTotal: z.number(),
        thisWeekCompleted: z.number(),
        thisWeekTotal: z.number(),
        completionRate: z.number(),
    }),
    summary: z.object({
        thisWeekQuestionsAdded: z.number(),
        thisWeekQuestionsAttempted: z.number(),
        thisWeekVideosAdded: z.number(),
        thisWeekTodosCompleted: z.number(),
    }),
});
export const dashboard = createRoute({
    method: 'get',
    path: '/stats/dashboard',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(dashboardSchema, '首页概览统计'),
    },
});
// ============================================================
// practice-trend
// ============================================================
const practiceTrendQuerySchema = z.object({
    days: z.coerce.number().int().positive().max(365).default(15),
    type: z.enum(['frequency', 'duration']).default('frequency'),
});
export const practiceTrend = createRoute({
    method: 'get',
    path: '/stats/practice-trend',
    tags,
    request: { query: practiceTrendQuerySchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(z.array(z.object({ date: z.string(), value: z.number() })), '近 N 天的练习趋势。frequency=每日次数,duration=每日分钟数'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(practiceTrendQuerySchema), '查询参数校验失败'),
    },
});
// ============================================================
// 饼图
// ============================================================
export const tagDistribution = createRoute({
    method: 'get',
    path: '/stats/tag-distribution',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(z.array(z.object({
            name: z.string(),
            value: z.number(),
            count: z.number(),
        })), '题库标签占比(按出现次数降序)'),
    },
});
export const difficultyDistribution = createRoute({
    method: 'get',
    path: '/stats/difficulty-distribution',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(z.array(z.object({
            name: z.string(),
            value: z.number(),
            count: z.number(),
            difficulty: difficultySchema,
        })), '题库难度占比。name 为中文标签'),
    },
});
// ============================================================
// 列表(均支持滚动分页)
// ============================================================
const pageQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    size: z.coerce.number().int().positive().max(100).default(10),
});
const incompleteItemSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    difficulty: difficultySchema,
    tags: z.array(z.string()).nullable(),
    createdAt: z.date(),
    stats: z.object({
        totalAttempts: z.number(),
        correctAttempts: z.number(),
        status: statusSchema,
    }),
});
export const incompleteQuestions = createRoute({
    method: 'get',
    path: '/stats/incomplete-questions',
    tags,
    request: { query: pageQuerySchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(z.object({
            data: z.array(incompleteItemSchema),
            total: z.number(),
            page: z.number(),
            size: z.number(),
            hasMore: z.boolean(),
        }), '未完成的题目(未开始 + 进行中)'),
    },
});
const simpleItemSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    difficulty: difficultySchema,
    tags: z.array(z.string()).nullable(),
    createdAt: z.date(),
});
export const recentAddedQuestions = createRoute({
    method: 'get',
    path: '/stats/recent-added-questions',
    tags,
    request: { query: pageQuerySchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(z.object({
            data: z.array(simpleItemSchema),
            total: z.number(),
            page: z.number(),
            size: z.number(),
            hasMore: z.boolean(),
        }), '最近添加的题目'),
    },
});
export const recentCompletedQuestions = createRoute({
    method: 'get',
    path: '/stats/recent-completed-questions',
    tags,
    request: { query: pageQuerySchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(z.object({
            data: z.array(z.object({
                id: z.string().uuid(),
                title: z.string(),
                difficulty: difficultySchema,
                tags: z.array(z.string()).nullable(),
                completedAt: z.date().nullable(),
                totalAttempts: z.number(),
            })),
            total: z.number(),
            page: z.number(),
            size: z.number(),
            hasMore: z.boolean(),
        }), '最近完成的题目,按首次答对时间倒序'),
    },
});
