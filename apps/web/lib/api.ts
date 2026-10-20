import { getSupabase, isSupabaseConfigured } from './supabase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetcherOptions {
    method?: string;
    body?: unknown;
    skipAuth?: boolean;
}

export async function fetcher<T = unknown>(
    endpoint: string,
    options: FetcherOptions = {}
): Promise<T> {
    const { method = 'GET', body, skipAuth = false } = options;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Attach Supabase JWT token if available
    if (!skipAuth && isSupabaseConfigured) {
        try {
            const supabase = getSupabase();
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }
            }
        } catch {
            // Supabase not available, continue without auth
        }
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || 'Request failed');
    }

    if (res.status === 204) return undefined as T;
    return res.json();
}
