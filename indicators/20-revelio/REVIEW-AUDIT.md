# Revelio Review and Audit

Date: 2026-07-26
Scope: `indicators/20-revelio/code/development/revelio.pine`
Purpose: Track verified findings, product decisions, remediation order, and independent validation by Fable.

## Status Key

- **Open** — verified in the current source and not addressed.
- **Resolved / TV pending** — changed locally; TradingView compile, Replay, or visual confirmation is still required.
- **Explained / no defect** — the observed result matches the intended event lifecycle.
- **Product decision** — current behavior is understood, but the desired analytical rule must be chosen before implementation.
- **Maintainability** — not necessarily a current user-facing defect, but it raises regression risk or operating cost.

## Executive Summary

The current development version has three categories of work:

1. Correctness inconsistencies in touch handling, short-session merging, quarterly snapshots, and drawing-budget allocation.
2. Timeframe-dependent profile and Touch Marker behavior that can produce different Monthly levels or markers on 1-minute and 5-minute charts.
3. Performance and maintainability pressure from repeated Focus backfills, full drawing recreation, large state types, and repeated four-level logic.

The stale Touch Marker identity reported on 2026-07-26 has been refactored. Marker events now retain their original touch facts while resolving the profile's current identity and presentation during rendering. TradingView validation remains pending.

## Finding Tracker

| ID | Priority | Status | Area | Summary | Fable Verdict |
| --- | --- | --- | --- | --- | --- |
| REV-001 | P1 | Open | Touch semantics | Exact-price contact counts as a Touch Marker but not as mitigation. | Confirmed, with a contract nuance |
| REV-002 | P1 | Open | Focus budget | Histogram trimming can remove every requested Focus profile because it compares total cost but can only remove Focus selections. | Confirmed |
| REV-003 | P1 | Open | Focus budget | The final newest-first allocator can discard older profiles that Focus selected for proximity. | Confirmed, plus an additional starvation mode |
| REV-004 | P1 | Open | Performance | Focus history can rescan up to 6,000 stored ranges on every last-bar update. | Confirmed |
| REV-005 | P2 | Open | Performance | All tracked drawings are deleted and recreated on every last-bar update. | Confirmed |
| REV-006 | P1 | Open | Session merge | `All Into Previous Full Session` is limited to two consecutive short sessions. | Confirmed |
| REV-007 | P1 | Open | Quarterly | The completion-day histogram publish condition is true every hour at the configured minute. | Confirmed |
| REV-008 | P1 | Resolved / TV pending | Touch Markers | A marker retained the identity `PREV` after its profile was no longer previous. | Refactor confirmed statically; needs runtime evidence |
| REV-009 | — | Explained / no defect | Touch Marker UX | A later-finalized level can join the current right-edge cluster without becoming part of an older marker event. | Explanation confirmed statically; Replay evidence pending |
| REV-010 | P1 | Open | Cross-timeframe consistency | Weekly and Monthly profiles use different source resolutions on 1-minute and 5-minute charts. | Confirmed mechanism; marker delta needs runtime evidence |
| REV-011 | P1 | Open | Cross-timeframe consistency | Touch detection collapses each chart candle's eligible sub-bars into one high/low envelope. | Confirmed; backfill path shares the defect |
| REV-012 | P2 | Product decision | Profile semantics | POC and value area use raw rows while the visible histogram is smoothed afterwards. | Confirmed, with an implementation constraint |
| REV-013 | P2 | Product decision | Sweep semantics | Swept confirmation uses closes from the current chart timeframe. | Confirmed |
| REV-014 | P3 | Product decision | Focus anchor | Manual Focus treats zero and negative prices as unplaced. | Confirmed |
| REV-015 | P2 | Maintainability | Touch state | Profile hit timestamps and the event archive both retain touch state. | Confirmed |
| REV-016 | P2 | Maintainability | Architecture | `Profile`, `SessionStyle`, and four-level POC/VAH/VAL/aPOC paths are large and repetitive. | Confirmed |
| REV-017 | P1 | Maintainability | Validation | There is no automated Pine compile or deterministic behavioral test harness. | Confirmed |

## Detailed Findings

### REV-001 — Exact contact has two meanings

**Evidence**

- `updateMitigation()` requires `breachLow < level` and `breachHigh > level`.
- `processLevelHitAtTime()` uses `hitLow <= level` and `hitHigh >= level`.

**Impact**

A candle that lands exactly on a level can receive a Touch Marker while the same level remains unmitigated. The line lifecycle and the marker disagree about whether contact occurred.

