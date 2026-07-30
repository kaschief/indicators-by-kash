# Revelio Change Tracker

Updated: 2026-07-30
Progress: Group A 6 / 6 validated and approved · Group B 12 / 12 code complete · 11 / 12 validated and approved
Committed baseline: `962eb334` — approved

Status flow: `Not Started` → `In Progress` → `Code Complete` → `TradingView Validated`

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

## Open Decisions

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
