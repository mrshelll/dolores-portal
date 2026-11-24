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
    constructor(tag, namespace = null) {
      super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.namespaceURI = namespace; this.children = []; this.attributes = {};
      this.classList = { add() {} };
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
    addEventListener() {}
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
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
const lampsOf = (el) => [el, ...(el.children || []).flatMap((c) => (c.nodeType === 1 ? lampsOf(c) : []))]
  .filter((n) => n.attributes && /(^| )lamp( |$)/.test(n.attributes.class || ""));

const TRACE = {
  version: 1, run_id: "2030-02-04-1", date: "2030-02-04", status: "complete", niche: null, cost: null,
  sources: [{ name: "Foro A", kind: "Foro", collected: 0, kept: 0, available: null, truncated: false, note: null, ok: true }],
  funnel: [{ stage: "collected", label: "Juntadas", count: 0, cap: null }, { stage: "read", label: "Leídas", count: 0, cap: null }],
  cuts: [], duels: [], ranking: [],
};

const all = (el, test) => (el.nodeType !== 1 ? [] : [...(test(el) ? [el] : []), ...(el.children || []).flatMap((c) => all(c, test))]);
const hasClass = (name) => (n) => (n.attributes.class || "").split(" ").includes(name);

// Every step is drawn in its final state on the first paint, its state named by data-lamp (amber renders as the cut's
// blue), and every icon (the scissors, the ✓ circle, the dash) is hidden from a screen reader: the words beside it carry
// it. No data-wait, data-step or data-lit, on the side panel and the strip alike.
test("the line's steps are drawn in their final state, every icon hidden from a screen reader", () => {
  for (const compact of [false, true]) {
    withFakeDocument(() => {
      const el = renderLine(SAMPLE, { compact });
      const steps = all(el, hasClass("line-step"));
      assert.deepEqual(steps.map((li) => li.attributes["data-lamp"]), ["amber", "green", "amber", "off"], `compact ${compact}`);
      const icons = all(el, (n) => n.tagName === "SVG");
      assert.ok(icons.length >= steps.length, `compact ${compact}`);
      for (const svg of icons) assert.equal(svg.attributes["aria-hidden"], "true", `compact ${compact}`);
      for (const n of all(el, () => true)) {
        assert.ok(!n.hasAttribute("data-wait") && !n.hasAttribute("data-step") && !n.hasAttribute("data-lit"), `compact ${compact}`);
      }
    });
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

// The line as a step list (the sketch's «Línea de la corrida»): under its heading, the run's facts with how many steps
// and, when a step had a cut, «Hubo recorte en n pasos» after the scissors; the column heads «Paso» and «Quedan» for the
// eye; one item per step with its icon, its name, how many remain (the cap muted under it) and, for a cut step, what
// was cut in words under its name; the sources under the first step with their figures and their state in words. The
// same list on the side panel, the run's page and the phone's strip.
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
const shownOf = (el) => (el.nodeType === 3 ? el.textContent
  : (el.attributes.class || "").split(" ").includes("visually-hidden") ? "" : (el.children || []).map(shownOf).join(""));
// What a screen reader hears of a step itself (its sources say their own).
const saidOf = (li) => li.children.filter((c) => c.nodeType === 1 && c.tagName !== "UL")
  .flatMap((c) => all(c, hasClass("visually-hidden"))).map(textOf).join("|");
const one = (el, name) => all(el, hasClass(name))[0] || null;

test("the line reads as a step list: Paso and Quedan, the cut steps with the scissors and their note, the sources under the first", () => {
  for (const compact of [false, true]) {
    withFakeDocument(() => {
      const el = renderLine(SAMPLE, { compact, idPrefix: "linea" });
      // The heading speaks for itself: no small label above it (the finish review: no eyebrow).
      assert.equal(one(el, "section-label"), null, `compact ${compact}`);
      assert.equal(textOf(find(el, (n) => n.attributes.id === "linea-titulo")), T.lineTitle);
      assert.equal(textOf(one(el, "line-facts")), `4 de febrero · ${fill(T.lineSteps, { count: 4 })}`);

      // The column heads are for the eye: each step says how many remain in words.
      const head = one(el, "line-steps-head");
      assert.equal(head.attributes["aria-hidden"], "true");
      assert.deepEqual(head.children.map(textOf), ["", T.lineColStep, T.lineColLeft]);
      const list = find(el, (n) => n.tagName === "OL");
      assert.equal(list.attributes["aria-labelledby"], "linea-titulo");

      const steps = list.children;
      assert.deepEqual(steps.map((li) => textOf(one(li, "line-step-name"))), ["Juntadas", "Leídas", "Analizadas a fondo", "Dolores agrupados"]);
      assert.deepEqual(steps.map((li) => shownOf(one(li, "line-step-count"))), ["312", "290", `44${fill(T.stageCap, { cap: "50" })}`, "—"]);
      // A screen reader hears how many remain, the cap, and the state of a step with no cut or no count.
      assert.deepEqual(steps.map(saidOf), [
        "quedan ",
        `quedan |, ${T.stageOk.toLowerCase()}`,
        "quedan |, ",
        `, ${T.stageNoData.toLowerCase()}`,
      ]);
      // A cut step carries the scissors and what was cut under its name; without a cut of its own, «Con recorte».
      assert.deepEqual(steps.map((li) => (one(li, "line-step-note") ? textOf(one(li, "line-step-note")) : null)),
        [T.stageCut, null, "253 testimonios con señales quedaron sin analizar a fondo", null]);
      assert.deepEqual(steps.map((li) => li.children[0].attributes.class), [
        "icon line-step-icon line-step-icon--cut", "icon line-step-icon line-step-icon--clear",
        "icon line-step-icon line-step-icon--cut", "icon line-step-icon line-step-icon--none"]);

      // The sources, under the first step only, each its name, its figures and its state in words.
      assert.equal(all(el, hasClass("line-sources")).length, 1);
      const sources = one(steps[0], "line-sources").children;
      assert.deepEqual(sources.map((li) => [shownOf(one(li, "line-source-name")), shownOf(one(li, "line-source-figures")), textOf(one(li, "line-source-state"))]), [
        ["Foro de tesoreros", "72 → 64", T.sourceOk],
        ["Grupos de familias", `240 → 29${fill(T.sourceOf, { available: "1830" })}`, T.sourceTruncated],
        ["Empleo ficticio", "0", T.sourceEmpty],
      ]);
      assert.deepEqual(sources.map((li) => li.attributes["data-lamp"]), ["green", "amber", "red"]);

      // How many steps had a cut, after the scissors: in the panel's head, or in the strip's summary.
      const cuts = one(el, "line-cuts");
      assert.equal(shownOf(cuts), fill(T.lineCuts, { count: 2 }));
      assert.equal(cuts.children.find((n) => n.tagName === "SVG").attributes["aria-hidden"], "true");
      if (compact) assert.ok(all(find(el, (n) => n.tagName === "SUMMARY"), hasClass("line-cuts")).length === 1);
    });
  }
});

test("a line with one cut step says it in the singular; with none, the strip says «Sin recortes»", () => {
  withFakeDocument(() => {
    // Without the sources' trouble only «Analizadas a fondo» had a cut; without its cut too, none did.
    const oneCut = { ...SAMPLE, sources: [] };
    assert.equal(shownOf(one(renderLine(oneCut), "line-cuts")), T.lineCutsOne);
    const clean = { ...SAMPLE, sources: [], cuts: [] };
    assert.equal(one(renderLine(clean), "line-cuts"), null);
    assert.equal(shownOf(one(renderLine(clean, { compact: true }), "line-strip-state")), T.lineStripClean);
  });
});

test("a line with no stages draws no step list", () => {
  for (const compact of [false, true]) {
    withFakeDocument(() => {
      const el = renderLine({ ...TRACE, funnel: [], sources: [] }, { compact });
      assert.equal(find(el, (n) => n.tagName === "OL"), null);
    });
  }
});
