import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** Whether Supabase is configured */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Lazy-init: don't crash during build when env vars are absent
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
    if (!isSupabaseConfigured) return null;
    if (!_supabase) {
        _supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
    return _supabase;
}
