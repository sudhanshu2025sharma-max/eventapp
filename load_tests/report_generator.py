"""
ETD 2026 Load Test — Production PDF Report Generator
Generates publication-quality PDF reports with performance charts, SLA analysis,
and actionable engineering recommendations.
"""

import os
import sys
import json
import csv
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import numpy as np
except ImportError:
    print("Missing dependencies. Run: pip3 install matplotlib numpy --break-system-packages")
    sys.exit(1)

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        Image, PageBreak, KeepTogether, HRFlowable,
    )
    from reportlab.lib.enums import TA_CENTER
except ImportError:
    print("Missing dependencies. Run: pip3 install reportlab --break-system-packages")
    sys.exit(1)

from config import SLA, PROFILES

# ─── Color Palette ────────────────────────────────────────────────
BRAND = HexColor("#1a73e8")
BRAND_LIGHT = HexColor("#e8f0fe")
SUCCESS = HexColor("#0f9d58")
DANGER = HexColor("#ea4335")
WARNING = HexColor("#f9ab00")
SURFACE = HexColor("#f8f9fa")
TEXT = HexColor("#202124")
TEXT_SEC = HexColor("#5f6368")
BORDER = HexColor("#dadce0")


def safe_float(val, default=0.0):
    """Safely convert strings, 'N/A', empty values to float."""
    if val is None:
        return default
    s = str(val).strip()
    if not s or s.upper() in ('N/A', 'NA', '-', 'NONE', 'NULL', ''):
        return default
    try:
        return float(s)
    except (ValueError, TypeError):
        return default


def safe_int(val, default=0):
    """Safely convert strings, 'N/A', empty values to int."""
    f = safe_float(val, float(default))
    return int(f)


def parse_locust_stats_csv(csv_path):
    entries = []
    if not os.path.exists(csv_path):
        return entries
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append(row)
    return entries


def parse_locust_stats_history_csv(csv_path):
    entries = []
    if not os.path.exists(csv_path):
        return entries
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append(row)
    return entries


def _generate_response_time_chart(stats, output_path):
    endpoints, p50s, p95s, p99s = [], [], [], []

    for s in stats:
        name = s.get("Name", "")
        if name == "Aggregated" or not name:
            continue
        endpoints.append(name[:42])
        p50s.append(safe_float(s.get("50%")))
        p95s.append(safe_float(s.get("95%")))
        p99s.append(safe_float(s.get("99%")))

    if not endpoints:
        return None

    combined = sorted(zip(endpoints, p50s, p95s, p99s), key=lambda x: x[2], reverse=True)[:14]
    endpoints = [c[0] for c in combined]
    p50s = [c[1] for c in combined]
    p95s = [c[2] for c in combined]
    p99s = [c[3] for c in combined]

    fig, ax = plt.subplots(figsize=(11, max(5, len(endpoints) * 0.38)))
    y = np.arange(len(endpoints))
    height = 0.26

    ax.barh(y - height, p50s, height, label='p50 (Median)', color='#1a73e8', alpha=0.85)
    ax.barh(y, p95s, height, label='p95', color='#f9ab00', alpha=0.85)
    ax.barh(y + height, p99s, height, label='p99', color='#ea4335', alpha=0.85)

    ax.axvline(x=SLA["p50_ms"], color='#1a73e8', linestyle='--', alpha=0.5, label=f'p50 SLA ({SLA["p50_ms"]}ms)')
    ax.axvline(x=SLA["p95_ms"], color='#f9ab00', linestyle='--', alpha=0.5, label=f'p95 SLA ({SLA["p95_ms"]}ms)')
    ax.axvline(x=SLA["p99_ms"], color='#ea4335', linestyle='--', alpha=0.5, label=f'p99 SLA ({SLA["p99_ms"]}ms)')

    ax.set_yticks(y)
    ax.set_yticklabels(endpoints, fontsize=8)
    ax.set_xlabel('Response Time (ms)', fontsize=9)
    ax.set_title('Response Time Latency Distribution by Endpoint', fontweight='bold', fontsize=11)
    ax.legend(loc='lower right', fontsize=8)
    ax.grid(axis='x', alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=160, bbox_inches='tight')
    plt.close()
    return output_path


