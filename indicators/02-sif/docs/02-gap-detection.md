# Gap Detection System

## Overview

SIF Hunter° implements a comprehensive gap detection system that identifies four distinct types of market inefficiencies, each representing different institutional and retail trading patterns.

## 🎯 **Gap Type Hierarchy**

### **Priority Levels** (Higher priority gaps suppress lower priority)
1. **Fair Value Gaps (FVG)** - Institutional Priority ⭐⭐⭐⭐
2. **Implied Fair Value Gaps** - Institutional Priority ⭐⭐⭐⭐  
3. **True Gaps** - Retail Priority ⭐⭐⭐
4. **Volume Imbalances** - Retail Priority ⭐⭐

## 📊 **Gap Detection Algorithms**

### **1. Fair Value Gaps (FVG)**

**Pattern**: 3-candle institutional imbalance
```pinescript
// @function is_bullish_fvg
// @description Detects bullish FVG: C0.low > C2.high (upward gap)
// COORDINATE WARNING: gap_top=C0.low, gap_bottom=C2.high (ensure TOP > BOTTOM)
is_bullish_fvg() => low > high[2]

// @function is_bearish_fvg  
// @description Detects bearish FVG: C0.high < C2.low (downward gap)
// COORDINATE WARNING: gap_top=C2.low, gap_bottom=C0.high (ensure TOP > BOTTOM)
is_bearish_fvg() => high < low[2]
```

**Candle Relationships**:
- **C2 (bars ago [2])**: Gap origin candle - provides one boundary
- **C1 (bars ago [1])**: Middle candle - gap remains unfilled if C1 doesn't overlap
- **C0 (current)**: Gap completion candle - provides opposite boundary

**Formation Logic**:
- **Bullish**: Current low above 2-bars-ago high creates upward price gap
- **Bearish**: Current high below 2-bars-ago low creates downward price gap
- **Institutional Significance**: Large price jumps indicating smart money activity

### **2. Implied Fair Value Gaps**

**Pattern**: Displacement-validated 3-candle gaps with wick overlap
```pinescript
detect_implied_fvg() =>
    // Enhanced displacement validation with institutional criteria
    displacement_valid = is_displacement_valid(displacement_multiplier)
    
    // Body separation with wick overlap detection
    if displacement_valid
        // Complex algorithm checking:
        // 1. Body separation between C2 and C0
        // 2. Wick overlap validation  
        // 3. Displacement candle strength verification
```

**Enhanced Features**:
- **Displacement Validation**: C2 body size vs 10-candle average (outlier-filtered)
- **Wick Overlap Required**: Bodies separated but wicks must connect
- **Institutional Filter**: Only displacement candles qualify (smart money moves)

### **3. True Gaps**

**Pattern**: Classic 2-candle price gaps
```pinescript
// @function is_bullish_true_gap
// @description Classic upward gap: C1.high < C0.low
// COORDINATE WARNING: gap_top=C0.low, gap_bottom=C1.high (ensure TOP > BOTTOM)
is_bullish_true_gap() => high[1] < low

// @function is_bearish_true_gap  
// @description Classic downward gap: C1.low > C0.high
// COORDINATE WARNING: gap_top=C1.low, gap_bottom=C0.high (ensure TOP > BOTTOM)
is_bearish_true_gap() => low[1] > high
```

**Formation Logic**:
- **Bullish**: Previous high below current low (gap up)
- **Bearish**: Previous low above current high (gap down)  
- **Retail Significance**: Traditional gap analysis patterns

### **4. Volume Imbalances**

**Pattern**: 2-candle body gaps with wick connection
```pinescript
is_bullish_vi() =>
    bodies_separated = math.min(open, close) > math.max(open[1], close[1])
    wicks_still_connect = low <= high[1]  // Current low reaches previous high
    bodies_separated and wicks_still_connect

is_bearish_vi() =>
    bodies_separated = math.max(open, close) < math.min(open[1], close[1])
    wicks_still_connect = high >= low[1]  // Current high reaches previous low
    bodies_separated and wicks_still_connect
```

**Formation Logic**:
- **Body Separation**: Gap between candle bodies
- **Wick Connection**: Wicks still overlap (partial fill)
- **Retail Pattern**: Smaller imbalances with immediate partial correction

## 🔍 **Detection Validation**

