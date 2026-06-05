# indicators • by kash

> A suite of 14 custom-built Pine Script v6 indicators for TradingView, engineered from scratch to surface institutional market microstructure in real time. No libraries, no wrappers — every algorithm, detection system, and data structure was designed and written from the ground up.

Markets move because of imbalances — unfilled orders, session liquidity pools, algorithmic stop hunts, and the footprints those leave behind on a chart. This suite is a real-time microstructure engine built to detect and track those imbalances the moment they form, across multiple timeframes, with production-quality state management and clean rendering logic.

~13,500 lines of Pine Script v6 across 14 indicators. Every feature exists because a real trading edge required it.

---

## Indicators at a Glance

| # | Indicator | What it does |
|---|---|---|
| 1 | **MBZ Core** | Detects and tracks 5 gap types as tradable zones, with real-time fill tracking and priority hierarchy |
| 2 | **MBZ Prime** | Tracks session liquidity pools across daily/weekly/monthly and 6+ intraday sessions |
| 3 | **MBZ SIF Relay** | Auto-selects higher-timeframe pairings and broadcasts HTF zone context onto any LTF chart |
| 4 | **SIF Core** | Detects gaps that get closed immediately — institutional traps that got unwound |
| 5 | **LTF Algo** | Identifies liquidity failures at swing highs/lows and draws algorithmic targets in real time |
| 6 | **HTF Algo** | Aggregates BSL/SSL levels from 8 timeframes plus session and time-based levels, filtered by ADR |
| 7 | **Untagged Opens** | Tracks unfilled bar opens as magnetic price targets, separating live draws from tagged history |
| 8 | **Pulse** | Tracks all major liquidity pools with per-instrument sweep depth calibration across sessions, opens, and closes |
| 9 | **DTT Intraday** | Proprietary 15-session intraday model with IQR-based range projections and dynamic Fibonacci |
| 10 | **DTT Weekly** | Same DTT framework at the weekly level — 4 named sessions with AMRP, Fibonacci, root zones |
| 11 | **Gaps** | Detects NWOG, NDOG, RTH, BPR, and FVG gaps with floating mode and fill percentage tracking |
| 12 | **Deviations** | Measures statistical price expansion from 13 session ranges — deviation levels, midpoints, Fibonacci |
| 13 | **ADR** | Plots Average Daily Range subdivisions with Judas Swing detection and per-level alerts |
| 14 | **FVG Atlas** | Scans Fair Value Gaps across up to 6 higher timeframes with real-time mitigation tracking |

---

## Repository Structure

```
indicators-by-kash/
├── indicators/
│   ├── 01-mbz/
│   │   └── code/
│   │       ├── mbz-core/production/mbz-core.pine
│   │       ├── mbz-prime/production/mbz-prime.pine
│   │       └── mbz-sif-relay/production/mbz-sif-relay.pine
│   ├── 02-sif/
│   │   └── code/production/sif-core.pine
│   ├── 03-ltf-algo/
│   │   └── code/development/ltf-algo.pine
│   ├── 04-htf-algo/
│   │   └── code/development/htf-algo.pine
│   ├── 05-untagged-opens/
│   │   └── code/development/untagged-opens-dev-v1.2-tagged-levels.pine
│   ├── 06-kash-os/
│   │   └── code/production/kash-os.pine
│   ├── 11-dtt-intraday/
│   │   └── code/development/dtt-intraday.pine
│   ├── 12-dtt-weekly/
│   │   └── code/development/dtt-weekly.pine
│   ├── 13-gaps/
│   │   └── code/development/gaps.pine
│   ├── 14-deviations/
│   │   └── code/development/deviations.pine
│   ├── 15-adr/
│   │   └── code/development/adr.pine
│   └── 17-fvg-atlas/
│       └── code/development/fvg-atlas.pine
├── PORTFOLIO.md
└── README.md
```

