# Data Structures

## Overview

SIF Hunter° uses carefully designed data structures to efficiently manage gap detection, institutional flow tracking, and visual rendering while maintaining optimal performance.

## 🏗️ **Core Type Definitions**

### **GapData Type**
**Purpose**: Represents a detected price gap with validation metadata
```pinescript
type GapData
    int anchor_bar          // Bar index where gap anchors  
    float top              // Upper price boundary (always > bottom)
    float bottom           // Lower price boundary (always < top)
    bool is_bullish        // Direction: true = bullish, false = bearish
    bool is_inverted       // Fill status: true = gap filled, false = still open
    int formation_bar      // Bar index where gap was first detected
    SIFCandidate candidate // Associated SIF formation data
    int gap_id            // Unique sequential identifier  
    string gap_type       // Gap classification (GAP_TYPE_* constants)
```

**Critical Validation Rules**:
- `top` must ALWAYS be > `bottom` (prevents coordinate reversal bugs)
- `is_bullish` must match coordinate relationship
- `anchor_bar` ≤ `formation_bar` (logical timeline)
- `gap_id` must be unique and sequential
- `gap_type` must use defined constants (GAP_TYPE_FVG, etc.)

### **SIFRecord Type**
**Purpose**: Represents a formed Smart Institutional Flow zone
```pinescript
type SIFRecord  
    int bar_index                    // Anchor bar for SIF zone
    float sif_open, sif_close       // Zone boundaries
    float sif_high, sif_low         // Extended zone limits
    bool is_bullish                 // SIF direction
    bool is_invalidated            // Zone breach status
    float max_fill_percentage      // Current fill level (0-100%)
    bool has_dominant_wick         // Wick dominance classification
    string sif_subtype            // Classification (SUBTYPE_* constants)
    string cached_label_text      // Pre-computed display text
    string cached_tooltip         // Pre-computed tooltip content
    // Visual elements
    label sif_label              // Zone identification label
    // Metadata
    int source_gap_id           // Originating gap reference
    bool is_super_sif          // Strength classification
    float overlap_percentage   // Overlap with other SIFs
    int overlapping_sif_bar_index  // Reference to overlapping SIF
```

## 📊 **Constants & Enumerations**

### **Gap Type Constants**
```pinescript  
GAP_TYPE_FVG = "fvg"           // Fair Value Gaps (institutional priority)
GAP_TYPE_IMPLIED = "implied"    // Implied FVGs (institutional priority)
GAP_TYPE_TRUE = "true"         // True Gaps (retail pattern)
GAP_TYPE_VOLUME = "volume"      // Volume Imbalances (retail pattern)
```
**Usage**: Stored in `GapData.gap_type` for classification and hierarchy enforcement

### **SIF Subtype Constants**
```pinescript
// Base classifications
SUBTYPE_STANDARD = "standard"       // Basic SIF formation
SUBTYPE_INCLUSION = "inclusion"     // Wick-dominant SIF  
SUBTYPE_REFLECTION = "reflection"   // Opposite-wick-dominant SIF

// Gap-specific variations
SUBTYPE_IMPLIED = "implied"         // From Implied FVG
SUBTYPE_VOLUME = "volume"          // From Volume Imbalance
SUBTYPE_TRUE = "true"              // From True Gap

// Combined classifications  
SUBTYPE_IMPLIED_INCLUSION = "implied_inclusion"
SUBTYPE_IMPLIED_REFLECTION = "implied_reflection"
SUBTYPE_VOLUME_INCLUSION = "volume_inclusion"
SUBTYPE_VOLUME_REFLECTION = "volume_reflection"
SUBTYPE_TRUE_INCLUSION = "true_inclusion"
SUBTYPE_TRUE_REFLECTION = "true_reflection"
```

### **Performance & Threshold Constants**
```pinescript
// PERFORMANCE & THRESHOLD CONSTANTS (Named constants replacing magic numbers)
MAX_ACTIVE_GAPS = 100           // Active gap tracking limit (performance optimized)
MAX_SIF_RECORDS = 75            // SIF history limit (visual clarity + performance)
DEFAULT_DISPLACEMENT_MULTIPLIER = 1.5    // Displacement detection threshold (testing optimized)
DEFAULT_TRANSPARENCY = 80       // Default visual transparency level
```

