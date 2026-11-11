// The page's entry point: the session, the hash router and the screens. Signing in is two screens (email, then the
// 8-digit code) with the manual's «formulario» pattern. Once in, every screen first checks that the person is on the
// team's list (`people`); someone who is not, or who was taken off it, sees the «sin permiso» state (EST-05).
// Routes: #/ is home; #/dolor/<id> is a pain. Without a session the page shows the sign-in.
// A pain's detail asks before leaving with a comment not yet published (NAV-06), and keeps that comment in the tab when
// the session ends, so it comes back after signing in again (Review Focus 3).

import { supabase } from "./supabase-client.js";
import { EMAIL_OTP_LENGTH } from "../config.js";
import { h, replaceChildren } from "./dom.js";
import { T, fill } from "./text.js";
import { classifyAuthError, isEmailInvalid, isNetworkError, retryAfterSeconds } from "./auth-errors.js";
import { accessState } from "./access.js";
import { buildSections, weekSentence, emptySentence, onlyDiscardedSentence, homeNotice, sentenceTense, runNotice, classifyError, rowMeta, firstPage, nextPage, PAGE_SIZE } from "./model.js";
import { loadHome, loadPain, setMark, addComment, deleteComment } from "./api.js";
import {
  nextMark, keyData, validComment, cardTitle, painStatus, statusLabel, cardSections, isLineCard, markLines, commentItems,
  sendErrorKind, draftKey, draftValue, readDraft, isDraftKey, discardNote, markErrorText, commentErrorText, COMMENT_MAX,
  markButtonLabels, ownMarkLine, lineNoticeText,
} from "./detail.js";

const root = document.getElementById("app");

const PENDING_SIGN_IN_KEY = "dolores-portal.pending-sign-in";
const PENDING_SIGN_IN_TTL_MS = 60 * 60 * 1000; // a code is useless after an hour
const CLOCK_SKEW_MS = 60 * 1000; // a «sent» time this far in the future is a clock change, not a real send
const RESEND_SECONDS = 60; // Supabase allows one email per 60 s
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAIN_ID = /^[A-Za-z0-9_-]{1,64}$/;

const state = {
  session: null,
  view: "boot", // "sign-in" while one of the sign-in screens is up
  viewId: 0, // bumped on every new screen, so a late answer never paints over a newer one
  cleanup: null, // stops the current screen's timers
  signingOut: false,
  guard: null, // { blocks(), ask(proceed) } while a pain has a comment not yet published
};

const t = (key, params) => fill(T[key], params);

function setTitle(text) { document.title = t("pageTitle", { title: text }); }

function runCleanup() {
  if (!state.cleanup) return;
  const cleanup = state.cleanup;
  state.cleanup = null;
  cleanup();
}

// ---- layout ---------------------------------------------------------------------------------

const atHome = () => ["", "#", "#/"].includes(location.hash);

// The header: «dolores» in its own type style (NAV-08) and, after signing in, «Salir». The name links home on every
// screen with a session (NAV-09); on the sign-in screens it is plain text, because there is no home yet and tapping it
// would only wipe the code being typed.
function masthead({ brandLink, actions }) {
  const brand = brandLink
    ? h("a", { class: "brand", "data-rol": "marca-producto", href: "#/", "aria-label": T.brandHome,
      "aria-current": atHome() ? "page" : null }, T.brand)
    : h("div", { class: "brand", "data-rol": "marca-producto" }, T.brand);
  return h("header", { class: "masthead" },
    brand,
    actions.length ? h("div", { class: "masthead-actions" }, actions) : null);
}

// «Salir» leaves the screen too: with a comment not yet published it asks first (NAV-06).
const signOutButton = () => h("button", { type: "button", class: "button button--secondary", onclick: () => leaveThen(signOut) },
  T.signOut);

// One frame for every screen (marco.md): the header, then inside <main> the context («← Volver», optional), the title
// band, the notice zone and the body.
function frameLayout({ title, meta = [], brandLink = true, actions = [], context = null }) {
  runCleanup(); // a new screen drops the last one's timers and its leave guard
  const heading = h("h1", { tabindex: "-1" }, title);
  const head = h("div", { class: "page-head", "data-rol": "cabecera" },
    heading,
    meta.filter(Boolean).map((line) => h("p", { class: "page-meta" }, line)));
  const notices = h("div", { class: "notices", "data-rol": "avisos" });
  const body = h("div", { class: "body", "data-rol": "cuerpo" });
  replaceChildren(root, h("div", { class: "frame" },
    masthead({ brandLink, actions }),
    h("main", { id: "main", class: context ? "has-context" : null },
      h("div", { "data-rol": "marco" }, context, head, notices, body))));
  setTitle(title);
  return { heading, head, notices, body };
}

// A notice in the page, one at a time in its zone (MAR-04), never floating (COM-17).
function showNotice(container, { tone = "info", text, actions = [] }) {
  const notice = h("div", { class: `notice notice--${tone}`, role: tone === "error" ? "alert" : "status" }, h("p", {}, text));
  if (actions.length) {
    notice.append(h("div", { class: "notice-actions" },
      actions.map((a) => h("button", { type: "button", class: "link-button", onclick: a.onClick }, a.label))));
  }
  replaceChildren(container, notice);
}
const clearNotice = (container) => replaceChildren(container);

