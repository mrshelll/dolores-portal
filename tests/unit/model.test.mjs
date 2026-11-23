import { test } from "node:test";
import assert from "node:assert/strict";
import {
  effectiveMark, buildSections, sectionOf, emptySentence, homeNotice, runNotice, classifyError, firstPage, nextPage, PAGE_SIZE, PAGED_ABOVE, rowMeta,
  decideList, catalogSections, painLamp, hasNewEvidence, lineView, latestTrace, brandLamp,
  stationMarks, stationMeta, decideLead, stationTags, lineHeading, runFacts, costRows, weekMeta, brandLampText, stageNotes,
  sourceFigures, catalogView, brandLampShort, rowMarks, stationFacts, stationFactLines, analysisRows,
} from "../../js/model.js";
import { scenarios } from "../browser/fixtures.mjs";
import { loadHome, loadWeek } from "../../js/api.js";
import { T, fill, formatDate } from "../../js/text.js";

// Fixtures in the base's shapes, with invented texts (this repository is public and carries no catalog data).
const PEOPLE = [
  { email: "carla@example.com", name: "Carla" },
  { email: "beto@example.com", name: "Beto" },
  { email: "ana@example.com", name: "Ana" },
];

const lineCard = (painId, { what_hurts = `Duele ${painId}.`, who = `Quien sufre ${painId}.`, direction = "new", last_evidence = "2026-08-18" } = {}) => ({
  pain_id: painId,
  kind: "line",
  card: {
    kind: "line",
    line: { who, what_hurts },
    trend: { runs: 1, direction, territory: null, last_evidence },
    review: null, run_id: "cards-2026-11-10", pain_id: painId, version: 1, language: "es", source_hash: "x",
  },
});

const fullCard = (painId, { title = `Título ${painId}`, direction = "steady", last_evidence = "2026-09-18" } = {}) => ({
  pain_id: painId,
  kind: "full",
  card: {
    kind: "full",
    line: { title, who: `Quien sufre ${painId}.`, what_hurts: `Duele ${painId}.` },
    full: { what_hurts: "…" },
    trend: { runs: 8, direction, territory: "document-data-extraction", last_evidence },
    review: { plain: true, round: 1, offending: [] }, run_id: "cards-2026-11-10", pain_id: painId, version: 2, language: "es",
  },
});

const mark = (painId, author, value) => ({ pain_id: painId, author, mark: value, created_at: "2026-11-10T22:10:00Z" });

const idsOf = (sections) => Object.fromEntries(Object.entries(sections).map(([k, items]) => [k, items.map((i) => i.id)]));

// ---- effectiveMark ---------------------------------------------------------------------------

test("effectiveMark follows the run's rule: any interested wins, a lone discard discards, nothing is null", () => {
  const marks = [
    mark("a", "carla@example.com", "discarded"), mark("a", "beto@example.com", "interested"),
    mark("b", "ana@example.com", "discarded"),
    mark("c", "ana@example.com", "interested"),
  ];
  assert.equal(effectiveMark("a", marks), "interested");
  assert.equal(effectiveMark("b", marks), "discarded");
  assert.equal(effectiveMark("c", marks), "interested");
  assert.equal(effectiveMark("d", marks), null);
  assert.equal(effectiveMark("a"), null);
  assert.equal(effectiveMark("a", null), null);
});

// ---- buildSections ---------------------------------------------------------------------------

test("discard plus interested lands in interested with both marks named", () => {
  const sections = buildSections({
    pains: [{ id: "dol-0002", territory: null, status: "watching" }],
    cards: [lineCard("dol-0002")],
    marks: [mark("dol-0002", "ana@example.com", "discarded"), mark("dol-0002", "beto@example.com", "interested")],
    people: PEOPLE,
  });
  assert.deepEqual(idsOf(sections), { weighty: [], interested: ["dol-0002"], watching: [], discarded: [] });
  const [item] = sections.interested;
  assert.deepEqual(item.marks, [{ name: "Ana", mark: "discarded" }, { name: "Beto", mark: "interested" }]);
});

test("an alive pain marked interested lands in weighty", () => {
  const sections = buildSections({
    pains: [{ id: "dol-0027", territory: "document-data-extraction", status: "alive" }],
    cards: [fullCard("dol-0027", { title: "Cobrar las cuotas del club a tiempo" })],
    marks: [mark("dol-0027", "carla@example.com", "interested")],
    people: PEOPLE,
  });
  assert.deepEqual(idsOf(sections), { weighty: ["dol-0027"], interested: [], watching: [], discarded: [] });
  assert.deepEqual(sections.weighty[0], {
    id: "dol-0027",
    title: "Cobrar las cuotas del club a tiempo",
    who: "Quien sufre dol-0027.",
    trend: { direction: "steady", last_evidence: "2026-09-18" },
    topic: "Sacar datos de documentos",
    marks: [{ name: "Carla", mark: "interested" }],
  });
});

test("a dead pain without marks is in no section", () => {
  const sections = buildSections({
    pains: [{ id: "dol-0099", territory: "documents-for-ai", status: "dead" }],
    cards: [lineCard("dol-0099")],
    marks: [],
    people: PEOPLE,
  });
  assert.deepEqual(idsOf(sections), { weighty: [], interested: [], watching: [], discarded: [] });
});

test("a card without title uses what_hurts", () => {
  const sections = buildSections({
    pains: [{ id: "dol-0002", territory: null, status: "watching" }, { id: "dol-0003", territory: null, status: "watching" }],
    cards: [
      lineCard("dol-0002", { what_hurts: "Hay que juntar a mano la autorización firmada de cada familia." }),
      fullCard("dol-0003", { title: "   " }), // a blank title is no title
    ],
    marks: [],
    people: PEOPLE,
  });
  const byId = Object.fromEntries(sections.watching.map((i) => [i.id, i]));
  assert.equal(byId["dol-0002"].title, "Hay que juntar a mano la autorización firmada de cada familia.");
  assert.equal(byId["dol-0002"].topic, "Sin tema");
  assert.equal(byId["dol-0003"].title, "Duele dol-0003.");
});

test("a pain without card is left out", () => {
  const sections = buildSections({
    pains: [
      { id: "dol-0001", territory: null, status: "alive" },
      { id: "dol-0004", territory: null, status: "alive" }, // a card row whose card has no line at all
      { id: "dol-0005", territory: null, status: "alive" },
    ],
    cards: [{ pain_id: "dol-0004", kind: "line", card: { kind: "line" } }, { pain_id: "dol-0005", kind: "line", card: null }],
    marks: [mark("dol-0001", "beto@example.com", "discarded")],
    people: PEOPLE,
  });
  assert.deepEqual(idsOf(sections), { weighty: [], interested: [], watching: [], discarded: [] });
});

test("a pain goes into one section, in priority order, and incomplete-verification is watching", () => {
  const sections = buildSections({
    pains: [
      { id: "p-discarded-alive", territory: null, status: "alive" },
      { id: "p-weighty", territory: null, status: "alive" },
      { id: "p-interested-dead", territory: null, status: "dead" },
      { id: "p-watching", territory: null, status: "watching" },
      { id: "p-verifying", territory: null, status: "incomplete-verification" },
      { id: "p-hand-discarded", territory: null, status: "manually-discarded" },
    ],
    cards: ["p-discarded-alive", "p-weighty", "p-interested-dead", "p-watching", "p-verifying", "p-hand-discarded"].map((id) => lineCard(id)),
    marks: [mark("p-discarded-alive", "ana@example.com", "discarded"), mark("p-interested-dead", "carla@example.com", "interested")],
    people: PEOPLE,
  });
  assert.deepEqual(idsOf(sections), {
    weighty: ["p-weighty"],
    interested: ["p-interested-dead"],
    watching: ["p-verifying", "p-watching"],
    discarded: ["p-discarded-alive"],
  });
});

test("a team discard whose discard marks are gone goes back by its previous status; a hand discard stays out", () => {
  const teamDiscard = (id, previous_status) => ({ id, territory: null, status: "manually-discarded",
    team_discard: { previous_status, previous_status_reason: null, previous_killer_lens: null } });
  const pains = [
    teamDiscard("t-alive", "alive"),
    teamDiscard("t-watching", "watching"),
    teamDiscard("t-verifying", "incomplete-verification"),
    teamDiscard("t-dead", "dead"),
    teamDiscard("t-dead-interested", "dead"),
    teamDiscard("t-still-discarded", "alive"),
    teamDiscard("t-bogus", "manually-discarded"), // not restorable: the run leaves it as a hand discard
    teamDiscard("t-unknown", "something-else"),
    { id: "hand", territory: null, status: "manually-discarded" },
    { id: "hand-null", territory: null, status: "manually-discarded", team_discard: null },
    { id: "not-discarded", territory: null, status: "dead", team_discard: { previous_status: "alive" } }, // stale doc
  ];
  const sections = buildSections({
    pains,
    cards: pains.map((p) => lineCard(p.id)),
    marks: [mark("t-dead-interested", "beto@example.com", "interested"), mark("t-still-discarded", "ana@example.com", "discarded")],
    people: PEOPLE,
  });
  assert.deepEqual(idsOf(sections), {
    weighty: ["t-alive"],
    interested: ["t-dead-interested"],
    watching: ["t-verifying", "t-watching"],
    discarded: ["t-still-discarded"],
  });
});

