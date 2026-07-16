# Legilimens — Development Handoff

Last updated: 2026-07-16
Primary and only implementation: `code/development/legilimens.pine`
Authoritative title: `INDICATOR_TITLE = "legilimens • development"`

The former parallel `legilimens-gpt.pine` build no longer exists. This file is the single source of truth. Do not rename the title; remove the ` • development` suffix only at final commit/publish per repository rules.

Use `../20-revelio/code/development/revelio.pine` as the reference for the repository's established visual language: sessions, labels, collision handling, value-area context, input organization, and the color reference table.

## 1. Purpose

A Pine Script v6 delta-by-price volume profile for intraday charts. Its job is to show, as granularly as Pine permits, the NET buying/selling pressure at each price row — clean and readable, not noisy — and to surface the unusually strong rows as actionable levels.

The desired visual is an ATAS/DeepCharts-style footprint delta profile, not a generic heatmap. Heatmaps and decorative per-profile summaries were deliberately removed as noise and must not return without an explicit new request.

## 2. Principal review — 2026-07-16

A full principal-level review of `legilimens.pine` was completed. Verdict: the architecture is sound. Shared `processAnchor()` boundary engine, parameterized profile builder, explicit object budgeting, temporary open-bar inclusion with clean pop-back, and bounded sample compaction all hold up. No critical defects were found.

Findings and their resolutions (all applied 2026-07-16, pending compile):

- **FIXED — O(queue²) strength recomputation.** The render grant loop now precomputes each queued profile's drawable-row count once into `queueDrawableCounts` before allocation; `reservedForLater` sums those cached counts instead of re-running `computeRowStrengths()` per later profile per pass.
- **FIXED — `recentChartTimes()` rebuilt every tick.** The 5,000-element chart-time scale is now cached in `var cachedChartTimes` and rebuilt only when `bar_index` changes (`chartTimesBuiltAtBar`), not on every realtime update.
- **FIXED — Peak-first outlier ranking.** Adjacent same-side qualifying rows, including rows separated by one non-qualifying row, form one peak before ranking. Same-profile peaks within `Merge Overlaps` distance consolidate next. The resulting peaks are ranked by aggregate absolute delta separately for buying and selling, so one visible zone cannot consume multiple ranks and ranks cannot skip after merging.

Verified clean during review: no double-counting between confirmed-bar appends and developing-profile open-bar appends (mutually exclusive on `barstate.isconfirmed`); box-budget accounting matches boxes actually drawn; zero-net-delta rows cannot pass any row filter; division guards on `maxAbsRowDelta` / `maxRowVolume`; the color reference table stays in sync with all color inputs.

## 3. Trader features — net-delta clarity

Implemented 2026-07-16 (pending compile and visual acceptance):

1. **Row Smoothing / Grouping** (`📊 Delta Profile`). `Smoothing` renders each delta bar as the centered average of net delta across N rows on each side (0 = raw, max 10) via `smoothProfileDeltas()`. Row volumes, occupancy, the volume layer, POC, and the value area stay raw. `Row Size` (1–20) groups tradable ticks into one price row independently of Smoothing, e.g. 4 on NQ gives one clean row per point.
2. **ΔPOC** (`🧭 Profile Levels`). The price row holding the largest absolute NET delta per profile — where one side pressed hardest; the "delta level" entries are built from. POC marks the most traded price, ΔPOC the most one-sided price. Own enable/line color/width/style/label color (`profileDeltaPocPrice()`); shares the POC text size; labels as `RTH ΔPOC` etc.; label rank 400 (between POC 300 and outliers 1000+).
3. **Ranked zones** (`🚩 Outlier Levels`). Adjacent same-side outlier rows become aggregate zones before ranking. Optional translucent fills show each selected zone's complete price span, while its anchor line marks the strongest constituent row.

Remaining roadmap (not implemented; requires explicit user selection):

4. **Alerts on ranked zones.** `alertcondition` when price re-enters a ranked zone. Zero visual cost.
5. **Delta-conviction intensity.** Optionally scale row color opacity by |Δ|/volume so a genuinely one-sided row pops over a high-volume churn row, without adding drawing objects.

## 4. Non-negotiable product direction

