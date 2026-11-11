// The browser checks: every screen measured in Chrome with the software factory's verifiers (reglas-pantalla.mjs and
// axe) at 320 × 640, 768 × 1024 and 1440 × 900 in light mode, and 320 and 1440 again in dark mode, against the fake
// Supabase of fixtures.mjs. Then the behaviours a screenshot cannot show (Review Focus 3 and 5).
//
//   node tests/browser/run-checks.mjs --factory <software-factory repo> --out <dir> [--url <base>]
//
// --url defaults to this repo served on 127.0.0.1 at a free port; Task 9 passes the published page. The Supabase
// project's URL is intercepted either way, so the screens get the same data. Exit codes: 0 all pass, 1 a check failed,
// 2 usage error, 3 Chrome or playwright missing. Nothing is installed in this repo: playwright-core and axe-core come
// from the factory's cache (playwright-cache.mjs).

import { mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startStaticServer } from "./static-server.mjs";
import { scenarios, installFakeSupabase, prepareStorage, ME, CODE, MARKUP_COMMENT } from "./fixtures.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const USAGE = "usage: node tests/browser/run-checks.mjs --factory <software-factory repo> --out <dir> [--url <base>]";

const VIEWPORTS = [
  { width: 320, height: 640, scheme: "light" },
  { width: 768, height: 1024, scheme: "light" },
  { width: 1440, height: 900, scheme: "light" },
  { width: 320, height: 640, scheme: "dark" },
  { width: 1440, height: 900, scheme: "dark" },
];
const MAR14_MAX_BOTTOM = 160; // at 320 × 640 the h1 ends within the first 160 px
const READY_TIMEOUT_MS = 20000;

// Explicit exceptions: a check that cannot pass for a stated reason. Never a deleted check.
const EXCEPTIONS = [
  "MAR-14 skips detail-line-v1 (see its NOTE): a version-1 card has no title, so its h1 is what_hurts. Transitional: the next run rewrites every card with a title.",
  "Console errors: the browser's own «Failed to load resource» line for a request the fake failed on purpose (home-error's read, the behaviours' 401 and 400) is expected and not counted. Every other console error fails.",
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
  for (const file of ["reglas-pantalla.mjs", "playwright-cache.mjs"]) {
    if (!existsSync(join(assets, file))) usage(`${join(assets, file)} not found: is --factory the software-factory repo?`);
  }
  if (args.url) {
    let url;
    try { url = new URL(args.url); } catch { usage(`--url «${args.url}» is not a URL`); }
    if (!["http:", "https:"].includes(url.protocol)) usage("--url must be http or https");
    url.hash = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    args.url = url.href;
  }
  return { assets, out: resolve(args.out), url: args.url || null };
}

// ---- one screen ---------------------------------------------------------------------------------

async function openScreen(browser, base, scenario, viewport, extraState = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height }, colorScheme: viewport.scheme, locale: "es-ES",
  });
  const page = await context.newPage();
  const state = { data: structuredClone(scenario.data), fail: structuredClone(scenario.fail || {}), ...extraState };
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
  try {
    await page.waitForSelector(scenario.ready, { state: "visible", timeout: READY_TIMEOUT_MS });
    await page.waitForFunction(() => !document.querySelector("[aria-busy=true]"), null, { timeout: READY_TIMEOUT_MS });
  } catch {
    problems.push(`the screen never became ready (${scenario.ready} did not show within ${READY_TIMEOUT_MS / 1000} s)`);
  }
  // The ready selector and the h1 together say it is this scenario's screen and no other.
  const title = await page.evaluate(() => { const h1 = document.querySelector("h1"); return h1 ? h1.textContent : null; });
  if (!scenario.expectedTitle) problems.push("the scenario has no expectedTitle");
  else if (title !== scenario.expectedTitle) problems.push(`the screen never became ready: the h1 is «${title}», expected «${scenario.expectedTitle}»`);
  return { context, page, state, log, problems };
}

