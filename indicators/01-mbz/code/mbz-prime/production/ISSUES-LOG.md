# MBZ Prime - Issues & Fixes Log

**Component:** MBZ Prime Production
**Last Updated:** 2025-10-05

---

## 🔴 CRITICAL ISSUES (Fixed)

### Issue #1: Saturday Pools Not Forming Sunday MBZs on Crypto
**Date:** 2025-10-05
**Severity:** CRITICAL
**Status:** ✅ Fixed

**Symptoms:**
- Saturday NYAM pool (12:00) on ETH did not form MBZ when breached at 12:20 on Sunday
- Saturday Lunch pool (13:30) on ETH did not form MBZ when breached at 13:32 on Sunday
- 24/7 detection showed GREEN but MBZs still didn't form
- Issue occurred in replay mode starting from Monday

**Root Cause:**
24/7 detection ran at `barstate.islastconfirmedhistory` (END of all historical bars):
1. Saturday pools created during historical replay → used `DAY_CODE_MON_SAT` (excludes Sunday)
2. Detection ran AFTER all pools already created → set `is_247_asset = true` (too late!)
3. Day codes already baked into pool definitions → Saturday pools couldn't breach on Sunday

**Fix Applied:**
Changed detection strategy to default `is_247_asset = true` (assume crypto) instead of `false`:
- Saturday pools now created with `DAY_CODE_ALL_DAYS` from the start
- Detection only runs once after 7+ days of data
- Only sets to `false` if scan proves no weekends exist (traditional market)

**Files Modified:** `mbz-prime.pine` (lines 566-602)

**Verified:** ✅ Green label shows, awaiting Saturday pool→Sunday MBZ confirmation

---

### Issue #2: Pine Script 10,000 Bar Lookback Limit Error
**Date:** 2025-10-05
**Severity:** HIGH
**Status:** ✅ Fixed

**Error Message:**
```
Error on bar 22223: Invalid number of bars back specified in the history-referencing operator.
It accepts a value between 0 and 10000.
at #main():580
```

**Root Cause:**
- Used `time[i]` where `i` was a bar index (e.g., 12,143)
- Pine's `[offset]` expects lookback bars (0-9999), NOT absolute bar indices
- On 1min: 7 days = 10,080 bars → exceeded Pine's 10,000 limit

**Fix Applied:**
```pine
// BEFORE (broken):
for i = scan_start to bar_index by 20
    check_day = dayofweek(time[i], NY_TIMEZONE)  // ❌ i is bar index

// AFTER (fixed):
for lookback = 0 to max_lookback by 20
    check_day = dayofweek(time[lookback], NY_TIMEZONE)  // ✅ lookback offset

max_lookback = math.min(9999, bars_in_7_days)  // Cap at Pine limit
```

**Files Modified:** `mbz-prime.pine` (lines 566-602)

**Verified:** ✅ No compilation errors

---

### Issue #3: Script Timeout on Non-24/7 Assets (40+ seconds)
**Date:** 2025-10-05
**Severity:** HIGH
**Status:** ✅ Fixed (prevented in final version)

**Symptoms:**
- NQ 5min chart took 40+ seconds to load
- Timeout occurred even with DTT sessions disabled
- Issue did NOT occur on BTC/ETH (24/7 assets)

**Root Cause:**
Early fix attempt used this logic:
```pine
should_run_detection = not is_247_asset and bar_index >= 100
```

On NQ (no weekends):
- `is_247_asset` stays `false` forever → condition ALWAYS true
- Detection ran on EVERY bar after bar 100
- 5000 bars × ~500 checks each = 2.5M+ operations = timeout

**Fix Applied:**
Added `detection_completed` flag to ensure one-time execution:
```pine
var bool detection_completed = false

if is_saturday_now or is_early_sunday_now
    is_247_asset := true
    detection_completed := true  // Never run again
else if not detection_completed  // Only runs ONCE
    // scan logic
    detection_completed := true  // Never run again
```

**Files Modified:** `mbz-prime.pine` (lines 566-602)

**Verified:** ✅ Logic review confirms one-time execution, awaiting real-world NQ test

---

### Issue #4: MBZ Labels/Extensions Not Visible After Formation
**Date:** 2025-10-05
**Severity:** MEDIUM
**Status:** ✅ Fixed

