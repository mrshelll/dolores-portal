// A pain's checks (checkRows, model.js: its judged counts against the run's own thresholds) drawn twice. In a closed
// row, a stack: one line per check, a filled circle (a tick when it passes, a cross when it fails, a dash when it has no
// result) and the check in a few words («1 tipo de fuente · falta 1»). In an open row or a pain's page, box cells: per
// check its name, its value, a row of boxes filled to the value with an ink rule at the threshold, the verdict in words
// («Fuera del rango · falta 1») and the minimum («Mínimo 2»); the per-country note closes them. Every circle, verdict
// icon and box row is hidden from a screen reader: the words beside it carry its meaning, and a stack's line says its
// result in words for a screen reader only (the ✓ and ✗ already differ for the eye). Both return null when the
// gate gives no checks (missing or malformed): a closed row then shows checkUnmeasured (the dash and «Sin medir contra
// los umbrales») and its facts line, its open part only its actions, and a pain's page says there is no analysis;
// none claims a range.

import { h, svg } from "./dom.js";
import { T } from "./text.js";
import { checkRows } from "./model.js";

// The stack's circle: its colour comes from its parent's data-result (css/base.css), its mark from the result. A pain's
// page draws it too, before each attack's and duel's result in words.
const CIRCLE_MARK = { pass: "m4.9 8.2 2.1 2.1 4.1-4.4", fail: "m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8", none: "M5 8h6" };
export const checkIcon = (result) => svg("svg", { class: "check-icon", viewBox: "0 0 16 16", width: 16, height: 16, "aria-hidden": "true" },
  svg("circle", { cx: 8, cy: 8, r: 7.5 }), svg("path", { d: CIRCLE_MARK[result] }));

// The cell's verdict: a stroke tick or cross before its words. A check with no result has no verdict. Nichos draws it
// too, before a figure's «Con señal» or «Sin señal».
const VERDICT_MARK = { pass: "M20 6 9 17l-5-5", fail: "M18 6 6 18M6 6l12 12" };
export const verdictIcon = (result) => svg("svg", { class: "check-flag-icon", viewBox: "0 0 24 24", width: 14, height: 14, "aria-hidden": "true" },
  svg("path", { d: VERDICT_MARK[result] }));

// The boxes: one per unit up to the row's `max`, the first `at` filled, the rule right after box `min` (so before box
// `min + 1`, or closing the row when the threshold is its end). Past ten units the row draws ten boxes, each a tenth of
// it: round(at / max × 10) filled, the rule after round(min / max × 10) (before the first box when that rounds to 0);
// the figure and the words keep the exact count. A drawing never contradicts the verdict: a count in range reaches the
// rule, one out of range stops before it even when its tenth rounds up to it. A check with no numbers (attacks with no
// result, the statement) has none.
const MAX_BOXES = 10;
function boxRow({ min, max, at }) {
  if (![min, max, at].every(Number.isInteger) || max < 1) return null;
  const scale = max > MAX_BOXES ? MAX_BOXES / max : 1;
  const boxes = Math.min(max, MAX_BOXES);
  const rule = Math.round(min * scale);
  const tenths = Math.round(at * scale);
  const filled = at >= min ? Math.max(tenths, rule) : Math.min(tenths, rule - 1);
  const row = rule === 0 ? [h("span", { class: "box-rule" })] : [];
  for (let i = 1; i <= boxes; i += 1) {
    row.push(h("span", { class: i <= filled ? "box box--filled" : "box" }));
    if (i === rule) row.push(h("span", { class: "box-rule" }));
  }
  return h("span", { class: "box-row", "aria-hidden": "true", style: `--min: ${min}; --at: ${at}` }, row);
}

const cell = (row) => h("div", { class: "check-cell", "data-result": row.result },
  h("p", { class: "check-label" }, row.label),
  h("p", { class: "check-value" }, h("strong", { class: "check-figure" }, row.value), boxRow(row)),
  row.flagText ? h("p", { class: "check-flag" }, verdictIcon(row.result), row.flagText) : null,
  row.minText ? h("p", { class: "check-min" }, row.minText) : null);

// The ✓ and the ✗ differ for the eye; a screen reader hears the result in words after the check. A check with no
// result says so in its own words.
const SAID = { pass: "checkSaidPass", fail: "checkSaidFail" };
const said = (result) => (SAID[result] ? h("span", { class: "visually-hidden" }, `, ${T[SAID[result]]}`) : null);

// checkStack(gate) → ul.check-stack, one li.check per check with its data-result; null without checks.
export function checkStack(gate) {
  const { rows } = checkRows(gate);
  if (!rows.length) return null;
  return h("ul", { class: "check-stack" },
    rows.map((row) => h("li", { class: "check", "data-result": row.result }, checkIcon(row.result), row.short, said(row.result))));
}

// checkUnmeasured() → p.check with data-result "none": where a row's stack goes when its pain has no gate (stored before
// it existed), the dash circle and «Sin medir contra los umbrales», muted, so the row claims no range.
export const checkUnmeasured = () => h("p", { class: "check", "data-result": "none" }, checkIcon("none"), T.checkUnmeasured);

// checkCells(gate) → div.check-cells, one div.check-cell per check with its data-result, the note as p.check-note;
// null without checks.
export function checkCells(gate) {
  const { rows, note } = checkRows(gate);
  if (!rows.length) return null;
  return h("div", { class: "check-cells" }, rows.map(cell), note ? h("p", { class: "check-note" }, note) : null);
}
