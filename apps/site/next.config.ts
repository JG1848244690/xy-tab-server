import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    // SSG 静态导出(plan §3.1):构建产物是纯静态文件,nginx 直接服务,
    // 服务器上零 Node 进程零内存开销
    output: 'export',
    images: {
        // 静态导出不带图片优化服务;图片走本地 static + 原图直出(plan 已定)
        unoptimized: true,
    },
    // 构建期拉 /public/* 数据的 API 地址;CI 与本地都从这里取
    env: {
        SITE_API_BASE: process.env.SITE_API_BASE ?? 'https://hls.kskbl.com.cn/api-hls',
    },
    experimental: {
        // Windows 下 next build 的 worker 进程会随机崩一个,报出误导性的
        // "missing generateStaticParams()" —— 关掉 worker 线程,构建慢一点但稳;
        // Linux(CI)不受此影响,该开关无副作用
        workerThreads: false,
        // 单 worker 串行收集,规避 Windows 上的并发崩溃
        cpus: 1,
    },
}

export default nextConfig
