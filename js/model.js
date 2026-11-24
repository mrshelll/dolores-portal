// The home's logic, without the DOM or the network: which section each pain goes in, the sentence that sums up the
// week, the notice about the run, and what kind of failure a read was. Pure, so tests/unit/model.test.mjs runs it in
// Node.

import { T, TOPICS, fill, topicName, formatDate, formatDayMonth, formatUsd, formatNumber } from "./text.js";
import { isNetworkError } from "./auth-errors.js";

// The same rule as the run (dolores/scripts/lib/marks.mjs, effectiveMark): one «interested» mark keeps a pain in play;
// a pain only discarded is discarded; no mark is null. The page and the run must never disagree.
export function effectiveMark(painId, marks = []) {
  const own = (Array.isArray(marks) ? marks : []).filter((m) => m && m.pain_id === painId);
  if (own.some((m) => m.mark === "interested")) return "interested";
  if (own.some((m) => m.mark === "discarded")) return "discarded";
  return null;
}

const MARKS = new Set(["interested", "discarded"]);
const DIRECTIONS = new Set(["new", "rising", "falling", "steady"]);
const WATCHING = new Set(["watching", "incomplete-verification"]);
// The statuses a team discard can go back to: the run's own list (dolores/scripts/lib/catalog.mjs, STATUSES) without
// the discard itself.
const RESTORABLE = new Set(["alive", "watching", "incomplete-verification", "dead"]);
const TEAM_DISCARDED = "manually-discarded";

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
const lower = (value) => String(value ?? "").trim().toLowerCase();
const byName = (a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }) || a.mark.localeCompare(b.mark);

// Each person's name by their lowercased email. Someone not on the list shows as their email, as the run does.
export function nameMap(people) {
  const list = Array.isArray(people) ? people : [];
  return new Map(list.filter((p) => p && p.email).map((p) => [lower(p.email), text(p.name) ?? String(p.email)]));
}
export const nameOf = (names, email) => names.get(lower(email)) ?? String(email ?? "");

// Who marked what, by name (the email when the person is not on the list), sorted by name.
function marksOf(painId, marks, names) {
  return marks
    .filter((m) => m && m.pain_id === painId && MARKS.has(m.mark))
    .map((m) => ({ name: nameOf(names, m.author), mark: m.mark }))
    .sort(byName);
}

// A row needs a card with a line to read: the title (a version-1 card has none, so what hurts stands in) and who.
function itemOf(pain, card, marks, names) {
  const line = card && typeof card === "object" && card.line && typeof card.line === "object" ? card.line : null;
  const title = line && (text(line.title) ?? text(line.what_hurts));
  if (!title) return null;
  const trend = card.trend && typeof card.trend === "object" ? card.trend : {};
  return {
    id: pain.id,
    title,
    who: text(line.who) ?? "",
    trend: {
      direction: DIRECTIONS.has(trend.direction) ? trend.direction : null,
      last_evidence: text(trend.last_evidence),
    },
    topic: topicName(pain.territory),
    marks: marksOf(pain.id, marks, names),
  };
}

