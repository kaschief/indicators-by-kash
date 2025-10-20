# 📋 Weekly DTT Implementation Notes
**CRITICAL: Read this file before making ANY changes to kash-dtt-weekly-pro.pine**

> This file contains all implementation details, bug fixes, performance optimizations, and critical notes that MUST be understood before modifying the Weekly DTT indicator code.

---

## 🚨 CRITICAL CODE SECTIONS - DO NOT MODIFY

### 1. PASS 1: Session END Detection (Lines ~344-369)
**Purpose:** Mark sessions as complete and update timestamps

**CRITICAL Rules:**
- MUST run BEFORE PASS 2 (session starts)
- Updates `end_timestamp` to actual bar time (not calculated)
- Updates end boundary line coordinates
- Updates high/low line x2 coordinates to stop at correct end time
- Required for previous session lookups to work correctly

**Why This Order Matters:**
When Icarus ends and Iscariot starts on same bar (Sun 18:00), Icarus must be marked completed BEFORE Iscariot looks for previous session.

---

### 2. PASS 2: Session START Creation (Lines ~371-453)
**Purpose:** Create new sessions and draw initial visual elements

**CRITICAL Rules:**
- Uses actual bar `time` for start_timestamp (NOT calculated timestamp)
- Draws BOTH start AND end boundaries at creation
- Draws high/low lines showing PREVIOUS session's values
- Extends PREVIOUS session's root zones to current session's end

**Why Actual Bar Time:**
On 4h chart, if session time is 18:00 but bar opens at 16:00, use 16:00. This ensures boundaries appear at the correct bar on all timeframes.

---

### 3. High/Low Tracking Loop (Lines ~514-577)
**Purpose:** Track session highs/lows from current timeframe bars