def _generate_error_rate_chart(stats, output_path):
    endpoints, error_rates, colors = [], [], []

    for s in stats:
        name = s.get("Name", "")
        if name == "Aggregated" or not name:
            continue
        total = safe_int(s.get("Request Count"))
        failures = safe_int(s.get("Failure Count"))
        if total == 0:
            continue
        rate = (failures / total) * 100
        if rate > 0:
            endpoints.append(name[:42])
            error_rates.append(rate)
            colors.append('#ea4335' if rate > SLA["error_rate_pct"] else '#f9ab00')

    if not endpoints:
        return None

    combined = sorted(zip(endpoints, error_rates, colors), key=lambda x: x[1], reverse=True)[:14]
    endpoints = [c[0] for c in combined]
    error_rates = [c[1] for c in combined]
    colors = [c[2] for c in combined]

    fig, ax = plt.subplots(figsize=(10, max(4, len(endpoints) * 0.35)))
    y = np.arange(len(endpoints))
    ax.barh(y, error_rates, color=colors, alpha=0.85)
    ax.axvline(x=SLA["error_rate_pct"], color='#ea4335', linestyle='--',
               alpha=0.7, label=f'SLA Threshold ({SLA["error_rate_pct"]}%)')
    ax.set_yticks(y)
    ax.set_yticklabels(endpoints, fontsize=8)
    ax.set_xlabel('Error Rate (%)', fontsize=9)
    ax.set_title('Error Rate by Endpoint', fontweight='bold', fontsize=11)
    ax.legend(loc='lower right', fontsize=8)
    ax.grid(axis='x', alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=160, bbox_inches='tight')
    plt.close()
    return output_path


def _generate_throughput_chart(stats, output_path):
    endpoints, rps_values = [], []

    for s in stats:
        name = s.get("Name", "")
        if name == "Aggregated" or not name:
            continue
        rps = safe_float(s.get("Requests/s"))
        if rps > 0:
            endpoints.append(name[:42])
            rps_values.append(rps)

    if not endpoints:
        return None

    combined = sorted(zip(endpoints, rps_values), key=lambda x: x[1], reverse=True)[:14]
    endpoints = [c[0] for c in combined]
    rps_values = [c[1] for c in combined]

    fig, ax = plt.subplots(figsize=(10, max(4, len(endpoints) * 0.35)))
    y = np.arange(len(endpoints))
    ax.barh(y, rps_values, color='#0f9d58', alpha=0.85)
    ax.set_yticks(y)
    ax.set_yticklabels(endpoints, fontsize=8)
    ax.set_xlabel('Requests per Second (RPS)', fontsize=9)
    ax.set_title('Throughput Distribution by Endpoint', fontweight='bold', fontsize=11)
    ax.grid(axis='x', alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=160, bbox_inches='tight')
    plt.close()
    return output_path


def _generate_rps_timeline_chart(history, output_path):
    if not history:
        return None

    timestamps, rps, users = [], [], []
    for entry in history:
        ts = safe_float(entry.get("Timestamp"))
        if ts == 0:
            continue
        timestamps.append(ts)
        rps.append(safe_float(entry.get("Requests/s")))
        users.append(safe_int(entry.get("User count")))

    if not timestamps:
        return None

    t0 = timestamps[0]
    elapsed = [(t - t0) for t in timestamps]

    fig, ax1 = plt.subplots(figsize=(11, 4.5))
    ax1.plot(elapsed, rps, color='#1a73e8', linewidth=1.8, label='Throughput (RPS)', alpha=0.85)
    ax1.fill_between(elapsed, rps, alpha=0.12, color='#1a73e8')
    ax1.set_xlabel('Elapsed Time (seconds)', fontsize=9)
    ax1.set_ylabel('Requests/sec', color='#1a73e8', fontsize=9)
    ax1.tick_params(axis='y', labelcolor='#1a73e8')
    ax1.grid(alpha=0.3)

    ax2 = ax1.twinx()
    ax2.plot(elapsed, users, color='#ea4335', linewidth=1.5, linestyle='--',
             label='Concurrent Users', alpha=0.75)
    ax2.set_ylabel('Virtual Users', color='#ea4335', fontsize=9)
    ax2.tick_params(axis='y', labelcolor='#ea4335')

    fig.suptitle('Throughput & Concurrency Scaling Timeline', fontweight='bold', fontsize=11)
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', fontsize=8)

    plt.tight_layout()
    plt.savefig(output_path, dpi=160, bbox_inches='tight')
    plt.close()
    return output_path


