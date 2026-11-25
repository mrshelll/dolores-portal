---
name: tomoshi
description: The category standard for a weekly decision, each pain a row that passes or fails three checks against the run's own thresholds, read like a list of deployments.
colors:
  ground: "#FFFFFF"
  panel: "#FAFAFA"
  ink: "#0A0A0A"
  muted: "#525252"
  hairline: "#E5E5E5"
  edge: "#8A8A8A"
  accent: "#2563EB"
  accent-fill: "#2563EB"
  accent-fill-hover: "#1D4ED8"
  on-accent: "#FFFFFF"
  accent-tint: "#F0F4FE"
  pass: "#16A34A"
  pass-text: "#15803D"
  pass-tint: "#EFF9F2"
  fail: "#DC2626"
  fail-text: "#B91C1C"
  fail-tint: "#FEF2F2"
  dark-ground: "#0A0A0A"
  dark-panel: "#111111"
  dark-ink: "#EDEDED"
  dark-muted: "#A1A1A1"
  dark-hairline: "#262626"
  dark-edge: "#737373"
  dark-accent: "#3B82F6"
  dark-accent-tint: "#0D121B"
  dark-pass: "#22C55E"
  dark-pass-tint: "#0C1710"
  dark-fail: "#F87171"
  dark-fail-tint: "#2A1215"
typography:
  display:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  display-compact:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  wordmark:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.035em"
  wordmark-compact:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.035em"
  figure:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "34px"
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "26px"
    letterSpacing: "-0.015em"
  subhead:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    fontFeature: "tnum"
  prose:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
  field:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "22px"
  code:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "30px"
    letterSpacing: "0.3em"
    fontFeature: "tnum"
  label:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "20px"
    fontFeature: "tnum"
  caption:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
rounded:
  rule: "1px"
  box: "2px"
  control: "6px"
  panel: "8px"
  count: "10px"
  tag: "11px"
  pill: "12px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
  target: "44px"
components:
  button-primary:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-fill-hover}"
    textColor: "{colors.on-accent}"
  button-secondary:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.panel}"
  button-quiet:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "36px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  tab:
    textColor: "{colors.muted}"
    typography: "{typography.body}"
    padding: "0 10px"
    height: "46px"
  tab-current:
    textColor: "{colors.ink}"
  tab-count:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.count}"
    height: "20px"
  state-pill:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
    height: "24px"
  state-pill-pass:
    backgroundColor: "{colors.pass-tint}"
    textColor: "{colors.pass-text}"
  state-pill-attention:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent}"
  state-pill-fail:
    backgroundColor: "{colors.fail-tint}"
    textColor: "{colors.fail-text}"
  tag:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.tag}"
    padding: "0 8px"
    height: "22px"
  tag-fresh:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent}"
  row-list:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.panel}"
    padding: "16px"
  row-open:
    backgroundColor: "{colors.panel}"
    padding: "16px 20px 18px 48px"
  check-cell:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    padding: "12px 18px 14px"
  check-cell-fail:
    backgroundColor: "{colors.fail-tint}"
    textColor: "{colors.fail-text}"
---

# Design System: tomoshi

## Overview

**Creative North Star: "Revisión por dolor"**

The page is the category standard of a developer dashboard, held to the craft of Stripe Dashboard, Vercel and Notion, and bent to one job: three people leave each week with a decision. Every pain is a row read like a deployment in a deployments list. It passes or fails three checks against the run's own thresholds, each check a filled ✓ or ✗ circle with its result in words. Opening a row shows the same three checks as box cells, small boxes filled up to a black threshold rule, then the duel's line and the actions. Beside the rows, the run's line lists every step, what remained, and each cut, marked with blue scissors and said in words. Everything else (Catálogo, Corridas, Nichos, a pain's page, a run's page) inherits these rows, cells and lists.

The world is quiet on purpose. A white ground, a #FAFAFA shell, near-black ink, grey hairlines and one blue accent. Green means in range, red means out of range with a pale red cell tint, and blue means attention, a cut, a link or the primary action. Depth is flat: 1 px borders, 6 px controls, 8 px panels, no shadow. Density is a working dashboard's, 14 px body on a 4 px spacing step, with tabular figures everywhere so counts line up. Light and dark follow the system setting with no toggle, and both keep the same roles.

It rejects the worlds it replaced: the clinical lab results report (institutional blue band, range bars) and the Toyota andon board. It also rejects a feed of cards with a separate analytics tab. The evidence sits in the row, never on another screen.

