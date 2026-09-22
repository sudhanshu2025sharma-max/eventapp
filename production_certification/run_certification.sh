#!/bin/bash
#
# ETD 2026 — Production Certification Master Runner
# Executes all 10 test layers and generates signed certificate + reports.
#

set +e  # Continue on errors — we want all layers to run

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export no_proxy="10.17.9.48,localhost,127.0.0.1"
export NO_PROXY="10.17.9.48,localhost,127.0.0.1"
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_DIR="$SCRIPT_DIR/results/certification_${TIMESTAMP}"
mkdir -p "$RESULTS_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

MODE="${1:-standard}"

# ─── Test Modes ───────────────────────────────────────────────────
# quick      = 15 min total (short soak, small load)
# standard   = 45 min total (full soak, realistic load)
# enterprise = 90 min total (extended tests + chaos)

case "$MODE" in
    quick)
        L1_USERS=30;  L1_DURATION=120
        L2_DURATION=30
        L3_CONNS=10;  L3_DURATION=30
        L6_MINUTES=3
        ;;
    standard)
        L1_USERS=80;  L1_DURATION=300
        L2_DURATION=60
        L3_CONNS=20;  L3_DURATION=60
        L6_MINUTES=10
        ;;
    enterprise)
        L1_USERS=150; L1_DURATION=600
        L2_DURATION=120
        L3_CONNS=50;  L3_DURATION=120
        L6_MINUTES=30
        ;;
    *)
        echo "Usage: $0 {quick|standard|enterprise}"
        exit 1
        ;;
esac

# ─── Banner ───────────────────────────────────────────────────────
clear
echo -e "${BOLD}${BLUE}"
cat << 'BANNER'
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║          ETD 2026 PRODUCTION CERTIFICATION SUITE                     ║
║          Enterprise-Grade Multi-Layer Testing System                 ║
║                                                                      ║
║          10 Layers  |  Signed Certificate  |  Full Attestation      ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
BANNER
echo -e "${NC}"

echo -e "${CYAN}Mode:${NC}       ${BOLD}${MODE^^}${NC}"
echo -e "${CYAN}Started:${NC}    $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "${CYAN}Results:${NC}    $RESULTS_DIR"
echo -e "${CYAN}Target:${NC}     http://10.17.9.48:8000"
echo ""

# ─── Pre-flight ──────────────────────────────────────────────────
echo -e "${YELLOW}[PRE-FLIGHT] Verifying environment...${NC}"

if ! curl -s --max-time 5 http://10.17.9.48:8000/api/v1/auth/login/ > /dev/null 2>&1; then
    echo -e "${RED}✗ Django server unreachable at http://10.17.9.48:8000${NC}"
    echo -e "${YELLOW}  Run: screen -r django${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Django/Daphne reachable${NC}"

if ! systemctl is-active --quiet postgresql 2>/dev/null && ! pgrep -x postgres > /dev/null; then
    echo -e "${RED}✗ PostgreSQL not running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL active${NC}"

if ! redis-cli ping > /dev/null 2>&1; then
    echo -e "${RED}✗ Redis not responding${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Redis active${NC}"

if ! systemctl is-active --quiet coturn 2>/dev/null; then
    echo -e "${YELLOW}⚠ coturn not active (Layer 4 will note this)${NC}"
else
    echo -e "${GREEN}✓ coturn active${NC}"
fi

echo ""
echo -e "${YELLOW}Starting 10-layer certification...${NC}"
echo ""

# ─── Layer Execution ─────────────────────────────────────────────
run_layer() {
    local NUM="$1"
    local NAME="$2"
    local CMD="$3"

    echo -e "${BLUE}${BOLD}▶ LAYER $NUM: $NAME${NC}"
    START=$(date +%s)
    eval "$CMD"
    END=$(date +%s)
    DURATION=$((END - START))
    echo -e "${CYAN}  Duration: ${DURATION}s${NC}"
    echo ""
}

# Layer 1: API Load
run_layer 1 "API Load Testing" \
    "python3 -c \"
import sys; sys.path.insert(0, '$SCRIPT_DIR')
from layers.layer1_api_load import run_layer1
run_layer1('$RESULTS_DIR', users=$L1_USERS, spawn_rate=10, duration=$L1_DURATION)
\""

