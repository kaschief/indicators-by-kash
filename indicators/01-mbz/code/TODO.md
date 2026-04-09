# MBZ Indicators — TODO

## Code Quality

### Convert `MBZRecord.new()` calls to named args (HIGH priority)
**Why**: Positional constructor args hide field-variable bindings and cause silent shifts on field deletion. We hit this today with `is_extended` (field name) vs `was_extended` (writer variable) — grep for the field name missed the write entirely, and deleting the field silently corrupted positional arg order in two constructor call sites.

**Files**:
- `indicators/01-mbz/code/mbz-prime/production/mbz-prime.pine` — `MBZRecord.new(` sites (see `cache_mbz_data`, base constructor in liquidity path)
- `indicators/01-mbz/code/mbz-core/production/mbz-core.pine` — `MBZRecord.new(` sites (`cache_mbz_data`, gap detection loop)

**Benefit**: grep for a field name finds every write site, adding/removing fields doesn't shift positions, self-documenting call sites.

**Scope check before starting**: audit ALL UDT constructor call sites in both files, not just MBZRecord. Apply the same rule to `LiquidityPoolCollection`, `ConsolidatedMBZ`, etc. if they're called with positional args anywhere.

---

### Struct field audit / dead-field census
Run a field-use census on every UDT in both files:
- For each field: count reads (`.field_name` access) and writes (constructor positional slot + `.field := value` assignments).
- Any field with writes but zero reads = dead write (like `is_extended` was).
- Any field with reads but zero writes = never-populated bug.

Start with MBZRecord (the one we just cleaned) and work outward.

---

### Deletion checklist for struct fields
Before deleting a field from any UDT:
1. Grep the field name across all reads and writes
2. Grep `<TypeName>.new(` and count args at every call site
3. For each call site, identify which positional slot maps to the field
4. Grep every variable name that appears in that slot — writers can use ANY name, not just the field name
5. Only delete if all slots pass literal defaults (`false`/`0`/`na`) OR you're removing every write expression in the same commit

---

## Performance

### Investigate mbz-prime slowdown after sub-TF pool gate loosening
**Change**: commit `6157a092` loosened the gates from `< 15/60/240` to `<= 15/60/240` so 15m/1H/4H candle pools track on their own TF.

**Observation**: mbz-prime feels slower loading. Expected — on e.g. a 1H chart, the 1H pool block now runs every bar (finalize/reset/breach-mark), which is new work over full history.

**Investigate**:
- Is the cost dominated by `liquidity_pool_finalize_session` (scan cap loop) or by `mark_breaches`?
- Can we short-circuit when user has NOT enabled the corresponding `enable_*_liquidity` input? (Currently the outer `if` guards on both `enable_tracking` and `enable_input`, so this should already be gated — verify.)
- Does `FIFTEEN_MIN_LIQUIDITY_SCAN_CAP = 500` / `ONE_HOUR_LIQUIDITY_SCAN_CAP = 500` / `FOUR_HOUR_LIQUIDITY_SCAN_CAP = 500` need to be lower on own-TF charts where each bar = one pool?

### Why is mbz-sif-relay faster than mbz-prime despite similar checks?
Compare architectures:
- `indicators/01-mbz/code/mbz-sif-relay/production/mbz-sif-relay.pine`
- `indicators/01-mbz/code/mbz-prime/production/mbz-prime.pine`

Hypotheses to verify (do NOT speculate — read code first):
- Does relay use `request.security` backfill whereas prime computes from live chart bars?
- Does relay process fewer sources per bar?
- Does relay skip consolidation/grouping logic that prime runs?
- Does relay have a smaller `all_mbz_records` array ceiling?
- Different scan caps?

Profile approach: instrument one or two hot loops with `var int counter += 1` and compare post-load counts between indicators on the same chart/TF.

---

## Outstanding Cleanups (smaller)

### mbz-prime: `MAX_TF_DTT` naming inconsistency
Already renamed to `MAX_TF_DTT_LIQUIDITY` this session. Leave note: verify mbz-core has no same-named constant that drifted.

### Color reference table sync
Per CLAUDE.md rule, any time a color input is added/removed/renamed, update the color reference table in the same edit. No known drift today — flag for future PRs.
