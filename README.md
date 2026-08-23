# indicators • by kash

Nine active TradingView indicators written in Pine Script v6.

Most of this is an exercise in working inside hard constraints. Pine Script runs your whole script once per price bar, gives you only arrays and user-defined types to work with, and caps how many lines, labels, and boxes you can draw on a chart. Building stateful, multi-timeframe tools on top of that means doing your own memory management, deduplication, and object-budget accounting.

## What the indicators do

| Folder | Indicator | One line |
|--------|-----------|----------|
| 06 | Kash OS | Provides chart furniture and time dividers |
| 09 | Pulse | Tracks liquidity pools with per-instrument sweep-depth calibration |
| 13 | Gaps | Detects multiple gap types with floating display and fill tracking |
| 14 | Deviations | Plots statistical expansion levels for intraday sessions |
| 15 | ADR | Shows daily, weekly, and monthly ranges with early-sweep detection |
| 18 | Parallax | Projects higher-timeframe expansion zones and Fibonacci levels |
| 19 | Elder Wand | Draws anchored VWAP structures and statistical bands |
| 20 | Revelio | Builds session profiles, value gaps, and level interactions |
| 21 | Legilimens | Builds configurable volume and delta profiles |

## Repository layout

```
indicators-by-kash/
├── indicators/
│   ├── 06-kash-os/code/kash-os.pine
│   ├── 09-pulse/code/pulse.pine
│   ├── 13-gaps/code/gaps.pine
│   ├── 14-deviations/code/deviations.pine
│   ├── 15-adr/code/adr.pine
│   ├── 18-parallax/code/parallax.pine
│   ├── 19-elderwand/code/elderwand.pine
│   ├── 20-revelio/code/...
│   └── 21-legilimens/code/legilimens.pine
├── PORTFOLIO.md
└── README.md
```

Active indicator sources live directly under each indicator's `code` folder. Revelio keeps its host and library sources in `code/indicator` and `code/libraries`.

## Running them

Each file is a standalone Pine Script v6 indicator. To run one:

