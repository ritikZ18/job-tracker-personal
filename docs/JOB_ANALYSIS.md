# Job Analysis System

This document explains how the job URL analysis feature works.

## Overview

When a user pastes a job posting URL, the system extracts:
- **Company name** - Who is hiring
- **Job title** - The role
- **Requirements/Description** - Skills and qualifications needed
- **Location** - Where the job is based

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │ ──▶ │    API      │ ──▶ │    Redis    │ ──▶ │   Worker    │
│  POST /analyze    │  Enqueue    │     │   Queue     │     │  Playwright │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                                       │
                           ▼                                       ▼
                    ┌─────────────┐                         ┌─────────────┐
                    │  PostgreSQL │◀────────────────────────│   Update    │
                    │  job_analyses                         │   Results   │
                    └─────────────┘                         └─────────────┘
```

## Flow

1. **User Action**: User pastes a job URL and clicks "Analyze"
2. **API Request**: Frontend POSTs to `/applications/analyze`
3. **Queue Job**: API creates a `job_analyses` record (status: `PENDING`) and enqueues to Redis
4. **Worker Pickup**: BullMQ worker picks up the job
5. **Extraction**: Worker fetches page and extracts data
6. **Update Status**: Worker updates `job_analyses` record to `DONE` with results
7. **Polling**: Frontend polls `/job-analyses/:id` until status is `DONE`
8. **Display**: Results shown to user who can create an application

## Extraction Strategy

### Priority Order

1. **JSON-LD** - Structured data (best quality)
2. **OpenGraph** - Meta tags (`og:title`, `og:site_name`)
3. **Job Board Specific** - Greenhouse, Lever, LinkedIn patterns
4. **DOM Heuristics** - CSS class patterns
5. **URL Parsing** - Fallback company from subdomain

### Greenhouse-Specific Logic

For Greenhouse URLs (`job-boards.greenhouse.io/companyname/...`):

```
URL: https://job-boards.greenhouse.io/archer56/jobs/7583101003
                                        ↑
                                  Extract "archer"
                                  (remove trailing numbers)
```

- Company: Extracted from URL path segment
- Location: From `.location` class
- Requirements: From "What you'll need" sections

### Extraction Examples

| Source | Pattern | Data |
|--------|---------|------|
| JSON-LD | `"@type": "JobPosting"` | title, company, description |
| OpenGraph | `og:site_name` | company |
| DOM | `.location` class | location |
| DOM | `<h3>What you'll need</h3>` | requirements |

## Worker Configuration

- **Concurrency**: 3 jobs processed simultaneously
- **Timeout**: 30 seconds per page load
- **Retry**: BullMQ handles retries on failure

## Database Schema

```sql
CREATE TABLE job_analyses (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  job_url TEXT NOT NULL,
  status ENUM('PENDING', 'RUNNING', 'DONE', 'FAILED'),
  result JSONB,  -- { title, company, description, location }
  error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Adding Support for New Job Boards

To add support for a new job board:

1. Add detection in `parseHtml()`:
   ```typescript
   if (url && url.includes('newboard.com')) {
       // Extract company, title, etc.
   }
   ```

2. Test with sample URLs from that board

3. Add patterns for:
   - Company name extraction
   - Job title extraction
   - Requirements/description extraction
   - Location extraction
