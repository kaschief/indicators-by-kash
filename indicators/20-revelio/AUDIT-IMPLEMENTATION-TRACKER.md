# Revelio Audit Implementation Tracker

Date started: 2026-07-26  
Baseline commit: `bcaab67`  
Working branch: `codex/revelio-audit-fixes`  
Source audit: `REVIEW-AUDIT.md`

## Purpose

This is the working checklist for implementing the Revelio review findings one testable change at a time.

`REV-###` values are permanent finding IDs, not execution-step numbers. The **Current Item** section below is the single source of truth for what we are doing next.

Only one implementation slice should be active at once. After each slice:

1. Run local structural checks.
2. Record the observable behavior and focused TradingView test below.
3. Compile and test in TradingView.
4. Record the result.
5. Commit only after the test passes and commit approval is given.
6. Start the next slice from that tested state.

## Status Key

- **Baseline accepted** — the starting behavior compiles and was accepted before audit fixes.
- **Next** — the next isolated implementation.
- **Queued** — waiting for earlier slices to pass.
- **Decision needed** — product behavior must be selected before implementation.
- **TV testing** — implemented locally and awaiting TradingView confirmation.
- **Passed** — TradingView behavior confirmed.
- **Deferred** — intentionally postponed until evidence shows it is needed.

## Current Item

**TEST NOW: REV-002 and REV-003 — rollback**

The allocator proposal was rejected and completely removed after it caused runtime timeouts and reduced the visible profiles to one. The original allocator behavior is restored.

Confirm the normal profiles are restored. REV-002 and REV-003 are then deferred until the original behavior becomes an observed product problem. REV-005 remains deferred. REV-010 is now confirmed by the December 31 RTH comparison and requires a product decision before any implementation.

## Findings by ID

| Finding | Status | Executive outcome | Decision |
| --- | --- | --- | --- |
| REV-001 | Explained / no defect | Preserve separate Touch Marker, mitigation, and Swept contracts. | No change |
| REV-002, REV-003 | Deferred / reverted | Preserve the original allocator until a real Focus display problem is observed. | Rejected |
| REV-004 | Partial / retained optimization | Stop unchanged Focus selections from rescanning retained history on every update. | No change |
| REV-005 | Deferred | Replace full drawing recreation only if loading remains slow after Touch Marker optimizations. | Revisit only if needed |
| REV-006 | Passed | Make `All Into Previous Full Session` fold every consecutive short session. | No change |
| REV-007 | Explained / no defect | Preserve repeated Quarterly snapshots required by higher chart timeframes. | No change |
| REV-008 | Baseline accepted | Resolve stale `PREV` marker identity dynamically. | No change |
| REV-009 | Explained / no defect | Preserve event-time truth when later confluence appears. | No change |
| REV-010 | Confirmed / test fixed 1-minute source | RTH, Globex, Weekly, and Monthly levels must match across 1–15 minute charts. | Use a common 1-minute profile source if the focused test passes |
| REV-011 | Queued | Detect touches from actual lower-timeframe ranges, including Focus backfill. | None after REV-010 design |
| REV-012 | Decision needed | Align or explicitly distinguish the displayed histogram and analytical levels. | Raw, smoothed, or mixed |
| REV-013 | Decision needed | Define whether Swept follows the chart timeframe or a fixed resolution. | Chart-based or fixed |
| REV-014 | Decision needed | Define whether Manual Focus supports zero and negative prices. | Instrument scope |
| REV-015 | Queued | Reduce synchronization risk between profile hit state and the marker archive. | No behavior change |
| REV-016 | Queued | Consolidate repeated four-level state and style paths incrementally. | Refactoring depth |
| REV-017 | Queued | Add repeatable structural checks and maintain the TradingView evidence matrix. | Tooling scope |
| REV-018 | Passed | Remove repeated regular Touch Marker archive searches during historical loading. | No change |

## Test Cards

### Gate 1 — Baseline Touch Marker behavior

Status: **Baseline accepted**

Accepted starting behavior:

