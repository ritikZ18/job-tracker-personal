export default function AdminApplicationsPage() {
    return (
        <div className="p-6">
            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4">All Applications</h2>
                <p className="text-[var(--color-muted-foreground)]">
                    Global applications view for administrators.
                    Features: view all user applications, search, filter, audit trail.
                </p>
                {/* TODO: Implement global applications list with AG Grid */}
            </div>
        </div>
    );
}