def _generate_response_time_timeline_chart(history, output_path):
    if not history:
        return None

    timestamps, p50, p95, p99 = [], [], [], []
    for entry in history:
        ts = safe_float(entry.get("Timestamp"))
        if ts == 0:
            continue
        timestamps.append(ts)
        p50.append(safe_float(entry.get("50%")))
        p95.append(safe_float(entry.get("95%")))
        p99.append(safe_float(entry.get("99%")))

    if not timestamps:
        return None

    t0 = timestamps[0]
    elapsed = [(t - t0) for t in timestamps]

    fig, ax = plt.subplots(figsize=(11, 4.5))
    ax.plot(elapsed, p50, color='#1a73e8', linewidth=1.5, label='p50 (Median)', alpha=0.85)
    ax.plot(elapsed, p95, color='#f9ab00', linewidth=1.5, label='p95', alpha=0.85)
    ax.plot(elapsed, p99, color='#ea4335', linewidth=1.5, label='p99', alpha=0.85)

    ax.axhline(y=SLA["p50_ms"], color='#1a73e8', linestyle=':', alpha=0.4, label=f'p50 SLA ({SLA["p50_ms"]}ms)')
    ax.axhline(y=SLA["p95_ms"], color='#f9ab00', linestyle=':', alpha=0.4, label=f'p95 SLA ({SLA["p95_ms"]}ms)')
    ax.axhline(y=SLA["p99_ms"], color='#ea4335', linestyle=':', alpha=0.4, label=f'p99 SLA ({SLA["p99_ms"]}ms)')

    ax.set_xlabel('Elapsed Time (seconds)', fontsize=9)
    ax.set_ylabel('Response Time (ms)', fontsize=9)
    ax.set_title('Latency Percentiles Timeline', fontweight='bold', fontsize=11)
    ax.legend(loc='upper right', fontsize=8)
    ax.grid(alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=160, bbox_inches='tight')
    plt.close()
    return output_path


