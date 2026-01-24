import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { chromium } from 'playwright';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import {
    pgTable,
    uuid,
    text,
    timestamp,
    pgEnum,
    json,
    varchar,
} from 'drizzle-orm/pg-core';

// Schema inline to avoid import issues
const jobAnalysisStatusEnum = pgEnum('job_analysis_status', [
    'PENDING',
    'RUNNING',
    'DONE',
    'FAILED',
]);

const userRoleEnum = pgEnum('user_role', ['USER', 'ADMIN']);

const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull().default('USER'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

const jobAnalyses = pgTable('job_analyses', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    jobUrl: text('job_url').notNull(),
    status: jobAnalysisStatusEnum('status').notNull().default('PENDING'),
    result: json('result'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// DB Setup
const pool = new pg.Pool({
    connectionString:
        process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/job_tracking',
});
const db = drizzle(pool);

// Redis connection
const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

interface AnalyzeJobData {
    jobAnalysisId: string;
    jobUrl: string;
    userId: string;
}

interface ExtractedData {
    title?: string;
    company?: string;
    jobId?: string;
    description?: string;
    location?: string;
}

async function extractWithFetch(url: string): Promise<ExtractedData | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });

        if (!response.ok) {
            return null;
        }

        const html = await response.text();
        return parseHtml(html, url);
    } catch {
        return null;
    }
}

async function extractWithPlaywright(url: string): Promise<ExtractedData | null> {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait a bit for dynamic content
        await page.waitForTimeout(2000);

        const html = await page.content();
        return parseHtml(html, url);
    } catch (error) {
        console.error('Playwright extraction error:', error);
        return null;
    } finally {
        await browser.close();
    }
}

