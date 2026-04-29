# API Documentation

Base URL: `http://localhost:3001`

## Authentication

All endpoints (except `/health` and `/auth/*`) require authentication.

**Local dev:** No auth headers needed — the API auto-creates a `dev-user` when Supabase is not configured.

**Production:** Send `Authorization: Bearer <supabase-jwt>` header.

### POST /auth/register

Create a new account.

```json
{ "email": "user@example.com", "password": "securepassword" }
→ 201: { "user": { "id": "uuid", "email": "user@example.com" } }
```

### POST /auth/login

Login and receive auth cookie.

### GET /auth/me

Get current user profile.

---

## Companies

### GET /companies

List companies with job counts.

**Query params:** `search`, `platform`, `isTarget`

### POST /companies

Add a company career page. Auto-detects ATS platform and enqueues crawl.

```json
{ "careerUrl": "https://boards.greenhouse.io/company" }
→ 201: { "id": "uuid", "name": "Company", "crawlRunId": "uuid", ... }
```

### POST /companies/bulk

Add up to 100 career pages at once.

```json
{ "urls": [{ "careerUrl": "https://..." }, ...] }
```

### GET /companies/:id

Company detail with job stats (total, open, closed, new this week).

### PUT /companies/:id

Update company fields.

### DELETE /companies/:id

Delete company and all its jobs.

### POST /companies/:id/crawl

Trigger a re-crawl of the company's career page.

```json
→ 200: { "crawlRunId": "uuid" }
```

---

## Jobs

### GET /jobs

List jobs with filters. Scoped to the user's companies.

**Query params:** `search`, `companyId`, `status`, `isRemote`, `employmentType`, `limit`, `offset`

```json
→ 200: { "jobs": [...], "total": 42 }
```

### GET /jobs/:slug

Get job detail by slug, including historical snapshots.

### POST /jobs/:slug/save

Save a job to the user's application tracker (creates an application with `SAVED` status and `CRAWLED` source).

---

## Crawls

### GET /crawls

List recent crawl runs.

**Query params:** `limit` (default 20)

### GET /crawls/:id

Get crawl run detail (status, discovery/update counts, errors, duration).

### GET /crawls/:id/stream

**SSE endpoint** — live stream of crawl logs via Redis pub/sub.

Events:

- `{ "type": "log", "message": "..." }`
- `{ "type": "complete", "jobsDiscovered": N, "jobsUpdated": N, ... }`
- `{ "type": "error", "message": "..." }`

---

## Search

### GET /search

Global search across companies and jobs.

**Query params:** `q` (min 2 chars)

```json
→ 200: { "companies": [...], "jobs": [...] }
```

---

## Applications

### GET /applications

List all applications for current user.

**Query params:** `status`, `search`

### POST /applications

Create new application.

```json
{
  "company": "Google",
  "jobTitle": "SWE",
  "jobUrl": "https://...",
  "status": "SAVED"
}
```

### PATCH /applications/:id

Update application fields.

### PATCH /applications/:id/status

Update status only (triggers auto-timestamps).

```json
{ "status": "INTERVIEWING" }
```

### DELETE /applications/:id

Delete application.

### POST /applications/analyze

Enqueue URL for AI-powered job analysis.

```json
{ "jobUrl": "https://..." }
→ 202: { "jobAnalysisId": "uuid", "status": "PENDING" }
```

---

## Job Analyses

### GET /job-analyses/:id

Get analysis result.

---

## Views

### GET /views — List saved grid views

### POST /views — Create saved view

### PUT /views/:id — Update saved view

### DELETE /views/:id — Delete saved view

---

## Analytics

### GET /analytics/funnel

Application funnel + response metrics for the current user. All counts/rates are user-scoped.

```json
→ 200: {
  "funnel": {
    "saved": 12, "applied": 30, "interviewing": 8,
    "offers": 2, "rejected": 14, "ghosted": 6, "total": 72
  },
  "metrics": {
    "responseRatePct": 73.3,
    "offerRatePct": 6.7,
    "avgDaysToResponse": 9.4
  },
  "weeklyVelocity": [{ "week": "2026-04-21", "applications": 5 }, ...],
  "bySource": [{ "source": "MANUAL", "count": 40 }, ...]
}
```

`avgDaysToResponse` is computed as `LEAST(interviewing_at, offer_at, rejected_at) - applied_at`, averaged over applications that have both an `applied_at` and any response timestamp.

---

## Alerts

Keyword-driven alerts that fire when the worker discovers a matching job (`JOB_DISCOVERED` event). Each alert may target an email address, a Slack webhook, or both.

### GET /alerts

List the current user's alerts.

### POST /alerts

Create an alert. Requires at least one of `email` or `slackWebhook`.

```json
{
  "name": "Senior eng",
  "keywords": ["staff", "senior", "principal"],
  "email": "you@example.com",
  "slackWebhook": "https://hooks.slack.com/services/...",
  "enabled": true
}
→ 201: { "id": "uuid", ... }
```

### PATCH /alerts/:id

Partial update. Any field accepted by `POST` may be sent; `enabled` toggles delivery without deleting the row.

### DELETE /alerts/:id

Delete an alert.

> Email delivery requires `RESEND_API_KEY` on the **worker**. Slack delivery has no extra config — it just POSTs to the webhook URL.

---

## Observability

### GET /health — Public health check

### GET /observability/stats — Admin-only system stats

### POST /observability/log — Client-side error logging