# Layer 2: Infrastructure
run_layer 2 "Infrastructure Stress (PostgreSQL + Redis)" \
    "python3 -c \"
import sys; sys.path.insert(0, '$SCRIPT_DIR')
from layers.layer2_infrastructure import run_layer2
run_layer2('$RESULTS_DIR')
\""

# Layer 3: WebSocket
run_layer 3 "WebSocket Capacity" \
    "python3 -c \"
import sys; sys.path.insert(0, '$SCRIPT_DIR')
from layers.layer3_websocket import run_layer3
run_layer3('$RESULTS_DIR', connections=$L3_CONNS, duration=$L3_DURATION)
\""

# Layer 4: WebRTC
run_layer 4 "WebRTC Voice Calling" \
    "python3 -c \"
import sys; sys.path.insert(0, '$SCRIPT_DIR')
from layers.layer4_webrtc import run_layer4
run_layer4('$RESULTS_DIR')
\""

# Layer 5: Security
run_layer 5 "Security Testing" \
    "python3 -c \"
import sys; sys.path.insert(0, '$SCRIPT_DIR')
from layers.layer5_security import run_layer5
run_layer5('$RESULTS_DIR')
\""

# Layer 6: Endurance (if enterprise mode)
if [ "$L6_MINUTES" -gt 3 ]; then
    echo -e "${YELLOW}⚠ Layer 6 (Endurance) will take $L6_MINUTES minutes...${NC}"
fi
run_layer 6 "Endurance / Soak (${L6_MINUTES}m)" \
    "python3 -c \"
import sys; sys.path.insert(0, '$SCRIPT_DIR')
from layers.layer6_endurance import run_layer6
run_layer6('$RESULTS_DIR', duration_minutes=$L6_MINUTES)
\""

# Layer 7: Chaos (only enterprise mode)
if [ "$MODE" = "enterprise" ]; then
    run_layer 7 "Chaos Engineering" \
        "python3 -c \"
import sys; sys.path.insert(0, '$SCRIPT_DIR')
from layers.layer7_chaos import run_layer7
run_layer7('$RESULTS_DIR')
\""
else
    echo -e "${YELLOW}⏭ Layer 7 (Chaos Engineering): SKIPPED in $MODE mode${NC}"
    echo ""
fi

# Layer 8: Data Integrity
run_layer 8 "Data Integrity" \
    "python3 -c \"
import sys; sys.path.insert(0, '$SCRIPT_DIR')
from layers.layer8_data_integrity import run_layer8
run_layer8('$RESULTS_DIR')
\""

# ─── Generate Certificate ────────────────────────────────────────
echo -e "${YELLOW}${BOLD}▶ GENERATING CERTIFICATE${NC}"

python3 << PYEOF
import sys, os, json, glob
sys.path.insert(0, '$SCRIPT_DIR')
from certification.certificate_generator import generate_certificate

results_dir = '$RESULTS_DIR'
all_results = {}
for f in glob.glob(os.path.join(results_dir, "layer*.json")):
    try:
        with open(f) as fp:
            data = json.load(fp)
            all_results[data.get('name', os.path.basename(f))] = data
    except Exception as e:
        print(f"  Warn: Could not load {f}: {e}")

cert_path = os.path.join(results_dir, "ETD2026_PRODUCTION_CERTIFICATE_${TIMESTAMP}.pdf")
result = generate_certificate(all_results, cert_path)
print(f"\n{'='*70}")
print(f"  CERTIFICATION COMPLETE")
print(f"{'='*70}")
print(f"  Grade:           {result['grade']}")
print(f"  Overall Score:   {result['score']:.1f}/100")
print(f"  Verdict:         {result['verdict']}")
print(f"  Certificate ID:  {result['certificate_id']}")
print(f"  Location:        {cert_path}")
print(f"{'='*70}")
PYEOF

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  CERTIFICATION COMPLETE${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Results Directory: ${BOLD}$RESULTS_DIR${NC}"
echo ""
echo -e "${YELLOW}Generated Files:${NC}"
ls -lh "$RESULTS_DIR"/*.pdf "$RESULTS_DIR"/*.json 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}'
echo ""
