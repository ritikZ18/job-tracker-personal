'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useTheme } from '../../../lib/theme';
import type { ColDef, CellValueChangedEvent, ICellRendererParams } from 'ag-grid-community';

const STATUS_OPTIONS = ['SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED', 'GHOSTED'] as const;

// Icons
const Icons = {
    sun: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
    ),
    moon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
    ),
    plus: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M12 4v16m-8-8h16" />
        </svg>
    ),
    link: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
    ),
    trash: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    ),
    search: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="m21 21-4.35-4.35" />
        </svg>
    ),
    external: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6m4-3h6v6m-11 5L21 3" />
        </svg>
    ),
};

function StatusCell({ value }: { value: string }) {
    return (
        <div className={`status-cell status-cell-${value.toLowerCase()}`}>
            {value}
        </div>
    );
}

function StatusPill({ value }: { value: string }) {
    return <span className={`pill pill-${value.toLowerCase()}`}>{value}</span>;
}

function StatusEditor({ value, onValueChange, stopEditing }: any) {
    return (
        <select
            value={value}
            onChange={(e) => {
                onValueChange(e.target.value);
                stopEditing();
            }}
            className="w-full h-full text-sm bg-transparent border-none outline-none cursor-pointer"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
            autoFocus
        >
            {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
            ))}
        </select>
    );
}

