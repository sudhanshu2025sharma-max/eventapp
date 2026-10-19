#!/bin/bash
# ================================================================
# scripts/start_all.sh
# Start all services for ETD 2026 Conference App
# Usage: bash scripts/start_all.sh
# ================================================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

PROJECT_DIR="/home/baadalvm/eventapp/backend"

echo -e "${BLUE}${BOLD}"
echo "=========================================="
echo "  ETD 2026 - Starting Services"
echo "=========================================="
echo -e "${NC}"

# ------------------------------------------------------------------
start_systemd() {
    local service=$1
    local name=$2
    local port=$3

    echo -n -e "  Starting ${name}... "

    if sudo systemctl is-active --quiet "$service" 2>/dev/null; then
        echo -e "${YELLOW}Already running${NC}"
        return 0
    fi

    sudo systemctl start "$service" 2>/dev/null
    sleep 2

    if sudo systemctl is-active --quiet "$service" 2>/dev/null; then
        echo -e "${GREEN}✅ Started${NC}"
        if [ -n "$port" ]; then
            if ss -tlnp | grep -q ":${port} "; then
                echo -e "    └─ Listening on port ${port} ✓"
            else
                echo -e "    └─ ${YELLOW}Warning: Port ${port} not yet listening${NC}"
            fi
        fi
        return 0
    else
        echo -e "${RED}❌ Failed${NC}"
        echo -e "    └─ Check: ${YELLOW}sudo journalctl -u ${service} -n 20${NC}"
        return 1
    fi
}

# ------------------------------------------------------------------
echo -e "${BOLD}[1/4] PostgreSQL Database${NC}"
start_systemd "postgresql" "PostgreSQL" "5432"

echo ""
echo -e "${BOLD}[2/4] Redis Cache${NC}"
start_systemd "redis-server" "Redis" "6379"

echo ""
echo -e "${BOLD}[3/4] Gunicorn (Django/ASGI)${NC}"
echo -n -e "  Starting Gunicorn... "

if pgrep -f "gunicorn confhub.asgi" > /dev/null 2>&1; then
    echo -e "${YELLOW}Already running${NC}"
else
    cd "$PROJECT_DIR"
    pkill -9 -f "gunicorn confhub.asgi" 2>/dev/null || true
    sleep 1
    nohup ./start_server.sh > server.log 2>&1 &
    sleep 4

    if pgrep -f "gunicorn confhub.asgi" > /dev/null 2>&1; then
        workers=$(pgrep -f "gunicorn confhub.asgi" | wc -l)
        echo -e "${GREEN}✅ Started${NC}"
        echo -e "    └─ ${workers} processes (1 master + $((workers-1)) workers)"
        if ss -tlnp | grep -q ":8000 "; then
            echo -e "    └─ Listening on port 8000 ✓"
        else
            echo -e "    └─ ${YELLOW}Warning: Port 8000 not yet listening${NC}"
        fi
    else
        echo -e "${RED}❌ Failed${NC}"
        echo -e "    └─ Check: ${YELLOW}tail -30 $PROJECT_DIR/server.log${NC}"
    fi
fi

# ------------------------------------------------------------------
echo ""
echo -e "${BOLD}[4/4] Health Checks${NC}"
echo ""

PASS=0
FAIL=0

test_url() {
    local url=$1
    local name=$2
    echo -n "  ${name} → "
    status=$(curl -s --noproxy '*' -o /dev/null -w "%{http_code}" "$url" --max-time 10 2>/dev/null)
    if [ "$status" = "200" ] || [ "$status" = "301" ] || [ "$status" = "302" ]; then
        echo -e "${GREEN}✅ OK (${status})${NC}"
        ((PASS++))
    elif [ "$status" = "000" ]; then
        echo -e "${RED}❌ Connection refused${NC}"
        ((FAIL++))
    else
        echo -e "${YELLOW}⚠ Status: ${status}${NC}"
        ((FAIL++))
    fi
}

test_url "http://127.0.0.1:8000/panel/login/" "Admin Panel"
test_url "http://127.0.0.1:8000/api/v1/schedule/sessions/" "Schedule API"
test_url "http://127.0.0.1:8000/api/v1/conferences/settings/" "Settings API"

echo -n "  PostgreSQL → "
if sudo -u postgres psql -d etdapp -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connected${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Cannot connect${NC}"
    ((FAIL++))
fi

echo -n "  Redis → "
if redis-cli ping 2>/dev/null | grep -q PONG; then
    echo -e "${GREEN}✅ PONG${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ No response${NC}"
    ((FAIL++))
fi

# Summary
echo ""
echo -e "${BLUE}=========================================="
echo -e "  All services started!"
echo -e "==========================================${NC}"
echo ""
echo -e "  ${GREEN}Passed: ${PASS}${NC}  |  ${RED}Failed: ${FAIL}${NC}"
echo ""
echo -e "   App VM:     ${BOLD}10.17.9.48:8000${NC}"
echo -e "   Public:     ${BOLD}https://etd2026.iitd.ac.in${NC}"
echo -e "   Logs:       tail -f $PROJECT_DIR/server.log"
echo ""
echo -e "${BLUE}==========================================${NC}"

if [ $FAIL -gt 2 ]; then
    exit 1
fi
exit 0
