import { db, schema } from '../db/index.js';

type EventType =
    | 'JOB_DISCOVERED'
    | 'JOB_UPDATED'
    | 'JOB_CLOSED'
    | 'CRAWL_STARTED'
    | 'CRAWL_COMPLETED'
    | 'CRAWL_FAILED'
    | 'COMPANY_ADDED'
    | 'JOB_CLICKED';

export async function emitEvent(
    eventType: EventType,
    entityId: string,
    entityType: string,
    metadata: Record<string, unknown> = {},
    correlationId?: string
) {
    try {
        await db.insert(schema.events).values({
            eventType,
            entityId,
            entityType,
            metadata,
            correlationId: correlationId || undefined,
        });

        // Structured log output
        console.log(
            JSON.stringify({
                type: 'event',
                eventType,
                entityId,
                entityType,
                correlationId,
                metadata,
                timestamp: new Date().toISOString(),
            })
        );
    } catch (error) {
        console.error('Failed to emit event:', error);
    }
}
