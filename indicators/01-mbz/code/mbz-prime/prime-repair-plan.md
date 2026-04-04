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

- `mark_breaches()` returns bool flag when any new breach is found
- Per-pool `var` breach flags with previous-bar rotation
- `process_liquidity_pool()` skips finalized session loop entirely when no breach on current or previous bar
- Current session processing always runs (no skip)
- Zero detection risk — if no breach happened, no pattern can form

**Test**: No 60-second timeout. Same MBZ detections as Phase 3. No missing MBZs. Compare counts.

---

## Phase 5: Source Origin Label Centering ✅

- Source origin labels: `label.style_none`, no vertical offset, sit directly on line
- Remove offset multiplier constants
- Labels centered horizontally on the line

**Test**: Labels on the line, not floating below. Existing pool labels readable.

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

## Phase 7: Superscript TF Labels (after Phase 6)

- Superscript formatting for TF pool labels: 4ʰ, 1ʰ, 15ᵐ

**Test**: TF labels use superscript. Existing pool labels unchanged.

---

## Phase 8: Cross-Pool Source Line Deduplication ✅

- Replace 20 per-pool line/label arrays with 2 unified arrays
- Replace 10 per-pool dedup arrays with map-based O(1) lookup
- Same price from different pools → 1 line, merged label (e.g., "2: asia, ons")
- Tokens ordered by priority (monthly > weekly > daily > sessions)
- Line color/width from highest-priority pool
- Gate source origins with `should_highlight_consolidated_zone` (orphan fix)
- Fixed missing nypm/ons/premarket cleanup bug

**Test**: Shared prices show one line. Labels readable with count format. No orphaned lines.

---

## Phase 9: Source Origin Orphan Fix ✅ (merged into Phase 8)

- Included in Phase 8 — `should_highlight_consolidated_zone` gate added to source origin rendering

---

## Phase 10: Extend-to-Wick Update + 50% Midline ✅

- Zone boundary uses the most extreme wick between ref candle and MBZ candle (matches Core)
- Two-step architecture: compute base zone, then only expand via min/max
- Removed `should_extend_wick()`, replaced with Core's approach in `get_mbz_subtype_zone()`
- 50% midline: dotted line at zone midpoint with adjustable color, width, and style
- Midline hidden on invalidated zones

**Test**: Zone boundaries extend to furthest wick. Midline visible at 50%. Style customisable.

---

## Phase 11: Hide Nested MBZs

- Option to hide MBZ zones that are fully contained within an existing non-invalidated MBZ zone
- If zone A is 90-100 and zone B is 92-98, zone B is nested and can be hidden
- New input toggle (similar to existing "show only latest/first touch" filters)
- Hidden nested MBZs also hide their source origin lines

**Test**: Nested MBZs hidden when toggle on. Non-nested MBZs unaffected. Toggle off shows all.

---

## Phase 12: DTT Removal (deferred)

- Remove all ~208 DTT references (constants, types, inputs, pools, tracking, detection, rendering, labels, status table)
- Update `SourceTypeStats` constructor arg count

**Test**: No DTT MBZs. No DTT in settings/labels/status. All other pools unaffected.

---

## Dependency Graph

```
Phase 1 → 2 → 3 → 4 → 5 → 6A → 6B → 6C → 7 → 8 → 9 → 10 → 11
                                                              └→ 12 (deferred)
```

Each phase is independently committable and testable on TradingView before proceeding.
