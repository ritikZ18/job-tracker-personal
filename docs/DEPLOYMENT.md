# Deployment Guide - Render

This guide covers deploying the Job Tracker to [Render](https://render.com).

## Architecture on Render

| Service | Type | Notes |
|---------|------|-------|
| API | Web Service | Express backend |
| Web | Static Site or Web Service | Next.js frontend |
| Worker | Background Worker | BullMQ processor |
| PostgreSQL | Managed Database | Render PostgreSQL |
| Redis | Managed Redis | Render Redis |

---

## Step 1: Create Databases

### PostgreSQL
1. Go to Render Dashboard → New → PostgreSQL
2. Name: `job-tracking-db`
3. Choose region and plan
4. Copy the **Internal Database URL**

### Redis
1. New → Redis
2. Name: `job-tracking-redis`
3. Copy the **Internal Redis URL**

---

## Step 2: Deploy API

1. New → Web Service
2. Connect your repo
3. Settings:
   - **Root Directory:** `apps/api`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** Node

4. Environment Variables:
   ```
   DATABASE_URL=<postgres-internal-url>
   REDIS_URL=<redis-internal-url>
   JWT_SECRET=<generate-a-strong-secret>
   CORS_ORIGIN=https://your-web-service.onrender.com
   NODE_ENV=production
   ```

---

## Step 3: Deploy Worker

1. New → Background Worker
2. Connect same repo
3. Settings:
   - **Root Directory:** `apps/worker`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`

4. Environment Variables (same as API):
   ```
   DATABASE_URL=<postgres-internal-url>
   REDIS_URL=<redis-internal-url>
   ```

5. Install Playwright browsers:
   ```
   # Add to build command:
   npm install && npx playwright install chromium && npm run build
   ```

---

## Step 4: Deploy Web

### Option A: Static Site (Recommended)
1. New → Static Site
2. Settings:
   - **Root Directory:** `apps/web`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `out`

3. Enable static export in `next.config.js`:
   ```js
   output: 'export'
   ```

### Option B: Web Service (SSR)
1. New → Web Service
2. Settings:
   - **Root Directory:** `apps/web`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`

3. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-api-service.onrender.com
   ```

---

## Step 5: Run Database Migrations

After API deploys, run migrations:

```bash
# In Render Shell or locally with DATABASE_URL set:
cd apps/api
npx drizzle-kit push
```

---

## Environment Variables Summary

| Variable | Service | Value |
|----------|---------|-------|
| `DATABASE_URL` | API, Worker | Render PostgreSQL internal URL |
| `REDIS_URL` | API, Worker | Render Redis internal URL |
| `JWT_SECRET` | API | Strong random string |
| `CORS_ORIGIN` | API | Your frontend URL |
| `NEXT_PUBLIC_API_URL` | Web | Your API URL |

---

## Health Checks

Configure Render health checks:
- **API:** `/health`
- **Worker:** Check logs for "Worker started"

---

## Costs

| Service | Free Tier | Paid |
|---------|-----------|------|
| Web Service | 750 hrs/mo | $7/mo |
| PostgreSQL | 1GB free | $7/mo |
| Redis | 25MB free | $10/mo |
| Background Worker | Not free | $7/mo |

**Total minimum:** ~$14-24/month for production

---

## Troubleshooting

### Worker not processing jobs
- Check Redis connection
- Verify DATABASE_URL is correct
- Check logs for Playwright errors

### CORS errors
- Verify CORS_ORIGIN matches exact frontend URL
- Include protocol (https://)

### Database connection issues
- Use Internal Database URL (not External)
- Check service is in same region
