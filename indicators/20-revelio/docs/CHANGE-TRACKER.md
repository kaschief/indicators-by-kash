# Revelio Change Tracker

Updated: 2026-08-02
Progress: Group A validated and approved · Group B first-hit context published, validated, and approved · Group C `/6` compiled with qualitative production-performance parity · Group D code complete and awaiting TradingView validation · Group E `/8` published, visually validated, and approved · Group F `/10` published, validated, and approved · Group G Quarterly histogram transport validated and approved
Committed baseline: `962eb334` — approved

Canonical library versions, publication instructions, source fingerprints, and copy-ready notes: [`TRADINGVIEW-LIBRARY-VERSION-REGISTRY.md`](../../../TRADINGVIEW-LIBRARY-VERSION-REGISTRY.md). This tracker does not maintain a second current-version ledger.

Status flow: `Not Started` → `In Progress` → `Code Complete` → `TradingView Validated`

## Group G — Quarterly Histogram Cross-Timeframe Transport

- [x] **BUG-07 — Preserve completed Quarterly histogram rows above 15m**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Principal Review: `Approved — prior transfer blocker resolved; no P0–P3 findings in final source review`
  - User evidence: NQ1! on 4h shows completed Quarterly VAH, POC, and VAL without the histogram silhouette in both published and development instances; the user reports the same symptom on multiple chart timeframes.
  - The 15m Quarterly context returns scalar level fields continuously but returns the `Profile` carrying histogram rows only on sparse completion-day, weekly, or last-bar snapshots.
  - On chart timeframes above 15m, `request.security()` returns one 15m intrabar per chart bar, so an exact sparse snapshot bar can be skipped while the scalar profile still arrives.
  - The host consequently stores a valid remote Quarterly profile with 250 zero-filled rows and `maxHistogramVolume == 0`; the former empty-array guard never copies the real rows, and rendering rejects the silhouette while still drawing the levels.
  - The 15m context now exposes the completed histogram on every 15m bar of its bounded completion day instead of only one minute per hour. Existing sparse Monday and last-bar recovery snapshots remain.
  - The host now copies only a valid incoming histogram into a matching stored profile whose maximum is still zero. After that copy, repeated completion-day exposure cannot repeat the host-side array copy.
  - The correction adds no request, profile calculation, drawing path, or persistent host state. Label formatting remains isolated.
  - [x] Design a bounded snapshot-transfer window that survives intraday higher-timeframe sampling without returning histogram arrays continuously.
  - [x] Correct the one-time host copy guard to use histogram readiness instead of preallocated array length.
  - [x] User confirmed the corrected `/10` build passed TradingView testing and approved the release.
  - [ ] Extended soak: verify retained completed quarters, reload, quarter rollover, Bar Replay where supported, and the current developing Quarterly profile.
  - [ ] Capture TradingView Profiler evidence before and after the correction.

## Group F — Profile Label Formatting

- [x] **LABEL-06 — Progressive profile-label format**
  - Status: `TradingView Validated`
  - Principal Review: `Approved — no P0–P3 findings; source-level performance and DRYness approved`
  - Separate `Profile Label Order` (`Profile First`, `Level First`) from `Shorten` (`None`, `Dated Profiles`, `Dated + Previous`, `All Profiles`).
  - Keep `Level First` plus `None` as the default and preserve the approved `/8` output exactly.
  - `Dated Profiles` shortens only completed dated profiles; live and previous identities keep full anchor wording.
  - `Dated + Previous` also shortens previous identities; live identities keep full anchor wording.
  - `All Profiles` also shortens live identities.
  - Apply the selected order independently: `Profile First` produces `G POC Jul 22`; `Level First` produces `POC G Jul 22`.
  - Use `R`, `G`, `W`, `M`, and `Q` consistently in shortened identities, including `M POC Jul 2026` and `Q VAL Q2 2026`.
  - Keep `✓` and `Ⓐ` attached to their identities. Keep `⁺` and `◌` at the rear of affected shortened identities as well as in Touch Marker hover.
  - Apply the same selected scope to right-edge labels, active-anchor reminders, and swept reminders.
  - Preserve Touch Marker and First Hit prefixes, shared price, carrier styling, merge distances, and merge-off behavior.