**CRITICAL Rules:**
- Uses current timeframe's OHLC (NOT 5-minute intrabar data for historical bars)
- Checks ALL recent sessions using is_in_session()
- Three-level decision tree for boundary bars (Issue #7, #9 fixes)
- Performance optimization: Only processes recent sessions (max_sessions_to_show + 4 buffer)

**Why Current Timeframe OHLC:**
On higher timeframes (15m+), request.security_lower_tf() only has data for CURRENT bar, not historical bars. Completed sessions never had their highs/lows tracked when using intrabar data.

**Three-Level Decision Tree:**
1. **Level 1:** Does bar OVERLAP with session? (bar start OR bar end in session)
2. **Level 2:** Is this a BOUNDARY bar or FULLY in session?
3. **Level 3:** Do we have 5-minute intrabar data available?
   - If YES + boundary bar → Filter intrabars to exclude out-of-session extremes
   - If NO or fully in session → Use full bar OHLC

---

### 4. Cache Rebuild Logic (Lines ~323-334)
**Purpose:** Rebuild 5-minute intrabar day/minutes cache every bar

**CRITICAL Rule:**
- Invalidate cache by BAR TIME, not array SIZE
- `if time != last_bar_time` (NOT `if size != last_size`)

**Why This Matters:**
On 4h chart, each bar has ~48 five-min bars (same size). Moving to next bar gives NEW data but SAME array size. Old size-based approach resulted in stale cache → root capture failures.

---

### 5. Session Pruning Logic (Lines ~626-656)
**Purpose:** Prevent unbounded memory growth

**CRITICAL Rules:**
- Keep max_sessions_to_show + 20 buffer sessions
- Remove oldest sessions from array front
- Update total_sessions and start_index after pruning
- Only run AFTER visual elements are deleted

**Why 20 Buffer:**
Needed for previous session lookups (get_previous_session). Without buffer, high/low lines can't find previous session data.

---

## 🐛 RESOLVED ISSUES - DO NOT REGRESS

### Issue #1: Boundaries Landing on Wrong Candles
**Problem:** Calculated timestamps were 4 hours off on 4h chart
**Solution:** Use actual bar `time` instead of calculated timestamps
**Lines:** 355-368 (PASS 1), 390 (PASS 2)

---

### Issue #2: Missing Boundaries on Completed Sessions
**Problem:** End boundaries were deleted but not recreated
**Solution:** Always draw BOTH boundaries at creation, recreate if missing in visual loop
**Lines:** 412-414, visual loop boundary section

---

### Issue #3: High/Low Lines Not Appearing
**Problem:** Used 5-min intrabar data that doesn't exist for historical bars on HTF
**Solution:** Rewrote to use current timeframe OHLC for ALL sessions
**Lines:** 514-577

---

### Issue #4: High/Low Lines Extending Past Session End
**Problem:** Lines not updated when session ends with corrected timestamp
**Solution:** Update line x2 coordinates in PASS 1 when session ends
**Lines:** 364-367

---

### Issue #5: Performance Degradation with Debug Table
**Problem:** Expensive str.format() calls (24 per bar)
**Solution:** Removed debug table, simplified to YES/NO checks
**Status:** Debug table removed in cleanup

---

### Issue #6: Terminology Inconsistency
**Problem:** Mixed "pool" and "high/low" terminology
**Solution:** Renamed ALL pool references to high_low
**Variables:** pool_high_line → high_line, pool_low_line → low_line, etc.

---

### Issue #7: Session High/Low Missed on HTF Boundary Bars
**Problem:** Bars starting before session were skipped entirely
**Example:** Wed 12:00-16:00 bar contains Icarus start (12:45), high at 13:55 was missed
**Solution:** Check if bar OVERLAPS session (bar start OR bar end in session)
**Lines:** 538-541
**Trade-off:** May include some out-of-session data, but prevents missing true extremes

---

### Issue #8: Root Candle Dimensions Changing on HTF
**Problem:** Cache invalidation by array size missed updates on 4h chart
**Solution:** Changed cache key from SIZE to BAR TIME
**Lines:** 318, 324, 334
**Result:** Root dimensions stay constant (exact 5-min bar's high/low)

---

### Issue #9: Bar Overlap Includes Out-of-Session Extremes
**Problem:** Boundary bars included extremes from out-of-session portions
**Example:** Sun 16:00-20:00 bar showed 17:35 low instead of 18:00 session start low
**Solution:** Three-level decision tree with smart intrabar filtering
**Lines:** 543-577
**Result:** Boundary bars with available intrabar data exclude out-of-session extremes

**Screenshot Reference:** Screenshot 2025-10-17 at 03.26.33.png

---

## ⚡ PERFORMANCE OPTIMIZATIONS

### Optimization #1: Session Pruning (Lines ~626-656)
**Purpose:** Prevent unbounded memory growth
**Implementation:** Remove sessions beyond max_sessions_to_show + 20 buffer
**Impact:**
- Before: Array grows forever (208 sessions after 1 year)
- After: Capped at 60 sessions (for 10 weeks setting)
- Performance: 71% reduction in memory usage after 1 year

---

### Optimization #2: High/Low Tracking Loop (Lines ~518-534)
**Purpose:** Skip old sessions that can't overlap current bar
**Implementation:** Start loop from (total - max_sessions_to_show - 4 buffer)
**Impact:**
- Before: Process ALL sessions (208 after 1 year)
- After: Process max 44 sessions (40 display + 4 buffer)
- Performance: 79% faster on max settings

**Buffer Rationale:** 4 sessions = 1 full week cycle, ensures we catch all possible overlaps. Worst case: Icarus session = 77 hours = ~19 bars on 4h chart.

---

## 📊 PERFORMANCE BENCHMARKS

### Per-Bar Execution Cost

| Scenario | Operations/Bar | Status |
|----------|----------------|--------|
| **1 week, ≤1h** | ~150-200 | ⭐⭐⭐⭐⭐ Excellent |
| **3-5 weeks, ≤1h** | ~500 | ⭐⭐⭐⭐ Good |
| **10 weeks, 4h** | ~2,000-2,880 | ⭐⭐⭐ Acceptable |
| **After 1 year (no optimizations)** | ~10,000 | ⭐ Poor |
| **After 1 year (with optimizations)** | ~2,880 | ⭐⭐⭐ Acceptable |

### Memory Usage

| Time Period | Without Pruning | With Pruning |
|-------------|-----------------|--------------|
| 1 week | 4 sessions | 4 sessions |
| 1 month | 16 sessions | 24 sessions (capped) |
| 1 year | 208 sessions | 60 sessions (capped) |
| 5 years | 1,040 sessions | 60 sessions (capped) |

---

## 🔧 HELPER FUNCTIONS

### `hhmm_to_minutes(int hhmm)`
**Purpose:** Convert HHMM format to minutes since midnight
**Example:** 1430 → 870 (14*60 + 30)
**Complexity:** O(1)

---

### `time_matches(int target_day, int target_time)`
**Purpose:** Check if target time falls within current bar's time range
**Behavior:**
- 5-minute: Exact match (day AND time must match exactly)
- Higher timeframes: Check if target falls in [bar_start, bar_end) range

**Why Different Behavior:**
On 4h chart, event at 18:00 falls within 16:00-20:00 bar. On 5m chart, event at 18:00 only matches 18:00 bar exactly.

**Complexity:** O(1)

---

### `is_in_session(int bar_day, int bar_minutes, DttWeeklySession sess)`
**Purpose:** Determine if specific day+time falls within session range
**Handles:**
- Multi-day sessions (Aries, Ash)
- Week-wrapping sessions (Icarus: Wed→Sun)
- Boundary cases (start day, end day, in-between days)

**Complexity:** O(1)

---

### `get_previous_session(string current_session_name)`
**Purpose:** Find most recent completed session of specific type
**Order:** Iscariot → Aries → Ash → Icarus (repeats)
**Usage:** For drawing high/low lines (each session shows PREVIOUS session's values)

**Complexity:** O(N) where N = session_instances size (bounded by pruning)

---

## 📐 SESSION TIME CONSTANTS

All times in America/New_York timezone, HHMM format:

| Session | Start | End | Duration | Root Time | Spans Days |
|---------|-------|-----|----------|-----------|------------|
| **Iscariot** | Sun 18:00 | Mon 07:00 | 13h | Sun 19:30 | Sun→Mon |
| **Aries** | Mon 07:00 | Tue 12:25 | 29.4h | Mon 09:45 | Mon→Tue |
| **Ash** | Tue 12:25 | Wed 12:45 | 24.3h | Tue 15:05 | Tue→Wed |
| **Icarus** | Wed 12:45 | Sun 18:00 | 77.3h | Wed 19:25 | Wed→Sun |

**CRITICAL:** These times are based on years of research - DO NOT MODIFY without explicit approval.

---

## 🎨 VISUAL ELEMENT LIFECYCLE

### 1. Creation (PASS 2)
- Both boundaries drawn at session start
- High/low lines showing PREVIOUS session's values
- Session name box with transparent borders
- Previous session's root zones extended

### 2. Updates (Every Bar)
- High/low tracking updates session_high/session_low values
- Session name box repositioned between tracked high/low
- Root zones extended when next session starts

### 3. Completion (PASS 1)
- End timestamp corrected to actual bar time
- End boundary line coordinates updated
- High/low line x2 coordinates updated to stop at session end

### 4. Cleanup (Visual Loop)
- Visual elements deleted when outside display window
- Session instances pruned when beyond buffer limit

---

## 🧪 TESTING CHECKLIST

### Core Functionality
- ✅ All 4 sessions display correctly (Iscariot, Aries, Ash, Icarus)
- ✅ Boundaries appear at correct bars on all timeframes
- ✅ High/low lines show PREVIOUS session's values
- ✅ Root zones extend through following session
- ✅ Session labels positioned between high/low

### Timeframe Coverage
- ✅ 5-minute (minimum)
- ✅ 15-minute
- ✅ 30-minute
- ✅ 1-hour
- ✅ 4-hour (maximum)

### Settings Coverage
- ✅ 1 week (default)
- ✅ 3 weeks
- ✅ 5 weeks
- ✅ 10 weeks (maximum stress test)

### Boundary Bar Cases
- ✅ Issue #7: Bar starting before session captures high/low
- ✅ Issue #9: Boundary bar excludes out-of-session extremes
- ✅ Fully in-session bars use full OHLC (performance)
- ✅ Historical bars gracefully fall back when no intrabar data

### Performance
- ✅ No lag on default settings (1 week)
- ✅ Acceptable performance on max settings (10 weeks, 4h)
- ✅ Memory stays bounded after long-term use
- ✅ No performance degradation over time

---

## 🔗 RELATED FILES

- `kash-dtt-weekly-pro.pine` - Main indicator code
- `DTT_WEEKLY_IMPLEMENTATION_PLAN.md` - Original implementation plan
- `weekly-dtt-times.md` - Session timing research
- `Screenshot 2025-10-17 at 03.26.33.png` - Issue #9 proof (third-party vs ours)

---

## 📝 CHANGELOG SUMMARY

### [2025-10-17] - Initial HTF Debugging Session
- Fixed boundary placement on all timeframes
- Fixed missing boundaries on completed sessions
- Rewrote high/low tracking for HTF compatibility
- Fixed high/low lines extending past boundaries
- Removed performance-degrading debug table
- Standardized terminology (pool → high_low)

### [2025-10-17] - Boundary Bar and Root Capture Fixes
- Fixed missed highs/lows on HTF boundary bars (Issue #7)
- Fixed root dimensions changing on HTF (Issue #8)
- Fixed out-of-session extremes in boundary bars (Issue #9)
- Implemented three-level decision tree for smart filtering

### [2025-10-17] - Performance Optimizations
- Implemented session pruning to prevent memory leak
- Optimized high/low tracking loop to skip old sessions
- Reduced long-term memory usage by 71%
- Improved max settings performance by 79%

---

## ⚠️ KNOWN LIMITATIONS

### Historical Bar Accuracy on HTF Boundary Bars
**Issue:** For historical bars (beyond current bar), boundary bar filtering is not available because request.security_lower_tf() only returns intrabar data for the CURRENT bar.

**Impact:** Historical boundary bars may include slight out-of-session data on 4h charts.

**Mitigation:** Recent bars (where traders care most) are accurate. This is an acceptable trade-off.

**Future Solution:** Could store session highs/lows at completion time, but adds complexity.

---

## 🚀 FUTURE ENHANCEMENTS (Optional)

### Low Priority
1. **Cache intrabar session membership** - Reduce repeated is_in_session() calls (HIGH complexity)
2. **Combine PASS 2 lookups** - Merge duplicate check and previous lookup into one loop (MEDIUM complexity)
3. **Store interval timestamps in type** - Avoid calculating from bar indices (LOW complexity)

**Note:** Current implementation is production-ready. These enhancements are OPTIONAL.

---

## 📞 MAINTENANCE CONTACT

**Last Updated:** 2025-10-17
**Indicator Version:** Pine Script v6
**Status:** Production Ready ✅

---

**END OF IMPLEMENTATION NOTES**
