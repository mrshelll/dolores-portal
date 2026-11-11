// The page's reads and writes on Supabase. The client comes in as a parameter, so tests pass a fake one and never load
// the CDN. RLS lets only people on the list read these tables; week_summary(), set_mark(), add_comment() and
// delete_comment() refuse anyone else with 42501. The writes go only through those three functions.

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

// { summary, pains, cards, marks, people }. summary is null when there is no run yet. Every read starts at once; the
// first one refused rejects the whole load (a fetch that fails rejects as it is). Each pain brings `team_discard` from
// its doc, so the page can place a team discard whose marks are gone (model.js, buildSections).
export async function loadHome(client) {
  const [summary, pains, cards, marks, people] = await Promise.all([
    client.rpc("week_summary"),
    client.from("pains").select("id,territory,status,team_discard:doc->team_discard"),
    client.from("pain_cards").select("pain_id,kind,card"),
    client.from("marks").select("*"),
    client.from("people").select("*"),
  ]);
  const sources = ["week_summary", "pains", "pain_cards", "marks", "people"];
  [summary, pains, cards, marks, people].forEach((result, i) => {
    if (result.error) throw refused(result.error, result.status, sources[i]);
  });
  const week = Array.isArray(summary.data) ? summary.data[0] : summary.data;
  return {
    summary: week && typeof week === "object" ? week : null,
    pains: rows(pains.data),
    cards: rows(cards.data),
    marks: rows(marks.data),
    people: rows(people.data),
  };
}

const PAIN_COLUMNS = "id,territory,status,team_discard:doc->team_discard";

// One pain for its detail: { pain, card, marks, comments, people }, or null when the pain is not in the base, has no
// card, or its card has nothing to title it (the same pains the home leaves out). Every read starts at once; the first
// one refused rejects, tagged with its table. Comments come in any order: detail.js sorts them.
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
  return { pain, card, marks: rows(marks.data), comments: rows(comments.data), people: rows(people.data) };
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
