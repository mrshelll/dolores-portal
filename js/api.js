// The page's reads and writes on Supabase. The client comes in as a parameter, so tests pass a fake one and never load
// the CDN. RLS lets only people on the list read these tables; week_summary(), run_traces(), set_mark(), add_comment()
// and delete_comment() refuse anyone else with 42501. The writes go only through those three functions.

import { cardTitle } from "./detail.js";

// A refused read becomes a thrown error that keeps the PostgREST code and the HTTP status, which classifyError (model.js)
// needs: a 401 lives on the response, not on the error.
// `source` says which read or write it was: a 42501 means «no access» only from a function (see classifyError).
function refused(error, status, source) {
  const out = new Error(String(error.message || "request failed"));
  out.code = error.code ?? "";
  out.details = error.details ?? null;
  out.status = status;
  out.source = source;
  return out;
}

const rows = (data) => (Array.isArray(data) ? data : []);

// week_summary() answers one row, as a list or alone; null when there is no run yet.
const weekOf = (data) => {
  const week = Array.isArray(data) ? data[0] : data;
  return week && typeof week === "object" ? week : null;
};

const objects = (data) => (Array.isArray(data) ? data.filter((row) => row && typeof row === "object" && !Array.isArray(row)) : []);

// The run traces (run_traces(), member-only like week_summary), newest first as the base orders them. The home needs
// the latest few; Corridas shows a year, the most the function hands out.
const HOME_TRACES = 12;
const RUNS_TRACES = 52;
const readTraces = (client, limit) => client.rpc("run_traces", { p_limit: limit });

// The traces only draw the week's line, so on the home and the masthead a run_traces that fails for any other reason
// (a timeout, a missing function, a failed fetch) gives no traces, and the page says the run left none. Refused (42501)
// or an expired session stops the screen as every other read does.
const STOPS = new Set(["42501", "PGRST301", "PGRST303"]);
// supabase-js's builder is only a thenable (it has no catch): the read goes through then.
const traceRead = (client, limit) => Promise.resolve(readTraces(client, limit)).then((result) => result, () => ({ status: 0, error: null, data: [] }));
function tracesOf(result) {
  if (!result.error) return objects(result.data);
  if (result.status === 401 || STOPS.has(String(result.error.code ?? ""))) throw refused(result.error, result.status, "run_traces");
  return [];
}

// { summary, pains, cards, marks, people, traces }. summary is null when there is no run yet; traces is [] when no run
// left one, or when run_traces failed for a reason other than refused or expired (tracesOf). Every read starts at once;
// the first one refused rejects the whole load (a fetch that fails rejects as it is). Each pain brings `team_discard` from its doc, so the page can place a team discard whose marks are gone
// (model.js, buildSections), its `history`, so the home can tell which pains the latest run touched (decideList), and
// its `gate`, the counts the run judged it by (model.js, analysisRows); a pain stored before the gate existed has none.
export async function loadHome(client) {
  const [summary, pains, cards, marks, people, traces] = await Promise.all([
    client.rpc("week_summary"),
    client.from("pains").select("id,territory,status,team_discard:doc->team_discard,history:doc->history,gate:doc->gate"),
    client.from("pain_cards").select("pain_id,kind,card"),
    client.from("marks").select("*"),
    client.from("people").select("*"),
    traceRead(client, HOME_TRACES),
  ]);
  const sources = ["week_summary", "pains", "pain_cards", "marks", "people"];
  [summary, pains, cards, marks, people].forEach((result, i) => {
    if (result.error) throw refused(result.error, result.status, sources[i]);
  });
  return {
    summary: weekOf(summary.data),
    pains: rows(pains.data),
    cards: rows(cards.data),
    marks: rows(marks.data),
    people: rows(people.data),
    traces: tracesOf(traces),
  };
}

// Only what the masthead needs on a screen that does not load the home (a pain, Corridas): the week's summary and the
// latest trace, { summary, traces }, the same shapes loadHome gives. The first one refused rejects; run_traces as in
// loadHome.
export async function loadWeek(client) {
  const [summary, traces] = await Promise.all([client.rpc("week_summary"), traceRead(client, 1)]);
  if (summary.error) throw refused(summary.error, summary.status, "week_summary");
  return { summary: weekOf(summary.data), traces: tracesOf(traces) };
}

// The traces for Corridas, newest first; [] when no run left one.
export async function loadRuns(client) {
  const result = await readTraces(client, RUNS_TRACES);
  if (result.error) throw refused(result.error, result.status, "run_traces");
  return objects(result.data);
}

