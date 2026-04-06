# MBZ Relay — Session Liquidity Pools: Architecture Design

**Date**: 2026-04-06
**Status**: Proposal (no code changes)
**Prerequisite**: Phase 7 of relay-liquidity-plan.md

---

## 1. What "2 Versions of Session Liquidity" Means

Prime implements a **three-mode system** for intraday session time windows, controlled by the `nine_times_mode` input:

| Mode | Behavior |
|------|----------|
| **Standard** | Uses the default ICT session times (e.g., Asia 2000-0000, London 0200-0500) |
| **NINE Only** | Replaces session times with NINE's alternative windows (e.g., Asia 1800-0300, London 0300-0930) |
| **Both** | Runs Standard AND NINE sessions **in parallel** as independent pools |

The time windows differ significantly:

| Session | Standard | NINE |
|---------|----------|------|
| Asia | 2000-0000 (4h) | 1800-0300 (9h) |
| London | 0200-0500 (3h) | 0300-0930 (6.5h) |
| NY AM | 0930-1200 (2.5h) | 0930-1200 (same) |
| Lunch | 1200-1330 (1.5h) | 1200-1300 (1h) |
| NY PM | 1330-1600 (2.5h) | 1200-1800 (6h) |

In "Both" mode, Prime creates **separate pool instances** for each variant:

- `asia_session_pool` (Standard times) + `asia_nine_pool` (NINE times)
- `london_session_pool` + `london_nine_pool`
- `nyam_session_pool` + `nyam_nine_pool`
- `nypm_session_pool` + `nypm_nine_pool`