**Expected direction**

Adopt one shared contact predicate and use it for all features whose contract is “price touched this level.” Sweep confirmation remains separate because it intentionally requires two-sided closes and a margin.

**Independent validation**

Test a candle whose high or low equals POC, VAH, or VAL exactly. Record whether the marker appears and whether the level mitigates.

### REV-002 — Focus trimming can remove all Focus profiles

**Evidence**

`trimFocusToBudget()` compares `totalHistogramCost(anchors)` with the global histogram budget. That total includes Weekly, Monthly, Quarterly, and ordinary daily costs, but the loop can only deselect Focus profiles from the daily anchors.

**Impact**

If non-Focus histogram cost already consumes the budget, the loop can remove every requested RTH and Globex Focus profile without resolving the overflow.

**Expected direction**

Calculate the capacity available to Focus explicitly and assign product priority before trimming. Requested Focus profiles should not silently lose to unrelated historical histograms.

**Independent validation**

Enable dense Weekly, Monthly, and Quarterly histograms, then request five or more Focus profiles. Confirm whether all requested Focus profiles disappear despite being valid selections.

### REV-003 — Newest-first allocation can override Focus proximity

**Evidence**

`allocateProfileBudget()` chooses the newest remaining completed profile across anchors. It does not treat a Focus-selected profile as a priority class.

**Impact**

An older profile selected because it is closest to the Focus anchor can lose to newer ordinary profiles. This contradicts Focus's analytical purpose.

**Expected direction**

Use an explicit priority order:

1. Live profiles.
2. Requested Focus profiles ordered by distance.
3. Ordinary completed profiles ordered by recency.

Lines and histograms should be budgeted independently.

**Independent validation**

Place a manual Focus anchor near an old RTH or Globex profile while several newer Weekly, Monthly, Quarterly, and daily profiles are enabled. Apply drawing pressure and verify which profile disappears first.

### REV-004 — Focus history is repeatedly rescanned

**Evidence**

- `MAX_FOCUS_HIT_RANGES` is 6,000.
- `backfillFocusedLevelHitTrace()` iterates retained ranges.
- It is called inside `if barstate.islast`, including realtime updates.

**Impact**

The same historical ranges can be reconsidered repeatedly while the current candle forms. Cost grows with retained ranges and selected Focus levels.

**Expected direction**

Backfill when the Focus selection changes, then advance incrementally for new or updated ranges. Preserve instant live markers.

**Independent validation**

Compare execution behavior with Focus Touch Markers off and on, using the maximum retained history and several surfaced profiles.

### REV-005 — Full drawing recreation on the last bar

**Evidence**

`clearDrawings()` deletes every tracked box, line, polyline, and label at the beginning of each `barstate.islast` render.

**Impact**

Realtime updates rebuild the full visible scene, increasing object churn and making performance sensitive to dense profiles, labels, gaps, and reminders.

**Expected direction**

First optimize repeated calculations such as Focus backfill. Then measure whether stable drawing IDs and targeted updates are warranted for the highest-cost drawing groups.

### REV-006 — “All” short-session merge is capped at two

**Evidence**

`mergeDepth()` returns:

- `0` for Off.
- `1` for Earliest.
- `2` for every other enabled mode.

**Impact**

`All Into Previous Full Session` does not mean all consecutive short sessions when the run contains more than two.

**Expected direction**

Make the displayed option and actual fold policy agree. `All` should continue through the complete consecutive short-session run.

**Independent validation**

Replay a holiday sequence or synthetic sequence containing three consecutive qualifying short sessions and inspect the resulting profile boundaries.

### REV-007 — Quarterly snapshot condition repeats hourly

**Evidence**

`histogramPublishWindow` checks the completion day and `minute(time) == QUARTERLY_SNAPSHOT_MINUTE` without constraining the hour or detecting a one-time transition.

**Impact**

The completion-day snapshot qualifies every hour at that minute. This creates unnecessary remote `Profile` transfers and obscures the intended publication event.

**Expected direction**

Use one explicit completion transition or one exact scheduled timestamp.

### REV-008 — Stale `PREV` marker identity

**Status**

Resolved locally; TradingView validation pending.

**Previous behavior**

A touch recorded when a profile was `PREV RTH POC` continued to display that identity after a newer RTH profile finalized.

**Current implementation**

`LevelHitEvent` retains the touch time, candle, price, source profile, and Focus origin. `LevelHitPresentation` is rebuilt from current profile state during rendering.

**Expected behavior**

