# 数据库备份与恢复手册

## 现状(为什么需要)

数据(81 题、打卡、答题记录)只有 PG 容器的一个 docker volume(`hlse-pg-data`)。
volume 会丢数据的场景统统没有第二份应对:**磁盘坏、容器/卷被误删、误操作 drop、被入侵勒索**。

## 备份机制(2026-10-17 起)

| 项 | 值 |
|---|---|
| 方式 | `pg_dump -Fc`(custom 格式,自带压缩,单文件) |
| 频率 | 每日 03:30(root crontab) |
| 保存位置 | `/opt/hls-api/backups/hlse_YYYYMMDD_HHMMSS.dump`(14 天)+ `/root/hls-backups/hls-latest.dump`(每日覆盖的最新一份) |
| 校验 | 每次备份完当场 `pg_restore -l` 读 TOC,读不了记 FAIL 并把文件改名 `.bad` |
| 日志 | `/var/log/hls-db-backup.log` |
| 脚本 | `deploy/backup/db-backup.sh`(安装于服务器 `/opt/hls-api/backup/db-backup.sh`) |

**局限(要诚实说)**:`/root` 镜像仍在同一块磁盘、同一台机器。真正的异地(机房级灾难/攻击者拿到 root)需要对象存储,见文末。

## 恢复步骤

```bash
# 1. 挑一份备份看内容(可选,确认这份数据是你要的时间点)
docker exec -i hls-api-postgres-1 pg_restore -l < /opt/hls-api/backups/hlse_xxx.dump | tail -20

# 2. 覆盖式恢复(--clean 先 DROP 现有对象再灌入)
docker exec -i hls-api-postgres-1 pg_restore -U postgres -d hlse --clean < /opt/hls-api/backups/hlse_xxx.dump

# 3. 重启 app 让连接池重来,并抽查
docker compose -f /opt/hls-api/docker-compose.yml restart app
curl -s http://localhost:4000/health
```

注意事项:
- `--clean` 会先删再建,**恢复期间前端会看到报错**,挑低峰做
- 若问题出在"手抖 drop 了库",先 `CREATE DATABASE hlse;` 再 pg_restore(不带 --clean)
- `pg_restore` 是事务性的:失败时数据库不会落到一半的中间态(除非加 --clean 前的 DDL 已提交——单库场景可接受)
- app 容器不用动:postgres.js 连接池有 connect_timeout,恢复完自动重连;保险起见 restart

## 手动立即备份(改 schema 前先跑一次)

```bash
/opt/hls-api/backup/db-backup.sh
```

## 待办:异地备份(推荐,需拍板)

阿里云的 OSS:每天 cron 里加一条 `ossutil cp`,费用每月几毛钱。
需要:Bucket 名 + 一对有写权限的 AccessKey(建议新建 RAM 子账号,只授权这一个 Bucket)。

## cron(已装,2026-10-17)

```cron
30 3 * * *  /opt/hls-api/backup/db-backup.sh        >> /var/log/hls-db-backup.log 2>&1
0  4 * * 0  /opt/hls-api/backup/db-restore-drill.sh >> /var/log/hls-db-backup.log 2>&1
```

