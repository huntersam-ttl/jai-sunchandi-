import { createClient } from "@supabase/supabase-js";

// PUBLIC values only. The anon key is safe for the browser. The service-role key
// and database URL must NEVER appear in the frontend.
const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Guard so a missing env doesn't throw at import time (keeps the app loadable
// during the migration); auth calls check for a configured client.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = Boolean(supabase);
