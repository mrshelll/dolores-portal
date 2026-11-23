---
name: tomoshi
description: The andon board where a small team decides which pains to work on, with the weekly run's production line beside each decision.
colors:
  graphite-ground: "#1A1C1E"
  graphite-side: "#202225"
  graphite-panel: "#2A2D31"
  board-ink: "#F4F4F2"
  board-muted: "#A9ADB1"
  board-line: "#3A3E43"
  board-edge: "#767B82"
  board-hover: "rgba(244, 244, 242, 0.06)"
  steel-ground: "#DCDEE0"
  steel-side: "#E6E8EA"
  steel-panel: "#F2F3F4"
  day-ink: "#1A1C1E"
  day-muted: "#4A4F55"
  day-line: "#C3C7CB"
  day-edge: "#6B7076"
  day-signal: "#7A5000"
  day-hover: "rgba(26, 28, 30, 0.07)"
  lamp-amber: "#F2A900"
  lamp-green: "#2E9E4F"
  lamp-red: "#D7261E"
  lamp-red-board: "#E0302A"
  lamp-off-day: "#B4B8BD"
  lamp-off-board: "#4A4E53"
  lamp-rim-day: "rgba(26, 28, 30, 0.78)"
  lamp-off-rim-day: "rgba(26, 28, 30, 0.55)"
  on-red: "#FFFFFF"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.005em"
  headline-section:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.15
  count:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
  caption:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  tag:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.6
rounded:
  tag: "2px"
  control: "3px"
  panel: "4px"
  lamp: "50%"
spacing:
  "1": "8px"
  "2": "16px"
  "3": "24px"
  "4": "32px"
  "5": "48px"
  pad-phone: "16px"
  pad-tablet: "24px"
  pad-desktop: "28px"
  target: "44px"
components:
  button-primary:
    backgroundColor: "{colors.board-ink}"
    textColor: "{colors.graphite-ground}"
    rounded: "{rounded.control}"
    padding: "6px 16px"
    height: "44px"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.control}"
    padding: "6px 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.board-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.board-muted}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
    height: "44px"
  button-quiet-hover:
    backgroundColor: "{colors.board-hover}"
    textColor: "{colors.board-ink}"
  input:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "44px"
    typography: "{typography.body}"
  tab:
    textColor: "{colors.board-muted}"
    padding: "3px 14px 0"
    height: "44px"
  tab-current:
    textColor: "{colors.board-ink}"
  lamp:
    backgroundColor: "{colors.lamp-off-board}"
    rounded: "{rounded.lamp}"
    size: "14px"
  lamp-station:
    rounded: "{rounded.lamp}"
    size: "30px"
  station:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.panel}"
    padding: "18px 22px 18px 20px"
  station-number:
    textColor: "{colors.board-ink}"
    typography: "{typography.display}"
  tag-winner:
    backgroundColor: "{colors.board-ink}"
    textColor: "{colors.graphite-ground}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
    typography: "{typography.tag}"
  tag-fresh:
    backgroundColor: "{colors.lamp-amber}"
    textColor: "{colors.graphite-ground}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
    typography: "{typography.tag}"
  flag-red:
    backgroundColor: "{colors.lamp-red-board}"
    textColor: "{colors.on-red}"
    rounded: "{rounded.tag}"
    padding: "0 6px"
    typography: "{typography.tag}"
  notice:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.panel}"
    padding: "14px 16px"
  row-list:
    backgroundColor: "{colors.graphite-panel}"
    rounded: "{rounded.panel}"
    padding: "10px 16px 12px"
  line-panel:
    backgroundColor: "{colors.graphite-side}"
    padding: "22px 26px 32px"
    width: "clamp(22rem, 30vw, 28rem)"
---

# Design System: tomoshi

## Overview

**Creative North Star: "The Andon Board"**