test("a hand discard marked interested is in no section; a team discard keeps its own rules", () => {
  const pains = [
    { id: "hand", territory: null, status: "manually-discarded" },
    { id: "hand-null", territory: null, status: "manually-discarded", team_discard: null },
    { id: "t-bogus", territory: null, status: "manually-discarded", team_discard: { previous_status: "manually-discarded" } },
    { id: "hand-discarded-mark", territory: null, status: "manually-discarded" },
    { id: "t-watching", territory: null, status: "manually-discarded", team_discard: { previous_status: "watching" } },
    { id: "t-dead", territory: null, status: "manually-discarded", team_discard: { previous_status: "dead" } },
  ];
  const sections = buildSections({
    pains,
    cards: pains.map((p) => lineCard(p.id)),
    marks: [
      mark("hand", "beto@example.com", "interested"),
      mark("hand-null", "carla@example.com", "interested"),
      mark("t-bogus", "ana@example.com", "interested"),
      mark("hand-discarded-mark", "ana@example.com", "discarded"),
      mark("t-watching", "beto@example.com", "interested"),
      mark("t-dead", "beto@example.com", "interested"),
    ],
    people: PEOPLE,
  });
  assert.deepEqual(idsOf(sections), {
    weighty: [],
    interested: ["t-dead", "t-watching"],
    watching: [],
    discarded: ["hand-discarded-mark"],
  });
  // t-watching is restored to watching and marked interested: «Nos interesa» comes before «En observación».
  assert.equal(sectionOf(pains[4], [mark("t-watching", "beto@example.com", "interested")]), "interested");
  for (const pain of pains.slice(0, 3)) assert.equal(sectionOf(pain, [mark(pain.id, "beto@example.com", "interested")]), null, pain.id);
});

test("each section is sorted by last evidence, newest first, then by id; missing evidence goes last", () => {
  const sections = buildSections({
    pains: ["dol-0010", "dol-0011", "dol-0012", "dol-0013"].map((id) => ({ id, territory: null, status: "alive" })),
    cards: [
      lineCard("dol-0013", { last_evidence: "2026-09-01" }),
      lineCard("dol-0012", { last_evidence: "2026-10-01" }),
      lineCard("dol-0011", { last_evidence: "2026-09-01" }),
      lineCard("dol-0010", { last_evidence: null }),
    ],
    marks: [],
    people: PEOPLE,
  });
  assert.deepEqual(sections.weighty.map((i) => i.id), ["dol-0012", "dol-0011", "dol-0013", "dol-0010"]);
});

test("marks name people case-insensitively, fall back to the email, and skip unknown values", () => {
  const sections = buildSections({
    pains: [{ id: "dol-0027", territory: "document-data-extraction", status: "watching" }],
    cards: [fullCard("dol-0027")],
    marks: [
      mark("dol-0027", "Carla@Example.com", "interested"),
      mark("dol-0027", "alguien@example.org", "discarded"),
      mark("dol-0027", "beto@example.com", "maybe"),
    ],
    people: PEOPLE,
  });
  assert.deepEqual(sections.interested[0].marks, [{ name: "alguien@example.org", mark: "discarded" }, { name: "Carla", mark: "interested" }]);
});

test("buildSections copes with missing inputs and an unknown trend direction", () => {
  assert.deepEqual(idsOf(buildSections({})), { weighty: [], interested: [], watching: [], discarded: [] });
  const sections = buildSections({
    pains: [{ id: "dol-0002", territory: "a-new-territory", status: "alive" }],
    cards: [{ pain_id: "dol-0002", kind: "line", card: { line: { what_hurts: "Duele.", who: null } } }],
  });
  assert.deepEqual(sections.weighty[0], {
    id: "dol-0002", title: "Duele.", who: "", trend: { direction: null, last_evidence: null }, topic: "Otro tema", marks: [],
  });
});

// ---- rowMeta ---------------------------------------------------------------------------------

test("rowMeta says the trend, the topic and who marked what, interested first", () => {
  const item = { id: "x", title: "t", who: "w", topic: "Sacar datos de documentos", trend: { direction: "rising", last_evidence: null },
    marks: [{ name: "Ana", mark: "discarded" }, { name: "Beto", mark: "interested" }, { name: "Carla", mark: "interested" }] };
  assert.deepEqual(rowMeta(item), ["Gana fuerza", "Sacar datos de documentos", "Nos interesa: Beto y Carla", "Descartado: Ana"]);
  assert.deepEqual(rowMeta({ ...item, marks: [{ name: "Beto", mark: "interested" }] }), ["Gana fuerza", "Sacar datos de documentos", "Nos interesa: Beto"]);
  assert.deepEqual(rowMeta({ ...item, trend: { direction: null }, marks: [] }), ["Sacar datos de documentos"]);
  for (const [direction, label] of [["new", "Dolor nuevo"], ["rising", "Gana fuerza"], ["falling", "Pierde fuerza"], ["steady", "Igual que la semana pasada"]]) {
    assert.equal(rowMeta({ ...item, trend: { direction }, marks: [] })[0], label);
  }
});

// ---- The week's summary ---------------------------------------------------------------------

const SUMMARY = { run_id: "2026-11-10-3", date: "2026-11-10", status: "complete", territory: "documents-for-ai", reasons: [], new_pains: 6, items_reviewed: 480 };

// ---- emptySentence ---------------------------------------------------------------------------

test("emptySentence: one sentence for an empty home, with what was reviewed when it is known", () => {
  assert.equal(emptySentence(SUMMARY),
    "Revisamos 480 publicaciones sobre «Preparar documentos para la IA» y ninguna trajo un dolor. La próxima corrida es el lunes.");
  assert.equal(emptySentence({ ...SUMMARY, items_reviewed: 1 }),
    "Revisamos 1 publicación sobre «Preparar documentos para la IA» y no trajo ningún dolor. La próxima corrida es el lunes.");
  assert.equal(emptySentence({ ...SUMMARY, items_reviewed: 12345, territory: "a-new-territory" }),
    "Revisamos 12.345 publicaciones y ninguna trajo un dolor. La próxima corrida es el lunes.");
  assert.equal(emptySentence({ ...SUMMARY, items_reviewed: 1, territory: null }),
    "Revisamos 1 publicación y no trajo ningún dolor. La próxima corrida es el lunes.");
  for (const summary of [{ ...SUMMARY, items_reviewed: null }, { ...SUMMARY, items_reviewed: 0 }, { ...SUMMARY, items_reviewed: "480" }]) {
    assert.equal(emptySentence(summary), "Esta semana no apareció ningún dolor. La próxima corrida es el lunes.");
  }
});

// ---- the empty home's sentence, per run status, this week's run and an old one ------------------

// What an empty home says for each status, fresh (2 days old) and stale (10 days old). It may not contradict the
// notice: no «esta semana» under a stale notice, no «Revisamos…» after a run that did not review.
const TOPIC = "«Preparar documentos para la IA»";
const EMPTY_SENTENCES = {
  complete: {
    fresh: `Revisamos 480 publicaciones sobre ${TOPIC} y ninguna trajo un dolor. La próxima corrida es el lunes.`,
    stale: `Revisamos 480 publicaciones sobre ${TOPIC} y ninguna trajo un dolor. La próxima corrida es el lunes.`,
  },
  incomplete: {
    fresh: `Revisamos 480 publicaciones sobre ${TOPIC} y ninguna trajo un dolor. La próxima corrida es el lunes.`,
    stale: `Revisamos 480 publicaciones sobre ${TOPIC} y ninguna trajo un dolor. La próxima corrida es el lunes.`,
  },
  failed: {
    fresh: "La corrida de esta semana no terminó, así que no hay dolores nuevos. La próxima corrida es el lunes.",
    stale: "La última corrida no terminó, así que no hay dolores nuevos. La próxima corrida es el lunes.",
  },
  "ingest-only": {
    fresh: "La corrida de esta semana no terminó, así que no hay dolores nuevos. La próxima corrida es el lunes.",
    stale: "La última corrida no terminó, así que no hay dolores nuevos. La próxima corrida es el lunes.",
  },
};
const DATES = { fresh: "2026-11-10", stale: "2026-11-02" };

for (const [status, byAge] of Object.entries(EMPTY_SENTENCES)) {
  for (const [age, expected] of Object.entries(byAge)) {
    test(`the empty home's sentence for a ${age} ${status} run agrees with its notice`, () => {
      const summary = { ...SUMMARY, status, date: DATES[age] };
      const said = emptySentence(summary, runNotice(summary, TODAY));
      assert.equal(said, expected);
      if (age === "stale") assert.doesNotMatch(said, /esta semana/i);
      if (status === "failed" || status === "ingest-only") assert.doesNotMatch(said, /Revisamos/);
    });
  }
}

test("an empty home of an old run without a count of publications does not say «esta semana»", () => {
  const stale = { ...SUMMARY, date: "2026-11-02", items_reviewed: null };
  assert.equal(emptySentence(stale, runNotice(stale, TODAY)), "En la última corrida no apareció ningún dolor. La próxima corrida es el lunes.");
  const fresh = { ...SUMMARY, items_reviewed: null };
  assert.equal(emptySentence(fresh, runNotice(fresh, TODAY)), "Esta semana no apareció ningún dolor. La próxima corrida es el lunes.");
});

test("a failed or ingest-only run never reports a count of publications, even when the summary has one", () => {
  for (const status of ["failed", "ingest-only", "something-new"]) assert.doesNotMatch(emptySentence({ ...SUMMARY, status }), /Revisamos/);
});

