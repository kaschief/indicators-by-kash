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

1. Correctness inconsistencies in touch handling, short-session merging, and drawing-budget allocation.
2. Timeframe-dependent profile and Touch Marker behavior that can produce different Monthly levels or markers on 1-minute and 5-minute charts.
3. Performance and maintainability pressure from repeated Focus backfills, full drawing recreation, large state types, and repeated four-level logic.

The stale Touch Marker identity reported on 2026-07-26 has been refactored. Marker events now retain their original touch facts while resolving the profile's current identity and presentation during rendering. TradingView validation remains pending.

## Finding Tracker

| ID | Priority | Status | Area | Summary | Fable Verdict |
| --- | --- | --- | --- | --- | --- |
| REV-001 | — | Explained / no defect | Touch semantics | Exact contact marks a touch; mitigation requires price to trade through the level. | Distinct contracts confirmed |
| REV-002 | P1 | Deferred / implementation rejected | Focus budget | Histogram trimming can remove every requested Focus profile because it compares total cost but can only remove Focus selections. | Confirmed |
| REV-003 | P1 | Deferred / implementation rejected | Focus budget | The final newest-first allocator can discard older profiles that Focus selected for proximity. | Confirmed, plus an additional starvation mode |
| REV-004 | P1 | Resolved / TV pending | Performance | Focus history can rescan up to 6,000 stored ranges on every last-bar update. | Confirmed |
| REV-005 | P2 | Open | Performance | All tracked drawings are deleted and recreated on every last-bar update. | Confirmed |
| REV-006 | P1 | Resolved / TV pending | Session merge | `All Into Previous Full Session` is limited to two consecutive short sessions. | Confirmed |
| REV-007 | — | Explained / no defect | Quarterly | Completion-day repetition preserves sparse histogram snapshots across higher chart timeframes. | Runtime evidence rejected the proposed fix |
| REV-008 | P1 | Resolved / TV pending | Touch Markers | A marker retained the identity `PREV` after its profile was no longer previous. | Refactor confirmed statically; needs runtime evidence |
| REV-009 | — | Explained / no defect | Touch Marker UX | A later-finalized level can join the current right-edge cluster without becoming part of an older marker event. | Explanation confirmed statically; Replay evidence pending |
| REV-010 | P1 | Resolved / TV pending | Cross-timeframe consistency | Profiles diverged across chart timeframes: HD resolution differed, and the chart-bar fallback fed timeframe-sized samples. | Both mechanisms confirmed; auto-TF fix plus five-minute fallback buckets applied |
| REV-011 | P1 | Resolved / TV pending | Cross-timeframe consistency | Touch detection collapsed each chart candle's eligible sub-bars into one high/low envelope. | Fixed via per-sub-bar contact sets, tick-territory realtime detection, range-chart support |
| REV-012 | P2 | Product decision | Profile semantics | POC and value area use raw rows while the visible histogram is smoothed afterwards. | Confirmed, with an implementation constraint |
| REV-013 | P2 | Product decision | Sweep semantics | Swept confirmation uses closes from the current chart timeframe. | Confirmed |
| REV-014 | P3 | Product decision | Focus anchor | Manual Focus treats zero and negative prices as unplaced. | Confirmed |
| REV-015 | P2 | Maintainability | Touch state | Profile hit timestamps and the event archive both retain touch state. | Confirmed |
| REV-016 | P2 | Maintainability | Architecture | `Profile`, `SessionStyle`, and four-level POC/VAH/VAL/aPOC paths are large and repetitive. | Confirmed |
| REV-017 | P1 | Maintainability | Validation | There is no automated Pine compile or deterministic behavioral test harness. | Confirmed |
| REV-018 | P1 | Resolved / TV passed | Performance | Regular Touch Markers search the retained event archive for every eligible level on every historical bar. | Runtime speed improvement confirmed |

## Detailed Findings

### REV-001 — Exact contact has two meanings

**Status**

Explained / no defect. Touch Markers and mitigation intentionally represent different events.

**Evidence**

- `updateMitigation()` requires `breachLow < level` and `breachHigh > level`.
- `processLevelHitAtTime()` uses `hitLow <= level` and `hitHigh >= level`.

**Impact**

A candle that lands exactly on a level can receive a Touch Marker while the same level remains unmitigated. The line lifecycle and the marker disagree about whether contact occurred.

**Expected direction**

Preserve the current contracts:

