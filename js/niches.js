// Nichos' logic, without the DOM or the network: the board the tab draws, from the newest trace with a choice
// (dolores/scripts/lib/trace.mjs, buildTrace: `choice`, `probe`, `why`, `territories`), the proposed niches, the
// vetoes, the pains, the marks and the people (js/api.js, loadNiches). Pure, so tests/unit/niches.test.mjs runs it in
// Node.
//
// Old traces lack `why` and `territories`, and their ranking entries lack `resting_until` and `advanced_pains`: each is
// read as possibly missing. A niche's id (its slug) is only ever `row.id`, for the veto: never in a string.

import { T, TOPICS, fill, topicName, formatDayMonth, formatNumber } from "./text.js";
import { sectionOf, nameMap, nameOf } from "./model.js";

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const list = (value) => (Array.isArray(value) ? value : []);
const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_DAYS = 31;
const PAID = new Set(["complete", "incomplete"]);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;
const dayOf = (value) => (typeof value === "string" && ISO_DAY.test(value) ? value.slice(0, 10) : null);
// A date as «4 de marzo», or null when there is none to say.
const dayMonth = (value) => formatDayMonth(typeof value === "string" ? value : null) || null;
// A name that is the slug itself is no name: the page never shows a slug.
const nameOr = (value, id) => {
  const name = text(value);
  return name && name !== id ? name : null;
};

// Each item by its `key`, the first one of each kept; items without a string key are dropped.
function byKey(items, key) {
  const map = new Map();
  for (const item of list(items)) {
    if (isObject(item) && typeof item[key] === "string" && item[key] !== "" && !map.has(item[key])) map.set(item[key], item);
  }
  return map;
}

// The newest trace whose choice names the niche that ran (traces come newest first).
const chosen = (traces) => list(traces).find((t) => isObject(t) && isObject(t.choice) && text(t.choice.territory));

// «28 %» from the probe's share; «sin medir» for a counted week or no share; null with nothing measured at all.
function noiseOf(rank, probe) {
  if (!rank && !probe) return null;
  const share = probe ? number(probe.noise_share) : null;
  const counted = (probe && probe.source === "counts") || (rank && rank.source === "counts");
  if (share === null || counted || share < 0 || share > 1) return T.nicheNoiseUnmeasured;
  return fill(T.nicheNoisePercent, { n: Math.round(share * 100) });
}

// Whether a proposed niche came within a month of the trace's day (one proposed after it is new too).
function isNew(proposedAt, traceDay) {
  const proposed = Date.parse(`${dayOf(proposedAt)}T00:00:00Z`);
  const day = Date.parse(`${traceDay}T00:00:00Z`);
  if (Number.isNaN(proposed) || Number.isNaN(day)) return false;
  return day - proposed <= NEW_DAYS * DAY_MS;
}

// Who vetoed and when, by name: from the vetoes' row, else the niche's own state. Null without who.
function vetoNoteOf(veto, niche, names) {
  const by = veto ? veto.vetoed_by : niche ? niche.state_by : null;
  const at = veto ? veto.vetoed_at : niche ? niche.state_changed_at : null;
  if (!text(by)) return null;
  const name = nameOf(names, by.trim());
  const date = dayMonth(at);
  return date ? fill(T.nicheVetoedBy, { name, date }) : fill(T.nicheVetoedByUndated, { name });
}

// The state, the first that applies: vetoed, retired, the niche that ran, resting, else competing.
function stateOf({ id, niche, veto, rank, current, traceDay, names }) {
  if (veto || (niche && niche.state === "vetoed")) {
    return { state: "vetoed", lamp: "red", stateText: T.nicheStateVetoed, stateNote: null, vetoNote: vetoNoteOf(veto, niche, names) };
  }
  if (niche && niche.state === "retired") {
    const date = dayMonth(niche.state_changed_at);
    const stateNote = date ? fill(T.nicheRetiredOn, { date }) : T.nicheRetiredUndated;
    return { state: "retired", lamp: "off", stateText: T.nicheStateRetired, stateNote, vetoNote: null };
  }
  if (id === current) return { state: "current", lamp: "green", stateText: T.nicheStateCurrent, stateNote: null, vetoNote: null };
  if (rank && rank.resting === true) {
    const date = dayMonth(rank.resting_until);
    const stateNote = date ? fill(T.nicheRestingUntil, { date }) : T.nicheRestingUndated;
    return { state: "resting", lamp: "off", stateText: T.nicheStateResting, stateNote, vetoNote: null };
  }
  const fresh = niche && traceDay && isNew(niche.proposed_at, traceDay);
  return { state: "competing", lamp: "amber", stateText: T.nicheStateCompeting, stateNote: fresh ? T.nicheNew : null, vetoNote: null };
}

const ORDER = ["current", "competing", "resting", "vetoed", "retired"];