**Key Characteristics:**
- Rows, not cards: bordered lists on the ground with a hairline between rows; the open part of a row sits on the panel grey.
- Three checks per pain, each a ✓/✗ circle with its words; never a score.
- Box cells filled to a 2 px black threshold rule, the failed cell on the fail tint.
- Blue scissors mark a cut step; the cut is always said in words too.
- One blue accent; green and red only for in range and out of range; no yellow, amber or orange anywhere.
- Geist 400/500/600 with tabular figures; light and dark by `prefers-color-scheme`.
- Flat: hairline borders, small radii, an outline focus ring, no shadows.

## Colors

A neutral grey scale carries the page; one blue and a strict green/red pair carry every signal.

### Primary
- **Signal Blue** (accent, accent-fill): links, the primary button, the waiting count in the tab, the focus ring, text selection, cut steps and their scissors, a «Evidencia nueva» tag, a pain that asks for attention. In dark mode the text accent lifts to Dark Signal Blue while the filled button stays Signal Blue, because white on the lighter blue drops to 3.68:1.
- **Pressed Blue** (accent-fill-hover): the primary button under the pointer or pressed.
- **Blue Wash** (accent-tint): the 7 % blue tint behind attention pills and fresh-evidence tags.

### Secondary
- **In-Range Green** (pass): the ✓ circle, a passing check's filled boxes, a green state dot. A mark, not text.
- **In-Range Green Text** (pass-text): the words of a passing state or source ("Completa", "Dentro del rango").
- **Green Wash** (pass-tint): the pill behind a run that finished or a pain with weight to work.

### Tertiary
- **Out-of-Range Red** (fail): the ✗ circle, a failing check's filled boxes, the large figure in a failed cell, an invalid field's edge, a red state dot.
- **Out-of-Range Red Text** (fail-text): the words of a failed check, source or error.
- **Pale Red Cell** (fail-tint): the background of a failed box cell and a failed pill.

### Neutral
- **Ground** (ground): the page, the masthead, every bordered list's rows, the auth page.
- **Panel Grey** (panel): the shell under the masthead, a row's open part, column-head rows, the cost foot of the run's line.
- **Ink** (ink): all primary text, the current tab and its 2 px underline, the box cells' threshold rule.
- **Muted Ink** (muted): secondary lines (who suffers it, key data, column heads, captions, team marks).
- **Hairline** (hairline): rules and panel borders; they divide and carry nothing. Also the empty boxes.
- **Control Edge** (edge): the secondary button's and the fields' border, link underlines, and the grey dot of any waiting state.
- **Dark roles** (dark-*): the same roles on a near-black ground, switched by `prefers-color-scheme: dark`. Washes are mixed at 7 % into the ground in both themes.

### Named Rules
**The Never Yellow Rule.** No yellow, amber or orange anywhere on the page, in either theme. Attention is blue. The model's internal lamp name `amber` renders as Signal Blue, and a state merely waiting renders as the grey edge dot.

**The Words Beside the Colour Rule.** Every state is written in words beside its colour: a dot is followed by its state, a ✓/✗ by its result, a filled box row by its figure, a cut's scissors by "Con recorte". Colour never carries meaning alone.

**The One Blue Rule.** Blue is reserved for attention, cuts, links, selection, the focus ring and the primary action. A waiting pain does not get blue; it gets the grey edge dot, and its section heading says what it is waiting for.

**The AA Both Ways Rule.** Text meets 4.5:1 and marks and control edges meet 3:1 in light and in dark. The contrast ratios are annotated beside each token in the stylesheet; a new colour arrives with its ratios measured on the ground, the panel and any tint it sits on.

## Typography

