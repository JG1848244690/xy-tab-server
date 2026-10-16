/**
 * vitest 全局 setup:在所有测试文件的 import 之前执行。
 *
 * 集成测试(*.integration.test.ts)需要真库:TEST_DATABASE_URL 指向独立的
 * 测试数据库(CI 里是 service 容器,本地用 ssh 隧道连服务器的 hlse_test)。
 * db/index.ts 在模块加载时就读 DATABASE_URL,所以必须在这里抢先覆盖,
 * 让整个测试进程的 db 单例连到测试库 —— 绝不会碰到生产数据。
 *
 * 没配 TEST_DATABASE_URL 时(比如本地只跑单元测试)什么都不做,
 * 集成测试文件里用 describe.skipIf 自动跳过。
 */
if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}