### **Display & Configuration Constants**
```pinescript
// Display modes
DISPLAY_ARROW_ONLY = "Arrow Only"
DISPLAY_TEXT_ONLY = "Text Only"  
DISPLAY_ARROW_TEXT = "Arrow + Text"

// Invalidation modes
INVALIDATION_STRICT = "Strict (55%)"     // 55% fill threshold
INVALIDATION_LENIENT = "Lenient (85%)"   // 85% fill threshold
INVALIDATION_CUSTOM = "Custom"           // User-defined threshold

// Wick tier classifications
WICK_TIER_STANDARD = "standard"   // 80%+ wick dominance
WICK_TIER_RELAXED = "relaxed"     // 60%+ wick dominance  
WICK_TIER_RISKY = "risky"         // 40%+ wick dominance
WICK_TIER_NONE = "none"           // No significant wick dominance
```

## 💾 **Global Arrays**

### **active_gaps**
**Type**: `array<GapData>`  
**Purpose**: Store all currently valid (unfilled) gaps
**Size Limit**: `MAX_ACTIVE_GAPS` (100 entries)
**Management**: FIFO cleanup via `array.shift()` when limit exceeded

```pinescript
// Access pattern
if array.size(active_gaps) > 0
    for i = 0 to array.size(active_gaps) - 1
        gap = array.get(active_gaps, i)
        // Process gap...
```

### **sif_records** 
**Type**: `array<SIFRecord>`
**Purpose**: Store all detected SIF formations  
**Size Limit**: `MAX_SIF_RECORDS` (75 entries)
**Management**: Visual elements deleted before array cleanup

```pinescript
// Proper cleanup pattern
while array.size(sif_records) > MAX_SIF_RECORDS
    oldest_record = array.shift(sif_records)
    // Delete visual elements before removal
    if not na(oldest_record.sif_label)
        label.delete(oldest_record.sif_label)
```

### **Visual Element Arrays**
```pinescript
array<box> sif_body_highlights      // SIF body zone boxes (limit: 100)
array<box> sif_extended_boxes       // SIF extension boxes (limit: 100) 
array<line> sif_projection_lines    // Projection lines (limit: 200)
array<label> sif_projection_labels  // Projection labels (limit: 200)
```

## 🔄 **Data Relationships**

### **Gap → SIF Flow**
```
GapData (detected) → SIF Classification → SIFRecord (created) → Visual Elements
    ↓                      ↓                    ↓                      ↓
gap_type              sif_subtype         Zone Calculation      Boxes/Labels
```

### **Suppression Relationships**
```
active_gaps Array → Hierarchy Check → New Gap Decision
      ↑                    ↓                    ↓
   Existing Gaps      Priority Analysis     Add or Suppress
```

### **Visual Element Lifecycle**
```
SIFRecord Creation → Visual Generation → Real-time Updates → Cleanup on Removal
```

## 🧮 **Memory Management**

### **Array Size Management**
```pinescript
// Standard FIFO cleanup pattern for all arrays
while array.size(active_gaps) > MAX_ACTIVE_GAPS
    array.shift(active_gaps)  // Remove oldest entry

// Performance monitoring
if array.size(active_gaps) > MAX_ACTIVE_GAPS * 0.9
    // Approaching limit - consider cleanup optimization
```

### **Visual Element Cleanup**
```pinescript
// CRITICAL: Always delete visuals before array removal
cleanup_sif_record(sif_record) =>
    // Delete all associated visual elements
    if not na(sif_record.sif_label)
        label.delete(sif_record.sif_label)
    // Then remove from array
```

### **Memory Efficiency Patterns**
- **Bounded Growth**: All arrays have strict size limits
- **FIFO Management**: Oldest entries removed automatically
- **Visual Cleanup**: Prevents memory leaks from abandoned elements
- **Lazy Computation**: Expensive calculations cached in records

## 🔍 **Data Validation**