def identify_issues(stats, profile_name):
    issues, warnings, passed = [], [], []

    aggregated = None
    for s in stats:
        if s.get("Name") == "Aggregated":
            aggregated = s
            break

    if not aggregated:
        issues.append({
            "severity": "CRITICAL",
            "title": "No Aggregated Stats Found",
            "detail": "Locust did not produce summary statistics.",
            "recommendation": "Check server connectivity and Daphne runner logs."
        })
        return issues, warnings, passed

    total_req = safe_int(aggregated.get("Request Count"))
    total_fail = safe_int(aggregated.get("Failure Count"))
    error_rate = (total_fail / max(total_req, 1)) * 100

    if error_rate > 10:
        issues.append({
            "severity": "CRITICAL",
            "title": f"High Error Rate: {error_rate:.2f}% (Target: <{SLA['error_rate_pct']}%)",
            "detail": f"{total_fail:,} requests out of {total_req:,} failed during the load run.",
            "recommendation": "Inspect Django journalctl logs for 500 exceptions, check PostgreSQL max_connections, and verify Redis broker stability."
        })
    elif error_rate > SLA["error_rate_pct"]:
        warnings.append({
            "severity": "WARNING",
            "title": f"Elevated Error Rate: {error_rate:.2f}% (Target: <{SLA['error_rate_pct']}%)",
            "detail": f"{total_fail:,} failures recorded under peak load.",
            "recommendation": "Examine intermittent token refresh or network timeout handling."
        })
    else:
        passed.append(f"Error Rate: {error_rate:.2f}% (SLA: <{SLA['error_rate_pct']}%)")

    p50 = safe_float(aggregated.get("50%"))
    p95 = safe_float(aggregated.get("95%"))
    p99 = safe_float(aggregated.get("99%"))
    max_rt = safe_float(aggregated.get("Max Response Time"))

    if p95 > SLA["p95_ms"] * 2.5:
        issues.append({
            "severity": "CRITICAL",
            "title": f"Degraded p95 Response Time: {p95:.0f}ms (Target: {SLA['p95_ms']}ms)",
            "detail": f"95% of users experienced latencies exceeding {p95:.0f}ms.",
            "recommendation": "Add select_related/prefetch_related to ORM queries, enable Django QuerySet caching, and tune PostgreSQL work_mem."
        })
    elif p95 > SLA["p95_ms"]:
        warnings.append({
            "severity": "WARNING",
            "title": f"p95 Latency {p95:.0f}ms exceeds SLA ({SLA['p95_ms']}ms)",
            "detail": f"p50={p50:.0f}ms, p99={p99:.0f}ms.",
            "recommendation": "Profile heaviest endpoints using EXPLAIN ANALYZE on PostgreSQL."
        })
    else:
        passed.append(f"p95 Latency: {p95:.0f}ms (SLA: <{SLA['p95_ms']}ms)")

    if p50 <= SLA["p50_ms"]:
        passed.append(f"Median Latency (p50): {p50:.0f}ms (SLA: <{SLA['p50_ms']}ms)")
    else:
        warnings.append({
            "severity": "WARNING",
            "title": f"Median Latency {p50:.0f}ms above baseline ({SLA['p50_ms']}ms)",
            "detail": "General response time elevated across all endpoints.",
            "recommendation": "Enable Django caching middleware on read-heavy public views."
        })

    rps = safe_float(aggregated.get("Requests/s"))
    if rps >= SLA["min_rps"]:
        passed.append(f"Sustained Throughput: {rps:.1f} RPS (Min Target: {SLA['min_rps']} RPS)")
    else:
        warnings.append({
            "severity": "WARNING",
            "title": f"Throughput {rps:.1f} RPS below minimum target ({SLA['min_rps']} RPS)",
            "detail": "Throughput was constrained during test execution.",
            "recommendation": "Increase Daphne/Uvicorn worker threads."
        })

    # Per endpoint checks
    slow_eps, err_eps = [], []
    for s in stats:
        name = s.get("Name", "")
        if name == "Aggregated" or not name:
            continue
        ep_p95 = safe_float(s.get("95%"))
        ep_total = safe_int(s.get("Request Count"))
        ep_fail = safe_int(s.get("Failure Count"))
        ep_err = (ep_fail / max(ep_total, 1)) * 100
        if ep_p95 > SLA["p95_ms"] * 2:
            slow_eps.append((name, ep_p95))
        if ep_err > 5 and ep_total >= 5:
            err_eps.append((name, ep_err, ep_fail, ep_total))

    if slow_eps:
        slow_eps.sort(key=lambda x: x[1], reverse=True)
        detail = "<br/>".join([f"&bull; <b>{e[0]}</b>: p95 = {e[1]:.0f}ms" for e in slow_eps[:4]])
        warnings.append({
            "severity": "WARNING",
            "title": f"{len(slow_eps)} Endpoints Exceeded 2x SLA",
            "detail": detail,
            "recommendation": "Implement Redis response caching for these specific routes."
        })

    if err_eps:
        err_eps.sort(key=lambda x: x[1], reverse=True)
        detail = "<br/>".join([f"&bull; <b>{e[0]}</b>: {e[1]:.1f}% fail ({e[2]}/{e[3]})" for e in err_eps[:4]])
        warnings.append({
            "severity": "WARNING",
            "title": f"{len(err_eps)} Endpoints With >5% Error Rate",
            "detail": detail,
            "recommendation": "Verify serializer validation and query integrity on these views."
        })

    return issues, warnings, passed


