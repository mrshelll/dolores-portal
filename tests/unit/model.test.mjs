import { test } from "node:test";
import assert from "node:assert/strict";
import {
  effectiveMark, buildSections, sectionOf, weekSentence, emptySentence, onlyDiscardedSentence, homeNotice, sentenceTense, runNotice, classifyError, firstPage, nextPage, PAGE_SIZE, PAGED_ABOVE, rowMeta,
} from "../../js/model.js";
import { loadHome } from "../../js/api.js";
import { T } from "../../js/text.js";

// Fixtures in the base's shapes, with invented texts (this repository is public and carries no catalog data).
const PEOPLE = [
  { email: "miguel@example.com", name: "Miguel" },
  { email: "jaime@example.com", name: "Jaime" },
  { email: "fabio@example.com", name: "Fabio" },
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
    mark("a", "miguel@example.com", "discarded"), mark("a", "jaime@example.com", "interested"),
    mark("b", "fabio@example.com", "discarded"),
    mark("c", "fabio@example.com", "interested"),
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
    marks: [mark("dol-0002", "fabio@example.com", "discarded"), mark("dol-0002", "jaime@example.com", "interested")],
    people: PEOPLE,
  });
  assert.deepEqual(idsOf(sections), { weighty: [], interested: ["dol-0002"], watching: [], discarded: [] });
  const [item] = sections.interested;
  assert.deepEqual(item.marks, [{ name: "Fabio", mark: "discarded" }, { name: "Jaime", mark: "interested" }]);
});

test("an alive pain marked interested lands in weighty", () => {
  const sections = buildSections({
    pains: [{ id: "dol-0027", territory: "document-data-extraction", status: "alive" }],
    cards: [fullCard("dol-0027", { title: "Cobrar las cuotas del club a tiempo" })],
    marks: [mark("dol-0027", "miguel@example.com", "interested")],
    people: PEOPLE,
  });
  assert.deepEqual(idsOf(sections), { weighty: ["dol-0027"], interested: [], watching: [], discarded: [] });
  assert.deepEqual(sections.weighty[0], {
    id: "dol-0027",
    title: "Cobrar las cuotas del club a tiempo",
    who: "Quien sufre dol-0027.",
    trend: { direction: "steady", last_evidence: "2026-09-18" },
    topic: "Sacar datos de documentos",
    marks: [{ name: "Miguel", mark: "interested" }],
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
    marks: [mark("dol-0001", "jaime@example.com", "discarded")],
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
    marks: [mark("p-discarded-alive", "fabio@example.com", "discarded"), mark("p-interested-dead", "miguel@example.com", "interested")],
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
    marks: [mark("t-dead-interested", "jaime@example.com", "interested"), mark("t-still-discarded", "fabio@example.com", "discarded")],
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
      mark("hand", "jaime@example.com", "interested"),
      mark("hand-null", "miguel@example.com", "interested"),
      mark("t-bogus", "fabio@example.com", "interested"),
      mark("hand-discarded-mark", "fabio@example.com", "discarded"),
      mark("t-watching", "jaime@example.com", "interested"),
      mark("t-dead", "jaime@example.com", "interested"),
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
  assert.equal(sectionOf(pains[4], [mark("t-watching", "jaime@example.com", "interested")]), "interested");
  for (const pain of pains.slice(0, 3)) assert.equal(sectionOf(pain, [mark(pain.id, "jaime@example.com", "interested")]), null, pain.id);
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
      mark("dol-0027", "Miguel@Example.com", "interested"),
      mark("dol-0027", "ana@example.com", "discarded"),
      mark("dol-0027", "jaime@example.com", "maybe"),
    ],
    people: PEOPLE,
  });
  assert.deepEqual(sections.interested[0].marks, [{ name: "ana@example.com", mark: "discarded" }, { name: "Miguel", mark: "interested" }]);
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
    marks: [{ name: "Fabio", mark: "discarded" }, { name: "Jaime", mark: "interested" }, { name: "Miguel", mark: "interested" }] };
  assert.deepEqual(rowMeta(item), ["Gana fuerza", "Sacar datos de documentos", "Nos interesa: Jaime y Miguel", "Descartado: Fabio"]);
  assert.deepEqual(rowMeta({ ...item, marks: [{ name: "Jaime", mark: "interested" }] }), ["Gana fuerza", "Sacar datos de documentos", "Nos interesa: Jaime"]);
  assert.deepEqual(rowMeta({ ...item, trend: { direction: null }, marks: [] }), ["Sacar datos de documentos"]);
  for (const [direction, label] of [["new", "Dolor nuevo"], ["rising", "Gana fuerza"], ["falling", "Pierde fuerza"], ["steady", "Igual que la semana pasada"]]) {
    assert.equal(rowMeta({ ...item, trend: { direction }, marks: [] })[0], label);
  }
});

