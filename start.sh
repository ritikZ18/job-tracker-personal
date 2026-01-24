#!/bin/bash
# Job Tracking App - Start Script
# Run this to start all services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting Job Tracking App${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Start infrastructure
echo -e "${YELLOW}📦 Starting PostgreSQL and Redis...${NC}"
cd infra
docker compose up -d
cd ..

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 3

# Push database schema
echo -e "${YELLOW}🗄️  Pushing database schema...${NC}"
cd apps/api
npx drizzle-kit push --force > /dev/null 2>&1 || true
cd ../..

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📥 Installing dependencies...${NC}"
    npm install
fi

echo ""
echo -e "${GREEN}✅ Infrastructure ready!${NC}"
echo ""
echo -e "${YELLOW}Starting services in separate terminals...${NC}"
echo ""

# Start all services
if command -v gnome-terminal &> /dev/null; then
    gnome-terminal -- bash -c "cd $(pwd) && npm run dev; exec bash" &
    gnome-terminal -- bash -c "cd $(pwd)/apps/worker && npm run dev; exec bash" &
elif command -v xterm &> /dev/null; then
    xterm -e "cd $(pwd) && npm run dev" &
    xterm -e "cd $(pwd)/apps/worker && npm run dev" &
else
    echo -e "${YELLOW}Run these commands in separate terminals:${NC}"
    echo ""
    echo "  Terminal 1 (API + Web): npm run dev"
    echo "  Terminal 2 (Worker):    cd apps/worker && npm run dev"
    echo ""
fi

echo -e "${GREEN}🌐 Access the app at: http://localhost:3000${NC}"
echo -e "${GREEN}📡 API running at: http://localhost:3001${NC}"