The page is a plant's andon board. Each pain waiting for a decision is a numbered station with a flat lamp, and the week's run is a production line of stations with a lamp and a count at each stage. A lamp lights when the run pulled the cord for it. Nothing on the page is a feed, a hero or a dashboard tab. There is one board, read top to bottom, with the line that produced it beside it. The look is industrial and plain: condensed type, big tabular station numbers, flat panels on a flat ground, and four lamp colours that mean something every time they appear.

There are two themes and no toggle. `prefers-color-scheme` chooses between them. Dark is the plant's board: graphite ground, slightly lighter panels, off-white ink. Light is «el tablero de día» (the day board): a cool steel ground, near-white panels, graphite ink. The lamp hues are the same in both, and each lamp on the day board gets a dark rim. The light theme is never cream or warm paper. The density is that of an operator's screen. Rows are dense, rules are 1 px, every target is 44 px, and the page works from 320 px wide.

Colour is status and only status. Amber, green and red appear as lamps, as small filled tags and flags, as the current tab's bar and as the focus ring. They never colour running text. Every lamp has its state written beside it in words, so the lamp repeats what the words already say.

**Key Characteristics:**
- Flat lamp discs (amber, green, red, off) with no bevel, glow or screws, and their state always written beside them.
- Two automatic themes built from one set of role tokens: a graphite board and a cool-steel day board.
- One face, Barlow Semi Condensed, with tabular figures everywhere, so counts line up down a column.
- Zero-padded station numbers (01, 02…), the largest type on the page.
- Depth through tonal steps (ground, side panel, panel) and 1 px rules. No shadows.
- One motion signature, «tomoshi»: on load the lamps light one after another in stage order, 70 ms apart, once.

## Colors

A neutral graphite-and-steel shell carries four saturated lamp colours, and those lamps are the page's only colour.

### Primary
- **Andon Amber** (lamp-amber): the "look at this" lamp. A pain under watch, a stage whose cap cut items, a source that came back truncated. It is also the «Evidencia nueva» (new evidence) tag fill, the text-selection fill, and on the board the current tab's bar, the caret and the focus ring.
- **Day Signal** (day-signal): amber darkened to 5.7:1 so it holds as a line on the steel ground. The day board's current-tab bar and caret.

### Secondary
- **Run Green** (lamp-green): the healthy lamp. A pain with weight to work on, a stage with no cut, a complete run at the brand.
- **Stop Red** (lamp-red on the day board, lamp-red-board on the graphite board): a failed run, a source that brought nothing, a field in error. The board's red is lifted a step (3.05:1 on the panel) so the disc still reads, and white text on it keeps 4.54:1.

### Neutral
- **Graphite Ground / Side / Panel** (graphite-ground, graphite-side, graphite-panel): the board's three tonal steps. The page, the line's side panel, then stations, notices, rows and fields.
- **Board Ink / Muted** (board-ink, board-muted): primary text (15.5:1 on the ground) and secondary text (6.1:1 on a panel).
- **Board Line / Edge** (board-line, board-edge): dividers, and the control borders that also rim an off lamp.
- **Steel Ground / Side / Panel** (steel-ground, steel-side, steel-panel): the day board's three steps, cool grey, never warm.
- **Day Ink / Muted / Line / Edge** (day-ink, day-muted, day-line, day-edge): the day board's text (12.7:1 on the ground), secondary text (6.1:1), dividers and control borders (4.5:1 on a panel).
- **Lamp Off** (lamp-off-day, lamp-off-board): an unlit lamp, meaning discarded, no data, or waiting for the move. On the board it is rimmed with the edge colour, on the day board with a 0.55 graphite rim.
- **Day Rim** (lamp-rim-day): the 1.5 px inset ring at 0.78 graphite that every lit lamp, amber tag and amber flag carries on the day board, so each one keeps 3:1 against the steel panels. It is transparent on the board.

### Named Rules
**The Written State Rule.** A lamp never stands alone. Its state is written beside it in words («En observación», which means under watch, or «Con recorte», which means the cap cut items), and the disc itself is hidden from screen readers.

