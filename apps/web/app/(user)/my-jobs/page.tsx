'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import Link from 'next/link';
import { CompanyLogo } from '../../components/CompanyLogo';
import { getDomainFromUrl } from '../../../lib/utils';

import {
    Briefcase,
    Globe,
    Search,
    Plus,
    Clock,
    CheckCircle2,
    XCircle,
    UserPlus,
    Zap,
    ArrowRight,
    Trash2,
    ExternalLink,
    AlertCircle,
    Calendar,
    ChevronDown,
    Filter,
    LayoutDashboard,
    Terminal as TerminalIcon,
    Moon,
    Sun,
    Layers,
    Info,
    Check
} from 'lucide-react';

interface Application {
    id: string;
    company: string;
    jobTitle: string;
    jobUrl: string | null;
    status: string;
    notes: string | null;
    source: string;
    appliedAt: string | null;
    interviewingAt: string | null;
    offerAt: string | null;
    rejectedAt: string | null;
    ghostedAt: string | null;
    createdAt: string;
}

const TABS = [
    { key: 'ALL', label: 'All', icon: <Layers size={14} /> },
    { key: 'SAVED', label: 'Saved', icon: <Plus size={14} />, color: '#8c837f' },
    { key: 'APPLIED', label: 'Applied', icon: <Zap size={14} />, color: 'var(--color-info)' },
    { key: 'INTERVIEWING', label: 'Interviewing', icon: <Clock size={14} />, color: 'var(--color-warning)' },
    { key: 'OFFER', label: 'Offer', icon: <CheckCircle2 size={14} />, color: 'var(--color-success)' },
    { key: 'REJECTED', label: 'Rejected', icon: <XCircle size={14} />, color: 'var(--color-danger)' },
    { key: 'GHOSTED', label: 'Ghosted', icon: <AlertCircle size={14} />, color: '#444' },
];

