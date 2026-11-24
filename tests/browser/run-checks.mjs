// The browser checks: every screen measured in Chrome at 320 × 640, 390 × 844, 768 × 1024 and 1440 × 900, each in light
// and dark, against the fake Supabase of fixtures.mjs. On each one: axe (a serious or critical violation fails, as the
// software factory's measure-pieces.mjs does), no sideways scroll, every target at least 44 × 44 px, no console or page
// error, no request the fake does not know, the screen's own h1 and texts, no raw run text outside «Detalle técnico»,
// and at 320 × 640 an h1 that ends within the first 160 px (MAR-14). Then the behaviours a screenshot cannot show.
//
//   node tests/browser/run-checks.mjs --factory <software-factory repo> --out <dir> [--url <base>]
//
// --url defaults to this repo served on 127.0.0.1 at a free port; Task 9 passes the published page. The Supabase
// project's URL is intercepted either way, so the screens get the same data. Exit codes: 0 all pass, 1 a check failed,
// 2 usage error, 3 Chrome or playwright missing. Nothing is installed in this repo: playwright-core and axe-core come
// from the factory's cache (design-system/assets/playwright-cache.mjs). The factory retired its screen rules
// (reglas-pantalla.mjs) on 2026-11-18; the checks the page keeps are its own, here.

import { mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startStaticServer } from "./static-server.mjs";
import {
  scenarios, installFakeSupabase, prepareStorage, ME, CODE, MARKUP_COMMENT, LONG_WORDS_TITLE, RUN_ID,
  NICHE_WEEK, NICHE_COMPETING, NICHE_COMPETING_ID,
} from "./fixtures.mjs";
import { T, fill, formatDayMonth } from "../../js/text.js";
import { decideList, waitingCount } from "../../js/model.js";
import { markButtonLabels } from "../../js/detail.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const USAGE = "usage: node tests/browser/run-checks.mjs --factory <software-factory repo> --out <dir> [--url <base>]";

const SIZES = [[320, 640], [390, 844], [768, 1024], [1440, 900]];
const VIEWPORTS = SIZES.flatMap(([width, height]) => ["light", "dark"].map((scheme) => ({ width, height, scheme })));
const MAR14_MAX_BOTTOM = 160; // at 320 × 640 the h1 ends within the first 160 px
const TARGET_PX = 44; // the page's --target: every control and link at least 44 × 44, at every width
const FAILING_IMPACT = new Set(["serious", "critical"]);
const READY_TIMEOUT_MS = 20000;
const SETTLE_MS = 250; // the folds' 200 ms chevron turn, the last transition on the page (lamps have none)

// Explicit exceptions: a check that cannot pass for a stated reason. Never a deleted check.
const EXCEPTIONS = [
  "MAR-14 holds a pain's screens (detail-v2, detail-v3, detail-no-gate, detail-long-title, detail-line) to 180 px, not 160: at 320 × 640 their h1 ends at 180 px, under the two-row masthead band (88 px, the brand and the tabs), «← Volver» and a title on two lines. Every other screen ends its h1 within 160 px; these are held to 180 exactly, so any growth fails.",
  "MAR-14 skips detail-line-v1 (see its NOTE): a version-1 card has no title, so its h1 is what_hurts. Transitional: the next run rewrites every card with a title.",
  "Console errors: the browser's own «Failed to load resource» line for a request the fake failed on purpose (home-error's and niches-error's reads, the behaviours' 400, 401, 403 and 500) is expected and not counted. Every other console error fails.",
  "Targets: a link inside a sentence (other words in the same block) is not held to 44 × 44, as WCAG 2.5.8 allows: its height is the line's. Every other link, button, field and fold is.",
  "axe: a moderate or minor violation is printed as a count and does not fail, as in the factory's measure-pieces.mjs; serious and critical fail.",
];

// ---- arguments ----------------------------------------------------------------------------------

function usage(message) {
  console.error(`run-checks: ${message}\n${USAGE}`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--help" || flag === "-h") { console.log(USAGE); process.exit(0); }
    if (!["--factory", "--out", "--url"].includes(flag)) usage(`unknown argument «${flag}»`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--") || value.trim() === "") usage(`${flag} needs a value`);
    args[flag.slice(2)] = value;
    i += 1;
  }
  if (!args.factory) usage("--factory is required");
  if (!args.out) usage("--out is required");
  const assets = join(resolve(args.factory), "design-system", "assets");
  const cache = join(assets, "playwright-cache.mjs");
  if (!existsSync(cache)) usage(`${cache} not found: is --factory the software-factory repo?`);
  if (args.url) {
    let url;
    try { url = new URL(args.url); } catch { usage(`--url «${args.url}» is not a URL`); }
    if (!["http:", "https:"].includes(url.protocol)) usage("--url must be http or https");
    url.hash = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    args.url = url.href;
  }
  return { cache, out: resolve(args.out), url: args.url || null };
}

// ---- the CDN, once ------------------------------------------------------------------------------

// supabase-js (jsDelivr) and the font (Google Fonts) are fetched once for the whole run and then served from memory to
// every screen: each screen opens a fresh context, which would fetch them again a few hundred times.
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const cdnCache = new Map();
async function serveCdn(route) {
  const url = route.request().url();
  let hit = cdnCache.get(url);
  if (!hit) {
    hit = route.fetch().then(async (response) => {
      const headers = { ...response.headers() };
      delete headers["content-encoding"]; // the body comes decoded
      delete headers["content-length"];
      return { status: response.status(), headers, body: await response.body() };
    });
    cdnCache.set(url, hit);
    hit.catch(() => cdnCache.delete(url));
  }
  try { await route.fulfill(await hit); } catch { await route.abort(); }
}

// ---- one screen ---------------------------------------------------------------------------------

async function openScreen(browser, base, scenario, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height }, colorScheme: viewport.scheme, locale: "es-ES",
  });
  await context.route(CDN, serveCdn);
  const page = await context.newPage();
  const state = { data: structuredClone(scenario.data), fail: structuredClone(scenario.fail || {}) };
  const log = await installFakeSupabase(page, state);
  const problems = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const at = message.location() && message.location().url;
    if (/^Failed to load resource/.test(message.text()) && at && log.failedUrls.has(at)) return;
    problems.push(`console error: ${message.text()}${at ? ` (${at})` : ""}`);
  });
  await prepareStorage(page, { signedIn: scenario.signedIn !== false, pendingSignIn: scenario.pendingSignIn });
  await page.goto(new URL(scenario.hash || "", base).href);
  let ready = true;
  try {
    await page.waitForSelector(scenario.ready, { state: "visible", timeout: READY_TIMEOUT_MS });
    await page.waitForFunction(() => !document.querySelector("[aria-busy=true]"), null, { timeout: READY_TIMEOUT_MS });
  } catch {
    ready = false;
    problems.push(`the screen never became ready (${scenario.ready} did not show within ${READY_TIMEOUT_MS / 1000} s)`);
  }
  // The ready selector and the h1 together say it is this scenario's screen and no other.
  const title = await page.evaluate(() => { const h1 = document.querySelector("h1"); return h1 ? h1.textContent : null; });
  if (!scenario.expectedTitle) problems.push("the scenario has no expectedTitle");
  else if (title !== scenario.expectedTitle) {
    ready = false;
    problems.push(`the screen never became ready: the h1 is «${title}», expected «${scenario.expectedTitle}»`);
  }
  return { context, page, state, log, problems, ready };
}

