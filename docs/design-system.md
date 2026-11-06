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
- **Plus Jakarta Sans** for headings and UI text. Designed by Gumpita Rahayu (Tokotype) for Jakarta's city
  identity ("+Jakarta: City of Collaboration"), it fits an Indonesian civic service and reads warmer and less stiff
  than the earlier grotesque. Open source (SIL OFL 1.1). The scale uses **400 / 600 / 800**. Big sizes get
  tighter tracking: `tracking-display` (−0.035em) on display and page titles, `tracking-heading` (−0.02em) on
  large headings. Body text keeps the default tracking.
- **JetBrains Mono** for numbers, dates, IDs and coordinates, with tabular figures, so columns line up (SIL OFL 1.1).

**The type scale has 6 sizes, and only these are used:**

| Token | Size / line height | Font | Use |
|---|---|---|---|
| `text-display` | 64 / 60 px | Jakarta 800, −0.035em | The one key number on a screen |
| `text-title` | 32 / 36 px | Jakarta 800, −0.035em (page titles) / −0.02em | Page title |
| `text-heading` | 20 / 26 px | Jakarta 600 | Section heading |
| `text-body` | 16 / 24 px | Jakarta 400 | Paragraphs, form inputs |
| `text-small` | 14 / 20 px | Jakarta 400 (600 for emphasis) | Tables, buttons, filters |
| `text-micro` | 12 / 16 px | JetBrains Mono 500, uppercase, +0.06em | Labels, column headers, meta |

Numbers anywhere use `font-mono` (JetBrains Mono, tabular) at the size of their context.

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

---

## v2: bold color blocks (polish pass)

The phase-1 UI was correct but read as a grey wireframe next to the login page. v2 keeps the same tokens
and adds **full color blocks**, used like a Bauhaus/punk poster: a few large flat fields of color, everything
else snowy white. These rules extend (and where they conflict, replace) the ones above.

### Color blocks

- **At most 3–4 colored blocks per screen.** Everything else stays snow.
- A block is a full flat field (no border, no shadow, no gradient) with its own text colors from the table
  below. Never place two blocks of the same color side by side.
- Inside a block the block's color *is* the background, so the usual "red orange only for the CTA / key number"
  rule is satisfied by the block itself: a red-orange block carries the screen's most important number.

**Dashboard assignment, by importance:**

| Block | Color | Why this section |
|---|---|---|
| Needs action (pending count + CTA) | red orange | The single most urgent thing on the screen, so it gets the loudest color and the top-left spot. Its CTA becomes an **ink** button, because a red-orange button would disappear on red orange |
| AI accuracy | yellow punk | Trust in the AI is a "watch this" signal, not an alarm. Yellow reads as attention, and ink on yellow has the highest contrast in the palette (15.34:1) |
| Composition (total reports by category) | cobalt | A calm reference panel: how much of what is coming in. Cobalt is the quietest of the three |

The blocks zig-zag down the page (red left, yellow right, cobalt left), so no two colored blocks touch and the
eye moves down in reading order: act → trust → patterns. The trend chart stays white and sits next to the red
block as the second-strongest region.

**Charts inside blocks.** Category colors don't all survive on a colored field: on cobalt, red orange is
2.02:1 and ink 2.77:1 (below the 3:1 needed for graphics). So the composition rings sit on a **snowy white
disc** set into the cobalt field, which keeps the category colors true. On yellow, the gauge is drawn in ink
(15.34:1), and red orange is never used on yellow (2.75:1).

### Contrast of block pairs (computed, WCAG 2.x)

| Foreground | Background | Ratio | Result | Use |
|---|---|---|---|---|
| ink | red orange | 5.57 | AA | All text in the red block, including the display number |
| snow | ink | 18.07 | AAA | Ink CTA button label inside the red block |
| ink (button fill) | red orange | 5.57 | AA (UI 3:1) | The ink button stands out on red orange |
| gray-700 | red orange | 2.85 | **Fail** | Never: secondary text on red orange stays ink |
| ink | yellow | 15.34 | AAA | All text and the gauge in the yellow block |
| gray-700 | yellow | 7.85 | AAA | Secondary text on yellow |
| red orange | yellow | 2.75 | **Fail** | Never red orange on yellow |
| white | cobalt | 6.77 | AA | Text in the cobalt block |
| snow | cobalt | 6.53 | AA | The rings' snow disc edge, secondary text |
| red orange | cobalt | 2.02 | **Fail** | Category color not drawn directly on cobalt (hence the snow disc) |
| ink | cobalt | 2.77 | **Fail** | Category color not drawn directly on cobalt (hence the snow disc) |
| ink | red orange | 5.57 | AA | Sidebar pending count: ink mono number on a red-orange chip (red-orange text on snow would fail at 12px: 3.24:1) |

### Sidebar

- Light, not black: snow background, a 1px ink rule on the right that runs the **full page height** (the rule
  belongs to the layout column, the content inside is sticky), never cut off.