export function nicheBoard({ traces = [], niches = [], vetoes = [], pains = [], marks = [], people = [] } = {}) {
  const trace = chosen(traces);
  if (!trace) return { week: null, rows: [], empty: true };

  const { choice } = trace;
  const current = text(choice.territory);
  const traceDay = dayOf(trace.date);
  const ranking = byKey(choice.ranking, "name");
  const probes = byKey(trace.probe, "name");
  const vetoed = byKey(vetoes, "name");
  const names = nameMap(people);
  const ranOf = isObject(trace.niche) && trace.niche.id === current ? trace.niche : null;

  // Every territory, then every proposed niche whose name no territory has (a territory wins, as in dolores). A trace
  // that could not name the territories still shows the ranking's and the one that ran, as the user's own.
  const sources = new Map();
  for (const t of list(trace.territories)) {
    if (isObject(t) && text(t.id) && !sources.has(t.id)) sources.set(t.id, { origin: "mine", name: t.name });
  }
  const proposed = byKey(niches, "name");
  for (const id of proposed.keys()) if (!sources.has(id)) sources.set(id, { origin: "proposed", niche: proposed.get(id) });
  for (const id of [...ranking.keys(), current]) {
    if (!sources.has(id)) sources.set(id, { origin: "mine", name: ranOf && ranOf.id === id ? ranOf.name : null });
  }

  const allMarks = list(marks);
  const rows = [...sources].map(([id, source]) => {
    const niche = source.origin === "proposed" ? source.niche : null;
    const rank = ranking.get(id) ?? null;
    const status = stateOf({ id, niche, veto: vetoed.get(id), rank, current, traceDay, names });
    const quiet = status.state === "vetoed" || status.state === "retired";
    const proposedOn = niche ? dayMonth(niche.proposed_at) : null;
    const own = { weighty: 0, watching: 0 };
    for (const pain of list(pains)) {
      if (!isObject(pain) || pain.territory !== id) continue;
      const section = sectionOf(pain, allMarks);
      if (section === "weighty" || section === "watching") own[section] += 1;
    }
    return {
      id,
      name: niche
        ? nameOr(niche.label, id) ?? T.nicheProposedUnnamed
        : nameOr(source.name, id) ?? (TOPICS.has(id) ? topicName(id) : T.nicheUnnamed),
      origin: source.origin,
      originText: !niche ? T.nicheOriginMine : proposedOn ? fill(T.nicheOriginProposed, { date: proposedOn }) : T.nicheOriginProposedUndated,
      why: niche ? text(niche.summary) : null,
      ...status,
      complaints: quiet || !rank ? null : number(rank.complaints),
      spending: quiet || !rank ? null : number(rank.spending),
      noise: quiet ? null : noiseOf(rank, probes.get(id)),
      paidRuns: list(traces).filter((t) => isObject(t) && isObject(t.niche) && t.niche.id === id && PAID.has(t.status)).length,
      pains: own,
      vetoed: status.state === "vetoed",
      canVeto: status.state !== "retired",
    };
  });

  // By state; within one, in ranking order, those out of the ranking after it by name.
  const place = new Map([...ranking.keys()].map((id, i) => [id, i]));
  const placeOf = (row) => place.get(row.id) ?? place.size;
  rows.sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state)
    || placeOf(a) - placeOf(b)
    || a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

  const row = rows.find((r) => r.id === current);
  return { week: weekOf(trace, row, ranking, probes), rows, empty: false };
}

// One side of the week's analysis: the niche's value, its place among the week's ranking, every rival's value over the
// week's highest (0-100) and whether it has a signal at all (above 0).
function measure(label, key, rank, ranking) {
  const own = rank ? number(rank[key]) : null;
  const rivals = [...ranking.values()].filter((e) => e !== rank).map((e) => number(e[key])).filter((v) => v !== null);
  const all = own === null ? rivals : [...rivals, own];
  const max = Math.max(0, ...all);
  const at = (v) => (max > 0 ? Math.round((v / max) * 100) : 0);
  const place = own === null ? null : 1 + rivals.filter((v) => v > own).length;
  const signal = own !== null && own > 0;
  return {
    label,
    value: own === null ? null : formatNumber(own),
    rank: place === null ? null : place === 1 ? T.nicheRankTop : fill(T.nicheRank, { n: place, total: all.length }),
    positions: rivals.map(at),
    at: own === null ? null : at(own),
    flag: signal ? "in" : "out",
    flagText: signal ? T.nicheSignalIn : T.nicheSignalOut,
  };
}

