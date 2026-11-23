// The run's production line (lineView, model.js) as the page draws it: one station per stage with its lamp, number,
// label, count and what happened there in words, the sources under the first station, the cuts of the whole run, and
// the cost by model. Beside «Para decidir» from 1024 px; on a phone a folded strip under the title (`compact`), whose
// summary keeps one small lamp per stage. Corridas uses it again.
//
// The «tomoshi» move: lamps that wait for it carry `data-wait` and `data-step`; lightUp() gives them `data-lit` step by
// step, LIGHT_STEP_MS apart, once per screen render, and all at once under prefers-reduced-motion. A lamp without
// `data-wait` is drawn already lit.

import { h } from "./dom.js";
import { T, fill, formatNumber } from "./text.js";
import { lineView, stageNotes, sourceFigures, runFacts, costRows } from "./model.js";

export const LIGHT_STEP_MS = 70;
const LIGHT_START_MS = 160; // after the first paint, so the sequence is seen

// The delay of each step: 0, 70, 140…; all 0 under reduced motion.
export function lightDelays(count, reduced) {
  const n = Number.isInteger(count) && count > 0 ? count : 0;
  return Array.from({ length: n }, (_, i) => (reduced ? 0 : i * LIGHT_STEP_MS));
}

// The move lights a run's lamps once per session (finish review 8): true the first time a run id is drawn lit up in this
// tab's session, false after, so a return to the home or the run's page draws its lamps already lit. Storage that is
// missing or refused counts as the first time and records nothing.
const LIT_KEY = "dolores-portal.lit.";
export function firstLighting(runId, storage = null) {
  if (typeof runId !== "string" || !runId) return false;
  try {
    // Read inside the guard: with site data blocked, the `sessionStorage` getter itself throws (SecurityError).
    const store = storage ?? globalThis.sessionStorage;
    if (store.getItem(LIT_KEY + runId) !== null) return false;
    store.setItem(LIT_KEY + runId, "1");
  } catch { /* no storage: light it */ }
  return true;
}

export const prefersReducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Lights every waiting lamp under `root`, step by step. Returns what stops the timers (a new screen calls it).
export function lightUp(root, reduced = prefersReducedMotion()) {
  const waiting = [...root.querySelectorAll("[data-wait]:not([data-lit])")];
  const light = (step) => waiting.filter((el) => Number(el.dataset.step) === step).forEach((el) => el.setAttribute("data-lit", ""));
  const steps = [...new Set(waiting.map((el) => Number(el.dataset.step)))].sort((a, b) => a - b);
  if (reduced) { steps.forEach(light); return () => {}; }
  const delays = lightDelays(steps.length, false);
  const timers = steps.map((step, i) => setTimeout(() => light(step), LIGHT_START_MS + delays[i]));
  return () => timers.forEach(clearTimeout);
}

// A flat lamp. Its state is always written beside it, so the disc itself is hidden from screen readers. With a `step`
// it waits for the move; without one it is drawn lit.
export function lamp(color, { step = null, size = null } = {}) {
  return h("span", {
    class: size ? `lamp lamp--${size}` : "lamp", "data-lamp": color || "off", "aria-hidden": "true",
    "data-wait": step !== null, "data-step": step, "data-lit": step === null,
  });
}

const pad = (n) => String(n).padStart(2, "0");

// The week's data on one line («Semana del 23 de noviembre · Cuotas y cobros de clubes · 3,66 USD»), each value after
// its label; the niche's and the cost's labels are for a screen reader only, to keep it to one line at 390 px.
const SHOWN_LABEL = new Set([T.metaWeek]);
function weekLine(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return h("span", { class: "line-strip-week" }, rows.map((row, i) => h("span", { class: "line-strip-week-item" },
    i ? " · " : null,
    SHOWN_LABEL.has(row.label) ? `${row.label} ` : h("span", { class: "visually-hidden" }, `${row.label} `),
    h("b", {}, row.value))));
}

function sourcesList(sources, step) {
  return h("ul", { class: "line-sources", role: "list", "aria-label": T.sourcesLabel }, sources.map((source) => {
    const figures = sourceFigures(source);
    const flagged = source.lamp === "amber" || source.lamp === "red";
    return h("li", { class: "line-source" },
      lamp(source.lamp, { step, size: "small" }),
      h("span", { class: "line-source-name" }, source.name || source.kind || T.sourceUnknown),
      h("span", { class: "line-source-figure" }, figures.figure ?? "", figures.of ? h("span", { class: "line-source-of" }, ` ${figures.of}`) : null),
      h("span", { class: flagged ? `line-flag line-flag--${source.lamp}` : "line-source-state" }, figures.state));
  }));
}

