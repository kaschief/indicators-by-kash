# Data Structures

## Core Type Definitions

### GapData Type
**Purpose**: Represents a detected price gap with all necessary metadata

```pinescript
type GapData
    int anchor_bar          // Bar index where gap anchors (C1 for 3-candle patterns)
    float top              // Upper price boundary of gap
    float bottom           // Lower price boundary of gap  
    bool is_bullish        // Direction: true = bullish, false = bearish
    bool is_closed_through // Fill status: true = gap filled, false = still open
    int formation_bar      // Bar index where gap was first detected
    int gap_id            // Unique sequential identifier
    string gap_type       // Gap classification (GAP_TYPE_* constants)
```

**Validation Rules**:
- `top` must always be > `bottom`
- `is_bullish` must match coordinate relationship (bullish = upward gap)
- `anchor_bar` ≤ `formation_bar` (gap anchors at or before detection)
- `gap_id` must be unique and sequential

### MBZRecord Type  
**Purpose**: Represents a formed MBZ with trading and visual information

```pinescript
type MBZRecord
    int anchor_bar         // Bar where MBZ anchors
    float mbz_top         // Upper boundary of MBZ zone
    float mbz_bottom      // Lower boundary of MBZ zone  
    bool is_bullish       // MBZ direction
    string mbz_subtype    // Classification (SUBTYPE_* constants)
    bool is_breached      // Whether MBZ has been violated
    bool is_invalidated   // Whether MBZ is no longer valid
    int formation_bar     // Bar where MBZ was created
    // Visual elements (boxes, labels, etc.)
    box body_box
    box wick_box  
    label mbz_label
    // Additional metadata...
```

## Constants & Enums

### Gap Type Constants
```pinescript
GAP_TYPE_FVG = "fvg"           // Fair Value Gaps (institutional)
GAP_TYPE_IMPLIED = "implied"    // Implied FVGs (institutional)  
GAP_TYPE_VOLUME = "volume"      // Volume Imbalances (retail)
GAP_TYPE_TRUE = "true"         // True Gaps (classic price gaps)
```

**Usage**: Stored in `GapData.gap_type` for classification and suppression logic

### MBZ Subtype Constants
```pinescript
// Base types
SUBTYPE_STANDARD = "standard"       // Basic MBZ formation
SUBTYPE_INCLUSION = "inclusion"     // Wick-dominant MBZ
SUBTYPE_REFLECTION = "reflection"   // Opposite-wick-dominant MBZ

// Gap-specific variations  
SUBTYPE_IMPLIED = "implied"
SUBTYPE_VOLUME = "volume" 
SUBTYPE_TRUE = "true"

// Combined classifications
SUBTYPE_IMPLIED_INCLUSION = "implied_inclusion"
SUBTYPE_IMPLIED_REFLECTION = "implied_reflection"
SUBTYPE_VOLUME_INCLUSION = "volume_inclusion"
SUBTYPE_VOLUME_REFLECTION = "volume_reflection"  
SUBTYPE_TRUE_INCLUSION = "true_inclusion"
SUBTYPE_TRUE_REFLECTION = "true_reflection"
```

**Classification Logic**:
1. **Base type** determined by source gap type
2. **Wick dominance** adds INCLUSION/REFLECTION suffix
3. **Final subtype** combines both elements

### Display Mode Constants
```pinescript
DISPLAY_ARROW_ONLY = "Arrow Only"     // Show only directional arrows
DISPLAY_TEXT_ONLY = "Text Only"       // Show only text labels
DISPLAY_ARROW_TEXT = "Arrow + Text"   // Show both arrows and text
```

### Wick Tier Constants
```pinescript
WICK_TIER_STANDARD = "standard"   // 80%+ wick dominance  
WICK_TIER_RELAXED = "relaxed"     // 60%+ wick dominance
WICK_TIER_RISKY = "risky"         // 40%+ wick dominance
WICK_TIER_NONE = "none"           // No significant wick dominance
```

### Confirmation Mode Constants
```pinescript
CONFIRMATION_DISTANCE_ONLY = "Distance Only"               // Price-based confirmation
CONFIRMATION_TIME_ONLY = "Time Only"                       // Time-based confirmation  
CONFIRMATION_HYBRID_OR = "Hybrid (Distance OR Time)"       // Either condition
CONFIRMATION_HYBRID_AND = "Hybrid (Distance AND Time)"     // Both conditions required
```

