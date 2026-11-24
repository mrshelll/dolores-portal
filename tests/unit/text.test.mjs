import { test } from "node:test";
import assert from "node:assert/strict";
import { T, TOPICS, topicName, formatDate, fill, formatDayMonth, formatUsd, formatNumber } from "../../js/text.js";

// Nothing internal is ever visible (FUN-45 and the plan's constraints), nor the words of the dashboards the page is
// modelled on («check», «deploy», «build»). Whole words only: «lente» inside «excelente» is not jargon. \p{L} and \p{N} make accented letters count as word characters. «Corrida» left this list with tomoshi:
// the page now has a «Corridas» tab and shows each run's line (the tomoshi spec), so the word is the page's own.
const SLUGS = [...TOPICS.keys()].filter((key) => typeof key === "string");
const WORDS = ["tier", "tiers", "lente", "lentes", "score", "scores", "underserved", "check", "checks", "deploy", "build", ...SLUGS];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const JARGON = new RegExp(String.raw`(?<![\p{L}\p{N}_-])(?:dol-|(?:${WORDS.map(escape).join("|")})(?![\p{L}\p{N}_-]))`, "iu");

const visible = () => [
  ...Object.entries(T).map(([key, value]) => [`T.${key}`, value]),
  ...[...TOPICS].map(([key, value]) => [`TOPICS[${key}]`, value]),
];

test("the jargon matcher matches whole words only", () => {
  for (const s of ["lente", "Las lentes", "el tier 1", "score: 3", "dol-0027", "documents-for-ai", "3 checks", "Check", "el deploy", "Build"]) assert.match(s, JARGON, s);
  for (const s of ["excelente", "relevante", "dolores", "Dolores de la semana", "frontier", "scoreboard", "lentejas", "checkout", "builder"]) assert.doesNotMatch(s, JARGON, s);
});

