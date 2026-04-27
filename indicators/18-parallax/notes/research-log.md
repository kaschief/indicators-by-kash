# parallax • — Reverse Engineering Research Log

Our indicator is `parallax •` — a clean-room reimplementation with original code, naming, and architecture. References to "Shadow Edge" below identify the third-party source we measured the algorithm against.

Live document. Updated 2026-04-27 after multi-HTF validation pass.

## Source

- **Original**: Shadow Edge [Flexi+] v25.28b by KatherinaNote (closed-source, locked)
- **Author's stated algorithm**: "proprietary statistical calculations" with a "database of price behavior by hour"
- **Author's named levels**: PH/PL, MuEH/MuEL, MEH/MEL, +M/−M, +D/−D, EQ
- **Public page**: https://www.tradingview.com/script/XFe7Yx57-Shadow-Edge/

The "by hour" framing is empirically wrong — the lookback is just the last N HTF candles, not bucketed by hour-of-day.

## Naming convention (our re-engineered version)

User chose **Option A — stat-plain**:

| Original | Our name | Formula | Status |
|---|---|---|---|
| MEH | **Typical High** | `open + median(H − O)` | ✓ solved, validated 4 HTFs |
| MuEH | **Average High** | `open + mean(H − O)` | ✓ solved, validated 4 HTFs |
| MEL | **Typical Low** | `open − median(O − L)` | ✓ solved, validated 4 HTFs |
| MuEL | **Average Low** | `open − mean(O − L)` | ✓ solved, validated 4 HTFs |
| +D | **Distribution +** | TBD — pattern logic, not pure stats | ✗ unsolved |
| −D | **Distribution −** | TBD — pattern logic, not pure stats | ✗ unsolved |
| +M / −M | (Manipulation) | not yet observed in active configs | not investigated |
| EQ / PH / PL | (Equilibrium / Prior H/L) | additional levels in original | not investigated |

## Confirmed: inner-zone formula

```
N           = min(setting=100, available_HTF_bars)
            EXCLUDING the current in-progress HTF bar
ho_samples  = [bar.high − bar.open  for each bar in window]
ol_samples  = [bar.open − bar.low   for each bar in window]

Typical High = currentHTF.open + median(ho_samples)
Average High = currentHTF.open + mean(ho_samples)
Typical Low  = currentHTF.open − median(ol_samples)
Average Low  = currentHTF.open − mean(ol_samples)
```

### Validation across 4 HTF pairings

| Chart | HTF | Effective N | MEH-O | MuEH-O | O-MEL | O-MuEL | All within |
|---|---|---|---|---|---|---|---|
| 1m | 15m | 50 | 11.62/11.63 | 13.68/13.68 | 9.75/9.75 | 12.04/12.02 | ±0.02 ✓ |
| 2m | 4H | 100 | 75.00/75.00 | 96.09/96.09 | 43.50/43.50 | 65.64/65.63 | ±0.01 ✓ |
| 5m | 12H | 100 | 121.62/121.63 | 178.49/178.43 | 125.00/125.00 | 159.87/159.63 | ±0.24 ✓ |
| 60m | D | 50 | 221.00/221.00 | 271.98/271.98 | 162.12/162.13 | 230.47/230.47 | ±0.01 ✓ |

(format: `computed/indicator`)

### Why N differs across HTFs

Empirically: 15m and D used N=50, while 4H and 12H used N=100. The settings panel shows "Max Lookback Periods: 100", which strongly suggests **N is dynamically capped at `min(setting, available_HTF_bars_at_calc_time)`**. Shorter HTFs (15m) viewed from low-TF charts have constrained `request.security` history; longer HTFs (D) viewed from mid-TF charts hit the chart's bar-history limit.

Our Pine implementation handles this naturally: array starts empty, grows as HTF transitions occur, capped at the user setting.

## Open: +D / −D ("Distribution") levels

### Captured data points

