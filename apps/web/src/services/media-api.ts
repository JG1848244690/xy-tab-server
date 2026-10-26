import { env } from '@/lib/env'
import { request } from '@/lib/request'

/**
 * 图片统一管理 API(2026-10-26)
 * 上传走 multipart(fetch,浏览器自动带 boundary);其余走 axios。
 */

export interface MediaAsset {
    id: string
    url: string
    path: string
    mime: string
    bytes: number
    uploadedBy: string | null
    createdAt: string
    /** 被题目/文章引用次数;0 = 未使用 */
    usage: number
}

export interface MediaListResponse {
    data: MediaAsset[]
    total: number
    page: number
    size: number
    counts: { all: number; unused: number }
}

export const mediaApi = {
    list: (params: { page?: number; size?: number; unused?: boolean } = {}) =>
        request
            .get<MediaListResponse>('/media', {
                params: {
                    page: params.page ?? 1,
                    size: params.size ?? 24,
                    ...(params.unused ? { unused: '1' } : {}),
                },
            })
            .then((r) => r.data),

    /** 上传单张图片(返回可直接写进 markdown 的 URL) */
    upload: async (file: File): Promise<MediaAsset> => {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch(`${env.apiBase}/media/upload`, {
            method: 'POST',
            credentials: 'include',
            body: fd,
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) {
            throw new Error(body?.message ?? `上传失败(${res.status})`)
        }
        return body.asset as MediaAsset
    },

    remove: (id: string) =>
        request.delete<{ message: string }>(`/media/${id}`).then((r) => r.data),

    cleanup: () =>
        request.post<{ deleted: number }>('/media/cleanup').then((r) => r.data),
}

/**
 * md-editor-rt 的 onUploadImg 适配:粘贴/拖拽/工具栏选图后,
 * 逐张上传并把 URL 回调给编辑器插入 markdown。
 */
export function uploadEditorImages(
    files: File[],
    callback: (urls: { url: string; alt: string; title: string }[]) => void,
): void {
    void Promise.all(files.map((f) => mediaApi.upload(f)))
        .then((assets) =>
            // alt 默认用文件名(去掉扩展名):渲染时会作为图注,用户可以再改
            callback(
                assets.map((a, i) => ({
                    url: a.url,
                    alt: (files[i]?.name ?? '').replace(/\.[^.]+$/, ''),
                    title: '',
                })),
            ),
        )
        .catch((err) => {
            console.error('图片上传失败', err)
            window.alert(err instanceof Error ? err.message : '图片上传失败')
        })
}
