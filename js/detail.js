// A pain's detail, without the DOM or the network: its title and status tag, the key data under the title, which card
// sections it has, its quotes, the marks and comments as lines to show, what a failed write means, and the comment kept
// across a lost session. Pure, so tests/unit/detail.test.mjs runs it in Node.

import { T, fill, topicName, formatDate, sourceName } from "./text.js";
import { sectionOf, classifyError, nameMap, nameOf, effectiveMark } from "./model.js";

const MARKS = new Set(["interested", "discarded"]);
const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
const lower = (value) => String(value ?? "").trim().toLowerCase();
const object = (value) => (value && typeof value === "object" ? value : null);

// Pressing the mark you already have clears it; pressing the other one switches to it. An unknown button changes
// nothing.
export function nextMark(current, pressed) {
  const now = MARKS.has(current) ? current : null;
  if (!MARKS.has(pressed)) return now;
  return pressed === now ? null : pressed;
}

// The h1: the line's title, or what hurts on a card from before titles (version 1). null when there is neither, and
// then the pain is shown as having no card.
export function cardTitle(card) {
  const line = object(card) && object(card.line);
  return line ? text(line.title) ?? text(line.what_hurts) : null;
}

// The section the home puts the pain in (model.js, sectionOf), so the tag and the list never disagree. null when the
// home leaves it out.
export function painStatus(pain, marks) {
  return sectionOf(pain, Array.isArray(marks) ? marks : []);
}

const STATUS = { weighty: "statusWeighty", watching: "statusWatching", interested: "statusInterested", discarded: "statusDiscarded" };
export const statusLabel = (status) => (Object.hasOwn(STATUS, status ?? "") ? T[STATUS[status]] : null);

const TREND = { new: "trendNew", rising: "trendRising", falling: "trendFalling", steady: "trendSteady" };

// The key data under the title (DET-01, DET-12): how it is going, the latest evidence, the topic and, when it has been
// seen more than once, in how many runs. `alone` says the value reads without its label, so on a phone the label can
// go (DET-12); the date and the runs keep theirs. What the card cannot say is left out; the topic always stands.
export function keyData(pain, card) {
  const trend = object(object(card) && card.trend) ?? {};
  const items = [];
  if (Object.hasOwn(TREND, trend.direction ?? "")) items.push({ label: T.keyTrend, value: T[TREND[trend.direction]], alone: true });
  const date = typeof trend.last_evidence === "string" ? formatDate(trend.last_evidence) : "";
  if (date) items.push({ label: T.keyEvidence, value: date, alone: false });
  items.push({ label: T.keyTopic, value: topicName(object(pain) ? pain.territory : undefined), alone: true });
  if (Number.isInteger(trend.runs) && trend.runs > 1) {
    items.push({ label: T.keyRuns, value: fill(T.keyRunsValue, { count: trend.runs }), alone: false });
  }
  return items;
}

// The base checks 1 to 500 characters after trimming (char_length, so a character outside the BMP counts once).
export const COMMENT_MAX = 500;
export const commentLength = (value) => [...(typeof value === "string" ? value.trim() : "")].length;

export function validComment(value) {
  const length = commentLength(value);
  if (length === 0) return { ok: false, error: "empty", length };
  if (length > COMMENT_MAX) return { ok: false, error: "too-long", length };
  return { ok: true, error: null, length };
}

// Only a web address goes in a link: never javascript:, data: or a relative path.
export function safeUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

// ---- «Cómo llegamos a este dolor»: the quotes by source, the attacks and the duels -----------------------------------

// Quotes shown per source before «Ver más».
export const QUOTES_SHOWN = 3;
const LANGUAGE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
const time = (value) => {
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(ms) ? -Infinity : ms;
};

// The pain's evidence (pains.doc.evidence) grouped by source, each source by the run's name and kind (sourceName), its
// quotes verbatim and in their language, newest first, with their day and a link only to a web address (safeUrl). The
// sources go by their newest quote. `shown` quotes are shown and `more` wait for «Ver más». The same words from the same
// address count once; nothing internal (tier, hash) is passed on.
export function evidenceBySource(evidence, { limit = QUOTES_SHOWN } = {}) {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : QUOTES_SHOWN;
  const groups = new Map();
  (Array.isArray(evidence) ? evidence : []).forEach((item, order) => {
    if (!object(item)) return;
    const quote = text(item.quote);
    if (!quote) return;
    const { name, kind } = sourceName(item.source, item.country);
    if (!groups.has(name)) groups.set(name, { source: name, kind, items: [], seen: new Set() });
    const group = groups.get(name);
    const url = safeUrl(item.url);
    const key = `${url}\n${quote}`;
    if (group.seen.has(key)) return;
    group.seen.add(key);
    const language = typeof item.language === "string" && LANGUAGE.test(item.language.trim()) ? item.language.trim() : null;
    group.items.push({ at: time(item.date), order, quote: { quote, date: typeof item.date === "string" ? formatDate(item.date) : "", url, language } });
  });
  return [...groups.values()]
    .map((group) => {
      const items = group.items.sort((a, b) => b.at - a.at || a.order - b.order);
      return { source: group.source, kind: group.kind, newest: items[0].at, quotes: items.map((i) => i.quote) };
    })
    .sort((a, b) => b.newest - a.newest || a.source.localeCompare(b.source, "es", { sensitivity: "base" }))
    .map(({ source, kind, quotes }) => ({ source, kind, quotes, shown: Math.min(cap, quotes.length), more: Math.max(0, quotes.length - cap) }));
}

