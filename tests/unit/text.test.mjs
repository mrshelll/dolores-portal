import { test } from "node:test";
import assert from "node:assert/strict";
import { T, TOPICS, topicName, formatDate, fill } from "../../js/text.js";

// Nothing internal is ever visible (FUN-45 and the plan's constraints). Whole words only: «lente» inside «excelente»
// is not jargon. \p{L} and \p{N} make accented letters count as word characters.
const SLUGS = [...TOPICS.keys()].filter((key) => typeof key === "string");
const WORDS = ["tier", "tiers", "lente", "lentes", "score", "scores", "underserved", "corrida", "corridas", ...SLUGS];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const JARGON = new RegExp(String.raw`(?<![\p{L}\p{N}_-])(?:dol-|(?:${WORDS.map(escape).join("|")})(?![\p{L}\p{N}_-]))`, "iu");

const visible = () => [
  ...Object.entries(T).map(([key, value]) => [`T.${key}`, value]),
  ...[...TOPICS].map(([key, value]) => [`TOPICS[${key}]`, value]),
];

test("the jargon matcher matches whole words only", () => {
  for (const s of ["lente", "Las lentes", "el tier 1", "score: 3", "dol-0027", "documents-for-ai"]) assert.match(s, JARGON, s);
  for (const s of ["excelente", "relevante", "dolores", "Dolores de la semana", "frontier", "scoreboard", "lentejas"]) assert.doesNotMatch(s, JARGON, s);
});

test("no visible string in T contains dol-, tier, lente, score, underserved, corrida or a territory slug", () => {
  for (const [where, value] of visible()) {
    assert.equal(typeof value, "string", `${where} is not a string`);
    assert.doesNotMatch(value, JARGON, `${where}: ${value}`);
  }
});

test("every visible string is non-empty and has no stray whitespace", () => {
  for (const [where, value] of visible()) {
    assert.ok(value.trim().length > 0, where);
    assert.equal(value, value.trim(), where);
  }
});

test("topicName gives each territory its plain name", () => {
  assert.equal(topicName("documents-for-ai"), "Preparar documentos para la IA");
  assert.equal(topicName("document-data-extraction"), "Sacar datos de documentos");
  assert.equal(topicName("accounting-automation"), "Automatizar la contabilidad");
  assert.equal(topicName("us-consumer-finance"), "Finanzas personales en EE. UU.");
  assert.equal(topicName("developer-tools"), "Herramientas para programadores");
  assert.equal(topicName(null), "Sin tema");
});

test("topicName(undefined) is «Otro tema»", () => {
  assert.equal(topicName(undefined), "Otro tema");
  assert.equal(topicName("a-new-territory"), "Otro tema");
  assert.equal(topicName("constructor"), "Otro tema");
  assert.equal(topicName("null"), "Otro tema");
});

test("formatDate uses the Spanish day, short month and year", () => {
  const expected = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(new Date(2026, 8, 18));
  assert.equal(formatDate("2026-09-18T15:00:00"), expected);
  assert.match(formatDate("2026-09-18T15:00:00"), /^18 sept\.? 2026$/);
});

test("formatDate keeps a date without time on its own day in any time zone", () => {
  // "2026-09-18" parses as UTC midnight; in Bogotá that is the 17th unless the date is read as UTC.
  assert.match(formatDate("2026-09-18"), /^18 sept\.? 2026$/);
});

test("formatDate returns an empty string for nothing or a bad date", () => {
  assert.equal(formatDate(null), "");
  assert.equal(formatDate(undefined), "");
  assert.equal(formatDate(""), "");
  assert.equal(formatDate("not a date"), "");
});

test("fill puts the values in their places and leaves unknown ones", () => {
  assert.equal(fill("Código de {length} números para {email}", { length: 8, email: "ana@example.com" }), "Código de 8 números para ana@example.com");
  assert.equal(fill("Hola {nombre}", {}), "Hola {nombre}");
});