- [x] **LABEL-07 — `/9` publication and test**
  - Status: `Superseded by later source revisions`
  - [x] Publish `RevelioInteractionsLibrary/9` privately.
  - [x] Compile the development host importing `/9`.
  - [x] User testing exposed unclear control scope and led to the separate Order and Shorten controls carried by `/10`.
- [x] **LABEL-08 — `/10` publication and TradingView validation**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Principal Re-review: `Approved — histogram and compact-provenance remediations resolved; no P0–P3 findings`
  - [x] Publish `RevelioInteractionsLibrary/10` privately.
  - [x] Compile the development host importing `/10`.
  - [x] User tested and approved the combined label-formatting release in TradingView.
  - [x] Confirm statically that the formatter adds no `request.*()` calls and no drawing-emission paths.
  - [ ] Optional quantitative follow-up: compare `/9` and `/10` with TradingView Profiler on the same chart, settings, and loaded history; record total runtime and the label-compositor and Quarterly request regions.

## Group E — Complete Merged-Label Compression

- [x] **LABEL-01 — One condensation system across all merged labels**
  - Status: `Code Complete`
  - Carry structured identities through right-edge labels, active-anchor reminders, and swept reminders.
  - Use the same compositor and `Condense Merged Labels` toggle for all three paths.
  - Turning condensation off restores full identities separated by ` | ` everywhere.
  - Keep brackets, capitalization, dates, status symbols, winning presentation, optional price, and merge-off behavior unchanged.
- [x] **LABEL-02 — Extra-wide merge distance**
  - Status: `Code Complete`
  - Add `Extra Wide` at `0.050%` to the existing merge-distance dropdown.
  - Raise the Custom merge-distance maximum from `0.1%` to `0.5%`.
- [ ] **LABEL-03 — TradingView validation**
  - Status: `Superseded`
  - [x] Publish `RevelioInteractionsLibrary/7`.
  - [x] Publish the development host importing `/7`.
  - Visual testing found that adaptive grouping did not materially improve scanability.
- [x] **LABEL-04 — Fixed level-first compositor**
  - Status: `Code Complete`
  - Make `POC`, `aPOC`, `VAH`, or `VAL` the first token of every condensed group.
  - Regroup the complete cluster by level and anchor instead of requiring adjacent identities.
  - Use ` | ` for a new level/anchor group and commas only for additional periods in the same group.
  - Keep live and bracketed previous identities complete, and preserve each member's `✓Ⓐ⁺◌` suffix.
  - Preserve Touch Marker, First Hit, shared price, winning presentation, merge-distance, and condensation-off behavior.
- [x] **LABEL-05 — `/8` publication and validation**
  - Status: `TradingView Validated`
  - [x] Publish `RevelioInteractionsLibrary/8`.
  - [x] Compile and publish the development host importing `/8`.
  - [x] User approved the visible fixed level-first label system.
  - [x] Preserve Touch Marker, First Hit, member suffixes, shared price, and non-adjacent regrouping.
  - [x] Preserve `Strict`, `Balanced`, `Wide`, `Extra Wide`, and Custom `0.5%` merge settings.

## Group A — Cosmetic Tweaks

- [x] **COS-01 — Default Value Gaps to Floating Only**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Change the default Value Gaps display from `Most Recent + Floating` to `Floating Only`.
  - Done when a fresh Revelio instance draws floating gaps without historical gaps by default.

