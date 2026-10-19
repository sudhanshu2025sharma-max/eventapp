#!/bin/bash
# ================================================================
# scripts/restart_all.sh
# Restart all services for ETD 2026 Conference App
# Usage: bash scripts/restart_all.sh
# ================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BLUE}${BOLD}Restarting all ETD 2026 services...${NC}"
echo ""

bash "$(dirname "$0")/stop_all.sh" <<< "n"
echo ""
sleep 2
bash "$(dirname "$0")/start_all.sh"