function fieldError(id) { return h("p", { class: "field-error", id, hidden: true }); }
function setFieldError(input, errorEl, text) {
  errorEl.textContent = text || "";
  errorEl.hidden = !text;
  if (text) { input.setAttribute("aria-invalid", "true"); input.focus(); }
  else input.removeAttribute("aria-invalid");
}

// ---- router ---------------------------------------------------------------------------------

function parseRoute(hash) {
  const match = /^#\/dolor\/([^/?#]+)\/?$/.exec(hash || "");
  if (match) {
    let id = "";
    try { id = decodeURIComponent(match[1]); } catch { /* malformed: home */ }
    if (PAIN_ID.test(id)) return { name: "pain", id };
  }
  return { name: "home" };
}

async function route() {
  const viewId = ++state.viewId;
  state.view = "routing";
  runCleanup();
  if (!state.session) return showSignIn();
  const target = parseRoute(location.hash);
  // Anything that is not a pain is home.
  if (target.name === "home" && !atHome()) history.replaceState(null, "", `${location.pathname}${location.search}#/`);

  const email = state.session.user && state.session.user.email;
  const layout = frameLayout({
    title: t(target.name === "pain" ? "painTitle" : "homeTitle"),
    context: target.name === "pain" ? backLink() : null,
    actions: [signOutButton()],
  });
  layout.body.setAttribute("aria-busy", "true");
  layout.body.append(h("p", { class: "loading", role: "status" }, T.checkingAccess));

  const access = await readAccess(email);
  if (viewId !== state.viewId) return;
  if (access.kind === "expired") return sessionEnded();
  if (access.kind === "error") return showAccessError(access.error);
  if (access.kind === "no-access") return showNoAccess(email);
  if (target.name === "pain") return showPain(layout, target.id, email);
  return showHome(layout, email);
}

// ---- access ---------------------------------------------------------------------------------

// The session's token is no longer accepted (PostgREST: HTTP 401, PGRST301 or PGRST303).
const isSessionExpired = (error, status) => status === 401 || /^PGRST30[13]$/.test(String((error && error.code) || ""));

// RLS shows `people` only to people on it, so zero rows means «no access» (accessState). RLS filters rows and never
// refuses this read: a 42501 here means the table lost its grant, which is an error like any other failure, never «no
// access».
async function readAccess(email) {
  let result;
  try { result = await supabase.from("people").select("email,name"); }
  catch (error) { return { kind: "error", error }; }
  const { data, error, status } = result;
  if (error) {
    if (isSessionExpired(error, status)) return { kind: "expired" };
    return { kind: "error", error };
  }
  return { kind: accessState(data, email) };
}

function showAccessError(error) {
  state.view = "access-error";
  const layout = frameLayout({ title: T.accessErrorTitle, actions: [signOutButton()] });
  showNotice(layout.notices, { tone: "error", text: isNetworkError(error) ? T.networkError : T.accessError });
  layout.body.append(h("button", { type: "button", class: "button button--primary", "data-rol": "accion-principal", onclick: route }, T.retry));
}

// EST-05: what cannot be done and whom to ask. The email they came in with is said, because the most likely cause is
// another address. «Salir» is the way out (and to come back with another email). The name is plain text (NAV-09):
// there is no home to go to without access.
function showNoAccess(email) {
  state.view = "no-access";
  const layout = frameLayout({ title: T.noAccessTitle, meta: [email ? t("signedInAs", { email }) : null], brandLink: false });
  layout.body.append(h("div", { class: "stack" },
    h("div", { class: "notice", role: "status" }, h("p", {}, T.noAccess)),
    h("button", { type: "button", class: "button button--primary", "data-rol": "accion-principal", onclick: signOut }, T.signOut)));
  layout.heading.focus({ preventScroll: true });
}

// ---- home: the week's pains (the manual's «lista» pattern) ----------------------------------

// A run that failed or is incomplete is a warning, also when it is old (then the tone follows its status).
const NOTICE_TONE = { failed: "warning", incomplete: "warning", "ingest-only": "info", none: "info" };

// The home keeps the frame route() drew while checking access (same title), so the screen does not flash. While the
// pains load the body is busy and says so; it never says «no hay» before the answer (EST-02).
async function showHome(layout, email) {
  state.view = "home";
  const viewId = state.viewId;
  layout.body.setAttribute("aria-busy", "true");
  replaceChildren(layout.body, h("p", { class: "loading", role: "status" }, T.homeLoading));
  layout.heading.focus({ preventScroll: true });
  let home;
  try { home = await loadHome(supabase); }
  catch (error) {
    if (viewId !== state.viewId) return;
    return showLoadError(layout, error, email, T.homeError);
  }
  if (viewId !== state.viewId) return;
  renderHome(layout, home);
}

// A session that ended goes back to signing in; someone the base refuses sees «sin permiso»; anything else says what
// happened and offers to try again (EST-04).
function showLoadError(layout, error, email, otherText) {
  const kind = classifyError(error);
  if (kind === "expired") return sessionEnded();
  if (kind === "no-access") return showNoAccess(email);
  layout.body.removeAttribute("aria-busy");
  showNotice(layout.notices, { tone: "error", text: kind === "network" ? T.networkError : otherText });
  replaceChildren(layout.body,
    h("button", { type: "button", class: "button button--primary", "data-rol": "accion-principal", onclick: route }, T.retry));
}