1. One profile source at a time: Fixed Range, RTH, or Globex. Object budgets are never divided among inactive modes.
2. Maximum useful price-row granularity is the priority.
3. No heatmaps unless the user explicitly reverses that decision.
4. No per-profile delta summary unless it supports a specific, defensible trading decision.
5. Delta bars and actionable outlier levels are the central visual.
6. Volume backdrop is optional and stays anchored on the profile's left edge facing right.
7. Delta bars alone may attach to either profile edge and face either direction.
8. Current/developing RTH or Globex profile is optional (`Developing`).
9. Fixed Range must clearly show both the selected time span and its calculated high/low zone.
10. Outlier and context labels sit in a stable column beyond current price (`Offset`), never colliding with candles.
11. Labels use the brand bullet `•` before an optional price, never `@`.
12. Naming stays consistent with Revelio (`RTH VAH`, `Globex POC`, `Fixed VAL`). Delta-outlier labels are NOT prefixed with the anchor name.
13. Independent text-size controls exist for outliers, VAH/VAL, POC, Fixed Start/End, and Fixed High/Low.
14. Every color input and its associated width is represented in the on-chart reference table.
15. Preserve the three-line section dividers; ordinary prose comments only where the code cannot explain the reason itself.

## 5. Delta model and honest interpretation

Pine exposes no true historical bid/ask aggressor volume. Delta is estimated from `request.security_lower_tf()` sub-bars:

- `close > open`: full sub-bar volume is buy volume (positive delta).
- `close < open`: full sub-bar volume is sell volume (negative delta).
- Doji: compare the sub-bar close with the previous tape close.
- Still tied: carry the persistent last tape direction (`lastTickDirection`).
- If lower-timeframe data is unavailable for a chart bar, fall back to the chart bar with the same rules.

`previousTapeClose` and `lastTickDirection` persist across chart bars. This mirrors TradingView Volume Delta's classification but is a candle-direction proxy, not exchange order flow. Each sample's volume and signed delta are distributed evenly across every profile row spanned by its high/low; volume and delta share the same row span and divisor, so they stay in lockstep.

A value like `Δ +227` means ~227 more units of classified positive volume than negative in that row. Magnitude varies with intrabar resolution, range, row height, lower-timeframe history depth, and feed. Never present it as confirmed market-buys at the ask.

## 6. Profile modes and boundaries

### Fixed Range

- Two `input.time(..., confirm=true)` points; clicks accepted in either order via `min()`/`max()`.
- Exactly one profile; `Visible Profiles` and `Developing` do not affect it.
- Four-sided outline at raw range high/low and selected start/end, with `Fixed Start`, `Fixed End`, `Range High`, `Range Low` labels drawn directly on their anchors (not through the right-edge queue).
- Open chart bar is included temporarily during rendering without persisting twice.
- TradingView has no Pine API to reopen point confirmation. Practical reset: select a drawing and drag the anchors, edit the timestamps in Settings, or remove/re-add the indicator (documented in `TOOLTIP_FIXED_RANGE`).

### RTH

- `09:30–16:00` New York; weekday session string `0930-1600:23456` in `America/New_York` (avoids the historical 10:30 drift bug).
- First bar after the session finalizes using the last actual in-session bar time, so early closes don't stretch across the post-session gap.
- 24/7-classified assets run the same window all seven days (`RTH_SESSION_ALL_DAYS`).

### Globex / continuous

- Futures-style assets: 18:00 New York trading-day boundary via a shifted calendar day.
- Crypto/24-7 assets: UTC calendar-day boundary.
- Boundary engine shared with RTH through `processAnchor()`; never duplicate anchor-specific calculation functions.

### Asset classification

- Crypto is classified 24/7 immediately; otherwise a true weekend bar (Saturday, or Sunday before 18:00 NY) proves 24/7; a full observed week without one proves session-based. Early deep-history bars may be processed before classification settles.

### Developing profiles

- `Developing` applies to RTH and Globex only. `Visible Profiles` is the total visible count; a live profile consumes one slot.
- Open-bar samples are added temporarily for display and removed immediately, so they're never double-counted on confirmation.

## 7. Granularity and memory management

- `Granularity (max rows)`: 50–500, default 400.
- If the price span fits, rows snap to exact tradable-tick multiples — `Row Size` (default 1) sets how many ticks each row groups; otherwise the span divides into the requested number of even bins.
- Raw sample arrays compact after 10,000 samples into 3,000 temporary price bins, preserving total row volume and delta while staying well below Pine's collection limit.
- Very old bars without lower-timeframe history fall back to chart-bar samples (coarser).

Relevant functions: `compactSamples()`, `compactIfNeeded()`, `appendSamples()`, `buildDeltaProfile()`, `buildDevelopingDeltaProfile()`, `downsampleProfile()`.

## 8. Delta bars and profile width