- The touch location and `Hit HH:MM NY` remain immutable.
- `PREV RTH POC` becomes a dated RTH POC after the next RTH profile finalizes.
- Bar Replay changes the identity only after replay crosses that finalization.
- Globex, Weekly, Monthly, Quarterly, Include Hidden, and Focus-added sources follow the same rule.

### REV-009 — Later confluence does not rewrite an older touch

**Screenshots**

- `Screenshot 2026-07-26 at 18.45.03.png`
- `Screenshot 2026-07-26 at 18.50.49.png`

**Observed behavior**

The right-edge label shows `PREV RTH POC | PREV GLOBEX VA-L`, while the marker tooltip shows only `PREV GLOBEX VAL`.

**Event timeline**

1. At 09:30, `PREV GLOBEX VAL` existed and received the marker.
2. The RTH profile had not finalized, so the later `PREV RTH POC` did not yet exist as a completed level.
3. After RTH finalized, its POC aligned with the existing Globex VAL.
4. The right-edge label recomputed the current price cluster and displayed both levels.
5. The historical marker continued to describe only the level that existed and was touched at 09:30.

**Conclusion**

This is correct behavior, not a missing-hit defect. Adding the later-created RTH POC to the 09:30 marker would incorrectly imply that it existed and was touched at that time.

The apparent ambiguity comes from the dot now occupying the same price column as a cluster that became shared later. The current right-edge label already communicates present-day confluence, while the marker tooltip preserves event-time truth.

**Independent validation**

Use Bar Replay around the RTH finalization. Confirm that the 09:30 marker initially belongs only to Globex VAL, then confirm that the right-edge cluster gains RTH POC after finalization without rewriting the marker's source membership.

### REV-010 — Monthly and Weekly profiles are chart-timeframe dependent

**Screenshots**

- `Screenshot 2026-07-26 at 18.47.09.png`
- `Screenshot 2026-07-26 at 18.47.16.png`

**Observed behavior**

A large green Monthly Touch Marker is present on the 5-minute chart and absent on the 1-minute chart.

**Evidence**

With Intrabar Resolution set to Auto:

- A 5-minute chart requests 1-minute samples.
- A 1-minute chart requests 1-second samples.

The same samples build RTH, Globex, Weekly, and Monthly profiles. Different sample resolutions can change volume distribution, POC, VAH, VAL, aPOC, and therefore which price the Monthly marker is testing.

**Impact**

The Monthly profile and its marker are not guaranteed to agree across chart timeframes.

**Independent validation**

On the same symbol and date, expose prices in the Monthly level labels and compare exact POC, VAH, VAL, and aPOC values on 1-minute and 5-minute charts with identical settings.

### REV-011 — Touch detection uses one envelope per chart candle

**Evidence**

`priceWindowRange()` reduces all eligible lower-timeframe samples inside the chart candle to one maximum high and one minimum low. `processLevelHitAtTime()` then treats every level between those extremes as touched.

**Impact**

On a 5-minute chart, a gap between component 1-minute bars can place a level inside the combined five-minute envelope even if no component bar traded that price. On a 1-minute chart, the same gap can sit between candles, producing no marker.

This is separate from REV-010: even if the Monthly level price is identical, the contact result can still differ.

**Expected direction**

Evaluate contact against individual lower-timeframe ranges rather than a single collapsed envelope, while retaining the first qualifying timestamp for instant and historical markers.

**Independent validation**

Inspect the component bars around the green marker. Determine whether one sub-bar actually contains the Monthly price or whether the price was only crossed by a gap between sub-bars.

### REV-012 — Raw analytical levels with a smoothed visible histogram

**Evidence**

`buildProfile()` calculates POC, VAH, VAL, and aPOC from raw row volumes. `prepareProfileHistogram()` subsequently replaces the displayed row volumes with smoothed values.

**Impact**

The largest visible histogram row can differ from the POC line. This may be intentional analytical smoothing, but it is not visually self-evident.

**Decision required**

Choose one product rule:

1. Raw histogram and raw analytical levels.
2. Smoothed histogram and smoothed analytical levels.
3. Smoothed presentation with raw analytical levels, explicitly documented as intentional.

### REV-013 — Sweep confirmation depends on chart timeframe

**Evidence**

`sweepStep()` uses the current chart's `close`. The sweep state advances only in confirmed chart-bar processing.

**Impact**

The same level can become swept at different times on 1-minute, 5-minute, and hourly charts.

**Decision required**

