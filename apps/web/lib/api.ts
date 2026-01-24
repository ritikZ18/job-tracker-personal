const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
    skipAuth?: boolean;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
        const { skipAuth, ...fetchOptions } = options;

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
        };

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...fetchOptions,
            headers,
            credentials: 'include', // For cookies
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        if (response.status === 204) {
            return undefined as T;
        }

        return response.json();
    }

    // Auth
    async login(email: string, password: string) {
        return this.request<{ user: any; token?: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async register(email: string, password: string) {
        return this.request<{ user: any; token?: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async logout() {
        return this.request<{ message: string }>('/auth/logout', { method: 'POST' });
    }

    async getMe() {
        return this.request<{ user: any }>('/auth/me');
    }

    // Applications
    async getApplications(params?: { status?: string; search?: string }) {
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.set('status', params.status);
        if (params?.search) searchParams.set('search', params.search);
        const query = searchParams.toString();
        return this.request<any[]>(`/applications${query ? `?${query}` : ''}`);
    }

    async createApplication(data: any) {
        return this.request<any>('/applications', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateApplication(id: string, data: any) {
        return this.request<any>(`/applications/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async updateStatus(id: string, status: string) {
        return this.request<any>(`/applications/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    }

    async deleteApplication(id: string) {
        return this.request<void>(`/applications/${id}`, { method: 'DELETE' });
    }

    async analyzeUrl(jobUrl: string) {
        return this.request<{ jobAnalysisId: string; status: string }>('/applications/analyze', {
            method: 'POST',
            body: JSON.stringify({ jobUrl }),
        });
    }

    // Job Analyses
    async getJobAnalysis(id: string) {
        return this.request<any>(`/job-analyses/${id}`);
    }

    // Views
    async getViews() {
        return this.request<any[]>('/views');
    }

    async createView(data: { name: string; config: any }) {
        return this.request<any>('/views', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateView(id: string, data: { name: string; config: any }) {
        return this.request<any>(`/views/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteView(id: string) {
        return this.request<void>(`/views/${id}`, { method: 'DELETE' });
    }

    // Observability
    async getStats() {
        return this.request<any>('/observability/stats');
    }

    async logError(message: string, context?: any) {
        return this.request<{ logged: boolean }>('/observability/log', {
            method: 'POST',
            body: JSON.stringify({ level: 'error', message, context }),
        }).catch(() => { }); // Don't throw on logging failures
    }
}

export const api = new ApiClient(API_BASE);