// Newest evidence first (ISO dates compare as text), a pain without evidence last, then by id.
function byEvidence(a, b) {
  const x = a.trend.last_evidence;
  const y = b.trend.last_evidence;
  if (x !== y) {
    if (!x) return 1;
    if (!y) return -1;
    return x < y ? 1 : -1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// The status a pain stands on for the page. The run turns a team discard into `manually-discarded` and keeps the status
// it replaced in `team_discard`; once the discard marks are gone, the next run puts that status back (marks.mjs,
// canRestore). Until then the page already reads it as the previous status, so the pain does not vanish for a week. A
// hand discard (no restorable `team_discard`) keeps its status.
function standingStatus(pain, mark) {
  const previous = pain.team_discard && typeof pain.team_discard === "object" ? pain.team_discard.previous_status : null;
  if (pain.status === TEAM_DISCARDED && mark !== "discarded" && RESTORABLE.has(previous)) return previous;
  return pain.status;
}

// The section a pain goes in, the first that applies: discarded by the team, alive («con peso para trabajar»), marked
// interested, under watch; null for anything else (dead, discarded by hand). A pain that stays `manually-discarded`
// without a discard mark was discarded by hand: an «interested» mark does not bring it back, since the run never
// touches it nor writes it a card. The home and a pain's detail both place a pain with this, so they never disagree.
export function sectionOf(pain, marks) {
  if (!pain || !pain.id) return null;
  const mark = effectiveMark(pain.id, marks);
  const status = standingStatus(pain, mark);
  if (mark === "discarded") return "discarded";
  if (status === TEAM_DISCARDED) return null;
  if (status === "alive") return "weighty";
  if (mark === "interested") return "interested";
  if (WATCHING.has(status)) return "watching";
  return null;
}

// Each pain with a card goes in at most one section (sectionOf). A pain without a card is left out.
export function buildSections({ pains = [], cards = [], marks = [], people = [] } = {}) {
  const list = (value) => (Array.isArray(value) ? value : []);
  const allMarks = list(marks);
  const names = nameMap(people);
  const cardOf = new Map(list(cards).filter((row) => row && row.pain_id).map((row) => [row.pain_id, row.card]));
  const sections = { weighty: [], interested: [], watching: [], discarded: [] };
  for (const pain of list(pains)) {
    if (!pain || !pain.id) continue;
    const item = itemOf(pain, cardOf.get(pain.id), allMarks, names);
    if (!item) continue;
    const section = sectionOf(pain, allMarks);
    if (section) sections[section].push(item);
  }
  for (const items of Object.values(sections)) items.sort(byEvidence);
  return sections;
}

// Catálogo: every pain by its section, the same as buildSections.
export const catalogSections = (input) => buildSections(input);

// Catálogo's sections in order, each with its title, its heading with the count, its lamp and its state in words (the
// same words as a pain's tag), its pains, and what it says when it has none. `empty` when no section has a pain.
const CATALOG = [
  ["weighty", "sectionWeighty", "statusWeighty", "catalogEmptyWeighty"],
  ["interested", "sectionInterested", "statusInterested", "catalogEmptyInterested"],
  ["watching", "sectionWatching", "statusWatching", "catalogEmptyWatching"],
  ["discarded", "sectionDiscarded", "statusDiscarded", "catalogEmptyDiscarded"],
];
export function catalogView(input) {
  const sections = catalogSections(input);
  const list = CATALOG.map(([key, title, state, empty]) => ({
    key,
    title: T[title],
    heading: fill(T.sectionCount, { title: T[title], count: formatNumber(sections[key].length) }),
    count: sections[key].length,
    lamp: painLamp(key),
    state: T[state],
    emptyText: T[empty],
    items: sections[key],
  }));
  const total = list.reduce((sum, section) => sum + section.count, 0);
  return { sections: list, total, empty: total === 0 };
}

const TREND_LABEL = new Map([["new", "trendNew"], ["rising", "trendRising"], ["falling", "trendFalling"], ["steady", "trendSteady"]]);
const MARK_LABEL = [["interested", "markInterested"], ["discarded", "markDiscarded"]];
const NAMES = new Intl.ListFormat("es", { style: "long", type: "conjunction" });

// «Nos interesa: Beto y Carla», «Descartado: Ana», from a pain's marks by name ({ name, mark }).
const markGroups = (marks) => MARK_LABEL
  .map(([mark, key]) => [key, marks.filter((m) => m.mark === mark).map((m) => m.name)])
  .filter(([, names]) => names.length)
  .map(([key, names]) => fill(T.markedBy, { mark: T[key], names: NAMES.format(names) }));

// The trend and the topic of a row: «Gana fuerza», «Sin tema».
export function stationMeta(item) {
  const trend = TREND_LABEL.get(item.trend && item.trend.direction);
  return [trend ? T[trend] : null, item.topic].filter(Boolean);
}

// A row's marks: «Nos interesa: Beto y Carla», «Descartado: Ana»; [] when nobody marked it.
export const rowMarks = (item) => markGroups(item && Array.isArray(item.marks) ? item.marks : []);

// The parts of a row's meta line: «Sube», the topic, «Nos interesa: Beto y Carla», «Descartado: Ana».
export function rowMeta(item) {
  return [...stationMeta(item), ...rowMarks(item)];
}

// A station's marks from the base's rows, so the home can say them again after a mark changes.
export function stationMarks(painId, marks, people) {
  return markGroups(marksOf(painId, Array.isArray(marks) ? marks : [], nameMap(people)));
}

const NUMBER = new Intl.NumberFormat("es");

// The run statuses that read publications. A failed run, or one that only gathered them, reviewed nothing the page can
// count, whatever items_reviewed says.
const REVIEWING = new Set(["complete", "incomplete"]);
// The statuses whose run did not get to review: the empty home says so instead of «Revisamos…».
const UNFINISHED = new Set(["failed", "ingest-only"]);

// How many publications were reviewed and on which topic, or null when the summary does not say or its run did not
// review: { count, topic }. The topic only when it has a plain name.
function reviewed(summary) {
  if (!summary || !REVIEWING.has(summary.status)) return null;
  const count = summary.items_reviewed;
  if (!Number.isInteger(count) || count <= 0) return null;
  const territory = summary.territory;
  return { count, topic: territory !== null && TOPICS.has(territory) ? topicName(territory) : null };
}

const isStale = (notice) => Boolean(notice && notice.kind === "stale");

// The home with no pain to show says it in one sentence: what was reviewed, that none of it brought a pain, and when
// the next review is. With no review at all (no summary, as runNotice reads it), that there is none yet and when the
// first is. After a run that failed or only gathered publications, that it did not finish and so nothing is new.
// Without a count of publications, only that no pain came up. With a stale notice (runNotice) it never says «esta
// semana».
export function emptySentence(summary, notice = null) {
  if (!summary || typeof summary !== "object") return T.emptyNoRun;
  const stale = isStale(notice);
  if (summary && UNFINISHED.has(summary.status)) return stale ? T.emptyUnfinishedLatest : T.emptyUnfinished;
  const seen = reviewed(summary);
  if (!seen) return stale ? T.emptyNoItemsLatest : T.emptyNoItems;
  const key = seen.count === 1 ? (seen.topic ? "emptyReviewedOneTopic" : "emptyReviewedOne")
    : (seen.topic ? "emptyReviewedManyTopic" : "emptyReviewedMany");
  return fill(T[key], { count: NUMBER.format(seen.count), topic: seen.topic ?? "" });
}

// The notice the home shows above its body. An empty home with no review at all drops it: its one sentence already
// says there is none (emptySentence), and the notice would repeat it.
export function homeNotice(notice, { empty = false } = {}) {
  if (!notice) return null;
  return empty && notice.kind === "none" ? null : notice;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_DAYS = 8; // the run is weekly: a day of slack before saying it is old
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

// A calendar day as a number of days, so two days compare without time zones. A Date counts by its local calendar
// day (the reader's today); a "YYYY-MM-DD…" string by its own digits.
function dayNumber(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS;
  }
  const match = typeof value === "string" ? ISO_DAY.exec(value) : null;
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(ms) ? null : ms / DAY_MS;
}

const STATUS_NOTICE = new Map([
  ["failed", "runFailed"],
  ["incomplete", "runIncomplete"],
  ["ingest-only", "runIngestOnly"],
]);
const STALE_NOTICE = new Map([
  ["failed", "runStaleFailed"],
  ["incomplete", "runStaleIncomplete"],
  ["ingest-only", "runStaleIngestOnly"],
]);

// What the reader needs to know about the latest run, or null when it is a complete run of this week. A run older
// than 8 days is said by its date («esta semana» would be false), together with how it ended when it did not end well.
export function runNotice(summary, today = new Date()) {
  if (!summary || typeof summary !== "object") return { kind: "none", text: T.runNone };
  const date = typeof summary.date === "string" ? summary.date.slice(0, 10) : null;
  const runDay = dayNumber(date);
  const todayDay = dayNumber(today);
  if (runDay !== null && todayDay !== null && todayDay - runDay > STALE_AFTER_DAYS) {
    return { kind: "stale", text: fill(T[STALE_NOTICE.get(summary.status) ?? "runStale"], { date: formatDate(date) }) };
  }
  // An incomplete run's list is that run's: the notice says its day. A failed run's list is the last finished run's,
  // whose day week_summary does not give, so it says just that.
  if (summary.status === "incomplete" && runDay !== null) {
    return { kind: "incomplete", text: fill(T.runIncompleteDated, { date: formatDate(date) }) };
  }
  const key = STATUS_NOTICE.get(summary.status);
  return key ? { kind: summary.status, text: T[key] } : null;
}

// The functions that raise 42501 for someone who is not on the list (Task 1's migration, run_traces from the traces'
// migration and set_niche_veto from the niches' one).
const MEMBER_RPCS = new Set(["week_summary", "run_traces", "set_mark", "add_comment", "delete_comment", "set_niche_veto"]);

// What a failed read or write means for the reader. The token is no longer accepted (HTTP 401, PostgREST
// PGRST301/PGRST303): sign in again. 42501 from a function (week_summary, run_traces, set_mark, add_comment,
// delete_comment, set_niche_veto) is the base refusing someone who is not on the list. On a table read (api.js tags
// each one in `source`) it is a lost grant instead, since RLS filters rows and never raises: an error. A fetch that
// never reached the server is the connection.
export function classifyError(error) {
  if (!error || typeof error !== "object") return "other";
  const code = String(error.code ?? "");
  if (error.status === 401 || code === "PGRST301" || code === "PGRST303") return "expired";
  if (code === "42501") return !error.source || MEMBER_RPCS.has(error.source) ? "no-access" : "other";
  if (isNetworkError(error)) return "network";
  return "other";
}

// LIS-04: a list of more than 50 loads by parts, 20 at a time.
export const PAGED_ABOVE = 50;
export const PAGE_SIZE = 20;
export const firstPage = (total) => (total > PAGED_ABOVE ? PAGE_SIZE : total);
export const nextPage = (shown, total) => Math.min(total, shown + PAGE_SIZE);

// ---- tomoshi: the run traces (dolores/scripts/lib/trace.mjs, buildTrace) and the home -------------------------------

const isTrace = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value)
  && typeof value.run_id === "string" && value.run_id);
