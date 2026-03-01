# CareerCrawl

A full-stack career page crawler and job application tracker with a Tesla-inspired premium glassmorphic UI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **🕷️ Career Page Crawler** — Paste any career page URL; auto-discovers jobs via Greenhouse/Lever APIs or Playwright DOM scraping
- **📊 Kanban Board** — Drag-and-drop application tracker (Saved → Applied → Interviewing → Offer → Rejected)
- **🔍 Global Search** — Real-time search across companies and jobs
- **📡 Live Terminal** — SSE-powered crawler terminal showing real-time progress
- **🏢 Company Management** — Track multiple companies, trigger re-crawls, view stats
- **🌗 Dark/Light Mode** — Industrial glassmorphic UI with theme toggle
- **🔒 Auth Optional** — Works locally without Supabase; real auth in production

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TanStack Query |
| Backend | Express.js, Drizzle ORM, Zod |
| Worker | BullMQ, Playwright (Chromium) |
| Database | PostgreSQL 16 |
| Queue | Redis 7 |
| Auth | Supabase (optional for local dev) |
| Infra | Docker Compose, Turborepo |

## Quick Start

```bash
git clone <repo-url>
cd job-tracking
npm install
./start.sh        # Starts everything (Docker + API + Web + Worker)
```

**Open:** http://localhost:3000

**Stop:** `Ctrl+C` or `./kill.sh`

## Project Structure

```
├── apps/
│   ├── api/           # Express API (port 3001)
│   │   └── src/
│   │       ├── routes/    # companies, jobs, crawls, search, applications
│   │       ├── db/        # Drizzle schema (13 tables)
│   │       ├── middleware/ # Auth (Supabase + dev bypass)
│   │       └── lib/       # Events emitter
│   ├── web/           # Next.js frontend (port 3000)
│   │   └── app/
│   │       ├── (user)/    # Dashboard, Companies, My Jobs, Search
│   │       └── (auth)/    # Login, Register
│   └── worker/        # BullMQ crawler
│       └── src/       # 2-phase: discover → extract → save
├── packages/
│   └── types/         # Shared TypeScript types
├── infra/             # Docker Compose (Postgres + Redis)
├── docs/              # API reference, deployment guide
├── start.sh           # One-command full startup
└── kill.sh            # One-command shutdown
```

## Environment Variables

**apps/api/.env**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/job_tracking
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
# Optional (for production auth):
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-key
```

**apps/web/.env.local**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
# Optional:
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

## Documentation

- [API Reference](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Job Analysis Pipeline](docs/JOB_ANALYSIS.md)

## License

MIT
