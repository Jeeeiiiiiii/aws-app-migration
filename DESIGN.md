---
name: Store Migration
description: A live replatform migration drawn as one cyanotype engineering sheet, revised in front of the viewer.
colors:
  ground: "#0e2847"
  sheet: "#102d50"
  well: "#0b2240"
  ink: "#e6f0f7"
  ink-2: "#b2c8db"
  ink-3: "#87a3bc"
  rule: "#24456b"
  rule-strong: "#4a6d93"
  line: "#d2e3f0"
  onprem: "#a47be6"
  aws: "#1597ae"
  rejected: "#c2841a"
  failed: "#d63c59"
  signal: "#f08a24"
  signal-ink: "#ffb46b"
  ok: "#4cc38a"
  focus: "#8fd3ff"
  print-ground: "#e9eef4"
  print-sheet: "#fbfcfd"
  print-well: "#f1f5f9"
  print-ink: "#0c1f38"
  print-ink-2: "#3a5068"
  print-ink-3: "#56697e"
  print-rule: "#d3dde8"
  print-rule-strong: "#93a7bc"
  print-line: "#17304f"
  print-onprem: "#7353cc"
  print-aws: "#00819e"
  print-rejected: "#b27c00"
  print-failed: "#b1234a"
  print-signal: "#c55a00"
  print-signal-ink: "#a14800"
  print-ok: "#1d8a57"
  print-focus: "#0b6bcb"
  store-paper: "#f4f1ea"
  store-card: "#fffdf8"
  store-ink: "#1d2a24"
  store-ink-2: "#4a5852"
  store-ink-3: "#66726c"
  store-rule: "#dcd5c6"
  store-accent: "#1f5b45"
  store-warn: "#9a5a00"
  store-warn-bg: "#fbecd2"
  store-ok: "#1d7a4e"
typography:
  headline:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "0.04em"
  title:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    letterSpacing: "0.08em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  body-small:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.86rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.1em"
  measure:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.86em"
    fontWeight: 400
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  store-display:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "2.4rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.01em"
rounded:
  none: "0px"
  swatch: "2px"
  pill: "9px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  panel: "14px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.line}"
    textColor: "{colors.ground}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.well}"
  button-hold-danger:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "40px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    size: "32px"
  panel:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  panel-header:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "8px 14px"
  env-tag:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "2px 10px 2px 8px"
  phase-row-next:
    backgroundColor: "{colors.well}"
    padding: "8px 14px"
  revision-delta:
    backgroundColor: "{colors.signal}"
    width: "20px"
    height: "18px"
  toggle-on:
    backgroundColor: "{colors.signal}"
    rounded: "{rounded.pill}"
    width: "30px"
    height: "18px"
  store-button:
    backgroundColor: "transparent"
    textColor: "{colors.store-ink}"
    rounded: "{rounded.none}"
    height: "36px"
  store-button-hover:
    backgroundColor: "{colors.store-ink}"
    textColor: "{colors.store-paper}"
---

# Design System: Store Migration

## Overview

**Creative North Star: "The Revised Drawing"**

The migration is a revision to a technical drawing of the system. The console is one drawing sheet on cyanotype ground: a live schematic, a phase schedule, and a revision block, each read from the running system, set in hairline panels with square corners. Nothing glows, nothing floats on a card grid. Line work at two weights does the structure, a 20px drafting grid sits faintly behind the schematic, and a single signal orange marks faults, freeze and the point of no return. Light mode is the same sheet printed: near-white paper, blue-black ink, identical geometry.

Density is that of an instrument, not a marketing page: 15px body, 12px gutters, condensed engineering lettering for every label, and monospace only where a figure was measured. Motion is functional drafting: request flow marches along the active route, and at cutover a revision cloud draws itself around the changed path while a delta triangle with the new revision letter is entered in the revision block.

The store (`apps/store/web`) is a related surface in the same product, not a second world. It is quieter retail: warm paper, green-black ink, one green accent, ruled lists instead of panels. It shares the type families, the square-cornered form, and the on-prem and AWS identity inks, so a viewer moving from console to store recognises which side is serving them.

**Key Characteristics:**
- One sheet, hairline panels, zero radius on every surface and control.
- Cyanotype dark default (Prussian ground, pale cyan line) with a printed light theme of identical structure.
- Two identity inks (violet on-prem, teal AWS) shared by schematic routes, chart series, the serving tag and the store's served-by badge.
- Safety orange is the only signal colour, rationed to faults, freeze, irreversible actions and revision marks.
- Condensed uppercase lettering for labels; monospace with tabular figures for measured values only.
- Drafting-native devices: dash-dot zone outlines, dimension lines, revision clouds, delta triangles, a title-block revision table.