- One box per occupied row passing the selected row filter; length proportional to |net delta| relative to the profile's max absolute row delta; sign encoded by buy/sell colors; outlier rows use the stronger outlier colors.
- `Attach` selects the left/start or right/end edge; `Face` selects growth direction. Neither moves the volume backdrop.
- Width is computed on a recent chart-bar time scale (not raw elapsed time), so overnight/weekend gaps don't collapse or clip fixed-range profiles. Beyond the available scale it extrapolates by chart timeframe. Preserve: `recentChartTimes()`, `nearestChartTimeIndex()`, `profileBaselineTime()`, `profileOuterTime()`.

## 9. Row visibility modes

`Show` filters rendering without changing calculation: All Delta, Buying, Selling, All Outliers, Buying Outliers, or Selling Outliers. This is separate from `Ranked Zones`, which controls which outlier-zone lines and labels extend to the right.

## 10. Outlier definition and behavior

Multiple-of-average model (not z-score/sigma):

```text
row strength = abs(row net delta) / mean(abs(row net delta)) across occupied rows
```

Current default threshold is **1.5** (`Outlier`, range 0.5–20.0). At 4.0, a row's absolute net delta must be at least four times the same profile's average occupied-row absolute delta — never "four times every other row" or four standard deviations.

Details:

- Fewer than three occupied rows produce no strength values.
- `Ranked Zones` can show both sides, buying, selling, or remain off. `Zones per Side` applies per profile with separate buying and selling allowances; strongest aggregate zones are chosen first.
- Adjacent same-side qualifying rows form one peak before ranking. A single non-qualifying row may sit inside the same peak so one visually continuous zone does not split into several ranks.
- `Merge Overlaps` then consolidates nearby same-side peaks within the same profile using the selected distance, with a minimum of one tick. Buying and selling remain separate at this calculation stage.
- Zones are ranked by aggregate absolute delta per profile and side. Labels are sequential (`Buy Zone 1`, `Buy Zone 2`, `Sell Zone 1`, `Sell Zone 2`) with no post-merge gaps.
- Multi-row labels use `ΣΔ` for aggregate zone delta and `max ×` for the strongest constituent row, e.g. `Sell Zone 1 • ΣΔ −1.2K • max 5.3× • 3 rows`.
- The first-ranked buying and selling zone in each profile gets the `Top Zone` line width. Its line is anchored at the strongest constituent row, while its rank describes the full zone.
- `Fill` optionally shades the complete price span from the zone's first contributing row through its last. The fill uses a highly transparent version of the configured buying or selling color and extends right with the anchor line.
- Every outlier line extends right so labels remain visually connected to their levels.
- Budget-induced downsampling happens before outlier strength calculation and peak detection: under a tight multi-profile budget, peaks describe rendered rows, not hidden full-resolution rows.

## 11. Volume backdrop, value area, and context

- **Backdrop**: optional filled polyline silhouette of total row volume; always left-attached, right-facing; one neutral color or inside/outside value-area colors (splits into at most three contiguous polylines, shape intact, no delta boxes consumed).
- **Value area**: default 70%; POC = max-volume row; expands from POC through the heavier adjacent row. VAH/VAL and POC each have independent enable, line color, width, style, label color, and label size. Context labels include the mode name (`RTH VAH`, `Fixed POC`) and share the right-edge label column/collision system.
- **Session appearance**: fill and border are independently optional per visible profile. If either is enabled, each visible profile reserves one box from the delta-row budget before bars are allocated.

## 12. Labels and collision control

All right-edge outlier/VAH/VAL/POC labels are buffered then flushed:

- `Offset` places them at `bar_index + offset` in one stable column.
- `Merge Overlaps` is the single clutter control. It first combines nearby same-side outlier values, then clusters remaining outlier, value-area, POC and ΔPOC labels and extended lines using the same distance. The highest-priority member supplies the surviving line style and label anchor.
- Merged names join with ` | `; highest-ranked member supplies anchor price and colors; largest requested text size wins; optional prices append with ` • `; shared configurable background.
- Rank order: outliers > POC > VAH/VAL.

## 13. Object budgets and newest-first policy

Declared maximums: 500 boxes, 500 lines, 500 labels, 100 polylines. Every render pass on the last bar deletes all prior drawings and rebuilds.

Allocation, newest profile first:

