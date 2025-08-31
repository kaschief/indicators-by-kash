# Gap Detection System

## Overview

The gap detection system is the foundation of MBZ formation, identifying four distinct types of price gaps with specific mathematical conditions and institutional priorities.

## Gap Types Detailed

## Visual Formation Summary

### Quick Reference - Candle Requirements

| **Gap Type** | **Candles** | **Key Condition** | **What Creates Gap** |
|--------------|-------------|-------------------|----------------------|
| **Fair Value Gap** | 3-candle | `C1_range ↔ C3_range` | Complete range separation (no overlap) |
| **Implied FVG** | 3-candle | `C1_body ↔ C3_body` + wick overlap | Body separation WITH wick testing |
| **True Gap** | 3-candle | `C1_range ↔ C3_range` + NOT FVG | Same as FVG but lower priority |
| **Volume Imbalance** | 2-candle | `C1_body ↔ C2_body` | Consecutive body separation |

### 1. Fair Value Gaps (FVGs) 🏦

**Definition**: 3-candle institutional gaps indicating smart money imbalance where middle candle creates complete range separation

**Candle Formation Requirements**:

#### **Bullish Fair Value Gap**:
```
C1 (2 bars ago): Any candle (establishes lower boundary)
C2 (1 bar ago):  Transition candle (creates the gap)
C3 (Current):    Any candle (establishes upper boundary)

Gap Condition: C1_high < C3_low
Visual: Complete gap between C1's highest point and C3's lowest point

Example:
C1: high[2] = 100  (highest point of C1)
C2: (transition candle - irrelevant for gap)  
C3: low = 102      (lowest point of C3)
Gap: 100 to 102 (unfilled institutional gap)
```

#### **Bearish Fair Value Gap**:
```
C1 (2 bars ago): Any candle (establishes upper boundary)  
C2 (1 bar ago):  Transition candle (creates the gap)
C3 (Current):    Any candle (establishes lower boundary)

Gap Condition: C1_low > C3_high  
Visual: Complete gap between C1's lowest point and C3's highest point

Example:
C1: low[2] = 100   (lowest point of C1)
C2: (transition candle - irrelevant for gap)
C3: high = 98      (highest point of C3)  
Gap: 98 to 100 (unfilled institutional gap)
```

**Detection Logic**:
```pinescript
// Bullish FVG: Gap between C1 high and C3 low  
is_bullish_fvg() => high[2] < low

// Bearish FVG: Gap between C1 low and C3 high
is_bearish_fvg() => high < low[2]
```

**Coordinate Assignment (CRITICAL)**:
```pinescript
// Bullish FVG
gap_data = GapData.new(bar_index - 2, low, high[2], true, ...)
//                                     ↑     ↑
//                                   top   bottom

// Bearish FVG  
gap_data = GapData.new(bar_index - 2, low[2], high, false, ...)
//                                     ↑      ↑
//                                   top    bottom
```

**⚠️ Critical Bug History**: v7.1-v7.04 had **reversed coordinates** causing missing MBZs. Fixed in v7.5-final.

### 2. Implied FVGs 🏦

**Definition**: 3-candle institutional gaps where bodies are separated BUT wicks overlap - indicating institutional positioning despite market noise

**Candle Formation Requirements**:

#### **Bullish Implied FVG**:
```
C1: Must have UPPER WICK (high[2] > body_top)
C2: Transition candle (any direction)  
C3: Must have LOWER WICK (low < body_bottom)

Critical Conditions:
1. C1_body_top < C3_body_bottom (body separation)
2. C1_upper_wick overlaps with C3_lower_wick (wick overlap)
3. Market tested the gap zone but bodies held separation
```

#### **Bearish Implied FVG**:  
```
C1: Must have LOWER WICK (low[2] < body_bottom)
C2: Transition candle (any direction)
C3: Must have UPPER WICK (high > body_top)

Critical Conditions:
1. C1_body_bottom > C3_body_top (body separation)  
2. C1_lower_wick overlaps with C3_upper_wick (wick overlap)
3. Market tested the gap zone but bodies held separation
```

**Body Definitions**:
```pinescript
// Body boundaries (excluding wicks)
bullish_body_top = close > open ? close : open
bullish_body_bottom = close > open ? open : close

bearish_body_top = close < open ? open : close  
bearish_body_bottom = close < open ? close : open
```

