/**
 * 面试站种子内容(一次性脚本,tsx 运行)
 *
 * 为什么需要:Next SSG 的 output:export 要求动态路由的 generateStaticParams
 * 非空,而 MVP 起步时 banks / tag_registry / articles 都是空表(后台录入
 * P2 才有)—— 空表会让站点构建直接失败。这里铺上第一层真实内容:
 *   1. 四个题库(banks),把 81 道存量题按标签归库
 *   2. 高频标签的 tag_registry 介绍(≥240 字,聚合页才可收录)
 *   3. 一篇 approved 的欢迎文章(文章/荟萃页的种子)
 *
 * 用法(改到哪个库就指向哪个 DATABASE_URL):
 *   pnpm --filter hlse-api exec tsx scripts/seed-site-content.ts
 * 幂等:全部 onConflictDoNothing / 先查后插,可重复运行。
 */
import 'dotenv/config'
import { and, count, eq, isNotNull, isNull } from 'drizzle-orm'
import db from '../src/db/index.js'
import { articles, banks, questions, tagRegistry, users } from '../src/db/schema.js'

const OWNER_EMAIL = 'omen@123.com'

/** 标签 → 题库归类规则:题目的第一个命中标签决定归属 */
const BANK_RULES: Array<{ slug: string; title: string; description: string; tags: string[] }> = [
    {
        slug: 'javascript',
        title: 'JavaScript 基础',
        description: '语言核心:原型、闭包、事件循环、异步与 ES 新特性。面试的第一道门槛,也是被问得最深的区域。',
        tags: ['javascript', 'js', 'promise', 'async', 'es6', '闭包', '原型链', '事件循环'],
    },
    {
        slug: 'framework',
        title: '框架与生态',
        description: 'React / Vue 等框架的原理与实战:渲染机制、状态管理、diff、hooks。会用不够,要讲得出为什么。',
        tags: ['react', 'vue', '框架', 'hooks', 'redux', 'next'],
    },
    {
        slug: 'algorithm',
        title: '算法与数据结构',
        description: '手写题与高频算法:数组、字符串、树、动态规划。思路 + 复杂度 + 边界,三样都要说清。',
        tags: ['算法', '数据结构', '动态规划', '数组', '字符串', '树'],
    },
    {
        slug: 'engineering',
        title: '工程与网络',
        description: '浏览器、网络协议、构建工具与工程化:从输入 URL 到渲染,从 webpack 到性能优化。',
        tags: ['网络', 'http', '浏览器', 'webpack', 'vite', '性能优化', '工程化', '安全'],
    },
]

