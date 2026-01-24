'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '../lib/auth';
import { ThemeProvider } from '../lib/theme';
import { GridProvider } from '../lib/grid-provider';

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <AuthProvider>
                    <GridProvider>
                        {children}
                        <Toaster
                            position="bottom-right"
                            toastOptions={{
                                style: {
                                    background: 'var(--color-background)',
                                    color: 'var(--color-foreground)',
                                    border: '1px solid var(--color-border)',
                                },
                            }}
                        />
                    </GridProvider>
                </AuthProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