// ---- weekSentence ----------------------------------------------------------------------------

const SUMMARY = { run_id: "2026-11-10-3", date: "2026-11-10", status: "complete", territory: "documents-for-ai", reasons: [], new_pains: 6, items_reviewed: 480 };

test("weekSentence singular, plural, zero and without items", () => {
  assert.equal(weekSentence(SUMMARY, { weighty: 1 }),
    "Esta semana hay 1 dolor con peso para trabajar. Revisamos 480 publicaciones sobre «Preparar documentos para la IA».");
  assert.equal(weekSentence(SUMMARY, { weighty: 3 }),
    "Esta semana hay 3 dolores con peso para trabajar. Revisamos 480 publicaciones sobre «Preparar documentos para la IA».");
  assert.equal(weekSentence(SUMMARY, { weighty: 0 }),
    "Esta semana ningún dolor tiene peso suficiente para trabajar. Revisamos 480 publicaciones sobre «Preparar documentos para la IA».");
  assert.equal(weekSentence({ ...SUMMARY, items_reviewed: null }, { weighty: 0 }),
    "Esta semana ningún dolor tiene peso suficiente para trabajar.");
  assert.equal(weekSentence(null, { weighty: 2 }), "Esta semana hay 2 dolores con peso para trabajar.");
});

test("weekSentence says one publication, groups thousands, and drops a topic it cannot name", () => {
  assert.equal(weekSentence({ ...SUMMARY, items_reviewed: 1 }, { weighty: 1 }),
    "Esta semana hay 1 dolor con peso para trabajar. Revisamos 1 publicación sobre «Preparar documentos para la IA».");
  assert.equal(weekSentence({ ...SUMMARY, items_reviewed: 12345, territory: null }, { weighty: 1 }),
    "Esta semana hay 1 dolor con peso para trabajar. Revisamos 12.345 publicaciones.");
  assert.equal(weekSentence({ ...SUMMARY, territory: "a-new-territory" }, { weighty: 1 }),
    "Esta semana hay 1 dolor con peso para trabajar. Revisamos 480 publicaciones.");
  assert.equal(weekSentence({ ...SUMMARY, items_reviewed: 0 }, {}), "Esta semana ningún dolor tiene peso suficiente para trabajar.");
  assert.equal(weekSentence({ ...SUMMARY, items_reviewed: "480" }, { weighty: 1 }), "Esta semana hay 1 dolor con peso para trabajar.");
});

test("weekSentence for a list from a run that did not finish well speaks of that run (past)", () => {
  assert.equal(weekSentence(SUMMARY, { weighty: 1, past: true }),
    "En esa revisión hubo 1 dolor con peso para trabajar. Revisamos 480 publicaciones sobre «Preparar documentos para la IA».");
  assert.equal(weekSentence({ ...SUMMARY, items_reviewed: null }, { weighty: 4, past: true }), "En esa revisión hubo 4 dolores con peso para trabajar.");
  assert.equal(weekSentence(null, { weighty: 0, past: true }), "En esa revisión no hubo ningún dolor con peso para trabajar.");
  assert.equal(weekSentence(SUMMARY, { weighty: 1, past: false }).startsWith("Esta semana hay 1 dolor"), true);
});