- [x] **COS-02 — Current / previous temporal symbols**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Use `★` for every current RTH, Globex, Weekly, Monthly, and Quarterly label.
  - Use grouped labels: `[PREV RTH]`, `[PREV GLOBEX]`, `[LAST WEEK'S]`, `[LAST MONTH'S]`, and `[LAST QUARTER'S]`.
  - Keep the approved text in the paired `LABEL_*_LAST` constants.
  - Removed the Previous Label Format testing dropdown, formatter, and derived variables.
  - Removed the dedicated `PREV RTH / GLOBEX` text-size control and its specialized style path.
  - Previous labels continue using their anchor's normal text-size setting.

- [x] **COS-03 — Upcoming Gap offset**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Change the default `Upcoming Gap · Offset` from `10` to `90`.
  - Keep the offset editable.

- [x] **COS-04 — Floating confirmed-gap offset**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Change the default `Floating Gaps · Offset` from `100` to `150`.
  - Keep the offset editable.

- [x] **COS-05 — Fixed floating-gap spacing**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Keep `10` empty bars between adjacent floating gap boxes.
  - Remove the spacing control from the UI.
  - Do not change the individual gap-box `Width`.
  - Depends on: `COS-04`.

- [x] **COS-06 — Simplify Quick Filter presets**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Remove the `Core` and `Prep` Quick Filter entries and their unused state branches.
  - Rename Macro Prep to describe its remaining behavior directly: `● Macro Prep: Full Spectrum`.
  - Prefix the Intraday preset with a plus sign: `+ Intraday: RTH + Globex`.
  - Preserve the anchor membership of every remaining preset.

## Group B — Touch Markers

- [x] **TOUCH-00 — Plain Touch Marker tooltip identities**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Keep `[…]` decoration on right-column labels and reminders.
  - Remove the arrow and brackets from Touch Marker hover identities.
  - Preserve plain wording such as `PREV RTH` and `LAST WEEK'S`.
  - Append `⁺` directly to identities detected through `Include All Anchors`.
  - Append `◌` directly to archived swept identities.
  - Remove the ambiguous group-level status footer.
  - Do not change swept checkmarks, marker styling, or priority.

- [x] **TOUCH-01 — Built-in archived-swept dots**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Archived swept touches use the normal Touch Marker dot automatically.
  - Remove the `Dot / Dot + Guide` control.
  - Remove archived guide-line rendering and its drawing-budget reserve.

- [x] **TOUCH-02 — Fixed archived-swept symbol**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Append a fixed subtle `◌` to an archived swept level’s temporary right-edge label.
  - Do not replace or conflict with the existing swept checkmark.
  - Example: `RTH POC Jun 26 ◌`
  - Keep temporal arrows and brackets out of Touch Marker tooltips.
  - Append `◌` beside the archived identity in both its marker tooltip and temporary right-edge label.
  - Depends on: `TOUCH-03`.

- [x] **TOUCH-02B — Remove archived-dot fade**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Remove the archived-dot fade control and rendering branch.
  - Archived swept dots use their normal winning-anchor color and opacity.
  - Depends on: `TOUCH-01`.

- [x] **TOUCH-03 — Temporary Touch Labels**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Add one optional `Labels` control that shows touched identities without requiring hover.
  - Show temporary labels only during the selected Touch Marker trading window.
  - Include levels detected through `Include All Anchors`, even when their anchor is outside the active Quick Filter.
  - Never duplicate an identity that already has a normal right-edge label.
  - Reuse the normal right-column merge, offset, size, color, and background systems.
  - Gate both selected-anchor and additional labels with `Touch Marker Labels` and the active detection window.
  - Derive `◌` from the marker event’s archived provenance, not from the level’s later live-edge state.
  - Respect the existing per-anchor price controls.
  - Example with price enabled: `Quarterly VAH Q2 · 6125.25`.
  - Example with price disabled: `Quarterly VAH Q2`.
  - Depends on: `TOUCH-01`.

