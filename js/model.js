// The home's logic, without the DOM or the network: which section each pain goes in, the sentence that sums up the
// week, the notice about the run, and what kind of failure a read was. Pure, so tests/unit/model.test.mjs runs it in
// Node.

import { T, TOPICS, fill, topicName, formatDate } from "./text.js";
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

const TREND_LABEL = new Map([["new", "trendNew"], ["rising", "trendRising"], ["falling", "trendFalling"], ["steady", "trendSteady"]]);
const MARK_LABEL = [["interested", "markInterested"], ["discarded", "markDiscarded"]];
const NAMES = new Intl.ListFormat("es", { style: "long", type: "conjunction" });

// The parts of a row's meta line: «Sube», the topic, «Nos interesa: Jaime y Miguel», «Descartado: Fabio».
export function rowMeta(item) {
  const trend = TREND_LABEL.get(item.trend && item.trend.direction);
  const marks = MARK_LABEL
    .map(([mark, key]) => [key, item.marks.filter((m) => m.mark === mark).map((m) => m.name)])
    .filter(([, names]) => names.length)
    .map(([key, names]) => fill(T.markedBy, { mark: T[key], names: NAMES.format(names) }));
  return [trend ? T[trend] : null, item.topic, ...marks].filter(Boolean);
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

// «Esta semana hay 1 dolor con peso para trabajar. Revisamos 480 publicaciones sobre «…».» The second sentence needs a
// count of publications from a run that reviewed them; the topic only when it has a plain name. With `past` (this
// week's run failed or stayed incomplete, which the notice above names) the first sentence speaks of that run: «En esa
// revisión hubo…». With `latest` (an old run, or this week's that only gathered publications) it speaks of the last
// review: «En la última revisión hubo…».
const FIRST_SENTENCE = {
  week: ["weekNone", "weekOne", "weekMany"],
  past: ["pastNone", "pastOne", "pastMany"],
  latest: ["lastNone", "lastOne", "lastMany"],
};
export function weekSentence(summary, counts = {}) {
  const weighty = Number.isInteger(counts && counts.weighty) && counts.weighty > 0 ? counts.weighty : 0;
  const [none, one, many] = FIRST_SENTENCE[counts && counts.past ? "past" : counts && counts.latest ? "latest" : "week"];
  const first = weighty === 0 ? T[none] : weighty === 1 ? T[one] : fill(T[many], { count: NUMBER.format(weighty) });
  const seen = reviewed(summary);
  if (!seen) return first;
  const key = seen.count === 1 ? (seen.topic ? "reviewedOneTopic" : "reviewedOne") : (seen.topic ? "reviewedManyTopic" : "reviewedMany");
  return `${first} ${fill(T[key], { count: NUMBER.format(seen.count), topic: seen.topic ?? "" })}`;
}

// Which run the home's sentence speaks of, from the notice about the run (runNotice): «past» for this week's run that
// failed or stayed incomplete (the notice names it); «latest» for any run more than 8 days old, whatever its status
// («esta semana» would be false), and for this week's run that only gathered publications (it reviewed nothing); null
// for this week's complete run.
export function sentenceTense(notice) {
  if (!notice) return null;
  if (notice.kind === "failed" || notice.kind === "incomplete") return "past";
  if (notice.kind === "stale" || notice.kind === "ingest-only") return "latest";
  return null;
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

// The home whose pains are all discarded points to them, without «esta semana» whenever the week's run did not end
// well (sentenceTense is not null: failed, incomplete, ingest-only or stale).
export function onlyDiscardedSentence(notice = null) {
  return sentenceTense(notice) ? T.homeOnlyDiscardedLatest : T.homeOnlyDiscarded;
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

// The functions that raise 42501 for someone who is not on the list (Task 1's migration).
const MEMBER_RPCS = new Set(["week_summary", "set_mark", "add_comment", "delete_comment"]);

// What a failed read or write means for the reader. The token is no longer accepted (HTTP 401, PostgREST
// PGRST301/PGRST303): sign in again. 42501 from a function (week_summary, set_mark, add_comment, delete_comment) is
// the base refusing someone who is not on the list. On a table read (api.js tags each one in `source`) it is a lost
// grant instead, since RLS filters rows and never raises: an error. A fetch that never reached the server is the
// connection.
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