- Touch Marker — exact contact counts.
- Mitigation — price must trade through the level.
- Swept — confirmed closes must clear both sides with the configured margin.

**Independent validation**

Test a candle whose high or low equals POC, VAH, or VAL exactly. Record whether the marker appears and whether the level mitigates.

### REV-002 — Focus trimming can remove all Focus profiles

**Status**

Deferred. The proposed allocator was rejected and the original behavior was restored.

**Evidence**

The audited `trimFocusToBudget()` implementation compared `totalHistogramCost(anchors)` with the global histogram budget. That total included Weekly, Monthly, Quarterly, and ordinary daily costs, but the loop could only deselect Focus profiles from the daily anchors.

**Impact**

If non-Focus histogram cost already consumes the budget, the loop can remove every requested RTH and Globex Focus profile without resolving the overflow.

**Expected direction**

Calculate the capacity available to Focus explicitly and assign product priority before trimming. Requested Focus profiles should not silently lose to unrelated historical histograms.

**Implementation result**

The proposal caused runtime timeouts and missing profiles. It was removed completely. Revisit only if the original behavior becomes a visible product problem.

**Independent validation**

Enable dense Weekly, Monthly, and Quarterly histograms, then request five or more Focus profiles. Confirm whether all requested Focus profiles disappear despite being valid selections.

### REV-003 — Newest-first allocation can override Focus proximity

**Status**

Deferred. The proposed allocator was rejected and the original behavior was restored.

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

**Implementation result**

The proposal caused repeated 500 ms runtime errors. A bounded-search follow-up then reduced the chart to one visible profile. The proposal and its timeout guards were removed completely.

**Independent validation**

Place a manual Focus anchor near an old RTH or Globex profile while several newer Weekly, Monthly, Quarterly, and daily profiles are enabled. Apply drawing pressure and verify which profile disappears first.

### REV-004 — Focus history is repeatedly rescanned

**Status**

Resolved locally; TradingView loading and realtime validation pending.

**Evidence**

- `MAX_FOCUS_HIT_RANGES` is 6,000.
- `backfillFocusedLevelHitTrace()` iterates retained ranges.
- It is called inside `if barstate.islast`, including realtime updates.

**Impact**

The same historical ranges can be reconsidered repeatedly while the current candle forms. Cost grows with retained ranges and selected Focus levels.

**Runtime observation — 2026-07-26**

The user reported noticeably slower indicator loading with the current Touch Marker and Focus changes. REV-004 is now the first performance investigation after REV-006. Compare `Off`, `On`, and `On + Focus` before attributing the slowdown to this path.

After the REV-004 change, the overall version still felt slow with Intraday Focus disabled. Focus backfill is therefore not the primary source of that loading delay. The next comparison must disable Touch Markers themselves to separate the regular marker engine from general drawing recreation.

**Expected direction**

Backfill when the Focus selection changes, then advance incrementally for new or updated ranges. Preserve instant live markers.

**Current implementation**

The selected Focus level keys are cached in `focusedHitBackfillKey`. Historical ranges are rescanned only when that selected level set changes or the presentation window reopens. New touches still use the existing live update path on every eligible realtime update.

**Independent validation**

Compare execution behavior with Focus Touch Markers off and on, using the maximum retained history and several surfaced profiles.

### REV-005 — Full drawing recreation on the last bar

**Evidence**

`clearDrawings()` deletes every tracked box, line, polyline, and label at the beginning of each `barstate.islast` render.

**Impact**

Realtime updates rebuild the full visible scene, increasing object churn and making performance sensitive to dense profiles, labels, gaps, and reminders.

**Expected direction**

First optimize repeated calculations such as Focus backfill. Then measure whether stable drawing IDs and targeted updates are warranted for the highest-cost drawing groups.

### REV-018 — Regular Touch Marker archive searches slow loading

**Status**

Resolved. TradingView loading improvement confirmed by the user.

**Runtime evidence**

Loading returns to the older version's speed when Touch Markers are `Off`, even with Intraday Focus already disabled. The remaining slowdown is therefore inside the regular Touch Marker path rather than Focus backfill or general drawing recreation.

**Code evidence**

`processLevelHitAtTime()` called `levelMarkedTimeOnDate()` for every eligible level on every historical chart bar. That function scans backward through the retained marker archive. Cost grows with chart history, retained profiles, visible levels, and recorded marker events.

**Current implementation**

