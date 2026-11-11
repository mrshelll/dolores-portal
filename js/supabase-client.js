// The only module that loads supabase-js (pinned version, ES module build from jsDelivr).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../config.js";

// The session persists in localStorage and refreshes on its own. Sign-in is by code, never by a link back to the
// page, so supabase-js never reads a session from the address: the hash is the router's alone.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