// The week's sentence opens the body, not the title band: on a 320 × 640 phone the band stays the masthead and the h1
// (MAR-14), and the sentence scrolls with the list.
function renderHome(layout, home) {
  const sections = buildSections(home);
  const shown = [["weighty", T.sectionWeighty], ["interested", T.sectionInterested], ["watching", T.sectionWatching]]
    .filter(([key]) => sections[key].length);
  const empty = !shown.length && !sections.discarded.length;
  const notice = runNotice(home.summary, new Date());
  const visibleNotice = homeNotice(notice, { empty });
  if (visibleNotice) {
    const tone = NOTICE_TONE[visibleNotice.kind === "stale" ? home.summary.status : visibleNotice.kind] || "info";
    showNotice(layout.notices, { tone, text: visibleNotice.text });
  }

  const blocks = [];
  // LIS-05 and EST-01: an empty list says so in one sentence and offers to load again, the way out last (MAR-06). With
  // only discarded pains the week's sentence stays and points to them instead of saying the list is empty.
  if (empty) {
    blocks.push(h("div", { class: "stack", "data-rol": "vacio" },
      h("p", { class: "week-sentence" }, emptySentence(home.summary, notice)),
      h("button", { type: "button", class: "button button--primary", "data-rol": "accion-principal", onclick: route }, T.reload)));
  } else {
    // A list from a run that failed, stayed incomplete or only gathered, or from an old run: the sentence speaks of
    // that run or of the last review.
    const tense = sentenceTense(notice);
    const sentence = h("p", { class: "week-sentence" },
      weekSentence(home.summary, { weighty: sections.weighty.length, past: tense === "past", latest: tense === "latest" }));
    blocks.push(sentence, ...shown.map(([key, title]) => painSection(key, title, sections[key])));
    if (!shown.length) {
      blocks.push(h("div", { class: "section stack", "data-rol": "vacio" },
        h("p", {}, onlyDiscardedSentence(notice)),
        h("button", { type: "button", class: "button button--primary", "data-rol": "accion-principal", onclick: route }, T.reload)));
    }
  }
  // The discarded ones are folded away: few need them (COM-06). The summary holds their h2, so their rows are always h3.
  if (sections.discarded.length) {
    blocks.push(h("details", { class: "section" },
      h("summary", { class: "section-summary" },
        h("h2", {}, t("sectionCount", { title: T.sectionDiscarded, count: sections.discarded.length }))),
      painList(sections.discarded)));
  }
  layout.body.removeAttribute("aria-busy");
  layout.body.classList.add("home-body");
  replaceChildren(layout.body, blocks);
}

function painSection(key, title, items) {
  const id = `section-${key}`;
  return h("section", { class: "section", "aria-labelledby": id },
    h("h2", { id }, t("sectionCount", { title, count: items.length })),
    painList(items));
}

// One row per pain: its title as the link to it, who suffers it, and a line with the trend, the topic and the marks
// (LIS-01). The pain id only travels in the link's address.
function painRow(item) {
  return h("li", { class: "pain-row" },
    h("h3", { class: "pain-title" }, h("a", { href: `#/dolor/${encodeURIComponent(item.id)}` }, item.title)),
    item.who ? h("p", { class: "pain-who" }, item.who) : null,
    h("p", { class: "pain-meta" }, rowMeta(item).join(" · ")));
}

// LIS-04: past 50 rows the list shows 20, and «Ver 20 más» adds the next ones; the focus goes to the first row added.
function painList(items) {
  const list = h("ul", { class: "pain-list", role: "list" });
  const more = h("button", { type: "button", class: "link-button" });
  let count = 0;
  function showUpTo(next) {
    const added = items.slice(count, next).map(painRow);
    list.append(...added);
    count = next;
    const left = items.length - count;
    more.hidden = left <= 0;
    more.textContent = t("showMore", { count: Math.min(PAGE_SIZE, left) });
    return added[0] || null;
  }
  more.addEventListener("click", () => {
    const first = showUpTo(nextPage(count, items.length));
    const link = first && first.querySelector("a");
    if (link) link.focus();
  });
  showUpTo(firstPage(items.length));
  return [list, more];
}

// ---- a pain: its card, the team's marks and comments (the manual's «detalle» pattern) ------

// «← Volver» on one line; its accessible name says where it goes (MAR-14).
const backLink = () => h("a", { class: "back-link", href: "#/", "aria-label": T.backToList }, T.back);

// The comment being written, kept in the tab under its pain and its author (Review Focus 3).
function saveDraft(painId, email, body) {
  try {
    if (body.trim()) sessionStorage.setItem(draftKey(painId), draftValue(email, body));
    else sessionStorage.removeItem(draftKey(painId));
  } catch { /* private mode: the comment stays only in its field */ }
}
function takeDraft(painId, email) {
  try {
    const raw = sessionStorage.getItem(draftKey(painId));
    const body = readDraft(raw, email);
    if (raw !== null && body === null) sessionStorage.removeItem(draftKey(painId)); // someone else's, or unreadable
    return body;
  } catch { return null; }
}
function clearDrafts() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) if (isDraftKey(sessionStorage.key(i))) keys.push(sessionStorage.key(i));
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch { /* private mode */ }
}

// Leaving the screen with a comment not yet published asks first (NAV-06); otherwise it just goes.
function leaveThen(proceed) {
  if (state.guard && state.guard.blocks()) state.guard.ask(proceed);
  else proceed();
}

