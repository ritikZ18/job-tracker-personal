# Deployment Guide

This guide covers deploying CareerCrawl to [Render](https://render.com) and running locally.

---

## Architecture

```
┌─────────┐     ┌─────────────┐     ┌────────┐
│   Web   │────▶│     API     │────▶│ Worker │
│ Next.js │     │  Express.js │     │ BullMQ │
│  :3000  │     │    :3001    │     │Playwright│
└─────────┘     └──────┬──────┘     └───┬────┘
                       │                │
                ┌──────┴──────┐   ┌─────┴─────┐
                │  PostgreSQL │   │   Redis    │
                │    :5432    │   │   :6379    │
                └─────────────┘   └───────────┘
```

| Service    | Type              | Purpose                                    |
|------------|-------------------|--------------------------------------------|
| **Web**    | Next.js SSR       | Dashboard, company/job pages, Kanban board  |
| **API**    | Express.js        | REST API, auth, CRUD, crawl triggers, SSE   |
| **Worker** | BullMQ + Playwright | 2-phase career page crawler                |
| **Postgres** | Database        | Users, companies, jobs, applications, crawls |
| **Redis**  | Queue + Pub/Sub   | Job queue, live crawl log streaming         |

---

## Local Development

### Prerequisites
- Node.js 18+
- Docker Desktop (for Postgres + Redis)
- npm 9+

### One-Command Start

```bash
./start.sh
```

This script:
1. Starts Postgres + Redis via Docker Compose
2. Installs npm dependencies (if missing)
3. Pushes Drizzle schema to Postgres
4. Runs API (`:3001`), Web (`:3000`), and Worker concurrently
5. Logs stream to `.logs/turbo.log` and `.logs/worker.log`

**Stop everything:** `Ctrl+C` or `./kill.sh`

### Manual Start

```bash
# 1. Infrastructure
cd infra && docker compose up -d && cd ..

# 2. Schema migration
cd apps/api && npx drizzle-kit push --force && cd ../..

# 3. API + Web (Turbo runs both)
npm run dev

# 4. Worker (separate terminal)
cd apps/worker && npm run dev
```

### Auth in Local Dev

**No Supabase required.** When `SUPABASE_URL` is not set, the API auto-creates a `dev-user` and the frontend skips Supabase auth entirely. Everything works out of the box.

To enable real auth, set these in `apps/api/.env` and `apps/web/.env.local`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Environment Variables

### apps/api/.env

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `CORS_ORIGIN` | Yes | — | Frontend URL (e.g. `http://localhost:3000`) |
| `SUPABASE_URL` | No | — | Supabase project URL (auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | — | Supabase service role key |
| `NODE_ENV` | No | `development` | Runtime environment |

### apps/web/.env.local

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:3001` | API base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | No | — | Supabase URL (auth) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | — | Supabase anon key |

---

## Render Deployment

### Step 1: Create Databases

- **PostgreSQL:** Render Dashboard → New → PostgreSQL → Copy Internal URL
- **Redis:** New → Redis → Copy Internal URL

### Step 2: Deploy API (Web Service)

| Setting | Value |
|---------|-------|
| Root Directory | `apps/api` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Environment | Node |

Environment variables: `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`, `NODE_ENV=production`, plus Supabase vars.

### Step 3: Deploy Worker (Background Worker)

| Setting | Value |
|---------|-------|
| Root Directory | `apps/worker` |
| Build Command | `npm install && npx playwright install chromium --with-deps && npm run build` |
| Start Command | `npm start` |

Environment variables: `DATABASE_URL`, `REDIS_URL`.

> **Note:** Playwright requires Chromium. The build command handles installation.

### Step 4: Deploy Web (Web Service — SSR)

| Setting | Value |
|---------|-------|
| Root Directory | `apps/web` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |

Environment variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Step 5: Database Migration

```bash
# Via Render Shell or locally with DATABASE_URL set:
cd apps/api && npx drizzle-kit push
```

---

## Health Checks

| Service | Endpoint | Expected |
|---------|----------|----------|
| API | `GET /health` | `200 OK` |
| Worker | Check logs | `"Worker started"` |
| Web | `GET /` | `200 OK` |

---

## Costs (Render)

| Service | Free Tier | Paid |
|---------|-----------|------|
| Web Service (API) | 750 hrs/mo | $7/mo |
| Web Service (Web) | 750 hrs/mo | $7/mo |
| Background Worker | ❌ | $7/mo |
| PostgreSQL | 1GB free | $7/mo |
| Redis | 25MB free | $10/mo |

**Estimated total:** $14–38/mo for production.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Worker not processing | Check Redis connection, verify `REDIS_URL` |
| CORS errors | Ensure `CORS_ORIGIN` matches frontend URL exactly (with `https://`) |
| DB connection fails | Use Internal Database URL, not External |
| Playwright crashes | Ensure `npx playwright install chromium --with-deps` ran in build |
| Auth not working locally | Ensure Supabase vars are unset (dev user activates automatically) |
