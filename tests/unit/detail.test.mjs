import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextMark, keyData, validComment, COMMENT_MAX, cardTitle, painStatus, statusLabel, cardSections, quoteView, safeUrl,
  markLines, commentItems, sendErrorKind, draftKey, draftValue, readDraft, isDraftKey, discardNote, markErrorText,
  commentErrorText, ownMarkLine, lineNoticeText, stationButtonLabels, stationStateText,
  evidenceBySource, attackRows, duelRows, titleMap, howWeGot,
} from "../../js/detail.js";
import { loadPain, setMark, addComment, deleteComment } from "../../js/api.js";
import { buildSections, classifyError } from "../../js/model.js";
import { T, TOPICS, formatDate } from "../../js/text.js";
import { h } from "../../js/dom.js";

// Fixtures in the base's shapes, with invented texts (this repository is public and carries no catalog data).
const PEOPLE = [
  { email: "carla@example.com", name: "Carla" },
  { email: "beto@example.com", name: "Beto" },
  { email: "ana@example.com", name: "Ana" },
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
    { label: "Visto en", value: "8 corridas", alone: false },
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
  const [item] = commentItems([{ id: 7, pain_id: "dol-0027", author: "ana@example.com", body, created_at: "2026-11-10T22:15:00Z" }], PEOPLE, "carla@example.com");
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
    mark("dol-0030", "beto@example.com", "discarded"),
    mark("dol-0040", "carla@example.com", "interested"),
    // Review Focus 2: one «Descartado» and one «Nos interesa» on the same pain keep it in play.
    mark("dol-0002", "beto@example.com", "discarded"),
    mark("dol-0002", "carla@example.com", "interested"),
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
  assert.deepEqual(ids(FULL), ["dolor", "comprador", "solucion", "pruebas", "validar", "riesgo", "glosario", "comentarios"]);
  assert.deepEqual(cardSections(FULL).map((s) => s.title), [
    "Qué le duele a la gente", "A quién se lo venderíamos", "Qué podríamos construir", "Por qué creemos que es real",
    "Cómo validarlo esta semana", "Lo que podría salir mal", "Palabras técnicas", "Comentarios",
  ]);
  const withView = { ...FULL, full: { ...FULL.full, team_view: "Al equipo le parece prometedor." } };
  const view = cardSections(withView).find((s) => s.id === "equipo");
  assert.equal(view.title, "Lo que opina el equipo");
  assert.deepEqual(view.paragraphs, ["Al equipo le parece prometedor."]);
  assert.deepEqual(ids(withView).slice(5, 8), ["riesgo", "equipo", "glosario"]);
  // A blank view, an empty glossary and a missing risk leave their sections out, never empty.
  const thin = { ...FULL, full: { ...FULL.full, team_view: "  ", glossary: [], risk: { lens: "pricing", text: "" } } };
  assert.deepEqual(ids(thin), ["dolor", "comprador", "solucion", "pruebas", "validar", "comentarios"]);
  // Nothing internal goes out: no sources, no lens.
  assert.doesNotMatch(JSON.stringify(cardSections({ ...FULL, full: { ...FULL.full, risk: { lens: "pricing", text: "Riesgo." } } })), /lens|pricing|foro-|aviso-/);
});

// Who suffers it is under the page's title (the row's own line), so no section says it again; the team's marks are with
// the actions, so the last section is the comments.
test("a line card has what hurts and the comments", () => {
  const sections = cardSections(LINE);
  assert.deepEqual(sections.map((s) => [s.id, s.title]), [["dolor", "Qué le duele a la gente"], ["comentarios", "Comentarios"]]);
  assert.deepEqual(sections[0].paragraphs, [LINE.line.what_hurts]);
  assert.ok(!JSON.stringify(sections).includes(LINE.line.who), "who suffers it is not a section");
  // A «full» card that lost its full part reads as a line card.
  assert.deepEqual(cardSections({ ...FULL, full: null }).map((s) => s.id), ["dolor", "comentarios"]);
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
    mark("dol-0027", "Carla@Example.com", "interested", "2026-11-10T22:10:00Z"),
    mark("dol-0027", "beto@example.com", "discarded", "2026-11-09T12:00:00Z"),
    mark("dol-0027", "ana@example.org", "interested", null),
    mark("dol-0027", "ana@example.com", "maybe"),
  ], PEOPLE);
  assert.deepEqual(lines.map((l) => l.text), [
    "ana@example.org: Nos interesa",
    `Beto: Descartado · ${formatDate("2026-11-09T12:00:00Z")}`,
    `Carla: Nos interesa · ${formatDate("2026-11-10T22:10:00Z")}`,
  ]);
  assert.deepEqual(markLines(null, PEOPLE), []);
});

