import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextMark, keyData, validComment, COMMENT_MAX, cardTitle, painStatus, statusLabel, cardSections, quoteView, safeUrl,
  markLines, commentItems, sendErrorKind, draftKey, draftValue, readDraft, isDraftKey, discardNote, markErrorText,
  commentErrorText, markButtonLabels, ownMarkLine, lineNoticeText,
} from "../../js/detail.js";
import { loadPain, setMark, addComment, deleteComment } from "../../js/api.js";
import { buildSections, classifyError } from "../../js/model.js";
import { T, TOPICS, formatDate } from "../../js/text.js";
import { h } from "../../js/dom.js";

// Fixtures in the base's shapes, with invented texts (this repository is public and carries no catalog data).
const PEOPLE = [
  { email: "miguel@example.com", name: "Miguel" },
  { email: "jaime@example.com", name: "Jaime" },
  { email: "fabio@example.com", name: "Fabio" },
];

const FULL = {
  kind: "full",
  line: {
    title: "Cobrar las cuotas del club a tiempo",
    who: "Tesoreros voluntarios de clubes deportivos pequeños que cobran una cuota mensual a decenas de familias.",
    what_hurts: "Saber quién pagó la cuota del mes sigue exigiendo cruzar a mano el banco con una lista, y se escapan cobros.",
  },
  full: {
    what_hurts: "Cada mes el tesorero cruza a mano los movimientos del banco con la lista de socios.",
    buyer: { text: "Quien paga parece ser el club.", known: true, sources: ["aviso-2002", "foro-1001"] },
    solution: { text: "Una herramienta que lea los movimientos del banco y marque quién pagó.", sources: ["lens:existing-solution"] },
    why_real: {
      text: "Cuatro personas distintas lo cuentan.",
      quotes: [
        { url: "https://example.org/foro/clubes/1001", hash: "foro-1001", original: "I spend a whole evening matching bank transfers by hand", translation: "paso una tarde entera cruzando a mano las transferencias del banco" },
        { url: "https://example.com/es", hash: "foro-1", original: "Ya está en español.", translation: "Ya está en español." },
      ],
    },
    validate: "Llamar a entre 5 y 10 tesoreros esta semana.",
    risk: { lens: null, text: "Muchos clubes tienen poco dinero." },
    team_view: null,
    glossary: [
      { term: "Conciliar", meaning: "Comprobar que los pagos del banco coinciden con los esperados." },
      { term: "Domiciliación", meaning: "Orden para que el banco cobre cada mes una cantidad." },
    ],
  },
  trend: { runs: 8, direction: "steady", territory: "accounting-automation", last_evidence: "2026-09-18" },
  review: { plain: true, round: 1, offending: [] },
  run_id: "cards-2026-11-10", pain_id: "dol-0027", version: 2, language: "es", source_hash: "x",
};

const LINE = {
  kind: "line",
  line: {
    who: "Quienes organizan las excursiones de un colegio; todavía no sabemos quién paga por esto.",
    what_hurts: "Hay que juntar a mano la autorización firmada de cada familia para cada excursión.",
  },
  trend: { runs: 1, direction: "new", territory: null, last_evidence: "2026-08-18" },
  review: null, run_id: "cards-2026-11-10", pain_id: "dol-0002", version: 1, language: "es", source_hash: "y",
};

const PAIN_27 = { id: "dol-0027", territory: "accounting-automation", status: "alive", team_discard: null };
const PAIN_02 = { id: "dol-0002", territory: null, status: "watching", team_discard: null };

const mark = (painId, author, value, created_at = "2026-11-10T22:10:00Z") => ({ pain_id: painId, author, mark: value, created_at });

// The same jargon matcher as text.test.mjs: nothing internal may reach the screen.
const SLUGS = [...TOPICS.keys()].filter((key) => typeof key === "string");
const WORDS = ["tier", "tiers", "lente", "lentes", "score", "scores", "underserved", ...SLUGS];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const JARGON = new RegExp(String.raw`(?<![\p{L}\p{N}_-])(?:dol-|(?:${WORDS.map(escape).join("|")})(?![\p{L}\p{N}_-]))`, "iu");

