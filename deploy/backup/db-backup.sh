#!/bin/bash
# ============================================================
# hlsEdu PG 数据库备份脚本
#
# 策略:
#   - 每日 cron 执行(服务器 root crontab),pg_dump -Fc(自带压缩)
#   - 备份目录 /opt/hls-api/backups,保留 KEEP_DAYS 天
#   - 成功后把最新一份再复制到 /root/hls-backups(hls-latest.dump)
#     —— /opt 下的目录被误删/被揉坏时,还有 /root 这份兜底
#   - 备份完当场用 pg_restore -l 校验能读,读不了的 dump 不算数
#
# 恢复(紧急时刻的两条命令,详细与注意事项见 README.md):
#   docker exec -i hls-api-postgres-1 pg_restore -U postgres -d hlse --clean < /root/hls-backups/hls-latest.dump
#
# 日志:cron 里 >> /var/log/hls-db-backup.log
# 依赖:无(只用服务器上已装的 docker)
# ============================================================
set -u

KEEP_DAYS=14
BACKUP_DIR="/opt/hls-api/backups"
ROOT_DIR="/root/hls-backups"
CONTAINER="hls-api-postgres-1"
DB_USER="postgres"
DB_NAME="hlse"

STAMP=$(date +%Y%m%d_%H%M%S)
TARGET="$BACKUP_DIR/hlse_${STAMP}.dump"
LATEST="$ROOT_DIR/hls-latest.dump"

mkdir -p "$BACKUP_DIR" "$ROOT_DIR"

# ---- dump(stdout 直接落到宿主机文件,容器内不留临时物)----
if docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$TARGET"; then
    SIZE=$(du -h "$TARGET" | cut -f1)
else
    echo "$(date '+%F %T') [FAIL] pg_dump 失败:$TARGET 未生成或损坏"
    rm -f "$TARGET"
    exit 1
fi

# ---- 校验:pg_restore 能列出 TOC 才算备份成功 ----
if ! docker exec -i "$CONTAINER" pg_restore -l < "$TARGET" > /dev/null 2>&1; then
    echo "$(date '+%F %T') [FAIL] dump 完整性校验不过:$TARGET"
    mv "$TARGET" "$TARGET.bad"
    exit 1
fi

# ---- 最新一份镜像到 /root(覆盖式,永远有最后一份已知的好的)----
cp -f "$TARGET" "$LATEST"

# ---- 保留策略 ----
find "$BACKUP_DIR" -name 'hlse_*.dump' -mtime +"$KEEP_DAYS" -delete

echo "$(date '+%F %T') [OK] $TARGET ($SIZE) 校验通过,/root 镜像已更新,清理 ${KEEP_DAYS} 天前"