Historical processing now uses each profile level's existing latest-hit timestamp for same-day deduplication. Archive searches remain enabled for realtime updates, where Pine rollback requires the `varip` event archive, and for out-of-order Focus backfill.

**Independent validation**

Compare loading with Touch Markers `Off` and `On`. Then verify historical marker count and placement, realtime instant markers, same-day deduplication, and Focus backfill.

### REV-006 — “All” short-session merge is capped at two

**Status**

Resolved locally; TradingView validation pending.

**Evidence**

`mergeDepth()` returns:

- `0` for Off.
- `1` for Earliest.
- `2` for every other enabled mode.

**Impact**

`All Into Previous Full Session` does not mean all consecutive short sessions when the run contains more than two.

A plausible resilience case is two holiday-adjusted traded sessions followed by an unexpected shortened session, such as a presidential national day of mourning. Fully closed days do not count because they create no session profile.

**Expected direction**

Make the displayed option and actual fold policy agree. `All` should continue through the complete consecutive short-session run.

**Current implementation**

The anchor process policy now carries an explicit `mergeAllShorts` rule. `All Into Previous Full Session` bypasses the finite fold counter, while `Off`, `Earliest`, and `Combine Shorts` keep their existing depth behavior.

**Independent validation**

Replay a holiday sequence or synthetic sequence containing three consecutive qualifying short sessions and inspect the resulting profile boundaries.

### REV-007 — Quarterly snapshot condition repeats hourly

**Status**

Explained / no defect. The proposed one-time snapshot was reverted after TradingView testing.

**Evidence**

`histogramPublishWindow` checks the completion day and `minute(time) == QUARTERLY_SNAPSHOT_MINUTE` without constraining the hour or detecting a one-time transition.

**Impact**

The completion-day snapshot qualifies every hour at that minute. This creates unnecessary remote `Profile` transfers and obscures the intended publication event.

**Expected direction**

Preserve the repeated completion-day snapshots. Document their higher-timeframe aggregation purpose.

**Runtime validation — 2026-07-26**

Replacing the repeated snapshots with one scheduled snapshot removed older Quarterly histogram shapes on a 4-hour BTCUSD chart. The baseline retained them. `fixedQuarterlyContext()` returns a sparse `Profile` object through a 15-minute `request.security(..., gaps=barmerge.gaps_on)` call; repeating at the configured minute allows the object to survive aggregation into higher chart-timeframe bars.

The original publication condition was restored. No Quarterly behavior change remains.

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

### REV-010 — Profile levels are chart-timeframe dependent

**Screenshots**

- `Screenshot 2026-07-26 at 18.47.09.png`
- `Screenshot 2026-07-26 at 18.47.16.png`

**Observed behavior**

A large green Monthly Touch Marker is present on the 5-minute chart and absent on the 1-minute chart.

The ES1! December 31 RTH comparison provides direct level-price evidence:

- 5-minute RTH VAH: approximately 6,937.50.
- 1-minute RTH VAH: approximately 6,947.50.
- The RTH VAL also differs, while the RTH POC appears aligned.

Screenshot: `Screenshot 2026-07-26 at 20.20.06.png`.

**Evidence**

With Intrabar Resolution set to Auto:

- A 5-minute chart requests 1-minute samples.
- A 1-minute chart requests 1-second samples.

The same samples build RTH, Globex, Weekly, and Monthly profiles. Different sample resolutions can change volume distribution, POC, VAH, VAL, aPOC, and therefore which price a marker is testing.

**Impact**

Profile levels and their markers are not guaranteed to agree across chart timeframes. This is now visibly confirmed for the December 31 RTH value area.

**Product decision**

Completed RTH, Globex, Weekly, and Monthly profiles must agree across nearby intraday chart timeframes. Test the existing `1` HD-resolution option on matching 1-minute and 5-minute charts first. If the levels align, use a common 1-minute profile source automatically on 1–15 minute charts.

**Second mechanism — chart-bar fallback divergence (2026-07-26)**

After `autoIntrabarTimeframe()` was changed so 1-minute through 15-minute charts all request `1` HD data, the mismatch persisted (`Screenshot 2026-07-26 at 20.35.59.png`, ES1! Bar Replay near 2026-01-02: December 31 RTH VAH ≈ 6,938 on 5-minute vs ≈ 6,947 on 1-minute).

