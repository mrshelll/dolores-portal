import { test } from "node:test";
import assert from "node:assert/strict";
import { T } from "../../js/text.js";
import { analysisTable } from "../../js/analysis.js";

// A minimal document for dom.js, enough to walk what analysisTable builds.
function withFakeDocument(run) {
  class FakeNode {}
  class FakeText extends FakeNode { constructor(t) { super(); this.nodeType = 3; this.textContent = t; } }
  class FakeElement extends FakeNode {
    constructor(tag) { super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener() {}
    append(...nodes) { this.children.push(...nodes); }
    set className(value) { this.attributes.class = value; }
  }
  const saved = { document: globalThis.document, Node: globalThis.Node };
  globalThis.document = { createElement: (tag) => new FakeElement(tag), createTextNode: (t) => new FakeText(t) };
  globalThis.Node = FakeNode;
  try { return run(); } finally { globalThis.document = saved.document; globalThis.Node = saved.Node; }
}
const textOf = (el) => (el.nodeType === 3 ? el.textContent : el.children.map(textOf).join(""));
const all = (el, test) => (el.nodeType !== 1 ? [] : [...(test(el) ? [el] : []), ...el.children.flatMap((c) => all(c, test))]);
const byTag = (el, tag) => all(el, (n) => n.tagName === tag);
const hasClass = (name) => (n) => (n.attributes.class || "").split(" ").includes(name);
const table = (gate) => withFakeDocument(() => analysisTable(gate));

const GATE = Object.freeze({
  testimonies: 4, tiers: 2, survivals: 4, verdicts: 5, has_statement: true, per_country: false,
  thresholds: Object.freeze({ testimonies: 3, tiers: 2, survivals: 3, verdicts: 5 }),
});
const gateWith = (extra = {}) => ({ ...GATE, ...extra });
const bodyRows = (el) => byTag(byTag(el, "TBODY")[0], "TR");

test("analysisTable: null when the gate gives no rows", () => {
  for (const gate of [null, undefined, {}, "gate", { ...GATE, thresholds: null }, gateWith({ testimonies: -1 })]) {
    assert.equal(table(gate), null, JSON.stringify(gate));
  }
});

test("analysisTable: a table captioned «Análisis», one body row per analysis row, each row headed by its label", () => {
  const el = table(GATE);
  assert.equal(el.tagName, "TABLE");
  assert.equal(textOf(byTag(el, "CAPTION")[0]), T.analysisCaption);
  const heads = byTag(byTag(el, "THEAD")[0], "TH");
  assert.deepEqual(heads.map(textOf), [T.analysisValueLabel, T.analysisRangeLabel, T.analysisFlagLabel]);
  assert.ok(heads.every((th) => th.attributes.scope === "col"));
  const rows = bodyRows(el);
  assert.equal(rows.length, 3);
  const headers = rows.map((tr) => byTag(tr, "TH")[0]);
  assert.deepEqual(headers.map(textOf), ["Testimonios", "Tipos de fuente", "Ataques resistidos"]);
  assert.ok(headers.every((th) => th.attributes.scope === "row"));
  // Each row says its value, its range and its flag in words.
  assert.deepEqual(rows.map((tr) => byTag(tr, "TD").map(textOf)), [
    ["4", "3 o más", "DENTRO DEL RANGO"],
    ["2", "2 o más", "DENTRO DEL RANGO"],
    ["4 de 5", "3 o más", "DENTRO DEL RANGO"],
  ]);
  // No note without per-country counting.
  assert.equal(byTag(el, "TFOOT").length, 0);
});

test("analysisTable: the flags in words, in and out of range", () => {
  const rows = bodyRows(table(gateWith({ tiers: 1 })));
  assert.deepEqual(rows.map((tr) => tr.attributes["data-flag"]), ["in", "out", "in"]);
  assert.equal(textOf(rows[1]).includes(T.analysisOut), true);
  assert.equal(textOf(rows[0]).includes(T.analysisIn), true);
  // The flag's dot is hidden from a screen reader: the words carry the state.
  for (const tr of rows) for (const dot of all(tr, hasClass("lamp"))) assert.equal(dot.attributes["aria-hidden"], "true");
});

test("analysisTable: every range bar is hidden from a screen reader and placed by the row's numbers", () => {
  const el = table(gateWith({ testimonies: 4, tiers: 1 }));
  const bars = all(el, hasClass("range-bar"));
  assert.equal(bars.length, 3);
  for (const bar of bars) assert.equal(bar.attributes["aria-hidden"], "true");
  // Testimonies: the bar spans 0..6, the range starts at 3 (50%), the mark at 4 (66.7%).
  assert.equal(bars[0].attributes.style, "--from: 50%; --at: 66.7%");
  // Tiers: 0..4, the range from 2 (50%), the mark at 1 (25%).
  assert.equal(bars[1].attributes.style, "--from: 50%; --at: 25%");
  // Attacks: 0..5, the attacks that answered; the range from 3 (60%), «4 de 5» at 80%.
  assert.equal(bars[2].attributes.style, "--from: 60%; --at: 80%");
});

test("analysisTable: the statement row and incomplete attacks have no bar; incomplete attacks have no flag", () => {
  const rows = bodyRows(table(gateWith({ has_statement: false, survivals: null, verdicts: 3 })));
  assert.equal(rows.length, 4);
  const [, , attacks, statement] = rows;
  assert.equal(all(attacks, hasClass("range-bar")).length, 0);
  assert.equal(all(statement, hasClass("range-bar")).length, 0);
  assert.equal(attacks.attributes["data-flag"], "none");
  assert.ok(!textOf(attacks).includes(T.analysisIn) && !textOf(attacks).includes(T.analysisOut));
  assert.ok(textOf(attacks).includes("Sin resultado completo (3 de 5 respondieron)"));
  assert.ok(textOf(statement).includes(T.analysisMissing) && textOf(statement).includes(T.analysisOut));
});

test("analysisTable: the per-country note is the table's footnote", () => {
  const el = table(gateWith({ per_country: true }));
  const foot = byTag(el, "TFOOT");
  assert.equal(foot.length, 1);
  assert.equal(textOf(foot[0]), T.analysisPerCountry);
  assert.equal(byTag(foot[0], "TD")[0].attributes.colspan, "4");
});
