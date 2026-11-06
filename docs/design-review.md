# Design review: Phase 3 polish (web + mobile)

Reviewed on 2026-11-06 against the screen captures made with `tools/screenshots/` (mock API and fixture data only):
web admin at 1440px and 390px, and the resident app at 390px (Expo web build). Before:
`docs/screenshots/polish-before/` (web `<page>-<width>.png`, mobile in `mobile/`). After, same file names:
`docs/screenshots/polish-final/`.

Scope: visual changes only. No behavior, data, route or API changes. Web fixes are on `design/polish-web`, mobile
fixes on `design/polish-mobile`.

## Top 10, ranked by impact on a first-time reviewer

| # | Problem | Where | Why it matters | Fix |
|---|---------|-------|----------------|-----|
| 1 | At 390px the Reports and Users tables are cut off at the right edge. Status, date and the Activate/Deactivate actions sit off-screen with no hint that the table scrolls. The report thumbnails collapse into 2px slivers. | Web `/reports`, `/users` at 390 | A reviewer opening the admin on a phone sees broken tables with no status column. This is the most visible defect in the set. | Below `md`, hide the secondary columns (email, AI confidence, location, created, role, report count, joined) so name, category, status and action fit. Pin the thumbnail to a fixed size (`max-w-none shrink-0`). |
| 2 | At 390px the admin header stacks logo, nav, name, email and "Log out" in about 270px before any page content. | Web, all admin pages at 390 | The first screen of every page shows chrome instead of the page, which reads like a desktop sidebar that was never adapted. | Below `md`: put the logo and the account row on one line (name + log out, email hidden) and put the nav under them. |
| 3 | At 390px the sign-in form starts below the fold, after the slogan and three facts. | Web `/login` at 390 | The only action on the page is invisible on first load. | Hide the facts row below `sm` and tighten the hero padding so the form appears in the first viewport. |
| 4 | "Reports in vs. completed" draws its completed line as a jagged zigzag that drops to zero between bars. The axis labels are 10px and the "4" tick overlaps the first bar. | Web dashboard | It is the largest chart on the page, and it looks noisy and unfinished. The zigzag suggests volatility the data doesn't have. | Draw the completed line as a step that changes on the bar edges, so each day's count sits flat across its bar. (A monotone curve was tried first and still rippled.) |
| 5 | Framed category swatches read as empty outlines when the fill matches the block: Plastic (cobalt) on the cobalt "What kind of waste" block, and Paper (ink) on the ink login hero and the mobile wordmark. | Web dashboard legend, web login facts, mobile login/register hero | Plastic and Paper look like "no data" or an unchecked box. Already known, still true. | Framed swatch = 1px white border, a 2px snow gap, then the solid fill. The fill now sits inside a frame instead of filling it, so it reads as a solid chip on any background. |
| 6 | The primary buttons on mobile sign-in and register ("Masuk", "Buat akun") are gray until the form is filled. | Mobile login, register | On first view the main call to action looks broken or missing, and the brand's red-orange CTA never appears. | Disabled primary = pale red-orange tint with ink label (still readable, clearly not pressable). Other variants unchanged. |
| 7 | Dashboard title scale is inconsistent. The trend chart's title is set in the 32px display face, which outranks "Needs action now", the page's real headline. The other sections use 20px. | Web dashboard | Hierarchy points the eye at the second-most-important thing, and the mixed faces look assembled from parts. | One section-title style (20px semibold) for every dashboard section. The trend section keeps its 2px rule as the only "strong" marker. |
| 8 | The funnel percentages are 12px mono chips on heavy black slabs, which is where the eye lands, but they're the least legible text in the section. | Web dashboard "How far reports get" | The black slabs plus tiny white tags look like a default charting template. | Drop the chip and set the percentage in 20px snow mono directly on the slab. |
| 9 | "Report not found" is one small line of text on an empty page, with the only way out being a small back link. | Web `/reports/<unknown id>` | Empty/error states are part of the review. This one looks unfinished and smaller than body headings elsewhere. | Title-sized heading, short explanation and a real secondary button "Go to all reports". |
| 10 | The mobile report detail doesn't say what was reported until you scroll past the whole history. The category sits fifth, under the timeline. The tab bar's "Lapor" label also sits 3px lower than its neighbours (larger icon). | Mobile report detail; tab bar | Web leads with "Paper waste", but mobile hides the same fact, so the two apps tell the story in a different order. The misaligned tab label is visible on every screen. | Move the category + AI confidence directly under the status. Give all tab icons the same 28px box so labels share a baseline. |

