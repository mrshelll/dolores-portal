// The run's line (lineView, model.js) as the page draws it: a step list. Its head: the title, the run's facts (its day,
// how many steps, how long it took, its cost) and, when a step had a cut, «Hubo recorte en 3 pasos» after the blue
// scissors. Then the column heads «Paso» and «Quedan» and one item per step: a cut step carries the scissors and what
// was cut in words under its name, a clear one a muted ✓ circle, one with no count a muted dash; how many remain, with
// the cap muted under it when the step has one; the sources indented under the first step, each with its figures and
// its state in words. Then the cuts of the whole run («Otros recortes») and the cost by model at the foot. No column
// says how long a step took: the trace carries no per-step time. Beside «Para decidir» from 1024 px; on a phone and a
// tablet a folded strip under the title (`compact`) whose summary says how many steps had a cut and whose body is the
// same list. A run's page uses it again. Every icon is hidden from a screen reader: the words beside it, or the words
// said for it, carry its state. Everything is drawn in its final state on the first paint.

import { h, icon } from "./dom.js";
import { T, fill, formatNumber } from "./text.js";
import { lineView, stageNotes, sourceFigures, runFacts, costRows } from "./model.js";

// A flat dot. Its state is always written beside it, so the dot itself is hidden from screen readers. `data-lamp`
// keeps the internal names (green, amber, red, off); amber renders as the attention blue (css/base.css).
export function lamp(color) {
  return h("span", { class: "lamp", "data-lamp": color || "off", "aria-hidden": "true" });
}

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

const said = (words) => h("span", { class: "visually-hidden" }, words);
const lowered = (words) => words.toLocaleLowerCase("es");

// The icons: the scissors of a cut, the ✓ circle of a clear step, the dash circle of a step with no count.
const SCISSORS = { circles: [[6, 6, 3], [6, 18, 3]], paths: ["M20 4 8.1 15.9", "M14.5 14.5 20 20", "M8.1 8.1 12 12"] };
const STEP_ICON = {
  amber: ["cut", SCISSORS],
  green: ["clear", { circles: [[12, 12, 9]], paths: ["m8.4 12.3 2.5 2.4 4.7-5"] }],
  off: ["none", { circles: [[12, 12, 9]], paths: ["M8.5 12h7"] }],
};
const stepIcon = (color) => {
  const [kind, parts] = STEP_ICON[color] ?? STEP_ICON.off;
  return icon(`line-step-icon line-step-icon--${kind}`, parts);
};

// How many steps had a cut, after the scissors (a paragraph in the head, a span in the strip's summary); null with none.
function cutsLine(stages, tag = "p") {
  const cut = stages.filter((s) => s.lamp === "amber").length;
  if (!cut) return null;
  return h(tag, { class: "line-cuts" }, icon("line-cuts-icon", SCISSORS),
    cut === 1 ? T.lineCutsOne : fill(T.lineCuts, { count: formatNumber(cut) }));
}

// A source under the first step: its name, its figures («240 → 29», «de 1830» when more were there) and its state in
// words, in its colour.
function sourceItem(source) {
  const { figure, of, state } = sourceFigures(source);
  return h("li", { class: "line-source", "data-lamp": source.lamp },
    h("span", { class: "line-source-name" }, said(`${T.sourceRowLabel} `), source.name || source.kind || T.sourceUnknown),
    h("span", { class: "line-source-figures" }, figure === null
      ? h("span", { "aria-hidden": "true" }, "—")
      : [h("span", { class: "line-figure" }, figure), of ? h("span", { class: "line-count-of" }, of) : null]),
    h("span", { class: "line-source-state" }, state));
}

