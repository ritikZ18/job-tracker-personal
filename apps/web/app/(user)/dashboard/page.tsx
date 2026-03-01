'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import Link from 'next/link';

// ============================================================
// TYPES
// ============================================================

interface Company {
    id: string;
    name: string;
    careerUrl: string;
    sourcePlatform: string;
    crawlStatus: string | null;
    lastCrawlAt: string | null;
    jobCount: number;
    newJobCount: number;
}

interface CrawlRun {
    id: string;
    companyId: string;
    companyName: string;
    status: string;
    jobsDiscovered: number;
    jobsUpdated: number;
    errorCount: number;
    durationMs: number | null;
    createdAt: string;
}

interface CrawlLogEntry {
    type: string;
    message?: string;
    timestamp?: number;
    jobsDiscovered?: number;
    jobsUpdated?: number;
    errorCount?: number;
    durationMs?: number;
}

// ============================================================
// DASHBOARD PAGE
// ============================================================

export default function DashboardPage() {
    const { user, signOut } = useAuth();
    const queryClient = useQueryClient();
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    // URL Input state
    const [urlInput, setUrlInput] = useState('');
    const [bulkMode, setBulkMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Terminal state
    const [terminalOpen, setTerminalOpen] = useState(false);
    const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
    const [activeCrawlId, setActiveCrawlId] = useState<string | null>(null);
    const terminalRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Theme toggle
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [terminalLogs]);

    // Clean up SSE on unmount
    useEffect(() => {
        return () => { eventSourceRef.current?.close(); };
    }, []);

    // Queries
    const { data: companiesData } = useQuery({
        queryKey: ['companies'],
        queryFn: () => fetcher<Company[]>('/companies'),
        refetchInterval: activeCrawlId ? 3000 : false,
    });

    const { data: crawlsData } = useQuery({
        queryKey: ['crawls'],
        queryFn: () => fetcher<CrawlRun[]>('/crawls?limit=10'),
        refetchInterval: activeCrawlId ? 3000 : 10000,
    });

    const companies = companiesData || [];
    const crawls = crawlsData || [];

    // Stats
    const totalCompanies = companies.length;
    const totalJobs = companies.reduce((sum, c) => sum + c.jobCount, 0);
    const newJobs = companies.reduce((sum, c) => sum + c.newJobCount, 0);
    const crawlErrors = crawls.filter(c => c.status === 'FAILED').length;

    // SSE connection for live crawl logs
    const connectSSE = useCallback((crawlRunId: string) => {
        eventSourceRef.current?.close();
        setActiveCrawlId(crawlRunId);
        setTerminalOpen(true);
        setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Connecting to crawl stream...`]);

        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const es = new EventSource(`${apiBase}/crawls/${crawlRunId}/stream`);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            try {
                const data: CrawlLogEntry = JSON.parse(event.data);
                if (data.type === 'log' && data.message) {
                    setTerminalLogs(prev => [...prev, data.message!]);
                } else if (data.type === 'complete') {
                    setTerminalLogs(prev => [
                        ...prev,
                        `✅ Crawl complete — ${data.jobsDiscovered} discovered, ${data.jobsUpdated} updated, ${data.errorCount} errors (${((data.durationMs || 0) / 1000).toFixed(1)}s)`,
                    ]);
                    setActiveCrawlId(null);
                    queryClient.invalidateQueries({ queryKey: ['companies'] });
                    queryClient.invalidateQueries({ queryKey: ['crawls'] });
                    es.close();
                } else if (data.type === 'error') {
                    setTerminalLogs(prev => [...prev, `❌ Crawl failed: ${JSON.stringify(data)}`]);
                    setActiveCrawlId(null);
                    es.close();
                }
            } catch { /* ignore parse errors */ }
        };

        es.onerror = () => {
            setTerminalLogs(prev => [...prev, `⚠️ Stream connection lost`]);
        };
    }, [queryClient]);

    // Submit URL
    const handleSubmitUrl = async () => {
        if (!urlInput.trim()) return;
        setIsSubmitting(true);

        try {
            if (bulkMode) {
                const urls = urlInput
                    .split('\n')
                    .map(u => u.trim())
                    .filter(u => u.startsWith('http'));

                const result = await fetcher<(Company & { crawlRunId: string })[]>('/companies/bulk', {
                    method: 'POST',
                    body: { urls: urls.map(u => ({ careerUrl: u })) },
                });

                setTerminalLogs(prev => [...prev, `📦 Bulk submitted ${result.length} companies`]);
                if (result.length > 0 && result[0]?.crawlRunId) {
                    connectSSE(result[0]!.crawlRunId);
                }
            } else {
                const result = await fetcher<Company & { crawlRunId: string }>('/companies', {
                    method: 'POST',
                    body: { careerUrl: urlInput.trim() },
                });

                setTerminalLogs(prev => [...prev, `🏢 Added: ${result.name} — crawl queued`]);
                connectSSE(result.crawlRunId);
            }

            setUrlInput('');
            queryClient.invalidateQueries({ queryKey: ['companies'] });
        } catch (error: any) {
            setTerminalLogs(prev => [...prev, `❌ Error: ${error.message}`]);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
            {/* Header */}
            <header className="dash-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em' }}>
                        <span style={{ color: 'var(--color-accent)' }}>Career</span>Crawl
                    </h1>
                </div>

                <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Link href="/dashboard" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>Dashboard</Link>
                    <Link href="/companies" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>Companies</Link>
                    <Link href="/my-jobs" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>My Jobs</Link>
                    <Link href="/search" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>Search</Link>

                    <button
                        className="btn"
                        onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                        style={{ width: '2.2rem', height: '2.2rem', padding: 0, fontSize: '1rem', borderRadius: '50%', background: 'transparent', border: '1px solid var(--glass-border)' }}
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>

                    <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.8rem' }}>
                        {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                </nav>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
                {/* URL Input Panel */}
                <section className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Add Career Page URL</h2>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-muted-foreground)', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={bulkMode}
                                onChange={e => setBulkMode(e.target.checked)}
                                style={{ accentColor: 'var(--color-accent)' }}
                            />
                            Bulk mode
                        </label>
                    </div>

                    {bulkMode ? (
                        <textarea
                            className="input"
                            value={urlInput}
                            onChange={e => setUrlInput(e.target.value)}
                            placeholder={'Paste one URL per line:\nhttps://boards.greenhouse.io/company\nhttps://jobs.lever.co/company\nhttps://company.com/careers'}
                            rows={5}
                            style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                        />
                    ) : (
                        <input
                            className="input"
                            type="url"
                            value={urlInput}
                            onChange={e => setUrlInput(e.target.value)}
                            placeholder="https://boards.greenhouse.io/company or any career page URL"
                            onKeyDown={e => e.key === 'Enter' && handleSubmitUrl()}
                        />
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <button
                            className="btn"
                            onClick={handleSubmitUrl}
                            disabled={isSubmitting || !urlInput.trim()}
                            style={{ opacity: isSubmitting || !urlInput.trim() ? 0.5 : 1 }}
                        >
                            {isSubmitting ? '⏳ Crawling...' : '🔍 Crawl & Discover Jobs'}
                        </button>
                    </div>
                </section>

                {/* KPI Stats */}
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <Link href="/companies" style={{ textDecoration: 'none' }}>
                        <div className="kpi-card">
                            <span className="kpi-label">Companies</span>
                            <span className="kpi-value">{totalCompanies}</span>
                        </div>
                    </Link>
                    <Link href="/search" style={{ textDecoration: 'none' }}>
                        <div className="kpi-card">
                            <span className="kpi-label">Jobs Found</span>
                            <span className="kpi-value">{totalJobs}</span>
                        </div>
                    </Link>
                    <div className="kpi-card">
                        <span className="kpi-label">New This Week</span>
                        <span className="kpi-value" style={{ color: 'var(--color-accent)' }}>{newJobs}</span>
                    </div>
                    <div className="kpi-card">
                        <span className="kpi-label">Crawl Errors</span>
                        <span className="kpi-value" style={{ color: crawlErrors > 0 ? '#ef4444' : undefined }}>{crawlErrors}</span>
                    </div>
                </section>

                {/* Recent Crawls */}
                <section className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Recent Crawls</h2>
                    {crawls.length === 0 ? (
                        <p style={{ color: 'var(--color-muted-foreground)', fontSize: '0.9rem' }}>No crawls yet. Paste a career page URL above to get started.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Company</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Status</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Jobs</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Updated</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Errors</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Duration</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>When</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {crawls.map(crawl => (
                                        <tr key={crawl.id} style={{ borderBottom: '1px solid var(--glass-border-subtle, rgba(255,255,255,0.04))' }}>
                                            <td style={{ padding: '0.5rem', fontWeight: 500 }}>{crawl.companyName}</td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <span className={`status-pill ${crawl.status === 'SUCCESS' ? 'status-pill--offer' : crawl.status === 'FAILED' ? 'status-pill--rejected' : crawl.status === 'RUNNING' ? 'status-pill--interviewing' : 'status-pill--saved'}`}>
                                                    <span className="status-dot"></span>
                                                    {crawl.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{crawl.jobsDiscovered}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{crawl.jobsUpdated}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', color: crawl.errorCount > 0 ? '#ef4444' : undefined }}>{crawl.errorCount}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                                {crawl.durationMs ? `${(crawl.durationMs / 1000).toFixed(1)}s` : '—'}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--color-muted-foreground)' }}>
                                                {new Date(crawl.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Crawler Terminal */}
                <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <button
                        onClick={() => setTerminalOpen(o => !o)}
                        style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem 1.5rem',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-foreground)',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                        }}
                    >
                        <span>
                            🖥️ Crawler Terminal
                            {activeCrawlId && <span style={{ marginLeft: '0.5rem', color: 'var(--color-accent)', animation: 'pulse 1.5s infinite' }}>● LIVE</span>}
                        </span>
                        <span style={{ transform: terminalOpen ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}>▼</span>
                    </button>

                    {terminalOpen && (
                        <div
                            ref={terminalRef}
                            style={{
                                background: '#0a0a0a',
                                color: '#00ff41',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.78rem',
                                lineHeight: 1.6,
                                padding: '1rem 1.5rem',
                                maxHeight: '320px',
                                overflowY: 'auto',
                                borderTop: '1px solid rgba(0,255,65,0.15)',
                            }}
                        >
                            {terminalLogs.length === 0 ? (
                                <div style={{ color: '#555' }}>$ Waiting for crawl jobs... Submit a URL to start.</div>
                            ) : (
                                terminalLogs.map((log, i) => (
                                    <div key={i} style={{
                                        color: log.includes('[ERROR]') || log.includes('❌') ? '#ef4444'
                                            : log.includes('[DONE]') || log.includes('✅') ? '#22c55e'
                                                : log.includes('[NEW]') ? '#38bdf8'
                                                    : log.includes('[PROGRESS]') ? '#a78bfa'
                                                        : log.includes('[WARN]') ? '#fbbf24'
                                                            : '#00ff41',
                                    }}>
                                        {log}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
