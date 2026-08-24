#!/usr/bin/env bash
# ==============================================================================
# start.sh — OpenX Deep Research Analyst (Unified Dev Runner)
#
# Starts both Backend Gateway (:7411) and Frontend Portal (:3010) concurrently
# with clean process management and pre-flight dependency checks.
# ==============================================================================

# ANSI Color Codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
VIOLET='\033[0;35m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}   OpenX Deep Research Analyst — Development Environment   ${NC}"
echo -e "${CYAN}================================================================${NC}"

# 1. Pre-flight Node.js check
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed or not in PATH.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR] npm is not installed or not in PATH.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) & npm $(npm -v) detected.${NC}"

# 2. Check and install dependencies if missing
if [ ! -d "$ROOT_DIR/gateway/node_modules" ]; then
    echo -e "${YELLOW}[!] gateway/node_modules missing. Installing dependencies...${NC}"
    (cd "$ROOT_DIR/gateway" && npm install)
fi

if [ ! -d "$ROOT_DIR/portal/node_modules" ]; then
    echo -e "${YELLOW}[!] portal/node_modules missing. Installing dependencies...${NC}"
    (cd "$ROOT_DIR/portal" && npm install)
fi

# 3. Clean up any stale processes occupying ports 7411 or 3010
echo -e "${CYAN}[*] Clearing any stale processes on ports 7411 and 3010...${NC}"
lsof -ti:7411 | xargs kill -9 2>/dev/null || true
lsof -ti:3010 | xargs kill -9 2>/dev/null || true

# 4. Graceful shutdown handler (on Ctrl+C / SIGTERM)
PIDS=()

cleanup() {
    echo ""
    echo -e "${YELLOW}[*] Shutting down OpenX services gracefully...${NC}"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    echo -e "${GREEN}✓ All services stopped. Goodbye!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 5. Start Gateway Backend Service (:7411)
echo -e "${VIOLET}[BE] Starting Gateway sidecar on http://localhost:7411...${NC}"
(
    cd "$ROOT_DIR/gateway"
    npm run dev
) &
PIDS+=($!)

# Brief pause
sleep 1.5

# 6. Start Portal Frontend (:3010)
echo -e "${CYAN}[FE] Starting Agent Portal on http://localhost:3010...${NC}"
(
    cd "$ROOT_DIR/portal"
    npm run dev
) &
PIDS+=($!)

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN} ✓ Gateway Backend:  http://localhost:7411/health${NC}"
echo -e "${GREEN} ✓ Agent Status API: http://localhost:7411/v1/agent/status?agentId=...${NC}"
echo -e "${GREEN} ✓ Portal Frontend:  http://localhost:3010${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "${CYAN}Press [Ctrl+C] to stop both services.${NC}"
echo ""

# Wait for all child processes to keep script running
wait
