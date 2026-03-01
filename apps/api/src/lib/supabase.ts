import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-init: don't crash when env vars are absent (e.g. dev without Supabase)
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
    if (!_supabaseAdmin) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
            throw new Error(
                'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
                'See apps/api/.env.example for required variables.'
            );
        }
        _supabaseAdmin = createClient(url, key);
    }
    return _supabaseAdmin;
}
