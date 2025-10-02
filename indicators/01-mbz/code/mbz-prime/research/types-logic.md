# Playful Highs & Lows — Candle Pattern Logic

## MBZ Taxonomy Reference

The Playful experiments now align with the runtime MBZ metadata schema. When building or testing liquidity variants use these shared enums:

- **Source context**
  - `SOURCE_FAMILY_IMBALANCE`, `SOURCE_FAMILY_LIQUIDITY`
  - `IMBALANCE_SOURCE_TYPE_FVG`, `IMBALANCE_SOURCE_TYPE_IMPLIED`, `IMBALANCE_SOURCE_TYPE_VOLUME`, `IMBALANCE_SOURCE_TYPE_GAP`, `IMBALANCE_SOURCE_TYPE_RDRB`
  - `LIQUIDITY_SOURCE_TYPE_DAILY`, `LIQUIDITY_SOURCE_TYPE_WEEKLY`, `LIQUIDITY_SOURCE_TYPE_MONTHLY`, `LIQUIDITY_SOURCE_TYPE_SESSION`
- **Formation rules** (`formation_rule` / former `variant_kind`)
  - Gap: `FORMATION_RULE_GAP_STANDARD`
  - Liquidity: `FORMATION_RULE_LIQUIDITY_IMMEDIATE`, `FORMATION_RULE_LIQUIDITY_STANDARD`, `FORMATION_RULE_LIQUIDITY_DELAYED`
- **Pool boundary** (liquidity-only): `POOL_BOUNDARY_HIGH`, `POOL_BOUNDARY_LOW`, `POOL_BOUNDARY_NONE`

Imbalance records always use `FORMATION_RULE_GAP_STANDARD` and `POOL_BOUNDARY_NONE`. Liquidity records must specify both the formation rule and the boundary that was swept: bullish MBZ ⇒ `POOL_BOUNDARY_LOW`, bearish MBZ ⇒ `POOL_BOUNDARY_HIGH`.

---

This note documents how the three candle-pattern highlights (Immediate, Standard, and Delayed) are derived inside `indicators/01-mbz/code/research/playful-highs-lows.pine`. It is written so another developer can reproduce the same behaviour in a different script or language.

The key entry point is the helper:

```
detect_pool_patterns(show_pool,
                     highlight_immediate,
                     highlight_standard,
                     highlight_delayed,
                     levels_high,
                     levels_low,
                     high_breach_times,
                     low_breach_times)
```

It returns a tuple of booleans `[immediate_found, standard_found, delayed_found]` signalling whether the current bar satisfies each pattern for the supplied liquidity pool. The function is called once per pool (daily, weekly, sessions, etc.).

All checks are performed only when:

- The pool is enabled (`show_pool`).
- At least one highlight toggle (`highlight_*`) is active; otherwise the pattern is skipped for that pool.
- We have at least one stored high/low value plus associated breach timestamps.
- The previous bar contains valid OHLC data (guards against `na`).

For every pattern we need two pieces of context:

1. **Pool level** – Each pool stores historical highs and lows (`levels_high`, `levels_low`) with the timestamps of the bar that first breached them (`high_breach_times`, `low_breach_times`).
2. **Two-bar window** – Many checks compare the *prior* bar (`[1]`) with the *current* bar (`[]`). We also compute the midpoint of the prior candle body: `a_mid = (open[1] + close[1]) / 2.0`, which acts as a line in the sand for closes.

Below each pattern is broken down into bullish and bearish branches, mirroring blocks `high ↔ low` in the source. Terms like “breach bar” refer to the bar whose timestamp equals the stored breach time. The “response bar” is the bar being evaluated now.

---

## Immediate Pattern

**Intent**: Detect a sharp, single-bar rejection immediately after a level is breached with a wick-only probe.

### Bullish rejection (level is a pool high)

