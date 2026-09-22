#!/bin/bash
#
# ETD 2026 — Production Load Test Runner
# Executes test profiles, runs WebSocket voice call tests, and generates PDF reports.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Bypass IITD Proxy for localhost & VM IP
export no_proxy="10.17.9.48,localhost,127.0.0.1"
export NO_PROXY="10.17.9.48,localhost,127.0.0.1"

RESULTS_DIR="$SCRIPT_DIR/results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
HOST="http://10.17.9.48:8000"

mkdir -p "$RESULTS_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}ETD 2026 Conference App — Production Load Test Suite${NC}       ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${YELLOW}Target Host: $HOST${NC}                         ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

run_profile() {
    local PROFILE="$1"
    local USERS RATE DURATION DESC

    case "$PROFILE" in
        smoke)    USERS=5;   RATE=2;  DURATION=60;   DESC="Sanity smoke test" ;;
        normal)   USERS=35;  RATE=5;  DURATION=180;  DESC="Standard conference browsing" ;;
        peak)     USERS=80;  RATE=10; DURATION=300;  DESC="Peak keynote & check-in rush" ;;
        stress)   USERS=150; RATE=15; DURATION=400;  DESC="Stress & capacity boundary" ;;
        brutal)   USERS=300; RATE=25; DURATION=600;  DESC="Brutal maximum breaking point" ;;
        spike)    USERS=100; RATE=50; DURATION=180;  DESC="Sudden traffic spike burst" ;;
        soak)     USERS=50;  RATE=5;  DURATION=1800; DESC="30-min endurance soak" ;;
        *)
            echo -e "${RED}Unknown profile: $PROFILE${NC}"
            echo "Available profiles: smoke, normal, peak, stress, brutal, spike, soak"
            exit 1
            ;;
    esac

    local RUN_DIR="$RESULTS_DIR/${PROFILE}_${TIMESTAMP}"
    mkdir -p "$RUN_DIR"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ PROFILE: ${PROFILE^^} — $DESC${NC}"
    echo -e "  Virtual Users: ${YELLOW}$USERS${NC} | Spawn Rate: ${YELLOW}$RATE/s${NC} | Duration: ${YELLOW}${DURATION}s${NC}"
    echo -e "  Output Directory: ${BLUE}$RUN_DIR/${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # 1. Health check
    echo -e "  ${YELLOW}⏳ Checking Daphne / Django server health...${NC}"
    if ! curl -s --max-time 5 "$HOST/api/v1/auth/login/" > /dev/null 2>&1; then
        echo -e "  ${RED}✗ Cannot connect to $HOST${NC}"
        echo -e "  ${YELLOW}Please verify Django/Daphne is running: screen -r django${NC}"
        return 1
    fi
    echo -e "  ${GREEN}✓ Server is active${NC}"

    # 2. Run Locust HTTP
    echo -e "  ${YELLOW}⏳ Executing Locust HTTP user behaviors...${NC}"
    locust -f locustfile.py \
        --headless \
        --host "$HOST" \
        -u "$USERS" \
        -r "$RATE" \
        -t "${DURATION}s" \
        --csv "$RUN_DIR/stats" \
        --html "$RUN_DIR/report.html" \
        --logfile "$RUN_DIR/locust.log" \
        --loglevel WARNING \
        2>&1 | tee "$RUN_DIR/console.log"

    echo -e "  ${GREEN}✓ HTTP load run completed${NC}"

    # 3. Run WebSocket voice signaling stress
    local WS_CONNS=$((USERS / 4))
    if [ "$WS_CONNS" -lt 5 ]; then WS_CONNS=5; fi
    if [ "$WS_CONNS" -gt 30 ]; then WS_CONNS=30; fi
    local WS_DUR=$((DURATION / 3))
    if [ "$WS_DUR" -lt 30 ]; then WS_DUR=30; fi
    if [ "$WS_DUR" -gt 90 ]; then WS_DUR=90; fi

    echo -e "  ${YELLOW}⏳ Executing WebSocket signaling test ($WS_CONNS concurrent clients, ${WS_DUR}s)...${NC}"
    python3 websocket_load.py \
        --connections "$WS_CONNS" \
        --duration "$WS_DUR" \
        --output-json "$RUN_DIR/ws_metrics.json" \
        2>&1 | tee "$RUN_DIR/ws_test.log"
    echo -e "  ${GREEN}✓ WebSocket stress test completed${NC}"

    # 4. Generate Comprehensive PDF Report
    echo -e "  ${YELLOW}⏳ Generating PDF Performance Certificate & Diagnostics Report...${NC}"
    local PDF_FILE="$RUN_DIR/ETD2026_LoadTest_${PROFILE^^}_${TIMESTAMP}.pdf"
    python3 -c "
import sys
sys.path.insert(0, '.')
from report_generator import generate_pdf_report
generate_pdf_report(
    '$RUN_DIR/stats_stats.csv',
    '$RUN_DIR/stats_stats_history.csv',
    '$PROFILE',
    '$PDF_FILE',
    ws_metrics_file='$RUN_DIR/ws_metrics.json'
)
"
    echo -e "  ${GREEN}✓ PDF Generated successfully!${NC}"
    echo ""
    echo -e "  ${CYAN}📄 Generated Artifacts:${NC}"
    ls -lh "$RUN_DIR"/*.pdf "$RUN_DIR"/*.html "$RUN_DIR"/*.csv 2>/dev/null | awk '{print "     " $NF " (" $5 ")"}'
    echo ""
}

print_header

PROFILE="${1:-smoke}"

if [ "$PROFILE" = "all" ]; then
    echo -e "${YELLOW}Running full benchmark sequence: smoke → normal → peak → stress${NC}"
    for p in smoke normal peak stress; do
        run_profile "$p"
        echo -e "${YELLOW}Cooling down for 15s before next profile...${NC}"
        sleep 15
    done
elif [ "$PROFILE" = "quick" ]; then
    run_profile "smoke"
    sleep 5
    run_profile "normal"
else
    run_profile "$PROFILE"
fi

echo -e "${GREEN}All tasks completed. Reports stored in: $RESULTS_DIR/${NC}"
