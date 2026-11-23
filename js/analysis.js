// The lab report's analysis table: a pain's judged counts (analysisRows, model.js) as a <table> captioned «Análisis»,
// one row per count with its label, its value, its reference range and its flag in words. The range bar beside each
// measured row is the report's signature: a track from 0 to the row's `max`, the in-range part (min..max) shaded and a
// mark at the value. The bar is hidden from a screen reader; the row's words («4», «3 o más», «DENTRO DEL RANGO») carry
// its meaning. The statement row and attacks with no result have no bar, and those attacks no flag. A cell with nothing
// to say stays in the table, empty, so every value is read under its own column header. When the counts
// were taken within one country the note is the table's footnote. The home's results and a pain's detail use it.
// Its two layouts (css/base.css, .analysis) follow the width of the nearest inline-size container: a consumer wraps it
// in one, or it keeps the narrow layout. Its rows are laid out as grids, so every part of the table carries its role
// explicitly: a table whose CSS display is changed can lose its semantics in some browsers.

import { h } from "./dom.js";
import { T } from "./text.js";
import { analysisRows } from "./model.js";
import { lamp } from "./line.js";

const percent = (n, max) => `${Math.round((n / max) * 1000) / 10}%`;
const measured = (row) => [row.min, row.max, row.at].every((n) => Number.isFinite(n)) && row.max > 0;

function rangeBar(row) {
  if (!measured(row)) return null;
  return h("span", { class: "range-bar", "aria-hidden": "true", style: `--from: ${percent(row.min, row.max)}; --at: ${percent(row.at, row.max)}` },
    h("span", { class: "range-bar-in" }), h("span", { class: "range-bar-at" }));
}

function flag(row) {
  if (row.flag !== "in" && row.flag !== "out") return null;
  return h("span", { class: `range-flag range-flag--${row.flag}` }, lamp(row.flag === "in" ? "green" : "red", { size: "small" }), row.flagText);
}

// analysisTable(gate) → the table, or null when the gate gives no rows (missing or malformed): the caller then keeps
// its facts line and never shows a range it cannot back.
export function analysisTable(gate) {
  const { rows, note } = analysisRows(gate);
  if (!rows.length) return null;
  return h("table", { class: "analysis", role: "table" },
    h("caption", { class: "analysis-caption" }, T.analysisCaption),
    h("thead", { role: "rowgroup" }, h("tr", { role: "row" },
      h("td", { class: "analysis-corner", role: "cell" }),
      h("th", { scope: "col", role: "columnheader" }, T.analysisValueLabel),
      h("th", { scope: "col", role: "columnheader" }, T.analysisRangeLabel),
      h("th", { scope: "col", role: "columnheader" }, T.analysisFlagLabel))),
    h("tbody", { role: "rowgroup" }, rows.map((row) => h("tr", { class: "analysis-row", role: "row", "data-flag": row.flag },
      h("th", { scope: "row", role: "rowheader", class: "analysis-label" }, row.label),
      h("td", { class: "analysis-value", role: "cell" }, row.value),
      h("td", { class: "analysis-range", role: "cell" }, rangeBar(row), row.range ? h("span", { class: "analysis-range-text" }, row.range) : null),
      h("td", { class: "analysis-flag", role: "cell" }, flag(row))))),
    note ? h("tfoot", { role: "rowgroup" }, h("tr", { role: "row" }, h("td", { class: "analysis-note", role: "cell", colspan: 4 }, note))) : null);
}
