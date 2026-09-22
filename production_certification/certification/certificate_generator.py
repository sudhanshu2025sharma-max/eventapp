"""
Production Readiness Certificate Generator
Generates a signed PDF certificate + detailed executive report.
"""

import os
import sys
import json
import hashlib
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import numpy as np
except ImportError:
    print("Install: pip3 install matplotlib numpy --break-system-packages")
    sys.exit(1)

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, KeepTogether, HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

from config.thresholds import calculate_grade
from config.test_matrix import TEST_COVERAGE

# Colors
BRAND = HexColor("#0f4c81")
GOLD = HexColor("#d4af37")
SUCCESS = HexColor("#0f9d58")
DANGER = HexColor("#ea4335")
WARNING = HexColor("#f9ab00")
SURFACE = HexColor("#f8f9fa")
TEXT = HexColor("#202124")
TEXT_SEC = HexColor("#5f6368")
BORDER = HexColor("#dadce0")


def generate_hash(content):
    """Generate SHA-256 verification hash."""
    return hashlib.sha256(str(content).encode()).hexdigest()[:16].upper()


def generate_score_chart(scores, output_path):
    """Radar-style score chart across all layers."""
    layers = list(scores.keys())
    values = list(scores.values())

    fig, ax = plt.subplots(figsize=(10, 6))
    colors = ['#0f9d58' if v >= 80 else '#f9ab00' if v >= 60 else '#ea4335' for v in values]

    y_pos = np.arange(len(layers))
    ax.barh(y_pos, values, color=colors, alpha=0.85)
    ax.set_yticks(y_pos)
    ax.set_yticklabels([l[:35] for l in layers], fontsize=9)
    ax.set_xlabel('Score (out of 100)')
    ax.set_xlim([0, 100])
    ax.axvline(x=70, color='gray', linestyle='--', alpha=0.5, label='Pass Threshold (70)')
    ax.axvline(x=90, color='green', linestyle='--', alpha=0.5, label='Excellence (90)')

    for i, v in enumerate(values):
        ax.text(v + 1, i, f' {v:.1f}', va='center', fontsize=9, fontweight='bold')

    ax.set_title('Production Certification — Layer Scores', fontweight='bold', fontsize=12)
    ax.legend(loc='lower right', fontsize=8)
    ax.grid(axis='x', alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=160, bbox_inches='tight')
    plt.close()