// The five attacks in the order the run makes them, each by its question in plain words. A lens the page does not know
// asks «Otra pregunta», after the five.
const LENSES = new Map([
  ["existing-solution", "lensExistingSolution"],
  ["evidence", "lensEvidence"],
  ["buyer", "lensBuyer"],
  ["root-cause", "lensRootCause"],
  ["feasibility", "lensFeasibility"],
]);
const LENS_ORDER = [...LENSES.keys()];
const lensRank = (lens) => (LENSES.has(lens) ? LENS_ORDER.indexOf(lens) : LENS_ORDER.length);
const attackRow = (lens, held, plain) => ({
  question: LENSES.has(lens) ? T[LENSES.get(lens)] : T.lensOther, held, result: held ? T.attackHeld : T.attackRefuted, plain,
});

// Run ids are a date and a counter: 2026-11-16-10 comes after 2026-11-16-9 (the run's own order, lib/cards.mjs).
const RUN_ORDER = new Intl.Collator("en", { numeric: true });

// The lens and its outcome from the verdicts of the pain's latest run (the greatest run_id; a verdict with no run
// belongs to none). A lens repeated within the run keeps its last verdict. Only `lens` and `refuted` are read: the
// verdict's argument is raw text and never reaches the page.
function latestVerdicts(pain) {
  const verdicts = (object(pain) && Array.isArray(pain.verdicts) ? pain.verdicts : [])
    .filter((v) => object(v) && text(v.run_id) && text(v.lens));
  const latest = verdicts.map((v) => v.run_id).sort(RUN_ORDER.compare).at(-1);
  const byLens = new Map();
  for (const v of verdicts) if (v.run_id === latest) byLens.set(v.lens, v.refuted !== true);
  return byLens;
}

// The attacks of the pain's latest run: [{ question, held, result, plain }], in the run's order. A version 3 card says
// them with a plain line each (card.attacks); an older card has none, so they come from the verdicts with `plain: null`
// and the page shows only the question and «Resistió» / «Lo tumbó» (Review Focus 4). An entry that does not say
// whether it held is left out: the page never guesses a result.
export function attackRows(card, pain) {
  const byLens = new Map();
  if (object(card) && Array.isArray(card.attacks)) {
    for (const a of card.attacks) {
      if (object(a) && text(a.lens) && typeof a.held === "boolean") byLens.set(a.lens, { held: a.held, plain: text(a.plain) });
    }
  } else {
    for (const [lens, held] of latestVerdicts(pain)) byLens.set(lens, { held, plain: null });
  }
  return [...byLens]
    .sort(([a], [b]) => lensRank(a) - lensRank(b) || (a < b ? -1 : a > b ? 1 : 0))
    .map(([lens, { held, plain }]) => attackRow(lens, held, plain));
}

// A pain's title by its id, from the cards the page has loaded (the home's or Catálogo's).
export function titleMap(cards) {
  const titles = new Map();
  for (const row of Array.isArray(cards) ? cards : []) {
    if (!object(row) || typeof row.pain_id !== "string") continue;
    const title = cardTitle(row.card);
    if (title) titles.set(row.pain_id, title);
  }
  return titles;
}

function titleOf(titles, id) {
  if (typeof id !== "string") return null;
  if (titles instanceof Map) return text(titles.get(id));
  return object(titles) && Object.hasOwn(titles, id) ? text(titles[id]) : null;
}

// Every duel the pain played in its latest run (card.duels, version 3), in the run's order: [{ againstTitle, known, won,
// result, plain }]. The rival goes by its title when the page has it (titles: a Map or an object by pain id), otherwise
// as «otro dolor del catálogo»: never by its id. A duel that does not say who won is left out; the duel's reason is
// raw text and is never read.
export function duelRows(card, titles) {
  const duels = object(card) && Array.isArray(card.duels) ? card.duels : [];
  return duels
    .filter((d) => object(d) && typeof d.won === "boolean")
    .map((d) => {
      const title = titleOf(titles, d.against);
      return {
        againstTitle: title ?? T.duelOtherPain, known: Boolean(title), won: d.won, result: d.won ? T.duelWon : T.duelLost, plain: text(d.plain),
      };
    });
}

