# Parallax Fibonacci Overlay — Implementation Plan

Status: **APPROVED — ready to implement**
Last updated: 2026-04-29

## Goals

1. Rename existing zone tiers from `Typical / Average` → `Inner / Outer` everywhere (variable names, inputs, tooltips, comments, color table, header doc) so a reader can immediately tell which line is which.
2. Port DTT's Fibonacci overlay onto each parallax slot — anchored to the slot's outer band, with the same 9 levels, the same default colors, and the same per-level styling controls.
3. Add a per-slot fib enable so the user controls which slots actually draw the fib (since 4 × 9 levels gets noisy).
4. Add a global mode toggle: **Static** vs **Trailing**.

## Rename: Typical/Average → Inner/Outer

Rationale: "Typical" (median) sits closer to the open; "Average" (mean) sits further out. "Inner / Outer" is self-descriptive.

| Old | New |
|---|---|
| Typical High / `typicalHigh` | Inner High / `innerHigh` |
| Typical Low / `typicalLow` | Inner Low / `innerLow` |
| Average High / `averageHigh` | Outer High / `outerHigh` |
| Average Low / `averageLow` | Outer Low / `outerLow` |
| `s.typH / s.typL` | `s.innH / s.innL` |
| `s.avgH / s.avgL` | `s.outH / s.outL` |

Distribution stays Distribution (third tier outside Outer).

Files touched: `parallax.pine` only. Header comment, `compute_levels` return tuple, `draw_slot_current` body, tooltips, comments. No external consumers.

## Fib feature spec

### Anchors

- Upper anchor = **Outer High** (= `htfO + meanHO`)
- Lower anchor = **Outer Low**  (= `htfO − meanOL`)

### Modes (single global toggle)

1. **Static** — anchors stay locked at Outer High / Outer Low for the life of the HTF candle.
2. **Trailing** — anchors expand outward when the live HTF candle's running high/low breaches the outer band:
   ```
   fib_high = max(outerHigh, htfRunningHigh)
   fib_low  = min(outerLow,  htfRunningLow)
   ```
   Anchors only ever expand; never contract. Matches DTT's session-fib trailing behavior.

No internal state needed — both modes are pure functions of the slot's current bar values (we already have running HTF high/low via `lookahead_on` security calls).

### Levels (9, identical to DTT)

`0 / 0.214 / 0.295 / 0.382 / 0.5 / 0.618 / 0.705 / 0.786 / 1.0`

Computation:
```
range = fib_high - fib_low
fib_X = fib_low + range * X
```

### Per-level controls (universal — one set, applied to every enabled slot)

| Level | Default Color (RGB, transparency) | Default Width |
|---|---|---|
| 1.0   | (46, 46, 46) t75      | 2 |
| 0.786 | (236, 64, 122) t40    | 2 |
| 0.705 | (244, 143, 177) t15   | 2 |
| 0.618 | (240, 98, 146) t45    | 2 |
| 0.5   | (49, 121, 245) t75    | 2 |
| 0.382 | (102, 187, 106) t45   | 2 |
| 0.295 | (102, 187, 106) t15   | 2 |
| 0.214 | (102, 187, 106) t15   | 2 |
| 0     | (74, 74, 74) t75      | 2 |

Each level row: `show toggle | color picker | width int (1–5)`. Same as DTT.

### Per-slot fib enable

Adds one bool per slot in the `HTF Slots` group, inline with that slot's existing row:
```
[Slot N show] [Fib] [Manual] [TF] [Color] [History]
```
Only slots with both Slot Show ✓ and Fib ✓ render the fib.

### Global fib controls

- `Fib` master on/off (group=Fibonacci)
- `Mode` dropdown: Static / Trailing
- `Style` dropdown: Solid / Dashed / Dotted (one global style, same as DTT)
- `Show Labels` toggle — labels match DTT exactly:
  - x = midpoint of HTF candle's time range: `mid_ts = (leftT + rightT) / 2`
  - y = the fib level's price
  - `style = label.style_none` → text-only, no callout, sitting directly on the line
  - `size = size.tiny`, `textalign = text.align_center`
  - `textcolor` inherits the per-level color so each label matches its line
  - Text strings: `"0"`, `"0.214"`, `"0.295"`, `"0.382"`, `"0.5"`, `"0.618"`, `"0.705"`, `"0.786"`, `"1"`

### Drawing scope (Phase 1)

**Current HTF candle only**, per enabled slot. Drawn in `barstate.islast` block, deleted/redrawn each bar (matches existing `draw_slot_current` pattern).

History (drawing fibs on past HTF candles) is **out of scope for Phase 1**. We can add it later by snapshotting `[fib_high, fib_low]` at HTF transition and pushing line tuples into a history array, mirroring the existing `histBoxes` approach. Defer until requested.

## State / type changes

```pine
type SlotState
    array<box>   histBoxes
    array<line>  histDistLines
    box   fillUp
    box   fillLo
    line  innH        // renamed from typH
    line  innL        // renamed from typL
    line  outH        // renamed from avgH
    line  outL        // renamed from avgL
    line  midUp
    line  midDn
    line  distP
    line  distM
    array<line> fibLines    // new — up to 9 active fib lines
```

Drawing helper signature:
```pine
draw_slot_fib(SlotState s, bool enabled, string htfSafe,
              float outerHigh, float outerLow, float htfH, float htfL,
              bool trailing)
```

## Color reference table

Append fib level rows so the table stays in sync with active colors. Rows are conditional:
- Fib master must be ON
- The individual level's show toggle must be ON

So the table grows/shrinks dynamically as the user toggles levels. Header + 4 slots + midline always present (when `showTable`). Fib rows appended only when both gates pass. Row count computed at draw time.

## Order of changes (for review-ability)

1. Commit A — pure rename Typical/Average → Inner/Outer. No behavior change.
2. Commit B — add fib inputs (group, mode, style, per-level rows, per-slot enable). No drawing yet.
3. Commit C — add `draw_slot_fib` and wire into `barstate.islast`. Static mode only.
4. Commit D — add Trailing mode branch.
5. Commit E — extend color reference table with fib rows.

Each commit independently testable.

## Decisions (locked 2026-04-29)

1. **Labels** → DTT-style: text-only (`label.style_none`) at midpoint of time range, AT the level's price, color = per-level color, size tiny. Included in Phase 1.
2. **Color table fib rows** → conditional on both `Fib master ON` AND the individual level's row being ON.
3. **Default mode** → Static.
4. **History** → 1 (current only) for Phase 1.
5. **Fib Only mode** → TBD, deferred. Not in Phase 1.

## Phase 2 candidates (not yet scheduled)

- History > 1 (draw fibs on past HTF candles, frozen at their final trailed anchors)
- Fib Only display mode (hides Inner/Outer/Distribution lines and zone fills)
- Right-edge price tags as an alternate label position
