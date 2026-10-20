'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase, isSupabaseConfigured } from './supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface UserProfile {
    id: string;
    email: string;
    role: string;
    displayName: string | null;
    avatarUrl: string | null;
}

interface AuthContextType {
    user: UserProfile | null;
    session: Session | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signInWithProvider: (provider: 'google' | 'github') => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    async function fetchUserProfile(sess: Session): Promise<UserProfile | null> {
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/me`,
                { headers: { Authorization: `Bearer ${sess.access_token}` } }
            );
            if (res.ok) return res.json();
        } catch { /* ignore */ }
        return null;
    }

    useEffect(() => {
        // DEV MODE: no Supabase configured, use dev user
        if (!isSupabaseConfigured) {
            setUser({
                id: 'dev-user',
                email: 'dev@careercrawl.local',
                role: 'ADMIN',
                displayName: 'Dev User',
                avatarUrl: null,
            });
            setIsLoading(false);
            return;
        }

        // PRODUCTION: use Supabase auth
        const supabase = getSupabase();
        if (!supabase) {
            setIsLoading(false);
            return;
        }

        supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
            setSession(initialSession);
            if (initialSession) {
                const profile = await fetchUserProfile(initialSession);
                setUser(profile);
            }
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, newSession) => {
                setSession(newSession);
                if (newSession) {
                    const profile = await fetchUserProfile(newSession);
                    setUser(profile);
                } else {
                    setUser(null);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Auth not configured');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    };

    const signUp = async (email: string, password: string) => {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Auth not configured');
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
    };

    const signInWithProvider = async (provider: 'google' | 'github') => {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Auth not configured');
        const { error } = await supabase.auth.signInWithOAuth({ provider });
        if (error) throw error;
    };

    const signOut = async () => {
        const supabase = getSupabase();
        if (supabase) {
            await supabase.auth.signOut();
        }
        setUser(null);
        setSession(null);
        router.push('/login');
    };

    return (
        <AuthContext.Provider
            value={{ user, session, isLoading, signIn, signUp, signInWithProvider, signOut }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}
