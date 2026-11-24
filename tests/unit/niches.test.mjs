import { test } from "node:test";
import assert from "node:assert/strict";
import { T, fill, formatDayMonth, topicName } from "../../js/text.js";
import { nicheBoard, withVeto, paidRunsText, painsText, versusLabel } from "../../js/niches.js";

// Nichos: the board the tab draws from the newest trace with a choice (dolores' buildTrace: choice, probe, why,
// territories, niche, date, status), the proposed niches, the vetoes, the pains, the marks and the people. Every name
// and text here is invented.
const PEOPLE = [
  { email: "ana@example.com", name: "Ana" },
  { email: "beto@example.com", name: "Beto" },
  { email: "carla@example.com", name: "Carla" },
];

const entry = (name, complaints, spending, extra = {}) => ({
  name, score: complaints === null || spending === null ? null : Math.min(complaints, spending), complaints, spending,
  source: "judge", resting: false, resting_until: null, advanced_pains: null, ...extra,
});

function trace(extra = {}) {
  return {
    run_id: "2030-02-04-1", date: "2030-02-04", status: "complete",
    niche: { id: "developer-tools", name: "Herramientas para programadores" },
    why: "Este era el que traía más quejas y más dinero a la vez.",
    territories: [
      { id: "developer-tools", name: "Herramientas para programadores" },
      { id: "us-consumer-finance", name: "Finanzas personales en EE. UU." },
      { id: "accounting-automation", name: "Automatizar la contabilidad" },
      { id: "documents-for-ai", name: "Documentos para IA" },
    ],
    choice: {
      territory: "developer-tools", reason: "switched-stalled", stalled: "documents-for-ai",
      ranking: [
        entry("developer-tools", 107, 96, { advanced_pains: 2 }),
        entry("us-consumer-finance", 41, 109),
        entry("claims-of-health-insurance", 29, 52),
        entry("accounting-automation", 29, 447),
        entry("documents-for-ai", 0, 4, { source: "counts", resting: true, resting_until: "2030-03-04" }),
      ],
    },
    probe: [
      { name: "developer-tools", noise_share: 0.281, source: "judge" },
      { name: "us-consumer-finance", noise_share: 0.31, source: "judge" },
      { name: "claims-of-health-insurance", noise_share: 0.44, source: "judge" },
      { name: "accounting-automation", noise_share: null, source: "judge" },
      { name: "documents-for-ai", noise_share: null, source: "counts" },
    ],
    ...extra,
  };
}

const NICHES = [
  {
    name: "claims-of-health-insurance", label: "Reclamos de seguros médicos", summary: "Vacantes que piden conciliar reclamos a mano.",
    state: "active", state_by: null, state_changed_at: null, proposed_at: "2030-01-20T10:00:00Z",
  },
  {
    name: "clinic-billing", label: "Facturación de clínicas", summary: "Clínicas que facturan a mano.",
    state: "retired", state_by: "dolores", state_changed_at: "2030-02-02T09:00:00Z", proposed_at: "2029-11-03T10:00:00Z",
  },
];

// The week's summary (week_summary) names this trace's run: it is this week's (the home's rule, model.js isThisWeeksRun).
const SUMMARY = { run_id: "2030-02-04-1", date: "2030-02-04", status: "complete", territory: "developer-tools" };
const input = (extra = {}) => ({ traces: [trace()], niches: NICHES, vetoes: [], pains: [], marks: [], people: PEOPLE, summary: SUMMARY, ...extra });
const rowOf = (board, id) => board.rows.find((r) => r.id === id);

// Every string anywhere in the board, with where it is, except the ids themselves.
function strings(value, where = "board", out = []) {
  if (typeof value === "string") out.push([where, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${where}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) if (key !== "id") strings(v, `${where}.${key}`, out);
  }
  return out;
}

// ---- empty ----------------------------------------------------------------------------------------

test("no trace with a choice: the board is empty", () => {
  const empty = { week: null, rows: [], empty: true };
  assert.deepEqual(nicheBoard(input({ traces: [] })), empty);
  assert.deepEqual(nicheBoard(input({ traces: [trace({ choice: null }), trace({ choice: undefined })] })), empty);
  assert.deepEqual(nicheBoard({}), empty);
  assert.deepEqual(nicheBoard(undefined), empty);
  assert.deepEqual(nicheBoard(input({ traces: null })), empty);
});

test("the newest trace with a choice is the one read (traces come newest first)", () => {
  const newer = trace({ run_id: "2030-02-11-1", date: "2030-02-11", choice: null });
  const older = trace({ run_id: "2030-01-28-1", date: "2030-01-28", choice: { ...trace().choice, territory: "us-consumer-finance" } });
  const board = nicheBoard(input({ traces: [newer, trace(), older] }));
  assert.equal(board.empty, false);
  assert.equal(board.week.row.id, "developer-tools");
});

// ---- rows -----------------------------------------------------------------------------------------

