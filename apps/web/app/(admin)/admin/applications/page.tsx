'use client';

import { useQuery } from '@tanstack/react-query';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { fetcher } from '../../../../lib/api';
import Link from 'next/link';
import { Loader2, LayoutDashboard, Terminal as TerminalIcon, Globe } from 'lucide-react';
import { CompanyLogo } from '../../../components/CompanyLogo';

interface AdminApplication {
    id: string;
    company: string;
    jobTitle: string;
    status: string;
    createdAt: string;
    userEmail: string;
}

export default function AdminApplicationsPage() {
    const { data: applications = [], isLoading } = useQuery({
        queryKey: ['admin-applications'],
        queryFn: () => fetcher<AdminApplication[]>('/applications/admin/all'),
    });

    const columnDefs: ColDef<AdminApplication>[] = [
        { field: 'company', headerName: 'Company', flex: 1, filter: true },
        { field: 'jobTitle', headerName: 'Job Title', flex: 1.5, filter: true },
        {
            field: 'status',
            headerName: 'Status',
            width: 140,
            cellRenderer: (params: any) => {
                const status = params.value || 'SAVED';
                return (
                    <span className={`status-pill status-${status.toLowerCase()}`}>
                        <span className="status-dot"></span>
                        {status}
                    </span>
                );
            }
        },
        {
            field: 'userEmail',
            headerName: 'User',
            flex: 1,
            filter: true
        },
        {
            field: 'createdAt',
            headerName: 'Applied On',
            width: 150,
            valueFormatter: (params) => new Date(params.value).toLocaleDateString()
        },
    ];

    return (
        <div className="p-6 h-full flex flex-col gap-4">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Global Applications</h1>
                    <p className="text-muted-foreground text-sm">Monitor all job applications across the platform</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/dashboard" className="btn btn-secondary btn-sm">Dashboard</Link>
                    <Link href="/admin/crawls" className="btn btn-secondary btn-sm">System Logs</Link>
                </div>
            </header>

            <div className="flex-1 min-h-[500px] glass-card p-0 overflow-hidden relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-accent" size={24} />
                            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Synchronizing...</span>
                        </div>
                    </div>
                ) : null}

                <div className="ag-theme-custom w-full h-full" style={{ height: '100%', width: '100%' }}>
                    <AgGridReact
                        rowData={applications}
                        columnDefs={columnDefs}
                        pagination={true}
                        paginationPageSize={20}
                        defaultColDef={{
                            sortable: true,
                            resizable: true,
                        }}
                    />
                </div>
            </div>

            <style jsx global>{`
                .ag-theme-alpine-dark {
                    --ag-background-color: transparent !important;
                    --ag-header-background-color: rgba(255, 255, 255, 0.03) !important;
                    --ag-odd-row-background-color: transparent !important;
                    --ag-border-color: var(--glass-border) !important;
                    --ag-row-hover-color: rgba(255, 255, 255, 0.05) !important;
                    --ag-foreground-color: var(--color-text-primary) !important;
                    --ag-header-foreground-color: var(--color-text-secondary) !important;
                    --ag-data-color: var(--color-text-primary) !important;
                    --ag-font-family: var(--font-sans) !important;
                }
                .ag-root-wrapper {
                    border: none !important;
                    background: transparent !important;
                }
            `}</style>
        </div>
    );
}