// The pain keeps the frame route() drew (same back link and frame), so the screen does not flash; the h1 becomes the
// pain's title once it loads.
async function showPain(layout, id, email) {
  state.view = "pain";
  const viewId = state.viewId;
  layout.body.setAttribute("aria-busy", "true");
  replaceChildren(layout.body, h("p", { class: "loading", role: "status" }, T.painLoading));
  layout.heading.focus({ preventScroll: true });
  let data;
  try { data = await loadPain(supabase, id); }
  catch (error) {
    if (viewId !== state.viewId) return;
    return showLoadError(layout, error, email, T.painError);
  }
  if (viewId !== state.viewId) return;
  // A pain the home leaves out (unknown, without a card, dead or discarded by hand) is not shown either.
  if (!data || !painStatus(data.pain, data.marks)) return showPainMissing(layout);
  renderPain(layout, id, String(email || "").trim().toLowerCase(), data);
}

// The sentence goes in the notice zone (EST-06) and the way back is the body's one action.
function showPainMissing(layout) {
  layout.body.removeAttribute("aria-busy");
  showNotice(layout.notices, { tone: "info", text: T.painMissing });
  replaceChildren(layout.body,
    h("a", { class: "button button--primary", "data-rol": "accion-principal", href: "#/" }, T.backToList));
}

// One key datum: its label (muted) and its value (DET-02). On a phone they share one line, «·» between them, and a
// value that reads alone hides its label from the eye but not from a screen reader (DET-12).
function keyItem(item) {
  return h("li", { class: item.alone ? "key key--alone" : "key", "data-rol": "dato-clave" },
    h("span", { class: "key-label" }, item.label), " ", h("span", { class: "key-value" }, item.value));
}

function quoteItem(quote) {
  return h("li", { class: "quote" },
    h("blockquote", {}, h("p", {}, quote.text)),
    quote.url ? h("a", { class: "quote-source", href: quote.url, target: "_blank", rel: "noopener noreferrer" }, T.seeSource) : null,
    quote.original ? h("details", { class: "fold original" }, h("summary", {}, T.originalText), h("p", {}, quote.original)) : null);
}

// A section of the card: its h2, its paragraphs, then its quotes or its glossary (a <dl>, DET-08). Separated by space,
// never boxed (DET-09).
function cardSection(section, ...extra) {
  const headingId = `${section.id}-titulo`;
  return h("section", { class: "section detail-section", id: section.id, "aria-labelledby": headingId },
    h("h2", { id: headingId, tabindex: "-1" }, section.title),
    section.paragraphs.map((text) => h("p", {}, text)),
    section.quotes && section.quotes.length ? h("ul", { class: "quotes", role: "list" }, section.quotes.map(quoteItem)) : null,
    section.glossary && section.glossary.length
      ? h("dl", { class: "glossary" }, section.glossary.map((g) => h("div", { class: "glossary-row" }, h("dt", {}, g.term), h("dd", {}, g.meaning))))
      : null,
    extra);
}

// The index of the sections (DET-04): folded at the top on a phone, sticky beside the sections from 672 px (the
// frame's side panel, `lateral`). The CSS
// shows one of the two, so a screen reader meets only one. Its links scroll to their section without touching the
// address, which is the router's.
function sectionIndex(sections) {
  const links = () => h("ul", { role: "list" }, sections.map((section) => h("li", {},
    h("a", { href: `#${section.id}`, onclick: (event) => {
      event.preventDefault();
      const target = document.getElementById(`${section.id}-titulo`);
      if (!target) return;
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
    } }, section.title))));
  return [
    h("details", { class: "fold detail-index detail-index--fold" },
      h("summary", {}, T.indexLabel), h("nav", { "aria-label": T.indexLabel }, links())),
    h("nav", { class: "detail-index detail-index--wide", "data-rol": "lateral", "aria-label": T.indexLabel }, links()),
  ];
}