test("rows: every territory (mine) and every proposed niche, each name once; a territory wins a clash", () => {
  const clash = { ...NICHES[0], name: "accounting-automation", label: "Contabilidad propuesta" };
  const board = nicheBoard(input({ niches: [...NICHES, clash] }));
  const ids = board.rows.map((r) => r.id).sort();
  assert.deepEqual(ids, ["accounting-automation", "claims-of-health-insurance", "clinic-billing", "developer-tools", "documents-for-ai", "us-consumer-finance"]);
  const mine = rowOf(board, "accounting-automation");
  assert.equal(mine.origin, "mine");
  assert.equal(mine.name, "Automatizar la contabilidad");
  assert.equal(mine.why, null);
  assert.equal(mine.originText, T.nicheOriginMine);
  const proposed = rowOf(board, "claims-of-health-insurance");
  assert.equal(proposed.origin, "proposed");
  assert.equal(proposed.name, "Reclamos de seguros médicos");
  assert.equal(proposed.why, "Vacantes que piden conciliar reclamos a mano.");
  assert.equal(proposed.originText, fill(T.nicheOriginProposed, { date: formatDayMonth("2030-01-20T10:00:00Z") }));
  assert.equal(fill(T.nicheOriginProposed, { date: "20 de enero" }), "Propuesto por tomoshi el 20 de enero");
  assert.equal(T.nicheOriginMine, "Elegido a mano");
});

test("names: the trace's name, else the topic's plain name, else a fallback; a niche's label, else its fallback", () => {
  const board = nicheBoard(input({
    traces: [trace({
      territories: [
        { id: "developer-tools", name: null },
        { id: "some-new-territory", name: "" },
        { id: "us-consumer-finance", name: "Finanzas en casa" },
      ],
    })],
    niches: [{ ...NICHES[0], label: null }, { ...NICHES[1], label: "  " }],
  }));
  assert.equal(rowOf(board, "developer-tools").name, topicName("developer-tools"));
  assert.equal(rowOf(board, "some-new-territory").name, "Nicho sin nombre");
  assert.equal(rowOf(board, "us-consumer-finance").name, "Finanzas en casa");
  assert.equal(rowOf(board, "claims-of-health-insurance").name, "Nicho propuesto sin nombre");
  assert.equal(rowOf(board, "clinic-billing").name, "Nicho propuesto sin nombre");
  assert.equal(T.nicheUnnamed, "Nicho sin nombre");
  assert.equal(T.nicheProposedUnnamed, "Nicho propuesto sin nombre");
});

test("names: a name that is only the id humanized (as dolores' nicheName writes it) counts as no name", () => {
  const board = nicheBoard(input({
    traces: [trace({
      territories: [
        ...trace().territories,
        { id: "new-latam-territory", name: "New latam territory" },
        { id: "accounting-ai", name: "  Accounting ai " },
        { id: "-odd--slug-", name: "Odd slug" },
      ],
    })],
    niches: [{ ...NICHES[0], name: "late-payments", label: "Late payments" }, NICHES[1]],
  }));
  assert.equal(rowOf(board, "new-latam-territory").name, "Nicho sin nombre");
  assert.equal(rowOf(board, "accounting-ai").name, "Nicho sin nombre");
  assert.equal(rowOf(board, "-odd--slug-").name, "Nicho sin nombre");
  assert.equal(rowOf(board, "late-payments").name, "Nicho propuesto sin nombre");
  // A topic the page knows goes by its plain name; a real name that only looks alike stays.
  const topic = nicheBoard(input({ traces: [trace({ territories: [{ id: "developer-tools", name: "Developer tools" }, { id: "new-latam-territory", name: "New LatAm territory" }] })] }));
  assert.equal(rowOf(topic, "developer-tools").name, topicName("developer-tools"));
  assert.equal(rowOf(topic, "new-latam-territory").name, "New LatAm territory");
  // The niche that ran, named only by its trace's `niche` (no territories), humanized: no name either.
  const ran = trace({ territories: null, niche: { id: "new-latam-territory", name: "New latam territory" },
    choice: { ...trace().choice, territory: "new-latam-territory" } });
  assert.equal(nicheBoard(input({ traces: [ran] })).week.row.name, "Nicho sin nombre");
});

test("no string of the board contains any id, even with unnamed territories and unlabeled niches", () => {
  const board = nicheBoard(input({
    traces: [trace({ territories: [{ id: "some-new-territory", name: null }, { id: "developer-tools", name: "developer-tools" }] })],
    niches: [{ ...NICHES[0], label: null }, { ...NICHES[1], label: "clinic-billing" }],
    vetoes: [{ name: "some-new-territory", vetoed_by: "ana@example.com", vetoed_at: "2030-02-01T10:00:00Z" }],
  }));
  const ids = board.rows.map((r) => r.id);
  assert.ok(ids.includes("some-new-territory"));
  for (const [where, value] of strings(board)) {
    for (const id of ids) assert.ok(!value.includes(id), `${where}: ${value} contains ${id}`);
  }
});

test("a trace without territories still shows the ranking's niches and the one that ran", () => {
  const board = nicheBoard(input({ traces: [trace({ territories: null })] }));
  const current = rowOf(board, "developer-tools");
  assert.equal(current.origin, "mine");
  assert.equal(current.name, "Herramientas para programadores");
  assert.equal(board.week.row, current);
  assert.ok(rowOf(board, "us-consumer-finance"));
  assert.equal(rowOf(board, "claims-of-health-insurance").origin, "proposed");
});

// ---- states ---------------------------------------------------------------------------------------