// ---- the four tests the brief names ----------------------------------------------------------------------------------

test("nextMark toggles and switches", () => {
  assert.equal(nextMark(null, "interested"), "interested");
  assert.equal(nextMark(null, "discarded"), "discarded");
  assert.equal(nextMark("interested", "interested"), null);
  assert.equal(nextMark("discarded", "discarded"), null);
  assert.equal(nextMark("interested", "discarded"), "discarded");
  assert.equal(nextMark("discarded", "interested"), "interested");
  assert.equal(nextMark(undefined, "interested"), "interested");
  assert.equal(nextMark("something-old", "discarded"), "discarded");
  // An unknown button changes nothing; an unknown current mark reads as none.
  assert.equal(nextMark("interested", "maybe"), "interested");
  assert.equal(nextMark("something-old", "maybe"), null);
});

test("keyData never shows a slug or an id", () => {
  const cases = [
    [PAIN_27, FULL],
    [PAIN_02, LINE],
    [{ id: "dol-0099", territory: "documents-for-ai", status: "watching" }, { ...LINE, trend: { runs: 3, direction: "rising", territory: "documents-for-ai", last_evidence: "2026-10-01" } }],
    [{ id: "dol-0100", territory: "a-territory-the-page-does-not-know", status: "watching" }, LINE],
    [null, { ...LINE, trend: { runs: "7", direction: "sideways", last_evidence: "not a date" } }],
    [PAIN_02, { ...LINE, trend: null }],
  ];
  for (const [pain, card] of cases) {
    for (const item of keyData(pain, card)) {
      for (const text of [item.label, item.value]) {
        assert.equal(typeof text, "string");
        assert.ok(text.trim(), "no empty key data");
        assert.doesNotMatch(text, JARGON, `${JSON.stringify(item)}`);
      }
    }
  }
  assert.deepEqual(keyData(PAIN_27, FULL), [
    { label: "Cómo viene", value: "Igual que la semana pasada", alone: true },
    { label: "Última evidencia", value: formatDate("2026-09-18"), alone: false },
    { label: "Tema", value: "Automatizar la contabilidad", alone: true },
    { label: "Visto en", value: "8 revisiones", alone: false },
  ]);
  // One run: no «Visto en»; no territory: «Sin tema».
  assert.deepEqual(keyData(PAIN_02, LINE).map((i) => i.value), ["Dolor nuevo", formatDate("2026-08-18"), "Sin tema"]);
  assert.deepEqual(keyData({ id: "dol-0100", territory: "nope" }, LINE).map((i) => i.value).at(-1), "Otro tema");
  // A trend the page cannot read leaves out what it cannot say, and the topic still stands.
  assert.deepEqual(keyData(null, { ...LINE, trend: { runs: "7", direction: "sideways", last_evidence: "not a date" } }), [
    { label: "Tema", value: "Otro tema", alone: true },
  ]);
});

test("validComment refuses empty and 501 characters", () => {
  assert.equal(COMMENT_MAX, 500);
  for (const empty of ["", "   ", "\n\t  \n", null, undefined, 42]) {
    const result = validComment(empty);
    assert.equal(result.ok, false, JSON.stringify(empty));
    assert.equal(result.error, "empty");
  }
  const long = validComment("a".repeat(501));
  assert.deepEqual(long, { ok: false, error: "too-long", length: 501 });
  assert.deepEqual(validComment("a".repeat(500)), { ok: true, error: null, length: 500 });
  // Trimmed first, as add_comment does.
  assert.deepEqual(validComment(`  ${"a".repeat(500)}\n`), { ok: true, error: null, length: 500 });
  assert.deepEqual(validComment("  x "), { ok: true, error: null, length: 1 });
  // Counted by characters, as the base's char_length: 500 emoji are 1000 UTF-16 units but 500 characters.
  assert.equal(validComment("😀".repeat(500)).ok, true);
  assert.equal(validComment("😀".repeat(501)).error, "too-long");
});

