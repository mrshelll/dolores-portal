import { test } from "node:test";
import assert from "node:assert/strict";
import { T, fill, formatDate } from "../../js/text.js";
import { runDuration } from "../../js/model.js";
import { runState, runRows, runRow, runCostLines, runAgents, runCutLines, runDuelLines, runTechnical, runTitle, duelIds, runKeys } from "../../js/runs.js";

// Corridas: every traced run, week by week (dolores/scripts/lib/trace.mjs, buildTrace). Every text here is invented.
const STAGES = ["collected", "read", "with_signals", "analyzed", "quotes_checked", "grouped", "candidates", "attacked", "survivors", "duel"];
const funnel = (counts, caps = {}) => STAGES.map((stage, i) => ({ stage, label: `Etapa ${i + 1}`, count: counts[i] ?? null, cap: caps[stage] ?? null }));

function trace(runId, date, extra = {}) {
  return {
    version: 1, run_id: runId, date, niche: { id: "nicho-x", name: "Cuotas de clubes" }, status: "complete",
    started_at: `${date}T09:00:00Z`, finished_at: `${date}T09:26:00Z`,
    cost: { total_usd: 3.66, by_model: [{ model: "Sonnet", usd: 1.64 }, { model: "Opus", usd: 0.93 }, { model: "Haiku", usd: 0.71 }], cards_usd: 0.38 },
    agents: { used: 158, cap: 180 },
    sources: [{ name: "Foro A", kind: "Foro", collected: 10, kept: 8, available: null, truncated: false, note: "RAW-NOTE-A", ok: true }],
    ingest: null,
    funnel: funnel([617, 392, 297, 44, 41, 15, 12, 12, 2, 1], { analyzed: 50 }),
    cuts: [], duels: [], ranking: [], duel_kind: null, new_pains: 6, cards: null,
    ...extra,
  };
}

test("runDuration: only when both times exist and make sense", () => {
  const t = trace("2030-02-04-1", "2030-02-04");
  assert.equal(runDuration(t), fill(T.durationMinutes, { minutes: 26 }));
  assert.equal(runDuration({ ...t, finished_at: null }), null);
  assert.equal(runDuration({ ...t, started_at: null }), null);
  assert.equal(runDuration({ ...t, started_at: undefined, finished_at: undefined }), null);
  assert.equal(runDuration({ ...t, finished_at: "2030-02-04T08:00:00Z" }), null); // ends before it starts
  assert.equal(runDuration({ ...t, finished_at: "2030-02-04T10:05:00Z" }), fill(T.durationHours, { hours: 1, minutes: 5 }));
  assert.equal(runDuration({ ...t, finished_at: "2030-02-04T09:00:20Z" }), T.durationShort);
  assert.equal(runDuration({ ...t, started_at: "nope" }), null);
  assert.equal(runDuration(null), null);
});

test("runState: a lamp and the state in words for every status; an unknown one is off and says so", () => {
  assert.deepEqual(runState("complete"), { lamp: "green", text: T.runStateComplete });
  assert.deepEqual(runState("incomplete"), { lamp: "amber", text: T.runStateIncomplete });
  assert.deepEqual(runState("ingest-only"), { lamp: "amber", text: T.runStateIngestOnly });
  assert.deepEqual(runState("failed"), { lamp: "red", text: T.runStateFailed });
  for (const status of [null, undefined, "", "constructor", "weird"]) assert.deepEqual(runState(status), { lamp: "off", text: T.runStateUnknown });
});

test("runTitle: «Corrida del <fecha>», or without a date", () => {
  assert.equal(runTitle(trace("2030-02-04-1", "2030-02-04")), fill(T.runTitleDated, { date: formatDate("2030-02-04") }));
  assert.equal(runTitle(trace("2030-02-04-1", null)), T.runTitleUndated);
  assert.equal(runTitle(trace("2030-02-04-1", "not a date")), T.runTitleUndated);
});