const traceList = (traces) => (Array.isArray(traces) ? traces.filter(isTrace) : []);
const historyOf = (pain) => (pain && Array.isArray(pain.history) ? pain.history.filter((h) => h && typeof h === "object") : []);
const count = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

// The latest traced run (run_traces() hands them newest first), and whether it is the run week_summary speaks of. When
// this week's run left no trace (it failed early, or only gathered), the home shows the last traced run by its own
// date, never as this week's (Review Focus 2).
export function latestTrace(traces, summary) {
  const [trace = null] = traceList(traces);
  return { trace, isThisWeek: isThisWeeksRun(trace, summary) };
}

// The home's this-week rule: a trace is this week's run when week_summary speaks of that same run. Nichos reads it too.
export function isThisWeeksRun(trace, summary) {
  return Boolean(isTrace(trace) && summary && typeof summary === "object" && summary.run_id === trace.run_id);
}

// A niche's own name, or null when it has none: empty, its id, or its id the way dolores' nicheName writes an id it
// has no name for (dolores/scripts/lib/i18n.mjs: the hyphens as spaces, a capital first letter). The page never shows
// a slug, not even dressed up as a name.
export function ownNicheName(value, id) {
  const name = text(value);
  if (!name || typeof id !== "string" || id === "") return name;
  const words = id.split("-").filter(Boolean).join(" ");
  const humanized = words === "" ? id : words[0].toUpperCase() + words.slice(1);
  return name === id || name === humanized ? null : name;
}

