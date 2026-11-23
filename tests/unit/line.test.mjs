import { test } from "node:test";
import assert from "node:assert/strict";
import { T, fill } from "../../js/text.js";
import { LIGHT_STEP_MS, lightDelays, renderLine, firstLighting } from "../../js/line.js";

// The «tomoshi» move: the lamps light one after another, 70 ms apart, in stage order; none under reduced motion.
test("lightDelays: 70 ms apart in order, all at once under reduced motion", () => {
  assert.equal(LIGHT_STEP_MS, 70);
  assert.deepEqual(lightDelays(4, false), [0, 70, 140, 210]);
  assert.deepEqual(lightDelays(3, true), [0, 0, 0]);
  assert.deepEqual(lightDelays(0, false), []);
  assert.deepEqual(lightDelays(-2, false), []);
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

test("this week's line waits for the move: its lamps carry data-wait and a step, none lit yet", () => {
  const lamps = withFakeDocument(() => lampsOf(renderLine(TRACE)));
  assert.equal(lamps.length, 3); // two stages and one source
  assert.ok(lamps.every((l) => l.hasAttribute("data-wait") && !l.hasAttribute("data-lit")));
  assert.deepEqual(lamps.map((l) => l.attributes["data-step"]), ["0", "0", "1"]);
});

test("an older run's line (light: false) is drawn already lit, with no sequence", () => {
  for (const compact of [false, true]) {
    const lamps = withFakeDocument(() => lampsOf(renderLine(TRACE, { light: false, compact })));
    assert.ok(lamps.length >= 3);
    assert.ok(lamps.every((l) => l.hasAttribute("data-lit") && !l.hasAttribute("data-wait") && !l.hasAttribute("data-step")), `compact ${compact}`);
  }
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

// The «tomoshi» move lights a run's lamps once per session (finish review 8): the first render of that run lights them,
// every later one draws them lit. Storage that throws counts as the first time and records nothing.
test("firstLighting: true the first time for a run id in the session, false after; per run id", () => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  assert.equal(firstLighting("2030-02-04-1", storage), true);
  assert.equal(firstLighting("2030-02-04-1", storage), false);
  assert.equal(firstLighting("2030-02-11-1", storage), true);
  assert.equal(firstLighting(null, storage), false);
  assert.equal(firstLighting("", storage), false);
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(firstLighting("2030-02-04-1", broken), true);
  assert.equal(firstLighting("2030-02-04-1", undefined), true);
});

// With site data blocked, reading `window.sessionStorage` itself throws (SecurityError). The default storage is read
// inside the guard, so the screen still draws: the move lights, nothing is recorded.
test("firstLighting: a sessionStorage whose getter throws still lights, and never throws", () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true, get() { const e = new Error("The operation is insecure."); e.name = "SecurityError"; throw e; },
  });
  try {
    assert.doesNotThrow(() => firstLighting("2030-02-04-1"));
    assert.equal(firstLighting("2030-02-04-1"), true);
    assert.equal(firstLighting("2030-02-04-1", null), true);
  } finally {
    if (saved) Object.defineProperty(globalThis, "sessionStorage", saved);
    else delete globalThis.sessionStorage;
  }
});