test("weekSentence for a complete run more than 8 days old speaks of the last review, never of this week", () => {
  assert.equal(weekSentence(SUMMARY, { weighty: 1, latest: true }),
    "En la última revisión hubo 1 dolor con peso para trabajar. Revisamos 480 publicaciones sobre «Preparar documentos para la IA».");
  assert.equal(weekSentence({ ...SUMMARY, items_reviewed: null }, { weighty: 3, latest: true }), "En la última revisión hubo 3 dolores con peso para trabajar.");
  assert.equal(weekSentence(SUMMARY, { weighty: 0, latest: true }).startsWith("En la última revisión no hubo ningún dolor con peso para trabajar."), true);
});

test("sentenceTense: this week's failed or incomplete run is «past»; any stale run, or one that only gathered, is «latest»", () => {
  const at = (summary) => sentenceTense(runNotice(summary, TODAY));
  assert.equal(at(SUMMARY), null);
  assert.equal(at({ ...SUMMARY, status: "failed" }), "past");
  assert.equal(at({ ...SUMMARY, status: "incomplete" }), "past");
  assert.equal(at({ ...SUMMARY, status: "ingest-only" }), "latest");
  assert.equal(at({ ...SUMMARY, date: "2026-11-02" }), "latest");
  assert.equal(at({ ...SUMMARY, date: "2026-11-04" }), null); // 8 days: still this week's
  for (const status of ["failed", "incomplete", "ingest-only", "complete"]) {
    assert.equal(at({ ...SUMMARY, date: "2026-11-02", status }), "latest", status);
  }
  assert.equal(at(null), null);
  assert.equal(sentenceTense(null), null);
});

test("the only-discarded home never says «esta semana» when the week's run did not end well", () => {
  for (const kind of ["failed", "incomplete", "ingest-only", "stale"]) {
    assert.equal(onlyDiscardedSentence({ kind }), T.homeOnlyDiscardedLatest, kind);
  }
  assert.equal(onlyDiscardedSentence(null), T.homeOnlyDiscarded);
  assert.equal(onlyDiscardedSentence(), T.homeOnlyDiscarded);
});

// ---- emptySentence ---------------------------------------------------------------------------

test("emptySentence: one sentence for an empty home, with what was reviewed when it is known", () => {
  assert.equal(emptySentence(SUMMARY),
    "Revisamos 480 publicaciones sobre «Preparar documentos para la IA» y ninguna trajo un dolor. La próxima revisión es el lunes.");
  assert.equal(emptySentence({ ...SUMMARY, items_reviewed: 1 }),
    "Revisamos 1 publicación sobre «Preparar documentos para la IA» y no trajo ningún dolor. La próxima revisión es el lunes.");
  assert.equal(emptySentence({ ...SUMMARY, items_reviewed: 12345, territory: "a-new-territory" }),
    "Revisamos 12.345 publicaciones y ninguna trajo un dolor. La próxima revisión es el lunes.");
  assert.equal(emptySentence({ ...SUMMARY, items_reviewed: 1, territory: null }),
    "Revisamos 1 publicación y no trajo ningún dolor. La próxima revisión es el lunes.");
  for (const summary of [{ ...SUMMARY, items_reviewed: null }, { ...SUMMARY, items_reviewed: 0 }, { ...SUMMARY, items_reviewed: "480" }]) {
    assert.equal(emptySentence(summary), "Esta semana no apareció ningún dolor. La próxima revisión es el lunes.");
  }
});

// ---- the home's sentences, per run status, this week's run and an old one ------------------------

