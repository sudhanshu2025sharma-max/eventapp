"""Layer 3: WebSocket Capacity — wraps existing websocket_load.py."""

import subprocess
import os
import sys
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config.thresholds import WS_SLA


def run_layer3(output_dir, connections=30, duration=90):
    print(f"\n{'='*70}")
    print(f"  LAYER 3: WEBSOCKET CAPACITY TESTING")
    print(f"  Connections: {connections} | Duration: {duration}s")
    print(f"{'='*70}\n")

    ws_output = os.path.join(output_dir, "layer3_ws_metrics.json")
    load_tests_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'load_tests')

    env = os.environ.copy()
    env["no_proxy"] = "10.17.9.48,localhost,127.0.0.1"
    env["NO_PROXY"] = "10.17.9.48,localhost,127.0.0.1"

    subprocess.run(
        ["python3", "websocket_load.py",
         "--connections", str(connections),
         "--duration", str(duration),
         "--output-json", ws_output],
        cwd=load_tests_dir,
        env=env,
        timeout=duration + 60,
    )

    if not os.path.exists(ws_output):
        return {"layer": 3, "name": "WebSocket", "score": 0, "passed": False,
                "error": "No metrics file produced"}

    with open(ws_output, 'r') as f:
        ws_metrics = json.load(f)

    success_rate = (ws_metrics["connections_succeeded"] /
                    max(ws_metrics["connections_attempted"], 1)) * 100

    connect_times = sorted(ws_metrics.get("connect_times_ms", []))
    p95_connect = connect_times[int(len(connect_times) * 0.95)] if connect_times else 0

    score = 100
    issues = []
    if success_rate < WS_SLA["min_connection_success_rate"]:
        score -= 40
        issues.append(f"Success rate {success_rate:.1f}% < {WS_SLA['min_connection_success_rate']}%")
    if p95_connect > WS_SLA["max_handshake_ms"]:
        score -= 20
        issues.append(f"p95 handshake {p95_connect:.0f}ms > {WS_SLA['max_handshake_ms']}ms")

    result = {
        "layer": 3,
        "name": "WebSocket Capacity",
        "score": max(0, score),
        "passed": score >= 70,
        "success_rate_pct": success_rate,
        "p95_handshake_ms": p95_connect,
        "metrics": ws_metrics,
        "issues": issues,
    }

    with open(os.path.join(output_dir, "layer3_websocket.json"), 'w') as f:
        json.dump(result, f, indent=2, default=str)

    print(f"  ★ Layer 3 Score: {score}/100 {'✅' if result['passed'] else '❌'}")
    return result


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "results", "test")
    os.makedirs(out, exist_ok=True)
    run_layer3(out, connections=10, duration=30)
