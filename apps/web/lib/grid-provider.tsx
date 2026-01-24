'use client';

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

// Register AG Grid modules ONCE at app initialization
ModuleRegistry.registerModules([AllCommunityModule]);

export function GridProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
