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

| Service      | Type                | Purpose                                      |
| ------------ | ------------------- | -------------------------------------------- |
| **Web**      | Next.js SSR         | Dashboard, company/job pages, Kanban board   |
| **API**      | Express.js          | REST API, auth, CRUD, crawl triggers, SSE    |
| **Worker**   | BullMQ + Playwright | 2-phase career page crawler                  |
| **Postgres** | Database            | Users, companies, jobs, applications, crawls |
| **Redis**    | Queue + Pub/Sub     | Job queue, live crawl log streaming          |

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

| Variable                    | Required | Default       | Description                                 |
| --------------------------- | -------- | ------------- | ------------------------------------------- |
| `DATABASE_URL`              | Yes      | —             | PostgreSQL connection string                |
| `REDIS_URL`                 | Yes      | —             | Redis connection string                     |
| `CORS_ORIGIN`               | Yes      | —             | Frontend URL (e.g. `http://localhost:3000`) |
| `SUPABASE_URL`              | No       | —             | Supabase project URL (auth)                 |
| `SUPABASE_SERVICE_ROLE_KEY` | No       | —             | Supabase service role key                   |
| `NODE_ENV`                  | No       | `development` | Runtime environment                         |

### apps/web/.env.local

| Variable                        | Required | Default                 | Description         |
| ------------------------------- | -------- | ----------------------- | ------------------- |
| `NEXT_PUBLIC_API_URL`           | Yes      | `http://localhost:3001` | API base URL        |
| `NEXT_PUBLIC_SUPABASE_URL`      | No       | —                       | Supabase URL (auth) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No       | —                       | Supabase anon key   |

### apps/worker/.env

| Variable                | Required | Default                  | Description                                                                  |
| ----------------------- | -------- | ------------------------ | ---------------------------------------------------------------------------- |
| `DATABASE_URL`          | Yes      | —                        | PostgreSQL connection string                                                 |
| `REDIS_URL`             | Yes      | —                        | Redis connection string                                                      |
| `SCHEDULER_TICK_MS`     | No       | `300000`                 | Auto-crawl scheduler tick interval (5 min)                                   |
| `SCHEDULER_BATCH_LIMIT` | No       | `50`                     | Max companies enqueued per tick                                              |
| `RESEND_API_KEY`        | No       | —                        | Resend API key for email alerts (no key = email disabled, Slack still works) |
| `RESEND_FROM`           | No       | `alerts@careercrawl.app` | From-address used for email alerts                                           |

---

## Render Deployment

### Step 1: Create Databases

- **PostgreSQL:** Render Dashboard → New → PostgreSQL → Copy Internal URL
- **Redis:** New → Redis → Copy Internal URL

### Step 2: Deploy API (Web Service)

| Setting        | Value                          |
| -------------- | ------------------------------ |
| Root Directory | `apps/api`                     |
| Build Command  | `npm install && npm run build` |
| Start Command  | `npm start`                    |
| Environment    | Node                           |

Environment variables: `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`, `NODE_ENV=production`, plus Supabase vars.

### Step 3: Deploy Worker (Background Worker)

| Setting        | Value                                                                         |
| -------------- | ----------------------------------------------------------------------------- |
| Root Directory | `apps/worker`                                                                 |
| Build Command  | `npm install && npx playwright install chromium --with-deps && npm run build` |
| Start Command  | `npm start`                                                                   |

Environment variables: `DATABASE_URL`, `REDIS_URL`.

> **Note:** Playwright requires Chromium. The build command handles installation.

### Step 4: Deploy Web (Web Service — SSR)

| Setting        | Value                          |
| -------------- | ------------------------------ |
| Root Directory | `apps/web`                     |
| Build Command  | `npm install && npm run build` |
| Start Command  | `npm start`                    |

Environment variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Step 5: Database Migration

```bash
# Via Render Shell or locally with DATABASE_URL set:
cd apps/api && npx drizzle-kit push
```

> **Note:** `start.sh` applies **all** SQL files in `apps/api/drizzle/` in lexicographic order (`0000_*` → `0001_*` → `0002_*` → `0003_*`). For Render deployments use `drizzle-kit push` (above) which derives the schema from `src/db/schema.ts` directly.

---

## Background Features

### Auto-crawl scheduler

The worker boots an in-process scheduler ([`apps/worker/src/scheduler.ts`](../apps/worker/src/scheduler.ts)) that re-crawls companies on an interval:

- A company is "due" when `crawl_schedule IN ('DAILY', 'WEEKLY')` and `last_crawl_at` is past the threshold (24h / 7d).
- Skips companies that already have a `QUEUED` or `RUNNING` crawl, so manual triggers and the scheduler can never collide.
- Tunable via `SCHEDULER_TICK_MS` and `SCHEDULER_BATCH_LIMIT` env vars on the worker.
- Reuses the existing `last_crawl_at` column — no schema change required to opt a company in; just `PATCH /companies/:id { "crawlSchedule": "DAILY" }`.

### Alerts (email + Slack)

When the worker discovers a new job (`JOB_DISCOVERED` event), it fans out to `user_alerts` rows whose `keywords` match the job title (case-insensitive substring), filtered to the company owner's `userId`.

- Email: requires `RESEND_API_KEY` on the **worker**. Without the key, email is silently skipped.
- Slack: just POSTs to the `slackWebhook` URL — no extra config.
- Manage alerts via the [`/alerts` REST endpoints](API.md#alerts).

Schema lives in [`drizzle/0003_user_alerts.sql`](../apps/api/drizzle/0003_user_alerts.sql) and is applied by `start.sh` automatically.

---

## Chrome Extension

A one-click "Save to CareerCrawl" extension lives in [`apps/extension/`](../apps/extension/).

### Install (unpacked, dev)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked** → select the `apps/extension/` directory
4. The Settings page opens automatically — paste your API base URL (e.g. `http://localhost:3001`) and, in production, your Supabase JWT
5. Visit any job posting and click the extension icon → **Save Application**

### How it works

- `manifest.json` (MV3) declares an action popup, options page, and a service-worker background script.
- `popup.js` calls `chrome.scripting.executeScript` to run `extract.js` in the page context. Extraction tries JSON-LD `JobPosting` first, then OpenGraph + meta tags, then the document title.
- `api.js` reads the API base + token from `chrome.storage.local` and POSTs to `/applications` with `source: "EXTENSION"`.

---

## Health Checks

| Service | Endpoint      | Expected           |
| ------- | ------------- | ------------------ |
| API     | `GET /health` | `200 OK`           |
| Worker  | Check logs    | `"Worker started"` |
| Web     | `GET /`       | `200 OK`           |

---

## Costs (Render)

| Service           | Free Tier  | Paid   |
| ----------------- | ---------- | ------ |
| Web Service (API) | 750 hrs/mo | $7/mo  |
| Web Service (Web) | 750 hrs/mo | $7/mo  |
| Background Worker | ❌         | $7/mo  |
| PostgreSQL        | 1GB free   | $7/mo  |
| Redis             | 25MB free  | $10/mo |

**Estimated total:** $14–38/mo for production.

---

## Troubleshooting

| Issue                    | Fix                                                                 |
| ------------------------ | ------------------------------------------------------------------- |
| Worker not processing    | Check Redis connection, verify `REDIS_URL`                          |
| CORS errors              | Ensure `CORS_ORIGIN` matches frontend URL exactly (with `https://`) |
| DB connection fails      | Use Internal Database URL, not External                             |
| Playwright crashes       | Ensure `npx playwright install chromium --with-deps` ran in build   |
| Auth not working locally | Ensure Supabase vars are unset (dev user activates automatically)   |
