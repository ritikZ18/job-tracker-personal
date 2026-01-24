# API Documentation

Base URL: `http://localhost:3001`

## Authentication

All endpoints (except `/health` and `/auth/*`) require authentication via HTTP-only cookie.

### POST /auth/register
Create a new account.

```json
Request:
{ "email": "user@example.com", "password": "securepassword" }

Response (201):
{ "user": { "id": "uuid", "email": "user@example.com" } }
```

### POST /auth/login
Login and receive auth cookie.

```json
Request:
{ "email": "user@example.com", "password": "securepassword" }

Response (200):
{ "user": { "id": "uuid", "email": "user@example.com" } }
```

### POST /auth/logout
Clear auth cookie.

### GET /auth/me
Get current user.

---

## Applications

### GET /applications
List all applications for current user.

**Query params:**
- `status` - Filter by status (SAVED, APPLIED, INTERVIEWING, OFFER, REJECTED, GHOSTED)
- `search` - Search company/title

### POST /applications
Create new application.

```json
Request:
{
  "company": "Google",
  "jobTitle": "Software Engineer",
  "jobUrl": "https://...",
  "status": "SAVED"
}
```

### PATCH /applications/:id
Update application fields.

### PATCH /applications/:id/status
Update status only (triggers auto-timestamps).

```json
Request:
{ "status": "REJECTED" }
```

### DELETE /applications/:id
Delete application.

### POST /applications/analyze
Enqueue URL for AI analysis.

```json
Request:
{ "jobUrl": "https://jobs.example.com/posting" }

Response (202):
{ "jobAnalysisId": "uuid", "status": "PENDING" }
```

---

## Job Analyses

### GET /job-analyses/:id
Get analysis status and result.

```json
Response:
{
  "id": "uuid",
  "status": "DONE",
  "result": {
    "title": "Software Engineer",
    "company": "Google",
    "description": "5+ years experience..."
  }
}
```

---

## Views

### GET /views
List saved views.

### POST /views
Create saved view.

### PUT /views/:id
Update saved view.

### DELETE /views/:id
Delete saved view.

---

## Observability

### GET /observability/health
Health check (public).

### GET /observability/stats
Admin stats (requires admin role).

### POST /observability/log
Client error logging.