function renderPain(layout, id, email, data) {
  const viewId = state.viewId;
  const view = { marks: [...data.marks], comments: [...data.comments] };
  const title = cardTitle(data.card);
  layout.heading.textContent = title;
  setTitle(title);

  // ---- the header (DET-01, DET-12): the status tag, the key data, then the marks as its actions (MAR-06) ----
  const tag = h("span", { class: "tag" });
  const statusRow = h("p", { class: "detail-status" }, tag);
  const interested = h("button", { type: "button", class: "button button--primary", "data-rol": "accion-principal" },
    T.markInterestedAction);
  const discard = h("button", { type: "button", class: "button button--secondary" }, T.markDiscardAction);
  const ownLine = h("p", { class: "own-mark" });
  layout.head.classList.add("detail-head");
  layout.head.append(statusRow,
    h("ul", { class: "key-data", role: "list" }, keyData(data.pain, data.card).map(keyItem)),
    h("div", { class: "actions detail-actions" }, interested, discard),
    ownLine);
  // A line card's notice depends on the marks too (lineNoticeText): it is refreshed with the header.
  const lineNotice = isLineCard(data.card) ? h("p", {}) : null;

  const myMark = () => {
    const own = view.marks.find((m) => m && String(m.author ?? "").trim().toLowerCase() === email);
    return own ? own.mark : null;
  };
  // The buttons say what pressing them does, and the line under them your own mark in words with its day. A button whose
  // label changes with the state carries no aria-pressed (ARIA: a toggle keeps a fixed label).
  function refreshHeader() {
    const label = statusLabel(painStatus(data.pain, view.marks));
    tag.textContent = label || "";
    statusRow.hidden = !label; // a pain that just left every list (a dead one no longer kept): no tag
    const mine = myMark();
    const labels = markButtonLabels(mine);
    interested.textContent = labels.interested;
    discard.textContent = labels.discard;
    const line = ownMarkLine(view.marks, email);
    ownLine.textContent = line || "";
    ownLine.hidden = !line;
    if (lineNotice) lineNotice.textContent = lineNoticeText(data.pain, view.marks);
  }

  // ---- marks and comments ----
  const marksList = h("ul", { class: "mark-list", role: "list" });
  const noMarks = h("p", { class: "muted" }, T.noMarks);
  const commentsHeading = h("h3", { tabindex: "-1" }, T.commentsTitle);
  const commentList = h("ul", { class: "comment-list", role: "list" });
  const noComments = h("p", { class: "muted" }, T.noComments);
  const live = h("p", { class: "visually-hidden", role: "status" });

  function refreshMarks() {
    const lines = markLines(view.marks, data.people);
    replaceChildren(marksList, lines.map((line) => h("li", {}, line.text)));
    marksList.hidden = !lines.length;
    noMarks.hidden = lines.length > 0;
  }
  function refreshComments() {
    const items = commentItems(view.comments, data.people, email);
    replaceChildren(commentList, items.map(commentRow));
    commentList.hidden = !items.length;
    noComments.hidden = items.length > 0;
  }

  // A failed write: a session that ended goes back to signing in (the comment is already kept), someone the base
  // refuses sees «sin permiso». Anything else returns its kind for the caller to say.
  function failed(error) {
    const kind = sendErrorKind(error);
    if (kind === "expired") { sessionEnded(); return null; }
    if (kind === "no-access") { showNoAccess(email); return null; }
    return kind;
  }

  let markBusy = false;
  async function pressMark(pressed) {
    if (markBusy) return;
    const next = nextMark(myMark(), pressed);
    markBusy = true;
    [interested, discard].forEach((b) => b.setAttribute("aria-disabled", "true"));
    clearNotice(layout.notices);
    let error = null;
    try { await setMark(supabase, id, next); } catch (err) { error = err; }
    markBusy = false;
    if (viewId !== state.viewId) return;
    [interested, discard].forEach((b) => b.removeAttribute("aria-disabled"));
    if (error) {
      const kind = failed(error);
      if (!kind) return;
      const { text, back } = markErrorText(kind);
      // A pain gone: the way back is the notice's own action (leaving with a comment written still asks first).
      const actions = back ? [{ label: T.backToList, onClick: () => { location.hash = "#/"; } }] : [];
      return showNotice(layout.notices, { tone: "error", text, actions });
    }
    // The base keeps one mark per person; the page mirrors it without reading everything again.
    view.marks = view.marks.filter((m) => !m || String(m.author ?? "").trim().toLowerCase() !== email);
    if (next) view.marks.push({ pain_id: id, author: email, mark: next, created_at: new Date().toISOString() });
    refreshHeader();
    refreshMarks();
    if (next === "discarded") showNotice(layout.notices, { tone: "info", text: discardNote(data.pain, view.marks) });
  }
  interested.addEventListener("click", () => pressMark("interested"));
  discard.addEventListener("click", () => pressMark("discarded"));

  // One comment: who and when, the body as text, and on your own «Borrar» with its inline confirmation.
  function commentRow(item) {
    const actions = item.own ? h("div", { class: "comment-actions" }) : null;
    const row = h("li", { class: "comment" },
      h("p", { class: "comment-meta" }, item.date ? t("commentMeta", { name: item.name, date: item.date }) : item.name),
      h("p", { class: "comment-body" }, item.body),
      actions);
    if (!actions) return row;
    let busy = false;
    const showDelete = (errorText = null) => {
      const button = h("button", { type: "button", class: "link-button", onclick: () => confirmDelete() }, T.deleteComment);
      replaceChildren(actions, button, errorText ? h("p", { class: "field-error", role: "alert" }, errorText) : null);
      return button;
    };
    const confirmDelete = () => {
      const cancel = h("button", { type: "button", class: "link-button", onclick: () => showDelete().focus() }, T.cancel);
      replaceChildren(actions,
        h("p", {}, T.deleteConfirm),
        h("button", { type: "button", class: "link-button", onclick: () => remove() }, T.deleteComment),
        cancel);
      cancel.focus();
    };
    const remove = async () => {
      if (busy) return;
      busy = true;
      let error = null;
      try { await deleteComment(supabase, item.id); } catch (err) { error = err; }
      busy = false;
      if (viewId !== state.viewId) return;
      const kind = error ? failed(error) : "done";
      if (!kind) return;
      if (kind !== "done" && kind !== "missing") {
        showDelete(kind === "network" ? T.deleteOffline : T.deleteError).focus();
        return;
      }
      // Deleted, or already gone: either way it leaves the list.
      view.comments = view.comments.filter((c) => !c || c.id !== item.id);
      refreshComments();
      live.textContent = T.deleted;
      commentsHeading.focus();
    };
    showDelete();
    return row;
  }

  // ---- the comment form: a counter, errors that keep the text (EST-04), the text kept across a lost session ----
  const textarea = h("textarea", {
    id: "comment", name: "comment", rows: "4", maxlength: String(COMMENT_MAX), "aria-describedby": "comment-count comment-error",
  });
  const counter = h("p", { class: "hint", id: "comment-count" });
  const fieldErr = fieldError("comment-error");
  const formNotice = h("div", { class: "form-notices" });
  const publishButton = h("button", { type: "submit", class: "button button--secondary" }, T.publish);
  const updateCounter = () => { counter.textContent = t("commentCount", { count: textarea.value.length, max: COMMENT_MAX }); };
  const kept = takeDraft(id, email);
  if (kept) textarea.value = kept;
  updateCounter();
  textarea.addEventListener("input", () => {
    updateCounter();
    saveDraft(id, email, textarea.value);
    if (!fieldErr.hidden) setFieldError(textarea, fieldErr, "");
  });

  let sending = false;
  async function publish(event) {
    event.preventDefault();
    if (sending) return;
    if (!validComment(textarea.value).ok) return setFieldError(textarea, fieldErr, commentErrorText("invalid", textarea.value).text);
    setFieldError(textarea, fieldErr, "");
    clearNotice(formNotice);
    const body = textarea.value;
    saveDraft(id, email, body);
    sending = true;
    publishButton.textContent = T.publishing;
    let newId;
    let error = null;
    try { newId = await addComment(supabase, id, body); } catch (err) { error = err; }
    sending = false;
    publishButton.textContent = T.publish;
    if (viewId !== state.viewId) return;
    if (error) {
      const kind = failed(error);
      if (!kind) return;
      const said = commentErrorText(kind, body);
      if (said.place === "field") return setFieldError(textarea, fieldErr, said.text);
      return showNotice(formNotice, { tone: "error", text: said.text });
    }
    // Published: the field empties unless more was typed while it was sending.
    if (textarea.value === body) textarea.value = "";
    saveDraft(id, email, textarea.value);
    updateCounter();
    view.comments.push({ id: newId, pain_id: id, author: email, body: body.trim(), created_at: new Date().toISOString() });
    refreshComments();
    live.textContent = T.published;
  }

  const form = h("form", { class: "form comment-form", "data-medida": "formulario", novalidate: true, onsubmit: publish },
    formNotice,
    h("div", { class: "field" }, h("label", { for: "comment" }, T.commentLabel), textarea, counter, fieldErr),
    h("div", {}, publishButton));

  // ---- the body: the line card's notice, or the index; then the sections ----
  const sections = cardSections(data.card);
  const blocks = sections.map((section) => (section.id === "marcas"
    ? cardSection(section,
      h("h3", {}, T.marksTitle), marksList, noMarks,
      commentsHeading, commentList, noComments,
      form, live)
    : cardSection(section)));
  layout.body.removeAttribute("aria-busy");
  if (isLineCard(data.card)) {
    replaceChildren(layout.body, h("div", { class: "notice detail-notice" }, lineNotice), blocks);
  } else {
    replaceChildren(layout.body, h("div", { class: "detail-layout" },
      sectionIndex(sections), h("div", { class: "detail-sections" }, blocks)));
  }
  refreshHeader();
  refreshMarks();
  refreshComments();

  // NAV-06: a comment not yet published stops the way out and asks, in the notice zone; leaving drops it.
  state.guard = {
    blocks: () => textarea.value.trim() !== "",
    ask: (proceed) => {
      showNotice(layout.notices, {
        tone: "warning", text: T.leaveUnsent, actions: [
          { label: T.leaveAnyway, onClick: () => {
            textarea.value = "";
            saveDraft(id, email, "");
            state.guard = null;
            proceed();
          } },
          { label: T.keepWriting, onClick: () => { clearNotice(layout.notices); textarea.focus(); } },
        ],
      });
      const first = layout.notices.querySelector("button");
      if (first) first.focus();
    },
  };
  state.cleanup = () => { state.guard = null; };
}