Indicators tagged `production` are stable and published. Those tagged `development` are in active iteration.

---

## How to Use

These are Pine Script v6 indicators for [TradingView](https://tradingview.com).

1. Open TradingView and go to the **Pine Script Editor** (bottom panel)
2. Open the `.pine` file of the indicator you want
3. Copy the full contents
4. Paste into the Pine Script Editor, replacing any existing code
5. Click **Save**, then **Add to chart**

Each indicator is self-contained — no external dependencies, no libraries, no imports required.

---

## The Indicators

---

### • MBZ Core — Median Body Zones

**In plain terms:** When price moves fast, it leaves gaps behind — regions where no trades actually happened. Those gaps act like magnets; price tends to return and fill them. But not all gaps are created equal. A gap left by an institutional order block is very different from a gap left by retail panic. MBZ Core tells them apart, draws the zones, and tracks in real time how much of each zone has been filled — automatically flagging them as valid or invalid as price moves through them.

**The edge it gives traders:**
- See which price zones still have unfilled institutional vs. retail order flow
- Know exactly when a zone has been "used up" based on configurable fill thresholds (55%, 85%, 100%)
- A workspace mode auto-activates during New York hours to surface only the nearest, most actionable zones — decluttering the chart exactly when it matters most

**The engineering:**
- Detects 5 distinct gap types (Fair Value Gaps, Implied FVGs, Volume Imbalances, True Gaps, RDRB) with separate detection logic for each
- Implied FVGs require the displacement candle's body to be ≥1.25× the average of the two prior candles — a quantitative confirmation of institutional strength
- A **stagger hash algorithm** (bar index mod 13) creates unique visual offsets so stacked zones at the same price level never blend into each other
- A **dynamic capacity system** (Boost 4×, Ultra Boost 8×, Ultra Pro Boost 12×) multiplies internal arrays on demand so users can access deeper history without hitting Pine's hard object limits
- Gap type hierarchy (FVG > Implied > RDRB > True Gap > VI) suppresses lower-priority gaps when a higher-priority one exists at the same level — the chart only shows what matters most

---

### • MBZ Prime — Session Liquidity Tracker

**In plain terms:** Every trading session — daily, weekly, monthly, Asia, London, New York — leaves behind high and low prices where traders placed stops. Those unswept highs and lows are "liquidity pools": money waiting to be taken. MBZ Prime tracks all of them simultaneously, shows which are tapped and which aren't, and handles the edge cases around sessions that cross midnight or span multiple days.

**The edge it gives traders:**
- See all unmitigated session highs and lows in one place, across three macro timeframes and six intraday sessions
- Know immediately when overnight price action was a real mitigation vs. a low-volume spike that shouldn't count
- Supports two complete session frameworks — Standard and "NINE's" variant — for different trading communities and methodologies

**The engineering:**
- Arrays of 360 entries (~18 months) store each session's high/low and mitigation state in memory
- **Provisional mitigation logic**: if price touches a level outside the 05:00–16:00 NY window, it's flagged as provisional — not confirmed until the next proper trading session. Prevents false signals from 2am spikes
- Timeframe gating via `timeframe.in_seconds()` enforces sensible display rules automatically: daily zones only on 15m+ charts, DTT zones only on ≤5m
- The NINE variant is a complete parallel set of session time constants — toggled by one input, zero code duplication

---

### • MBZ SIF Relay — Higher-Timeframe Zone Broadcaster

**In plain terms:** A 1-minute chart trader needs to know where the 15-minute and 1-hour zones are. Manually cross-referencing multiple charts constantly is impractical. The Relay solves this by automatically figuring out which higher timeframes are relevant for whatever chart you're on, pulling zone data from those timeframes, and displaying it right on your current chart — correctly scaled, color-coded, and visually distinct.

**The edge it gives traders:**
- Higher-timeframe context on any chart with zero manual configuration — it just works
- Visual distinction between primary and secondary HTF zones so you always know which timeframe a zone belongs to
- A draw budget system prevents silent rendering failures — when near object limits, the indicator warns you rather than quietly dropping zones

**The engineering:**
- A single centralized pairing function maps every supported LTF to its correct primary and secondary HTF (e.g., 1m → 15m + 1H, 5m → 1H + 4H) — one place to maintain, no scattered conditionals
- `request.security()` fetches live zone data from both HTF contexts and renders it natively on the current chart
- Secondary zones render 1.8× longer than primary zones for instant visual separation
- Pre-calculated millisecond constants (`TF_5M_MS = 300000`) are used throughout for precision time arithmetic — no floating-point drift on time comparisons

---

### • SIF Core — Sweep Inversion Formation Detector

**In plain terms:** The most interesting gaps aren't just the ones that form — they're the ones that get closed immediately. When a gap opens and price closes it on the same candle (or within a few candles), that's an inversion: a trap that got unwound. Those are some of the highest-probability reversal signals on a chart. SIF Core detects them in real time, tells you whether the inversion was immediate or multi-bar, and tracks their invalidation over time.

**The edge it gives traders:**
- Immediate identification of institutional traps that got arbitraged — a strong reversal signal
- Backtesting mode flips the display to show only historical invalidated SIFs, enabling clean performance analysis of the pattern
- Per-gap-source breakdown in labels (e.g., `SIF⁺ [3] fvg, imp`) so you know exactly what's behind each inversion

**The engineering:**
- `formation_time` field on each candidate record enables true real-time same-bar detection — no lookahead, works correctly on both historical and live bars
- Zone consolidation groups multiple SIFs from the same source gap into a single visual zone with a count, preventing clutter on active instruments
- The same five-tier gap hierarchy from MBZ Core carries over — suppression logic is shared, not duplicated
- Separate wick highlight boxes with different opacity levels (body at 90%, wick at 95%) precisely differentiate body inversions from wick-only sweeps

---

### • LTF Algo — Lower-Timeframe Liquidity Failure Detector

**In plain terms:** Traders place limit orders at swing highs and lows. When price approaches those levels, fails to break through, and then reverses — that's a liquidity failure, and an algorithmic move toward those unfilled orders typically follows. LTF Algo detects those failures the moment they happen, draws the projected target, and updates live as price approaches or fills it.

**The edge it gives traders:**
- Real-time visual targets that update tick-by-tick — not lagging candle-close signals
- Separate tracking of open draws vs. filled draws so you always know which targets are still live
- Automatic timeframe-adaptive caps so the indicator is never cluttered on higher-timeframe charts or starved of context on lower ones

**The engineering:**
- **Tick-based deduplication**: all prices converted to `price / syminfo.mintick` before storage — eliminates float precision artifacts that cause phantom duplicate levels on forex and crypto instruments
- **Input change hashing**: all settings are hashed on every bar; if any input changes, state resets completely — no stale levels from a prior configuration ever contaminate the display
- Timeframe-adaptive reference caps: 80 on 1m, 100 on 5m, 150 on 15m, 200 on 1H, 300 on 4H, 400 on 1D — automatically set, never requiring manual tuning
- Fill detection runs on unconfirmed bars for instant visual feedback the moment a level is touched
- Tooltips on every draw line show type, the exact time the reference wick formed, and the chart timeframe — full provenance without cluttering the chart

---

### • HTF Algo — Higher-Timeframe Multi-Slot Liquidity Aggregator

**In plain terms:** The monthly, weekly, and daily charts have the most important liquidity targets — but they're spread across multiple windows. HTF Algo aggregates them all: BSL/SSL levels from 8 timeframes (1M, 1W, 1D, 12H, 8H, 7H, 4H, 1H) plus time-based levels (16:00 NY close prices) and session range levels (Asia Open, Evening Range, Rafael's Range) — filtered by what's statistically within reach today.

