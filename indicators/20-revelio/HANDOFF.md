# Revelio — Work Handoff

Working file: `indicators/20-revelio/code/development/revelio.pine` (Pine Script **v6**).
Indicator title: `revelio • development` — keep the dev suffix during development; strip it only at publish.
(`PLAN.md` in this folder is **outdated — ignore it.**)

## Conventions (must follow)
- **Never run any git command without explicit per-command permission.**
- **Never offer/ask to compile** — the user is the only one who compiles. Just make edits.
- DRY; no dead code; no subjective/editorial comments; never convert colour formats without permission.
- **Keep the colour reference table in sync** whenever a colour input is added/removed (update both `colorRowsForSession` counter and `addSessionColorRows` renderer).
- When delegating to a "principal" reviewer: describe the problem/symptoms only, never pre-feed solutions.

## Architecture (orientation)
Four anchors: **RTH, Weekly, New Day Open, Monthly**. Each has parallel `var array` state + a `SessionStyle` built from its inputs.
- `processSession(...)` — accumulates confirmed bars per anchor; on period boundaries calls `finalizePeriod(...)`.
- `finalizePeriod(...)` — builds a `Profile`, and (RTH only) handles **short-session merging** before committing to the ring.
- `renderProfile(Profile, SessionStyle)` — draws histogram (filled polylines), session box, and the level lines+labels at `barstate.islast`. All drawings tracked in `drawnBoxes/Lines/Polylines/Labels` and cleared each render.
- `buildProfile(...)` — bins bars into rows → POC, Value Area (VAH/VAL), alternate POC.
- Merge/normal-span state is **RTH-only**; the 3 continuous anchors pass `mergeDepth=0, combineShorts=false` and share inert `mergeUnused*` buffers.

## DONE
1. **Asset-classification rewrite** (was Codex). Incremental weekend-bar detection; no warmup misclassification; `MERGE`-unrelated. See `if not assetClassificationReady`.
2. **Short Session Merge** (RTH only). Dropdown `rthMergeMode`: `Off / Earliest Into Previous Full / All Into Previous Full / Combine Shorts`. Maps to engine controls `mergeDepth` (0/1/2) + `combineShorts` (bool). Detection = bar-span < `HOLIDAY_MERGE_SPAN_FRACTION` (0.75) × self-calibrated longest session span. "Combine" keeps the full day standalone and merges consecutive shorts into one block; "Into Previous Full" folds shorts into the prior full session. CME clusters are ≤2 shorts, hence depth cap 2.
3. **RTH default breach mode** → `Same-Session Touch` (`LEVEL_BREACH_SAME`).
4. **End-time ballooning fix**: completed RTH profile ends at its real last bar (`periodLastBarRef`), not the post-gap out-of-session bar — fixes early-close/holiday boxes + histograms stretching across the data gap.
5. **Crypto weekend RTH**: 24/7 assets use `RTH_SESSION_ALL_DAYS` (all 7 days); session-based assets keep Mon–Fri. Selected after asset classification.
6. **Histogram**: plain proportional (25% of each box). (An earlier sub-proportional `spanFraction` experiment was removed once #4 turned out to be the real cause.)
7. **Price labels (Task 4)** — ALL sessions now. Per-session inputs on a `*_labels` row: `Price Labels` toggle (default on), bg colour, size (Tiny/Small/Normal/Large/Huge via `toLabelSize`), and a rightward `offset` (bars). Drawn by `drawLevel` only when `style.showLevelLabels and extendRight` (i.e. open/untouched extended levels: POC, VAH, VAL, aPOC). Label placed at `bar_index + offset`, `style_label_left`. Bg colour is in the colour table.
8. **Detailed Label Names (latest Task 2)** — **global** toggle `showLevelLabelNames` (Display group, default on). Recency labels are date-first, e.g. `Today's VAH • 23456.7` / `Grand Daily VAH • 23456.7`; explicit dates are level-first, e.g. `POC Jun 25 • …`. Helpers: `sessionReference(startTime)` → `LABEL_TODAY` / `LABEL_YESTERDAY` / `Mon DD` (NY date, mirrors Gaps' `monthName`); `BRAND_BULLET = "•"`; level-name constants `LABEL_VAH/LABEL_VAL/LABEL_POC/LABEL_ALTERNATE_POC`.
9. **Removed "Always Extend"** (`LEVEL_ALWAYS`) entirely — constant, all 4 extension-mode dropdowns/tooltips, and the `levelEndpoint` branch. Now `extendRight` strictly means "extended AND untouched."

Key signature: `drawLevel(startTime, endTime, price, lineColor, lineWidth, styleName, extendRight, labelColor, levelName, SessionStyle style)`.

## TODO (remaining)
### Task 5 — pre-session / delayed mitigation (NOT started; needs user confirm first)
Restated behaviour to confirm with user before coding:
> Under **Same-Session Touch**, a prior RTH level extended into the next session should be treated as **already mitigated** if price crossed it overnight/pre-market **and** the new RTH session opens on the *other side* of it. The extended line should **end before that RTH session opened**, not continue as open. Inspiration: Deviations' "delayed mitigation after 5".

**Open questions to resolve before implementing:**
- End the line at the RTH **open bar**, or the **last bar before** RTH open?
- "Opened beyond it" measured by the session's **opening price** vs the level, or **any intrabar trade** through it during the open?

Touches `updateMitigation(...)` and/or `levelEndpoint`. RTH mitigation currently gated by `sameSessionOnly and not inWindowNow`.

### Task 6 — active developing RTH value-area styling (NOT started; RTH only first)
Separate style controls for **today's still-developing** RTH VAH/VAL + POC vs completed historical levels. The developing profile is rendered in `renderSession` via the live `buildProfile(...)` path. Idea: detect "is this the live/developing profile" and apply alternate colour/width/style. Add RTH inputs for Active VAH/VAL + Active POC; extend `SessionStyle` (or pass a flag into `renderProfile`/`drawLevel`). Keep colour table in sync.

### New Day merge (NOT started; design with user first)
Extend Short Session Merge to New Day. **Do NOT reuse the span-based detector** — futures early-close holidays trade ~83% of a normal day (too close to full). Needs a **close-time detector** ("did the day stop trading materially before the normal session close?"). The merge *mechanic* (`finalizePeriod`, modes) is already anchor-agnostic; New Day just needs its own detector + inputs + state refs (currently passes inert `mergeUnused*`).

## Known deferred quirk
Continuous anchors (Weekly/New Day/Monthly) finalize via the `shouldStart` path using `time[1]`, so completed continuous profiles end one chart bar early. RTH is unaffected (uses `periodLastBarRef`). See the TODO comment near the end of the file. Low priority (rarely hits a gap).