// ---- sign in --------------------------------------------------------------------------------

// The address a code was sent to, kept for the tab (sessionStorage) for as long as the code lasts.
function readPendingSignIn() {
  try {
    const value = JSON.parse(sessionStorage.getItem(PENDING_SIGN_IN_KEY));
    const age = value && Date.now() - value.sentAt;
    if (value && typeof value.email === "string" && EMAIL_PATTERN.test(value.email) && Number.isFinite(value.sentAt)
      && age > -CLOCK_SKEW_MS && age < PENDING_SIGN_IN_TTL_MS) return value;
  } catch { /* unreadable or blocked: start over */ }
  clearPendingSignIn();
  return null;
}
function writePendingSignIn(email, sentAt) {
  try { sessionStorage.setItem(PENDING_SIGN_IN_KEY, JSON.stringify({ email, sentAt })); } catch { /* private mode */ }
}
function clearPendingSignIn() {
  try { sessionStorage.removeItem(PENDING_SIGN_IN_KEY); } catch { /* private mode */ }
}

async function requestCode(email) {
  try {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    return error ? { ok: false, error } : { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

const systemErrorText = (kind) => (kind === "network" ? T.networkError : T.otherError);

function stepsSection() {
  return h("section", { class: "section", "aria-labelledby": "steps-title" },
    h("h2", { id: "steps-title" }, T.stepsTitle),
    h("ol", { class: "steps" }, [T.step1, t("step2", { length: EMAIL_OTP_LENGTH }), T.step3].map((text, i) =>
      h("li", {}, h("span", { class: "step-number" }, `${i + 1}. `), text))));
}

// Both sign-in screens keep one composition: the form (its primary action last, MAR-06) and what goes after it,
// then how signing in works, side by side from 672 px.
function signInBody(body, form, after = null) {
  body.append(h("div", { class: "split" }, h("div", { class: "section" }, form, after), stepsSection()));
}

function showSignIn({ notice = null } = {}) {
  const pending = readPendingSignIn();
  if (pending) showCodeStep(pending, { notice });
  else showEmailStep("", { notice });
}

function showEmailStep(prefill = "", { notice = null } = {}) {
  state.view = "sign-in";
  const { notices, body } = frameLayout({ title: T.signInTitle, meta: [T.signInLead], brandLink: false });
  setTitle(T.signInPageTitle);
  if (notice) showNotice(notices, notice);
  const input = h("input", {
    id: "email", name: "email", type: "email", autocomplete: "email", inputmode: "email",
    autocapitalize: "none", spellcheck: "false", required: true, "aria-describedby": "email-hint email-error",
  });
  input.value = prefill;
  const error = fieldError("email-error");
  const button = h("button", { type: "submit", class: "button button--primary", "data-rol": "accion-principal" }, T.sendCode);
  let busy = false;

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const email = input.value.trim().toLowerCase();
    if (!email) return setFieldError(input, error, T.emailRequired);
    if (!EMAIL_PATTERN.test(email)) return setFieldError(input, error, T.emailInvalid);
    setFieldError(input, error, "");
    clearNotice(notices);
    busy = true;
    button.textContent = T.sending;
    const result = await requestCode(email);
    busy = false;
    button.textContent = T.sendCode;
    if (state.view !== "sign-in") return; // signed in from another tab meanwhile
    if (result.ok) {
      const sentAt = Date.now();
      writePendingSignIn(email, sentAt);
      return showCodeStep({ email, sentAt });
    }
    if (isEmailInvalid(result.error)) return setFieldError(input, error, T.emailInvalid);
    const kind = classifyAuthError(result.error);
    // The project's hourly cap on emails: no wait to count down, and maybe no code to type.
    if (kind === "email-cap") return showNotice(notices, { tone: "warning", text: T.emailCap });
    if (kind === "rate-limit") {
      // A code was sent a moment ago (maybe from another tab): say when another can be asked, and let them type it.
      const seconds = retryAfterSeconds(result.error, RESEND_SECONDS);
      return showNotice(notices, {
        tone: "warning", text: t("rateLimitSend", { seconds }),
        actions: [{ label: T.haveCode, onClick: () => {
          const sentAt = Date.now() - Math.max(0, RESEND_SECONDS - seconds) * 1000;
          writePendingSignIn(email, sentAt);
          showCodeStep({ email, sentAt });
        } }],
      });
    }
    showNotice(notices, { tone: "error", text: systemErrorText(kind) });
  }

  signInBody(body, h("form", { class: "form", "data-medida": "formulario", novalidate: true, onsubmit: onSubmit },
    h("div", { class: "field" },
      h("label", { for: "email" }, T.emailLabel),
      h("p", { class: "hint", id: "email-hint" }, T.emailHint),
      input, error),
    button));
}

function showCodeStep(pending, { notice = null } = {}) {
  state.view = "sign-in";
  const { notices, body } = frameLayout({
    title: T.codeTitle, meta: [t("codeSentTo", { length: EMAIL_OTP_LENGTH, email: pending.email })], brandLink: false,
  });
  if (notice) showNotice(notices, notice);
  const input = h("input", {
    id: "code", name: "code", type: "text", inputmode: "numeric", autocomplete: "one-time-code",
    pattern: "[0-9]*", class: "code-input", required: true, "aria-describedby": "code-error",
  });
  const error = fieldError("code-error");
  const button = h("button", { type: "submit", class: "button button--primary", "data-rol": "accion-principal" }, T.verify);
  const resendStatus = h("p", { class: "hint" }); // changes every second: not a live region
  const live = h("p", { class: "visually-hidden", role: "status" });
  const resendButton = h("button", { type: "button", class: "link-button", hidden: true }, T.resend);
  const otherEmail = h("button", { type: "button", class: "link-button" }, T.useOtherEmail);
  let sentAt = pending.sentAt;
  let resent = false;
  let busy = false;
  let resendBusy = false;

  // «Enviar otro código» unlocks 60 s after the last send; until then the line says how long is left.
  function tick() {
    const left = Math.ceil(RESEND_SECONDS - (Date.now() - sentAt) / 1000);
    const prefix = resent ? `${T.codeResent} ` : "";
    resendStatus.textContent = left > 0 ? prefix + t("resendIn", { seconds: left }) : prefix.trim();
    resendStatus.hidden = !resendStatus.textContent;
    resendButton.hidden = left > 0;
  }
  const timer = setInterval(tick, 1000);
  tick();
  state.cleanup = () => clearInterval(timer);
  const viewId = state.viewId;

  async function verify(event) {
    if (event) event.preventDefault();
    if (busy) return;
    const token = input.value.replace(/\D/g, "");
    if (token.length !== EMAIL_OTP_LENGTH) return setFieldError(input, error, t("codeIncomplete", { length: EMAIL_OTP_LENGTH }));
    busy = true;
    button.textContent = T.verifying;
    clearNotice(notices);
    let result;
    try { result = await supabase.auth.verifyOtp({ email: pending.email, token, type: "email" }); }
    catch (err) { result = { error: err }; }
    busy = false;
    button.textContent = T.verify;
    if (!result.error && result.data && result.data.session) {
      clearPendingSignIn();
      state.session = result.data.session;
      return route();
    }
    if (viewId !== state.viewId) return;
    const kind = classifyAuthError(result.error);
    if (kind === "expired-code") { setFieldError(input, error, T.codeExpired); input.select(); }
    else if (kind === "invalid-code") { setFieldError(input, error, t("codeInvalid", { length: EMAIL_OTP_LENGTH })); input.select(); }
    else if (kind === "rate-limit") showNotice(notices, { tone: "error", text: T.tooManyAttempts });
    else showNotice(notices, { tone: "error", text: systemErrorText(kind) });
  }

  // Only digits, at most the code's length; a pasted «1234 5678» keeps its 8 digits. The code goes in by itself once whole.
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH);
    if (digits !== input.value) input.value = digits;
    if (!error.hidden) setFieldError(input, error, "");
    if (digits.length === EMAIL_OTP_LENGTH) verify();
  });

  resendButton.addEventListener("click", async () => {
    if (resendBusy) return;
    resendBusy = true;
    resendButton.textContent = T.sending;
    clearNotice(notices);
    const result = await requestCode(pending.email);
    resendBusy = false;
    resendButton.textContent = T.resend;
    if (viewId !== state.viewId) return;
    if (result.ok) {
      sentAt = Date.now();
      resent = true;
      writePendingSignIn(pending.email, sentAt);
      live.textContent = T.codeResent;
      return tick();
    }
    const kind = classifyAuthError(result.error);
    if (kind === "email-cap") return showNotice(notices, { tone: "warning", text: T.emailCap });
    if (kind === "rate-limit") {
      sentAt = Date.now() - Math.max(0, RESEND_SECONDS - retryAfterSeconds(result.error, RESEND_SECONDS)) * 1000;
      return tick();
    }
    showNotice(notices, { tone: "error", text: systemErrorText(kind) });
  });

  otherEmail.addEventListener("click", () => {
    runCleanup();
    clearPendingSignIn();
    state.viewId += 1;
    showEmailStep(pending.email);
  });

  const form = h("form", { class: "form", "data-medida": "formulario", novalidate: true, onsubmit: verify },
    h("div", { class: "field" }, h("label", { for: "code" }, t("codeLabel", { length: EMAIL_OTP_LENGTH })), input, error),
    button);
  signInBody(body, form, h("div", { class: "secondary-actions" }, resendStatus, resendButton, otherEmail, live));
  input.focus();
}