// The lamp beside the brand: how the latest run went. Green complete, red failed, amber anything else: incomplete,
// only gathered, older than 8 days (runNotice), or no run at all. A failed run stays red however old it is.
export function brandLamp(summary, today = new Date()) {
  if (!summary || typeof summary !== "object") return "amber";
  if (summary.status === "failed") return "red";
  if (summary.status !== "complete") return "amber";
  const notice = runNotice(summary, today);
  return notice && notice.kind === "stale" ? "amber" : "green";
}

// A pain's lamp has one meaning, its section: green with weight, amber under watch (or kept by an «interested» mark),
// off when discarded or out.
export function painLamp(section) {
  if (section === "weighty") return "green";
  if (section === "interested" || section === "watching") return "amber";
  return "off";
}

// «Evidencia nueva»: the pain has a history entry from that run.
export function hasNewEvidence(pain, trace) {
  if (!isTrace(trace)) return false;
  return historyOf(pain).some((h) => h.run_id === trace.run_id);
}

// How many complete traced runs a pain may go without showing up before it leaves the home (it stays in Catálogo).
// With fewer traced complete runs than that, the window is these many days before the latest traced run.
export const QUIET_RUNS = 4;
export const QUIET_DAYS = 28;

// Whether a pain that is not alive has gone quiet: none of the last QUIET_RUNS complete traced runs is in its history,
// or, with fewer of them, no history entry dated within QUIET_DAYS before the latest traced run. Without traces (or
// without a date to measure from) nothing is quiet: the page cannot tell.
function quietTest(traces) {
  const complete = traces.filter((t) => t.status === "complete");
  if (complete.length >= QUIET_RUNS) {
    const recent = new Set(complete.slice(0, QUIET_RUNS).map((t) => t.run_id));
    return (pain) => !historyOf(pain).some((h) => recent.has(h.run_id));
  }
  const latestDay = traces.length ? dayNumber(traces[0].date) : null;
  if (latestDay === null) return () => false;
  return (pain) => !historyOf(pain).some((h) => {
    const day = dayNumber(h.date);
    return day !== null && day >= latestDay - QUIET_DAYS;
  });
}

// The pains the latest traced run touched: new in it (its first history entry is that run), in any of its duels, or in
// its final order when the duel was between survivors. And the winner, the first of that order, only then.
function touchedBy(trace) {
  if (!trace) return { touched: () => false, winner: null };
  const ids = new Set();
  for (const duel of Array.isArray(trace.duels) ? trace.duels : []) {
    if (!duel || typeof duel !== "object") continue;
    for (const id of [duel.a, duel.b]) if (typeof id === "string") ids.add(id);
  }
  const survivors = trace.duel_kind === "survivors";
  const ranking = survivors && Array.isArray(trace.ranking) ? trace.ranking.filter((id) => typeof id === "string") : [];
  for (const id of ranking) ids.add(id);
  const isNew = (pain) => {
    const [first] = historyOf(pain);
    return Boolean(first && first.run_id === trace.run_id);
  };
  return { touched: (pain) => ids.has(pain.id) || isNew(pain), winner: ranking[0] ?? null };
}

// The pain that won the trace's duel (touchedBy's winner: the first of a survivors' duel's final order), or null. A
// pain's page asks it of the week's trace to say what the pain's row says: its tag and the duel's line.
export const duelWinner = (trace) => touchedBy(isTrace(trace) ? trace : null).winner;