test("state: current, competing, resting, retired, each with its lamp and words", () => {
  const board = nicheBoard(input());
  const current = rowOf(board, "developer-tools");
  assert.equal(current.state, "current");
  assert.equal(current.lamp, "green");
  assert.equal(current.stateText, "Corrió esta semana");
  assert.equal(current.stateNote, null);
  assert.equal(current.canVeto, true);
  assert.equal(current.vetoed, false);
  assert.equal(current.vetoNote, null);

  const competing = rowOf(board, "us-consumer-finance");
  assert.equal(competing.state, "competing");
  assert.equal(competing.lamp, "amber");
  assert.equal(competing.stateText, "Compite");
  assert.equal(competing.stateNote, null);

  const resting = rowOf(board, "documents-for-ai");
  assert.equal(resting.state, "resting");
  assert.equal(resting.lamp, "off");
  assert.equal(resting.stateText, "Descansa");
  assert.equal(resting.stateNote, fill(T.nicheRestingUntil, { date: formatDayMonth("2030-03-04") }));
  assert.equal(resting.stateNote, "Se estancó; vuelve a más tardar el 4 de marzo");
  assert.equal(resting.canVeto, true);

  const retired = rowOf(board, "clinic-billing");
  assert.equal(retired.state, "retired");
  assert.equal(retired.lamp, "off");
  assert.equal(retired.stateText, "Retirado");
  assert.equal(retired.stateNote, "Lo retiró tomoshi el 2 de febrero para dejar lugar a otros propuestos");
  assert.equal(retired.canVeto, false);
  assert.equal(retired.vetoed, false);
});

test("the niche that ran: «Corrió esta semana» only for this week's complete or incomplete run", () => {
  for (const status of ["complete", "incomplete"]) {
    const row = rowOf(nicheBoard(input({ traces: [trace({ status })] })), "developer-tools");
    assert.equal(row.state, "current", status);
    assert.equal(row.lamp, "green", status);
    assert.equal(row.stateText, "Corrió esta semana", status);
  }
});

test("the niche that ran in an older week (the summary speaks of another run, or of none): «Corrió el <día mes>», green", () => {
  const later = { ...SUMMARY, run_id: "2030-02-11-1", date: "2030-02-11", status: "failed" };
  for (const summary of [later, null, undefined, {}]) {
    for (const status of ["complete", "incomplete"]) {
      const board = nicheBoard(input({ summary, traces: [trace({ status })] }));
      const row = rowOf(board, "developer-tools");
      assert.equal(row.state, "current");
      assert.equal(row.lamp, "green");
      assert.equal(row.stateText, "Corrió el 4 de febrero", `${JSON.stringify(summary)} ${status}`);
      assert.equal(board.week.row, row);
    }
  }
  const undated = rowOf(nicheBoard(input({ summary: later, traces: [trace({ date: null })] })), "developer-tools");
  assert.equal(undated.stateText, "Ya corrió");
  assert.equal(fill(T.nicheRanOn, { date: "4 de febrero" }), "Corrió el 4 de febrero");
});

test("the niche chosen for a run that did not finish (failed, only gathered, unknown): «Se eligió el <día mes>; la corrida falló», red", () => {
  for (const summary of [SUMMARY, null]) {
    for (const status of ["failed", "ingest-only", undefined, "something-new"]) {
      const board = nicheBoard(input({ summary, traces: [trace({ status })] }));
      const row = rowOf(board, "developer-tools");
      assert.equal(row.state, "current", String(status));
      assert.equal(row.lamp, "red", String(status));
      assert.equal(row.stateText, "Se eligió el 4 de febrero; la corrida falló", String(status));
      assert.equal(row.paidRuns, 0);
    }
  }
  assert.equal(rowOf(nicheBoard(input({ traces: [trace({ status: "failed", date: undefined })] })), "developer-tools").stateText,
    "Se eligió; la corrida falló");
});

test("a resting niche from an old trace without resting_until says only that it stalled", () => {
  const ranking = trace().choice.ranking.map((e) => (e.name === "documents-for-ai" ? { ...e, resting_until: undefined } : e));
  const board = nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, ranking } })] }));
  assert.equal(rowOf(board, "documents-for-ai").stateNote, T.nicheRestingUndated);
});

test("a retired niche without a date says so without one", () => {
  const board = nicheBoard(input({ niches: [{ ...NICHES[1], state_changed_at: null }] }));
  assert.equal(rowOf(board, "clinic-billing").stateNote, T.nicheRetiredUndated);
});

test("vetoed: a territory in the vetoes, or a niche in state vetoed, red, with who and when by name", () => {
  const board = nicheBoard(input({
    vetoes: [{ name: "us-consumer-finance", vetoed_by: "Beto@Example.com", vetoed_at: "2030-01-30T15:00:00Z" }],
    niches: [{ ...NICHES[0], state: "vetoed", state_by: "carla@example.com", state_changed_at: "2030-02-03T12:00:00Z" }, NICHES[1]],
  }));
  const territory = rowOf(board, "us-consumer-finance");
  assert.equal(territory.state, "vetoed");
  assert.equal(territory.lamp, "red");
  assert.equal(territory.stateText, "Vetado");
  assert.equal(territory.vetoed, true);
  assert.equal(territory.canVeto, true);
  assert.equal(territory.vetoNote, "Lo vetó Beto el 30 de enero");
  const niche = rowOf(board, "claims-of-health-insurance");
  assert.equal(niche.state, "vetoed");
  assert.equal(niche.vetoNote, "Lo vetó Carla el 3 de febrero");
});

