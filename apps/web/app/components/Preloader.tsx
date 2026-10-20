'use client';

import { useState, useEffect } from 'react';

export function Preloader() {
    const [visible, setVisible] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const hasLoaded = sessionStorage.getItem('hasLoaded');
        if (!hasLoaded) {
            setVisible(true);
            const timer = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(timer);
                        setTimeout(() => {
                            setVisible(false);
                            sessionStorage.setItem('hasLoaded', 'true');
                        }, 500);
                        return 100;
                    }
                    return prev + 5;
                });
            }, 60);
        }
    }, []);

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'var(--color-background)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.8s ease-out',
        }}>
            <div className="preloader-logo" style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.05em' }}>
                    <span style={{ color: 'var(--color-accent)' }}>Career</span>Crawl
                </h1>
            </div>

            <div style={{
                width: '240px',
                height: '4px',
                background: 'var(--glass-border)',
                borderRadius: '2px',
                overflow: 'hidden',
                position: 'relative',
            }}>
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    background: 'var(--color-accent)',
                    width: `${progress}%`,
                    transition: 'width 0.1s linear',
                    boxShadow: '0 0 15px var(--color-accent-glow)',
                }} />
            </div>

            <div style={{
                marginTop: '1.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
            }}>
                Grounded Discovery Engine... {progress}%
            </div>
        </div>
    );
}
