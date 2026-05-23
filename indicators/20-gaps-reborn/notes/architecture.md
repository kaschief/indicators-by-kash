# Gaps Reborn Architecture

Goal: rebuild gaps around explicit lifecycle data, not drawing side effects.

## Current Scope

- RTH gaps with full lifecycle (detection, fill tracking, extension rules).
- NWOG and NDOG detection, color dispatch, display logic, and limits are wired up.
- RTH preview uses a separate `DraftGap`, not a stored `GapRecord`.
- Floating overlays use a separate `FloatingGap` per type, not moved historical drawings.
- `Upcoming RTH` controls `DraftGap` visibility (gated on `showRTH`).
- `Display Mode` controls historical vs floating layout: `Historical`, `Historical + Floating`, or `Floating Only`.
- No projections or dividers in the first cut.

## Type Dispatch Architecture

All drawing functions resolve colors through three dispatch functions:
- `getUnfilledColor(gapType)` / `getFilledColor(gapType)` / `getBorderColor(gapType)`

Box fill geometry (the 3-box split for entry direction) is computed by `getBoxGeometry()` — a pure function returning a 6-element tuple. Both `applyGapColors()` and `updateFloating()` consume it, eliminating duplicated branching.

Display and limit logic use `shouldDisplayGap(gap)` and `getDisplayLimit(gapType)`, both switch-dispatched. Adding a new gap type requires:
1. Add constants, default colors, and input group.
2. Add cases to `getUnfilledColor`, `getFilledColor`, `getBorderColor`, `shouldDisplayGap`, `getDisplayLimit`.
3. Implement detection logic that pushes `GapRecord` into the shared `gaps` array.
4. Add a `var FloatingGap` instance and wire it into the render loop.

## Pipeline

1. Detection
   - Capture RTH close.
   - Create/update a separate RTH draft during ETH (only when both `showRTH` and `showRTHDraft` are true).
   - Create a gap at the next RTH open when open differs from prior RTH close.
   - Delete the draft at RTH open whether or not a confirmed gap forms.
   - Mark older same-type gaps with `nextSessionTime` and `nextSessionBar` only when an actual next session-open bar is observed.

2. State
   - Track `entryDirection`, `penetrationLevel`, `filled`, `fillTime`, `fillBar`, `nextSessionTime`, and `nextSessionBar`.
   - State updates run on every bar, skipping already-filled gaps.

3. Selection
   - Decide which stored gaps are visible via `shouldDisplayGap` (per-type switch).
   - Per-type visible limit counting (`displayedRTH`, `displayedNWOG`, `displayedNDOG`) applies to historical display. `Floating Only` ignores historical counts and shows only selected floating candidates.

4. Layout
   - Resolve the right edge from lifecycle timestamps. Do not pre-compute future session endpoints; let actual session-open bars mark lifecycle boundaries.
   - Display mode changes only layout, never lifecycle state.
   - `Historical` shows normal gap drawings only. `Historical + Floating` keeps historical drawings plus compact floating overlays. `Floating Only` hides non-floating historical drawings while state continues running.
   - When the RTH draft is visible, it owns the compact RTH slot, so confirmed RTH gaps do not float during the draft.
   - Draft suppression only applies to RTH type.
   - Unfilled gaps always extend live.
   - Filled gaps extend at least to the next same-type session boundary.
   - Filled gaps that complete after that boundary extend to `fillTime`.
   - Confirmed gap labels are centered by bar count, then mapped to an actual stored bar timestamp and drawn with `xloc.bar_time`. This avoids weekend/holiday midpoint snapping without old `xloc.bar_index` anchors.
   - Shared NWOG/NDOG geometry is owned by NWOG when NWOG is enabled: the NWOG label becomes `NWOG / NDOG`, and the duplicate NDOG drawing is suppressed before visible counts or floating selection.

5. Render
   - Drawing objects are only output.
   - Rendering never decides lifecycle state.

## Extension Plan

- Validate NDOG/NWOG overlap behavior across toggles, limits, and hide-filled combinations.
- Add projections, dividers, alerts, and production publishing after lifecycle validation.

## Handoff Notes

Current branch: `gaps-reborn`. Do not merge into `kash-home` until Kaschief explicitly approves.

Committed baseline:

- `3a8af29e feat(gaps-reborn): scaffold RTH lifecycle and draft`

Current working-tree increment:

- Display Mode implemented with Historical, Historical + Floating, and Floating Only.
- Pre-extension hardening completed: color resolvers, box geometry extraction, per-type display/limits, renamed generic functions, NDOG/NWOG detection, event-driven next-session marking, bar-count label centering resolved to bar-time anchors, dynamic NWOG/NDOG overlap ownership, floating-only display, color table matching CLAUDE.md spec.
- Validate in TradingView before committing.

Validation before next commit:

- Toggle `Upcoming RTH` during ETH: draft should show/hide.
- Toggle `showRTH` off: no gaps or drafts visible.
- Switch `Display Mode` to `Historical`: no floating overlays should render.
- Switch `Display Mode` to `Historical + Floating`: selected unfilled gaps should float while non-floating historical gaps remain visible.
- Switch `Display Mode` to `Floating Only`: only selected floating gaps should render; non-floating historical gaps should be hidden and should not consume limits.
- Filled RTH gaps must remain historical.
- Per-type visibility toggles still gate both historical and floating drawings.
- Toggle `Hide Filled`: filled gaps disappear.
- Color table displays all 11 color entries correctly.
- No orphan labels, zero-width boxes, or labels snapped to the right edge on Thursday/Friday NDOGs.