test("commentItems puts the newest first, names the author and knows your own, ignoring case", () => {
  const items = commentItems([
    { id: 1, pain_id: "dol-0027", author: "ana@example.com", body: "Primero.", created_at: "2026-11-10T22:15:00Z" },
    { id: 3, pain_id: "dol-0027", author: "CARLA@example.com", body: "Tercero.", created_at: "2026-11-11T08:00:00Z" },
    { id: 2, pain_id: "dol-0027", author: "nadie@example.org", body: "Segundo.", created_at: "2026-11-11T08:00:00Z" },
    { id: 4, pain_id: "dol-0027", author: "ana@example.com", body: 12, created_at: "2026-11-12T08:00:00Z" },
    null,
  ], PEOPLE, " Carla@Example.com ");
  assert.deepEqual(items.map((i) => [i.id, i.name, i.own]), [[3, "Carla", true], [2, "nadie@example.org", false], [1, "Ana", false]]);
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

test("a 42501 from set_mark, add_comment, delete_comment or set_niche_veto is «no access», like week_summary's", () => {
  for (const source of ["set_mark", "add_comment", "delete_comment", "set_niche_veto", "week_summary"]) {
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
  const raw = draftValue("Carla@Example.com", "Conozco <b>dos</b> clubes.");
  assert.equal(readDraft(raw, "carla@example.com"), "Conozco <b>dos</b> clubes.");
  assert.equal(readDraft(raw, "beto@example.com"), null);
  assert.equal(readDraft(raw, ""), null);
  assert.equal(readDraft(draftValue("carla@example.com", "   "), "carla@example.com"), null);
  for (const bad of [null, "", "{", "[]", "42", JSON.stringify({ email: "carla@example.com" }), JSON.stringify({ email: 1, text: "x" })]) {
    assert.equal(readDraft(bad, "carla@example.com"), null, String(bad));
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
    marks: { data: [mark("dol-0027", "carla@example.com", "interested")] },
    comments: { data: [{ id: 1, pain_id: "dol-0027", author: "ana@example.com", body: "Hola.", created_at: "2026-11-10T22:15:00Z" }] },
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
    ["select", "pains", "id,territory,status,team_discard:doc->team_discard,evidence:doc->evidence,verdicts:doc->verdicts,gate:doc->gate", [["id", "dol-0027"]]],
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
  const alone = [mark("dol-0027", "carla@example.com", "discarded")];
  assert.equal(discardNote(PAIN_27, alone), T.discardedNote);
  assert.match(T.discardedNote, /^Lo descartaste\. La próxima corrida no lo volverá a presentar\./);
  // Someone else keeps it with «Nos interesa»: the run keeps the pain, and the page must not say otherwise.
  const kept = [...alone, mark("dol-0027", "beto@example.com", "interested")];
  assert.equal(discardNote(PAIN_27, kept), T.discardedKept);
  assert.equal(T.discardedKept, "Lo descartaste, pero alguien del equipo lo marcó «Nos interesa», así que sigue en la lista.");
  // The same placement as the tag: a discard on a team-discarded pain stays a discard.
  const teamDiscarded = { id: "dol-0030", territory: null, status: "manually-discarded", team_discard: { previous_status: "alive" } };
  assert.equal(discardNote(teamDiscarded, [mark("dol-0030", "carla@example.com", "discarded")]), T.discardedNote);
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

test("ownMarkLine says your own mark and its day, ignoring case in the email, or null without one", () => {
  const day = formatDate("2026-11-10T22:10:00Z");
  const marks = [mark("dol-0027", "Carla@Example.com", "interested"), mark("dol-0027", "beto@example.com", "discarded")];
  assert.equal(ownMarkLine(marks, "carla@example.com"), `Marcaste «Nos interesa» el ${day}.`);
  assert.equal(ownMarkLine(marks, "beto@example.com"), `Lo descartaste el ${day}.`);
  assert.equal(ownMarkLine(marks, "ana@example.com"), null);
  assert.equal(ownMarkLine(marks, ""), null);
  assert.equal(ownMarkLine(null, "carla@example.com"), null);
  assert.equal(ownMarkLine([mark("dol-0027", "carla@example.com", "interested", "not a date")], "carla@example.com"), "Marcaste «Nos interesa».");
  assert.equal(ownMarkLine([mark("dol-0027", "carla@example.com", "discarded", null)], "carla@example.com"), "Lo descartaste.");
  assert.equal(ownMarkLine([mark("dol-0027", "carla@example.com", "maybe")], "carla@example.com"), null);
});

test("lineNoticeText: a line card already marked «Nos interesa» says the next review writes its card", () => {
  assert.equal(lineNoticeText(PAIN_02, []), T.lineNotice);
  assert.match(T.lineNotice, /Si lo marcas «Nos interesa», la próxima corrida escribe su ficha completa\.$/);
  const interested = [mark("dol-0002", "beto@example.com", "interested")];
  assert.equal(lineNoticeText(PAIN_02, interested), "Ya está marcado «Nos interesa». La próxima corrida, el lunes, escribe su ficha completa.");
  // The effective mark decides: one «Nos interesa» wins over a discard; a discard alone does not count; another pain's
  // mark does not count.
  assert.equal(lineNoticeText(PAIN_02, [...interested, mark("dol-0002", "ana@example.com", "discarded")]), T.lineNoticeMarked);
  assert.equal(lineNoticeText(PAIN_02, [mark("dol-0002", "ana@example.com", "discarded")]), T.lineNotice);
  assert.equal(lineNoticeText(PAIN_02, [mark("dol-0027", "beto@example.com", "interested")]), T.lineNotice);
  assert.equal(lineNoticeText(null, interested), T.lineNotice);
});

test("stationButtonLabels: a station's buttons say «Nos interesa» and «Descartar», or how to undo your mark", () => {
  assert.deepEqual(stationButtonLabels(null), { interested: T.stationInterested, discard: T.markDiscardAction });
  assert.deepEqual(stationButtonLabels("interested"), { interested: T.unmarkInterestedAction, discard: T.markDiscardAction });
  assert.deepEqual(stationButtonLabels("discarded"), { interested: T.stationInterested, discard: T.unmarkDiscardAction });
});

test("stationStateText: every station says its state, also one that just left every section", () => {
  assert.equal(stationStateText("weighty"), T.statusWeighty);
  assert.equal(stationStateText("watching"), T.statusWatching);
  assert.equal(stationStateText("discarded"), T.statusDiscarded);
  assert.equal(stationStateText(null), T.statusOut);
  assert.equal(stationStateText(undefined), T.statusOut);
  assert.equal(T.statusOut, "Fuera de la lista");
});

// ---- «Cómo llegamos a este dolor» (Task 11) --------------------------------------------------------------------------
// Evidence and verdicts in the shapes of pains.doc (dolores/scripts/record-run.mjs stamps each verdict with its run),
// every text invented. RAW- marks a text that must never reach the page (a verdict's argument).

const ev = (source, quote, date, extra = {}) => ({
  hash: `${source}-${quote.length}`, url: `https://example.org/${source}/${quote.length}`, source, tier: 2, country: null,
  language: "en", quote, date, ...extra,
});

test("evidenceBySource groups the quotes by source with the run's names, newest first, verbatim", () => {
  const groups = evidenceBySource([
    ev("hn", "matching transfers by hand takes all evening", "2026-05-09T13:07:38Z"),
    ev("github", "the export drops every second row", "2026-06-01T08:00:00Z"),
    ev("hn", "nobody on the board noticed until June", "2026-07-02T10:00:00Z"),
    ev("socrata", "Contratar el cruce de cuotas del club", "2026-04-01", { country: "CO", language: "es" }),
    ev("adzuna", "Se busca auxiliar para conciliar cuotas", "2026-03-15", { country: "MX", language: "es" }),
    ev("adzuna", "Treasurer assistant to reconcile dues", "2026-03-10", { country: "US" }),
    ev("cfpb", "the bank charged the dues twice", "2026-02-01"),
  ]);
  assert.deepEqual(groups.map((g) => [g.source, g.kind]), [
    ["Hacker News", "Foro de programadores"],
    ["GitHub", "Proyectos de código libre"],
    ["SECOP · Colombia", "Contratos públicos"],
    ["Ofertas de empleo · México", "Ofertas de empleo"],
    ["Ofertas de empleo · Estados Unidos", "Ofertas de empleo"],
    ["CFPB", "Quejas de consumidores"],
  ]);
  const hn = groups[0];
  assert.deepEqual(hn.quotes.map((q) => q.quote), ["nobody on the board noticed until June", "matching transfers by hand takes all evening"]);
  assert.deepEqual(hn.quotes[0], {
    quote: "nobody on the board noticed until June", date: formatDate("2026-07-02T10:00:00Z"), url: "https://example.org/hn/38", language: "en",
  });
  // Nothing internal travels: no tier, no hash.
  for (const group of groups) for (const quote of group.quotes) assert.deepEqual(Object.keys(quote).sort(), ["date", "language", "quote", "url"]);
  assert.equal(groups[2].quotes[0].language, "es");
});

test("evidenceBySource keeps 3 per source before «Ver más», and says how many more", () => {
  const many = Array.from({ length: 5 }, (_, i) => ev("hn", `quote number ${i}`, `2026-0${i + 1}-01`));
  const [hn] = evidenceBySource(many);
  assert.equal(hn.quotes.length, 5);
  assert.equal(hn.shown, 3);
  assert.equal(hn.more, 2);
  assert.deepEqual(hn.quotes.map((q) => q.quote), ["quote number 4", "quote number 3", "quote number 2", "quote number 1", "quote number 0"]);
  const [few] = evidenceBySource(many.slice(0, 2));
  assert.deepEqual([few.shown, few.more], [2, 0]);
  const [one] = evidenceBySource(many, { limit: 1 });
  assert.deepEqual([one.shown, one.more], [1, 4]);
});

test("evidenceBySource puts every link through safeUrl", () => {
  const [group] = evidenceBySource([
    ev("hn", "a", "2026-05-03", { url: "javascript:alert(1)" }),
    ev("hn", "b", "2026-05-02", { url: "/relative/path" }),
    ev("hn", "c", "2026-05-01", { url: "data:text/html,hi" }),
    ev("hn", "d", "2026-04-30", { url: "https://example.org/ok a" }),
    ev("hn", "e", "2026-04-29", { url: null }),
  ]);
  assert.deepEqual(group.quotes.map((q) => q.url), [null, null, null, "https://example.org/ok%20a", null]);
});

test("evidenceBySource names every source the run's way, and an unknown one by its id", () => {
  const names = (source, country = null) => {
    const [g] = evidenceBySource([ev(source, "x", "2026-01-01", { country })]);
    return [g.source, g.kind];
  };
  assert.deepEqual(names("adzuna:US"), ["Ofertas de empleo · Estados Unidos", "Ofertas de empleo"]);
  assert.deepEqual(names("adzuna:BR"), ["Ofertas de empleo · Brasil", "Ofertas de empleo"]);
  assert.deepEqual(names("adzuna", "co"), ["Ofertas de empleo · Colombia", "Ofertas de empleo"]);
  assert.deepEqual(names("adzuna", "DE"), ["Ofertas de empleo · DE", "Ofertas de empleo"]);
  assert.deepEqual(names("adzuna"), ["Ofertas de empleo", "Ofertas de empleo"]);
  assert.deepEqual(names("socrata:p6dx-8zbt"), ["SECOP · Colombia", "Contratos públicos"]);
  assert.deepEqual(names("socrata"), ["SECOP · Colombia", "Contratos públicos"]);
  // Only SECOP's dataset is SECOP: another Socrata dataset is another source, by its id, as the run names it.
  assert.deepEqual(names("socrata:abcd-1234"), ["socrata:abcd-1234", "Otra fuente"]);
  assert.deepEqual(names("socrata:"), ["socrata:", "Otra fuente"]);
  assert.deepEqual(names("foro-nuevo"), ["foro-nuevo", "Otra fuente"]);
  assert.deepEqual(names("constructor"), ["constructor", "Otra fuente"]);
  assert.deepEqual(names(null), ["Otra fuente", "Otra fuente"]);
  // Two job boards are two sources; the same one twice is one.
  const jobs = evidenceBySource([ev("adzuna", "a", "2026-01-02", { country: "US" }), ev("adzuna:US", "b", "2026-01-01"), ev("adzuna", "c", "2026-01-01", { country: "MX" })]);
  assert.deepEqual(jobs.map((g) => [g.source, g.quotes.length]), [["Ofertas de empleo · Estados Unidos", 2], ["Ofertas de empleo · México", 1]]);
});

test("evidenceBySource skips what has no quote, repeats nothing, and is [] for no evidence", () => {
  assert.deepEqual(evidenceBySource(undefined), []);
  assert.deepEqual(evidenceBySource(null), []);
  assert.deepEqual(evidenceBySource([]), []);
  assert.deepEqual(evidenceBySource([null, 3, "x", { source: "hn", quote: "   " }, { source: "hn" }]), []);
  const [hn] = evidenceBySource([ev("hn", "same words", "2026-01-01"), ev("hn", "same words", "2026-01-01"), ev("hn", " other words ", "not a date")]);
  assert.deepEqual(hn.quotes.map((q) => [q.quote, q.date]), [["same words", formatDate("2026-01-01")], ["other words", ""]]);
  // A language that is not a language tag is not passed on (it becomes a lang attribute).
  const [odd] = evidenceBySource([ev("hn", "x", "2026-01-01", { language: "en\" onclick=\"x" })]);
  assert.equal(odd.quotes[0].language, null);
});

const verdict = (lens, refuted, run_id = "2026-11-16-1") => ({
  pain_id: "dol-0027", lens, refuted, confidence: "medium", argument: `RAW-ARGUMENT ${lens}`, proof: [], run_id,
});
const FIVE = ["existing-solution", "evidence", "buyer", "root-cause", "feasibility"];

test("attackRows: a version 3 card says each attack's question, whether it held, and its plain line", () => {
  const card = {
    ...FULL, version: 3,
    attacks: [
      { lens: "feasibility", held: true, plain: "Se puede construir con lo que ya existe." },
      { lens: "buyer", held: false, plain: "  Nadie parece tener presupuesto para esto.  " },
      { lens: "existing-solution", held: true, plain: "Hay programas, pero caros para un club pequeño." },
      { lens: "evidence", held: true, plain: "Cuatro personas distintas lo cuentan." },
      { lens: "root-cause", held: true, plain: "" },
    ],
  };
  const pain = { ...PAIN_27, verdicts: FIVE.map((lens) => verdict(lens, false)) };
  assert.deepEqual(attackRows(card, pain), [
    { question: "¿Ya existe una solución?", held: true, result: "Resistió", plain: "Hay programas, pero caros para un club pequeño." },
    { question: "¿Alcanza la evidencia?", held: true, result: "Resistió", plain: "Cuatro personas distintas lo cuentan." },
    { question: "¿Hay quién pague?", held: false, result: "Lo tumbó", plain: "Nadie parece tener presupuesto para esto." },
    { question: "¿Es la causa de fondo?", held: true, result: "Resistió", plain: null },
    { question: "¿Se puede construir?", held: true, result: "Resistió", plain: "Se puede construir con lo que ya existe." },
  ]);
});

test("attackRows: a version 2 card takes the latest run's verdicts, with no plain line and no raw argument (Review Focus 4)", () => {
  const pain = {
    ...PAIN_27,
    verdicts: [
      ...FIVE.map((lens) => verdict(lens, true, "2026-11-16-9")), // an older run: 9 < 10
      ...FIVE.map((lens) => verdict(lens, lens === "root-cause", "2026-11-16-10")),
      verdict("buyer", true, ""), verdict("buyer", true, undefined), // no run: belongs to none
    ],
  };
  const rows = attackRows(FULL, pain);
  assert.deepEqual(rows.map((r) => [r.question, r.result, r.plain]), [
    ["¿Ya existe una solución?", "Resistió", null],
    ["¿Alcanza la evidencia?", "Resistió", null],
    ["¿Hay quién pague?", "Resistió", null],
    ["¿Es la causa de fondo?", "Lo tumbó", null],
    ["¿Se puede construir?", "Resistió", null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), /RAW-/);
  // A lens repeated in the run keeps its last verdict; a lens the page does not know asks a plain question last.
  const twice = attackRows(LINE, { verdicts: [verdict("buyer", false), verdict("buyer", true), verdict("new-lens", false)] });
  assert.deepEqual(twice.map((r) => [r.question, r.result]), [["¿Hay quién pague?", "Lo tumbó"], [T.lensOther, "Resistió"]]);
  for (const row of twice) assert.doesNotMatch(row.question, JARGON);
});

test("attackRows is [] with nothing to tell, and never invents a result", () => {
  assert.deepEqual(attackRows(FULL, PAIN_27), []);
  assert.deepEqual(attackRows(FULL, null), []);
  assert.deepEqual(attackRows(null, { verdicts: "nope" }), []);
  assert.deepEqual(attackRows({ ...FULL, attacks: [] }, { verdicts: FIVE.map((lens) => verdict(lens, false)) }), []);
  assert.deepEqual(attackRows({ ...FULL, attacks: [null, { lens: "buyer", held: "yes", plain: "x" }, { held: true, plain: "x" }] }, PAIN_27), []);
});

test("duelRows: one row per duel, the rival by its title or in plain words, never by its id", () => {
  const card = {
    ...FULL, version: 3,
    duels: [
      { against: "dol-0101", won: false, plain: "El otro dolor tiene más gente que paga por resolverlo." },
      { against: "dol-0999", won: true, plain: "" },
      { against: "dol-0102", won: "yes", plain: "x" },
      null,
    ],
  };
  const titles = new Map([["dol-0101", "Firmar contratos de alquiler a mano"], ["dol-0999", "  "]]);
  assert.deepEqual(duelRows(card, titles), [
    { againstTitle: "Firmar contratos de alquiler a mano", known: true, won: false, result: "Perdió", plain: "El otro dolor tiene más gente que paga por resolverlo." },
    { againstTitle: "otro dolor del catálogo", known: false, won: true, result: "Ganó", plain: null },
  ]);
  assert.deepEqual(duelRows(card, null).map((r) => r.againstTitle), ["otro dolor del catálogo", "otro dolor del catálogo"]);
  assert.deepEqual(duelRows(card, { "dol-0101": "Un título" }).map((r) => r.againstTitle), ["Un título", "otro dolor del catálogo"]);
  for (const row of duelRows(card, null)) assert.doesNotMatch(JSON.stringify(row), JARGON);
  assert.deepEqual(duelRows(FULL, titles), []);
  assert.deepEqual(duelRows(null, titles), []);
  assert.deepEqual(duelRows({ ...FULL, duels: "nope" }, titles), []);
});

test("titleMap titles each pain by its card, as the home and the detail do", () => {
  const titles = titleMap([
    { pain_id: "dol-0027", kind: "full", card: FULL },
    { pain_id: "dol-0002", kind: "line", card: LINE },
    { pain_id: "dol-0003", kind: "line", card: { kind: "line", line: {} } },
    null, { card: FULL },
  ]);
  assert.deepEqual([...titles], [["dol-0027", FULL.line.title], ["dol-0002", LINE.line.what_hurts]]);
  assert.deepEqual([...titleMap(undefined)], []);
});

test("howWeGot gathers the quotes, the attacks and the duels, and is null with nothing to tell", () => {
  const pain = { ...PAIN_27, evidence: [ev("hn", "a quote", "2026-01-01")], verdicts: FIVE.map((lens) => verdict(lens, false)) };
  const view = howWeGot({ ...FULL, duels: [{ against: "dol-0101", won: true, plain: "Ganó." }] }, pain, new Map());
  assert.equal(view.sources.length, 1);
  assert.equal(view.attacks.length, 5);
  assert.equal(view.duels.length, 1);
  assert.equal(howWeGot(FULL, PAIN_27, new Map()), null);
  assert.equal(howWeGot(LINE, { evidence: [], verdicts: [] }, null), null);
  // A card with only its duel still tells it.
  assert.deepEqual(Object.values(howWeGot({ ...LINE, duels: [{ against: "x", won: false, plain: "" }] }, {}, null)).map((list) => list.length), [0, 0, 1]);
});

test("the section's own strings are plain Spanish", () => {
  for (const key of ["secHowWeGot", "howQuotesTitle", "howQuotesLead", "howAttacksTitle", "howDuelTitle", "howDuelsTitle",
    "attackHeld", "attackRefuted", "duelWon", "duelLost", "duelAgainst", "duelAgainstOther", "duelOtherPain", "lensOther",
    "quoteCountOne", "quoteCountMany"]) {
    assert.equal(typeof T[key], "string", key);
  }
  assert.equal(T.secHowWeGot, "Cómo llegamos a este dolor");
  assert.equal(T.attackHeld, "Resistió");
  assert.equal(T.attackRefuted, "Lo tumbó");
  assert.equal(T.duelOtherPain, "otro dolor del catálogo");
});
