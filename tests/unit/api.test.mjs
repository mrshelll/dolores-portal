// api.js reads for tomoshi: the run traces (run_traces()), each pain's history on the home, and a pain's evidence and
// verdicts on its detail. Fictional rows only: this repository is public.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadHome, loadPain, loadRuns, loadTitles, loadWeek } from "../../js/api.js";
import { classifyError } from "../../js/model.js";

// A fake supabase-js: from().select() is a thenable builder with eq() and in(); rpc() resolves. Answers are keyed by
// table or by "rpc:<name>", or are a function of the call (two reads of one table); an Error rejects, as a failed fetch
// does.
function fakeClient(answers = {}) {
  const calls = [];
  const reply = (key, call) => {
    const answer = typeof answers[key] === "function" ? answers[key](call) : answers[key];
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
        in(column, values) { call[3].push(["in", column, [...values]]); return builder; },
        then(resolve, reject) { return reply(table, call).then(resolve, reject); },
      };
      return builder;
    },
  };
}

const TRACE = { version: 1, run_id: "2030-02-04-1", date: "2030-02-04", status: "complete", funnel: [], duels: null };
const OLDER = { version: 1, run_id: "2030-01-28-1", date: "2030-01-28", status: "failed", funnel: [] };
const callOf = (client, name) => client.calls.find((c) => c[1] === name);

test("loadHome reads each pain's history and the latest 12 traces", async () => {
  const client = fakeClient({
    "rpc:run_traces": { data: [TRACE, OLDER] },
    pains: { data: [{ id: "dol-9201", territory: null, status: "watching", history: [{ run_id: "2030-02-04-1", date: "2030-02-04" }] }] },
  });
  const home = await loadHome(client);
  assert.deepEqual(home.traces, [TRACE, OLDER]);
  assert.equal(home.pains[0].history.length, 1);
  assert.deepEqual(callOf(client, "run_traces"), ["rpc", "run_traces", { p_limit: 12 }]);
  assert.equal(callOf(client, "pains")[2], "id,territory,status,team_discard:doc->team_discard,history:doc->history");
});

test("loadHome turns no traces, or a reply that is not a list, into an empty list and skips non-objects", async () => {
  assert.deepEqual((await loadHome(fakeClient())).traces, []);
  assert.deepEqual((await loadHome(fakeClient({ "rpc:run_traces": { data: { run_id: "x" } } }))).traces, []);
  assert.deepEqual((await loadHome(fakeClient({ "rpc:run_traces": { data: [null, 3, TRACE] } }))).traces, [TRACE]);
});

test("a refused run_traces rejects the home: 42501 is «no access», 401 is expired", async () => {
  const denied = fakeClient({ "rpc:run_traces": { status: 403, error: { code: "42501", message: "run_traces: not a member" } } });
  await assert.rejects(loadHome(denied), (error) => error.source === "run_traces" && classifyError(error) === "no-access");
  const expired = fakeClient({ "rpc:run_traces": { status: 401, error: { code: "PGRST303", message: "JWT expired" } } });
  await assert.rejects(loadHome(expired), (error) => classifyError(error) === "expired");
});

// The traces only draw the week's line: any other failure of run_traces leaves the home (and the masthead) without a
// line, the «no dejó su recorrido» path, instead of failing the whole screen.
test("a run_traces that fails for another reason leaves the home and the week without traces, not failed", async () => {
  const summary = { run_id: "2030-02-04-1", date: "2030-02-04", status: "complete" };
  const failures = [
    { status: 500, error: { code: "XX000", message: "statement timeout" } },
    { status: 404, error: { code: "PGRST202", message: "Could not find the function public.run_traces" } },
    { status: 400, error: { code: "22023", message: "bad limit" } },
    new TypeError("Failed to fetch"),
  ];
  for (const failure of failures) {
    const answers = { "rpc:week_summary": { data: [summary] }, pains: { data: [{ id: "dol-9201" }] }, "rpc:run_traces": failure };
    const home = await loadHome(fakeClient(answers));
    assert.deepEqual(home.traces, []);
    assert.deepEqual(home.summary, summary);
    assert.deepEqual(home.pains, [{ id: "dol-9201" }]);
    assert.deepEqual(await loadWeek(fakeClient(answers)), { summary, traces: [] });
  }
  // supabase-js's rpc() answers a builder that is only a thenable (no catch): the read still works through it.
  const thenable = (answer) => ({ then: (resolve, reject) => (answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)).then(resolve, reject) });
  for (const answer of [{ status: 200, error: null, data: [TRACE] }, { status: 500, error: { code: "XX000", message: "boom" }, data: null }, new TypeError("Failed to fetch")]) {
    const client = fakeClient({ "rpc:week_summary": { data: [summary] } });
    const rpc = client.rpc;
    client.rpc = (name, args) => (name === "run_traces" ? thenable(answer) : rpc(name, args));
    const expected = answer instanceof Error || answer.error ? [] : [TRACE];
    assert.deepEqual((await loadHome(client)).traces, expected);
    assert.deepEqual((await loadWeek(client)).traces, expected);
  }
  // Refused or expired still stop the screen, as before.
  for (const [failure, kind] of [
    [{ status: 403, error: { code: "42501", message: "run_traces: not a member" } }, "no-access"],
    [{ status: 401, error: { code: "PGRST303", message: "JWT expired" } }, "expired"],
    [{ status: 401, error: { code: "", message: "unauthorized" } }, "expired"],
    [{ status: 200, error: { code: "PGRST301", message: "JWT invalid" } }, "expired"],
  ]) {
    await assert.rejects(loadHome(fakeClient({ "rpc:run_traces": failure })), (error) => error.source === "run_traces" && classifyError(error) === kind);
    await assert.rejects(loadWeek(fakeClient({ "rpc:run_traces": failure })), (error) => error.source === "run_traces" && classifyError(error) === kind);
  }
  // Another read that fails still fails the home.
  await assert.rejects(loadHome(fakeClient({ pains: { status: 500, error: { code: "XX000", message: "boom" } } })), (error) => error.source === "pains");
});

