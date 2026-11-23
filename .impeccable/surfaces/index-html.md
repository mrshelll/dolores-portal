---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# index.html — tomoshi, the andon board for deciding

## Scope
The whole page (one `index.html`, hash routes): Esta semana `#/`, Catálogo `#/catalogo`, Corridas `#/corridas`,
el dolor `#/dolor/<id>`, plus sign-in and «sin permiso». Visitor mode: Operate. Build path: code-led.

## Brief
- Audience: the small team on the access list, on phone and computer alike, on Monday.
- Job: decide which pains to work on; the weekly run's trace is context that backs each decision.
- Action: «Nos interesa» / «Descartar» on each pain of «Para decidir»; comment.
- Proof: the run's production line (sources, counts, caps that cut, duel), each pain's verbatim quotes and attacks.
- Constraints: plain Spanish, no jargon or internal ids; every lamp has its state written beside it; AA on both
  themes; from 320 px; no real data in this public repo.

## Direction contract
THESIS: Each pain is a station on the plant's andon board and lights when the week's run pulled the cord for it; the
page refuses the category default of a feed of cards under a hero with a separate analytics tab.

OWN-WORLD: The andon board. Dark: graphite shell #1A1C1E, panels #2A2D31, text #F4F4F2, muted #A9ADB1, flat lamps
amber #F2A900, green #2E9E4F, red #D7261E, off #4A4E53. Light, automatic via `prefers-color-scheme`, «el tablero de
día»: cool steel ground ~#DCDEE0, panels ~#F2F3F4, text #1A1C1E, the same lamp hues each with a dark rim; never
cream. Barlow Semi Condensed, tabular figures, big station numbers; flat discs, no bevel, glow or screws.

STORY: The visitor sees what waits for a mark and why each pain is there, trusts it because the run's line shows where
it came from and what was cut, and marks «Nos interesa» or «Descartar».

FIRST VIEWPORT: The chosen sketch `.impeccable/mocks/decision/model-pick.html`: top bar with the lowercase «tomoshi»
wordmark and the run-state lamp at its left, tabs Esta semana · Catálogo · Corridas, week, niche and cost at right;
«Para decidir» as a grid of numbered stations (01, 02…) with lamp, written state, title, who suffers it, marks and
the primary «Nos interesa» button on each; the run's production line beside it, one station per stage with count
and lamp, sources under the first.

FORM: candidate 1 of 7 (IMPECCABLE'S PICK), seed:faca3a33afad1fff. Signature move «tomoshi»: on load the lamps light
one after another in stage order, 70 ms apart, once; none under reduced motion; a pain with new evidence lights with
that move, the rest are already lit and still.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- How the line folds into a strip on phones, and the exact cut of «Ver más» on quotes.