- Development source compiles in TradingView.
- Current status-quo chart behavior is correct.
- Historical marker facts remain fixed while current profile identity can update.
- Later-created confluence does not rewrite an older touch event.

### REV-007 — Quarterly snapshot publication

Status: **Explained / no defect**

Tested proposal:

- Transfer a completed Quarterly histogram on one scheduled completion event instead of every hour at the configured minute.

TradingView result:

- Rejected on a 4-hour BTCUSD comparison.
- The development version lost older Quarterly histogram shapes that remained visible in the baseline.
- A single sparse 15-minute `Profile` snapshot did not reliably survive aggregation into the higher chart timeframe.

Resolution:

- Restored the original repeated completion-day snapshots.
- Added a concise source comment documenting the higher-timeframe requirement.
- No indicator behavior change remains.

### REV-006 — Consecutive short-session merging

Status: **Passed**

Expected change:

- `All Into Previous Full Session` folds the complete consecutive run of qualifying short sessions.
- `Off`, `Earliest`, and `Combine Shorts` retain their existing behavior.

TradingView test:

- Use ES1! around the November 27–28, 2025 holiday sessions for the visible regression pass.
- Test RTH and Globex independently.
- Compare `Off`, `Earliest`, `All`, and `Combine Shorts`.
- Confirm existing one- and two-short-session behavior remains stable.
- Confirm ordinary full-session boundaries and Value Gap source profiles remain correct.
- The direct edge case is three shortened traded sessions, such as two holiday-adjusted sessions followed by an unexpected presidential mourning-day early close. Fully closed days do not count.
- The third-fold rule is covered locally by a deterministic policy simulation when that extraordinary sequence is unavailable in chart history.

Local result:

- `All` now has an explicit unlimited-fold policy.
- `Off`, `Earliest`, and `Combine Shorts` retain their existing finite policies.
- Structural checks, constructor arity, and the three-plus fold simulation passed; TradingView confirmation is pending.

### REV-001 — Exact contact semantics

Status: **Explained / no defect**

Current contracts:

- Touch Marker — exact wick contact counts.
- Mitigation — price must trade through the level.
- Swept — confirmed closes must clear both sides with the configured margin.

TradingView test after the decision:

- Find or replay a candle whose high or low equals POC, VAH, VAL, or aPOC exactly.
- Confirm the marker and level lifecycle match the selected contracts.
- Confirm Swept remains separate and still requires its two-sided close sequence.

Result: _No implementation needed_

### REV-010 — Cross-timeframe profile consistency

Status: **Confirmed / product rule selected**

Expected change:

- If consistency is selected, Weekly and Monthly POC, VAH, VAL, and aPOC use a stable data resolution rather than changing with the chart timeframe.

TradingView test:

- Use the same symbol, date, session, and indicator settings on 1-minute and 5-minute charts.
- Expose Weekly and Monthly prices and compare every level exactly.
- Confirm completed and developing profiles follow the selected resolution contract.
- Confirm RTH, Globex, Quarterly, and Value Gaps remain unchanged unless explicitly included.

Runtime evidence:

- On ES1! December 31, the 5-minute RTH VAH is approximately 6,937.50.
- On the matching 1-minute chart, the RTH VAH is approximately 6,947.50.
- The RTH VAL also differs, while the POC appears aligned.
- Evidence: `Screenshot 2026-07-26 at 20.20.06.png`.

Result: _Actual cross-timeframe mismatch confirmed; implementation decision pending_

Decision:

- Completed RTH, Globex, Weekly, and Monthly profiles must match across nearby intraday chart timeframes.
- First verify the existing `1` HD-resolution option on matching 1-minute and 5-minute charts.
- If December 31 aligns, change Auto so 1–15 minute charts share the 1-minute profile source.

### REV-011 — Per-intrabar Touch Marker detection

Expected change:

- A Touch Marker appears only if an eligible component range actually contains the level.
- A gap between component bars no longer creates a false touch.
- Live detection and Focus backfill use the same contact evidence.

TradingView test:

