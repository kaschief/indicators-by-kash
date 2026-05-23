# Gaps Reborn Architecture

Goal: rebuild gaps around explicit lifecycle data, not drawing side effects.

## Current Scope

- RTH gaps only.
- NWOG and NDOG are reserved extension points.
- RTH preview uses a separate `DraftGap`, not a stored `GapRecord`.
- No floating mode, projections, or dividers in the first cut.

## Pipeline

1. Detection
   - Capture RTH close.
   - Create/update a separate RTH draft during ETH.
   - Create a gap at the next RTH open when open differs from prior RTH close.
   - Delete the draft at RTH open whether or not a confirmed gap forms.
   - Mark older RTH gaps with `nextSessionTime` before creating the new gap.

2. State
   - Track `entryDirection`, `penetrationLevel`, `filled`, `fillTime`, and `nextSessionTime`.
   - State updates run on every bar.

3. Selection
   - Decide which stored gaps are visible.
   - The visible limit counts selected visible gaps, not skipped drawings.

4. Layout
   - Resolve the right edge from lifecycle timestamps.
   - Unfilled gaps always extend live.
   - Filled gaps extend at least to the next same-type session boundary.
   - Filled gaps that complete after that boundary extend to `fillTime`.

5. Render
   - Drawing objects are only output.
   - Rendering never decides lifecycle state.

## Extension Plan

- Add NWOG detection by pushing `GapRecord` from Friday close to Sunday 18:00 open.
- Add NDOG detection by pushing `GapRecord` from prior session close to next 18:00 open.
- Add per-type colors and visibility through type dispatch functions.
- Add optional type-specific extension rules only after the shared lifecycle is stable.