async function measure(verificarPagina, browser, base, out, scenario, viewport) {
  const label = `${scenario.name} ${viewport.width} ${viewport.scheme}`;
  const failures = [];
  const { context, page, log, problems } = await openScreen(browser, base, scenario, viewport);
  try {
    if (!problems.some((p) => p.startsWith("the screen never"))) {
      await page.evaluate(() => window.scrollTo(0, 0));
      const result = await verificarPagina(page, scenario.pattern);
      for (const rule of result.reglas) {
        if (rule.ok === false) failures.push(`${rule.regla} (${(rule.codigos || []).join(", ")}): ${rule.detalle}`);
      }
      for (const violation of result.axe) {
        failures.push(`axe ${violation.regla} (${(violation.codigos || []).join(", ")}), ${violation.impacto}: ${violation.nodos.join(" | ")}`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const geometry = await page.evaluate(() => {
        const h1 = document.querySelector("h1");
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          h1Bottom: h1 ? Math.round(h1.getBoundingClientRect().bottom + window.scrollY) : null,
        };
      });
      if (geometry.scrollWidth > geometry.innerWidth) {
        failures.push(`NAV-04: the page scrolls sideways (scrollWidth ${geometry.scrollWidth} > innerWidth ${geometry.innerWidth})`);
      }
      if (viewport.width === 320 && viewport.height === 640 && scenario.mar14 !== false) {
        if (geometry.h1Bottom === null) failures.push("MAR-14: no <h1>");
        else if (geometry.h1Bottom > MAR14_MAX_BOTTOM) failures.push(`MAR-14: the h1 ends at ${geometry.h1Bottom} px (max ${MAR14_MAX_BOTTOM})`);
      }
      for (const selector of scenario.mustShow || []) {
        if (!(await page.locator(selector).first().isVisible())) failures.push(`not shown: ${selector}`);
      }
    }
    if (log.unknown.length) failures.push(`requests the fake does not know: ${[...new Set(log.unknown)].join(", ")}`);
    failures.push(...problems);
    await page.screenshot({ path: join(out, `${scenario.name}-${viewport.width}-${viewport.scheme}.png`), fullPage: true });
  } finally {
    await context.close();
  }
  return { label, failures };
}

// ---- behaviours ---------------------------------------------------------------------------------

const PHONE = { width: 320, height: 640, scheme: "light" };

async function behaviours(browser, base) {
  const results = [];
  const check = (name, ok, detail) => results.push({ label: `behaviour: ${name}`, failures: ok ? [] : [detail] });
  const detail = () => scenarios().find((s) => s.name === "detail-full");
  const draftKey = "dolores-portal.draft.dol-0027";

  // Review Focus 5: a comment with markup shows as literal text.
  {
    const { context, page, log, problems } = await openScreen(browser, base, detail(), PHONE);
    const seen = await page.evaluate(() => [...document.querySelectorAll(".comment-body")].map((p) => ({ text: p.textContent, elements: p.children.length })));
    const markup = seen.find((c) => c.text === MARKUP_COMMENT);
    check("a comment with markup shows as literal text", markup && markup.elements === 0 && problems.length === 0 && log.unknown.length === 0,
      `comments ${JSON.stringify(seen)}; ${problems.join("; ")}; unknown requests: ${log.unknown.join(", ")}`);
    await context.close();
  }

  // Review Focus 5: the base refuses a comment the page let through (22023); the field says so and keeps the text.
  {
    const { context, page, state, log, problems } = await openScreen(browser, base, detail(), PHONE);
    const text = "Texto aceptado por la página";
    await page.fill("#comment", text);
    state.fail.add_comment = { status: 400, body: { code: "22023", message: "comment must be 1 to 500 characters", details: null, hint: null } };
    await page.click("button[type=submit]");
    await page.waitForSelector("#comment-error:not([hidden])", { timeout: 5000 }).catch(() => {});
    const seen = await page.evaluate(() => ({
      error: document.querySelector("#comment-error").textContent,
      value: document.querySelector("#comment").value,
      invalid: document.querySelector("#comment").getAttribute("aria-invalid"),
      published: [...document.querySelectorAll(".comment-body")].length,
    }));
    check("the base refuses a comment and the text is kept",
      seen.value === text && seen.invalid === "true" && seen.error.includes("sigue aquí") && seen.published === 2 && problems.length === 0
        && log.unknown.length === 0,
      `${JSON.stringify(seen)}; ${problems.join("; ")}; unknown requests: ${log.unknown.join(", ")}`);
    await context.close();
  }

  // Review Focus 3: the session expires while publishing (401, PGRST303). The page says «Tu sesión terminó», keeps the
  // comment, and after signing in again the comment is back in its field on the same pain.
  {
    const { context, page, state, log, problems } = await openScreen(browser, base, detail(), PHONE);
    const text = "Texto que no debe perderse";
    await page.fill("#comment", text);
    state.fail.add_comment = { status: 401, body: { code: "PGRST303", message: "JWT expired", details: null, hint: null } };
    await page.click("button[type=submit]");
    const ended = await page.waitForSelector("text=Tu sesión terminó. Vuelve a entrar.", { timeout: 5000 }).then(() => true, () => false);
    const kept = await page.evaluate((key) => ({ draft: sessionStorage.getItem(key), hash: location.hash, email: !!document.querySelector("#email") }), draftKey);
    check("an expired session says so and keeps the comment",
      ended && kept.email && kept.hash === "#/dolor/dol-0027" && kept.draft !== null && JSON.parse(kept.draft).text === text
        && log.unknown.length === 0,
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
      back && back.value === text && back.hash === "#/dolor/dol-0027" && problems.length === 0 && log.unknown.length === 0,
      `${JSON.stringify(back)}; ${problems.join("; ")}; unknown requests: ${log.unknown.join(", ")}`);
    await context.close();
  }
  return results;
}

// ---- main ---------------------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { verificarPagina } = await import(pathToFileURL(join(args.assets, "reglas-pantalla.mjs")).href);
  const { abrirNavegador, rutaAxe } = await import(pathToFileURL(join(args.assets, "playwright-cache.mjs")).href);
  mkdirSync(args.out, { recursive: true });

  let browser;
  try {
    rutaAxe();
    browser = await abrirNavegador();
  } catch (error) {
    console.error(`run-checks: cannot start Chrome with playwright: ${error.message}`);
    process.exit(3);
  }

  const server = args.url ? null : await startStaticServer(REPO);
  const base = args.url || server.url;
  console.log(`base ${base}\nscreenshots ${args.out}`);
  const results = [];
  try {
    for (const scenario of scenarios()) {
      if (scenario.note) console.log(`NOTE ${scenario.note}`);
      for (const viewport of VIEWPORTS) {
        const result = await measure(verificarPagina, browser, base, args.out, scenario, viewport);
        results.push(result);
        console.log(`${result.failures.length ? "FAIL" : "PASS"} ${result.label}`);
        for (const failure of result.failures) console.log(`     ${failure}`);
      }
    }
    for (const result of await behaviours(browser, base)) {
      results.push(result);
      console.log(`${result.failures.length ? "FAIL" : "PASS"} ${result.label}`);
      for (const failure of result.failures) console.log(`     ${failure}`);
    }
  } finally {
    await browser.close();
    if (server) await server.close();
  }

  const failed = results.filter((r) => r.failures.length);
  console.log("\nExceptions:");
  for (const exception of EXCEPTIONS) console.log(`  - ${exception}`);
  console.log(`\n${scenarios().length} scenarios × ${VIEWPORTS.length} viewports + ${results.length - scenarios().length * VIEWPORTS.length} behaviours: ${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(`run-checks: ${error.stack || error.message}`);
  process.exit(error && error.codigo === 3 ? 3 : 1);
});
