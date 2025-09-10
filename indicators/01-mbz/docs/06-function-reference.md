# Function Reference

## Complete API Documentation

This reference provides comprehensive documentation for all key functions in the MBZ Hunter° indicator system.

---

## Gap Detection Functions

### FVG Detection

#### `is_bullish_fvg() => bool`
**Purpose**: Detects 3-candle bullish Fair Value Gap formation  
**Logic**: `high[2] < low` (gap between C1 high and C3 low)  
**Returns**: `true` if bullish FVG detected, `false` otherwise

```pinescript
// Usage example
if enable_fair_value_gaps and barstate.isconfirmed and is_bullish_fvg()
    // Create bullish FVG gap data
```

#### `is_bearish_fvg() => bool`  
**Purpose**: Detects 3-candle bearish Fair Value Gap formation
**Logic**: `high < low[2]` (gap between C1 low and C3 high)
**Returns**: `true` if bearish FVG detected, `false` otherwise

### True Gap Detection

#### `is_bullish_true_gap() => bool`
**Purpose**: Detects bullish classic price gap between complete candle ranges
**Logic**: `high[2] < low and not (is_bullish_fvg() or is_bearish_fvg())`
**Returns**: `true` if bullish true gap detected (excluding FVG areas)

#### `is_bearish_true_gap() => bool`
**Purpose**: Detects bearish classic price gap between complete candle ranges  
**Logic**: `low[2] > high and not (is_bullish_fvg() or is_bearish_fvg())`
**Returns**: `true` if bearish true gap detected (excluding FVG areas)

#### `detect_true_gap() => [bool, float, float, bool]`
**Purpose**: Unified True Gap detection with coordinate calculation  
**Returns**: `[found, bottom, top, is_bullish]`
- `found`: Whether valid True Gap was detected
- `bottom`: Lower boundary of gap
- `top`: Upper boundary of gap  
- `is_bullish`: Direction of gap

### Volume Imbalance Detection

#### `is_bullish_vi() => bool`
**Purpose**: Detects bullish Volume Imbalance (2-candle body gap)  
**Logic**: Current bullish body above previous bearish body with gap
**Returns**: `true` if bullish VI detected

#### `is_bearish_vi() => bool`
**Purpose**: Detects bearish Volume Imbalance (2-candle body gap)
**Logic**: Current bearish body below previous bullish body with gap  
**Returns**: `true` if bearish VI detected

#### `get_vi_coordinates(is_bullish) => [float, float]`
**Purpose**: Calculate VI gap boundaries  
**Parameters**:
- `is_bullish`: Direction of VI
**Returns**: `[top, bottom]` coordinates for VI gap

```pinescript
// Usage example
if is_bullish_vi()
    [vi_top, vi_bottom] = get_vi_coordinates(true)
```

### Implied FVG Detection

#### `detect_implied_fvg() => [bool, float, float, bool]`
**Purpose**: Detects 3-candle institutional gaps based on body relationships (excludes wicks)

**Candle Requirements**:
- **C1**: Any candle (establishes body baseline)  
- **C2**: Transition candle (any direction)
- **C3**: Target candle where body doesn't overlap C1 body

**Detection Process**:
1. Calculate body boundaries for C1 and C3 (open/close, excluding wicks)
2. Check for body-level gap: `C1_body ↔ C3_body`  
3. Apply additional institutional validation conditions
4. Return gap coordinates if valid

**Returns**: `[is_valid, bottom, top, is_bullish]`  
- `is_valid`: Whether legitimate institutional body gap detected
- `bottom`/`top`: Gap boundaries based on body separation
- `is_bullish`: Direction of detected gap

**Key Difference**: Uses **body-only** separation, not complete candle ranges

---

## Suppression Functions

### Volume Imbalance Suppression

#### `is_vi_suppressed_by_gaps(vi_top, vi_bottom, is_vi_bullish) => bool`
**Purpose**: Check if VI should be suppressed by higher-priority gaps
**Parameters**:
- `vi_top`: Upper boundary of VI gap
- `vi_bottom`: Lower boundary of VI gap  
- `is_vi_bullish`: Direction of VI

