import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // 显式限定只扫 src:dist/ 里可能有上次 build 留下的编译产物,
        // 不排除的话同一批用例会跑两遍(测试数翻倍,还容易误判覆盖范围)
        include: ['src/**/*.{test,spec}.ts'],
        exclude: ['**/node_modules/**', '**/.git/**', 'dist/**'],
    },
})