**Detection Function Details**:
```pinescript
detect_implied_fvg() => [bool, float, float, bool]
    // Step 1: Calculate body boundaries for C1 and C3
    c1_body_top = close[2] > open[2] ? close[2] : open[2]
    c1_body_bottom = close[2] > open[2] ? open[2] : close[2]
    
    c3_body_top = close > open ? close : open
    c3_body_bottom = close > open ? open : close
    
    // Step 2: Check for bullish body gap
    bullish_gap = c1_body_top < c3_body_bottom
    
    // Step 3: Check for bearish body gap  
    bearish_gap = c1_body_bottom > c3_body_top
    
    // Step 4: Additional validation conditions
    // (Market structure, volume, momentum confirmations)
    
    // Returns: [is_valid, gap_bottom, gap_top, is_bullish]
```

**Key Differences from Regular FVGs**:
- **Wick overlap required**: Must have overlapping wicks (Regular FVGs have no overlap)
- **Body separation**: Bodies don't touch despite wick overlap  
- **Market testing**: Wicks indicate market tested the gap but couldn't break institutional positioning
- **Institutional significance**: Shows smart money held body-level discipline despite market noise
- **Same priority**: Treated equally with regular FVGs in hierarchy

### 3. True Gaps 📈

**Definition**: Classic price gaps between complete candle ranges where no price overlap exists between non-consecutive candles

**Candle Formation Requirements**:

#### **Bullish True Gap**:
```
C1 (2 bars ago): Any candle (establishes lower boundary)
C2 (1 bar ago):  Transition candle (creates separation)  
C3 (Current):    Any candle (establishes upper boundary)

Gap Condition: C1_high < C3_low AND not an FVG
Visual: Complete price gap - no trading occurred between C1's high and C3's low

Example:
C1: OHLC = [95, 102, 94, 100]  → high[2] = 102
C2: (any candle - creates gap)
C3: OHLC = [105, 108, 104, 107] → low = 104  
Gap: 102 to 104 (classic price gap, 2 point unfilled area)
```

#### **Bearish True Gap**:
```
C1 (2 bars ago): Any candle (establishes upper boundary)
C2 (1 bar ago):  Transition candle (creates separation)
C3 (Current):    Any candle (establishes lower boundary) 

Gap Condition: C1_low > C3_high AND not an FVG
Visual: Complete price gap - no trading occurred between C1's low and C3's high

Example:  
C1: OHLC = [100, 102, 98, 99]   → low[2] = 98
C2: (any candle - creates gap)
C3: OHLC = [95, 96, 93, 94]     → high = 96
Gap: 96 to 98 (classic price gap, 2 point unfilled area)
```

**Detection Logic**:
```pinescript
// Bullish True Gap (same condition as bullish FVG but with exclusion)
is_bullish_true_gap() => 
    high[2] < low and not (is_bullish_fvg() or is_bearish_fvg())

// Bearish True Gap (same condition as bearish FVG but with exclusion) 
is_bearish_true_gap() =>
    low[2] > high and not (is_bullish_fvg() or is_bearish_fvg())
```

**Key Differences from FVGs**:
- **Same mathematical condition**: Uses identical gap detection formula
- **FVG Exclusion**: Won't detect if area already classified as FVG (priority system)
- **Classical interpretation**: Traditional gap analysis rather than institutional flow
- **Medium Priority**: Can be suppressed by institutional gaps (FVGs, Implied FVGs)

### 4. Volume Imbalances (VIs) 🛒

**Definition**: 2-candle retail body gaps indicating order flow imbalance between consecutive candle bodies

**Candle Formation Requirements**:

#### **Bullish Volume Imbalance**:
```
C1 (Previous): Bearish candle (close[1] < open[1])
C2 (Current):  Bullish candle (close > open)

Gap Condition: C1_body_low > C2_body_high
Visual: Current bullish body completely above previous bearish body

Example:
C1: open[1]=100, close[1]=95  → body range 95-100
C2: open=102, close=105       → body range 102-105  
Gap: 100 to 102 (2 point gap between bodies)
```

#### **Bearish Volume Imbalance**:
```
C1 (Previous): Bullish candle (close[1] > open[1])  
C2 (Current):  Bearish candle (close < open)

Gap Condition: C1_body_high < C2_body_low
Visual: Current bearish body completely below previous bullish body

Example:
C1: open[1]=95, close[1]=100  → body range 95-100
C2: open=93, close=90         → body range 90-93
Gap: 93 to 95 (2 point gap between bodies)
```

