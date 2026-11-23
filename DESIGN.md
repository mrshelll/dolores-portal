---
name: tomoshi
description: The clinical lab results report where a small team decides which pains to work on, each pain measured against the weekly run's own reference ranges.
colors:
  report-white: "#FFFFFF"
  section-tint: "#E8EEF6"
  report-ink: "#14213D"
  muted-ink: "#4A5568"
  hairline: "#D5DCE6"
  control-edge: "#6B778A"
  institutional-blue: "#1F4E8C"
  signal-blue: "#2B6CC4"
  attention-blue: "#2B6CC4"
  attention-blue-text: "#2862B3"
  in-range-green: "#2E9E4F"
  in-range-green-text: "#1D7A3A"
  failed-red: "#C62828"
  off-grey: "#7A8597"
  navy-ground: "#0D1729"
  navy-panel: "#111E33"
  navy-section: "#18294A"
  navy-ink: "#E6ECF5"
  navy-muted: "#A9B6CA"
  navy-hairline: "#2A3B5A"
  navy-edge: "#7486A3"
  navy-brand: "#8DB6EE"
  navy-band: "#173763"
  navy-attention: "#5B9BEA"
  navy-ok: "#3FB565"
  navy-fail: "#F0605A"
typography:
  title:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  result-title:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  small:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.12em"
rounded:
  chip: "2px"
  control: "3px"
  block: "4px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
  xl: "48px"
  target: "44px"
components:
  button-primary:
    backgroundColor: "{colors.institutional-blue}"
    textColor: "{colors.report-white}"
    rounded: "{rounded.control}"
    padding: "6px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.report-white}"
    textColor: "{colors.institutional-blue}"
    rounded: "{rounded.control}"
    padding: "6px 16px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.report-white}"
    textColor: "{colors.report-ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "44px"
  result-block:
    backgroundColor: "{colors.report-white}"
    textColor: "{colors.report-ink}"
    rounded: "{rounded.block}"
  result-head:
    backgroundColor: "{colors.section-tint}"
    textColor: "{colors.report-ink}"
    padding: "6px 16px"
    height: "44px"
  tag-chip:
    backgroundColor: "{colors.report-white}"
    textColor: "{colors.institutional-blue}"
    rounded: "{rounded.chip}"
    padding: "0 6px"
    height: "24px"
  masthead-band:
    backgroundColor: "{colors.institutional-blue}"
    textColor: "{colors.report-white}"
  range-bar:
    backgroundColor: "{colors.section-tint}"
    rounded: "{rounded.chip}"
    height: "8px"
---

# Design System: tomoshi

## Overview

**Creative North Star: "The Lab Results Report"**

Each pain arrives as a result, not a card: its evidence measured against the reference ranges the weekly run itself used, with what falls in or out of range said in words. The page reads like a clinical report on white paper: an institutional blue band across the top, pale blue-grey section heads, hairline-ruled tables, ink on white. At night (automatic, no toggle) it is the same report on a deep navy ground, never graphite and never warm.

The voice is calm, exact and unadorned. Density is that of a document a person reads closely on Monday, on a phone or a computer: small tracked section labels, tabular numbers, short plain-Spanish sentences. Nothing decorates; the one drawn element is the reference-range bar, because it is data.

This replaces the earlier andon-board world, which was rejected, above all for its yellow. None of that world carries over.

**Key Characteristics:**
- White paper, one institutional blue, hairline rules; flat, no shadows.
- One typeface (Public Sans) with tabular figures everywhere.
- Never yellow or amber. Attention is blue.
- Every state is written in words beside its colour; dots and bars are `aria-hidden`.
- The signature move is the reference-range bar drawn from the run's real thresholds.
- AA contrast in both themes, usable from 320 px.

## Colors

A blue-and-white report palette: one institutional blue carries identity, three state hues (blue, green, red) carry meaning, everything else is blue-tinted neutral. Dark theme keeps the same roles on navy; the values below are light, the navy counterparts are listed under Neutral and State.

