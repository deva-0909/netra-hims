import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// A second client with its own auth storage key — the patient portal's
// session must never collide with (or be overwritten by) the staff app's
// own Supabase Auth session living in the same browser, since this app's
// DEMO_MODE auto-signs every visitor into a shared staff account using the
// default client's storage.
export const portalSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: 'netra-portal-auth' },
});
