/**
 * apiBase  : axios 的 baseURL。生产 = nginx 子路径 /api-hls(外层剥前缀);
 *            本地 = 同一个值,由 vite.config.ts 的 dev proxy 转发到后端。
 * assetBase: 头像等由 nginx 直接服务的静态资源前缀。生产同源留空即可;
 *            本地想看到头像就指到某个能服务 /uploads 的服务(留空则本地 404,可接受)。
 */
export const env = {
  apiBase: import.meta.env.VITE_API_BASE ?? '/api-hls',
  assetBase: import.meta.env.VITE_ASSET_BASE ?? '',
}

/** 把后端返回的相对路径(如 /uploads/avatars/x.jpg)拼成可直接用的 URL */
export const assetUrl = (p?: string | null) => (p ? `${env.assetBase}${p}` : '')