Choose whether Swept is a chart-timeframe interpretation or a timeframe-invariant market event using a fixed confirmation resolution.

### REV-014 — Manual Focus excludes zero and negative prices

**Evidence**

`focusManualPricePlaced` and `renderFocusAnchor()` require a price greater than zero.

**Impact**

Manual Focus cannot be placed at zero or on negative-valued instruments and synthetic series.

**Decision required**

Determine whether those instruments are in product scope. Supporting an exact zero requires a separate placed/unplaced state because zero currently acts as the unset value.

### REV-015 — Touch state remains in two stores

**Evidence**

Each `Profile` retains four hit timestamps while `levelHitEvents` retains the marker archive.

**Current improvement**

Presentation metadata is no longer duplicated in each event, resolving the stale-identity defect.

**Remaining risk**

Future lifecycle changes must still keep profile-level hit state, event retention, daily deduplication, and Focus backfill synchronized.

### REV-016 — Large state structures and repeated level paths

**Evidence**

- `Profile` contains calculated profile data plus breach, sweep, and hit state for four levels.
- `SessionStyle` contains anchor behavior, four level styles, histogram styles, label styles, and sweep behavior.
- Detection, Focus collection, rendering, reminders, and hit timestamps repeatedly branch across POC, VAH, VAL, and aPOC.

**Impact**

Adding a level field or changing lifecycle rules requires coordinated edits in several paths. Constructor arity and branch drift remain high-risk.

**Expected direction**

Refactor incrementally after correctness work:

1. Centralize level access and state mutation helpers.
2. Introduce smaller cohesive style/state types where Pine constraints allow.
3. Remove repeated four-level branches only when each step can be compiled and visually compared.

### REV-017 — Validation is manual

**Evidence**

There is no local Pine compiler or deterministic chart harness in the repository.

**Impact**

Balanced delimiters, input references, and constructor arity can be checked locally, but session boundaries, Replay state, realtime timing, drawing budgets, and cross-timeframe behavior require TradingView.

**Expected direction**

Maintain:

- A repository static checker for structural hygiene.
- A repeatable TradingView compile and Replay matrix.
- Screenshot baselines for dense Focus, shared levels, Value Gaps, and session finalization.

## Recommended Remediation Order

### Gate 1 — Validate the current marker identity refactor

Compile the development source in TradingView and test:

- RTH and Globex session rollover.
- Weekly, Monthly, and Quarterly rollover.
- Bar Replay before and after finalization.
- Include Hidden.
- Focus live and backfilled markers.
- Same-candle merged markers.

### Batch 1 — Small correctness fixes

Address REV-001, REV-006, and REV-007 together. They are isolated rules with clear expected behavior.

### Batch 2 — Timeframe consistency

Address REV-010 and REV-011 as one design review:

- Choose a stable source resolution for Weekly and Monthly profiles if cross-timeframe identity is required.
- Evaluate contacts per lower-timeframe range rather than per chart-candle envelope.

### Batch 3 — Focus allocator

Address REV-002 and REV-003 together. Establish drawing priority before changing either trimming or final allocation.

### Batch 4 — Performance

Address REV-004 first, measure, then decide how much of REV-005 is necessary.

### Batch 5 — Product semantics

Resolve REV-012, REV-013, and REV-014 with explicit product decisions before implementation.

### Batch 6 — Maintainability and validation

Address REV-015 through REV-017 incrementally after the behavioral contracts are stable.

## Fable Independent Review Protocol

Fable should make no indicator changes during the validation pass.

For every finding:

1. Mark it **Confirmed**, **Rejected**, or **Needs runtime evidence**.
2. Cite the current function or state path independently.
3. Describe the user-visible consequence.
4. Record whether the evidence is static, TradingView compile, Replay, realtime, or screenshot-based.
5. Note any regression risk in RTH, Globex, Weekly, Monthly, Quarterly, Include Hidden, Focus, and Value Gaps.

For REV-009, validate the event timeline using Bar Replay and the two named screenshots. For REV-010 and REV-011, use the 1-minute and 5-minute screenshots and reproduce with identical symbol, date, chart settings, and indicator inputs.

## Fable Independent Validation — 2026-07-26

Static review of `code/development/revelio.pine` (3,462 lines). No indicator changes were made. Line numbers reference the current development source. Evidence type is static code reading unless noted.

### Verdicts and citations

