---
name: Gunblood Browser Duels
description: Blackened walnut, antique brass and bone lettering around the original duel.
colors:
  ground: "#190f0a"
  wood: "#21140d"
  ink: "#f4e4bb"
  muted: "#dfc39a"
  brass: "#b98b4c"
  red: "#841e17"
  error: "#ffb8a5"
  focus: "#ffdb81"
  line: "#79542c"
  masthead: "#f0d4a0"
  field: "#100b08"
  placeholder: "#ad9575"
typography:
  display:
    fontFamily: "Sancreek, Georgia, serif"
    fontSize: "clamp(42px, 6.8vw, 108px)"
    fontWeight: 400
    lineHeight: 1.16
    letterSpacing: ".025em"
  headline:
    fontFamily: "Rye, Georgia, serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "Barlow, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Barlow, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  button:
    fontFamily: "Rye, Georgia, serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.3
  code:
    fontFamily: "ui-monospace, monospace"
    fontSize: "32px"
    lineHeight: 1.4
    letterSpacing: ".18em"
rounded:
  control: "5px"
  field: "3px"
  header: "9px 9px 2px 2px"
  cabinet: "0 0 8px 8px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  button-primary:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "16px 28px"
  button-secondary:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "16px 28px"
  button-text:
    textColor: "{colors.ink}"
    padding: "8px 12px"
  input-code:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
  link-source:
    textColor: "{colors.ink}"
    padding: "8px 20px"
---

# Design System: Gunblood Browser Duels

## Overview

**Creative North Star: "The Saloon Duel Cabinet"**

The implemented world is a substantial Western arcade cabinet: blackened walnut, worn antique brass, oxblood plates and bone lettering. Material depth surrounds the real Gunblood imagery; readable HTML carries the controls, room codes, status and attribution. The user approved the centered cabinet reference and rejected the former plain cream treatment.

This document extracts `docs/style.css` and `docs/index.html`. It records the implementation, rather than certifying a visual audit. The automated comparison against the approved mockup remains failed; known genre and material detection false positives do not convert that result into a pass.

**Key Characteristics:**
- Original game imagery framed by physical-looking timber and brass.
- Western sign lettering reserved for brand, headings and actions.
- Short connection steps beneath an anchored arena.
- Warm readable utility text and visible keyboard focus.

## Colors

The palette is warm throughout, with lighter bone and sand text on walnut surfaces.

### Primary
- **Antique Brass** (`brass`): bezel-adjacent borders, room-code strokes and health indicators.
- **Oxblood** (`red`): the declared red palette anchor; the primary plate's actual pigment comes from raster artwork, not a CSS fill.

### Neutral
- **Blackened Walnut** (`ground`, `wood`): dark base colors beneath the saloon and timber images.
- **Bone** (`ink`) and **Signboard Bone** (`masthead`): utility copy and the masthead respectively.
- **Warm Sand** (`muted`): hints, attribution and secondary gameplay information.
- **Dark Recess** (`field`) and **Worn Brass Line** (`line`): code fields and quiet separators.
- **Faded Sand** (`placeholder`): empty room-code prompt.

### State Colors
- **Lantern Gold** (`focus`): keyboard outline and input caret.
- **Pale Ember** (`error`): invalid fields, connection failures and suspension notices.

**The Material Color Rule.** Keep the production raster materials as the visual source for wood, brass and control plates; a flat token fill is only the underlying surface.

## Typography

**Display Font:** self-hosted Sancreek, with Georgia and serif fallbacks.
**Headings and Controls:** self-hosted Rye, with Georgia and serif fallbacks.
**Body Font:** Barlow is the CSS alias for the self-hosted **Barlow Semi Condensed** regular and semibold files; Arial and sans-serif are the fallbacks.
**Code Font:** system monospace, used for actual six-digit room data.

### Hierarchy
- **Display:** the frontmatter clamp applies to the desktop masthead; responsive rules resize it. During a duel the desktop mark contracts to (50px), then (38px) and (30px) at the smaller breakpoints.
- **Headline:** Rye headings use the headline token; the start heading is uppercase. Round status uses Rye at (26px).
- **Body:** regular Barlow with a paragraph maximum measure of (70ch). Smaller supporting copy uses (16px–17px).
- **Label:** semibold Barlow groups field labels and player-side names; the subtitle uses uppercase Barlow with generous tracking.
- **Button:** Rye action labels use the button token; the desktop initial Host and Join controls enlarge to (26px).
- **Code:** tabular numerals and spaced monospace; the outgoing desktop code enlarges to (36px).

**The Lettering Rule.** Keep decorative Western faces on the sign, headings and principal actions. Instructions, errors and dense gameplay information use Barlow.

## Layout

The current browser-duel surface uses a single centered cabinet. Its desktop width is `min(80vw,1200px)`, with a joined signboard and main casing. The screen frame occupies (87%) of the cabinet; percentage padding makes room for the brass overlay. The live arena and preview preserve the game's (720:425) ratio.

The initial apron has three tracks (`1.2fr 1fr 1fr`) separated by (32px). The connection exchange replaces this area and caps its width at (660px); the arena stays above it. Match status and scoreboard use an (80%) interior width. The scoreboard has two equal columns, one for each fighter. These are game data columns, not a general card system.