- Wordmark in Jakarta Sans 800 with display tracking.
- Active item: a yellow punk background with a 3px ink bar on the left. The indicator **slides** between items.
- The Reports item shows the pending count as an ink mono number on a red-orange chip.
- The admin's name and "Log out" are pinned to the bottom.

### Charts

- **Data is drawn in the category colors** (red orange, cobalt, ink). Grey is only for gridlines, axes and
  tracks.
- Composed chart: reports in = cobalt bars at 75% opacity, completed = ink line. At 75% the bars keep 3.89:1
  against snow and the ink line keeps 4.64:1 where it crosses a bar (full cobalt would only give 2.77:1).
- Funnel: solid ink stages, not grey slabs, with snow percentage badges; stage names and counts sit in a
  mono row under the funnel instead of inside the dark stages.
- Sankey: flows the AI got right are drawn in their category color at reduced opacity; corrections at full
  color.
- Composition uses Bklit's concentric ring chart (one ring per category, filled to its share), on light
  tracks with square ends and no glow, like the gauge's flat notches.

### Typography and section rhythm

- Page titles use Jakarta Sans 800 with display tracking (`tracking-display`), like the login headline.
- The dashboard shows today's date (Asia/Jakarta, mono) above its title.
- **Not every section gets the same template.** Mono uppercase eyebrows are kept only where they add
  information (for example "Last 30 days"), not as decoration. Colored blocks are dominant, the trend
  chart comes next, everything else is quieter (a heading, no subtitle unless it explains something).

### Motion

Using the `motion` package Bklit already brings in (no extra animation library). Short (150–400ms) and
**off when the user prefers reduced motion** (`MotionConfig reducedMotion="user"` wraps the admin pages):
count-up on the big numbers on first load, charts draw in once, row hover on tables, the sidebar indicator
slides between items, and page content fades and slides up slightly when it appears.

---

## Mobile (Expo + React Native Paper)

The mobile app uses the same tokens (`Mobile/src/constants/theme.ts`) and a fully overridden Paper MD3 theme
(`Mobile/src/constants/paper-theme.ts`): our palette, `roundness: 0`, every elevation level flat snow (no shadows,
no tinted surfaces), Plus Jakarta Sans and JetBrains Mono for every Paper text variant (through `configureFonts`). **Light mode only**: `app.json`
forces `userInterfaceStyle: "light"`, the navigation and Paper themes are light-only, and the status bar uses dark
icons, so the app looks the same whatever the phone's dark-mode setting is.

- **Fonts:** `@expo-google-fonts/plus-jakarta-sans` and `@expo-google-fonts/jetbrains-mono`, loaded in the root
  layout. Display and title use Jakarta 800 with tight negative tracking (−1.6 / −0.8), heading 600, body 400.
  Jakarta's heaviest weight is 800, so the old `black` key is an alias for 800. Numbers, dates, IDs and
  coordinates use JetBrains Mono.
- **Type scale (6 sizes):** display 44, title 28, heading 20, body 16, small 14, micro 12 (mono, uppercase).
- **Language:** all user-facing text is Bahasa Indonesia, in one file (`Mobile/src/constants/strings.ts`).
  Known backend error messages are translated there too; unknown ones pass through unchanged.
- **Status** uses the same squares as the web (empty / half / filled with check / crossed + struck label).
  Status labels: Menunggu, Diproses, Selesai, Ditolak. Categories: Organik (red orange), Kertas (ink), Plastik
  (cobalt).
- **Dialogs** are Paper's `Dialog`, restyled: square, 2px ink frame, no elevation, sentence-case actions from our
  Button (never uppercase Material text buttons).

### Mobile contrast pairs (computed, WCAG 2.x)

| Foreground | Background | Ratio | Result | Use |
|---|---|---|---|---|
| ink | snow | 18.07 | AAA | All body text |
| gray-600 | snow | 6.36 | AA | Secondary text |
| gray-500 | snow | 4.51 | AA | Input placeholders only |
| ink | red orange | 5.57 | AA | Primary button label, the "Lapor" tab, the organic result block |
| gray-700 | gray-100 | 7.81 | AAA | Disabled button label (stays readable) |
| snow | ink | 18.07 | AAA | Ink button, the paper result block |
| gray-300 | ink | 9.64 | AAA | Secondary text on the ink result block |
| ink | yellow | 15.34 | AAA | Selected filter option, admin note highlight |
| white | cobalt | 6.77 | AA | The plastic result block (all text white, including small mono) |
| gray-300 | cobalt | 3.48 | **Fail** for small text | Not used: secondary text on cobalt stays white |
| ink | gray-100 | 15.27 | AAA | Text on photo placeholders |
| gray-600 | gray-100 | 5.37 | AA | Hints on photo placeholders |

## v3: glass navigation (mobile) and a lighter touch on web

**Mobile: floating glass tab bar** (`Mobile/src/components/ui/tab-bar.tsx`, `glass.tsx`)

- Rounded (height 68, fully round ends), inset 16px from the sides and floating above the safe area. Thin white
  border, soft ink shadow. The screens scroll **behind** it: every scrolling screen inside the tabs pads its
  bottom by the bar's height + gap (`useTabBarSpace()`), so nothing ends up hidden.