**Suppression Conditions** (ALL must be true):
1. **Gap Type**: Must be FVG, Implied FVG, or True Gap
2. **Direction**: `gap.is_bullish == is_vi_bullish`
3. **Active**: `not gap.is_closed_through`  
4. **Overlap**: Spatial overlap in price space

**Returns**: `true` if VI should be suppressed, `false` if allowed

```pinescript
// Usage example
if not is_vi_suppressed_by_gaps(vi_top, vi_bottom, true)
    vi_data = GapData.new(...)  // Create VI gap
```

### True Gap Suppression

#### `is_true_gap_suppressed_by_gaps(tg_top, tg_bottom, is_tg_bullish) => bool`
**Purpose**: Check if True Gap should be suppressed by existing gaps
**Parameters**:
- `tg_top`: Upper boundary of True Gap
- `tg_bottom`: Lower boundary of True Gap
- `is_tg_bullish`: Direction of True Gap

**Suppression Conditions** (ALL must be true):
1. **Direction**: `gap.is_bullish == is_tg_bullish`  
2. **Active**: `not gap.is_closed_through`
3. **Overlap**: Spatial overlap in price space
4. **Any Type**: ANY existing gap type can suppress

**Returns**: `true` if True Gap should be suppressed, `false` if allowed

---

## MBZ Classification Functions

### MBZ Subtype Classification

#### `classify_mbz_subtype(gap_data, mbz_open, mbz_high, mbz_low, mbz_close) => [string, bool]`
**Purpose**: Determine MBZ subtype based on source gap and wick analysis
**Parameters**:
- `gap_data`: Source gap that formed the MBZ
- `mbz_open`, `mbz_high`, `mbz_low`, `mbz_close`: OHLC values of MBZ candle

**Returns**: `[subtype, has_classification]`
- `subtype`: MBZ classification (e.g., "standard", "inclusion", "volume_reflection")
- `has_classification`: Whether classification was successful

**Classification Process**:
1. **Base type** from gap type (standard, implied, volume, true)
2. **Wick analysis** for inclusion/reflection determination  
3. **Combined subtype** creation

### Wick Dominance Analysis

#### `classify_wick_dominance(body_size, upper_wick, lower_wick) => [string, bool]`
**Purpose**: Analyze wick dominance for MBZ classification
**Parameters**:
- `body_size`: Size of candle body
- `upper_wick`: Size of upper wick
- `lower_wick`: Size of lower wick

**Returns**: `[tier, has_dominant]`
- `tier`: Wick dominance tier ("standard", "relaxed", "risky", "none")
- `has_dominant`: Whether significant wick dominance exists

**Thresholds**:
- **Standard**: 80%+ wick-to-body ratio
- **Relaxed**: 60%+ wick-to-body ratio
- **Risky**: 40%+ wick-to-body ratio
- **None**: Below 40% ratio

---

## SUPER MBZ Detection Functions

### Nested MBZ Strength Detection

#### `detect_mbz_strength(new_mbz_record) => [string, int]`
**Purpose**: Detects if new MBZ overlaps with existing MBZs to determine SUPER MBZ status  
**Parameters**: 
- `new_mbz_record`: MBZ record to analyze for overlaps

**Returns**: `[strength_level, nested_count]`
- `strength_level`: "SUPER" if overlaps found, otherwise standard level
- `nested_count`: Number of overlapping same-direction MBZs

**Critical Fix (v8.1)**: Symmetric zone-to-zone overlap detection
```pinescript
// FIXED: Direct zone-to-zone comparison for all MBZ subtypes
[existing_zone_top, existing_zone_bottom] = get_mbz_subtype_zone(existing_mbz)
[new_zone_top, new_zone_bottom] = get_mbz_subtype_zone(new_mbz_record)
has_overlap = new_zone_bottom < existing_zone_top and new_zone_top > existing_zone_bottom
```

**Reflection MBZ Support**: 
- Properly detects reflection zones that extend beyond candle boundaries
- Uses zone calculations instead of candle ranges for accurate overlap detection
- Enables checkmarks (✔️) for reflection MBZs when zones overlap

### Zone Boundary Calculation

#### `get_mbz_subtype_zone(mbz_record) => [float, float]`  
**Purpose**: Calculate precise zone boundaries for any MBZ subtype
**Parameters**: 
- `mbz_record`: MBZ record with subtype classification

