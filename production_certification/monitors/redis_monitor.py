"""Redis health monitor."""

import subprocess
import re


def get_redis_stats():
    """Get Redis runtime statistics."""
    stats = {}
    try:
        result = subprocess.run(
            ["redis-cli", "info"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            output = result.stdout
            for line in output.split("\n"):
                if ":" not in line:
                    continue
                key, val = line.split(":", 1)
                key = key.strip()
                val = val.strip()
                if key == "used_memory":
                    stats["memory_bytes"] = int(val)
                elif key == "used_memory_human":
                    stats["memory_human"] = val
                elif key == "connected_clients":
                    stats["clients"] = int(val)
                elif key == "instantaneous_ops_per_sec":
                    stats["ops_per_sec"] = int(val)
                elif key == "total_commands_processed":
                    stats["total_commands"] = int(val)
                elif key == "evicted_keys":
                    stats["evicted_keys"] = int(val)
                elif key == "uptime_in_seconds":
                    stats["uptime_seconds"] = int(val)
    except Exception as e:
        stats["error"] = str(e)
    return stats


if __name__ == "__main__":
    import json
    print(json.dumps(get_redis_stats(), indent=2))
