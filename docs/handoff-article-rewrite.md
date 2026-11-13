# 文章改写交接文档

> 写于 2026-11-13。本文档只讲「把外部技术文章改写成站内原创」这件事怎么做、做到哪了,
> 不包含任何密钥。服务器/部署相关内容见 `HANDOFF.md`。

## 1. 背景与边界

站点的文章分两类:

- `own`:**本站原创**。有正文(`content_md`),在站内完整阅读
- `curated`:**荐文**。只存外链 + 导读 + 来源,不复制全文

「改写」指的是把 `curated` 的荐文,变成 `own` 的原创文章:

```
原文(外链)  →  读结构、提炼观点  →  用自己的组织方式重写  →  站内原创
```

**必须遵守**:

- 不做整篇搬运。观点和技术方案可以用,具体的句子、段落顺序、例子、代码注释要自己写
- 文末保留参考来源(标题 + 链接),格式见 §4
- 改写完成后,删掉对应的 `curated` 条目,避免同一主题在合集里出现两条

## 2. 来源

| 项 | 值 |
| --- | --- |
| 公众号 | 小楠编程 |
| 合集 | Web前端工程化 |
| 合集地址 | `https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzI1ODQxNTc3MQ==&action=getalbum&album_id=4597026983729004545` |
| 抓取脚本 | `C:\Users\xy\AppData\Local\Temp\opencode\fetch-wx-album.js`(本地临时目录,重装系统会丢) |
| 抓取接口 | `mp/appmsgalbum?...&f=json`,分页用 `begin_msgid` / `begin_itemidx` |

抓取脚本只取**标题、链接、发布时间**,不抓正文。重跑一次会输出 `wx-album.json`。

> 注意:脚本在系统临时目录,建议复制到仓库 `scripts/` 或桌面长期保存。

### 抓正文会被风控

直接 `fetch` 文章页时,微信可能返回「环境异常,完成验证后即可继续访问」的验证页(HTTP 200,但页面没有 `#js_content`)。表现:

- 同一 IP 短时间抓多篇会触发
- 无头浏览器、云浏览器(Browserless)同样会被拦
- 换 UA / 加 referer 不一定有效

处理顺序:

1. 等 30–60 分钟再试(多数是临时风控)
2. 换网络(手机热点 / 代理)
3. 仍然不行就**让用户提供正文**:在微信里打开文章,复制粘贴给 agent,或粘进后台编辑器

判断是否被拦:HTML 里搜 `js_content`,有才是正文页;出现 `环境异常` / `wappoc_appmsgcaptcha` 就是验证页。

## 3. 当前状态

合集:`frontend-engineering`(标题「前端工程化」),共 15 项。

| # | 状态 | 站内 slug | 标题 |
| --- | --- | --- | --- |
| 01 | ✅ 已改写 | `package-managers-pnpm-yarn-npm` | pnpm / yarn / npm 到底差在哪 |
| 02 | ⬜ 外链 | `wechat-fe-02` | Vite 工程化完整指南 |
| 03 | ⬜ 外链 | `wechat-fe-03` | 代码质量工具链全套落地 |
| 04 | ⬜ 外链 | `wechat-fe-04` | Monorepo 实战 |
| 05 | ⬜ 外链 | `wechat-fe-05` | 前端 CI/CD 流水线设计 |
| 06 | ⬜ 外链 | `wechat-fe-06` | 前端依赖治理与供应链安全 |
| 07 | ⬜ 外链 | `wechat-fe-07` | Core Web Vitals 实战 |
| 08 | ⬜ 外链 | `wechat-fe-08` | 微前端方案选型与落地 |
| 09 | ⬜ 外链 | `wechat-fe-09` | 渲染策略选型 |
| 10 | ⬜ 外链 | `wechat-fe-10` | 前端缓存策略全景 |
| 11 | ⬜ 外链 | `wechat-fe-11` | Bundle 分析与瘦身 |
| 12 | ⬜ 外链 | `wechat-fe-12` | 前端错误监控与上报 |
| 13 | ✅ 已改写 | `gray-release-and-ab-testing` | 灰度发布与 A/B 测试 |
| 14 | 保持外链 | `wechat-fe-14` | 前端可观测性 |

第 14 篇不做改写:站内已有原创《一次点击之后:前端可观测性怎么落地》(`frontend-observability-in-practice`),再写一篇同主题会重复。

## 4. 改写规范

### 结构

不要照搬原文的章节顺序。推荐骨架:

1. **一个具体场景开场**(报障、踩坑、线上问题),不超过 3 段
2. **拆概念**:把原文的核心术语用自己的话解释一遍
3. **给可执行的判断**:什么情况选 A、什么情况选 B,带取舍
4. **代码/配置**:能跑的最小片段,不要大段伪代码
5. **踩坑清单**:原文没写但你踩过的最好
6. **验收标准 / checklist**:读者能照着自查
7. **参考来源**

