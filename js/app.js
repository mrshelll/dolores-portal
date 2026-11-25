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
import { h, icon, replaceChildren } from "./dom.js";
import { T, fill, formatNumber, formatDate } from "./text.js";
import { classifyAuthError, isEmailInvalid, isNetworkError, retryAfterSeconds } from "./auth-errors.js";
import { accessState } from "./access.js";
import {
  emptySentence, homeNotice, runNotice, classifyError, firstPage, nextPage, PAGE_SIZE, sectionOf, decideList, catalogSections,
  catalogView, latestTrace, brandLamp, brandLampText, brandLampShort, painLamp, lineView, lineHeading, weekMeta, decideLead,
  stationMarks, stationMeta, stationTags, rowMarks, stationFacts, stationFactLines, waitingCount, duelWinner,
} from "./model.js";
import { loadHome, loadWeek, loadPain, loadRuns, loadTitles, loadNiches, setMark, setNicheVeto, addComment, deleteComment } from "./api.js";
import {
  nextMark, keyData, validComment, cardTitle, painStatus, statusLabel, cardSections, isLineCard, markLines, commentItems,
  sendErrorKind, draftKey, draftValue, readDraft, isDraftKey, discardNote, markErrorText, commentErrorText, COMMENT_MAX,
  ownMarkLine, lineNoticeText, stationButtonLabels, stationStateText, howWeGot, titleMap,
} from "./detail.js";
import { renderLine, lamp } from "./line.js";
import { checkStack, checkCells, checkUnmeasured, checkIcon, verdictIcon } from "./checks.js";
import { runRows, runState, runTitle, runKeys, runCostLines, runCutLines, runDuelLines, runTechnical, duelIds } from "./runs.js";
import { nicheBoard, withVeto, paidRunsText, painsText, versusLabel, versusKey } from "./niches.js";

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
  painTab: null, // the tab a pain's page keeps current: "catalog" when opened from Catálogo, else "week" (route)
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
// its data leave the masthead, so the heading stays in the first screen: the home's line strip says them (css/base.css).
// The name links home (NAV-09); the screens without a session or without access have no masthead (panelLayout).
// The pill, the week and the count stay hidden until a load says what they are.
function masthead({ actions, tab }) {
  const word = h("a", { class: "brand-word", href: "#/", "aria-label": T.brandHome, "aria-current": atHome() ? "page" : null }, T.brand);
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
    week,
    pill,
    meta,
    actions.length ? h("div", { class: "masthead-actions" }, actions) : null,
    h("nav", { class: "tabs", "aria-label": T.tabsLabel }, TABS.map(([key, href, label]) =>
      h("a", { class: "tab", href, "aria-current": key === tab ? "page" : null }, T[label], key === "week" ? [" ", count] : null))));
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

// A screen's title band (its h1 and the lines under it), its notice zone and its body, with the roles marco.md gives
// them.
function screenParts(title, meta) {
  const heading = h("h1", { tabindex: "-1" }, title);
  return {
    heading,
    head: h("div", { class: "page-head", "data-rol": "cabecera" },
      heading,
      meta.filter(Boolean).map((line) => h("p", { class: "page-meta" }, line))),
    notices: h("div", { class: "notices", "data-rol": "avisos" }),
    body: h("div", { class: "body", "data-rol": "cuerpo" }),
  };
}

// One frame for every screen with a session (marco.md): the masthead, then the shell: inside <main> the context
// («← Volver», optional), the title band, the notice zone and the body; beside it, from 1024 px, the side panel the
// home fills with the run's line (hidden on every other screen).
function frameLayout({ title, meta = [], actions = [], context = null, tab = null, pageTitle = null }) {
  runCleanup(); // a new screen drops the last one's timers and its leave guard
  const { heading, head, notices, body } = screenParts(title, meta);
  const side = h("aside", { class: "line-panel", "aria-label": T.lineLabel, hidden: true });
  const shell = h("div", { class: "shell" },
    h("main", { id: "main", class: context ? "has-context" : null },
      h("div", { "data-rol": "marco" }, context, head, notices, body)),
    side);
  replaceChildren(root, h("div", { class: "frame" }, masthead({ actions, tab }), shell));
  setTitle(pageTitle || title);
  return { heading, head, notices, body, side, shell };
}