**REV-001 — Confirmed, with a contract nuance.** `updateMitigation()` (lines 2724–2730) requires strictly `breachLow < level and breachHigh > level`; `processLevelHitAtTime()` (line 2780) uses inclusive `hitLow <= level and hitHigh >= level`. A bar whose extreme lands exactly on the level marks a touch but never mitigates. Nuance on the proposed fix: the strict two-sided predicate reads as "traded through the level," which is a legitimately different contract from "wick contacted the level." Before unifying on one shared predicate, decide whether mitigation is intended to mean penetration. If it is, the correct remediation is documenting the two contracts, not merging them.

**REV-002 — Confirmed.** `trimFocusToBudget()` (lines 2405–2427) loops while `totalHistogramCost(anchors) > budget` (line 2409), where `totalHistogramCost()` (line 2396) sums every anchor including Weekly/Monthly/Quarterly. The loop can only flip `focusSelections` on `restrictToFocus` anchors (line 2426) and exits via `farthestAnchorIndex < 0` (line 2423) once none remain — so it terminates, but it can deselect every Focus profile without resolving the overflow. The comment at lines 2403–2404 confirms the trimming intent; the budget comparison scope is what is wrong. Agree with the proposed direction: compute the capacity actually available to Focus and trim against that.

**REV-003 — Confirmed, plus an additional starvation mode.** `allocateProfileBudget()` (lines 2429–2464) walks strictly newest-first with no Focus priority class. Additional detail beyond the finding: when the newest candidate's cost exceeds the remaining budget, the loop sets `exhausted := true` immediately (lines 2456–2457) instead of skipping to cheaper candidates — one expensive newest profile therefore blocks every older profile across all anchors, including Focus selections. Mitigating detail: disallowed profiles cost 0 (line 2455), so non-selected profiles in Focus anchors do not consume budget. The proposed priority order (live → Focus-by-distance → recency) is correct; the fix should also decide skip-vs-stop behavior on an unaffordable candidate.

**REV-004 — Confirmed.** `MAX_FOCUS_HIT_RANGES = 6000` (line 173). `backfillFocusedLevelHitTrace()` (lines 2909–2931) iterates all retained ranges and additionally rebuilds `markedDateKeys` from the full event array on every call (lines 2912–2916). It is called at line 3399 inside the `barstate.islast` block that begins at line 3335, so every realtime tick pays the full rescan. Agree with the incremental direction; the `markedDateKeys` rebuild should be made incremental in the same pass.

**REV-005 — Confirmed.** `clearDrawings()` (line 1563) is called at line 3336, the first statement of the `barstate.islast` render block. Agree with the ordering: fix REV-004 first, measure, then decide how much stable-ID rendering is worth its complexity. Full-recreate is a simple invariant; partial updates in Pine are a known source of orphaned-drawing bugs.

**REV-006 — Confirmed.** `mergeDepth()` (lines 991–992) returns `2` for both `MERGE_ALL` and `MERGE_COMBINE`, and `finalizePeriod()` gates folding on `mergeState.foldCount < mergeDepth` (line 2593). A run of three qualifying short sessions leaves the third unmerged despite the `All` label, and the Globex tooltip (line 449) promises "fold consecutive shorts." Agree: `MERGE_ALL` should return an effectively unbounded depth (or the fold gate should not cap by count for that mode).

**REV-007 — Confirmed.** Line 2711: `histogramPublishWindow = sameCompletionDay and minute(time) == QUARTERLY_SNAPSHOT_MINUTE` — no hour constraint and no transition detection. The adjacent `weeklyHistogramSnapshot` (line 2712) already constrains day + hour + minute and is the pattern to copy. Note `histogramSnapshot` (line 2713) also ORs `barstate.islast`, so the last-bar path is unaffected; the waste is on historical completion-day bars.

**REV-008 — Refactor confirmed statically; needs runtime evidence.** `LevelHitEvent` (line 775) retains only touch facts; `LevelHitPresentation` (line 783) is rebuilt during rendering via `registerProfileLevelHitPresentations()` (lines 2483–2491) into the `levelHitPresentations` map (line 3078), and `renderLevelHitCircles()` resolves presentation by key at render time (lines 2192–2210). The architecture makes stale identity structurally impossible for retained profiles. Gate 1 TradingView validation remains required.

**REV-009 — Explanation confirmed statically; Replay evidence pending.** Events are inserted only when the level exists at hit time (`processLevelHitAtTime()`, line 2779+), and later-finalized levels get their own keys — nothing rewrites an archived event's source membership. The audit's timeline is consistent with the code. Agree this is correct behavior, not a defect. Bar Replay confirmation per the protocol is still worthwhile.

