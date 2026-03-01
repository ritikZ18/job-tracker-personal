#!/bin/bash
# ============================================================
# CareerCrawl — Kill All Services
# Stops: Node processes + Docker containers
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${RED}🛑 Stopping CareerCrawl...${NC}"
echo ""

# ── Kill Node processes ────────────────────────────────────
kill_proc() {
    local pattern=$1 name=$2
    if pgrep -f "$pattern" > /dev/null 2>&1; then
        echo -e "   Killing $name..."
        pkill -f "$pattern" 2>/dev/null || true
    else
        echo -e "   $name — not running"
    fi
}

echo -e "${YELLOW}🔪 Application processes:${NC}"
kill_proc "turbo run dev" "Turbo (API + Web)"
kill_proc "next-server" "Next.js Server"
kill_proc "next dev" "Next.js Dev"
kill_proc "tsx watch" "Worker (tsx)"
kill_proc "ts-node" "Worker (ts-node)"
kill_proc "drizzle-kit" "Drizzle Kit"

# ── Stop Docker ────────────────────────────────────────────
echo ""
echo -e "${YELLOW}📦 Docker containers:${NC}"
if [ -f "$ROOT_DIR/infra/docker-compose.yml" ]; then
    cd "$ROOT_DIR/infra"
    docker compose down 2>&1 | sed 's/^/   /'
    cd "$ROOT_DIR"
else
    echo "   No docker-compose.yml found, skipping"
fi

# ── Clean logs ─────────────────────────────────────────────
if [ -d "$ROOT_DIR/.logs" ]; then
    rm -rf "$ROOT_DIR/.logs"
    echo ""
    echo -e "   🧹 Cleaned log files"
fi

echo ""
echo -e "${GREEN}✅ All services stopped. Resources freed.${NC}"