test("with no review at all, the empty home says so once and when the first one is, without a separate notice", () => {
  for (const summary of [null, undefined, "not a summary"]) {
    const notice = runNotice(summary, TODAY);
    assert.equal(notice.kind, "none");
    assert.equal(emptySentence(summary, notice), "Todavía no hay ninguna corrida. La primera es el lunes.");
    assert.equal(emptySentence(summary), "Todavía no hay ninguna corrida. La primera es el lunes.");
    assert.doesNotMatch(emptySentence(summary, notice), /esta semana/i);
    // The sentence already says it: the notice above an empty home is dropped.
    assert.equal(homeNotice(notice, { empty: true }), null);
    // A home with pains but no review keeps the notice.
    assert.deepEqual(homeNotice(notice, { empty: false }), notice);
  }
  // Any other notice stays, empty home or not.
  const failed = runNotice({ ...SUMMARY, status: "failed" }, TODAY);
  assert.deepEqual(homeNotice(failed, { empty: true }), failed);
  assert.equal(homeNotice(null, { empty: true }), null);
});

// ---- runNotice -------------------------------------------------------------------------------

const TODAY = new Date(2026, 10, 12, 9, 0); // 12 Nov 2026, local time

test("runNotice for each kind, and null for a complete run 2 days old", () => {
  assert.equal(runNotice(SUMMARY, TODAY), null);
  assert.deepEqual(runNotice({ ...SUMMARY, status: "failed" }, TODAY),
    { kind: "failed", text: "La corrida de esta semana falló. Ves la lista de la última corrida que terminó." });
  const incomplete = runNotice({ ...SUMMARY, status: "incomplete" }, TODAY);
  assert.equal(incomplete.kind, "incomplete");
  assert.match(incomplete.text, /^La corrida de esta semana quedó incompleta: puede faltar algún dolor\. Ves la lista del 10 nov\.? 2026\.$/);
  assert.deepEqual(runNotice({ ...SUMMARY, status: "ingest-only" }, TODAY),
    { kind: "ingest-only", text: "Esta semana solo se juntaron publicaciones; no se revisaron." });
  const stale = runNotice({ ...SUMMARY, date: "2026-11-02" }, TODAY);
  assert.equal(stale.kind, "stale");
  assert.match(stale.text, /^La última corrida es del 2 nov\.? 2026\.$/);
  const none = runNotice(null, TODAY);
  assert.equal(none.kind, "none");
  assert.equal(typeof none.text, "string");
  assert.ok(none.text.length > 0);
});

test("runNotice: 8 days old is not stale, 9 is; a stale run says its date whatever its status", () => {
  assert.equal(runNotice({ ...SUMMARY, date: "2026-11-04" }, TODAY), null);
  assert.equal(runNotice({ ...SUMMARY, date: "2026-11-03" }, TODAY).kind, "stale");
  assert.equal(runNotice({ ...SUMMARY, date: "2026-10-20", status: "failed" }, TODAY).kind, "stale");
  assert.equal(runNotice({ ...SUMMARY, date: "2026-11-03" }, "2026-11-12").kind, "stale");
});

test("runNotice says both the date and the status of a stale run that did not finish well", () => {
  const stale = (status) => runNotice({ ...SUMMARY, date: "2026-11-02", status }, TODAY);
  assert.match(stale("failed").text, /^La última corrida es del 2 nov\.? 2026 y falló\.$/);
  assert.match(stale("incomplete").text, /^La última corrida es del 2 nov\.? 2026 y quedó incompleta: puede faltar algún dolor\.$/);
  assert.match(stale("ingest-only").text, /^La última corrida es del 2 nov\.? 2026 y solo juntó publicaciones; no llegó a leerlas\.$/);
  assert.match(stale("complete").text, /^La última corrida es del 2 nov\.? 2026\.$/);
  for (const status of ["failed", "incomplete", "ingest-only", "complete"]) assert.equal(stale(status).kind, "stale");
});

test("runNotice without a usable date judges by status only, and ignores an unknown status", () => {
  assert.equal(runNotice({ ...SUMMARY, date: null }, TODAY), null);
  const undated = runNotice({ ...SUMMARY, date: "not a date", status: "incomplete" }, TODAY);
  assert.deepEqual(undated, { kind: "incomplete", text: "La corrida de esta semana quedó incompleta: puede faltar algún dolor." });
  assert.equal(runNotice({ ...SUMMARY, status: "something-new" }, TODAY), null);
});

// ---- classifyError ---------------------------------------------------------------------------

test("classifyError maps 401, PGRST303 and 42501", () => {
  assert.equal(classifyError({ status: 401, code: "", message: "Unauthorized" }), "expired");
  assert.equal(classifyError({ status: 401, code: "PGRST301", message: "JWT expired" }), "expired");
  assert.equal(classifyError({ status: 401, code: "PGRST303", message: "JWT expired" }), "expired");
  assert.equal(classifyError({ code: "PGRST303" }), "expired");
  assert.equal(classifyError({ status: 403, code: "42501", message: "week_summary: not a member" }), "no-access");
});

test("classifyError maps a failed fetch to network and anything else to other", () => {
  assert.equal(classifyError(new TypeError("Failed to fetch")), "network");
  assert.equal(classifyError({ status: 0, code: "", message: "TypeError: Failed to fetch" }), "network");
  assert.equal(classifyError({ status: 500, code: "XX000", message: "boom" }), "other");
  assert.equal(classifyError({ status: 400, code: "PGRST302" }), "other");
  assert.equal(classifyError(null), "other");
  assert.equal(classifyError(undefined), "other");
});

// ---- load by parts (LIS-04) ------------------------------------------------------------------

test("a list of 50 shows whole; over 50 shows 20, then 20 more each time, never past the end", () => {
  assert.equal(PAGED_ABOVE, 50);
  assert.equal(PAGE_SIZE, 20);
  assert.equal(firstPage(0), 0);
  assert.equal(firstPage(50), 50);
  assert.equal(firstPage(51), 20);
  assert.equal(nextPage(20, 51), 40);
  assert.equal(nextPage(40, 51), 51);
  assert.equal(nextPage(51, 51), 51);
});

// ---- loadHome --------------------------------------------------------------------------------

// A fake supabase client: records each read and answers from `answers`.
function fakeClient(answers) {
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
      return { select(columns) { calls.push(["select", table, columns]); return reply(table); } };
    },
  };
}

test("loadHome reads the summary by rpc and each table with its columns", async () => {
  const client = fakeClient({
    "rpc:week_summary": { data: SUMMARY },
    pains: { data: [{ id: "dol-0027", territory: "document-data-extraction", status: "alive" }] },
    pain_cards: { data: [fullCard("dol-0027")] },
    marks: { data: [mark("dol-0027", "carla@example.com", "interested")] },
    people: { data: PEOPLE },
  });
  const home = await loadHome(client);
  assert.deepEqual(home.summary, SUMMARY);
  assert.equal(home.pains.length, 1);
  assert.equal(home.cards.length, 1);
  assert.equal(home.marks.length, 1);
  assert.equal(home.people.length, 3);
  const sorted = [...client.calls].sort((a, b) => a[1].localeCompare(b[1]));
  assert.deepEqual(sorted, [
    ["select", "marks", "*"],
    ["select", "pain_cards", "pain_id,kind,card"],
    ["select", "pains", "id,territory,status,team_discard:doc->team_discard,history:doc->history,gate:doc->gate"],
    ["select", "people", "*"],
    ["rpc", "run_traces", { p_limit: 12 }],
    ["rpc", "week_summary", undefined],
  ]);
});

test("loadHome turns no run into a null summary and missing rows into empty lists", async () => {
  const home = await loadHome(fakeClient({ "rpc:week_summary": { data: null } }));
  assert.deepEqual(home, { summary: null, pains: [], cards: [], marks: [], people: [], traces: [] });
});

test("loadHome throws the first refused read with its HTTP status, so classifyError can read it", async () => {
  const client = fakeClient({
    "rpc:week_summary": { status: 403, error: { code: "42501", message: "week_summary: not a member" } },
  });
  await assert.rejects(loadHome(client), (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, "42501");
    assert.equal(classifyError(error), "no-access");
    return true;
  });
  const expired = fakeClient({ pains: { status: 401, error: { code: "PGRST303", message: "JWT expired" } } });
  await assert.rejects(loadHome(expired), (error) => classifyError(error) === "expired");
});

test("a 42501 on a table read is a lost grant (other), never «no access»; only week_summary's 42501 is", async () => {
  for (const table of ["pains", "pain_cards", "marks", "people"]) {
    const client = fakeClient({ [table]: { status: 403, error: { code: "42501", message: `permission denied for table ${table}` } } });
    await assert.rejects(loadHome(client), (error) => {
      assert.equal(error.source, table);
      assert.equal(classifyError(error), "other", table);
      return true;
    });
  }
  const rpc = fakeClient({ "rpc:week_summary": { status: 403, error: { code: "42501", message: "week_summary: not a member" } } });
  await assert.rejects(loadHome(rpc), (error) => error.source === "week_summary" && classifyError(error) === "no-access");
});

test("loadHome lets a failed fetch through as a network error", async () => {
  const client = fakeClient({ marks: new TypeError("Failed to fetch") });
  await assert.rejects(loadHome(client), (error) => classifyError(error) === "network");
});

// ---- tomoshi: the run's traces and what goes on the home -------------------------------------------------------------

