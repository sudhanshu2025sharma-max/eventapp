"""
WebSocket Voice Call Signaling Stress Test
Bypasses proxy, connects to /ws/call/?token=<jwt>, simulates signaling,
and outputs ws_metrics.json for the PDF report.
"""

import argparse
import json
import time
import threading
import sys
import os
import random

# Force internal proxy bypass
os.environ["no_proxy"] = "10.17.9.48,localhost,127.0.0.1"
os.environ["NO_PROXY"] = "10.17.9.48,localhost,127.0.0.1"

sys.path.insert(0, os.path.dirname(__file__))

try:
    import websocket
except ImportError:
    print("Install: pip3 install websocket-client --break-system-packages")
    sys.exit(1)

from config import WS_BASE, STAFF_USERS, ADMIN_USERS
from auth_helper import get_tokens

metrics = {
    "connections_attempted": 0,
    "connections_succeeded": 0,
    "connections_failed": 0,
    "messages_sent": 0,
    "messages_received": 0,
    "errors": [],
    "connect_times_ms": [],
    "message_latencies_ms": [],
    "active_connections": 0,
    "max_concurrent": 0,
}
metrics_lock = threading.Lock()


def record_metric(key, value=1):
    with metrics_lock:
        if isinstance(metrics[key], list):
            metrics[key].append(value)
        else:
            metrics[key] += value


class WSLoadClient:
    def __init__(self, user_creds, client_id, duration):
        self.creds = user_creds
        self.client_id = client_id
        self.duration = duration
        self.ws = None
        self.connected = False
        self.start_time = None

    def run(self):
        record_metric("connections_attempted")
        access, _ = get_tokens(self.creds["email"], self.creds["password"])
        if not access:
            record_metric("connections_failed")
            record_metric("errors", f"Client {self.client_id}: Auth failed for {self.creds['email']}")
            return

        ws_url = f"{WS_BASE}/ws/call/?token={access}"
        connect_start = time.time()

        try:
            self.ws = websocket.WebSocket()
            self.ws.settimeout(10)
            # Connect directly without proxy
            self.ws.connect(ws_url, http_proxy_host=None, http_proxy_port=None)
            connect_ms = (time.time() - connect_start) * 1000
            record_metric("connect_times_ms", connect_ms)
            record_metric("connections_succeeded")
            self.connected = True

            with metrics_lock:
                metrics["active_connections"] += 1
                metrics["max_concurrent"] = max(
                    metrics["max_concurrent"], metrics["active_connections"]
                )

            self.start_time = time.time()
            self._simulate_session()

        except Exception as e:
            record_metric("connections_failed")
            record_metric("errors", f"Client {self.client_id}: {str(e)[:80]}")
        finally:
            self._cleanup()

    def _simulate_session(self):
        end_time = self.start_time + self.duration
        while time.time() < end_time and self.connected:
            try:
                # Simulate signaling ping / ICE heartbeat
                msg = {
                    "type": "ping",
                    "timestamp": time.time(),
                    "client_id": self.client_id,
                }
                send_time = time.time()
                self.ws.send(json.dumps(msg))
                record_metric("messages_sent")

                self.ws.settimeout(1.5)
                try:
                    resp = self.ws.recv()
                    if resp:
                        record_metric("messages_received")
                        record_metric("message_latencies_ms", (time.time() - send_time) * 1000)
                except websocket.WebSocketTimeoutException:
                    pass

                time.sleep(random.uniform(1.5, 4.0))

            except (websocket.WebSocketConnectionClosedException, BrokenPipeError):
                self.connected = False
                break
            except Exception as e:
                record_metric("errors", f"Client {self.client_id} error: {str(e)[:60]}")
                break

    def _cleanup(self):
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
        if self.connected:
            with metrics_lock:
                metrics["active_connections"] -= 1
        self.connected = False


def run_ws_load_test(num_connections, duration, ramp_delay=0.08, output_json=None):
    print(f"\n{'='*70}")
    print(f"  WebSocket Voice Call Signaling Stress Test")
    print(f"  Connections: {num_connections} | Duration: {duration}s")
    print(f"{'='*70}\n")

    all_creds = STAFF_USERS + ADMIN_USERS
    threads = []
    start = time.time()

    for i in range(num_connections):
        creds = all_creds[i % len(all_creds)]
        client = WSLoadClient(creds, i, duration)
        t = threading.Thread(target=client.run, daemon=True)
        threads.append(t)
        t.start()
        time.sleep(ramp_delay)

    for t in threads:
        t.join(timeout=duration + 20)

    elapsed = time.time() - start

    success_rate = (metrics['connections_succeeded'] /
                    max(metrics['connections_attempted'], 1)) * 100

    print(f"\n{'='*70}")
    print(f"  RESULTS — WebSocket Stress Test")
    print(f"{'='*70}")
    print(f"  Duration:              {elapsed:.1f}s")
    print(f"  Connections Attempted: {metrics['connections_attempted']}")
    print(f"  Connections Succeeded: {metrics['connections_succeeded']}")
    print(f"  Connections Failed:    {metrics['connections_failed']}")
    print(f"  Max Concurrent:        {metrics['max_concurrent']}")
    print(f"  Messages Sent:         {metrics['messages_sent']}")
    print(f"  Messages Received:     {metrics['messages_received']}")
    print(f"  Handshake Success:     {success_rate:.1f}%")
    print(f"{'='*70}\n")

    if output_json:
        try:
            with open(output_json, 'w', encoding='utf-8') as f:
                json.dump(metrics, f, indent=2)
            print(f"  Saved WebSocket metrics to: {output_json}")
        except Exception as e:
            print(f"  Failed saving WS metrics: {e}")

    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WebSocket Load Test")
    parser.add_argument("--connections", type=int, default=15)
    parser.add_argument("--duration", type=int, default=60)
    parser.add_argument("--output-json", type=str, default="")
    args = parser.parse_args()

    run_ws_load_test(args.connections, args.duration, output_json=args.output_json)