// ---- session end ----------------------------------------------------------------------------

// With scope "local", auth-js removes the session (and emits SIGNED_OUT) even when the network call fails, so the
// person always lands on a clean sign-in screen.
async function signOut() {
  if (state.signingOut) return;
  state.signingOut = true;
  let error = null;
  try { ({ error } = await supabase.auth.signOut({ scope: "local" })); } catch (err) { error = err; }
  state.signingOut = false;
  state.session = null;
  clearPendingSignIn();
  clearDrafts(); // whoever signs in next in this tab must not find this person's comments
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  state.viewId += 1;
  runCleanup();
  showSignIn({ notice: error && isNetworkError(error) ? { tone: "info", text: T.signedOutOffline } : null });
}

// The session ended on its own (expired, or signed out in another tab). The stored session is dropped too, so a reload
// does not come back to a token the base refuses. The address stays in the hash, so signing in again comes back to the
// same screen, and a comment being written stays kept for its author (saveDraft).
async function sessionEnded() {
  state.session = null;
  state.viewId += 1;
  const viewId = state.viewId;
  runCleanup();
  state.signingOut = true;
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* already gone */ }
  state.signingOut = false;
  if (viewId !== state.viewId || state.session) return; // signed in again meanwhile
  showSignIn({ notice: { tone: "info", text: T.sessionExpired } });
}

