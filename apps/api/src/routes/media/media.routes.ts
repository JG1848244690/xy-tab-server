import { createRoute, z } from '@hono/zod-openapi'
import { HttpStatusCodes, jsonContent, createMessageObjectSchema } from '../../lib/openapi.js'

/**
 * 图片统一管理(2026-10-26)
 *
 * 上传文件写到 static 子域目录(UPLOAD_DIR),DB 记录路径/URL/大小/上传人;
 * 「图库」页面按引用情况管理、清理孤儿图。
 * 上传:任何登录用户(有每日上限);列表/删除/清理:仅 admin。
 */

const tags = ['Media']

const mediaAssetSchema = z.object({
    id: z.string().uuid(),
    url: z.string(),
    path: z.string(),
    mime: z.string(),
    bytes: z.number(),
    uploadedBy: z.string().nullable(),
    createdAt: z.date(),
    /** 被多少篇题目/文章引用(0 = 未使用,可清理) */
    usage: z.number(),
})

const IdParamsSchema = z.object({ id: z.string().uuid() })

export const upload = createRoute({
    method: 'post',
    path: '/media/upload',
    tags,
    // multipart/form-data:file 字段(不在 OpenAPI 里声明 binay body,
    // 避免 zod-openapi 的 multipart 类型兼容问题;前端见 services/media-api.ts)
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ asset: mediaAssetSchema }),
            '上传成功,返回可引用的 URL',
        ),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(
            z.object({ message: z.string() }),
            '缺少 file 字段 / 空文件 / 非 multipart 请求',
        ),
        [HttpStatusCodes.PAYLOAD_TOO_LARGE]: jsonContent(
            z.object({ message: z.string() }),
            '单张图片超过 5MB',
        ),
        [HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE]: jsonContent(
            z.object({ message: z.string() }),
            '不是 png/jpeg/webp/gif',
        ),
        [HttpStatusCodes.TOO_MANY_REQUESTS]: jsonContent(
            z.object({ message: z.string() }),
            '今日上传数量已达上限',
        ),
    },
})

export const list = createRoute({
    method: 'get',
    path: '/media',
    tags,
    request: {
        query: z.object({
            page: z.coerce.number().int().positive().default(1),
            size: z.coerce.number().int().positive().max(60).default(24),
            /** 只看未使用(用于清理) */
            unused: z.enum(['1', '0']).optional(),
            search: z.string().max(200).optional(),
        }),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                data: z.array(mediaAssetSchema),
                total: z.number(),
                page: z.number(),
                size: z.number(),
                counts: z.object({ all: z.number(), unused: z.number() }),
            }),
            '图库列表(含引用次数)',
        ),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(
            z.object({ message: z.string() }),
            '仅 admin 可见',
        ),
    },
})

export const remove = createRoute({
    method: 'delete',
    path: '/media/{id}',
    tags,
    request: { params: IdParamsSchema },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            createMessageObjectSchema('success'),
            '删除成功(文件与记录一起删)',
        ),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(
            z.object({ message: z.string() }),
            '仅 admin 可删',
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            z.object({ message: z.string() }),
            '图片不存在',
        ),
        [HttpStatusCodes.CONFLICT]: jsonContent(
            z.object({ message: z.string() }),
            '图片仍被题目/文章引用,先删正文里的引用',
        ),
    },
})

export const cleanup = createRoute({
    method: 'post',
    path: '/media/cleanup',
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({ deleted: z.number() }),
            '删除所有未被引用的图片',
        ),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(
            z.object({ message: z.string() }),
            '仅 admin 可操作',
        ),
    },
})

export type UploadRoute = typeof upload
export type ListRoute = typeof list
export type RemoveRoute = typeof remove
export type CleanupRoute = typeof cleanup
