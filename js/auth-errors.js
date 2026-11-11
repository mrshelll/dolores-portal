// Maps Supabase Auth errors to the few situations the sign-in screens explain.
// Codes come from @supabase/auth-js 2.117.2 (lib/error-codes.d.ts and lib/fetch.js).
// Note: for a wrong code the server answers otp_expired too («Token has expired or is invalid»), so the text for
// expired-code has to cover both a mistyped and an expired code.

const NETWORK_MESSAGE = /failed to fetch|load failed|networkerror|network request failed|fetch failed/i;
const INVALID_CODE_MESSAGE = /invalid (otp|token|code)|(otp|token|code) is invalid/i;
const EMAIL_LIMIT_MESSAGE = /email rate limit/i;
const SECONDS = /(\d+)\s*seconds?/i;

const codeOf = (error) => String((error && error.code) || "");
const messageOf = (error) => String((error && error.message) || "");

export function isNetworkError(error) {
  if (!error || typeof error !== "object") return false;
  // auth-js also wraps every 5xx answer in AuthRetryableFetchError, with its HTTP status: only status 0 means no answer.
  if (error.name === "AuthRetryableFetchError") return !error.status;
  return NETWORK_MESSAGE.test(messageOf(error));
}

// 'email-cap' | 'rate-limit' | 'invalid-code' | 'expired-code' | 'network' | 'other'
// Supabase answers over_email_send_rate_limit both for the 60-second wait between two codes («… after 42 seconds.») and
// for the project's hourly cap on emails («Email rate limit exceeded»). Only the first says how long to wait and means a
// code just went out; the cap says neither. The cap is 'email-cap'.
export function classifyAuthError(error) {
  if (!error || typeof error !== "object") return "other";
  if (isNetworkError(error)) return "network";
  const code = codeOf(error);
  const emailLimit = code === "over_email_send_rate_limit" || EMAIL_LIMIT_MESSAGE.test(messageOf(error));
  if (emailLimit && !SECONDS.test(messageOf(error))) return "email-cap";
  if (error.status === 429 || /rate_limit/.test(code)) return "rate-limit";
  if (code === "otp_expired") return "expired-code";
  if (INVALID_CODE_MESSAGE.test(messageOf(error))) return "invalid-code";
  return "other";
}

// The server refused the address itself (the page checks its shape first, so this is rare).
export function isEmailInvalid(error) {
  if (!error || typeof error !== "object") return false;
  const code = codeOf(error);
  return code === "email_address_invalid" || (code === "validation_failed" && /email/i.test(messageOf(error)));
}

// Supabase answers «For security purposes, you can only request this after 42 seconds.»
export function retryAfterSeconds(error, fallback = 60) {
  const match = SECONDS.exec(messageOf(error));
  const seconds = match ? Number(match[1]) : fallback;
  return seconds > 0 && seconds <= 3600 ? seconds : fallback;
}
