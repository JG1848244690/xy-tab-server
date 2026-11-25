#!/usr/bin/env python3
"""Write the fixed set of host metrics consumed by the read-only admin API."""

import json
import os
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from shutil import disk_usage


OUTPUT = Path('/var/lib/hls-monitor/snapshot.json')
CONTAINER = 'hls-api-app-1'
LOG = '/var/log/hls-db-backup.log'


def command(*args):
    try:
        return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL, timeout=15).strip()
    except (OSError, subprocess.SubprocessError):
        return None


def directory_bytes(path):
    output = command('du', '-s', '-B1', '--', path)
    return int(output.split()[0]) if output else None


def backup_status():
    info = {'latestSuccessAt': None, 'latest': None, 'restoreDrill': None}
    for line in (command('tail', '-n', '500', '--', LOG) or '').splitlines():
        match = re.match(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(OK|FAIL|DRILL OK|DRILL FAIL)\]', line)
        if not match:
            continue
        at = datetime.fromisoformat(match[1]).astimezone(timezone.utc).isoformat()
        label = match[2]
        info['restoreDrill' if label.startswith('DRILL') else 'latest'] = {
            'at': at, 'status': 'ok' if label.endswith('OK') else 'failed',
        }
        if label == 'OK':
            info['latestSuccessAt'] = at
    return info


def service_status():
    line = command('docker', 'inspect', '--format',
                   '{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.State.StartedAt}}|{{.Config.Image}}',
                   CONTAINER)
    if not line:
        return {'status': 'unknown', 'release': None, 'startedAt': None}
    running, health, started_at, image = line.split('|', 3)
    release = image.rsplit(':', 1)[-1]
    return {
        'status': (health or 'unknown') if running == 'true' else 'stopped',
        'release': release if re.fullmatch(r'[\w.-]{1,64}', release) else None,
        'startedAt': started_at if not started_at.startswith('0001-') else None,
    }


def main():
    disk = disk_usage('/')
    logs = directory_bytes('/var/log')
    container_logs = directory_bytes('/var/lib/docker/containers')
    data = {
        'source': 'host',
        'at': datetime.now(timezone.utc).isoformat(),
        'disk': {'totalBytes': disk.total, 'availableBytes': disk.free},
        'storage': {
            'uploadsBytes': directory_bytes('/www/wwwroot/static/uploads'),
            'backupsBytes': directory_bytes('/opt/hls-api/backups'),
            'logsBytes': logs + container_logs if logs is not None and container_logs is not None else None,
        },
        'service': service_status(),
        'backup': backup_status(),
    }
    OUTPUT.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
    staged = tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=OUTPUT.parent, delete=False)
    try:
        with staged:
            json.dump(data, staged)
        os.chmod(staged.name, 0o644)
        os.replace(staged.name, OUTPUT)
    finally:
        Path(staged.name).unlink(missing_ok=True)


if __name__ == '__main__':
    main()
