export default function AdminJobsPage() {
    return (
        <div className="p-6">
            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4">Job Queue Status</h2>
                <p className="text-[var(--color-muted-foreground)]">
                    Job analysis queue monitoring.
                    Features: view pending/running/failed jobs, retry failures, success rate metrics.
                </p>
                {/* TODO: Implement job queue dashboard */}
            </div>
        </div>
    );
}
