"""
Layer 6: Endurance / Soak Testing
30-minute sustained load to detect memory leaks and performance drift.
"""

import subprocess
import time
import json
import os
import sys
import threading

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from monitors.system_monitor import SystemMonitor
from monitors.redis_monitor import get_redis_stats
from monitors.db_monitor import get_db_stats


def run_layer6(output_dir, duration_minutes=30):
    """Run soak test with Locust + system monitoring."""
    print(f"\n{'='*70}")
    print(f"  LAYER 6: ENDURANCE / SOAK TESTING")
    print(f"  Duration: {duration_minutes} minutes")
    print(f"{'='*70}")

    monitor = SystemMonitor(interval=5)
    monitor.start()

    # Baseline stats
    redis_start = get_redis_stats()
    db_start = get_db_stats()

    duration_seconds = duration_minutes * 60
    locust_output = os.path.join(output_dir, "layer6_soak")
    os.makedirs(locust_output, exist_ok=True)

    print(f"\n  Starting Locust soak test (50 users, {duration_minutes}m)...")

    locust_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'load_tests')

    # Run Locust in headless mode
    env = os.environ.copy()
    env["no_proxy"] = "10.17.9.48,localhost,127.0.0.1"
    env["NO_PROXY"] = "10.17.9.48,localhost,127.0.0.1"

    proc = subprocess.Popen(
        ["locust", "-f", "locustfile.py",
         "--headless",
         "--host", "http://10.17.9.48:8000",
         "-u", "50",
         "-r", "5",
         "-t", f"{duration_seconds}s",
         "--csv", os.path.join(locust_output, "stats"),
         "--only-summary",
         "--loglevel", "WARNING"],
        cwd=locust_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )

    # Periodic snapshots
    snapshots = []
    start_time = time.time()

    while proc.poll() is None:
        elapsed = time.time() - start_time
        if elapsed > duration_seconds + 60:
            proc.terminate()
            break

        # Take snapshot every 60 seconds
        snapshot = {
            "elapsed_seconds": int(elapsed),
            "redis": get_redis_stats(),
            "db": get_db_stats(),
        }
        snapshots.append(snapshot)

        remaining = int((duration_seconds - elapsed) / 60)
        print(f"  [Soak] {int(elapsed/60)}m elapsed | {remaining}m remaining | "
              f"Redis: {snapshot['redis'].get('memory_human', 'N/A')} | "
              f"DB conns: {snapshot['db'].get('active_connections', -1)}")

        time.sleep(60)

    proc.wait(timeout=30)
    monitor.stop()

    # Final stats
    sys_summary = monitor.summary()
    redis_end = get_redis_stats()
    db_end = get_db_stats()

    # Memory growth analysis
    mem_growth = sys_summary.get("mem_growth_pct", 0)
    redis_growth_mb = 0
    if redis_start.get("memory_bytes") and redis_end.get("memory_bytes"):
        redis_growth_mb = (redis_end["memory_bytes"] - redis_start["memory_bytes"]) / 1024 / 1024

    # Score calculation
    score = 100
    issues = []

    if mem_growth > 20:
        score -= 30
        issues.append(f"System memory grew {mem_growth:.1f}% (SLA: <20%)")

    if sys_summary.get("cpu_max", 0) > 90:
        score -= 20
        issues.append(f"CPU peaked at {sys_summary.get('cpu_max', 0):.1f}% (SLA: <90%)")

    if redis_growth_mb > 100:
        score -= 20
        issues.append(f"Redis memory grew {redis_growth_mb:.1f} MB during soak")

    result = {
        "layer": 6,
        "name": "Endurance / Soak",
        "duration_minutes": duration_minutes,
        "score": max(0, score),
        "passed": score >= 70,
        "system": sys_summary,
        "redis_start": redis_start,
        "redis_end": redis_end,
        "redis_growth_mb": redis_growth_mb,
        "db_start": db_start,
        "db_end": db_end,
        "snapshots": snapshots,
        "issues": issues,
    }

    output_file = os.path.join(output_dir, "layer6_endurance.json")
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2, default=str)

    print(f"\n  ★ Layer 6 Score: {score}/100")
    print(f"  ★ Memory Growth: {mem_growth:.1f}%")
    print(f"  ★ CPU Max: {sys_summary.get('cpu_max', 0):.1f}%")
    print(f"  ★ Status: {'✅ PASS' if result['passed'] else '⚠ ISSUES'}")

    return result


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "results", "test")
    os.makedirs(out, exist_ok=True)
    # Short 3-min test for verification
    run_layer6(out, duration_minutes=3)