test("no visible string in T contains dol-, tier, lente, score, underserved, check, deploy, build or a territory slug", () => {
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

// ---- tomoshi ------------------------------------------------------------------------------------

test("the product is called tomoshi: the brand, its link and the tab title", () => {
  assert.equal(T.brand, "tomoshi");
  assert.match(T.brandHome, /^tomoshi\b/);
  assert.equal(fill(T.pageTitle, { title: "Para decidir" }), "Para decidir · tomoshi");
});

// «dolores» is still the Spanish noun (the pains: «los dolores de la semana», «3 dolores», «Sin dolores aún»), never the
// product's name. Every «dolores» must follow a word that makes it the noun.
const NOUN_BEFORE = new Set(["los", "unos", "sus", "tus", "más", "demás", "hay", "sin", "{count}"]);
test("no visible string uses «dolores» as the product's name", () => {
  const word = /(\S+)\s+dolores(?![\p{L}\p{N}_-])|(?<![\p{L}\p{N}_-])dolores(?![\p{L}\p{N}_-])/giu;
  for (const [where, value] of visible()) {
    for (const match of value.matchAll(word)) {
      const before = match[1] ? match[1].toLowerCase() : null;
      assert.ok(before !== null && (NOUN_BEFORE.has(before) || /^\d/.test(before)), `${where}: ${value}`);
    }
  }
  assert.doesNotMatch(T.noAccess, /equipo de dolores/);
});

test("every label the shell, the home and the line use exists", () => {
  const keys = [
    "tabsLabel", "tabWeek", "tabCatalog", "tabRuns", "brandLampGreen", "brandLampAmber", "brandLampRed",
    "metaWeek", "metaNiche", "metaCost", "homeTitle", "leadNoPending", "leadPendingOne", "leadPendingMany",
    "leadOrderWinnerWeighty", "leadOrderWinner", "leadOrderWeighty", "decideEmpty", "seeCatalog", "boardLabel",
    "boardWeighty", "boardInterested", "boardWatching", "boardDiscarded", "whoLabel", "tagWinner", "tagWinnerDated",
    "tagFresh", "noMarksYet", "commentAction", "stationInterested", "markSavedInterested", "markRemoved",
    "lineLabel", "lineTitle", "lineTitleOld", "lineTitleOldUndated", "lineNoTrace", "lineOlderNote",
    "lineNoRun", "lineStripCutsOne", "lineStripCuts", "lineStripClean", "durationMinutes", "durationHours", "durationShort",
    "costUsd", "costCards", "costLabel", "stageOk", "stageCut", "stageNoData", "stageCap", "sourcesLabel", "sourceOk",
    "sourceTruncated", "sourceEmpty", "sourceFailed", "sourceUnknown", "sourceOf", "otherCuts",
    "lineColNumber", "lineColNumberFull", "lineColStage", "lineColCount", "lineColCountFull", "lineColCap", "lineColFlag",
    "lineNoCap", "lineNoCount", "sourceRowLabel", "catalogTitle",
    "catalogLoading", "runsTitle", "runsLead", "runsLoading", "runsError", "runsEmpty", "runMissing", "statusOut",
    "runTitleDated", "runTitleUndated", "runStateComplete", "runStateIncomplete", "runStateIngestOnly", "runStateFailed",
    "runStateUnknown", "costTotal", "cutsOtherMany", "duelLine", "techTitle", "techLead",
    "brandShortComplete", "brandShortPartial", "brandShortOld", "brandShortFailed", "brandShortNone",
    "catalogEmptyWeighty", "catalogEmptyInterested", "catalogEmptyWatching", "catalogEmptyDiscarded",
  ];
  for (const key of keys) assert.equal(typeof T[key], "string", `T.${key} is missing`);
  assert.match(T.lineTitleOld, /\{date\}/);
  assert.equal(T.tabWeek, "Esta semana");
  assert.equal(T.tabCatalog, "Catálogo");
  assert.equal(T.tabRuns, "Corridas");
  assert.equal(T.analysisNone, "Sin análisis guardado para este dolor");
});

test("formatDayMonth: «16 de noviembre», on its own day in any time zone; \"\" for nothing", () => {
  assert.equal(formatDayMonth("2026-11-16"), "16 de noviembre");
  assert.equal(formatDayMonth("2026-11-16T23:30:00Z").length > 0, true);
  assert.equal(formatDayMonth(null), "");
  assert.equal(formatDayMonth("nope"), "");
});

test("formatUsd: two decimals with a comma; null for what is not a number", () => {
  assert.equal(formatUsd(3.6649), "3,66");
  assert.equal(formatUsd(0), "0,00");
  assert.equal(formatUsd(null), null);
  assert.equal(formatUsd("2"), null);
  assert.equal(formatUsd(Number.NaN), null);
});

// Intl «es» does not group four digits (1234 stays «1234»), so the grouping is only seen from five.
test("formatNumber groups thousands the Spanish way", () => {
  assert.equal(formatNumber(12345), "12.345");
  assert.equal(formatNumber(617), "617");
  assert.equal(formatNumber(1234), "1234");
});

// The page calls each weekly run «corrida» (the «Corridas» tab, the run's line): never «revisión» for the same thing.
// The verb stays («Revisamos 480 publicaciones», «revisa tu conexión»): only the noun is checked.
test("no visible string calls a run «revisión»", () => {
  for (const [where, value] of visible()) assert.doesNotMatch(value, /(?<![\p{L}\p{N}_-])revisi(?:ón|ones)(?![\p{L}\p{N}_-])/iu, `${where}: ${value}`);
  assert.equal(T.keyRunsValue, "{count} corridas");
});

// The checks' copy is pinned word for word (the plan's brief), and the thresholds never live here: «Mínimo {n}» takes
// the gate's own number. Singular and plural are two strings, chosen by the number.
test("the checks' copy", () => {
  assert.equal(T.analysisCaption, "Análisis");
  assert.equal(T.analysisTestimonies, "Testimonios");
  assert.equal(T.analysisTiers, "Tipos de fuente");
  assert.equal(T.analysisSurvivals, "Ataques resistidos");
  assert.equal(T.analysisStatement, "Descrito por quien lo sufre");
  assert.equal(fill(T.analysisRange, { n: 3 }), "Mínimo 3");
  assert.equal(fill(T.analysisRangeOf, { n: 3, total: 5 }), "Mínimo 3 de 5");
  assert.equal(T.analysisIn, "Dentro del rango");
  assert.equal(T.analysisOut, "Fuera del rango");
  assert.equal(fill(T.analysisHeld, { held: 4, total: 5 }), "4 de 5");
  assert.equal(fill(T.analysisIncomplete, { n: 3, total: 5 }), "Sin resultado completo (3 de 5 respondieron)");
  assert.equal(T.analysisMissing, "Falta");
  assert.equal(T.analysisPerCountry, "Contado dentro de un solo país");
  assert.equal(T.checkTestimoniesOne, "1 testimonio");
  assert.equal(fill(T.checkTestimonies, { n: 4 }), "4 testimonios");
  assert.equal(T.checkTiersOne, "1 tipo de fuente");
  assert.equal(fill(T.checkTiers, { n: 2 }), "2 tipos de fuente");
  assert.equal(fill(T.checkAttacks, { held: 4, total: 5 }), "4 de 5 ataques");
  assert.equal(fill(T.checkAttacksOne, { held: 1 }), "1 de 1 ataque");
  assert.equal(T.checkMissingOne, "falta 1");
  assert.equal(fill(T.checkMissing, { n: 2 }), "faltan 2");
  assert.equal(T.checkStatement, "Falta cómo lo cuenta quien lo sufre");
});
