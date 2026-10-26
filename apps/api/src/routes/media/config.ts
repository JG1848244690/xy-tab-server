/**
 * media/config.ts —— 图片上传的运行时配置(2026-10-26)
 *
 * 为什么运行时读 process.env 而不是 env.ts 快照:
 * 测试要临时改 UPLOAD_DIR 指到临时目录;env.ts 在 import 时就 parse 完,改不动。
 */
import { resolve } from 'node:path'

/** 上传根目录(容器内挂载 static 子域目录) */
export function uploadDir(): string {
    return resolve(process.env.UPLOAD_DIR ?? './uploads')
}

/**
 * 对外访问前缀。生产 = https://static.kskbl.com.cn/uploads;
 * 本地默认走 API 自己的 /uploads/*(见 app.ts 的静态托管)。
 */
export function uploadPublicBase(): string {
    return (process.env.UPLOAD_PUBLIC_BASE ?? 'http://127.0.0.1:9999/uploads').replace(
        /\/$/,
        '',
    )
}

/** 单张图片上限:5MB(超过说明没压缩,直接拒绝) */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** 每用户每天最多上传多少张(admin 豁免;防存储滥用) */
export const DAILY_UPLOAD_LIMIT = 50

/** 允许的图片类型(靠魔数识别,不信客户端 content-type) */
export const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