function parseHtml(html: string, url?: string): ExtractedData {
    const result: ExtractedData = {};

    // Try JSON-LD first
    const jsonLdMatch = html.match(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (jsonLdMatch) {
        try {
            const jsonLd = JSON.parse(jsonLdMatch[1]);
            if (jsonLd['@type'] === 'JobPosting' || jsonLd.title) {
                result.title = jsonLd.title || jsonLd.name;
                result.company =
                    jsonLd.hiringOrganization?.name || jsonLd.company || jsonLd.employer?.name;
                result.description = jsonLd.description;
                result.jobId = jsonLd.identifier?.value || jsonLd.id;
            }
        } catch {
            // JSON-LD parse failed, continue
        }
    }

    // Try OpenGraph meta tags
    if (!result.title) {
        const ogTitleMatch = html.match(
            /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
        );
        if (ogTitleMatch) {
            result.title = ogTitleMatch[1];
        }
    }

    // Try og:site_name for company
    if (!result.company) {
        const ogSiteMatch = html.match(
            /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i
        );
        if (ogSiteMatch) {
            result.company = ogSiteMatch[1];
        }
    }

    // Try application-name meta tag
    if (!result.company) {
        const appNameMatch = html.match(
            /<meta[^>]*name=["']application-name["'][^>]*content=["']([^"']+)["']/i
        );
        if (appNameMatch) {
            result.company = appNameMatch[1];
        }
    }

    // Try twitter:site
    if (!result.company) {
        const twitterMatch = html.match(
            /<meta[^>]*name=["']twitter:site["'][^>]*content=["']@?([^"']+)["']/i
        );
        if (twitterMatch) {
            // Remove @ and capitalize
            const name = twitterMatch[1].replace(/^@/, '');
            result.company = name.charAt(0).toUpperCase() + name.slice(1);
        }
    }

    // Try common company name classes/selectors
    if (!result.company) {
        const companyPatterns = [
            /<[^>]*class=["'][^"']*company[_-]?name[^"']*["'][^>]*>([^<]+)</i,
            /<[^>]*class=["'][^"']*employer[_-]?name[^"']*["'][^>]*>([^<]+)</i,
            /<[^>]*class=["'][^"']*organization[^"']*["'][^>]*>([^<]+)</i,
            /<[^>]*itemprop=["']hiringOrganization["'][^>]*>([^<]+)</i,
            /<[^>]*data-company=["']([^"']+)["']/i,
        ];
        for (const pattern of companyPatterns) {
            const match = html.match(pattern);
            if (match?.[1]) {
                result.company = match[1].trim();
                break;
            }
        }
    }

    // Extract job requirements/qualifications - prioritize structured job content
    if (!result.description) {
        // Look for requirements/qualifications sections
        const requirementPatterns = [
            /<(?:div|section|ul)[^>]*class=["'][^"']*(?:requirements?|qualifications?|skills?|responsibilities)[^"']*["'][^>]*>([\s\S]{50,500}?)<\/(?:div|section|ul)>/i,
            /<h\d[^>]*>(?:Requirements?|Qualifications?|What you['']?ll need|Skills?|Experience)<\/h\d>\s*([\s\S]{50,500}?)<(?:h\d|div|section)/i,
            /<li[^>]*>([^<]{20,200}?(?:experience|skills?|proficient|knowledge|degree|years?)[\s\S]{0,100}?)<\/li>/gi,
        ];

        for (const pattern of requirementPatterns) {
            const match = html.match(pattern);
            if (match?.[1]) {
                // Clean up HTML tags and excessive whitespace
                const cleaned = match[1]
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 300);
                if (cleaned.length > 30) {
                    result.description = cleaned;
                    break;
                }
            }
        }
    }

    // Fallback to og:description if no requirements found
    if (!result.description) {
        const ogDescMatch = html.match(
            /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i
        );
        if (ogDescMatch) {
            result.description = ogDescMatch[1];
        }
    }

    // Try standard meta tags
    if (!result.description) {
        const metaDescMatch = html.match(
            /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
        );
        if (metaDescMatch) {
            result.description = metaDescMatch[1];
        }
    }

    // Try <title> tag
    if (!result.title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            result.title = titleMatch[1].trim();
        }
    }

    // Extract company from title patterns like "Job Title | Company" or "Job Title - Company"
    if (!result.company && result.title) {
        const titleParts = result.title.split(/\s*[\|–—-]\s*/);
        if (titleParts.length >= 2) {
            // Usually company is the last part
            const potentialCompany = titleParts[titleParts.length - 1].trim();
            // Avoid common non-company suffixes
            const nonCompanyPatterns = /^(careers?|jobs?|hiring|apply|work|linkedin|indeed|glassdoor)/i;
            if (!nonCompanyPatterns.test(potentialCompany)) {
                result.company = potentialCompany;
                // If title was just "Company | Company", use first part as title
                if (titleParts.length === 2) {
                    result.title = titleParts[0].trim();
                }
            }
        }
    }

    // GREENHOUSE-SPECIFIC EXTRACTION (job-boards.greenhouse.io/companyname/...)
    if (url && url.includes('greenhouse.io')) {
        // Extract company from Greenhouse URL: job-boards.greenhouse.io/archer56/jobs/...
        const ghUrlMatch = url.match(/greenhouse\.io\/([^\/]+)/i);
        if (ghUrlMatch && ghUrlMatch[1] && !result.company) {
            // Remove trailing numbers (e.g., archer56 -> archer)
            const companySlug = ghUrlMatch[1].replace(/\d+$/, '');
            result.company = companySlug.charAt(0).toUpperCase() + companySlug.slice(1);
        }

        // Greenhouse location
        if (!result.location) {
            const ghLocation = html.match(/class=["']location[^"']*["'][^>]*>([^<]+)</i);
            if (ghLocation) result.location = ghLocation[1].trim();
        }

        // Greenhouse content sections - "What you'll do" and "What you need"
        if (!result.description) {
            // Look for content after headers like "What you'll do", "What you need", "Responsibilities"
            const contentPatterns = [
                /<h[23][^>]*>[\s\S]*?What you(?:'ll| will)? (?:do|need|bring)[\s\S]*?<\/h[23]>\s*([\s\S]{100,800}?)<(?:h[23]|div class)/i,
                /<strong>What you(?:'ll| will)? (?:do|need)<\/strong>\s*([\s\S]{100,800}?)<(?:strong|h[23])/i,
                /(?:Requirements?|Qualifications?|What you(?:'ll| will)? need)[:\s]*<\/[^>]+>\s*<(?:ul|ol)[^>]*>([\s\S]{100,600}?)<\/(?:ul|ol)>/i,
            ];

            for (const pattern of contentPatterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    const cleaned = match[1]
                        .replace(/<li[^>]*>/gi, '• ')
                        .replace(/<\/li>/gi, ' ')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .substring(0, 400);
                    if (cleaned.length > 50) {
                        result.description = cleaned;
                        break;
                    }
                }
            }
        }
    }

    // Try to extract company from URL domain (fallback, but skip job boards)
    if (!result.company && url) {
        try {
            const hostname = new URL(url).hostname;
            // Skip if it's a job board domain
            const jobBoards = ['greenhouse.io', 'lever.co', 'indeed.com', 'linkedin.com', 'glassdoor.com', 'workday.com'];
            const isJobBoard = jobBoards.some(board => hostname.includes(board));

            if (!isJobBoard) {
                const domainParts = hostname.replace('www.', '').split('.');
                if (domainParts.length >= 1 && domainParts[0]) {
                    const domain = domainParts[0];
                    result.company = domain.charAt(0).toUpperCase() + domain.slice(1);
                }
            }
        } catch {
            // URL parsing failed
        }
    }

    // Extract location from JSON-LD or meta tags
    if (!result.location) {
        // Try JSON-LD jobLocation
        const jsonLdLocationMatch = html.match(/"jobLocation"[^}]*"addressLocality"\s*:\s*"([^"]+)"/i);
        if (jsonLdLocationMatch) {
            result.location = jsonLdLocationMatch[1];
        }

        // Try common location patterns
        if (!result.location) {
            const locationPatterns = [
                /<[^>]*class=["'][^"']*location[^"']*["'][^>]*>([^<]{5,60})</i,
                /Location[:\s]*<\/[^>]+>\s*<[^>]+>([^<]{5,60})</i,
                /<meta[^>]*name=["']geo\.placename["'][^>]*content=["']([^"']+)["']/i,
            ];
            for (const pattern of locationPatterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    result.location = match[1].trim();
                    break;
                }
            }
        }
    }

    // Common job site specific selectors (DOM heuristics)
    // LinkedIn
    if (!result.title && html.includes('linkedin.com')) {
        const linkedInTitle = html.match(
            /class=["'][^"']*job-details-jobs-unified-top-card__job-title[^"']*["'][^>]*>([^<]+)</i
        );
        if (linkedInTitle?.[1]) result.title = linkedInTitle[1].trim();
    }

    // Indeed
    if (!result.title && html.includes('indeed.com')) {
        const indeedTitle = html.match(/class=["']jobsearch-JobInfoHeader-title[^"']*["'][^>]*>([^<]+)</i);
        if (indeedTitle?.[1]) result.title = indeedTitle[1].trim();
    }

    // Lever
    if (url && url.includes('lever.co')) {
        if (!result.company) {
            const leverCompany = html.match(/<a[^>]*class=["'][^"']*company-name[^"']*["'][^>]*>([^<]+)</i);
            if (leverCompany?.[1]) result.company = leverCompany[1].trim();
        }
    }

    return result;
}

const worker = new Worker<AnalyzeJobData>(
    'analyze-job',
    async (job: Job<AnalyzeJobData>) => {
        const { jobAnalysisId, jobUrl } = job.data;

        console.log(`Processing job analysis: ${jobAnalysisId}`);

        // Update status to RUNNING
        await db
            .update(jobAnalyses)
            .set({ status: 'RUNNING', updatedAt: new Date() })
            .where(eq(jobAnalyses.id, jobAnalysisId));

        try {
            // Try simple fetch first
            let result = await extractWithFetch(jobUrl);

            // Fallback to Playwright if fetch didn't get good data
            if (!result || (!result.title && !result.company)) {
                console.log('Fetch failed or incomplete, trying Playwright...');
                result = await extractWithPlaywright(jobUrl);
            }

            if (!result || (!result.title && !result.company && !result.description)) {
                throw new Error('Could not extract any data from the URL');
            }

            // Update with success
            await db
                .update(jobAnalyses)
                .set({
                    status: 'DONE',
                    result,
                    updatedAt: new Date(),
                })
                .where(eq(jobAnalyses.id, jobAnalysisId));

            console.log(`Job analysis completed: ${jobAnalysisId}`, result);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Job analysis failed: ${jobAnalysisId}`, errorMessage);

            await db
                .update(jobAnalyses)
                .set({
                    status: 'FAILED',
                    error: errorMessage,
                    updatedAt: new Date(),
                })
                .where(eq(jobAnalyses.id, jobAnalysisId));

            throw error;
        }
    },
    {
        connection: redis,
        concurrency: 3,
    }
);

worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
});

console.log('Worker started. Waiting for jobs...');
