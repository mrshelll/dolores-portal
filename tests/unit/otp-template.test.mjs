import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The email Supabase Auth sends with the sign-in code (COR-10 to COR-13 of the factory's visual manual): HTML only,
// the code first and as real text, no links, no images. The subject lives in its own file, pasted next to the body.
const html = readFileSync(new URL("../../supabase/templates/otp-code.html", import.meta.url), "utf8");
const subject = readFileSync(new URL("../../supabase/templates/otp-code.subject.txt", import.meta.url), "utf8").trim();
const body = html.replace(/<!--[\s\S]*?-->/g, "");
const text = body.replace(/<[^>]+>/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);

test("the subject has no {{ .Token }} and is at most 50 characters", () => {
  assert.equal(subject, "Tu código para entrar a dolores");
  assert.doesNotMatch(subject, /\{\{/);
  assert.ok(subject.length <= 50, `${subject.length} characters`);
  assert.doesNotMatch(subject, /\d|!|[A-ZÁÉÍÓÚ]{3,}/);
});

test("the body has {{ .Token }} exactly once, before any other text", () => {
  assert.equal(body.split("{{ .Token }}").length - 1, 1);
  assert.equal(text.filter((line) => line.includes("{{")).length, 1);
  assert.equal(text[0], "{{ .Token }}");
});

test("the code is large, in a fixed-width font", () => {
  const tag = body.match(/<[^>]*style="[^"]*"[^>]*>\s*\{\{ \.Token \}\}/)[0];
  const size = Number(tag.match(/font-size:\s*(\d+)px/)[1]);
  assert.ok(size >= 24, `font-size ${size}`);
  assert.match(tag, /monospace/);
});

test("the body has no <a and no <img", () => {
  assert.doesNotMatch(body, /<a[\s>]/i);
  assert.doesNotMatch(body, /<img/i);
  assert.doesNotMatch(body, /href\s*=|<button|<script|<style|https?:|@font-face|url\(/i);
  assert.doesNotMatch(body, /\{\{\s*\.(ConfirmationURL|SiteURL|RedirectTo|TokenHash)/);
});

test("the body says «Vale 1 hora.» and has a sentence for the person who did not ask for the code", () => {
  const all = text.join(" ");
  assert.match(all, /Vale 1 hora\./);
  assert.match(all, /Si no lo pediste, ignora este correo\./);
  assert.doesNotMatch(all, /urgente|alerta|peligro|!/i);
});

test("inline styles: a 600 px column, 16 px text, no pure white or black, colour always with its background", () => {
  assert.match(body, /max-width:\s*600px/);
  assert.match(body, /font-size:\s*16px/);
  assert.doesNotMatch(body, /#000(000)?\b|#fff(fff)?\b|background(-color)?:\s*(white|black)/i);
  for (const [, style] of body.matchAll(/style="([^"]*)"/g)) {
    if (/(^|;)\s*color:/.test(style)) assert.match(style, /background-color:/, style);
  }
});
