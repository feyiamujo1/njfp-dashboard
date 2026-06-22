import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_SUPABASE_URL;
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "NEXT_SUPABASE_URL and NEXT_SUPABASE_SERVICE_ROLE_KEY must be set in .env.local"
  );
}

// Service-role client — server-side only. Never import this in client components.
// auth options disable session handling which is irrelevant for a service account.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