// What the home says for each status, fresh (2 days old) and stale (10 days old): the week's sentence above a list with
// one weighty pain, the sentence of an empty home, and the one of a home with only discarded pains. None of them may
// contradict the notice: no «esta semana» under a stale notice, no «Revisamos…» after a run that did not review.
const TOPIC = "«Preparar documentos para la IA»";
const HOME_SENTENCES = {
  complete: {
    fresh: [`Esta semana hay 1 dolor con peso para trabajar. Revisamos 480 publicaciones sobre ${TOPIC}.`,
      `Revisamos 480 publicaciones sobre ${TOPIC} y ninguna trajo un dolor. La próxima revisión es el lunes.`,
      "No hay dolores activos esta semana. Los descartados están abajo."],
    stale: [`En la última revisión hubo 1 dolor con peso para trabajar. Revisamos 480 publicaciones sobre ${TOPIC}.`,
      `Revisamos 480 publicaciones sobre ${TOPIC} y ninguna trajo un dolor. La próxima revisión es el lunes.`,
      "No hay dolores activos. Los descartados están abajo."],
  },
  incomplete: {
    fresh: [`En esa revisión hubo 1 dolor con peso para trabajar. Revisamos 480 publicaciones sobre ${TOPIC}.`,
      `Revisamos 480 publicaciones sobre ${TOPIC} y ninguna trajo un dolor. La próxima revisión es el lunes.`,
      "No hay dolores activos. Los descartados están abajo."],
    stale: [`En la última revisión hubo 1 dolor con peso para trabajar. Revisamos 480 publicaciones sobre ${TOPIC}.`,
      `Revisamos 480 publicaciones sobre ${TOPIC} y ninguna trajo un dolor. La próxima revisión es el lunes.`,
      "No hay dolores activos. Los descartados están abajo."],
  },
  failed: {
    fresh: ["En esa revisión hubo 1 dolor con peso para trabajar.",
      "La revisión de esta semana no terminó, así que no hay dolores nuevos. La próxima revisión es el lunes.",
      "No hay dolores activos. Los descartados están abajo."],
    stale: ["En la última revisión hubo 1 dolor con peso para trabajar.",
      "La última revisión no terminó, así que no hay dolores nuevos. La próxima revisión es el lunes.",
      "No hay dolores activos. Los descartados están abajo."],
  },
  "ingest-only": {
    fresh: ["En la última revisión hubo 1 dolor con peso para trabajar.",
      "La revisión de esta semana no terminó, así que no hay dolores nuevos. La próxima revisión es el lunes.",
      "No hay dolores activos. Los descartados están abajo."],
    stale: ["En la última revisión hubo 1 dolor con peso para trabajar.",
      "La última revisión no terminó, así que no hay dolores nuevos. La próxima revisión es el lunes.",
      "No hay dolores activos. Los descartados están abajo."],
  },
};
const DATES = { fresh: "2026-11-10", stale: "2026-11-02" };

function homeSentences(summary) {
  const notice = runNotice(summary, TODAY);
  const tense = sentenceTense(notice);
  return [
    weekSentence(summary, { weighty: 1, past: tense === "past", latest: tense === "latest" }),
    emptySentence(summary, notice),
    onlyDiscardedSentence(notice),
  ];
}

for (const [status, byAge] of Object.entries(HOME_SENTENCES)) {
  for (const [age, expected] of Object.entries(byAge)) {
    test(`the home's sentences for a ${age} ${status} run agree with its notice`, () => {
      const summary = { ...SUMMARY, status, date: DATES[age] };
      const said = homeSentences(summary);
      assert.deepEqual(said, expected);
      if (age === "stale") for (const line of said) assert.doesNotMatch(line, /esta semana/i);
      if (status === "failed" || status === "ingest-only") for (const line of said) assert.doesNotMatch(line, /Revisamos/);
    });
  }
}

