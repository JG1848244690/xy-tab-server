import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // 显式限定只扫 src:dist/ 里可能有上次 build 留下的编译产物,
        // 不排除的话同一批用例会跑两遍(测试数翻倍,还容易误判覆盖范围)
        include: ['src/**/*.{test,spec}.ts'],
        exclude: ['**/node_modules/**', '**/.git/**', 'dist/**'],
        // 集成测试要连真实 PG(CI 的 service 容器 / 本地的隧道),
        // 迁移 + 多个请求串行,给宽一点的超时
        testTimeout: 30_000,
        hookTimeout: 30_000,
        // 多个集成测试文件会对同一个测试库各跑一次 migrate(),
        // 并行会抢迁移锁/重放迁移,串行最稳
        fileParallelism: false,
        // 每个文件独立的模块图:db 单例/连接池互不影响
        // (没有它,前一个文件 afterAll 的 client.end 会杀死后续文件的连接)
        isolate: true,
        setupFiles: ['./vitest.setup.ts'],
    },
})
