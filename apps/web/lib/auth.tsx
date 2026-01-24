'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

interface User {
    id: string;
    email: string;
    role: 'USER' | 'ADMIN';
    createdAt: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check if user is logged in on mount
        api
            .getMe()
            .then((data) => setUser(data.user))
            .catch(() => setUser(null))
            .finally(() => setIsLoading(false));
    }, []);

    const login = async (email: string, password: string) => {
        const data = await api.login(email, password);
        setUser(data.user);

        // Redirect based on role
        if (data.user.role === 'ADMIN') {
            router.push('/admin/users');
        } else {
            router.push('/dashboard');
        }
    };

    const register = async (email: string, password: string) => {
        const data = await api.register(email, password);
        setUser(data.user);
        router.push('/dashboard');
    };

    const logout = async () => {
        await api.logout();
        setUser(null);
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
