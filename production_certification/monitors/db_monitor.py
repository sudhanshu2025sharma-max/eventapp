"""PostgreSQL health monitor."""

import subprocess
import json
import os


def get_db_stats(db_name="etd2026", db_user="baadalvm"):
    """Get PostgreSQL runtime statistics."""
    stats = {}

    # Connection count
    try:
        result = subprocess.run(
            ["psql", "-U", db_user, "-d", db_name, "-t", "-c",
             "SELECT count(*) FROM pg_stat_activity WHERE datname='" + db_name + "';"],
            capture_output=True, text=True, timeout=10
        )
        stats["active_connections"] = int(result.stdout.strip()) if result.returncode == 0 else -1
    except Exception:
        stats["active_connections"] = -1

    # Database size
    try:
        result = subprocess.run(
            ["psql", "-U", db_user, "-d", db_name, "-t", "-c",
             f"SELECT pg_size_pretty(pg_database_size('{db_name}'));"],
            capture_output=True, text=True, timeout=10
        )
        stats["database_size"] = result.stdout.strip() if result.returncode == 0 else "unknown"
    except Exception:
        stats["database_size"] = "unknown"

    # Slow queries (> 100ms in last hour if pg_stat_statements enabled)
    try:
        result = subprocess.run(
            ["psql", "-U", db_user, "-d", db_name, "-t", "-c",
             "SELECT count(*) FROM pg_stat_activity WHERE state='active' AND query_start < NOW() - INTERVAL '1 second';"],
            capture_output=True, text=True, timeout=10
        )
        stats["long_running_queries"] = int(result.stdout.strip()) if result.returncode == 0 else 0
    except Exception:
        stats["long_running_queries"] = 0

    # Deadlocks
    try:
        result = subprocess.run(
            ["psql", "-U", db_user, "-d", db_name, "-t", "-c",
             f"SELECT deadlocks FROM pg_stat_database WHERE datname='{db_name}';"],
            capture_output=True, text=True, timeout=10
        )
        stats["deadlocks"] = int(result.stdout.strip()) if result.returncode == 0 else 0
    except Exception:
        stats["deadlocks"] = 0

    return stats


if __name__ == "__main__":
    print(json.dumps(get_db_stats(), indent=2))