// Fictional traces in buildTrace's shape (dolores/scripts/lib/trace.mjs), newest first as run_traces() returns them.
// Every id, date, title and count is invented.
// Invented people for these tests.
const CREW = [{ email: "ana@example.com", name: "Ana" }, { email: "beto@example.com", name: "Beto" }, { email: "carla@example.com", name: "Carla" }];
const trace = (runId, date, extra = {}) => ({
  version: 1, run_id: runId, date, niche: { id: "nicho-ficticio", name: "Nicho ficticio" }, status: "complete",
  started_at: null, finished_at: null, cost: { total_usd: 1.5, by_model: [{ model: "Sonnet", usd: 1.2 }], cards_usd: 0.3 },
  agents: { used: 40, cap: 100 }, sources: [], ingest: null, funnel: [], cuts: [], duels: [], ranking: [], duel_kind: null,
  new_pains: 0, cards: null, ...extra,
});
// Five complete weekly runs, then the latest (index 0).
const RUNS = [
  trace("2030-02-04-1", "2030-02-04"),
  trace("2030-01-28-1", "2030-01-28"),
  trace("2030-01-21-1", "2030-01-21"),
  trace("2030-01-14-1", "2030-01-14"),
  trace("2030-01-07-1", "2030-01-07"),
];
const entry = (runId) => ({ run_id: runId, date: runId.slice(0, 10), score: 10 });
const painOf = (id, status, runIds = [], extra = {}) => ({ id, territory: null, status, history: runIds.map(entry), ...extra });
const decideIds = (input) => decideList({ people: CREW, marks: [], ...input }).map((item) => item.id);

test("decideList keeps alive, new this run, in the duels, in a survivors' ranking, and interested", () => {
  const latest = trace("2030-02-04-1", "2030-02-04", {
    duels: [{ a: "dol-9104", b: "dol-9105", winner: "dol-9105", reason: "raw reasoning" }],
    ranking: ["dol-9105", "dol-9104", "dol-9106"], duel_kind: "survivors",
  });
  const pains = [
    painOf("dol-9101", "alive", ["2029-06-03-1"]),                          // alive, quiet for months: stays
    painOf("dol-9102", "watching", ["2030-02-04-1"]),                       // first entry is the latest run: new
    painOf("dol-9103", "watching", ["2029-12-03-1", "2030-02-04-1"]),       // old pain seen again: not «touched»
    painOf("dol-9104", "watching", ["2029-12-03-1", "2030-02-04-1"]),       // in a duel
    painOf("dol-9105", "watching", ["2029-12-03-1", "2030-02-04-1"]),       // in a duel, the winner
    painOf("dol-9106", "watching", ["2029-12-03-1", "2030-02-04-1"]),       // only in the survivors' ranking
    painOf("dol-9107", "watching", ["2030-01-21-1"]),                       // interested, seen 3 runs ago
    painOf("dol-9108", "watching", ["2029-10-01-1"]),                       // quiet, nobody marked it
  ];
  const ids = pains.map((p) => p.id);
  const items = decideList({
    pains, cards: ids.map((id) => lineCard(id)), people: CREW,
    marks: [mark("dol-9107", "beto@example.com", "interested")],
    traces: [latest, ...RUNS.slice(1)],
  });
  assert.deepEqual(new Set(items.map((i) => i.id)), new Set(["dol-9101", "dol-9102", "dol-9104", "dol-9105", "dol-9106", "dol-9107"]));
});

test("decideList drops a watching pain absent from the last 4 complete runs and a team-discarded pain", () => {
  const pains = [
    painOf("dol-9111", "watching", ["2030-01-07-1"]),                  // only in the 5th run back: quiet
    painOf("dol-9112", "watching", ["2030-01-07-1"]),                  // same, but interested: quiet too (it stays in the catalog)
    painOf("dol-9113", "alive", ["2030-02-04-1"]),                     // alive, but the team discarded it
    painOf("dol-9114", "watching", ["2030-01-14-1"]),                  // 4th run back, interested: stays
  ];
  const ids = decideIds({
    pains, cards: pains.map((p) => lineCard(p.id)), traces: RUNS,
    marks: [
      mark("dol-9112", "ana@example.com", "interested"),
      mark("dol-9113", "carla@example.com", "discarded"),
      mark("dol-9114", "ana@example.com", "interested"),
    ],
  });
  assert.deepEqual(ids, ["dol-9114"]);
  // The quiet ones are still in the catalog.
  const catalog = catalogSections({ pains, cards: pains.map((p) => lineCard(p.id)), marks: [mark("dol-9112", "ana@example.com", "interested")], people: CREW });
  assert.deepEqual(idsOf(catalog).watching, ["dol-9111", "dol-9114"]);
  assert.deepEqual(idsOf(catalog).interested, ["dol-9112"]);
});

test("the quiet window counts complete runs only: a failed or incomplete trace does not push a run out", () => {
  const traces = [
    trace("2030-02-11-1", "2030-02-11", { status: "failed" }),
    ...RUNS.slice(0, 3),
    trace("2030-01-17-1", "2030-01-17", { status: "incomplete" }),
    ...RUNS.slice(3),
  ];
  const pains = [painOf("dol-9121", "watching", ["2030-01-14-1"]), painOf("dol-9122", "watching", ["2030-01-07-1"])];
  const ids = decideIds({ pains, cards: pains.map((p) => lineCard(p.id)), traces,
    marks: pains.map((p) => mark(p.id, "beto@example.com", "interested")) });
  assert.deepEqual(ids, ["dol-9121"]);
});

test("with fewer than 4 complete traced runs the quiet rule is 28 days before the latest traced run", () => {
  const traces = [trace("2030-03-04-1", "2030-03-04"), trace("2030-02-25-1", "2030-02-25")];
  const pains = [
    painOf("dol-9131", "watching", ["2030-02-04-1"]),   // exactly 28 days before: stays
    painOf("dol-9132", "watching", ["2030-02-03-1"]),   // 29 days before: quiet
  ];
  const ids = decideIds({ pains, cards: pains.map((p) => lineCard(p.id)), traces,
    marks: pains.map((p) => mark(p.id, "beto@example.com", "interested")) });
  assert.deepEqual(ids, ["dol-9131"]);
});

test("decideList puts the survivors' duel winner first, then alive, then newest evidence", () => {
  const latest = trace("2030-02-04-1", "2030-02-04", {
    duels: [{ a: "dol-9141", b: "dol-9142", winner: "dol-9142", reason: null }],
    ranking: ["dol-9142", "dol-9141"], duel_kind: "survivors",
  });
  const pains = [
    painOf("dol-9141", "watching", ["2030-02-04-1"]),
    painOf("dol-9142", "watching", ["2030-02-04-1"]),
    painOf("dol-9143", "alive", ["2030-01-28-1"]),
    painOf("dol-9144", "watching", ["2030-02-04-1"]),
  ];
  const cards = [
    lineCard("dol-9141", { last_evidence: "2030-02-03" }),
    lineCard("dol-9142", { last_evidence: "2029-11-01" }),
    lineCard("dol-9143", { last_evidence: "2029-10-01" }),
    lineCard("dol-9144", { last_evidence: "2030-01-30" }),
  ];
  const items = decideList({ pains, cards, marks: [], people: CREW, traces: [latest, ...RUNS.slice(1)] });
  assert.deepEqual(items.map((i) => i.id), ["dol-9142", "dol-9143", "dol-9141", "dol-9144"]);
  assert.deepEqual(items.map((i) => i.winner), [true, false, false, false]);
  assert.deepEqual(items.map((i) => [i.section, i.lamp]), [["watching", "amber"], ["weighty", "green"], ["watching", "amber"], ["watching", "amber"]]);
  assert.deepEqual(items.map((i) => i.fresh), [true, false, true, true]);
});

test("a fallback duel's winner is on the home but not first, and wins nothing", () => {
  const latest = trace("2030-02-04-1", "2030-02-04", {
    duels: [{ a: "dol-9151", b: "dol-9152", winner: "dol-9152", reason: null }],
    ranking: ["dol-9152", "dol-9151"], duel_kind: "fallback",
  });
  const pains = [
    painOf("dol-9151", "watching", ["2029-12-03-1", "2030-02-04-1"]),
    painOf("dol-9152", "watching", ["2029-12-03-1", "2030-02-04-1"]),
    painOf("dol-9153", "alive", ["2030-01-28-1"]),
  ];
  const cards = [
    lineCard("dol-9151", { last_evidence: "2030-02-01" }),
    lineCard("dol-9152", { last_evidence: "2029-12-01" }),
    lineCard("dol-9153", { last_evidence: "2029-10-01" }),
  ];
  const items = decideList({ pains, cards, marks: [], people: CREW, traces: [latest, ...RUNS.slice(1)] });
  assert.deepEqual(items.map((i) => i.id), ["dol-9153", "dol-9151", "dol-9152"]);
  assert.ok(items.every((i) => i.winner === false));
});

test("decideList without traces keeps alive and interested, and copes with missing inputs and v3 cards", () => {
  const v3 = lineCard("dol-9162");
  v3.card.version = 3;
  v3.card.attacks = [{ lens: "evidence", held: true, plain: "Alcanza." }];
  v3.card.duels = [{ against: "dol-9161", won: true, plain: "Ganó." }];
  const pains = [painOf("dol-9161", "alive"), painOf("dol-9162", "watching", [], { history: null }), painOf("dol-9163", "watching")];
  const ids = decideIds({ pains, cards: [lineCard("dol-9161"), v3, lineCard("dol-9163")],
    marks: [mark("dol-9162", "carla@example.com", "interested")], traces: null });
  assert.deepEqual(ids, ["dol-9161", "dol-9162"]);
  assert.deepEqual(decideList(), []);
  assert.deepEqual(decideList({ pains: [painOf("dol-9164", "alive")], traces: [null, { run_id: 7 }] }), []);
});

test("painLamp: green with weight, amber under watch or interested, off when discarded or out", () => {
  assert.equal(painLamp("weighty"), "green");
  assert.equal(painLamp("interested"), "amber");
  assert.equal(painLamp("watching"), "amber");
  assert.equal(painLamp("discarded"), "off");
  assert.equal(painLamp(null), "off");
});