- [x] **TOUCH-04 — Archived swept Touch Labels**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Include older swept levels when `Include Older Levels` and `Labels` are enabled.
  - Mark them with the fixed `◌` suffix.
  - Keep one source-scope control; do not add separate archived-label or symbol controls.
  - Keep label visibility independent from Touch Marker source eligibility.
  - Depends on: `TOUCH-03`.

- [x] **TOUCH-05 — Quiet source defaults**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Rename the source controls to `Include All Anchors` and `Include Older Levels`.
  - Keep `⁺` and `◌` out of the control labels and explain them in the tooltip.
  - Default both source controls off.
  - Default `Labels` on for right-column trading context.
  - Older Levels means swept levels whose continuation lines are no longer displayed.
  - Preserve scaled marker sizes and the optional `Labels` control.

- [x] **TOUCH-06 — Limit daily-level retouches**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Add `Limit Daily Retouches`, default on and active only with `Include Older Levels`.
  - RTH and Globex POC, aPOC, VAH, and VAL levels mark their first eligible touch after the source profile completes.
  - Consume the daily identity whether its line is still visible or already older, so becoming older cannot create a second “first” touch.
  - Keep intrabar-persistent consumed state on each retained level so realtime rollback or changing `History` cannot make it eligible again.
  - Keep Weekly, Monthly, and Quarterly Touch Marker behavior unchanged.
  - Keep the rule independent for every identity inside a merged marker.
  - Apply the same older-level eligibility and consumption rule to deep Intraday Focus profiles.
  - Reconstruct staggered swept-continuation visibility at each Focus backfill timestamp.
  - Use the next profile’s actual finalization timestamp and only breaches known before each backfilled contact.
  - Preserve the base profile’s original finalization boundary when short sessions merge into it.
  - Give each recalculated short-session fold a new internal touch identity so stale hits and consumed state cannot attach to changed prices.
  - Consume an identity only after its first eligible marker is actually recorded.
  - Disabling the control restores the existing first-touch-per-NY-day behavior.

- [x] **TOUCH-07 — Optional first-hit direction context**
  - Status: `TradingView Validated`
  - Principal Review: `Approved — no P0–P3 findings after remediation`
  - TradingView: `Approved`
  - Add a `First Hit` checkbox, default `Off`, active only while `Touch Marker Labels` is enabled.
  - When enabled, render the first right-column Touch Marker cluster as `● ① ▼ [LAST WEEK'S] VAL | [PREV RTH] POC` when price arrives from above; use `▲` when price arrives from below.
  - Keep the marker tooltip compact: the identities stay on separate lines and the footer reads `① FIRST · From above · 09:42 NY`; use `From below` for an approach from below and do not repeat the arrow.
  - If the first contact starts exactly at the level or direction cannot be resolved, retain only `①` in the right column and `① FIRST · 09:42 NY` in the tooltip.
  - Use the earliest hit inside the selected Touch Marker `Window`; retained history does not carry a prior window's badge into the current one.
  - Give a merged Touch Marker one shared badge and preserve its established identity merge, winning-anchor color, and winning-anchor size.
  - Treat separate clusters with the same earliest lower-timeframe timestamp as co-first instead of inventing an order.
  - Historical and Replay direction starts from the lower-timeframe open; continuous live direction starts from the prior update price.
  - Keep the legacy `Hit hh:mm NY` time unchanged when `First Hit` is off; the new contact time is used only to select and describe the first cluster.
  - Compact dynamic live-Focus backfill into bounded one-minute ranges, preserving the first update origin and chart-bar marker placement without exhausting the multi-day retention cap.
  - Interactions `/4` and the Revelio host were published; the user approved the feature after TradingView testing.
  - Approved test surface: `First Hit` off/on, NQ1! 5m Replay from above and below, merged first cluster, co-first timestamp, Labels off, Window change, reload, and one forming-candle live touch.

