# MBZ Indicators — TODO

Status: audit complete (see bottom of this file). Revised execution plan below.

---

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
- `indicators/01-mbz/code/mbz-prime/prime-repair-plan.md` — historical planning doc, contains DTT refs
- `indicators/01-mbz/code/mbz-prime/session-handoff.md` — session snapshot, contains DTT refs
These are historical records, not active reference material. Leave as archaeology or clean up in a separate docs pass.

---

### 2. Gate intraday session pools by timeframe (trivial win)
Skip Asia/London/NYAM/Lunch/NYPM/ONS/Premarket blocks entirely on HTF charts where they're irrelevant. Currently each session runs 2× `time(timeframe.period, session, NY_TIMEZONE)` probes per bar — ~20 probes/bar wasted on 4H+ charts.

- Add outer TF gate to each session block
- Small–medium perf win, ~15 min of work, trivial risk

**Anchors**: mbz-prime lines 3580-3855

---

### 3. Read `process_liquidity_events` + count `request.security` budget
Two unknowns the audit flagged that need resolution before touching architecture:
- `process_liquidity_events` at line 2603 wasn't opened — may hide more per-bar work
- Pine Script has a ~40 `request.security` call limit per indicator. Prime currently uses a handful; relay uses more. Need a head count before proposing #6 migration.

**Deliverable**: two-paragraph summary added to this TODO before #4 starts.

---

### 4. Hoist tuple-return array allocations (BIGGEST PERF WIN)
Root cause: `process_liquidity_pool`, `detect_liquidity_pool_patterns`, and `process_dtt_sessions` each allocate 5–7 fresh arrays every call. With ~14 pools (soon ~13 after DTT removal), that's **~150 empty array allocations per bar, every bar, across full chart history.**

- Replace with `var`-scoped reusable arrays + `array.clear()` per call
- Or refactor the API to direct-write via struct outparams

**Hypothesized win**: Large. Ranked #1 by the audit.
**Effort**: moderate
**Risk**: low if API shape is preserved
**Anchors**: mbz-prime lines 1533-1537, 1697-1702, 1808-1814

---

### 5. Consolidate 14 pool blocks into one parameterized loop
Replace the 14 copy-paste pool tracking blocks with a single loop over a pool-descriptor array. Doesn't speed things up directly, but means any future perf fix applies once instead of 14 times. Force multiplier.

- **Risk**: medium — `time()` session probes take literal session strings, so the descriptor must carry them
- **Effort**: architectural
- **When**: after #4, before #6

**Anchors**: mbz-prime lines 3528-3888

---

### 6. Short-circuit `process_liquidity_pool` when nothing changed
Currently the current-session path at 1904-1969 runs unconditionally. On bars with no breach and no pool state change, this is pure waste. Add early return that skips the block when `has_recent_breach` is false AND no pending events.

- **Win**: medium
- **Effort**: moderate
- **Risk**: must preserve event emission on the exact breach bar
- **Anchors**: mbz-prime lines 4021+, 1904-1969

---

### 7. Port mbz-prime HTF pools (D/W/M) to relay's `request.security` pattern
Relay reads D/W/M H/L directly from `request.security(syminfo.tickerid, "D"/"W"/"M", [high, low])` + batched backfill. Prime iterates bars manually for daily and only uses request.security as a value override for weekly/monthly.

- **Win**: small-medium on prime specifically
- **Effort**: moderate
- **Risk**: Pine's 40 `request.security` call budget — must verify headroom (blocked by #3)
- **Anchors**: mbz-prime lines 3528-3577 (targets), relay lines 3146-3155 + 3275-3287 (reference implementation)

---

### 8. Cache `timeframe.in_seconds()` and `is_247_asset` in `var` at top of bar
Trivial. Both are `var`-eligible and currently recomputed multiple times per bar.

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
- `indicators/01-mbz/code/mbz-prime/production/mbz-prime.pine` — `MBZRecord.new(` sites (`cache_mbz_data`, base constructor in liquidity path)
- `indicators/01-mbz/code/mbz-core/production/mbz-core.pine` — `MBZRecord.new(` sites (`cache_mbz_data`, gap detection loop)

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
