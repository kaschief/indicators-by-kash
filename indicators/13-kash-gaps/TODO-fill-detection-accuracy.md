# TODO: Fix Gap Fill Detection Accuracy on Higher Timeframes

## Problem Description

Gap fill penetration tracking is **inaccurate on higher timeframes** (1H, 4H, etc.) compared to lower timeframes (1m, 5m, etc.).

### Observed Behavior
- **Chart**: 1H timeframe
- **Gap Type**: NDOG (created from 1-minute data at 18:00 session open)
- **Visual Issue**: By bar 2, indicator shows gap ~50% filled
- **Actual Reality**: On 1m timeframe, gap is ~75% filled by same timestamp

## Root Cause

The fill detection logic (lines 498-560 in kash-gaps.pine) tracks penetration using the **current chart timeframe's** bar highs/lows:

```pine
if high >= gap.bottom and high <= gap.top
    gap.penetrationLevel := na(gap.penetrationLevel) ? high : math.max(gap.penetrationLevel, high)
```

But NDOG/NWOG gaps are created from **1-minute data** using `request.security_lower_tf()`.

### The Mismatch:
1. **Gap Creation**: Uses 1-minute bars → accurate gap boundaries
2. **Fill Tracking**: Uses chart timeframe bars (e.g., 1H) → inaccurate penetration levels
3. **Result**: Visual fill representation lags behind actual 1m reality

### Example Timeline:
- **18:00**: NDOG gap created from 1m data (top: 100, bottom: 90)
- **18:00-19:00 (1H bar 1)**: 1H bar high = 92 → indicator records 20% penetration
- **19:00-20:00 (1H bar 2)**: 1H bar high = 95 → indicator records 50% penetration
- **Reality on 1m**: By 20:00, actual 1m bars showed high = 97.5 → should be 75% penetration

## Potential Solutions

### Solution 1: Lower Timeframe Penetration Tracking (Recommended)
Use `request.security_lower_tf()` to track penetration with 1-minute precision.

**Implementation:**
1. Add new section after gap creation (around line 700)
2. For each NDOG/NWOG gap, scan 1m bars since `gap.creationTime`
3. Track actual 1m highs/lows to update `gap.penetrationLevel` accurately

**Pros:**
- Accurate across all chart timeframes
- Consistent with gap creation methodology
- True representation of fill progression

**Cons:**
- Additional `request.security_lower_tf()` calls (performance impact)
- Increased code complexity

### Solution 2: Timeframe-Aware Warning
Add tooltip/warning when viewing NDOG/NWOG on timeframes > 15m.

**Implementation:**
1. Check current timeframe
2. Display warning label: "For accurate fill visualization, use 15m or lower"

**Pros:**
- Simple implementation
- No performance impact
- Educates users

**Cons:**
- Doesn't fix the underlying issue
- Users on 1H+ still see inaccurate data

### Solution 3: Hybrid Approach
- Use LTF tracking only when chart timeframe > 15m
- Use current method for lower timeframes (already accurate)

**Pros:**
- Performance optimized (only LTF when needed)
- Accurate everywhere
- Best of both worlds

**Cons:**
- Most complex implementation
- Two different code paths to maintain

## Files Affected

- `/indicators/13-kash-gaps/code/development/kash-gaps.pine`
  - Lines 498-560: Fill detection logic
  - Lines 867-906: NDOG creation (uses LTF correctly)
  - Lines 709-745: NWOG creation (uses LTF correctly)

## Priority

Medium - Visual accuracy issue, but doesn't affect functionality on intended timeframes (1m-15m for most users).

## Related Issues

- RTH gaps use current timeframe for creation AND tracking (lines 440-453), so they're consistent (though less precise)
- BPR gaps also use current timeframe consistently
- Only NDOG/NWOG have the LTF creation + HTF tracking mismatch