/** 高频标签的聚合页介绍(≥240 字才允许被收录,这是产品文案,先人工垫底) */
const TAG_INTROS: Record<string, string> = {
    javascript:
        'JavaScript 是前端面试的绝对主场。这个标签下的问题覆盖语言核心机制:数据类型与隐式转换、原型与继承链、闭包与作用域、this 与执行上下文、事件循环与宏微任务、Promise 与 async/await 的调度细节,以及 ES2015 之后的关键特性(解构、迭代器、代理与反射、模块系统)。面试官在这一层反复下探,目的不是背概念,而是确认你理解"代码为什么这样跑"。建议按题做题、按题追底层:每道题的分层答案都给出了从结论到原理的完整链条,先记住结论,再消化原理,最后能用自己的话讲出来,这道题才算过了。配套的口诀用于考前快速唤醒,不要替代理解。',
    react:
        'React 相关问题是前端框架层的必考区。这里的题目围绕几个稳定的主题展开:组件与受控/非受控、hooks 的规则与心智模型(useState 的批处理、useEffect 的依赖与清理、useMemo/useCallback 的真实收益)、协调与 diff 的基本假设(key 的意义)、以及状态管理方案的边界(什么该放 context、什么该放服务端缓存)。React 19 带来的并发特性与 Action 也在逐步进入题池。复习时建议对照"如果不用 React 你怎么实现"来理解每个 API 的存在理由,这类"设计动机"追问是高级岗位面试的分水岭。每题的参考答案都按"是什么—为什么—边界与坑"组织,适合直接迁移到口头表达。',
    算法:
        '算法与手写题是流程里最难临场发挥的部分,也是最可以靠刷题模板化的部分。本标签收录高频手写(防抖节流、深拷贝、call/bind/apply、Promise 并发控制)与经典算法题(双指针、滑动窗口、二叉树遍历、动态规划入门)。每道题都强调三件事:先说清思路与复杂度、再写可运行的代码、最后主动补边界条件(空输入、极值、溢出)。面试现场的正确姿势是"边写边讲",让面试官看到你的思考过程而不是一个沉默的答案。如果时间有限,优先把手写题练到肌肉记忆——它们出现频率最高、套路最固定。',
    网络:
        '网络与浏览器机制的题目贯穿前后端岗位。高频主题:HTTP/1.1 与 2/3 的演进、HTTPS 握手与证书链、缓存策略(强缓存与协商缓存的头字段组合)、从输入 URL 到页面渲染的完整链路、跨域与 CORS 的细节、Cookie/Storage/安全(XSS/CSRF)的边界。这类问题的特点是"人人都会说两句,人人都说不全"——分层答案的价值就在这里:第一层给结论,第二层给机制,第三层给面试官可能追问的细节(比如 TLS 1.3 为什么快、ALPN 是什么)。把这一层讲透,后端知识面的问题也能顺势接住。',
    性能优化:
        '性能优化问题的答题框架比具体技巧更重要:先度量(Core Web Vitals:LCP/INP/CLS)、再定位(Network/Performance 面板)、后优化(资源、渲染、运行时三层)。这里的题目覆盖常见的优化手段与它们的适用边界:懒加载与预加载的取舍、代码分割的粒度、重排重绘的规避、长任务拆分、图片格式与尺寸策略,以及"优化了但没效果"的常见原因。面试官最爱追问"你怎么知道该优化哪里"——请务必把度量前置到答案里,避免背一串无上下文的技巧清单。',
    typescript:
        'TypeScript 的问题集中在类型系统的心智模型:结构化类型与鸭子类型的区别、泛型的使用与推断、工具类型(Partial/Pick/Omit/Record)的实现、条件类型与 infer、any/unknown/never 的边界。面试期望的不是背工具类型清单,而是能在真实场景里"想出"一个类型:比如把一个对象的部分字段变成可选、给函数参数做反向推断。每道题的答案都附了最小可运行示例,建议在 TS Playground 里亲手改一遍,类型体操是练出来的不是看出来的。',
    vue:
        'Vue 的问题与 React 形成很好的对照复习:响应式的实现路径(defineProperty 与 Proxy 的取舍)、模板编译与运行时的分工、computed 与 watch 的依赖收集、v-if 与 v-show 的本质差异、组件通信的完整光谱。双框架都熟是中小团队招聘的高频加分项,而对照着学是最快路径——同一个问题(比如"key 是干什么的")在两个框架里的答案互为镜像,理解一侧再记另一侧成本减半。',
    工程:
        '工程化能力是区分"能写页面"和"能交付项目"的分界线。这个分组覆盖:模块规范(ESM/CJS 的加载差异)、打包工具(webpack 的 loader/plugin 机制、vite 为什么快)、Babel 与 AST 的关系、代码质量工具链(eslint/prettier/husky)、CI/CD 的基本形状,以及 monorepo 的取舍。回答这类问题的要点是"带场景":不说"webpack 慢",而说"冷启动慢在全量构建,vite 用 ESM 按需编译解决的就是这个场景"。工程题的答案质量,直接决定面试官对你独立交付能力的判断。',
}

