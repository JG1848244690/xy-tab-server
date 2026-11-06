# Nginx 旧 URL 重定向(面试站)

`code.kskbl-redirects.inc` 是 `code.kskbl.com.cn` 的旧 URL 跳转表:

- 旧中文标签 → 新 ASCII 标签(301)
- 已合并/下架的题目 → 保留的题(301)或 410
- 已隐藏的 legacy 标签 → `/tags`(301)

## 为什么不叫 `.conf`

`/www/server/nginx/conf/nginx.conf` 里有:

```nginx
include /www/server/panel/vhost/nginx/*.conf;
```

放在该目录下的 `.conf` 会被 **http 级**再加载一次,而 `location` 不能出现在 http 级。所以文件用 `.inc`,只在 vhost 的 server 块里 include。

## 部署位置

```nginx
# /www/server/panel/vhost/nginx/code.kskbl.com.cn.conf (443 server)
root /opt/hls-site/current;
include /www/server/panel/vhost/nginx/code.kskbl-redirects.inc;
```

## 更新步骤

```bash
cp ops/nginx/code.kskbl-redirects.inc /www/server/panel/vhost/nginx/
nginx -t && nginx -s reload
```

改 vhost 前先备份到 `/root/backups/`。
