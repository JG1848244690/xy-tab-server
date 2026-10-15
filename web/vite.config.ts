import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // 本地开发时模拟生产 nginx:剥掉 /api-hls 前缀再打后端
      '/api-hls': {
        target: process.env.VITE_DEV_BACKEND ?? 'http://127.0.0.1:9999',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api-hls/, ''),
      },
      // 头像等上传文件:新后端不服务 /uploads,本地看头像会 404,属预期
      '/uploads': {
        target: process.env.VITE_DEV_BACKEND ?? 'http://127.0.0.1:9999',
        changeOrigin: true,
      },
    },
  },
})