// `light` false draws every lamp already lit (an older run's line does not light up).
function stationItem(stage, index, view, light) {
  const { state, notes } = stageNotes(stage, view.cuts);
  const first = index === 0;
  const step = light ? index : null;
  return h("li", { class: "line-station", "data-lamp": stage.lamp },
    lamp(stage.lamp, { step }),
    h("h3", { class: "line-station-label" }, h("span", { class: "line-station-number", "aria-hidden": "true" }, pad(index + 1)), stage.label),
    h("p", { class: stage.count === null ? "line-station-count is-empty" : "line-station-count" },
      stage.count === null ? T.stageNoData : formatNumber(stage.count)),
    h("p", { class: "line-station-notes" },
      h("span", { class: stage.lamp === "amber" ? "line-flag line-flag--amber" : "line-station-state" }, state),
      notes.length ? ` · ${notes.join(" · ")}` : null),
    first && view.sources.length ? sourcesList(view.sources, step) : null);
}

// The cuts that belong to no station, as list items: each one with plain words, then the unexplained ones said once,
// together, as a link to the run's page, where «Lo que se recortó» counts them and «Detalle técnico» has their
// sentences (finish review 6).
function looseCutItems(cuts, runId) {
  const loose = cuts.filter((cut) => cut.stage === null);
  const others = loose.filter((cut) => !cut.explained).length;
  const items = loose.filter((cut) => cut.explained).map((cut) => h("li", {}, cut.text));
  if (others) {
    const words = others === 1 ? T.cutOtherLinkOne : fill(T.cutsOtherLinkMany, { count: formatNumber(others) });
    items.push(h("li", {}, typeof runId === "string" && runId
      ? h("a", { class: "line-other-link", href: `#/corridas/${encodeURIComponent(runId)}` }, words) : words));
  }
  return items;
}

// The line's body: the stations, the run's own cuts (unless `withOthers` is false), the cost (unless `withCosts` is
// false). Empty without a trace.
function lineBody(trace, view, ids, light, withCosts, withOthers) {
  if (!view) return [];
  const loose = withOthers ? looseCutItems(view.cuts, trace.run_id) : [];
  const costs = withCosts ? costRows(trace) : [];
  return [
    view.stages.length ? h("ol", { class: "line-stations", role: "list" }, view.stages.map((stage, i) => stationItem(stage, i, view, light))) : null,
    loose.length ? h("div", { class: "line-other" },
      h("h3", { id: `${ids}-otros` }, T.otherCuts),
      h("ul", { role: "list", "aria-labelledby": `${ids}-otros` }, loose)) : null,
    costs.length ? h("dl", { class: "line-costs", "aria-label": T.costLabel },
      costs.map((row) => h("div", {}, h("dt", {}, row.label), h("dd", {}, row.value)))) : null,
  ];
}

// renderLine(trace, { compact, title, note, idPrefix, light, costs, otherCuts, week }) → the line as an Element. `title` and `note` come
// from lineHeading (model.js): this week's line, an older run's by its date, or no line and why. `light` (default true)
// makes the lamps wait for the «tomoshi» move; the home passes false for an older run's line, which is drawn already
// lit. `costs` (default true) ends the line with the cost by model; Corridas passes false and shows its own, with the
// total. `otherCuts` (default true) ends the stations with «Otros recortes»; the run's own page passes false (its «Lo que
// se recortó» says them). `week` (the strip only): the week's data (weekMeta) in the strip's summary, shown on a phone,
// where the masthead leaves it out (finish review 3).
export function renderLine(trace, { compact = false, title = T.lineTitle, note = null, idPrefix = "linea", light = true, costs = true, otherCuts = true, week = [] } = {}) {
  const view = lineView(trace);
  const facts = runFacts(trace);
  const headingId = `${idPrefix}-titulo`;
  const heading = h("h2", { id: headingId }, title);
  const head = h("div", { class: "line-head" },
    heading,
    facts.length ? h("p", { class: "line-facts" }, facts.join(" · ")) : null,
    note ? h("p", { class: "line-note" }, note) : null);
  const body = lineBody(trace, view, idPrefix, light, costs, otherCuts);
  if (!compact) return h("section", { class: "line", "aria-labelledby": headingId }, head, body);

  // The strip: the stage lamps in a row and how many stages had a cut; open, the whole line.
  const stages = view ? view.stages : [];
  const cut = stages.filter((s) => s.lamp === "amber").length;
  const summary = h("summary", { class: "line-strip-summary" },
    h("span", { class: "line-strip-title" }, title),
    stages.length ? h("span", { class: "line-strip-lamps", "aria-hidden": "true" }, stages.map((s, i) => lamp(s.lamp, { step: light ? i : null, size: "small" }))) : null,
    stages.length ? h("span", { class: "line-strip-state" }, cut === 1 ? T.lineStripCutsOne : cut ? fill(T.lineStripCuts, { count: formatNumber(cut) }) : T.lineStripClean) : null,
    weekLine(week));
  if (!stages.length) {
    // No stations to draw: the title, the facts and the note say why, open at every width (the page shows no panel).
    return h("section", { class: "line line-strip line-strip--empty", "aria-labelledby": headingId }, head, weekLine(week));
  }
  heading.setAttribute("class", "visually-hidden"); // the summary already says it
  return h("details", { class: "line line-strip" }, summary, h("section", { class: "line-strip-body", "aria-labelledby": headingId }, head, body));
}
