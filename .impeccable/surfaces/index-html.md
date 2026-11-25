---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# index.html — tomoshi, la revisión por dolor

## Scope
The whole page (one `index.html`, hash routes): Esta semana `#/`, Catálogo `#/catalogo`, Nichos `#/nichos`, Corridas `#/corridas`,
el dolor `#/dolor/<id>`, plus sign-in and «sin permiso». Visitor mode: Operate. Build path: code-led.
The Monday email template stays as it is.

## Brief
- Audience: the small team on the access list, on phone and computer alike, on Monday.
- Job: decide which pains to work on; the weekly run's trace is context that backs each decision.
- Action: «Nos interesa» / «Descartar» on each pain of «Para decidir»; comment. Veto a niche on `#/nichos`.
- Proof: each pain's evidence against the run's real thresholds (`doc.gate.thresholds`, never hand-written), its verbatim
  quotes and attacks; the run's step list beside the pains.
- Constraints: plain Spanish, no jargon or internal ids («checks», «deploy», «build» never appear); every state written in
  words beside its colour; AA on both themes, automatic light/dark; from 320 px; no real data in this public repo;
  never yellow, amber or orange (Miguel, 2026-11-23).
- Replaces the lab-report world (2026-11-23). Miguel, 2026-11-24: nothing specific wrong, «miremos otras opciones»; he
  took the category standard over the herbarium, the cupping form, the dense Japanese web and the title wall, then chose
  the «Revisión por dolor» structure over the document, the board by state, «Lo que cambió» and his first pick.
- Must survive (Miguel, 2026-11-24): measuring each pain against the thresholds; light and dark; the run line on the home.

## Direction contract
THESIS: Each pain is a row that passes or fails three checks against the run's own thresholds, read like a list of
deployments; the page refuses a feed of cards with a separate analytics tab and gives the category standard at the craft
of Stripe Dashboard, Vercel and Notion.

OWN-WORLD: Category standard. Light: white #FFFFFF ground, #FAFAFA panels, ink #0A0A0A, grey hairlines, accent blue
#2563EB (primary button, selection, cut stages, attention), green #16A34A in range, red #DC2626 out of range with a pale
red cell tint. Dark (automatic): near-black ground, same roles. Geist 400/500/600 with tabular figures. No sidebar:
brand row, then underlined tabs across the width. Flat, 1px borders, small radii, no heavy shadows.

STORY: The visitor sees how many pains wait, scans each row's three checks (✓ or ✗ with words), opens one to see the
boxes against each threshold, the duel's line and the way to its quotes and attacks, and marks «Nos interesa» or
«Descartar»; trusts it because the run's step list at the right shows every stage, what remained, each cut in words
and the cost by model.

FIRST VIEWPORT: The chosen sketch `.impeccable/reference/revision-por-dolor.html` (shot `.impeccable/reference/1440x900.png`):
brand row (tomoshi / Semana del … / status pill; Nicho, Costó, Salir), underlined tabs with the waiting count; «Para
decidir» heading with its sentence; left, the list of rows (chevron, title and tags, who suffers, three stacked checks,
state and marks; the sketch's «⋯» menu is not built: it would hold no item, the chevron and the open region carry every action), the first row open with three box cells, the actions and «Ver los testimonios y los ataques»;
right, «Línea de la corrida» as a step list (Paso, Quedan, Tardó only when the trace has it), sources under the first
step, cost by model at the foot; under the list, the catalog line.

FORM: Direction round: Miguel took the standing exit (the category standard; seed:2166316c1b4c616e). Structure round:
candidate 3 of 7 «Revisión por dolor», dealt, seed:6ff3d3486ced206c. Signature move: three stacked checks per row,
each a ✓/✗ circle with its words; the open row shows the boxes filled to a black threshold rule; blue scissors mark cut
stages. Other views inherit: Catálogo and Corridas as row lists with the same checks, the pain page as the open row
at full width, Nichos as rows with their three figures.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Per-step durations: shown only if the run trace carries them; never invented.
- Per-country counting: a pain can show 3+ testimonies in total and still be «en observación»; checks read the same
  counts the run judged.