test("hasNewEvidence: a history entry in the given run", () => {
  const latest = RUNS[0];
  assert.equal(hasNewEvidence(painOf("x", "watching", ["2030-01-07-1", "2030-02-04-1"]), latest), true);
  assert.equal(hasNewEvidence(painOf("x", "watching", ["2030-01-07-1"]), latest), false);
  assert.equal(hasNewEvidence(painOf("x", "watching", ["2030-02-04-1"]), null), false);
  assert.equal(hasNewEvidence({ id: "x", history: "broken" }, latest), false);
  assert.equal(hasNewEvidence(null, latest), false);
});

test("latestTrace is this week's only when the summary's run has the trace (Review Focus 2)", () => {
  const summary = { run_id: "2030-02-04-1", date: "2030-02-04", status: "complete" };
  assert.deepEqual(latestTrace(RUNS, summary), { trace: RUNS[0], isThisWeek: true });
  const failedWeek = { run_id: "2030-02-11-1", date: "2030-02-11", status: "failed" };
  assert.deepEqual(latestTrace(RUNS, failedWeek), { trace: RUNS[0], isThisWeek: false });
  assert.deepEqual(latestTrace(RUNS, null), { trace: RUNS[0], isThisWeek: false });
  assert.deepEqual(latestTrace([], summary), { trace: null, isThisWeek: false });
  assert.deepEqual(latestTrace(null, summary), { trace: null, isThisWeek: false });
  assert.deepEqual(latestTrace([null, "x", RUNS[1]], summary), { trace: RUNS[1], isThisWeek: false });
});

test("brandLamp: green for a complete run, amber for incomplete, ingest-only, old or none, red when it failed", () => {
  const today = new Date(2030, 1, 6);
  const run = (status, date = "2030-02-04") => ({ run_id: `${date}-1`, date, status });
  assert.equal(brandLamp(run("complete"), today), "green");
  assert.equal(brandLamp(run("incomplete"), today), "amber");
  assert.equal(brandLamp(run("ingest-only"), today), "amber");
  assert.equal(brandLamp(run("complete", "2030-01-20"), today), "amber");
  assert.equal(brandLamp(run("failed"), today), "red");
  assert.equal(brandLamp(run("failed", "2030-01-20"), today), "red");
  assert.equal(brandLamp(null, today), "amber");
  assert.equal(brandLamp(run("unknown"), today), "amber");
});

const STAGE_LABELS = {
  collected: "Juntadas", read: "Leídas", with_signals: "Con señales de dolor", analyzed: "Analizadas a fondo",
  quotes_checked: "Con citas comprobadas", grouped: "Dolores agrupados", candidates: "Candidatos",
  attacked: "Puestos a prueba", survivors: "Resistieron", duel: "Duelos",
};
const funnelOf = (counts) => Object.entries(counts).map(([stage, [count, cap = null]]) => ({ stage, label: STAGE_LABELS[stage], count, cap }));
const source = (name, extra = {}) => ({ name, kind: "Foro ficticio", collected: 50, kept: 40, available: null, truncated: false, note: "nota técnica", ok: true, ...extra });

test("lineView: a cap that was hit, or a cut at that stage, is amber; no count is off; a source with 0 is red", () => {
  const view = lineView(trace("2030-02-04-1", "2030-02-04", {
    funnel: funnelOf({
      collected: [300], read: [200], with_signals: [null], analyzed: [20, 60], quotes_checked: [19], grouped: [9],
      candidates: [10, 10], attacked: [2], survivors: [1], duel: [0],
    }),
    sources: [
      source("Foro A"),
      source("Foro B", { collected: 120, available: 900, truncated: true }),
      source("Foro C", { collected: 0, kept: 0 }),
      source("Foro D", { collected: null, kept: null, ok: false }),
    ],
    cuts: [
      { kind: "extraction-cap", count: 150, cap: 60, text: "150 testimonios con señales quedaron sin analizar a fondo", original: null },
      { kind: "other", count: null, cap: null, text: "Hubo un recorte más", original: "an english sentence" },
    ],
  }));
  assert.deepEqual(view.stages.map((s) => [s.key, s.count, s.cap, s.lamp]), [
    ["collected", 300, null, "amber"], ["read", 200, null, "green"], ["with_signals", null, null, "off"],
    ["analyzed", 20, 60, "amber"], ["quotes_checked", 19, null, "green"], ["grouped", 9, null, "green"],
    ["candidates", 10, 10, "amber"], ["attacked", 2, null, "green"], ["survivors", 1, null, "green"],
    ["duel", 0, null, "green"],
  ]);
  assert.equal(view.stages[0].label, "Juntadas");
  assert.deepEqual(view.sources.map((s) => [s.name, s.lamp, s.state]), [
    ["Foro A", "green", "ok"], ["Foro B", "amber", "truncated"], ["Foro C", "red", "empty"], ["Foro D", "red", "failed"],
  ]);
  assert.deepEqual(view.cuts.map((c) => [c.kind, c.count, c.stage]), [["extraction-cap", 150, "analyzed"], ["other", null, null]]);
  assert.equal(typeof view.dateLabel, "string");
  assert.ok(view.dateLabel.length > 0);
});

test("lineView keeps the raw duel reasons, source notes and English cut sentences out of its output", () => {
  const view = lineView(trace("2030-02-04-1", "2030-02-04", {
    sources: [source("Foro A", { note: "RAW-NOTE" })],
    cuts: [{ kind: "other", count: null, cap: null, text: "Hubo un recorte más", original: "RAW-ORIGINAL" }],
    duels: [{ a: "dol-9171", b: "dol-9172", winner: "dol-9171", reason: "RAW-REASON" }],
  }));
  const text = JSON.stringify(view);
  for (const raw of ["RAW-NOTE", "RAW-ORIGINAL", "RAW-REASON"]) assert.ok(!text.includes(raw), raw);
});

test("lineView handles a trace with missing inputs, and no trace at all", () => {
  const view = lineView(trace("2030-02-04-1", null, { funnel: null, sources: null, cuts: null, ingest: null, duels: null, ranking: null }));
  assert.deepEqual(view, { stages: [], sources: [], cuts: [], dateLabel: "" });
  assert.equal(lineView(null), null);
  assert.equal(lineView({}), null);
  const odd = lineView(trace("2030-02-04-1", "2030-02-04", { funnel: [null, { key: "read", label: "Leídas", count: "9", cap: 5 }] }));
  assert.deepEqual(odd.stages, [{ key: "read", label: "Leídas", count: null, cap: 5, lamp: "off" }]);
});

test("a pain the latest run touched stays even when that run is not complete and so is outside the quiet window", () => {
  const latest = trace("2030-02-11-1", "2030-02-11", { status: "incomplete" });
  const pains = [painOf("dol-9181", "watching", ["2030-02-11-1"]), painOf("dol-9182", "watching", ["2029-12-03-1", "2030-02-11-1"])];
  const ids = decideIds({ pains, cards: pains.map((p) => lineCard(p.id)), traces: [latest, ...RUNS],
    marks: [mark("dol-9182", "carla@example.com", "interested")] });
  // dol-9181 is new in the latest run; dol-9182 only has an «interested» mark and none of the last 4 complete runs.
  assert.deepEqual(ids, ["dol-9181"]);
});

// ---- tomoshi: the shell, the stations of «Para decidir» and the line -------------------------------------------------

test("stationMarks: who marked what, grouped by mark, names sorted; [] with none", () => {
  const marks = [
    mark("dol-9201", "beto@example.com", "interested"), mark("dol-9201", "ana@example.com", "interested"),
    mark("dol-9201", "carla@example.com", "discarded"), mark("dol-9202", "ana@example.com", "discarded"),
    mark("dol-9201", "nadie@example.com", "otra"), null,
  ];
  assert.deepEqual(stationMarks("dol-9201", marks, CREW), ["Nos interesa: Ana y Beto", "Descartado: Carla"]);
  assert.deepEqual(stationMarks("dol-9203", marks, CREW), []);
  assert.deepEqual(stationMarks("dol-9201", null, null), []);
  assert.deepEqual(stationMarks("dol-9202", marks, []), ["Descartado: ana@example.com"]);
});

test("stationMeta: the trend and the topic, never the marks", () => {
  const item = { trend: { direction: "rising" }, topic: "Sin tema", marks: [{ name: "Ana", mark: "interested" }] };
  assert.deepEqual(stationMeta(item), [T.trendRising, "Sin tema"]);
  assert.deepEqual(stationMeta({ trend: { direction: null }, topic: "Otro tema", marks: [] }), ["Otro tema"]);
});

test("decideLead counts what waits for your own mark and says what goes first", () => {
  const items = [
    { id: "dol-9211", winner: true, section: "watching" },
    { id: "dol-9212", winner: false, section: "weighty" },
    { id: "dol-9213", winner: false, section: "watching" },
  ];
  const marks = [mark("dol-9212", "ANA@example.com", "interested"), mark("dol-9213", "beto@example.com", "discarded")];
  assert.equal(decideLead(items, marks, "ana@example.com"), `${fill(T.leadPendingMany, { count: 2 })} ${T.leadOrderWinnerWeighty}`);
  assert.equal(decideLead(items.slice(1), marks, "ana@example.com"), `${T.leadPendingOne} ${T.leadOrderWeighty}`);
  assert.equal(decideLead([items[0]], [mark("dol-9211", "ana@example.com", "discarded")], "ana@example.com"),
    `${T.leadNoPending} ${T.leadOrderWinner}`);
  assert.equal(decideLead([items[2]], [], "ana@example.com"), T.leadPendingOne);
  assert.equal(decideLead([items[2]], null, null), T.leadPendingOne);
});