// «Cómo llegamos a este dolor»: { sources, attacks, duels }, or null when there is nothing to tell (then the page leaves
// the section out).
export function howWeGot(card, pain, titles) {
  const view = {
    sources: evidenceBySource(object(pain) ? pain.evidence : null),
    attacks: attackRows(card, pain),
    duels: duelRows(card, titles),
  };
  return view.sources.length || view.attacks.length || view.duels.length ? view : null;
}

// A quote is shown in the card's language (its translation). The original goes under «Texto original» only when it
// differs: a quote already in the card's language has the same text in both.
export function quoteView(quote) {
  if (!object(quote)) return null;
  const translation = text(quote.translation);
  const original = text(quote.original);
  const shown = translation ?? original;
  if (!shown) return null;
  return { text: shown, original: translation && original && original !== translation ? original : null, url: safeUrl(quote.url) };
}

const paragraphs = (...values) => values.map(text).filter(Boolean);

// The card's sections, in the brief's order, each { id, title, paragraphs, quotes?, glossary? }. The id is the anchor
// of the index. A section with nothing to say is left out; «Comentarios» is always last (the team's marks go with the
// actions, and who suffers it under the title, so neither is a section). Nothing internal (sources, the risk's lens) is
// passed on. A «full» card without its full part reads as a line card.
export function cardSections(card) {
  const line = object(object(card) && card.line) ?? {};
  const full = object(card) && card.kind === "full" ? object(card.full) : null;
  const sections = [];
  const add = (id, title, section) => sections.push({ id, title, paragraphs: [], ...section });
  if (!full) {
    add("dolor", T.secWhatHurts, { paragraphs: paragraphs(line.what_hurts) });
  } else {
    add("dolor", T.secWhatHurts, { paragraphs: paragraphs(full.what_hurts ?? line.what_hurts) });
    add("comprador", T.secBuyer, { paragraphs: paragraphs(object(full.buyer)?.text) });
    add("solucion", T.secSolution, { paragraphs: paragraphs(object(full.solution)?.text) });
    const whyReal = object(full.why_real) ?? {};
    const quotes = (Array.isArray(whyReal.quotes) ? whyReal.quotes : []).map(quoteView).filter(Boolean);
    add("pruebas", T.secWhyReal, { paragraphs: paragraphs(whyReal.text), quotes });
    add("validar", T.secValidate, { paragraphs: paragraphs(full.validate) });
    add("riesgo", T.secRisk, { paragraphs: paragraphs(object(full.risk)?.text) });
    add("equipo", T.secTeamView, { paragraphs: paragraphs(full.team_view) });
    const glossary = (Array.isArray(full.glossary) ? full.glossary : [])
      .filter((g) => object(g) && text(g.term) && text(g.meaning))
      .map((g) => ({ term: text(g.term), meaning: text(g.meaning) }));
    add("glosario", T.secGlossary, { glossary });
  }
  const filled = sections.filter((s) => s.paragraphs.length || (s.quotes && s.quotes.length) || (s.glossary && s.glossary.length));
  filled.push({ id: "comentarios", title: T.commentsTitle, paragraphs: [] });
  return filled;
}

// Is it a line card? Then the page says it only has this summary (EST-06).
export const isLineCard = (card) => !(object(card) && card.kind === "full" && object(card.full));

const MARK_TEXT = { interested: "markInterested", discarded: "markDiscarded" };

