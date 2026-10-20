#!/bin/bash
# ============================================================
# CareerCrawl — Full-Stack Start Script
# Starts: Docker infra → DB migration → API + Web + Worker
# ============================================================

set -e

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

# Trap to clean up background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down services...${NC}"
    # Kill all background processes in this process group
    kill 0 2>/dev/null || true
    wait 2>/dev/null || true
    echo -e "${GREEN}✅ All services stopped.${NC}"
}
trap cleanup EXIT INT TERM

# ── Pre-flight Checks ──────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "   ╔═══════════════════════════════════════╗"
echo "   ║       🕷️  CareerCrawl Launchpad       ║"
echo "   ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi
echo -e "${GREEN}✔${NC} Docker running"

# Check Node
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Install Node 18+ first.${NC}"
    exit 1
fi
NODE_V=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_V" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18+ required (found v$(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}✔${NC} Node $(node -v)"

# ── Step 1: Infrastructure (Postgres + Redis) ──────────────
echo ""
echo -e "${YELLOW}📦 Step 1/4: Starting PostgreSQL & Redis...${NC}"
cd "$ROOT_DIR/infra"
docker compose up -d --wait 2>&1 | sed 's/^/   /'
cd "$ROOT_DIR"
echo -e "${GREEN}✔${NC} Infrastructure ready"

# ── Step 2: Install Dependencies ───────────────────────────
echo ""
echo -e "${YELLOW}📥 Step 2/4: Checking dependencies...${NC}"
if [ ! -d "$ROOT_DIR/node_modules" ]; then
    echo "   Installing npm packages (first run)..."
    npm install --silent 2>&1 | tail -3 | sed 's/^/   /'
fi
echo -e "${GREEN}✔${NC} Dependencies installed"

# ── Step 3: Database Migration ─────────────────────────────
echo ""
echo -e "${YELLOW}🗄️  Step 3/4: Applying database migrations...${NC}"

MIGRATION_DIR="$ROOT_DIR/apps/api/drizzle"

# Generate migrations if none exist yet
if [ ! -d "$MIGRATION_DIR" ] || ! ls "$MIGRATION_DIR"/*.sql 1>/dev/null 2>&1; then
    echo "   No migration files found, generating from schema..."
    (cd "$ROOT_DIR/apps/api" && npx drizzle-kit generate 2>&1 | grep -E "(table|migration|✓)" | sed 's/^/   /')
fi

# Apply ALL migrations in lexicographic (chronological) order — 0000, 0001, 0002, ...
# We grep "already exists" out of *informational* output but keep real errors visible.
shopt -s nullglob
MIGRATION_FILES=("$MIGRATION_DIR"/*.sql)
shopt -u nullglob

if [ ${#MIGRATION_FILES[@]} -eq 0 ]; then
    echo -e "${RED}❌ No migration files to apply${NC}"
    exit 1
fi

# Sort by filename (drizzle prefixes with 0000_, 0001_, ...)
IFS=$'\n' MIGRATION_FILES=($(printf '%s\n' "${MIGRATION_FILES[@]}" | sort))
unset IFS

for SQL_FILE in "${MIGRATION_FILES[@]}"; do
    echo "   ▸ $(basename "$SQL_FILE")"
    OUTPUT=$(docker exec -i job-tracking-postgres psql -v ON_ERROR_STOP=0 -U postgres -d job_tracking < "$SQL_FILE" 2>&1)
    # Filter "already exists" notices (idempotent re-run); show real errors.
    echo "$OUTPUT" | grep -vE "(already exists|^$)" | sed 's/^/     /' || true
    if echo "$OUTPUT" | grep -qE "^(ERROR|FATAL):" | grep -vE "already exists"; then
        echo -e "${YELLOW}     ⚠ Some statements failed — see above${NC}"
    fi
done

echo -e "${GREEN}✔${NC} Database schema up to date"

# ── Step 4: Start All Services ─────────────────────────────
echo ""
echo -e "${YELLOW}🚀 Step 4/4: Starting services...${NC}"
echo ""

# API + Web (via Turbo, runs both dev servers in parallel)
echo -e "   ${CYAN}▶ API + Web${NC}  → logs: .logs/turbo.log"
npm run dev > "$LOG_DIR/turbo.log" 2>&1 &
TURBO_PID=$!

# Worker (separate process for crawler)
echo -e "   ${CYAN}▶ Worker${NC}     → logs: .logs/worker.log"
cd "$ROOT_DIR/apps/worker"
npm run dev > "$LOG_DIR/worker.log" 2>&1 &
WORKER_PID=$!
cd "$ROOT_DIR"

# Wait a moment for startup
sleep 3

# ── Ready! ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  ✅ CareerCrawl is running!${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}🌐 Web:${NC}    http://localhost:3000"
echo -e "  ${CYAN}📡 API:${NC}    http://localhost:3001"
echo -e "  ${CYAN}❤️  Health:${NC} http://localhost:3001/health"
echo ""
echo -e "  ${YELLOW}📋 Logs:${NC}"
echo -e "     tail -f .logs/turbo.log    ${CYAN}# API + Web${NC}"
echo -e "     tail -f .logs/worker.log   ${CYAN}# Crawler Worker${NC}"
echo ""
echo -e "  ${RED}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for any background process to exit
wait
