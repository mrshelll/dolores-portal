import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyAuthError, isEmailInvalid, isNetworkError, retryAfterSeconds } from "../../js/auth-errors.js";

test("classifyAuthError maps HTTP 429 and over_email_send_rate_limit with a wait to rate-limit", () => {
  assert.equal(classifyAuthError({ status: 429, message: "Too many requests" }), "rate-limit");
  assert.equal(classifyAuthError({ status: 429, code: "over_email_send_rate_limit",
    message: "For security purposes, you can only request this after 42 seconds." }), "rate-limit");
  assert.equal(classifyAuthError({ status: 429, code: "over_request_rate_limit", message: "Request rate limit reached" }), "rate-limit");
});

test("classifyAuthError maps the hourly email cap (no seconds in the message) to email-cap", () => {
  assert.equal(classifyAuthError({ status: 429, code: "over_email_send_rate_limit", message: "Email rate limit exceeded" }), "email-cap");
  assert.equal(classifyAuthError({ status: 400, code: "over_email_send_rate_limit", message: "Email rate limit exceeded" }), "email-cap");
  assert.equal(classifyAuthError({ status: 429, code: "over_email_send_rate_limit" }), "email-cap");
  // An older server without the code says it only in the message.
  assert.equal(classifyAuthError({ status: 429, message: "Email rate limit exceeded" }), "email-cap");
});

test("classifyAuthError maps otp_expired to expired-code", () => {
  assert.equal(classifyAuthError({ name: "AuthApiError", status: 403, code: "otp_expired", message: "Token has expired or is invalid" }), "expired-code");
});

test("classifyAuthError maps a code the server calls invalid to invalid-code", () => {
  assert.equal(classifyAuthError({ name: "AuthApiError", status: 400, message: "Invalid OTP" }), "invalid-code");
  assert.equal(classifyAuthError({ status: 422, code: "validation_failed", message: "Token is invalid" }), "invalid-code");
});

test("classifyAuthError maps a TypeError: Failed to fetch to network", () => {
  assert.equal(classifyAuthError(new TypeError("Failed to fetch")), "network");
  assert.equal(classifyAuthError({ name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" }), "network");
  assert.equal(classifyAuthError({ message: "Load failed" }), "network");
  assert.equal(isNetworkError({ message: "TypeError: Failed to fetch" }), true);
});

// auth-js 2.117.2 (lib/fetch.js, NETWORK_ERROR_CODES) wraps every 5xx answer, 500 included, in AuthRetryableFetchError
// with the HTTP status. An answer came back, so it is the server's failure (a rejected SMTP login gives 500), not the
// reader's internet.
test("classifyAuthError maps an AuthRetryableFetchError that carries an HTTP status to other", () => {
  const smtpRefused = { name: "AuthRetryableFetchError", status: 500, message: "Error sending confirmation email" };
  assert.equal(classifyAuthError(smtpRefused), "other");
  assert.equal(isNetworkError(smtpRefused), false);
  assert.equal(classifyAuthError({ name: "AuthRetryableFetchError", status: 504, message: "HTTP 504" }), "other");
});

test("classifyAuthError maps anything else, and nothing, to other", () => {
  assert.equal(classifyAuthError({ status: 500, message: "boom" }), "other");
  assert.equal(classifyAuthError(null), "other");
  assert.equal(classifyAuthError(undefined), "other");
  assert.equal(classifyAuthError("weird"), "other");
});

test("isEmailInvalid recognises the server refusing the address", () => {
  assert.equal(isEmailInvalid({ status: 400, code: "email_address_invalid", message: "Email address is invalid" }), true);
  assert.equal(isEmailInvalid({ status: 422, code: "validation_failed", message: "Unable to validate email address: invalid format" }), true);
  assert.equal(isEmailInvalid({ status: 429, code: "over_email_send_rate_limit" }), false);
  assert.equal(isEmailInvalid(null), false);
});

test("retryAfterSeconds reads the wait from the message, defaulting to 60", () => {
  assert.equal(retryAfterSeconds({ message: "For security purposes, you can only request this after 42 seconds." }), 42);
  assert.equal(retryAfterSeconds({ message: "Email rate limit exceeded" }), 60);
  assert.equal(retryAfterSeconds({ message: "after 0 seconds" }), 60);
  assert.equal(retryAfterSeconds(null), 60);
});
