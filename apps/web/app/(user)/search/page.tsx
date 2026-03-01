'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetcher } from '../../../lib/api';
import Link from 'next/link';
import { Search as SearchIcon, Building2, Briefcase, MapPin, Users, Calendar, ArrowRight, Loader2 } from 'lucide-react';

interface SearchCompany {
    id: string;
    name: string;
    careerUrl: string;
    sourcePlatform: string;
    crawlStatus: string | null;
    lastCrawlAt: string | null;
}

interface SearchJob {
    id: string;
    jobTitle: string;
    jobSlug: string;
    jobLocation: string | null;
    jobTeam: string | null;
    status: string;
    lastSeenAt: string;
    companyName: string;
    companyId: string;
}

interface SearchResult {
    companies: SearchCompany[];
    jobs: SearchJob[];
}

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

export default function SearchPage() {
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 300);

    const { data, isLoading } = useQuery({
        queryKey: ['search', debouncedQuery],
        queryFn: () => fetcher<SearchResult>(`/search?q=${encodeURIComponent(debouncedQuery)}`),
        enabled: debouncedQuery.length >= 2,
    });

    const companies = data?.companies || [];
    const jobs = data?.jobs || [];
    const hasResults = companies.length > 0 || jobs.length > 0;

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
            <header className="dash-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-foreground)' }}>
                            <span style={{ color: 'var(--color-accent)' }}>Career</span>Crawl
                        </h1>
                    </Link>
                    <span style={{ color: 'var(--color-muted-foreground)', fontSize: '0.85rem' }}>/ Search</span>
                </div>
                <nav style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link href="/dashboard" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>Dashboard</Link>
                    <Link href="/companies" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>Companies</Link>
                    <Link href="/my-jobs" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>My Jobs</Link>
                    <Link href="/search" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>Search</Link>
                </nav>
            </header>

            <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
                {/* Search Input */}
                <div style={{ position: 'relative', marginBottom: '2rem' }}>
                    <input
                        className="input"
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search companies, job titles, locations..."
                        autoFocus
                        style={{
                            fontSize: '1.1rem',
                            padding: '0.9rem 1rem 0.9rem 2.5rem',
                        }}
                    />
                    <SearchIcon
                        size={20}
                        style={{
                            position: 'absolute',
                            left: '0.8rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--color-text-tertiary)',
                            pointerEvents: 'none',
                        }}
                    />
                </div>

                {/* Results */}
                {isLoading && debouncedQuery.length >= 2 && (
                    <div style={{ textAlign: 'center', color: 'var(--color-muted-foreground)', padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Loader2 className="animate-spin" size={18} />
                        <span>Searching discovery engine...</span>
                    </div>
                )}

                {debouncedQuery.length >= 2 && !isLoading && !hasResults && (
                    <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No results found</p>
                        <p style={{ color: 'var(--color-muted-foreground)', fontSize: '0.85rem' }}>
                            Try a different search term or add more companies from the dashboard.
                        </p>
                    </div>
                )}

                {/* Companies Results */}
                {companies.length > 0 && (
                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                            Companies ({companies.length})
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {companies.map(c => (
                                <Link key={c.id} href={`/companies/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div className="glass-card" style={{ padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}>
                                        <div>
                                            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{c.name}</span>
                                            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--color-muted-foreground)' }}>
                                                {c.sourcePlatform}
                                            </span>
                                        </div>
                                        <span className={`status-pill ${c.crawlStatus === 'SUCCESS' ? 'status-pill--offer' : c.crawlStatus === 'FAILED' ? 'status-pill--rejected' : 'status-pill--saved'}`} style={{ fontSize: '0.7rem' }}>
                                            <span className="status-dot"></span>
                                            {c.crawlStatus || 'NONE'}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Jobs Results */}
                {jobs.length > 0 && (
                    <section>
                        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                            Jobs ({jobs.length})
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {jobs.map(job => (
                                <div key={job.id} className="glass-card" style={{ padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{job.jobTitle}</span>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-foreground)', marginTop: '0.15rem' }}>
                                            <Link href={`/companies/${job.companyId}`} style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>
                                                {job.companyName}
                                            </Link>
                                            {job.jobLocation && <span> · {job.jobLocation}</span>}
                                            {job.jobTeam && <span> · {job.jobTeam}</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--color-muted-foreground)' }}>
                                            {new Date(job.lastSeenAt).toLocaleDateString()}
                                        </span>
                                        <span className={`status-pill ${job.status === 'OPEN' ? 'status-pill--offer' : 'status-pill--rejected'}`} style={{ fontSize: '0.7rem' }}>
                                            <span className="status-dot"></span>
                                            {job.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
