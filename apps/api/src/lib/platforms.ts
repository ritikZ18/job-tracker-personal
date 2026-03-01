import { sourcePlatformEnum } from '../db/schema.js';
import { findMetadataByUrl } from './company-metadata.js';

export type Platform = typeof sourcePlatformEnum.enumValues[number];

/** Detect ATS platform from URL */
export function detectPlatform(url: string): Platform {
    const lower = url.toLowerCase();

    // 1. Check Metadata Registry first for known major companies
    const metadata = findMetadataByUrl(url);
    if (metadata) {
        // If it's a major company site, we often treat it as CUSTOM or check for ATS signatures within it
        if (lower.includes('greenhouse.io') || lower.includes('boards.greenhouse')) return 'GREENHOUSE';
        if (lower.includes('lever.co') || lower.includes('jobs.lever')) return 'LEVER';
        if (lower.includes('myworkdayjobs') || lower.includes('workday.com')) return 'WORKDAY';
        if (lower.includes('icims.com')) return 'ICIMS';
        return 'CUSTOM';
    }

    // 2. Fallback to Known ATS Patterns
    if (lower.includes('greenhouse.io') || lower.includes('boards.greenhouse')) return 'GREENHOUSE';
    if (lower.includes('lever.co') || lower.includes('jobs.lever')) return 'LEVER';
    if (lower.includes('myworkdayjobs') || lower.includes('workday.com')) return 'WORKDAY';
    if (lower.includes('icims.com')) return 'ICIMS';

    return 'UNKNOWN';
}

/** Extract company name from URL if not provided */
export function guessCompanyName(url: string): string {
    try {
        const u = new URL(url);
        const lower = url.toLowerCase();

        // 1. Check Metadata Registry
        const metadata = findMetadataByUrl(url);
        if (metadata) return metadata.name;

        const hostname = u.hostname;
        const parts = u.pathname.split('/').filter(Boolean);

        // 2. Platform specific logic
        if (hostname.includes('lever.co') && parts[0]) return parts[0];
        if (hostname.includes('greenhouse.io') && parts[0]) return parts[0];

        // Generic: use hostname minus extension
        return hostname.replace(/^(www|jobs|careers?|boards?)\./, '').split('.')[0] || 'Unknown';
    } catch {
        return 'Unknown';
    }
}

/** Detect if URL is a single job posting or a career list */
export function isJobPosting(url: string): boolean {
    const lower = url.toLowerCase();

    // Common patterns for job details
    const detailPatterns = [
        /\/jobs\/\d+/,
        /\/job\//,
        /\/posting\//,
        /\/details\//,
        /\/opening\//,
        /\/apply\//,
        /lever\.co\/[^\/]+\/[a-f0-9-]+$/i, // Lever detail: lever.co/company/uuid
        /greenhouse\.io\/[^\/]+\/jobs\/\d+/i, // Greenhouse detail
    ];

    // Common patterns for career portals
    const portalPatterns = [
        /\/careers$/i,
        /\/careers\/$/i,
        /\/search$/i,
        /\/jobs$/i,
        /boards\.greenhouse\.io\/[^\/]+$/i,
        /jobs\.lever\.co\/[^\/]+$/i,
    ];

    if (detailPatterns.some(p => p.test(url))) return true;
    if (portalPatterns.some(p => p.test(url))) return false;

    // Heuristic: longest path often means detail page
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return parts.length >= 3;
}