- [x] **BUG-01 — Highest anchor controls a merged Touch Marker**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - When multiple levels share one Touch Marker, use this anchor priority:
    - `Quarterly`
    - `Monthly`
    - `Weekly`
    - `RTH / Globex`
  - The winning anchor must supply:
    - Dot color
    - Dot size
  - Keep the winning anchor first in the Touch Marker identity list.
  - Preserve stable identity order when RTH and Globex tie.
  - Regression test: when `LAST WEEK'S VAL` merges with RTH and Globex levels, the marker must use the Weekly VAL color and Weekly marker size.

- [x] **BUG-02 — Align Touch Marker and right-edge merging**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Assign same-candle Touch Marker identities to one shared cluster.
  - Reuse that cluster for the corresponding right-edge labels.
  - A level included in a merged dot tooltip must appear in the same merged right-edge label.
  - Regression test: `Globex VAL Jun 24` must not remain separate when its touch is grouped with `Weekly POC Jun 7`, `RTH VAL Jun 24`, `RTH POC Jul 2`, and `Globex POC Jul 1`.

- [x] **BUG-03 — Replay-safe Touch Marker timing**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Treat the active last chart bar as immediate Touch Marker input in live trading and supported time-chart Bar Replay, including confirmed Replay bars.
  - Use `timenow` only when the wall clock falls inside the active candle; use the replay candle timestamp when Replay reports its edge as realtime.
  - Preserve the forming price path and intrabar-persistent deduplication on the Replay edge.
  - Process Replay and ordinary historical candles through their lower-timeframe timestamps, including confirmed last bars spanning the window boundary.
  - Keep live Range-chart window transitions tied to the market clock when `time_close` is unavailable; TradingView does not support Bar Replay on Range charts.
  - Keep live forming-candle Touch Markers immediate.

- [x] **BUG-04 — All Anchors provenance in right-column labels**
  - Status: `Code Complete`
  - TradingView: `Not Tested`
  - Append the shared `⁺` symbol to each temporary right-column identity included through `Include All Anchors`.
  - Keep the symbol attached to the affected identity inside merged labels, matching its Touch Marker tooltip.

- [x] **BUG-05 — Stable Quarterly Replay below 15m**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Preserve the latest valid developing Quarterly snapshot between sparse 15-minute remote updates.
  - Clear the cache at a new quarter and whenever Quarterly developing output is inactive.
  - Keep completed Quarterly histogram copies sparse and leave 15m behavior unchanged.
  - Regression case: NQ1! on 5m Bar Replay around 10 Nov 2025 in Macro mode must not flicker while advancing; compare against 15m.

- [x] **BUG-06 — Immediate Quarterly On below 15m**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Principal review: `Approved for TradingView testing` with no P0–P3 defect found statically.
  - Resolve explicit `On` in the host instead of waiting for a sparse 15-minute maturity response.
  - Carry the latest developing Quarterly snapshot onto each lower-timeframe host bar.
  - Copy each completed Quarterly histogram only once even though the remote tuple is forward-filled.
  - Regression case: toggle `+Quarterly` from `Off` or `Auto` to `On` on an intermediate 5m Replay bar; the current Quarterly profile must appear immediately and match 15m.
  - Boundary case: step across a quarter rollover on 5m and confirm the prior-quarter developing snapshot is not briefly readmitted after the cache clears.

## Group C — Automatic Swept Lines

