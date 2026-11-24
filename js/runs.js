// Corridas' logic, without the DOM or the network: every traced run (dolores/scripts/lib/trace.mjs, buildTrace) as a
// row of the list, and what an opened run says in words: its cost, its agents, its cuts, its duels and, apart, the raw
// texts of «Detalle técnico». Pure, so tests/unit/runs.test.mjs runs it in Node.
//
// The raw texts (a cut's `original`, a source's `note`, a duel's `reason`) are internal and often English: only
// runTechnical reads them, and the page shows them only inside the closed «Detalle técnico» (Review Focus 3).

import { T, TOPICS, fill, topicName, formatDate, formatNumber, formatUsd } from "./text.js";
import { lineView, runDuration, costRows, ownNicheName } from "./model.js";

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isTrace = (value) => isObject(value) && typeof value.run_id === "string" && value.run_id !== "";
const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const usd = (value) => {
  const amount = formatUsd(value);
  return amount === null ? null : fill(T.costUsd, { amount });
};
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;
const dayOf = (trace) => (typeof trace.date === "string" && ISO_DAY.test(trace.date) ? trace.date.slice(0, 10) : null);

// A run's status as a lamp and in words: green complete, amber incomplete or only gathered, red failed; off and said
// so for a status the page does not know.
const STATES = new Map([
  ["complete", ["green", "runStateComplete"]],
  ["incomplete", ["amber", "runStateIncomplete"]],
  ["ingest-only", ["amber", "runStateIngestOnly"]],
  ["failed", ["red", "runStateFailed"]],
]);
export function runState(status) {
  const [lamp, key] = STATES.get(status) ?? ["off", "runStateUnknown"];
  return { lamp, text: T[key] };
}

// «Corrida del 10 nov 2026», or «Corrida sin fecha».
export function runTitle(trace) {
  const date = isTrace(trace) ? formatDate(dayOf(trace)) : "";
  return date ? fill(T.runTitleDated, { date }) : T.runTitleUndated;
}

// The niche by its name (not its id humanized, ownNicheName); without one, by its topic's plain name when the page knows
// it. Never by its id.
function nicheName(trace) {
  const niche = isObject(trace.niche) ? trace.niche : {};
  return ownNicheName(niche.name, niche.id) ?? (typeof niche.id === "string" && TOPICS.has(niche.id) ? topicName(niche.id) : null);
}

function newPains(trace) {
  const n = number(trace.new_pains);
  if (n === null || n < 0) return null;
  return n === 0 ? T.newPainsNone : n === 1 ? T.newPainsOne : fill(T.newPainsMany, { count: formatNumber(n) });
}

// A row of the list: the run's date as its title, its state, its niche, how long it took (only when both times
// exist), its cost and its new pains, then the mini line: each stage's lamp and count (lineView), and how many stages
// had a cut. What the trace does not say is left out. null for what is not a trace.
export function runRow(trace) {
  if (!isTrace(trace)) return null;
  const { lamp, text: state } = runState(trace.status);
  const view = lineView(trace);
  const stages = view.stages.map((s) => ({ label: s.label, count: s.count === null ? null : formatNumber(s.count), lamp: s.lamp }));
  const cut = view.stages.filter((s) => s.lamp === "amber").length;
  return {
    id: trace.run_id,
    href: `#/corridas/${encodeURIComponent(trace.run_id)}`,
    title: runTitle(trace),
    lamp,
    state,
    facts: [nicheName(trace), runDuration(trace), usd(isObject(trace.cost) ? trace.cost.total_usd : null), newPains(trace)].filter(Boolean),
    stages,
    hasCounts: stages.some((s) => s.count !== null),
    cutStages: cut === 0 ? T.lineStripClean : cut === 1 ? T.lineStripCutsOne : fill(T.lineStripCuts, { count: formatNumber(cut) }),
  };
}

// The key data under an opened run's title: its niche, the agents it used of its cap, and the new pains it found.
// What the trace does not say is left out.
export function runKeys(trace) {
  if (!isTrace(trace)) return [];
  return [
    { label: T.keyNiche, value: nicheName(trace) },
    { label: T.keyAgents, value: runAgents(trace) },
    { label: T.keyFound, value: newPains(trace) },
  ].filter((key) => key.value);
}

const COLLATOR = new Intl.Collator("en", { numeric: true });

// Every traced run as a row, newest first (by its day, then by its id: «2030-01-28-10» after «-2»), each run once; a
// run without a day goes last. The base already hands them newest first; this keeps the page right if it did not.
export function runRows(traces) {
  const seen = new Set();
  const list = (Array.isArray(traces) ? traces : []).filter((t) => {
    if (!isTrace(t) || seen.has(t.run_id)) return false;
    seen.add(t.run_id);
    return true;
  });
  list.sort((a, b) => {
    const x = dayOf(a);
    const y = dayOf(b);
    if (x !== y) return !x ? 1 : !y ? -1 : x < y ? 1 : -1;
    return COLLATOR.compare(b.run_id, a.run_id);
  });
  return list.map(runRow);
}