test("an empty home of an old run without a count of publications does not say «esta semana»", () => {
  const stale = { ...SUMMARY, date: "2026-11-02", items_reviewed: null };
  assert.equal(emptySentence(stale, runNotice(stale, TODAY)), "En la última revisión no apareció ningún dolor. La próxima revisión es el lunes.");
  const fresh = { ...SUMMARY, items_reviewed: null };
  assert.equal(emptySentence(fresh, runNotice(fresh, TODAY)), "Esta semana no apareció ningún dolor. La próxima revisión es el lunes.");
});

test("a failed or ingest-only run never reports a count of publications, even when the summary has one", () => {
  for (const status of ["failed", "ingest-only"]) {
    assert.equal(weekSentence({ ...SUMMARY, status }, { weighty: 2 }), "Esta semana hay 2 dolores con peso para trabajar.");
    assert.doesNotMatch(emptySentence({ ...SUMMARY, status }), /Revisamos/);
  }
  assert.equal(weekSentence({ ...SUMMARY, status: "something-new" }, { weighty: 2 }), "Esta semana hay 2 dolores con peso para trabajar.");
});

test("with no review at all, the empty home says so once and when the first one is, without a separate notice", () => {
  for (const summary of [null, undefined, "not a summary"]) {
    const notice = runNotice(summary, TODAY);
    assert.equal(notice.kind, "none");
    assert.equal(emptySentence(summary, notice), "Todavía no hay ninguna revisión. La primera es el lunes.");
    assert.equal(emptySentence(summary), "Todavía no hay ninguna revisión. La primera es el lunes.");
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
    { kind: "failed", text: "La revisión de esta semana falló. Ves la lista de la última revisión que terminó." });
  const incomplete = runNotice({ ...SUMMARY, status: "incomplete" }, TODAY);
  assert.equal(incomplete.kind, "incomplete");
  assert.match(incomplete.text, /^La revisión de esta semana quedó incompleta: puede faltar algún dolor\. Ves la lista del 10 nov\.? 2026\.$/);
  assert.deepEqual(runNotice({ ...SUMMARY, status: "ingest-only" }, TODAY),
    { kind: "ingest-only", text: "Esta semana solo se juntaron publicaciones; no se revisaron." });
  const stale = runNotice({ ...SUMMARY, date: "2026-11-02" }, TODAY);
  assert.equal(stale.kind, "stale");
  assert.match(stale.text, /^La última revisión es del 2 nov\.? 2026\.$/);
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
  assert.match(stale("failed").text, /^La última revisión es del 2 nov\.? 2026 y falló\.$/);
  assert.match(stale("incomplete").text, /^La última revisión es del 2 nov\.? 2026 y quedó incompleta: puede faltar algún dolor\.$/);
  assert.match(stale("ingest-only").text, /^La última revisión es del 2 nov\.? 2026 y solo juntó publicaciones; no llegó a leerlas\.$/);
  assert.match(stale("complete").text, /^La última revisión es del 2 nov\.? 2026\.$/);
  for (const status of ["failed", "incomplete", "ingest-only", "complete"]) assert.equal(stale(status).kind, "stale");
});

test("runNotice without a usable date judges by status only, and ignores an unknown status", () => {
  assert.equal(runNotice({ ...SUMMARY, date: null }, TODAY), null);
  const undated = runNotice({ ...SUMMARY, date: "not a date", status: "incomplete" }, TODAY);
  assert.deepEqual(undated, { kind: "incomplete", text: "La revisión de esta semana quedó incompleta: puede faltar algún dolor." });
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
    marks: { data: [mark("dol-0027", "miguel@example.com", "interested")] },
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
    ["select", "pains", "id,territory,status,team_discard:doc->team_discard"],
    ["select", "people", "*"],
    ["rpc", "week_summary", undefined],
  ]);
});

test("loadHome turns no run into a null summary and missing rows into empty lists", async () => {
  const home = await loadHome(fakeClient({ "rpc:week_summary": { data: null } }));
  assert.deepEqual(home, { summary: null, pains: [], cards: [], marks: [], people: [] });
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
