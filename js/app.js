// The page's entry point: the session, the hash router and the screens. Signing in is two screens (email, then the
// 8-digit code) with the manual's «formulario» pattern. Once in, every screen first checks that the person is on the
// team's list (`people`); someone who is not, or who was taken off it, sees the «sin permiso» state (EST-05).
// Routes: #/ is «Esta semana» (the home: «Para decidir» and the run's line), #/catalogo every pain by state, #/nichos
// the week's niche and every candidate with its veto, #/corridas the runs week by week, #/corridas/<run_id> one run
// opened, #/dolor/<id> a pain. Without a session the page shows the sign-in.
// A pain's detail asks before leaving with a comment not yet published (NAV-06), and keeps that comment in the tab when
// the session ends, so it comes back after signing in again (Review Focus 3).

import { supabase } from "./supabase-client.js";
import { EMAIL_OTP_LENGTH } from "../config.js";
import { h, replaceChildren } from "./dom.js";
import { T, fill, formatNumber } from "./text.js";
import { classifyAuthError, isEmailInvalid, isNetworkError, retryAfterSeconds } from "./auth-errors.js";
import { accessState } from "./access.js";
import {
  emptySentence, homeNotice, runNotice, classifyError, firstPage, nextPage, PAGE_SIZE, sectionOf, decideList, catalogSections,
  catalogView, latestTrace, brandLamp, brandLampText, brandLampShort, painLamp, lineView, lineHeading, weekMeta, decideLead,
  stationMarks, stationMeta, stationTags, rowMarks, stationFactLines, waitingCount,
} from "./model.js";
import { loadHome, loadWeek, loadPain, loadRuns, loadTitles, loadNiches, setMark, setNicheVeto, addComment, deleteComment } from "./api.js";
import {
  nextMark, keyData, validComment, cardTitle, painStatus, statusLabel, cardSections, isLineCard, markLines, commentItems,
  sendErrorKind, draftKey, draftValue, readDraft, isDraftKey, discardNote, markErrorText, commentErrorText, COMMENT_MAX,
  markButtonLabels, ownMarkLine, lineNoticeText, stationButtonLabels, stationStateText, howWeGot, titleMap,
} from "./detail.js";
import { renderLine, lamp } from "./line.js";
import { checkCells } from "./checks.js";
import { runRows, runState, runTitle, runKeys, runCostLines, runCutLines, runDuelLines, runTechnical, duelIds } from "./runs.js";
import { nicheBoard, withVeto, paidRunsText, painsText, versusLabel } from "./niches.js";

const root = document.getElementById("app");

const PENDING_SIGN_IN_KEY = "dolores-portal.pending-sign-in";
const PENDING_SIGN_IN_TTL_MS = 60 * 60 * 1000; // a code is useless after an hour
const CLOCK_SKEW_MS = 60 * 1000; // a «sent» time this far in the future is a clock change, not a real send
const RESEND_SECONDS = 60; // Supabase allows one email per 60 s
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAIN_ID = /^[A-Za-z0-9_-]{1,64}$/;
const RUN_ID = /^[A-Za-z0-9._-]{1,64}$/;

