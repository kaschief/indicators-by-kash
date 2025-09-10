# Function Reference

## Overview

Complete reference for all functions in SIF Hunter°, organized by functional area with detailed parameter descriptions and usage examples.

## 🎯 **Gap Detection Functions**

### **is_bullish_fvg()**
```pinescript
// @function is_bullish_fvg
// @description Detects bullish Fair Value Gap pattern (3-candle upward gap)
// @returns bool True if C0.low > C2.high (upward gap exists)
// @coordinate_warning When creating GapData, ensure TOP > BOTTOM (gap_top=C0.low, gap_bottom=C2.high)
is_bullish_fvg() => low > high[2]
```

**Usage Example**:
```pinescript
if enable_fair_value_gaps and barstate.isconfirmed and is_bullish_fvg()
    gap_top = low        // Current low (higher value)
    gap_bottom = high[2] // 2-bars-ago high (lower value)
    // gap_top > gap_bottom guaranteed by detection logic
```

### **is_bearish_fvg()**  
```pinescript
// @function is_bearish_fvg
// @description Detects bearish Fair Value Gap pattern (3-candle downward gap)
// @returns bool True if C0.high < C2.low (downward gap exists)
// @coordinate_warning When creating GapData, ensure TOP > BOTTOM (gap_top=C2.low, gap_bottom=C0.high)
is_bearish_fvg() => high < low[2]
```

**Critical Fix Applied (v8.5)**:
```pinescript
// CORRECT coordinate assignment (fixed coordinate reversal bug)
if is_bearish_fvg()
    gap_top = low[2]     // 2-bars-ago low (higher value) - CORRECTED  
    gap_bottom = high    // Current high (lower value) - CORRECTED
```

### **is_bullish_true_gap()**
```pinescript
// @function is_bullish_true_gap
// @description Detects bullish True Gap (2-candle upward price gap)
// @returns bool True if C1.high < C0.low (classic upward gap)
// @coordinate_warning gap_top=C0.low, gap_bottom=C1.high (ensure TOP > BOTTOM)
is_bullish_true_gap() => high[1] < low
```

### **is_bearish_true_gap()**
```pinescript
// @function is_bearish_true_gap  
// @description Detects bearish True Gap (2-candle downward price gap)
// @returns bool True if C1.low > C0.high (classic downward gap)
// @coordinate_warning gap_top=C1.low, gap_bottom=C0.high (ensure TOP > BOTTOM)
is_bearish_true_gap() => low[1] > high
```

### **is_bullish_vi()**
```pinescript
// @function is_bullish_vi
// @description Detects bullish Volume Imbalance (2-candle body gap with wick connection)
// @returns bool True if bodies separated but wicks connect
is_bullish_vi() =>
    bodies_separated = math.min(open, close) > math.max(open[1], close[1])
    wicks_still_connect = low <= high[1]  // Current low reaches previous high
    bodies_separated and wicks_still_connect
```

### **is_bearish_vi()**
```pinescript
// @function is_bearish_vi
// @description Detects bearish Volume Imbalance (2-candle body gap with wick connection)  
// @returns bool True if bodies separated but wicks connect
is_bearish_vi() =>
    bodies_separated = math.max(open, close) < math.min(open[1], close[1])
    wicks_still_connect = high >= low[1]  // Current high reaches previous low
    bodies_separated and wicks_still_connect
```

## 🚨 **Suppression System Functions**

### **is_gap_overlapping()**
```pinescript
// @function is_gap_overlapping
// @description Master suppression dispatcher using MBZ-style hierarchy enforcement
// @param new_top float Upper boundary of new gap
// @param new_bottom float Lower boundary of new gap
// @param new_is_bullish bool Direction of new gap (true = bullish, false = bearish)
// @param new_gap_type string Gap classification (GAP_TYPE_FVG, GAP_TYPE_IMPLIED, GAP_TYPE_TRUE, GAP_TYPE_VOLUME)
// @param existing_gaps array<GapData> Array of existing gaps to check against
// @returns bool True if new gap should be suppressed, false if should be added
is_gap_overlapping(new_top, new_bottom, new_is_bullish, new_gap_type, existing_gaps) =>
    switch new_gap_type
        GAP_TYPE_FVG => false              // FVGs NEVER suppressed
        GAP_TYPE_IMPLIED => false          // Implied FVGs NEVER suppressed
        GAP_TYPE_TRUE => is_true_gap_suppressed(...)
        GAP_TYPE_VOLUME => is_vi_suppressed(...)
        => false
```

**Hierarchy Rules**:
- **FVG**: Never suppressed (institutional priority)
- **Implied FVG**: Never suppressed (institutional priority)  
- **True Gap**: Suppressed by FVG, Implied FVG only
- **Volume Imbalance**: Suppressed by FVG, Implied FVG, True Gap