test("runRow: date, niche, state, duration, cost, new pains and the mini line's counts", () => {
  const row = runRow(trace("2030-02-04-1", "2030-02-04"));
  assert.equal(row.id, "2030-02-04-1");
  assert.equal(row.href, "#/corridas/2030-02-04-1");
  assert.equal(row.title, fill(T.runTitleDated, { date: formatDate("2030-02-04") }));
  assert.equal(row.lamp, "green");
  assert.equal(row.state, T.runStateComplete);
  assert.deepEqual(row.facts, [
    "Cuotas de clubes", fill(T.durationMinutes, { minutes: 26 }), fill(T.costUsd, { amount: "3,66" }), fill(T.newPainsMany, { count: "6" }),
  ]);
  assert.equal(row.stages.length, 10);
  assert.deepEqual(row.stages[0], { label: "Etapa 1", count: "617", lamp: "green" });
  assert.equal(row.stages[3].lamp, "green"); // 44 of 50: not at the cap
  assert.equal(row.hasCounts, true);
  assert.equal(row.cutStages, T.lineStripClean);
});

test("runRow: what the trace does not say is left out, never invented", () => {
  const old = trace("2030-01-28-1", "2030-01-28", {
    niche: { id: null, name: null }, status: "failed", finished_at: null, cost: { total_usd: null, by_model: null, cards_usd: null },
    sources: null, funnel: funnel([]), new_pains: null,
  });
  const row = runRow(old);
  assert.deepEqual(row.facts, []);
  assert.equal(row.lamp, "red");
  assert.equal(row.state, T.runStateFailed);
  assert.equal(row.hasCounts, false);
  assert.ok(row.stages.every((s) => s.count === null && s.lamp === "off"));
  // A niche with no name goes by its topic's plain name when the page knows it, never by its id.
  assert.equal(runRow(trace("x", "2030-01-28", { niche: { id: "documents-for-ai", name: null } })).facts[0], "Preparar documentos para la IA");
  assert.ok(!runRow(trace("x", "2030-01-28", { niche: { id: "nicho-raro", name: " " } })).facts.includes("nicho-raro"));
  // A name that is only the id humanized (dolores' nicheName) is no name: the topic's, or nothing at all.
  assert.ok(!runRow(trace("x", "2030-01-28", { niche: { id: "new-latam-territory", name: "New latam territory" } })).facts.includes("New latam territory"));
  assert.equal(runRow(trace("x", "2030-01-28", { niche: { id: "documents-for-ai", name: "Documents for ai" } })).facts[0], "Preparar documentos para la IA");
  assert.equal(runRow(trace("x", "2030-01-28", { new_pains: 0 })).facts.at(-1), T.newPainsNone);
  assert.equal(runRow(trace("x", "2030-01-28", { new_pains: 1 })).facts.at(-1), T.newPainsOne);
  assert.equal(runRow(null), null);
  assert.equal(runRow({ run_id: "" }), null);
});

test("runRow: the mini line says how many stages had a cut", () => {
  const cut = trace("x", "2030-02-04", { cuts: [{ kind: "extraction-cap", count: 253, cap: 50, text: "253 quedaron sin analizar", original: null }] });
  assert.equal(runRow(cut).stages[3].lamp, "amber");
  assert.equal(runRow(cut).cutStages, T.lineStripCutsOne);
});

test("runRows: newest first, each run once, anything that is not a trace left out", () => {
  const a = trace("2030-02-04-1", "2030-02-04");
  const b = trace("2030-01-28-2", "2030-01-28");
  const c = trace("2030-01-28-10", "2030-01-28");
  const undated = trace("2030-01-01-1", null);
  const rows = runRows([b, undated, null, "x", a, c, { ...a }]);
  assert.deepEqual(rows.map((r) => r.id), ["2030-02-04-1", "2030-01-28-10", "2030-01-28-2", "2030-01-01-1"]);
  assert.deepEqual(runRows(null), []);
  assert.deepEqual(runRows([]), []);
});

test("runCostLines: each model, the cards, then the total; nothing that is not a number", () => {
  assert.deepEqual(runCostLines(trace("x", "2030-02-04")), [
    { label: "Sonnet", value: fill(T.costUsd, { amount: "1,64" }), total: false },
    { label: "Opus", value: fill(T.costUsd, { amount: "0,93" }), total: false },
    { label: "Haiku", value: fill(T.costUsd, { amount: "0,71" }), total: false },
    { label: T.costCards, value: fill(T.costUsd, { amount: "0,38" }), total: false },
    { label: T.costTotal, value: fill(T.costUsd, { amount: "3,66" }), total: true },
  ]);
  assert.deepEqual(runCostLines(trace("x", "2030-02-04", { cost: null })), []);
  assert.deepEqual(runCostLines(trace("x", "2030-02-04", { cost: { total_usd: 1.5, by_model: null, cards_usd: null } })),
    [{ label: T.costTotal, value: fill(T.costUsd, { amount: "1,50" }), total: true }]);
});

