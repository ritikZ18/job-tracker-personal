# Job Tracker

A modern job application tracking system with an Excel-like grid interface, AI-powered job posting analysis, and a Tesla-inspired premium UI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Excel-like Grid** - Edit applications inline with AG Grid
- **AI Job Analysis** - Paste a job URL to extract title, company, and requirements
- **Dark/Light Mode** - Tesla-inspired premium UI with theme toggle
- **PWA** - Installable on mobile and desktop
- **Real-time Updates** - Status changes, toast notifications

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, AG Grid, Tailwind |
| Backend | Express.js, Drizzle ORM |
| Worker | BullMQ, Playwright |
| Database | PostgreSQL |
| Queue | Redis |
| Infrastructure | Docker Compose |

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd job-tracking
npm install

# Start everything
./start.sh
```

Or manually:

```bash
# 1. Start infrastructure
cd infra && docker compose up -d

# 2. Push database schema
cd apps/api && npx drizzle-kit push

# 3. Start dev servers
npm run dev              # Terminal 1: API + Web
cd apps/worker && npm run dev  # Terminal 2: Worker
```

**Access:** http://localhost:3000

## Project Structure

```
├── apps/
│   ├── api/          # Express API server (port 3001)
│   ├── web/          # Next.js frontend (port 3000)
│   └── worker/       # BullMQ job processor
├── packages/
│   └── types/        # Shared TypeScript types
└── infra/            # Docker Compose (Postgres, Redis)
```

## Environment Variables

Create `.env` files in each app directory:

**apps/api/.env**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/job_tracking
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:3000
```

**apps/web/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## API Documentation

See [docs/API.md](docs/API.md) for full API reference.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Render deployment guide.

## License

MIT
