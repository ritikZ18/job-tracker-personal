import crypto from 'crypto';

// ============================================================
// INTERFACES
// ============================================================

export interface ExtractedData {
    title?: string;
    company?: string;
    jobId?: string;
    description?: string;
    location?: string;
}

export interface DiscoveredJob {
    title: string;
    url: string;
    location?: string;
    team?: string;
    jobId?: string;
    postedDate?: string;
}

// ============================================================
// CONSTANTS & REGEX
// ============================================================

export const JUNK_TITLE_RE = /(talent\s*network|join\s*talent|register|sign\s*up|login|privacy|cookie|terms|about|culture|benefits|events|newsletter|working\s*at|cookies|preferences|dashboard|my\s*applications|help|faq|legal)/i;
export const JUNK_URL_RE = /(privacy|cookie|terms|login|register|about|culture|benefits|events|news|blog|contact|support|faq|legal|press|social|investor|preference|dashboard|content\/)/i;
export const JOB_URL_HINT_RE = /(job|jobs|careers|positions?|opening|requisition|gh_jid|lever\.co|greenhouse\.io|workday|icims|requisition|vacancy|apply)/i;

// ============================================================
// HELPERS
// ============================================================

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 100);
}

export function generateJobSlug(companyName: string, jobId?: string, url?: string): string {
    const prefix = slugify(companyName);
    if (jobId) return `${prefix}-${slugify(jobId)}`;
    const hash = crypto.createHash('sha256').update(url || '').digest('hex').substring(0, 8);
    return `${prefix}-${hash}`;
}

export function detectRemote(title: string, location?: string): boolean {
    const text = `${title} ${location || ''}`.toLowerCase();
    return text.includes('remote') || text.includes('work from home') || text.includes('wfh') || text.includes('anywhere');
}

export function detectSeniority(title: string): string | undefined {
    const lower = title.toLowerCase();
    if (lower.includes('intern') || lower.includes('internship')) return 'Intern';
    if (lower.includes('junior') || lower.includes('jr.') || lower.includes('entry level')) return 'Junior';
    if (lower.includes('senior') || lower.includes('sr.') || lower.includes('lead')) return 'Senior';
    if (lower.includes('staff')) return 'Staff';
    if (lower.includes('principal')) return 'Principal';
    if (lower.includes('manager') || lower.includes('director')) return 'Manager';
    if (lower.includes('vp') || lower.includes('vice president')) return 'VP';
    return undefined;
}

export function detectEmploymentType(title: string): string | undefined {
    const lower = title.toLowerCase();
    if (lower.includes('intern')) return 'Intern';
    if (lower.includes('contract') || lower.includes('contractor')) return 'Contract';
    if (lower.includes('part-time') || lower.includes('part time')) return 'Part-time';
    return 'Full-time';
}

export function isJunkListingTitle(title: string): boolean {
    return JUNK_TITLE_RE.test(title.trim());
}

export function scoreJobCandidateLink(url: string, title: string): number {
    let score = 0;

    // 1. Title heuristics (always apply)
    if (title.length >= 5 && title.length <= 140) score += 1;
    if (isJunkListingTitle(title)) score -= 5;

    // 2. URL heuristics
    try {
        // Use a dummy base for parsing relative URLs
        const urlObj = new URL(url, 'https://example.com');
        const path = urlObj.pathname.toLowerCase();

        // Path-based hints
        if (JOB_URL_HINT_RE.test(path)) score += 3;

        // High-signal domains (only if absolute and matched)
        if (url.includes('://') && /(lever\.co|greenhouse\.io|workday|icims)/i.test(url)) {
            score += 2;
        }

        // Junk signals in path
        if (JUNK_URL_RE.test(path) || path.includes('/content/') || path.includes('/user/')) {
            score -= 5;
        }
    } catch {
        // Fallback for truly malformed
        if (JOB_URL_HINT_RE.test(url)) score += 2;
    }

    return score;
}

export function isValidJobPostingPage(extracted: ExtractedData | null): boolean {
    if (!extracted) return false;

    const title = (extracted.title || '').trim();
    const descLen = (extracted.description || '').trim().length;

    // Reject obvious junk
    if (!title || isJunkListingTitle(title)) return false;

    // Evidence signals
    const hasGoodDescription = descLen > 200;
    const hasCompany = !!extracted.company;
    const hasId = !!extracted.jobId;

    // Check for "Apply" text in description if short
    const hasApplyCta = /(apply|submit|interest|application)/i.test(extracted.description || '');

    const signals = [hasGoodDescription, hasCompany, hasId, hasApplyCta].filter(Boolean).length;

    // Precision gate: if description is short, require at least 3 total signals 
    // (e.g. Title + Company + Apply CTA OR Title + Company + Job ID)
    if (!hasGoodDescription) {
        return signals >= 3;
    }

    return signals >= 1;
}

export function computeQualityScore(disc: DiscoveredJob, detail: ExtractedData | null): number {
    let score = 0;
    const title = detail?.title || disc.title;
    const location = detail?.location || disc.location;
    const desc = detail?.description;

    if (title) score += 0.2;
    if (location) score += 0.2;
    if (disc.postedDate) score += 0.2;
    if (desc && desc.trim().length > 200) score += 0.2;
    if (detail?.company) score += 0.2;

    return Math.min(1, score);
}
