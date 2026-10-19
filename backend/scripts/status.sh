#!/bin/bash
# ================================================================
# scripts/status.sh
# Full system health dashboard for ETD 2026
# Usage: bash scripts/status.sh
# ================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

PROJECT_DIR="/home/baadalvm/eventapp/backend"

echo -e "${BLUE}${BOLD}"
echo "╔══════════════════════════════════════════╗"
echo "║   ETD 2026 Conference - System Status    ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ------------------------------------------------------------------
check_systemd() {
    local service=$1
    local name=$2
    local port=$3

    echo -e "${BOLD}  $name${NC}"
    if sudo systemctl is-active --quiet "$service" 2>/dev/null; then
        local uptime=$(sudo systemctl show "$service" --property=ActiveEnterTimestamp --value 2>/dev/null)
        echo -e "    Status:  ${GREEN}● Active${NC}"
        [ -n "$uptime" ] && echo -e "    Since:   ${DIM}${uptime}${NC}"
    else
        local state=$(sudo systemctl is-active "$service" 2>/dev/null)
        echo -e "    Status:  ${RED}● Inactive ($state)${NC}"
    fi
    if [ -n "$port" ]; then
        if ss -tlnp | grep -q ":${port} "; then
            echo -e "    Port:    ${GREEN}${port} ✓${NC}"
        else
            echo -e "    Port:    ${RED}${port} ✗${NC}"
        fi
    fi
    echo ""
}

# ------------------------------------------------------------------
echo -e "${BOLD}  🗄️  Infrastructure Services${NC}"
echo ""
check_systemd "postgresql" "PostgreSQL Database" "5432"
check_systemd "redis-server" "Redis Cache" "6379"

# Gunicorn (not systemd)
echo -e "${BOLD}  🌐 Django (Gunicorn/ASGI)${NC}"
if pgrep -f "gunicorn confhub.asgi" > /dev/null 2>&1; then
    workers=$(pgrep -f "gunicorn confhub.asgi" | wc -l)
    master_pid=$(pgrep -f "gunicorn confhub.asgi" -o)
    master_mem=$(ps -p "$master_pid" -o rss= 2>/dev/null)
    total_mem=$(ps -C gunicorn -o rss= 2>/dev/null | awk '{s+=$1}END{printf "%.0f", s/1024}')
    echo -e "    Status:  ${GREEN}● Active${NC}"
    echo -e "    Workers: ${DIM}${workers} processes (1 master + $((workers-1)) workers)${NC}"
    echo -e "    Memory:  ${DIM}${total_mem} MB total${NC}"
    if ss -tlnp | grep -q ":8000 "; then
        echo -e "    Port:    ${GREEN}8000 ✓${NC}"
    else
        echo -e "    Port:    ${RED}8000 ✗${NC}"
    fi
else
    echo -e "    Status:  ${RED}● Not running${NC}"
    echo -e "    Port:    ${RED}8000 ✗${NC}"
fi
echo ""

# ------------------------------------------------------------------
echo -e "${BOLD}  🔗 HTTP Health Checks${NC}"
echo ""

test_url() {
    local url=$1
    local name=$2
    echo -n "    "
    local start=$(date +%s%N)
    local status=$(curl -s --noproxy '*' -o /dev/null -w "%{http_code}" "$url" --max-time 5 2>/dev/null)
    local end=$(date +%s%N)
    local ms=$(( (end - start) / 1000000 ))

    if [ "$status" = "200" ] || [ "$status" = "301" ] || [ "$status" = "302" ] || [ "$status" = "401" ]; then
        echo -e "${GREEN}✅${NC} ${name} → ${status} ${DIM}(${ms}ms)${NC}"
    elif [ "$status" = "000" ]; then
        echo -e "${RED}❌${NC} ${name} → Connection refused"
    else
        echo -e "${YELLOW}⚠️${NC}  ${name} → ${status} ${DIM}(${ms}ms)${NC}"
    fi
}

test_url "http://127.0.0.1:8000/panel/login/" "Admin Login"
test_url "http://127.0.0.1:8000/api/v1/schedule/sessions/" "Schedule API"
test_url "http://127.0.0.1:8000/api/v1/conferences/settings/" "Settings API"
test_url "http://127.0.0.1:8000/api/v1/notifications/unread-count/" "Notifications API"

echo ""

# ------------------------------------------------------------------
echo -e "${BOLD}  💾 Database${NC}"
echo ""
db_size=$(sudo -u postgres psql -t -c "SELECT pg_size_pretty(pg_database_size('etdapp'));" 2>/dev/null | xargs)
user_count=$(sudo -u postgres psql -t -d etdapp -c "SELECT count(*) FROM users;" 2>/dev/null | xargs)
echo -e "    Database:    ${CYAN}etdapp${NC}"
echo -e "    Size:        ${CYAN}${db_size:-N/A}${NC}"
echo -e "    Users:       ${CYAN}${user_count:-N/A}${NC}"
echo ""

# ------------------------------------------------------------------
echo -e "${BOLD}  💻 System Resources${NC}"
echo ""
mem_used=$(free -m | awk '/^Mem:/{printf "%.1f", $3/1024}')
mem_total=$(free -m | awk '/^Mem:/{printf "%.1f", $2/1024}')
mem_pct=$(free | awk '/^Mem:/{printf "%.0f", $3/$2*100}')
swap_used=$(free -m | awk '/^Swap:/{printf "%.1f", $3/1024}')
load=$(uptime | grep -oP 'load average: \K[^,]+')
disk_free=$(df -h / | awk 'NR==2{print $4}')
disk_pct=$(df -h / | awk 'NR==2{print $5}')

echo -e "    RAM:     ${CYAN}${mem_used}G / ${mem_total}G (${mem_pct}%)${NC}"
echo -e "    Swap:    ${CYAN}${swap_used}G used${NC}"
echo -e "    CPU:     ${CYAN}$(nproc) cores, load ${load}${NC}"
echo -e "    Disk:    ${CYAN}${disk_free} free (${disk_pct} used)${NC}"
echo ""

# ------------------------------------------------------------------
echo -e "${BOLD}  📋 Recent Errors (last 50 lines)${NC}"
echo ""
error_count=$(tail -50 "$PROJECT_DIR/server.log" 2>/dev/null | grep -iE 'error|500|traceback|critical' | wc -l)
if [ "$error_count" -gt 0 ]; then
    echo -e "    ${YELLOW}⚠ ${error_count} error(s) in last 50 log lines:${NC}"
    tail -50 "$PROJECT_DIR/server.log" 2>/dev/null | grep -i 'error\|500\|traceback\|critical' | tail -3 | while read line; do
        echo -e "    ${DIM}${line:0:100}${NC}"
    done
else
    echo -e "    ${GREEN}✅ No errors in recent logs${NC}"
fi
echo ""

# ------------------------------------------------------------------
echo -e "${BOLD}  ⏰ Cron Jobs${NC}"
echo ""
crontab -l 2>/dev/null | grep -v '^#' | grep -v '^$' | while read line; do
    echo -e "    ${DIM}${line}${NC}"
done
echo ""

# ------------------------------------------------------------------
echo -e "${BLUE}╔══════════════════════════════════════════╗"
echo -e "║  🌐 https://etd2026.iitd.ac.in          ║"
echo -e "║  🖥  10.17.9.48:8000 (direct)           ║"
echo -e "╚══════════════════════════════════════════╝${NC}"
echo ""