- Reproduce the audited 1-minute versus 5-minute marker discrepancy.
- Inspect the component ranges around the candidate level.
- Confirm no marker appears when the level exists only inside a gap.
- Confirm a genuine component-bar contact still appears instantly.
- Toggle Focus off and back on and confirm the backfilled result matches the live result.

Result: _Pending implementation_

### REV-002 and REV-003 — Focus allocator

Status: **Rejected and reverted**

Expected change:

- Drawing priority is explicit: live profiles, Focus profiles by distance, then ordinary profiles by recency.
- Non-Focus histogram costs cannot silently remove every Focus selection.
- One unaffordable profile cannot starve all cheaper older candidates.

TradingView test:

- Enable dense Weekly, Monthly, and Quarterly histograms.
- Select five or more Focus profiles near an older RTH or Globex area.
- Confirm the requested nearest Focus profiles survive drawing pressure.
- Confirm ordinary profiles fill only the remaining capacity.
- Confirm levels and histograms respect their independent budgets.
- Check for missing, partially drawn, or silently evicted profiles.

Result:

- The proposed allocator caused repeated 500 ms runtime errors.
- The timeout limit then caused only one profile to remain visible.
- The entire proposal and both timeout guards were removed.
- The original allocator is restored.
- Final restoration check in TradingView is pending.

### REV-004 — Incremental Focus backfill

Status: **Partial / not primary cause**

Observed problem:

- Indicator loading is noticeably slower with the current Touch Marker and Focus changes.
- The cause is not assigned yet; the comparison below separates Focus backfill from general drawing work.

Expected change:

- Historical ranges are backfilled when the Focus selection changes and advanced incrementally afterward.
- Realtime updates do not repeatedly rescan the complete retained history.
- Existing marker identity, timing, and daily deduplication remain unchanged.

TradingView test:

- Use the same BTCUSD 1-minute or 5-minute chart and reload after each setting change.
- First test Touch Markers `Off`.
- Then test `On` with Intraday Focus off.
- Then test `On + Focus` with Intraday Focus active and several profiles.
- Record which setting introduces the noticeable loading delay.
- Use `On + Focus`, maximum retained history, and several Focus profiles.
- Move the Focus anchor and confirm historical markers repopulate correctly.
- Leave the anchor unchanged and confirm live markers still appear instantly.
- Compare marker count, placement, tooltips, and merged circles with the baseline.
- Watch for execution-limit errors during realtime updates.

Interpretation:

- If only `On + Focus` is slower, prioritize incremental Focus backfill.
- If all three modes are similarly slow, measure full drawing recreation under REV-005 instead.

Result: _TradingView loading and marker comparison pending_

Local result:

- Revelio remembers which Focus levels were already backfilled.
- The retained history is scanned again only when the selected Focus levels change or the marker window reopens.
- Live touches still run on every eligible realtime update.
- Structural checks passed; TradingView loading and marker confirmation are pending.

TradingView result:

- The overall version still feels slow with Intraday Focus disabled.
- Focus backfill is not the primary cause of the remaining loading delay.
- Disable Touch Markers themselves for the next comparison.

### REV-005 — Drawing lifecycle

Status: **Deferred**

Diagnostic result:

- Touch Markers `Off` restored the older version's loading speed.
- General drawing recreation is not the isolated cause of this regression.
- Test REV-018 before reconsidering the drawing lifecycle.

Decision rule:

- Proceed only if REV-004 passes but dense configurations still show unacceptable performance.

If implemented, test:

- Dense profiles, Value Gaps, Touch Markers, reminders, and merged labels together.
- Realtime updates and Bar Replay for missing, duplicated, flickering, or orphaned drawings.
- Setting changes that enable, disable, or reduce retained drawings.

Result: _Deferred pending measurement_

### REV-018 — Regular Touch Marker loading

Status: **Passed**

What changed:

- Historical bars no longer search through the complete retained marker list for every visible level.
- They use the level's existing same-day hit timestamp instead.
- Realtime updates and Focus backfill still use the retained marker archive where it is required.

What to test:

