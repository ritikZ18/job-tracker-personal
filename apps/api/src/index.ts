import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import applicationsRoutes from './routes/applications.js';
import jobAnalysesRoutes from './routes/job-analyses.js';
import viewsRoutes from './routes/views.js';
import observabilityRoutes from './routes/observability.js';
import companiesRoutes from './routes/companies.js';
import jobsRoutes from './routes/jobs.js';
import crawlsRoutes from './routes/crawls.js';
import searchRoutes from './routes/search.js';
import analyzeRoutes from './routes/analyze.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
    })
);
app.use(express.json());

// Health check
app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'CareerCrawl API' });
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

// Routes
app.use('/auth', authRoutes);
app.use('/applications', applicationsRoutes);
app.use('/job-analyses', jobAnalysesRoutes);
app.use('/views', viewsRoutes);
app.use('/observability', observabilityRoutes);
app.use('/companies', companiesRoutes);
app.use('/jobs', jobsRoutes);
app.use('/crawls', crawlsRoutes);
app.use('/search', searchRoutes);
app.use('/analyze', analyzeRoutes);

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
});