async function main() {
    const [owner] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, OWNER_EMAIL))
        .limit(1)
    // 本地/测试库没有这个账号时自动补一个(密码随机不登录,只为满足 FK)
    let ownerId = owner?.id
    if (!ownerId) {
        const [created] = await db
            .insert(users)
            .values({
                email: OWNER_EMAIL,
                username: '内容组',
                password: '$2b$10$seedonlynotusableforlogin00000000000000000000000000000',
            })
            .onConflictDoNothing()
            .returning()
        ownerId = created!.id
        console.log('seed owner created (local/test db)')
    }
    if (!ownerId) throw new Error('unreachable: owner id missing')

    // ---- 0. 空库兜底:没有题目时放 3 道示例题(生产 81 题在库,不会命中)----
    // output:export 下 question/[slug] 的 gSP 为空数组会让构建失败
    const [{ n: questionCount }] = await db
        .select({ n: count() })
        .from(questions)
    if (Number(questionCount) === 0) {
        await db.insert(questions).values(
            [
                {
                    title: '下面这段代码输出什么?为什么?',
                    type: 'markdown' as const,
                    content:
                        '```js\nasync function m() {\n  console.log(1)\n  const n = await 1\n  console.log(n)\n}\n\nm()\nconsole.log(2)\n```\n\n考察 async 函数的返回值与事件循环。',
                    answer:
                        '**输出 `1`、`2`、`1`。**\n\n- `m()` 同步执行到第一个 `await` 前打出 `1`\n- `await 1` 把 thenable 后续挂进微任务,主栈继续走完打出 `2`\n- 微任务里 `n = 1`(await 非 Promise 值会透传),打出 `1`\n\n> 💡 **记忆口诀**:await 让路,主栈先跑;微任务排队,回头再算。',
                    difficulty: 'medium' as const,
                    tags: ['Promise', '事件循环'],
                    slug: 'promise-syntax-sugar',
                    visibility: 'shared' as const,
                },
                {
                    title: '手写防抖 debounce',
                    type: 'markdown' as const,
                    content: '实现一个 `debounce(fn, wait)`,首次立即执行的可选参数加分。',
                    answer:
                        '核心:**闭包记 timer,每次触发先清再设**。\n\n```js\nfunction debounce(fn, wait, immediate = false) {\n  let timer = null\n  return function (...args) {\n    if (immediate && !timer) fn.apply(this, args)\n    clearTimeout(timer)\n    timer = setTimeout(() => {\n      timer = null\n      if (!immediate) fn.apply(this, args)\n    }, wait)\n  }\n}\n```\n\n追问点:`this` 与参数保留、immediate 首次执行、取消方法。',
                    difficulty: 'easy' as const,
                    tags: ['手写', '闭包'],
                    slug: 'handwrite-debounce',
                    visibility: 'shared' as const,
                },
                {
                    title: '浏览器里 0.1 + 0.2 !== 0.3 的原因与解法',
                    type: 'markdown' as const,
                    content: '为什么 `0.1 + 0.2 === 0.3` 是 false?工程上怎么比较浮点数?',
                    answer:
                        '**IEEE 754 双精度**的二进制表示:0.1 和 0.2 都是无法精确表示的小数,相加后产生误差 `0.30000000000000004`。\n\n解法:误差容忍比较 `Math.abs(a - b) < Number.EPSILON`,或整体转整数运算(金额用「分」)。\n\n**不要用** toFixed 做精确比较——它只是四舍五入。',
                    difficulty: 'easy' as const,
                    tags: ['javascript', '数据类型'],
                    slug: 'float-0.1-plus-0.2',
                    visibility: 'shared' as const,
                },
            ].map((q) => ({
                ...q,
                status: 'approved' as const,
                publishedAt: new Date(),
                createdBy: ownerId!,
            })),
        )
        console.log('sample questions created: 3')
    }

    // ---- 1. banks ----
    const bankIdBySlug = new Map<string, string>()
    for (const rule of BANK_RULES) {
        const existing = await db.select().from(banks).where(eq(banks.slug, rule.slug)).limit(1)
        if (existing[0]) {
            bankIdBySlug.set(rule.slug, existing[0].id)
            continue
        }
        const [created] = await db
            .insert(banks)
            .values({
                slug: rule.slug,
                title: rule.title,
                description: rule.description,
                createdBy: owner.id,
            })
            .returning()
        bankIdBySlug.set(rule.slug, created!.id)
        console.log(`bank created: ${rule.slug}`)
    }

    // ---- 2. 题目按首个命中标签归库(不动已归库的)----
    const rows = await db
        .select({ id: questions.id, tags: questions.tags })
        .from(questions)
        .where(and(eq(questions.status, 'approved'), isNull(questions.bankId)))
    for (const row of rows) {
        const hit = BANK_RULES.find((rule) => (row.tags ?? []).some((t) => rule.tags.includes(t)))
        if (!hit) continue
        await db
            .update(questions)
            .set({ bankId: bankIdBySlug.get(hit.slug) })
            .where(eq(questions.id, row.id))
    }
    console.log(`bank assigned: ${rows.length} candidates scanned`)

    // ---- 3. tag_registry(≥240 字介绍)----
    for (const [name, description] of Object.entries(TAG_INTROS)) {
        const slug = name.toLowerCase().replace(/\s+/g, '-')
        const existing = await db.select().from(tagRegistry).where(eq(tagRegistry.slug, slug)).limit(1)
        if (existing[0]) continue
        await db.insert(tagRegistry).values({ slug, name, description })
        console.log(`tag registered: ${slug}`)
    }

    // ---- 3.5 兜底登记:题库里出现过但没写介绍的标签 ----
    // 登记了聚合页才存在(标签 pill 的内链才不是 404);介绍占位 <240 字
    // → hasIntro=false → 站点侧 noindex,不算薄内容。清洗 agent 之后补正经文案
    const tagRows = await db
        .select({ tags: questions.tags })
        .from(questions)
        .where(and(eq(questions.status, 'approved'), isNotNull(questions.tags)))
    const names = new Set(tagRows.flatMap((r) => r.tags ?? []))
    for (const name of names) {
        if (!name) continue
        const slug = name.toLowerCase().replace(/\s+/g, '-')
        const existing = await db.select().from(tagRegistry).where(eq(tagRegistry.slug, slug)).limit(1)
        if (existing[0]) continue
        await db.insert(tagRegistry).values({
            slug,
            name,
            description: `关于${name}的面试题合集,共收录多道相关题目与分层解析。介绍文案整理中。`,
        })
        console.log(`tag registered (placeholder intro): ${slug}`)
    }

    // ---- 4. 欢迎文章 ----
    const WELCOME_SLUG = 'welcome-to-hls-interview'
    const existingArticle = await db
        .select()
        .from(articles)
        .where(eq(articles.slug, WELCOME_SLUG))
        .limit(1)
    if (!existingArticle[0]) {
        await db.insert(articles).values({
            slug: WELCOME_SLUG,
            title: '欢迎来到 HLS 面试题库:这份题库怎么用',
            kind: 'own',
            contentMd: [
                '## 这份题库的三个特点',
                '',
                '**不藏要点**:所有答案都是完整的分层解析——结论、原理、边界与追问,不搞"关注解锁"。每道题都经过 AI 评分 + 人工复核的双审流程,低于阈值的题目进不了公开池。',
                '',
                '**口诀记忆**:每道高频题附一条记忆口诀。口诀负责考前 5 分钟快速唤醒,理解请看正文——顺序不能反。',
                '',
                '**按专题刷**:题库按 JavaScript 基础、框架与生态、算法与数据结构、工程与网络四个专题组织,配合标签可以横向串联。建议先过一遍专题里标"简单"的题建立信心,再攻中等题。',
                '',
                '## 复习节奏建议',
                '',
                '- 第一遍:只看题目,自己说答案,再对照分层解析找差距(最痛苦也最有用的一遍)',
                '- 第二遍:只看口诀和一句话答案,巩固骨架',
                '- 考前:用「相关题目」顺藤摸瓜,把同标签的题串成网',
                '',
                '题目会持续增加,欢迎在后台提交你遇到的面试题。',
            ].join('\n'),
            excerpt: '三个特点 + 一套复习节奏,5 分钟读懂这份题库的正确打开方式。',
            createdBy: owner.id,
            status: 'approved',
            publishedAt: new Date(),
        })
        console.log('welcome article created')
    }

    console.log('seed done')
    process.exit(0)
}

main().catch((err) => {
    console.error('seed failed:', err)
    process.exit(1)
})