test("runAgents: used of the cap, used alone, or nothing", () => {
  assert.equal(runAgents(trace("x", "2030-02-04")), fill(T.agentsOfCap, { used: "158", cap: "180" }));
  assert.equal(runAgents(trace("x", "2030-02-04", { agents: { used: 40, cap: null } })), fill(T.agentsUsed, { used: "40" }));
  assert.equal(runAgents(trace("x", "2030-02-04", { agents: { used: null, cap: 180 } })), null);
  assert.equal(runAgents(trace("x", "2030-02-04", { agents: null })), null);
});

// Review Focus 3: a cut nobody mapped is said as «Hubo un recorte más», counted, never hidden, never its raw sentence.
test("runCutLines: every cut in plain words; the ones without words counted in one line, last", () => {
  const cuts = [
    { kind: "other", count: null, cap: null, text: "Hubo un recorte más", original: "RAW-ONE" },
    { kind: "extraction-cap", count: 253, cap: 50, text: "253 testimonios quedaron sin analizar", original: null },
    { kind: "other", count: null, cap: null, text: "Hubo un recorte más", original: "RAW-TWO" },
    { kind: "catalog-unread", count: null, cap: null, text: "No se pudo leer el catálogo", original: null },
    { kind: "gate-partial", count: 2, cap: null, text: "", original: null }, // no words: counted with the others
    null,
  ];
  const lines = runCutLines(trace("x", "2030-02-04", { cuts }));
  // Their sentences are in «Detalle técnico», so the line says where to find them (finish review 6: said once).
  // The two with a sentence point there; the one with none (gate-partial without text) is only counted.
  assert.deepEqual(lines, ["253 testimonios quedaron sin analizar", "No se pudo leer el catálogo", fill(T.runCutsOtherMany, { count: "2" }), T.cutOther]);
  assert.equal(T.runCutsOtherMany, "Hubo {count} recortes más; los verás en el detalle técnico");
  assert.ok(!lines.some((l) => /RAW-/.test(l)));
  assert.deepEqual(runCutLines(trace("x", "2030-02-04", { cuts: [cuts[0]] })), [T.runCutsOtherOne]);
  // Without a sentence to show there, the line does not send anyone to «Detalle técnico».
  assert.deepEqual(runCutLines(trace("x", "2030-02-04", { cuts: [cuts[4]] })), [T.cutOther]);
  assert.deepEqual(runCutLines(trace("x", "2030-02-04", { cuts: [cuts[4], { ...cuts[4] }] })), [fill(T.cutsOtherMany, { count: "2" })]);
  // Mixed: the pointer counts only the cuts «Detalle técnico» shows (with their sentence); the rest are counted apart,
  // in the plain sentence, without promising any detail.
  const mixed = runCutLines(trace("x", "2030-02-04", { cuts: [cuts[0], cuts[4], cuts[2], { kind: "other", text: null, original: "  " }] }));
  assert.deepEqual(mixed, [fill(T.runCutsOtherMany, { count: "2" }), fill(T.cutsOtherMany, { count: "2" })]);
  assert.deepEqual(runCutLines(trace("x", "2030-02-04", { cuts: [cuts[0], cuts[4]] })), [T.runCutsOtherOne, T.cutOther]);
  assert.deepEqual(runCutLines(trace("x", "2030-02-04", { cuts: [] })), []);
  assert.deepEqual(runCutLines(trace("x", "2030-02-04", { cuts: null })), []);
});

