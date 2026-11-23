import { test } from "node:test";
import assert from "node:assert/strict";
import { T, fill } from "../../js/text.js";
import * as line from "../../js/line.js";

const { renderLine, lamp } = line;

// The lab report has no lighting sequence (2026-11-23): the andon board's «tomoshi» move is retired with its helpers.
test("the lighting sequence is gone: line.js exports no lightUp, firstLighting or lightDelays", () => {
  for (const name of ["lightUp", "firstLighting", "lightDelays", "LIGHT_STEP_MS", "prefersReducedMotion"]) {
    assert.equal(name in line, false, name);
  }
});

// A minimal document for dom.js, enough to walk what renderLine builds.
function withFakeDocument(run) {
  class FakeNode {}
  class FakeText extends FakeNode { constructor(t) { super(); this.nodeType = 3; this.textContent = t; } }
  class FakeElement extends FakeNode {
    constructor(tag) { super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.classList = { add() {} }; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
    addEventListener() {}
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    set className(value) { this.attributes.class = value; }
  }
  const saved = { document: globalThis.document, Node: globalThis.Node };
  globalThis.document = { createElement: (tag) => new FakeElement(tag), createTextNode: (t) => new FakeText(t) };
  globalThis.Node = FakeNode;
  try { return run(); } finally { globalThis.document = saved.document; globalThis.Node = saved.Node; }
}
const lampsOf = (el) => [el, ...(el.children || []).flatMap((c) => (c.nodeType === 1 ? lampsOf(c) : []))]
  .filter((n) => n.attributes && /(^| )lamp( |$)/.test(n.attributes.class || ""));

const TRACE = {
  version: 1, run_id: "2030-02-04-1", date: "2030-02-04", status: "complete", niche: null, cost: null,
  sources: [{ name: "Foro A", kind: "Foro", collected: 0, kept: 0, available: null, truncated: false, note: null, ok: true }],
  funnel: [{ stage: "collected", label: "Juntadas", count: 0, cap: null }, { stage: "read", label: "Leídas", count: 0, cap: null }],
  cuts: [], duels: [], ranking: [],
};

// Every lamp is drawn in its final state on the first paint, its colour named by data-lamp and hidden from a screen
// reader (its state is written beside it): no data-wait, data-step or data-lit, on the side panel and the strip alike.
test("the line's lamps are drawn in their final state: data-lamp, aria-hidden, nothing waiting", () => {
  for (const compact of [false, true]) {
    const lamps = withFakeDocument(() => lampsOf(renderLine(TRACE, { compact })));
    assert.ok(lamps.length >= 3, `compact ${compact}`);
    for (const l of lamps) {
      assert.equal(l.attributes["aria-hidden"], "true");
      assert.ok(["green", "amber", "red", "off"].includes(l.attributes["data-lamp"]));
      assert.ok(!l.hasAttribute("data-wait") && !l.hasAttribute("data-step") && !l.hasAttribute("data-lit"), `compact ${compact}`);
    }
  }
});

test("lamp() keeps the internal names and falls back to off", () => {
  const made = withFakeDocument(() => [lamp("amber"), lamp(null), lamp("red", { size: "small" })]);
  assert.deepEqual(made.map((l) => l.attributes["data-lamp"]), ["amber", "off", "red"]);
  assert.deepEqual(made.map((l) => l.attributes.class), ["lamp", "lamp", "lamp lamp--small"]);
  assert.ok(made.every((l) => l.attributes["aria-hidden"] === "true" && !l.hasAttribute("data-lit")));
});

const classesOf = (el) => [el.attributes && el.attributes.class, ...(el.children || []).flatMap((c) => (c.nodeType === 1 ? classesOf(c) : []))].filter(Boolean);

test("Corridas draws its own cost: renderLine(trace, { costs: false }) leaves the line's cost foot out", () => {
  const withCost = { ...TRACE, cost: { total_usd: 1, by_model: [{ model: "Sonnet", usd: 1 }], cards_usd: null } };
  assert.ok(withFakeDocument(() => classesOf(renderLine(withCost))).includes("line-costs"));
  assert.ok(!withFakeDocument(() => classesOf(renderLine(withCost, { costs: false }))).includes("line-costs"));
});

// «Otros recortes»: the cuts that belong to no station. One with plain words is its own line; the ones the page cannot
// explain (kind `other`, or no text) are said once, in one last line that links to the run's page, where «Lo que se
// recortó» counts them and «Detalle técnico» has their sentences. The run's own page passes `otherCuts: false`.
const textOf = (el) => (el.nodeType === 3 ? el.textContent : (el.children || []).map(textOf).join(""));
const find = (el, test) => (el.nodeType !== 1 ? null : test(el) ? el : (el.children || []).reduce((hit, c) => hit || find(c, test), null));
const otherBox = (cuts, options = {}) => withFakeDocument(() => find(renderLine({ ...TRACE, cuts }, options), (el) => el.attributes.class === "line-other"));
const otherCuts = (cuts, options) => withFakeDocument(() => {
  const box = otherBox(cuts, options);
  if (!box) return null;
  return find(box, (el) => el.tagName === "UL").children.map((li) => {
    const link = find(li, (el) => el.tagName === "A");
    return link ? `${textOf(li)} → ${link.attributes.href}` : textOf(li);
  });
});

test("«Otros recortes» says the unexplained cuts once, in one line that links to the run's page", () => {
  const other = (original) => ({ kind: "other", count: null, cap: null, text: "Hubo un recorte más", original });
  const page = "#/corridas/2030-02-04-1";
  assert.equal(otherCuts([]), null);
  assert.deepEqual(otherCuts([other("RAW-1")]), [`${T.cutOtherLinkOne} → ${page}`]);
  assert.deepEqual(otherCuts([other("RAW-1"), other("RAW-2"), { kind: "other", text: null }]), [`${fill(T.cutsOtherLinkMany, { count: 3 })} → ${page}`]);
  assert.deepEqual(otherCuts([
    { kind: "a-new-kind", count: 2, cap: null, text: "2 cosas quedaron fuera por algo nuevo", original: null },
    other("RAW-1"),
    { kind: "a-newer-kind", count: null, cap: null, text: "   ", original: null },
  ]), ["2 cosas quedaron fuera por algo nuevo", `${fill(T.cutsOtherLinkMany, { count: 2 })} → ${page}`]);
  // A cut at a station stays at its station, never in «Otros recortes».
  assert.equal(otherCuts([{ kind: "extraction-cap", count: 3, cap: 60, text: "3 sin analizar", original: null }]), null);
  // The run's own page says them in «Lo que se recortó»: its line leaves «Otros recortes» out.
  assert.equal(otherCuts([other("RAW-1"), { kind: "a-new-kind", text: "Algo", original: null }], { otherCuts: false }), null);
});

// «Muestra procesada»: the line as a table under its label and heading, its columns «N°», «Etapa», «Cant.», «Tope» and
// «Indicador» (a dot and its words), the sources as indented rows under stage 01, and a stage's cut in words as a note
// row under it. The same table on the side panel, the run's page and the phone's strip.
const SAMPLE = {
  ...TRACE,
  sources: [
    { name: "Foro de tesoreros", kind: "Foro", collected: 72, kept: 64, available: null, truncated: false, note: null, ok: true },
    { name: "Grupos de familias", kind: "Foro", collected: 240, kept: 29, available: 1830, truncated: true, note: null, ok: true },
    { name: "Empleo ficticio", kind: "Empleo", collected: 0, kept: 0, available: null, truncated: false, note: null, ok: true },
  ],
  funnel: [
    { stage: "collected", label: "Juntadas", count: 312, cap: null },
    { stage: "read", label: "Leídas", count: 290, cap: null },
    { stage: "analyzed", label: "Analizadas a fondo", count: 44, cap: 50 },
    { stage: "grouped", label: "Dolores agrupados", count: null, cap: null },
  ],
  cuts: [{ kind: "extraction-cap", count: 253, cap: 50, text: "253 testimonios con señales quedaron sin analizar a fondo", original: null }],
};
const cellsOf = (row) => row.children.filter((c) => c.nodeType === 1).map((c) => textOf(c));

test("the line reads as the processed sample: a table with N°, Etapa, Cant., Tope and Indicador, the sources under 01", () => {
  for (const compact of [false, true]) {
    withFakeDocument(() => {
      const el = renderLine(SAMPLE, { compact, idPrefix: "linea" });
      // The heading speaks for itself: no small label above it (the finish review: no eyebrow).
      assert.equal(find(el, (n) => (n.attributes.class || "").split(" ").includes("section-label")), null, `compact ${compact}`);
      assert.equal(T.lineSampleLabel, undefined);
      const table = find(el, (n) => n.tagName === "TABLE");
      assert.ok(table, `compact ${compact}: a table`);
      assert.equal(table.attributes["aria-labelledby"], "linea-titulo");
      assert.equal(textOf(find(el, (n) => n.attributes.id === "linea-titulo")), T.lineTitle);

      const head = find(table, (n) => n.tagName === "THEAD");
      const headers = find(head, (n) => n.tagName === "TR").children;
      assert.ok(headers.every((th) => th.tagName === "TH" && th.attributes.scope === "col"));
      assert.deepEqual(headers.map((th) => textOf(th)), [
        `${T.lineColNumber}${T.lineColNumberFull}`, T.lineColStage, `${T.lineColCount}${T.lineColCountFull}`, T.lineColCap, T.lineColFlag]);

      const rows = find(table, (n) => n.tagName === "TBODY").children;
      assert.deepEqual(rows.map(cellsOf), [
        ["01", "Juntadas", "312", `—${T.lineNoCap}`, T.stageCut],
        ["", `${T.sourceRowLabel} Foro de tesoreros`, "72 → 64", T.sourceOk],
        ["", `${T.sourceRowLabel} Grupos de familias`, `240 → 29 ${fill(T.sourceOf, { available: "1830" })}`, T.sourceTruncated],
        ["", `${T.sourceRowLabel} Empleo ficticio`, "0", T.sourceEmpty],
        ["02", "Leídas", "290", `—${T.lineNoCap}`, T.stageOk],
        ["03", "Analizadas a fondo", "44", "50", T.stageCut],
        ["253 testimonios con señales quedaron sin analizar a fondo"],
        ["04", "Dolores agrupados", `—${T.lineNoCount}`, `—${T.lineNoCap}`, T.stageNoData],
      ], `compact ${compact}`);
      // The stage's name is its row's header; a source's count spans Cant. and Tope (a source has no cap); the note
      // spans the whole row.
      assert.ok(rows.filter((r) => !(r.attributes.class || "").includes("line-row-note"))
        .every((r) => r.children[1].tagName === "TH" && r.children[1].attributes.scope === "row"));
      assert.equal(rows[1].children[2].attributes.colspan, "2");
      assert.equal(rows[6].children[0].attributes.colspan, "5");
      // Every indicator is a dot and its words.
      for (const r of rows.filter((r) => !(r.attributes.class || "").includes("line-row-note"))) {
        assert.equal(lampsOf(r.children.at(-1)).length, 1);
      }
    });
  }
});

test("a line with no stages draws no table", () => {
  for (const compact of [false, true]) {
    withFakeDocument(() => {
      const el = renderLine({ ...TRACE, funnel: [], sources: [] }, { compact });
      assert.equal(find(el, (n) => n.tagName === "TABLE"), null);
    });
  }
});
