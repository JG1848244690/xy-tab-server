import { describe, expect, it } from 'vitest'
import {
    classifyQuestion,
    tagSlug,
    DIRECTIONS,
    TECH_STACKS,
    KNOWLEDGE_POINTS,
} from './taxonomy.js'

/**
 * 三级标签分类的回归用例。
 *
 * 这些 case 都来自 2026-10-28 首轮回填的真实误判:回填后的 tags 会带上一轮
 * 写入的方向名(Agent/LLM/前端…),如果分类器再拿 tags 当输入,就会自我强化。
 */
describe('classifyQuestion', () => {
    it('存储题带着 Agent/LLM 旧标签,也不能判成 Agent', () => {
        const r = classifyQuestion({
            title: '本地存储有哪一些？它们三者有什么区别？',
            tags: ['Agent', 'LLM', '生命周期', '存储', 'HTML'],
        })
        expect(r.direction).toBe('前端')
        expect(r.knowledgePoints).toContain('存储')
        expect(r.knowledgePoints).not.toContain('LLM')
    })

    it('direction 只看标题:旧 tags 里的 MySQL 不会把前端题拉去后端', () => {
        const r = classifyQuestion({
            title: 'POST 请求常见数据格式有哪些？如何选择？',
            tags: ['后端', 'MySQL', '类型转换', 'JavaScript'],
        })
        expect(r.direction).toBe('前端')
        expect(r.techStack).toBe('浏览器')
    })

    it('标题优先于标签:HTTP 题不会被旧 HTML 标签带走', () => {
        const r = classifyQuestion({
            title: 'HTTP与HTTPS有什么区别？',
            tags: ['前端', 'HTML', '安全', 'HTTPS'],
        })
        expect(r.direction).toBe('前端')
        expect(r.techStack).toBe('浏览器')
        expect(r.knowledgePoints).toEqual(expect.arrayContaining(['HTTP', 'HTTPS']))
    })

    it('Vue/React 可按标题或标签识别', () => {
        expect(classifyQuestion({ title: 'Vue Router 如何配置 404 页面？' }).techStack).toBe('Vue')
        expect(classifyQuestion({ title: '生命周期', tags: ['Vue'] }).techStack).toBe('Vue')
        expect(classifyQuestion({ title: '谈谈 Fiber' }).techStack).toBe('React')
    })

    it('算法题库进算法方向,主栈是数据结构', () => {
        const r = classifyQuestion({ title: '二分查找', bankSlug: 'algorithm', tags: ['算法'] })
        expect(r.direction).toBe('算法')
        expect(r.techStack).toBe('数据结构')
    })

    it('后端题按标题识别技术栈', () => {
        const r = classifyQuestion({
            title: 'MySQL（InnoDB）底层使用了哪些数据结构？',
            tags: ['后端', 'MySQL', 'B+树', '索引'],
        })
        expect(r.direction).toBe('后端')
        expect(r.techStack).toBe('MySQL')
        expect(r.knowledgePoints).toContain('B+树')
    })

    it('知识点最多 4 个,且方向/技术栈会并进 tags 兼容旧标签页', () => {
        const r = classifyQuestion({
            title: '手写bind,并说明this指向和原型链',
            tags: ['手写实现', 'this', '原型链', '闭包', '数组方法'],
        })
        expect(r.knowledgePoints.length).toBeLessThanOrEqual(4)
        expect(r.tags).toEqual(expect.arrayContaining([r.direction, r.techStack, ...r.knowledgePoints]))
    })
})

describe('tagSlug', () => {
    it('中文标签也必须是 ASCII slug(output: export 对非 ASCII 动态段会导出 404)', () => {
        expect(tagSlug('前端')).toBe('frontend')
        expect(tagSlug('数据结构')).toBe('data-structure')
        expect(tagSlug('B+树')).toBe('b-plus-tree')
        expect(tagSlug('虚拟DOM')).toBe('virtual-dom')
    })

    it('所有规范标签的 slug 合法且不冲突', () => {
        const names = [...DIRECTIONS, ...TECH_STACKS, ...KNOWLEDGE_POINTS]
        const slugs = names.map((n) => tagSlug(n))
        for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/)
        // 同名标签(如 工程化/数据结构/LLM 同时是技术栈和知识点)允许共用 slug,
        // 但不能出现「不同名字 → 同一个 slug」
        const bySlug = new Map<string, string>()
        for (let i = 0; i < names.length; i++) {
            const prev = bySlug.get(slugs[i])
            if (prev) expect(prev).toBe(names[i])
            else bySlug.set(slugs[i], names[i])
        }
    })

    it('未登记的中文标签回退到稳定哈希,且不抛错', () => {
        const a = tagSlug('未登记标签')
        expect(a).toMatch(/^[a-z0-9-]+$/)
        expect(tagSlug('未登记标签')).toBe(a)
    })
})