**Returns**: `[zone_top, zone_bottom]`
- Handles standard, inclusion, reflection, and volume MBZ subtypes
- Uses wick calculations for reflection zones extending beyond candle ranges
- Critical for accurate overlap detection in nested MBZ analysis

---

## Data Management Functions

### Gap Data Creation

#### `GapData.new(anchor, top, bottom, bullish, closed, formation, id, type) => GapData`
**Purpose**: Create new gap data structure  
**Parameters**:
- `anchor`: Bar index where gap anchors
- `top`: Upper boundary (MUST be > bottom)
- `bottom`: Lower boundary  
- `bullish`: Direction flag
- `closed`: Fill status
- `formation`: Detection bar index
- `id`: Unique identifier
- `type`: Gap type constant

**Critical Requirements**:
- `top` > `bottom` (coordinate validation)
- `bullish` matches coordinate relationship  
- `anchor` ≤ `formation` (timeline logic)

### Array Management

#### Array Size Management Pattern
```pinescript
// Standard cleanup pattern for all arrays
while array.size(target_array) > MAX_SIZE
    array.shift(target_array)  // Remove oldest entry
```

#### Visual Element Cleanup Pattern
```pinescript  
// Proper visual cleanup before array removal
while array.size(visual_array) > MAX_SIZE
    element = array.shift(visual_array)
    [element_type].delete(element)  // Delete visual first
```

---

## Utility Functions

### Overlap Detection

#### Internal Overlap Logic
```pinescript
// Mathematical overlap detection used in suppression
has_overlap = (gap1_bottom < gap2_top) and (gap1_top > gap2_bottom)
```

### Coordinate Validation

#### Gap Coordinate Validation Pattern  
```pinescript
// Validate gap coordinates after creation
validate_gap(gap_data) =>
    valid = gap_data.top > gap_data.bottom
    valid := valid and not na(gap_data.anchor_bar)  
    valid := valid and gap_data.gap_type != ""
    valid
```

## Configuration Functions

### Input Parameter Access

#### Gap Source Settings
```pinescript
enable_fair_value_gaps      // bool: Enable FVG detection
enable_implied             // bool: Enable Implied FVG detection
enable_volume_imbalance    // bool: Enable VI detection  
enable_true_gaps          // bool: Enable True Gap detection
```

#### Display Settings
```pinescript
display_mode              // string: Arrow/Text/Both display mode
max_mbz_labels           // int: Maximum number of labels to show
wick_detection_tier      // string: Wick dominance threshold
```

---

## Error Handling Patterns

### Safe Array Access
```pinescript
// Always check array size before access
if array.size(gaps_array) > 0
    for i = 0 to array.size(gaps_array) - 1
        gap = array.get(gaps_array, i)
        // Safe to process gap
```

### Coordinate Safety
```pinescript
// Validate coordinates before gap creation
if calculated_top > calculated_bottom
    gap_data = GapData.new(...)  // Safe to create
else
    // Log error or skip creation
```

### Type Safety  
```pinescript
// Verify gap type before type-specific operations
if gap.gap_type == GAP_TYPE_FVG
    // Safe to apply FVG-specific logic
```

---

## Performance Optimization Functions

### Early Exit Patterns
```pinescript
// Return immediately when conditions not met
check_condition() =>
    if not basic_requirement
        false  // Early exit
    else
        // Continue with expensive computation
```

### Loop Optimization
```pinescript
// Break loops as soon as condition found
find_overlap() =>
    for i = 0 to array.size(gaps) - 1
        if overlap_detected
            break  // Stop searching immediately
```

---

**Function Categories**:
- 🔍 **Detection**: Gap identification and validation
- 🎯 **Suppression**: Hierarchy and overlap management  
- 📝 **Classification**: MBZ subtype determination
- 🗃️ **Data Management**: Structure creation and array handling
- ⚡ **Performance**: Optimization and safety patterns

**Usage Notes**:
- All detection functions require `barstate.isconfirmed`
- Suppression functions assume non-empty `active_gaps` array
- Coordinate functions must maintain `top` > `bottom` invariant
- Visual functions must handle proper cleanup