## Colors

A Prussian-blue drafting ground with pale cyan line work, two quiet identity inks for the two environments, and one rationed safety orange.

The dark cyanotype values are the default (`:root`); the `print-*` tokens are the same roles under `[data-theme="light"]`. The `store-*` tokens belong to the store surface, which follows `prefers-color-scheme` and reuses the console's on-prem and AWS values in each mode.

### Primary
- **Drafting Line** (line / print-line): the pen. Node outlines, wires, arrowheads, the primary button fill, and the active front-door route before cutover. Pale cyan-white on the cyanotype, blue-black when printed.

### Secondary
- **On-prem Violet** (onprem / print-onprem): identity ink for the on-prem environment. Active route to on-prem, the superseded route after cutover (dotted, 60% opacity), the first chart series, the serving tag dot, the store's served-by border.
- **AWS Teal** (aws / print-aws): identity ink for the AWS side. Active route to the ALB, the active pg_dump to pg_restore dimension line, the second chart series, the serving tag dot.

### Tertiary
- **Safety Orange** (signal / print-signal): the signal. Frozen node outlines, the revision cloud and delta triangle, strike-throughs, the hold-to-confirm fill (35% opacity), the danger button border, the fault-injection toggle when on, and the rollback confirmation border.
- **Signal Text** (signal-ink / print-signal-ink): orange tuned for text: connection loss, error lines, warn/error revision descriptions, checksum mismatches.

### Chart Series
Categorical, in fixed stack order bottom to top: on-prem, AWS, rejected, failed. Dark values on surface sheet; light values on print-sheet.
- **Freeze Amber** (rejected / print-rejected): writes rejected during freeze. Deliberately warmer and duller than Safety Orange so a chart fill is never mistaken for the signal.
- **Fault Crimson** (failed / print-failed): failed requests; also the failed-phase glyph.

Validated with a CVD, lightness, chroma and contrast palette validator: the light set passes on every check; the dark set passes except the adjacent violet/teal pair at CVD ΔE 8.0 (warn band), which the always-visible legend and the 2px surface gaps between stacked segments cover.

### Neutral
- **Cyanotype Ground** (ground): page background behind the sheet.
- **Sheet Blue** (sheet): panel and top-bar surface; node fill; tooltip.
- **Well Blue** (well): recessed areas: schematic drawing field, the next phase row, the confirm box, secondary button hover.
- **Ink, Ink 2, Ink 3** (ink / ink-2 / ink-3): text ramp for primary values, secondary prose, and tertiary metadata (timestamps, axis labels, asides, zone names).
- **Rule** (rule): internal dividers, gridlines, table rows, disabled borders.
- **Rule Strong** (rule-strong): panel borders, control borders, zone outlines, pending routes, the phantom (not-yet-built) node outline.
- **OK Green** (ok): done-phase glyph only.
- **Focus Sky** (focus): the 2px focus ring.
- Drafting grid `rgba(210, 227, 240, 0.045)` (printed: `rgba(23, 48, 79, 0.05)`) and selection `rgba(143, 211, 255, 0.28)` (printed: `rgba(11, 107, 203, 0.18)`) are translucent overlays defined as custom properties, not palette colours.

### Store Surface
- **Shop Paper** (store-paper) and **Shop Card** (store-card): warm off-white ground and the served-by badge fill.
- **Shop Ink ramp** (store-ink / store-ink-2 / store-ink-3) and **Shop Rule** (store-rule): green-black text and warm hairlines.
- **Shop Green** (store-accent): selection tint and focus ring; the store's only accent.
- **Shop Amber** (store-warn, store-warn-bg): freeze banner and frozen or error notices.
- **Shop OK** (store-ok): order-placed notices.

### Named Rules
**The Rationed Orange Rule.** Safety Orange appears only where something is wrong, frozen, irreversible, or revised. It is never a chart fill, never decoration, never a brand accent.

**The Two Inks Rule.** On-prem is always violet and AWS is always teal, on every surface that names an environment: schematic, chart, serving tag, and store badge. No other hue may stand for either side.

**The Printed Sheet Rule.** Light mode changes ink and paper only. Every role, weight, and geometry stays identical.

## Typography

**Display Font:** Barlow Condensed (with Barlow, system-ui), weights 500 and 600
**Body Font:** Barlow (with system-ui, sans-serif), weights 400, 500, 600
**Label/Mono Font:** JetBrains Mono (with ui-monospace), weights 400 and 500

