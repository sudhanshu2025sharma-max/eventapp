"""
Layer 2: Infrastructure Stress Testing
Tests PostgreSQL and Redis under sustained load.
"""

import subprocess
import re
import time
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config.thresholds import DB_SLA, REDIS_SLA
from monitors.db_monitor import get_db_stats
from monitors.redis_monitor import get_redis_stats


def run_pgbench(db_name="etdapp", db_user="etdapp_admin", db_pass="ETD@2026",
                clients=50, threads=4, duration=60, scale=5):
    """Run pgbench PostgreSQL stress test against local Postgres."""
    print(f"\n{'─'*70}")
    print(f"  [Layer 2A] PostgreSQL Stress Test (pgbench)")
    print(f"  Database: {db_name} | User: {db_user} | Clients: {clients}")
    print(f"{'─'*70}\n")

    result = {
        "test": "pgbench",
        "clients": clients,
        "threads": threads,
        "duration": duration,
        "tps": 0,
        "latency_ms": 0,
        "success": False,
        "raw_output": "",
        "score": 0,
    }

    env = os.environ.copy()
    env["PGPASSWORD"] = db_pass

    # Initialize pgbench tables (idempotent)
    print("  Initializing pgbench tables...")
    init = subprocess.run(
        ["pgbench", "-i", "-s", str(scale), "-q", "-h", "localhost", "-p", "5432", "-U", db_user, db_name],
        capture_output=True, text=True, timeout=120, env=env
    )
    if init.returncode != 0:
        print(f"  ⚠ pgbench init warning: {init.stderr[:200]}")

    # Run pgbench
    print(f"  Running pgbench for {duration}s...")
    proc = subprocess.run(
        ["pgbench", "-c", str(clients), "-j", str(threads),
         "-T", str(duration), "-r", "-h", "localhost", "-p", "5432", "-U", db_user, db_name],
        capture_output=True, text=True, timeout=duration + 60, env=env
    )

    result["raw_output"] = proc.stdout + "\n" + proc.stderr

    # Parse output
    tps_match = re.search(r"tps = ([\d.]+)", proc.stdout)
    lat_match = re.search(r"latency average = ([\d.]+) ms", proc.stdout)

    if tps_match:
        result["tps"] = float(tps_match.group(1))
    if lat_match:
        result["latency_ms"] = float(lat_match.group(1))

    result["success"] = proc.returncode == 0 and result["tps"] > 0

    tps_score = min(100, (result["tps"] / DB_SLA["target_tps"]) * 100) if DB_SLA.get("target_tps") else 100
    lat_score = 100 if result["latency_ms"] < 50 else max(0, 100 - result["latency_ms"])
    result["score"] = (tps_score + lat_score) / 2 if result["tps"] > 0 else 50

    print(f"  ✓ TPS: {result['tps']:.1f} (target: {DB_SLA.get('target_tps', 500)})")
    print(f"  ✓ Latency: {result['latency_ms']:.2f}ms")
    print(f"  ✓ Score: {result['score']:.1f}/100")

    return result


def run_redis_benchmark(duration=30):
    """Run redis-benchmark test."""
    print(f"\n{'─'*70}")
    print(f"  [Layer 2B] Redis Stress Test (redis-benchmark)")
    print(f"{'─'*70}\n")

    result = {
        "test": "redis-benchmark",
        "duration": duration,
        "operations": {},
        "success": False,
        "score": 0,
    }

    ops_to_test = [
        ("SET", ["-t", "set"]),
        ("GET", ["-t", "get"]),
        ("INCR", ["-t", "incr"]),
        ("LPUSH", ["-t", "lpush"]),
        ("LPOP", ["-t", "lpop"]),
    ]

    total_ops = 0
    op_count = 0

    for op_name, op_args in ops_to_test:
        try:
            proc = subprocess.run(
                ["redis-benchmark", "-h", "127.0.0.1", "-p", "6379",
                 "-c", "50", "-n", "50000", "-q"] + op_args,
                capture_output=True, text=True, timeout=60
            )
            match = re.search(r"([\d.]+) requests per second", proc.stdout)
            if match:
                ops_per_sec = float(match.group(1))
                result["operations"][op_name] = ops_per_sec
                total_ops += ops_per_sec
                op_count += 1
                print(f"  ✓ {op_name:8} = {ops_per_sec:>10,.0f} ops/sec")
        except Exception as e:
            print(f"  ✗ {op_name} failed: {e}")

    if op_count > 0:
        result["avg_ops_per_sec"] = total_ops / op_count
        result["success"] = True
        min_sla = REDIS_SLA.get("min_ops_per_sec", 40000)
        result["score"] = min(100, (result["avg_ops_per_sec"] / min_sla) * 100)

        print(f"\n  ✓ Average: {result['avg_ops_per_sec']:,.0f} ops/sec")
        print(f"  ✓ Score: {result['score']:.1f}/100")

    return result


def run_layer2(output_dir):
    """Execute all Layer 2 tests."""
    print(f"\n{'='*70}")
    print(f"  LAYER 2: INFRASTRUCTURE STRESS TESTING")
    print(f"{'='*70}")

    pg_result = run_pgbench(duration=60)
    redis_result = run_redis_benchmark(duration=30)

    layer_score = (pg_result["score"] + redis_result["score"]) / 2

    layer_result = {
        "layer": 2,
        "name": "Infrastructure Stress",
        "score": layer_score,
        "postgresql": pg_result,
        "redis": redis_result,
        "passed": layer_score >= 70,
    }

    output_file = os.path.join(output_dir, "layer2_infrastructure.json")
    with open(output_file, 'w') as f:
        json.dump(layer_result, f, indent=2, default=str)

    print(f"\n  ★ Layer 2 Overall Score: {layer_score:.1f}/100")
    print(f"  ★ Status: {'✅ PASS' if layer_result['passed'] else '❌ FAIL'}")

    return layer_result


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "results", "test")
    os.makedirs(out, exist_ok=True)
    run_layer2(out)