test("stationTags: «Evidencia nueva» only when the line is this week's (Review Focus 2); the duel by its date otherwise", () => {
  const item = { winner: true, fresh: true };
  assert.deepEqual(stationTags(item, { isThisWeek: true, dateLabel: "4 feb 2030" }),
    [{ kind: "winner", text: T.tagWinner }, { kind: "fresh", text: T.tagFresh }]);
  assert.deepEqual(stationTags(item, { isThisWeek: false, dateLabel: "4 feb 2030" }),
    [{ kind: "winner", text: fill(T.tagWinnerDated, { date: "4 feb 2030" }) }]);
  assert.deepEqual(stationTags(item, { isThisWeek: false, dateLabel: "" }), [{ kind: "winner", text: T.tagWinner }]);
  assert.deepEqual(stationTags({ winner: false, fresh: false }, { isThisWeek: true }), []);
});

test("lineHeading: this week's line, an older one by its own date (Review Focus 2), or none", () => {
  const summary = { run_id: "2030-02-04-1", date: "2030-02-04", status: "complete" };
  assert.deepEqual(lineHeading(latestTrace(RUNS, summary), summary), { title: T.lineTitle, older: false, note: null });
  const failedWeek = { run_id: "2030-02-11-1", date: "2030-02-11", status: "failed" };
  assert.deepEqual(lineHeading(latestTrace(RUNS, failedWeek), failedWeek),
    { title: fill(T.lineTitleOld, { date: formatDate("2030-02-04") }), older: true, note: T.lineOlderNote });
  assert.equal(lineHeading(latestTrace(RUNS, failedWeek), failedWeek).title.startsWith("Recorrido de la corrida del "), true);
  const undated = [trace("2030-02-04-1", null)];
  assert.deepEqual(lineHeading(latestTrace(undated, failedWeek), failedWeek), { title: T.lineTitleOldUndated, older: true, note: T.lineOlderNote });
  assert.deepEqual(lineHeading(latestTrace([], failedWeek), failedWeek), { title: T.lineTitle, older: false, note: T.lineNoTrace });
  assert.deepEqual(lineHeading(latestTrace(null, null), null), { title: T.lineTitle, older: false, note: T.lineNoRun });
});

test("runFacts: the day, how long it took when both times exist, and the cost", () => {
  const run = trace("2030-02-04-1", "2030-02-04", { started_at: "2030-02-04T09:00:00Z", finished_at: "2030-02-04T09:26:20Z" });
  assert.deepEqual(runFacts(run), ["4 de febrero", fill(T.durationMinutes, { minutes: 26 }), fill(T.costUsd, { amount: "1,50" })]);
  const long = trace("2030-02-04-1", "2030-02-04", { started_at: "2030-02-04T09:00:00Z", finished_at: "2030-02-04T10:05:00Z", cost: null });
  assert.deepEqual(runFacts(long), ["4 de febrero", fill(T.durationHours, { hours: 1, minutes: 5 })]);
  const quick = trace("2030-02-04-1", null, { started_at: "2030-02-04T09:00:00Z", finished_at: "2030-02-04T09:00:20Z" });
  assert.deepEqual(runFacts(quick), [T.durationShort, fill(T.costUsd, { amount: "1,50" })]);
  const backwards = trace("2030-02-04-1", "2030-02-04", { started_at: "2030-02-04T10:00:00Z", finished_at: "2030-02-04T09:00:00Z", cost: { total_usd: "1" } });
  assert.deepEqual(runFacts(backwards), ["4 de febrero"]);
  assert.deepEqual(runFacts(null), []);
});

test("costRows: each model, then the cards, in USD; nothing that is not a number", () => {
  const run = trace("2030-02-04-1", "2030-02-04", {
    cost: { total_usd: 2, by_model: [{ model: "Modelo A", usd: 1.2 }, { model: "", usd: 1 }, { model: "Modelo B", usd: "x" }, null], cards_usd: 0.3 },
  });
  assert.deepEqual(costRows(run), [
    { label: "Modelo A", value: fill(T.costUsd, { amount: "1,20" }) },
    { label: T.costCards, value: fill(T.costUsd, { amount: "0,30" }) },
  ]);
  assert.deepEqual(costRows(trace("2030-02-04-1", "2030-02-04", { cost: null })), []);
  assert.deepEqual(costRows(null), []);
});

test("weekMeta: the week, the niche and the cost; the cost and the run's niche only from this week's trace", () => {
  const summary = { run_id: "2030-02-04-1", date: "2030-02-04", status: "complete", territory: "documents-for-ai" };
  assert.deepEqual(weekMeta(summary, latestTrace(RUNS, summary)), [
    { label: T.metaWeek, value: "4 de febrero" },
    { label: T.metaNiche, value: "Nicho ficticio" },
    { label: T.metaCost, value: fill(T.costUsd, { amount: "1,50" }) },
  ]);
  const failedWeek = { ...summary, run_id: "2030-02-11-1", date: "2030-02-11", status: "failed" };
  assert.deepEqual(weekMeta(failedWeek, latestTrace(RUNS, failedWeek)), [
    { label: T.metaWeek, value: "11 de febrero" },
    { label: T.metaNiche, value: "Preparar documentos para la IA" },
  ]);
  assert.deepEqual(weekMeta({ ...failedWeek, territory: null, date: null }, latestTrace([], failedWeek)), []);
  assert.deepEqual(weekMeta(null, latestTrace(RUNS, null)), []);
});

test("brandLampText says the lamp's state in words", () => {
  assert.equal(brandLampText("green"), T.brandLampGreen);
  assert.equal(brandLampText("amber"), T.brandLampAmber);
  assert.equal(brandLampText("red"), T.brandLampRed);
  assert.equal(brandLampText("purple"), T.brandLampAmber);
});

test("stageNotes: the lamp's state in words, the cap and the cuts that happened at that stage", () => {
  const cuts = [{ kind: "extraction-cap", stage: "analyzed", text: "150 sin analizar" }, { kind: "other", stage: null, text: T.cutOther }];
  assert.deepEqual(stageNotes({ key: "analyzed", count: 20, cap: 60, lamp: "amber" }, cuts),
    { state: T.stageCut, notes: [fill(T.stageCap, { cap: "60" }), "150 sin analizar"] });
  assert.deepEqual(stageNotes({ key: "read", count: 9, cap: null, lamp: "green" }, cuts), { state: T.stageOk, notes: [] });
  assert.deepEqual(stageNotes({ key: "with_signals", count: null, cap: null, lamp: "off" }, null), { state: T.stageNoData, notes: [] });
});

test("sourceFigures: gathered → kept, «de N» when it came truncated, and the state in words", () => {
  const view = lineView(trace("2030-02-04-1", "2030-02-04", { sources: [
    source("Foro A", { collected: 72, kept: 64 }),
    source("Foro B", { collected: 120, kept: 120, available: 900, truncated: true }),
    source("Foro C", { collected: 0, kept: 0 }),
    source("Foro D", { collected: null, kept: null, ok: false }),
    source("Foro E", { collected: null, kept: null }),
  ] }));
  assert.deepEqual(view.sources.map(sourceFigures), [
    { figure: "72 → 64", of: null, state: T.sourceOk },
    { figure: "120", of: fill(T.sourceOf, { available: "900" }), state: T.sourceTruncated },
    { figure: "0", of: null, state: T.sourceEmpty },
    { figure: null, of: null, state: T.sourceFailed },
    { figure: null, of: null, state: T.sourceUnknown },
  ]);
});

// ---- Catálogo ------------------------------------------------------------------------------