**Symptoms:**
- Saturday MBZ formed at 14:56
- Sunday 11:32 (20 hours later = ~300 bars on 4min)
- MBZ not visible: no label, no extension box
- MBZ existed but was filtered from display

**Root Cause:**
Hard-coded display limit at line 3699:
```pine
max_safe_lookback = 300
```

MBZ age check:
```pine
if show_mbz_labels and mbz_age <= max_safe_lookback  // Labels hidden if > 300 bars
if ... and mbz_age <= max_safe_lookback  // Extensions hidden if > 300 bars
```

Saturday 14:56 → Sunday 11:32 = ~300 bars on 4min → MBZ filtered out

**Fix Applied:**
Increased limit to 500 bars:
```pine
max_safe_lookback = 500  // Supports weekend MBZs (Sat→Sun = ~300-400 bars)
```

**Why Safe:**
- Code uses stored MBZ data (bar_index, prices from records)
- NO historical array access like `high[mbz_age]` or `time[mbz_age]`
- Just positioning boxes/labels at stored coordinates
- 500 << Pine's 5000 series limit

**Files Modified:** `mbz-prime.pine` (lines 3697-3701)

**Verified:** ✅ Limit increased, awaiting visual confirmation

---

## ⚠️ POTENTIAL ISSUES (Monitoring)

### Watch #1: 1-Hour Timeframe MBZ Detection
**Date:** 2025-10-05
**Severity:** MEDIUM
**Status:** ⚠️ Monitoring

**User Report:** "now on 1h i am NOT seeing MBZs!!!!!!!1"

**Investigation:**
- 1h = 60 minutes
- Intraday session limit: `MAX_TF_INTRADAY_LIQUIDITY = 60`
- Check: `current_tf_minutes <= 60` → `60 <= 60` = TRUE ✓
- Logic should work

**Possible Causes:**
1. 24/7 detection timing issue (needs 7 days = 168 bars on 1h)
2. MBZ lookback age limit (500 bars = 500 hours = 20 days on 1h)
3. User toggled off intraday sessions in settings
4. Chart not fully loaded yet

**Action Items:**
- [ ] Test ETH 1h with full 7+ days loaded
- [ ] Test NQ 1h after 7 days (168 bars)
- [ ] Verify intraday session toggles ON in settings
- [ ] Check if issue resolved after user's "wait" message

**Status:** User said "wait" then "i think it's resolved but im still being cautious"

---

### Watch #2: False 24/7 Detection on Traditional Assets
**Date:** 2025-10-05
**Severity:** LOW
**Status:** ⚠️ Monitoring

**Risk:**
With default `is_247_asset = true`, traditional assets (NQ, ES, CL) will temporarily show GREEN until 7 days of data loads.

**Expected Behavior:**
- First load: GREEN (default true)
- After 7 days data: Scan runs → finds NO weekends → ORANGE "Mon-Fri"
- Required bars:
  - 1min: 10,080 bars (7 days)
  - 5min: 2,016 bars (7 days)
  - 1h: 168 bars (7 days)

**If Issue Occurs:**
NQ shows GREEN even after 20+ days loaded → detection logic broken

**Action Items:**
- [ ] Test NQ 5min with 7+ days (2000+ bars)
- [ ] Test ES 5min with 7+ days
- [ ] Verify ORANGE "Mon-Fri" appears after scan
- [ ] Check `detection_completed` flag is set

---

## 🟢 RESOLVED (No Further Action)

### DTT Compilation Errors
**Date:** Prior session
**Status:** ✅ Resolved

**Issues:**
1. "Could not find function 'detect_liquidity_pool_patterns'"
2. "Cannot call with 'na' as value for non-typified argument"

**Fixes:**
1. Moved `process_dtt_sessions()` after `detect_liquidity_pool_patterns()` definition
2. Changed `na` to `float(na)` for typed parameters
3. Created `var LiquidityPoolCollection dtt_dummy_pool = na` for type safety

**Files Modified:** `mbz-prime.pine`

---

### DTT Performance Issues
**Date:** Prior session
**Status:** ✅ Resolved

**Fixes:**
- Limited to 15 sessions max (1 day cycle)
- Pattern detection only checks sessions ended in last 2 bars
- Active session updates only scan last 5 sessions
- Early exit after finding 2 active sessions

