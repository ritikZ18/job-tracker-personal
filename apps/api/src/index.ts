import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import applicationsRoutes from './routes/applications.js';
import jobAnalysesRoutes from './routes/job-analyses.js';
import viewsRoutes from './routes/views.js';
import observabilityRoutes from './routes/observability.js';

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
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

// Routes
app.use('/auth', authRoutes);
app.use('/applications', applicationsRoutes);
app.use('/job-analyses', jobAnalysesRoutes);
app.use('/views', viewsRoutes);
app.use('/observability', observabilityRoutes);

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
});
