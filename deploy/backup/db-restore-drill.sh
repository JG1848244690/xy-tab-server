#!/bin/bash
# ============================================================
# 备份恢复演练(每周日 04:00 cron)
#
# 备份最怕的不是没跑,而是"跑了但半年前就悄悄坏了"。
# 这里把最近一份备份真实恢复进临时库、数 questions 行数、再删库。
# 演练失败会在 /var/log/hls-db-backup.log 留下 [DRILL FAIL]。
# ============================================================
set -u

CONTAINER="hls-api-postgres-1"
LATEST="/root/hls-backups/hls-latest.dump"
SCRATCH="hlse_restore_drill"

if [ ! -s "$LATEST" ]; then
    echo "$(date '+%F %T') [DRILL FAIL] 备份文件不存在或为空:$LATEST"
    exit 1
fi

docker exec "$CONTAINER" psql -U postgres -d postgres \
    -c "DROP DATABASE IF EXISTS $SCRATCH" > /dev/null
docker exec "$CONTAINER" psql -U postgres -d postgres \
    -c "CREATE DATABASE $SCRATCH" > /dev/null

if ! docker exec -i "$CONTAINER" pg_restore -U postgres -d "$SCRATCH" --no-owner \
    < "$LATEST" > /dev/null 2>&1; then
    echo "$(date '+%F %T') [DRILL FAIL] pg_restore 失败,备份可能已损坏"
    docker exec "$CONTAINER" psql -U postgres -d postgres \
        -c "DROP DATABASE $SCRATCH" > /dev/null
    exit 1
fi

COUNT=$(docker exec "$CONTAINER" psql -U postgres -d "$SCRATCH" \
    -tAc 'SELECT count(*) FROM questions' | tr -d '[:space:]')
docker exec "$CONTAINER" psql -U postgres -d postgres \
    -c "DROP DATABASE $SCRATCH" > /dev/null

echo "$(date '+%F %T') [DRILL OK] 备份可恢复,questions=$COUNT"
