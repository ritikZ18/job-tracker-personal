'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import Link from 'next/link';
import { CompanyLogo } from '../../components/CompanyLogo';
import { CrawlerTerminal } from '../../components/CrawlerTerminal';
import { getDomainFromUrl } from '../../../lib/utils';
import {
    Search,
    Globe,
    Briefcase,
    Clock,
    AlertCircle,
    Plus,
    Layers,
    Calendar,
    Moon,
    Sun,
    Terminal,
    Filter,
    LogOut
} from 'lucide-react';

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

    // Filter Preferences
    const [maxAgeDays, setMaxAgeDays] = useState<number>(30); // Default 30 days
    const [category, setCategory] = useState<string>('all');

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
        // Silently connect without boilerplate logs

        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const es = new EventSource(`${apiBase}/crawls/${crawlRunId}/stream`);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            try {
                const data: CrawlLogEntry = JSON.parse(event.data);
                if (data.type === 'log' && data.message) {
                    setTerminalLogs(prev => [...prev, data.message!]);
                } else if (data.type === 'complete') {
                    setActiveCrawlId(null);
                    queryClient.invalidateQueries({ queryKey: ['companies'] });
                    queryClient.invalidateQueries({ queryKey: ['crawls'] });
                    es.close();
                } else if (data.type === 'error') {
                    setTerminalLogs(prev => [...prev, `[error] Crawl failed`]);
                    setActiveCrawlId(null);
                    es.close();
                }
            } catch { /* ignore parse errors */ }
        };

        es.onerror = () => {
            // Silently handle retry
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
                    body: {
                        careerUrl: urlInput.trim(),
                        preferences: { maxAgeDays, category: category === 'all' ? null : category }
                    },
                });

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
                        className="btn-icon"
                        onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                        title="Toggle theme"
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>

                    <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.8rem', background: 'var(--color-accent)', color: 'white' }}>
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
                            placeholder={'https://boards.greenhouse.io/company\nhttps://jobs.lever.co/company\nhttps://company.com/careers'}
                            rows={4}
                            style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                        />
                    ) : (
                        <div style={{ position: 'relative' }}>
                            <Globe size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                            <input
                                className="input"
                                type="url"
                                value={urlInput}
                                onChange={e => setUrlInput(e.target.value)}
                                placeholder="Enter career page URL..."
                                style={{ paddingLeft: '3rem' }}
                                onKeyDown={e => e.key === 'Enter' && handleSubmitUrl()}
                            />
                        </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
                        {/* Preferences */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={16} style={{ color: 'var(--color-text-secondary)' }} />
                            <select
                                className="input"
                                style={{ padding: '0.4rem 0.8rem', width: 'auto', fontSize: '0.8rem' }}
                                value={maxAgeDays}
                                onChange={(e) => setMaxAgeDays(Number(e.target.value))}
                            >
                                <option value={7}>Last 7 days</option>
                                <option value={14}>Last 14 days</option>
                                <option value={30}>Last 30 days</option>
                                <option value={60}>Last 60 days</option>
                                <option value={90}>Last 90 days</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Filter size={16} style={{ color: 'var(--color-text-secondary)' }} />
                            <select
                                className="input"
                                style={{ padding: '0.4rem 0.8rem', width: 'auto', fontSize: '0.8rem' }}
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                <option value="all">All Categories</option>
                                <option value="engineering">Engineering</option>
                                <option value="product">Product</option>
                                <option value="design">Design</option>
                                <option value="marketing">Marketing</option>
                                <option value="sales">Sales</option>
                            </select>
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={handleSubmitUrl}
                            disabled={isSubmitting || !urlInput.trim()}
                            style={{ marginLeft: 'auto' }}
                        >
                            {isSubmitting ? <Clock className="animate-spin" size={18} /> : <Search size={18} />}
                            <span>{isSubmitting ? 'Crawling...' : 'Crawl Jobs'}</span>
                        </button>
                    </div>
                </section>

                {/* KPI Stats */}
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <Link href="/companies" style={{ textDecoration: 'none' }}>
                        <div className="kpi-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span className="kpi-label">Companies</span>
                                <Globe size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                            </div>
                            <span className="kpi-value">{totalCompanies}</span>
                        </div>
                    </Link>
                    <Link href="/search" style={{ textDecoration: 'none' }}>
                        <div className="kpi-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span className="kpi-label">Jobs Found</span>
                                <Briefcase size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                            </div>
                            <span className="kpi-value">{totalJobs}</span>
                        </div>
                    </Link>
                    <div className="kpi-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="kpi-label">New This Week</span>
                            <Calendar size={16} style={{ color: 'var(--color-accent)' }} />
                        </div>
                        <span className="kpi-value" style={{ color: 'var(--color-accent)' }}>{newJobs}</span>
                    </div>
                    <div className="kpi-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="kpi-label">Crawl Errors</span>
                            <AlertCircle size={16} style={{ color: crawlErrors > 0 ? 'var(--color-danger)' : 'var(--color-text-tertiary)' }} />
                        </div>
                        <span className="kpi-value" style={{ color: crawlErrors > 0 ? 'var(--color-danger)' : undefined }}>{crawlErrors}</span>
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
                                            <td style={{ padding: '0.8rem 0.5rem', fontWeight: 500 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                    <CompanyLogo
                                                        name={crawl.companyName}
                                                        size={20}
                                                    />
                                                    {crawl.companyName}
                                                </div>
                                            </td>
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

                <CrawlerTerminal
                    logs={terminalLogs}
                    isLive={!!activeCrawlId}
                    isOpen={terminalOpen}
                    onToggle={() => setTerminalOpen(!terminalOpen)}
                />
            </main>
        </div>
    );
}