| HTF | N | mean(H-O) | σ(H-O) | mean(O-L) | σ(O-L) | +D−O | O−(−D) |
|---|---|---|---|---|---|---|---|
| 15m | 50 | 13.68 | 10.46 | 12.02 | 10.95 | 30.18 | 26.06 |
| 4H | 100 | 96.09 | 90.05 | 65.64 | 66.31 | 143.36 | 145.74 |
| 12H | 100 | 178.43 | 162.97 | 159.63 | 141.32 | 234.39 | 240.91 |
| D | 50 | 271.98 | 218.68 | 230.47 | 187.58 | 350.34 | 352.11 |

### Implied σ multipliers (proves k is not constant)

| HTF | +D σk | −D σk |
|---|---|---|
| 15m | 1.58 | 1.28 |
| 4H | 0.52 | 1.21 |
| 12H | 0.34 | 0.58 |
| D | 0.36 | 0.65 |

### Best-fit percentiles per HTF

| HTF | +D ≈ pX(H−O) | −D ≈ pX(O−L) |
|---|---|---|
| 15m | p91 | p93 |
| 4H | p79.5 | p85.5 |
| 12H | p71.5 | p79.5 |
| D | p65.1 | p71.0 |

Percentile DECREASES as HTF size grows. Not a fixed-rule percentile.

### Formulas tested and rejected

| Hypothesis | Result |
|---|---|
| `mean + k·σ` (fixed k) | k varies wildly across HTFs |
| `2·mean − median` (skewness reflection) | matches 12H, fails 15m / 4H / D |
| Fixed percentile of distribution | percentile not constant |
| Mean of upper half | systematic over-estimate at higher HTFs |
| Mean of upper quarter | far too high at higher HTFs |
| Mean of outliers (above MuE) | systematic over-estimate at higher HTFs |
| Max of last K bars | erratic, nonlinear |
| `mean(H−L) × c` | c varies (0.886 / 1.000 / etc.) |

### Why we suspect pattern logic

The author's public description states: *"Manipulation/Distribution Levels (-M, +M, -D, +D): Potential manipulation and distribution zones calculated from price action patterns."*

The phrase "price action patterns" implies multi-candle conditional logic. Plausible formulations we couldn't directly test from descriptive stats:

1. **Sweep-conditional means** — average of (H−O) but only for candles where H exceeded the prior candle's MuEH (sweep events).
2. **Order-flow / displacement counters** — count of bars showing wick rejection or close-near-extreme, weighted into the projection.
3. **Wick-only stats** — using `(high − max(open, close))` and `(min(open, close) − low)` instead of plain (H−O), (O−L).

Pursuing any of these requires a different data shape than we collected — namely, OHLC including close, plus multi-candle context. Future research bucket: capture close + classify each historical bar into pattern types (sweep/reversal/expansion), then test conditional means.

### Workaround for now

Two viable user-facing approaches:

**A. Skip +D/−D entirely.** Ship the inner-zone version (which matches the original to 0pt). Outer levels become a future feature.

**B. Approximate +D/−D as a configurable multiplier of σ.** Default `1.5σ` above MuEH and `1.5σ` below MuEL. Won't match the original exactly, but gives the user "outer" zones visually and a knob to tune. Document clearly that this is a placeholder until pattern logic is reverse-engineered.

## Architectural improvements vs. original (in v2 prototype)

1. **Replace string-parsed `chartTF:HTF` mapping** with relay-style switch-based `get_tf_pairing()` — type-safe, no runtime parsing, predictable behavior
2. **Plain English level names** per Option A
3. **Color tokens** matching the rest of the codebase (`DEFAULT_*_COLOR` constants)
4. **Color reference table** for verification at a glance
5. **Per-level visibility + color** inputs (matches deviations pattern)
6. **Strict cap** on historical zone count for performance
7. **Brand alignment**: lowercase title with bullet (`shadow edge •`)
8. Future: multi-HTF slot support like relay (4 simultaneous HTFs with different colors)