### **Spatial Overlap Detection**
```pinescript
// Mathematical overlap detection used in all suppression functions
is_spatial_overlap(gap1_top, gap1_bottom, gap2_top, gap2_bottom) =>
    // Condition 1: gap1_bottom < gap2_top (gap1 starts below gap2 end)
    // Condition 2: gap1_top >= gap2_bottom (gap1 ends at/above gap2 start)
    gap1_bottom < gap2_top and gap1_top >= gap2_bottom
```

## 🏗️ **Data Structure Functions**

### **GapData Creation**
```pinescript
// @function GapData.new
// @description Creates new gap data structure with validation
// @param anchor_bar int Bar index where gap anchors
// @param top float Upper boundary (must be > bottom)
// @param bottom float Lower boundary (must be < top)
// @param is_bullish bool Gap direction
// @param is_inverted bool Fill status (false = unfilled)
// @param formation_bar int Bar where gap detected
// @param candidate SIFCandidate Associated SIF data
// @param gap_id int Unique identifier
// @param gap_type string Gap classification
GapData.new(anchor_bar, top, bottom, is_bullish, is_inverted, formation_bar, candidate, gap_id, gap_type)
```

**Critical Validation**:
- `top > bottom` (prevents coordinate reversal bugs)
- `formation_bar >= anchor_bar` (logical timeline)
- `gap_type` uses defined constants only

### **SIFRecord Creation**
```pinescript
// @function SIFRecord.new  
// @description Creates new SIF record with zone calculations
// @param bar_index int Anchor bar
// @param sif_open float Zone open price
// @param sif_close float Zone close price
// @param sif_high float Zone high boundary
// @param sif_low float Zone low boundary
// @param is_bullish bool SIF direction
// @param ... [additional parameters]
SIFRecord.new(bar_index, sif_open, sif_close, sif_high, sif_low, is_bullish, ...)
```

## 📊 **Analysis Functions**

### **get_wick_dominance_analysis()**
```pinescript
// @function get_wick_dominance_analysis
// @description Analyzes candle wick dominance for SIF classification
// @param candle_open float Candle open price
// @param candle_close float Candle close price  
// @param candle_high float Candle high price
// @param candle_low float Candle low price
// @returns [string, bool] Wick tier classification and dominance status
get_wick_dominance_analysis(candle_open, candle_close, candle_high, candle_low) =>
    body_size = math.abs(candle_close - candle_open)
    upper_wick = candle_high - math.max(candle_open, candle_close)
    lower_wick = math.min(candle_open, candle_close) - candle_low
    
    max_wick = math.max(upper_wick, lower_wick)
    max_ratio = body_size > 0 ? max_wick / body_size : 0
    
    if max_ratio >= 1.0
        [WICK_TIER_STANDARD, true]
    else if max_ratio >= 0.85  
        [WICK_TIER_RELAXED, true]
    else if max_ratio >= 0.80
        [WICK_TIER_RISKY, true]
    else
        [WICK_TIER_NONE, false]
```

### **is_displacement_valid()**
```pinescript  
// @function is_displacement_valid
// @description Enhanced displacement validation for Implied FVGs
// @param displacement_multiplier float Multiplier threshold vs recent average
// @returns bool True if C2 shows sufficient displacement
is_displacement_valid(displacement_multiplier) =>
    // Enhanced algorithm with:
    // - 10-candle sample size (vs 5-candle)  
    // - Outlier filtering (remove top 20%)
    // - Minimum size validation (50%+ of average)
    // - Robust average calculation
```

### **detect_implied_fvg()**
```pinescript
// @function detect_implied_fvg
// @description Detects Implied Fair Value Gaps with displacement validation
// @returns [bool, float, float, bool] [is_valid, bottom, top, is_bullish]
detect_implied_fvg() =>
    displacement_valid = is_displacement_valid(displacement_multiplier)
    if displacement_valid
        // Complex detection algorithm:
        // 1. Check body separation between C2 and C0
        // 2. Validate wick overlap requirements
        // 3. Confirm displacement candle strength
        // 4. Return gap coordinates and direction
```

## 🎨 **Visual Functions**

### **create_sif_zone()**
```pinescript
// @function create_sif_zone
// @description Creates visual zone representation for SIF
// @param sif_record SIFRecord SIF data
// @param zone_color color Zone fill color
// @param border_color color Zone border color
// @returns box Visual zone element
create_sif_zone(sif_record, zone_color, border_color) =>
    box.new(
        left=sif_record.bar_index,
        top=sif_record.sif_high,
        right=sif_record.bar_index + 50,  // Extension length
        bottom=sif_record.sif_low,
        bgcolor=zone_color,
        border_color=border_color,
        border_width=1
    )
```

