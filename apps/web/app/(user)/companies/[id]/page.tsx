'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { fetcher } from '../../../../lib/api';
import Link from 'next/link';
import {
    Search as SearchIcon,
    RefreshCw,
    Briefcase,
    MapPin,
    Users,
    Calendar,
    Save,
    Home,
    ArrowLeft,
    Share2,
    ExternalLink,
    Clock,
    CheckCircle2,
    XCircle,
    Info,
    LayoutDashboard,
    Loader2
} from 'lucide-react';

interface CompanyDetail {
    id: string;
    name: string;
    careerUrl: string;
    sourcePlatform: string;
    crawlStatus: string | null;
    crawlSchedule: string;
    isTarget: boolean;
    logoUrl: string | null;
    heroImageUrl: string | null;
    rootDomain: string | null;
    stats: {
        total: number;
        open: number;
        closed: number;
        newThisWeek: number;
    };
}

interface Job {
    id: string;
    jobTitle: string;
    jobSlug: string;
    canonicalJobUrl: string;
    jobLocation: string | null;
    jobTeam: string | null;
    employmentType: string | null;
    status: string;
    firstSeenAt: string;
    lastSeenAt: string;
    isRemote: boolean;
    seniority: string | null;
    salaryRange: string | null;
    qualityScore: string | null;
    parseMethod: string | null;
}