// One line per person, by name: «Beto: Nos interesa · 10 nov 2026». Unknown marks are skipped.
export function markLines(marks, people) {
  const names = nameMap(people);
  return (Array.isArray(marks) ? marks : [])
    .filter((m) => object(m) && MARKS.has(m.mark))
    .map((m) => {
      const name = nameOf(names, m.author);
      const date = typeof m.created_at === "string" ? formatDate(m.created_at) : "";
      const params = { name, mark: T[MARK_TEXT[m.mark]], date };
      return { name, mark: m.mark, text: fill(date ? T.markLineDated : T.markLine, params) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

// Comments, newest first (ties by the newest id), each with its author's name, its day and whether it is yours: its
// author is your session email, ignoring case. The body is passed on as it came; it reaches the DOM as text.
export function commentItems(comments, people, email) {
  const names = nameMap(people);
  const me = lower(email);
  const time = (c) => {
    const ms = Date.parse(c.created_at);
    return Number.isNaN(ms) ? -Infinity : ms;
  };
  return (Array.isArray(comments) ? comments : [])
    .filter((c) => object(c) && c.id !== null && c.id !== undefined && typeof c.body === "string")
    .sort((a, b) => time(b) - time(a) || Number(b.id) - Number(a.id))
    .map((c) => ({
      id: c.id,
      name: nameOf(names, c.author),
      body: c.body,
      date: typeof c.created_at === "string" ? formatDate(c.created_at) : "",
      own: me !== "" && lower(c.author) === me,
    }));
}

// The note after your discard. Only a pain effectively discarded (the tag's placement, painStatus) is dropped by the
// run; when someone else keeps it with «Nos interesa», the note says so instead of promising it goes away.
export function discardNote(pain, marks) {
  return painStatus(pain, marks) === "discarded" ? T.discardedNote : T.discardedKept;
}

// The mark buttons, on a row of the home and on a pain's page: «Nos interesa» and «Descartar», or how to undo your own
// mark. They say what pressing them does, so they carry no aria-pressed (the label already changes).
export function stationButtonLabels(mine) {
  return {
    interested: mine === "interested" ? T.unmarkInterestedAction : T.stationInterested,
    discard: mine === "discarded" ? T.unmarkDiscardAction : T.markDiscardAction,
  };
}

// A station's state in words, beside its lamp. A pain that just left every section (its last «interested» mark removed
// from a pain the run no longer keeps) still says where it stands, so no lamp goes without its state.
export const stationStateText = (section) => statusLabel(section) ?? T.statusOut;

// Your own mark in words, under the buttons: «Marcaste «Nos interesa» el 10 nov 2026.» or «Lo descartaste el …». null
// when you have none. Your mark is the one whose author is your email, ignoring case.
export function ownMarkLine(marks, email) {
  const me = lower(email);
  if (!me) return null;
  const own = (Array.isArray(marks) ? marks : []).find((m) => object(m) && MARKS.has(m.mark) && lower(m.author) === me);
  if (!own) return null;
  const date = typeof own.created_at === "string" ? formatDate(own.created_at) : "";
  const [dated, undated] = own.mark === "interested" ? ["ownInterested", "ownInterestedUndated"] : ["ownDiscarded", "ownDiscardedUndated"];
  return date ? fill(T[dated], { date }) : T[undated];
}

// The line card's notice: once someone keeps the pain with «Nos interesa» (the run's effective mark), the next review
// writes its full card, so the notice says that instead of «Si lo marcas…».
export function lineNoticeText(pain, marks) {
  const id = object(pain) ? pain.id : null;
  return id && effectiveMark(id, Array.isArray(marks) ? marks : []) === "interested" ? T.lineNoticeMarked : T.lineNotice;
}

// What a failed mark says. A pain gone (P0002) says the mark was not saved and offers the way back to the list.
export function markErrorText(kind) {
  if (kind === "missing") return { text: T.markPainGone, back: true };
  return { text: kind === "network" ? T.markOffline : T.markError, back: false };
}

// What a refused comment says, and where: the field for anything about the text (the page's own check, or the base's
// 22023 whatever the page's check said), the form's notice for the rest. The text is always kept.
export function commentErrorText(kind, body) {
  if (kind === "invalid") {
    const check = validComment(body);
    if (check.error === "empty") return { place: "field", text: T.commentEmpty };
    if (check.error === "too-long") return { place: "field", text: fill(T.commentTooLong, { count: check.length, max: COMMENT_MAX }) };
    return { place: "field", text: T.commentRefused };
  }
  const text = kind === "network" ? T.commentOffline : kind === "missing" ? T.commentPainGone : T.commentError;
  return { place: "notice", text };
}

// What a failed write means. add_comment refuses an empty or too long body with 22023, and any write on a pain (or a
// comment) that is gone with P0002. The rest is what classifyError says: an ended session, no access, the connection.
export function sendErrorKind(error) {
  const kind = classifyError(error);
  if (kind !== "other" || !object(error)) return kind;
  const code = String(error.code ?? "");
  if (code === "22023") return "invalid";
  if (code === "P0002") return "missing";
  return "other";
}

// A comment being written is kept in the tab (sessionStorage) under its pain, with the email of who wrote it, so a
// session that ends mid-visit does not lose it (Review Focus 3). It comes back only to the same person.
const DRAFT_PREFIX = "dolores-portal.draft.";
export const draftKey = (painId) => `${DRAFT_PREFIX}${painId}`;
export const isDraftKey = (key) => typeof key === "string" && key.startsWith(DRAFT_PREFIX);
export const draftValue = (email, body) => JSON.stringify({ email: lower(email), text: String(body ?? "") });

export function readDraft(raw, email) {
  if (typeof raw !== "string" || !raw) return null;
  let value;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!object(value) || Array.isArray(value) || typeof value.email !== "string" || typeof value.text !== "string") return null;
  const me = lower(email);
  if (!me || lower(value.email) !== me || !value.text.trim()) return null;
  return value.text;
}