**REV-010 — Mechanism confirmed; marker delta needs runtime evidence.** `autoIntrabarTimeframe()` (lines 975–977): a 1-minute chart requests `"1S"`, a 5-minute chart requests `"1"`. All session and calendar profiles are built from the same intrabar stream, so distribution-derived levels can differ across chart timeframes. That the specific Monthly marker discrepancy in the screenshots is caused by this (rather than REV-011) requires the runtime comparison described in the finding. Note the Quarterly path is already timeframe-invariant — it uses a fixed `QUARTERLY_INTRABAR_TIMEFRAME` via `request.security_lower_tf` (line 2692) — which is the existing in-file precedent for the proposed fix.

**REV-011 — Confirmed; backfill path shares the defect.** `priceWindowRange()` (lines 1471–1485) folds all eligible sub-bars into one max-high/min-low envelope, and `processLevelHitAtTime()` (line 2780) treats any level inside it as touched. Additional detail: `recordLevelHitRange()` (lines 2740–2748) also merges same-bar ranges into a single envelope before retention, so Focus backfill inherits identical envelope semantics — a per-sub-bar contact fix must cover both the live path and the retained-range format, or backfilled markers will disagree with live ones.

**REV-012 — Confirmed, with an implementation constraint.** `buildProfile()` (line 1209+) derives POC/VAH/VAL/aPOC from raw rows; `prepareProfileHistogram()` (lines 1182–1207) then overwrites `profile.rowVolumes` in place with smoothed values (line 1205). Constraint for the product decision: after preparation the raw distribution is gone, so option 1 (raw histogram) or any later raw-based recomputation requires retaining the raw rows, not just skipping the smoothing call at render time.

**REV-013 — Confirmed.** `sweepStep()` (lines 2942–2945) reads the chart-timeframe `close` directly. Chart-timeframe dependence follows. This is a legitimate product decision; note that making Swept timeframe-invariant would need a fixed confirmation resolution and would interact with REV-010's resolution choice — decide them together.

**REV-014 — Confirmed.** Line 425: `focusManualPricePlaced = not na(focusManualPrice) and focusManualPrice > 0`. Zero doubles as the unset sentinel. Agree with the framing: this only matters if negative-valued or zero-crossing instruments are in scope; if they are, a separate placed flag is required.

**REV-015 — Confirmed.** Per-profile hit timestamps are mutated in `setFocusHitLevelTime()` (lines 2896–2903) and in the level-hit trace paths, while `levelHitEvents` (varip, line 3074) holds the archive. Two stores, one lifecycle. Agree this is a synchronization risk rather than a current defect.

**REV-016 — Confirmed.** Representative four-level branch repetition: swept-state updates (lines 2956–2974), hit-presentation registration (lines 2486–2490), breach checks (lines 2724–2730), denote/extension flags (lines 2796–2803). Agree with the incremental approach and with sequencing it after correctness work — Pine's lack of first-class abstractions makes each consolidation step compile-risky.

**REV-017 — Confirmed.** No compile or behavioral harness exists in the repository; the structural checks in the validation record below are the current ceiling for local verification.

### Assessment of the remediation order

The batch order is sound. Two adjustments recommended:

1. In Batch 1, REV-001 needs the touch-vs-mitigation contract decision (see verdict) before code changes — otherwise it risks silently redefining mitigation.
2. Batch 2 and Batch 5 overlap on resolution policy: REV-010's fixed-resolution choice and REV-013's sweep-confirmation resolution should be decided in the same design review, with the Quarterly fixed-timeframe path (line 2692) as the precedent.
3. Any REV-011 fix must update `LevelHitRange` retention as well as live detection, or live and backfilled Focus markers will diverge.

### Regression-risk notes

- REV-002/REV-003 fixes touch the shared allocator; verify Weekly/Monthly/Quarterly histogram survival under pressure, not just Focus.
- REV-006 fix changes profile boundaries retroactively for any history containing 3+ short-session runs; existing screenshots become stale baselines.
- REV-011 fix changes which markers exist at all; every Touch Marker screenshot baseline must be recaptured.

## Current Validation Record

Local structural checks after the marker identity refactor:

- 234 inputs found and referenced.
- Delimiters balanced.
- Updated constructors and call sites have matching arity.
- No conflict markers.
- No trailing whitespace.
- Development title preserved.

Still required:

- TradingView compilation.
- Bar Replay across session and calendar boundaries.
- Live-tick marker timing.
- Cross-timeframe visual comparison.
- Drawing-budget stress testing.