**Display Font:** Geist (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Geist, same stack
**Label/Mono Font:** none distinct; Geist with tabular figures serves every number.

**Character:** One grotesque in three weights, tight negative tracking on the large sizes and none on body. It reads as a precise tool, not an editorial page.

### Hierarchy
- **Display** (600, 28px / 36px, -0.03em; Display Compact, 24px / 28px, below 640px): the page h1, "Para decidir" and a pain's or run's title.
- **Wordmark** (600, 22px / 28px, -0.035em; Wordmark Compact, 20px, below 380px): «tomoshi» in the brand row and on the sign-in panel. The run's line heading uses the same size.
- **Figure** (600, 28px / 34px, -0.03em, tabular): the count in a box cell, in ink or in the fail red when it fails.
- **Headline** (600, 18px / 26px, -0.015em): section headings on a pain's and a run's page, the «Detalle técnico» fold.
- **Subhead** (600, 16px / 24px, -0.01em): Nichos' section headings; the folded line strip's heading takes the same size when the run left no line.
- **Title** (600, 15px / 22px, -0.01em): a row's title in every list.
- **Body** (400, 14px / 20px, tabular): the default for everything not otherwise set.
- **Prose** (400, 15px / 24px, max 70ch): a pain's card text, quotes, glossary.
- **Field** (400, 16px / 22px): the text typed in a field, at 16px so iOS never zooms.
- **Code** (600, 24px / 30px, 0.3em, tabular): the sign-in code's eight digits.
- **Label** (500, 13px / 20px): the check stack's lines, state words, key data, row secondary lines. 13px is the system's most used size.
- **Caption** (500, 12px / 16px): pills, tags, column heads, cost labels, a step's cap.

### Named Rules
**The Tabular Everywhere Rule.** `font-variant-numeric: tabular-nums` is set on the body; counts in rows, cells and the run's line align without per-element overrides.

**The Lowercase Wordmark Rule.** tomoshi is a lowercase text wordmark set in Geist 600, never a logo image, never capitalised.

## Layout

Mobile first, on a 4 px spacing step (4, 8, 12, 16, 24, 32). The side margin grows from 16px to 24px at 640px and 28px at 1024px. There is no sidebar: a brand row, then the tabs across the full width on a hairline. Below 768px the brand row keeps only the wordmark, the run pill and «Salir»; the week and its data move into the home's folded line strip. From 768px the brand row carries the week (after a leaning 1 px slash), the run pill and «Salir»; up to 1023px the niche and the cost take their own row under the tabs, divided by a hairline, and the masthead closes on a hairline under them. From 1024px they join the brand row at the right, before «Salir».

On the home from 1024px the shell becomes two columns: the rows, and the run's line as a 344 px side panel. Below 1024px the line is a folded strip under the heading. A pain's and a run's page keep one 48rem measure at the left; from 1024px a pain's index is a sticky 13rem column beside it, and below it a fold above the sections. Prose keeps 70ch, notices and sentences 38rem, forms 440px.

Rows lay out by their own container width, not the viewport: stacked on a phone; from 34rem the checks take a 12rem column at the right; from 46rem the four columns (chevron, title and who suffers it, the checks, the state and marks). Box cells keep 11-12rem each and stack one per line on a phone. On a narrow open row the actions come before the cells so the decision is on the first screen.

Every interactive element has a 44px target. Buttons draw a 36px box inside that target. Tabs scroll inside their own row; the page never scrolls sideways at 320px.

## Elevation & Depth

Flat. There are no shadows anywhere. Depth is tonal and drawn with lines: the ground for lists and controls, the panel grey for the shell, a row's open part and column-head rows, 1 px hairlines between rows and around panels. Hover is a 2 % to 5 % ink wash over the surface. Focus is a 2px Signal Blue outline offset 2px (inset on full-row links).

### Named Rules
**The Hairline Not Shadow Rule.** A surface is separated by a 1 px hairline or a change between ground and panel grey, never by a shadow or a raised card.

## Shapes

Small, consistent radii: 1px on the ends of the 2px rules (the current tab's underline, the threshold rule, the niche's mark on the versus band), 2px on the boxes and the versus band, 6px on controls (buttons, fields, the chevron's hover box), 8px on panels and bordered lists, fully rounded pills (12px) for states and tags (11px), circles for state dots (7-8px) and the 20px tab count. Borders are always 1px; the only 2px lines are the current tab's underline, the threshold rule in box cells, and an invalid field's doubled red edge. Chevrons are drawn as two borders of a rotated square, not glyphs. Icons are inline SVG strokes at 16px, stroke 1.6, round caps; the ✓/✗ check is an SVG filled circle with the mark cut in the ground colour.

## Components

### Buttons
Restrained and exact; one blue button per decision.
- **Shape:** gently rounded (6px), a 36px box inside a 44px target.
- **Primary:** Signal Blue fill with white text, 500 weight, 8px 12px padding; «Nos interesa», «Entrar».
- **Hover / Focus:** fill shifts to Pressed Blue in 90ms; focus is the 2px blue outline around the drawn box.
- **Secondary:** ground with a Control Edge border, ink text; hover turns the box panel grey. «Descartar».
- **Quiet:** no box until hovered, then a 5 % ink wash; «Comentar», with its stroke icon.
- **Link button:** Signal Blue text underlined at 45 % blue; for secondary actions that read as links.
- **Busy:** `aria-disabled` at 72 % opacity with a progress cursor.

### Chips (tags and state pills)
- **Tag:** 22px pill on a hairline, ground fill, ink caption. «Ganó el duelo».
- **Fresh tag:** Blue Wash fill, blue text, a 35 % blue edge. «Evidencia nueva».
- **State pill:** 24px pill with a 7px dot and two or three words, tinted by state: green wash for complete, blue wash for attention or running, pale red for failed, neutral otherwise. Used for the run in the brand row, a pain's state on its page and each run in Corridas.

### Cards / Containers (bordered lists)
- **Corner Style:** 8px.
- **Background:** ground for rows; panel grey for column heads and open parts.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px hairline around the list and between rows.
- **Internal Padding:** 16px.

### Inputs / Fields
- **Style:** ground fill, 1px Control Edge, 6px radius, 44px tall, 16px text so iOS never zooms.
- **Focus:** the 2px blue outline offset 1px.
- **Error:** a doubled red edge (border plus a 1px inset outline) and the error in words in red text after a red dot. The sign-in code field sets its 8 digits at 24px 600 with 0.3em tracking.

### Navigation
- **Brand row:** lowercase «tomoshi» wordmark, the week, the run pill, the niche (a link) and the cost, «Salir» as a secondary button.
- **Tabs:** muted 14px words; the current one in ink 500 with a 2px ink underline over the row's hairline. «Esta semana» carries the waiting count in a 20px blue circle. Below 380px the tabs step down to 13px and tighter padding so all four fit at 320px.

### Pain row (signature)
The chevron, the title with its tags, who suffers it in muted text, the three stacked checks, the state (dot and words in ink) and the team's marks. Each check line is a 16px filled circle (green ✓ or red ✗, muted when unmeasured) and its words: ink when it passes, fail text plus "falta N" when it fails. A pain with no gate shows a muted dash and «Sin medir contra los umbrales». The whole row is the target; hover is a 2 % ink wash.

### Box cells (signature)
In an open row and on a pain's page: one bordered panel cut into a cell per check. Each cell has its label, a 28px figure, a row of 14 × 8px boxes (filled green to the count when it passes, red when it fails, hairline when empty) broken by a 2 × 18px ink threshold rule, then the result in words after a ✓ or ✗ and the minimum. A failed cell sits on the Pale Red Cell with its words in fail text and its figure in fail red. A note across the cells' foot says how the count was taken. Nichos reuses the cells for a niche's three figures, with a versus band (grey ticks per rival, an ink rule for the niche) where the boxes go.

### Run's line (signature)
A bordered panel: the title, the run's facts, and "Hubo recorte en N pasos" after the blue scissors; column heads «Paso» and «Quedan» on the panel grey; one hairline row per step with its icon (blue scissors for a cut, a muted ✓ circle for a clear step, a muted dash circle with no count), the name, the count in 600 and the cap muted under it, a cut's note in blue under the name, the sources indented under the first step with their state in words and colour; then other cuts, and the cost by model on the panel grey at the foot.

### Notices
A bordered 8px panel on the ground with the dot of its tone beside its words; a warning takes a 45 % blue edge, an error a red edge.

## Do's and Don'ts

### Do:
- **Do** write every state in words beside its colour: a dot with its state, a ✓/✗ with its result, a box row with its figure, scissors with "Con recorte".
- **Do** use Signal Blue (#2563EB) for attention, cuts, links, selection, focus and the single primary action, and nothing else.
- **Do** keep text at 4.5:1 and marks and control edges at 3:1 on the ground, the panel and every tint, in both light and dark.
- **Do** build new views from the bordered row list, the three-check stack and the box cells; Catálogo, Corridas, Nichos and the detail pages already do.
- **Do** keep every target at 44px and every screen usable at 320px wide, with tabs and tables reflowing inside their container, never the page.
- **Do** write in plain Spanish: «Nos interesa», «Descartar», «Con recorte», «Fuera del rango · falta 1».
- **Do** set «tomoshi» as a lowercase Geist 600 text wordmark.

### Don't:
- **Don't** use yellow, amber or orange anywhere, in either theme, for any state; attention is blue.
- **Don't** convey a state by colour alone.
- **Don't** add shadows, raised cards, gradients or a sidebar; separate with hairlines and the panel grey.
- **Don't** show internal ids, slugs or pipeline jargon (tier, lens, underserved, scores, pain ids) on the page.
- **Don't** reduce a pain to a single score; it is three checks against the run's own thresholds.
- **Don't** invent a value the run did not leave (a step's duration, a missing count); show a muted dash or leave it out.
- **Don't** add a theme toggle; light and dark follow the system.
- **Don't** use a logo image, another brand's mark or capitals for tomoshi.
