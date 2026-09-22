"""
Production SLA Thresholds — ETD 2026 Certification Criteria
Based on industry standards (Google SRE, AWS Well-Architected Framework)
"""

# ─── API Performance ──────────────────────────────────────────────
API_SLA = {
    "p50_ms": 200,          # Median must be < 200ms
    "p95_ms": 800,          # 95% of requests < 800ms
    "p99_ms": 2000,         # 99% of requests < 2s
    "max_ms": 10000,        # Absolute max 10s
    "error_rate_pct": 1.0,  # < 1% error rate
    "min_rps": 20,          # Sustain 20 RPS minimum
    "throughput_target": 50, # Target 50 RPS at peak
}

# ─── Database (PostgreSQL) ────────────────────────────────────────
DB_SLA = {
    "min_tps": 100,              # 100 transactions/sec minimum
    "target_tps": 500,           # 500 TPS target
    "max_connection_time_ms": 100,
    "max_query_time_ms": 500,
    "max_concurrent_conns": 100,
    "deadlock_tolerance": 0,     # Zero deadlocks accepted
}

# ─── Cache (Redis) ────────────────────────────────────────────────
REDIS_SLA = {
    "min_ops_per_sec": 10000,
    "max_latency_ms": 5,
    "max_memory_mb": 512,
    "eviction_tolerance": 0,     # Zero evictions under normal load
}

# ─── WebSocket / WebRTC ───────────────────────────────────────────
WS_SLA = {
    "min_connection_success_rate": 95.0,
    "max_handshake_ms": 500,
    "max_signaling_latency_ms": 200,
    "concurrent_calls_target": 25,   # 25 simultaneous calls
    "concurrent_calls_max": 50,      # 50 max capacity
}

# ─── System Resources ─────────────────────────────────────────────
SYSTEM_SLA = {
    "max_cpu_pct": 80,          # CPU should stay under 80%
    "max_memory_pct": 85,       # RAM under 85%
    "max_disk_io_pct": 70,      # Disk IO under 70%
    "max_network_mbps": 100,    # Network under 100 Mbps
    "min_free_disk_gb": 5,      # 5GB free disk minimum
}

# ─── Security ─────────────────────────────────────────────────────
SECURITY_SLA = {
    "max_auth_bypass_attempts_allowed": 0,
    "max_sql_injection_success": 0,
    "max_xss_success": 0,
    "jwt_expiry_enforced": True,
    "rate_limiting_enforced": True,
}

# ─── Endurance / Soak ─────────────────────────────────────────────
ENDURANCE_SLA = {
    "duration_minutes": 30,
    "max_memory_growth_pct": 20,   # Memory shouldn't grow > 20% during soak
    "max_response_time_drift_pct": 30,
    "min_uptime_pct": 99.9,
}

# ─── Chaos Engineering ────────────────────────────────────────────
CHAOS_SLA = {
    "max_recovery_time_seconds": 30,
    "data_loss_tolerance": 0,
    "graceful_degradation_required": True,
}

# ─── Certification Grade ──────────────────────────────────────────
def calculate_grade(scores):
    """Calculate letter grade from layer scores (0-100 each)."""
    avg = sum(scores.values()) / len(scores) if scores else 0
    if avg >= 95: return "A+", "PRODUCTION READY - ENTERPRISE GRADE"
    if avg >= 90: return "A",  "PRODUCTION READY"
    if avg >= 85: return "B+", "PRODUCTION READY WITH MINOR IMPROVEMENTS"
    if avg >= 80: return "B",  "ACCEPTABLE - RECOMMENDED IMPROVEMENTS"
    if avg >= 70: return "C",  "CONDITIONAL PASS - REQUIRES OPTIMIZATION"
    if avg >= 60: return "D",  "NOT PRODUCTION READY"
    return "F", "FAIL - CRITICAL ISSUES"