### Primary
- **Institutional Blue** (#1F4E8C): the masthead band, headings (h1, h2), the primary button, result numbers, tag text and the focus ring. 8.31:1 on white. In dark it becomes **Navy-Lit Blue** (#8DB6EE) for text and controls, while the band itself drops to **Deep Band Navy** (#173763) so it does not glare.
- **Signal Blue** (#2B6CC4): the text caret and the selection tint only.

### State
- **Attention Blue** (#2B6CC4; text #2862B3): something awaiting attention, such as a pain pending a mark or fresh evidence. Dark: #5B9BEA, text #93BEF5.
- **In-Range Green** (#2E9E4F; text #1D7A3A): evidence inside the reference range. Dark: #3FB565, text #6FCF8E.
- **Failed Red** (#C62828): out of range, failures and errors. Dark: #F0605A, text #FF8A84.
- **Off Grey** (#7A8597): no state yet. Dark: #7486A3.

### Neutral
- **Report White** (#FFFFFF): the page and every result block, notice and field.
- **Section Tint** (#E8EEF6): section heads, the range track, the tinted strips.
- **Report Ink** (#14213D): body text, 15.97:1 on white.
- **Muted Ink** (#4A5568): secondary text, 7.53:1.
- **Hairline** (#D5DCE6): every rule and block border.
- **Control Edge** (#6B778A): input and control borders, 4.53:1.
- Dark neutrals: ground #0D1729, panel #111E33, section #18294A, ink #E6ECF5, muted #A9B6CA, hairline #2A3B5A, edge #7486A3.

### Named Rules
**The Never-Yellow Rule.** No yellow, amber or orange anywhere, in either theme. Attention is blue. (The code keeps the internal attribute name `data-lamp="amber"`; it is only a name and renders the attention blue. Likewise `green`, `red`, `off`.)

**The Words-Beside-Colour Rule.** A state is never colour alone. The dot or bar is `aria-hidden` and the state is written next to it («DENTRO DEL RANGO», «FUERA DEL RANGO», the run's status).

**The Text-Variant Rule.** A state written as text uses its `-text` value (4.5:1 or better); the plain state value is for dots, bars and control edges (3:1). A green dot never sits directly on the section tint: it goes inside a chip on the panel.

## Typography

**Display Font:** Public Sans (with system-ui, Segoe UI, Roboto)
**Body Font:** Public Sans
**Label/Mono Font:** Public Sans; there is no second face.

**Character:** a plain, institutional grotesque in four weights (400, 500, 600, 700). Tabular figures are on for the whole page (`font-variant-numeric: tabular-nums`), so counts and thresholds align in columns.

### Hierarchy
- **Title** (700, 24px, 1.1, -0.01em; 30px from 640px): the screen's h1, in Institutional Blue.
- **Headline** (600, 18px, 1.3): section h2; sheet heads use 17px.
- **Result title** (600, 17px, 1.3): a pain's title, in ink, next to its number in blue.
- **Body** (400, 16px, 1.45): running text; measure 38rem (about 72 letters), prose 64ch.
- **Small** (400/600, 14px): table rows, notes, buttons at 15px/600.
- **Label** (600, 11px, 0.12em tracked, uppercase, muted): «RESULTADOS», «QUIÉN LO SUFRE», the analysis caption and its column heads. The range flag is 11px/700 at 0.06em.

### Named Rules
**The No-Eyebrow Rule.** Tracked uppercase labels name a section or a table; they never sit as a kicker above a heading.

**The Out-of-Range-Is-Bold Rule.** A value outside its range is set bold in the failing state's text colour, as a lab report marks it.

## Layout

Mobile first, from 320 px. The page is a masthead, then a `shell`: one column, with the run's line panel (a 22 to 28rem column, `clamp(22rem, 30vw, 28rem)`) beside the main content from 1024 px; below that the line becomes a collapsible strip. Side padding is 16px, 24px from 640px, 28px from 1024px. Spacing steps on 8px: 8, 16, 24, 32, 48. Touch targets are at least 44px. Each result block lays out by its own width (a container query): stacked below about 600px, analysis table plus a side column of who suffers it and the actions above. The masthead stacks brand and actions, tabs, then the week's data on a phone, and moves the week's data into the line strip.

## Elevation & Depth

Flat. There are no shadows; depth is a hairline border (1px) and a tonal step between white panels and the Section Tint head. The only `box-shadow` in the build is an inset 1px ring that thickens an invalid field's border without moving its text. State changes are immediate colour swaps; transitions are removed under `prefers-reduced-motion`.

### Named Rules
**The Hairline-Not-Shadow Rule.** Separate surfaces with a 1px Hairline or a Section Tint head, never a shadow.

## Shapes

Small, square-leaning radii: 2px for chips and the range bar, 3px for buttons and fields, 4px for result blocks, sheets and notices. State dots are circles (10px, 8px small, 12px on the band with a 2px white ring). The range marker is a 3px-wide vertical bar. Borders are always 1px, except the active tab (3px underline) and the in-range edge (2px).

## Components

### Buttons
- **Shape:** 3px radius, 44px minimum height, 15px/600 label.
- **Primary:** Institutional Blue fill, white text; hover mixes 14% toward the ground.
- **Secondary:** panel fill, 1px blue border and blue text; hover tints 8% blue.
- **Quiet:** blue text, underlined, tinted hover; used for low-emphasis actions like «Comentar» and «Salir» (on the band «Salir» is drawn as the outline below). «Descartar» is a secondary button, not a quiet one.
- **Masthead «Salir»:** an outline button on the band, a 32px outline inside its 44px target.
- **Focus:** a 2px ring in `--focus` offset 2px (white on the band).

### Result block (station)
A 1px hairline block on the panel, 4px radius. Its head sits on the Section Tint: number in blue, title in ink, tag chips, and the state flag pushed to the right. The body is the analysis table with a side column («Quién lo sufre», actions).

### Chips and flags
- **Tag:** 24px tall, 1px hairline outline on the panel, 2px radius, 12px/600 blue text; «Evidencia nueva» in attention blue.
- **State flag:** the same chip with a dot and words, coloured by state (green, attention blue, muted).

### Fields
44px, 1px Control Edge border, 3px radius, panel fill, 16px text (no iOS zoom). Invalid: red border plus an inset ring, and a message in words after a red dot.

### Navigation
Tabs live on the band: 15px, band-soft text at rest, white and 600 with a 3px white underline when current. The brand «tomoshi» is 20px/700 with the run's dot and status in words beside it.

### Notices
Hairline panel block, 14px 16px padding, optional dot; warning borders mix attention blue, error borders are Failed Red.

### Reference-range bar (signature)
A 8px track (Section Tint, hairline border, 2px radius, 48 to 200px wide) from 0 to the row's top. The in-range part is shaded from the threshold to the end, with a 2px In-Range Green edge on the threshold side. The value is a 3px by 16px ink marker. The thresholds come from the run's real `gate.thresholds`, not constants in the page. The bar is `aria-hidden`; the row says the value, the range text and the flag in words («DENTRO DEL RANGO» in green text, «FUERA DEL RANGO» in red text, value bold red when out).

### Analysis table and the run's line
The analysis table is rows of label, value, range bar and flag, separated by hairlines under a 1px ink caption. The line is the processed sample's stage table (number, stage, cant., tope, indicador) with source sub-rows on a faint section tint.

## Do's and Don'ts

### Do:
- **Do** write every state in words beside its colour; keep dots and bars `aria-hidden`.
- **Do** draw ranges from the run's real thresholds and flag them in words.
- **Do** use Public Sans at 400/500/600/700 with tabular figures.
- **Do** separate surfaces with 1px Hairline rules and the Section Tint; keep radii 2 to 4px.
- **Do** keep both themes at AA (4.5:1 text, 3:1 marks and control edges) and usable at 320 px.

### Don't:
- **Don't** use yellow, amber or orange, or reintroduce the andon-board look (lamps, graphite, a second display face).
- **Don't** convey a state by colour alone.
- **Don't** add shadows, gradients or rounded pills.
- **Don't** put a tracked uppercase label above a heading as an eyebrow.
- **Don't** show jargon or internal ids; the page is plain Spanish.

## Implementation notes

The class `.lamp` and attribute `data-lamp` (`green`, `amber`, `red`, `off`) are legacy code names kept to avoid churn; `amber` renders Attention Blue and is not a colour of this system. Not canonized: the build's `.line-strip` and some 11 to 13px sizes are legibility floors, not a type scale to extend.