test("runDuelLines: «A contra B · ganó W» by the cards' titles, never an id, never the raw reason", () => {
  const titles = new Map([["dol-1", "Cobrar cuotas a tiempo"], ["dol-2", "Firmar autorizaciones"]]);
  const duels = [
    { a: "dol-1", b: "dol-2", winner: "dol-2", reason: "RAW-REASON" },
    { a: "dol-1", b: "dol-9", winner: "dol-1", reason: null },
    { a: "dol-8", b: "dol-1", winner: "dol-8", reason: null },
    { a: "dol-8", b: "dol-9", winner: "dol-9", reason: null },
    { a: "dol-1", b: "dol-2", winner: null, reason: null },
    { a: null, b: null, winner: null },
    "x",
  ];
  const lines = runDuelLines(trace("x", "2030-02-04", { duels }), titles);
  assert.deepEqual(lines, [
    fill(T.duelLine, { a: "«Cobrar cuotas a tiempo»", b: "«Firmar autorizaciones»", winner: fill(T.duelWinner, { name: "«Firmar autorizaciones»" }) }),
    fill(T.duelLine, { a: "«Cobrar cuotas a tiempo»", b: T.duelOtherPain, winner: fill(T.duelWinner, { name: "«Cobrar cuotas a tiempo»" }) }),
    fill(T.duelLine, { a: T.duelOnePain, b: "«Cobrar cuotas a tiempo»", winner: T.duelWinnerFirst }),
    fill(T.duelLine, { a: T.duelOnePain, b: T.duelOtherPain, winner: T.duelWinnerSecond }),
    fill(T.duelLine, { a: "«Cobrar cuotas a tiempo»", b: "«Firmar autorizaciones»", winner: T.duelNoWinner }),
  ].map((line) => line[0].toUpperCase() + line.slice(1)));
  assert.ok(!lines.some((l) => /dol-|RAW-/.test(l)));
  // titles as a plain object work too; no titles at all fall back
  assert.equal(runDuelLines(trace("x", "2030-02-04", { duels: [duels[0]] }), { "dol-1": "Uno" }).length, 1);
  assert.ok(runDuelLines(trace("x", "2030-02-04", { duels: [duels[0]] }), null)[0].startsWith("Un dolor del catálogo contra"));
  assert.deepEqual(runDuelLines(trace("x", "2030-02-04", { duels: null }), titles), []);
});

test("runTechnical: the raw texts, only here: other cuts' originals, sources' notes, duels' reasons", () => {
  const titles = new Map([["dol-1", "Cobrar cuotas a tiempo"]]);
  const t = trace("x", "2030-02-04", {
    cuts: [
      { kind: "other", count: null, cap: null, text: "Hubo un recorte más", original: "batch 3: something odd happened" },
      { kind: "extraction-cap", count: 3, cap: 60, text: "3 quedaron", original: null },
      { kind: "other", count: null, cap: null, text: "Hubo un recorte más", original: null },
    ],
    sources: [
      { name: "Foro A", kind: "Foro", collected: 10, kept: 8, note: "only 10 of 2000 fetched", ok: true },
      { name: null, kind: "Foro", collected: 1, kept: 1, note: null, ok: true },
      { name: "", kind: "Avisos", collected: 1, kept: 1, note: "rate limited", ok: false },
    ],
    duels: [{ a: "dol-1", b: "dol-9", winner: "dol-1", reason: "A has more buyers" }, { a: "dol-1", b: "dol-9", winner: "dol-1", reason: "  " }],
  });
  const detail = runTechnical(t, titles);
  assert.deepEqual(detail.cuts, ["batch 3: something odd happened"]);
  assert.deepEqual(detail.notes, [{ label: "Foro A", text: "only 10 of 2000 fetched" }, { label: "Avisos", text: "rate limited" }]);
  assert.equal(detail.reasons.length, 1);
  assert.equal(detail.reasons[0].text, "A has more buyers");
  assert.match(detail.reasons[0].label, /Cobrar cuotas a tiempo/);
  assert.equal(detail.empty, false);
  const none = runTechnical(trace("x", "2030-02-04", { sources: null, cuts: [], duels: null }), titles);
  assert.deepEqual(none, { cuts: [], notes: [], reasons: [], empty: true });
});

test("duelIds: the pains a run's duels name, each once, for one titles read", () => {
  const duels = [{ a: "dol-1", b: "dol-2", winner: "dol-2" }, { a: "dol-1", b: "dol-3", winner: null }, null, { a: null, b: null }];
  assert.deepEqual(duelIds(trace("x", "2030-02-04", { duels })), ["dol-1", "dol-2", "dol-3"]);
  assert.deepEqual(duelIds(trace("x", "2030-02-04", { duels: null })), []);
  assert.deepEqual(duelIds(null), []);
});

test("runKeys: the niche, the agents of the cap and the new pains; what the trace does not say is left out", () => {
  assert.deepEqual(runKeys(trace("x", "2030-02-04")), [
    { label: T.keyNiche, value: "Cuotas de clubes" },
    { label: T.keyAgents, value: fill(T.agentsOfCap, { used: "158", cap: "180" }) },
    { label: T.keyFound, value: fill(T.newPainsMany, { count: "6" }) },
  ]);
  assert.deepEqual(runKeys(trace("x", "2030-02-04", { niche: null, agents: null, new_pains: null })), []);
  assert.deepEqual(runKeys(null), []);
});
