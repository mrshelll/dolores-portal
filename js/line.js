// The run's production line (lineView, model.js) as the page draws it: the lab report's processed sample, its heading
// and the run's facts, then a table with one row per stage (number, name, count, cap and
// its indicator: a dot and its state in words), the sources indented under stage 01, a stage's cuts as a note row under
// it; then the cuts of the whole run and the cost by model. Beside «Para decidir» from 1024 px; on a phone a folded
// strip under the title (`compact`), whose summary keeps one small lamp per stage. A run's page uses it again. Every
// lamp is drawn in its final state on the first paint: the lab report has no lighting sequence.

import { h } from "./dom.js";
import { T, fill, formatNumber } from "./text.js";
import { lineView, stageNotes, sourceFigures, runFacts, costRows } from "./model.js";

// A flat dot. Its state is always written beside it, so the dot itself is hidden from screen readers. `data-lamp`
// keeps the internal names (green, amber, red, off); amber renders as the attention blue (css/base.css).
export function lamp(color, { size = null } = {}) {
  return h("span", { class: size ? `lamp lamp--${size}` : "lamp", "data-lamp": color || "off", "aria-hidden": "true" });
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

// The lab report's processed sample: the line as a table, one row per stage (its number, name, count, cap and its
// indicator: a dot and its state in words), the sources as indented rows under stage 01, and a stage's cuts in words
// as a note row under it. Its rows are laid out as grids (css/base.css, .line-table), so every part of the table
// carries its role explicitly: a table whose CSS display is changed can lose its semantics in some browsers.

// A cell's dash (no cap, no count) is for the eye; a screen reader hears it in words.
const dash = (words) => [h("span", { "aria-hidden": "true" }, "—"), h("span", { class: "visually-hidden" }, words)];
// An abbreviated column head («N°», «Cant.») is for the eye; a screen reader hears the whole word.
const abbreviated = (short, full) => [h("span", { "aria-hidden": "true" }, short), h("span", { class: "visually-hidden" }, full)];

const indicator = (color, words) => h("span", { class: "line-indicator", "data-lamp": color || "off" }, lamp(color, { size: "small" }), words);
const cell = (attrs, ...children) => h("td", { role: "cell", ...attrs }, ...children);
const rowHeader = (...children) => h("th", { scope: "row", role: "rowheader", class: "line-stage" }, ...children);

function sourceRow(source) {
  const figures = sourceFigures(source);
  return h("tr", { class: "line-row line-row--source", role: "row" },
    cell({ class: "line-number" }),
    rowHeader(h("span", { class: "visually-hidden" }, `${T.sourceRowLabel} `), source.name || source.kind || T.sourceUnknown),
    cell({ class: "line-count", colspan: 2 }, figures.figure === null ? dash(T.lineNoCount)
      : [h("span", { class: "line-figure" }, figures.figure), figures.of ? [" ", h("span", { class: "line-count-of" }, figures.of)] : null]),
    cell({ class: "line-flag-cell" }, indicator(source.lamp, figures.state)));
}

function stageRows(stage, index, view) {
  const { state } = stageNotes(stage, view.cuts);
  // The cap has its own column; the note row says what was cut there.
  const notes = view.cuts.filter((cut) => cut.stage === stage.key && cut.text).map((cut) => cut.text);
  return [
    h("tr", { class: "line-row", role: "row", "data-lamp": stage.lamp },
      cell({ class: "line-number" }, pad(index + 1)),
      rowHeader(stage.label),
      cell({ class: "line-count" }, stage.count === null ? dash(T.lineNoCount) : formatNumber(stage.count)),
      cell({ class: "line-cap" }, stage.cap === null ? dash(T.lineNoCap) : formatNumber(stage.cap)),
      cell({ class: "line-flag-cell" }, indicator(stage.lamp, state))),
    notes.length ? h("tr", { class: "line-row-note", role: "row" }, cell({ class: "line-row-note-text", colspan: 5 }, notes.join(" · "))) : null,
    index === 0 ? view.sources.map(sourceRow) : null,
  ];
}

function sampleTable(view, headingId) {
  const column = (attrs, ...children) => h("th", { scope: "col", role: "columnheader", ...attrs }, ...children);
  return h("div", { class: "line-sample" },
    h("table", { class: "line-table", role: "table", "aria-labelledby": headingId },
      h("thead", { role: "rowgroup" }, h("tr", { class: "line-table-head", role: "row" },
        column({ class: "line-number" }, abbreviated(T.lineColNumber, T.lineColNumberFull)),
        column({ class: "line-stage" }, T.lineColStage),
        column({ class: "line-count" }, abbreviated(T.lineColCount, T.lineColCountFull)),
        column({ class: "line-cap" }, T.lineColCap),
        column({ class: "line-flag-cell" }, T.lineColFlag))),
      h("tbody", { role: "rowgroup" }, view.stages.map((stage, i) => stageRows(stage, i, view)))));
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

// The line's body: the sample's table, the run's own cuts (unless `withOthers` is false), the cost (unless `withCosts` is
// false). Empty without a trace.
function lineBody(trace, view, ids, withCosts, withOthers) {
  if (!view) return [];
  const loose = withOthers ? looseCutItems(view.cuts, trace.run_id) : [];
  const costs = withCosts ? costRows(trace) : [];
  return [
    view.stages.length ? sampleTable(view, `${ids}-titulo`) : null,
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
// total. `otherCuts` (default true) ends the stations with «Otros recortes»; the run's own page passes false (its «Lo que
// se recortó» says them). `week` (the strip only): the week's data (weekMeta) in the strip's summary, shown on a phone,
// where the masthead leaves it out (finish review 3).
export function renderLine(trace, { compact = false, title = T.lineTitle, note = null, idPrefix = "linea", costs = true, otherCuts = true, week = [] } = {}) {
  const view = lineView(trace);
  const facts = runFacts(trace);
  const headingId = `${idPrefix}-titulo`;
  const heading = h("h2", { id: headingId }, title);
  const head = h("div", { class: "line-head" },
    heading,
    facts.length ? h("p", { class: "line-facts" }, facts.join(" · ")) : null,
    note ? h("p", { class: "line-note" }, note) : null);
  const body = lineBody(trace, view, idPrefix, costs, otherCuts);
  if (!compact) return h("section", { class: "line", "aria-labelledby": headingId }, head, body);

  // The strip: the stage lamps in a row and how many stages had a cut; open, the whole line.
  const stages = view ? view.stages : [];
  const cut = stages.filter((s) => s.lamp === "amber").length;
  const summary = h("summary", { class: "line-strip-summary" },
    h("span", { class: "line-strip-title" }, title),
    stages.length ? h("span", { class: "line-strip-lamps", "aria-hidden": "true" }, stages.map((s) => lamp(s.lamp, { size: "small" }))) : null,
    stages.length ? h("span", { class: "line-strip-state" }, cut === 1 ? T.lineStripCutsOne : cut ? fill(T.lineStripCuts, { count: formatNumber(cut) }) : T.lineStripClean) : null,
    weekLine(week));
  if (!stages.length) {
    // No stations to draw: the title, the facts and the note say why, open at every width (the page shows no panel).
    return h("section", { class: "line line-strip line-strip--empty", "aria-labelledby": headingId }, head, weekLine(week));
  }
  heading.setAttribute("class", "visually-hidden"); // the summary already says it
  return h("details", { class: "line line-strip" }, summary, h("section", { class: "line-strip-body", "aria-labelledby": headingId }, head, body));
}