// A pain's detail also brings its quotes and the attacks' verdicts, for «Cómo llegamos a este dolor», and its gate, for
// the analysis table (model.js, analysisRows).
const PAIN_COLUMNS = "id,territory,status,team_discard:doc->team_discard,evidence:doc->evidence,verdicts:doc->verdicts,gate:doc->gate";

// The pain ids a card's duels name (dolores/scripts/lib/cards.mjs, PAIN_ID), each once, never the pain's own.
const RIVAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
function rivalIds(card, ownId) {
  const duels = Array.isArray(card.duels) ? card.duels : [];
  const ids = duels.map((d) => (d && typeof d === "object" ? d.against : null))
    .filter((id) => typeof id === "string" && RIVAL_ID.test(id) && id !== ownId);
  return [...new Set(ids)];
}

// The duel rivals' titles (their card's line.title, or its what_hurts for a version-1 card with no title, as the home
// titles it), by id, in one read; only those asked for and with something to name them. The titles only name the
// rivals, so a failed read never holds the pain up: the page names them in plain words instead.
const TITLES_SELECT = "pain_id,title:card->line->>title,what_hurts:card->line->>what_hurts";
const filled = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
async function rivalTitles(client, ids) {
  const titles = new Map();
  if (!ids.length) return titles;
  let result;
  try { result = await client.from("pain_cards").select(TITLES_SELECT).in("pain_id", ids); }
  catch { return titles; }
  if (!result || result.error) return titles;
  const wanted = new Set(ids);
  for (const row of rows(result.data)) {
    if (!row || !wanted.has(row.pain_id)) continue;
    const title = filled(row.title) ?? filled(row.what_hurts);
    if (title) titles.set(row.pain_id, title);
  }
  return titles;
}

// The titles of the pains a run's duels name (Corridas), by id, in one read: the same read as a pain's rivals. Only
// valid ids, each once; a failed read gives no titles, and the page names the pains in plain words instead.
export function loadTitles(client, ids) {
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && RIVAL_ID.test(id)))];
  return rivalTitles(client, wanted);
}

// One pain for its detail: { pain, card, marks, comments, people, titles }, or null when the pain is not in the base,
// has no card, or its card has nothing to title it (the same pains the home leaves out). Every read starts at once; the
// first one refused rejects, tagged with its table. Comments come in any order: detail.js sorts them. A card with duels
// then reads its rivals' titles (`titles`, a Map by pain id), so a pain opened from the Monday email names them too.
export async function loadPain(client, id) {
  const [pains, cards, marks, comments, people] = await Promise.all([
    client.from("pains").select(PAIN_COLUMNS).eq("id", id),
    client.from("pain_cards").select("pain_id,kind,card").eq("pain_id", id),
    client.from("marks").select("*").eq("pain_id", id),
    client.from("comments").select("*").eq("pain_id", id),
    client.from("people").select("*"),
  ]);
  const sources = ["pains", "pain_cards", "marks", "comments", "people"];
  [pains, cards, marks, comments, people].forEach((result, i) => {
    if (result.error) throw refused(result.error, result.status, sources[i]);
  });
  const pain = rows(pains.data).find((row) => row && row.id === id);
  const cardRow = rows(cards.data).find((row) => row && row.pain_id === id);
  const card = cardRow && cardRow.card && typeof cardRow.card === "object" ? cardRow.card : null;
  if (!pain || !card || !cardTitle(card)) return null;
  const titles = await rivalTitles(client, rivalIds(card, id));
  return { pain, card, marks: rows(marks.data), comments: rows(comments.data), people: rows(people.data), titles };
}

async function call(client, name, args) {
  const result = await client.rpc(name, args);
  if (result.error) throw refused(result.error, result.status, name);
  return result.data;
}

// The caller's mark on a pain; null removes it. The author is always the caller's JWT email, set by the base.
export async function setMark(client, painId, mark) {
  await call(client, "set_mark", { p_pain_id: painId, p_mark: mark });
}

// Adds a comment and returns its id. The base trims the body and refuses an empty or over-500 one with 22023.
export function addComment(client, painId, body) {
  return call(client, "add_comment", { p_pain_id: painId, p_body: body });
}

// Deletes one of the caller's comments; P0002 when it is gone or not theirs.
export async function deleteComment(client, id) {
  await call(client, "delete_comment", { p_id: id });
}