test("vetoed by someone not on the list shows their email; without a date, only who; without who, no note", () => {
  const board = nicheBoard(input({
    vetoes: [
      { name: "us-consumer-finance", vetoed_by: "otra@example.com", vetoed_at: null },
      { name: "accounting-automation", vetoed_by: null, vetoed_at: "2030-01-30T15:00:00Z" },
    ],
  }));
  assert.equal(rowOf(board, "us-consumer-finance").vetoNote, "Lo vetó otra@example.com");
  assert.equal(rowOf(board, "accounting-automation").vetoNote, null);
  assert.equal(rowOf(board, "accounting-automation").vetoed, true);
});

test("a stale ranking that still lists a niche vetoed since: vetoed wins, with no numbers", () => {
  const board = nicheBoard(input({ vetoes: [{ name: "us-consumer-finance", vetoed_by: "ana@example.com", vetoed_at: "2030-02-05T09:00:00Z" }] }));
  const row = rowOf(board, "us-consumer-finance");
  assert.equal(row.state, "vetoed");
  assert.equal(row.complaints, null);
  assert.equal(row.spending, null);
  assert.equal(row.noise, null);
});

test("review focus 1: the niche that ran and is vetoed since is vetoed, and the week says the vetoed wording", () => {
  const board = nicheBoard(input({ vetoes: [{ name: "developer-tools", vetoed_by: "ana@example.com", vetoed_at: "2030-02-05T09:00:00Z" }] }));
  const row = rowOf(board, "developer-tools");
  assert.equal(row.state, "vetoed");
  assert.equal(row.lamp, "red");
  assert.equal(row.stateText, "Vetado · corrió esta semana");
  assert.equal(row.vetoNote, "Lo vetó Ana el 5 de febrero");
  assert.equal(board.week.row, row);
  assert.equal(board.week.row.vetoed, true);
  assert.equal(board.week.vetoNext, "Vetado: el próximo lunes corre otro.");
  assert.equal(board.rows[0].id, "us-consumer-finance"); // no current row left: the competing ones lead
});

test("finish 1: the vetoed niche that ran keeps this week's numbers; any other vetoed niche shows none", () => {
  const vetoes = [
    { name: "developer-tools", vetoed_by: "ana@example.com", vetoed_at: "2030-02-05T09:00:00Z" },
    { name: "us-consumer-finance", vetoed_by: "beto@example.com", vetoed_at: "2030-02-05T09:00:00Z" },
  ];
  const board = nicheBoard(input({ vetoes }));
  const ran = rowOf(board, "developer-tools");
  assert.equal(ran.complaints, 107);
  assert.equal(ran.spending, 96);
  assert.equal(ran.noise, "28 %");
  const other = rowOf(board, "us-consumer-finance");
  assert.equal(other.complaints, null);
  assert.equal(other.spending, null);
  assert.equal(other.noise, null);
});

test("finish 1: the vetoed niche that ran says how its run went, by the same rule as when it is not vetoed", () => {
  const vetoes = [{ name: "developer-tools", vetoed_by: "ana@example.com", vetoed_at: "2030-02-05T09:00:00Z" }];
  const later = { ...SUMMARY, run_id: "2030-02-11-1" };
  const stateOf = (extra) => rowOf(nicheBoard(input({ vetoes, ...extra })), "developer-tools");
  assert.equal(stateOf({}).stateText, "Vetado · corrió esta semana");
  assert.equal(stateOf({ summary: later }).stateText, "Vetado · corrió el 4 de febrero");
  assert.equal(stateOf({ summary: later, traces: [trace({ date: null })] }).stateText, "Vetado · ya corrió");
  assert.equal(stateOf({ traces: [trace({ status: "failed" })] }).stateText, "Vetado · la corrida falló");
  for (const extra of [{}, { summary: later }, { traces: [trace({ status: "failed" })] }]) {
    const row = stateOf(extra);
    assert.equal(row.state, "vetoed");
    assert.equal(row.lamp, "red");
    assert.equal(row.vetoed, true);
  }
});

test("a veto on a name with no row is ignored", () => {
  const board = nicheBoard(input({ vetoes: [{ name: "gone-territory", vetoed_by: "ana@example.com", vetoed_at: null }] }));
  assert.equal(rowOf(board, "gone-territory"), undefined);
});

test("a proposed niche proposed within 31 days of the trace says «Nuevo este mes»; an older one does not", () => {
  const board = nicheBoard(input({
    niches: [
      NICHES[0],
      { ...NICHES[0], name: "late-payments", label: "Pagos atrasados", proposed_at: "2030-01-04T10:00:00Z" },
      { ...NICHES[0], name: "old-niche", label: "Nicho viejo", proposed_at: "2029-12-20T10:00:00Z" },
      { ...NICHES[0], name: "undated-niche", label: "Nicho sin fecha", proposed_at: null },
    ],
  }));
  assert.equal(rowOf(board, "claims-of-health-insurance").stateNote, "Nuevo este mes");
  assert.equal(rowOf(board, "late-payments").stateNote, "Nuevo este mes");
  assert.equal(rowOf(board, "old-niche").stateNote, null);
  assert.equal(rowOf(board, "undated-niche").stateNote, null);
  assert.equal(rowOf(board, "undated-niche").originText, T.nicheOriginProposedUndated);
});

