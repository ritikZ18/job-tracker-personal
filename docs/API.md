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
{ "company": "Google", "jobTitle": "SWE", "jobUrl": "https://...", "status": "SAVED" }
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

## Observability

### GET /health — Public health check
### GET /observability/stats — Admin-only system stats
### POST /observability/log — Client-side error logging
