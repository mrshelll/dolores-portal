// Tiny DOM builder. Text always goes in through text nodes (textContent), never innerHTML, so whatever the base
// returns shows as literal text.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs || {})) {
    if (value === false || value === null || value === undefined) continue;
    if (name.startsWith("on") && typeof value === "function") el.addEventListener(name.slice(2), value);
    else if (name === "class") el.className = value;
    else if (value === true) el.setAttribute(name, "");
    else el.setAttribute(name, String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) el.append(child);
    else {
      const text = document.createTextNode("");
      text.textContent = String(child);
      el.append(text);
    }
  }
}

// An SVG element (an icon and its parts), its attributes as given.
const SVG_NS = "http://www.w3.org/2000/svg";
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  el.append(...children);
  return el;
}

// A stroke icon on a 24-unit grid, hidden from a screen reader (the words beside it carry its meaning): its paths, and
// circles as [cx, cy, r]. Its size and colour come from css/base.css (.icon).
export function icon(className, { paths = [], circles = [] }) {
  return svg("svg", { class: `icon ${className}`, viewBox: "0 0 24 24", width: 16, height: 16, "aria-hidden": "true" },
    ...circles.map(([cx, cy, r]) => svg("circle", { cx, cy, r })),
    ...paths.map((d) => svg("path", { d })));
}

export function replaceChildren(el, ...children) {
  el.replaceChildren();
  append(el, children);
}