1. Open the Pine Script Editor in [TradingView](https://tradingview.com).
2. Paste the contents of a `.pine` file, replacing anything already there.
3. Save, then Add to chart.

## Selected indicator details

The notes below include historical indicators whose source remains available in Git history.

### 1. MBZ Core — gap classification and fill tracking

When price moves quickly it leaves behind ranges where no trading happened. Markets tend to revisit those ranges, but a gap left by a large order behaves differently from one left by a thin, panicky move, so it's worth telling them apart. MBZ Core detects five distinct gap types (Fair Value Gaps, Implied FVGs, Volume Imbalances, True Gaps, RDRB), each with its own detection rule, and tracks how much of each has been filled against configurable thresholds (55%, 85%, 100%).

What made it interesting to build:
- Each gap type needed its own detection logic, but they share a single priority hierarchy (FVG > Implied > RDRB > True Gap > VI) so a lower-priority gap is suppressed when a higher-priority one sits at the same price.
- Stacked zones at the same level used to render on top of each other and become unreadable. I offset them with a small hash on the bar index (`bar_index % 13`) so overlapping zones stay visually distinct.
- Pine caps the number of drawable objects. Rather than silently dropping zones near that cap, I added explicit capacity tiers (4×, 8×, 12×) that grow the internal arrays on request, so the user chooses the depth-versus-performance tradeoff instead of the tool making it invisibly.

### 2. MBZ Prime — session liquidity tracker

Every session (daily, weekly, monthly, Asia, London, New York) leaves a high and a low. The ones that haven't been traded back through are levels price often returns to. MBZ Prime tracks all of them at once across three macro timeframes and six intraday sessions, and tries to be honest about what counts as a real revisit versus a thin overnight spike.

What made it interesting to build:
- State lives in arrays of 360 entries (roughly 18 months) holding each session's high, low, and revisit status.
- A touch outside the 05:00–16:00 NY window is marked provisional rather than confirmed, so a low-volume 2am wick doesn't invalidate a level that should still be live during the trading day. This provisional/confirmed pattern ended up reused across several indicators.
- Display rules are gated by `timeframe.in_seconds()` so daily levels only show on 15m and higher, finer levels only on 5m and lower, without the user configuring anything.
- It supports two different session-time conventions, toggled by one input, sharing all the same code rather than duplicating it.

### 3. MBZ SIF Relay — higher-timeframe zone relay

A trader on a 1-minute chart still wants to see where the 15m and 1h zones are. This pulls zone data from the relevant higher timeframes and draws it on whatever chart you're on, scaled and color-coded correctly.

What made it interesting to build:
- One central function maps each lower timeframe to its correct higher-timeframe pair (1m → 15m + 1h, 5m → 1h + 4h, and so on), so the pairing logic lives in exactly one place.
- `request.security()` fetches the higher-timeframe zone data and it gets rendered natively on the current chart.
- Time math uses pre-computed millisecond constants (`TF_5M_MS = 300000`) rather than recomputing durations, which avoids drift in time comparisons.
- When it's near the object cap it warns the user instead of quietly failing to draw.

### 4. SIF Core — immediate-reversal gap detector

The gaps worth the most attention are the ones that get closed almost as soon as they open. SIF Core looks for a gap that forms and then gets reversed on the same candle or within a few bars, and tracks whether the reversal was immediate or took several bars.

What made it interesting to build:
- Each candidate stores a `formation_time`, which is what makes same-bar detection work correctly without lookahead, on both historical and live bars.
- Multiple reversals from the same source gap get consolidated into one zone with a count instead of stacking up.
- It reuses MBZ Core's five-tier gap hierarchy rather than reimplementing it.
- Body reversals and wick-only reversals render as separate boxes at different opacities so they're distinguishable.

### 5. LTF Algo — failed-breakout detector

When price runs at a swing high or low, fails to break through, and turns back, there are usually resting orders on the other side that price tends to move toward. LTF Algo flags that failure as it happens and projects the target, updating live.

What made it interesting to build:
- Prices are stored as integer tick counts (`price / syminfo.mintick`) rather than floats. Float comparison was producing phantom duplicate levels on forex and crypto; integer tick math removed them.
- Every input is hashed each bar. If any setting changes, all state resets, so stale levels from an old configuration can never linger on the chart.
- Reference caps scale with timeframe automatically (80 on 1m up to 400 on 1D) so the chart is neither cluttered on high timeframes nor starved on low ones.
- Fill detection runs on the unconfirmed bar so a touch shows immediately rather than waiting for the candle to close.

### 6. HTF Algo — multi-timeframe level aggregator

The big reference levels are spread across many timeframes and session windows. HTF Algo collects them: highs/lows from eight timeframes (1M down to 1h), specific time-based prices (the 16:00 NY close), and a few named session ranges, then filters to what's realistically in reach for the day using Average Daily Range.

What made it interesting to build:
- Eight fully independent timeframe slots, each managing its own arrays, fill state, and eligible-level sets.
- The ADR filter computes the average daily range, applies a user multiplier (0.4–2.0×), and clips displayed levels to that window.
- A `TimePriceLevel` type stores up to 50 historical time/price pairs per session with individual revisit flags and timestamps, giving a full history rather than just the latest value.
- Sessions that cross midnight (one runs 21:30–01:29) needed dedicated handling with provisional state and same-day awareness.
- Levels within 0.005% of each other are merged so natural clustering on high timeframes doesn't turn into noise.

### 7. Untagged Opens — open-price tracker

Each bar opens at a price. When price leaves an open behind and hasn't come back to it, that open is a level worth watching. This tracks every un-revisited open, draws them, and marks them once price returns.

What made it interesting to build:
- Open price, bar index, direction, tag status, and tag time are kept in parallel arrays that stay in sync, updated every bar.
- Revisit checks are capped to the most recent 50 bars so the work per bar stays bounded as history grows.
- An insertion sort keeps both nearest-to-price ordering and recency ordering current without rebuilding the arrays each bar.
- Levels are only recorded on confirmed bars so a forming candle can't corrupt the set.

### 8. Pulse — liquidity pool and sweep-depth tracker

Pulse tracks the session highs and lows, key opening prices, and intraday closes where stop orders tend to cluster, across daily/weekly/monthly, all five intraday sessions, premarket and overnight ranges, and a handful of specific open and close times. Beyond just where each level is, it estimates how far price typically pushes past it, calibrated per instrument.

What made it interesting to build:
- An asset registry initialized on the first bar holds per-instrument depth distances (L1/L2/L3) for several futures and crypto symbols, looked up once and cached for constant-time access afterward.
- A `LiquidityPool` type bundles highs, lows, breach times, session boundaries, and nested depth-level arrays into one structure, so a pool moves through the code as a single value.
- A single "mode" input overrides all the individual pool toggles, so switching between preset views is one dropdown rather than twenty checkboxes.
- Day dividers and labels are rendered as a separate concern from the pools, with their own timeframe gate.

### 9. DTT Intraday — 15-session intraday model

A standard Asia/London/NY split is too coarse for short-term work, so this divides the 24-hour cycle into 15 named sessions, each with its own typical range and key internal timestamps. For each one it estimates the expected price expansion so you can see whether a session is moving normally or stretching.

What made it interesting to build:
- The range projection uses the interquartile range (Q3 − Q1) of historical session expansions rather than a mean. A single outlier session would skew an average; the IQR ignores the tails. I made the same choice in DTT Weekly.
- Projection multipliers are parsed from a comma-separated string input (e.g. `"1, 2, 2.5, 4"`) and generate the extension lines dynamically, so there are no hardcoded levels.
- The equilibrium snapshot for each session is taken at a fixed clock minute rather than at a price condition, so it's consistent regardless of volatility.

### 10. DTT Weekly — four-session weekly model

The same framework as DTT Intraday but applied to the trading week, split into four sessions (the longest spans 77 hours). Same statistical tooling, operating across days instead of hours.

What made it interesting to build:
- Day-of-week detection uses Pine's `dayofweek` with named day constants for readability.
- The 77-hour session spans 4.5 calendar days and needed cross-day boundary handling the shorter sessions don't.
- Same IQR-based projection as the intraday version, recalibrated for a weekly lookback (1–30 weeks). Only the lookback length changed; the math was reused as-is.
- Fibonacci levels re-anchor as each multi-day session builds, so they're meaningful from the session's open, not only at its close.

### 11. Gaps — multi-type gap detector with floating display

Tracks five gap types at once (weekly opens, daily opens, regular-hours gaps, balanced price ranges, fair value gaps) and shows how filled each one is. Its distinctive feature is a "floating" mode that keeps unfilled gaps compactly near current price instead of stranded far off-screen at their origin.

What made it interesting to build:
- Floating mode computes a bar-offset display position for each unfilled gap and reverts it to its true historical position once filled.
- Fill tracking measures how far the candle body penetrates the gap, logging wick-only touches separately with a distinct marker.
- Gap classification uses NY-timezone hour crossings (16:59, 18:00, midnight) so it stays correct even on instruments that trade nearly around the clock.
- Lookback is capped at 20 days and 100 bars per type so performance doesn't degrade as history accumulates.

### 12. Deviations — statistical expansion levels

Each intraday session tends to expand a typical amount from its reference point. Deviations measures that and plots where price is statistically likely to stall (midpoint, 1×, 1.5×, 2× of range), across 13 sessions at once, with touch alerts and a simple directional read from the prior session's close.

What made it interesting to build:
- A `SessionConfig` type separates each session's configuration (mode, times, colors, rules, extension settings) from its runtime state, so adding or changing a session is data, not new code.
- It stores separate high/low values for candle bodies and full wick ranges, allowing analysis at two levels of precision.
- It uses the same provisional/confirmed revisit logic as MBZ Prime and HTF Algo.
- Midnight-crossing sessions set a single flag that adjusts all the downstream day-tracking logic, instead of scattering special cases through the code.

### 13. ADR — Average Daily Range with early-sweep detection

Every instrument has a typical daily range, which tells you roughly where price is likely to exhaust. ADR maps that range and subdivides it. The interesting subdivision is the 1/3 mark, where price often sweeps early in the session before reversing toward the real target. ADR makes that level prominent and detects the early sweep (a "Judas Swing") so it's something to watch for rather than get caught in.

What made it interesting to build:
- Two range-definition modes (NY midnight-to-midnight, or the daily candle) for traders who define the day differently.
- A `LevelConfig` type holds multiplier, label, color, style, and width per level, so level management is data-driven rather than repeated blocks.
- An `AlertState` type tracks per-level, per-day alert status to prevent duplicate alerts firing on the same level in the same session.
- Past 10–20 days of ADR levels render faded, giving a volatility baseline without crowding the current day.

### 14. FVG Atlas — multi-timeframe Fair Value Gap scanner

Fair Value Gaps are among the most-watched patterns. FVG Atlas scans for them across up to six higher timeframes at once, tracks fill percentage per gap, and makes higher-timeframe gaps visually heavier than smaller ones.

What made it interesting to build:
- `Fvg`, `FvgBox`, `FvgStore`, and `HtfSettings` types keep detection, storage, and display separate, so how a gap is found is decoupled from how it's drawn.
- Mitigation is checked in two phases: confirmed higher-timeframe candles with `lookahead_on`, and the current forming candle with `lookahead_off`, which gives real-time accuracy without lookahead bias leaking into historical bars.
- Each gap tracks the deepest body penetration seen (`max_body_fill`) as a continuous fill measure rather than a binary filled/unfilled flag.
- Visual weight is derived from the timeframe ranking, so a 4h-plus gap on a sub-4h chart is emphasized automatically.

## Patterns that show up across the suite

A handful of decisions recur because the same problems recur. These are the ones I'd point to as the real takeaways.

**Integer tick math instead of floats.** Price comparisons and deduplication are done in tick units (`price / syminfo.mintick`). Float comparison produced phantom duplicate levels on forex and crypto; integer ticks eliminated them. Used everywhere prices are compared.

**Provisional vs. confirmed state.** Overnight touches are held as provisional until the 05:00–16:00 NY window confirms them, so thin off-hours moves don't invalidate levels that should still be live. The same small state machine appears in MBZ Prime, HTF Algo, and Deviations.

**Input hashing for state resets.** LTF Algo and HTF Algo hash all settings every bar and wipe state when anything changes, so an old configuration never leaves stale objects on the chart.

**Explicit object-budget management.** Pine caps drawable objects. Instead of silently dropping work near the cap, the capacity tiers (4×/8×/12×) grow arrays on request and warn when limits are close, leaving the depth-versus-performance call to the user.

**IQR instead of averages.** The range models (DTT Intraday, DTT Weekly, ADR, Deviations) use the interquartile range and range subdivisions rather than means, so one outlier session doesn't distort the expected range.

**Parameterized, not duplicated.** Detection and calculation functions take the data they operate on as parameters rather than being copied per timeframe or session. Only genuinely per-context state (each session's own arrays) is separate, so a fix to shared logic applies everywhere at once.