test("loadRuns returns the traces, newest first as the base orders them", async () => {
  const client = fakeClient({ "rpc:run_traces": { data: [TRACE, OLDER] } });
  assert.deepEqual(await loadRuns(client), [TRACE, OLDER]);
  assert.deepEqual(client.calls, [["rpc", "run_traces", { p_limit: 52 }]]);
  assert.deepEqual(await loadRuns(fakeClient()), []);
  await assert.rejects(loadRuns(fakeClient({ "rpc:run_traces": new TypeError("Failed to fetch") })),
    (error) => classifyError(error) === "network");
  await assert.rejects(loadRuns(fakeClient({ "rpc:run_traces": { status: 403, error: { code: "42501", message: "no" } } })),
    (error) => error.source === "run_traces" && classifyError(error) === "no-access");
});

test("loadPain brings the pain's evidence and verdicts", async () => {
  const pain = {
    id: "dol-9202", territory: null, status: "watching",
    evidence: [{ quote: "Una cita inventada.", date: "2030-02-01", url: "https://example.com/1" }],
    verdicts: [{ lens: "evidence", run_id: "2030-02-04-1", result: "survives" }],
  };
  const client = fakeClient({
    pains: { data: [pain] },
    pain_cards: { data: [{ pain_id: "dol-9202", kind: "line", card: { kind: "line", line: { what_hurts: "Duele algo inventado." } } }] },
  });
  const data = await loadPain(client, "dol-9202");
  assert.deepEqual(data.pain, pain);
  assert.equal(callOf(client, "pains")[2],
    "id,territory,status,team_discard:doc->team_discard,evidence:doc->evidence,verdicts:doc->verdicts");
});

test("loadWeek reads only the week's summary and the latest trace, for the masthead on any screen", async () => {
  const summary = { run_id: "2030-02-04-1", date: "2030-02-04", status: "complete" };
  const client = fakeClient({ "rpc:week_summary": { data: [summary] }, "rpc:run_traces": { data: [TRACE] } });
  assert.deepEqual(await loadWeek(client), { summary, traces: [TRACE] });
  assert.deepEqual(client.calls, [["rpc", "week_summary", undefined], ["rpc", "run_traces", { p_limit: 1 }]]);
  assert.deepEqual(await loadWeek(fakeClient()), { summary: null, traces: [] });
  await assert.rejects(loadWeek(fakeClient({ "rpc:week_summary": { status: 401, error: { code: "PGRST303", message: "JWT expired" } } })),
    (error) => error.source === "week_summary" && classifyError(error) === "expired");
});

// A pain opened straight from the Monday email names its duel rivals: loadPain reads their titles in one more read.
const TITLES_SELECT = "pain_id,title:card->line->>title,what_hurts:card->line->>what_hurts";
const DUEL_CARD = {
  kind: "full", version: 3,
  line: { title: "Un dolor inventado" },
  duels: [
    { against: "dol-9301", won: true, plain: "Ganó." },
    { against: "dol-9302", won: false, plain: "Perdió." },
    { against: "dol-9301", won: true, plain: "Repetido." },
    { against: "dol-9202", won: true, plain: "Contra sí mismo." },
    { against: 42, won: true, plain: "Sin id." },
    { against: "dol-9303; drop", won: true, plain: "Un id raro." },
    null,
  ],
};
const isTitlesRead = (call) => call[2] === TITLES_SELECT;
const painCards = (titles) => (call) => (isTitlesRead(call)
  ? titles
  : { data: [{ pain_id: "dol-9202", kind: "full", card: DUEL_CARD }] });