// ---- order ----------------------------------------------------------------------------------------

test("order: current, competing in ranking order (then by name), resting, vetoed, retired", () => {
  const board = nicheBoard(input({
    traces: [trace({ territories: [...trace().territories, { id: "zeta-territory", name: "Zeta" }, { id: "alfa-territory", name: "Alfa" }] })],
    vetoes: [{ name: "accounting-automation", vetoed_by: "ana@example.com", vetoed_at: null }],
  }));
  assert.deepEqual(board.rows.map((r) => r.id), [
    "developer-tools",
    "us-consumer-finance", "claims-of-health-insurance", "alfa-territory", "zeta-territory",
    "documents-for-ai",
    "accounting-automation",
    "clinic-billing",
  ]);
});

// ---- numbers --------------------------------------------------------------------------------------

test("numbers: from the ranking entry; noise rounded as a percent, «sin medir» for counts or no share", () => {
  const board = nicheBoard(input());
  const current = rowOf(board, "developer-tools");
  assert.equal(current.complaints, 107);
  assert.equal(current.spending, 96);
  assert.equal(current.noise, "28 %");
  assert.equal(rowOf(board, "claims-of-health-insurance").noise, "44 %");
  assert.equal(rowOf(board, "accounting-automation").noise, "sin medir");
  assert.equal(rowOf(board, "documents-for-ai").noise, "sin medir");
  assert.equal(rowOf(board, "documents-for-ai").complaints, 0);
  const retired = rowOf(board, "clinic-billing");
  assert.equal(retired.complaints, null);
  assert.equal(retired.spending, null);
  assert.equal(retired.noise, null);
});

test("numbers: an old trace without a probe reads «sin medir»; a niche out of the ranking has no numbers", () => {
  const board = nicheBoard(input({ traces: [trace({ probe: null, territories: [...trace().territories, { id: "alfa-territory", name: "Alfa" }] })] }));
  assert.equal(rowOf(board, "developer-tools").noise, "sin medir");
  const out = rowOf(board, "alfa-territory");
  assert.equal(out.complaints, null);
  assert.equal(out.spending, null);
  assert.equal(out.noise, null);
});

test("paidRuns: the traces of the niche that ran complete or incomplete", () => {
  const t = (runId, id, status) => ({ run_id: runId, date: runId.slice(0, 10), status, niche: { id, name: "x" }, choice: null });
  const board = nicheBoard(input({
    traces: [
      trace(),
      t("2030-01-28-1", "developer-tools", "incomplete"),
      t("2030-01-21-1", "developer-tools", "failed"),
      t("2030-01-14-1", "developer-tools", "ingest-only"),
      t("2030-01-07-1", "documents-for-ai", "complete"),
      { run_id: "2030-01-01-1", status: "complete", niche: null },
    ],
  }));
  assert.equal(rowOf(board, "developer-tools").paidRuns, 2);
  assert.equal(rowOf(board, "documents-for-ai").paidRuns, 1);
  assert.equal(rowOf(board, "us-consumer-finance").paidRuns, 0);
});

test("pains: each pain of the niche counted as weighty, watching or interested by its section", () => {
  const pains = [
    { id: "p1", territory: "developer-tools", status: "alive" },
    { id: "p2", territory: "developer-tools", status: "watching" },
    { id: "p3", territory: "developer-tools", status: "incomplete-verification" },
    { id: "p4", territory: "developer-tools", status: "watching" }, // discarded by a mark
    { id: "p5", territory: "developer-tools", status: "dead" },
    { id: "p6", territory: "us-consumer-finance", status: "alive" },
    { id: "p7", territory: "developer-tools", status: "dead" }, // kept by an «interested» mark
    { id: "p8", territory: "accounting-automation", status: "watching" }, // kept by an «interested» mark
  ];
  const marks = [
    { pain_id: "p4", author: "ana@example.com", mark: "discarded" },
    { pain_id: "p7", author: "beto@example.com", mark: "interested" },
    { pain_id: "p8", author: "carla@example.com", mark: "interested" },
  ];
  const board = nicheBoard(input({ pains, marks }));
  assert.deepEqual(rowOf(board, "developer-tools").pains, { weighty: 1, watching: 2, interested: 1 });
  assert.deepEqual(rowOf(board, "us-consumer-finance").pains, { weighty: 1, watching: 0, interested: 0 });
  assert.deepEqual(rowOf(board, "accounting-automation").pains, { weighty: 0, watching: 0, interested: 1 });
  assert.deepEqual(rowOf(board, "documents-for-ai").pains, { weighty: 0, watching: 0, interested: 0 });
});

// ---- the week -------------------------------------------------------------------------------------

test("week: the current row, its date, why, the advanced pains and what a veto does", () => {
  const board = nicheBoard(input());
  assert.equal(board.empty, false);
  assert.equal(board.week.row, rowOf(board, "developer-tools"));
  assert.equal(board.week.date, formatDayMonth("2030-02-04"));
  assert.equal(board.week.why, "Este era el que traía más quejas y más dinero a la vez.");
  assert.equal(board.week.advanced, "2 se acercaron a tener peso en sus últimas semanas");
  assert.equal(board.week.vetoNext, "Si lo vetan, el próximo lunes corre otro.");
});

