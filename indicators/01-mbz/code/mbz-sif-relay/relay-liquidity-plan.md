# MBZ Relay — Liquidity Pool Integration Plan

**Branch**: `relay-liquidity`
**File**: `indicators/01-mbz/code/mbz-sif-relay/production/mbz-sif-relay.pine`
**Last updated**: 2026-04-05

---

## Completed Work

### Phase 0: Performance Prep ✅

- Audited per-bar computation, confirmed headroom
- Default pools OFF for safe opt-in

### Phase 1: Pool Type + Daily Tracking ✅

- `RelayPoolCollection` type — lean 17-field version of Prime's pool (no source origin, no mitigation)
- 11 pool functions: create, update, finalize, mark_breaches, trim, advance pointers, recompute min/max
- Min/max unbreached perf optimization included from day one
- Daily session boundary via `ta.change(dayofmonth(time, NY_TIMEZONE))`
- Breach flag with previous-bar rotation
- `RELAY_DAILY_SCAN_CAP = 100`
- Default OFF, runs after all HTF processing, no visual output

### Phase 2: Detection + Labels ✅

**Phase 2A: Detection Against HTF Candles** ✅
- Ported 4 condition functions from Prime: `liquidity_immediate_condition`, `liquidity_standard_condition`, `liquidity_delayed_condition`, `check_midpoint_confirmation`
- `detect_relay_pool_patterns()`: iterates finalized pool sessions, classifies breach_time into HTF candle A (`ctx.t2 <= bt < ctx.t1`) or B (`bt >= ctx.t1`) windows, runs IMM/STD/DEL conditions
- `create_pool_zone()` helper: midpoint confirmation uses candle A body 50% (matching Prime's `a_midpoint`), creates zone via `get_or_create_zone`
- Wired into `process_htf_close()` — gated by `enable_relay_pools` only (breach flag gating removed — doesn't work for HTF boundary detection since breach bar rarely coincides with HTF close)
- Pool functions relocated above `process_htf_close` for Pine scope rules

**Phase 2B: Formation Rule Tracking** ✅
- `liq_formation_rule` field on CandleZone: stores `"L-IMM"`, `"L-STD"`, or `"L-DEL"`
- Priority: IMM > STD > DEL (via `get_liq_rule_priority()`)
- `has_gap_mbz` field on CandleZone: set only by gap-based MBZ detection, used for label parenthesizing

**Phase 2C: Label Rendering** ✅
- `build_engine_prefix()` helper (DRY, shared by chart + PO3)
  - Gap-only: `MBZ⁻·𝟭𝗛`
  - LQ-only: `L-STD·MBZ⁻·𝟭𝗛`
  - LQ+gap: `(L-STD)·MBZ⁻·𝟭𝗛` (parentheses only when `has_gap_mbz`)
  - LQ+SIF: `L-STD·𝗠𝗕𝗭·𝗦𝗜𝗙⁻·𝟭𝗛`
  - `use_bold` parameter: chart=true (bold Unicode), PO3=false (plain text)
- `build_source_breakdown()` updated: pool sources ("daily") render first, gap sources after
  - `show_pool_sources` / `show_gap_sources` params filter by engine visibility
  - SIF-off hides gap sources when `has_gap_mbz` is false (prevents SIF's fvg leaking into MBZ label)

**Phase 2D: UI Controls (Minimal)** ✅
- `enable_gap_mbz` toggle (default ON) — gates gap-based MBZ detection in `process_htf_close`
- `enable_relay_pools` toggle (default OFF) — gates pool tracking + detection
- Both currently placed in GROUP_ADVANCED (to be reorganized in Phase 3)

**Phase 2E: Debug Table** ✅
- Bottom-right table showing: pool sessions, breached H/L counts, in-window counts, HTF candle A/B OHLC, condition replay (IMM/STD/DEL pass/fail), all toggle states
- Computed at `barstate.islast` from live pool/HTF state (no function instrumentation needed)

### Bugs Found and Fixed During Phase 2

1. **Midpoint used wrong candle** — was computing from candle B (`ctx.o1/c1`), fixed to candle A (`ctx.o2/c2`) matching Prime's `a_midpoint`
2. **Breach flag gating timing** — `relay_daily_breach` flag is only true on the chart bar where breach occurs; by HTF close it's false. Removed gating, detection always runs on HTF close (minimal perf cost)
3. **Parentheses triggered by SIF sources** — SIF adds gap IDs to `source_gap_types`, falsely triggering `(L-STD)` brackets. Fixed with `has_gap_mbz` field set only by gap-based MBZ detection
4. **PO3 missing LQ prefix** — PO3 had inline label building that never checked `liq_formation_rule`. Fixed by extracting `build_engine_prefix()` and sharing between chart and PO3

---

## Remaining Work

### Phase 3: UI Reorganization + Formation Rule Toggles ✅

**Phase 3A: Input Group Restructuring** ✅

- Created `🔧 Engine` group as FIRST input group with master `Enable MBZ` / `Enable SIF` toggles
- Engine toggles control ALL detection; PO3 toggles renamed to "Show MBZ" / "Show SIF" (visual only)
- PO3 rendering gated by BOTH engine toggle AND PO3 toggle (`enable_mbz and po3_show_mbz`)
- Created `🎯 MBZ Detection` group with: Gap MBZ, Liquidity MBZ, Direction, Formation Rules (IMM/STD/DEL), Daily Scan Cap

**Phase 3B: Formation Rule Toggle Wiring** ✅

- 3 `input.bool` toggles (all default ON): `enable_liq_imm`, `enable_liq_std`, `enable_liq_del`
- Checked inside `detect_pool_side()` condition blocks
- Input enforcement: if all 3 off + pools enabled, `enable_liq_std` forced ON

**Phase 3C: Scan Cap Configurability** ✅

- `relay_daily_scan_cap` is now `input.int` (10–500, default 100) with descriptive tooltip
- Tooltip explains relationship to HTF Candles and subscription tier data limits

### Phase 3D: Architectural Cleanup (review findings) ✅

- **Engine decoupling**: `enable_mbz_engine` / `enable_sif_engine` now derived from Engine group master toggles, not PO3 visual toggles
- **Dead code removal**: `consolidated_zone_top/bottom` computation (unused), `relay_daily_breach` / `relay_daily_breach_prev` flags (return value no longer used)
- **DRY extraction**: `detect_pool_side()` helper — single parameterized function replaces duplicated high-side/low-side blocks in `detect_relay_pool_patterns()`
- **Source count fix**: `build_source_breakdown` multi-type count now uses `visible_count` (post-filter) instead of `num_sources` (pre-filter)
- **Unique pool sentinel IDs**: `POOL_SOURCE_ID_DAILY = -1`, `POOL_SOURCE_ID_WEEKLY = -2`, `POOL_SOURCE_ID_MONTHLY = -3` — future pool types get distinct IDs
- **Input enforcement**: at least one MBZ source when MBZ enabled; at least one formation rule when pools enabled

**Test**: Toggle each rule on/off, verify only matching patterns appear. Verify scan cap change works. Verify UI groups render correctly. Verify Engine toggle disables detection while PO3 toggle only hides PO3 visuals.

### Phase 4: Scan Cap Architecture + Documentation ✅

**The relationship between "HTF Candles" and "Daily Scan Cap":**

| Setting | What it controls | Current default |
|---------|-----------------|----------------|
| HTF Candles (max_htf_candles) | How many HTF candles of history to process for gap/MBZ detection. Controls the data window for FVGs, zones, invalidation. | 200 |
| Daily Scan Cap | Max finalized daily sessions stored in the pool. Controls how deep the pool's H/L history goes. | 100 |

These are **independent dimensions**:
- HTF Candles = detection window depth (how far back zones can form)
- Scan Cap = pool memory depth (how far back H/L levels are tracked)

A pool breach from 50 days ago can still form a pattern on today's HTF candle if the breach_time falls in the A/B window. The scan cap limits how many old levels we remember, not when detection can fire.

**Phase 4A: Document the Relationship**

- Add tooltips explaining this to both inputs
- Clarify in plan: scan caps are per-pool, independent of HTF candle count

**Phase 4B: Interaction with Subscription Tiers**

TradingView data availability varies by plan:
- Free: ~5,000 bars
- Premium: ~20,000 bars
- On 5min chart: 5,000 bars ≈ 17 trading days, 20,000 bars ≈ 67 trading days

If scan cap = 100 but user only has 17 days of data, the pool will only fill ~17 sessions. The cap is a maximum, not a guarantee. This is self-limiting and correct — no fix needed, just documentation.

**Phase 4C: Per-Pool Scan Caps**

When weekly/monthly pools are added, each needs its own cap:
- Daily: 100 (≈100 trading days)
- Weekly: 50 (≈1 year)
- Monthly: 30 (≈2.5 years)

These should be defined as defaults with optional user override.

**Test**: Verify tooltip text. Verify pool behavior on accounts with limited bar history.

### Phase 5: Pool Scalability Architecture ✅

- Renamed all `relay_pool_*` / `RelayPoolCollection` to `liq_pool_*` / `LiqPoolCollection` (matches Prime naming)
- Extracted `liq_pool_track()` — shared finalize/reset/update/mark_breaches function. Adding a pool = 1 line.
- Threaded `pool_source_id` parameter through `detect_liq_pool_patterns` → `detect_pool_side` → `create_pool_zone` — no hardcoded source IDs in functions
- Performance unchanged — same O(1) breach gating, same per-HTF-close detection cost

### Phase 5B: Same-Source Filter Fix + DRY Helpers ✅

- **Same-source filter bug**: All pool zones shared source ID `-1`, causing the same-source filter to treat them as duplicates. Only the first pool zone rendered; rest were hidden. Fixed in all 4 filter locations (chart pre-pass, chart main loop, PO3 pre-pass, PO3 main pass) — pool sources (negative IDs) now skip filtering.
- **DRY extraction**: `ss_build_first_touch()` and `ss_should_hide()` centralize same-source filter logic. The `gap_id >= 0` pool guard lives in one place.
- **`passes_direction_filter()`**: Replaces 7 inline copies of the direction check expression.
- **Source counting**: `add_source_to_zone` skips dedup for pool sources (negative IDs). `build_source_breakdown` tracks per-name counts for "daily×6" display.
- Removed debug table, removed unused `POOL_SOURCE_ID_WEEKLY`/`POOL_SOURCE_ID_MONTHLY` constants.

---

## Phase 5C: Invalidation Bypass + Execution Order Fix ✅

- **Invalidation bypass**: Pool zones (`liq_formation_rule != ""`) skip close-penetration invalidation. Pool zones represent daily H/L sweeps, not candle bodies — standard MBZ invalidation killed them immediately on the next HTF close. Opening-gap invalidation (price gaps completely past zone) still applies.
- **Execution order fix**: `liq_pool_track()` moved to run BEFORE all HTF close processing. Previously ran AFTER, meaning breaches on HTF close bars were invisible to detection at that close.
- **Type infrastructure**: Added `high_first_breach_bars`, `low_first_breach_bars`, `high_used_by_pattern`, `low_used_by_pattern` arrays to `LiqPoolCollection`. Maintained through finalize/trim. Available for future per-bar detection approaches.
- **`first_breach_bar` set in `mark_breaches`**: When a breach is first detected, `bar_index` is recorded for future use.

---

## OPEN ISSUE: Pool Data Parity with Prime

### The Problem

Relay's daily pool produces **different session highs/lows** than Prime's, even though both use `dayofmonth(time, NY_TIMEZONE)` for session boundaries. Verified by comparing pool levels: Prime has a daily high at 24,298 that Relay doesn't track. Relay has 24,267 and 24,348 instead.

**Root cause**: Chart timeframe granularity. Prime runs on a 4H chart, Relay runs on 5m. The same `dayofmonth` boundary hit at different bar granularities produces different session splits. A 4H bar straddling midnight includes price data from both days, potentially assigning a high to the wrong session.

### Why This Matters

Detection logic is correct and functional — 15 zones detected on HTF3 with breach_time windowing + HTF candle OHLC. But the zones don't match Prime because the underlying pool levels differ. This is a **data-level** issue, not an algorithm issue.

### Possible Solutions

- **`request.security("D", ...)`**: Fetch daily OHLC from TradingView's native daily candle data. This would produce identical daily H/L regardless of chart timeframe. However, `request.security` has limitations (max 40 calls) and the pool would need to be restructured to ingest daily OHLC from security calls rather than tracking from chart bars.
- **Increase scan cap**: Relay uses 100, Prime uses 300. May help capture more sessions but doesn't fix the session boundary mismatch.
- **Session-aligned tracking**: Instead of `dayofmonth`, use session-aware detection that matches CME futures sessions (18:00-17:00 ET).

### What's NOT Broken

The detection pipeline IS working:
- Pool tracking: 95 sessions, 79H/92L breached
- Breach_time windowing: correctly gates detection to 2-candle window
- HTF candle OHLC conditions: match Prime's condition logic at HTF granularity
- Zone creation: zones render correctly with proper labels
- Invalidation: pool zones survive (opening-gap invalidation only)
- Execution order: breaches recorded before detection runs

---

## SUPERSEDED: Breach-Time Windowing — Root Cause & Fix Plan

*The section below documents earlier analysis of the windowing issue. The real root cause turned out to be pool data parity (different daily H/L levels), not windowing. The windowing logic is correct for levels that exist in the pool.*

### The Problem (Was)

Relay's `detect_pool_side` used `breach_time` windowing: it only checked a level if the chart-bar breach timestamp fell within the current HTF candle A (`ctx.t2 <= bt < ctx.t1`) or B (`bt >= ctx.t1`) time window. Levels breached during older HTF candles were never checked, even if the current A/B candle geometry formed a valid pattern. Result: Relay detected fewer levels than Prime (e.g., 4 of 6 daily levels instead of all 6).

### Root Cause

Detection was running at the **wrong granularity**. Relay ran pool detection inside `process_htf_close()` — once per HTF candle — then tried to map chart-bar breach timestamps onto HTF time windows. This is a fundamental domain mismatch. Breaches happen at chart-bar granularity; you must detect at chart-bar granularity too.

### How Prime Solves This

Prime runs pool detection **every chart bar**, using a **two-bar window per level**:

1. `mark_breaches()` runs every bar — stores `breach_time` (timestamp) when price touches a level
2. Breach flag rotation: `daily_breach_prev := daily_breach; daily_breach := false` — 2-bar memory
3. `has_recent_breach` gate: `daily_breach or daily_breach_prev` — perf optimization, skips bars with no breaches
4. `first_breach_bar` — persisted `bar_index` per level in the pool arrays, set on first encounter
5. Two derived flags per level:
   - `breach_is_current = (first_breach_bar == bar_index)` → gates IMM
   - `breach_is_previous = (first_breach_bar == bar_index - 1)` → gates STD/DEL
6. After 2 bars, neither flag matches → level is done, no more patterns from it
7. `liquidity_level_is_ready(level, time)` — simple maturity check: `not na(level) and level_time < time`

**No time-window filtering. No checking if breach_time falls in some HTF candle range.** Just: "did this level get breached in the last 2 bars? Check conditions against the current A/B geometry."

### Approaches Previously Attempted and Failed

1. **OHLC fallback**: Check if candle A/B reaches the level when `breach_time` is too old. Failed: every old breached level where price has ever been triggers detection, producing "daily×89" flooding.
2. **First-reach latch**: Track which HTF candle first reaches each level, give a 2-candle detection window. Failed: the latch fires during historical processing, all expired by current bar.
3. **Used-by-pattern flag**: One-shot flag per level. Failed: flags set during historical processing, all already flagged by current bar.

All three failed because they tried to keep detection at HTF-close granularity. The correct fix is to move detection to chart-bar granularity, matching Prime.

### Phase 5C: Per-Bar Pool Detection (Two Options)

Both options move pool detection out of `process_htf_close()` and run it every chart bar, matching Prime's architecture. They differ in gating strategy.

---

#### Option A: Breach-Gated Per-Bar Detection (Recommended)

**Concept**: Run pool detection every bar, but only when a breach just happened (current or previous bar). This matches Prime's `has_recent_breach` gate exactly.

**Type changes to `LiqPoolCollection`**:
- Add `high_first_breach_bars` array (int, parallel to `highs`) — bar_index of first breach per level
- Add `low_first_breach_bars` array (int, parallel to `lows`)
- Add `high_breach_times_current` / `high_breach_times_prev` rotation (or derive from breach_time vs time)
- Initialize all `first_breach_bar` entries to `na` on push

**New fields for breach flag rotation** (module-level vars):
- `var bool liq_daily_breach = false`
- `var bool liq_daily_breach_prev = false`
- Rotate every bar: `liq_daily_breach_prev := liq_daily_breach; liq_daily_breach := false`
- Set `liq_daily_breach := true` when `mark_breaches()` finds a new breach

**Detection flow (runs every bar)**:
```
// 1. Rotate breach flags
liq_daily_breach_prev := liq_daily_breach
liq_daily_breach := false

// 2. Track pool (finalize/reset/update/mark_breaches)
liq_daily_breach := liq_pool_track(liq_daily_pool, is_new_day, liq_daily_scan_cap)

// 3. Detect patterns (only on breach bars)
if enable_liq_pools and (liq_daily_breach or liq_daily_breach_prev)
    detect_liq_pool_patterns(liq_daily_pool, ctx, POOL_SOURCE_DAILY, POOL_SOURCE_ID_DAILY)
```

**Changes to `detect_pool_side`**:
- Remove `breach_time` windowing (`breach_in_a` / `breach_in_b` checks)
- Add `first_breach_bar` tracking:
  - If `first_breach_bar` is `na` and level is breached: set to `bar_index` or `bar_index - 1`
  - Derive `breach_is_current = (first_breach_bar == bar_index)`
  - Derive `breach_is_previous = (first_breach_bar == bar_index - 1)`
- IMM gated by `breach_is_current`, STD/DEL gated by `breach_is_previous`
- Return updated `first_breach_bar` values for persistence

**Changes to `liq_pool_mark_breaches`**:
- Return `bool` indicating whether any new breach was found (currently void)
- Caller uses return value to set `liq_daily_breach`

**Changes to `liq_pool_track`**:
- Return `bool` (breach found) instead of void
- Push `first_breach_bar` arrays during `finalize_session`

**Zone creation**: Still calls `get_or_create_zone` + `add_source_to_zone`. No change needed — zones are created on the breach bar, not deferred to HTF close.

**Interaction with `process_htf_close`**: Pool detection is **removed** from `process_htf_close`. Gap-based MBZ detection remains there (it operates at HTF granularity by design). The two engines now run at their natural granularities:
- Gap MBZ → on HTF close (needs finalized HTF candle geometry)
- Pool MBZ → every bar on breach (needs chart-bar timing)

**Multi-tier detection**: Relay has three HTF contexts (`htf1`, `htf2`, `htf3`). Currently pool detection runs inside `process_htf_close`, which is called per tier. The per-bar version must preserve this by calling detection once per valid tier:
```
if enable_liq_pools and (liq_daily_breach or liq_daily_breach_prev)
    if IS_VALID
        detect_liq_pool_patterns(liq_daily_pool, htf1, POOL_SOURCE_DAILY, POOL_SOURCE_ID_DAILY)
    if HTF2_VALID
        detect_liq_pool_patterns(liq_daily_pool, htf2, POOL_SOURCE_DAILY, POOL_SOURCE_ID_DAILY)
    if HTF3_VALID
        detect_liq_pool_patterns(liq_daily_pool, htf3, POOL_SOURCE_DAILY, POOL_SOURCE_ID_DAILY)
```
The `first_breach_bar` is per-level and shared across tiers — this is correct because breach timing is chart-bar granularity (tier-independent). Different tiers have different A/B geometry so a level might match STD against HTF1 but not HTF2.

**`ctx` geometry note**: Relay's `ctx.o1/c1/o2/c2` are **HTF candle geometry** (not chart-bar OHLC like Prime's `open[1]/close[1]`). These values only change on `shift_htf_history()` at HTF close, so they are stable and valid on every bar between HTF closes. This is intentionally correct — pattern validation uses finalized HTF candle structure while breach timing uses chart-bar granularity.

**`first_breach_bar` initialization**: Must use Prime's **triple-fallback pattern**, not a simplified single-path:
```
if na(first_breach_bar)
    if breach_time == time          // breach detected THIS bar
        first_breach_bar := bar_index
    else if breach_time == time[1]  // breach detected PREVIOUS bar
        first_breach_bar := bar_index - 1
    else                            // fallback: direct OHLC reach check
        if candle_reaches_level
            first_breach_bar := bar_index
```
The third path is a safety net for edge cases (first bar, timing mismatches).

**Performance**: Same as Prime. The `has_recent_breach` gate means detection only runs on bars where a breach occurred — typically a few bars per session. Within detection, the loop is bounded by `scan_cap` (100). On a 1m chart with 20,000 bars: ~200 breach bars × 200 evaluations = ~40,000 iterations. With 3 pools (daily/weekly/monthly): ~120,000 total. Well within TradingView limits. The real constraint is drawing objects (500 max) — `MAX_ZONES` and `cleanup_zones` must accommodate pool-sourced zones alongside gap-sourced zones.

**Duplicate zone prevention**: The 2-bar window naturally prevents duplicates. IMM fires on `breach_is_current` (bar N), STD/DEL on `breach_is_previous` (bar N+1) — mutually exclusive. Both call `get_or_create_zone` which returns the existing zone if one exists at the same location. `liq_formation_rule` priority (IMM > STD > DEL) keeps the highest-priority rule.

**Pros**:
- Exact parity with Prime's proven architecture
- Minimal per-bar cost (breach gate skips most bars)
- `first_breach_bar` prevents duplicate patterns naturally
- No zone dedup concerns — each level fires once during its 2-bar window

**Cons**:
- Pool detection now runs outside `process_htf_close`, slightly more complex call chain
- Three detection calls per breach bar (one per HTF tier) instead of one

---

#### Option B: Unconditional Per-Bar Detection

**Concept**: Run pool detection every bar with no breach gate. Let conditions alone determine if a pattern exists.

**Same type changes as Option A** (`first_breach_bar` arrays, breach flag rotation).

**Detection flow (runs every bar)**:
```
// 1. Track pool
liq_pool_track(liq_daily_pool, is_new_day, liq_daily_scan_cap)

// 2. Detect patterns (every bar, no gate)
if enable_liq_pools
    detect_liq_pool_patterns(liq_daily_pool, ctx, POOL_SOURCE_DAILY, POOL_SOURCE_ID_DAILY)
```

**Pros**:
- Simpler code — no breach flag rotation needed
- Guaranteed no missed detections

**Cons**:
- Loops over all pool levels every bar (bounded by scan_cap, but still ~100 iterations per bar)
- On a 1m chart with 20,000 bars, that's 2M iterations just for daily pool
- With weekly + monthly pools, 6M iterations
- Risk of TradingView execution timeout on low-TF charts
- `first_breach_bar` still needed to prevent duplicate patterns, so the type changes are identical

---

#### Recommendation

**Option A** is the clear choice. It matches Prime's architecture exactly, has proven performance characteristics, and the breach gate is trivial to implement (one bool rotation + return value from `mark_breaches`). Option B offers no functional benefit and carries real timeout risk.

---

#### Implementation Checklist (Option A)

1. **Type**: Add `high_first_breach_bars`, `low_first_breach_bars` arrays to `LiqPoolCollection`
2. **Create**: Initialize new arrays in `liq_pool_create()`
3. **Finalize**: Push `na` values for `first_breach_bar` arrays during `liq_pool_finalize_session()`. Every parallel array op must stay in sync.
4. **Trim**: Shift new arrays alongside existing ones in `liq_pool_trim()`. Every `array.shift` in trim must include the new arrays.
5. **Mark breaches**: Confirm `liq_pool_mark_breaches()` returns `bool` (it already returns `found_breach` — verify the return value is propagated)
6. **Track**: Propagate `mark_breaches` return value through `liq_pool_track()`. Add breach flag rotation at call site (`liq_daily_breach_prev := liq_daily_breach; liq_daily_breach := false`)
7. **Detect**: Rewrite `detect_pool_side()` — remove breach_time windowing, add `first_breach_bar` logic **with triple-fallback initialization pattern from Prime** (breach_time == time, breach_time == time[1], direct OHLC reach check)
8. **Persist**: After detection, write updated `first_breach_bar` values back to pool arrays via `array.set`
9. **Rewire**: Move `detect_liq_pool_patterns` from `process_htf_close` to main execution. Gate by breach flags AND tier validity (`IS_VALID`/`HTF2_VALID`/`HTF3_VALID`). Call once per valid tier, not once total.
10. **Validate**: Confirm `ctx` has valid A/B geometry on non-HTF-close bars (`o1/c1/o2/c2` only change on `shift_htf_history` — confirmed stable)
11. **Drawing budget**: Verify `MAX_ZONES` and `cleanup_zones` accommodate pool-sourced zones alongside gap-sourced zones without hitting TradingView's 500-object limit
12. **Placement**: Ensure detection block runs after `liq_pool_track` and inside/after the `IS_VALID` guard, since `ctx` fields require valid HTF data
13. **Test**: Verify detection count matches Prime on the same chart/TF/pool. Verify no duplicate zones. Verify no timeout on 1m chart.

### Phase 6: Weekly + Monthly Pools ✅

Same pattern as daily, using the scalable architecture from Phase 5.

**Phase 6A: Weekly Pool** ✅
- Session boundary: `weekofyear(time[1]) != weekofyear(time)`
- Scan cap: 50 (default)
- Source label: "weekly"
- Pool toggle in MBZ Detection group
- `request.security("W")` for authoritative H/L

**Phase 6B: Monthly Pool** ✅
- Session boundary: `month(time[1]) != month(time)`
- Scan cap: 30 (default)
- Source label: "monthly"
- Pool toggle in MBZ Detection group
- `request.security("M")` for authoritative H/L
- `POOL_SOURCE_ID_MONTHLY = -3`

**Phase 6C: Multi-Pool Detection** ✅
- Each pool gets its own `liq_pool_track` call in main execution
- Detection runs per pool in `process_htf_close`, gated by pool toggle
- Combined zones show multiple sources: "daily, weekly"
- `get_highest_pool_source()` returns highest-TF pool (monthly > weekly > daily)
- PO3 labels show highest pool source as second line (toggle in PO3 Candles)

**Phase 6D: A-Reach Detection Timing Fix** ✅
- `first_htf_reach` only latches when candle A reaches the level
- When only candle B reaches, detection defers to next HTF close (B becomes A)
- Fixes one-candle-off timing error that caused missing STD/DEL on lower-TF charts
- IMM unaffected (fires on `breach_in_b`, B is sweep candle for IMM)

### Phase 7: Session Pools (Optional, Lower Priority)

- Asia, London, NYAM, Lunch, NYPM
- Only on sub-1H chart TFs
- Separate toggle from HTF pools
- Uses session time window checks instead of calendar boundaries

### Phase 8: Performance Hardening

- Verify no timeout on 1m chart with all pools + 3 HTF tiers active
- Tune scan caps if needed
- Profile mark_breaches across N pools (should be O(1) per pool per bar via min/max gating)
- Drawing budget audit with all pools active

### Phase 9: Cleanup

- Remove debug table
- Remove `-dev` suffix from title
- Final review of all code quality rules (CLAUDE.md)

---

## Key Technical Decisions

### Why `>=` in mark_breaches (not `>`)
`mark_breaches()` uses `bar_high >= tracked_high` (not strict `>`). Touching a level exactly should count as reaching it for breach purposes. Changing to `>` was attempted in Prime and caused issues.

### Why pool detection was moved from HTF-close to per-bar (Phase 5C)
Pool detection originally ran inside `process_htf_close()`, with breach_time windowing to filter levels. This fundamentally failed because breaches happen at chart-bar granularity but detection fired at HTF-candle granularity — old breaches had stale timestamps that never matched any window. The fix moves pool detection to run every chart bar (matching Prime), gated by `has_recent_breach` for performance. Gap-based MBZ detection remains in `process_htf_close` since it operates at HTF granularity by design.

### Why midpoint uses candle A (not candle B)
Prime's `a_midpoint = (a_open + a_close) / 2.0` — the reference candle's body 50%. The initial implementation incorrectly used candle B. Fixed in Phase 2A.

### Why `has_gap_mbz` field exists
SIF detection adds gap IDs to `source_gap_types`, which caused the parenthesized label format `(L-STD)` to appear even when MBZ only had pool sources. The `has_gap_mbz` bool is set exclusively by gap-based MBZ detection, allowing the label builder to correctly determine when parentheses are needed.

### Why pool sources use negative sentinel IDs
`POOL_SOURCE_ID_DAILY = -1`, `POOL_SOURCE_ID_WEEKLY = -2`, `POOL_SOURCE_ID_MONTHLY = -3` — each pool type gets a unique negative ID to distinguish pool sources from gap sources (which use positive IDs from `gap.gap_id`) in `source_gap_ids` arrays. Negative IDs (`id < 0`) identify pool sources; the specific value identifies the pool type. This allows the zone system to track both source types in the same arrays while supporting future multi-pool architectures.

### Why scan caps are independent of HTF candle count
HTF candle count controls the detection window (how far back zones can form). Scan caps control pool memory (how far back H/L levels are tracked). A breach from 50 days ago can form a pattern on today's HTF candle if the breach_time falls in the A/B window. These are orthogonal dimensions.

### Why formation rule toggles are pool-only
Gap-based MBZ uses a completely different formation model (gap tap + conviction). The IMM/STD/DEL rules are specific to liquidity pool sweeps. Gap-based MBZ has its own subtype detection (standard/inclusion/reflection) which is always-on.

---

## File Locations

| File | Purpose |
|------|---------|
| `indicators/01-mbz/code/mbz-sif-relay/production/mbz-sif-relay.pine` | MBZ Relay indicator |
| `indicators/01-mbz/code/mbz-sif-relay/relay-liquidity-plan.md` | This plan (consolidated) |
| `indicators/01-mbz/code/mbz-prime/production/mbz-prime.pine` | MBZ Prime (reference for condition functions, formation rules) |
| `indicators/01-mbz/code/mbz-prime/session-handoff.md` | Session handoff (covers Prime + Pulse + original Relay context) |