// «Para decidir»: every alive pain, the pains the latest traced run touched, and the ones marked «Nos interesa». A pain
// leaves when the team discards it (sectionOf is discarded, or null: dead, discarded by hand) or, unless alive or
// touched by the latest run, when it has gone quiet (quietTest), interested or not; it stays in Catálogo. First the
// survivors' duel winner, then the alive ones, then the rest, newest evidence first. Each item is buildSections' row
// plus its section, lamp, whether it has new evidence from the latest run (`fresh`) and whether it won the duel.
export function decideList({ pains = [], cards = [], marks = [], people = [], traces = [] } = {}) {
  const list = (value) => (Array.isArray(value) ? value : []);
  const allMarks = list(marks);
  const names = nameMap(people);
  const runs = traceList(traces);
  const latest = runs[0] ?? null;
  const quiet = quietTest(runs);
  const { touched, winner } = touchedBy(latest);
  const cardOf = new Map(list(cards).filter((row) => row && row.pain_id).map((row) => [row.pain_id, row.card]));
  const items = [];
  for (const pain of list(pains)) {
    if (!pain || !pain.id) continue;
    const section = sectionOf(pain, allMarks);
    if (section === null || section === "discarded") continue;
    const alive = section === "weighty";
    const byRun = touched(pain);
    const interested = effectiveMark(pain.id, allMarks) === "interested";
    if (!alive && !byRun && !(interested && !quiet(pain))) continue;
    const item = itemOf(pain, cardOf.get(pain.id), allMarks, names);
    if (!item) continue;
    const won = pain.id === winner;
    items.push({
      ...item, section, lamp: painLamp(section), fresh: hasNewEvidence(pain, latest), winner: won,
      // The ranked board: the duel's winner and the pains with weight are full stations, the rest compact.
      full: won || section === "weighty",
      facts: stationFacts(pain, cardOf.get(pain.id), { winner: won }),
      // The counts the run judged it by, as stored (analysisRows reads and checks them); null before the gate existed.
      gate: isObject(pain.gate) ? pain.gate : null,
    });
  }
  const rank = (item) => (item.winner ? 0 : item.section === "weighty" ? 1 : 2);
  return items.sort((a, b) => rank(a) - rank(b) || byEvidence(a, b));
}

// Why a station is there, from what the home already read: the testimonies of the pain's latest history entry
// (`inputs.testimonies`, as record-run.mjs writes it), the attacks a version-3 card says it held (null for an older
// card: the page never guesses a result), and, for the survivors' duel winner only, its card's line about the duel it
// won. Anything missing or odd is null.
export function stationFacts(pain, card, { winner = false } = {}) {
  const entries = historyOf(pain);
  let latest = null;
  for (const h of entries) if (!latest || String(h.date ?? "") >= String(latest.date ?? "")) latest = h;
  const inputs = latest && latest.inputs && typeof latest.inputs === "object" ? latest.inputs : null;
  const n = inputs ? inputs.testimonies : null;
  const testimonies = Number.isInteger(n) && n >= 0 ? n : null;
  const ok = card && typeof card === "object";
  const attacks = ok && Array.isArray(card.attacks) ? card.attacks.filter((a) => a && typeof a === "object" && typeof a.held === "boolean") : [];
  const won = winner && ok && Array.isArray(card.duels)
    ? card.duels.find((d) => d && typeof d === "object" && d.won === true && text(d.plain)) : null;
  return {
    testimonies,
    attacks: attacks.length ? { held: attacks.filter((a) => a.held).length, total: attacks.length } : null,
    duelReason: won ? text(won.plain) : null,
  };
}

// A station's facts in words: «5 testimonios», «Resistió 4 de 5 ataques». [] when there is none.
export function stationFactLines(facts) {
  if (!facts || typeof facts !== "object") return [];
  const lines = [];
  const n = facts.testimonies;
  if (Number.isInteger(n)) lines.push(n === 1 ? T.factTestimoniesOne : fill(T.factTestimoniesMany, { count: formatNumber(n) }));
  const a = facts.attacks;
  if (a && Number.isInteger(a.held) && Number.isInteger(a.total) && a.total > 0) {
    lines.push(fill(a.total === 1 ? T.factAttacksOne : T.factAttacks, { held: formatNumber(a.held), total: formatNumber(a.total) }));
  }
  return lines;
}

// The stage of the line each cut kind of the run happened at (i18n.mjs, trace.cut); a cut of the whole run has none.
const CUT_STAGE = new Map([
  ["incomplete-coverage", "read"],
  ["extraction-cap", "analyzed"],
  ["extraction-budget", "analyzed"],
  ["no-quote", "quotes_checked"],
  ["gate-missing", "quotes_checked"],
  ["gate-partial", "quotes_checked"],
  ["candidate-cap", "candidates"],
  ["below-threshold", "attacked"],
  ["missing-verdicts", "attacked"],
  ["duels-unplayed", "duel"],
]);

// A source's lamp and state: red when it failed or brought nothing («No aportó nada»), amber when it came truncated
// («Recortada»), off when the run did not count it, green otherwise.
function sourceState(source) {
  if (source.ok === false) return ["red", "failed"];
  const collected = count(source.collected);
  if (collected === 0) return ["red", "empty"];
  if (source.truncated === true) return ["amber", "truncated"];
  if (collected === null) return ["off", "unknown"];
  return ["green", "ok"];
}