**The Lamp Is Not Ink Rule.** Amber, green and red fill discs, tags, flags and the active bar. They never colour text, and green or red text never sits on the graphite ground. An error is ink-coloured words after a red dot.

**The Never Cream Rule.** The day board is cool steel (a hue near 248°, chroma under 0.01). Warm paper, cream and beige are outside this world.

**The Same Lamps Rule.** The lamp hues are shared by both themes. Only the red is lifted on the board for contrast, the rim appears on the day board, and the off colour changes with the ground.

## Typography

**Display Font:** Barlow Semi Condensed (with Roboto Condensed, Arial Narrow, system-ui)
**Body Font:** Barlow Semi Condensed
**Label/Mono Font:** none distinct. The same face is used everywhere, and `font-variant-numeric: tabular-nums` is set on the body.

**Character:** The condensed grotesque of signage and plant-floor panels. It is narrow enough to fit a station's title in two lines and sturdy at 700 for numbers that have to be read from across a room.

### Hierarchy
- **Display** (700, 36px on phones → 52px from 640px, line-height 0.9, -0.01em): the station number (01, 02…). It is always zero-padded to two digits. A compact station uses 28px.
- **Headline** (700, 28px → 32px from 640px, 1.05): the page's h1.
- **Headline Section** (700, 26px, 1.15): a section heading in a pain's detail column. The line's own h2 is 22px/700, and a list section's h2 is 18px/600.
- **Title** (600, 21px → 22px, 1.15): a station's pain title. In row lists, titles step down to 17px (pain rows) and 19px (run rows and the compact station), all 600.
- **Count** (700, 22px, 1): a stage's count on the line. The board's counters use the same weight at 26px → 28px.
- **Body** (400, 16px, 1.45): running text, held to a 40rem measure. Detail prose runs at 54ch, about 66 letters in this face. Quotes are 17px/1.45.
- **Label** (600, 14px, 1.2): a lamp's written state, buttons (15px/600), field labels, and the muted label before a value («Quién lo sufre:», meaning who suffers it).
- **Caption** (400–500, 13px, 1.4): stage notes, a source's state, the week's data on the masthead below 1280px.
- **Tag** (600, 12px, 1.6): filled tags and flags («Ganó el duelo», meaning it won the duel; «recortada», meaning truncated).

### Named Rules
**The One Face Rule.** Barlow Semi Condensed does every job, at 400, 500, 600 and 700. Hierarchy comes from size and weight, never from a second family.

**The Tabular Figures Rule.** Every number is tabular, so the counts in a column and the figures in a source line up digit for digit.

**The Big Number Rule.** The station number is the largest type on any screen that has stations. It leads the station's plate, and the title follows it in reading order.

## Layout

The layout is mobile first and works from 320px. The page's side margin (`pad`) is 16px, then 24px from 640px, then 28px from 1024px. Spacing runs on an 8px step (8, 16, 24, 32, 48), with more space above a block than inside it. Every interactive target is at least 44px tall. Where a one-line link is shorter than that, its box grows to 44px and gives the room back with a negative margin, so the rhythm does not change.