export default function MyJobsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('ALL');
    const [showAddForm, setShowAddForm] = useState(false);
    const [showAnalyze, setShowAnalyze] = useState(false);

    // Add form state
    const [formCompany, setFormCompany] = useState('');
    const [formTitle, setFormTitle] = useState('');
    const [formUrl, setFormUrl] = useState('');

    // Analyze URL state
    const [analyzeUrl, setAnalyzeUrl] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisStep, setAnalysisStep] = useState<'IDLE' | 'DETECTING' | 'FETCHING' | 'PARSING' | 'SAVING'>('IDLE');
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const { data: applications = [], isLoading } = useQuery({
        queryKey: ['applications'],
        queryFn: () => fetcher<Application[]>('/applications'),
    });

    const createMut = useMutation({
        mutationFn: (data: { company: string; jobTitle: string; jobUrl?: string; status: string }) =>
            fetcher('/applications', { method: 'POST', body: data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            setShowAddForm(false);
            setFormCompany('');
            setFormTitle('');
            setFormUrl('');
        },
    });

    const updateStatusMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            fetcher(`/applications/${id}/status`, { method: 'PATCH', body: { status } }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => fetcher(`/applications/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    });

    // Analyze Link
    const handleAnalyze = async () => {
        if (!analyzeUrl.trim()) return;
        setAnalyzing(true);
        setAnalysisStep('DETECTING');
        setAnalysisError(null);
        setAnalysisResult(null);

        try {
            // Step 1: Detect & Enqueue
            const result = await fetcher<{ type: 'JOB' | 'PORTAL'; jobAnalysisId?: string; crawlRunId?: string; companyId?: string }>('/analyze', {
                method: 'POST',
                body: { url: analyzeUrl.trim() },
            });

            if (result.type === 'PORTAL') {
                setAnalysisStep('SAVING');
                // Portal handling: redirect to company page or show success
                setTimeout(() => {
                    setAnalyzing(false);
                    setAnalysisStep('IDLE');
                    setShowAnalyze(false);
                    queryClient.invalidateQueries({ queryKey: ['companies'] });
                    window.location.href = `/companies/${result.companyId}`;
                }, 1500);
                return;
            }

            // Job Detail handling
            setAnalysisStep('FETCHING');
            const analysisId = result.jobAnalysisId!;

            // Poll for result
            const poll = async (id: string, retries = 30): Promise<void> => {
                const analysis = await fetcher<{ status: string; result?: any; error?: string }>(`/job-analyses/${id}`);

                if (analysis.status === 'RUNNING') {
                    setAnalysisStep('PARSING');
                }

                if (analysis.status === 'DONE' && analysis.result) {
                    setAnalysisStep('SAVING');
                    setAnalysisResult(analysis.result);

                    setTimeout(() => {
                        setAnalyzing(false);
                        setAnalysisStep('IDLE');
                        // Auto-fill the add form
                        setFormCompany(analysis.result.company || '');
                        setFormTitle(analysis.result.title || analysis.result.jobTitle || '');
                        setFormUrl(analyzeUrl);
                        setShowAddForm(true);
                        setShowAnalyze(false);
                    }, 1000);
                } else if (analysis.status === 'FAILED') {
                    setAnalyzing(false);
                    setAnalysisStep('IDLE');
                    setAnalysisError(analysis.error || 'Analysis failed');
                } else if (retries > 0) {
                    setTimeout(() => poll(id, retries - 1), 2000);
                } else {
                    setAnalyzing(false);
                    setAnalysisStep('IDLE');
                    setAnalysisError('Analysis timed out');
                }
            };
            await poll(analysisId);
        } catch (error: any) {
            setAnalyzing(false);
            setAnalysisStep('IDLE');
            setAnalysisError(error.message);
        }
    };

    const filtered = activeTab === 'ALL'
        ? applications
        : applications.filter(a => a.status === activeTab);

    const getCounts = (status: string) => applications.filter(a => a.status === status).length;

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
            <header className="dash-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-foreground)' }}>
                            <span style={{ color: 'var(--color-accent)' }}>Career</span>Crawl
                        </h1>
                    </Link>
                    <span style={{ color: 'var(--color-muted-foreground)', fontSize: '0.85rem' }}>/ My Jobs</span>
                </div>
                <nav style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link href="/dashboard" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>Dashboard</Link>
                    <Link href="/companies" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>Companies</Link>
                    <Link href="/my-jobs" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>My Jobs</Link>
                    <Link href="/search" className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>Search</Link>
                </nav>
            </header>

            <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <button
                        className="btn"
                        onClick={() => { setShowAddForm(f => !f); setShowAnalyze(false); }}
                        style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.4rem' }}><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                        Add Application
                    </button>
                    <button
                        className="btn"
                        onClick={() => { setShowAnalyze(a => !a); setShowAddForm(false); }}
                        style={{ fontSize: '0.85rem', background: 'transparent', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.4rem' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                        Analyze Link
                    </button>
                </div>

                {/* Analyze Link Modal Overlay */}
                {
                    showAnalyze && (
                        <div style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 100,
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '1.5rem',
                        }}>
                            <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '2rem', position: 'relative' }}>
                                <button
                                    onClick={() => !analyzing && setShowAnalyze(false)}
                                    style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--color-muted-foreground)', cursor: 'pointer', fontSize: '1.25rem' }}
                                >
                                    ✕
                                </button>

                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Globe size={22} className="text-accent" /> Analyze Job Link
                                </h3>
                                <p style={{ fontSize: '0.88rem', color: 'var(--color-muted-foreground)', marginBottom: '1.5rem' }}>
                                    Paste any job posting or career portal URL. We'll intelligently detect the platform and extract details.
                                </p>

                                {!analyzing ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <input
                                            className="input"
                                            type="url"
                                            autoFocus
                                            value={analyzeUrl}
                                            onChange={e => setAnalyzeUrl(e.target.value)}
                                            placeholder="https://jobs.lever.co/company/position..."
                                            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                                            style={{ width: '100%' }}
                                        />
                                        <button
                                            className="btn"
                                            onClick={handleAnalyze}
                                            disabled={!analyzeUrl.trim()}
                                            style={{ padding: '0.75rem' }}
                                        >
                                            Start Intelligence Check
                                        </button>
                                        {analysisError && (
                                            <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.82rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                ⚠️ {analysisError}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ marginTop: '1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {[
                                                { step: 'DETECTING', label: 'Detecting Platform & Intent' },
                                                { step: 'FETCHING', label: 'Fetching Remote Content' },
                                                { step: 'PARSING', label: 'Extracting Job Attributes' },
                                                { step: 'SAVING', label: 'Finalizing Record' },
                                            ].map((s, idx) => {
                                                const steps = ['DETECTING', 'FETCHING', 'PARSING', 'SAVING'];
                                                const currentIdx = steps.indexOf(analysisStep);
                                                const stepIdx = steps.indexOf(s.step);
                                                const isDone = stepIdx < currentIdx;
                                                const isCurrent = s.step === analysisStep;
                                                const isPending = stepIdx > currentIdx;

                                                return (
                                                    <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: '1rem', opacity: isPending ? 0.4 : 1 }}>
                                                        <div style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.75rem',
                                                            background: isDone ? 'var(--color-accent)' : isCurrent ? 'var(--glass-border)' : 'transparent',
                                                            border: `2px solid ${isDone ? 'var(--color-accent)' : isCurrent ? 'var(--color-accent)' : 'var(--glass-border)'}`,
                                                            color: isDone ? '#000' : 'var(--color-foreground)',
                                                        }}>
                                                            {isDone ? '✓' : idx + 1}
                                                        </div>
                                                        <span style={{
                                                            fontSize: '0.9rem',
                                                            fontWeight: isCurrent ? 600 : 400,
                                                            color: isCurrent ? 'var(--color-accent)' : 'var(--color-foreground)'
                                                        }}>
                                                            {s.label}
                                                            {isCurrent && <span className="pulse" style={{ display: 'inline-block', marginLeft: '0.5rem', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-accent)' }} />}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div style={{ marginTop: '2rem', height: '4px', background: 'var(--glass-border)', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                background: 'var(--color-accent)',
                                                width: `${((['DETECTING', 'FETCHING', 'PARSING', 'SAVING'].indexOf(analysisStep) + 1) / 4) * 100}%`,
                                                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* Add Application Form */}
                {
                    showAddForm && (
                        <section className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Plus size={18} className="text-accent" /> Add Application
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <input
                                    className="input"
                                    value={formCompany}
                                    onChange={e => setFormCompany(e.target.value)}
                                    placeholder="Company name *"
                                />
                                <input
                                    className="input"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    placeholder="Job title *"
                                />
                                <input
                                    className="input"
                                    type="url"
                                    value={formUrl}
                                    onChange={e => setFormUrl(e.target.value)}
                                    placeholder="Job URL (optional)"
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    <button
                                        className="btn"
                                        onClick={() => {
                                            if (formCompany.trim() && formTitle.trim()) {
                                                createMut.mutate({
                                                    company: formCompany.trim(),
                                                    jobTitle: formTitle.trim(),
                                                    jobUrl: formUrl.trim() || undefined,
                                                    status: 'SAVED',
                                                });
                                            }
                                        }}
                                        disabled={!formCompany.trim() || !formTitle.trim() || createMut.isPending}
                                    >
                                        {createMut.isPending ? '⏳ Saving...' : '💾 Save'}
                                    </button>
                                    <button
                                        className="btn"
                                        onClick={() => setShowAddForm(false)}
                                        style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </section>
                    )
                }

                {/* Status Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '0.25rem',
                    marginBottom: '1.5rem',
                    overflowX: 'auto',
                    padding: '0.25rem',
                    background: 'var(--glass-bg)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--glass-border)',
                }}>
                    {TABS.map(tab => {
                        const count = tab.key === 'ALL' ? applications.length : getCounts(tab.key);
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    flex: 1,
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: 'none',
                                    background: isActive ? 'var(--color-accent)' : 'transparent',
                                    color: isActive ? '#fff' : 'var(--color-text-secondary)',
                                    fontSize: '0.8rem',
                                    fontWeight: isActive ? 600 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.35rem',
                                }}
                            >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                                {count > 0 && (
                                    <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--color-border)',
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '9999px',
                                    }}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Applications List */}
                {
                    isLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted-foreground)' }}>Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                                {activeTab === 'ALL' ? 'No applications yet' : `No ${activeTab.toLowerCase()} applications`}
                            </p>
                            <p style={{ color: 'var(--color-muted-foreground)', fontSize: '0.85rem' }}>
                                Click "Add Application" or "Analyze Link" to start tracking jobs.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {filtered.map(app => {
                                const tab = TABS.find(t => t.key === app.status);
                                const color = tab?.color || '#6b7280';

                                return (
                                    <div
                                        key={app.id}
                                        className="glass-card animate-slide-up"
                                        style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: `3px solid ${color}` }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <CompanyLogo
                                                name={app.company}
                                                domain={getDomainFromUrl(app.jobUrl)}
                                                size={40}
                                                className="glass"
                                                style={{ padding: '8px', borderRadius: '10px' }}
                                            />
                                            {/* Job Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                                    <h4 style={{ fontSize: '1.05rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {app.jobTitle}
                                                    </h4>
                                                    {app.source === 'CRAWLED' && (
                                                        <span style={{ fontSize: '0.65rem', background: 'var(--color-accent)', color: '#000', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discovery</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Briefcase size={12} /> {app.company}
                                                </div>
                                            </div>

                                            {/* Status Selector */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                                                <select
                                                    value={app.status}
                                                    onChange={e => updateStatusMut.mutate({ id: app.id, status: e.target.value })}
                                                    style={{
                                                        padding: '0.4rem 0.75rem',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--glass-border)',
                                                        background: 'var(--color-surface)',
                                                        color: 'var(--color-text-primary)',
                                                        fontSize: '0.82rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {TABS.filter(t => t.key !== 'ALL').map(t => (
                                                        <option key={t.key} value={t.key}>{t.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Lifecycle Tracking */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.75rem',
                                            background: 'rgba(0,0,0,0.2)',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            color: 'var(--color-text-tertiary)',
                                            flexWrap: 'wrap'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: app.appliedAt ? 'var(--color-info)' : 'inherit' }}>
                                                <Calendar size={12} /> Applied: {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : 'Pending'}
                                            </div>
                                            {app.interviewingAt && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-warning)' }}>
                                                    <ArrowRight size={12} /> Interview: {new Date(app.interviewingAt).toLocaleDateString()}
                                                </div>
                                            )}
                                            {app.offerAt && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-success)' }}>
                                                    <ArrowRight size={12} /> Offer: {new Date(app.offerAt).toLocaleDateString()}
                                                </div>
                                            )}
                                            {app.rejectedAt && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-danger)' }}>
                                                    <ArrowRight size={12} /> Rejected: {new Date(app.rejectedAt).toLocaleDateString()}
                                                </div>
                                            )}
                                            {app.ghostedAt && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#666' }}>
                                                    <ArrowRight size={12} /> Ghosted: {new Date(app.ghostedAt).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            {app.jobUrl && (
                                                <a
                                                    href={app.jobUrl}
                                                    target="_blank"
                                                    rel="noopener"
                                                    className="btn"
                                                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                                >
                                                    <ExternalLink size={14} /> View Posting
                                                </a>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (confirm('Remove from tracker?')) deleteMut.mutate(app.id);
                                                }}
                                                className="btn-icon"
                                                style={{
                                                    background: 'rgba(239,68,68,0.1)',
                                                    color: 'var(--color-danger)',
                                                    border: '1px solid rgba(239,68,68,0.2)',
                                                    padding: '0.4rem'
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                }
            </main >
        </div >
    );
}
