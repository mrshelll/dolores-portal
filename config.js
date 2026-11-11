// Public configuration. The publishable key is meant to be public: every table is protected by Row Level Security in
// Supabase, which is where the access rules live. Never put any other key here.
export const SUPABASE_URL = "https://hphrlkvkefztxvlamrmh.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bXPMT36HXGUrVd7gy1Anjg_QU2rLIX7";

// Length of the sign-in code Supabase emails. Must match Authentication > Sign In / Providers > Email >
// «Email OTP Length» in the Supabase panel.
export const EMAIL_OTP_LENGTH = 8;