Each variant tracks its own H/L levels and breach state. NINE variants use a `-9` suffix in their source labels (`"asia-9"`, `"london-9"`). Lunch has no NINE variant in "Both" mode (NINE's lunch is just a shorter standard lunch). ONS and Premarket are unaffected by NINE mode.

**The "2 versions" = Standard session times and NINE session times, potentially running simultaneously.**

This means the relay must be designed to handle **up to 2x the number of session pools** when "Both" mode is active.

---

## 2. Architectural Decision: Start Without NINE, Design For It

**Decision**: Implement Standard-only session pools first. Design the architecture so NINE variants can be added later without refactoring.

**Rationale**:
- NINE mode doubles the pool count (5 sessions x 2 = 10 pools, vs 5 pools)
- Relay already has 5 pools (daily, weekly, monthly, 4H, 1H). Adding 5 standard sessions = 10 total. Adding NINE variants = 15 total.
- The relay runs pool detection inside `process_htf_close`, which is called per-tier (up to 3 tiers). 15 pools x 3 tiers = 45 detection calls per HTF close. This is acceptable because detection is bounded by scan cap and breach gating.
- Starting with Standard-only allows testing the full pipeline before doubling the load.

**What "design for it" means concretely**:
- Source IDs, source labels, and scan cap constants are pre-allocated for NINE variants
- The `pool_source_ms()` priority function is extended to handle session sources
- The session time strings are parameterized so NINE times can be swapped in

---

## 3. Session Boundary Detection: `time()` vs Calendar Functions

### The Critical Difference

Daily/weekly/monthly pools use **calendar boundaries**:
```pine
// Daily: dayofmonth changes
is_new_daily_session = dayofmonth(time[1], NY_TIMEZONE) != dayofmonth(time, NY_TIMEZONE)

// Weekly: weekofyear changes
is_new_weekly_session = weekofyear(time[1], NY_TIMEZONE) != weekofyear(time, NY_TIMEZONE)
```

Session pools use **time window checks** via Pine's `time()` function:
```pine
// Asia: check if current bar falls within the session window
in_asia_session = not na(time(timeframe.period, "2000-0000:23456", "America/New_York"))
was_in_asia_session = not na(time(timeframe.period, "2000-0000:23456", "America/New_York")[1])

session_just_started = in_asia_session and not was_in_asia_session
session_just_ended = not in_asia_session and was_in_asia_session
```

### Why Session Tracking is More Complex

Calendar boundaries produce exactly one transition per period. Session windows produce **two transitions** per period (start and end), and sessions can span midnight (Asia 2000-0000). The tracking pattern differs from daily/weekly/monthly in three ways:

1. **Finalize on session END** (not session start). When `session_just_ended`, we finalize the session that just completed.
2. **Reset on session START**. When `session_just_started`, we begin tracking a new session's H/L.
3. **Update only DURING session**. H/L extremes are only updated when `in_session` is true. Outside the session window, the pool only marks breaches (price can breach old levels at any time).

This means `liq_pool_track` **cannot be reused as-is** for session pools. The existing function assumes a single `is_new_session` boolean that handles both finalize-previous and reset-new. Session pools need the three-phase pattern.

### Proposed: `liq_pool_track_session` — Session-Aware Tracking Function

```pine
liq_pool_track_session(LiquidityPoolCollection pool, bool in_session, bool session_just_started, bool session_just_ended, int scan_cap) =>
    if session_just_ended
        liq_pool_finalize_session(pool, nz(time[1], time), scan_cap)
    if session_just_started
        liq_pool_reset_current(pool, high, low, time)
    if in_session and not session_just_started
        liq_pool_update_current(pool, high, low, time)
    liq_pool_mark_breaches(pool, high, low, time)
```

The existing `liq_pool_track` remains unchanged for calendar-based pools. Both functions call the same internal helpers (`finalize`, `reset`, `update`, `mark_breaches`) — only the boundary logic differs.

**Alternative considered: modify `liq_pool_track` to accept start/end booleans.** Rejected because it changes the call signature for all 5 existing pools and the two patterns are conceptually different (calendar = one event, session = two events).

---

## 4. Type Changes

### New Constants

```pine
// Session pool source IDs (negative, unique per pool)
const int POOL_SOURCE_ID_ASIA    = -6
const int POOL_SOURCE_ID_LONDON  = -7
const int POOL_SOURCE_ID_NYAM    = -8
const int POOL_SOURCE_ID_LUNCH   = -9
const int POOL_SOURCE_ID_NYPM    = -10
// Reserved for NINE variants
const int POOL_SOURCE_ID_ASIA_9  = -11
const int POOL_SOURCE_ID_LONDON_9 = -12
const int POOL_SOURCE_ID_NYAM_9  = -13
const int POOL_SOURCE_ID_NYPM_9  = -14

// Session pool source labels
const string POOL_SOURCE_ASIA    = "asia"
const string POOL_SOURCE_LONDON  = "london"
const string POOL_SOURCE_NYAM    = "nyam"
const string POOL_SOURCE_LUNCH   = "lunch"
const string POOL_SOURCE_NYPM    = "nypm"

// Session scan caps
const int LIQ_SCAN_CAP_SESSION   = 200   // ~40 weeks of intraday sessions

// Session time definitions (NY timezone)
const string NY_TIMEZONE = "America/New_York"  // already exists
const string SESSION_ASIA_TIME   = "2000-0000"
const string SESSION_LONDON_TIME = "0200-0500"
const string SESSION_NYAM_TIME   = "0930-1200"
const string SESSION_LUNCH_TIME  = "1200-1330"
const string SESSION_NYPM_TIME   = "1330-1600"

// Day codes
const string DAY_CODE_MON_SAT    = ":23456"
```

### No Type Changes to `PoolLevel` or `LiquidityPoolCollection`

The existing types are fully sufficient. Session pools use the same `PoolLevel` struct (session_high, session_low, breach state, per-tier detection state). The `LiquidityPoolCollection` holds an array of `PoolLevel` with performance pointers. Nothing session-specific needs to be added to these types.

### `pool_source_ms` Extension

Session pools need a priority value for `get_highest_pool_source`. Sessions are sub-daily, so they rank below daily but above TF pools in the hierarchy:

```pine
pool_source_ms(string src) =>
    src == POOL_SOURCE_MONTHLY ? TF_M_MS :
    src == POOL_SOURCE_WEEKLY  ? TF_W_MS :
    src == POOL_SOURCE_DAILY   ? TF_D_MS :
    src == POOL_SOURCE_4H      ? TF_4H_MS :
    src == POOL_SOURCE_ASIA    ? TF_4H_MS - 1 :   // Below 4H, above 1H
    src == POOL_SOURCE_LONDON  ? TF_4H_MS - 2 :
    src == POOL_SOURCE_NYAM    ? TF_4H_MS - 3 :
    src == POOL_SOURCE_LUNCH   ? TF_4H_MS - 4 :
    src == POOL_SOURCE_NYPM    ? TF_4H_MS - 5 :
    src == POOL_SOURCE_1H      ? TF_1H_MS : 0
```

Session pools are multi-hour windows (2-4 hours), so they rank between 4H and 1H conceptually. However, the exact ordering between session types is somewhat arbitrary since they don't form a nested hierarchy. The ordering above uses Asia > London > NYAM > Lunch > NYPM which follows chronological session order — a reasonable convention.

---

## 5. Implementation Phases

### Phase 7A: Asia Session Pool (Foundation)

This is the minimal vertical slice that proves the architecture end-to-end.

**Add**:
1. Constants: `POOL_SOURCE_ID_ASIA`, `POOL_SOURCE_ASIA`, `SESSION_ASIA_TIME`, `DAY_CODE_MON_SAT`, `LIQ_SCAN_CAP_SESSION`
2. UI: `enable_liq_asia` toggle in a new `GROUP_LIQ_SESSION` input group
3. Pool instance: `var LiquidityPoolCollection liq_asia_pool = liq_pool_create()`
4. Session boundary detection:
   ```pine
   string asia_session_str = SESSION_ASIA_TIME + DAY_CODE_MON_SAT
   bool in_asia = not na(time(timeframe.period, asia_session_str, NY_TIMEZONE))
   bool was_in_asia = not na(time(timeframe.period, asia_session_str, NY_TIMEZONE)[1])
   bool asia_just_started = in_asia and not was_in_asia
   bool asia_just_ended = not in_asia and was_in_asia
   ```
5. Tracking call in main execution (before HTF close processing):
   ```pine
   if enable_liq_pools and enable_liq_asia and not skip_sunday_liq
       liq_pool_track_session(liq_asia_pool, in_asia, asia_just_started, asia_just_ended, LIQ_SCAN_CAP_SESSION)
   ```
6. Detection call inside `process_htf_close`:
   ```pine
   if enable_liq_asia
       detect_liq_pool_patterns(liq_asia_pool, ctx, POOL_SOURCE_ASIA, POOL_SOURCE_ID_ASIA)
   ```
7. Extend `pool_source_ms` and `pool_order` array for the new source
8. Timeframe gating: only track on sub-1H charts (`timeframe.in_seconds() < 3600`)

**Test**: Apply on a 5m chart. Verify Asia H/L levels are tracked. Verify MBZ zones form when Asia highs/lows are swept on HTF candles. Verify labels show "asia" as source.

### Phase 7B: London, NYAM, Lunch, NYPM

Same pattern as Asia, repeated for each session. Each session adds:
- 1 constant block (source ID, source label, time string)
- 1 `input.bool` toggle (all in `GROUP_LIQ_SESSION`)
- 1 `LiquidityPoolCollection` instance
- 1 boundary detection block
- 1 `liq_pool_track_session` call
- 1 `detect_liq_pool_patterns` call per pool inside `process_htf_close`

**DRY concern**: The boundary detection block is identical except for the session time string. However, Pine Script cannot pass string constants to `time()` at runtime through a function parameter — `time()` requires a literal or simple variable session string. Each session's boundary detection must be inline, but the tracking and detection calls go through shared functions.

**What CAN be DRY**: `liq_pool_track_session`, `detect_liq_pool_patterns`, `detect_pool_side`, `liq_pool_finalize_session`, `liq_pool_mark_breaches` — all fully reused. Only boundary detection and pool instantiation are per-session.

### Phase 7C: NINE Mode Support (Optional, Deferred)

When NINE mode is needed:
1. Add NINE time constants (`SESSION_ASIA_NINE_TIME = "1800-0300"`, etc.)
2. Add NINE pool instances (`liq_asia_nine_pool`, etc.)
3. Add NINE source IDs and labels (`POOL_SOURCE_ID_ASIA_9`, `"asia-9"`)
4. Add `nine_times_mode` input (Standard / NINE Only / Both)
5. "Standard" mode: use standard time strings
6. "NINE Only" mode: swap time strings to NINE values
7. "Both" mode: run two parallel pools with separate boundary detection

The architecture supports this without refactoring because each pool is an independent `LiquidityPoolCollection` instance with its own source ID.

### Phase 7D: 24/7 Asset Detection

Prime auto-detects crypto/forex 24/7 assets (scan for weekend bars) and adjusts day codes from `:23456` to `:1234567`. Relay should adopt the same detection if session pools are used on 24/7 assets. This can be deferred if relay is primarily used on futures.

---

## 6. Performance Analysis

### Computation Budget

**Current state (5 pools)**:
- `liq_pool_track` runs 5x per bar (daily, weekly, monthly, 4H, 1H)
- `detect_liq_pool_patterns` runs 5x per HTF close, per tier (up to 15 calls)
- Each `mark_breaches` call is O(1) most bars (min/max gate skips loop)

**With 5 session pools added (10 total)**:
- `liq_pool_track_session` runs 5x per bar (5 new sessions)
- `detect_liq_pool_patterns` runs 10x per HTF close, per tier (up to 30 calls)
- `mark_breaches` still O(1) per pool per bar

**With NINE variants in Both mode (14 total)**:
- 14 tracking calls per bar
- Up to 42 detection calls per HTF close (14 pools x 3 tiers)

### The Real Bottleneck: Scan Cap x Detection Frequency

Detection loops through all finalized sessions in each pool. With `LIQ_SCAN_CAP_SESSION = 200` and 5 session pools:
- Per HTF close, per tier: 5 pools x 200 sessions x 2 sides = 2,000 iterations
- With 3 tiers: 6,000 iterations per HTF close
- HTF closes are infrequent (once per HTF candle). On a 5m chart with 1H HTF: ~12 closes/day

This is well within TradingView's limits. For reference, Prime runs 15+ pools through `process_liquidity_pool` every bar (gated by breach flags), and handles it fine.

### Drawing Object Budget

TradingView limit: 500 boxes, 500 labels, 500 lines.

Session pools produce more levels (5 sessions x ~200 levels each = 1,000 levels) but most won't form patterns. The bottleneck is `MAX_ZONES` — the cap on how many zones the relay renders. The existing `cleanup_zones` function handles this. With session pools, zones may compete more aggressively for rendering slots.

**Mitigation**: Consider reducing `LIQ_SCAN_CAP_SESSION` to 100 (vs 200) to limit memory. Sessions produce patterns from recent levels; old session levels are less likely to be relevant.

### `request.security` Budget

Current usage: 3 of 40 calls (daily, weekly, monthly H/L).

Session pools **do not need `request.security`**. Session H/L is tracked from chart bars using `time()` boundary detection. Unlike daily/weekly/monthly pools (which needed `request.security` to fix chart-TF granularity mismatch), session boundaries are defined by wall clock time, and the chart's bars within a session window inherently capture the correct H/L.

This means adding session pools costs **zero** `request.security` calls.

---

## 7. Key Code Patterns

### Session Boundary Detection (per-session, inline)

```pine
// Each session needs its own inline boundary detection because
// time() requires a compile-time-known session string.
string asia_session_str = SESSION_ASIA_TIME + DAY_CODE_MON_SAT
bool in_asia = not na(time(timeframe.period, asia_session_str, NY_TIMEZONE))
bool was_in_asia = not na(time(timeframe.period, asia_session_str, NY_TIMEZONE)[1])
bool asia_started = in_asia and not was_in_asia
bool asia_ended = not in_asia and was_in_asia
```

This must be computed unconditionally (before the enable gate) because Pine evaluates `time()` calls globally. The boolean results are then used inside the gated tracking block.

### Session Pool Tracking (shared function)

```pine
liq_pool_track_session(LiquidityPoolCollection pool, bool in_session, bool just_started, bool just_ended, int scan_cap) =>
    if just_ended
        liq_pool_finalize_session(pool, nz(time[1], time), scan_cap)
    if just_started
        liq_pool_reset_current(pool, high, low, time)
    if in_session and not just_started
        liq_pool_update_current(pool, high, low, time)
    liq_pool_mark_breaches(pool, high, low, time)
```

Note: `just_started` bars also need update, but `reset_current` already sets the initial H/L from the start bar. The `and not just_started` guard prevents double-writing.

### Detection (fully reused)

Detection uses the existing `detect_liq_pool_patterns` with no modifications. Session pools produce the same `PoolLevel` structs; detection is pool-type-agnostic. The only difference is the source label and source ID passed in.

### Execution Order

```
// 1. Session boundary detection (unconditional, before gates)
// 2. Session pool tracking (gated by enable_liq_pools + per-session toggle + TF check)
// 3. Calendar pool tracking (existing, unchanged)
// 4. HTF close processing (includes detection for ALL pools)
```

Session pool tracking must run BEFORE `process_htf_close`, matching the existing pattern where calendar pool tracking already runs before HTF processing.

---

## 8. UI Design

### New Input Group: `GROUP_LIQ_SESSION`

```
GROUP_LIQ_SESSION = "💧 Session Pools"
```

Placed between `GROUP_LIQ_HTF` and `GROUP_LIQ_TF` (session pools are sub-daily, above TF pools in the hierarchy).

### Controls

```
Asia      [x]  London  [x]  NY AM  [x]  Lunch  [x]  NY PM  [x]
```

All on a single inline row, matching the existing HTF pool layout. All default OFF (session pools are opt-in, consistent with the existing "default OFF for new pool types" convention).

When NINE mode is added later:
```
Intraday Session Mode  [ Standard | NINE Only | Both ]
```

### Tooltip

```
Session liquidity pools track high/low prices during specific trading sessions.
Patterns are detected when session highs/lows are swept on HTF candles.

Asia: 2000-0000 NY
London: 0200-0500 NY
NY AM: 0930-1200 NY
Lunch: 1200-1330 NY
NY PM: 1330-1600 NY

Only active on sub-1H chart timeframes.
```

---

## 9. Risks and Mitigations

### Risk 1: Execution Timeout on Low-TF Charts

**Scenario**: 1m chart with 20,000 bars, all session pools enabled + all calendar pools + 3 HTF tiers.

**Analysis**: Pool tracking runs every bar (10 pools, each doing 1 `mark_breaches` call = 10 O(1) checks). Detection runs only on HTF closes (rare). The tracking cost is negligible. The detection cost on HTF close is bounded: 10 pools x scan_cap x 2 sides x 3 tiers. With scan_cap=200, that's 12,000 iterations per HTF close. Acceptable.

**Mitigation**: If timeout occurs, reduce session scan cap to 100 or 50. Session patterns are most relevant from recent sessions (last few weeks), unlike daily pools where months-old levels matter.

### Risk 2: Drawing Object Saturation

**Scenario**: 10 pools producing zones simultaneously could exhaust `MAX_ZONES`.

**Mitigation**: The existing `cleanup_zones` function caps zone count per HTF tier. Session pool zones compete for the same slots as calendar pool zones. No change needed — the cap already enforces the limit. If zones from session pools crowd out calendar pool zones, the user can disable specific session pools.

### Risk 3: Label Noise ("asia, london, nyam, lunch, nypm" in source breakdown)

**Scenario**: A price level that coincides with multiple session H/L values could show an extremely verbose source label.

**Mitigation**: The existing `build_source_breakdown` function handles multi-source zones. Session sources are short strings ("asia", "london"). The `pool_order` array determines display order. If needed, a future "collapse by category" feature could group session sources (e.g., "session x3" instead of "asia, london, nyam").

### Risk 4: `time()` Function Limitations

**Pine Script constraint**: `time()` requires a session string that is effectively a constant. You cannot pass a dynamically constructed session string through a function parameter in a way that varies per call.

**Mitigation**: Each session's boundary detection is inline (not in a shared function). This is unavoidable in Pine Script and is the same approach Prime uses. The code is repetitive in structure but not in logic — all shared behavior lives in `liq_pool_track_session`.

### Risk 5: Sunday Evening Handling

**Scenario**: CME futures reopen Sunday 18:00 NY. Asia session (2000-0000) starts within this window.

**Mitigation**: The existing `skip_sunday_liq` flag handles this. Session pool tracking is gated by `not skip_sunday_liq`, matching calendar pool behavior. Prime uses the same guard (`skip_sunday_liquidity`).

### Risk 6: Session Pools on Higher TF Charts

**Scenario**: User on a 4H chart enables session pools. A 4-hour bar spans an entire session — boundary detection fires but H/L is just one bar's range.

**Mitigation**: Timeframe gating. Session pools only activate on sub-1H charts (`timeframe.in_seconds() < 3600`), matching Prime's `MAX_TF_INTRADAY_LIQUIDITY = 60` (60 minutes). This prevents meaningless data on higher TF charts.

---

## 10. What Does NOT Change

- `PoolLevel` type — no new fields
- `LiquidityPoolCollection` type — no new fields
- `liq_pool_track` — unchanged (calendar pools keep using it)
- `liq_pool_finalize_session` — unchanged
- `liq_pool_mark_breaches` — unchanged
- `detect_pool_side` — unchanged
- `detect_liq_pool_patterns` — unchanged
- `create_pool_zone` — unchanged
- `get_or_create_zone` — unchanged
- `process_htf_close` — adds detection calls for session pools (same pattern as existing)
- All existing pool behavior — zero regression risk

---

## 11. Summary: Incremental Delivery Plan

| Phase | Scope | Pools Added | Testable? | Reversible? |
|-------|-------|-------------|-----------|-------------|
| 7A | Asia only | 1 | Yes — single session, verify H/L tracking + MBZ formation | Yes — delete one pool + one constant block |
| 7B | London, NYAM, Lunch, NYPM | 4 | Yes — each session independently toggleable | Yes — each pool is independent |
| 7C | NINE mode (deferred) | +4 (Both mode) | Yes — NINE variants have separate source labels | Yes — NINE pools are separate instances |
| 7D | 24/7 asset detection (deferred) | 0 | Yes — test on BTC vs ES | Yes — only affects day codes |

Each phase produces a testable, shippable increment. No phase depends on a future phase. The architecture is designed so that NINE mode can be added at any time without touching the Standard session pool code.

---

## 12. Files Affected

| File | Changes |
|------|---------|
| `mbz-sif-relay.pine` | Constants, UI inputs, pool instances, boundary detection, `liq_pool_track_session` function, detection calls in `process_htf_close`, `pool_source_ms` extension, `pool_order` extension |
| `relay-liquidity-plan.md` | Phase 7 expanded with sub-phases |
