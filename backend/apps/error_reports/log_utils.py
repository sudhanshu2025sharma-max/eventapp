import os
import subprocess
from django.db import connection

def get_server_log_tail(num_lines=200):
    """Safely reads the last N lines from server.log on the App VM."""
    log_path = '/home/baadalvm/eventapp/backend/server.log'
    if not os.path.exists(log_path):
        return ["Log file does not exist yet."]
    
    try:
        cmd = ['tail', '-n', str(num_lines), log_path]
        output = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True, timeout=5)
        return output.splitlines()
    except Exception as e:
        return [f"Error reading server.log: {e}"]

def get_system_health():
    """Gathers App VM Linux metrics: Uptime, Memory, Disk, and Process status."""
    health = {
        'uptime': 'Unavailable',
        'ram_used': 'Unavailable',
        'ram_total': 'Unavailable',
        'ram_percent': 0,
        'disk_used': 'Unavailable',
        'disk_total': 'Unavailable',
        'disk_percent': 0,
        'gunicorn_running': False,
        'gunicorn_workers': 0,
        'postgres_status': 'Unknown',
        'postgres_active_connections': 0,
    }

    # Uptime
    try:
        out = subprocess.check_output(['uptime', '-p'], text=True, timeout=2).strip()
        health['uptime'] = out
    except Exception:
        pass

    # RAM
    try:
        out = subprocess.check_output(['free', '-m'], text=True, timeout=2).splitlines()
        if len(out) >= 2:
            parts = out[1].split()
            total = int(parts[1])
            used = int(parts[2])
            health['ram_total'] = f"{total} MB"
            health['ram_used'] = f"{used} MB"
            health['ram_percent'] = round((used / total) * 100, 1) if total else 0
    except Exception:
        pass

    # Disk
    try:
        out = subprocess.check_output(['df', '-h', '/home/baadalvm'], text=True, timeout=2).splitlines()
        if len(out) >= 2:
            parts = out[1].split()
            health['disk_total'] = parts[1]
            health['disk_used'] = parts[2]
            health['disk_percent'] = parts[4].replace('%', '')
    except Exception:
        pass

    # Gunicorn processes
    try:
        out = subprocess.check_output(['pgrep', '-f', 'gunicorn'], text=True, timeout=2).splitlines()
        pids = [p.strip() for p in out if p.strip()]
        if pids:
            health['gunicorn_running'] = True
            health['gunicorn_workers'] = len(pids)
    except Exception:
        pass

    # Postgres connection check
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")
            row = cursor.fetchone()
            health['postgres_status'] = 'Connected (Healthy)'
            health['postgres_active_connections'] = row[0] if row else 0
    except Exception as e:
        health['postgres_status'] = f"Error: {e}"

    return health
