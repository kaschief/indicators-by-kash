# MBZ Relay — Liquidity Pool Session Handoff

**Branch**: `relay-liquidity`
**Date**: 2026-04-05
**Status**: Working — 5 pool types, per-tier detection, per-pool toggles, HTF-aware labels

---

## Current State

### What's Working
- **PoolLevel UDT** — self-contained object with per-tier detection state (3 tiers × 2 sides × 2 fields)
- **A-reach detection timing** — `first_htf_reach` only latches when candle A reaches the level. When only B reaches, defers to next HTF close.
- **Per-tier detection state** — `first_htf_reach` and `used_by_pattern` are per-tier, preventing cross-tier contamination. Each tier detects independently against shared pool levels.
- **5 pool types**:
  - Monthly — `request.security("M")`, scan cap 30
  - Weekly — `request.security("W")`, scan cap 50
  - Daily — `request.security("D")`, scan cap 300
  - 4H — `timeframe.change("240")`, sub-4H charts only, scan cap 500
  - 1H — `timeframe.change("60")`, sub-1H charts only, scan cap 500
- **Per-pool toggles** — two groups matching Prime UI layout:
  - 💧 Higher Timeframe Pools: Monthly | Weekly | Daily (inline row)
  - 💧 Timeframe Pools: 4ʰ | 1ʰ (inline row)
  - Each toggle gates both tracking and detection for that pool.
- **HTF-aware label filtering** — pool sources at or below the HTF are hidden from chart zone labels. Detection still runs for all enabled pools unconditionally.
- **PO3 pool source labels** — optional second line showing highest-TF pool source above the HTF. Bearish: source above label. Bullish: source below. Toggle in PO3 Candles group.
- **Pool source ordering** — monthly > weekly > daily > 4ʰ > 1ʰ in source breakdowns (matching Prime).
- **PO3 zone placement** — all zones use right-half placement. Only `ref_pushed` (another candle's wick) widens left.
- **pool_source_ms()** — single helper mapping source name to TF milliseconds. Adding a pool = 1 line here.
- **Scan caps as constants** — not in UI (they're ceilings above chart data availability).
- **MBZ bear label color** — updated to R:239 G:83 B:80

### Key Design Decisions
- **No detection gate by HTF** — all pools detect against all tiers. Labels handle the UX.
- **Per-tier state on PoolLevel** — breach state (shared, tier-independent) vs detection state (per-tier). 4 accessor helpers keep detect_pool_side DRY.
- **Prime keeps chart-bar tracking** — `request.security` in Prime broke weekly detection. Relay uses it independently for D/W/M pools. 4H/1H pools track from chart bars directly.
- **1H pool zones invalidate quickly** — 1H levels are close to price, so zones get penetrated fast. Expected, not a bug.

### Known Limitations
- Pool depth limited by chart bar history. 1m chart ~ 3.5 days, 5m ~ 17 days, 4H ~ 200 days.
- IMM requires contemporaneous breach (breach_time in candle B window).
- Scan caps are ceilings, not data sources. Increasing beyond chart history does nothing.
- PO3 bearish zone labels with pool source second line can collide with tier label at top — needs clearance fix.

---

## What to Do Next

### Priority 1: Backfill Older Sessions
Use `request.security` with historical lookback to fetch H/L from before the chart's bar history. Pre-populate pools on first bar. Applies to ALL pool types, not just daily.

Approach:
- `request.security("D", [high[1], low[1], ..., high[20], low[20]])` = 20 days per call
- Same pattern for W, M, 240, 60 — each pool type gets its own backfill call(s)
- Currently using 3 of 40 allowed `request.security` calls
- On `bar_index == 0`: create PoolLevel objects from returned values, push oldest-first into pool
- Normal tracking takes over from there
- Trade-off: `request.security` must be at global scope (runs even if pools disabled)
- No performance impact — `request.security` is pre-computed by TradingView's server
- Target: 60 days daily backfill (3 calls), scaled appropriately for other pools

Testing approach:
- Compare 5m chart (with backfill) vs 4H chart (natural depth) — levels and detections should match
- Debug label showing `liq_pool_session_count` to verify injection count
- Without backfill: 5m chart ~17 daily sessions. With 60-day backfill: ~77 sessions.

Coverage gap by chart TF (vs daily scan cap 300):
| Chart TF | ~Days available | Missing |
|----------|----------------|---------|
| 1m | ~3.5 | ~297 |
| 5m | ~17 | ~283 |
| 15m | ~52 | ~248 |
| 1H | ~208 | ~92 |
| 4H | ~833 | 0 |

### Priority 2: PO3 Label Collision Fix
Bearish zone labels with pool source second line collide with PO3 tier label at top of chart. Needs vertical clearance — either offset the label Y or position at chart.highest_point.

### Priority 3: 15M Pool
Same pattern as 1H/4H. `timeframe.change("15")`, sub-15M charts only.

### Priority 4: Session Pools (Phase 7)
Sub-daily sessions (Asia, London, NYAM, Lunch, NYPM).

---

## Architecture Summary

### PoolLevel Type
```
PoolLevel
    // Session identity
    session_high, session_low, high_time, low_time, session_close_time
    // Breach state (shared — tier-independent)
    high_breached, high_breach_time, high_first_breach_bar
    low_breached, low_breach_time, low_first_breach_bar
    // Per-tier detection state (×3 tiers, ×2 sides)
    high_first_htf_reach_1/2/3, high_used_by_pattern_1/2/3
    low_first_htf_reach_1/2/3, low_used_by_pattern_1/2/3
```

### Pool Source Hierarchy
```
monthly (TF_M_MS) > weekly (TF_W_MS) > daily (TF_D_MS) > 4ʰ (TF_4H_MS) > 1ʰ (TF_1H_MS)
```

### Detection Flow
```
Every bar:  liq_pool_track() → finalize/reset/update/mark_breaches (per enabled pool)
HTF close:  detect_liq_pool_patterns() → detect_pool_side() (per enabled pool, per tier)
              Uses ctx.tier_index to read/write per-tier detection state
              IMM: breach_in_b → fires immediately
              STD/DEL: is_first_a_reach → fires when A reaches
              If matched: create_pool_zone(), mark used_by_pattern for this tier
```

### Key Files
| File | Purpose |
|------|---------|
| `production/mbz-sif-relay.pine` | The indicator |
| `relay-liquidity-plan.md` | Full plan with all phases |
| `session-handoff-liq.md` | This handoff |
