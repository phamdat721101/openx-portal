#!/usr/bin/env bash
# ==============================================================================
# start.sh — OpenX Deep Research Analyst (Unified Application Runner)
#
# Builds and starts the Gateway (:7411) and Portal (:3010) in production mode,
# so the Portal is ready to serve without compiling routes on first use.
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
echo -e "${CYAN}   OpenX Deep Research Analyst — Application Environment   ${NC}"
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

# 3. Build both services before replacing the running application.
echo -e "${CYAN}[*] Building Gateway and Portal for immediate serving...${NC}"
if ! (cd "$ROOT_DIR/gateway" && npm run build); then
    echo -e "${RED}[ERROR] Gateway build failed. Existing services were left untouched.${NC}"
    exit 1
fi

if ! (cd "$ROOT_DIR/portal" && npm run build); then
    echo -e "${RED}[ERROR] Portal build failed. Existing services were left untouched.${NC}"
    exit 1
fi

# 4. Clean up any stale processes occupying ports 7411 or 3010
echo -e "${CYAN}[*] Clearing any stale processes on ports 7411 and 3010...${NC}"
lsof -ti:7411 | xargs kill -9 2>/dev/null || true
lsof -ti:3010 | xargs kill -9 2>/dev/null || true

# 5. Graceful shutdown handler (on Ctrl+C / SIGTERM)
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

# 6. Start Gateway Backend Service (:7411)
echo -e "${VIOLET}[BE] Starting built Gateway sidecar on http://localhost:7411...${NC}"
(
    cd "$ROOT_DIR/gateway"
    npm run start
) &
PIDS+=($!)

# Brief pause
sleep 1.5

# 7. Start Portal Frontend (:3010)
echo -e "${CYAN}[FE] Starting built Agent Portal on http://localhost:3010...${NC}"
(
    cd "$ROOT_DIR/portal"
    npm run start
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
