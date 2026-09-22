"""Layer 1: API Load — wraps existing Locust suite."""

import subprocess
import os
import sys
import json
import csv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config.thresholds import API_SLA


def safe_float(v, default=0.0):
    if v is None: return default
    s = str(v).strip()
    if not s or s.upper() in ('N/A', 'NA', '-'): return default
    try: return float(s)
    except: return default


def safe_int(v, default=0):
    return int(safe_float(v, float(default)))


def run_layer1(output_dir, users=80, spawn_rate=10, duration=300):
    print(f"\n{'='*70}")
    print(f"  LAYER 1: API LOAD TESTING (Locust)")
    print(f"  Users: {users} | Rate: {spawn_rate}/s | Duration: {duration}s")
    print(f"{'='*70}\n")

    locust_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'load_tests')
    csv_prefix = os.path.join(output_dir, "layer1_locust")

    env = os.environ.copy()
    env["no_proxy"] = "10.17.9.48,localhost,127.0.0.1"
    env["NO_PROXY"] = "10.17.9.48,localhost,127.0.0.1"

    proc = subprocess.run(
        ["locust", "-f", "locustfile.py",
         "--headless",
         "--host", "http://10.17.9.48:8000",
         "-u", str(users),
         "-r", str(spawn_rate),
         "-t", f"{duration}s",
         "--csv", csv_prefix,
         "--only-summary",
         "--loglevel", "WARNING"],
        cwd=locust_dir,
        capture_output=True, text=True,
        env=env,
        timeout=duration + 120,
    )

    # Parse stats CSV
    stats_file = csv_prefix + "_stats.csv"
    aggregated = None
    per_endpoint = []

    if os.path.exists(stats_file):
        with open(stats_file, 'r') as f:
            for row in csv.DictReader(f):
                if row.get("Name") == "Aggregated":
                    aggregated = row
                else:
                    per_endpoint.append(row)

    if not aggregated:
        return {
            "layer": 1,
            "name": "API Load",
            "score": 0,
            "passed": False,
            "error": "No aggregated stats produced",
        }

    total_req = safe_int(aggregated.get("Request Count"))
    total_fail = safe_int(aggregated.get("Failure Count"))
    error_rate = (total_fail / max(total_req, 1)) * 100
    p50 = safe_float(aggregated.get("50%"))
    p95 = safe_float(aggregated.get("95%"))
    p99 = safe_float(aggregated.get("99%"))
    rps = safe_float(aggregated.get("Requests/s"))

    # Score
    score = 100
    issues = []
    if error_rate > API_SLA["error_rate_pct"]:
        score -= min(50, (error_rate - API_SLA["error_rate_pct"]) * 5)
        issues.append(f"Error rate {error_rate:.2f}% > {API_SLA['error_rate_pct']}%")
    if p95 > API_SLA["p95_ms"]:
        score -= min(30, (p95 - API_SLA["p95_ms"]) / 50)
        issues.append(f"p95 {p95:.0f}ms > {API_SLA['p95_ms']}ms")
    if rps < API_SLA["min_rps"]:
        score -= 20
        issues.append(f"RPS {rps:.1f} < {API_SLA['min_rps']}")

    score = max(0, score)

    result = {
        "layer": 1,
        "name": "API Load Testing",
        "score": score,
        "passed": score >= 70,
        "config": {"users": users, "spawn_rate": spawn_rate, "duration": duration},
        "metrics": {
            "total_requests": total_req,
            "total_failures": total_fail,
            "error_rate_pct": error_rate,
            "p50_ms": p50,
            "p95_ms": p95,
            "p99_ms": p99,
            "rps": rps,
        },
        "issues": issues,
        "per_endpoint": per_endpoint,
    }

    with open(os.path.join(output_dir, "layer1_api_load.json"), 'w') as f:
        json.dump(result, f, indent=2, default=str)

    print(f"  ✓ Requests: {total_req:,} | Failures: {total_fail} ({error_rate:.2f}%)")
    print(f"  ✓ p50: {p50:.0f}ms | p95: {p95:.0f}ms | p99: {p99:.0f}ms")
    print(f"  ✓ Throughput: {rps:.1f} RPS")
    print(f"  ★ Layer 1 Score: {score:.1f}/100 {'✅' if result['passed'] else '❌'}")

    return result


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "results", "test")
    os.makedirs(out, exist_ok=True)
    run_layer1(out, users=20, spawn_rate=5, duration=60)
