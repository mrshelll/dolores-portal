import { test } from "node:test";
import assert from "node:assert/strict";
import { accessState } from "../../js/access.js";

test("accessState returns no-access for zero rows", () => {
  // RLS hides every row of people from someone not on the list, so they read nothing.
  assert.equal(accessState([], "ana@example.com"), "no-access");
});

test("accessState returns member for a case-different email", () => {
  assert.equal(accessState([{ email: "Ana@Example.com", name: "Ana" }], "ana@example.COM"), "member");
  assert.equal(accessState([{ email: " ana@example.com ", name: "Ana" }], "ana@example.com"), "member");
});

test("accessState returns no-access when the only row is someone else's", () => {
  assert.equal(accessState([{ email: "otro@example.com", name: "Otro" }], "ana@example.com"), "no-access");
});

test("accessState returns no-access for missing rows, a missing email or malformed rows", () => {
  assert.equal(accessState(null, "ana@example.com"), "no-access");
  assert.equal(accessState(undefined, "ana@example.com"), "no-access");
  assert.equal(accessState([{ email: "" }], ""), "no-access");
  assert.equal(accessState([{ email: "ana@example.com" }], undefined), "no-access");
  assert.equal(accessState([null, { name: "Sin correo" }, { email: 42 }], "ana@example.com"), "no-access");
});
