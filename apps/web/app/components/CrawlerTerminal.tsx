'use client';

import { useEffect, useRef } from 'react';

interface CrawlerTerminalProps {
    logs: string[];
    isLive?: boolean;
    isOpen: boolean;
    onToggle: () => void;
}

export function CrawlerTerminal({ logs, isLive, isOpen, onToggle }: CrawlerTerminalProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <section className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
            {/* Terminal Header / Window Bar */}
            <div
                onClick={onToggle}
                style={{
                    background: '#1a1a1a',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: '1px solid #333'
                }}
            >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Window Controls */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }}></div>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }}></div>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }}></div>
                    </div>

                    <span style={{
                        marginLeft: '12px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#999',
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" /></svg>
                        crawler@terminal: ~
                    </span>

                    {isLive && (
                        <span style={{
                            marginLeft: '8px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: 'var(--color-accent)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <span style={{
                                width: '6px',
                                height: '6px',
                                background: 'var(--color-accent)',
                                borderRadius: '50%',
                                display: 'inline-block',
                                animation: 'pulse 1.5s infinite'
                            }}></span>
                            LIVE
                        </span>
                    )}
                </div>

                <span style={{
                    color: '#666',
                    transform: isOpen ? 'rotate(180deg)' : '',
                    transition: 'transform 0.2s',
                    fontSize: '0.8rem'
                }}>▼</span>
            </div>

            {/* Terminal Body */}
            {isOpen && (
                <div
                    ref={scrollRef}
                    style={{
                        background: '#0d0d0d',
                        color: '#f0f0f0',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem',
                        lineHeight: 1.6,
                        padding: '1.25rem',
                        height: '320px',
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#333 transparent'
                    }}
                >
                    {logs.length === 0 ? (
                        <div style={{ color: '#555' }}>
                            <span style={{ color: '#27c93f' }}>$</span> Waiting for crawl jobs... Submit a URL to start.
                        </div>
                    ) : (
                        logs.map((log, i) => {
                            // Syntax highlighting for "Earthy" logs
                            let color = '#f0f0f0';
                            const lowerLog = log.toLowerCase();

                            if (lowerLog.includes('[error]')) color = 'var(--color-danger)';
                            else if (lowerLog.includes('[done]')) color = 'var(--color-success)';
                            else if (lowerLog.includes('[db]')) color = '#8c837f'; // Muted charcoal
                            else if (lowerLog.includes('[parse]')) color = 'var(--color-terracotta-soft)';
                            else if (lowerLog.includes('[crawl]')) color = 'var(--color-info)';
                            else if (lowerLog.includes('starting')) color = 'var(--color-terracotta)';

                            return (
                                <div key={i} style={{ color, marginBottom: '2px', wordBreak: 'break-all', opacity: log.includes('[db]') ? 0.7 : 1 }}>
                                    <span style={{ color: '#444', marginRight: '8px', fontSize: '0.75rem' }}>[{new Date().toLocaleTimeString(undefined, { hour12: false })}]</span>
                                    {log}
                                </div>
                            );
                        })
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ color: '#27c93f', marginRight: '8px' }}>$</span>
                        <span style={{
                            width: '8px',
                            height: '16px',
                            background: '#f0f0f0',
                            display: 'inline-block',
                            animation: 'pulse 1s infinite',
                            opacity: 0.8
                        }}></span>
                    </div>
                </div>
            )}
        </section>
    );
}