function DateEditor({ value, onValueChange, stopEditing }: any) {
    const [date, setDate] = useState<Date>(() => {
        return value ? new Date(value) : new Date();
    });
    // Used for navigation
    const [viewDate, setViewDate] = useState<Date>(() => {
        return value ? new Date(value) : new Date();
    });

    // Calendar logic
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

    const changeMonth = (offset: number) => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
    };

    const handleSelect = (day: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        onValueChange(newDate.toISOString());
        stopEditing();
    };

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                stopEditing();
            }
        };

        // Use mousedown to capture the event before other click handlers might interfere
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [stopEditing]);

    return (
        <div
            ref={ref}
            className="absolute top-0 left-0 z-50 p-4 rounded-xl shadow-2xl backdrop-blur-xl border border-white/20"
            style={{
                backgroundColor: 'rgba(20, 20, 22, 0.85)',
                color: '#fff',
                width: '250px',
                marginTop: '25px'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={() => changeMonth(-1)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="font-semibold text-lg">
                    {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                </div>
                <button
                    onClick={() => changeMonth(1)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-xs text-white/50 font-medium uppercase">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const d = i + 1;
                    const isSelected = date.getDate() === d && date.getMonth() === viewDate.getMonth() && date.getFullYear() === viewDate.getFullYear();
                    const isToday = new Date().getDate() === d && new Date().getMonth() === viewDate.getMonth() && new Date().getFullYear() === viewDate.getFullYear();

                    return (
                        <button
                            key={d}
                            onClick={() => handleSelect(d)}
                            className={`
                                w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all
                                ${isSelected ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' : 'hover:bg-white/10'}
                                ${isToday && !isSelected ? 'border border-blue-400 text-blue-400' : ''}
                            `}
                        >
                            {d}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const queryClient = useQueryClient();
    const gridRef = useRef<AgGridReact>(null);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);

    // Fetch applications
    const { data: applications = [], isLoading, error } = useQuery({
        queryKey: ['applications', statusFilter, searchQuery],
        queryFn: () => api.getApplications({ status: statusFilter || undefined, search: searchQuery || undefined }),
    });

    if (error) {
        toast.error('Failed to load applications');
    }

    // KPI calculations
    const kpis = useMemo(() => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        return {
            thisWeek: applications.filter((a: any) => new Date(a.createdAt) >= weekAgo).length,
            inProgress: applications.filter((a: any) => ['APPLIED', 'INTERVIEWING'].includes(a.status)).length,
            interviews: applications.filter((a: any) => a.status === 'INTERVIEWING').length,
            offers: applications.filter((a: any) => a.status === 'OFFER').length,
            rejected: applications.filter((a: any) => a.status === 'REJECTED').length,
        };
    }, [applications]);

    // Mutations with toast feedback
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.updateApplication(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            toast.success('Saved.');
        },
        onError: (err) => {
            toast.error('Failed to update');
            api.logError('Update application failed', { error: String(err) });
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => api.updateStatus(id, status),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            toast.success(variables.status === 'REJECTED' ? 'Marked as rejected.' : 'Status updated.');
        },
        onError: (err) => {
            toast.error('Failed to update status');
            api.logError('Update status failed', { error: String(err) });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteApplication(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            toast.success('Deleted.');
        },
        onError: (err) => {
            toast.error('Failed to delete');
            api.logError('Delete application failed', { error: String(err) });
        },
    });

    // Column definitions
    const columnDefs = useMemo<ColDef[]>(() => [
        {
            headerName: '#',
            width: 60,
            valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
            cellClass: 'text-tertiary text-center',
            sortable: false,
            filter: false,
        },
        {
            field: 'company',
            headerName: 'COMPANY',
            editable: true,
            flex: 1,
            minWidth: 100,
        },
        {
            field: 'jobTitle',
            headerName: 'ROLE',
            editable: true,
            flex: 1.2,
            minWidth: 160,
        },
        {
            field: 'jobDescription',
            headerName: 'REQUIREMENTS',
            editable: true,
            width: 220,
            cellRenderer: (params: ICellRendererParams) => {
                const desc = params.value as string | null;
                if (!desc) return <span className="text-tertiary">—</span>;
                const truncated = desc.length > 30 ? desc.substring(0, 30) + '...' : desc;
                return (
                    <span
                        className="text-secondary text-xs cursor-help truncate block"
                        title={desc}
                    >
                        {truncated}
                    </span>
                );
            },
        },
        {
            field: 'status',
            headerName: 'STATUS',
            cellRenderer: (params: ICellRendererParams) => <StatusCell value={params.value} />,
            editable: true,
            cellEditor: StatusEditor,
            width: 140,
            cellStyle: { padding: '4px' },
        },
        {
            field: 'appliedAt',
            headerName: 'APPLIED',
            valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : '—',
            width: 140,
            editable: true,
            cellEditor: DateEditor,
            cellEditorPopup: true,
        },
        {
            field: 'rejectedAt',
            headerName: 'REJECTED',
            valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : '—',
            width: 140,
            editable: true,
            cellEditor: DateEditor,
            cellEditorPopup: true,
        },
        {
            field: 'jobUrl',
            headerName: '',
            width: 40,
            cellRenderer: (params: ICellRendererParams) =>
                params.value ? (
                    <a
                        href={params.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-tertiary hover:text-accent transition-colors"
                        title="Open job posting"
                    >
                        {Icons.external}
                    </a>
                ) : null,
            sortable: false,
            filter: false,
        },
        {
            headerName: '',
            width: 40,
            cellRenderer: (params: ICellRendererParams) => (
                <button
                    onClick={() => deleteMutation.mutate(params.data.id)}
                    className="text-tertiary hover:text-[var(--status-rejected-text)] transition-colors p-1"
                    title="Delete"
                >
                    {Icons.trash}
                </button>
            ),
            sortable: false,
            filter: false,
        },
    ], [deleteMutation]);

    const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
        const { data, colDef, newValue, oldValue } = event;
        if (newValue === oldValue) return;

        if (colDef.field === 'status') {
            statusMutation.mutate({ id: data.id, status: newValue });
        } else if (colDef.field) {
            updateMutation.mutate({ id: data.id, data: { [colDef.field]: newValue } });
        }
    }, [updateMutation, statusMutation]);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        filter: true,
        resizable: true,
    }), []);

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--app-bg)' }}>
            {/* Top Bar */}
            <header className="bg-surface border-b" style={{ borderColor: 'var(--border-soft)' }}>
                <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <h1 className="text-lg font-semibold tracking-tight">Job Tracker</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary">
                                {Icons.search}
                            </span>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input pl-10 w-56"
                            />
                        </div>

                        {/* Actions */}
                        <button onClick={() => setShowAnalyzeModal(true)} className="btn btn-secondary btn-sm">
                            {Icons.link}
                            <span>Analyze link</span>
                        </button>
                        <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
                            {Icons.plus}
                            <span>Add application</span>
                        </button>

                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            className="btn btn-icon btn-ghost"
                            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                        >
                            {theme === 'light' ? Icons.moon : Icons.sun}
                        </button>

                        {/* User */}
                        <div className="flex items-center gap-3 pl-3 ml-1 border-l" style={{ borderColor: 'var(--border-soft)' }}>
                            <span className="text-sm text-secondary">{user?.email}</span>
                            <button onClick={logout} className="btn btn-ghost btn-sm">Sign out</button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-2xl mx-auto px-6 py-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-5 gap-4 mb-6">
                    <div className="kpi-card">
                        <div className="kpi-value">{kpis.thisWeek}</div>
                        <div className="kpi-label">This week</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-value">{kpis.inProgress}</div>
                        <div className="kpi-label">In progress</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-value">{kpis.interviews}</div>
                        <div className="kpi-label">Interviews</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-value" style={{ color: 'var(--status-offer-text)' }}>{kpis.offers}</div>
                        <div className="kpi-label">Offers</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-value" style={{ color: 'var(--status-rejected-text)' }}>{kpis.rejected}</div>
                        <div className="kpi-label">Rejected</div>
                    </div>
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-2 mb-4">
                    {['', ...STATUS_OPTIONS].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={statusFilter === status ? 'chip chip-active' : 'chip'}
                        >
                            {status || 'All'}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                <div className="ag-theme-tesla" style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
                    {isLoading ? (
                        <div className="card p-4 h-full">
                            <div className="space-y-3">
                                {[...Array(10)].map((_, i) => (
                                    <div key={i} className="skeleton h-12 w-full" />
                                ))}
                            </div>
                        </div>
                    ) : applications.length === 0 ? (
                        <div className="card h-full">
                            <div className="empty-state h-full">
                                <div className="empty-state-icon">{Icons.plus}</div>
                                <p className="text-secondary mb-4">No applications yet</p>
                                <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                                    Add your first application
                                </button>
                            </div>
                        </div>
                    ) : (
                        <AgGridReact
                            ref={gridRef}
                            rowData={applications}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            onCellValueChanged={onCellValueChanged}
                            animateRows
                            rowSelection="multiple"
                            suppressRowClickSelection
                            getRowId={(params) => params.data.id}
                            enterNavigatesVerticallyAfterEdit
                            singleClickEdit
                            domLayout="normal"
                        />
                    )}
                </div>
            </main>

            {showAddModal && <AddApplicationModal onClose={() => setShowAddModal(false)} />}
            {showAnalyzeModal && <AnalyzeUrlModal onClose={() => setShowAnalyzeModal(false)} />}
        </div>
    );
}