**The edge it gives traders:**
- All macro and HTF liquidity targets on one chart, filtered to only what's within the day's probable range via ADR
- Automatic confluence detection: swing and intraday levels only appear when 2+ source types align at the same price — built-in signal quality filtering
- Provisional mitigation with NY session confirmation so overnight sweeps don't count until they're confirmed

**The engineering:**
- 8 fully independent parallel HTF slots, each managing its own BSL/SSL arrays, fill tracking, open flags, and eligible tick sets
- ADR filtering calculates the average daily high-low range, applies a user-defined multiplier (0.4–2.0×), and clips displayed levels to within that price window
- `TimePriceLevel` type stores up to 50 historical time-price pairs per session with individual mitigated flags and mitigation timestamps — a full audit trail
- `SessionRangeLevel` type handles midnight-crossing sessions (Rafael's Range 21:30–01:29) with provisional vs. confirmed state tracking and same-day awareness
- Level merging collapses levels within 0.005% of each other — natural clustering on higher timeframes never becomes visual noise

---

### • Untagged Opens — Open Price Magnet Tracker

**In plain terms:** Every bar opens at a specific price. When price moves away from that open and never comes back, that open becomes a magnetic target — liquidity sitting there, waiting to be collected. Untagged Opens tracks every unfilled bar open on the chart, renders them as live target levels, and marks them as "tagged" the moment price returns to touch them. Tagged levels stay visible in a faded style so you always have the full picture.

**The edge it gives traders:**
- Live target levels at every unfilled open — drawn the moment a bar closes, updated the moment they're touched
- Closest open draws are always most prominent thanks to proximity sorting — you always know which target is nearest
- Tagged history stays on screen, faded and dashed, so you can see the full draw lifecycle without it competing with live targets

**The engineering:**
- Parallel arrays track open price, bar index, direction, tag status, and tag time — all in sync, updated every bar
- Tagging checks are capped at the most recent 50 bars so the lookback never grows unbounded as history accumulates
- **Insertion sort** maintains both proximity ordering and recency ordering without full array rebuilds each bar
- All level recording happens on `barstate.isconfirmed` only — forming candles never corrupt the level set

---

### • Pulse — Liquidity Pool & Sweep Depth Tracker

**In plain terms:** Liquidity pools are the session highs and lows where stop orders cluster — the daily high, the overnight low, the premarket range, the 9:30 open price. When price sweeps those levels, it's rarely a random move; it's targeting the orders sitting there. Pulse tracks all of those pools simultaneously — daily, weekly, monthly, all five intraday sessions, premarket, overnight, key opens (8:30, 9:30, 4H, 1H, midnight), and the 14:00 and 16:00 closing prices — and shows which have been swept and which haven't. It also tracks *how deep* into each pool price reached, calibrated per instrument so that a sweep on NQ looks different from a sweep on ES.

**The edge it gives traders:**
- Every major liquidity pool visible on one chart — session highs/lows, key opens, and intraday closes all in one view
- Liquidity Depth levels (L1, L2, L3) show per-instrument sweep targets above and below each pool — so you know not just where the pool is, but how far into it price typically reaches
- "Pulse Mode" lets you instantly switch between preset views (e.g., Range Box + Key Opens + HTF, Liquidity Map, Today mode) without touching individual toggles
- Asset-aware by default: NQ, ES, YM, RTY, GC, CL, BTC, ETH each have pre-calibrated depth distances built in

**The engineering:**
- **Asset family registry**: an array of `AssetFamily` types initialized on the first bar, each storing per-instrument L1/L2/L3 distances for daily, weekly, and monthly pools — looked up once, cached for O(1) access on every subsequent bar
- `LiquidityPool` type tracks highs, lows, breach times, session boundaries, and nested `LiquidityDepthLevels` arrays for both HTF and intraday depth tracking — all in one composable structure
- `IntradayClosingPriceTracker` handles the 14:00 and 16:00 close prices with the same provisional mitigation logic (13-hour delay before a close can be mitigated) used across the suite
- Pulse Mode filter is a single input that overrides all individual pool toggles — switching views is one dropdown, not 20 checkboxes
- Time dividers with day labels and Monday highlights are rendered separately from pools, with their own timeframe gate (≤1H)

---

### • DTT Intraday — Proprietary 15-Session Intraday Model

**In plain terms:** The standard Asia/London/NY session breakdown is too coarse for precision scalping. The DTT model — built from years of research into how institutions move price — divides the 24-hour cycle into 15 named sessions, each with its own character, typical range, and key internal timepoints. For each session, the indicator calculates the statistically expected price expansion, so you know immediately whether a session is running within its normal range or breaking out.

**The edge it gives traders:**
- Know the statistically typical expansion for each of the 15 sessions — immediately visible whether price is moving normally or making an outsized move
- Live Fibonacci levels anchored to the developing session high/low, updating in real time as the session builds
- Root zones show where price equilibrated within each session — a reference for mean-reversion entries

**The engineering:**
- **IQR-based AMRP** (Average Model Range Projection): collects historical session expansion data, calculates Q1 and Q3, uses Q3−Q1 as the expected band — explicitly chosen over a mean because outlier sessions would inflate a simple average; the IQR is inherently outlier-resistant
- Projection multipliers are parsed from a comma-separated string input (e.g., `"1, 2, 2.5, 4"`) and generate bidirectional extension lines dynamically — no hardcoded levels, fully configurable
- Root capture is time-based, not price-based: the equilibrium snapshot is taken at a specific clock minute within each session, ensuring consistency regardless of volatility
- 15 sessions × 3 intervals = 45 research-backed time constants — proprietary market structure encoded directly into the software

---

### • DTT Weekly — Proprietary 4-Session Weekly Model

**In plain terms:** For swing traders, the 15-session intraday breakdown is too granular. DTT Weekly applies the same framework at the weekly level, dividing the trading week into 4 named sessions: Iscariot, Aries, Ash, and the 77-hour mega-session Icarus. Same statistical tools — expected range, Fibonacci levels, root zones, interval markers — but operating across days instead of hours.

**The edge it gives traders:**
- Know the typical weekly expansion for each session — is this week running wide or tight relative to history?
- Fibonacci targets anchored to the live weekly session high/low, building as the week progresses
- Icarus (Wed–Sun, 77 hours) captures the bulk of weekly trend continuation — a stable, high-timeframe reference

**The engineering:**
- Day-of-week session detection uses Pine's `dayofweek` constant with hardcoded day constants — clean, readable, and maintainable
- Icarus spanning 4.5 calendar days required dedicated cross-day boundary handling that other session-based indicators simply don't have to solve
- Same IQR-based AMRP as DTT Intraday, calibrated for weekly lookback (1–30 weeks) — the statistical methodology carries across both timeframe scales
- Fibonacci levels re-anchor dynamically as each multi-day session builds its range — meaningful from the moment the session opens, not just at its close

---

### • Gaps — Multi-Type Gap Detector

**In plain terms:** When price jumps between sessions or within a trading day, it leaves a gap — an area where no trading happened. These gaps have strong magnetic pull; markets tend to fill them. Gaps tracks every major gap type automatically — weekly opens, daily opens, regular trading hours gaps, balanced price ranges, and fair value gaps — shows exactly how filled each one is, and uses a "floating mode" that keeps unfilled gaps visible near price without blocking live candles.

**The edge it gives traders:**
- Five gap types tracked simultaneously (NWOG, NDOG, RTH, BPR, FVG) without needing multiple indicators
- Floating mode keeps the most recent unfilled gaps compact and visible near price — they snap back to their historical position when filled
- Fill percentage shown per gap so you know exactly how filled each zone is — wick-only touches are flagged separately from body fills

**The engineering:**
- Floating mode calculates a bar-offset position for each unfilled gap, displaying it compactly near current price — reverts to historical position on fill
- Fill percentage tracks candle body penetration depth into the gap, with wick-only touches logged separately using a ⋄ symbol
- Session detection uses NY timezone hour crossing (`16:59`, `18:00`, midnight) to correctly classify gap type even on instruments that trade 23 hours
- Historical lookback is capped at 20 days and 100 bars per type — the indicator never degrades as history grows

---

### • Deviations — Statistical Price Expansion Mapper

**In plain terms:** Every intraday session has a typical amount it expands from its starting reference point. Deviations measures that expansion statistically and plots the levels where price is most likely to stall — at the session midpoint (50%), at the first standard deviation of range (1 deviation), at 1.5×, 2×, and beyond. It tracks 13 intraday sessions simultaneously, shows which expansion levels have been touched and which haven't, fires alerts on touches, and calculates a directional bias from yesterday's close. It's a complete statistical framework for session-based price behavior, not just a session line tool.

**The edge it gives traders:**
- Know at a glance whether price is at a "normal" expansion level or at an extreme — across 13 sessions simultaneously
- "1600 bias" tells you whether today is above, below, or inside yesterday's NY close — a quick directional read before the open
- 61.8% Fibonacci retracement tracked specifically for Rafael's Range — the level where counter-moves typically exhaust
- Per-session mitigation alerts so you're notified the moment price reaches any tracked expansion level, not after

**The engineering:**
- Deviation levels are calculated as multiples of each session's established range — the statistical expected expansion zones, not arbitrary lines
- `SessionConfig` type cleanly separates configuration from runtime state — every session's mode, times, colors, mitigation rules, and extension settings encapsulated
- Body vs. wick separation: stores separate high/low values for candle bodies and full wick ranges, enabling structural analysis at two levels of precision
- The same provisional/confirmed mitigation state machine as MBZ Prime and HTF Algo — outside-hours touches = provisional only, confirmed during the 05:00–16:00 NY window
- Midnight-crossing sessions (Rafael's 21:30–01:29) set a `crossesMidnight` flag that adjusts all downstream day-tracking logic — no special-casing scattered through the code
- Deviation extensions store millisecond timestamps and project session boxes forward by 6H, 12H, 24H, or a custom duration beyond the official session end

---

### • ADR — Average Daily Range

**In plain terms:** Every instrument moves a typical amount each day. Knowing that range tells you where price is likely to exhaust before reversing. ADR maps the full daily range and subdivides it into thirds — and the 1/3 level is where the action gets interesting. Price has a well-documented tendency to sweep to the 1/3 mark early in the session, trapping traders in the wrong direction, before reversing and running toward the true daily target. ADR makes that manipulation level impossible to miss, and detects the "Judas Swing" — when price exhausts to a major ADR level suspiciously early — so you're watching for the trap instead of falling into it.

**The edge it gives traders:**
- The 1/3 ADR level is visually prominent — the exact zone where early-session sweeps tend to exhaust before the real directional move begins
- Judas Swing detection alerts you before 08:00 NY if price has already reached a major level — a heads-up to watch for a reversal rather than following the initial move
- Per-level alerts on each ADR subdivision so you're notified the moment any major statistical boundary is touched

**The engineering:**
- Two calculation modes: NY Midnight (00:00–00:00) or Daily Candle — accounts for traders using different session definitions
- `LevelConfig` type encapsulates multiplier, label, color, style, and width per level — level management is data-driven, not repeated code
- `AlertState` type tracks per-level per-day alert status, preventing duplicate fires on the same level within the same trading session
- Historical ADR levels from the past 10–20 days render at reduced opacity — gives a volatility baseline without cluttering the current day

---

### • FVG Atlas — Multi-Timeframe Fair Value Gap Scanner

**In plain terms:** Fair Value Gaps are among the most-watched technical patterns — gaps left by fast, directional moves that price tends to return and fill. FVG Atlas scans for them across up to 6 higher timeframes simultaneously, tracks exactly how much of each gap has been filled in real time, and automatically makes 4H+ gaps more visually prominent than smaller ones. The chart hierarchy reflects the timeframe hierarchy.

**The edge it gives traders:**
- All significant FVGs across up to 6 timeframes visible on one chart, auto-filtered to what's within the current day's probable ADR range
- Real-time fill percentage per gap — know if a gap has been barely touched or nearly fully consumed
- Higher-timeframe gaps (4H+) render more prominently by default — automatic visual prioritization without manual configuration

**The engineering:**
- `Fvg`, `FvgBox`, `FvgStore`, `HtfSettings` types keep drawing, storage, and configuration cleanly separated — no coupling between what gets detected and how it gets displayed
- **Dual-phase mitigation**: confirmed HTF candles checked with `lookahead_on`, current forming candle checked with `lookahead_off` — real-time accuracy without lookahead bias contaminating historical bars
- `max_body_fill` field tracks the deepest body penetration seen per gap — a continuous fill depth measure, not just a binary mitigated flag
- Visual prominence derived from timeframe rank: chart TF < 4H and gap TF ≥ 4H renders at full intensity; otherwise subtled — automatic hierarchy, no manual adjustment needed

---

## Engineering Patterns Across the Suite

A few decisions appear consistently across all 14 indicators because they solve real problems that most indicator developers never encounter:

**Statistical range measurement** — DTT Intraday, DTT Weekly, ADR, and Deviations all measure price expansion statistically — using IQR (interquartile range), ADR subdivisions, and session deviation levels. The consistent choice of IQR over simple averages appears in both DTT indicators: outlier sessions don't inflate the expected range. This isn't coincidence — it's a deliberate design standard across the suite.

**Tick-based price precision** — Every price comparison and deduplication is done in tick units (`price / syminfo.mintick`), not floats. Float comparison causes phantom duplicate levels on forex and crypto. Tick arithmetic eliminates that entirely.

**Provisional + confirmed mitigation** — Overnight price touches are flagged as provisional, not confirmed, until the 05:00–16:00 NY window. This prevents low-volume 2am spikes from invalidating levels that should still be live during the trading day. Implemented consistently in MBZ Prime, HTF Algo, and Deviations.

**Input change detection + state reset** — LTF Algo and HTF Algo hash all user settings on every bar. If settings change, state clears immediately. No stale data from a prior configuration ever persists on screen.

**DRY parameterized architecture** — Detection functions are never duplicated across contexts. If the same logic applies to multiple timeframes or sessions, it takes parameters. State variables (the one thing that must be per-context) are isolated. This holds consistently across ~13,500 lines.

**Dynamic capacity management** — Rather than silently dropping zones when object limits approach, the capacity system (Boost 4×, Ultra Boost 8×, Ultra Pro Boost 12×) multiplies internal arrays explicitly. Users choose the depth-vs-performance trade-off; the indicator never makes that choice for them invisibly.

---

## Scale

| Indicator | ~Lines |
|---|---|
| MBZ Core | 1,400 |
| MBZ Prime | 1,200 |
| MBZ SIF Relay | 900 |
| SIF Core | 950 |
| LTF Algo | 800 |
| HTF Algo | 1,100 |
| Untagged Opens | 430 |
| Pulse | 740 |
| DTT Intraday | 900 |
| DTT Weekly | 800 |
| Gaps | 1,890 |
| Deviations | 1,200 |
| ADR | 520 |
| FVG Atlas | 680 |
| **Total** | **~13,510** |

---

These indicators are in daily use by active traders. The design decisions — provisional mitigation, tick precision, capacity modes, IQR-based range projections — didn't come from theory. They came from running these tools in live markets and fixing the edge cases that actually appear.