### **Critical Coordinate Validation**
```pinescript
// COORDINATE VALIDATION: Applied at gap creation
// Prevents MBZ v7.1-v7.4 style coordinate reversal bugs

// Bullish FVG Example:
if is_bullish_fvg()
    fvg_top = low        // C0.low (higher value)
    fvg_bottom = high[2] // C2.high (lower value)  
    // CRITICAL: fvg_top > fvg_bottom verified by detection logic

// Bearish FVG Example (FIXED in v8.5):
if is_bearish_fvg()  
    fvg_top = low[2]     // C2.low (higher value) - CORRECTED
    fvg_bottom = high    // C0.high (lower value) - CORRECTED
    // CRITICAL FIX: Prevents coordinate reversal bug
```

### **Enhanced Validation Patterns**
```pinescript
// Multi-layer validation for each gap type
coordinates_valid = gap_top > gap_bottom and not na(gap_top) and not na(gap_bottom)
direction_consistent = (is_bullish and gap_top > gap_bottom) or (not is_bullish and gap_top > gap_bottom)
```

## ⚙️ **Detection Configuration**

### **Gap Source Controls**
```pinescript
enable_fair_value_gaps = input.bool(true, 'Fair Value Gaps')
enable_implied = input.bool(true, 'Implied FVGs') 
enable_true_gaps = input.bool(false, 'True Gaps')
enable_volume_imbalance = input.bool(false, 'Volume Imbalances')
```

### **Threshold Settings**  
```pinescript
displacement_multiplier = input.float(1.5, "Implied: Displacement", minval=1.0, maxval=5.0)
// Controls sensitivity of implied FVG displacement validation
```

## 📈 **Detection Performance**

### **Optimization Strategies**
```pinescript
// Early exit patterns for performance
if not (enable_fair_value_gaps or enable_implied or enable_volume_imbalance or enable_true_gaps)
    // Skip all detection if no sources enabled

// Pre-filtering before expensive operations  
if enable_fair_value_gaps and barstate.isconfirmed and is_bullish_fvg()
    // Only process coordinates if detection succeeds
```

### **Memory Efficiency**
```pinescript
MAX_ACTIVE_GAPS = 100  // Performance-optimized limit
// FIFO cleanup when limit exceeded
while array.size(active_gaps) > MAX_ACTIVE_GAPS
    array.shift(active_gaps)
```

## 🚨 **Common Detection Issues**

### **Coordinate Reversal Prevention**
**Problem**: Mixing up gap_top and gap_bottom assignments
**Solution**: Comprehensive validation comments at each assignment point

### **Middle Candle Validation**
**Pattern**: C1 (middle candle) overlap affects gap validity
**Documentation**: Clear explanation of C1 role in gap formation

### **Direction Consistency**
**Validation**: Bullish/bearish flag must match coordinate relationships
**Enforcement**: Mathematical validation in gap creation

## 🔧 **Advanced Detection Features**

### **Displacement Validation Enhancement**
```pinescript
// Improved displacement calculation (10-candle sample vs 5-candle)
// Outlier filtering (remove top 20% to avoid skew)
// Minimum size validation (must be 50%+ of average)
```

### **Gap Formation Documentation**
```pinescript
// C1, C2, C3 CANDLE RELATIONSHIP DOCUMENTATION:
// C2: Gap origin - institutional movement initiation
// C1: Middle candle - gap persistence verification  
// C0: Gap completion - institutional movement confirmation
```

## 📊 **Detection Statistics**

### **Gap Type Frequency** (Typical Markets)
- **FVGs**: 15-25% of all gaps (highest priority)
- **Implied FVGs**: 10-20% (displacement-filtered)
- **True Gaps**: 20-30% (classic patterns)
- **Volume Imbalances**: 35-45% (most common, lowest priority)

### **Institutional vs Retail**
- **Institutional** (FVG + Implied): ~25-45% of gaps
- **Retail** (True + VI): ~55-75% of gaps  
- **Priority System**: Ensures institutional gaps always detected

---

**Detection System Benefits**:
- ✅ **Comprehensive**: Covers all major gap types and market inefficiencies
- ✅ **Hierarchical**: Institutional priority ensures smart money detection
- ✅ **Validated**: Coordinate and direction consistency enforcement  
- ✅ **Performant**: Optimized algorithms with early exit patterns
- ✅ **Documented**: Clear mathematical relationships and formation logic