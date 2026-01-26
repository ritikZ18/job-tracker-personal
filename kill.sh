#!/bin/bash
# Job Tracking App - Kill Script
# Run this to stop all services and free up resources

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}🛑 Stopping Job Tracking App...${NC}"
echo ""

# Stop infrastructure
if [ -d "infra" ]; then
    echo -e "${YELLOW}📦 Stopping Docker containers (PostgreSQL, Redis)...${NC}"
    cd infra
    docker compose down
    cd ..
else
    echo -e "${RED}❌ infra directory not found!${NC}"
fi

echo ""

# Kill Node.js processes
echo -e "${YELLOW}🔪 Killing application processes...${NC}"

# Helper function to kill process by pattern
kill_process() {
    local pattern=$1
    local name=$2
    if pgrep -f "$pattern" > /dev/null; then
        echo -e "   Killing $name..."
        pkill -f "$pattern" || true
    else
        echo -e "   $name not running."
    fi
}

kill_process "turbo run dev" "Turbo Repo (Root)"
kill_process "next-server" "Next.js Server" 
kill_process "next dev" "Next.js Dev Server"
kill_process "tsx watch" "Worker Service"
kill_process "drizzle-kit" "Drizzle Kit"

echo ""
echo -e "${GREEN}✅ All services stopped.${NC}"
echo -e "${GREEN}Resources (computation) should now be zero.${NC}"