1. Identify a stored high level whose breach timestamp equals the *current* bar time (`array.get(high_breach_times, i) == time`). This means the current bar is the first to hit or exceed the level.
2. Require that the *previous* bar sat entirely below the level: `high[1] < level` and `close[1] < level`.
3. On the current bar: it must open below `level`, spike above it (`high > level`), but close back below the midline of the prior candle (`close < a_mid`). The candle itself must finish bearish (`close < open`).
4. When all hold, the pattern flags `immediate_found = true`.

### Bearish rejection (level is a pool low)

1. Look for a low-level record whose breach timestamp matches the current bar.
2. Previous bar must be entirely above the level (`low[1] > level`, `close[1] > level`).
3. Current bar opens above, wicks through the level (`low < level`), yet closes above the prior midpoint (`close > a_mid`). The candle must finish bullish (`close > open`).
4. Satisfying these flips `immediate_found` true.

If neither branch succeeds, `immediate_found` stays false for this pool.

---

## Standard Pattern

**Intent**: Spot the classic “wick run” where the breach was yesterday/last bar and the next candle confirms a reversal without printing a new extreme.

### Bullish confirmation (working off a breached high)

1. Locate a high-level breach event with timestamp equal to `time[1]`, meaning the previous bar tagged the level.
2. The breach bar must have been wick-only: `open[1] < level`, `high[1] > level`, `close[1] < level`.
3. Evaluate the current bar:
   - It opens back inside the range (`open < level`).
   - It closes below the prior midpoint (`close < a_mid`).
   - It does **not** set a new high (`high < high[1]`).
   - The bar must be bearish (`close < open`).
4. Passing all three evidences that the market rejected the run and is moving lower, so `standard_found` becomes true.

### Bearish confirmation (breached low)

1. Check low-level records breached on `time[1]`.
2. Previous bar wick-only conditions invert: `open[1] > level`, `low[1] < level`, `close[1] > level`.
3. Current bar must: open above (`open > level`), close above the prior midpoint (`close > a_mid`), avoid a new low (`low > low[1]`), and finish bullish (`close > open`).
4. These constraints flip `standard_found` to true.

If neither side qualifies, `standard_found` remains false.

---

## Delayed Pattern

**Intent**: Capture a slower reversal that occurs one bar after a *body-close* breakout through the level.

### Bullish failure (after a high closes above)

1. Find a high-level whose breach time is `time[1]` (breach occurred last bar).
2. The breach bar must have closed beyond the level: `close[1] > level`.
3. Current bar then:
   - Opens outside/on the breakout side (`open > level`).
   - Closes back below the prior midpoint (`close < a_mid`).
   - Ends bearish (`close < open`).
4. Meeting both signals the breakout stalled and `delayed_found` becomes true.

### Bearish failure (after a low closes below)

1. Match a low-level breached on the previous bar.
2. Require `close[1] < level` (body close beneath the level).
3. Current bar opens outside (`open < level`) but closes back above the midpoint (`close > a_mid`) and ends bullish (`close > open`).
4. Conditions satisfied → `delayed_found = true`.

---

## How Highlights Are Combined

For each enabled pool, the caller aggregates the tuple into three global flags:

```
immediate_detected := immediate_detected or pool_immediate
standard_detected  := standard_detected  or pool_standard
delayed_detected   := delayed_detected   or pool_delayed
```

Finally, bar colouring happens with precedence Delayed > Standard > Immediate, using the user-selected colours when the relevant global flag is true.

---

## Implementation Notes

- The logic is level-agnostic: the same function supports daily, weekly, monthly, and session pools by passing in the corresponding arrays/toggles.
- Every branch guards against missing data (`na`) to prevent runtime errors in Pine Script.
- Because Pine evaluates the entire history, remember that `time`, `time[1]`, etc., refer to UTC milliseconds; the arrays store the same values when the breach was recorded.
- The midpoint `a_mid` is computed off the prior candle regardless of bullish/bearish context, ensuring symmetric behaviour around wick rejections.

This breakdown should let you port the detection to other scripts or languages with equivalent candle data feeds.