test("week: no why saved, no advanced pains, one advanced pain", () => {
  const noWhy = nicheBoard(input({ traces: [trace({ why: undefined })] }));
  assert.equal(noWhy.week.why, "Esta corrida no guardó por qué se eligió");
  const ranking = (n) => trace().choice.ranking.map((e) => (e.name === "developer-tools" ? { ...e, advanced_pains: n } : e));
  assert.equal(nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, ranking: ranking(null) } })] })).week.advanced, null);
  assert.equal(nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, ranking: ranking(undefined) } })] })).week.advanced, null);
  assert.equal(nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, ranking: ranking(1) } })] })).week.advanced, "1 se acercó a tener peso en sus últimas semanas");
});

test("week analysis: complaints and spending with rank, rivals' positions and flag; noise without flag", () => {
  const { week } = nicheBoard(input());
  assert.deepEqual(week.analysis.map((r) => r.label), ["Quejas reales", "Gasto real", "Ruido"]);
  const [complaints, spending, noise] = week.analysis;
  assert.equal(complaints.value, "107");
  assert.equal(complaints.rank, "el más alto");
  // Only the rivals measured the same way (judge): documents-for-ai was counted, so it is out of the comparison.
  assert.deepEqual(complaints.positions, [38, 27, 27]); // 41, 29, 29 over 107
  assert.equal(complaints.at, 100);
  assert.equal(complaints.flag, "in");
  assert.equal(complaints.flagText, "Con señal");
  assert.equal(spending.value, "96");
  assert.equal(spending.rank, "3.º de 4"); // 447, 109 above
  assert.deepEqual(spending.positions, [24, 12, 100]); // 109, 52, 447 over 447
  assert.equal(spending.at, 21);
  assert.equal(spending.flag, "in");
  assert.equal(noise.label, "Ruido");
  assert.equal(noise.value, "28 %");
  assert.equal(noise.flag, null);
  assert.equal(noise.flagText, "");
  assert.deepEqual(noise.positions, []);
  assert.equal(week.note, "Gana el nicho con más en su lado más débil; aquí, 96 de gasto.");
});

test("week analysis: a side at zero has no signal; a tie with the highest is the highest; the note names complaints", () => {
  const ranking = [entry("developer-tools", 0, 30), entry("us-consumer-finance", 12, 30)];
  const { week } = nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, ranking } })] }));
  const [complaints, spending] = week.analysis;
  assert.equal(complaints.flag, "out");
  assert.equal(complaints.flagText, "Sin señal");
  assert.equal(complaints.rank, "2.º de 2");
  assert.equal(spending.rank, "el más alto");
  assert.equal(week.note, "Gana el nicho con más en su lado más débil; aquí, 0 de quejas.");
});

test("a mixed week: a judged niche is set only against the judged ones; a counted rival's bigger numbers are not its rivals", () => {
  const ranking = [
    entry("developer-tools", 60, 50),
    entry("us-consumer-finance", 40, 30),
    entry("documents-for-ai", 300, 400, { source: "counts" }),
  ];
  const { week } = nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, ranking } })] }));
  const [complaints, spending] = week.analysis;
  assert.equal(complaints.rank, "el más alto");
  assert.equal(spending.rank, "el más alto");
  assert.deepEqual(complaints.positions, [67]); // 40 over 60: no tick for the counted 300
  assert.deepEqual(spending.positions, [60]); // 30 over 50: no tick for the counted 400
  assert.equal(complaints.at, 100);
  assert.equal(versusLabel(Math.max(...week.analysis.map((a) => a.positions.length))), "Frente al otro");

  // Alone among the judged: the highest, no rival tick, «Frente a los otros» with no count.
  const alone = nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, ranking: [ranking[0], ranking[2]] } })] })).week;
  assert.equal(alone.analysis[0].rank, "el más alto");
  assert.deepEqual(alone.analysis[0].positions, []);
  assert.deepEqual(alone.analysis[1].positions, []);
  // A counted niche that ran is set only against the counted ones.
  const counted = [entry("developer-tools", 5, 4, { source: "counts" }), entry("us-consumer-finance", 400, 300), entry("documents-for-ai", 10, 2, { source: "counts" })];
  const c = nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, ranking: counted } })] })).week;
  assert.equal(c.analysis[0].rank, "2.º de 2");
  assert.deepEqual(c.analysis[0].positions, [100]);
  assert.equal(c.analysis[1].rank, "el más alto");
  assert.deepEqual(c.analysis[1].positions, [50]);
});

test("review focus 4: a counts week reads «sin medir» and says the noise was not measured", () => {
  const ranking = trace().choice.ranking.map((e) => ({ ...e, source: "counts" }));
  const probe = trace().probe.map((p) => ({ ...p, noise_share: null, source: "counts" }));
  const board = nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, ranking }, probe })] }));
  assert.equal(board.week.note, "Esta semana se contó sin revisar: el ruido no se midió.");
  assert.equal(board.week.analysis[2].value, "sin medir");
  assert.equal(rowOf(board, "developer-tools").noise, "sin medir");
});

