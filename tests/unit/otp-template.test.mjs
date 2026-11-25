import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The email Supabase Auth sends with the sign-in code (COR-10 to COR-13 of the factory's visual manual), as tomoshi:
// HTML only, the code first and as real text, no links, no images. The subject lives in its own file, pasted next to
// the body.
const html = readFileSync(new URL("../../supabase/templates/otp-code.html", import.meta.url), "utf8");
const subject = readFileSync(new URL("../../supabase/templates/otp-code.subject.txt", import.meta.url), "utf8").trim();
const body = html.replace(/<!--[\s\S]*?-->/g, "");
const text = body.replace(/<[^>]+>/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);

test("the subject has no {{ .Token }} and is at most 50 characters", () => {
  assert.equal(subject, "Tu código para entrar a tomoshi");
  assert.doesNotMatch(subject, /\{\{/);
  assert.ok(subject.length <= 50, `${subject.length} characters`);
  assert.doesNotMatch(subject, /\d|!|[A-ZÁÉÍÓÚ]{3,}/);
});

// The code first (the factory's «code first»), before the wordmark and before any other sentence: the inbox preview
// shows it. The lab report's band closes the email: the lowercase wordmark «tomoshi», text only, near-white on the
// report's blue (#1F4E8C), the masthead of the portal's earlier design. Nothing of the andon board is left: no amber
// line, no graphite, no Barlow.
test("the body opens with {{ .Token }}, exactly once, and closes with tomoshi's band in the lab report's colours", () => {
  assert.equal(body.split("{{ .Token }}").length - 1, 1);
  assert.equal(text.filter((line) => line.includes("{{")).length, 1);
  assert.equal(text[0], "{{ .Token }}");
  assert.equal(text.at(-1), "tomoshi");
  assert.ok(body.indexOf("{{ .Token }}") < body.search(/>\s*tomoshi\s*</), "the code comes before the wordmark");
  const band = body.match(/<[^>]*style="([^"]*)"[^>]*>\s*tomoshi\s*</);
  assert.ok(band, "the wordmark is its own element");
  assert.match(band[1], /background-color:\s*#1F4E8C/i);
  assert.doesNotMatch(html, /#F2A900|#1A1C1E|Barlow|amber|border-top/i);
});

// The lab report's type and ink: Public Sans when the reader has it, else Arial (no web font is loaded); the text in
// the report's ink (#14213D).
test("the sentences are in the lab report's font stack and ink", () => {
  const sentences = [...body.matchAll(/<p style="([^"]*)">([^<{]*)<\/p>/g)];
  assert.ok(sentences.length >= 3, `${sentences.length} sentences`);
  for (const [, style] of sentences) assert.match(style, /font-family:\s*'Public Sans', Arial, sans-serif/, style);
  assert.match(body, /color:\s*#14213D/i);
});

test("the email says tomoshi, never dolores as the product's name", () => {
  const all = text.join(" ");
  assert.match(all, /entrar a tomoshi\./);
  assert.doesNotMatch(`${subject} ${all} ${html}`, /\bdolores\b/i);
});

// WCAG relative luminance and contrast of two #RRGGBB colours.
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("every text colour reaches WCAG AA (4.5:1) on its own background", () => {
  let checked = 0;
  for (const [, style] of body.matchAll(/style="([^"]*)"/g)) {
    const color = /(?:^|;)\s*color:\s*(#[0-9a-f]{6})/i.exec(style);
    if (!color) continue;
    const ground = /background-color:\s*(#[0-9a-f]{6})/i.exec(style);
    assert.ok(ground, style);
    assert.ok(contrast(color[1], ground[1]) >= 4.5, `${color[1]} on ${ground[1]}: ${contrast(color[1], ground[1]).toFixed(2)}`);
    checked += 1;
  }
  assert.ok(checked >= 4, `${checked} styles with a colour`);
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
