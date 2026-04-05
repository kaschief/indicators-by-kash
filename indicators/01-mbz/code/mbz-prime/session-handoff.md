# MBZ Prime & Relay — Session Handoff Document

Date: 2026-04-05
Branch: `kash-home` (all work merged)
Previous working branch: `prime-repair`

---

## What Was Done (MBZ Prime)

### Completed Phases (all tested and committed)

**Phase 1: Deeper Scan Caps**
- Daily 100→300, weekly 50→100, monthly 30→100, sessions 50→200
- Removed redundant `LIQUIDITY_POOL_MAX_ENTRIES`, each pool uses its scan cap as storage limit
- File: `indicators/01-mbz/code/mbz-prime/production/mbz-prime.pine`

**Phase 2: Sunday 1D Fix**
- Added `timeframe.in_seconds() < 86400` to `should_skip_sunday_liquidity()`
- Fixes Monday data loss on 1D CME futures charts (bar's `time` = Sunday 18:00, was incorrectly triggering Sunday skip)

**Phase 3: Directional Enforcement**
- L-STD and L-DEL require candle A to move INTO the sweep (bullish A for bearish MBZ, bearish A for bullish MBZ)
- Removed `no_new_extreme` constraint from standard condition (B can make new extreme before displacing)
- Removed STANDARD_PLUS and DELAYED_PLUS distinctions entirely (constants, prefixes, branches, tooltips)
- Fixed inverted priority in unification block (was DEL > STD > IMM, now IMM > STD > DEL)
- Removed `mbz_variant_mode` variable (only "Liquidity" variant exists)

**Phase 4: Performance Optimization — Breach Flag Gating**
- `mark_breaches()` returns bool flag when any new breach found
- Per-pool `var` breach flags with previous-bar rotation (28 flags for 14 pools)
- `process_liquidity_pool()` skips entire finalized session loop when no breach on current or previous bar
- Current session processing always runs unconditionally
- ~99% reduction in detection iterations on non-breach bars

**Phase 5: Source Origin Label Centering**
- `label.style_none` for all source origin labels
- Labels positioned at `level_price` directly (no vertical offset)
- Removed all `LABEL_OFFSET_MULTIPLIER` constants

**Phase 8: Cross-Pool Source Line Deduplication**
- Replaced 20 per-pool line/label arrays with 2 unified arrays (`source_origin_lines`, `source_origin_labels`)
- Replaced 10 per-pool dedup arrays with map-based O(1) lookup
- Same price from different pools → 1 line, merged label (e.g., "2: asia, ons")
- Tokens ordered by priority (monthly > weekly > daily > sessions > TF pools)
- Labels use "count: token1, token2" format when multiple sources
- Gate source origins with `should_highlight_consolidated_zone` (fixes orphaned lines)
- Fixed missing nypm/ons/premarket cleanup bug

**Phase 9: Source Origin — Session Close Time Matching**
- Stored `source_session_close_time` and `source_level_time` in MBZRecord at detection time
- Rendering matches by unique integer timestamp instead of ambiguous float price
- Dedup key = `time + "_" + price` to distinguish different sessions at same price
- Eliminates orphaned lines (wrong session matched) and missing lines (correct session missed)
- Current session fallback with sentinel value 0
- All 15 pool call sites updated to carry session identity through pipeline

**Phase 10: Extend-to-Wick + 50% Midline**
- Zone boundary uses furthest wick between ref candle and MBZ candle (matches MBZ Core)
- Two-step architecture: compute base zone, then only expand via min/max (never shrink)
- Removed `should_extend_wick()` function, logic moved into `get_mbz_subtype_zone()`
- 50% midline with adjustable color, style (solid/dashed/dotted), and width
- Midline hidden on invalidated zones

**Phase 6A/B/C: Timeframe Pools (4H, 1H, 15m)**
- 4H (`4ʰ`), 1H (`1ʰ`), 15m (`15ᵐ`) with superscript labels
- Each with individual show/color/width source origin controls
- Scan caps: 500 each (~83 days for 4H, ~20 days for 1H, ~8 days for 15m)
- Timeframe gating: 4H on sub-4H charts, 1H on sub-1H, 15m on sub-15m
- Default OFF — user opts in
- Full pipeline: tracking, breach flags, detection, source origin rendering
- 4H blue (41,98,255), 1H green (139,195,74), 15m light green (174,213,129)

**Performance: Min/Max Unbreached Tracking**
- Each pool tracks `min_unbreached_high` and `max_unbreached_low`
- `mark_breaches()` skips entire loop via O(1) comparison when bar can't reach any unbreached level
- Recompute on breach/trim/finalize
- ~95% reduction in mark_breaches work

**MBZ Quota Increase**
- Default 60 (was 30), max 100 (was 60)

---

## What Was Done (MBZ Relay)

**Phase 0: Performance Audit** — completed, no prep needed
**Phase 1: Daily Pool Tracking** — implemented (tracking only, no detection yet)

### Phase 1 Details
- `RelayPoolCollection` type — lean 17-field version of Prime's pool (no source origin, no mitigation, no first_breach_bars)
- 11 pool functions adapted from Prime (create, update, finalize, mark_breaches, trim, etc.)
- Min/max unbreached perf optimization included from day one
- Daily session boundary via `ta.change(dayofmonth(time, NY_TIMEZONE))`
- Breach flag with previous-bar rotation
- Default OFF, runs after all HTF processing
- No visual output — pool silently fills, ready for Phase 2

---

## What Was Done (Pulse)

- Per-pool `SHOW_LAST_MAX` constants (daily 300, weekly 100, monthly 100, others 50)
- Scan caps derived from show-last maxes automatically
- `includeSundayEvening` toggle (default OFF) replacing `useTradingWeek`
- Sunday continuation block and `coming_from_sunday_evening` gated to sub-daily
- Daily/weekly/monthly pools visible on their native timeframes (`<=` instead of `<`)
- Day dividers on 4H (18:00 fallback when no midnight bar exists)
- Updated default colors for daily, weekly, midnight open
- Fix 1D daily pool losing Monday data (same Sunday fix as Prime)

---

## Key Technical Decisions

### Why `>=` in mark_breaches (not `>`)
`mark_breaches()` uses `bar_high >= tracked_high` (not strict `>`). This is the original behavior. Changing to `>` was attempted and caused issues — touching a level exactly should count as reaching it for breach purposes.

### Why breach flag gating works
A pattern can only form when a breach happens on the current bar (IMM) or previous bar (STD/DEL). If `mark_breaches()` found no new breach on this bar AND no new breach on the previous bar, `detect_patterns()` would find `breach_is_current = false` and `breach_is_previous = false` for ALL entries, producing zero events. Skipping the call is equivalent.

### Why session close time matching
Multiple pool sessions can have the same H/L price. Price-based lookup matches the WRONG session, causing orphaned lines at wrong positions and missing lines for the correct session. Session close times are unique integer timestamps — immune to float precision and price collisions.

### Why auto-mitigation was NOT re-enabled
Auto-mitigation (marking levels as "done" after N bars) was attempted and caused valid MBZ patterns to be missed. The level could be breached by a wick touch earlier, auto-mitigated, and then the actual sweep candle arrives too late. The breach flag gating provides sufficient performance without mitigation.

### Why `timeframe.change()` was NOT used for daily detection
`timeframe.change("D")` fires at session boundaries (18:00 for CME), merging Sunday evening + Monday into one session. `ta.change(dayofmonth())` fires at midnight, properly separating Sunday evening from Monday. The `coming_from_sunday_evening` guard prevents duplicate entries at midnight on sub-daily charts.

---

## Remaining Work

### MBZ Prime
- **Phase 11: Hide Nested MBZs** — option to hide zones fully contained within a larger active zone
- **Phase 12: DTT Removal** — deferred, user will decide
- **Label Collapsing** — discussed but deferred. When too many source tokens, collapse by category (htf/sess/tf)
- Plan file: `indicators/01-mbz/code/mbz-prime/prime-repair-plan.md`

### MBZ Relay (Pool Integration)
- **Phase 2**: Detection against HTF candles — adapt `detect_liquidity_pool_patterns` for HTF context, run inside `process_htf_close()`
- **Phase 3**: Weekly + Monthly pools
- **Phase 4**: UI controls (per-pool toggles, formation rule toggles)
- **Phase 5**: Source labeling in zone labels
- **Phase 6**: Performance hardening
- **Phase 7**: Session pools (optional, lower priority)
- Plan file: `indicators/01-mbz/code/mbz-sif-relay/relay-liquidity-plan.md`

### Relay Phase 2 Key Details
- Pool tracks on chart bars (every bar) for H/L + breach marking
- Detection only runs on HTF candle boundaries using HTF OHLC (`ctx.o2/c2` = candle A, `ctx.o1/c1` = candle B)
- Breach timing: compare `breach_time` against HTF candle time windows (`ctx.t1`, `ctx.t2`) instead of `time`/`time[1]`
- IMM/STD/DEL condition functions are identical to Prime
- Pools tracked once (global), detection runs per HTF tier
- Zones created via existing `get_or_create_zone` with liquidity source tokens

---

## File Locations

| File | Purpose |
|------|---------|
| `indicators/01-mbz/code/mbz-prime/production/mbz-prime.pine` | MBZ Prime indicator |
| `indicators/01-mbz/code/mbz-prime/prime-repair-plan.md` | Prime repair plan (phases with status) |
| `indicators/01-mbz/code/mbz-sif-relay/production/mbz-sif-relay.pine` | MBZ Relay indicator |
| `indicators/01-mbz/code/mbz-sif-relay/relay-liquidity-plan.md` | Relay integration plan |
| `indicators/09-playful/code/development/playful-pulse.pine` | Pulse indicator |
| `indicators/01-mbz/code/mbz-core/production/mbz-core.pine` | MBZ Core (reference for wick extension) |

---

## Code Quality Rules (from CLAUDE.md)

- Append "-dev" to indicator titles during development, remove before final commit
- Never take shortcuts — remove variables entirely, don't hardcode
- Keep code DRY — parameterize functions
- Never add subjective commentary in code
- Never convert color formats without permission
- Keep color reference table in sync
- NEVER execute git commands without explicit permission for each command

---

## User Preferences (from memory)

- User is a senior developer who builds TradingView indicators for ICT/smart money trading
- Prefers the principal-engineer agent for complex implementations
- Wants clear ELI5 explanations of technical changes
- Values production quality over speed — would rather rewrite than patch
- Frustrated by sloppy implementations — always have principal review
- Git commands require explicit permission for EACH command
