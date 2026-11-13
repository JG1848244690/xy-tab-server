# 安全加固记录(2026-11-13)

针对一次外部安全排查报出的 4 个高危项,逐条复核并修复。所有结论都有实测佐证。

---

## 1. 伪造 IP 头绕过限流(已修)

**现象**:同一来源打满限流后,换一个 `CF-Connecting-IP` 请求头就恢复 200。

**根因**:两层都优先信这个头。

- nginx 反代默认透传客户端请求头,`CF-Connecting-IP` 原样进到 app
- app 的 `clientIp()` / `rateLimit.clientKey()` 优先读 `cf-connecting-ip`

而本站 DNS 是**灰云(未走 Cloudflare 代理)**,这个头完全是客户端自己写的,所以随便伪造。

**修复**:

| 层 | 改动 |
| --- | --- |
| nginx | 所有 `/api-hls` 反代块加 `proxy_set_header CF-Connecting-IP $remote_addr;`(覆盖客户端自带的同名头) |
| app | `x-real-ip`(nginx 强制写入)提到第一优先,`cf-connecting-ip` 降为兜底 |
| 测试 | 新增单测:两个头都在时以 `x-real-ip` 为准 |

**实测(修复后)**:

```
同一 IP 连打 35 次,每次换伪造 CF-Connecting-IP:
  30 × 200
   5 × 429        ← 不再被重置

登录接口 35 次:
  30 × 401
   5 × 429
```

---

## 2. HTTP 未强制跳 HTTPS(已修)

**现象**:`http://hls.kskbl.com.cn` 直接返回 200,可明文提交密码。

**修复**:在 vhost 的 server 块里加

```nginx
if ($scheme = http) {
    return 301 https://$host$request_uri;
}
```

覆盖 `hls.kskbl.com.cn`、`static.kskbl.com.cn`、`kskbl.com.cn`
(`code.kskbl.com.cn` / `doc.kskbl.com.cn` 原本已有跳转)。

**实测**:四个域名 HTTP 全部 `301 https://...`。

---

## 3. SSH 允许 root 密码登录 / 无 fail2ban(已修)

**原状态**:

```
permitrootlogin yes
passwordauthentication yes
fail2ban inactive(未安装)
近 7 天 22 条密码失败记录
```

**修复**:

- `/etc/ssh/sshd_config.d/99-hardening.conf`:
  `PermitRootLogin prohibit-password`、`PasswordAuthentication no`、`MaxAuthTries 3`
- 安装并启用 fail2ban,`sshd` jail:5 次失败封 1 小时
- 改配置前挂了 **10 分钟自动回滚定时器**,验证密钥登录正常后取消

**回滚方法**(万一密钥丢失):

```
ssh 控制台(VNC)登录 → rm /etc/ssh/sshd_config.d/99-hardening.conf
→ systemctl reload ssh
```

---

## 4. 公网暴露的非必要端口(已收口)

**原状态**:UFW 放行了 20/21/3000/3001/3002/4000/8001-8003/8080/888/10667/9999/39000-40000,
其中 3002(Next.js 文档站,root 运行)与 10667(宝塔面板)确认外部可达。

**修复后**:

```
22/tcp    ALLOW  Anywhere          # SSH(仅密钥)
80/tcp    ALLOW  Anywhere          # 仅用于 301 跳转
443/tcp   ALLOW  Anywhere
10667/tcp ALLOW  39.180.175.138    # 宝塔面板,仅本人出口 IP
```

其余全部删除。3002 仍在本机监听,但只经 `doc.kskbl.com.cn`(nginx 反代 127.0.0.1:3002)访问。

**外部验证**(check-host.net 多节点):

```
3002   Connection timed out   ← 已关闭
10667  Connection timed out   ← 已关闭(非本人 IP)
443    OPEN
```

> 面板 IP 变了怎么办:用 SSH 隧道,不受防火墙限制
> `ssh -L 10667:127.0.0.1:10667 root@47.94.85.91`
> 然后浏览器打开 `https://127.0.0.1:10667`(证书告警可忽略)。
> 或者临时执行 `ufw allow from <新IP> to any port 10667 proto tcp`。

---

## 仍未做(建议)

| 项 | 说明 |
| --- | --- |
| MySQL 3306 | 当前 UFW 已挡(外部 timeout),但仍建议在 `my.cnf` 加 `bind-address = 127.0.0.1` |
| 宝塔面板加固 | 面板已启用 SSL;建议再确认强密码 + 安全入口路径 |
| 端口 22 | 可改非标端口并限制来源 IP;当前 fail2ban 已能挡住爆破 |
| 备份异地化 | 每日 `pg_dump` 仍在本机,见 handoff 文档 |
