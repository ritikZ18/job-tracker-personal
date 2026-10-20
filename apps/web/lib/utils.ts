/** Extract domain from URL for favicon fetching */
export function getDomainFromUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    try {
        const u = new URL(url);
        return u.hostname;
    } catch {
        // Fallback for relative paths or malformed URLs
        const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
        return match?.[1];
    }
}
