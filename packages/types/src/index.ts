import { z } from 'zod';

// ============ Enums ============
export const UserRoleSchema = z.enum(['USER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const ApplicationStatusSchema = z.enum([
    'SAVED',
    'APPLIED',
    'INTERVIEWING',
    'OFFER',
    'REJECTED',
    'GHOSTED',
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const ApplicationSourceSchema = z.enum(['MANUAL', 'ANALYZED']);
export type ApplicationSource = z.infer<typeof ApplicationSourceSchema>;

export const JobAnalysisStatusSchema = z.enum([
    'PENDING',
    'RUNNING',
    'DONE',
    'FAILED',
]);
export type JobAnalysisStatus = z.infer<typeof JobAnalysisStatusSchema>;

export const ApplicationEventTypeSchema = z.enum([
    'CREATED',
    'FIELD_EDIT',
    'STATUS_CHANGED',
    'NOTE_ADDED',
    'ANALYZED',
]);
export type ApplicationEventType = z.infer<typeof ApplicationEventTypeSchema>;

// ============ User ============
export const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: UserRoleSchema,
    createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

// ============ Application ============
export const ApplicationSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    company: z.string(),
    jobTitle: z.string(),
    jobId: z.string().nullable(),
    jobUrl: z.string().url().nullable(),
    jobDescription: z.string().nullable(),
    appliedAt: z.string().datetime().nullable(),
    status: ApplicationStatusSchema,
    rejectedAt: z.string().datetime().nullable(),
    source: ApplicationSourceSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type Application = z.infer<typeof ApplicationSchema>;

export const CreateApplicationSchema = z.object({
    company: z.string().min(1),
    jobTitle: z.string().min(1),
    jobId: z.string().optional(),
    jobUrl: z.string().url().optional(),
    jobDescription: z.string().optional(),
    appliedAt: z.string().datetime().optional(),
    status: ApplicationStatusSchema.optional().default('SAVED'),
    source: ApplicationSourceSchema.optional().default('MANUAL'),
});
export type CreateApplication = z.infer<typeof CreateApplicationSchema>;

export const UpdateApplicationSchema = CreateApplicationSchema.partial();
export type UpdateApplication = z.infer<typeof UpdateApplicationSchema>;

export const UpdateStatusSchema = z.object({
    status: ApplicationStatusSchema,
});
export type UpdateStatus = z.infer<typeof UpdateStatusSchema>;

// ============ Job Analysis ============
export const JobAnalysisResultSchema = z.object({
    title: z.string().optional(),
    company: z.string().optional(),
    jobId: z.string().optional(),
    description: z.string().optional(),
});
export type JobAnalysisResult = z.infer<typeof JobAnalysisResultSchema>;

export const JobAnalysisSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    jobUrl: z.string().url(),
    status: JobAnalysisStatusSchema,
    result: JobAnalysisResultSchema.nullable(),
    error: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

export const AnalyzeJobUrlSchema = z.object({
    jobUrl: z.string().url(),
});
export type AnalyzeJobUrl = z.infer<typeof AnalyzeJobUrlSchema>;

// ============ Application Events ============
export const ApplicationEventSchema = z.object({
    id: z.string().uuid(),
    applicationId: z.string().uuid(),
    type: ApplicationEventTypeSchema,
    payload: z.record(z.unknown()),
    createdAt: z.string().datetime(),
});
export type ApplicationEvent = z.infer<typeof ApplicationEventSchema>;

// ============ Views ============
export const ViewConfigSchema = z.object({
    filters: z.record(z.unknown()).optional(),
    sort: z
        .array(z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) }))
        .optional(),
    columns: z.array(z.string()).optional(),
});
export type ViewConfig = z.infer<typeof ViewConfigSchema>;

export const SavedViewSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    name: z.string(),
    config: ViewConfigSchema,
    createdAt: z.string().datetime(),
});
export type SavedView = z.infer<typeof SavedViewSchema>;

export const CreateViewSchema = z.object({
    name: z.string().min(1),
    config: ViewConfigSchema,
});
export type CreateView = z.infer<typeof CreateViewSchema>;

// ============ Auth ============
export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});
export type Login = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});
export type Register = z.infer<typeof RegisterSchema>;

export const AuthResponseSchema = z.object({
    user: UserSchema,
    token: z.string().optional(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
