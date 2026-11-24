import { test } from "node:test";
import assert from "node:assert/strict";
import { T } from "../../js/text.js";
import { checkStack, checkCells } from "../../js/checks.js";

// A minimal document for dom.js, enough to walk what checkStack and checkCells build; createElementNS for the icons.
function withFakeDocument(run) {
  class FakeNode {}
  class FakeText extends FakeNode { constructor(t) { super(); this.nodeType = 3; this.textContent = t; } }
  class FakeElement extends FakeNode {
    constructor(tag, namespace = null) {
      super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.namespaceURI = namespace; this.children = []; this.attributes = {};
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener() {}
    append(...nodes) { this.children.push(...nodes); }
    set className(value) { this.attributes.class = value; }
  }
  const saved = { document: globalThis.document, Node: globalThis.Node };
  globalThis.document = {
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (namespace, tag) => new FakeElement(tag, namespace),
    createTextNode: (t) => new FakeText(t),
  };
  globalThis.Node = FakeNode;
  try { return run(); } finally { globalThis.document = saved.document; globalThis.Node = saved.Node; }
}
const textOf = (el) => (el.nodeType === 3 ? el.textContent : el.children.map(textOf).join(""));
// What the eye reads: the text outside the visually hidden spans (a screen reader hears those too).
const shownOf = (el) => (el.nodeType === 3 ? el.textContent
  : (el.attributes.class || "").split(" ").includes("visually-hidden") ? "" : el.children.map(shownOf).join(""));
const all = (el, test) => (el.nodeType !== 1 ? [] : [...(test(el) ? [el] : []), ...el.children.flatMap((c) => all(c, test))]);
const byTag = (el, tag) => all(el, (n) => n.tagName === tag);
const hasClass = (name) => (n) => (n.attributes.class || "").split(" ").includes(name);
const byClass = (el, name) => all(el, hasClass(name));
const stack = (gate) => withFakeDocument(() => checkStack(gate));
const cells = (gate) => withFakeDocument(() => checkCells(gate));

const GATE = Object.freeze({
  testimonies: 4, tiers: 1, survivals: 4, verdicts: 5, has_statement: true, per_country: false,
  thresholds: Object.freeze({ testimonies: 3, tiers: 2, survivals: 3, verdicts: 5 }),
});
const gateWith = (extra = {}) => ({ ...GATE, ...extra });
const SVG_NS = "http://www.w3.org/2000/svg";

test("checkStack and checkCells: null when the gate gives no rows", () => {
  for (const gate of [null, undefined, {}, "gate", { ...GATE, thresholds: null }, gateWith({ testimonies: -1 })]) {
    assert.equal(stack(gate), null, JSON.stringify(gate));
    assert.equal(cells(gate), null, JSON.stringify(gate));
  }
});

test("checkStack: one check per count, its result as data and its words as text", () => {
  const el = stack(GATE);
  assert.equal(el.tagName, "UL");
  assert.equal(el.attributes.class, "check-stack");
  const items = byTag(el, "LI");
  assert.equal(items.length, 3);
  assert.ok(items.every(hasClass("check")));
  assert.deepEqual(items.map((li) => li.attributes["data-result"]), ["pass", "fail", "pass"]);
  assert.deepEqual(items.map(shownOf), ["4 testimonios", "1 tipo de fuente · falta 1", "4 de 5 ataques"]);
});

// The ✓ and ✗ differ for the eye; a screen reader hears the result in words after each check, and nothing after one
// with no result (its own words say it has none).
test("checkStack: a passing check says «dentro del rango» and a failing one «fuera del rango», for a screen reader only", () => {
  const items = byTag(stack(gateWith({ survivals: null, verdicts: 3 })), "LI");
  const said = items.map((li) => byClass(li, "visually-hidden").map(textOf));
  assert.deepEqual(said, [[`, ${T.checkSaidPass}`], [`, ${T.checkSaidFail}`], []]);
  assert.equal(T.checkSaidPass, "dentro del rango");
  assert.equal(T.checkSaidFail, "fuera del rango");
  assert.deepEqual(items.map(textOf), [
    "4 testimonios, dentro del rango", "1 tipo de fuente · falta 1, fuera del rango", "Sin resultado completo (3 de 5 respondieron)"]);
});

test("checkStack: each check's circle is an SVG hidden from a screen reader, its mark by the result", () => {
  const items = byTag(stack(gateWith({ survivals: null, verdicts: 3 })), "LI");
  assert.deepEqual(items.map((li) => li.attributes["data-result"]), ["pass", "fail", "none"]);
  assert.equal(shownOf(items[2]), "Sin resultado completo (3 de 5 respondieron)");
  const icons = items.map((li) => byTag(li, "SVG"));
  for (const list of icons) {
    assert.equal(list.length, 1);
    assert.equal(list[0].namespaceURI, SVG_NS);
    assert.equal(list[0].attributes["aria-hidden"], "true");
    assert.equal(byTag(list[0], "CIRCLE").length, 1);
  }
  // A tick, a cross and a dash: three different marks inside the circle.
  const marks = icons.map(([svg]) => byTag(svg, "PATH")[0].attributes.d);
  assert.equal(new Set(marks).size, 3);
});

test("checkStack: a missing statement is a fourth check, failed", () => {
  const items = byTag(stack(gateWith({ has_statement: false })), "LI");
  assert.equal(items.length, 4);
  assert.equal(items[3].attributes["data-result"], "fail");
  assert.equal(shownOf(items[3]), "Falta cómo lo cuenta quien lo sufre");
});

test("checkCells: one cell per count with its label, value, verdict and minimum", () => {
  const el = cells(GATE);
  assert.equal(el.tagName, "DIV");
  assert.equal(el.attributes.class, "check-cells");
  const list = byClass(el, "check-cell");
  assert.equal(list.length, 3);
  assert.ok(list.every((cell) => cell.tagName === "DIV"));
  assert.deepEqual(list.map((cell) => cell.attributes["data-result"]), ["pass", "fail", "pass"]);
  const [testimonies, tiers, attacks] = list.map(textOf);
  for (const words of ["Testimonios", "4", "Dentro del rango", "Mínimo 3"]) assert.ok(testimonies.includes(words), words);
  for (const words of ["Tipos de fuente", "1", "Fuera del rango · falta 1", "Mínimo 2"]) assert.ok(tiers.includes(words), words);
  for (const words of ["Ataques resistidos", "4 de 5", "Dentro del rango", "Mínimo 3 de 5"]) assert.ok(attacks.includes(words), words);
  // No note without per-country counting.
  assert.equal(byClass(el, "check-note").length, 0);
});

test("checkCells: the box row, hidden from a screen reader, is filled to the value and ruled at the threshold", () => {
  const [, tiers] = byClass(cells(GATE), "check-cell");
  const [row] = byClass(tiers, "box-row");
  assert.equal(row.attributes["aria-hidden"], "true");
  assert.match(row.attributes.style, /--min: 2;/);
  assert.match(row.attributes.style, /--at: 1;?/);
  // Tiers: four boxes (twice the threshold), the first one filled, the rule right after the second (before box min + 1).
  assert.deepEqual(row.children.map((n) => n.attributes.class), ["box box--filled", "box", "box-rule", "box", "box"]);
  // Testimonies: «4» against «Mínimo 3», six boxes, four filled, the rule after the third.
  const [testimonies] = byClass(byClass(cells(GATE), "check-cell")[0], "box-row");
  assert.deepEqual(testimonies.children.map((n) => n.attributes.class),
    ["box box--filled", "box box--filled", "box box--filled", "box-rule", "box box--filled", "box", "box"]);
  // The verdict's icon is hidden too: the words carry it.
  for (const cell of byClass(cells(GATE), "check-cell")) {
    for (const svg of byTag(cell, "SVG")) assert.equal(svg.attributes["aria-hidden"], "true");
  }
});

test("checkCells: a threshold as high as the row still draws its rule, at the end", () => {
  // Attacks «1 de 2» against «Mínimo 3»: the row spans 3, the rule closes it.
  const gate = { ...GATE, survivals: 1, verdicts: 2, thresholds: { ...GATE.thresholds, verdicts: 2 } };
  const [, , attacks] = byClass(cells(gate), "check-cell");
  const [row] = byClass(attacks, "box-row");
  assert.deepEqual(row.children.map((n) => n.attributes.class), ["box box--filled", "box", "box", "box-rule"]);
});

// A row never draws more than ten boxes: past ten, the boxes stand for tenths of the row, the filled ones round(at / max
// × 10) and the rule after round(min / max × 10); the figure and the words keep the exact count. The drawing never
// contradicts the verdict: a count in range reaches the rule, one out of range stops before it.
const boxesOf = (row) => row.children.map((n) => n.attributes.class);
const drawn = (gate, index) => {
  const [row] = byClass(byClass(cells(gate), "check-cell")[index], "box-row");
  return boxesOf(row);
};
test("checkCells: a row past ten draws ten boxes, filled and ruled by tenths; the figure keeps the count", () => {
  // Testimonies 25 against «Mínimo 3»: the row spans 25, ten boxes, all filled, the rule after the first (3 / 25 × 10).
  const gate = gateWith({ testimonies: 25 });
  const boxes = drawn(gate, 0);
  assert.ok(boxes.filter((c) => c.startsWith("box ") || c === "box").length <= 10);
  assert.deepEqual(boxes, ["box box--filled", "box-rule", ...Array(9).fill("box box--filled")]);
  const [testimonies] = byClass(cells(gate), "check-cell");
  assert.equal(textOf(byClass(testimonies, "check-figure")[0]), "25");
  // 7 of a row of 14 against «Mínimo 7» (testimonies 7, threshold 7, row 14): half filled, the rule after the fifth.
  assert.deepEqual(drawn(gateWith({ testimonies: 7, thresholds: { ...GATE.thresholds, testimonies: 7 } }), 0),
    [...Array(5).fill("box box--filled"), "box-rule", ...Array(5).fill("box")]);
});

test("checkCells: past ten, a count out of range stops before the rule even when its tenth rounds up to it", () => {
  // 9 against «Mínimo 10» spans 20: 4.5 tenths would round to the rule's 5; it draws 4.
  const boxes = drawn(gateWith({ testimonies: 9, thresholds: { ...GATE.thresholds, testimonies: 10 } }), 0);
  assert.deepEqual(boxes, [...Array(4).fill("box box--filled"), "box", "box-rule", ...Array(5).fill("box")]);
});

test("checkCells: past ten, a threshold under a twentieth of the row puts the rule before the first box", () => {
  // 200 against «Mínimo 3»: 3 / 200 × 10 rounds to 0.
  const boxes = drawn(gateWith({ testimonies: 200 }), 0);
  assert.deepEqual(boxes, ["box-rule", ...Array(10).fill("box box--filled")]);
});

test("checkCells: attacks with no complete result have no boxes and no verdict; the statement has no boxes", () => {
  const list = byClass(cells(gateWith({ survivals: null, verdicts: 3, has_statement: false })), "check-cell");
  assert.equal(list.length, 4);
  const [, , attacks, statement] = list;
  assert.equal(attacks.attributes["data-result"], "none");
  assert.equal(byClass(attacks, "box-row").length, 0);
  assert.ok(!textOf(attacks).includes(T.analysisIn) && !textOf(attacks).includes(T.analysisOut));
  assert.ok(textOf(attacks).includes("Sin resultado completo (3 de 5 respondieron)"));
  assert.ok(textOf(attacks).includes("Mínimo 3 de 5"));
  assert.equal(statement.attributes["data-result"], "fail");
  assert.equal(byClass(statement, "box-row").length, 0);
  assert.ok(textOf(statement).includes(T.analysisStatement) && textOf(statement).includes(T.analysisOut));
});

test("checkCells: the per-country note closes the cells", () => {
  const el = cells(gateWith({ per_country: true }));
  const notes = byClass(el, "check-note");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].tagName, "P");
  assert.equal(textOf(notes[0]), T.analysisPerCountry);
  assert.equal(el.children.at(-1), notes[0]);
});