Root cause: profile construction has a second, chart-timeframe-dependent input. When `request.security_lower_tf` returns empty arrays — Bar Replay, and history beyond the intrabar availability window — `prepareBarVolumeSamples()` falls back to the chart bar's high/low/volume. A 1-minute chart then feeds one-minute samples while a 5-minute chart feeds five-minute envelopes. Same underlying trade data, different sample granularity, different POC/VAH/VAL. The auto-resolution change only equalized the zone where HD data exists; the replay screenshot sits entirely in the fallback zone.

**Fix applied — Resolved / TV pending**

Sub-5-minute chart bars in the fallback path are now folded into epoch-aligned five-minute buckets (`FALLBACK_PARITY_BUCKET_MS`) before entering profile state, so a 1-minute chart's fallback emits exactly the samples a 5-minute chart's bars produce:

- A pending bucket (`fallbackBucket*` state) accumulates confirmed fallback bars; the sample is emitted on the bar whose close lands on the five-minute boundary.
- A stale pending bucket — HD data resuming mid-bucket, or a missing boundary bar — is flushed ahead of that bar's own samples.
- `buildDevelopingProfile()` includes the pending bucket, so live profiles do not lose the current partial bucket.
- Aggregation activates only when the chart timeframe divides five minutes evenly (1S–1m and 5m itself trivially); 2/3/4-minute charts keep per-bar fallback because five-minute buckets cannot be reproduced from their bars.
- All profile period boundaries (09:30, 16:00, 18:00, day/week/month starts) are five-minute-aligned, so buckets never straddle a session boundary.

Known residual limits: 15-minute charts still fall back to 15-minute bars in the fallback zone (parity target is the 1m/5m pair); exchanges whose sessions open off the five-minute grid would have shifted buckets; Touch Marker contact timing can still differ per REV-011.

**Independent validation**

Repeat the ES1! Bar Replay comparison from `Screenshot 2026-07-26 at 20.35.59.png` on matching 1-minute and 5-minute charts and confirm the December 31 RTH VAH/VAL agree. Then compare live-chart levels inside the HD window to confirm no regression where intrabar data exists.

### REV-011 — Touch detection uses one envelope per chart candle

**Status**

Resolved locally (2026-07-26); TradingView validation pending.

**Original evidence**

`priceWindowRange()` reduced all eligible lower-timeframe samples inside the chart candle to one maximum high and one minimum low. `processLevelHitAtTime()` then treated every level between those extremes as touched.

**Impact**

On a 5-minute chart, a gap between component 1-minute bars could place a level inside the combined five-minute envelope even if no component bar traded that price. On a 1-minute chart, the same gap sat between candles, producing no marker. This was the remaining source of markers such as a Monthly level hit shown on 5-minute but absent on 1-minute, independent of the REV-010 level-price divergence.

**Fix applied — contact-set detection**

The single per-bar envelope was replaced with a per-bar contact set (`levelHitContactHighs/Lows/Times`): the price ranges that actually traded, each with its own timestamp.

- Historical bars with HD data: one contact range per eligible lower-timeframe sub-bar. A level between sub-bars is a hit on no chart timeframe, and the recorded hit time is the sub-bar's own time — sub-minute accuracy on the marker tooltip, identical across 1-minute and 5-minute charts.
- Realtime: each tick contributes only the newly covered territory since the previous tick (`liveCovered*` varip state). Detection stays tick-instant, and first-touch-of-day is driven by the shared tape rather than the chart's forming-bar envelope, so a level jumped by a gap inside a forming 5-minute bar is no longer marked. A bar that opened before the detection window still counts only the in-window tick price, as before.
- Fallback (no HD data) and non-time charts: the chart bar is the single contact range. Range bars are contiguous by construction, so this is accurate there.
- Focus history now records the contact set (`recordLevelHitRanges`), so backfilled Focus markers agree with live detection. `MAX_FOCUS_HIT_RANGES` is derived from the scan window in minutes to keep full backfill coverage at sub-bar granularity. Realtime forming-bar entries remain a per-bar envelope so the archive stays bounded while the bar forms.
- Range charts: `levelHitTimeframeAllowed` now passes `chart.is_range` explicitly, and the REV-010 fallback bucketing is gated to `chart.is_standard` so range bars are never folded into time buckets.

Residual limits: in the fallback zone contact granularity equals the chart bar, so 1-minute remains more precise than 5-minute there (accuracy prioritized over parity); realtime forming-bar entries in the Focus archive are envelopes until the bar completes.

**Independent validation**

Reproduce the Monthly marker case on matching 1-minute and 5-minute charts: within HD coverage the marker must appear on both or neither, with the same `Hit HH:MM NY`. Watch a live session and confirm markers appear on the touching tick. Confirm markers appear on a range chart with identical settings.

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

