# MBZ Indicators — TODO

Status: audit complete (see bottom of this file). Revised execution plan below.

---

## Known regression / decision log

### Self-TF pool tracking reverted (commit 6157a092's `<` → `<=` change)
**Symptom**: with `<=`, on a 4H chart the 4H pool self-tracks every bar. Every prior 4H candle becomes a pool level, and the next 4H candle that sweeps one creates a new 4H MBZ. This floods `all_mbz_records` with thousands of 4H records over a historical load. The FIFO cap at line ~3737 (`max_mbz_records_effective = max_liquidity_mbzs + max_invalidated_mbzs`, ~60 + invalidated) overflows, oldest records get evicted first, and the HTF (daily/weekly/monthly) records — which formed earliest in the chart history — are the first to be displaced. Net effect: HTF MBZs disappear from the visible window, seemingly "consumed" by 4H records.

**Root cause**: FIFO eviction is source-type-agnostic. Self-TF tracking produces records at a much higher rate (roughly 1 per bar) than HTF pool tracking (1 per day/week/month). With a small records cap, high-rate sources always win out.

**Decision**: revert the `<=` → `<` gate on lines 3093-3095 (self-TF pool tracking OFF on the chart's own TF). Keeps HTF MBZs stable on HTF charts. Lose the ability to detect self-TF sweeps on the chart's own TF (still visible on sub-TFs).

**If you want self-TF sweeps back** — three options, all require changes beyond the gate:
1. Raise `max_liquidity_mbzs` default substantially (cheap, trades memory for headroom).
2. Source-type-aware trimming: give HTF records priority survival in the FIFO eviction. Architectural but correct.
3. Reduce self-TF scan caps (`FOUR_HOUR_LIQUIDITY_SCAN_CAP` etc.) dramatically when `current_tf_minutes == pool_tf_minutes` so fewer pool levels exist to sweep. Targeted, preserves HTF budget.

## Execution Plan (ordered by ROI × risk)

### 1. Remove DTT sessions entirely ✅ DONE
Product decision: DTT dropped from MBZ indicators. Executed as single atomic commit.

**Removed** (mbz-prime.pine, ~510 lines deleted, 4675 → 4165):
- Per-bar DTT tracking block (99 lines)
- `process_dtt_sessions()` function (106 lines)
- Template instantiation block + 3 helper functions (`is_within_dtt_time_range`, `get_dtt_session_name_lower`, `get_last_dtt_session`)
- `dtt_session_templates`, `dtt_session_instances`, `dtt_dummy_pool` var state
- `DttSession` type (22 fields)
- `liquidity_dtt_count` field from `SourceTypeStats`
- 4 × `profile_dtt_*` counter vars
- 15 × `DTT_SESSION_*` names + 15 × `_LOWER` versions + 30 × `DTT_TIME_*` HHMM constants
- `LIQUIDITY_SOURCE_TYPE_DTT`, `STATUS_DISPLAY_DTT`, `DEFAULT_DTT_LIQUIDITY_COLOR`, `DEFAULT_DTT_LIQUIDITY_LINE_WIDTH`, `MAX_TF_DTT_LIQUIDITY`, `DTT_MAX_SESSIONS_TO_KEEP`, `GROUP_LIQUIDITY_DTT`, `INPUT_LABEL_DTT`
- `enable_dtt_sessions` + `enable_dtt_liquidity_tracking` + 3 source-origin DTT inputs
- DTT branch in `get_source_type_stats()` + `build_source_breakdown()` + `build_source_breakdown_extension_from_stats()`
- DTT source origin render branch (21 lines)
- DTT MBZ creation block (44 lines)
- Color reference table DTT row + row re-indexing (14 → 13 rows)
- Status table `source_parts` DTT push
- `all_sources_enabled` updated to drop `enable_dtt_sessions` term

**Verified**: zero DTT references remain in mbz-prime.pine. mbz-core and mbz-sif-relay were already clean (confirmed pre-removal).

**Post-removal fix**: removing `liquidity_dtt_count` from `SourceTypeStats` type required dropping one positional zero from `SourceTypeStats.new(0, 0, ..., 0)` at line 2139 (17 args → 16). Missed on first pass, surfaced during user testing as "Undeclared identifier stats.liquidity_15m_count" because Pine's type inference collapsed at the bad constructor site. Reinforces the deletion-checklist rule: count args in EVERY `<Type>.new(` against current field count — no shortcuts for "obvious" shared types.

**Not touched in this commit** (out of scope):
- `indicators/deprecated/01-mbz/code/mbz-prime/prime-repair-plan.md` — historical planning doc, contains DTT refs
- `indicators/deprecated/01-mbz/code/mbz-prime/session-handoff.md` — session snapshot, contains DTT refs
These are historical records, not active reference material. Leave as archaeology or clean up in a separate docs pass.

---

### 2. Gate intraday session pools by timeframe ✅ DONE
Skip Asia/London/NYAM/Lunch/NYPM/ONS/Premarket (+ NINE variants) processing on HTF charts where they're irrelevant.

**Root cause found during implementation**: the tracking blocks (lines 3580-3855 equivalent) were already TF-gated via `enable_*_liquidity_tracking` — the audit's claim about "wasted time() probes" was incorrect for those. The REAL leak was in the processing blocks (~lines 3585-3657) which only checked `enable_*_liquidity` (user input) without the TF gate, so on HTF charts `process_liquidity_pool(...)` was still being called on empty stale pools every bar, allocating 5-7 arrays per call.

**Fix**: added `and enable_<session>_liquidity_tracking` to all 11 intraday processing `if` conditions (Asia/London/NYAM/Lunch/NYPM/ONS/Premarket + 4 NINE variants).

**Expected benefit on 4H+ charts**: ~55-77 array allocations/bar eliminated + 11 × `process_liquidity_pool` + 11 × `process_liquidity_events` calls skipped per bar. Estimated medium win specifically for HTF historical loads.

**Not touched**: Daily/Weekly/Monthly processing blocks at lines 3565/3572/3579 don't have TF gates either, but user's scope was explicitly intraday. HTF gating for D/W/M left for future consideration if relevant (daily gate would skip on below-15m or above-weekly).

---

### 3. Read `process_liquidity_events` + count `request.security` budget ✅ DONE

**`process_liquidity_events` (line 2280)** — not a hot spot. Simple loop: exits if event_count == 0, otherwise 7× `array.get` per event to unpack + one `create_liquidity_mbz_record` call. Zero allocations inside the loop. Common-case cost is one `array.size` check per bar. No changes needed; the real hot work is upstream in `process_liquidity_pool`'s tuple-return allocations.

**`request.security` budget** — prime currently uses 2 calls (lines 3080-3081: weekly H/L and monthly H/L). Pine limit is ~40/indicator. **~38 free slots.** The architectural D/W/M migration (step 7) is feasible without hitting the cap.

---

### 4. Hoist tuple-return array allocations ✅ DONE (kept — benefit unverified)
Hoisted 12 per-call array allocations to function-scoped `var` state reused across calls.

**`detect_liquidity_pool_patterns`** (line 1286): 5 arrays (`events_is_high`, `events_formation_rule`, `events_is_exact_midpoint`, `events_source_price`, `events_source_bar_index`) moved from `array.new_*()` on entry → `var array.new_*()` + `array.clear()` on entry.

**`process_liquidity_pool`** (line 1471): 7 arrays (`detected_events_is_high`, `detected_events_rules`, `detected_events_is_exact`, `detected_events_source_price`, `detected_events_source_bar_index`, `detected_events_session_close_time`, `detected_events_level_time`) moved to same pattern.

**Correctness reasoning**: both functions return references to their scratch arrays via tuple. Callers read synchronously — `process_liquidity_events(daily_events_is_high, ...)` iterates and consumes before the next `process_liquidity_pool(weekly_liquidity_pool, ...)` call overwrites. Within a single call, `detect_liquidity_pool_patterns` is called in a loop AND once after; each return is immediately copied out to `detected_events_*` before the next call. Verified by tracing all call sites.

**Honest perf framing**: the audit ranked this "Large win" but was explicitly speculating — no profiling. After implementing and testing, user did not perceive a substantial speedup. Retained anyway because (a) the change is correct, (b) it does eliminate some work even if modest, and (c) reverting costs more reading than it saves. **Not treated as a proven perf win.**

**Other per-call allocations still present** (not touched — lower priority, same uncertainty):
- `get_source_type_stats` allocates `SourceTypeStats.new(0,0,...)` + `tokens_seen` — called from label building, gated to `needs_visual_update`, not hot on historical load.
- `build_source_breakdown*` helpers allocate `parts` — same gating.
- `create_liquidity_mbz_record` / `cache_mbz_data` allocate `MBZRecord.new(...)` — per-event, not per-bar.
- `invalidated_indices` at line ~3708 — inside GC block gated to `islastconfirmedhistory or islast`.

---

## Remaining optimization candidates (unordered, user-directed)

Confidence labels:
- 🟢 = evidence-backed (measurement, git history, or verified behavior elsewhere)
- 🟡 = reasoned from code reading, not measured
- 🔴 = speculation, no evidence

### 🟢 Migrate HTF (D/W/M) pool tracking to relay's `request.security` pattern
Relay loads faster than prime and uses `request.security(syminfo.tickerid, "D"/"W"/"M", [high, low])` for HTF pool data. Prime iterates bars manually for daily, uses request.security only as a value override for weekly/monthly. Migrating means TradingView's engine does the HTF aggregation server-side; prime just reads cached values per bar.

- **Evidence**: relay does it, relay is faster
- **Security call budget**: 2 used, ~38 free — feasible
- **Risk**: moderate — integration with existing MBZ detection pipeline
- **Effort**: architectural
- **Anchors**: mbz-prime lines ~3190-3230 (current HTF tracking), relay lines 3146-3155 + 3275-3287 (reference implementation)

### 🟡 Replace session `time(period, session_str, tz)` probes with HHMM math
On intraday TFs, 11 session tracking blocks each call `time(timeframe.period, session, NY_TIMEZONE)` twice per bar to detect "am I in session X?" That's ~22 timezone lookups per bar. If Pine's `time()` is expensive, switching to simple HHMM-range checks (`cur_hhmm >= session_start and cur_hhmm < session_end`) is cheaper.

- **Evidence**: none — don't know how expensive Pine's `time()` actually is
- **Risk**: low — changes only "in session?" detection, not pool mechanics
- **Effort**: medium (11 blocks to update)
- **Note**: if done alongside the pool-block DRY consolidation, both changes land together

### 🟡 Consolidate 11 pool processing blocks into a parameterized loop
Replace 11 copy-paste blocks with a single loop over a `PoolDescriptor` array. Not a direct perf win — it's code quality. The force multiplier is that future perf changes apply once instead of 11 times. Also surfaces bottlenecks during the refactor that a superficial audit misses.

- **Evidence**: DRY violation is a code quality issue, not a perf one
- **Risk**: medium (big diff)
- **Effort**: largest single change in backlog
- **Anchors**: mbz-prime lines ~3565-3681

### 🟡 Reduce `LIQUIDITY_SCAN_CAP` constants
Scan caps (ASIA/LONDON/NYAM/etc = 200, TF pools = 500) bound worst-case scan work when a breach happens. Lower caps = faster worst case but older levels stop being detectable.

- **Evidence**: none — don't know how often the scan actually hits the cap
- **Tradeoff**: perf vs feature reach (user-facing)
- **Effort**: trivial
- **Anchors**: mbz-prime constants block near top

### 🔴 Short-circuit `process_liquidity_pool` when nothing changed
Audit suggested this but on re-read, the finalized-session scan is already gated by `has_recent_breach`. Only the current-session path always runs. After step 4's hoist the no-breach allocation cost is already gone. Diminishing returns.

- **Evidence**: looks like the juice is already squeezed
- **Effort**: moderate
- **Verdict**: probably not worth it

### 🔴 Cache `timeframe.in_seconds()` and `is_247_asset` in `var`
Both are `var`-eligible and currently recomputed multiple times per bar.

- **Evidence**: none — cost of these is probably negligible
- **Effort**: trivial
- **Verdict**: cleanup, not perf

---

## Dead code / cleanups flagged by the audit

### `check_mbz_confirmation` is a no-op
mbz-prime lines 2231-2233. The function just returns `mbz_record` unchanged. Either dead code from a removed feature, or an unfinished hook. Investigate → delete if dead, document if intentional.

### `MAX_TF_DTT` / `MAX_TF_DTT_LIQUIDITY` / `MAX_TF_INTRADAY_LIQUIDITY` naming inconsistency
Partially resolved this session (MAX_TF_DTT → MAX_TF_DTT_LIQUIDITY). All three will be deleted as part of #1 (DTT removal) or become simpler after the pool-consolidation refactor in #5.

---

## Code Quality (non-perf)

### Convert all `UDT.new()` calls to named args (HIGH priority)
**Why**: Positional constructor args hide field-variable bindings and cause silent shifts on field deletion. We hit this today with `is_extended` (field name) vs `was_extended` (writer variable) — grep for the field name missed the write entirely, and deleting the field silently corrupted positional arg order in two constructor call sites.

**Files**:
- `indicators/deprecated/01-mbz/code/mbz-prime/production/mbz-prime.pine` — `MBZRecord.new(` sites (`cache_mbz_data`, base constructor in liquidity path)
- `indicators/deprecated/01-mbz/code/mbz-core/production/mbz-core.pine` — `MBZRecord.new(` sites (`cache_mbz_data`, gap detection loop)

**Scope**: all UDT constructors, not just `MBZRecord` — apply to `LiquidityPoolCollection`, `ConsolidatedMBZ`, etc.

**Benefit**: grep for a field name finds every write site, adding/removing fields doesn't shift positions, self-documenting call sites.

---

### Struct field audit / dead-field census
Run a field-use census on every UDT in both files:
- For each field: count reads (`.field_name` access) and writes (constructor positional slot + `.field := value` assignments + `.field = value` in type initialization).
- Any field with writes but zero reads = dead write (like `is_extended` was).
- Any field with reads but zero writes = never-populated bug.

---

### Deletion checklist for struct fields
Before deleting a field from any UDT:
1. Grep the field name across all reads and writes
2. Grep `<TypeName>.new(` and count args at every call site
3. For each call site, identify which positional slot maps to the field
4. Grep every variable name that appears in that slot — writers can use ANY name, not just the field name
5. Only delete if all slots pass literal defaults (`false`/`0`/`na`) OR you're removing every write expression in the same commit

---

### Color reference table sync
Per CLAUDE.md rule, any time a color input is added/removed/renamed, update the color reference table in the same edit. No known drift today — flag for future PRs.

---

## Speed audit findings (reference)

Full audit completed this session. Key discoveries:

1. **Relay is faster because it does ~30-40% less work**, not because of `request.security` alone. Relay has 5 pool types vs prime's 14, zero DTT, and no MBZ record system (no consolidation, no invalidation loop, no extension boxes). Relay's MBZs are gap-based and only processed on HTF closes.

2. **The biggest per-bar cost in prime is hidden array allocations**, not the pool tracking loops themselves. ~150 empty array allocations per bar across `process_liquidity_pool`, `detect_liquidity_pool_patterns`, and `process_dtt_sessions` tuple returns. Fix = #4 above.

3. **The self-TF gate loosening (commit `6157a092`) is real but small.** ~30-45 extra ops per bar on self-TF charts. Not the dominant slowdown — reverting it alone won't restore parity with relay.

4. **DTT is a meaningful cost by itself.** O(15 × active_instances) existence check + O(instances²) in get_last_dtt_session. Removed entirely per product decision in #1.

5. **`manage_consolidated_mbz_display()` is correctly gated** to `islastconfirmedhistory or islast` — it does NOT run during historical load. Not a target.

### Uncertainties the audit flagged honestly
- Pine array-allocation cost not empirically benchmarked — #4's "Large" ranking is reasoned, not measured. Confidence from high frequency (~150/bar) + Pine's known struct-vs-array cost ratio.
- `process_liquidity_events` (line 2603) not opened. Could hide more hot work.
- Prime's existing `request.security` call count not tallied. #7 feasibility depends on this.

These three gaps are addressed by step #3 above.