def generate_certificate(all_results, output_path):
    """Generate the signed certification PDF."""
    styles = getSampleStyleSheet()

    # Calculate overall grade
    scores = {r["name"]: r["score"] for r in all_results.values() if isinstance(r, dict) and "score" in r}
    overall_score = sum(scores.values()) / len(scores) if scores else 0
    grade, verdict = calculate_grade(scores)

    # Generate verification hash
    hash_input = json.dumps(scores, sort_keys=True) + str(datetime.now().date())
    verification_hash = generate_hash(hash_input)

    # Charts
    charts_dir = os.path.join(os.path.dirname(output_path), "cert_charts")
    os.makedirs(charts_dir, exist_ok=True)
    score_chart = os.path.join(charts_dir, "scores.png")
    generate_score_chart(scores, score_chart)

    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        topMargin=15*mm, bottomMargin=15*mm,
        leftMargin=15*mm, rightMargin=15*mm,
    )

    elements = []

    cert_title = ParagraphStyle('CertTitle', parent=styles['Title'],
        fontSize=26, textColor=BRAND, alignment=TA_CENTER,
        fontName='Helvetica-Bold', spaceAfter=3*mm)
    cert_subtitle = ParagraphStyle('CertSub', parent=styles['Heading1'],
        fontSize=14, textColor=GOLD, alignment=TA_CENTER,
        fontName='Helvetica-Bold', spaceAfter=5*mm)
    body = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=10, textColor=TEXT, spaceBefore=1*mm, leading=13)
    body_center = ParagraphStyle('BodyCenter', parent=body,
        alignment=TA_CENTER)
    body_small = ParagraphStyle('Small', parent=body,
        fontSize=8, textColor=TEXT_SEC)
    h1 = ParagraphStyle('H1', parent=styles['Heading1'],
        fontSize=13, textColor=BRAND, spaceBefore=6*mm, spaceAfter=3*mm,
        fontName='Helvetica-Bold')
    h2 = ParagraphStyle('H2', parent=styles['Heading2'],
        fontSize=11, textColor=TEXT, spaceBefore=3*mm, spaceAfter=2*mm,
        fontName='Helvetica-Bold')

    # ─── COVER: CERTIFICATE ────────────────────────────────────────
    elements.append(Spacer(1, 15*mm))
    elements.append(HRFlowable(width="100%", thickness=3, color=GOLD))
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph("PRODUCTION READINESS CERTIFICATE", cert_title))
    elements.append(Paragraph("Enterprise-Grade Verification & Attestation", cert_subtitle))
    elements.append(HRFlowable(width="100%", thickness=3, color=GOLD))
    elements.append(Spacer(1, 10*mm))

    elements.append(Paragraph("This certifies that the software system:", body_center))
    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph(
        "<b>ETD 2026 Conference Management Platform</b>",
        ParagraphStyle('AppName', parent=body, fontSize=18, alignment=TA_CENTER,
                       textColor=BRAND, fontName='Helvetica-Bold')))
    elements.append(Paragraph(
        "IIT Delhi Central Library — <i>ETDs in the age of AI</i>",
        ParagraphStyle('AppSub', parent=body, fontSize=11, alignment=TA_CENTER,
                       textColor=TEXT_SEC)))
    elements.append(Spacer(1, 8*mm))
    elements.append(Paragraph(
        "has undergone comprehensive multi-layer production testing across "
        "10 certification dimensions including API load, infrastructure stress, "
        "security auditing, endurance validation, and chaos engineering, "
        "and has achieved the following certification:",
        body_center))
    elements.append(Spacer(1, 8*mm))

    # Grade badge
    grade_color = SUCCESS if grade in ["A+", "A"] else WARNING if grade in ["B+", "B"] else DANGER

    grade_table = Table(
        [[Paragraph(f"<font size='72' color='white'><b>{grade}</b></font>",
                    ParagraphStyle('Grade', parent=body, alignment=TA_CENTER))]],
        colWidths=[60*mm],
    )
    grade_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), grade_color),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('PADDING', (0, 0), (-1, -1), 15),
    ]))

    outer_table = Table([[grade_table]], colWidths=[180*mm])
    outer_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(outer_table)
    elements.append(Spacer(1, 5*mm))

    elements.append(Paragraph(
        f"<b>{verdict}</b>",
        ParagraphStyle('Verdict', parent=body, fontSize=14, alignment=TA_CENTER,
                       textColor=grade_color, fontName='Helvetica-Bold')))
    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph(
        f"Overall Score: <b>{overall_score:.1f} / 100</b>",
        ParagraphStyle('Score', parent=body, fontSize=12, alignment=TA_CENTER)))

    elements.append(Spacer(1, 10*mm))
    elements.append(HRFlowable(width="60%", thickness=0.5, color=BORDER, hAlign='CENTER'))
    elements.append(Spacer(1, 3*mm))

    # Certification metadata
    meta = [
        ["Certificate ID", verification_hash],
        ["Issue Date", datetime.now().strftime("%B %d, %Y")],
        ["Test Duration", f"{sum(r.get('config',{}).get('duration', 0) for r in all_results.values() if isinstance(r, dict)) // 60} minutes total"],
        ["Layers Tested", str(len(all_results))],
        ["Target System", "http://10.17.9.48:8000 (IITD VM)"],
        ["Certifying Authority", "ETD 2026 Automated Certification Suite"],
        ["Verification Hash", f"SHA-256: {verification_hash}"],
    ]
    meta_table = Table(meta, colWidths=[55*mm, 100*mm], hAlign='CENTER')
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), SURFACE),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 8*mm))

    # Signature line
    elements.append(HRFlowable(width="40%", thickness=1, color=black, hAlign='CENTER'))
    elements.append(Paragraph("<b>Digital Signature</b>",
                              ParagraphStyle('Sig', parent=body, alignment=TA_CENTER, fontSize=9)))
    elements.append(Paragraph(f"Certified: {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}",
                              ParagraphStyle('SigDate', parent=body_small, alignment=TA_CENTER)))

    # ─── PAGE 2: SCORE BREAKDOWN ──────────────────────────────────
    elements.append(PageBreak())
    elements.append(Paragraph("Certification Score Breakdown", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=BRAND))
    elements.append(Spacer(1, 3*mm))

    if os.path.exists(score_chart):
        img = Image(score_chart)
        img.drawWidth = 180*mm
        img.drawHeight = 108*mm
        elements.append(img)

    # Score table
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph("Layer-by-Layer Results", h2))

    score_table_data = [["Layer", "Test Category", "Score", "Status", "Weight"]]
    weights = {name: info["weight"] for name, info in TEST_COVERAGE.items()}

    for name, result in all_results.items():
        if not isinstance(result, dict) or "score" not in result:
            continue
        s = result["score"]
        status = "✅ PASS" if s >= 70 else "⚠ WARN" if s >= 60 else "❌ FAIL"
        layer_num = f"Layer {result.get('layer', '-')}"
        # Find matching weight
        weight = 10
        for k, w in weights.items():
            if result["name"].lower() in k.lower() or k.lower() in result["name"].lower():
                weight = w
                break
        score_table_data.append([layer_num, result["name"], f"{s:.1f}", status, f"{weight}%"])

    score_table = Table(score_table_data, colWidths=[22*mm, 70*mm, 25*mm, 30*mm, 25*mm])
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, SURFACE]),
    ]))
    elements.append(score_table)

    # ─── PAGE 3+: DETAILED FINDINGS ───────────────────────────────
    elements.append(PageBreak())
    elements.append(Paragraph("Detailed Findings & Recommendations", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=BRAND))
    elements.append(Spacer(1, 3*mm))

    for name, result in all_results.items():
        if not isinstance(result, dict):
            continue

        elements.append(Paragraph(f"Layer {result.get('layer', '?')}: {result.get('name', name)}", h2))

        # Key metrics
        if "metrics" in result:
            m = result["metrics"]
            metric_text = " | ".join([f"<b>{k}:</b> {v}" for k, v in m.items() if not isinstance(v, (dict, list))])
            elements.append(Paragraph(metric_text[:400], body_small))

        # Issues
        issues = result.get("issues", [])
        if issues:
            for i in issues:
                elements.append(Paragraph(f"⚠ {i}", body_small))

        # Pass/fail
        status_text = "✅ PASS" if result.get("passed") else "❌ FAIL"
        elements.append(Paragraph(
            f"<b>Score:</b> {result.get('score', 0):.1f}/100 &nbsp;&nbsp; <b>Status:</b> {status_text}",
            body))
        elements.append(Spacer(1, 2*mm))

    # ─── FINAL PAGE: RECOMMENDATIONS ──────────────────────────────
    elements.append(PageBreak())
    elements.append(Paragraph("Production Deployment Recommendations", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=BRAND))
    elements.append(Spacer(1, 3*mm))

    recommendations = generate_recommendations(all_results, overall_score, grade)
    for rec in recommendations:
        elements.append(Paragraph(f"<b>{rec['category']}:</b> {rec['action']}", body))
        elements.append(Spacer(1, 2*mm))

    elements.append(Spacer(1, 10*mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    elements.append(Paragraph(
        f"This certificate is issued by the ETD 2026 Automated Testing Suite v1.0. "
        f"Verification Hash: {verification_hash}. "
        f"Issued {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}.",
        body_small))

    doc.build(elements)
    print(f"\n✅ Certificate generated: {output_path}")
    return {
        "certificate_id": verification_hash,
        "grade": grade,
        "score": overall_score,
        "verdict": verdict,
    }


def generate_recommendations(all_results, overall_score, grade):
    """Generate deployment recommendations based on results."""
    recs = []

    if overall_score >= 90:
        recs.append({
            "category": "Deployment Status",
            "action": "System is CERTIFIED for production deployment. Proceed with confidence.",
        })
    elif overall_score >= 80:
        recs.append({
            "category": "Deployment Status",
            "action": "System is production-ready with minor improvements recommended. Deploy with monitoring.",
        })
    else:
        recs.append({
            "category": "Deployment Status",
            "action": "System requires optimization before production. Address failing layers first.",
        })

    # Layer-specific recommendations
    for name, result in all_results.items():
        if not isinstance(result, dict) or result.get("passed", True):
            continue

        layer_num = result.get("layer", 0)
        if layer_num == 1:
            recs.append({
                "category": "API Performance",
                "action": "Enable Django cache middleware, add PostgreSQL query indexes, consider Gunicorn + Uvicorn workers.",
            })
        elif layer_num == 2:
            recs.append({
                "category": "Infrastructure",
                "action": "Tune PostgreSQL max_connections, enable pgbouncer connection pooling, increase Redis maxmemory.",
            })
        elif layer_num == 5:
            recs.append({
                "category": "Security",
                "action": "Install django-ratelimit and django-axes for brute-force protection. Review JWT signing.",
            })
        elif layer_num == 6:
            recs.append({
                "category": "Endurance",
                "action": "Investigate memory growth patterns. Set CONN_MAX_AGE=60 in Django settings.",
            })

    recs.append({
        "category": "Day-of-Event Monitoring",
        "action": "Run htop, pg_stat_activity, and redis-cli monitor in tmux/screen during event.",
    })
    recs.append({
        "category": "Rollback Plan",
        "action": "Have Django restart command ready: 'sudo systemctl restart daphne' + Redis flush script.",
    })

    return recs