// The screens without a session or without access (signing in, «sin permiso»): no masthead, one 400 px panel centred
// on the ground. «tomoshi» at its top is plain text (NAV-09): there is no home to go to yet, and tapping it would only
// wipe the code being typed. Then the title band, the notice zone and the body, with a frame's roles. index.html's
// fallback draws the same panel.
function panelLayout({ title, meta = [] }) {
  runCleanup(); // a new screen drops the last one's timers
  state.masthead = null;
  const { heading, head, notices, body } = screenParts(title, meta);
  replaceChildren(root, h("main", { id: "main", class: "auth" },
    h("div", { class: "auth-panel", "data-rol": "marco" }, h("p", { class: "brand-word auth-brand" }, T.brand), head, notices, body)));
  setTitle(title);
  return { heading, notices, body };
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
  // A pain's page keeps the tab of the screen it was opened from, and its way back goes there: Catálogo from Catálogo,
  // «Esta semana» from anywhere else or when opened directly (a link, a reload).
  if (target.name !== "pain") state.painTab = screen.tab === "catalog" ? "catalog" : "week";
  const tab = target.name === "pain" ? (state.painTab ?? screen.tab) : screen.tab;
  const layout = frameLayout({
    title: T[screen.title],
    pageTitle: screen.pageTitle ? T[screen.pageTitle] : null,
    tab,
    context: target.name === "pain" ? painBackLink(tab)
      : target.name === "run" ? backLink("#/corridas", T.runsBackLabel, backChevron(), T.tabRuns) : null,
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

// Each route's h1, the tab's title when it differs, and which tab is current (a pain's: the one it was opened from).
const ROUTE_SCREEN = {
  home: { title: "homeTitle", pageTitle: "tabWeek", tab: "week" },
  catalog: { title: "catalogTitle", tab: "catalog" },
  niches: { title: "nichesTitle", tab: "niches" },
  runs: { title: "runsTitle", tab: "runs" },
  run: { title: "runTitle", tab: "runs" },
  pain: { title: "painTitle", tab: "week" }, // opened directly; from Catálogo, "catalog" (state.painTab)
};

// A pain's way back, to the tab its page keeps current: its address, its words for a screen reader and for the eye.
const PAIN_BACK = { week: ["#/", "backToWeek", "tabWeek"], catalog: ["#/catalogo", "backToCatalog", "tabCatalog"] };
function painBackLink(tab) {
  const [href, label, words] = PAIN_BACK[tab] ?? PAIN_BACK.week;
  return backLink(href, T[label], backChevron(), T[words]);
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

// EST-05: what cannot be done and whom to ask, in the sign-in's panel. The email they came in with is said, because the
// most likely cause is another address. «Salir» is the way out (and to come back with another email).
function showNoAccess(email) {
  state.view = "no-access";
  const layout = panelLayout({ title: T.noAccessTitle, meta: [email ? t("signedInAs", { email }) : null] });
  layout.body.append(
    h("p", { class: "auth-text", role: "status" }, T.noAccess),
    h("button", { type: "button", class: "button button--primary", "data-rol": "accion-principal", onclick: signOut }, T.signOut));
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

// «Para decidir» (decideList) as a list of rows, its sentence beside the heading, with the run's line beside them from
// 1024 px and as a folded strip under the title below. Under the list, one line counts the whole catalog by state and
// opens it.
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
  layout.head.classList.add("home-head");
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
    // With nothing to decide, «Ver el catálogo» is the screen's own button: the line only counts.
    const counts = catalogLine(sections, { link: items.length > 0 });
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
    if (items.length) blocks.push(stationList(items, { home, email, me, latest, view, onChange: refresh }));
    blocks.push(counts.element);
    refresh();
  }
  layout.body.removeAttribute("aria-busy");
  layout.body.classList.add("home-body");
  replaceChildren(layout.body, blocks);
}

// The whole catalog by state in one line under the list («En el catálogo: 1 con peso para trabajar · 55 en observación ·
// 1 descartado por el equipo»; a state with none is left out), then «Abrir el catálogo» unless `link` is false.
// `refresh` recounts after a mark.
const CATALOG_LINE = [
  ["weighty", "catalogLineWeighty", "catalogLineWeighty"],
  ["interested", "catalogLineInterestedOne", "catalogLineInterested"],
  ["watching", "catalogLineWatching", "catalogLineWatching"],
  ["discarded", "catalogLineDiscardedOne", "catalogLineDiscarded"],
];
function catalogLine(sections, { link = true } = {}) {
  const counts = h("span", { class: "catalog-line-counts" });
  const element = h("p", { class: "catalog-line" }, counts,
    link ? h("a", { class: "catalog-line-link", href: "#/catalogo" }, T.openCatalog) : null);
  const refresh = (next) => {
    const parts = CATALOG_LINE.map(([key, one, many]) => [next[key].length, one, many]).filter(([n]) => n > 0)
      .map(([n, one, many]) => `${formatNumber(n)} ${T[n === 1 ? one : many]}`);
    counts.textContent = parts.length ? t("catalogLine", { counts: parts.join(" · ") }) : "";
    counts.hidden = !parts.length;
  };
  refresh(sections);
  return { element, refresh };
}

// «Para decidir»'s rows in decideList's order, in one bordered list.
function stationList(items, ctx) {
  const pains = new Map(ctx.home.pains.filter((p) => p && p.id).map((p) => [p.id, p]));
  return h("ol", { class: "stations", role: "list" },
    items.map((item, index) => station(item, index, { ...ctx, pain: pains.get(item.id) })));
}

// The icons of a row: the chevron that opens it (it turns down when open, css/base.css) and the speech bubble of
// «Comentar». Hidden from a screen reader: the button's and the link's words carry them.
const chevron = () => icon("station-chevron", { paths: ["m9 6 6 6-6 6"] });
const speech = () => icon("station-speech", { paths: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"] });

// The parts a home row, a Catálogo row and a pain's page share. A row's tags (stationTags) as pills.
const tagPills = (tags) => tags.map((tag) => h("span", { class: `station-tag station-tag--${tag.kind}` }, tag.text));
// Who suffers it, its label for a screen reader only; null when the card does not say.
const whoLine = (className, who) => (who
  ? h("p", { class: className }, h("span", { class: "visually-hidden" }, `${T.whoLabel}: `), who) : null);
// Why it is there (stationFactLines) in one line; null with nothing to say.
function factsLine(itemFacts) {
  const facts = stationFactLines(itemFacts);
  return facts.length
    ? h("p", { class: "station-facts" }, h("span", { class: "visually-hidden" }, `${T.factsLabel}: `), facts.join(" · ")) : null;
}
// A closed row's checks (checkStack); without a gate, the dash and «Sin medir contra los umbrales» (checkUnmeasured),
// then why it is there in its facts line.
const rowChecks = (item) => checkStack(item.gate)
  || h("div", { class: "check-unmeasured" }, checkUnmeasured(), factsLine(item.facts));

// One pain of «Para decidir» as a row. Closed: the chevron that opens it; the title as the link to the pain, its tags
// and who suffers it; its checks (checkStack: each count against the run's own threshold, a ✓ or ✗ beside its words)
// or, without a gate, a dash that says it was not measured and why it is there (rowChecks); its state (a dot and its
// words) and the team's marks. Open, under it: the duel's line (for the winner); the box cells (checkCells) or, without
// a gate, a line that says there is no analysis; then «Nos interesa», «Descartar» and «Comentar», and at the right the
// way to its testimonies and attacks. The first row starts open, the rest closed; a row opens and closes by its chevron
// or a click on its title area, never leaving the page, and opening one never closes another. Each button says what
// pressing it does and names its pain for a screen reader (aria-describedby). A mark changes the row in place: a
// discarded pain stays until the next load, its dot off, so it can be undone with the same button.
function station(item, index, ctx) {
  const { home, me, pain } = ctx;
  const viewId = state.viewId;
  const titleId = `estacion-${index + 1}`;
  const openId = `${titleId}-detalle`;
  const href = `#/dolor/${encodeURIComponent(item.id)}`;
  const light = lamp(item.lamp);
  const stateText = h("span", { class: "station-state-text" });
  const stateFlag = h("p", { class: "station-state" }, light, stateText);
  const tags = tagPills(stationTags(item, { isThisWeek: ctx.latest.isThisWeek, dateLabel: ctx.view ? ctx.view.dateLabel : "" }));
  const cells = checkCells(item.gate);
  const reason = item.facts && item.facts.duelReason;
  const marksLine = h("p", { class: "station-marks" });
  const interested = h("button", { type: "button", class: "button button--primary", "aria-describedby": titleId });
  const discard = h("button", { type: "button", class: "button button--secondary", "aria-describedby": titleId });
  const note = h("p", { class: "station-note", role: "status" });
  const comment = h("a", { class: "button button--quiet", href, "aria-describedby": titleId,
    onclick: () => { state.focusComment = item.id; } }, speech(), T.commentAction);

  const mine = () => {
    const own = home.marks.find((m) => m && m.pain_id === item.id && lower(m.author) === me);
    return own ? own.mark : null;
  };
  function refresh() {
    const section = pain ? sectionOf(pain, home.marks) : item.section;
    const color = painLamp(section);
    light.dataset.lamp = color;
    stateFlag.dataset.lamp = color;
    stateFlag.dataset.section = section ?? "out"; // a waiting pain's dot is grey (css/base.css), its lamp still amber
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

  // Open or closed: the chevron says it (aria-expanded) and the region shows or hides.
  let open = index === 0;
  const toggle = h("button", { type: "button", class: "station-toggle", "aria-label": T.stationDetail, "aria-describedby": titleId,
    "aria-expanded": String(open), "aria-controls": openId }, chevron());
  const region = h("div", { class: "station-open", id: openId, hidden: !open },
    reason ? h("p", { class: "station-duel" }, h("span", { class: "station-duel-label" }, T.duelReasonLabel), " ", reason) : null,
    cells || h("p", { class: "checks-none" }, T.analysisNone), // why it is there is already in the row's own line
    h("div", { class: "station-foot" },
      h("div", { class: "station-actions" }, interested, discard, comment),
      h("a", { class: "station-evidence", href, "aria-describedby": titleId }, T.stationEvidence),
      note));
  const row = h("li", { class: open ? "station is-open" : "station", "aria-labelledby": titleId });
  function setOpen(next) {
    open = next;
    toggle.setAttribute("aria-expanded", String(open));
    region.hidden = !open;
    row.classList.toggle("is-open", open);
  }
  toggle.addEventListener("click", () => setOpen(!open));
  // A click anywhere on the row's own line opens or closes it too, unless it lands on a link or a button, or ends a
  // selection of its text: the chevron is the keyboard's way.
  const onRowClick = (event) => {
    if (event.target.closest("a, button")) return;
    if (String(window.getSelection ? window.getSelection() : "").trim()) return;
    setOpen(!open);
  };

  row.append(
    h("div", { class: "station-row", onclick: onRowClick },
      toggle,
      h("div", { class: "station-name" },
        h("div", { class: "station-heading" },
          h("h2", { class: "station-title", id: titleId }, h("a", { href }, item.title)),
          tags),
        whoLine("station-who", item.who)),
      rowChecks(item),
      h("div", { class: "station-status" }, stateFlag, marksLine)),
    region);
  return row;
}

// ---- Catálogo: every pain by state --------------------------------------------------------

// Every pain by state (catalogView): one bordered list per state, in the board's order, each pain a closed row like
// the home's. A section with no pain says so; with no pain anywhere the screen says so once and offers to load again,
// the way out last (LIS-05, EST-01, MAR-06). The run's notice stays: it says how old the list is.
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

// A state as a bordered list: its head row (the state's dot, its name and how many), then its rows (and «Ver 20 más»
// at its foot) or the sentence that says it has none. The discarded ones are folded away, since few need them
// (COM-06); their head row is the fold's summary. A waiting state's dot is grey (css/base.css, by data-section).
function catalogSection(section) {
  const id = `seccion-${section.key}`;
  const heading = h("h2", { id, class: "catalog-heading" },
    lamp(section.lamp), h("span", { class: "catalog-state" }, section.title), " ", h("span", { class: "catalog-count" }, section.countText));
  const attrs = { class: "catalog-section", "data-section": section.key };
  if (!section.count) {
    return h("section", { ...attrs, "aria-labelledby": id },
      h("div", { class: "catalog-head" }, heading), h("p", { class: "catalog-empty" }, section.emptyText));
  }
  const rows = painList(section.items, (item) => painRow(item, section));
  if (section.key === "discarded") {
    return h("details", { ...attrs, class: "catalog-section catalog-fold" }, h("summary", { class: "catalog-head" }, heading), rows);
  }
  return h("section", { ...attrs, "aria-labelledby": id }, h("div", { class: "catalog-head" }, heading), rows);
}

// One pain as the home's row, closed and with no chevron: the title as the link to it (the whole row is its target),
// who suffers it and its trend and topic; its checks or, without a gate, the dash and why it is there (rowChecks); its
// state (a dot and its words) and the team's marks (LIS-01). Its actions live on its page. The pain id only
// travels in the address.
function painRow(item, section) {
  const meta = stationMeta(item);
  const marks = rowMarks(item);
  return h("li", { class: "pain-row" },
    h("div", { class: "pain-name" },
      h("h3", { class: "pain-title" }, h("a", { href: `#/dolor/${encodeURIComponent(item.id)}` }, item.title)),
      whoLine("pain-who", item.who),
      meta.length ? h("p", { class: "pain-meta" }, meta.join(" · ")) : null),
    rowChecks(item),
    h("div", { class: "pain-status" },
      h("p", { class: "pain-state" }, lamp(section.lamp), h("span", {}, section.state)),
      h("p", { class: "pain-marks" }, marks.length ? marks.join(" · ") : T.noMarksYet)));
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

// The board from the screen's data, drawn whole: «Esta semana», the niche that ran as an open row, then «Candidatos»,
// every niche in one table. A veto redraws it from the data with the veto mirrored (withVeto).
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

// «Esta semana»: the niche that ran as the home's open row, in a bordered list of one. Its line: the name and where it
// came from; its pains, the paid runs in this niche and how many came close to weight; its state (a dot and the same
// words as its row in the table: «Corrió esta semana», «Corrió el <día>», «Se eligió el <día>; la corrida falló», or
// «Vetado · …») and its veto. Open under it: why it was chosen, the week's three figures in cells, and the veto with what
// a veto does now.
function nicheWeek(week, ctx, layout) {
  const { row } = week;
  const nameId = "nicho-semana";
  const pains = painsText(row.pains, { retired: row.state === "retired" });
  const control = row.canVeto ? vetoControl(row, "week", ctx, layout, nameId) : null;
  return h("section", { class: "niche-section niche-week-section", "aria-labelledby": "esta-semana" },
    h("h2", { class: "niche-section-title", id: "esta-semana" }, T.nicheWeekLabel),
    h("div", { class: "niche-week" },
      h("div", { class: "niche-week-row" },
        h("div", { class: "station-name" },
          h("h3", { class: "station-title", id: nameId }, row.name),
          h("span", { class: "station-tag niche-origin-tag" }, row.originText)),
        h("ul", { class: "niche-side-list", role: "list", "aria-label": T.nicheOwnPains },
          ...(pains.none ? [h("li", {}, pains.none)] : pains.week.map((line) => h("li", {}, boldNumbers(line)))),
          week.advanced ? h("li", {}, boldNumbers(week.advanced)) : null,
          h("li", {}, boldNumbers(paidRunsText(row.paidRuns, { long: true })))),
        h("div", { class: "niche-week-status" },
          h("p", { class: "station-state", "data-lamp": row.lamp },
            lamp(row.lamp), h("span", { class: "station-state-text" }, row.stateText)),
          h("p", { class: "station-marks" }, row.vetoNote ?? (row.vetoed ? row.stateText : T.nicheNoVeto)))),
      h("div", { class: "niche-week-open" },
        h("p", { class: "niche-week-why" }, h("span", { class: "niche-week-why-label" }, T.nicheWhyLabel), " ", week.why),
        nicheFigures(week),
        h("div", { class: "niche-week-foot" },
          control ? control.button : null,
          h("p", { class: "niche-veto-next" }, week.vetoNext),
          control ? control.note : null))));
}

// The week's sounding as the pain's box cells: «Quejas reales», «Gasto real» and «Ruido», each its figure; for quejas
// and gasto its place against the other niches drawn beside it (the versus bar: a tick per rival and the niche's own
// rule, hidden from a screen reader) and said in words under it, and whether it has a signal at all: ✓ «Con señal» on
// the ground, ✗ «Sin señal» on the fail tint. Over the cells, the day of the sounding and how many niches it was
// measured against; in them, the week's note; under them, when a bar draws a rival, what its marks are (versusKey).
const FIGURE_RESULT = { in: "pass", out: "fail" };
const drawsVersus = (a) => a.at !== null && a.flag !== null;
function nicheFigures(week) {
  const rivals = Math.max(0, ...week.analysis.map((a) => a.positions.length));
  const caption = week.date ? fill(T.nicheProbeCaption, { date: week.date }) : T.nicheProbeCaptionUndated;
  const key = week.analysis.some((a) => drawsVersus(a) && a.positions.length) ? versusKey(rivals) : null;
  const cell = (a) => {
    const result = FIGURE_RESULT[a.flag] ?? null;
    // A value in words («sin medir») or missing reads at the size of the words, as a check with no result does.
    const words = a.value === null || a.value === T.nicheNoiseUnmeasured;
    const versus = !drawsVersus(a) ? null : h("span", { class: "versus", "aria-hidden": "true" },
      a.positions.map((at) => h("span", { class: "versus-tick", style: `--at: ${at}%` })),
      h("span", { class: "versus-at", style: `--at: ${a.at}%` }));
    return h("div", { class: "check-cell", "data-result": result ?? (words ? "none" : null) },
      h("p", { class: "check-label" }, a.label),
      h("p", { class: "check-value" }, h("strong", { class: "check-figure" }, a.value ?? noValue()), versus),
      result ? h("p", { class: "check-flag" }, verdictIcon(result), a.flagText) : null,
      a.rank ? h("p", { class: "check-min" }, a.rank) : null);
  };
  return [
    h("p", { class: "niche-probe" }, `${caption} · ${versusLabel(rivals)}`),
    h("div", { class: "check-cells niche-cells" }, week.analysis.map(cell), week.note ? h("p", { class: "check-note" }, week.note) : null),
    key ? h("p", { class: "niche-versus-key" }, key) : null,
  ];
}

// «Candidatos»: one table on a bordered panel, a row per niche (a <th scope="row"> with its name, where it came from
// and, for a proposed one, why), its state (a dot and its words), quejas, gasto and ruido, its pains and its veto.
// Below 900 px each row is a stacked block (css/base.css): the explicit roles keep it a table, and each figure says its
// column (data-label).
const QUIET_STATES = new Set(["resting", "vetoed", "retired"]);
function nicheCandidates(rows, ctx, layout) {
  const col = (text, cls = null) => h("th", { scope: "col", role: "columnheader", class: cls }, text);
  return h("section", { class: "niche-section niche-candidates", "aria-labelledby": "candidatos" },
    h("h2", { class: "niche-section-title", id: "candidatos" }, T.nicheCandidatesLabel),
    h("div", { class: "niche-table-panel" },
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
  // A niche out of the race (resting, vetoed, retired) reads muted. A competing one waits: its dot is grey (css/base.css,
  // by data-state), its lamp still amber.
  return h("tr", { role: "row", class: QUIET_STATES.has(row.state) ? "niche-row--quiet" : null },
    h("td", { role: "cell", class: "niche-cell-state" },
      h("span", { class: "niche-state", "data-lamp": row.lamp, "data-state": row.state }, lamp(row.lamp), row.stateText),
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
  // The head row names the columns for the eye, once the rows lay them out (css/base.css); each row says its values in
  // words, so a screen reader skips it.
  const columns = h("div", { class: "run-columns", "aria-hidden": "true" },
    [T.runColRun, T.runColState, T.runColNiche, T.runColFound, T.runColDuration, T.runColCost].map((label) => h("span", {}, label)));
  replaceChildren(layout.body, h("div", { class: "run-table" }, columns, list, more));
}

// One run as a deployments list draws one, a value per fixed column: its date as the link to it (the whole row is its
// target), its state as a pill (a dot and its words), its niche, its new pains, how long it took and its cost. A value
// the run did not leave is a dash for the eye and is not said; on a phone, where the values stack, it is left out.
function runListRow(row) {
  const value = (key, text, label = null) => h("p", { class: text ? `run-cell run-${key}` : `run-cell run-${key} is-empty` },
    text ? [label ? h("span", { class: "visually-hidden" }, `${label}: `) : null, text] : h("span", { "aria-hidden": "true" }, "—"));
  return h("li", { class: "run-row" },
    h("h2", { class: "run-title" }, h("a", { href: row.href }, row.title)),
    h("p", { class: "run-state", "data-lamp": row.lamp }, lamp(row.lamp), h("span", {}, row.state)),
    value("niche", row.niche, T.keyNiche),
    value("found", row.found),
    value("duration", row.duration),
    value("cost", row.cost));
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

// The run's sections, as a pain's page draws its own: a plain block under a hairline, its h2, then its rows (the
// cost, the cuts and the duels in words) or what it says when it has none.
function runSection(key, title, items, emptyText, list = "ul") {
  const id = `corrida-${key}`;
  return h("section", { class: "detail-section run-section", "aria-labelledby": id },
    h("h2", { id }, title),
    items.length ? h(list, { class: `run-${key}-list`, role: list === "ul" ? "list" : null }, items) : h("p", { class: "run-empty" }, emptyText));
}

function technicalPart(title, items) {
  return items.length ? h("div", { class: "tech-part" }, h("h3", {}, title), h("ul", { role: "list" }, items)) : null;
}

// One run opened reads as a pain's page: the way back to Corridas, the title, its state as the same pill and its key
// data on one muted line; then its line across the page's width (renderLine: every step, what remained, each cut in
// words); then its cost, its cuts and its duels as plain sections, and «Detalle técnico», closed, the only place where
// the run's raw texts show.
function renderRun(layout, trace, titles) {
  const title = runTitle(trace);
  layout.heading.textContent = title;
  setTitle(title);
  const status = runState(trace.status);
  const keys = runKeys(trace);
  layout.head.classList.add("detail-head", "run-head");
  // Element.append writes a null as the text «null»: only what exists goes in.
  layout.head.append(...[
    h("div", { class: "detail-meta" }, h("p", { class: "detail-status", "data-lamp": status.lamp }, lamp(status.lamp), h("span", {}, status.text))),
    keys.length ? h("ul", { class: "key-data", role: "list" }, keys.map(keyItem)) : null,
  ].filter(Boolean));

  const costs = runCostLines(trace);
  const cuts = runCutLines(trace);
  const duels = runDuelLines(trace, titles);
  const tech = runTechnical(trace, titles);
  const counted = Array.isArray(trace.funnel) && trace.funnel.some((stage) => stage && typeof stage.count === "number");
  const technical = h("details", { class: "detail-section run-tech fold" },
    h("summary", {}, T.techTitle),
    h("div", { class: "run-tech-body" },
      h("p", { class: "run-tech-lead" }, T.techLead),
      tech.empty ? h("p", { class: "run-empty" }, T.techNone) : null,
      technicalPart(T.techCuts, tech.cuts.map((line) => h("li", {}, h("p", { class: "raw" }, line)))),
      technicalPart(T.techNotes, tech.notes.map((n) => h("li", {}, h("p", { class: "raw-label" }, n.label), h("p", { class: "raw" }, n.text)))),
      technicalPart(T.techReasons, tech.reasons.map((r) => h("li", {}, h("p", { class: "raw-label" }, r.label), h("p", { class: "raw" }, r.text))))));

  layout.notices.classList.add("detail-notices");
  layout.body.removeAttribute("aria-busy");
  layout.body.classList.add("detail-body", "run-body");
  replaceChildren(layout.body, h("div", { class: "run-detail" },
    h("div", { class: "run-line" }, renderLine(trace, {
      idPrefix: "corrida-linea", costs: false, otherCuts: false,
      note: counted ? null : T.runMiniNone })),
    h("div", { class: "run-sections" },
      runSection("costo", T.runCostTitle, costs.map((row) => h("div", { class: row.total ? "run-cost-row run-cost-row--total" : "run-cost-row" },
        h("dt", {}, row.label), h("dd", {}, row.value))), T.runCostNone, "dl"),
      runSection("recortes", T.runCutsTitle, cuts.map((line) => h("li", {}, line)), T.runCutsNone),
      runSection("duelos", T.runDuelsTitle, duels.map((line) => h("li", {}, line)), T.runDuelsNone),
      technical)));
}

// ---- a pain: the home's open row at full width, its card, «Cómo llegamos» and the comments ------

// The way back, on one line above the title, after a drawn chevron; its accessible name says where it goes (MAR-14). A
// pain goes back to «Esta semana», an opened run to Corridas.
const backLink = (href, label, ...content) => h("a", { class: "back-link", href, "aria-label": label }, content);
const backChevron = () => icon("back-chevron", { paths: ["m15 18-6-6 6-6"] });

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

// One key datum: its label (muted) and its value, the data on one line divided by «·» (DET-02). On a phone a value that
// reads alone hides its label from the eye but not from a screen reader (DET-12).
function keyItem(item) {
  return h("li", { class: item.alone ? "key key--alone" : "key", "data-rol": "dato-clave" },
    h("span", { class: "key-label" }, item.label), " ", h("span", { class: "key-value" }, item.value));
}

// A quote of the card, drawn as «Cómo llegamos» draws its own: the words between guillemets, then its link and, when it
// differs, the original under a fold.
function quoteItem(quote) {
  return h("li", { class: "quote" },
    h("blockquote", {}, h("p", {}, quote.text)),
    quote.url ? h("a", { class: "quote-source", href: quote.url, target: "_blank", rel: "noopener noreferrer" }, T.seeSource) : null,
    quote.original ? h("details", { class: "fold original" }, h("summary", {}, T.originalText), h("p", {}, quote.original)) : null);
}

// A section of the card as a plain headed block under a hairline: its h2, then its paragraphs, its quotes or its
// glossary (a <dl>, DET-08). Nothing in it is boxed (DET-09): its rows are divided by hairlines.
function cardSection(section, ...extra) {
  const headingId = `${section.id}-titulo`;
  return h("section", { class: "detail-section", id: section.id, "aria-labelledby": headingId },
    h("h2", { id: headingId, tabindex: "-1" }, section.title),
    section.paragraphs.map((text) => h("p", { class: "detail-prose" }, text)),
    section.quotes && section.quotes.length ? h("ul", { class: "quotes", role: "list" }, section.quotes.map(quoteItem)) : null,
    section.glossary && section.glossary.length
      ? h("dl", { class: "glossary" }, section.glossary.map((g) => h("div", { class: "glossary-row" }, h("dt", {}, g.term), h("dd", {}, g.meaning))))
      : null,
    extra);
}

// An in-page link: it scrolls to its section's heading and gives it the focus, without touching the address (the
// router's).
const jumpTo = (id) => (event) => {
  event.preventDefault();
  const target = document.getElementById(`${id}-titulo`);
  if (!target) return;
  target.scrollIntoView({ block: "start" });
  target.focus({ preventScroll: true });
};

// ---- «Cómo llegamos a este dolor» ----

// One row of the attacks or the duels: its result in words after a ✓ (it held, it won) or a ✗ (checkIcon, hidden from
// a screen reader), then what was asked (or whom it faced) and, when the card has it, its plain line. No plain line,
// no empty box (Review Focus 4).
function howRow(passed, result, main, plain) {
  const outcome = passed ? "pass" : "fail";
  return h("li", { class: "how-row" },
    h("p", { class: "how-result", "data-result": outcome }, checkIcon(outcome), h("span", {}, result)),
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

// A source: its name and kind (the kind left out when it is the name, as «Otra fuente» is), how many quotes, the newest
// three and «Ver N más» for the rest. The focus goes to the first quote added (its item, so a screen reader starts at
// the quote and not at its «Ver la fuente» link).
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
      h("p", { class: "how-source-kind" }, group.kind === group.source ? count : `${group.kind} · ${count}`)),
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
        view.attacks.map((a) => howRow(a.held, a.result, a.question, a.plain)))) : null,
    view.duels.length ? part("duelos", view.duels.length === 1 ? T.howDuelTitle : T.howDuelsTitle,
      h("ul", { class: "how-rows", role: "list", "aria-labelledby": "como-duelos" },
        view.duels.map((d) => howRow(d.won, d.result,
          d.known ? t("duelAgainst", { title: d.againstTitle }) : T.duelAgainstOther, d.plain)))) : null,
  ];
}

// The index of the sections (DET-04): folded above the sections on a phone and a tablet, a column beside them from
// 1024 px. The CSS shows one of the two, so a screen reader meets only one. Its links scroll to their section without
// touching the address, which is the router's.
function sectionIndex(sections) {
  const links = () => h("ul", { role: "list" }, sections.map((section) => h("li", {},
    h("a", { href: `#${section.id}`, onclick: jumpTo(section.id) }, section.title))));
  return [
    h("details", { class: "fold detail-index detail-index--fold" },
      h("summary", {}, T.indexLabel), h("nav", { "aria-label": T.indexLabel }, links())),
    h("nav", { class: "detail-index detail-index--wide", "data-rol": "lateral", "aria-label": T.indexLabel },
      h("p", { class: "detail-index-label", "aria-hidden": "true" }, T.indexLabel), links()),
  ];
}

// A pain's page is its row on «Esta semana», opened, at the page's width. The head is the row's own line: the title,
// its tags and its state (a pill: its dot and its words), who suffers it and the key data. Then the open part: the
// duel's line (for the winner), the box cells (checkCells: the counts the run judged it by against the run's own
// thresholds; a pain stored before the gate existed has none, claims nothing and says so in one line), «Nos interesa»,
// «Descartar» and «Comentar» with the way to its testimonies and attacks, and the team's marks. Then the card's
// sections, «Cómo llegamos» and, last, the comments, beside their index. A line card says first that it only has
// this summary (EST-06).
function renderPain(layout, id, email, data) {
  const viewId = state.viewId;
  const view = { marks: [...data.marks], comments: [...data.comments] };
  const title = cardTitle(data.card);
  layout.heading.textContent = title;
  setTitle(title);

  // ---- the head (DET-01, DET-12) ----
  const tags = h("p", { class: "detail-tags", hidden: true });
  const statusText = h("span", {});
  const statusLamp = lamp("off");
  const statusRow = h("p", { class: "detail-status", "data-lamp": "off" }, statusLamp, statusText);
  const who = typeof data.card.line.who === "string" ? data.card.line.who.trim() : "";
  layout.head.classList.add("detail-head");
  layout.head.append(...[
    h("div", { class: "detail-meta" }, tags, statusRow),
    whoLine("detail-who", who),
    h("ul", { class: "key-data", role: "list" }, keyData(data.pain, data.card).map(keyItem)),
  ].filter(Boolean)); // Element.append writes a null as the text «null»

  // What the week's run says of this pain, as its row says it: «Ganó el duelo» and the duel's line, for the winner of
  // the survivors' duel. A pain opened from a link can come before the week: they show when it arrives.
  const duelLine = h("p", { class: "detail-duel", hidden: true });
  function showWeek(week) {
    const latest = week && week.latest;
    if (!latest || !latest.trace || duelWinner(latest.trace) !== id) return;
    replaceChildren(tags, tagPills(stationTags({ winner: true }, { isThisWeek: latest.isThisWeek, dateLabel: formatDate(latest.trace.date) })));
    tags.hidden = false;
    const reason = stationFacts(data.pain, data.card, { winner: true }).duelReason;
    if (!reason) return;
    replaceChildren(duelLine, h("span", { class: "detail-duel-label" }, T.duelReasonLabel), " ", reason);
    duelLine.hidden = false;
  }
  if (state.week) showWeek(state.week);
  else ensureWeek().then((week) => { if (viewId === state.viewId) showWeek(week); });

  // ---- the actions, your own mark and the team's marks (MAR-06) ----
  const interested = h("button", { type: "button", class: "button button--primary", "data-rol": "accion-principal" });
  const discard = h("button", { type: "button", class: "button button--secondary" });
  const ownLine = h("p", { class: "own-mark" });
  const marksList = h("ul", { class: "mark-list", role: "list", "aria-labelledby": "marcas-titulo" });
  const noMarks = h("p", { class: "detail-marks-none" }, T.noMarks);
  // A line card's notice depends on the marks too (lineNoticeText): it is refreshed with the state.
  const lineNotice = isLineCard(data.card) ? h("p", {}) : null;

  const myMark = () => {
    const own = view.marks.find((m) => m && String(m.author ?? "").trim().toLowerCase() === email);
    return own ? own.mark : null;
  };
  // The state's pill and the buttons follow the marks. The buttons say what pressing them does, and the line under them
  // your own mark in words with its day. A waiting pain's dot is grey (css/base.css, by its section), its lamp still
  // amber.
  function refreshHeader() {
    const section = painStatus(data.pain, view.marks);
    const label = statusLabel(section);
    statusText.textContent = label || "";
    statusLamp.dataset.lamp = painLamp(section);
    statusRow.dataset.lamp = statusLamp.dataset.lamp;
    statusRow.dataset.section = section ?? "out";
    statusRow.hidden = !label; // a pain that just left every list (a dead one no longer kept): no pill
    const labels = stationButtonLabels(myMark());
    interested.textContent = labels.interested;
    discard.textContent = labels.discard;
    const line = ownMarkLine(view.marks, email);
    ownLine.textContent = line || "";
    ownLine.hidden = !line;
    if (lineNotice) lineNotice.textContent = lineNoticeText(data.pain, view.marks);
  }
  function refreshMarks() {
    const lines = markLines(view.marks, data.people);
    replaceChildren(marksList, lines.map((line) => h("li", {}, line.text)));
    marksList.hidden = !lines.length;
    noMarks.hidden = lines.length > 0;
  }

  // ---- comments ----
  const commentList = h("ul", { class: "comment-list", role: "list" });
  const noComments = h("p", { class: "muted" }, T.noComments);
  const live = h("p", { class: "visually-hidden", role: "status" });
  let commentsHeading = null; // the comments section's h2, where the focus goes after a deletion

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
      if (commentsHeading) commentsHeading.focus();
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
  // «Comentar» here, and on a row of the home, leads to the comment field ready to write.
  const goToComment = () => {
    textarea.focus({ preventScroll: true });
    textarea.scrollIntoView({ block: "center" });
  };

  // ---- the sections: the card's, «Cómo llegamos» before the comments ----
  // The rivals' titles read with the pain win over the last home's (a pain opened from the email has only those).
  const titles = new Map([...(state.titles ?? []), ...(data.titles ?? [])]);
  const how = howWeGot(data.card, data.pain, titles);
  const sections = cardSections(data.card);
  if (how) sections.splice(sections.length - 1, 0, { id: "como-llegamos", title: T.secHowWeGot, paragraphs: [] });
  const blocks = sections.map((section) => {
    if (section.id === "comentarios") {
      const block = cardSection(section, commentList, noComments, form, live);
      commentsHeading = block.querySelector("h2");
      return block;
    }
    if (section.id === "como-llegamos") return cardSection(section, howBody(how));
    return cardSection(section);
  });

  // ---- the open part, then the sections beside their index ----
  const open = h("div", { class: "detail-open" },
    lineNotice ? h("div", { class: "notice detail-notice" }, lineNotice) : null,
    duelLine,
    checkCells(data.pain.gate) || h("p", { class: "checks-none" }, T.analysisNone),
    h("div", { class: "detail-foot" },
      h("div", { class: "actions detail-actions" }, interested, discard,
        h("button", { type: "button", class: "button button--quiet", onclick: goToComment }, speech(), T.commentAction)),
      how ? h("a", { class: "detail-evidence", href: "#como-llegamos", onclick: jumpTo("como-llegamos") }, T.stationEvidence) : null,
      ownLine),
    h("div", { class: "detail-marks" },
      h("p", { class: "detail-marks-label", id: "marcas-titulo" }, T.marksTitle), marksList, noMarks));
  layout.notices.classList.add("detail-notices");
  layout.body.classList.add("detail-body");
  layout.body.removeAttribute("aria-busy");
  // A line card has two or three sections and no index.
  const [foldIndex, wideIndex] = isLineCard(data.card) ? [] : sectionIndex(sections);
  replaceChildren(layout.body, h("div", { class: wideIndex ? "detail-layout" : "detail-layout detail-layout--single" },
    open, foldIndex, wideIndex, h("div", { class: "detail-sections" }, blocks)));
  refreshHeader();
  refreshMarks();
  refreshComments();
  // «Comentar» on a row of the home opens the pain with its comment field ready.
  if (state.focusComment === id) {
    state.focusComment = null;
    goToComment();
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

// How signing in works, at the panel's foot under a hairline: a small h2, then the steps as a numbered list.
function stepsSection() {
  return h("section", { class: "auth-steps", "aria-labelledby": "steps-title" },
    h("h2", { id: "steps-title" }, T.stepsTitle),
    h("ol", {}, [T.step1, t("step2", { length: EMAIL_OTP_LENGTH }), T.step3].map((text) => h("li", {}, text))));
}

// Both sign-in screens keep one composition in the panel: the form (its primary action last, MAR-06) and what goes
// after it, then how signing in works.
function signInBody(body, form, after = null) {
  body.append(...[form, after, stepsSection()].filter(Boolean));
}

function showSignIn({ notice = null } = {}) {
  const pending = readPendingSignIn();
  if (pending) showCodeStep(pending, { notice });
  else showEmailStep("", { notice });
}

function showEmailStep(prefill = "", { notice = null } = {}) {
  state.view = "sign-in";
  const { notices, body } = panelLayout({ title: T.signInTitle, meta: [T.signInLead] });
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
  const { notices, body } = panelLayout({
    title: T.codeTitle, meta: [t("codeSentTo", { length: EMAIL_OTP_LENGTH, email: pending.email })],
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