// Add Application Modal
function AddApplicationModal({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        company: '',
        jobTitle: '',
        jobUrl: '',
        status: 'SAVED' as string,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            await api.createApplication(formData);
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            toast.success('Application added.');
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to add application';
            setError(message);
            toast.error(message);
            api.logError('Create application failed', { error: String(err) });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-semibold mb-6">Add application</h2>

                {error && (
                    <div className="p-3 mb-4 rounded-md text-sm" style={{ backgroundColor: 'var(--status-rejected-bg)', color: 'var(--status-rejected-text)' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Company</label>
                        <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => setFormData((f) => ({ ...f, company: e.target.value }))}
                            className="input"
                            placeholder="e.g. Google"
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Role</label>
                        <input
                            type="text"
                            value={formData.jobTitle}
                            onChange={(e) => setFormData((f) => ({ ...f, jobTitle: e.target.value }))}
                            className="input"
                            placeholder="e.g. Software Engineer"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Job URL <span className="text-tertiary font-normal">(optional)</span></label>
                        <input
                            type="url"
                            value={formData.jobUrl}
                            onChange={(e) => setFormData((f) => ({ ...f, jobUrl: e.target.value }))}
                            className="input"
                            placeholder="https://..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))}
                            className="input"
                        >
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
                            {isSubmitting ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Analyze URL Modal
function AnalyzeUrlModal({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const [jobUrl, setJobUrl] = useState('');
    const [status, setStatus] = useState<'idle' | 'analyzing' | 'done' | 'error'>('idle');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');

    const startAnalysis = async () => {
        if (!jobUrl) return;
        setStatus('analyzing');
        setError('');

        try {
            const resp = await api.analyzeUrl(jobUrl);
            pollAnalysis(resp.jobAnalysisId);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to start analysis';
            setError(message);
            toast.error(message);
            setStatus('error');
            api.logError('Analyze URL failed', { error: String(err) });
        }
    };

    const pollAnalysis = async (id: string) => {
        let attempts = 0;
        const maxAttempts = 30;

        const poll = async () => {
            if (attempts >= maxAttempts) {
                setError('Analysis timed out');
                toast.error('Analysis timed out');
                setStatus('error');
                return;
            }

            try {
                const analysis = await api.getJobAnalysis(id);
                if (analysis.status === 'DONE') {
                    setResult(analysis.result);
                    setStatus('done');
                    toast.success('Analysis complete.');
                } else if (analysis.status === 'FAILED') {
                    setError(analysis.error || 'Analysis failed');
                    toast.error(analysis.error || 'Analysis failed');
                    setStatus('error');
                } else {
                    attempts++;
                    setTimeout(poll, 2000);
                }
            } catch (err) {
                setError('Failed to check status');
                toast.error('Failed to check status');
                setStatus('error');
            }
        };

        poll();
    };

    const createFromResult = async () => {
        if (!result) return;
        try {
            await api.createApplication({
                company: result.company || 'Unknown',
                jobTitle: result.title || 'Unknown',
                jobUrl,
                jobDescription: result.description,
                source: 'ANALYZED',
            });
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            toast.success('Application added.');
            onClose();
        } catch (err) {
            toast.error('Failed to create application');
            api.logError('Create from analysis failed', { error: String(err) });
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-semibold mb-6">Analyze link</h2>

                {status === 'idle' && (
                    <>
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">Job Posting URL</label>
                            <input
                                type="url"
                                value={jobUrl}
                                onChange={(e) => setJobUrl(e.target.value)}
                                className="input"
                                placeholder="Paste job URL here..."
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
                                Cancel
                            </button>
                            <button onClick={startAnalysis} disabled={!jobUrl} className="btn btn-primary flex-1">
                                Analyze
                            </button>
                        </div>
                    </>
                )}

                {status === 'analyzing' && (
                    <div className="text-center py-12">
                        <div className="spinner mx-auto mb-4" />
                        <p className="text-secondary">Analyzing job posting...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center py-8">
                        <p className="mb-6" style={{ color: 'var(--status-rejected-text)' }}>{error}</p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                            <button onClick={() => setStatus('idle')} className="btn btn-primary">Try again</button>
                        </div>
                    </div>
                )}

                {status === 'done' && result && (
                    <>
                        <div className="space-y-4 mb-6">
                            <div>
                                <div className="detail-label">Role</div>
                                <div className="detail-value text-lg">{result.title || '—'}</div>
                            </div>
                            <div>
                                <div className="detail-label">Company</div>
                                <div className="detail-value text-lg">{result.company || '—'}</div>
                            </div>
                            {result.description && (
                                <div>
                                    <div className="detail-label">Description</div>
                                    <p className="text-sm text-secondary mt-1 line-clamp-4">{result.description}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
                            <button onClick={createFromResult} className="btn btn-primary flex-1">Add application</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