- Glass = blur + snow tint (72% over a blur, 92% without), so ink text keeps ≥ 4.5:1 whatever passes behind.
  iOS and web use a real blur. Android uses expo-blur's Dimezis blur (`blurMethod="dimezisBlurViewSdk31Plus"`)
  against a `BlurTargetView` that wraps the tab screens. The bar renders through Paper's `Portal`, so it sits
  outside its own blur target. Android 11 and older fall back to the translucent panel, with no blur.
- States: a **yellow-punk pill slides** behind the active tab (Reanimated, 260ms; it jumps with "reduce
  motion" on). The active label is ink 800, idle labels are gray-700 600, and a pressed tab scales to 0.94.
  "Lapor" stays the anchor as a red-orange pill, but the active state is always the yellow pill, so red orange
  is not the only color in the bar.
- Transitions: switching tabs uses React Navigation's `shift` (fade + slight slide), and stack pushes slide
  from the right. Both become instant with "reduce motion" on.
- Report detail has a **glass header**: transparent, blurred and tinted, with a hairline rule. The photo and
  content scroll underneath it. On Android the header is the translucent panel, because it lives inside the
  blur target.

**Web** (narrow screens only, nothing heavy)

- The top bar on phones is sticky glass: snow at 75% + `backdrop-blur`, with a faint ink rule. Desktop keeps the
  solid sidebar.
- Press feedback: buttons move 1px down on press, nav links scale to 0.98, and table rows deepen their yellow
  hover on press. All of it turns off with `prefers-reduced-motion`.

## Onboarding (mobile, first launch)

Three swipeable full-color slides (`Mobile/src/components/onboarding/`), shown once per install. The flag
`swms.onboarding.seen` lives in secure storage. "Lewati" skips, and it can be replayed later from Akun →
Pengaturan.

- **Color per slide:** 01 ink on yellow punk, 02 white on cobalt, 03 ink on snow (all ≥ 6.7:1). The color
  change while swiping is part of the story.
- **Type:** huge Jakarta Sans 800 (50/52, −2.2 tracking) titles, a mono kicker ("01 · lihat"), and short casual
  body copy in 600.
- **Stickers:** shapes built from plain Views in the palette, each with a 3px ink outline and a hard 5px ink
  "drop", like die-cut stickers. No images, emoji or SVG dependency. Each slide has its own composition:
  01 viewfinder corners pop around a pile of shapes, then "cekrek!" pops on top. 02 the three category stickers
  snap in from the sides and an "AI" badge spins in. 03 the status steps stamp in one by one, then "beres!"
  drops and floats.
- **Motion:** Reanimated springs and delays, replayed each time a slide comes on screen. With "reduce motion"
  on, everything is simply in place.
- **Progress:** three chunky rounded segments, filled up to the current slide. The CTA is a full-width pill
  ("Lanjut"), and the last slide has a big red-orange "Mulai lapor".

## Handling guidance

Each category has a short handling guide: what it is, how to handle it, and where it can go. There's one
mapping per app: `Mobile/src/constants/handling.ts` (Indonesian) and `web/src/lib/handling.ts` (English).
Keep the two in step.

- Mobile shows it on the AI result ("Cara menangani", between the colored result block and the journey) and on
  the report detail (a section right after Kategori). Small text, dash bullets, and a bold "Dibawa ke mana?"
  line.
- Web shows it on the report detail under "AI sorting" as a "Handling" section: the category swatch + name, one
  line on what it is, dash bullets, and "Where it goes". It always follows the report's final category, so a
  correction updates the guidance.

## "Needs review" (AI unsure)

- **Web list:** a small "Needs review" tag (mono micro, ink on yellow punk, 15.3:1) under the status marker.
  The "Flag" filter has a "Needs review" option (`?flag=needs_review`).
- **Web detail:** a yellow-punk note with a 4px ink left rule at the top of "AI sorting". It says the AI was
  not confident and asks the admin to confirm (route) or correct the category.
- **Dashboard:** inside the red-orange "Needs action" block, a compact ink chip with yellow text ("3 need
  review: the AI was unsure →"), linking to the filtered list. It's only shown when the count is above 0.
- **Mobile:** on the AI result, below the confidence, a yellow-punk label: "AI kurang yakin, petugas akan
  cek manual."

## Settings (web + mobile)

- **Web `/settings`** (in the sidebar): three sections, each with its title and a short hint on the left and the
  form on the right (stacked on phones). Profile (name, email), Password (current, new, repeat), and This
  session (signed in as, role tag, when the session ends in WIB, Log out). Success messages are ink on a light
  yellow-punk wash with a 4px ink rule. Errors are ink with an icon, never red.
- **Mobile Akun → Pengaturan**: a pushed screen with the glass header. Sections are separated by a 2px ink rule
  with a heading: Profil, Ganti kata sandi, Panduan ("Lihat panduan lagi" replays the onboarding) and Sesi
  (Keluar, with the confirm dialog). The Akun screen keeps the name and email, then a secondary "Pengaturan"
  button and a text "Keluar".
