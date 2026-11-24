---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# index.html — tomoshi, the lab results report for deciding

## Scope
The whole page (one `index.html`, hash routes): Esta semana `#/`, Catálogo `#/catalogo`, Nichos `#/nichos`, Corridas `#/corridas`,
el dolor `#/dolor/<id>`, plus sign-in and «sin permiso». Visitor mode: Operate. Build path: code-led.

## Brief
- Audience: the small team on the access list, on phone and computer alike, on Monday.
- Job: decide which pains to work on; the weekly run's trace is context that backs each decision.
- Action: «Nos interesa» / «Descartar» on each pain of «Para decidir»; comment.
- Proof: each pain's evidence against the run's real thresholds, its verbatim quotes and attacks; the run's line.
- Constraints: plain Spanish, no jargon or internal ids; every state written in words beside its colour; AA on both
  themes; from 320 px; no real data in this public repo; never yellow or amber (Miguel, 2026-11-23).
- Replaces the andon-board world (2026-11-22), which Miguel rejected on 2026-11-23: «no me gustó el diseño, ese
  amarillo no me gusta».

## Direction contract
THESIS: Each pain arrives as a lab result: its evidence measured against the run's own reference ranges, with what
falls in or out of range said in words; the page refuses the category default of a feed of cards with a separate
analytics tab.

OWN-WORLD: The clinical lab results report. Light: white ground, institutional blue #1F4E8C shell band and headings,
pale blue-grey section heads #E8EEF6, hairline tables #D5DCE6, ink #14213D; state: attention blue, green in range,
red failed. Dark (automatic): deep navy ground, same roles. Public Sans, tabular figures, small tracked uppercase
section labels («RESULTADOS», «ANÁLISIS»), never as an eyebrow above a heading. Flat, hairline rules, 2–4 px radius, no shadows.

STORY: The visitor sees which pains wait for a mark, reads each one's results against the ranges that decide «con
peso» (3 testimonios, 2 tipos de fuente, 3 de 5 ataques resistidos), trusts it because the processed sample shows
every stage and cut, and marks «Nos interesa» or «Descartar».

FIRST VIEWPORT: The chosen sketch `.impeccable/mocks/decision/model-pick.html`: blue shell band with «tomoshi»,
status, tabs and week · niche · cost; «Para decidir» with the summary strip, then «RESULTADOS»: each pain a result
block (number, title, tags, state flag right) with an analysis table (value, reference-range bar, flag in words) and
«Quién lo sufre» plus the actions beside it; at right «Línea de la corrida» as the processed sample's stage table
(cant., tope, indicador).

FORM: candidate 3 of 7 dealt as the roll's assignment was «La transmisión del partido»; Miguel chose IMPECCABLE'S
PICK, candidate 1 of 7 (the lab report), seed:4b4c0fa1c771083c. Signature move: the reference-range bar — a value
marker on a band whose shaded part is the real threshold, flagged «DENTRO DEL RANGO» / «FUERA DEL RANGO» in words.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- The thresholds live in the dolores repo (`record-run.mjs`: TESTIMONY_THRESHOLD 3, TIER_THRESHOLD 2, MIN_SURVIVALS
  3); the page must not drift from them.
- Per-country counting: a pain can show 3+ testimonies in total and still be «en observación»; the range must read
  the same counts the run judged.

## Extension: Nichos `#/nichos` (2026-11-24, approved by Miguel)
- Job: see which niche ran this week and why, and veto any niche (Miguel's or proposed) for the whole team; one click,
  undone with the same button, like the marks. Inherits the lab report world; no DESIGN.md change.
- Composition: the approved sketch `.impeccable/mocks/nichos/sketch.html` (shots in `.impeccable/mocks/nichos/shots/`).
  «ESTA SEMANA»: the chosen niche as a result block: why it was chosen in words, «Sondeo del <fecha>» analysis table
  (quejas reales, gasto real, ruido) whose range column is «Frente a los otros N»: the value's marker on a band with a
  tick per rival niche, flagged «CON SEÑAL» / «SIN SEÑAL»; beside it «Sus dolores» and «Vetar este nicho». Then
  «CANDIDATOS»: one table, every niche with its state in words (Corrió esta semana / Compite / Descansa / Vetado /
  Retirado), origin (Tuyo / Propuesto por tomoshi), the proposal's why, quejas, gasto, ruido, its pains, and Vetar /
  Quitar veto with who vetoed it. From 900 px down each row is a stacked block with the button full width.
- The masthead's niche becomes a link to `#/nichos`.