// The run's production line for the page, or null without a trace: one station per stage with its count, cap and lamp
// (off with no count, «sin dato»; amber when the cap was hit or a cut happened there; the first station amber when a
// source came truncated or brought nothing; green otherwise), the sources with their lamp, the cuts in plain words with
// the stage they happened at (`explained` false for one with no plain words of its own: kind `other`, or no text), and
// the run's date. Raw text stays out (sources' `note`, cuts' `original`, duels'
// `reason`): the page shows it only in Corridas' «Detalle técnico», from the trace itself.
export function lineView(trace) {
  if (!isTrace(trace)) return null;
  const sources = (Array.isArray(trace.sources) ? trace.sources : [])
    .filter((s) => s && typeof s === "object")
    .map((s) => {
      const [lamp, state] = sourceState(s);
      return {
        name: text(s.name) ?? "", kind: text(s.kind) ?? "", collected: count(s.collected), kept: count(s.kept),
        available: count(s.available), truncated: s.truncated === true, ok: s.ok !== false, lamp, state,
      };
    });
  const cuts = (Array.isArray(trace.cuts) ? trace.cuts : [])
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const kind = typeof c.kind === "string" ? c.kind : "other";
      const own = kind === "other" ? null : text(c.text);
      return { kind, count: count(c.count), cap: count(c.cap), text: own ?? text(c.text) ?? T.cutOther, explained: own !== null, stage: CUT_STAGE.get(kind) ?? null };
    });
  const cutAt = new Set(cuts.map((c) => c.stage).filter(Boolean));
  const sourcesCut = sources.some((s) => s.lamp === "red" || s.lamp === "amber");
  const stages = (Array.isArray(trace.funnel) ? trace.funnel : [])
    .filter((s) => s && typeof s === "object" && typeof (s.stage ?? s.key) === "string")
    .map((s) => {
      const key = s.stage ?? s.key;
      const n = count(s.count);
      const cap = count(s.cap);
      const hit = (cap !== null && n !== null && n >= cap) || cutAt.has(key) || (key === "collected" && sourcesCut);
      return { key, label: text(s.label) ?? "", count: n, cap, lamp: n === null ? "off" : hit ? "amber" : "green" };
    });
  return { stages, sources, cuts, dateLabel: formatDate(trace.date) };
}

// ---- a pain's judged counts as analysis rows -----------------------------------------------------------------------

const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isCount = (value) => Number.isInteger(value) && value >= 0;
const isThreshold = (value) => Number.isInteger(value) && value > 0;

// A row measured against its threshold. `min`, `max` and `at` are for the box row (js/checks.js): it spans `top` (by
// default twice the threshold), stretched to the threshold or the value when one is past it, so neither falls off it.
// `range` says the minimum in words: «Mínimo 3» unless the row says it otherwise.
function measured(key, label, value, min, at, { top = min * 2, range = fill(T.analysisRange, { n: formatNumber(min) }) } = {}) {
  const inRange = at >= min;
  return {
    key, label, value, range, min, max: Math.max(top, min, at), at,
    flag: inRange ? "in" : "out", flagText: inRange ? T.analysisIn : T.analysisOut,
  };
}

// A pain's gate (dolores' decideStatus, stored on the pain's doc) as the rows its checks are drawn from (checkRows):
// testimonies, source tiers, attacks held, and «Descrito por quien lo sufre» only when the statement is missing. Each
// threshold is the gate's own, so the page says what the run used even if the rules change. Attacks held read out of
// those that answered (gate.verdicts), as dolores' own reason says them, and their boxes span those: «4 de 5» fills 4
// of 5; their minimum is the rule's own, so many held of the attacks the run requires («Mínimo 3 de 5»).
// With fewer answered than the run requires there is no result to judge: the row says how many answered of those
// required, with no flag and no boxes; with none answered it says no attack was evaluated (not «0 de 5», which would
// claim five were sent: none may have been, ever). `note` says when the testimonies were counted within one country
// (dolores' bestCount: not necessarily the one with the most). A missing gate (a pain stored before it existed) or a
// malformed one gives no rows: the page then shows the facts line and never a range claim it cannot back.
export function analysisRows(gate) {
  const none = { rows: [], note: null };
  if (!isObject(gate) || !isObject(gate.thresholds)) return none;
  const { testimonies, tiers, survivals, verdicts, thresholds } = gate;
  if (![testimonies, tiers, verdicts].every(isCount)) return none;
  if (survivals !== null && !isCount(survivals)) return none;
  if (![thresholds.testimonies, thresholds.tiers, thresholds.survivals, thresholds.verdicts].every(isThreshold)) return none;
  const answered = formatNumber(verdicts);
  const required = formatNumber(thresholds.verdicts);
  const attacksRange = fill(T.analysisRangeOf, { n: formatNumber(thresholds.survivals), total: required });
  const attacks = verdicts === 0 || survivals === null
    ? {
      key: "survivals", label: T.analysisSurvivals,
      value: verdicts === 0 ? T.analysisNoAttacks : fill(T.analysisIncomplete, { n: answered, total: required }),
      range: attacksRange, min: null, max: null, at: null, flag: "none", flagText: "",
    }
    : measured("survivals", T.analysisSurvivals, fill(T.analysisHeld, { held: formatNumber(survivals), total: answered }), thresholds.survivals, survivals,
      { top: verdicts, range: attacksRange });
  const rows = [
    measured("testimonies", T.analysisTestimonies, formatNumber(testimonies), thresholds.testimonies, testimonies),
    measured("tiers", T.analysisTiers, formatNumber(tiers), thresholds.tiers, tiers),
    attacks,
  ];
  if (gate.has_statement === false) {
    rows.push({
      key: "statement", label: T.analysisStatement, value: T.analysisMissing, range: "", min: null, max: null, at: null, flag: "out", flagText: T.analysisOut,
    });
  }
  return { rows, note: gate.per_country === true ? T.analysisPerCountry : null };
}