## Current Remediation Sequence

REV numbers are permanent finding IDs, not step numbers. Remaining work now proceeds numerically:

1. **REV-002 and REV-003 — Deferred.** The attempted allocator change was rejected and fully reverted.
2. **REV-005 — Deferred.** Skip unless loading becomes slow again after the completed marker optimizations.
3. **REV-010 — Next after confirming the rollback.** Decide and implement stable Weekly and Monthly source resolution.
4. **REV-011.** Evaluate touches per actual lower-timeframe range.
5. **REV-012.** Decide raw-versus-smoothed histogram semantics.
6. **REV-013.** Decide chart-based versus fixed-resolution Swept confirmation.
7. **REV-014.** Decide support for zero and negative Manual Focus prices.
8. **REV-015.** Reduce Touch Marker state synchronization risk.
9. **REV-016.** Consolidate repeated four-level paths incrementally.
10. **REV-017.** Add repeatable structural validation.

Completed, closed, deferred, or awaiting only TradingView confirmation: REV-001, REV-002, REV-003, REV-004, REV-006, REV-007, REV-008, REV-009, and REV-018.

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

**REV-001 — Distinct contracts confirmed; no defect.** `updateMitigation()` requires price to trade through the level, while `processLevelHitAtTime()` treats exact contact as a touch. Touch Marker, mitigation, and Swept represent different lifecycle events, so their predicates should not be unified.

**REV-002 — Confirmed.** `trimFocusToBudget()` (lines 2405–2427) loops while `totalHistogramCost(anchors) > budget` (line 2409), where `totalHistogramCost()` (line 2396) sums every anchor including Weekly/Monthly/Quarterly. The loop can only flip `focusSelections` on `restrictToFocus` anchors (line 2426) and exits via `farthestAnchorIndex < 0` (line 2423) once none remain — so it terminates, but it can deselect every Focus profile without resolving the overflow. The comment at lines 2403–2404 confirms the trimming intent; the budget comparison scope is what is wrong. Agree with the proposed direction: compute the capacity actually available to Focus and trim against that.

**REV-003 — Confirmed, plus an additional starvation mode.** `allocateProfileBudget()` (lines 2429–2464) walks strictly newest-first with no Focus priority class. Additional detail beyond the finding: when the newest candidate's cost exceeds the remaining budget, the loop sets `exhausted := true` immediately (lines 2456–2457) instead of skipping to cheaper candidates — one expensive newest profile therefore blocks every older profile across all anchors, including Focus selections. Mitigating detail: disallowed profiles cost 0 (line 2455), so non-selected profiles in Focus anchors do not consume budget. The proposed priority order (live → Focus-by-distance → recency) is correct; the fix should also decide skip-vs-stop behavior on an unaffordable candidate.

**REV-004 — Baseline defect confirmed; resolved locally.** `focusedHitBackfillKey` now records the selected Focus level set. The retained range scan and `markedDateKeys` rebuild run only when that set changes or the presentation window reopens. The existing live trace path handles subsequent eligible updates without rescanning history. TradingView performance and marker validation remain pending.

**REV-005 — Confirmed.** `clearDrawings()` (line 1563) is called at line 3336, the first statement of the `barstate.islast` render block. Agree with the ordering: fix REV-004 first, measure, then decide how much stable-ID rendering is worth its complexity. Full-recreate is a simple invariant; partial updates in Pine are a known source of orphaned-drawing bugs.

**REV-006 — Baseline defect confirmed; resolved locally.** `AnchorProcessPolicy` now carries `mergeAllShorts` independently from the finite `mergeDepth`. `finalizePeriod()` bypasses the fold counter only for `MERGE_ALL`; `Off`, `Earliest`, and `Combine Shorts` retain their previous limits. TradingView regression testing remains pending.

**REV-007 — Static mechanism confirmed; remediation rejected by runtime evidence.** Line 2712 intentionally repeats the completion-day snapshot at the configured minute. A one-time scheduled replacement removed historical Quarterly histogram shapes on a 4-hour BTCUSD chart because the sparse 15-minute `Profile` object did not survive higher-timeframe `request.security` aggregation. The repeated condition is required compatibility behavior, not removable waste.

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

1. REV-001 is closed with the existing distinction preserved: exact contact creates a Touch Marker, while mitigation requires trading through the level.
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
