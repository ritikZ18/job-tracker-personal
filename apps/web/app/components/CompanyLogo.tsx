'use client';

interface CompanyLogoProps {
    name: string;
    logoUrl?: string | null;
    domain?: string; // Optional explicit domain for favicon
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

export function CompanyLogo({ name, logoUrl, domain, size = 24, className = '', style = {} }: CompanyLogoProps) {
    if (logoUrl) {
        return (
            <div className={className} style={{ ...style, width: size, height: size, borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1px solid var(--glass-border)' }}>
                <img src={logoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
        );
    }

    const n = name.toLowerCase();

    // Premium SVGs for top companies (High Fidelity)
    if (n.includes('tesla')) {
        return (
            <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 4.5V6L12 8.5L22 6V4.5L12 2ZM2 9V21L12 22L22 21V9L12 11L2 9Z" />
                </svg>
            </div>
        );
    }
    if (n.includes('apple')) {
        return (
            <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.08-.46-2.07-.48-3.19 0-1.25.55-1.9 balance 2.05-.12.43-.88.22-1.78.36-2.73zM12 2.2c1.3.05 2.6.76 3.4 1.7 1.25 1.5 1.15 3.3.05 4.5-1.3 1.4-3.1 1.2-4.1.1-1.2-1.3-1.1-3.1-.05-4.5.8-.9 1.9-1.3 2.7-1.3z" />
                    <path d="M12 22c-3.1 0-5.7-2.3-6.5-5.3-.8-3.1.5-6.4 3.1-8.1 1.3-.8 2.8-1.2 4.4-1.2 1.9 0 3.7.6 5.1 1.8 2.6 2.1 3.4 5.6 2 8.5-1.1 2.5-3.5 4.3-6.4 4.3h-1.7zm0-13c-1.3 0-2.5.3-3.6.9-2.1 1.4-3.1 4-2.5 6.5.6 2.4 2.8 4.3 5.3 4.3h.8l.8-.2c2.4 0 4.4-1.5 5.3-3.6.1-.2.2-.4.3-.6l1-2.4c0-2.3-.9-4.3-2.6-5.8-1.1-1-2.6-1.5-4.1-1.5-.3 0-.6.1-1 .1-.5 0-.8.1-1.1.2.2.1.4.1.6.1z" />
                </svg>
            </div>
        );
    }
    if (n.includes('google')) {
        return (
            <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
            </div>
        );
    }
    if (n.includes('meta') || n.includes('facebook')) {
        return (
            <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={size} height={size} viewBox="0 0 24 24" fill="#0668E1">
                    <path d="M16.14 11.23a3.52 3.52 0 1 0-3.52 3.52 3.52 3.52 0 0 0 3.52-3.52zm5.72 0a2.82 2.82 0 0 0-5.63 0 2.82 2.82 0 0 0 5.63 0zM12.63 3.4a7.84 7.84 0 0 1 7.83 7.83 7.84 7.84 0 0 1-7.83 7.83 7.84 7.84 0 0 1-7.83-7.83A7.84 7.84 0 0 1 12.63 3.4z" />
                </svg>
            </div>
        );
    }
    if (n.includes('amazon')) {
        return (
            <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.4 12.44c.4-.23.6-.54.6-.98 0-.82-.66-1.5-1.5-1.5s-1.5.68-1.5 1.5c0 .44.2.75.6.98.66.38 1.15.38 1.8 0zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.2 14.86c-1.92 1.34-4.5 2.14-7.2 2.14-3.1 0-5.94-1.04-8-2.66-.2-.16-.25-.33-.08-.4l.66-.3c.18-.08.38-.04.54.12 1.9 1.42 4.4 2.34 7.15 2.34 2.45 0 4.8-.75 6.6-2.02.16-.1.38-.08.54.08l.6.6c.14.12.14.3-.01.4z" />
                </svg>
            </div>
        );
    }

    // Dynamic Favicon Fetching for 100+ Companies
    if (domain) {
        return (
            <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                    alt={name}
                    style={{ width: size, height: size, objectFit: 'contain' }}
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.setAttribute('style', 'display: block');
                    }}
                />
                {/* Fallback Building Icon */}
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'none' }}>
                    <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
                    <path d="M9 22v-4h6v4" />
                    <path d="M8 6h.01" />
                    <path d="M16 6h.01" />
                </svg>
            </div>
        );
    }

    // Fallback building icon
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01" />
            <path d="M16 6h.01" />
            <path d="M8 10h.01" />
            <path d="M16 10h.01" />
            <path d="M8 14h.01" />
            <path d="M16 14h.01" />
        </svg>
    );
}