**Character:** Barlow Condensed is engineering lettering: uppercase, tracked, compact, the voice of a drawing's labels. Barlow is its plain-spoken sibling for sentences. JetBrains Mono with tabular figures marks a number as measured.

### Hierarchy
- **Headline** (600, 1.25rem, tracking 0.04em, uppercase): the sheet title in the top bar.
- **Title** (600, 0.95rem, tracking 0.08em, uppercase): panel headers and phase names (phase names at 0.06em).
- **Body** (400, 15px, line-height 1.45): sentences in phase details, controls, hints.
- **Body Small** (400, 0.8–0.86rem): phase detail, revision descriptions, legend, asides, notes.
- **Label** (600, 0.75rem, tracking 0.1em, uppercase): revision table headers. Schematic node labels use the same lettering at 13px / 0.06em; zone names at 11.5px / 0.12em in Ink 3.
- **Measure** (JetBrains Mono 400, 0.86em, tracking -0.01em, tabular figures): counts, rps, checksums, timestamps, record values, host names, axis ticks (10.5px).
- **Store Display** (Barlow Condensed 600, 2.4rem, line-height 1, uppercase): the store masthead; the served-by environment name at 1.5rem.

### Named Rules
**The Measured Mono Rule.** Monospace means "this value was read from the running system". Never set prose, labels, or buttons in mono, and never set a live figure in Barlow.

**The Lettering Rule.** Every label that names a thing on the drawing (nodes, zones, panels, phases, column heads) is condensed, uppercase and tracked. Sentences are never uppercase.

## Layout

The console is a single sheet: 16px outer padding, max width 1600px, centred, with 12px gaps everywhere between panels. A top bar spans the sheet; beneath it a two-column grid (`2fr` main, `minmax(320px, 1fr)` side). The main column (schematic over traffic chart) is sticky at 16px from the top above 980px wide, so the drawing stays in view while the schedule and revision block scroll. Panels have 8px × 14px headers and 14px internal padding; schedule rows are 8px × 14px on a 22px glyph column.

At 980px and below the grid collapses to one column and the top bar wraps. At 720px and below the schematic holds a 640px minimum width inside a horizontal scroller rather than shrinking past legibility, and panel header asides drop to their own line. The traffic chart height is `clamp(180px, 28vh, 300px)`.

The store uses a 1080px column with 24px top and 16px side padding, a masthead ruled off by a 2px ink line, and a `1fr 300px` catalogue/orders grid with 32px gap that collapses at 760px.

## Elevation & Depth

Flat by construction. Depth is tonal and linear: the Cyanotype Ground sits behind Sheet Blue panels, and Well Blue recesses the drawing field and the next phase. Hairline borders (1px Rule Strong outside, 1px Rule inside) do the separating that shadows would do elsewhere.

### Shadow Vocabulary
- **Tooltip lift** (`box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25)`): the chart hover tooltip only, because it overlaps live data and must read as a transient layer.

### Named Rules
**The Hairline Rule.** Separation is a 1px rule, never a shadow. The tooltip is the one floating element and the only one with a shadow.

## Shapes

Square corners everywhere (0px): panels, the top bar, buttons, inputs, the env tag, schematic nodes, the store's buttons and badge. The few curves are functional glyphs: 2px on legend swatches and the top of each stacked chart bar, a 9px pill for the fault-injection toggle, and full circles for status dots and phase glyphs.

Line language carries the drawing: solid 1.5px node outlines, 1.25px wires at 70% opacity, dash-dot zone outlines (`14 4 3 4`), dash-dot-dot phantom nodes for infrastructure that does not exist yet (`10 3 2 3`), dashed pending routes (`6 4`), a heavy 3px solid active route, and arrowed dimension lines. Icons share one stroke family: 16px box, 1.6px stroke, round caps and joins, inline SVG.

## Components

### Buttons
Instrument switches: square, bordered, quiet until meant.
- **Shape:** square (0px), minimum height 40px, 0 × 16px padding, 1px Rule Strong border, weight 500.
- **Primary:** the next phase, named. Filled with Drafting Line, Cyanotype Ground text, weight 600. Hover fills with Ink. Disabled falls back to an outlined button in Ink 2.
- **Secondary:** transparent with a Rule Strong border; hover fills with Well Blue (fine pointers only).
- **Press:** scale 0.97 over 160ms `cubic-bezier(0.23, 1, 0.32, 1)`; disabled shows Ink 3 text on a Rule border with a not-allowed cursor.
- **Hold to confirm (danger):** for irreversible actions (decommission). Safety Orange border; pressing and holding for 1600ms sweeps a 35% Safety Orange fill left to right, linearly; releasing retracts it in 200ms. Works with pointer, Space and Enter.
- **Icon button:** 32px square, transparent, Rule Strong border, scale 0.95 on press. Used for the theme toggle.

