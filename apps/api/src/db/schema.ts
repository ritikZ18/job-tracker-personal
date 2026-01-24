import { pgTable, uuid, varchar, text, timestamp, pgEnum, json } from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['USER', 'ADMIN']);
export const applicationStatusEnum = pgEnum('application_status', [
    'SAVED',
    'APPLIED',
    'INTERVIEWING',
    'OFFER',
    'REJECTED',
    'GHOSTED',
]);
export const applicationSourceEnum = pgEnum('application_source', ['MANUAL', 'ANALYZED']);
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

// Users table
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull().default('USER'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Applications table
export const applications = pgTable('applications', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    company: varchar('company', { length: 255 }).notNull(),
    jobTitle: varchar('job_title', { length: 255 }).notNull(),
    jobId: varchar('job_id', { length: 255 }),
    jobUrl: text('job_url'),
    jobDescription: text('job_description'),
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

// Job Analyses table
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