// A step: its icon, its name, how many remain (the cap muted under it) and, for a screen reader, how many remain and
// the state of a step with no cut; a cut step says what was cut under its name (the run's own words for the cuts made
// there, or «Con recorte» when it has none: its sources say why), and the first step lists the sources.
function stepItem(stage, index, view) {
  const { state } = stageNotes(stage, view.cuts);
  const cut = stage.lamp === "amber";
  const cutTexts = view.cuts.filter((c) => c.stage === stage.key && c.text).map((c) => c.text);
  const count = stage.count === null
    ? h("span", { class: "line-step-count is-empty" }, h("span", { "aria-hidden": "true" }, "—"))
    : h("span", { class: "line-step-count" },
      said(`${lowered(T.lineColLeft)} `),
      h("b", {}, formatNumber(stage.count)),
      stage.cap === null ? null : [said(", "), h("span", { class: "line-step-cap" }, fill(T.stageCap, { cap: formatNumber(stage.cap) }))]);
  return h("li", { class: "line-step", "data-lamp": stage.lamp },
    stepIcon(stage.lamp),
    h("span", { class: "line-step-name" }, stage.label),
    count,
    cut ? null : said(`, ${lowered(state)}`),
    cut ? h("p", { class: "line-step-note" }, cutTexts.length ? cutTexts.join(" · ") : state) : null,
    index === 0 && view.sources.length ? h("ul", { class: "line-sources", role: "list" }, view.sources.map(sourceItem)) : null);
}

// The step list: the column heads for the eye (each step says its count in words), then the steps.
function stepList(view, headingId) {
  return h("div", { class: "line-steps" },
    h("div", { class: "line-steps-head", "aria-hidden": "true" },
      h("span", {}), h("span", {}, T.lineColStep), h("span", {}, T.lineColLeft)),
    h("ol", { class: "line-step-list", role: "list", "aria-labelledby": headingId },
      view.stages.map((stage, i) => stepItem(stage, i, view))));
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

// The line's body: the step list, the run's own cuts (unless `withOthers` is false), the cost (unless `withCosts` is
// false). Empty without a trace.
function lineBody(trace, view, ids, withCosts, withOthers) {
  if (!view) return [];
  const loose = withOthers ? looseCutItems(view.cuts, trace.run_id) : [];
  const costs = withCosts ? costRows(trace) : [];
  return [
    view.stages.length ? stepList(view, `${ids}-titulo`) : null,
    loose.length ? h("div", { class: "line-other" },
      h("h3", { id: `${ids}-otros` }, T.otherCuts),
      h("ul", { role: "list", "aria-labelledby": `${ids}-otros` }, loose)) : null,
    costs.length ? h("dl", { class: "line-costs", "aria-label": T.costLabel },
      costs.map((row) => h("div", {}, h("dt", {}, row.label), h("dd", {}, row.value)))) : null,
  ];
}

// renderLine(trace, { compact, title, note, idPrefix, costs, otherCuts, week }) → the line as an Element. `title` and
// `note` come from lineHeading (model.js): this week's line, an older run's by its date, or no line and why. `costs`
// (default true) ends the line with the cost by model; Corridas passes false and shows its own, with the
// total. `otherCuts` (default true) ends the steps with «Otros recortes»; the run's own page passes false (its «Lo que
// se recortó» says them). `week` (the strip only): the week's data (weekMeta) in the strip's summary, shown on a phone,
// where the masthead leaves it out (finish review 3).
export function renderLine(trace, { compact = false, title = T.lineTitle, note = null, idPrefix = "linea", costs = true, otherCuts = true, week = [] } = {}) {
  const view = lineView(trace);
  const stages = view ? view.stages : [];
  const facts = runFacts(trace, { steps: stages.length });
  const headingId = `${idPrefix}-titulo`;
  const heading = h("h2", { id: headingId }, title);
  const head = h("div", { class: "line-head" },
    heading,
    facts.length ? h("p", { class: "line-facts" }, facts.join(" · ")) : null,
    note ? h("p", { class: "line-note" }, note) : null,
    compact ? null : cutsLine(stages));
  const body = lineBody(trace, view, idPrefix, costs, otherCuts);
  if (!compact) return h("section", { class: "line", "aria-labelledby": headingId }, head, body);

  // The strip: the title and how many steps had a cut (or «Sin recortes»); open, the whole line.
  if (!stages.length) {
    // No steps to draw: the title, the facts and the note say why, open at every width (the page shows no panel).
    return h("section", { class: "line line-strip line-strip--empty", "aria-labelledby": headingId }, head, weekLine(week));
  }
  const summary = h("summary", { class: "line-strip-summary" },
    h("span", { class: "line-strip-title" }, title),
    cutsLine(stages, "span") || h("span", { class: "line-strip-state" }, T.lineStripClean),
    weekLine(week));
  heading.setAttribute("class", "visually-hidden"); // the summary already says it
  return h("details", { class: "line line-strip" }, summary, h("section", { class: "line-strip-body", "aria-labelledby": headingId }, head, body));
}