### Chips
- **Env tag:** square bordered tag in condensed uppercase lettering (0.85rem, 0.06em) with an 8px dot in the environment's identity ink. Names who is serving shoppers.

### Cards / Containers
- **Corner Style:** square (0px).
- **Background:** Sheet Blue on Cyanotype Ground.
- **Shadow Strategy:** none (see The Hairline Rule).
- **Border:** 1px Rule Strong; header divided by 1px Rule.
- **Internal Padding:** header 8px × 14px with a lettered title and an optional Ink 3 aside right-aligned; body 14px.

### Inputs / Fields
- **Toggle:** 30 × 18px pill, Rule Strong outline, 12px Ink 2 knob. On: Safety Orange fill and border, knob in Sheet Blue, slid 12px over 200ms. Disabled at 50% opacity.
- **Focus:** a 2px Focus Sky outline offset 2px on every focusable element.

### Navigation
None. The console is one sheet; the top bar carries only the title, the current revision letter in mono, the serving tag, a connection warning in Signal Text, and the theme toggle.

### Live Schematic (signature)
The system drawn as nodes on a 20px drafting grid in a Well Blue field. Nodes are Sheet Blue rectangles with a 1.5px Drafting Line outline, a lettered name and a sub-line in Ink 2 or mono. States: phantom (dash-dot outline, no fill, Ink 3 text) for infrastructure not yet built; frozen (Safety Orange outline); void (55% opacity) after decommission. The active route is 3px in the serving environment's identity ink, with request flow drawn as round dots marching along it (900ms loop). At cutover a Safety Orange revision cloud draws itself around the changed path (1100ms, `cubic-bezier(0.77, 0, 0.175, 1)`, 250ms delay) and a delta triangle carrying the new revision letter appears after it.

### Traffic Chart
Stacked bars per second over the last 120 seconds, four series in fixed order (on-prem, AWS, rejected, failed), with a 2px surface gap between segments and a 2px rounded top on the top segment only. Gridlines in Rule, mono axis ticks in Ink 3, a 6% Ink hover band, a legend with live per-second values, a bordered tooltip, and a disclosure table of the last ten seconds for screen readers and precise reading.

### Phase Schedule
A vertical list: 16px status glyph (circle; check in OK Green; cross in Fault Crimson; spinning arc while running), lettered phase name with a mono timestamp right-aligned, Body Small detail, and optional fingerprint tables (row counts and checksums, mismatches in Signal Text). The next phase sits on Well Blue.

### Revision Block
The drawing's title-block revision table, anchored at the bottom of the side column: REV, TIME, DESCRIPTION columns in lettered headers. Milestones carry a Safety Orange delta triangle with the revision letter and full-Ink text; routine entries are Ink 2; warn and error descriptions are Signal Text. New rows fade in over 200ms. Scrolls past 340px.

### Store: Served-by Badge (related surface)
A square card with a 2px border in the serving environment's identity ink, an Ink 3 label, the environment in 1.5rem condensed lettering, and the database host in mono. The border colour transitions over 300ms when cutover lands.

## Do's and Don'ts

### Do:
- **Do** draw every surface as part of one sheet: square corners, 1px Rule Strong borders, 12px gaps.
- **Do** colour on-prem violet and AWS teal everywhere an environment is named, in both the console and the store.
- **Do** keep the chart series in fixed stack order (on-prem, AWS, rejected, failed) with the 2px surface gaps and an always-visible legend.
- **Do** set every measured value in JetBrains Mono with tabular figures.
- **Do** use drafting devices for change: phantom dash-dot outlines for what is not built, revision clouds and delta triangles for what was revised.
- **Do** make irreversible actions hold-to-confirm with the Safety Orange sweep.
- **Do** honour `prefers-reduced-motion`: stop the flow and spinners, show the revision cloud and delta already drawn.

### Don't:
- **Don't** use Safety Orange as a chart series, fill, or decorative accent.
- **Don't** add drop shadows to panels, buttons or nodes; the chart tooltip is the only shadowed element.
- **Don't** round panel or button corners.
- **Don't** set labels or prose in monospace, or live figures in Barlow.
- **Don't** introduce a third environment hue or reuse violet or teal for anything but the two environments.
