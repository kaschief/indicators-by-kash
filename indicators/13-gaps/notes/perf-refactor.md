# Gaps Indicator — Performance Refactor (completed)

**Branch shipped:** `gaps-perf` → fast-forward merged into `kash-home` on 2026-04-27.

**Symptom that started this:** TradingView occasionally timed out loading the indicator on 1m charts with high gap counts.

**Outcome:** gaps.pine reduced from 1887 → ~1500 lines after BPR + FVG removal and the perf restructure. Display loop now splits state mutation (every bar) from drawing (last bar only). Verified on chart.

---

## Completed work

### Drawing-pool limits (commit `1829564c`)
- Title set to `gaps • development` per CLAUDE.md dev-naming.
- Added `max_labels_count=500` and `max_bars_back=5000` to `indicator()`.

### Phase 1 — consolidate the per-bar work (commit `1829564c`)
- **A.** Five duplicate 1-minute array scans collapsed into one master scan with per-job lookback gates and display gates. Mark-passed runs before gap creation in the same iteration; safety windows (6 days NWOG, 20h NDOG) still enforce per-gap.
- **B.** O(n²) per-bar NWOG/NDOG label merge replaced by a creation-time merge via a new `GapData.labelPrefixOverride` field. Self-heal in `restoreGapDrawings` clears the override if the partner is removed via `removeOldestGap`.
- **C.** Projection management gated on `barstate.islast` (cleaner than the originally-planned dirty flag — last-bar drawings are the only ones that ever render). Fill sites still call `clearProjections(gap)` inline so real-time fills don't leave orphans.

### Divider pool memory leak (commit `361939ec`)
- `ndogDividers.dividerTimes` and `nwogDividers.dividerTimes` were push-only; every chart bar re-pushed the same session-open timestamps. Added `array.clear(...)` for both at the top of the master scan.

### BPR feature removal (commit `0d4a355e`)
- Total wipe: gap type constants, group, filter preset, default colors, 8 inputs, `displayBPR` derivation, BPR detection block (~50 lines), `removeOldestBPR()`, `tryMergeGap()` (BPR-only after removal), BPR branches in `getGapLabelText` / color dispatch / `shouldExtend` / hide-filled / fill-site `stopExtendingAt`, color reference table rows.

### FVG feature removal (commit `f73b7b2f`)
- Total wipe: gap type constants, group, two filter presets (`FILTER_FVG`, `FILTER_FRESH_FVG`), 7 default colors, 11 inputs, `displayFVG` derivation, `isFVG()`, `countFVG()`, `removeOldestFVG()`, `stopExtendingAt()` (now FVG-only), FVG-specific branches in createGap (label rendering + q1/q3 skip) and `updateGapDrawingPositions` (Y-position update), FVG branches in `getGapLabelText` / color dispatch / fill detection / hide-filled / FVG grey-out invalidation block / `shouldExtend`, FVG Detection block (~70 lines), color reference table rows.
- Body-vs-wick fill detection eliminated; all gaps use wick now.

### Phase 2 — split display loop + preview RTH bug fixes (commit `b5cae039`)
- **PASS A** (every bar) handles state mutation: entry direction, fill detection, filled-gap cleanup with `array.remove`. No drawing decisions.
- **PASS B** (`barstate.islast` only) handles drawing: pre-pass tracking, fresh-mode label restore, visibility filter, color dispatch, box positioning, RTH fill-percentage label, extension positioning, projection right-edge updates.
- **Behavior change:** hidden gap types now still track their fill state. Previously the visibility filter `continue`-ed before fill detection so hiding NWOG meant fills were missed until re-enabled. Now state advances regardless of display.
- **Dropped sub-block:** the "find next fresh RTH and restore drawings" inside old filled cleanup. PASS B's visibility filter naturally surfaces the next unfilled candidate at last bar.
- **Preview RTH border** — `createGap` no longer gates `topBoundaryLine`/`bottomBoundaryLine` creation on `not isPreview`; previews now have a border in both modes. Non-floating preview update block now keeps both lines positioned every bar.
- **Preview RTH date drift** — floating draw was recomputing `nextTradingDay` from current `time` on every render, so a Friday-minted preview drifted to Tuesday once `time` crossed into Monday. Anchored to `previewGap.creationTime` so both modes show the same date.

### Strict projection cap (verified, no change needed)
- Plan originally listed this as Phase 2B work. On re-reading the projection-management block (post-FVG), the cap is already strictly enforced: most-recent-unfilled per type gets projections, anything else gets `clearProjections(gap)`. `deleteGap` and PASS A both clean up projections when gaps fill or are removed. No leak path identified.

---

## Open / future work

### Pre-publish: remove the `-development` suffix from title
Before publishing the production version, line 2 of `gaps.pine` must change:
```pine
indicator("gaps • development", ...)  // dev
indicator("gaps •", ...)              // production
```
Per CLAUDE.md "Development Naming Rule."

### Phase 3 (high risk, only if needed)
Replace 1m session-boundary scanning (`request.security_lower_tf`) with proper `request.security()` HTF calls patterned after the relay's backfill-batch tuples. Original plan called this out as "only do if Phase 1+2 doesn't eliminate timeouts." Skip unless a future TV timeout regression on 1m ES forces revisiting.

---

## Regression checklist (re-run on any future gaps work)

Symbol: ES on 1m chart, chart zoomed to cover at least 6 weeks of history.

**Gap creation:**
- [ ] NWOG appears at each Fri 16:59 → Sun 18:00 transition
- [ ] NDOG appears at each weekday 16:59 → 18:00 transition
- [ ] NDOG appears at Fri 16:59 → Sun 18:00 (shares geometry with NWOG)
- [ ] RTH appears at each 09:30 session open when prior close ≠ open

**Fill behavior:**
- [ ] Each gap type transitions to filled color when wick breaches
- [ ] `penetrationLevel` partial-fill visualization works (top/filled/bottom 3-box split)
- [ ] 100% filled gaps get `✓` suffix in label
- [ ] RTH "Today's RTH filled" alert fires once per day (if user uses alerts; not in active use as of this branch)

**Filter modes** (cycle through each):
- [ ] All
- [ ] Fresh
- [ ] NWOG
- [ ] NDOG
- [ ] NWOG + NDOG
- [ ] RTH

**Label merging:**
- [ ] When NWOG and NDOG share geometry (Sunday open), NWOG label reads "NWOG / NDOG"
- [ ] NDOG label is hidden (empty string) when NWOG absorbs it
- [ ] If NWOG is removed via limit, NDOG label restores via `restoreGapDrawings` self-heal

**Projections:**
- [ ] Only most recent unfilled NWOG/NDOG/RTH has projections
- [ ] Projections clear when gap fills (PASS A `clearProjections(gap)`)
- [ ] Projection right-edge tracks current bar (PASS B updates)

**Preview RTH (upcoming):**
- [ ] Preview shows correct date in BOTH floating and non-floating mode (no drift)
- [ ] Preview has visible top + bottom border in both modes
- [ ] Toggling floating mode does not change the displayed date

**Dividers:**
- [ ] NWOG dividers only on Sunday 18:00
- [ ] NDOG dividers on all 18:00 session opens
- [ ] Dividers do not duplicate (divider pools cleared and refilled each scan)

**Performance:**
- [ ] No TV timeout on 1m ES chart with full history
- [ ] Frame rate acceptable when scrubbing through history