test("catalogView: the browser fixtures' catalog has 1 with weight, 1 kept by «Nos interesa», 55 under watch, 1 discarded", () => {
  const { data } = scenarios().find((s) => s.name === "catalog");
  const view = catalogView(data);
  assert.deepEqual(view.sections.map((s) => [s.key, s.count]),
    [["weighty", 1], ["interested", 1], ["watching", 55], ["discarded", 1]]);
  assert.equal(view.total, 58);
  assert.equal(view.empty, false);
  assert.deepEqual(view.sections.map((s) => s.items.map((i) => i.id)[0]), ["dol-0027", "dol-0002", "dol-0100", "dol-0030"]);
  // Every section's count is its list's length, and no pain is in two sections.
  for (const s of view.sections) assert.equal(s.count, s.items.length, s.key);
  const ids = view.sections.flatMap((s) => s.items.map((i) => i.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("catalogView: each section's title, heading with its count, lamp and state in words", () => {
  const { data } = scenarios().find((s) => s.name === "catalog");
  const [weighty, interested, watching, discarded] = catalogView(data).sections;
  assert.deepEqual([weighty.title, weighty.heading, weighty.lamp, weighty.state],
    [T.sectionWeighty, fill(T.sectionCount, { title: T.sectionWeighty, count: "1" }), "green", T.statusWeighty]);
  assert.deepEqual([interested.lamp, interested.state], ["amber", T.statusInterested]);
  assert.deepEqual([watching.heading, watching.lamp, watching.state],
    [fill(T.sectionCount, { title: T.sectionWatching, count: "55" }), "amber", T.statusWatching]);
  assert.deepEqual([discarded.title, discarded.lamp, discarded.state], [T.sectionDiscarded, "off", T.statusDiscarded]);
  assert.equal(T.sectionDiscarded, "Descartados por el equipo");
});

test("catalogView: a section with no pain says so in plain words; with none anywhere the catalog is empty", () => {
  const view = catalogView({});
  assert.equal(view.empty, true);
  assert.equal(view.total, 0);
  assert.deepEqual(view.sections.map((s) => [s.key, s.count, s.emptyText]), [
    ["weighty", 0, T.catalogEmptyWeighty], ["interested", 0, T.catalogEmptyInterested],
    ["watching", 0, T.catalogEmptyWatching], ["discarded", 0, T.catalogEmptyDiscarded],
  ]);
  const only = catalogView({ pains: [{ id: "dol-9301", status: "alive" }], cards: [fullCard("dol-9301")] });
  assert.equal(only.empty, false);
  assert.deepEqual(only.sections.map((s) => s.count), [1, 0, 0, 0]);
  // A count past a thousand is written the Spanish way.
  const many = Array.from({ length: 1200 }, (_, i) => ({ id: `dol-${10000 + i}`, status: "watching" }));
  const big = catalogView({ pains: many, cards: many.map((p) => lineCard(p.id)) });
  assert.equal(big.sections[2].heading, fill(T.sectionCount, { title: T.sectionWatching, count: new Intl.NumberFormat("es").format(1200) }));
});

test("brandLampShort: the brand lamp's state in two or three words, for beside the lamp", () => {
  const today = new Date(2030, 1, 6);
  const run = (status, date = "2030-02-04") => ({ run_id: `${date}-1`, date, status });
  assert.equal(brandLampShort(run("complete"), today), T.brandShortComplete);
  assert.equal(brandLampShort(run("incomplete"), today), T.brandShortPartial);
  assert.equal(brandLampShort(run("ingest-only"), today), T.brandShortPartial);
  assert.equal(brandLampShort(run("unknown"), today), T.brandShortPartial);
  assert.equal(brandLampShort(run("complete", "2030-01-20"), today), T.brandShortOld);
  assert.equal(brandLampShort(run("failed"), today), T.brandShortFailed);
  assert.equal(brandLampShort(run("failed", "2030-01-20"), today), T.brandShortFailed);
  assert.equal(brandLampShort(null, today), T.brandShortNone);
  assert.equal(T.brandShortComplete, "Corrida completa");
  assert.equal(T.brandShortPartial, "Corrida a medias");
  assert.equal(T.brandShortFailed, "Corrida fallida");
});

test("rowMarks: a catalog row's marks by kind and name, nothing when nobody marked it", () => {
  const { data } = scenarios().find((s) => s.name === "catalog");
  const [weighty, interested, watching, discarded] = catalogView(data).sections;
  assert.deepEqual(rowMarks(weighty.items[0]), [fill(T.markedBy, { mark: T.markInterested, names: "Carla" })]);
  assert.deepEqual(rowMarks(interested.items[0]), [fill(T.markedBy, { mark: T.markInterested, names: "Beto" })]);
  assert.deepEqual(rowMarks(watching.items[0]), []);
  assert.deepEqual(rowMarks(discarded.items[0]), [fill(T.markedBy, { mark: T.markDiscarded, names: "Ana" })]);
  assert.deepEqual(rowMarks({}), []);
});

// ---- why each station is there (fix round 1, finish review 1) -------------------------------------------------------

// The testimonies come from the pain's latest history entry (`inputs.testimonies`, as record-run.mjs writes it); the
// attacks from a version-3 card; the duel reason only for the survivors' duel winner, from the card's won duel.
test("stationFacts: testimonies of the latest history entry, attacks held of a v3 card, the winner's duel reason", () => {
  const pain = { id: "dol-9201", history: [
    { run_id: "2030-01-28-1", date: "2030-01-28", score: 9, inputs: { testimonies: 3, tiers: 2 } },
    { run_id: "2030-02-04-1", date: "2030-02-04", score: 11, inputs: { testimonies: 5, tiers: 2 } },
  ] };
  const card = { version: 3, attacks: [
    { lens: "evidence", held: true }, { lens: "buyer", held: true }, { lens: "root-cause", held: false },
    { lens: "feasibility", held: true }, { lens: "existing-solution", held: true }, { lens: "x", held: "yes" },
  ], duels: [{ against: "dol-9202", won: false, plain: "Perdió." }, { against: "dol-9203", won: true, plain: " Tiene un comprador más claro. " }] };
  assert.deepEqual(stationFacts(pain, card, { winner: true }), { testimonies: 5, attacks: { held: 4, total: 5 }, duelReason: "Tiene un comprador más claro." });
  assert.deepEqual(stationFacts(pain, card, { winner: false }).duelReason, null);
  // The history comes in any order: the latest by date wins.
  const reversed = { ...pain, history: [...pain.history].reverse() };
  assert.equal(stationFacts(reversed, card).testimonies, 5);
});

test("stationFacts: a v2 card has no attacks, odd inputs give nothing, and nothing is invented", () => {
  assert.deepEqual(stationFacts({ history: [{ run_id: "r", date: "2030-02-04", inputs: { testimonies: "7" } }] }, { version: 2 }, { winner: true }),
    { testimonies: null, attacks: null, duelReason: null });
  assert.deepEqual(stationFacts(null, null), { testimonies: null, attacks: null, duelReason: null });
  assert.deepEqual(stationFacts({ history: [{ inputs: null }, null, 3] }, { attacks: [] }), { testimonies: null, attacks: null, duelReason: null });
  assert.equal(stationFacts({ history: [{ date: "2030-02-04", inputs: { testimonies: -1 } }] }, {}).testimonies, null);
  assert.equal(stationFacts({ history: [{ date: "2030-02-04", inputs: { testimonies: 0 } }] }, {}).testimonies, 0);
});

test("stationFactLines: «N testimonios» and «Resistió X de N ataques», in words, singular when one", () => {
  assert.deepEqual(stationFactLines({ testimonies: 5, attacks: { held: 4, total: 5 }, duelReason: "x" }), ["5 testimonios", "Resistió 4 de 5 ataques"]);
  assert.deepEqual(stationFactLines({ testimonies: 1, attacks: { held: 1, total: 1 } }), ["1 testimonio", "Resistió 1 de 1 ataque"]);
  assert.deepEqual(stationFactLines({ testimonies: 12345, attacks: null }), ["12.345 testimonios"]);
  assert.deepEqual(stationFactLines({ testimonies: null, attacks: null }), []);
  assert.deepEqual(stationFactLines(null), []);
});

test("decideList gives each station its facts and says which ones are full stations", () => {
  const latest = trace("2030-02-04-1", "2030-02-04", {
    duels: [{ a: "dol-9211", b: "dol-9212", winner: "dol-9212", reason: "raw" }], ranking: ["dol-9212", "dol-9211"], duel_kind: "survivors",
  });
  const withInputs = (runIds, testimonies) => runIds.map((id) => ({ ...entry(id), inputs: { testimonies } }));
  const pains = [
    painOf("dol-9211", "watching", [], { history: withInputs(["2030-02-04-1"], 3) }),
    painOf("dol-9212", "watching", [], { history: withInputs(["2030-02-04-1"], 6) }),
    painOf("dol-9213", "alive", [], { history: withInputs(["2030-01-28-1"], 4) }),
  ];
  const winnerCard = lineCard("dol-9212");
  Object.assign(winnerCard.card, { version: 3, attacks: [{ lens: "evidence", held: true }], duels: [{ against: "dol-9211", won: true, plain: "Más clubes lo pagan." }] });
  const items = decideList({ pains, cards: [lineCard("dol-9211"), winnerCard, lineCard("dol-9213")], marks: [], people: CREW, traces: [latest, ...RUNS.slice(1)] });
  assert.deepEqual(items.map((i) => [i.id, i.full]), [["dol-9212", true], ["dol-9213", true], ["dol-9211", false]]);
  assert.deepEqual(items[0].facts, { testimonies: 6, attacks: { held: 1, total: 1 }, duelReason: "Más clubes lo pagan." });
  assert.deepEqual(items[2].facts, { testimonies: 3, attacks: null, duelReason: null });
});

// The top bar says the week the same way on every screen (finish review, round 3). The home reads the week with
// loadHome; a screen opened first (a pain from the Monday email, Corridas) with loadWeek, which reads one trace. Both go
// through weekMeta(summary, latestTrace(traces, summary)): the run's own niche name and cost when the latest trace is
// that run's, else the summary's topic by its plain name and no cost.
test("the top bar names the niche and the cost the same way whether the home or a pain is opened first", async () => {
  const summary = { run_id: "2030-02-04-1", date: "2030-02-04", status: "complete", territory: "documents-for-ai", reasons: [], new_pains: 1, items_reviewed: 9 };
  const week = trace("2030-02-04-1", "2030-02-04", { niche: { id: "x", name: "Documentos para IA" }, cost: { total_usd: 3.66, by_model: [], cards_usd: null } });
  const tables = { pains: { data: [] }, pain_cards: { data: [] }, marks: { data: [] }, people: { data: CREW } };
  const bar = (loaded) => weekMeta(loaded.summary, latestTrace(loaded.traces, loaded.summary));

  // A trace for the summary's run: its niche name and its cost, on both paths (the home reads more traces).
  const home = await loadHome(fakeClient({ ...tables, "rpc:week_summary": { data: summary }, "rpc:run_traces": { data: [week, ...RUNS.slice(1)] } }));
  const first = await loadWeek(fakeClient({ "rpc:week_summary": { data: summary }, "rpc:run_traces": { data: [week] } }));
  const expected = [
    { label: T.metaWeek, value: "4 de febrero" },
    { label: T.metaNiche, value: "Documentos para IA" },
    { label: T.metaCost, value: fill(T.costUsd, { amount: "3,66" }) },
  ];
  assert.deepEqual(bar(home), expected);
  assert.deepEqual(bar(first), expected);

  // No trace for that run (it failed early): the summary's topic by its plain name, and no cost, on both paths.
  const failed = { ...summary, run_id: "2030-02-11-1", date: "2030-02-11", status: "failed" };
  const homeFailed = await loadHome(fakeClient({ ...tables, "rpc:week_summary": { data: failed }, "rpc:run_traces": { data: [week] } }));
  const firstFailed = await loadWeek(fakeClient({ "rpc:week_summary": { data: failed }, "rpc:run_traces": { data: [week] } }));
  const fallback = [{ label: T.metaWeek, value: "11 de febrero" }, { label: T.metaNiche, value: "Preparar documentos para la IA" }];
  assert.deepEqual(bar(homeFailed), fallback);
  assert.deepEqual(bar(firstFailed), fallback);
});

// ---- the lab report: a pain's judged counts (dolores' decideStatus, `gate` on the pain's doc) as analysis rows ------

const GATE = Object.freeze({
  testimonies: 4, tiers: 2, survivals: 4, verdicts: 5, has_statement: true, per_country: false,
  thresholds: Object.freeze({ testimonies: 3, tiers: 2, survivals: 3, verdicts: 5 }),
});
const gateWith = (extra = {}, thresholds = {}) => ({ ...GATE, ...extra, thresholds: { ...GATE.thresholds, ...thresholds } });
const rowOf = (gate, key) => analysisRows(gate).rows.find((row) => row.key === key);
const pick = ({ value, min, max, at }) => ({ value, min, max, at });

test("analysisRows reads the thresholds from the gate", () => {
  const { rows } = analysisRows(gateWith());
  assert.deepEqual(rows.map((row) => row.key), ["testimonies", "tiers", "survivals"]);
  assert.deepEqual(rows.map((row) => row.label), ["Testimonios", "Tipos de fuente", "Ataques resistidos"]);
  assert.deepEqual(rows.map((row) => row.range), ["3 o más", "2 o más", "3 o más"]);
  assert.deepEqual(rows.map((row) => row.min), [3, 2, 3]);
  assert.equal(rowOf(gateWith({}, { testimonies: 4 }), "testimonies").range, "4 o más");
  assert.equal(rowOf(gateWith({}, { testimonies: 4 }), "testimonies").min, 4);
  // The survivals total is the gate's own number of attacks, not a fixed five.
  assert.equal(rowOf(gateWith({ survivals: 5, verdicts: 6 }, { verdicts: 6 }), "survivals").value, "5 de 6");
  // A complete result counts the attacks that answered (gate.verdicts), as dolores' own reason does, not the required
  // number: six answered and all held reads «6 de 6» though five were required.
  assert.equal(rowOf(gateWith({ survivals: 6, verdicts: 6 }, { verdicts: 5 }), "survivals").value, "6 de 6");
});

test("analysisRows: in and out of range, with the value in words and the bar's ends", () => {
  assert.deepEqual(rowOf(gateWith({ testimonies: 4 }), "testimonies"), {
    key: "testimonies", label: "Testimonios", value: "4", range: "3 o más", min: 3, max: 6, at: 4, flag: "in", flagText: "DENTRO DEL RANGO",
  });
  assert.deepEqual(rowOf(gateWith({ tiers: 1 }), "tiers"), {
    key: "tiers", label: "Tipos de fuente", value: "1", range: "2 o más", min: 2, max: 4, at: 1, flag: "out", flagText: "FUERA DEL RANGO",
  });
  // Exactly at the threshold is in range; the bar grows past twice the threshold to fit the value.
  assert.equal(rowOf(gateWith({ testimonies: 3 }), "testimonies").flag, "in");
  const many = rowOf(gateWith({ testimonies: 12345 }), "testimonies");
  assert.deepEqual([many.value, many.max, many.at], ["12.345", 12345, 12345]);
  // The attacks' bar spans the attacks that answered: «2 de 5» ends at 5, and «4 de 6» at 6.
  assert.deepEqual(rowOf(gateWith({ survivals: 2 }), "survivals"), {
    key: "survivals", label: "Ataques resistidos", value: "2 de 5", range: "3 o más", min: 3, max: 5, at: 2, flag: "out", flagText: "FUERA DEL RANGO",
  });
  assert.deepEqual(pick(rowOf(gateWith({ survivals: 4 }), "survivals")), { value: "4 de 5", min: 3, max: 5, at: 4 });
  assert.deepEqual(pick(rowOf(gateWith({ survivals: 4, verdicts: 6 }), "survivals")), { value: "4 de 6", min: 3, max: 6, at: 4 });
  // A gate whose numbers do not add up never pushes the threshold or the mark off the bar.
  assert.deepEqual(pick(rowOf(gateWith({ survivals: 1, verdicts: 2 }, { survivals: 3, verdicts: 2 }), "survivals")), { value: "1 de 2", min: 3, max: 3, at: 1 });
  assert.deepEqual(pick(rowOf(gateWith({ survivals: 7, verdicts: 5 }), "survivals")), { value: "7 de 5", min: 3, max: 7, at: 7 });
  assert.equal(rowOf(gateWith({ testimonies: 0 }), "testimonies").flag, "out");
});

test("analysisRows: no statement adds the statement row only when it is missing", () => {
  assert.equal(rowOf(gateWith({ has_statement: true }), "statement"), undefined);
  assert.equal(rowOf(gateWith({ has_statement: undefined }), "statement"), undefined);
  const { rows } = analysisRows(gateWith({ has_statement: false }));
  assert.deepEqual(rows.map((row) => row.key), ["testimonies", "tiers", "survivals", "statement"]);
  assert.deepEqual(rows[3], {
    key: "statement", label: "Descrito por quien lo sufre", value: "Falta", range: "", min: null, max: null, at: null, flag: "out", flagText: "FUERA DEL RANGO",
  });
});

test("analysisRows: incomplete attacks have no flag", () => {
  assert.deepEqual(rowOf(gateWith({ survivals: null, verdicts: 3 }), "survivals"), {
    key: "survivals", label: "Ataques resistidos", value: "Sin resultado completo (3 de 5 respondieron)", range: "3 o más",
    min: null, max: null, at: null, flag: "none", flagText: "",
  });
  assert.equal(rowOf(gateWith({ survivals: null, verdicts: 1 }), "survivals").value, "Sin resultado completo (1 de 5 respondieron)");
  assert.equal(rowOf(gateWith({ survivals: null, verdicts: 4 }), "survivals").value, "Sin resultado completo (4 de 5 respondieron)");
});

test("analysisRows: a pain no attack answered says so, with no bar and no flag", () => {
  // «0 de 5 respondieron» would claim five attacks were sent: none may have been, this run or ever.
  const none = { key: "survivals", label: "Ataques resistidos", value: "Sin ataques evaluados", range: "3 o más", min: null, max: null, at: null, flag: "none", flagText: "" };
  assert.deepEqual(rowOf(gateWith({ survivals: null, verdicts: 0 }), "survivals"), none);
  // A gate whose survivals do not add up with no attack answered still invents no result.
  assert.deepEqual(rowOf(gateWith({ survivals: 0, verdicts: 0 }), "survivals"), none);
});

test("analysisRows: per country adds the note", () => {
  assert.equal(analysisRows(gateWith({ per_country: true })).note, "Contado dentro de un solo país");
  assert.equal(analysisRows(gateWith({ per_country: false })).note, null);
  assert.equal(analysisRows(gateWith({ per_country: "true" })).note, null);
});

test("analysisRows: a missing or malformed gate gives no rows", () => {
  const none = { rows: [], note: null };
  for (const gate of [null, undefined, {}, { testimonies: "x" }, "gate", 7, [], [GATE]]) assert.deepEqual(analysisRows(gate), none, JSON.stringify(gate));
  assert.deepEqual(analysisRows(), none);
  for (const extra of [{ testimonies: -1 }, { tiers: 1.5 }, { verdicts: null }, { survivals: "4" }, { survivals: -1 }, { survivals: undefined }]) {
    assert.deepEqual(analysisRows(gateWith(extra)), none, JSON.stringify(extra));
  }
  for (const thresholds of [undefined, null, "3", [3, 2, 3, 5]]) assert.deepEqual(analysisRows({ ...GATE, thresholds }), none, String(thresholds));
  for (const bad of [{ testimonies: 0 }, { tiers: -2 }, { survivals: "3" }, { verdicts: 2.5 }, { verdicts: undefined }]) {
    assert.deepEqual(analysisRows(gateWith({}, bad)), none, JSON.stringify(bad));
  }
  // Only the counts the page reads are checked: a field it does not know is ignored.
  assert.equal(analysisRows({ ...gateWith(), extra: "x" }).rows.length, 3);
});

test("decideList carries each pain's gate to its station, or null without one", () => {
  const pains = [painOf("dol-9221", "alive", [], { gate: gateWith() }), painOf("dol-9222", "alive"), painOf("dol-9223", "alive", [], { gate: "odd" })];
  const items = decideList({ pains, cards: ["dol-9221", "dol-9222", "dol-9223"].map((id) => lineCard(id)), marks: [], people: CREW, traces: [] });
  const byId = new Map(items.map((item) => [item.id, item.gate]));
  assert.deepEqual(byId.get("dol-9221"), gateWith());
  assert.equal(byId.get("dol-9222"), null);
  assert.equal(byId.get("dol-9223"), null);
});