// The cost of an opened run: each model, the cards («Fichas»), then the total (which includes the cards).
export function runCostLines(trace) {
  if (!isTrace(trace)) return [];
  const rows = costRows(trace).map((row) => ({ ...row, total: false }));
  const total = usd(isObject(trace.cost) ? trace.cost.total_usd : null);
  return total ? [...rows, { label: T.costTotal, value: total, total: true }] : rows;
}

// «158 usados de 180», «40 usados», or null without a count.
export function runAgents(trace) {
  const agents = isTrace(trace) && isObject(trace.agents) ? trace.agents : {};
  const used = number(agents.used);
  if (used === null) return null;
  const cap = number(agents.cap);
  return cap === null ? fill(T.agentsUsed, { used: formatNumber(used) }) : fill(T.agentsOfCap, { used: formatNumber(used), cap: formatNumber(cap) });
}

// Every cut in plain words, in the run's order. A cut with no plain words of its own (`kind: 'other'`, or no text) is
// never hidden and never shown raw: they are counted together in one last line, «Hubo un recorte más» or «Hubo 3
// recortes más» (Review Focus 3), which points to «Detalle técnico» when their sentences are there. The run's line
// leaves them out on this page, so they are said once (finish review 6).
export function runCutLines(trace) {
  const cuts = isTrace(trace) && Array.isArray(trace.cuts) ? trace.cuts.filter(isObject) : [];
  const plain = [];
  let shown = 0; // unexplained, with a sentence «Detalle técnico» shows (runTechnical)
  let bare = 0; // unexplained, with nothing to show there
  for (const cut of cuts) {
    const words = cut.kind === "other" ? null : text(cut.text);
    if (words) plain.push(words);
    else if (cut.kind === "other" && text(cut.original)) shown += 1;
    else bare += 1;
  }
  // The ones «Detalle técnico» shows are counted with the pointer to it; the others are only counted.
  const count = (n, one, many) => (n === 1 ? [one] : n > 1 ? [fill(many, { count: formatNumber(n) })] : []);
  return [...plain, ...count(shown, T.runCutsOtherOne, T.runCutsOtherMany), ...count(bare, T.cutOther, T.cutsOtherMany)];
}

function titleOf(titles, id) {
  if (typeof id !== "string") return null;
  if (titles instanceof Map) return text(titles.get(id));
  return isObject(titles) && Object.hasOwn(titles, id) ? text(titles[id]) : null;
}

const capital = (line) => line.charAt(0).toUpperCase() + line.slice(1);

// One duel in words: «A» contra «B» · ganó «B». Each pain by its card's title; one the page has no title for is «un
// dolor del catálogo» (first) or «otro dolor del catálogo» (second), and a winner without a title is «el primero» or
// «el segundo». Never an id; the duel's reason is raw and is not read here.
function duelLine(duel, titles) {
  const a = titleOf(titles, duel.a);
  const b = titleOf(titles, duel.b);
  const named = (title) => `«${title}»`;
  const w = duel.winner;
  const winnerTitle = titleOf(titles, w);
  const winner = typeof w !== "string" ? T.duelNoWinner
    : winnerTitle ? fill(T.duelWinner, { name: named(winnerTitle) })
      : w === duel.a ? T.duelWinnerFirst
        : w === duel.b ? T.duelWinnerSecond
          : fill(T.duelWinner, { name: T.duelOtherPain });
  return capital(fill(T.duelLine, { a: a ? named(a) : T.duelOnePain, b: b ? named(b) : T.duelOtherPain, winner }));
}

const playable = (duel) => isObject(duel) && (typeof duel.a === "string" || typeof duel.b === "string");
const duelsOf = (trace) => (isTrace(trace) && Array.isArray(trace.duels) ? trace.duels.filter(playable) : []);

// Every duel of the run in words (duelLine), in the run's order. `titles`: a Map or an object by pain id.
export function runDuelLines(trace, titles) {
  return duelsOf(trace).map((duel) => duelLine(duel, titles));
}

// «Detalle técnico»: the raw texts, as the run wrote them: each unexplained cut's original sentence, each source's
// note (by the source's name or kind), each duel's reason (by its line in words). `empty` when there is none.
export function runTechnical(trace, titles) {
  const ok = isTrace(trace);
  const cuts = (ok && Array.isArray(trace.cuts) ? trace.cuts : [])
    .filter((c) => isObject(c) && c.kind === "other").map((c) => text(c.original)).filter(Boolean);
  const notes = (ok && Array.isArray(trace.sources) ? trace.sources : [])
    .filter(isObject)
    .map((s) => ({ label: text(s.name) ?? text(s.kind) ?? T.techSourceUnnamed, text: text(s.note) }))
    .filter((n) => n.text);
  const reasons = duelsOf(trace)
    .map((duel) => ({ label: duelLine(duel, titles), text: text(duel.reason) }))
    .filter((r) => r.text);
  return { cuts, notes, reasons, empty: !cuts.length && !notes.length && !reasons.length };
}

// The pain ids a run's duels name, each once, for one titles read (api.js, loadTitles).
export function duelIds(trace) {
  const ids = new Set();
  for (const duel of duelsOf(trace)) for (const id of [duel.a, duel.b, duel.winner]) if (typeof id === "string" && id) ids.add(id);
  return [...ids];
}