### Invalidation Mode Constants
```pinescript
INVALIDATION_STANDARD = "Standard (100%)"  // Full breach invalidates
INVALIDATION_STRICT = "Strict (85%)"       // 85% breach invalidates
INVALIDATION_CUSTOM = "Custom"             // User-defined threshold
```

### Display Constants for Invalidated MBZs
```pinescript
INVALIDATED_DISPLAY_OFF = "Off"                    // Don't show invalidated
INVALIDATED_DISPLAY_LABELS = "Labels Only"         // Show labels only  
INVALIDATED_DISPLAY_LABELS_ZONES = "Labels + Zones" // Show labels and zones
```

## Global Arrays

### active_gaps
**Type**: `array<GapData>`  
**Purpose**: Store all currently valid (unfilled) gaps  
**Size Limit**: 100 entries (FIFO cleanup)  
**Management**: Oldest gaps removed via `array.shift()`

```pinescript
// Access pattern
for i = 0 to array.size(active_gaps) - 1
    gap = array.get(active_gaps, i)
    // Process gap...
```

### all_mbz_records  
**Type**: `array<MBZRecord>`
**Purpose**: Store all detected MBZ formations
**Size Limit**: 75 entries (FIFO cleanup)
**Management**: Visual elements deleted before array cleanup

### Visual Element Arrays
```pinescript
array<box> mbz_body_highlights      // MBZ body zone boxes (limit: 100)
array<box> mbz_wick_highlights      // MBZ wick zone boxes (limit: 100)  
array<box> mbz_extended_boxes       // MBZ extension boxes (limit: 100)
array<line> mbz_projection_lines    // Projection lines (limit: 200)
array<label> mbz_projection_labels  // Projection labels (limit: 200)
```

## Data Relationships

### Gap → MBZ Flow
```
GapData (detected) → MBZ Classification → MBZRecord (created)
    ↓                      ↓                    ↓
gap_type              mbz_subtype         Visual Elements
```

### Suppression Relationships
```
active_gaps Array → Suppression Check → New Gap Decision
      ↑                    ↓                    ↓
   Existing Gaps      Overlap Analysis     Add or Reject
```

## Memory Management Patterns

### Array Size Management
```pinescript
// Standard pattern for all arrays
while array.size(active_gaps) > MAX_SIZE
    array.shift(active_gaps)  // Remove oldest
```

### Visual Element Cleanup
```pinescript
// Proper cleanup before array removal
while array.size(mbz_body_highlights) > 100
    box.delete(array.shift(mbz_body_highlights))  // Delete visual + remove from array
```

## Data Validation

### GapData Validation
```pinescript
validate_gap_data(gap) =>
    valid = true
    valid := valid and gap.top > gap.bottom              // Coordinate order
    valid := valid and not na(gap.anchor_bar)           // Valid bar index
    valid := valid and gap.formation_bar >= gap.anchor_bar // Timeline logic
    valid := valid and gap.gap_type != ""               // Type assigned
    valid
```

### Common Validation Errors
1. **Coordinate Reversal**: `top` < `bottom` (critical bug source)
2. **Missing Type**: `gap_type` not assigned  
3. **Invalid Timeline**: `formation_bar` < `anchor_bar`
4. **Direction Mismatch**: `is_bullish` doesn't match coordinates

## Performance Considerations

### Array Access Patterns
- **Sequential Access**: Use `for` loops for full array processing
- **Early Exit**: Break loops when condition found
- **Size Checks**: Always verify `array.size() > 0` before access

### Memory Efficiency
- **Regular Cleanup**: Prevent unlimited array growth
- **Visual Deletion**: Always delete visual elements before array removal
- **Size Limits**: Enforce strict limits on all arrays

## Type Safety Guidelines

### Best Practices
1. **Always validate** gap coordinates after creation
2. **Check array bounds** before accessing elements  
3. **Verify type consistency** in gap_type and mbz_subtype
4. **Ensure proper cleanup** of visual elements

### Common Pitfalls
- **Mixing gap types** in suppression logic
- **Forgetting to delete visuals** before array cleanup  
- **Coordinate assignment errors** in gap creation
- **Array access without size checks**

---

**Critical Success Factors**:
- ✅ Proper coordinate validation (top > bottom)
- ✅ Consistent type usage across functions
- ✅ Regular array cleanup with size limits  
- ✅ Visual element proper deletion
- ✅ Data relationship integrity