test("loadPain reads the duel rivals' titles in one read, only for real rival ids", async () => {
  const client = fakeClient({
    pains: { data: [{ id: "dol-9202", territory: null, status: "alive" }] },
    pain_cards: painCards({ data: [
      { pain_id: "dol-9301", title: "Primer rival inventado" },
      { pain_id: "dol-9302", title: "   " },
      { pain_id: "dol-9999", title: "No lo pedimos" },
      null,
    ] }),
  });
  const data = await loadPain(client, "dol-9202");
  const reads = client.calls.filter((c) => c[1] === "pain_cards");
  assert.equal(reads.length, 2);
  assert.deepEqual(reads.find(isTitlesRead), ["select", "pain_cards", TITLES_SELECT, [["in", "pain_id", ["dol-9301", "dol-9302"]]]]);
  assert.ok(data.titles instanceof Map);
  assert.deepEqual([...data.titles], [["dol-9301", "Primer rival inventado"]]);
});

// A version-1 card has no line.title: the rival goes by what hurts, as the home titles it (model.js), also when the pain
// is opened straight from the Monday email.
test("a rival whose card has no title goes by its what_hurts; one with neither is left out", async () => {
  const client = fakeClient({
    pains: { data: [{ id: "dol-9202", territory: null, status: "alive" }] },
    pain_cards: painCards({ data: [
      { pain_id: "dol-9301", title: null, what_hurts: " Duele algo inventado. " },
      { pain_id: "dol-9302", title: "  ", what_hurts: null },
    ] }),
  });
  assert.deepEqual([...(await loadPain(client, "dol-9202")).titles], [["dol-9301", "Duele algo inventado."]]);
  const runs = fakeClient({ pain_cards: { data: [{ pain_id: "dol-9401", title: "Con título", what_hurts: "No se usa" }, { pain_id: "dol-9402", what_hurts: "Sin título" }] } });
  assert.deepEqual([...(await loadTitles(runs, ["dol-9401", "dol-9402"]))], [["dol-9401", "Con título"], ["dol-9402", "Sin título"]]);
});

test("loadPain makes no titles read for a card without duels, and gives no titles", async () => {
  const client = fakeClient({
    pains: { data: [{ id: "dol-9202", territory: null, status: "alive" }] },
    pain_cards: { data: [{ pain_id: "dol-9202", kind: "full", card: { ...DUEL_CARD, duels: [] } }] },
  });
  const data = await loadPain(client, "dol-9202");
  assert.equal(client.calls.filter((c) => c[1] === "pain_cards").length, 1);
  assert.deepEqual([...data.titles], []);
  const old = fakeClient({
    pains: { data: [{ id: "dol-9202", territory: null, status: "alive" }] },
    pain_cards: { data: [{ pain_id: "dol-9202", kind: "full", card: { kind: "full", line: { title: "Sin duelos" } } }] },
  });
  assert.deepEqual([...(await loadPain(old, "dol-9202")).titles], []);
  assert.equal(old.calls.filter((c) => c[1] === "pain_cards").length, 1);
});

test("a failed titles read still opens the pain: the rivals keep their plain fallback", async () => {
  for (const failure of [new TypeError("Failed to fetch"), { status: 500, error: { code: "XX000", message: "boom" } }]) {
    const client = fakeClient({
      pains: { data: [{ id: "dol-9202", territory: null, status: "alive" }] },
      pain_cards: painCards(failure),
    });
    const data = await loadPain(client, "dol-9202");
    assert.equal(data.card, DUEL_CARD);
    assert.deepEqual([...data.titles], []);
  }
});

// Corridas names each run's duels by the cards' titles: one read for the ids asked for, each once, only valid ids.
test("loadTitles reads the titles of the ids asked for in one read; a failure gives no titles", async () => {
  const client = fakeClient({ pain_cards: { data: [
    { pain_id: "dol-9401", title: " Primer dolor inventado " }, { pain_id: "dol-9402", title: "  " }, { pain_id: "dol-9999", title: "No pedido" },
  ] } });
  const titles = await loadTitles(client, ["dol-9401", "dol-9402", "dol-9401", null, "bad id!", ""]);
  assert.deepEqual([...titles], [["dol-9401", "Primer dolor inventado"]]);
  assert.deepEqual(client.calls, [["select", "pain_cards", TITLES_SELECT, [["in", "pain_id", ["dol-9401", "dol-9402"]]]]]);
  const none = fakeClient();
  assert.deepEqual([...(await loadTitles(none, []))], []);
  assert.deepEqual([...(await loadTitles(none, null))], []);
  assert.deepEqual(none.calls, []);
  assert.deepEqual([...(await loadTitles(fakeClient({ pain_cards: new TypeError("Failed to fetch") }), ["dol-9401"]))], []);
  assert.deepEqual([...(await loadTitles(fakeClient({ pain_cards: { status: 500, error: { code: "XX000", message: "x" } } }), ["dol-9401"]))], []);
});