// ---- the checks: each analysis row passed or failed, in a few words -------------------------------------------------

const RESULTS = new Map([["in", "pass"], ["out", "fail"], ["none", "none"]]);

// What a count out of range lacks to reach its threshold («falta 1», «faltan 2»); null when it lacks nothing or has no
// count to say it with (the statement).
function lacking(row) {
  if (row.flag !== "out" || row.at === null) return null;
  const n = row.min - row.at;
  return n === 1 ? T.checkMissingOne : fill(T.checkMissing, { n: formatNumber(n) });
}

// A row's count in a few words: «4 testimonios», «1 tipo de fuente», «4 de 5 ataques» (out of those that answered, as
// the row's value). Attacks with no result say so in the row's own words; the statement says what is missing.
function shortOf(row, verdicts) {
  if (row.key === "statement") return T.checkStatement;
  if (row.flag === "none") return row.value;
  const n = formatNumber(row.at);
  if (row.key === "testimonies") return row.at === 1 ? T.checkTestimoniesOne : fill(T.checkTestimonies, { n });
  if (row.key === "tiers") return row.at === 1 ? T.checkTiersOne : fill(T.checkTiers, { n });
  return verdicts === 1 ? fill(T.checkAttacksOne, { held: n }) : fill(T.checkAttacks, { held: n, total: formatNumber(verdicts) });
}

// A pain's gate as its checks (js/checks.js draws them): each analysis row passes (in range), fails (out of range, or
// the statement missing) or has no result (attacks not all answered). `short` is the row in a few words for a closed
// row, with what it lacks when it fails; `flagText` is the box cell's verdict, with the same lack; `minText` the
// threshold in words. No rows exactly when analysisRows gives none: the page then claims nothing.
export function checkRows(gate) {
  const { rows, note } = analysisRows(gate);
  return {
    rows: rows.map((row) => {
      const lacks = lacking(row);
      const said = (words) => (lacks ? `${words} · ${lacks}` : words);
      return {
        key: row.key, label: row.label, result: RESULTS.get(row.flag), short: said(shortOf(row, gate.verdicts)), value: row.value,
        minText: row.range, min: row.min, max: row.max, at: row.at, flagText: said(row.flagText),
      };
    }),
    note,
  };
}

// ---- tomoshi: the shell, the stations and the line, in words --------------------------------------------------------

// How many of «Para decidir» (decideList) wait for your own mark: the lead's sentence says it, «Esta semana»'s tab shows it.
export function waitingCount(items, marks, email) {
  const me = lower(email);
  const mine = new Set((Array.isArray(marks) ? marks : [])
    .filter((m) => m && MARKS.has(m.mark) && me && lower(m.author) === me).map((m) => m.pain_id));
  return (Array.isArray(items) ? items : []).filter((item) => !mine.has(item.id)).length;
}

// The sentence under «Para decidir»: how many wait for your own mark, and what goes first (decideList's order).
export function decideLead(items, marks, email) {
  const list = Array.isArray(items) ? items : [];
  const pending = waitingCount(list, marks, email);
  const count = pending === 0 ? T.leadNoPending : pending === 1 ? T.leadPendingOne : fill(T.leadPendingMany, { count: formatNumber(pending) });
  const winner = Boolean(list[0] && list[0].winner);
  const weighty = list.some((item) => item.section === "weighty");
  const order = winner && weighty ? T.leadOrderWinnerWeighty : winner ? T.leadOrderWinner : weighty ? T.leadOrderWeighty : "";
  return order ? `${count} ${order}` : count;
}

// A station's tags: the duel's winner (by the run's date when the line is an older run's) and «Evidencia nueva», only
// when the line is this week's: an older run's evidence is not new this week (Review Focus 2).
export function stationTags(item, { isThisWeek = false, dateLabel = "" } = {}) {
  const tags = [];
  if (item && item.winner) tags.push({ kind: "winner", text: isThisWeek || !dateLabel ? T.tagWinner : fill(T.tagWinnerDated, { date: dateLabel }) });
  if (item && item.fresh && isThisWeek) tags.push({ kind: "fresh", text: T.tagFresh });
  return tags;
}

// The line's title and its note, from latestTrace: this week's line; an older run's, by its own date, never as this
// week's (Review Focus 2); or no line, saying why.
export function lineHeading(latest, summary) {
  const trace = latest && latest.trace;
  if (trace && latest.isThisWeek) return { title: T.lineTitle, older: false, note: null };
  if (trace) {
    const date = formatDate(trace.date);
    return { title: date ? fill(T.lineTitleOld, { date }) : T.lineTitleOldUndated, older: true, note: T.lineOlderNote };
  }
  const hasRun = Boolean(summary && typeof summary === "object");
  return { title: T.lineTitle, older: false, note: hasRun ? T.lineNoTrace : T.lineNoRun };
}

