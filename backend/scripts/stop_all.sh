#!/bin/bash
# ================================================================
# scripts/stop_all.sh
# Stop all services for ETD 2026 Conference App
# Usage: bash scripts/stop_all.sh
# ================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BLUE}${BOLD}"
echo "=========================================="
echo "  ETD 2026 - Stopping Services"
echo "=========================================="
echo -e "${NC}"

# ------------------------------------------------------------------
stop_systemd() {
    local service=$1
    local name=$2

    echo -n "  Stopping ${name}... "
    if ! sudo systemctl is-active --quiet "$service" 2>/dev/null; then
        echo -e "${YELLOW}Already stopped${NC}"
        return 0
    fi
    sudo systemctl stop "$service" 2>/dev/null
    sleep 1
    if sudo systemctl is-active --quiet "$service" 2>/dev/null; then
        echo -e "${RED}❌ Failed${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Stopped${NC}"
        return 0
    fi
}

# ------------------------------------------------------------------
echo -e "${BOLD}[1/3] Gunicorn (Django/ASGI)${NC}"
echo -n "  Stopping Gunicorn... "
if pgrep -f "gunicorn confhub.asgi" > /dev/null 2>&1; then
    pkill -f "gunicorn confhub.asgi" 2>/dev/null
    sleep 2
    if pgrep -f "gunicorn confhub.asgi" > /dev/null 2>&1; then
        echo -e "${YELLOW}Graceful failed, force killing...${NC}"
        pkill -9 -f "gunicorn confhub.asgi" 2>/dev/null
        sleep 1
    fi
    if ! pgrep -f "gunicorn confhub.asgi" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Stopped${NC}"
    else
        echo -e "${RED}❌ Still running${NC}"
    fi
else
    echo -e "${YELLOW}Already stopped${NC}"
fi

echo ""
echo -e "${BOLD}[2/3] Redis Cache${NC}"
stop_systemd "redis-server" "Redis"

echo ""
echo -e "${BOLD}[3/3] PostgreSQL Database${NC}"
read -p "  Stop PostgreSQL too? (y/N): " stop_pg
if [[ "$stop_pg" =~ ^[Yy]$ ]]; then
    stop_systemd "postgresql" "PostgreSQL"
else
    echo -e "  PostgreSQL: ${GREEN}Still running${NC}"
fi

# Port verification
echo ""
echo -e "${BOLD}Port check:${NC}"
for port in 8000 5432 6379; do
    if ss -tlnp | grep -q ":${port} "; then
        echo -e "  Port ${port}: ${RED}Still in use${NC}"
    else
        echo -e "  Port ${port}: ${GREEN}Free${NC}"
    fi
done

echo ""
echo -e "${BLUE}=========================================="
echo -e "  Services stopped!"
echo -e "==========================================${NC}"
echo ""
echo -e "  ${YELLOW}⚠ Cron keep_alive.sh will restart Gunicorn within 60s${NC}"
echo -e "  ${YELLOW}  To prevent: crontab -e → comment out keep_alive line${NC}"
echo ""
