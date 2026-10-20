'use client';

import { type ReactNode } from 'react';

export default function UserLayout({ children }: { children: ReactNode }) {
    // Auth gating disabled for now — will be re-enabled after Supabase setup
    return <>{children}</>;
}