1. Reserve one box per visible profile when either Session Fill or Session Border is enabled.
2. Count rows passing the current delta-row filter.
3. Preserve a minimum allocation (`FAIR_SHARE_MIN_ROWS = 25`) for profiles later in the queue.
4. Grant the newest profile the remaining budget.
5. Downsample cleanly when drawable rows exceed the grant; the `MIN_DRAWABLE_ROWS = 5` floor guards against budget starvation, not against profiles that legitimately have few rows.
6. Never rely on TradingView evicting older boxes.

With one visible profile, delta can consume essentially the full box budget. The volume layer consumes polylines; profile and outlier levels consume lines. `Zones per Side` limits extended outlier lines to at most five buying and five selling zones per profile.

## 14. Inputs and visual organization

Keep the current group order:

1. `⚙️ Profile`
2. `🎯 Fixed Range`
3. `📊 Delta Profile`
4. `🖼️ Profile Appearance`
5. `🧭 Profile Levels`
6. `🚩 Outlier Levels`
7. `🏷️ Price Labels`
8. `🎨 Reference`

Related controls share inline rows: enable/color/width/style, orientation pairs, label-size pairs, buy/sell color pairs.

## 15. Color and width reference table

Optional, top right. 21 rows: 17 direct color inputs (including ΔPOC line/label) plus 4 derived zone line/fill colors, each with setting name, `R:n G:n B:n`, transparency, and associated width or profile percentage. Any color add/remove/rename must update the table in the same change. Keep the helper-based row construction. Never convert color formats without explicit permission.

## 16. Structural code style

Preserve the three-line `// ═══ … ═══` section headers — they are navigation, not verbosity. Prose comments only for non-obvious reasons, trade-offs, platform constraints, or ordering requirements. Follow root `CLAUDE.md`: parameterize shared behavior, remove unused controls completely, no subjective commentary, keep the color table synchronized.

## 17. Verification state

Completed:

- Full principal-level code review (section 2) with budget-accounting, double-counting, and filter-correctness verification; all review fixes applied.
- Implemented smoothing/grouping, ΔPOC, and ranked-zone fills (section 3) with the color table kept in sync.
- Static structure/string sanity review; input grouping, function structure, object cleanup, and title verified.

Still required (no local Pine compiler exists in this repository; the user always compiles — never offer to):

- Compilation and visual testing in TradingView on live/replay data.
- Fixed-range reset workflow confirmation in the user's TradingView client.
- Lower-timeframe history depth varies by account/symbol/range — verify long-range fallback coarseness is acceptable.
- 24/7 classification on the user's actual continuous contracts.
- Performance on a long Fixed Range with 500 rows and several thousand lower-timeframe samples (note the two MEDIUM perf findings in section 2).

## 18. Recommended TradingView acceptance pass

Use NQ on a five-minute chart first, then at least one crypto symbol.

1. Compile under Pine v6 with no object-count or timeframe warnings.
2. RTH: profile starts 09:30 NY, ends 16:00, never appears to begin at 10:30.
3. Toggle `Developing`; `Visible Profiles` remains the total visible count.
4. Globex: futures boundary 18:00 NY; crypto rolls 00:00 UTC.
5. Fixed Range: click points in both orders; identical selection.
6. Extend Fixed Range across an overnight gap and weekend; no collapse or clipping.
7. All four Attach/Face combinations move only delta bars; backdrop stays left/right-facing.
8. Each row filter toggles independently of flags.
9. Adjacent same-side rows form one zone; resulting zones have sequential side ranks, aggregate `ΣΔ`, row count, correct strongest width, and an optional fill spanning the full price area.
10. Buy/sell outliers at nearby prices never merge.
11. Every outlier and VAH/VAL/POC tag connects to a right-extending line.
12. Increasing `Offset` moves all right-edge tags as one column.
13. Forced label collisions merge with ` | ` and no underlying line loss.
14. Each independent label-size control works.
15. Color reference table matches every input color, transparency, and width.
16. `Visible Profiles = 5`, session boxes on, 500 rows, all delta rows: controlled coarsening, no missing arbitrary boxes.
17. Developing profile across bar confirmation and session boundary: no double-counting or stale drawings.

## 19. Next-step priorities

1. Compile and visually test the current build (the user always compiles — never offer to). New surfaces to exercise: Smoothing at 0, 2 and 5; Row Size at 1 and 4 on NQ; ΔPOC on each mode; and strongest-width behavior with multiple visible profiles.
2. Fix any TradingView compiler/runtime issue with the smallest DRY change.
3. Implement remaining roadmap items (section 3, items 4–5) only as the user selects them; alerts first.
4. Preserve product scope: no heatmaps, no generic summaries, no duplicate anchor implementations, no scattered toggles.