const state = {
  session: null,
  view: "boot", // "sign-in" while one of the sign-in screens is up
  viewId: 0, // bumped on every new screen, so a late answer never paints over a newer one
  cleanup: null, // stops the current screen's timers
  signingOut: false,
  guard: null, // { blocks(), ask(proceed) } while a pain has a comment not yet published
  week: null, // { summary, latest }, kept for the session: the run's pill and the masthead's data on every screen
  weekLoad: null, // the read of `week` a pain or Corridas started (ensureWeek); dropped when the session ends
  masthead: null, // { pill, pillShort, pillLong, week, meta, count } of the masthead on screen, so a load can fill them in
  waiting: null, // { items, marks, me }: «Para decidir» as last loaded, for «Esta semana»'s count (setWaiting)
  focusComment: null, // the pain whose comment field takes the focus when it opens («Comentar» on a station)
  titles: null, // each pain's title by its id, from the last home or Catálogo load; a pain adds its rivals' own (loadPain)
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

const TABS = [
  ["week", "#/", "tabWeek"], ["catalog", "#/catalogo", "tabCatalog"], ["niches", "#/nichos", "tabNiches"], ["runs", "#/corridas", "tabRuns"],
];

// The masthead (NAV-08), two rows. The brand row: lowercase «tomoshi», the week after a thin slash, how the latest run
// went as a pill (a dot and two or three words; the whole sentence for a screen reader and the pointer), then at the
// right the week's niche and cost and «Salir». Under it the tabs, the current one underlined, «Esta semana» carrying how
// many pains wait for your own mark. Below 768 px the brand row keeps the name, the pill and «Salir», and the week and
// its data go under the tabs (css/base.css). The name links home on every screen with a session (NAV-09); on the
// sign-in screens it is plain text, because there is no home yet and tapping it would only wipe the code being typed.
// The pill, the week and the count stay hidden until a load says what they are.
function masthead({ brandLink, actions, tab }) {
  const word = brandLink
    ? h("a", { class: "brand-word", href: "#/", "aria-label": T.brandHome, "aria-current": atHome() ? "page" : null }, T.brand)
    : h("span", { class: "brand-word" }, T.brand);
  const pillShort = h("span", { class: "run-pill-short", "aria-hidden": "true" });
  const pillLong = h("span", { class: "visually-hidden" });
  const pill = h("p", { class: "run-pill", "data-lamp": "off", hidden: true },
    h("span", { class: "run-pill-dot", "aria-hidden": "true" }), pillShort, pillLong);
  const week = h("p", { class: "masthead-week", hidden: true });
  const meta = h("p", { class: "masthead-meta", hidden: true });
  const count = h("span", { class: "tab-count", hidden: true });
  state.masthead = { pill, pillShort, pillLong, week, meta, count };
  refreshMasthead();
  return h("header", { class: "masthead" },
    word,
    brandLink ? week : null,
    pill,
    brandLink ? meta : null,
    actions.length ? h("div", { class: "masthead-actions" }, actions) : null,
    brandLink ? h("nav", { class: "tabs", "aria-label": T.tabsLabel }, TABS.map(([key, href, label]) =>
      h("a", { class: "tab", href, "aria-current": key === tab ? "page" : null }, T[label], key === "week" ? [" ", count] : null))) : null);
}

// The pill, the week's data and «Esta semana»'s count from the session's week (state.week) and the last «Para decidir»
// (state.waiting). The week's niche is a link to Nichos, its words unchanged, marked as the current page on Nichos.
function refreshMasthead() {
  const parts = state.masthead;
  if (!parts) return;
  const { week, waiting } = state;
  if (week) {
    const color = brandLamp(week.summary);
    const words = brandLampText(color);
    parts.pill.dataset.lamp = color;
    parts.pill.title = words;
    parts.pillShort.textContent = brandLampShort(week.summary);
    parts.pillLong.textContent = words;
    parts.pill.hidden = false;
  }
  const rows = week ? weekMeta(week.summary, week.latest) : [];
  const weekRow = rows.find((row) => row.label === T.metaWeek);
  const others = rows.filter((row) => row !== weekRow);
  parts.week.textContent = weekRow ? `${weekRow.label} ${weekRow.value}` : "";
  parts.week.hidden = !weekRow;
  replaceChildren(parts.meta, others.map((row) => h("span", { class: "meta-item" }, `${row.label} `,
    row.label === T.metaNiche
      ? h("a", { class: "meta-link", href: "#/nichos", "aria-current": parseRoute(location.hash).name === "niches" ? "page" : null }, h("b", {}, row.value))
      : h("b", {}, row.value))));
  parts.meta.hidden = !others.length;
  // The digit is for the eye; a screen reader hears it in words, after the tab's name.
  const pending = waiting ? waitingCount(waiting.items, waiting.marks, waiting.me) : 0;
  replaceChildren(parts.count, pending ? [
    h("span", { "aria-hidden": "true" }, formatNumber(pending)),
    h("span", { class: "visually-hidden" }, pending === 1 ? T.leadPendingOne : t("leadPendingMany", { count: formatNumber(pending) })),
  ] : []);
  parts.count.hidden = !pending;
}

// «Esta semana»'s count: the pains of «Para decidir» (decideList) as the last home or Catálogo load read them, with the
// marks known since. Unknown (no count shown) until one of them loads in the session.
function setWaiting(items, marks, me) {
  state.waiting = { items, marks, me };
  refreshMasthead();
}

// A mark from a pain's page counts at once, as one from the home does.
function countOwnMark(painId, next) {
  const waiting = state.waiting;
  if (!waiting) return;
  const marks = waiting.marks.filter((m) => !m || m.pain_id !== painId || lower(m.author) !== waiting.me);
  setWaiting(waiting.items, next ? [...marks, { pain_id: painId, author: waiting.me, mark: next }] : marks, waiting.me);
}

// «Salir» leaves the screen too: with a comment not yet published it asks first (NAV-06).
const signOutButton = () => h("button", { type: "button", class: "button button--secondary", onclick: () => leaveThen(signOut) },
  T.signOut);

// One frame for every screen (marco.md): the masthead, then the shell: inside <main> the context («← Volver»,
// optional), the title band, the notice zone and the body; beside it, from 1024 px, the side panel the home fills with
// the run's line (hidden on every other screen).
function frameLayout({ title, meta = [], brandLink = true, actions = [], context = null, tab = null, pageTitle = null }) {
  runCleanup(); // a new screen drops the last one's timers and its leave guard
  const heading = h("h1", { tabindex: "-1" }, title);
  const head = h("div", { class: "page-head", "data-rol": "cabecera" },
    heading,
    meta.filter(Boolean).map((line) => h("p", { class: "page-meta" }, line)));
  const notices = h("div", { class: "notices", "data-rol": "avisos" });
  const body = h("div", { class: "body", "data-rol": "cuerpo" });
  const side = h("aside", { class: "line-panel", "aria-label": T.lineLabel, hidden: true });
  const shell = h("div", { class: "shell" },
    h("main", { id: "main", class: context ? "has-context" : null },
      h("div", { "data-rol": "marco" }, context, head, notices, body)),
    side);
  replaceChildren(root, h("div", { class: "frame" }, masthead({ brandLink, actions, tab }), shell));
  setTitle(pageTitle || title);
  return { heading, head, notices, body, side, shell };
}

// A notice in the page, one at a time in its zone (MAR-04), never floating (COM-17).
// The notice carries a lamp of its tone (off for information, amber for a warning, red for an error) beside its words.
const NOTICE_LAMP = { info: "off", warning: "amber", error: "red" };
function showNotice(container, { tone = "info", text, actions = [] }) {
  const notice = h("div", { class: `notice notice--${tone}`, role: tone === "error" ? "alert" : "status" },
    lamp(NOTICE_LAMP[tone] || "off"), h("p", {}, text));
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

const SCREENS = new Map([
  ["#/catalogo", "catalog"], ["#/catalogo/", "catalog"], ["#/nichos", "niches"], ["#/nichos/", "niches"],
  ["#/corridas", "runs"], ["#/corridas/", "runs"],
]);

function parseRoute(hash) {
  if (SCREENS.has(hash)) return { name: SCREENS.get(hash) };
  const match = /^#\/(dolor|corridas)\/([^/?#]+)\/?$/.exec(hash || "");
  if (match) {
    let id = "";
    try { id = decodeURIComponent(match[2]); } catch { /* malformed: home */ }
    if (match[1] === "dolor" && PAIN_ID.test(id)) return { name: "pain", id };
    if (match[1] === "corridas" && RUN_ID.test(id)) return { name: "run", id };
  }
  return { name: "home" };
}

async function route() {
  const viewId = ++state.viewId;
  state.view = "routing";
  runCleanup();
  if (!state.session) return showSignIn();
  const target = parseRoute(location.hash);
  // Anything that is not a screen of its own is home.
  if (target.name === "home" && !atHome()) history.replaceState(null, "", `${location.pathname}${location.search}#/`);
  if (target.name !== "pain") state.focusComment = null;

  const email = state.session.user && state.session.user.email;
  const screen = ROUTE_SCREEN[target.name];
  const layout = frameLayout({
    title: T[screen.title],
    pageTitle: screen.pageTitle ? T[screen.pageTitle] : null,
    tab: screen.tab,
    context: target.name === "pain" ? backLink() : target.name === "run" ? backLink("#/corridas", T.runsBack, T.runsBackLabel) : null,
    actions: [signOutButton()],
  });
  layout.body.setAttribute("aria-busy", "true");
  layout.body.append(h("p", { class: "loading", role: "status" }, T.checkingAccess));

  const access = await readAccess(email);
  if (viewId !== state.viewId) return;
  if (access.kind === "expired") return sessionEnded();
  if (access.kind === "error") return showAccessError(access.error);
  if (access.kind === "no-access") return showNoAccess(email);
  if (target.name === "pain" || target.name === "runs" || target.name === "niches") ensureWeek();
  if (target.name === "pain") return showPain(layout, target.id, email);
  if (target.name === "catalog") return showCatalog(layout, email);
  if (target.name === "niches") return showNiches(layout, email);
  if (target.name === "runs") return showRuns(layout, email);
  if (target.name === "run") return showRun(layout, target.id, email);
  return showHome(layout, email);
}

// Each route's h1, the tab's title when it differs, and which tab is current.
const ROUTE_SCREEN = {
  home: { title: "homeTitle", pageTitle: "tabWeek", tab: "week" },
  catalog: { title: "catalogTitle", tab: "catalog" },
  niches: { title: "nichesTitle", tab: "niches" },
  runs: { title: "runsTitle", tab: "runs" },
  run: { title: "runTitle", tab: "runs" },
  pain: { title: "painTitle", tab: null },
};

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

// ---- the session's week: the masthead on every screen ----------------------------------------

// A pain, Nichos or Corridas opened first (a link, a reload) reads the week once for the session, so the brand lamp and the
// week's data are right there too; the home and Catálogo read it again with every load (loadInto). It never holds the
// screen up, and a failure only leaves the lamp off: the next such screen tries again. An answer that comes after the
// session ended, or after a home load already filled the week, is dropped. Returns what resolves to the session's week
// once known, or null when the read failed; it never rejects.
function ensureWeek() {
  if (state.week) return Promise.resolve(state.week);
  if (!state.weekLoad) {
    const load = loadWeek(supabase);
    state.weekLoad = load;
    load.then((week) => {
      if (state.weekLoad !== load) return;
      state.weekLoad = null;
      if (state.week) return;
      state.week = { summary: week.summary, latest: latestTrace(week.traces, week.summary) };
      refreshMasthead();
    }, () => { if (state.weekLoad === load) state.weekLoad = null; });
  }
  return state.weekLoad.then(() => state.week, () => null);
}

// ---- home: «Esta semana» -------------------------------------------------------------------

// A run that failed or is incomplete is a warning, also when it is old (then the tone follows its status).
const NOTICE_TONE = { failed: "warning", incomplete: "warning", "ingest-only": "info", none: "info" };

const lower = (value) => String(value ?? "").trim().toLowerCase();
const pad = (n) => String(n).padStart(2, "0");

// The home and the catalog keep the frame route() drew while checking access (same title), so the screen does not
// flash. While the pains load the body is busy and says so; it never says «no hay» before the answer (EST-02). A load
// also tells the masthead how the latest run went.
async function loadInto(layout, email, { loading, error: errorText }, render) {
  const viewId = state.viewId;
  layout.body.setAttribute("aria-busy", "true");
  replaceChildren(layout.body, h("p", { class: "loading", role: "status" }, loading));
  layout.heading.focus({ preventScroll: true });
  let home;
  try { home = await loadHome(supabase); }
  catch (error) {
    if (viewId !== state.viewId) return;
    return showLoadError(layout, error, email, errorText);
  }
  if (viewId !== state.viewId) return;
  state.week = { summary: home.summary, latest: latestTrace(home.traces, home.summary) };
  state.titles = titleMap(home.cards);
  refreshMasthead();
  render(layout, home, email);
}

function showHome(layout, email) {
  state.view = "home";
  return loadInto(layout, email, { loading: T.homeLoading, error: T.homeError }, renderHome);
}

function showCatalog(layout, email) {
  state.view = "catalog";
  return loadInto(layout, email, { loading: T.catalogLoading, error: T.homeError }, renderCatalog);
}

// The notice about the run (runNotice, homeNotice): failed, incomplete, only gathered, old. Returns runNotice's.
function showRunNotice(layout, home, { empty }) {
  const notice = runNotice(home.summary, new Date());
  const visible = homeNotice(notice, { empty });
  if (visible) {
    const tone = NOTICE_TONE[visible.kind === "stale" ? home.summary.status : visible.kind] || "info";
    showNotice(layout.notices, { tone, text: visible.text });
  }
  return notice;
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

// «Para decidir» (decideList) as numbered results, with the run's line beside them from 1024 px and as a folded strip
// under the title below. Over the results, the board (the summary strip) counts the whole catalog by state, each count
// a way into it.
function renderHome(layout, home, email) {
  const me = lower(email);
  const { latest } = state.week;
  const heading = lineHeading(latest, home.summary);
  const view = latest.trace ? lineView(latest.trace) : null;
  const items = decideList(home);
  const sections = catalogSections(home);
  const inCatalog = Object.values(sections).some((list) => list.length);
  const notice = showRunNotice(layout, home, { empty: !inCatalog });
  setWaiting(items, home.marks, me);

  // The panel only when there are stations to draw; otherwise the strip under the title says why, at every width.
  if (view && view.stages.length) {
    layout.side.hidden = false;
    layout.shell.classList.add("shell--line");
    replaceChildren(layout.side, h("div", { class: "line-panel-inner" },
      renderLine(latest.trace, { title: heading.title, note: heading.note, idPrefix: "linea" })));
  }
  const lead = h("p", { class: "page-lead", hidden: !items.length });
  layout.head.append(lead,
    renderLine(latest.trace, { compact: true, title: heading.title, note: heading.note, idPrefix: "franja",
      week: weekMeta(home.summary, latest) }));

  const blocks = [];
  // LIS-05 and EST-01: an empty catalog says so in one sentence and offers to load again, the way out last (MAR-06).
  if (!inCatalog) {
    blocks.push(h("div", { class: "stack", "data-rol": "vacio" },
      h("p", { class: "week-sentence" }, emptySentence(home.summary, notice)),
      h("button", { type: "button", class: "button button--primary", "data-rol": "accion-principal", onclick: route }, T.reload)));
  } else {
    const counts = board(sections);
    const refresh = () => {
      lead.textContent = decideLead(items, home.marks, me);
      counts.refresh(catalogSections(home));
      setWaiting(items, home.marks, me);
    };
    if (!items.length) {
      blocks.push(h("div", { class: "stack decide-empty", "data-rol": "vacio" },
        h("p", {}, T.decideEmpty),
        h("a", { class: "button button--primary", "data-rol": "accion-principal", href: "#/catalogo" }, T.seeCatalog)));
    }
    blocks.push(counts.element);
    if (items.length) blocks.push(stationList(items, { home, email, me, latest, view, onChange: refresh }));
    refresh();
  }
  layout.body.removeAttribute("aria-busy");
  layout.body.classList.add("home-body");
  replaceChildren(layout.body, blocks);
}

// The whole catalog by state: four counts, each a link to Catálogo. `refresh` recounts after a mark.
const BOARD = [["weighty", "boardWeighty"], ["interested", "boardInterested"], ["watching", "boardWatching"], ["discarded", "boardDiscarded"]];
function board(sections) {
  const figures = new Map(BOARD.map(([key]) => [key, h("strong", { class: "board-count" })]));
  const element = h("section", { class: "board", "aria-label": T.boardLabel },
    h("ul", { role: "list" }, BOARD.map(([key, label]) => h("li", {},
      h("a", { class: "board-cell", href: "#/catalogo" }, lamp(painLamp(key)), figures.get(key), h("span", { class: "board-label" }, T[label]))))));
  const refresh = (next) => BOARD.forEach(([key]) => { figures.get(key).textContent = formatNumber(next[key].length); });
  refresh(sections);
  return { element, refresh };
}

// «Resultados»: the results in decideList's order, numbered 01, 02…, one result per row.
function stationList(items, ctx) {
  const pains = new Map(ctx.home.pains.filter((p) => p && p.id).map((p) => [p.id, p]));
  return h("div", { class: "results" },
    h("p", { class: "section-label results-label", id: "resultados" }, T.resultsLabel),
    h("ol", { class: "stations", role: "list", "aria-labelledby": "resultados" },
      items.map((item, index) => station(item, index, { ...ctx, pain: pains.get(item.id) }))));
}

// One result, as the lab report's block. Its head: the number, the title as the link to the pain, its tags and its
// state flag at the right (a dot with the state in words, on a chip). Its body, in two columns that stack in a narrow
// block: at the left the duel's line (for the winner) and its box cells (checkCells: the counts the run judged it by
// against the run's own thresholds), or, without a gate, a line that says there is no analysis and why it is there
// in a facts line; at the right «Quién lo
// sufre», the trend and topic, the team's marks and «Nos interesa», «Descartar» and «Comentar». The duel's winner and
// the pains with weight are full results; the rest are compact (`station--compact`): one head row with the facts line
// in it, then the marks and the actions. Each button says what pressing it does, and names its pain for a screen reader
// (aria-describedby). A mark changes the result in place: a discarded pain stays until the next load, its dot off, so it
// can be undone with the same button.
function station(item, index, ctx) {
  const { home, me, pain } = ctx;
  const viewId = state.viewId;
  const titleId = `estacion-${index + 1}`;
  const href = `#/dolor/${encodeURIComponent(item.id)}`;
  const light = lamp(item.lamp, { size: "small" });
  const stateText = h("span", { class: "station-state-text" });
  const stateFlag = h("p", { class: "station-state" }, light, stateText);
  const tags = stationTags(item, { isThisWeek: ctx.latest.isThisWeek, dateLabel: ctx.view ? ctx.view.dateLabel : "" })
    .map((tag) => h("span", { class: `station-tag station-tag--${tag.kind}` }, tag.text));
  const meta = item.full ? stationMeta(item) : [];
  const checks = item.full ? checkCells(item.gate) : null;
  const facts = checks ? [] : stationFactLines(item.facts);
  const factsLine = facts.length
    ? h("p", { class: "station-facts" }, h("span", { class: "visually-hidden" }, `${T.factsLabel}: `), facts.join(" · ")) : null;
  const reason = item.facts && item.facts.duelReason;
  const marksLine = h("p", { class: "station-marks" });
  const interested = h("button", { type: "button", class: "button button--primary", "aria-describedby": titleId });
  const discard = h("button", { type: "button", class: "button button--secondary", "aria-describedby": titleId });
  const note = h("p", { class: "station-note", role: "status" });
  const comment = h("a", { class: "button button--quiet", href, "aria-describedby": titleId,
    onclick: () => { state.focusComment = item.id; } }, T.commentAction);

  const mine = () => {
    const own = home.marks.find((m) => m && m.pain_id === item.id && lower(m.author) === me);
    return own ? own.mark : null;
  };
  function refresh() {
    const section = pain ? sectionOf(pain, home.marks) : item.section;
    const color = painLamp(section);
    light.dataset.lamp = color;
    stateFlag.dataset.lamp = color;
    stateText.textContent = stationStateText(section);
    const labels = stationButtonLabels(mine());
    interested.textContent = labels.interested;
    discard.textContent = labels.discard;
    const lines = stationMarks(item.id, home.marks, home.people);
    marksLine.textContent = lines.length ? lines.join(" · ") : T.noMarksYet;
  }

  let busy = false;
  async function press(pressed) {
    if (busy) return;
    const next = nextMark(mine(), pressed);
    busy = true;
    [interested, discard].forEach((b) => b.setAttribute("aria-disabled", "true"));
    note.textContent = "";
    delete note.dataset.tone;
    let error = null;
    try { await setMark(supabase, item.id, next); } catch (err) { error = err; }
    busy = false;
    if (viewId !== state.viewId) return;
    [interested, discard].forEach((b) => b.removeAttribute("aria-disabled"));
    if (error) {
      const kind = sendErrorKind(error);
      if (kind === "expired") return sessionEnded();
      if (kind === "no-access") return showNoAccess(ctx.email);
      note.dataset.tone = "error";
      note.textContent = markErrorText(kind).text;
      return;
    }
    // The base keeps one mark per person; the page mirrors it without reading everything again.
    home.marks = home.marks.filter((m) => !m || m.pain_id !== item.id || lower(m.author) !== me);
    if (next) home.marks.push({ pain_id: item.id, author: me, mark: next, created_at: new Date().toISOString() });
    refresh();
    ctx.onChange();
    note.textContent = next === "discarded" ? discardNote(pain, home.marks) : next === "interested" ? T.markSavedInterested : T.markRemoved;
  }
  interested.addEventListener("click", () => press("interested"));
  discard.addEventListener("click", () => press("discarded"));
  refresh();

  // The left column: the duel's line, said as what it is, then the analysis; when there is none, a line that says so
  // where the cells would be, and why it is there.
  const main = [
    reason ? h("p", { class: "station-duel" }, h("span", { class: "station-duel-label" }, T.duelReasonLabel), " ", reason) : null,
    checks,
    item.full && !checks ? h("p", { class: "analysis-none" }, T.analysisNone) : null,
    item.full && !checks ? factsLine : null,
  ].filter(Boolean);
  return h("li", { class: item.full ? "station" : "station station--compact", "aria-labelledby": titleId },
    h("div", { class: "station-head" },
      h("div", { class: "station-name" },
        h("span", { class: "station-number", "aria-hidden": "true" }, pad(index + 1)),
        h("h2", { class: "station-title", id: titleId }, h("a", { href }, item.title))),
      tags.length ? h("p", { class: "station-tags" }, tags) : null,
      item.full ? null : factsLine,
      stateFlag),
    h("div", { class: main.length ? "station-body" : "station-body station-body--single" },
      main.length ? h("div", { class: "station-main" }, main) : null,
      h("div", { class: "station-side" },
        item.full && item.who
          ? h("p", { class: "station-who" }, h("span", { class: "section-label" }, T.whoLabel), h("span", { class: "visually-hidden" }, ": "), item.who)
          : null,
        meta.length ? h("p", { class: "station-meta" }, meta.join(" · ")) : null,
        h("div", { class: "station-foot" },
          marksLine,
          h("div", { class: "station-actions" }, interested, discard, comment),
          note))));
}

// ---- Catálogo: every pain by state --------------------------------------------------------

// Every pain by state (catalogView): one section per state with its count, in the board's order, each a list of dense
// rows. A section with no pain says so; with no pain anywhere the screen says so once and offers to load again, the way
// out last (LIS-05, EST-01, MAR-06). The run's notice stays: it says how old the list is.
function renderCatalog(layout, home, email) {
  setWaiting(decideList(home), home.marks, lower(email));
  const view = catalogView(home);
  const notice = showRunNotice(layout, home, { empty: view.empty });
  const blocks = view.empty
    ? [h("div", { class: "stack", "data-rol": "vacio" },
      h("p", { class: "week-sentence" }, emptySentence(home.summary, notice)),
      h("button", { type: "button", class: "button button--primary", "data-rol": "accion-principal", onclick: route }, T.reload))]
    : view.sections.map(catalogSection);
  layout.body.removeAttribute("aria-busy");
  layout.body.classList.add("catalog-body");
  replaceChildren(layout.body, blocks);
}

// A section, as one of the report's result tables: a hairline-bordered sheet, its head band on the section tint with
// the lamp and the heading with the count, then its rows (and «Ver 20 más» at its foot) or the sentence that says it has
// none. The discarded ones are folded away, since few need them (COM-06); their h2 is in the fold's summary, the band.
function catalogSection(section) {
  const id = `seccion-${section.key}`;
  const heading = h("h2", { id, class: "catalog-heading" }, lamp(section.lamp), h("span", {}, section.heading));
  if (!section.count) {
    return h("section", { class: "catalog-section sheet", "aria-labelledby": id },
      h("div", { class: "sheet-head" }, heading), h("p", { class: "catalog-empty" }, section.emptyText));
  }
  const rows = painList(section.items, (item) => painRow(item, section));
  if (section.key === "discarded") {
    return h("details", { class: "catalog-section catalog-fold sheet" }, h("summary", { class: "sheet-head catalog-summary" }, heading), rows);
  }
  return h("section", { class: "catalog-section sheet", "aria-labelledby": id }, h("div", { class: "sheet-head" }, heading), rows);
}

// One row per pain, dense: its lamp and its state in words, the title as the link to it (the whole row is its target),
// who suffers it, then the trend and topic and the team's marks (LIS-01). The pain id only travels in the address.
function painRow(item, section) {
  const meta = stationMeta(item);
  const marks = rowMarks(item);
  return h("li", { class: "pain-row" },
    h("p", { class: "pain-state" }, lamp(section.lamp), h("span", {}, section.state)),
    h("div", { class: "pain-main" },
      h("h3", { class: "pain-title" }, h("a", { href: `#/dolor/${encodeURIComponent(item.id)}` }, item.title)),
      item.who ? h("p", { class: "pain-who" }, h("span", { class: "visually-hidden" }, `${T.whoLabel}: `), item.who) : null),
    h("div", { class: "pain-side" },
      meta.length ? h("p", { class: "pain-meta" }, meta.join(" · ")) : null,
      h("p", { class: marks.length ? "pain-marks" : "pain-marks is-empty" }, marks.length ? marks.join(" · ") : T.noMarksYet)));
}

// LIS-04: past 50 rows the list shows 20, and «Ver 20 más» adds the next ones; the focus goes to the first row added.
function painList(items, row) {
  const list = h("ul", { class: "pain-list", role: "list" });
  const more = h("button", { type: "button", class: "link-button more-button" });
  let count = 0;
  function showUpTo(next) {
    const added = items.slice(count, next).map(row);
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

// ---- Nichos: the week's niche and why, every candidate, and the veto -----------------------

// Nichos keeps the frame route() drew (same title), so the screen does not flash. It reads the traces, the proposed
// niches, the vetoes and the pains at once (loadNiches), with the session's week (ensureWeek: its summary says whether
// the niche's run is this week's; a week that failed to load reads as an older one), and draws the board (nicheBoard):
// no sounding yet says so and offers to load again, a secondary action since nothing changes until Monday's run, the
// way out last (EST-01, MAR-06).
async function showNiches(layout, email) {
  state.view = "niches";
  const viewId = state.viewId;
  layout.body.setAttribute("aria-busy", "true");
  replaceChildren(layout.body, h("p", { class: "loading", role: "status" }, T.nichesLoading));
  layout.heading.focus({ preventScroll: true });
  let data;
  try {
    const [niches, week] = await Promise.all([loadNiches(supabase), ensureWeek()]);
    data = { ...niches, summary: week ? week.summary : null };
  } catch (error) {
    if (viewId !== state.viewId) return;
    return showLoadError(layout, error, email, T.nichesError);
  }
  if (viewId !== state.viewId) return;
  layout.body.removeAttribute("aria-busy");
  layout.body.classList.add("niches-body");
  if (nicheBoard(data).empty) {
    replaceChildren(layout.body, h("div", { class: "stack", "data-rol": "vacio" },
      h("p", { class: "week-sentence" }, T.nichesEmpty),
      h("button", { type: "button", class: "button button--secondary", onclick: route }, T.reload)));
    return;
  }
  layout.head.append(h("p", { class: "page-lead" }, T.nichesLead));
  renderNiches(layout, { data, email, viewId, busy: false, buttons: new Map() });
}

// The board from the screen's data, drawn whole: «ESTA SEMANA», the niche that ran as a result block, then
// «CANDIDATOS», every niche in one table. A veto redraws it from the data with the veto mirrored (withVeto).
function renderNiches(layout, ctx) {
  const board = nicheBoard(ctx.data);
  ctx.buttons = new Map();
  replaceChildren(layout.body, nicheWeek(board.week, ctx, layout), nicheCandidates(board.rows, ctx, layout));
}

// A count said with its numbers in bold («<b>3</b> con peso · <b>12</b> en obs.»), as the report sets its figures.
const NUMBER_RUN = /(\d+(?:[.  ]\d{3})*)/;
const boldNumbers = (text) => String(text).split(NUMBER_RUN).map((part, i) => (i % 2 ? h("b", {}, part) : part)).filter((part) => part !== "");

// A missing figure: a dash for the eye, words for a screen reader.
const noValue = () => [h("span", { "aria-hidden": "true" }, "—"), h("span", { class: "visually-hidden" }, T.nicheNoValue)];

// The veto's button for a niche, in the week's block (`week`) or its row (`row`), with its note (role="status") beside
// it. It works like the marks' buttons: one veto at a time, aria-disabled while it is sent; a session that ended goes
// back to signing in, someone the base refuses sees «sin permiso», any other failure says so in the note and the
// button works again. Once the base took it, the board is redrawn with the veto mirrored, the focus goes back to the
// same niche's button in the same place, and its note says what changed.
function vetoControl(row, place, ctx, layout, nameId) {
  const label = row.vetoed ? T.nicheUnveto : place === "week" ? T.nicheVetoWeek : T.nicheVeto;
  const button = h("button", {
    type: "button", class: `button ${row.vetoed ? "button--primary" : "button--secondary"} niche-veto`, "aria-describedby": nameId,
  }, label);
  const note = h("p", { class: "station-note niche-veto-status", role: "status" });
  const key = `${place}:${row.id}`;
  ctx.buttons.set(key, { button, note });
  button.addEventListener("click", async () => {
    if (ctx.busy) return;
    const vetoed = !row.vetoed;
    ctx.busy = true;
    const all = [...ctx.buttons.values()];
    all.forEach((b) => b.button.setAttribute("aria-disabled", "true"));
    all.forEach((b) => { b.note.textContent = ""; delete b.note.dataset.tone; });
    let error = null;
    try { await setNicheVeto(supabase, row.id, vetoed); } catch (err) { error = err; }
    ctx.busy = false;
    if (ctx.viewId !== state.viewId) return;
    if (error) {
      all.forEach((b) => b.button.removeAttribute("aria-disabled"));
      const kind = sendErrorKind(error);
      if (kind === "expired") return sessionEnded();
      if (kind === "no-access") return showNoAccess(ctx.email);
      note.dataset.tone = "error";
      note.textContent = kind === "network" ? T.nicheVetoOffline : T.nicheVetoError;
      return;
    }
    ctx.data = withVeto(ctx.data, { name: row.id, vetoed, by: lower(ctx.email), at: new Date().toISOString() });
    renderNiches(layout, ctx);
    const next = ctx.buttons.get(key);
    if (!next) { layout.heading.focus({ preventScroll: true }); return; }
    next.button.focus();
    // The note is in the page before its words change, so a screen reader announces them.
    const done = fill(vetoed ? T.nicheVetoDone : T.nicheVetoUndone, { name: row.name });
    requestAnimationFrame(() => { if (ctx.viewId === state.viewId) next.note.textContent = done; });
  });
  return { button, note };
}

// «ESTA SEMANA»: the niche that ran as the report's result block. Its head: the name, where it came from and its state
// on a chip, the same words and lamp as its row («Corrió esta semana», «Corrió el <día>», «Se eligió el <día>; la
// corrida falló», or «Vetado · …»). Its body: why it was chosen, then the week's sounding as an analysis
// table, each side against the other niches (the versus bar: a tick per rival and the niche's marker, hidden from a
// screen reader, its place in words beside it); at the right its pains, the veto and what a veto does now.
function nicheWeek(week, ctx, layout) {
  const { row } = week;
  const nameId = "nicho-semana";
  const pains = painsText(row.pains, { retired: row.state === "retired" });
  const control = row.canVeto ? vetoControl(row, "week", ctx, layout, nameId) : null;
  return h("section", { class: "results niche-week-section", "aria-labelledby": "esta-semana" },
    h("p", { class: "section-label results-label", id: "esta-semana" }, T.nicheWeekLabel),
    h("div", { class: "station niche-week" },
      h("div", { class: "station-head" },
        h("div", { class: "station-name" }, h("h2", { class: "station-title", id: nameId }, row.name)),
        h("p", { class: "station-tags" }, h("span", { class: "station-tag niche-origin-tag" }, row.originText)),
        h("p", { class: "station-state", "data-lamp": row.lamp },
          lamp(row.lamp, { size: "small" }), h("span", { class: "station-state-text" }, row.stateText))),
      h("div", { class: "station-body" },
        h("div", { class: "station-main" },
          h("p", { class: "station-duel niche-why" }, h("span", { class: "station-duel-label" }, T.nicheWhyLabel), " ", week.why),
          nicheAnalysis(week)),
        h("div", { class: "station-side" },
          h("p", { class: "section-label niche-side-label", id: "sus-dolores" }, T.nicheOwnPains),
          h("ul", { class: "niche-side-list", role: "list", "aria-labelledby": "sus-dolores" },
            ...(pains.none ? [h("li", {}, pains.none)] : pains.week.map((line) => h("li", {}, boldNumbers(line)))),
            week.advanced ? h("li", {}, boldNumbers(week.advanced)) : null,
            h("li", {}, boldNumbers(paidRunsText(row.paidRuns, { long: true })))),
          h("div", { class: "station-foot" },
            h("p", { class: "station-marks" }, row.vetoNote ?? (row.vetoed ? row.stateText : T.nicheNoVeto)),
            control ? h("div", { class: "station-actions" }, control.button) : null,
            control ? control.note : null,
            h("p", { class: "niche-veto-next" }, week.vetoNext))))));
}

// The week's sounding: «Quejas reales», «Gasto real» and «Ruido», as a table with explicit roles (its rows are laid
// out as grids, and a table whose CSS display is changed can lose its semantics in some browsers). The versus bar only
// where there is a value to place.
function nicheAnalysis(week) {
  const rivals = Math.max(0, ...week.analysis.map((a) => a.positions.length));
  const caption = week.date ? fill(T.nicheProbeCaption, { date: week.date }) : T.nicheProbeCaptionUndated;
  const versus = (a) => (a.at === null || a.flag === null ? null : h("span", { class: "versus", "aria-hidden": "true" },
    a.positions.map((at) => h("span", { class: "versus-tick", style: `--at: ${at}%` })),
    h("span", { class: "versus-at", style: `--at: ${a.at}%` })));
  return h("table", { class: "analysis niche-analysis", role: "table" },
    h("caption", { class: "analysis-caption" }, caption),
    h("thead", { role: "rowgroup" }, h("tr", { role: "row" },
      h("td", { class: "analysis-corner", role: "cell" }),
      h("th", { scope: "col", role: "columnheader" }, T.analysisValueLabel),
      h("th", { scope: "col", role: "columnheader" }, versusLabel(rivals)),
      h("th", { scope: "col", role: "columnheader" }, T.analysisFlagLabel))),
    h("tbody", { role: "rowgroup" }, week.analysis.map((a) => h("tr", { class: "analysis-row", role: "row", "data-flag": a.flag },
      h("th", { scope: "row", role: "rowheader", class: "analysis-label" }, a.label),
      h("td", { class: "analysis-value", role: "cell" }, a.value ?? noValue()),
      h("td", { class: "analysis-range", role: "cell" }, versus(a), a.rank ? h("span", { class: "analysis-range-text" }, a.rank) : null),
      h("td", { class: "analysis-flag", role: "cell" }, a.flag
        ? h("span", { class: `range-flag range-flag--${a.flag}` }, lamp(a.flag === "in" ? "green" : "red", { size: "small" }), a.flagText)
        : null)))),
    week.note ? h("tfoot", { role: "rowgroup" }, h("tr", { role: "row" }, h("td", { class: "analysis-note", role: "cell", colspan: 4 }, week.note))) : null);
}

// «CANDIDATOS»: one table, a row per niche (a <th scope="row"> with its name, where it came from and, for a proposed
// one, why), its state in words, quejas, gasto and ruido, its pains and its veto. Below 900 px each row is a stacked
// block (css/base.css): the explicit roles keep it a table, and each figure says its column (data-label).
const QUIET_STATES = new Set(["resting", "vetoed", "retired"]);
function nicheCandidates(rows, ctx, layout) {
  const col = (text, cls = null) => h("th", { scope: "col", role: "columnheader", class: cls }, text);
  return h("section", { class: "niche-candidates", "aria-labelledby": "candidatos" },
    h("p", { class: "section-label niche-candidates-label", id: "candidatos" }, T.nicheCandidatesLabel),
    h("div", { class: "sheet" },
      h("table", { class: "niche-table", role: "table", "aria-labelledby": "candidatos" },
        h("thead", { role: "rowgroup" }, h("tr", { role: "row" },
          col(T.nicheColState), col(T.nicheColName),
          col(T.nicheColComplaints, "niche-num"), col(T.nicheColSpending, "niche-num"), col(T.nicheNoise, "niche-num"),
          col(T.nicheOwnPains), col(h("span", { class: "visually-hidden" }, T.nicheColVeto)))),
        h("tbody", { role: "rowgroup" }, rows.map((row, index) => nicheRow(row, index, ctx, layout)))),
      h("p", { class: "niche-table-foot" }, T.nicheFootnote)));
}

function nicheRow(row, index, ctx, layout) {
  const nameId = `nicho-${index + 1}`;
  const pains = painsText(row.pains, { retired: row.state === "retired" });
  const control = row.canVeto ? vetoControl(row, "row", ctx, layout, nameId) : null;
  const figure = (label, value, extra = null) => h("td", { role: "cell", class: "niche-num", "data-label": label }, value ?? noValue(), extra);
  const unmeasured = row.noise === T.nicheNoiseUnmeasured;
  // The faint green of the niche that ran only when its run did run: a failed one keeps the plain row beside its red.
  const ran = row.state === "current" && row.lamp === "green";
  const classes = [ran ? "niche-row--current" : null, QUIET_STATES.has(row.state) ? "niche-row--quiet" : null];
  return h("tr", { role: "row", class: classes.filter(Boolean).join(" ") || null },
    h("td", { role: "cell", class: "niche-cell-state" },
      h("span", { class: "niche-state", "data-lamp": row.lamp }, lamp(row.lamp, { size: "small" }), row.stateText),
      row.stateNote ? h("span", { class: "niche-state-note" }, row.stateNote) : null),
    h("th", { scope: "row", role: "rowheader", class: "niche-cell-name" },
      h("span", { class: "niche-name", id: nameId }, row.name),
      h("span", { class: "niche-origin" }, `${row.originText} · ${paidRunsText(row.paidRuns)}`),
      row.why ? h("span", { class: "niche-why" }, row.why) : null),
    figure(T.nicheColComplaints, row.complaints === null ? null : formatNumber(row.complaints)),
    figure(T.nicheColSpending, row.spending === null ? null : formatNumber(row.spending)),
    unmeasured
      ? figure(T.nicheNoise, [h("span", { "aria-hidden": "true" }, "—")], h("small", {}, row.noise))
      : figure(T.nicheNoise, row.noise),
    h("td", { role: "cell", class: "niche-cell-pains" }, pains.none
      ?? [h("span", { "aria-hidden": "true" }, pains.short.map((line) => h("span", { class: "niche-pains-line" }, boldNumbers(line)))),
        h("span", { class: "visually-hidden" }, pains.full)]),
    h("td", { role: "cell", class: "niche-cell-action" },
      control ? control.button : null,
      row.vetoNote ? h("span", { class: "niche-who" }, row.vetoNote) : null,
      control ? control.note : null));
}

// ---- Corridas: what the workflow did, week by week -----------------------------------------

// Corridas keeps the frame route() drew (same title), so the screen does not flash. Only runs that left their trace
// come back (run_traces), newest first.
async function showRuns(layout, email) {
  state.view = "runs";
  const viewId = state.viewId;
  layout.body.setAttribute("aria-busy", "true");
  replaceChildren(layout.body, h("p", { class: "loading", role: "status" }, T.runsLoading));
  layout.heading.focus({ preventScroll: true });
  let traces;
  try { traces = await loadRuns(supabase); }
  catch (error) {
    if (viewId !== state.viewId) return;
    return showLoadError(layout, error, email, T.runsError);
  }
  if (viewId !== state.viewId) return;
  const rows = runRows(traces);
  layout.body.removeAttribute("aria-busy");
  layout.body.classList.add("runs-body");
  if (!rows.length) {
    // EST-01: no run yet says so and offers to load again, the way out last (MAR-06).
    replaceChildren(layout.body, h("div", { class: "stack", "data-rol": "vacio" },
      h("p", { class: "week-sentence" }, T.runsEmpty),
      h("button", { type: "button", class: "button button--primary", "data-rol": "accion-principal", onclick: route }, T.reload)));
    return;
  }
  layout.head.append(h("p", { class: "page-lead" }, T.runsLead));
  // LIS-04: past 50 runs the list shows 20 at a time (painList).
  const [list, more] = painList(rows, runListRow);
  list.className = "run-list";
  list.setAttribute("aria-label", T.runsListLabel);
  // The sheet's head band names the columns for the eye, once the rows have them (from 720 px); each row says its parts
  // in words, so a screen reader skips it.
  const columns = h("div", { class: "sheet-head run-columns", "aria-hidden": "true" },
    h("span", { class: "section-label" }, T.lineColFlag),
    h("span", { class: "section-label" }, T.runTitle),
    h("span", { class: "section-label run-columns-mini" }, T.runMiniLabel));
  replaceChildren(layout.body, h("div", { class: "sheet run-sheet" }, columns, list, more));
}

// One run, dense: its lamp and its state in words, its date as the link to it (the whole row is its target), its niche,
// how long it took, its cost and its new pains; then the mini line, each stage's lamp and count, and how many stages had
// a cut in words (the lamps are only drawn: the words beside them say it). Every lamp is drawn in its final state on
// the first paint: the lab report has no lighting sequence.
function runListRow(row) {
  const mini = row.hasCounts
    ? h("div", { class: "run-mini" },
      h("ol", { class: "run-mini-stages", role: "list", "aria-label": T.runMiniLabel }, row.stages.map((stage) => h("li", {},
        lamp(stage.lamp, { size: "small" }),
        h("span", { class: "visually-hidden" }, `${stage.label}: `),
        h("span", { class: stage.count === null ? "run-mini-count is-empty" : "run-mini-count" }, stage.count ?? "–"),
        stage.count === null ? h("span", { class: "visually-hidden" }, T.stageNoData) : null))),
      h("p", { class: "run-mini-state" }, row.cutStages))
    : h("p", { class: "run-mini run-mini--none" }, T.runMiniNone);
  return h("li", { class: "run-row" },
    h("p", { class: "run-state" }, lamp(row.lamp), h("span", {}, row.state)),
    h("div", { class: "run-main" },
      h("h2", { class: "run-title" }, h("a", { href: row.href }, row.title)),
      row.facts.length ? h("p", { class: "run-facts" }, row.facts.join(" · ")) : null),
    mini);
}

// One run opened: it reads the runs again (the list is a year at most) and, for the masthead, the session's week (it
// never holds the screen up). A run not in the list (no trace, or an address typed by hand) says so and points back
// to the list.
async function showRun(layout, id, email) {
  state.view = "run";
  const viewId = state.viewId;
  layout.body.setAttribute("aria-busy", "true");
  replaceChildren(layout.body, h("p", { class: "loading", role: "status" }, T.runsLoading));
  layout.heading.focus({ preventScroll: true });
  ensureWeek();
  let traces;
  try { traces = await loadRuns(supabase); }
  catch (error) {
    if (viewId !== state.viewId) return;
    return showLoadError(layout, error, email, T.runsError);
  }
  if (viewId !== state.viewId) return;
  const trace = traces.find((t) => t.run_id === id);
  if (!trace) {
    layout.body.removeAttribute("aria-busy");
    showNotice(layout.notices, { tone: "info", text: T.runMissing });
    replaceChildren(layout.body, h("a", { class: "button button--primary", "data-rol": "accion-principal", href: "#/corridas" }, T.seeAllRuns));
    return;
  }
  // The duels go by the cards' titles: the last home's, and a fresh read of the ones this run names (it wins). A failed
  // read only leaves them in plain words.
  const fresh = await loadTitles(supabase, duelIds(trace));
  if (viewId !== state.viewId) return;
  const titles = new Map([...(state.titles ?? []), ...fresh]);
  renderRun(layout, trace, titles);
}

// The run's sections: the cost, the cuts and the duels in words, each with what it says when it has none; then
// «Detalle técnico», closed, the only place where the run's raw texts show.
function runSection(key, title, items, emptyText, list = "ul") {
  const id = `corrida-${key}`;
  return h("section", { class: "run-section sheet", "aria-labelledby": id },
    h("div", { class: "sheet-head" }, h("h2", { id }, title)),
    items.length ? h(list, { class: `run-${key}-list`, role: list === "ul" ? "list" : null }, items) : h("p", { class: "run-empty" }, emptyText));
}

function technicalPart(title, items) {
  return items.length ? h("div", { class: "tech-part" }, h("h3", {}, title), h("ul", { role: "list" }, items)) : null;
}

function renderRun(layout, trace, titles) {
  const title = runTitle(trace);
  layout.heading.textContent = title;
  setTitle(title);
  const status = runState(trace.status);
  const keys = runKeys(trace);
  layout.head.classList.add("run-head");
  // Element.append writes a null as the text «null»: only what exists goes in.
  layout.head.append(...[
    h("p", { class: "detail-status", "data-lamp": status.lamp }, lamp(status.lamp), h("span", {}, status.text)),
    keys.length ? h("ul", { class: "key-data", role: "list" }, keys.map(keyItem)) : null,
  ].filter(Boolean));

  const costs = runCostLines(trace);
  const cuts = runCutLines(trace);
  const duels = runDuelLines(trace, titles);
  const tech = runTechnical(trace, titles);
  const counted = Array.isArray(trace.funnel) && trace.funnel.some((stage) => stage && typeof stage.count === "number");
  const technical = h("details", { class: "run-tech sheet" },
    h("summary", { class: "sheet-head" }, T.techTitle),
    h("div", { class: "run-tech-body" },
      h("p", { class: "run-tech-lead" }, T.techLead),
      tech.empty ? h("p", { class: "run-empty" }, T.techNone) : null,
      technicalPart(T.techCuts, tech.cuts.map((line) => h("li", {}, h("p", { class: "raw" }, line)))),
      technicalPart(T.techNotes, tech.notes.map((n) => h("li", {}, h("p", { class: "raw-label" }, n.label), h("p", { class: "raw" }, n.text)))),
      technicalPart(T.techReasons, tech.reasons.map((r) => h("li", {}, h("p", { class: "raw-label" }, r.label), h("p", { class: "raw" }, r.text))))));

  layout.body.removeAttribute("aria-busy");
  layout.body.classList.add("run-body");
  replaceChildren(layout.body, h("div", { class: "run-detail" },
    h("div", { class: "run-line" }, renderLine(trace, {
      idPrefix: "corrida-linea", costs: false, otherCuts: false,
      note: counted ? null : T.runMiniNone })),
    h("div", { class: "run-sections" },
      runSection("costo", T.runCostTitle, costs.map((row) => h("div", { class: row.total ? "run-cost run-cost--total" : "run-cost" },
        h("dt", {}, row.label), h("dd", {}, row.value))), T.runCostNone, "dl"),
      runSection("recortes", T.runCutsTitle, cuts.map((line) => h("li", {}, line)), T.runCutsNone),
      runSection("duelos", T.runDuelsTitle, duels.map((line) => h("li", {}, line)), T.runDuelsNone),
      technical)));
}

// ---- a pain: its card, the team's marks and comments (the manual's «detalle» pattern) ------

// «← Volver» on one line; its accessible name says where it goes (MAR-14). A pain goes back to the list, an opened run
// to Corridas.
const backLink = (href = "#/", text = T.back, label = T.backToList) => h("a", { class: "back-link", href, "aria-label": label }, text);

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

// A section of the card, as a section of the report: a hairline-bordered sheet, its h2 on the head band, then its
// paragraphs, its quotes or its glossary (a <dl>, DET-08). Inside it nothing is boxed again (DET-09): its rows are
// divided by hairlines.
function cardSection(section, ...extra) {
  const headingId = `${section.id}-titulo`;
  return h("section", { class: "section detail-section sheet", id: section.id, "aria-labelledby": headingId },
    h("div", { class: "sheet-head" }, h("h2", { id: headingId, tabindex: "-1" }, section.title)),
    h("div", { class: "sheet-body" },
      section.paragraphs.map((text) => h("p", {}, text)),
      section.quotes && section.quotes.length ? h("ul", { class: "quotes", role: "list" }, section.quotes.map(quoteItem)) : null,
      section.glossary && section.glossary.length
        ? h("dl", { class: "glossary" }, section.glossary.map((g) => h("div", { class: "glossary-row" }, h("dt", {}, g.term), h("dd", {}, g.meaning))))
        : null,
      extra));
}

// ---- «Cómo llegamos a este dolor» ----

// One row of the attacks or the duels: its lamp and its result in words, then what was asked (or whom it faced) and,
// when the card has it, its plain line. No plain line, no empty box (Review Focus 4).
function howRow(color, result, main, plain) {
  return h("li", { class: "how-row" },
    h("p", { class: "how-result" }, lamp(color), h("span", {}, result)),
    h("div", { class: "how-main" },
      h("p", { class: "how-question" }, main),
      plain ? h("p", { class: "how-plain" }, plain) : null));
}

// One quote, verbatim and in its language (its lang attribute), with its day and its link.
function howQuote(quote) {
  return h("li", { class: "how-quote" },
    h("blockquote", { lang: quote.language }, h("p", {}, quote.quote)),
    quote.date || quote.url ? h("p", { class: "how-quote-meta" },
      quote.date ? h("span", {}, quote.date) : null,
      quote.url ? h("a", { class: "how-quote-link", href: quote.url, target: "_blank", rel: "noopener noreferrer" }, T.seeSource) : null) : null);
}

// A source: its name and kind, how many quotes, the newest three and «Ver N más» for the rest. The focus goes to the
// first quote added (its item, so a screen reader starts at the quote and not at its «Ver la fuente» link).
function howSource(group, index) {
  const id = `fuente-${index + 1}`;
  const list = h("ul", { class: "how-quotes", role: "list" }, group.quotes.slice(0, group.shown).map(howQuote));
  const more = group.more ? h("button", { type: "button", class: "link-button more-button" }, t("showMore", { count: group.more })) : null;
  if (more) {
    more.addEventListener("click", () => {
      const added = group.quotes.slice(group.shown).map(howQuote);
      list.append(...added);
      more.remove();
      added[0].setAttribute("tabindex", "-1");
      added[0].focus();
    });
  }
  const count = group.quotes.length === 1 ? T.quoteCountOne : t("quoteCountMany", { count: formatNumber(group.quotes.length) });
  return h("section", { class: "how-source", "aria-labelledby": id },
    h("div", { class: "how-source-head" },
      h("h4", { id }, group.source),
      h("p", { class: "how-source-kind" }, `${group.kind} · ${count}`)),
    list, more);
}

// The section's body: the quotes by source, the attacks of the latest run, and its duels; each part only when it has
// something to tell.
function howBody(view) {
  const part = (key, title, ...content) => h("div", { class: "how-part" }, h("h3", { class: "how-heading", id: `como-${key}` }, title), content);
  return [
    view.sources.length ? part("citas", T.howQuotesTitle,
      h("p", { class: "how-lead" }, T.howQuotesLead),
      h("div", { class: "how-sources" }, view.sources.map(howSource))) : null,
    view.attacks.length ? part("preguntas", T.howAttacksTitle,
      h("ul", { class: "how-rows", role: "list", "aria-labelledby": "como-preguntas" },
        view.attacks.map((a) => howRow(a.held ? "green" : "red", a.result, a.question, a.plain)))) : null,
    view.duels.length ? part("duelos", view.duels.length === 1 ? T.howDuelTitle : T.howDuelsTitle,
      h("ul", { class: "how-rows", role: "list", "aria-labelledby": "como-duelos" },
        view.duels.map((d) => howRow(d.won ? "green" : "amber", d.result,
          d.known ? t("duelAgainst", { title: d.againstTitle }) : T.duelAgainstOther, d.plain)))) : null,
  ];
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
    h("nav", { class: "detail-index detail-index--wide sheet", "data-rol": "lateral", "aria-label": T.indexLabel },
      h("p", { class: "sheet-head section-label", "aria-hidden": "true" }, T.indexLabel), links()),
  ];
}

function renderPain(layout, id, email, data) {
  const viewId = state.viewId;
  const view = { marks: [...data.marks], comments: [...data.comments] };
  const title = cardTitle(data.card);
  layout.heading.textContent = title;
  setTitle(title);

  // ---- the header (DET-01, DET-12): the status tag, the key data, then the marks as its actions (MAR-06) ----
  const tag = h("span", {});
  const statusLamp = lamp("off");
  const statusRow = h("p", { class: "detail-status", "data-lamp": "off" }, statusLamp, tag);
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
    const section = painStatus(data.pain, view.marks);
    const label = statusLabel(section);
    tag.textContent = label || "";
    statusLamp.dataset.lamp = painLamp(section);
    statusRow.dataset.lamp = statusLamp.dataset.lamp;
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
    countOwnMark(id, next);
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

  // ---- the body: the line card's notice, or the index; then the sections, «Cómo llegamos» before the marks ----
  // The rivals' titles read with the pain win over the last home's (a pain opened from the email has only those).
  const titles = new Map([...(state.titles ?? []), ...(data.titles ?? [])]);
  const how = howWeGot(data.card, data.pain, titles);
  const sections = cardSections(data.card);
  if (how) sections.splice(sections.length - 1, 0, { id: "como-llegamos", title: T.secHowWeGot, paragraphs: [] });
  const blocks = sections.map((section) => {
    if (section.id === "marcas") {
      return cardSection(section,
        h("h3", {}, T.marksTitle), marksList, noMarks,
        commentsHeading, commentList, noComments,
        form, live);
    }
    if (section.id === "como-llegamos") return cardSection(section, howBody(how));
    return cardSection(section);
  });
  // The card opens with its box cells (checkCells: the counts the run judged it by against the run's own
  // thresholds) on a panel that is its container; a pain stored before the gate existed has none, claims nothing, and
  // says so in one line where the panel would be.
  const checks = checkCells(data.pain.gate);
  const analysis = checks ? h("div", { class: "detail-analysis" }, checks) : h("p", { class: "analysis-none" }, T.analysisNone);
  layout.body.removeAttribute("aria-busy");
  if (isLineCard(data.card)) {
    replaceChildren(layout.body, h("div", { class: "detail-sections" },
      h("div", { class: "notice detail-notice" }, lineNotice), analysis, blocks));
  } else {
    // On a phone the index is a fold under the analysis; from 672 px it is a column beside the sections.
    const [foldIndex, wideIndex] = sectionIndex(sections);
    replaceChildren(layout.body, h("div", { class: "detail-layout" },
      wideIndex, h("div", { class: "detail-sections" }, analysis, foldIndex, blocks)));
  }
  refreshHeader();
  refreshMarks();
  refreshComments();
  // «Comentar» on a station of the home opens the pain with its comment field ready.
  if (state.focusComment === id) {
    state.focusComment = null;
    textarea.focus({ preventScroll: true });
    textarea.scrollIntoView({ block: "center" });
  }

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

// How signing in works, as a sheet of the report: its h2 on the head band, then one row per step.
function stepsSection() {
  return h("section", { class: "section sheet steps-sheet", "aria-labelledby": "steps-title" },
    h("div", { class: "sheet-head" }, h("h2", { id: "steps-title" }, T.stepsTitle)),
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
  state.week = null;
  state.weekLoad = null;
  state.waiting = null;
  state.titles = null;
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
  state.week = null;
  state.weekLoad = null;
  state.waiting = null;
  state.titles = null;
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
