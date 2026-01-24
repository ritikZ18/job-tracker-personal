'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth';
import { useTheme } from '../../../lib/theme';

const loginSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const { login } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginForm) => {
        setError('');
        setIsSubmitting(true);
        try {
            await login(data.email, data.password);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--app-bg)' }}>
            {/* Theme toggle */}
            <button
                onClick={toggleTheme}
                className="absolute top-4 right-4 btn btn-icon btn-ghost"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
                {theme === 'light' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                    </svg>
                )}
            </button>

            <div className="card w-full max-w-sm p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                    <p className="text-secondary mt-2">Sign in to continue</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {error && (
                        <div
                            className="p-3 rounded-md text-sm"
                            style={{ backgroundColor: 'var(--status-rejected-bg)', color: 'var(--status-rejected-text)' }}
                        >
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <input
                            {...register('email')}
                            type="email"
                            className="input"
                            placeholder="you@example.com"
                            autoFocus
                        />
                        {errors.email && (
                            <p className="text-sm mt-1" style={{ color: 'var(--status-rejected-text)' }}>{errors.email.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Password</label>
                        <input
                            {...register('password')}
                            type="password"
                            className="input"
                            placeholder="••••••••"
                        />
                        {errors.password && (
                            <p className="text-sm mt-1" style={{ color: 'var(--status-rejected-text)' }}>{errors.password.message}</p>
                        )}
                    </div>

                    <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full mt-6">
                        {isSubmitting ? 'Signing in...' : 'Continue'}
                    </button>
                </form>

                <p className="text-center text-sm text-secondary mt-6">
                    Don't have an account?{' '}
                    <Link href="/register" className="text-accent hover:underline font-medium">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    );
}