Responsive changes are explicit at (1100px), (760px) and (480px):
- At (1100px), cabinet width becomes viewport width minus (48px), screen width becomes (91%), and gaps and lettering tighten.
- At (760px), the apron introduction spans both columns while Host and Join remain side by side. The source link enters normal flow in the lobby, the footer help takes a full row, and game information widens to (86%).
- At (480px), outer gutters shrink to (8px) each and the decorative saloon edges disappear. The screen is (98%) wide. Code inputs and their actions stack full width; Host and Join still share two columns.

## Elevation & Depth

Depth comes primarily from generated material artwork: timber grain, brass lips and screw heads. The cabinet also has one soft structural shadow (`0 10px 24px #000b`), a dark casing border, and an inset brass outline. The masthead uses two short offset text shadows (`2px 3px 1px #641b0c, 3px 5px 2px #080403`). Controls use a small shadow beneath their letters and brighten on hover. Keep these roles tied to the physical cabinet.

### Material Assets and Provenance

All paths below are relative to the project root. The mockup at `.impeccable/mocks/duel-cabinet.png` is a style reference, not production image content.
- `docs/assets/arena.png` is the actual rebuilt SWF rendered through bundled Ruffle; `arena.origin.txt` points to its capture and `archive/provenance.json`. Keep Andrew Wolf / Wolf Games attribution.
- `arena-bezel.png`, `host-button.png` and `join-button.png` are native ImageGen material assets with transparent backgrounds; their adjacent `.json` and `.prompt.txt` files retain generation and resampling history. Plate labels are HTML, never painted into the image.
- `cabinet-timber.jpg` is the shipping timber texture; `cabinet-timber.png.json` and its prompt retain the original generated material history. The JPEG is the delivery format; the provenance filename retains its original PNG name.
- `saloon-ground.jpg`, `saloon-left.jpg` and `saloon-right.jpg` derive from the generated backdrop; adjacent `.origin.txt` files point to `.impeccable/asset-sources/saloon-backdrop.png.json`. The edges are decorative, empty-alt images. The shipping `docs/assets/saloon-backdrop.provenance.txt` also retains the exact source and prompt metadata.
- Self-hosted font files and their SIL Open Font License texts live in `docs/fonts/`.

## Shapes

The cabinet is rectangular with subtly softened joinery: the header and base use the compound radius tokens. Action plates have softened (5px) CSS corners and their own raster contours; code fields use the tighter field radius. Fine brass outlines and the substantial dark casing border express construction. The arena is a rectangular aperture, not a rounded card. Health meters are thin (5px) bars.

## Components

### Material Action Buttons

Primary actions use the oxblood `host-button.png`; secondary actions use dark `join-button.png`. Their base minimum height is (54px), increasing to (74px) in the initial desktop apron. Hover uses `brightness(1.18)` and active uses `translateY(1px)` with no timed transition. Disabled controls use grayscale (.65), opacity (.7) and a wait cursor. Labels remain semantic HTML.

### Utility Actions and Source Link

Back and Leave use underlined semibold Barlow, a (44px) minimum height and a faint warm hover fill. The source link uses the dark plate material with an inline stroked SVG arrow, and remains an ordinary anchor. This implementation has no general navigation bar, chip or card primitive.

### Room-Code Fields and Feedback

Fields have a recessed dark fill, brass stroke, tabular code text and a gold caret. Invalid incoming codes switch the border to the error token and show a nearby error message. Read-only outgoing fields keep the same appearance. Feedback sits behind a thin separator, with polite live status in the markup. Error status gains the warm error color and semibold weight.

### Arena and Scoreboard

A decorative transparent brass overlay frames both the lobby preview and the interactive arena without intercepting pointer input. The arena's input surface has a crosshair cursor and touch-action disabled. The two fighter columns show textual health and ammunition as well as thin brass health meters; numerical alignment uses tabular figures.

### Help and Browser States

Connection help is an inline details disclosure; opening it expands its row to the full cabinet width. Links have offset underlines. Selection uses an ember background and light bone text; scrollbars use brass on the dark ground. Buttons, fields, links, summary and the arena input receive a (3px) gold focus outline with (4px) offset. The programmatically focused connection heading suppresses its own outline.

### Motion and High-Contrast Adaptation

The one authored entrance is the exchange apron's (180ms) clip-path reveal, eased with `cubic-bezier(.16,1,.3,1)`, enabled only when the user has no reduced-motion preference. It starts already visible and reveals the final bottom portion. Reduced motion disables that entrance; the immediate mechanical button press remains. In forced-colors mode, system colors and borders replace material buttons, the decorative bezel and saloon edges disappear, and the cabinet and brand adopt system canvas colors.

## Do's and Don'ts

### Do:
- **Do** retain genuine game imagery, aspect ratio, creator credit and original links.
- **Do** use the existing material assets with their provenance when extending this cabinet.
- **Do** keep action labels, field labels and status as readable semantic HTML.
- **Do** retain explicit focus, reduced-motion and forced-colors behavior.

### Don't:
- **Don't** return to the rejected plain cream visual treatment.
- **Don't** replace Western masthead lettering with a generic system display face.
- **Don't** bake functional copy or fields into a generated image.
- **Don't** describe the failed automated mockup comparison as passed or this extraction as accessibility certification.

Fullscreen gameplay uses the native Fullscreen API on the duel section. Keep round status, health, ammunition and exit controls visible; fit the arena at 720:425 using the available container dimensions. Decorative bezel and page-level content recede in this mode.