**Files Modified:** `mbz-prime.pine`

---

## 📋 TESTING CHECKLIST

### Critical Tests (Before Release)
- [ ] **ETH 4min replay from Monday**: Saturday NYAM (12:00) → Sunday MBZ at 12:20
- [ ] **ETH 4min replay from Monday**: Saturday Lunch (13:30) → Sunday MBZ at 13:32
- [ ] **BTC 1min**: Saturday pools → Sunday MBZs
- [ ] **NQ 5min (7+ days loaded)**: Shows ORANGE "Mon-Fri", loads in <5 seconds
- [ ] **ES 5min (7+ days loaded)**: Shows ORANGE "Mon-Fri"
- [ ] **ETH 1h**: Intraday sessions work (Asia, London, NYAM, Lunch)
- [ ] **NQ 1h**: Shows ORANGE after 168+ bars

### Performance Tests
- [ ] **NQ 5min (5000+ bars)**: No timeout, loads in <5 seconds
- [ ] **ETH 1min (10000+ bars)**: No timeout, loads in <10 seconds
- [ ] **BTC 3min (3000+ bars)**: No timeout

### Visual Tests
- [ ] **Saturday MBZ visibility**: Label + extension visible 500+ bars later
- [ ] **Weekend MBZ colors**: Proper green/red extension colors
- [ ] **Debug label**: Shows correct asset type (remove after testing)

---

## 🛠️ DEBUG TOOLS

### Temporary Debug Label
**Location:** `mbz-prime.pine` (lines 604-607)

```pine
if barstate.islast
    debug_text = is_247_asset ? "24/7 Asset: YES ✓" : "24/7 Asset: NO (Mon-Fri only)"
    debug_color = is_247_asset ? color.green : color.orange
    label.new(bar_index, high, debug_text, style=label.style_label_down,
              color=debug_color, textcolor=color.white, size=size.normal)
```

**Action:** DELETE lines 604-607 once verified working across all assets/timeframes

---

## 📁 FILES MODIFIED

### mbz-prime.pine
- **Lines 566-602**: 24/7 detection logic (Issues #1, #2, #3)
- **Lines 604-607**: Debug label (temporary - REMOVE after testing)
- **Lines 3697-3701**: MBZ display lookback limit (Issue #4)

### Supporting Documentation
- **24-7-detection-fixes.md**: Detailed 24/7 detection technical notes
- **ISSUES-LOG.md**: This file (general issues tracking)

---

## 🔄 ROLLBACK PLAN

If critical issues occur, rollback 24/7 detection:

```pine
// EMERGENCY ROLLBACK CODE:
var bool is_247_asset = false  // Start with false

if barstate.islastconfirmedhistory
    bars_in_7_days = math.ceil(10080 / current_tf_minutes)
    max_lookback = math.min(9999, bars_in_7_days)

    for lookback = 0 to max_lookback by 20
        check_day = dayofweek(time[lookback], NY_TIMEZONE)
        check_hour = hour(time[lookback], NY_TIMEZONE)

        is_saturday = check_day == dayofweek.saturday
        is_early_sunday = check_day == dayofweek.sunday and check_hour < SUNDAY_REOPEN_START_HOUR
        if is_saturday or is_early_sunday
            is_247_asset := true
            break
```

**Note:** Rollback will break Saturday pools in replay mode (original issue returns)

---

## 📞 ESCALATION

If issues persist:
1. Check Pine Script error console for new errors
2. Verify user settings (intraday toggles, extension mode, etc.)
3. Test on fresh chart (remove/re-add indicator)
4. Check TradingView platform updates (Pine v6 changes)

---

## 📝 NOTES

- All fixes maintain backwards compatibility
- No breaking changes to existing MBZ formation logic
- Only affects 24/7 asset detection timing and display limits
- Performance impact: Negligible (one-time scan per chart load)
- User feedback: "i think it's resolved but im still being cautious"

---

## ✅ SIGN-OFF REQUIRED

Before removing debug label and closing issues:
- [ ] User confirms Saturday→Sunday MBZs working on ETH
- [ ] User confirms NQ shows ORANGE "Mon-Fri"
- [ ] User confirms 1h timeframe working
- [ ] User confirms no performance issues
- [ ] 24-48 hours production monitoring complete