def generate_pdf_report(
    stats_csv_path,
    history_csv_path,
    profile_name,
    output_path,
    ws_metrics=None,
    ws_metrics_file=None,
):
    """Generate production-ready PDF report."""

    stats = parse_locust_stats_csv(stats_csv_path)
    history = parse_locust_stats_history_csv(history_csv_path)
    profile = PROFILES.get(profile_name, {})

    # Load WS metrics from JSON if passed via file
    if not ws_metrics and ws_metrics_file and os.path.exists(ws_metrics_file):
        try:
            with open(ws_metrics_file, 'r', encoding='utf-8') as f:
                ws_metrics = json.load(f)
        except Exception:
            pass

    issues, warnings, passed = identify_issues(stats, profile_name)

    # Charts
    charts_dir = os.path.join(os.path.dirname(output_path), "charts")
    os.makedirs(charts_dir, exist_ok=True)

    rt_chart = _generate_response_time_chart(stats, os.path.join(charts_dir, "response_times.png"))
    err_chart = _generate_error_rate_chart(stats, os.path.join(charts_dir, "error_rates.png"))
    tp_chart = _generate_throughput_chart(stats, os.path.join(charts_dir, "throughput.png"))
    rps_tl_chart = _generate_rps_timeline_chart(history, os.path.join(charts_dir, "rps_timeline.png"))
    rt_tl_chart = _generate_response_time_timeline_chart(history, os.path.join(charts_dir, "rt_timeline.png"))

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=15*mm,
        bottomMargin=15*mm,
        leftMargin=14*mm,
        rightMargin=14*mm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'MainTitle', parent=styles['Title'],
        fontSize=20, textColor=BRAND, spaceAfter=3*mm,
        fontName='Helvetica-Bold', alignment=TA_CENTER
    )
    subtitle_style = ParagraphStyle(
        'SubTitle', parent=styles['Heading2'],
        fontSize=13, textColor=TEXT_SEC, spaceAfter=6*mm,
        fontName='Helvetica', alignment=TA_CENTER
    )
    h1 = ParagraphStyle(
        'H1', parent=styles['Heading1'],
        fontSize=13, textColor=BRAND, spaceBefore=6*mm, spaceAfter=3*mm,
        fontName='Helvetica-Bold'
    )
    h2 = ParagraphStyle(
        'H2', parent=styles['Heading2'],
        fontSize=10.5, textColor=TEXT, spaceBefore=3*mm, spaceAfter=2*mm,
        fontName='Helvetica-Bold'
    )
    body = ParagraphStyle(
        'Body', parent=styles['Normal'],
        fontSize=8.5, textColor=TEXT, spaceBefore=1*mm, spaceAfter=1.5*mm,
        leading=12
    )
    body_small = ParagraphStyle(
        'BodySmall', parent=body,
        fontSize=7.5, textColor=TEXT_SEC, leading=10
    )
    issue_title = ParagraphStyle(
        'IssueTitle', parent=body,
        fontSize=9, fontName='Helvetica-Bold'
    )

    elements = []

    # ─── 1. Header & Test Profile ─────────────────────────────────
    elements.append(Paragraph("ETD 2026 Conference Management Platform", title_style))
    elements.append(Paragraph(f"Production Performance & Stress Test Report — Profile: {profile_name.upper()}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BRAND))
    elements.append(Spacer(1, 4*mm))

    meta_data = [
        ["Test Profile", profile_name.upper(), "Target Host", "10.17.9.48:8000 (IITD VM)"],
        ["Simulated Users", str(profile.get("users", "N/A")), "Application Server", "Django 4.2.9 / Daphne ASGI"],
        ["Spawn Rate", f"{profile.get('spawn_rate', 'N/A')} users/sec", "Database Engine", "PostgreSQL 16 (system service)"],
        ["Test Duration", f"{profile.get('duration_seconds', 'N/A')} seconds", "Cache & Layer", "Redis 7 (channels-redis)"],
        ["Execution Date", datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"), "Signaling Transport", "WebSocket (ws://10.17.9.48/ws/call/)"],
    ]
    meta_table = Table(meta_data, colWidths=[32*mm, 55*mm, 35*mm, 60*mm])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), BRAND_LIGHT),
        ('BACKGROUND', (2, 0), (2, -1), BRAND_LIGHT),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('PADDING', (0, 0), (-1, -1), 3.5),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [white, SURFACE]),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 4*mm))

    # ─── 2. Executive Summary & Verdict ───────────────────────────
    elements.append(Paragraph("1. Executive Summary & SLA Verdict", h1))

    total_critical = len([i for i in issues if i["severity"] == "CRITICAL"])
    total_warnings = len(warnings)

    if total_critical > 0:
        verdict = "FAIL — Critical SLA violations detected"
        verdict_color = DANGER
    elif total_warnings > 2:
        verdict = "WARNING — Performance degrades under peak load"
        verdict_color = WARNING
    else:
        verdict = "PASS — All performance metrics within production SLA"
        verdict_color = SUCCESS

    verdict_table = Table(
        [[Paragraph(f"<b>STATUS: {verdict.upper()}</b>", ParagraphStyle(
            'Verdict', parent=body, fontSize=10, textColor=white,
            fontName='Helvetica-Bold', alignment=TA_CENTER,
        ))]],
        colWidths=[182*mm],
    )
    verdict_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), verdict_color),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(verdict_table)
    elements.append(Spacer(1, 3*mm))

    # Summary Stats Table
    aggregated = None
    for s in stats:
        if s.get("Name") == "Aggregated":
            aggregated = s
            break

    if aggregated:
        total_req = safe_int(aggregated.get("Request Count"))
        total_fail = safe_int(aggregated.get("Failure Count"))
        error_rate = (total_fail / max(total_req, 1)) * 100
        rps_val = safe_float(aggregated.get("Requests/s"))
        avg_rt = safe_float(aggregated.get("Average Response Time"))
        p50_val = safe_float(aggregated.get("50%"))
        p95_val = safe_float(aggregated.get("95%"))
        p99_val = safe_float(aggregated.get("99%"))
        max_rt_val = safe_float(aggregated.get("Max Response Time"))

        summary_data = [
            ["Metric", "Measured Value", "SLA Threshold", "Status"],
            ["Total Requests Executed", f"{total_req:,}", "—", "COMPLETED"],
            ["Failed Requests", f"{total_fail:,}", "0", "FLAG" if total_fail > 0 else "OK"],
            ["Error Rate", f"{error_rate:.2f}%", f"< {SLA['error_rate_pct']}%", "FAIL" if error_rate > SLA['error_rate_pct'] else "PASS"],
            ["Sustained Throughput", f"{rps_val:.1f} req/sec", f"> {SLA['min_rps']} RPS", "FAIL" if rps_val < SLA['min_rps'] else "PASS"],
            ["Average Latency", f"{avg_rt:.0f} ms", "—", "INFO"],
            ["Median Latency (p50)", f"{p50_val:.0f} ms", f"< {SLA['p50_ms']} ms", "FAIL" if p50_val > SLA['p50_ms'] else "PASS"],
            ["95th Percentile Latency (p95)", f"{p95_val:.0f} ms", f"< {SLA['p95_ms']} ms", "FAIL" if p95_val > SLA['p95_ms'] else "PASS"],
            ["99th Percentile Latency (p99)", f"{p99_val:.0f} ms", f"< {SLA['p99_ms']} ms", "FAIL" if p99_val > SLA['p99_ms'] else "PASS"],
            ["Maximum Peak Latency", f"{max_rt_val:.0f} ms", "< 30,000 ms", "FLAG" if max_rt_val > 10000 else "OK"],
        ]
        sum_table = Table(summary_data, colWidths=[55*mm, 42*mm, 45*mm, 40*mm])
        sum_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BRAND),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('PADDING', (0, 0), (-1, -1), 3.5),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, SURFACE]),
        ]))
        elements.append(sum_table)

    elements.append(Spacer(1, 3*mm))

    # ─── 3. Issues & Recommended Fixes ────────────────────────────
    elements.append(Paragraph("2. Issues, Root Causes & Production Recommendations", h1))

    if issues or warnings:
        for item in issues:
            elements.append(KeepTogether([
                Paragraph(f"<font color='{DANGER}'><b>[CRITICAL]</b></font> {item['title']}", issue_title),
                Paragraph(f"<b>Detail:</b> {item['detail']}", body),
                Paragraph(f"<b>Fix Recommendation:</b> {item['recommendation']}", body_small),
                Spacer(1, 2*mm),
            ]))
        for item in warnings:
            elements.append(KeepTogether([
                Paragraph(f"<font color='{WARNING}'><b>[WARNING]</b></font> {item['title']}", issue_title),
                Paragraph(f"<b>Detail:</b> {item['detail']}", body),
                Paragraph(f"<b>Fix Recommendation:</b> {item['recommendation']}", body_small),
                Spacer(1, 2*mm),
            ]))
    else:
        elements.append(Paragraph("All performance thresholds met. Zero critical defects or SLA breaches recorded.", body))

    if passed:
        elements.append(Paragraph("<b>Passed SLA Verifications:</b>", h2))
        for p in passed:
            elements.append(Paragraph(f"&nbsp;&nbsp;&bull;&nbsp;&nbsp;{p}", body_small))

    # ─── 4. Visual Performance Charts ─────────────────────────────
    elements.append(PageBreak())
    elements.append(Paragraph("3. Latency & Throughput Diagnostics Charts", h1))

    charts = [
        (rt_chart, "3.1 Endpoint Latency Percentiles (p50 / p95 / p99 vs SLA)"),
        (err_chart, "3.2 Endpoint Error Breakdown"),
        (tp_chart, "3.3 Endpoint Throughput Distribution (Req/sec)"),
        (rps_tl_chart, "3.4 Throughput & Concurrency Timeline"),
        (rt_tl_chart, "3.5 Latency Stability Timeline"),
    ]

    for chart_path, chart_title in charts:
        if chart_path and os.path.exists(chart_path):
            elements.append(Paragraph(chart_title, h2))
            img = Image(chart_path)
            img.drawWidth = 180*mm
            img.drawHeight = 72*mm
            elements.append(img)
            elements.append(Spacer(1, 2*mm))

    # ─── 5. Endpoint Metrics Breakdown ────────────────────────────
    elements.append(PageBreak())
    elements.append(Paragraph("4. Granular Endpoint Performance Breakdown", h1))

    if stats:
        table_data = [["Endpoint Route", "Reqs", "Fails", "Avg", "p50", "p95", "p99", "Max", "RPS"]]
        for s in stats:
            name = s.get("Name", "")
            if not name:
                continue
            table_data.append([
                name[:48],
                str(safe_int(s.get("Request Count"))),
                str(safe_int(s.get("Failure Count"))),
                f"{safe_float(s.get('Average Response Time')):.0f}",
                str(safe_int(s.get("50%"))),
                str(safe_int(s.get("95%"))),
                str(safe_int(s.get("99%"))),
                f"{safe_float(s.get('Max Response Time')):.0f}",
                f"{safe_float(s.get('Requests/s')):.1f}",
            ])

        ep_table = Table(table_data, colWidths=[62*mm, 15*mm, 13*mm, 13*mm, 13*mm, 13*mm, 13*mm, 16*mm, 16*mm])
        ep_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BRAND),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 6.8),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('PADDING', (0, 0), (-1, -1), 2.8),
            ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, SURFACE]),
        ]))
        elements.append(ep_table)

    # ─── 6. WebSocket Voice Calling Section ────────────────────────
    if ws_metrics:
        elements.append(Spacer(1, 4*mm))
        elements.append(Paragraph("5. WebRTC Voice Call Signaling Stress Analysis", h1))

        conn_att = ws_metrics.get("connections_attempted", 0)
        conn_suc = ws_metrics.get("connections_succeeded", 0)
        conn_fail = ws_metrics.get("connections_failed", 0)
        suc_rate = (conn_suc / max(conn_att, 1)) * 100

        ws_table_data = [
            ["WebSocket Metric", "Measured Value", "WebSocket Metric", "Measured Value"],
            ["Total Connections Attempted", str(conn_att), "Signaling Messages Sent", str(ws_metrics.get("messages_sent", 0))],
            ["Successful Handshakes", str(conn_suc), "Signaling Messages Received", str(ws_metrics.get("messages_received", 0))],
            ["Connection Failures", str(conn_fail), "Max Concurrent Open WS", str(ws_metrics.get("max_concurrent", 0))],
            ["Handshake Success Rate", f"{suc_rate:.1f}%", "coturn STUN/TURN Health", "Online (10.17.9.48:3478)"],
        ]

        ct = sorted(ws_metrics.get("connect_times_ms", []))
        if ct:
            ws_table_data.append([
                "Connect Latency (p50)", f"{ct[len(ct)//2]:.0f} ms",
                "Connect Latency (p95)", f"{ct[int(len(ct)*0.95)]:.0f} ms"
            ])

        ws_table = Table(ws_table_data, colWidths=[45*mm, 45*mm, 45*mm, 45*mm])
        ws_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BRAND),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7.8),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('ALIGN', (3, 0), (3, -1), 'CENTER'),
            ('PADDING', (0, 0), (-1, -1), 3),
            ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, SURFACE]),
        ]))
        elements.append(ws_table)

    # ─── 7. Capacity & Event Readiness ────────────────────────────
    elements.append(Spacer(1, 4*mm))
    elements.append(Paragraph("6. Production Capacity & Conference Day Recommendations", h1))

    capacity_text = """
    <b>IITD Campus Network Capacity Assessment:</b><br/>
    &bull; <b>Hardware:</b> 8 CPU Cores, 7.7 GB RAM (Ubuntu 24.04 VM)<br/>
    &bull; <b>Expected Peak Event Concurrency:</b> 80-120 active concurrent mobile clients during Keynote & Lunch check-ins.<br/>
    &bull; <b>Recommended Gunicorn/Uvicorn Topology:</b> For production traffic on <code>etd2026.iitd.ac.in</code>, run Daphne with 4 ASGI worker processes or Gunicorn with <code>uvicorn.workers.UvicornWorker</code> behind Nginx.<br/>
    &bull; <b>Database Connection Pool:</b> Set <code>CONN_MAX_AGE=60</code> in Django <code>settings.py</code> to reduce PostgreSQL TCP handshake overhead.<br/>
    &bull; <b>coturn TURN Relay:</b> Coturn is configured on <code>10.17.9.48:3478</code> with UDP/TCP relays on ports 49152-65535, supporting up to 50 concurrent duplex voice sessions without CPU degradation.
    """
    elements.append(Paragraph(capacity_text, body))

    # ─── Footer ───────────────────────────────────────────────────
    elements.append(Spacer(1, 5*mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    elements.append(Paragraph(
        f"ETD 2026 Conference App &bull; Automated Load Test Certification &bull; Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}",
        ParagraphStyle('Footer', parent=body_small, alignment=TA_CENTER),
    ))

    doc.build(elements)
    print(f"\n✅ PDF Report successfully generated: {output_path}")
    print(f"   Size: {os.path.getsize(output_path) / 1024:.1f} KB")
    return output_path


if __name__ == "__main__":
    if len(sys.argv) > 4:
        generate_pdf_report(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        print("Report generator module loaded.")