### Also noticed (smaller, fixed if cheap)

- **"← Back to reports" is indented 12px** from the content edge (ghost-button padding wins over `px-0` because the
  classes are concatenated, not merged). Fixed with `cn()`.
- **The login fact "97.7%" is stale.** The served model is Option B, with 98.29% test accuracy (ml/README.md). A
  reviewer cross-checking will notice. Copy updated to 98.3%.
- **Web timeline times wrap "WIB" onto a second line** at 1440. Kept on one line.
- ~~"Reset filters" is light gray and looks disabled.~~ On inspection it *is* disabled when no filter is set,
  and it turns ink as soon as one is. Correct as is, so not changed.

## Result after the fixes

Recaptured into `docs/screenshots/polish-final/` (web `<page>-<width>.png`, mobile in `mobile/`, same names as
`polish-before/`) and re-reviewed.

| # | Status | Notes (before → after file) |
|---|--------|-------|
| 1 | Fixed | `reports-390.png`, `users-390.png`: thumbnail, reporter, category and status fit at 390. Users shows name, status and the action. The detail page still has every field. |
| 2 | Fixed | Every `*-390.png`: logo + "Dewi Lestari · Log out" on one row, nav underneath. Content starts at about 130px instead of 270px. |
| 3 | Fixed | `login-390.png`: the Sign in button is at about 705px, inside the 844px first screen. The facts show from `sm` up. |
| 4 | Mostly fixed | `dashboard-1440.png`, `dashboard-390.png`: the step line reads cleanly against the bars. The y-axis tick labels are still small and sit tight against the first bar. They're positioned inside the shared chart library, so I left it alone instead of changing a shared component the day before the deadline. |
| 5 | Fixed, with a caveat | `dashboard-1440.png` (legend), `login-1440.png` (facts), `mobile/01-masuk.png`, `mobile/02-daftar.png`: framed swatches are now a white border, a 2px snow gap, then the fill. Plastic on cobalt reads as a blue chip in a white frame. A gap in the *block* color (cobalt) would match the fill and change nothing, so the gap is snow. Paper on the ink hero is clearly a three-part mark now but still the weakest of the three, because its core is the background color. |
| 6 | Fixed | `mobile/01-masuk.png`, `mobile/02-daftar.png`: "Masuk" / "Buat akun" are pale red-orange with an ink label before the form is filled, so the main action is recognisable but clearly not active yet. |
| 7 | Fixed | `dashboard-1440.png`: every section title is 20px semibold. "Needs action now" and its 7 are now the clear first read. |
| 8 | Fixed | `dashboard-1440.png`: 100% / 83% / 65% in 20px snow mono on the slabs, no chips. |
| 9 | Fixed | `report-not-found-1440.png`, `report-not-found-390.png`: title-sized heading, explanation, and a "Go to all reports" button. |
| 10 | Fixed | `mobile/05-*`, `06-*`, `07-*`: KATEGORI + AI confidence sit right under the status. The tab labels share a baseline on every screen. |
| also | Fixed | Back link aligned with the content edge (`report-detail-*`). Timeline times on one line (`report-detail-closed-1440.png`). Login fact reads 98.3% (served Option B model). |

### New things noticed on the re-review (not fixed)

- **Login at 390:** the dark hero has a large empty band between the wordmark and the headline (`justify-between` on a
  tall block). It's harmless now that the form is on screen, but a tighter hero would look more deliberate.
- **Mobile detail header** ("Detail laporan") is the plain native stack title, while the tab screens use the large
  display title. Matching it means changing the stack header options, which behaves differently on iOS and Android.
  Worth doing on a device, not blind in a web preview.
- **Users at 390** hides role. The single admin row still says "You", but on a phone you can't tell other admins from
  residents. That's acceptable for the take-home, and a small role tag next to the name would fix it later.