const MINUTE_MS = 60 * 1000;
const usd = (value) => {
  const amount = formatUsd(value);
  return amount === null ? null : fill(T.costUsd, { amount });
};

// How long a run took («duró 26 min»), only when both times exist and make sense; null otherwise.
export function runDuration(trace) {
  if (!trace || typeof trace !== "object") return null;
  const start = Date.parse(trace.started_at);
  const end = Date.parse(trace.finished_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const minutes = Math.round((end - start) / MINUTE_MS);
  if (minutes < 1) return T.durationShort;
  if (minutes < 60) return fill(T.durationMinutes, { minutes });
  return fill(T.durationHours, { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

const costOf = (trace) => (trace && trace.cost && typeof trace.cost === "object" ? trace.cost : {});

// The line under the line's title: «4 de febrero», «10 pasos» (with `steps`, how many the line has), «duró 26 min»,
// «1,50 USD». What the trace does not say is left out.
export function runFacts(trace, { steps = 0 } = {}) {
  if (!isTrace(trace)) return [];
  const stepsText = Number.isInteger(steps) && steps > 0 ? (steps === 1 ? T.lineStepsOne : fill(T.lineSteps, { count: formatNumber(steps) })) : null;
  return [formatDayMonth(trace.date), stepsText, runDuration(trace), usd(costOf(trace).total_usd)].filter(Boolean);
}

// The cost by model, then the cards, as the line's foot.
export function costRows(trace) {
  if (!isTrace(trace)) return [];
  const cost = costOf(trace);
  const rows = (Array.isArray(cost.by_model) ? cost.by_model : [])
    .filter((m) => m && typeof m === "object" && text(m.model) && usd(m.usd))
    .map((m) => ({ label: text(m.model), value: usd(m.usd) }));
  const cards = usd(cost.cards_usd);
  return cards ? [...rows, { label: T.costCards, value: cards }] : rows;
}

// The week's data at the masthead's right: the week, the niche and the cost. The run's own niche and cost only come
// from this week's trace; otherwise the niche is the summary's topic by its plain name, and there is no cost.
export function weekMeta(summary, latest) {
  if (!summary || typeof summary !== "object") return [];
  const trace = latest && latest.isThisWeek ? latest.trace : null;
  const niche = (trace && trace.niche && ownNicheName(trace.niche.name, trace.niche.id))
    ?? (typeof summary.territory === "string" && TOPICS.has(summary.territory) ? topicName(summary.territory) : null);
  return [
    { label: T.metaWeek, value: formatDayMonth(typeof summary.date === "string" ? summary.date.slice(0, 10) : null) },
    { label: T.metaNiche, value: niche },
    { label: T.metaCost, value: trace ? usd(costOf(trace).total_usd) : null },
  ].filter((row) => row.value);
}

// The brand lamp's state in two or three words (brandLamp, told apart): complete, failed, old, none, or half done.
export function brandLampShort(summary, today = new Date()) {
  if (!summary || typeof summary !== "object") return T.brandShortNone;
  const color = brandLamp(summary, today);
  if (color === "green") return T.brandShortComplete;
  if (color === "red") return T.brandShortFailed;
  return summary.status === "complete" ? T.brandShortOld : T.brandShortPartial;
}

const BRAND_LAMP_TEXT = { green: "brandLampGreen", red: "brandLampRed" };
// The brand lamp's state in words (brandLamp), for a screen reader and the pointer's tooltip.
export const brandLampText = (lamp) => T[BRAND_LAMP_TEXT[lamp] ?? "brandLampAmber"];

const STAGE_STATE = { green: "stageOk", amber: "stageCut", off: "stageNoData" };
// A station of the line in words: its lamp's state, its cap, and the cuts that happened there (lineView).
export function stageNotes(stage, cuts) {
  const notes = [];
  if (stage.cap !== null && stage.cap !== undefined) notes.push(fill(T.stageCap, { cap: formatNumber(stage.cap) }));
  for (const cut of Array.isArray(cuts) ? cuts : []) if (cut && cut.stage === stage.key && cut.text) notes.push(cut.text);
  return { state: T[STAGE_STATE[stage.lamp] ?? "stageNoData"], notes };
}

const SOURCE_STATE = { ok: "sourceOk", truncated: "sourceTruncated", empty: "sourceEmpty", failed: "sourceFailed", unknown: "sourceUnknown" };
// A source's figures: «72 → 64» (gathered, then kept), «de 1830» when more were there, and its state in words.
export function sourceFigures(source) {
  const { collected, kept, available } = source;
  const figure = collected === null ? null
    : kept !== null && kept !== collected ? `${formatNumber(collected)} → ${formatNumber(kept)}` : formatNumber(collected);
  const of = collected !== null && available !== null && available > collected ? fill(T.sourceOf, { available: formatNumber(available) }) : null;
  return { figure, of, state: T[SOURCE_STATE[source.state] ?? "sourceUnknown"] };
}