export default function CompanyDetailPage() {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');

    const { data: company, isLoading: companyLoading } = useQuery({
        queryKey: ['company', id],
        queryFn: () => fetcher<CompanyDetail>(`/companies/${id}`),
        enabled: !!id,
    });

    const { data: jobsData } = useQuery({
        queryKey: ['company-jobs', id, search],
        queryFn: () =>
            fetcher<{ jobs: Job[]; total: number }>(
                `/jobs?companyId=${id}${search ? `&search=${encodeURIComponent(search)}` : ''}`
            ),
        enabled: !!id,
    });

    const reCrawlMut = useMutation({
        mutationFn: () => fetcher<{ crawlRunId: string }>(`/companies/${id}/crawl`, { method: 'POST' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['company', id] });
        },
    });

    const saveMut = useMutation({
        mutationFn: (slug: string) => fetcher(`/jobs/${slug}/save`, { method: 'POST' }),
    });

    const jobs = jobsData?.jobs || [];

    if (companyLoading) {
        return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-muted-foreground)' }}>Loading...</div>;
    }

    if (!company) {
        return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-muted-foreground)' }}>Company not found</div>;
    }

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
            <header className="dash-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-foreground)' }}>
                            <span style={{ color: 'var(--color-accent)' }}>Career</span>Crawl
                        </h1>
                    </Link>
                    <span style={{ color: 'var(--color-muted-foreground)', fontSize: '0.85rem' }}>/ <Link href="/companies" style={{ color: 'var(--color-muted-foreground)' }}>Companies</Link> / {company.name}</span>
                </div>
                <nav style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link href="/dashboard" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>Dashboard</Link>
                    <Link href="/companies" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>Companies</Link>
                </nav>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
                {/* Company Header */}
                <section className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            {company.logoUrl ? (
                                <img
                                    src={company.logoUrl}
                                    alt={company.name}
                                    style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'contain', background: 'white', border: '1px solid var(--glass-border)' }}
                                />
                            ) : (
                                <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'var(--color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Briefcase size={24} style={{ color: 'var(--color-text-tertiary)' }} />
                                </div>
                            )}
                            <div>
                                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>{company.name}</h2>
                                <a href={company.careerUrl} target="_blank" rel="noopener" style={{ fontSize: '0.85rem', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    {company.careerUrl} <ExternalLink size={12} />
                                </a>
                            </div>
                        </div>
                        <button
                            className="btn"
                            onClick={() => reCrawlMut.mutate()}
                            disabled={company.crawlStatus === 'RUNNING' || reCrawlMut.isPending}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                            {reCrawlMut.isPending || company.crawlStatus === 'RUNNING' ? (
                                <RefreshCw size={16} className="animate-spin" />
                            ) : (
                                <RefreshCw size={16} />
                            )}
                            {reCrawlMut.isPending ? 'Queuing Discovery...' : 'Trigger Discovery'}
                        </button>
                    </div>
                </section>

                {/* Stats */}
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="kpi-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="kpi-label">Total Jobs</span>
                            <Briefcase size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                        </div>
                        <span className="kpi-value">{company.stats.total}</span>
                    </div>
                    <div className="kpi-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="kpi-label">Open</span>
                            <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
                        </div>
                        <span className="kpi-value" style={{ color: 'var(--color-success)' }}>{company.stats.open}</span>
                    </div>
                    <div className="kpi-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="kpi-label">Closed</span>
                            <XCircle size={16} style={{ color: 'var(--color-danger)' }} />
                        </div>
                        <span className="kpi-value" style={{ color: 'var(--color-danger)' }}>{company.stats.closed}</span>
                    </div>
                    <div className="kpi-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="kpi-label">New This Week</span>
                            <Calendar size={16} style={{ color: 'var(--color-accent)' }} />
                        </div>
                        <span className="kpi-value" style={{ color: 'var(--color-accent)' }}>{company.stats.newThisWeek}</span>
                    </div>
                </section>

                {/* Search + Jobs Table */}
                <section className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <LayoutDashboard size={18} className="text-secondary" /> Discovered Jobs ({jobsData?.total || 0})
                        </h3>
                        <div style={{ position: 'relative', width: '250px' }}>
                            <SearchIcon size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                            <input
                                className="input"
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Filter results..."
                                style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
                            />
                        </div>
                    </div>

                    {jobs.length === 0 ? (
                        <p style={{ color: 'var(--color-muted-foreground)', fontSize: '0.9rem' }}>No jobs found. Try crawling the career page.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Title</th>
                                        <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Location</th>
                                        <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Team</th>
                                        <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Source / Quality</th>
                                        <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>First Seen</th>
                                        <th style={{ padding: '0.6rem 0.5rem' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.map(job => (
                                        <tr key={job.id} style={{ borderBottom: '1px solid var(--glass-border-subtle, rgba(255,255,255,0.04))' }}>
                                            <td style={{ padding: '0.75rem 0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <a href={job.canonicalJobUrl} target="_blank" rel="noopener" style={{ fontWeight: 600, color: 'var(--color-foreground)', textDecoration: 'none', borderBottom: '1px solid transparent', transition: 'border-color 0.2s' }}>
                                                        {job.jobTitle}
                                                    </a>
                                                    {job.isRemote && (
                                                        <span style={{ fontSize: '0.65rem', background: 'var(--color-accent-soft)', color: 'var(--color-accent)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                            <Home size={10} /> REMOTE
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.6rem 0.5rem', color: 'var(--color-muted-foreground)' }}>{job.jobLocation || '—'}</td>
                                            <td style={{ padding: '0.6rem 0.5rem', color: 'var(--color-muted-foreground)' }}>{job.jobTeam || '—'}</td>
                                            <td style={{ padding: '0.6rem 0.5rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>
                                                        {job.parseMethod || 'HTML'}
                                                    </span>
                                                    {job.qualityScore && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                            <div style={{ width: '40px', height: '4px', background: 'var(--glass-border)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${Number(job.qualityScore) * 100}%`, height: '100%', background: Number(job.qualityScore) > 0.7 ? 'var(--color-success)' : Number(job.qualityScore) > 0.4 ? 'var(--color-accent)' : 'var(--color-danger)' }} />
                                                            </div>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-tertiary)' }}>{Math.round(Number(job.qualityScore) * 100)}%</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.6rem 0.5rem', color: 'var(--color-muted-foreground)', fontSize: '0.8rem' }}>{new Date(job.firstSeenAt).toLocaleDateString()}</td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                                                <button
                                                    className="btn"
                                                    onClick={() => saveMut.mutate(job.jobSlug)}
                                                    disabled={saveMut.isPending}
                                                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}
                                                >
                                                    {saveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                    <span>Track</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