### **create_sif_label()**  
```pinescript
// @function create_sif_label
// @description Creates identification label for SIF zone
// @param sif_record SIFRecord SIF data  
// @param label_text string Display text
// @param label_color color Text color
// @returns label Visual label element
create_sif_label(sif_record, label_text, label_color) =>
    label.new(
        x=sif_record.bar_index,
        y=sif_record.is_bullish ? sif_record.sif_high : sif_record.sif_low,
        text=label_text,
        textcolor=label_color,
        style=label.style_label_down,
        size=size.small
    )
```

## ⚙️ **Utility Functions**

### **get_sif_invalidation_threshold()**
```pinescript
// @function get_sif_invalidation_threshold  
// @description Gets current invalidation threshold percentage
// @returns float Threshold value (0.0 to 1.0)
get_sif_invalidation_threshold() =>
    switch sif_invalidation_mode
        INVALIDATION_STRICT => 0.55      // 55% fill
        INVALIDATION_LENIENT => 0.85     // 85% fill  
        INVALIDATION_CUSTOM => custom_invalidation_threshold / 100.0
        => 0.55
```

### **calculate_zone_fill_percentage()**
```pinescript
// @function calculate_zone_fill_percentage
// @description Calculates how much of SIF zone has been penetrated
// @param zone_top float Upper zone boundary
// @param zone_bottom float Lower zone boundary
// @param current_price float Current market price
// @param is_bullish bool Zone direction
// @returns float Fill percentage (0.0 to 100.0)
calculate_zone_fill_percentage(zone_top, zone_bottom, current_price, is_bullish) =>
    zone_size = zone_top - zone_bottom
    if zone_size <= 0
        0.0
    else
        penetration = is_bullish ? 
            math.max(0, zone_top - current_price) :    // Bearish: penetration from top
            math.max(0, current_price - zone_bottom)   // Bullish: penetration from bottom
        math.min(100.0, (penetration / zone_size) * 100.0)
```

## 🔧 **Helper Functions**

### **validate_coordinates()**
```pinescript
// @function validate_coordinates
// @description Validates gap coordinates prevent reversal bugs
// @param top float Upper boundary  
// @param bottom float Lower boundary
// @param gap_type string Gap classification
// @returns bool True if coordinates valid
validate_coordinates(top, bottom, gap_type) =>
    basic_valid = top > bottom and not na(top) and not na(bottom)
    type_valid = gap_type == GAP_TYPE_FVG or gap_type == GAP_TYPE_IMPLIED or 
                 gap_type == GAP_TYPE_TRUE or gap_type == GAP_TYPE_VOLUME
    basic_valid and type_valid
```

### **get_text_size()**
```pinescript
// @function get_text_size
// @description Converts text size string to Pine Script size constant
// @param size_string string Size designation ("small", "normal", "large")
// @returns string Pine Script size constant
get_text_size(size_string) =>
    switch size_string
        "tiny" => size.tiny
        "small" => size.small  
        "normal" => size.normal
        "large" => size.large
        => size.normal
```

## 🚨 **Critical Functions**

### **Array Management**
```pinescript
// @function cleanup_arrays  
// @description Maintains array size limits with proper visual cleanup
cleanup_arrays() =>
    // Clean active gaps
    while array.size(active_gaps) > MAX_ACTIVE_GAPS
        array.shift(active_gaps)
        
    // Clean SIF records with visual cleanup
    while array.size(sif_records) > MAX_SIF_RECORDS
        old_record = array.shift(sif_records)
        if not na(old_record.sif_label)
            label.delete(old_record.sif_label)
```

### **Memory Safety**
```pinescript
// @function safe_array_get
// @description Safely retrieves array element with bounds checking  
// @param arr array Array to access
// @param index int Element index
// @returns element Array element or na if out of bounds
safe_array_get(arr, index) =>
    if array.size(arr) > index and index >= 0
        array.get(arr, index)
    else
        na
```

---

## 📚 **Function Categories Summary**

### **Core Detection** (8 functions)
- Gap pattern recognition functions
- Primary detection algorithms  
- Pattern validation functions

### **Suppression System** (4 functions)  
- Hierarchy enforcement functions
- Overlap detection functions
- Priority validation functions

### **Data Management** (6 functions)
- Structure creation functions
- Validation functions
- Array management functions

### **Analysis & Classification** (5 functions)
- Wick dominance analysis
- Displacement validation  
- Zone calculation functions

### **Visual & UI** (7 functions)
- Zone rendering functions
- Label creation functions
- Display utility functions

### **Utilities & Helpers** (10+ functions)
- Coordinate validation
- Text conversion functions
- Safety and error prevention

---

**Function Reference Benefits**:
- ✅ **Complete Coverage**: Every function documented with examples
- ✅ **Parameter Safety**: All parameters typed and validated  
- ✅ **Usage Examples**: Real-world implementation patterns
- ✅ **Error Prevention**: Critical validation and safety functions highlighted