// The fonts in, the last transition over.
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(SETTLE_MS);
}

// axe on the painted screen: the violations with their impact and up to five nodes each.
async function runAxe(page, axePath) {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { resultTypes: ["violations"] });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 5).map((n) => [].concat(n.target).join(" ")) }));
  });
}

// Every visible target with its box (runs in the page). A link inside a sentence (`inline`: the block around it has
// letters or digits outside any target) is WCAG 2.5.8's exception: its height is the line's. A disabled control, a
// transparent one, or one of 2 px or less is not a target.
const MEASURE_TARGETS = () => {
  const SEL = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"],[tabindex="0"]';
  const BLOCK = ["block", "list-item", "flex", "grid", "table-cell", "flow-root"];
  const name = (el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "")
    + (typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "");
  const label = (el) => (el.innerText || el.value || el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const inline = (el) => {
    if (!el.matches("a") || !getComputedStyle(el).display.startsWith("inline")) return false;
    let block = el.parentElement;
    while (block && !BLOCK.includes(getComputedStyle(block).display)) block = block.parentElement;
    if (!block) return false;
    let rest = "";
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const target = n.parentElement && n.parentElement.closest(SEL);
      if (!target || !block.contains(target)) rest += n.textContent;
    }
    return /[\p{L}\p{N}]/u.test(rest);
  };
  const out = [];
  for (const el of document.querySelectorAll(SEL)) {
    if (el.disabled || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    // A stretched link (its ::after absolutely over the whole row, as Catálogo's and Corridas' rows do) is as big as
    // the box it covers.
    const after = getComputedStyle(el, "::after");
    const stretched = after.content !== "none" && after.position === "absolute" && el.offsetParent
      && ["top", "right", "bottom", "left"].every((side) => after[side] === "0px");
    const r = (stretched ? el.offsetParent : el).getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) continue;
    out.push({ name: name(el), label: label(el), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10, inline: inline(el) });
  }
  return out;
};

// The page as measured: sideways scroll, the h1's bottom, what a person reads (innerText: a closed fold is not read),
// and any raw run text (RAW- in the fixtures) outside «Detalle técnico».
const MEASURE_PAGE = () => {
  const h1 = document.querySelector("h1");
  const raw = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.textContent.includes("RAW-") && !(n.parentElement && n.parentElement.closest(".run-tech"))) raw.push(n.textContent.trim().slice(0, 60));
  }
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    h1Bottom: h1 ? Math.round(h1.getBoundingClientRect().bottom + window.scrollY) : null,
    mastheadBottom: (() => { const bar = document.querySelector(".masthead"); return bar ? Math.round(bar.getBoundingClientRect().bottom + window.scrollY) : 0; })(),
    read: document.body.innerText.replace(/\s+/g, " "),
    raw,
  };
};

