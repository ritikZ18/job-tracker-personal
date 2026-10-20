import { chromium } from 'playwright';

export interface LLMParsedJob {
    title: string;
    company: string | null;
    location: string | null;
    team: string | null;
    employment_type: string | null;
    posted_date: string | null;
    apply_url: string | null;
    description_text: string | null;
    tags: string[];
}

function stripHtmlForLLM(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<img[\s\S]*?>/gi, '')
        .replace(/<\/?(nav|footer|header|aside|iframe)[^>]*>/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export async function extractWithLLMFallback(jobUrl: string): Promise<LLMParsedJob | null> {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();
        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(2000);

        const html = await page.content();
        const cleanedHtml = stripHtmlForLLM(html).slice(0, 50000); // Token limit safety

        const prompt = `Return STRICT JSON only. No markdown. Use exactly this schema:
{
  "title": string,
  "company": string | null,
  "location": string | null,
  "team": string | null,
  "employment_type": string | null,
  "posted_date": string | null,
  "apply_url": string | null,
  "description_text": string,
  "tags": string[]
}

Extract from this job page HTML. Use null if unknown. Ensure apply_url is absolute.
HTML Content:
${cleanedHtml}`;

        // Get API key from env
        const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.warn('[LLM] No API key found (GEMINI_API_KEY or GROQ_API_KEY). Skipping LLM fallback.');
            return null;
        }

        // Logic for calling the LLM API (stub for now, will implement actual fetch)
        // const response = await callLLM(prompt, apiKey);
        // return JSON.parse(response);

        console.log('[LLM] Fallback triggered, but API call is not yet implemented.');
        return null;

    } catch (error) {
        console.error('LLM extraction error:', error);
        return null;
    } finally {
        await browser.close();
    }
}