- **Masthead.** On a phone it has three rows: brand with «Salir» (sign out), then tabs, and the week's data is dropped (the home's line strip carries it). From 768px the tabs join the brand's row and the week's data takes a row under it. From 1280px it is one 56px row: brand, tabs, week's data aligned right and divided by 1px rules, then actions.
- **Shell.** It is one column. On the home from 1024px, the run's line becomes a side panel `clamp(22rem, 30vw, 28rem)` wide on the side tone, with a 1px rule on its left. Below 1024px the line folds into a strip under the title. Its summary keeps one small lamp per stage and a count of the stages that had a cut.
- **Stations.** They sit in an `auto-fill` grid of `minmax(min(100%, 24rem), 1fr)` with 16px gaps. On a phone the plate (number, lamp, state) is a row on top. From 640px it is a 96px column at the left, divided by a rule, with the state centred under the lamp. Full stations in a row stretch to the same height with their actions at the foot. A compact station starts its own row. An odd last full station spans the row.
- **Row lists** (catalog, runs). The rows sit on one panel, divided by 1px rules, and each title's link covers its row. From 720px the lamp and state become a left column (12.5rem for pains, 11rem for runs). From 1200px a third column takes the marks or the run's mini line.
- **Container queries.** The sources box and the "how we got here" rows lay out by their own width, not the viewport's, because the same box sits in the narrow side panel and in the full-width strip.
- **Measures.** 40rem for text, 54ch for detail prose, 440px for forms. A pain's detail runs prose beside a 14rem sticky index from 672px. One run's page puts its line in a 24–30rem column from 1024px.
- **Breakpoints in use:** 400, 640, 672, 720, 768, 1024, 1200, 1280px (exact values are in the sidecar).

## Elevation & Depth

The system is flat. There are no drop shadows anywhere. Depth comes from three tonal steps (ground → side panel → panel) and from 1px rules in the line colour. A panel is a flat plate set into a flat board. The only `box-shadow`s are structural, and they draw part of a lamp. One is the inset rim that outlines a lamp, tag or flag. The other is a 4px ring in the colour of the surface behind a station's lamp on the line, which cuts the rail so the rail seems to stop at each lamp.

### Named Rules
**The Flat Board Rule.** Surfaces never lift. Hover is a tint (6–7% ink over the surface), never a shadow or a raise.

**The No Bevel Rule.** Lamps are flat discs with no gradient, highlight, glow or screw heads.

## Shapes

The geometry is small and rectilinear. Panels (stations, notices, row lists, the line strip) use a 4px radius. Controls (buttons, fields, the sources box, raw-text panels) use 3px. Tags and flags use 2px. The only round shape is the lamp, a true circle in four sizes: 10px small (sources, strip), 14px default, 16px on the line, and 22px → 30px at a station. The line is a 2px vertical rail with its lamps threaded on it. The mini line in a run row is the same rail laid flat, with ten lamps to a row, or five on a narrow phone. A quote has a 3px rule on its inline start. Disclosure chevrons are drawn from two borders of an 8px square turned 45°, and they rotate 180° when the fold opens.

## Components