async function measure(browser, axePath, base, out, scenario, viewport) {
  const label = `${scenario.name} ${viewport.width}×${viewport.height} ${viewport.scheme}`;
  const failures = [];
  const info = [];
  const { context, page, log, problems, ready } = await openScreen(browser, base, scenario, viewport);
  try {
    if (ready) {
      for (const selector of scenario.open || []) {
        try { await page.click(selector, { timeout: 5000 }); } catch { failures.push(`could not open ${selector}`); }
      }
      await settle(page);
      await page.evaluate(() => window.scrollTo(0, 0));

      const violations = await runAxe(page, axePath);
      for (const v of violations.filter((x) => FAILING_IMPACT.has(x.impact))) failures.push(`axe ${v.id} (${v.impact}): ${v.nodes.join(" | ")}`);
      const minor = violations.filter((x) => !FAILING_IMPACT.has(x.impact));
      if (minor.length) info.push(`axe: ${minor.length} moderate or minor (${minor.map((v) => v.id).join(", ")})`);

      const geometry = await page.evaluate(MEASURE_PAGE);
      if (geometry.scrollWidth > geometry.clientWidth) {
        failures.push(`sideways scroll: scrollWidth ${geometry.scrollWidth} > clientWidth ${geometry.clientWidth}`);
      }
      if (viewport.width === 320 && viewport.height === 640 && scenario.mar14 !== false) {
        const max = typeof scenario.mar14 === "number" ? scenario.mar14 : MAR14_MAX_BOTTOM;
        if (geometry.h1Bottom === null) failures.push("MAR-14: no <h1>");
        else if (geometry.h1Bottom > max) {
          failures.push(`MAR-14: the h1 ends at ${geometry.h1Bottom} px (max ${max}; the masthead ends at ${geometry.mastheadBottom} px)`);
        }
      }
      if (geometry.raw.length) failures.push(`raw run text outside «Detalle técnico»: ${geometry.raw.slice(0, 3).join(" | ")}`);
      for (const text of scenario.mustRead || []) if (!geometry.read.includes(text)) failures.push(`not read on the screen: «${text}»`);
      for (const text of scenario.mustNotRead || []) if (geometry.read.includes(text)) failures.push(`read on the screen, and must not be: «${text}»`);

      const targets = await page.evaluate(MEASURE_TARGETS);
      const small = targets.filter((t) => !t.inline && (t.width < TARGET_PX - 0.5 || t.height < TARGET_PX - 0.5));
      if (small.length) {
        failures.push(`targets under ${TARGET_PX} × ${TARGET_PX}: ${small.slice(0, 5).map((t) => `${t.name} «${t.label}» ${t.width} × ${t.height}`).join("; ")}`
          + (small.length > 5 ? ` (and ${small.length - 5} more)` : ""));
      }
      for (const selector of scenario.mustShow || []) {
        if (!(await page.locator(selector).first().isVisible())) failures.push(`not shown: ${selector}`);
      }
    }
    if (log.unknown.length) failures.push(`requests the fake does not know: ${[...new Set(log.unknown)].join(", ")}`);
    failures.push(...problems);
    await page.screenshot({ path: join(out, `${scenario.name}-${viewport.width}-${viewport.scheme}.png`), fullPage: true, animations: "disabled", caret: "hide" });
  } finally {
    await context.close();
  }
  return { label, failures, info };
}

// ---- behaviours ---------------------------------------------------------------------------------

const PHONE = { width: 320, height: 640, scheme: "light" };

