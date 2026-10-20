import { chromium } from 'playwright';

export interface BrandingData {
    logoUrl?: string;
    heroImageUrl?: string;
    rootDomain?: string;
}

export async function extractBranding(url: string): Promise<BrandingData> {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const u = new URL(url);
        const rootDomain = u.hostname.replace(/^(www|jobs|careers?|boards?)\./, '');
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();

        // Use a shorter timeout for branding
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const branding = await page.evaluate((baseUrl: string) => {
            const result: BrandingData = {};

            // 1. OG Image (often hero image)
            const ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage) {
                result.heroImageUrl = ogImage.getAttribute('content') || undefined;
            }

            // 2. Organization JSON-LD
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
                try {
                    const json = JSON.parse(script.innerHTML);
                    const items = Array.isArray(json) ? json : [json];
                    for (const item of items) {
                        if (item['@type'] === 'Organization' || item['@type'] === 'Company') {
                            if (item.logo) {
                                result.logoUrl = typeof item.logo === 'string' ? item.logo : item.logo.url;
                                break;
                            }
                        }
                    }
                } catch { /* ignore */ }
                if (result.logoUrl) break;
            }

            // 3. Icons (favicon, apple-touch-icon)
            if (!result.logoUrl) {
                const icon = document.querySelector('link[rel="apple-touch-icon"]') ||
                    document.querySelector('link[rel="icon"]') ||
                    document.querySelector('link[rel="shortcut icon"]');
                if (icon) {
                    result.logoUrl = icon.getAttribute('href') || undefined;
                }
            }

            // Resolve relative URLs
            if (result.logoUrl && !result.logoUrl.startsWith('http')) {
                result.logoUrl = new URL(result.logoUrl, baseUrl).toString();
            }
            if (result.heroImageUrl && !result.heroImageUrl.startsWith('http')) {
                result.heroImageUrl = new URL(result.heroImageUrl, baseUrl).toString();
            }

            return result;
        }, url);

        // Fallback to domain favicon if still missing logo
        if (!branding.logoUrl) {
            branding.logoUrl = `https://${rootDomain}/favicon.ico`;
        }

        return { ...branding, rootDomain };

    } catch (error) {
        console.error('Branding extraction error:', error);
        return {};
    } finally {
        await browser.close();
    }
}
