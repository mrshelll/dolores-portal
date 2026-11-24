// A pain's checks (checkRows, model.js: its judged counts against the run's own thresholds) drawn twice. In a closed
// row, a stack: one line per check, a filled circle (a tick when it passes, a cross when it fails, a dash when it has no
// result) and the check in a few words («1 tipo de fuente · falta 1»). In an open row or a pain's page, box cells: per
// check its name, its value, a row of boxes filled to the value with an ink rule at the threshold, the verdict in words
// («Fuera del rango · falta 1») and the minimum («Mínimo 2»); the per-country note closes them. Every circle, verdict
// icon and box row is hidden from a screen reader: the words beside it carry its meaning. Both return null when the
// gate gives no checks (missing or malformed): the caller then keeps its facts line and claims nothing.

import { h } from "./dom.js";
import { checkRows } from "./model.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  el.append(...children);
  return el;
}

// The stack's circle: its colour comes from the check's data-result (css/base.css), its mark from the result.
const CIRCLE_MARK = { pass: "m4.9 8.2 2.1 2.1 4.1-4.4", fail: "m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8", none: "M5 8h6" };
const circle = (result) => svg("svg", { class: "check-icon", viewBox: "0 0 16 16", width: 16, height: 16, "aria-hidden": "true" },
  svg("circle", { cx: 8, cy: 8, r: 7.5 }), svg("path", { d: CIRCLE_MARK[result] }));

// The cell's verdict: a stroke tick or cross before its words. A check with no result has no verdict.
const VERDICT_MARK = { pass: "M20 6 9 17l-5-5", fail: "M18 6 6 18M6 6l12 12" };
const verdictIcon = (result) => svg("svg", { class: "check-flag-icon", viewBox: "0 0 24 24", width: 14, height: 14, "aria-hidden": "true" },
  svg("path", { d: VERDICT_MARK[result] }));

// The boxes: one per unit up to the row's `max`, the first `at` filled, the rule right after box `min` (so before box
// `min + 1`, or closing the row when the threshold is its end). A check with no numbers (attacks with no result, the
// statement) has none.
function boxRow({ min, max, at }) {
  if (![min, max, at].every(Number.isInteger) || max < 1) return null;
  const boxes = [];
  for (let i = 1; i <= max; i += 1) {
    boxes.push(h("span", { class: i <= at ? "box box--filled" : "box" }));
    if (i === min) boxes.push(h("span", { class: "box-rule" }));
  }
  return h("span", { class: "box-row", "aria-hidden": "true", style: `--min: ${min}; --at: ${at}` }, boxes);
}

const cell = (row) => h("div", { class: "check-cell", "data-result": row.result },
  h("p", { class: "check-label" }, row.label),
  h("p", { class: "check-value" }, h("strong", { class: "check-figure" }, row.value), boxRow(row)),
  row.flagText ? h("p", { class: "check-flag" }, verdictIcon(row.result), row.flagText) : null,
  row.minText ? h("p", { class: "check-min" }, row.minText) : null);

// checkStack(gate) → ul.check-stack, one li.check per check with its data-result; null without checks.
export function checkStack(gate) {
  const { rows } = checkRows(gate);
  if (!rows.length) return null;
  return h("ul", { class: "check-stack" },
    rows.map((row) => h("li", { class: "check", "data-result": row.result }, circle(row.result), row.short)));
}

// checkCells(gate) → div.check-cells, one div.check-cell per check with its data-result, the note as p.check-note;
// null without checks.
export function checkCells(gate) {
  const { rows, note } = checkRows(gate);
  if (!rows.length) return null;
  return h("div", { class: "check-cells" }, rows.map(cell), note ? h("p", { class: "check-note" }, note) : null);
}