### **GapData Validation**
```pinescript
validate_gap_data(gap) =>
    valid = true
    // Critical coordinate validation (prevents MBZ v7.1-v7.4 bugs)
    valid := valid and gap.top > gap.bottom              // TOP > BOTTOM requirement
    valid := valid and not na(gap.top) and not na(gap.bottom)  // No NaN values
    valid := valid and gap.formation_bar >= gap.anchor_bar      // Timeline logic
    valid := valid and gap.gap_type != ""               // Type assigned
    valid := valid and (gap.gap_type == GAP_TYPE_FVG or gap.gap_type == GAP_TYPE_IMPLIED or 
                       gap.gap_type == GAP_TYPE_TRUE or gap.gap_type == GAP_TYPE_VOLUME)  // Valid type
    valid
```

### **SIFRecord Validation**
```pinescript
validate_sif_record(sif_record) =>
    valid = true
    valid := valid and sif_record.sif_high >= sif_record.sif_low    // High >= Low
    valid := valid and sif_record.max_fill_percentage >= 0.0 and 
                      sif_record.max_fill_percentage <= 100.0       // Valid percentage
    valid := valid and not na(sif_record.bar_index)               // Valid bar reference
    valid
```

## ⚡ **Performance Considerations**

### **Array Access Optimization**
```pinescript
// Efficient array processing patterns
array_size = array.size(active_gaps)
if array_size > 0
    for i = 0 to array_size - 1  // Cache size to avoid repeated calls
        gap = array.get(active_gaps, i)
        // Early exit on conditions
        if gap.is_inverted
            continue  // Skip filled gaps
```

### **Memory Footprint**
- **GapData**: ~200 bytes per record (estimated)
- **SIFRecord**: ~400 bytes per record (estimated)
- **Total Memory**: ~95KB at maximum capacity (175 total records)
- **Visual Elements**: Additional ~50-100KB depending on active zones

### **Computational Complexity**
- **Gap Detection**: O(1) per bar for each gap type
- **Suppression Check**: O(n) where n = active gaps (max 100)
- **Visual Updates**: O(m) where m = active SIFs (max 75)
- **Overall**: Linear complexity with bounded limits

## 🛡️ **Data Integrity**

### **Type Safety Guidelines**
```pinescript
// Always validate types before operations
if gap.gap_type == GAP_TYPE_FVG
    // FVG-specific processing
else if gap.gap_type == GAP_TYPE_IMPLIED  
    // Implied FVG-specific processing
// Handle all cases explicitly
```

### **Coordinate Safety**
```pinescript
// COORDINATE VALIDATION: Critical for preventing reversal bugs
// Always verify TOP > BOTTOM before gap creation
if gap_top <= gap_bottom
    // CRITICAL ERROR: Coordinate reversal detected
    // This prevented MBZ v7.1-v7.4 style bugs in SIF
```

### **Array Safety**
```pinescript
// Always check array bounds before access
if array.size(active_gaps) > index and index >= 0
    gap = array.get(active_gaps, index)
    // Safe to process gap
```

## 📊 **Data Structure Benefits**

### **Reliability**
- ✅ **Type Safety**: Strongly typed structures prevent errors
- ✅ **Validation**: Multi-layer validation prevents corrupt data
- ✅ **Bounds Checking**: Array access safety enforced

### **Performance**  
- ✅ **Memory Bounded**: Strict limits prevent unlimited growth
- ✅ **Efficient Access**: Optimized array patterns
- ✅ **Lazy Computation**: Cached calculations where beneficial

### **Maintainability**
- ✅ **Clear Structure**: Well-defined types and relationships
- ✅ **Named Constants**: No magic numbers in data definitions
- ✅ **Comprehensive Documentation**: Every field and relationship explained

---

**Data Structure Design Principles**:
- 🔒 **Safety First**: Coordinate validation prevents critical bugs
- ⚡ **Performance Focused**: Bounded arrays with efficient cleanup
- 📚 **Self-Documenting**: Clear naming and comprehensive validation
- 🔄 **Lifecycle Managed**: Proper creation, update, and cleanup patterns