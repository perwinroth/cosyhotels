import { createClient } from "@supabase/supabase-js";

// Support both NEXT_PUBLIC_* and non-public env var names commonly used in Vercel setups
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export function getServerSupabase() {
  if (!url) return null;
  const key = serviceKey || anonKey;
  if (!key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
