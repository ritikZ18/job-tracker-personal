'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../../../lib/api';
import Link from 'next/link';

interface Application {
    id: string;
    company: string;
    jobTitle: string;
    jobUrl: string | null;
    status: string;
    notes: string | null;
    source: string;
    appliedAt: string | null;
    createdAt: string;
}

const COLUMNS = [
    { key: 'SAVED', label: '📌 Saved', color: '#6b7280' },
    { key: 'APPLIED', label: '📤 Applied', color: '#3b82f6' },
    { key: 'INTERVIEWING', label: '🎙️ Interviewing', color: '#f59e0b' },
    { key: 'OFFER', label: '✅ Offer', color: '#22c55e' },
    { key: 'REJECTED', label: '❌ Rejected', color: '#ef4444' },
];

export default function MyJobsPage() {
    const queryClient = useQueryClient();
    const [draggedId, setDraggedId] = useState<string | null>(null);

    const { data: applications = [], isLoading } = useQuery({
        queryKey: ['applications'],
        queryFn: () => fetcher<Application[]>('/applications'),
    });

    const updateStatusMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            fetcher(`/applications/${id}/status`, {
                method: 'PATCH',
                body: { status },
            }),
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ['applications'] });
            const prev = queryClient.getQueryData<Application[]>(['applications']);
            queryClient.setQueryData<Application[]>(['applications'], old =>
                (old || []).map(a => a.id === id ? { ...a, status } : a)
            );
            return { prev };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(['applications'], ctx.prev);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => fetcher(`/applications/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    });

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        if (draggedId) {
            updateStatusMut.mutate({ id: draggedId, status });
            setDraggedId(null);
        }
    };

    const getColumnApps = (status: string) =>
        applications.filter(a => a.status === status);

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

            <main style={{ padding: '2rem 1.5rem', overflowX: 'auto' }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted-foreground)' }}>Loading applications...</div>
                ) : (
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        minWidth: 'max-content',
                        paddingBottom: '1rem',
                    }}>
                        {COLUMNS.map(col => {
                            const colApps = getColumnApps(col.key);

                            return (
                                <div
                                    key={col.key}
                                    onDragOver={handleDragOver}
                                    onDrop={e => handleDrop(e, col.key)}
                                    style={{
                                        width: '280px',
                                        flexShrink: 0,
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                >
                                    {/* Column Header */}
                                    <div style={{
                                        padding: '0.6rem 0.8rem',
                                        borderRadius: '0.75rem 0.75rem 0 0',
                                        background: `${col.color}18`,
                                        borderBottom: `2px solid ${col.color}`,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{col.label}</span>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            background: `${col.color}30`,
                                            color: col.color,
                                            padding: '0.15rem 0.5rem',
                                            borderRadius: '9999px',
                                        }}>
                                            {colApps.length}
                                        </span>
                                    </div>

                                    {/* Cards */}
                                    <div style={{
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem',
                                        padding: '0.5rem',
                                        minHeight: '200px',
                                        background: 'var(--glass-bg, rgba(255,255,255,0.03))',
                                        borderRadius: '0 0 0.75rem 0.75rem',
                                        border: '1px solid var(--glass-border)',
                                        borderTop: 'none',
                                    }}>
                                        {colApps.length === 0 ? (
                                            <div style={{
                                                textAlign: 'center',
                                                padding: '2rem 0.5rem',
                                                color: 'var(--color-muted-foreground)',
                                                fontSize: '0.8rem',
                                                border: '2px dashed var(--glass-border)',
                                                borderRadius: '0.5rem',
                                            }}>
                                                Drop jobs here
                                            </div>
                                        ) : (
                                            colApps.map(app => (
                                                <div
                                                    key={app.id}
                                                    className="glass-card"
                                                    draggable
                                                    onDragStart={e => handleDragStart(e, app.id)}
                                                    style={{
                                                        padding: '0.8rem',
                                                        cursor: 'grab',
                                                        transition: 'transform 0.15s, box-shadow 0.15s',
                                                        borderLeft: `3px solid ${col.color}`,
                                                    }}
                                                    onMouseEnter={e => {
                                                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                                                        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${col.color}20`;
                                                    }}
                                                    onMouseLeave={e => {
                                                        (e.currentTarget as HTMLElement).style.transform = '';
                                                        (e.currentTarget as HTMLElement).style.boxShadow = '';
                                                    }}
                                                >
                                                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', lineHeight: 1.3 }}>
                                                        {app.jobTitle}
                                                    </h4>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-foreground)', marginBottom: '0.5rem' }}>
                                                        {app.company}
                                                    </div>
                                                    {app.source === 'CRAWLED' && (
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            background: 'var(--color-accent)',
                                                            color: '#000',
                                                            padding: '0.1rem 0.4rem',
                                                            borderRadius: '4px',
                                                            fontWeight: 600,
                                                            marginBottom: '0.4rem',
                                                            display: 'inline-block',
                                                        }}>
                                                            CRAWLED
                                                        </span>
                                                    )}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-muted-foreground)' }}>
                                                        <span>{new Date(app.createdAt).toLocaleDateString()}</span>
                                                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                            {app.jobUrl && (
                                                                <a href={app.jobUrl} target="_blank" rel="noopener" style={{ color: 'var(--color-accent)' }}>🔗</a>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('Remove from tracker?')) {
                                                                        deleteMut.mutate(app.id);
                                                                    }
                                                                }}
                                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.72rem' }}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