### Buttons
Square-shouldered and plain. The primary action is the ink colour, inverted.
- **Shape:** slightly squared (3px), at least 44px tall, 6px × 16px padding, 15px/600 labels that never break inside their guillemets.
- **Primary** («Nos interesa», meaning we're interested): the ink colour as a fill with the ground colour as text. On the board that means an off-white button with graphite text; on the day board, graphite with near-white text. Hover and active mix the fill 84% with the ground. It is never amber.
- **Secondary** («Descartar», meaning discard): transparent with a 1px edge border. Hover takes the hover tint and an ink border.
- **Quiet** («Comentar», «Salir»): muted text with 10px side padding. Hover takes ink text and the hover tint.
- **Busy:** `aria-disabled` shows a progress cursor at 0.72 opacity.
- **Link button:** an underlined secondary action in the edge colour that turns to currentColor on hover.

### Lamps
The signature primitive. A flat disc in one of the four states, aria-hidden, always paired with written state.
- **Sizes:** 10 / 14 / 16 / 22–30px, as above.
- **Rim:** a 1.5px inset rim in lamp-rim-day on the day board (transparent on the board). Off lamps take a 1px rim.
- **Waiting:** a lamp that waits for the «tomoshi» move is drawn off and scaled to 0.82 until it is lit. Then background and scale ease in over 320ms on `cubic-bezier(0.16, 1, 0.3, 1)`.

### Tags and Flags
- **Style:** small filled plates (2px radius, 12px/600). Winner: ink fill with inverted text. New evidence and amber flags: amber fill with graphite text and the day rim. Red flag: red fill with white text.
- **Use:** a tag marks a station's standing; a flag marks a stage's or source's outcome inside the line. Each one carries words, never only colour.

### Cards / Containers (stations, notices, row panels)
- **Corner Style:** 4px.
- **Background:** the panel tone on the ground. Inside the line strip, the sources box takes the ground tone to step back down.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none on stations and row panels. Internal divisions are 1px rules. A notice has a 1px line border, or an edge border when it is a warning.
- **Internal Padding:** a station is 12px × 16px on a phone and 18px × 20–22px from 640px. Rows are 10–14px × 16px. Notices are 14px × 16px.

### Inputs / Fields
- **Style:** panel fill, 1px edge border, 3px radius, at least 44px tall, 16px text so iOS does not zoom.
- **Focus:** a 2px solid focus ring (amber on the board, ink on the day board) at a 2px offset, the same ring as every focusable element.
- **Error:** a red border plus a 1px red inset. The message is ink-coloured 14px/600 words after a 10px red dot.
- **Code input:** 24px/600 with 0.2em letter-spacing, about 12ch wide.

### Navigation
- **Style:** lowercase «tomoshi» wordmark at 26px/700, with the run-state lamp at its left and, from 768px, the lamp's state in words after a 1px rule.
- **Tabs:** 16px/500 muted, 44px tall. The current tab is ink at 600 with a 3px bottom bar in the signal colour. Hover shows ink.

### The Run's Line (signature)
A vertical rail of stations, one per pipeline stage. Each station has a lamp, a muted zero-padded step number, a 16px/600 label, a right-aligned 22px/700 count, and a caption line with its state (an amber flag when its cap cut items) and notes. The sources sit in an inset box under the first station, each with a small lamp, a name, figures like `before → after of available`, and a state or flag. The run's costs close the line above a 1px rule. On a phone it is a `<details>` strip whose summary is the title, a row of small lamps, and «N etapas con recorte» (N stages had a cut).

### The «tomoshi» Move (motion)
On a screen's first render in a session, lamps marked to wait light up in stage order, 70ms apart, starting 160ms after the first paint. They light once per run per session, and later visits draw them already lit. Under `prefers-reduced-motion` every lamp is lit at once and all transitions are off. No other element on the page animates on load. Other transitions are state feedback only: 90ms ease-out on buttons and 200ms on chevrons.

## Do's and Don'ts

### Do:
- **Do** write a lamp's state in words beside every lamp, and mark the disc `aria-hidden`.
- **Do** build both themes from the same role tokens (ground, side, panel, ink, muted, line, edge, signal, focus, hover), switched only by `prefers-color-scheme`.
- **Do** give every lit lamp, amber tag and amber flag the 1.5px dark rim on the day board.
- **Do** set every number in tabular figures, and zero-pad station and stage numbers to two digits.
- **Do** separate content with tonal steps and 1px rules, and keep panels at 4px, controls at 3px and tags at 2px.
- **Do** keep every target at 44px or more, and let a short link's box grow to 44px with a negative margin.
- **Do** draw disclosure chevrons from two borders of an 8px square, rotated, so they inherit the muted colour.
- **Do** reserve load-time motion for the «tomoshi» lamp sequence, at 70ms a step, once, and with none under reduced motion.

### Don't:
- **Don't** bevel, gloss, glow or screw a lamp. It is a flat disc.
- **Don't** colour text amber, green or red, and never put green or red text on the graphite ground.
- **Don't** make a lamp colour the primary action. The primary button is inverted ink.
- **Don't** warm the day board toward cream or paper. It stays cool steel.
- **Don't** add drop shadows or lift a panel on hover. Hover is a 6–7% ink tint.
- **Don't** add a second typeface or a monospace for figures.
- **Don't** show state by colour alone anywhere: in a lamp, a tag, a flag or a field error.
