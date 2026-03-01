'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../../../lib/api';
import Link from 'next/link';
import { CompanyLogo } from '../../components/CompanyLogo';
import { getDomainFromUrl } from '../../../lib/utils';
import {
    Search as SearchIcon,
    RefreshCw,
    Trash2,
    ExternalLink,
    LayoutGrid,
    Globe,
    Plus,
    Clock,
    CheckCircle2,
    XCircle,
    Building2,
    Eye
} from 'lucide-react';

interface Company {
    id: string;
    name: string;
    careerUrl: string;
    sourcePlatform: string;
    crawlStatus: string | null;
    crawlSchedule: string;
    isTarget: boolean;
    lastCrawlAt: string | null;
    jobCount: number;
    newJobCount: number;
}

export default function CompaniesPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');

    const { data: companies = [], isLoading } = useQuery({
        queryKey: ['companies', search],
        queryFn: () => fetcher<Company[]>(`/companies${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => fetcher(`/companies/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
    });

    const reCrawlMut = useMutation({
        mutationFn: (id: string) => fetcher<{ crawlRunId: string }>(`/companies/${id}/crawl`, { method: 'POST' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
    });

    const platformColors: Record<string, string> = {
        GREENHOUSE: '#22c55e',
        LEVER: '#3b82f6',
        WORKDAY: '#f97316',
        ICIMS: '#8b5cf6',
        CUSTOM: '#6b7280',
        UNKNOWN: '#6b7280',
    };

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
            <header className="dash-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-foreground)' }}>
                            <span style={{ color: 'var(--color-accent)' }}>Career</span>Crawl
                        </h1>
                    </Link>
                    <span style={{ color: 'var(--color-muted-foreground)', fontSize: '0.85rem' }}>/ Companies</span>
                </div>
                <nav style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link href="/dashboard" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>Dashboard</Link>
                    <Link href="/companies" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>Companies</Link>
                    <Link href="/my-jobs" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>My Jobs</Link>
                    <Link href="/search" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>Search</Link>
                </nav>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
                {/* Search */}
                <div style={{ marginBottom: '1.5rem', position: 'relative', maxWidth: '400px' }}>
                    <SearchIcon
                        size={18}
                        style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}
                    />
                    <input
                        className="input"
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search companies..."
                        style={{ paddingLeft: '3rem' }}
                    />
                </div>

                {/* Company Grid */}
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted-foreground)' }}>Loading...</div>
                ) : companies.length === 0 ? (
                    <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No companies yet</p>
                        <p style={{ color: 'var(--color-muted-foreground)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Go to the <Link href="/dashboard" style={{ color: 'var(--color-accent)' }}>Dashboard</Link> to add your first career page URL.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                        {companies.map(company => (
                            <div key={company.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                        <CompanyLogo
                                            name={company.name}
                                            domain={getDomainFromUrl(company.careerUrl)}
                                            size={40}
                                            className="glass"
                                            style={{ padding: '8px', borderRadius: '10px' }}
                                        />
                                        <div>
                                            <Link href={`/companies/${company.id}`} style={{ textDecoration: 'none', color: 'var(--color-foreground)' }}>
                                                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.25rem' }}>{company.name}</h3>
                                            </Link>
                                            <a href={company.careerUrl} target="_blank" rel="noopener" style={{ fontSize: '0.78rem', color: 'var(--color-muted-foreground)', wordBreak: 'break-all' }}>
                                                {company.careerUrl.replace(/^https?:\/\//, '').substring(0, 50)}
                                            </a>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '9999px',
                                        color: '#fff',
                                        background: platformColors[company.sourcePlatform] || '#6b7280',
                                    }}>
                                        {company.sourcePlatform}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                                    <div>
                                        <span style={{ color: 'var(--color-muted-foreground)' }}>Jobs: </span>
                                        <strong>{company.jobCount}</strong>
                                    </div>
                                    {company.newJobCount > 0 && (
                                        <div>
                                            <span style={{ color: 'var(--color-accent)' }}>+{company.newJobCount} new</span>
                                        </div>
                                    )}
                                    <div style={{ marginLeft: 'auto' }}>
                                        <span className={`status-pill ${company.crawlStatus === 'SUCCESS' ? 'status-pill--offer' : company.crawlStatus === 'FAILED' ? 'status-pill--rejected' : company.crawlStatus === 'RUNNING' ? 'status-pill--interviewing' : 'status-pill--saved'}`} style={{ fontSize: '0.7rem' }}>
                                            <span className="status-dot"></span>
                                            {company.crawlStatus === 'RUNNING' ? (
                                                <RefreshCw size={10} className="animate-spin" style={{ marginRight: '4px' }} />
                                            ) : null}
                                            {company.crawlStatus || 'NONE'}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)' }}>
                                    <Link
                                        href={`/companies/${company.id}`}
                                        className="btn"
                                        style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem', textAlign: 'center', background: 'transparent', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                                    >
                                        <Eye size={14} /> View
                                    </Link>
                                    <button
                                        className="btn"
                                        onClick={() => reCrawlMut.mutate(company.id)}
                                        disabled={company.crawlStatus === 'RUNNING'}
                                        style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                                    >
                                        {reCrawlMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        Crawl
                                    </button>
                                    <button
                                        className="btn-icon"
                                        onClick={() => {
                                            if (confirm(`Delete ${company.name}? This removes all its jobs too.`)) {
                                                deleteMut.mutate(company.id);
                                            }
                                        }}
                                        style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.2)', padding: '0.45rem' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
