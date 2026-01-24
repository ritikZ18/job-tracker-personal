'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';

export default function AdminLayout({ children }: { children: ReactNode }) {
    const { user, isLoading, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/login');
            } else if (user.role !== 'ADMIN') {
                router.push('/dashboard');
            }
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse text-[var(--color-muted-foreground)]">Loading...</div>
            </div>
        );
    }

    if (!user || user.role !== 'ADMIN') {
        return null;
    }

    return (
        <div className="min-h-screen bg-[var(--color-muted)]">
            {/* Admin Header */}
            <header className="bg-[var(--color-background)] border-b border-[var(--color-border)] px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-semibold">Admin Console</h1>
                        <nav className="flex gap-4">
                            <a href="/admin/users" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
                                Users
                            </a>
                            <a href="/admin/applications" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
                                Applications
                            </a>
                            <a href="/admin/jobs" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
                                Job Queue
                            </a>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-[var(--color-muted-foreground)]">{user?.email}</span>
                        <button onClick={logout} className="btn btn-ghost text-sm">
                            Sign out
                        </button>
                    </div>
                </div>
            </header>
            {children}
        </div>
    );
}
