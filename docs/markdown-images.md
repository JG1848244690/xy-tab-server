# Markdown 图文 + 图片统一管理(2026-10-26)

题目/文章正文和答案支持标准 markdown 图片。图片集中在 **static 子域**,
通过「图库」统一上传、查引用、清理;正文只存 URL。

## 1. 写法

```md
![事件循环执行顺序](https://static.kskbl.com.cn/uploads/2026/10/<uuid>.webp)
```

- `alt` 会同时作为**图注**显示在图片下方,请写有信息量的说明;
- 图片单独成段时渲染为 figure(居中 + 图注);夹在文字中时按行内图片处理;
- 点击图片在新标签打开原图;懒加载;高度上限 560px,宽度自适应正文;
- 支持 `title`: `![说明](url "悬停提示")`;
- **不启用 raw HTML**,只认 markdown 语法(UGC 不会变成 XSS 入口)。

## 2. 统一管理(图库)

后台导航「图库」(`/media`,仅 admin)是唯一的图片入口:

| 能力 | 说明 |
|---|---|
| 上传 | 支持 png / jpeg / webp / gif,单张 ≤5MB;每用户每天 50 张(admin 豁免) |
| 落盘 | `UPLOAD_DIR/YYYY/MM/<uuid>.<ext>` → 对外 `https://static.kskbl.com.cn/uploads/...` |
| 引用检查 | 「被引用 N 处」实时扫描题目/文章正文;被引用的图片**禁止删除** |
| 清理 | 「清理未使用」一次清掉所有 0 引用图片(文件 + 记录一起删) |
| 复制链接 | 一键复制 markdown 用 URL |

**编辑器直传**:出题/编辑对话框里直接**粘贴或拖拽图片**、或用工具栏图片按钮,
会自动上传到图库并把 markdown 插进正文 —— 不需要手动传服务器。

实现:
- 上传 `POST /media/upload`(multipart `file`)→ `{ asset: { id, url, ... } }`
- 列表 `GET /media?page&size&unused=1`(admin);删除 `DELETE /media/:id`(admin,被引用 409)
- 清理 `POST /media/cleanup`(admin)
- 元信息表 `media_assets`(迁移 0006);魔数识别,不信任客户端 content-type

## 3. 服务端托管(当前服务器实况)

- 域名:`static.kskbl.com.cn`(Cloudflare 橙云 → 源站 nginx)
- nginx(宝塔):`/www/server/panel/vhost/nginx/html_static.kskbl.com.cn.conf`
- 站点根:`/www/wwwroot/static`,上传目录 `/www/wwwroot/static/uploads`
- 证书:Cloudflare Origin(复用,不要新申请)

nginx 里为上传目录单独加长缓存(优先于宝塔的图片 30d 正则):

```nginx
location ^~ /uploads/ {
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
    access_log off;
    try_files $uri =404;
}
```

API 域名(`hls.kskbl.com.cn`)需要放开上传体积(默认 1m 会 413):

```nginx
client_max_body_size 10m;
```

容器挂载(仓库 `docker-compose.yml` 已带):

```yaml
environment:
  UPLOAD_DIR: /data/uploads
  UPLOAD_PUBLIC_BASE: https://static.kskbl.com.cn/uploads
volumes:
  - /www/wwwroot/static/uploads:/data/uploads
```

宿主目录属主必须是容器用户 uid 1001:

```bash
mkdir -p /www/wwwroot/static/uploads
chown -R 1001:1001 /www/wwwroot/static/uploads
chmod 755 /www/wwwroot/static/uploads
```

### 图片规范(建议)

| 项 | 建议 |
|---|---|
| 格式 | WebP 优先(上传接口也收 png/jpg/gif) |
| 单图体积 | ≤300KB(接口硬上限 5MB) |
| 宽度 | 1200–1600px(正文展示约 720px,2x 屏用) |
| 命名 | 由系统生成 `uuid`;靠图库的日期/引用管理,不要手动改名 |

## 4. 本地上传文件

生产由 nginx 直接服务;本地开发把 `UPLOAD_PUBLIC_BASE` 指向
`http://127.0.0.1:9999/uploads`,由 API 的 `/uploads/*` 路由托管
(见 `apps/api/src/app.ts`)。本地文件默认在 `apps/api/uploads`(已 gitignore)。

## 5. 已支持的渲染位置

| 页面 | 渲染器 |
|---|---|
| 面试站题目页(题干/答案) | `apps/site/src/lib/markdown.tsx`(react-markdown) |
| 面试站文章页 | 同上 |
| 后台练习页(题干/答案) | md-editor-rt `MdPreview` |
| 后台审核中心「原题详情」/「AI 改进版」 | md-editor-rt `MdPreview` |
| 出题/编辑对话框预览 | md-editor-rt `MdEditor` |

## 6. 清理策略

- 日常:图库 → 「未使用」→ 抽空点「清理未使用」;
- 被引用的图片删不掉(接口 409),避免出现"正文里图裂了";
- 图片 URL 里是随机 uuid,天然不可枚举;需要换图时删掉引用再清理即可。
