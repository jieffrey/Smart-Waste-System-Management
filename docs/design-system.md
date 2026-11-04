# SWMS design system (web admin, phase 1)

## Concept

Residents are the eyes, the AI is the sorter, admins are the dispatchers. Every report reaches the right
handling path, and the reporter can see it get resolved.

The design has to say that without decoration:
- **The AI category routes reports.** It is shown everywhere with the same three colors, so an admin learns
  to read "organic / paper / plastic" at a glance: in tables, charts and the AI result.
- **Status is a sequence, not a mood.** Pending → in progress → completed is shown with shapes that fill
  up, not with traffic-light colors.
- **The dashboard is about patterns:** what kind of waste, how fast it is handled, how far the AI can be
  trusted. One number leads each screen; everything else supports it.

Style: Bauhaus / punk-zine discipline. Hard edges, 1px ink rules instead of boxes, a strong grid, big
confident numbers, generous whitespace. No shadows, gradients (charts included), glass effects, emoji or
decorative shapes. Light mode only.

## Color

All colors are defined once, as CSS variables in [`web/src/app/globals.css`](../web/src/app/globals.css)
(`@theme`), and the category mapping lives in [`web/src/lib/categories.ts`](../web/src/lib/categories.ts).

### Base

| Token | Hex | Use |
|---|---|---|
| `snow` | `#FBFBF8` | Page background |
| `ink` | `#121212` | Text, rules, icons, secondary buttons |
| `red` (red orange) | `#FF4A1C` | **Only:** the primary CTA, the single most important number on a screen, and the active/selected state |
| `yellow` (yellow punk) | `#E8F23A` | **Only** as a highlighter behind ink text, or as text on ink. Never text or icons on snow |
| `cobalt` | `#2B4BD8` | Category color (plastic) |

Red orange is **never** used for errors or "rejected". Errors and rejected items use ink text with an icon.

### Neutral scale (ink mixed into snow)

| Token | Hex | Use |
|---|---|---|
| `gray-50` | `#F2F2EF` | Hover rows, subtle fills |
| `gray-100` | `#E8E8E6` | Selected rows, image placeholders |
| `gray-200` | `#D6D6D3` | Table row dividers |
| `gray-300` | `#BABAB8` | Disabled borders, chart grid lines (decorative only) |
| `gray-400` | `#929291` | Disabled text at large sizes only |
| `gray-500` | `#747473` | Placeholder text |
| `gray-600` | `#5D5D5C` | Secondary text (labels, meta) |
| `gray-700` | `#454545` | Body text on tinted backgrounds |
| `gray-800` | `#2E2E2E` | Strong secondary text |

### Waste categories (one place: `lib/categories.ts`)

| Class | Color | Why |
|---|---|---|
| `organic` | red orange `#FF4A1C` | The heaviest, most urgent stream (it rots) |
| `paper` | ink `#121212` | Print, newsprint |
| `plastic` | cobalt `#2B4BD8` | Bottles, water |

In charts these are flat fills. In text, a category is a **small square swatch + ink label**, because red
orange text on snow only passes AA at large sizes.

### Status (no color)

| Status | Marker |
|---|---|
| Pending | empty square (1.5px ink outline) |
| In progress | half-filled square |
| Completed | filled ink square with a check |
| Rejected | crossed square + struck-through label |

## WCAG contrast (computed)

Ratios computed with the WCAG 2.x relative-luminance formula. AA needs 4.5:1 for normal text, 3:1 for
large text (≥ 24px, or ≥ 18.66px bold) and for UI graphics.

