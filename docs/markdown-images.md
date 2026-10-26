# Markdown 图文支持(2026-10-26)

题目/story 正文和答案都支持标准 markdown 图片。图片不经过后端,托管在独立的
**static 子域**(推荐 `static.kskbl.com.cn`),正文只存 URL。

## 1. 写法

```md
![事件循环执行顺序](https://static.kskbl.com.cn/questions/2026/10/event-loop.png)
```

- `alt`(图片说明)会同时作为**图注**显示在图片下方,请写有信息量的说明;
- 图片单独成段时渲染为 figure(居中 + 图注);夹杂在文字中时按行内图片处理;
- 点击图片在新标签打开原图;
- 图片懒加载,高度上限 560px,宽度自适应正文,不会撑破布局;
- 支持 `title`:`![说明](url "鼠标悬停提示")`。

## 2. 服务端托管(推荐做法)

静态资源与业务 API 分离,独立子域、独立目录、nginx 直接发文件:

```nginx
server {
    listen 443 ssl http2;
    server_name static.kskbl.com.cn;

    root /opt/hls-static;          # 只放图片,不放任何代码
    autoindex off;

    location / {
        add_header Cache-Control "public, max-age=31536000, immutable";
        expires 1y;
        try_files $uri =404;
    }
}
```

目录建议按内容分: `/questions/2026/10/<slug>.webp`、`/articles/...`。
文件名只用 `[a-z0-9-]`,不要用中文/空格(URL 编码后很丑)。

### 图片规范(建议)

| 项 | 建议 |
|---|---|
| 格式 | WebP 优先(png/jpg 也可),动图 gif |
| 单图体积 | ≤ 300KB(截图类注意压缩) |
| 宽度 | 1200–1600px 足够(正文展示宽度约 720px,2x 屏用) |
| 命名 | `语义-slug.webp`,同一主题加序号 |
| 防盗链 | 可不开;要开的话允许空 referer(微信/直链) |

## 3. 安全性

- 渲染器**不启用 raw HTML**,只认 markdown 图片/链接语法,UGC 不会变成 XSS 入口;
- 图片域名与主站分离(不同 origin),恶意图片拿不到主站 cookie;
- 建议 static 子域只允许 GET/HEAD,禁止上传接口暴露公网写权限。

## 4. 已支持的渲染位置

| 页面 | 渲染器 |
|---|---|
| 面试站题目页(题干/答案) | `apps/site/src/lib/markdown.tsx`(react-markdown) |
| 面试站文章页 | 同上 |
| 后台练习页(题干/答案) | md-editor-rt `MdPreview` |
| 后台审核中心「原题详情」/「AI 改进版」 | md-editor-rt `MdPreview` |
| 出题/编辑对话框预览 | md-editor-rt `MdEditor` |

## 5. 后续可选(未做)

- 编辑器里直接粘贴/拖拽图片 → 自动上传到 static 子域并插入 URL;
  需要一个上传接口 + 服务器可写目录 + nginx 静态路由(和本文档 §2 配套)。
- 图片懒加载占位/骨架、图床 CDN。

## 6. 落地清单(切到 static 子域时)

1. DNS 加 `static` A/CNAME 记录;
2. nginx 加 server 块(§2)+ 证书(Let's Encrypt);
3. 建目录 `/opt/hls-static`,给部署/运维账号写权限;
4. 图片上传后用 URL 在题目/文章里引用(本系统不需要改代码);
5. 抽查:面试站题目页和后台「原题详情」都能看到图、图注和点击放大。