test("week analysis: the niche that ran missing from the ranking leaves its values empty and without signal", () => {
  const ranking = trace().choice.ranking.filter((e) => e.name !== "developer-tools");
  const { week } = nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, ranking } })] }));
  assert.equal(week.row.id, "developer-tools");
  const [complaints, , noise] = week.analysis;
  assert.equal(complaints.value, null);
  assert.equal(complaints.rank, null);
  assert.equal(complaints.flag, "out");
  assert.equal(complaints.positions.length, 4);
  assert.equal(noise.value, "28 %");
  assert.equal(week.note, null);
  assert.equal(week.advanced, null);
});

// ---- the strings P3 uses ----------------------------------------------------------------------------

test("the tab's own strings, word for word", () => {
  assert.equal(T.tabNiches, "Nichos");
  assert.equal(T.nichesTitle, "Nichos");
  assert.equal(T.nichesLead, "Cada lunes tomoshi mide todos los nichos sin gastar y paga la corrida del que trae a la vez quejas y dinero. Si uno no les interesa, vétenlo: deja de competir desde el lunes siguiente.");
  assert.equal(T.nichesEmpty, "Todavía no hay sondeo de nichos. El primero llega con la próxima corrida del lunes.");
  assert.equal(fill(T.nicheVetoDone, { name: "Pagos atrasados" }), "Vetaste «Pagos atrasados». Deja de competir desde el próximo lunes.");
  assert.equal(fill(T.nicheVetoUndone, { name: "Pagos atrasados" }), "Quitaste el veto a «Pagos atrasados». Vuelve a competir desde el próximo lunes.");
});

test("each row and the week carry exactly the fields the tab draws; the input is left as it was", () => {
  const given = input({ pains: [{ id: "p1", territory: "developer-tools", status: "alive" }] });
  const before = structuredClone(given);
  const board = nicheBoard(given);
  assert.deepEqual(given, before);
  assert.deepEqual(Object.keys(board.rows[0]).sort(), [
    "canVeto", "complaints", "id", "lamp", "name", "noise", "origin", "originText", "paidRuns", "pains", "spending",
    "state", "stateNote", "stateText", "vetoNote", "vetoed", "why",
  ]);
  assert.deepEqual(Object.keys(board.week).sort(), ["advanced", "analysis", "date", "note", "row", "vetoNext", "why"]);
  for (const r of board.week.analysis) assert.deepEqual(Object.keys(r).sort(), ["at", "flag", "flagText", "label", "positions", "rank", "value"]);
  assert.equal(nicheBoard(given).rows.length, board.rows.length);
});

const REASONS_RANKED = ["first", "switched-stalled", "switched-unavailable"];
const REASONS_OTHER = ["kept-advancing", "kept-guaranteed", "kept-no-signal", "requested", "fallback-no-signal", undefined, null, "something-new"];

test("the judge note only for a week the ranking decided; any other reason has none", () => {
  const judged = "Gana el nicho con más en su lado más débil; aquí, 96 de gasto.";
  for (const reason of REASONS_RANKED) {
    assert.equal(nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, reason } })] })).week.note, judged, reason);
  }
  for (const reason of REASONS_OTHER) {
    assert.equal(nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, reason } })] })).week.note, null, String(reason));
  }
});

test("the counts note for every counted week, whatever the reason", () => {
  const ranking = trace().choice.ranking.map((e) => ({ ...e, source: "counts" }));
  for (const reason of [...REASONS_RANKED, ...REASONS_OTHER]) {
    const board = nicheBoard(input({ traces: [trace({ choice: { ...trace().choice, ranking, reason } })] }));
    assert.equal(board.week.note, "Esta semana se contó sin revisar: el ruido no se midió.", String(reason));
  }
});

// ---- the veto, mirrored locally after the base took it (P3) -------------------------------------------

const AT = "2030-02-05T12:00:00.000Z";

test("withVeto on a territory adds its vetoes row, with who and when, and the board shows it vetoed", () => {
  const data = input();
  const next = withVeto(data, { name: "us-consumer-finance", vetoed: true, by: "carla@example.com", at: AT });
  assert.deepEqual(next.vetoes, [{ name: "us-consumer-finance", vetoed_by: "carla@example.com", vetoed_at: AT }]);
  assert.deepEqual(data.vetoes, [], "the input is left as it was");
  const row = rowOf(nicheBoard(next), "us-consumer-finance");
  assert.equal(row.state, "vetoed");
  assert.equal(row.vetoed, true);
  assert.equal(row.vetoNote, fill(T.nicheVetoedBy, { name: "Carla", date: formatDayMonth(AT) }));
});

test("withVeto lifting a territory's veto removes its row, and it competes again", () => {
  const data = input({ vetoes: [{ name: "us-consumer-finance", vetoed_by: "beto@example.com", vetoed_at: AT }, { name: "accounting-automation", vetoed_by: "ana@example.com", vetoed_at: AT }] });
  const next = withVeto(data, { name: "us-consumer-finance", vetoed: false, by: "carla@example.com", at: AT });
  assert.deepEqual(next.vetoes.map((v) => v.name), ["accounting-automation"]);
  assert.equal(data.vetoes.length, 2, "the input is left as it was");
  assert.equal(rowOf(nicheBoard(next), "us-consumer-finance").state, "competing");
});