### 长度与格式

- 4,000–6,000 字;超过 8,000 字考虑拆成两篇
- 二级标题 7–10 个,不要超过 12 个
- 表格 1–3 个,用于对比;代码块 5–10 个
- 标题**不带**「第 X 周」「第 N 篇」这类序号,合集页会自动编号
- slug 用英文小写连字符,与主题对应

### 文末参考来源格式

```markdown
---

参考来源:选题受公众号「小楠编程」的《原标题》启发,结构与内容为独立重写。原文:<https://mp.weixin.qq.com/s?...>
```

### 语气

- 第一人称技术随笔,不写「本文将介绍」这类套话
- 少用形容词,多给数字和结论
- 允许说「我不建议」「这里容易错」,不要中立到没有观点

## 5. 入库流程

1. 写 Markdown 到本地临时文件
2. 用 Node 读文件(UTF-8)生成 JSON,`scp` 到服务器,`docker cp` 进 `hls-api-app-1`
3. 容器内跑 Node 脚本插入:
   - `insert into articles (...)` 字段:`slug / title / kind='own' / excerpt / content_md / tags / status='approved' / published_at / created_by`
   - `created_by` 用管理员 id(见下)
4. 挂进合集:
   ```sql
   update collection_articles set sort = sort + 1
   where collection_id = (select id from collections where slug='frontend-engineering') and sort < 100;
   insert into collection_articles (collection_id, article_id, sort) values (<collection>, <article>, 0);
   ```
   新文章按主题顺序插入,不一定要放最前
5. 删掉对应外链:
   ```sql
   delete from collection_articles where article_id in (select id from articles where slug='wechat-fe-0X');
   delete from articles where slug='wechat-fe-0X';
   ```
6. 重建前台(见下)

### 重建前台

```bash
rm -rf apps/site/.next apps/site/out
pnpm --filter hls-site build
tar -czf site-out.tgz -C apps/site/out .
scp site-out.tgz root@47.94.85.91:/tmp/
ssh root@47.94.85.91 '
  set -e
  rel="manual-$(date +%Y%m%d%H%M)"
  mkdir -p /opt/hls-site/releases/$rel
  tar -xzf /tmp/site-out.tgz -C /opt/hls-site/releases/$rel
  chmod -R a+rX /opt/hls-site/releases/$rel
  cd /opt/hls-site
  ln -sfn releases/$rel current.tmp && mv -Tf current.tmp current
  rm /tmp/site-out.tgz
'
```

或者 push 到 `hls-api` 等 Site CI;但它每 6 小时才跑一次,数据库改动不会立刻上线。

### 需要的常量

| 项 | 值 |
| --- | --- |
| 合集 slug | `frontend-engineering` |
| 管理员 id | `f40f1ab8-c260-48bd-a6f9-495c894609a9` |
| API 容器 | `hls-api-app-1` |
| 生产库 | `docker exec -it hls-api-postgres-1 psql -U postgres -d hlse` |

## 6. 验收清单

每篇改写完成后检查:

- [ ] `/article/<slug>` 返回 200,只有一个 H1(正文开头的 H1 会被前台自动去掉)
- [ ] 二级标题 ≥ 7 个,代码块 ≥ 5 个
- [ ] 文末有参考来源,链接可点
- [ ] 合集页顺序正确,原外链条目已删除
- [ ] `/articles` 的「原创」tab 计数 +1
- [ ] sitemap 包含新文章

## 7. 下一批建议

按「技术点密度 + 与面试题重合度」排序:

1. `wechat-fe-12` 错误监控(和站内《手写一个迷你 Sentry》互补,不重复)
2. `wechat-fe-11` Bundle 分析与瘦身
3. `wechat-fe-07` Core Web Vitals
4. `wechat-fe-05` CI/CD 流水线
5. `wechat-fe-09` 渲染策略选型

每轮 2 篇,写完立刻重建前台,不要攒着。

> 2026-11-13 记录:`wechat-fe-11` / `wechat-fe-12` 抓正文时被微信风控拦(「环境异常」验证页),改抓 `wechat-fe-13` 并完成改写。
> 下一轮先重试这两篇;仍失败就让用户提供正文。

## 8. 相关文件

| 路径 | 说明 |
| --- | --- |
| `apps/site/src/app/articles/page.tsx` | 文章页(三 tab:原创 / 荐文 / 合集) |
| `apps/site/src/components/articles-tabs.tsx` | tab 组件(客户端) |
| `apps/site/src/app/collection/[slug]/page.tsx` | 合集详情页 |
| `apps/web/src/pages/articles/editor.tsx` | 后台文章编辑页(左预览右编辑) |
| `apps/api/src/routes/articles/` | 文章 CRUD 接口 |
| `ops/nginx/code.kskbl-redirects.inc` | 旧 URL 跳转(含 `/digest` → `/articles`) |