// The week block: the niche that ran, when, why, its analysis against the others, how many of its pains came close to
// weight, and what a veto does now.
function weekOf(trace, row, ranking, probes) {
  const rank = ranking.get(row.id) ?? null;
  const noise = noiseOf(rank, probes.get(row.id));
  const analysis = [
    measure(T.nicheComplaints, "complaints", rank, ranking),
    measure(T.nicheSpending, "spending", rank, ranking),
    {
      label: T.nicheNoise, value: noise, rank: noise && noise !== T.nicheNoiseUnmeasured ? T.nicheNoiseOf : null,
      positions: [], at: null, flag: null, flagText: "",
    },
  ];
  const advanced = rank ? number(rank.advanced_pains) : null;
  return {
    row,
    date: dayMonth(dayOf(trace.date)),
    why: text(trace.why) ?? T.nicheWhyMissing,
    analysis,
    note: noteOf(rank, trace.choice.reason),
    advanced: advanced === null || advanced < 1
      ? null
      : advanced === 1 ? T.nicheAdvancedOne : fill(T.nicheAdvancedMany, { count: formatNumber(advanced) }),
    vetoNext: row.vetoed ? T.nicheVetoNextVetoed : T.nicheVetoNext,
  };
}

// The reasons of a week the ranking decided (dolores/scripts/lib/chooser.mjs): only then does the rule pick the winner.
const RANKED = new Set(["first", "switched-stalled", "switched-unavailable"]);

// A counted week says the noise went unmeasured, whatever the reason. A judged week the ranking decided says the rule
// and the niche's weaker side; one kept, requested or fallen back to says nothing (its `why` says the real reason).
function noteOf(rank, reason) {
  if (!rank) return null;
  if (rank.source === "counts") return T.nicheNoteCounts;
  const score = number(rank.score);
  if (rank.source !== "judge" || score === null || !RANKED.has(reason)) return null;
  const complaints = number(rank.complaints);
  const spending = number(rank.spending);
  const side = complaints !== null && spending !== null && spending < complaints ? T.nicheSideSpending : T.nicheSideComplaints;
  return fill(T.nicheNoteJudge, { value: formatNumber(score), side });
}

// ---- the veto, mirrored after the base took it ------------------------------------------------------------------

// The data loadNiches gave with one veto set or lifted as set_niche_veto does in the base, so the tab redraws without
// reading everything again: a name in `niches` is a proposed niche and changes its own state, by and when (lifting
// only a vetoed one); any other name is a territory, with its row in `vetoes` added (the first veto stays) or removed.
// A new object; the lists it does not touch are the same ones, and the input is left as it was.
export function withVeto(data, { name, vetoed, by, at }) {
  const niches = list(data && data.niches);
  const vetoes = list(data && data.vetoes);
  if (niches.some((n) => isObject(n) && n.name === name)) {
    return {
      ...data,
      niches: niches.map((n) => {
        if (!isObject(n) || n.name !== name || (!vetoed && n.state !== "vetoed")) return n;
        return { ...n, state: vetoed ? "vetoed" : "active", state_by: by, state_changed_at: at };
      }),
      vetoes,
    };
  }
  const kept = vetoes.filter((v) => !isObject(v) || v.name !== name);
  if (!vetoed) return { ...data, niches, vetoes: kept };
  if (kept.length < vetoes.length) return { ...data, niches, vetoes };
  return { ...data, niches, vetoes: [...vetoes, { name, vetoed_by: by, vetoed_at: at }] };
}

// ---- the tab's counts in words ------------------------------------------------------------------------------------

// A niche's paid runs: «2 corridas pagadas» in its row, «2 corridas pagadas en este nicho» (`long`) in the week's block.
export function paidRunsText(count, { long = false } = {}) {
  const n = number(count) ?? 0;
  if (n < 1) return long ? T.nichePaidRunsNoneLong : T.nichePaidRunsNone;
  if (n === 1) return long ? T.nichePaidRunsOneLong : T.nichePaidRunsOne;
  return fill(long ? T.nichePaidRunsManyLong : T.nichePaidRunsMany, { count: formatNumber(n) });
}

// A niche's pains: the table's short line, the whole one for a screen reader and the week's block, and, with none, the
// sentence that says so instead («Sin dolores aún», or «Sin dolores» for a retired niche, which will have none).
export function painsText(pains, { retired = false } = {}) {
  const weighty = number(pains && pains.weighty) ?? 0;
  const watching = number(pains && pains.watching) ?? 0;
  const params = { weighty: formatNumber(weighty), watching: formatNumber(watching) };
  return {
    short: fill(T.nichePainsShort, params),
    full: fill(T.nichePainsFull, params),
    none: weighty || watching ? null : retired ? T.nichePainsNoneRetired : T.nichePainsNone,
  };
}

// The week's analysis column: the niche against how many others.
export function versusLabel(rivals) {
  const n = number(rivals) ?? 0;
  if (n < 1) return T.nicheVersusNone;
  if (n === 1) return T.nicheVersusOne;
  return fill(T.nicheVersus, { n: formatNumber(n) });
}