- Reload the same chart with Touch Markers `On` and Intraday Focus off.
- Compare loading speed with the older version and with Touch Markers `Off`.
- Confirm historical markers appear on the same candles.
- Confirm only the first touch per level per New York date is marked.
- Confirm a new realtime touch still appears immediately.
- Enable `On + Focus`, move the Focus anchor, and confirm backfilled markers still appear.

What must not change:

- Marker locations, timestamps, identities, merged circles, or retention.
- Quarterly histograms, profiles, Value Gaps, mitigation, or Swept behavior.

Result: _TradingView loading is faster; approved by the user_

### REV-012 — Histogram and analytical levels

Decision:

1. Raw histogram and raw levels.
2. Smoothed histogram and smoothed levels.
3. Smoothed presentation with raw analytical levels.

TradingView test:

- Confirm whether the visually largest histogram row should coincide with POC under the selected contract.
- Compare POC, VAH, VAL, aPOC, and histogram shape before and after.
- Test RTH, Globex, Weekly, Monthly, and Quarterly profiles.

Result: _Decision pending_

### REV-013 — Swept confirmation resolution

Decision:

- Swept follows confirmed closes from the active chart timeframe, or
- Swept uses one fixed confirmation resolution across charts.

TradingView test:

- Compare the same level and date on 1-minute, 5-minute, and hourly charts.
- Confirm sweep time and continuation behavior match the selected contract.
- Confirm Touch Markers and mitigation remain independent.

Result: _Decision pending_

### REV-014 — Manual Focus at zero or negative prices

Decision:

- Keep positive-price instruments as the supported scope, or
- Add a separate placed/unplaced state for zero and negative prices.

TradingView test if implemented:

- Place Manual Focus above zero, at zero, and below zero on a suitable synthetic series.
- Confirm the anchor, label, selection direction, and nearest profiles work at each value.

Result: _Decision pending_

### REV-015 — Touch-state ownership

Expected change:

- Reduce dual-state synchronization risk without changing marker behavior.

TradingView test:

- Repeat Gate 1.
- Test daily deduplication, profile retention, Focus backfill, rollover identity, and live timing.

Result: _Pending implementation_

### REV-016 — Level-path maintainability

Expected change:

- Centralize repeated POC, VAH, VAL, and aPOC access in small compile-safe steps.
- No intended visual or analytical change.

TradingView test:

- Compare all four levels across every anchor.
- Test mitigation, Swept, Touch Markers, Focus, labels, reminders, and hidden anchors.
- Use screenshot comparison because no visual change is intended.

Result: _Pending implementation_

### REV-017 — Validation workflow

Expected change:

- Add repeatable local structural checks.
- Preserve a TradingView compile, Replay, realtime, and screenshot matrix.

Validation:

- Run the repository checker against the development source.
- Confirm inputs, constructors, call arity, delimiters, conflict markers, and whitespace.
- Record TradingView evidence separately because local checks are not runtime proof.

Result: _Pending implementation_

## Decision Log

| Finding | Decision | Date |
| --- | --- | --- |
| REV-001 | Preserve separate contracts | 2026-07-26 |
| REV-002, REV-003 | Reject implementation and defer until an observed problem exists | 2026-07-26 |
| REV-005 | Measure after REV-004 | 2026-07-26 |
| REV-010 | Pending | — |
| REV-012 | Pending | — |
| REV-013 | Pending | — |
| REV-014 | Pending | — |

## Chronological Test Result Log

This log is ordered by when testing happened, not by REV number.

| Finding | Local validation | TradingView result | Commit |
| --- | --- | --- | --- |
| Gate 1 | Fable static review complete | Baseline compiled and accepted by user | `bcaab67` |
| REV-007 | Proposal reverted | Failed on 4-hour BTCUSD; baseline restored | — |
| REV-006 | Passed | Approved by user | — |
| REV-004 | Passed | Overall version still slow with Intraday Focus off | — |
| REV-018 | Passed | Loading is faster; approved by user | — |
| REV-002, REV-003 | Proposal fully reverted | Timeouts and missing profiles; restoration retest pending | — |
