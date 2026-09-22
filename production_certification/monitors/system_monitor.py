"""System resource monitor — samples CPU/RAM/Disk/Network at intervals."""

import time
import json
import threading
import psutil
from datetime import datetime


class SystemMonitor:
    def __init__(self, interval=2):
        self.interval = interval
        self.running = False
        self.samples = []
        self.thread = None

    def start(self):
        self.running = True
        self.samples = []
        self.thread = threading.Thread(target=self._collect, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)

    def _collect(self):
        # Prime psutil
        psutil.cpu_percent(interval=None)
        net_start = psutil.net_io_counters()
        while self.running:
            try:
                cpu = psutil.cpu_percent(interval=self.interval)
                mem = psutil.virtual_memory()
                disk = psutil.disk_usage('/')
                net = psutil.net_io_counters()
                load_avg = psutil.getloadavg()

                self.samples.append({
                    "ts": time.time(),
                    "cpu_pct": cpu,
                    "mem_pct": mem.percent,
                    "mem_used_mb": mem.used / 1024 / 1024,
                    "mem_available_mb": mem.available / 1024 / 1024,
                    "disk_pct": disk.percent,
                    "disk_free_gb": disk.free / 1024 / 1024 / 1024,
                    "net_bytes_sent": net.bytes_sent - net_start.bytes_sent,
                    "net_bytes_recv": net.bytes_recv - net_start.bytes_recv,
                    "load_1min": load_avg[0],
                })
            except Exception as e:
                pass

    def summary(self):
        if not self.samples:
            return {}
        cpus = [s["cpu_pct"] for s in self.samples]
        mems = [s["mem_pct"] for s in self.samples]
        return {
            "duration_seconds": len(self.samples) * self.interval,
            "cpu_avg": sum(cpus) / len(cpus),
            "cpu_max": max(cpus),
            "mem_avg": sum(mems) / len(mems),
            "mem_max": max(mems),
            "mem_growth_pct": mems[-1] - mems[0] if len(mems) > 1 else 0,
            "samples_count": len(self.samples),
            "raw_samples": self.samples,
        }

    def save(self, path):
        with open(path, 'w') as f:
            json.dump(self.summary(), f, indent=2, default=str)


if __name__ == "__main__":
    mon = SystemMonitor(interval=1)
    mon.start()
    print("Monitoring for 10s...")
    time.sleep(10)
    mon.stop()
    print(json.dumps(mon.summary(), indent=2, default=str))
