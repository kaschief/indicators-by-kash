# MBZ Prime Repair Plan

Branch: `prime-repair` (clean baseline before changes)

---

## Phase 1: Deeper Scan Caps ✅

- Daily 100→300, weekly 50→100, monthly 30→100, sessions 50→200
- Remove redundant `LIQUIDITY_POOL_MAX_ENTRIES`, use scan caps directly as storage limits
- Each `liquidity_pool_finalize_session()` call uses its pool's scan cap

**Test**: More MBZs from deeper history. Daily reaches ~14 months. No compilation errors.

---

## Phase 2: Sunday 1D Fix ✅

- Add `timeframe.in_seconds() < 86400` to `should_skip_sunday_liquidity()`
- On 1D CME charts, Monday data is no longer lost

**Test**: Monday MBZs appear on 1D. Sub-daily behavior unchanged. 24/7 assets unaffected.

---

## Phase 3: Directional Enforcement (L-STD + L-DEL merge) ✅

- Enforce candle A moves INTO the sweep for both L-STD and L-DEL
- Remove `no_new_extreme` constraint (B can make new extreme before displacing)
- Remove L-STD• and L-DEL• distinctions — merge into L-STD and L-DEL
- Clean up dead STANDARD_PLUS and DELAYED_PLUS constants, prefixes, priority logic, tooltips
- Fix inverted priority in unification block (was DEL > STD > IMM, now IMM > STD > DEL)
- Remove `mbz_variant_mode` variable

**Test**: Fewer but higher quality detections. No bullet labels. Priority correct.

---

## Phase 4: Performance Optimization ✅

- Re-enable auto-mitigation with 3-bar grace window (was disabled for debugging)
- Record `first_breach_bar` in `mark_breaches()` so it's available for early-skip
- Early-skip in `process_liquidity_pool()`: skip mitigated entries and entries with stale breaches
- Fix stale `first_breach_bar` in `finalize_session()` — push clean slate values

**Test**: No 60-second timeout. Same MBZ detections as before optimization. No missing MBZs.

---

## Phase 5: DTT Removal

- Remove all ~208 DTT references (constants, types, inputs, pools, tracking, detection, rendering, labels, status table)
- Update `SourceTypeStats` constructor arg count

**Test**: No DTT MBZs. No DTT in settings/labels/status. All other pools unaffected.

---

## Phase 6: Timeframe Pools (one at a time)

### Phase 6A: 4H Pool
- Add `LIQUIDITY_SOURCE_TYPE_4H`, scan cap 200
- Add pool, tracking (`timeframe.change("240")`), detection, source origin rendering
- Timeframe gate: visible on sub-4H charts only

**Test**: On 5m/15m chart, 4H levels appear and MBZs form. On 4H chart, hidden. No orphaned lines.

### Phase 6B: 1H Pool
- Same pattern as 6A for 1H (`timeframe.change("60")`)
- Visible on sub-1H charts only

**Test**: 1H levels alongside 4H. 4H pool still works. No interference.

### Phase 6C: 15m Pool
- Same pattern for 15m (`timeframe.change("15")`)
- Visible on sub-15m charts only

**Test**: 15m levels alongside 1H and 4H. All pools unaffected.

---

## Phase 7: Label Improvements

- Source origin labels: `label.style_none`, no vertical offset, sit directly on line
- Superscript TF labels: 4ʰ, 1ʰ, 15ᵐ
- Remove offset multiplier constants

**Test**: Labels on the line, not floating. TF labels use superscript. Existing pool labels unchanged.

---

## Phase 8: Cross-Pool Source Line Deduplication

- When multiple pools have levels at the same price, draw one line with combined label
- Two-pass rendering: collect candidates, then draw deduplicated
- Label format: `daily·4ʰ·15ᵐ` for shared levels
- Line color/width from highest-priority pool

**Test**: Shared prices show one line. Different prices unaffected. Display cap respected.

---

## Phase 9: Source Origin Orphan Fix

- Gate source origin rendering with `should_highlight_consolidated_zone`
- Source lines only draw when the MBZ zone box is also drawn

**Test**: No orphaned lines for invalidated/hidden MBZs. Toggle "Show Invalidated" works correctly.

---

## Dependency Graph

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6A → 6B → 6C → Phase 7 → Phase 8 → Phase 9
```

Each phase is independently committable and testable on TradingView before proceeding.