// A minimal document for dom.js: elements keep their children, text nodes keep their text, and setting innerHTML
// throws, so a test fails if anything ever parses markup.
function fakeDocument() {
  class FakeNode {}
  class FakeText extends FakeNode {
    constructor() { super(); this.nodeType = 3; this.textContent = ""; }
  }
  class FakeElement extends FakeNode {
    constructor(tag) { super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.listeners = {}; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    set innerHTML(_) { throw new Error("innerHTML must never be used"); }
    get textContent() { return this.children.map((c) => c.textContent).join(""); }
  }
  return {
    Node: FakeNode,
    document: { createElement: (tag) => new FakeElement(tag), createTextNode: (t) => Object.assign(new FakeText(), { textContent: t }) },
  };
}

test("a comment body with <script> stays text", () => {
  const body = '<script>alert("hola")</script><img src=x onerror=alert(1)> & «bien»';
  const [item] = commentItems([{ id: 7, pain_id: "dol-0027", author: "fabio@example.com", body, created_at: "2026-11-10T22:15:00Z" }], PEOPLE, "miguel@example.com");
  assert.equal(item.body, body, "the body is passed on as it came, never escaped or parsed");

  const fake = fakeDocument();
  const saved = { document: globalThis.document, Node: globalThis.Node };
  globalThis.document = fake.document;
  globalThis.Node = fake.Node;
  try {
    const p = h("p", { class: "comment-body" }, item.body);
    assert.equal(p.children.length, 1);
    assert.equal(p.children[0].nodeType, 3, "a single text node");
    assert.equal(p.textContent, body);
    assert.equal(p.children.filter((c) => c.nodeType === 1).length, 0, "no element was created from the markup");
  } finally {
    globalThis.document = saved.document;
    globalThis.Node = saved.Node;
  }
});

// ---- the title, the status tag and the sections ----------------------------------------------------------------------

test("cardTitle is the line's title, or what hurts on a card from before titles", () => {
  assert.equal(cardTitle(FULL), "Cobrar las cuotas del club a tiempo");
  assert.equal(cardTitle(LINE), LINE.line.what_hurts);
  assert.equal(cardTitle({ ...LINE, line: { ...LINE.line, title: "   " } }), LINE.line.what_hurts);
  assert.equal(cardTitle({ kind: "line", line: { who: "x" } }), null);
  assert.equal(cardTitle({ kind: "line" }), null);
  assert.equal(cardTitle(null), null);
});

test("the status tag says what the home says, for every placement", () => {
  const cards = [{ pain_id: "dol-0027", card: FULL }, { pain_id: "dol-0002", card: LINE }, { pain_id: "dol-0030", card: LINE },
    { pain_id: "dol-0031", card: LINE }, { pain_id: "dol-0040", card: LINE }, { pain_id: "dol-0041", card: LINE }];
  const pains = [
    PAIN_27,
    PAIN_02,
    // Discarded by the team, and one person still keeps the discard.
    { id: "dol-0030", territory: null, status: "manually-discarded", team_discard: { previous_status: "alive" } },
    // Discarded by the team, its discard marks gone: it stands on its previous status until the next run.
    { id: "dol-0031", territory: null, status: "manually-discarded", team_discard: { previous_status: "watching" } },
    // Dead, kept by an «interested» mark.
    { id: "dol-0040", territory: null, status: "dead", team_discard: null },
    // Dead and unmarked: not in any list.
    { id: "dol-0041", territory: null, status: "dead", team_discard: null },
  ];
  const marks = [
    mark("dol-0030", "jaime@example.com", "discarded"),
    mark("dol-0040", "miguel@example.com", "interested"),
    // Review Focus 2: one «Descartado» and one «Nos interesa» on the same pain keep it in play.
    mark("dol-0002", "jaime@example.com", "discarded"),
    mark("dol-0002", "miguel@example.com", "interested"),
  ];
  const sections = buildSections({ pains, cards, marks, people: PEOPLE });
  const placed = new Map(Object.entries(sections).flatMap(([key, items]) => items.map((i) => [i.id, key])));
  for (const pain of pains) {
    const own = marks.filter((m) => m.pain_id === pain.id);
    assert.equal(painStatus(pain, own), placed.get(pain.id) ?? null, pain.id);
  }
  assert.equal(statusLabel("weighty"), "Con peso para trabajar");
  assert.equal(statusLabel("watching"), "En observación");
  assert.equal(statusLabel("interested"), "Nos interesa");
  assert.equal(statusLabel("discarded"), "Descartado por el equipo");
  assert.equal(statusLabel(null), null);
});

test("a full card has its sections in order; the team's view only when there is one", () => {
  const ids = (card) => cardSections(card).map((s) => s.id);
  assert.deepEqual(ids(FULL), ["dolor", "comprador", "solucion", "pruebas", "validar", "riesgo", "glosario", "marcas"]);
  assert.deepEqual(cardSections(FULL).map((s) => s.title), [
    "Qué le duele a la gente", "A quién se lo venderíamos", "Qué podríamos construir", "Por qué creemos que es real",
    "Cómo validarlo esta semana", "Lo que podría salir mal", "Palabras técnicas", "Marcas y comentarios",
  ]);
  const withView = { ...FULL, full: { ...FULL.full, team_view: "Al equipo le parece prometedor." } };
  const view = cardSections(withView).find((s) => s.id === "equipo");
  assert.equal(view.title, "Lo que opina el equipo");
  assert.deepEqual(view.paragraphs, ["Al equipo le parece prometedor."]);
  assert.deepEqual(ids(withView).slice(5, 8), ["riesgo", "equipo", "glosario"]);
  // A blank view, an empty glossary and a missing risk leave their sections out, never empty.
  const thin = { ...FULL, full: { ...FULL.full, team_view: "  ", glossary: [], risk: { lens: "pricing", text: "" } } };
  assert.deepEqual(ids(thin), ["dolor", "comprador", "solucion", "pruebas", "validar", "marcas"]);
  // Nothing internal goes out: no sources, no lens.
  assert.doesNotMatch(JSON.stringify(cardSections({ ...FULL, full: { ...FULL.full, risk: { lens: "pricing", text: "Riesgo." } } })), /lens|pricing|foro-|aviso-/);
});

test("a line card has what hurts, who, and the marks", () => {
  const sections = cardSections(LINE);
  assert.deepEqual(sections.map((s) => [s.id, s.title]), [
    ["dolor", "Qué le duele a la gente"], ["quien", "A quién le duele"], ["marcas", "Marcas y comentarios"],
  ]);
  assert.deepEqual(sections[0].paragraphs, [LINE.line.what_hurts]);
  assert.deepEqual(sections[1].paragraphs, [LINE.line.who]);
  // A «full» card that lost its full part reads as a line card.
  assert.deepEqual(cardSections({ ...FULL, full: null }).map((s) => s.id), ["dolor", "quien", "marcas"]);
});

test("a quote is its translation, with the original only when it differs and a link only to http(s)", () => {
  assert.deepEqual(quoteView(FULL.full.why_real.quotes[0]), {
    text: "paso una tarde entera cruzando a mano las transferencias del banco",
    original: "I spend a whole evening matching bank transfers by hand",
    url: "https://example.org/foro/clubes/1001",
  });
  assert.deepEqual(quoteView(FULL.full.why_real.quotes[1]), { text: "Ya está en español.", original: null, url: "https://example.com/es" });
  assert.equal(quoteView({ translation: " igual ", original: "igual" }).original, null);
  assert.equal(quoteView({ translation: "x", original: "y", url: "javascript:alert(1)" }).url, null);
  assert.equal(quoteView({ translation: "x", original: "y", url: "/relative" }).url, null);
  assert.equal(quoteView({ translation: "", original: "only the original" }).text, "only the original");
  assert.equal(quoteView({ translation: "", original: "" }), null);
  assert.equal(quoteView(null), null);
  assert.equal(safeUrl("http://example.com/a b"), "http://example.com/a%20b");
  assert.equal(safeUrl("data:text/html,hi"), null);
  assert.equal(safeUrl(42), null);
});

// ---- marks and comments ----------------------------------------------------------------------------------------------

test("markLines gives one line per person, by name, with the mark and its day", () => {
  const lines = markLines([
    mark("dol-0027", "Miguel@Example.com", "interested", "2026-11-10T22:10:00Z"),
    mark("dol-0027", "jaime@example.com", "discarded", "2026-11-09T12:00:00Z"),
    mark("dol-0027", "ana@example.org", "interested", null),
    mark("dol-0027", "fabio@example.com", "maybe"),
  ], PEOPLE);
  assert.deepEqual(lines.map((l) => l.text), [
    "ana@example.org: Nos interesa",
    `Jaime: Descartado · ${formatDate("2026-11-09T12:00:00Z")}`,
    `Miguel: Nos interesa · ${formatDate("2026-11-10T22:10:00Z")}`,
  ]);
  assert.deepEqual(markLines(null, PEOPLE), []);
});

test("commentItems puts the newest first, names the author and knows your own, ignoring case", () => {
  const items = commentItems([
    { id: 1, pain_id: "dol-0027", author: "fabio@example.com", body: "Primero.", created_at: "2026-11-10T22:15:00Z" },
    { id: 3, pain_id: "dol-0027", author: "MIGUEL@example.com", body: "Tercero.", created_at: "2026-11-11T08:00:00Z" },
    { id: 2, pain_id: "dol-0027", author: "nadie@example.org", body: "Segundo.", created_at: "2026-11-11T08:00:00Z" },
    { id: 4, pain_id: "dol-0027", author: "fabio@example.com", body: 12, created_at: "2026-11-12T08:00:00Z" },
    null,
  ], PEOPLE, " Miguel@Example.com ");
  assert.deepEqual(items.map((i) => [i.id, i.name, i.own]), [[3, "Miguel", true], [2, "nadie@example.org", false], [1, "Fabio", false]]);
  assert.equal(items[0].date, formatDate("2026-11-11T08:00:00Z"));
  assert.equal(commentItems([{ id: 1, author: "a@example.org", body: "x", created_at: "2026-11-10T00:00:00Z" }], [], "").at(0).own, false);
});

test("a send error says what kind it is: refused text, a pain gone, or the shared kinds", () => {
  assert.equal(sendErrorKind({ code: "22023", source: "add_comment", status: 400 }), "invalid");
  assert.equal(sendErrorKind({ code: "P0002", source: "delete_comment", status: 400 }), "missing");
  assert.equal(sendErrorKind({ code: "PGRST303", source: "add_comment", status: 401 }), "expired");
  assert.equal(sendErrorKind({ code: "", source: "set_mark", status: 401 }), "expired");
  assert.equal(sendErrorKind({ code: "PGRST301", source: "set_mark" }), "expired");
  assert.equal(sendErrorKind(new TypeError("Failed to fetch")), "network");
  assert.equal(sendErrorKind({ code: "XX000", source: "set_mark" }), "other");
  assert.equal(sendErrorKind(null), "other");
});

test("a 42501 from set_mark, add_comment or delete_comment is «no access», like week_summary's", () => {
  for (const source of ["set_mark", "add_comment", "delete_comment", "week_summary"]) {
    assert.equal(classifyError({ code: "42501", source, status: 403 }), "no-access", source);
    assert.equal(sendErrorKind({ code: "42501", source, status: 403 }), "no-access", source);
  }
  for (const source of ["pains", "pain_cards", "marks", "comments", "people"]) {
    assert.equal(classifyError({ code: "42501", source, status: 403 }), "other", source);
  }
});

// ---- the kept comment (Review Focus 3) -------------------------------------------------------------------------------

test("a kept comment comes back only for the same person, and a bad one is ignored", () => {
  const key = draftKey("dol-0027");
  assert.ok(isDraftKey(key));
  assert.ok(!isDraftKey("dolores-portal.pending-sign-in"));
  assert.notEqual(key, draftKey("dol-0002"));
  const raw = draftValue("Miguel@Example.com", "Conozco <b>dos</b> clubes.");
  assert.equal(readDraft(raw, "miguel@example.com"), "Conozco <b>dos</b> clubes.");
  assert.equal(readDraft(raw, "jaime@example.com"), null);
  assert.equal(readDraft(raw, ""), null);
  assert.equal(readDraft(draftValue("miguel@example.com", "   "), "miguel@example.com"), null);
  for (const bad of [null, "", "{", "[]", "42", JSON.stringify({ email: "miguel@example.com" }), JSON.stringify({ email: 1, text: "x" })]) {
    assert.equal(readDraft(bad, "miguel@example.com"), null, String(bad));
  }
});

// ---- api.js: the pain's reads and the three writes -------------------------------------------------------------------

// A fake supabase-js: from().select() is a thenable builder with eq(); rpc() resolves. Answers are keyed by table or
// by "rpc:<name>"; an Error rejects, as a failed fetch does.
function fakeClient(answers = {}) {
  const calls = [];
  const reply = (key) => {
    const answer = answers[key];
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve({ status: 200, error: null, data: null, ...answer });
  };
  return {
    calls,
    rpc(name, args) { calls.push(["rpc", name, args]); return reply(`rpc:${name}`); },
    from(table) {
      const call = ["select", table, null, []];
      const builder = {
        select(columns) { call[2] = columns; calls.push(call); return builder; },
        eq(column, value) { call[3].push([column, value]); return builder; },
        then(resolve, reject) { return reply(table).then(resolve, reject); },
      };
      return builder;
    },
  };
}

test("loadPain reads the one pain, its card, marks and comments, and everyone's names", async () => {
  const client = fakeClient({
    pains: { data: [PAIN_27] },
    pain_cards: { data: [{ pain_id: "dol-0027", kind: "full", card: FULL }] },
    marks: { data: [mark("dol-0027", "miguel@example.com", "interested")] },
    comments: { data: [{ id: 1, pain_id: "dol-0027", author: "fabio@example.com", body: "Hola.", created_at: "2026-11-10T22:15:00Z" }] },
    people: { data: PEOPLE },
  });
  const data = await loadPain(client, "dol-0027");
  assert.deepEqual(data.pain, PAIN_27);
  assert.deepEqual(data.card, FULL);
  assert.equal(data.marks.length, 1);
  assert.equal(data.comments.length, 1);
  assert.equal(data.people.length, 3);
  const sorted = [...client.calls].sort((a, b) => a[1].localeCompare(b[1]));
  assert.deepEqual(sorted, [
    ["select", "comments", "*", [["pain_id", "dol-0027"]]],
    ["select", "marks", "*", [["pain_id", "dol-0027"]]],
    ["select", "pain_cards", "pain_id,kind,card", [["pain_id", "dol-0027"]]],
    ["select", "pains", "id,territory,status,team_discard:doc->team_discard", [["id", "dol-0027"]]],
    ["select", "people", "*", []],
  ]);
});

test("loadPain is null for an unknown pain, a pain without a card, or a card with nothing to title it", async () => {
  assert.equal(await loadPain(fakeClient({ pains: { data: [] } }), "dol-9999"), null);
  assert.equal(await loadPain(fakeClient({ pains: { data: [PAIN_02] }, pain_cards: { data: [] } }), "dol-0002"), null);
  const untitled = { pain_id: "dol-0002", kind: "line", card: { kind: "line", line: { who: "Alguien." } } };
  assert.equal(await loadPain(fakeClient({ pains: { data: [PAIN_02] }, pain_cards: { data: [untitled] } }), "dol-0002"), null);
  const line = await loadPain(fakeClient({ pains: { data: [PAIN_02] }, pain_cards: { data: [{ pain_id: "dol-0002", kind: "line", card: LINE }] } }), "dol-0002");
  assert.deepEqual([line.marks, line.comments, line.people], [[], [], []]);
});

test("loadPain throws a refused read with its status and source", async () => {
  await assert.rejects(loadPain(fakeClient({ comments: { status: 401, error: { code: "PGRST303", message: "JWT expired" } } }), "dol-0027"),
    (error) => error.status === 401 && error.source === "comments" && classifyError(error) === "expired");
  await assert.rejects(loadPain(fakeClient({ marks: { status: 403, error: { code: "42501", message: "denied" } } }), "dol-0027"),
    (error) => error.source === "marks" && classifyError(error) === "other");
  const offline = new TypeError("Failed to fetch");
  await assert.rejects(loadPain(fakeClient({ pains: offline }), "dol-0027"), (error) => error === offline && classifyError(error) === "network");
});

test("setMark, addComment and deleteComment call their RPCs and tag a refusal with its source", async () => {
  const client = fakeClient({ "rpc:add_comment": { data: 12 } });
  await setMark(client, "dol-0027", "interested");
  await setMark(client, "dol-0027", null);
  assert.equal(await addComment(client, "dol-0027", "  Hola  "), 12);
  await deleteComment(client, 12);
  assert.deepEqual(client.calls, [
    ["rpc", "set_mark", { p_pain_id: "dol-0027", p_mark: "interested" }],
    ["rpc", "set_mark", { p_pain_id: "dol-0027", p_mark: null }],
    ["rpc", "add_comment", { p_pain_id: "dol-0027", p_body: "  Hola  " }],
    ["rpc", "delete_comment", { p_id: 12 }],
  ]);
  const refusing = fakeClient({
    "rpc:set_mark": { status: 403, error: { code: "42501", message: "set_mark: not a member" } },
    "rpc:add_comment": { status: 400, error: { code: "22023", message: "add_comment: the body must have 1 to 500 characters" } },
    "rpc:delete_comment": { status: 400, error: { code: "P0002", message: "delete_comment: no comment 3 of yours" } },
  });
  await assert.rejects(setMark(refusing, "dol-0027", "discarded"), (e) => e.source === "set_mark" && sendErrorKind(e) === "no-access");
  await assert.rejects(addComment(refusing, "dol-0027", "x".repeat(600)), (e) => e.source === "add_comment" && sendErrorKind(e) === "invalid");
  await assert.rejects(deleteComment(refusing, 3), (e) => e.source === "delete_comment" && sendErrorKind(e) === "missing");
});

// ---- fix round: what the page says after a discard and after a failed write ------------------------------------------

test("discardNote says the run drops the pain only when it is effectively discarded", () => {
  const alone = [mark("dol-0027", "miguel@example.com", "discarded")];
  assert.equal(discardNote(PAIN_27, alone), T.discardedNote);
  assert.match(T.discardedNote, /^Lo descartaste\. La próxima revisión no lo volverá a presentar\./);
  // Someone else keeps it with «Nos interesa»: the run keeps the pain, and the page must not say otherwise.
  const kept = [...alone, mark("dol-0027", "jaime@example.com", "interested")];
  assert.equal(discardNote(PAIN_27, kept), T.discardedKept);
  assert.equal(T.discardedKept, "Lo descartaste, pero alguien del equipo lo marcó «Nos interesa», así que sigue en la lista.");
  // The same placement as the tag: a discard on a team-discarded pain stays a discard.
  const teamDiscarded = { id: "dol-0030", territory: null, status: "manually-discarded", team_discard: { previous_status: "alive" } };
  assert.equal(discardNote(teamDiscarded, [mark("dol-0030", "miguel@example.com", "discarded")]), T.discardedNote);
});

test("markErrorText: a pain gone says the mark was not saved and offers the way back", () => {
  assert.deepEqual(markErrorText("missing"), { text: "Este dolor ya no está en la lista y tu marca no se guardó.", back: true });
  assert.equal(T.markPainGone, "Este dolor ya no está en la lista y tu marca no se guardó.");
  assert.deepEqual(markErrorText("network"), { text: T.markOffline, back: false });
  assert.deepEqual(markErrorText("other"), { text: T.markError, back: false });
});

test("commentErrorText: a 22023 is always about the text (kept, and what to change), never «try again»", () => {
  const field = (kind, body) => commentErrorText(kind, body);
  // The page's own check and the base's 22023 give the same field error.
  assert.deepEqual(field("invalid", "x".repeat(501)), {
    place: "field", text: "Tu comentario tiene 501 caracteres y el máximo es 500. Lo que escribiste sigue aquí: acórtalo y vuelve a publicarlo.",
  });
  assert.deepEqual(field("invalid", "   "), { place: "field", text: T.commentEmpty });
  // The page let it through but the base refused it (a different trim or count): still about the text.
  const refused = field("invalid", "Un texto que la página aceptó.");
  assert.equal(refused.place, "field");
  assert.equal(refused.text, T.commentRefused);
  for (const text of [refused.text, field("invalid", "x".repeat(501)).text]) {
    assert.match(text, /sigue aquí/);
    assert.doesNotMatch(text, /inténtalo|intentarlo en un momento/i);
  }
  assert.match(T.commentRefused, /entre 1 y 500 caracteres/);
  // The rest go in the form's notice.
  assert.deepEqual(field("missing", "x"), { place: "notice", text: T.commentPainGone });
  assert.deepEqual(field("network", "x"), { place: "notice", text: T.commentOffline });
  assert.deepEqual(field("other", "x"), { place: "notice", text: T.commentError });
});

// ---- fix round 2 (rubric): the mark buttons say what they do, your own mark in words, the line card's notice ----------

test("markButtonLabels: each button says what pressing it does", () => {
  assert.deepEqual(markButtonLabels(null), { interested: "Marcar «Nos interesa»", discard: "Descartar" });
  assert.deepEqual(markButtonLabels("interested"), { interested: "Quitar «Nos interesa»", discard: "Descartar" });
  assert.deepEqual(markButtonLabels("discarded"), { interested: "Marcar «Nos interesa»", discard: "Quitar descarte" });
  assert.deepEqual(markButtonLabels("something-else"), markButtonLabels(null));
});

test("ownMarkLine says your own mark and its day, ignoring case in the email, or null without one", () => {
  const day = formatDate("2026-11-10T22:10:00Z");
  const marks = [mark("dol-0027", "Miguel@Example.com", "interested"), mark("dol-0027", "jaime@example.com", "discarded")];
  assert.equal(ownMarkLine(marks, "miguel@example.com"), `Marcaste «Nos interesa» el ${day}.`);
  assert.equal(ownMarkLine(marks, "jaime@example.com"), `Lo descartaste el ${day}.`);
  assert.equal(ownMarkLine(marks, "fabio@example.com"), null);
  assert.equal(ownMarkLine(marks, ""), null);
  assert.equal(ownMarkLine(null, "miguel@example.com"), null);
  assert.equal(ownMarkLine([mark("dol-0027", "miguel@example.com", "interested", "not a date")], "miguel@example.com"), "Marcaste «Nos interesa».");
  assert.equal(ownMarkLine([mark("dol-0027", "miguel@example.com", "discarded", null)], "miguel@example.com"), "Lo descartaste.");
  assert.equal(ownMarkLine([mark("dol-0027", "miguel@example.com", "maybe")], "miguel@example.com"), null);
});

test("lineNoticeText: a line card already marked «Nos interesa» says the next review writes its card", () => {
  assert.equal(lineNoticeText(PAIN_02, []), T.lineNotice);
  assert.match(T.lineNotice, /Si lo marcas «Nos interesa», la próxima revisión escribe su ficha completa\.$/);
  const interested = [mark("dol-0002", "jaime@example.com", "interested")];
  assert.equal(lineNoticeText(PAIN_02, interested), "Ya está marcado «Nos interesa». La próxima revisión, el lunes, escribe su ficha completa.");
  // The effective mark decides: one «Nos interesa» wins over a discard; a discard alone does not count; another pain's
  // mark does not count.
  assert.equal(lineNoticeText(PAIN_02, [...interested, mark("dol-0002", "fabio@example.com", "discarded")]), T.lineNoticeMarked);
  assert.equal(lineNoticeText(PAIN_02, [mark("dol-0002", "fabio@example.com", "discarded")]), T.lineNotice);
  assert.equal(lineNoticeText(PAIN_02, [mark("dol-0027", "jaime@example.com", "interested")]), T.lineNotice);
  assert.equal(lineNoticeText(null, interested), T.lineNotice);
});
