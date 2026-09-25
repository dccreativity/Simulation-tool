import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/*
 * Browser Supabase client. Only the public project URL and the publishable
 * (anon) key are used here — both are safe to ship to the browser because Row
 * Level Security decides what each signed-in user can read and write. No
 * service-role key is used anywhere in this app.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export const isSupabaseConfigured = Boolean(url && key);

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || typeof window === 'undefined') return null;
  if (!client) {
    client = createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'eco-field-lab-auth',
      },
    });
  }
  return client;
}