async function behaviours(browser, base) {
  const results = [];
  const check = (name, ok, detail) => results.push({ label: `behaviour: ${name}`, failures: ok ? [] : [detail], info: [] });
  const scenario = (name) => scenarios().find((s) => s.name === name);
  const draftKey = "dolores-portal.draft.dol-0027";
  const clean = (log, problems) => problems.length === 0 && log.unknown.length === 0;
  const why = (log, problems) => `${problems.join("; ")}; unknown requests: ${log.unknown.join(", ")}`;
  // «Esta semana»'s count on the home's data (the lead's own count), and the digit its tab shows (null: no count shown).
  const HOME_WAITING = (({ data }) => waitingCount(decideList(data), data.marks, ME))(scenario("home"));
  const tabCount = (page) => page.evaluate(() => {
    const badge = document.querySelector("nav.tabs .tab-count");
    return badge && badge.checkVisibility() ? badge.querySelector("[aria-hidden=true]")?.textContent ?? null : null;
  });

  // A comment with markup shows as literal text.
  {
    const { context, page, log, problems } = await openScreen(browser, base, scenario("detail-v2"), PHONE);
    const seen = await page.evaluate(() => [...document.querySelectorAll(".comment-body")].map((p) => ({ text: p.textContent, elements: p.children.length })));
    const markup = seen.find((c) => c.text === MARKUP_COMMENT);
    check("a comment with markup shows as literal text", markup && markup.elements === 0 && clean(log, problems),
      `comments ${JSON.stringify(seen)}; ${why(log, problems)}`);
    await context.close();
  }

  // The base refuses a comment the page let through (22023); the field says so and keeps the text.
  {
    const { context, page, state, log, problems } = await openScreen(browser, base, scenario("detail-v2"), PHONE);
    const text = "Texto aceptado por la página";
    await page.fill("#comment", text);
    state.fail.add_comment = { status: 400, body: { code: "22023", message: "comment must be 1 to 500 characters", details: null, hint: null } };
    await page.click("form button[type=submit]");
    await page.waitForSelector("#comment-error:not([hidden])", { timeout: 5000 }).catch(() => {});
    const seen = await page.evaluate(() => ({
      error: document.querySelector("#comment-error").textContent,
      value: document.querySelector("#comment").value,
      invalid: document.querySelector("#comment").getAttribute("aria-invalid"),
      published: [...document.querySelectorAll(".comment-body")].length,
    }));
    check("the base refuses a comment and the text is kept",
      seen.value === text && seen.invalid === "true" && seen.error.includes("sigue aquí") && seen.published === 2 && clean(log, problems),
      `${JSON.stringify(seen)}; ${why(log, problems)}`);
    await context.close();
  }

  // Review Focus 3 of the first plan: the session expires while publishing (401, PGRST303). The page says «Tu sesión
  // terminó», keeps the comment, and after signing in again the comment is back in its field on the same pain.
  {
    const { context, page, state, log, problems } = await openScreen(browser, base, scenario("detail-v2"), PHONE);
    const text = "Texto que no debe perderse";
    await page.fill("#comment", text);
    state.fail.add_comment = { status: 401, body: { code: "PGRST303", message: "JWT expired", details: null, hint: null } };
    await page.click("form button[type=submit]");
    const ended = await page.waitForSelector(`text=${T.sessionExpired}`, { timeout: 5000 }).then(() => true, () => false);
    const kept = await page.evaluate((key) => ({ draft: sessionStorage.getItem(key), hash: location.hash, email: !!document.querySelector("#email") }), draftKey);
    check("an expired session says so and keeps the comment",
      ended && kept.email && kept.hash === "#/dolor/dol-0027" && kept.draft !== null && JSON.parse(kept.draft).text === text && log.unknown.length === 0,
      `notice shown: ${ended}; ${JSON.stringify(kept)}; unknown requests: ${log.unknown.join(", ")}`);
    let back = null;
    if (ended && kept.email) {
      await page.fill("#email", ME);
      await page.click("button[type=submit]");
      await page.waitForSelector("#code", { timeout: 5000 });
      await page.fill("#code", CODE);
      back = await page.waitForSelector("#comment", { timeout: 10000 })
        .then(() => page.evaluate(() => ({ value: document.querySelector("#comment").value, hash: location.hash })), () => null);
    }
    check("after signing in again the comment is back",
      back && back.value === text && back.hash === "#/dolor/dol-0027" && clean(log, problems),
      `${JSON.stringify(back)}; ${why(log, problems)}`);
    await context.close();
  }

  // A comment not yet published stops the way out (NAV-06): a tab asks first; «Seguir escribiendo» keeps the text and
  // the pain; «Salir sin publicar» goes where the person meant to.
  {
    const { context, page, log, problems } = await openScreen(browser, base, scenario("detail-v2"), PHONE);
    const text = "Un borrador sin publicar";
    await page.fill("#comment", text);
    await page.click(`nav.tabs a:text-is("${T.tabRuns}")`);
    const asked = await page.waitForSelector(`text=${T.leaveUnsent}`, { timeout: 5000 }).then(() => true, () => false);
    await page.click(`button:text-is("${T.keepWriting}")`).catch(() => {});
    const kept = await page.evaluate(() => ({ value: document.querySelector("#comment") && document.querySelector("#comment").value,
      focused: document.activeElement && document.activeElement.id, hash: location.hash }));
    await page.click(`nav.tabs a:text-is("${T.tabRuns}")`);
    await page.click(`button:text-is("${T.leaveAnyway}")`, { timeout: 5000 }).catch(() => {});
    // The pain's data has no runs, so Corridas opens on its empty state: its h1 says it got there.
    const left = await page.waitForFunction((title) => document.querySelector("h1") && document.querySelector("h1").textContent === title
      && !document.querySelector("[aria-busy=true]"), T.runsTitle, { timeout: 10000 }).then(() => page.evaluate(() => location.hash), () => null);
    check("an unpublished comment asks before leaving, and keeps or drops it as chosen",
      asked && kept.value === text && kept.focused === "comment" && kept.hash === "#/dolor/dol-0027" && left === "#/corridas" && clean(log, problems),
      `asked: ${asked}; ${JSON.stringify(kept)}; left to ${left}; ${why(log, problems)}`);
    await context.close();
  }

  // A mark from the home: the «Nos interesa» of the station Carla marked (dol-0027) is removed and set again, each time
  // in the base, in words under the station, and in «Esta semana»'s count (one more waits for her mark, then one less).
  {
    const { context, page, state, log, problems } = await openScreen(browser, base, scenario("home"), PHONE);
    const station = page.locator('.station:has(a[href="#/dolor/dol-0027"])');
    const note = station.locator(".station-note");
    const mine = () => state.data.marks.filter((m) => m.pain_id === "dol-0027" && m.author === ME).map((m) => m.mark);
    const noteBecomes = async (text) => {
      for (let i = 0; i < 50 && (await note.textContent()) !== text; i += 1) await page.waitForTimeout(100);
      return note.textContent();
    };
    await station.locator(".station-actions .button--primary").click();
    const removed = { note: await noteBecomes(T.markRemoved), marks: mine(), count: await tabCount(page) };
    await station.locator(".station-actions .button--primary").click();
    const saved = { note: await noteBecomes(T.markSavedInterested), marks: mine(), count: await tabCount(page) };
    check("a mark from the home is saved and undone with the same button, and «Esta semana»'s count follows it",
      removed.note === T.markRemoved && removed.marks.length === 0 && removed.count === String(HOME_WAITING + 1)
        && saved.note === T.markSavedInterested && saved.marks.join() === "interested" && saved.count === String(HOME_WAITING)
        && log.calls.filter((c) => c === "POST /rest/v1/rpc/set_mark").length === 2 && clean(log, problems),
      `${JSON.stringify({ waiting: HOME_WAITING, removed, saved })}; ${why(log, problems)}`);
    await context.close();
  }

  // The shell at 1440 × 900 (the sketch's two rows): the brand row holds «tomoshi», the week, the run's state as a pill
  // with its words (the long ones for a screen reader), the niche, the cost and «Salir» as a secondary button, all above
  // the tabs; «Esta semana» is the one current tab, underlined 2 px, and carries the count of pains waiting for your own
  // mark, a digit for the eye and its words for a screen reader.
  {
    const wide = { width: 1440, height: 900, scheme: "light" };
    const { context, page, log, problems } = await openScreen(browser, base, scenario("home"), wide);
    const words = fill(T.leadPendingMany, { count: HOME_WAITING });
    const named = await page.getByRole("link", { name: `${T.tabWeek} ${words}`, exact: true }).count();
    const seen = await page.evaluate(() => {
      const box = (sel) => { const el = document.querySelector(sel); return el && el.checkVisibility() ? el.getBoundingClientRect() : null; };
      const tabs = document.querySelector("nav.tabs");
      const current = [...document.querySelectorAll("nav.tabs a[aria-current]")];
      const badge = document.querySelector("nav.tabs .tab-count");
      const pill = document.querySelector(".masthead .run-pill");
      const tabsTop = tabs ? tabs.getBoundingClientRect().top : 0;
      const row1 = [".brand-word", ".masthead-week", ".run-pill", ".masthead-meta", ".masthead-actions .button"]
        .map((sel) => [sel, box(sel)]).map(([sel, r]) => [sel, r && Math.round(r.bottom) <= Math.round(tabsTop)]);
      return {
        label: tabs && tabs.getAttribute("aria-label"),
        current: current.map((a) => [a.firstChild && a.firstChild.textContent, a.getAttribute("aria-current")]),
        digit: badge && badge.checkVisibility() ? badge.querySelector("[aria-hidden=true]")?.textContent ?? null : null,
        underline: current[0] ? getComputedStyle(current[0], "::after").height : null,
        week: document.querySelector(".masthead-week")?.textContent ?? null,
        pill: pill && pill.checkVisibility() ? { lamp: pill.dataset.lamp, shown: pill.querySelector(".run-pill-short")?.textContent,
          said: pill.querySelector(".visually-hidden")?.textContent } : null,
        signOut: document.querySelector(".masthead-actions .button")?.className ?? null,
        row1,
      };
    });
    check("the shell at 1440: the brand row above the tabs, «Esta semana» current with its count in words",
      seen.label === T.tabsLabel && seen.current.length === 1 && seen.current[0][0] === T.tabWeek && seen.current[0][1] === "page"
        && seen.digit === String(HOME_WAITING) && named === 1 && seen.underline === "2px"
        && seen.week === `${T.metaWeek} ${formatDayMonth(scenario("home").data.summary.date.slice(0, 10))}`
        && seen.pill && seen.pill.lamp === "green" && seen.pill.shown === T.brandShortComplete && seen.pill.said === T.brandLampGreen
        && /\bbutton--secondary\b/.test(seen.signOut) && seen.row1.every(([, above]) => above) && clean(log, problems),
      `${JSON.stringify({ named, ...seen })}; ${why(log, problems)}`);
    await context.close();
  }

  // Below 768 px the brand row keeps «tomoshi», the pill and «Salir» above the tabs, which scroll inside their own row if
  // they must, never the page (the page's scroll is measured on every screen). The week and its data leave the masthead,
  // so the heading stays in the first screen (MAR-14), and the home's line strip says them.
  for (const phone of [{ width: 390, height: 844, scheme: "dark" }, PHONE]) {
    const { context, page, log, problems } = await openScreen(browser, base, scenario("home"), phone);
    await page.waitForSelector(".line-strip-week", { timeout: 10000 }).catch(() => {});
    const seen = await page.evaluate(() => {
      const rect = (sel) => { const el = document.querySelector(sel); return el && el.checkVisibility() ? el.getBoundingClientRect() : null; };
      const tabs = rect("nav.tabs");
      if (!tabs) return { tabs: false };
      const above = (sel) => { const r = rect(sel); return Boolean(r) && Math.round(r.bottom) <= Math.round(tabs.top); };
      const strip = document.querySelector(".line-strip-week");
      return {
        above: [".brand-word", ".run-pill", ".masthead-actions .button"].map((sel) => [sel, above(sel)]),
        gone: [".masthead-week", ".masthead-meta"].map((sel) => [sel, !rect(sel)]),
        strip: strip && strip.checkVisibility() ? strip.textContent : null,
        overflow: getComputedStyle(document.querySelector("nav.tabs")).overflowX,
      };
    });
    check(`the shell at ${phone.width}: brand, pill and «Salir» above the tabs; the week and its data in the home's strip, not the masthead`,
      seen.above && seen.above.every(([, ok]) => ok) && seen.gone.every(([, ok]) => ok)
        && typeof seen.strip === "string" && seen.strip.startsWith(T.metaWeek) && seen.overflow === "auto" && clean(log, problems),
      `${JSON.stringify(seen)}; ${why(log, problems)}`);
    await context.close();
  }

  // A mark from a pain's page counts on «Esta semana»'s tab at once: the home loads the count, the pain undoes Carla's
  // «Nos interesa», and one more waits for her mark.
  {
    const wide = { width: 1440, height: 900, scheme: "dark" };
    const { context, page, log, problems } = await openScreen(browser, base, scenario("home"), wide);
    const before = await tabCount(page);
    await page.evaluate(() => { location.hash = "#/dolor/dol-0027"; });
    // The home's station says the same words: the pain must be open, its h1 the pain's, before the button is pressed.
    const opened = await page.waitForFunction((home) => location.hash === "#/dolor/dol-0027" && !document.querySelector(".station")
      && document.querySelector("h1")?.textContent !== home && !document.querySelector("[aria-busy=true]"), T.homeTitle, { timeout: 10000 })
      .then(() => true, () => false);
    const undo = page.getByRole("button", { name: markButtonLabels("interested").interested, exact: true });
    await undo.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    await undo.click().catch(() => {});
    const redo = page.getByRole("button", { name: markButtonLabels(null).interested, exact: true });
    await redo.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    const after = await tabCount(page);
    check("a mark from a pain's page counts on «Esta semana»'s tab at once",
      opened && before === String(HOME_WAITING) && after === String(HOME_WAITING + 1) && clean(log, problems),
      `pain opened: ${opened}; before ${before}, after ${after}; ${why(log, problems)}`);
    await context.close();
  }

  // «Ver N más» under a source: the quotes are added and the focus goes to the first one added (its item), not its link.
  {
    const { context, page, log, problems } = await openScreen(browser, base, scenario("detail-v3"), PHONE);
    const before = await page.evaluate(() => {
      const source = [...document.querySelectorAll(".how-source")].find((s) => s.querySelector(".more-button"));
      if (!source) return null;
      source.setAttribute("data-check", "more");
      return source.querySelectorAll(".how-quote").length;
    });
    const had = before !== null;
    let focus = null;
    if (had) {
      await page.click("[data-check=more] .more-button");
      focus = await page.evaluate((index) => {
        const el = document.activeElement;
        const items = [...document.querySelector("[data-check=more]").querySelectorAll(".how-quote")];
        return { tag: el.tagName, tabindex: el.getAttribute("tabindex"), index: items.indexOf(el), expected: index, count: items.length };
      }, before);
    }
    check("«Ver más» quotes put the focus on the first quote added",
      focus && focus.tag === "LI" && focus.tabindex === "-1" && focus.index === focus.expected && focus.count > focus.expected && clean(log, problems),
      `more buttons: ${had}; focus ${JSON.stringify(focus)}; ${why(log, problems)}`);
    await context.close();
  }

  // Finish review 3: on a 390 × 844 phone the first station's «Nos interesa» is on the first screen, without scrolling.
  {
    const phone = { width: 390, height: 844, scheme: "dark" };
    const { context, page, log, problems } = await openScreen(browser, base, scenario("home"), phone);
    await settle(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const seen = await page.evaluate(() => {
      const button = document.querySelector(".station .station-actions .button--primary");
      const r = button ? button.getBoundingClientRect() : null;
      return r && { top: Math.round(r.top), bottom: Math.round(r.bottom), height: window.innerHeight, text: button.textContent };
    });
    check("390 × 844: the first station's «Nos interesa» shows without scrolling",
      seen && seen.top >= 0 && seen.bottom <= seen.height && clean(log, problems), `${JSON.stringify(seen)}; ${why(log, problems)}`);
    await context.close();
  }

  // Finish review 6: the home's line says the cuts nobody mapped once, as a link to that run's page.
  {
    const wide = { width: 1440, height: 900, scheme: "light" };
    const { context, page, log, problems } = await openScreen(browser, base, scenario("home"), wide);
    const links = await page.evaluate(() => [...document.querySelectorAll(".line-panel .line-other li")]
      .map((li) => ({ text: li.textContent, href: li.querySelector("a") && li.querySelector("a").getAttribute("href") })));
    check("the home's line says an unexplained cut once, linking to its run",
      links.length === 1 && links[0].text === T.cutOtherLinkOne && links[0].href === `#/corridas/${RUN_ID}` && clean(log, problems),
      `${JSON.stringify(links)}; ${why(log, problems)}`);
    await context.close();
  }

  // Round 3: the top bar names the week, its niche and cost the same way whether the home or a pain is opened first.
  {
    const wide = { width: 1440, height: 900, scheme: "dark" };
    const bars = [];
    for (const name of ["home", "detail-v3"]) {
      const { context, page, log, problems } = await openScreen(browser, base, scenario(name), wide);
      await page.waitForSelector(".masthead-meta:not([hidden])", { timeout: 10000 }).catch(() => {});
      const text = await page.evaluate(() => [".masthead-week", ".masthead-meta"].map((sel) => document.querySelector(sel)?.textContent ?? "").join(" | "));
      bars.push({ name, text, ok: clean(log, problems), why: why(log, problems) });
      await context.close();
    }
    check("the top bar says the same week, niche and cost on the home and on a pain opened first",
      bars[0].text && bars[0].text === bars[1].text && bars[1].text.startsWith(T.metaWeek) && /Costó/.test(bars[1].text) && bars.every((b) => b.ok),
      JSON.stringify(bars));
  }

  // Review Focus 5: 320 px with a long Spanish title and a dense line. The line is the strip under the title (the side
  // panel hidden), the title wraps whole (no ellipsis, nothing cut), no sideways scroll.
  {
    const { context, page, log, problems } = await openScreen(browser, base, scenario("home-long-title"), PHONE);
    const seen = await page.evaluate((long) => {
      const title = [...document.querySelectorAll(".station-title a")].find((a) => a.textContent === long);
      if (!title) return { title: false };
      const style = getComputedStyle(title);
      const heading = title.closest(".station-title");
      return {
        strip: !!document.querySelector(".line-strip") && document.querySelector(".line-strip").checkVisibility(),
        panel: !!document.querySelector(".line-panel") && document.querySelector(".line-panel").checkVisibility(),
        ellipsis: style.textOverflow === "ellipsis" || getComputedStyle(heading).textOverflow === "ellipsis",
        clipped: heading.scrollWidth > heading.clientWidth,
        lines: Math.round(heading.getBoundingClientRect().height / parseFloat(getComputedStyle(heading).lineHeight)),
        scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    }, LONG_WORDS_TITLE);
    check("320 px, a long title: the line is a strip, the title wraps whole, no sideways scroll",
      seen.strip && !seen.panel && !seen.ellipsis && !seen.clipped && seen.lines >= 2 && !seen.scroll && clean(log, problems),
      `${JSON.stringify(seen)}; ${why(log, problems)}`);
    await context.close();
  }

  // Nichos: a niche's row as a person sees it (its state, who vetoed it, its button and its note), found by its name
  // since a veto moves it; and the vetoes sent to the base.
  const nicheRow = (page, name) => page.evaluate((wanted) => {
    const row = [...document.querySelectorAll(".niche-table tbody tr")].find((tr) => tr.querySelector(".niche-name").textContent === wanted);
    if (!row) return null;
    const button = row.querySelector(".niche-veto");
    const text = (sel) => (row.querySelector(sel) ? row.querySelector(sel).textContent : null);
    return {
      state: text(".niche-state"), who: text(".niche-who"), button: button && button.textContent, note: text(".niche-veto-status"),
      focused: !!button && document.activeElement === button,
      disabled: [...document.querySelectorAll(".niche-veto")].filter((b) => b.getAttribute("aria-disabled") === "true").length,
    };
  }, name);
  const nicheRowBecomes = async (page, name, done) => {
    let seen = null;
    for (let i = 0; i < 50; i += 1) {
      seen = await nicheRow(page, name);
      if (seen && done(seen)) return seen;
      await page.waitForTimeout(100);
    }
    return seen;
  };
  const vetoesSent = (log) => log.rpcs.filter((r) => r.name === "set_niche_veto").map((r) => r.payload);
  const sent = (payload, vetoed) => payload && payload.p_name === NICHE_COMPETING_ID && payload.p_vetoed === vetoed;
  const vetoButton = (page) => page.locator(`.niche-table tr:has(.niche-name:text-is("${NICHE_COMPETING}")) .niche-veto`);

  // A competing niche is vetoed with one click: the base gets `p_vetoed: true`, the row turns «Vetado» by Carla with
  // «Quitar veto», the focus stays on its button; a reload reads the same from the base. The same button lifts it: the
  // base gets `false` and the row competes again.
  {
    const { context, page, state, log, problems } = await openScreen(browser, base, scenario("niches"), PHONE);
    const before = await nicheRow(page, NICHE_COMPETING);
    await vetoButton(page).click();
    const vetoed = await nicheRowBecomes(page, NICHE_COMPETING, (s) => s.state === T.nicheStateVetoed && s.note);
    const inBase = state.data.vetoes.filter((v) => v.name === NICHE_COMPETING_ID).map((v) => v.vetoed_by);
    check("Nichos: vetoing a competing niche sends true and the row turns «Vetado» by Carla, with «Quitar veto»",
      before && before.state === T.nicheStateCompeting && before.button === T.nicheVeto
        && vetoed && vetoed.state === T.nicheStateVetoed && vetoed.who && vetoed.who.startsWith("Lo vetó Carla") && vetoed.button === T.nicheUnveto
        && vetoed.focused && vetoed.disabled === 0 && vetoed.note === fill(T.nicheVetoDone, { name: NICHE_COMPETING })
        && vetoesSent(log).length === 1 && sent(vetoesSent(log)[0], true) && inBase.join() === ME && clean(log, problems),
      `${JSON.stringify({ before, vetoed, sent: vetoesSent(log), inBase })}; ${why(log, problems)}`);

    await page.reload();
    await page.waitForSelector(".niche-table", { state: "visible", timeout: READY_TIMEOUT_MS }).catch(() => {});
    const reloaded = await nicheRow(page, NICHE_COMPETING);
    check("Nichos: after a reload the vetoed niche still reads «Vetado» by Carla",
      reloaded && reloaded.state === T.nicheStateVetoed && reloaded.who && reloaded.who.startsWith("Lo vetó Carla")
        && reloaded.button === T.nicheUnveto && clean(log, problems),
      `${JSON.stringify(reloaded)}; ${why(log, problems)}`);

    await vetoButton(page).click();
    const lifted = await nicheRowBecomes(page, NICHE_COMPETING, (s) => s.state === T.nicheStateCompeting && s.note);
    const left = state.data.vetoes.filter((v) => v.name === NICHE_COMPETING_ID).length;
    check("Nichos: pressing «Quitar veto» sends false and the row competes again",
      lifted && lifted.state === T.nicheStateCompeting && lifted.who === null && lifted.button === T.nicheVeto && lifted.focused
        && lifted.note === fill(T.nicheVetoUndone, { name: NICHE_COMPETING })
        && vetoesSent(log).length === 2 && sent(vetoesSent(log)[1], false) && left === 0 && clean(log, problems),
      `${JSON.stringify({ lifted, sent: vetoesSent(log), left })}; ${why(log, problems)}`);
    await context.close();
  }

  // Review Focus 5: the session expires while vetoing (401, PGRST303): the page asks to sign in again with «Tu sesión
  // terminó», and the base keeps no veto.
  {
    const { context, page, state, log, problems } = await openScreen(browser, base, scenario("niches"), PHONE);
    state.fail.set_niche_veto = { status: 401, body: { code: "PGRST303", message: "JWT expired", details: null, hint: null } };
    await vetoButton(page).click();
    const ended = await page.waitForSelector(`text=${T.sessionExpired}`, { timeout: 5000 }).then(() => true, () => false);
    const seen = await page.evaluate(() => ({ email: !!document.querySelector("#email"), hash: location.hash }));
    check("Nichos: a session that ends while vetoing says «Tu sesión terminó»",
      ended && seen.email && vetoesSent(log).length === 1 && !state.data.vetoes.some((v) => v.name === NICHE_COMPETING_ID) && clean(log, problems),
      `notice shown: ${ended}; ${JSON.stringify(seen)}; ${why(log, problems)}`);
    await context.close();
  }

  // Review Focus 5: someone the base refuses (42501) sees «sin permiso».
  {
    const { context, page, state, log, problems } = await openScreen(browser, base, scenario("niches"), PHONE);
    state.fail.set_niche_veto = { status: 403, body: { code: "42501", message: "not a member", details: null, hint: null } };
    await vetoButton(page).click();
    const refused = await page.waitForFunction((title) => document.querySelector("h1") && document.querySelector("h1").textContent === title,
      T.noAccessTitle, { timeout: 5000 }).then(() => true, () => false);
    check("Nichos: a veto the base refuses as «not a member» shows «sin permiso»",
      refused && !state.data.vetoes.some((v) => v.name === NICHE_COMPETING_ID) && clean(log, problems),
      `no-access shown: ${refused}; ${why(log, problems)}`);
    await context.close();
  }

  // Review Focus 5: a base error while vetoing is said in words beside the button, every veto button works again, and
  // pressing it again vetoes.
  {
    const { context, page, state, log, problems } = await openScreen(browser, base, scenario("niches"), PHONE);
    state.fail.set_niche_veto = { status: 500, body: { code: "XX000", message: "fixture failure", details: null, hint: null } };
    await vetoButton(page).click();
    const failed = await nicheRowBecomes(page, NICHE_COMPETING, (s) => s.note === T.nicheVetoError);
    await vetoButton(page).click();
    const again = await nicheRowBecomes(page, NICHE_COMPETING, (s) => s.state === T.nicheStateVetoed);
    check("Nichos: a base error while vetoing is said beside the button, and the button works again",
      failed && failed.note === T.nicheVetoError && failed.state === T.nicheStateCompeting && failed.button === T.nicheVeto && failed.disabled === 0
        && again && again.state === T.nicheStateVetoed && vetoesSent(log).length === 2 && sent(vetoesSent(log)[1], true) && clean(log, problems),
      `${JSON.stringify({ failed, again, sent: vetoesSent(log) })}; ${why(log, problems)}`);
    await context.close();
  }

  // The top bar's niche is a link to Nichos: from Corridas (its tab the current one) it opens #/nichos, whose week block
  // names the same niche; there, and only there, the link is the current page, with the «Nichos» tab.
  {
    const wide = { width: 1440, height: 900, scheme: "light" };
    const from = { ...scenario("niches"), hash: "#/corridas", ready: ".run-list", expectedTitle: T.runsTitle };
    const { context, page, log, problems } = await openScreen(browser, base, from, wide);
    const currentTabs = () => page.evaluate(() => [...document.querySelectorAll("nav.tabs a[aria-current=page]")].map((a) => a.firstChild?.textContent ?? ""));
    const tabsBefore = await currentTabs();
    const link = page.locator(".masthead-meta a.meta-link");
    await link.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    const linkText = await link.textContent().catch(() => null);
    const currentBefore = await link.getAttribute("aria-current").catch(() => "unread");
    await link.click().catch(() => {});
    const opened = await page.waitForFunction((title) => document.querySelector("h1") && document.querySelector("h1").textContent === title
      && document.querySelector(".niche-week .station-title"), T.nichesTitle, { timeout: 10000 })
      .then(() => page.evaluate(() => ({
        hash: location.hash, week: document.querySelector(".niche-week .station-title").textContent,
        current: document.querySelector(".masthead-meta a.meta-link")?.getAttribute("aria-current") ?? null,
      })), () => null);
    const tabsAfter = await currentTabs();
    check("the top bar's niche opens #/nichos, on the same niche, and there it is the current page, with its tab",
      linkText === NICHE_WEEK && currentBefore === null && tabsBefore.join() === T.tabRuns && opened && opened.hash === "#/nichos"
        && opened.week === NICHE_WEEK && opened.current === "page" && tabsAfter.join() === T.tabNiches && clean(log, problems),
      `link «${linkText}», aria-current before «${currentBefore}», tabs ${JSON.stringify({ tabsBefore, tabsAfter })}; ${JSON.stringify(opened)}; ${why(log, problems)}`);
    await context.close();
  }

  // A pain's page belongs to no tab: none is the current one.
  {
    const { context, page, log, problems } = await openScreen(browser, base, scenario("detail-v3"), PHONE);
    const current = await page.evaluate(() => document.querySelectorAll("nav.tabs a").length
      ? document.querySelectorAll("nav.tabs a[aria-current]").length : null);
    check("a pain's page marks no tab as the current one", current === 0 && clean(log, problems), `current tabs ${current}; ${why(log, problems)}`);
    await context.close();
  }
  return results;
}

// ---- main ---------------------------------------------------------------------------------------

function report(result) {
  console.log(`${result.failures.length ? "FAIL" : "PASS"} ${result.label}`);
  for (const failure of result.failures) console.log(`     ${failure}`);
  for (const line of result.info || []) console.log(`     (${line})`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { abrirNavegador, rutaAxe } = await import(pathToFileURL(args.cache).href);
  mkdirSync(args.out, { recursive: true });

  let browser;
  let axePath;
  try {
    axePath = rutaAxe();
    browser = await abrirNavegador();
  } catch (error) {
    console.error(`run-checks: cannot start Chrome with playwright and axe: ${error.message}`);
    process.exit(3);
  }

  const server = args.url ? null : await startStaticServer(REPO);
  const base = args.url || server.url;
  console.log(`base ${base}\nscreenshots ${args.out}`);
  const results = [];
  const all = scenarios();
  try {
    for (const scenario of all) {
      if (scenario.note) console.log(`NOTE ${scenario.note}`);
      for (const viewport of VIEWPORTS) {
        const result = await measure(browser, axePath, base, args.out, scenario, viewport);
        results.push(result);
        report(result);
      }
    }
    for (const result of await behaviours(browser, base)) {
      results.push(result);
      report(result);
    }
  } finally {
    await browser.close();
    if (server) await server.close();
  }

  const failed = results.filter((r) => r.failures.length);
  console.log("\nExceptions:");
  for (const exception of EXCEPTIONS) console.log(`  - ${exception}`);
  const screens = all.length * VIEWPORTS.length;
  console.log(`\n${all.length} scenarios × ${VIEWPORTS.length} viewports + ${results.length - screens} behaviours: ${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(`run-checks: ${error.stack || error.message}`);
  process.exit(error && error.codigo === 3 ? 3 : 1);
});