// ---- boot -----------------------------------------------------------------------------------

// A way out of a pain with a comment not yet published (the back link, the brand, the browser's back) puts the pain's
// address back and asks first (NAV-06); leaving then goes where the person meant to.
window.addEventListener("hashchange", (event) => {
  if (state.view === "sign-in") return;
  if (state.guard && state.guard.blocks()) {
    history.pushState(null, "", event.oldURL);
    state.guard.ask(() => { location.href = event.newURL; });
    return;
  }
  route();
});
// Closing or reloading the tab with it: the browser's own question.
window.addEventListener("beforeunload", (event) => {
  if (!state.guard || !state.guard.blocks()) return;
  event.preventDefault();
  event.returnValue = "";
});

supabase.auth.onAuthStateChange((event, session) => {
  const hadSession = Boolean(state.session);
  state.session = session;
  // Deferred: supabase-js advises against calling it again from inside this callback.
  if (event === "SIGNED_OUT" && hadSession && !state.signingOut) setTimeout(sessionEnded, 0);
  else if (event === "SIGNED_IN" && !hadSession) setTimeout(() => { if (state.view === "sign-in") route(); }, 0);
});

// The module graph (supabase-js included) loaded: index.html's fallback can stand down.
document.documentElement.dataset.ready = "true";
let initial = null;
try { ({ data: { session: initial } } = await supabase.auth.getSession()); } catch { /* no stored session */ }
state.session = initial;
route();