**Detection Logic**:
```pinescript  
// Bullish VI: Current bullish body above previous bearish body
is_bullish_vi() => 
    close > open and                              // Current candle bullish
    close[1] < open[1] and                        // Previous candle bearish  
    math.min(open, close) > math.max(open[1], close[1])  // Gap between bodies

// Bearish VI: Current bearish body below previous bullish body
is_bearish_vi() => 
    close < open and                              // Current candle bearish
    close[1] > open[1] and                        // Previous candle bullish
    math.max(open, close) < math.min(open[1], close[1])  // Gap between bodies
```

**Gap Coordinate Calculation**:
```pinescript
get_vi_coordinates(is_bullish) =>
    if is_bullish
        // Gap from top of previous bearish body to bottom of current bullish body
        [math.min(open, close), math.max(open[1], close[1])]  // [top, bottom]
    else  
        // Gap from bottom of previous bullish body to top of current bearish body
        [math.max(open[1], close[1]), math.min(open, close)]  // [top, bottom]
```

**Key Characteristics**:
- **2-candle pattern**: Uses only current and previous candle
- **Body-only gaps**: Ignores wicks completely  
- **Opposite directions**: Requires direction change between candles
- **Retail significance**: Indicates retail order flow imbalance, not institutional positioning

## Detection Flow & Timing

### Bar Confirmation Requirement
```pinescript
// All gap detection requires confirmed bars
if barstate.isconfirmed and [gap_condition]
```

### Detection Order (Important for Suppression)
1. **FVGs** detect first (no suppression)
2. **Implied FVGs** detect second (no suppression)  
3. **Volume Imbalances** detect third (with suppression check)
4. **True Gaps** detect fourth (with suppression check)

## Gap Data Structure

### GapData Type Definition
```pinescript
type GapData
    int anchor_bar       // Bar where gap anchors (C1 for 3-candle, C1 for 2-candle)
    float top           // Upper boundary of gap  
    float bottom        // Lower boundary of gap
    bool is_bullish     // Direction flag
    bool is_closed_through  // Whether gap has been filled
    int formation_bar   // Bar where gap was detected
    int gap_id         // Unique identifier
    string gap_type    // GAP_TYPE_FVG, GAP_TYPE_IMPLIED, etc.
```

### Critical Coordinate Rules

**For ALL gap types**:
- `top` must always be > `bottom`
- `is_bullish` must match coordinate relationship
- Anchor bar must be correct for gap type (C1 for most types)

## Suppression Integration

### Gap Detection + Suppression Flow
```
Gap Detected → Suppression Check → Add to active_gaps OR Suppress
```

### Suppression Bypass (No Check Required)
- **FVGs**: Always added to `active_gaps`
- **Implied FVGs**: Always added to `active_gaps`

### Suppression Required
- **Volume Imbalances**: Check `is_vi_suppressed_by_gaps()`
- **True Gaps**: Check `is_true_gap_suppressed_by_gaps()`

## Common Detection Issues & Fixes

### Issue 1: Missing FVG Detections
**Cause**: Reversed coordinates in gap creation
**Fix**: Ensure proper coordinate assignment (see FVG section above)

### Issue 2: False VI Suppressions  
**Cause**: VI suppression not checking correct gap types
**Fix**: Verify suppression includes all higher-priority types

### Issue 3: True Gap Over-Detection
**Cause**: Not excluding FVG areas from True Gap detection
**Fix**: Include FVG exclusion in True Gap conditions

## Mathematical Formulas

### Overlap Detection (Used in Suppression)
```pinescript
// Two gaps overlap if:
overlap_exists = (gap1_bottom < gap2_top) and (gap1_top > gap2_bottom)
```

### Gap Size Calculation
```pinescript
gap_size = gap_top - gap_bottom  // Always positive
```

### Percentage Overlap (Historical - removed in v7.5-final)
```pinescript
// This was used in problematic v7.1 logic
overlap_percentage = overlap_size / gap_size
```

## Testing & Validation

### Required Test Cases
1. **FVG Detection**: Verify 3-candle gap conditions
2. **Coordinate Accuracy**: Ensure top > bottom for all types  
3. **Direction Consistency**: Bullish flag matches coordinates
4. **Suppression Logic**: Higher priority gaps suppress lower priority
5. **Edge Cases**: Boundary conditions and exact overlaps

### Debug Output (Development)
```pinescript
// Temporary debug - remove for production
if gap_detected
    log.info("Gap: " + gap_type + " | Top: " + str.tostring(top) + " | Bottom: " + str.tostring(bottom))
```

---

**Critical Success Factors**:
- ✅ Correct coordinate assignment for each gap type  
- ✅ Proper suppression integration
- ✅ Accurate overlap detection
- ✅ Consistent direction flags