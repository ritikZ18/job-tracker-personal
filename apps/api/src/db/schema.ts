import { pgTable, uuid, varchar, text, timestamp, pgEnum, json, boolean, integer } from 'drizzle-orm/pg-core';

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum('user_role', ['USER', 'ADMIN']);

export const applicationStatusEnum = pgEnum('application_status', [
    'SAVED',
    'APPLIED',
    'INTERVIEWING',
    'OFFER',
    'REJECTED',
    'GHOSTED',
]);

export const applicationSourceEnum = pgEnum('application_source', ['MANUAL', 'ANALYZED', 'CRAWLED']);

export const jobAnalysisStatusEnum = pgEnum('job_analysis_status', [
    'PENDING',
    'RUNNING',
    'DONE',
    'FAILED',
]);

export const applicationEventTypeEnum = pgEnum('application_event_type', [
    'CREATED',
    'FIELD_EDIT',
    'STATUS_CHANGED',
    'NOTE_ADDED',
    'ANALYZED',
]);

export const crawlStatusEnum = pgEnum('crawl_status', [
    'QUEUED',
    'RUNNING',
    'SUCCESS',
    'FAILED',
]);

export const jobStatusEnum = pgEnum('job_status', ['OPEN', 'CLOSED']);

export const sourcePlatformEnum = pgEnum('source_platform', [
    'GREENHOUSE',
    'LEVER',
    'WORKDAY',
    'ICIMS',
    'CUSTOM',
    'UNKNOWN',
]);

export const changeTypeEnum = pgEnum('change_type', ['NEW', 'UPDATED', 'CLOSED']);

export const eventTypeEnum = pgEnum('event_type', [
    'JOB_DISCOVERED',
    'JOB_UPDATED',
    'JOB_CLOSED',
    'CRAWL_STARTED',
    'CRAWL_COMPLETED',
    'CRAWL_FAILED',
    'COMPANY_ADDED',
    'JOB_CLICKED',
]);

export const crawlScheduleEnum = pgEnum('crawl_schedule', ['MANUAL', 'DAILY', 'WEEKLY']);

// ============================================================
// TABLES
// ============================================================

// Users table — linked to Supabase Auth via supabaseUid
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    supabaseUid: varchar('supabase_uid', { length: 255 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    avatarUrl: text('avatar_url'),
    role: userRoleEnum('role').notNull().default('USER'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Companies table — career page sources to crawl
export const companies = pgTable('companies', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    careerUrl: text('career_url').notNull(),
    sourcePlatform: sourcePlatformEnum('source_platform').notNull().default('UNKNOWN'),
    crawlSchedule: crawlScheduleEnum('crawl_schedule').notNull().default('MANUAL'),
    isTarget: boolean('is_target').notNull().default(false),
    lastCrawlAt: timestamp('last_crawl_at', { withTimezone: true }),
    crawlStatus: crawlStatusEnum('crawl_status'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Jobs table — discovered job postings
export const jobs = pgTable('jobs', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    jobTitle: varchar('job_title', { length: 500 }).notNull(),
    jobSlug: varchar('job_slug', { length: 500 }).notNull().unique(),
    canonicalJobUrl: text('canonical_job_url').notNull(),
    jobLocation: varchar('job_location', { length: 500 }),
    jobTeam: varchar('job_team', { length: 255 }),
    employmentType: varchar('employment_type', { length: 100 }),
    postedDate: timestamp('posted_date', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    status: jobStatusEnum('status').notNull().default('OPEN'),
    descriptionHtml: text('description_html'),
    descriptionText: text('description_text'),
    applyUrl: text('apply_url'),
    sourcePlatform: sourcePlatformEnum('source_platform').notNull().default('UNKNOWN'),
    salaryRange: varchar('salary_range', { length: 255 }),
    seniority: varchar('seniority', { length: 100 }),
    isRemote: boolean('is_remote').default(false),
    tags: json('tags').$type<string[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Job Snapshots table — change detection history
export const jobSnapshots = pgTable('job_snapshots', {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
        .notNull()
        .references(() => jobs.id, { onDelete: 'cascade' }),
    snapshotData: json('snapshot_data').notNull().default({}),
    changeType: changeTypeEnum('change_type').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
});

// Crawl Runs table — tracks each crawl execution
export const crawlRuns = pgTable('crawl_runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    status: crawlStatusEnum('status').notNull().default('QUEUED'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    pagesFetched: integer('pages_fetched').notNull().default(0),
    jobsDiscovered: integer('jobs_discovered').notNull().default(0),
    jobsUpdated: integer('jobs_updated').notNull().default(0),
    jobsClosed: integer('jobs_closed').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    durationMs: integer('duration_ms'),
    logs: json('logs').$type<string[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Applications table — user's job application tracker
export const applications = pgTable('applications', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
        .references(() => jobs.id, { onDelete: 'set null' }),
    company: varchar('company', { length: 255 }).notNull(),
    jobTitle: varchar('job_title', { length: 255 }).notNull(),
    jobIdStr: varchar('job_id_str', { length: 255 }),
    jobUrl: text('job_url'),
    jobDescription: text('job_description'),
    notes: text('notes'),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    status: applicationStatusEnum('status').notNull().default('SAVED'),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    source: applicationSourceEnum('source').notNull().default('MANUAL'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Application Events table (audit log)
export const applicationEvents = pgTable('application_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
        .notNull()
        .references(() => applications.id, { onDelete: 'cascade' }),
    type: applicationEventTypeEnum('type').notNull(),
    payload: json('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Job Analyses table (legacy single-URL analysis)
export const jobAnalyses = pgTable('job_analyses', {
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

// Saved Views table
export const views = pgTable('views', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    config: json('config').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// User Tags table — custom tags on jobs
export const userTags = pgTable('user_tags', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
        .notNull()
        .references(() => jobs.id, { onDelete: 'cascade' }),
    tags: json('tags').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Events table — observability event log
export const events = pgTable('events', {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: eventTypeEnum('event_type').notNull(),
    entityId: varchar('entity_id', { length: 255 }),
    entityType: varchar('entity_type', { length: 100 }),
    metadata: json('metadata').default({}),
    correlationId: varchar('correlation_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