| Foreground | Background | Ratio | Result | Allowed use |
|---|---|---|---|---|
| ink | snow | 18.07 | AAA | All text |
| gray-800 | snow | 13.10 | AAA | Text |
| gray-700 | snow | 9.25 | AAA | Text |
| gray-600 | snow | 6.36 | AA | Secondary text (any size) |
| gray-500 | snow | 4.51 | AA | Placeholders only (just passes) |
| gray-400 | snow | 3.00 | AA large / UI | Large text, disabled states |
| gray-300 | snow | 1.87 | Fail | Decorative lines only, never text |
| red orange | snow | 3.24 | AA large / UI | Display numbers (≥ 24px), active markers, chart fills. **Not** small text |
| ink | red orange | 5.57 | AA | Primary button label |
| white / snow | red orange | 3.36 / 3.24 | AA large only | Not used for button labels |
| cobalt | snow | 6.53 | AA | Chart fills, swatches (could be text) |
| snow | cobalt | 6.53 | AA | Text on cobalt |
| ink | yellow | 15.34 | AAA | Highlighter behind ink text |
| yellow | ink | 15.34 | AAA | Yellow text on ink blocks |
| yellow | snow | 1.18 | **Fail** | **Never** |
| red orange | ink | 5.57 | AA | Red orange on ink blocks |
| snow | ink | 18.07 | AAA | Inverted blocks |
| ink | gray-100 | 15.27 | AAA | Text on selected rows |
| gray-600 | gray-100 | 5.37 | AA | Meta text on selected rows |
| gray-700 | gray-100 | 7.81 | AAA | Text on placeholders |
| cobalt | gray-100 | 5.52 | AA | Swatches on tinted rows |
| red orange | gray-100 | 2.74 | **Fail** | Never red-orange text on gray-100 |

Focus indicator: 2px ink outline with a 2px offset (ink on snow, 18:1).

## Typography

Fonts load with `next/font` (self-hosted at build time):
- **Archivo** (variable, with the width axis) for headings and UI text. Display sizes use the wide width
  (`font-stretch: 125%`).
- **IBM Plex Mono** for numbers, dates, IDs and coordinates, with tabular figures, so columns line up.

**The type scale has 6 sizes, and only these are used:**

| Token | Size / line height | Font | Use |
|---|---|---|---|
| `text-display` | 64 / 60 px | Archivo 800, width 125% | The one key number on a screen |
| `text-title` | 32 / 36 px | Archivo 700, width 112% | Page title |
| `text-heading` | 20 / 26 px | Archivo 650 | Section heading |
| `text-body` | 16 / 24 px | Archivo 400 | Paragraphs, form inputs |
| `text-small` | 14 / 20 px | Archivo 400/500 | Tables, buttons, filters |
| `text-micro` | 12 / 16 px | Plex Mono 500, uppercase, +0.06em | Labels, column headers, meta |

Numbers anywhere use `font-mono` (Plex Mono, tabular) at the size of their context.

## Space, rules, shape

- **Spacing:** 4px base. Steps used: 4, 8, 12, 16, 24, 32, 48, 64, 96 (Tailwind `1 2 3 4 6 8 12 16 24`).
- **Rules:** sections are separated by a **1px ink rule**, not by boxes. Table rows use 1px `gray-200`.
  Heavy 2px ink rules mark the top of a major region.
- **Shape:** radius 0 everywhere (2px allowed on inputs only). No shadows.
- **Grid:** 12 columns, 24px gutters, 1440px max content width. Content aligns to the grid; numbers align
  right in tables.

## Components

| Component | Rules |
|---|---|
| Button | `primary` = red orange fill, ink label, used **once per view**. `secondary` = 1px ink outline. `ghost` = text only, underline on hover. All 40px tall (32px in tables) |
| Input / Select / Textarea | 1px ink border, snow fill, 2px radius max, ink focus outline. Native `<select>` (keeps forms and accessibility simple) |
| Table | No outer box. 2px ink top rule, 1px gray-200 row rules, mono micro headers, right-aligned numbers |
| StatusMarker | Shape + label (see Status). Never a colored pill |
| CategoryLabel | Square swatch in the category color + ink label |
| Pagination | Mono "Page 2 / 9 · 173 reports", secondary buttons |
| Empty / error state | Ink text with an icon, a 1px rule above. Errors never red |
| Highlight | Yellow behind ink text, for one key phrase |

## Layout rules

1. **One primary CTA per view** (red orange). Everything else is secondary or ghost.
2. **One dominant number per screen** (display size, red orange). It answers "what needs me now?".
3. **No equal-box grids.** Regions differ in size by importance; rules separate them.
4. **Left-aligned, top-to-bottom reading order:** what needs action → trend → patterns → detail.