- [x] **SWEEP-AUTO-01 — Session-latched automatic visibility**
  - Status: `Approved`
  - TradingView: `Approved`
  - Current decision: `REVELIO-AUTO-SWEPT-ADR.md`.
  - Rejected `/2` and `/3` history: `REVELIO-AUTO-SWEPT-PARKED.md`.
  - Add `Auto Swept Lines`, default off while the behavior is evaluated.
  - Preserve the existing five retention settings as an unconditional floor in both modes.
  - Preserve post-sweep grace through the next same-anchor finalization.
  - Restrict every new Auto candidate and protected-floor line to the configured RTH, Globex, Weekly, Monthly, or Quarterly profile count.
  - Preserve a separate deep canonical archive only for ADR, optional older Touch Markers, and exact current-cycle carry.
  - Evaluate POC, aPOC, VAH, and VAL independently so one sibling sweep cannot revive another in Auto.
  - Build one global plan across enabled anchors at each Futures/UTC trading-day boundary.
  - Use trimmed 14-profile Globex/UTC ADR only to bound plausible reach.
  - Rank zones by higher-timeframe participation, distinct anchors, source-profile repetition, complementary roles, later control overlap, later value acceptance, ADR distance, and recency.
  - Keep admitted identities at their exact source prices so merged labels expose confluence.
  - Allow one directionally bounded add-only expansion after price travels 1.00 ADR from the cycle open.
  - Never evict or reorder an admitted line intraday.
  - Keep Intraday Focus `Swept Levels` as an explicit visibility override.
  - Keep Auto visibility independent from Touch Marker mode, window, history, older-level inclusion, and retouch limits.
  - Preserve archived Touch Marker provenance in live detection and Focus backfill.
  - Reserve bounded drawing capacity for both protected manual/grace lines and adaptive selections before ordinary completed-profile history.
  - Use ordered recent-profile indices, exact selection bitmasks, and reusable visibility-mask caches without changing the product model.
  - Rebuild retained Touch source identities only when the last-bar pruning phase consumes them.
  - Add a temporary `Ⓐ` audit that marks only the lines contributed beyond the current manual/grace floor.
  - Show the plan's current trimmed Globex/UTC ADR as `Ⓐ ADR` in the status line and Data Window while auditing.
  - Keep the default-off `Ⓐ` audit temporarily for periodic post-approval observation; remove it only when the user closes the soak period.
  - Publish Core `/6`, then Gaps `/6`, then compile the aligned indicator before behavior testing.

## Group D — Mature Appearance Input Cleanup

- [x] **INPUT-CLEANUP-01 — Remove settled appearance controls**
  - Status: `Approved`
  - TradingView: `Approved`
  - Begin only after Auto Swept `/6` performance and parity validation.
  - Preserve every current visual value exactly; this is an input-surface cleanup, not a redesign.
  - Remove settled color inputs across profile levels, labels, Value Gaps, Gap text, and other mature elements.
  - Preserve the current per-anchor histogram colors while removing their inputs.
  - Preserve all current level and gap widths while removing their inputs.
  - Preserve all current solid, dashed, and dotted style choices while removing their inputs.
  - Preserve all current price-label and text sizes while removing their dropdowns, including Gap and 50% Gap text.
  - Keep Manual Focus price, width, and offset adjustable; preserve its settled color directly in rendering.
  - Keep behavioral toggles, counts, retention, offsets, thresholds, and other non-appearance controls unless separately approved.
  - Remove obsolete variables and branches completely; use settled values directly rather than creating hard-coded replacement controls.
  - Remove the color reference table after the final editable color is retired.
  - Repack anchor controls into plain compact rows without category prefixes: Extension; VAH/L, POC, aPOC; Box, Histogram, Fade Mitigated Levels; Developing Profile and cutoff.
  - Inventory every affected input and its exact current default before implementation.
  - Make the 5% sweep-confirmation margin a code constant and remove its UI input.
  - Make every Value Gap show its main label and 25% / 50% / 75% lines; keep the 50% internal label on historical gaps only and remove quartile labels.
  - Default Upcoming Value Gaps to off for the first production release; users can enable them explicitly.
  - Fix Value Area at 70%, Anchor Labels at Reminders, confirmed Gap minimum at 5%, Upcoming Gap minimum at 45%, and all settled fade percentages through named constants.
  - Remove the Manual Focus color input and the complete reference-table type, helpers, state, rendering, and Utility group.
  - Remove the obsolete Anchor Label mode contract through Interactions `/2`; reminders are now the library's only behavior.
  - Implementation result: remove 131 settled inputs and 303 host lines; retain 106 behavioral/manual inputs.