test("withVeto on an already vetoed territory keeps the first veto, as the base does", () => {
  const first = { name: "us-consumer-finance", vetoed_by: "beto@example.com", vetoed_at: "2030-02-01T00:00:00Z" };
  const next = withVeto(input({ vetoes: [first] }), { name: "us-consumer-finance", vetoed: true, by: "carla@example.com", at: AT });
  assert.deepEqual(next.vetoes, [first]);
});

test("withVeto on a proposed niche sets its own state, by and when; lifting it makes it active again", () => {
  const data = input();
  const vetoed = withVeto(data, { name: "claims-of-health-insurance", vetoed: true, by: "ana@example.com", at: AT });
  assert.deepEqual(vetoed.vetoes, [], "a proposed niche never goes to the territories' vetoes");
  const niche = vetoed.niches.find((n) => n.name === "claims-of-health-insurance");
  assert.equal(niche.state, "vetoed");
  assert.equal(niche.state_by, "ana@example.com");
  assert.equal(niche.state_changed_at, AT);
  assert.equal(data.niches[0].state, "active", "the input is left as it was");
  assert.equal(rowOf(nicheBoard(vetoed), "claims-of-health-insurance").state, "vetoed");
  const lifted = withVeto(vetoed, { name: "claims-of-health-insurance", vetoed: false, by: "beto@example.com", at: AT });
  assert.equal(lifted.niches.find((n) => n.name === "claims-of-health-insurance").state, "active");
  assert.equal(rowOf(nicheBoard(lifted), "claims-of-health-insurance").state, "competing");
});

test("withVeto lifting a veto never touches a niche that is not vetoed (a retired one stays retired)", () => {
  const next = withVeto(input(), { name: "clinic-billing", vetoed: false, by: "ana@example.com", at: AT });
  assert.deepEqual(next.niches.find((n) => n.name === "clinic-billing"), NICHES[1]);
});

test("withVeto on the niche that ran turns the week vetoed", () => {
  const board = nicheBoard(withVeto(input(), { name: "developer-tools", vetoed: true, by: "ana@example.com", at: AT }));
  assert.equal(board.week.row.vetoed, true);
  assert.equal(board.week.vetoNext, T.nicheVetoNextVetoed);
});

test("withVeto keeps every other list as it was, and reads missing lists as empty", () => {
  const data = input();
  const next = withVeto(data, { name: "us-consumer-finance", vetoed: true, by: "ana@example.com", at: AT });
  for (const key of ["traces", "pains", "marks", "people"]) assert.equal(next[key], data[key], key);
  assert.deepEqual(withVeto({}, { name: "x-y", vetoed: true, by: "ana@example.com", at: AT }).vetoes,
    [{ name: "x-y", vetoed_by: "ana@example.com", vetoed_at: AT }]);
});

test("the tab's counts in words: paid runs, pains and the rivals' column", () => {
  assert.equal(paidRunsText(0), "sin corridas aún");
  assert.equal(paidRunsText(1), "1 corrida pagada");
  assert.equal(paidRunsText(2), "2 corridas pagadas");
  assert.equal(paidRunsText(0, { long: true }), "Sin corridas pagadas en este nicho");
  assert.equal(paidRunsText(1, { long: true }), "1 corrida pagada en este nicho");
  assert.equal(paidRunsText(1200, { long: true }), "1200 corridas pagadas en este nicho".replace("1200", new Intl.NumberFormat("es").format(1200)));
  assert.deepEqual(painsText({ weighty: 3, watching: 12 }), {
    short: ["3 con peso · 12 en obs."], full: "3 con peso para trabajar · 12 en observación",
    week: ["3 con peso para trabajar · 12 en observación"], none: null,
  });
  assert.equal(painsText({ weighty: 0, watching: 0 }).none, "Sin dolores aún");
  assert.equal(painsText({ weighty: 0, watching: 0, interested: 0 }).none, "Sin dolores aún");
  assert.equal(painsText({ weighty: 0, watching: 0 }, { retired: true }).none, "Sin dolores");
  assert.equal(painsText(null).none, "Sin dolores aún");
  // «Nos interesa» is a third figure, only when there is one.
  assert.deepEqual(painsText({ weighty: 3, watching: 12, interested: 2 }), {
    short: ["3 con peso · 12 en obs.", "2 marcados «Nos interesa»"],
    full: "3 con peso para trabajar · 12 en observación · 2 marcados «Nos interesa»",
    week: ["3 con peso para trabajar · 12 en observación", "2 marcados «Nos interesa»"], none: null,
  });
  assert.deepEqual(painsText({ weighty: 0, watching: 0, interested: 1 }), {
    short: ["0 con peso · 0 en obs.", "1 marcado «Nos interesa»"],
    full: "0 con peso para trabajar · 0 en observación · 1 marcado «Nos interesa»",
    week: ["0 con peso para trabajar · 0 en observación", "1 marcado «Nos interesa»"], none: null,
  });
  assert.equal(versusLabel(4), "Frente a los otros 4");
  assert.equal(versusLabel(1), "Frente al otro");
  assert.equal(versusLabel(0), "Frente a los otros");
});