## Closed Decisions

- [x] **D-01:** Should brackets contain only `PREV` / `LAST` or the complete previous-period phrase?
  - Approved with the complete previous-period phrase inside the brackets.

- [x] **D-02:** Confirm the archived-swept symbol.
  - Approved as one fixed `◌` suffix with no symbol control.
  - Mirror it beside each archived swept identity.

- [x] **D-03:** Confirm the exact placement of visible Touch Marker labels.
  - Approved as temporary right-column labels during the active Touch Marker window only.

- [x] **D-04:** Define the priority tie between RTH and Globex.
  - Approved with stable displayed-identity order because both are daily anchors.

- [x] **D-05:** Confirm the default floating-gap spacing.
  - Implemented as a fixed `10` bars with no UI control.

- [x] **D-06:** Keep archived swept dot fading adjustable?
  - Removed; archived swept dots use normal opacity.

- [x] **D-07:** Name the optional expanded Touch Marker sources.
  - Approved as `Include All Anchors` and `Include Older Levels`.

- [x] **D-08:** Reduce repeated touches from older daily levels.
  - Approved as optional `Limit Daily Retouches`, default on.
  - Apply to RTH and Globex only; keep Weekly, Monthly, and Quarterly unchanged.

## Validation Checklist

- [x] Pine delimiter, constructor-arity, and stale-reference checks pass.
- [x] Group D leaves no style or text-size dropdown and no color inputs.
- [x] Group D preserves all five `SessionStyle` constructor arities and all three `ValueGapStyle` constructor arities.
- [x] Group D compiles in TradingView and matches the preceding development build visually.
- [x] Manual Focus price, width, and offset remain editable; its settled color is preserved and the reference table is absent.
- [x] The production Core, Gaps, and Interactions `/1` chain compiles in the deployed `revelio` indicator and receives final user approval.
- [x] TradingView compilation passes for Group A.
- [x] TradingView compilation and product testing pass for committed Group B baseline `962eb334`.
- [x] Fresh-instance defaults match the requested gap display and offsets.
- [x] Final grouped labels preserve `WEEK'S`, `MONTH'S`, and `QUARTER'S`.
- [x] Floating-gap offset and width remain editable; adjacent gaps keep `10` empty bars.
- [x] Touch Marker tooltips use plain temporal identities while right-column labels remain decorated.
- [x] Tooltip status symbols sit beside the identities they describe; no ambiguous status footer remains.
- [x] `Include Older Levels` independently includes older swept markers and labels.
- [x] With `Limit Daily Retouches` on, an older RTH or Globex identity appears once and remains consumed after its marker leaves `History`.
- [x] A realtime intrabar touch remains consumed after later updates on the same open candle.
- [x] A realtime intrabar touch keeps its selected right-column Touch Marker label after later updates on the same open candle.
- [x] A visible-line touch consumes the daily identity, remains the first marker, and prevents a later older-level retouch from replacing it.
- [x] Regression: `Globex POC Jun 26` keeps its marker on the earlier session contact instead of moving to the later retouch when the limit is enabled.
- [x] Turning `Limit Daily Retouches` off restores one eligible marker per NY date for older RTH and Globex levels.
- [x] Weekly, Monthly, and Quarterly older levels retain their existing per-date behavior in both settings.
- [x] Deep Intraday Focus profiles obey `Include Older Levels` and `Limit Daily Retouches`, including backfilled ranges.
- [x] Focus backfill does not fill hidden gaps between staggered POC/aPOC/VAH/VAL continuation windows.
- [x] A sweep completed on the same candle does not retroactively resurface another level for that candle’s backfill.
- [x] The next profile’s final in-session candle does not retire the prior most-recent profile before finalization.
- [x] RTH and Globex short-session merges do not extend the preceding profile’s most-recent window.
- [x] Earliest, All, and Combine short-session folds do not transfer stale touch state to recalculated POC, aPOC, VAH, or VAL prices.
- [x] Older-level markers preserve normal winning-anchor color, opacity, and scaled size.
- [x] Turning `Touch Marker Labels` off hides temporary selected and unselected touch context; active anchor labels remain without the touch prefix.
- [x] A visible-line touch does not gain `◌` later merely because its continuation subsequently disappears.
- [ ] `Include All Anchors` Touch Labels append `⁺` to the affected identity and obey the existing price controls.
- [x] Weekly/Monthly/Quarterly merged-marker priority is visually correct.
- [x] A merged Touch Marker and its right-edge label contain the same touched identities.
- [x] Playing Bar Replay forward records Touch Markers from the replay candle’s NY window and timestamp.
- [ ] The Replay correction does not delay Touch Markers on an open realtime candle.
- [ ] Standard charts, Replay, and the active Touch Marker trading window receive a visual pass.
- [x] Quarterly remains continuously visible while stepping the 5m Replay regression case and still matches 15m at each completed 15-minute boundary.
- [ ] Manual swept-line output and retention controls match the training build after Auto parking.
- Adaptive Auto `/6` validation matrix:
- [ ] Auto off matches the approved library-backed manual build.
- [ ] Auto on contains every line visible with the same manual retention settings.
- [ ] With daily profile counts set to 10, every adaptive RTH/Globex identity comes from those 10 retained source profiles.
- [ ] Weekly, Monthly, and Quarterly adaptive identities stay inside their configured profile counts.
- [ ] A price-isolated level supported by only one source profile is not admitted merely because capacity remains.
- [ ] ADR still samples up to 14 canonical Globex/UTC profiles when the Globex display count is below 14.
- [ ] `Include Older Levels` still detects eligible older Touch Marker sources beyond the Auto source window.
- [ ] A current-cycle pick remains stable when an intracycle profile finalization rolls its source outside recent N, then is re-evaluated at the next cycle boundary.
- [ ] Intraday Focus can surface an older swept level without allowing that older profile to seed a global Auto selection.
- [ ] Outside the protected manual/grace floor, Auto does not let a later VAH/VAL/aPOC sweep revive an older sibling continuation.
- [ ] A known older-marker case has its selected line visible before contact.
- [ ] Same-anchor repetition and RTH/Globex-to-Weekly/Monthly/Quarterly confluence retain the expected exact identities.
- [ ] Auto candidates remain fixed throughout a trading day except for one add-only expansion.
- [ ] The 1.00-ADR directional expansion adds without removing, moving, or symmetrically widening existing lines.
- [ ] Auto line visibility is identical with Touch Markers off and on.
- [ ] Auto grace follows actual RTH, Globex, Weekly, Monthly, and Quarterly finalizations.
- [ ] Intraday Focus retains a newly swept manual/grace line under maximum line pressure.
- [ ] A same-start holiday/short-session fold does not move or remove a selected line before the next cycle.
- [ ] A selected superseded holiday/short-session snapshot keeps its exact Touch Marker identity while visible.
- [ ] When that exact selection expires, the superseded snapshot cannot create another Touch Marker before archive cleanup.
- [ ] Auto and Custom preserve Focus `Swept Levels` overrides and archived `◌` provenance.
- [ ] Auto works on 4h and 180R/360R charts where Touch Marker availability differs.
- [ ] Auto stays within line budgets with every anchor, histogram, and Value Gap family enabled.
- [ ] Three comparable cold loads keep Auto overhead within the two-second target.
- [ ] Touch Marker identities, pruning, Focus, Include All Anchors, and Include Older Levels match before and after the last-bar retained-source optimization.
- [ ] `Ⓐ` appears only on lines absent under the current manual/grace floor.
- [ ] Disabling `Ⓐ` removes every audit suffix without changing visible lines.
- [ ] `Ⓐ ADR` appears only while auditing and matches the plan's current ADR value.
