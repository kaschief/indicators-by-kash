# Suppression Mechanisms

## Overview

The suppression system implements **institutional market structure hierarchy**, ensuring higher-priority gaps take precedence over lower-priority patterns while preventing signal redundancy.

## Gap Priority Hierarchy

```
🏦 INSTITUTIONAL (Never Suppressed)
├── Priority #1: FVGs (Fair Value Gaps)
└── Priority #2: Implied FVGs

📈 MEDIUM PRIORITY (Targeted Suppression)  
└── Priority #3: True Gaps

🛒 RETAIL (Suppressed by All Higher)
└── Priority #4: Volume Imbalances
```

## Suppression Rules Matrix

| Gap Type | Suppressed By | Suppresses | Suppression Logic |
|----------|---------------|------------|-------------------|
| **FVGs** | ❌ Nothing | ✅ VIs | No suppression check |
| **Implied FVGs** | ❌ Nothing | ✅ VIs | No suppression check |  
| **True Gaps** | ✅ Any existing same-direction gap | ✅ VIs | `is_true_gap_suppressed_by_gaps()` |
| **Volume Imbalances** | ✅ FVGs, Implied FVGs, True Gaps | ❌ Nothing | `is_vi_suppressed_by_gaps()` |

## Volume Imbalance Suppression

### Function: `is_vi_suppressed_by_gaps()`

**Purpose**: Prevent VI detection when higher-priority gaps exist in same area

```pinescript
is_vi_suppressed_by_gaps(vi_top, vi_bottom, is_vi_bullish) =>
    if array.size(active_gaps) == 0
        false  // No existing gaps = no suppression
    else
        has_overlap = false
        for i = 0 to array.size(active_gaps) - 1
            gap = array.get(active_gaps, i)
            
            // Check for FVGs, Implied FVGs, AND True Gaps (all higher priority)
            if (gap.gap_type == GAP_TYPE_FVG or 
                gap.gap_type == GAP_TYPE_IMPLIED or 
                gap.gap_type == GAP_TYPE_TRUE) and 
                gap.is_bullish == is_vi_bullish and 
                not gap.is_closed_through
                
                // Spatial overlap check with edge case handling
                if vi_bottom < gap.top and vi_top >= gap.bottom
                    has_overlap := true
                    break  // Early exit - suppression confirmed
        has_overlap
```

### Suppression Conditions (ALL must be true)

1. **Higher Priority Gap Type**: Must be FVG, Implied FVG, OR True Gap
2. **Same Direction**: `gap.is_bullish == is_vi_bullish`  
3. **Gap Still Active**: `not gap.is_closed_through`
4. **Spatial Overlap**: Mathematical overlap in price space

### Spatial Overlap Logic

```pinescript
// Overlap exists when:
vi_bottom < gap.top AND vi_top >= gap.bottom

// Visual representation:
Gap:     |████████████|  (gap.bottom to gap.top)
VI:           |████████████|  (vi_bottom to vi_top)
         ↑
    Overlap detected → VI suppressed
```

### Edge Case Handling

```pinescript
// CRITICAL: Use >= for boundary cases
if vi_top >= gap.bottom  // Inclusive boundary
```

**Why >=?** Handles cases where VI exactly touches gap boundary - institutional gaps should still win.

## True Gap Suppression

### Function: `is_true_gap_suppressed_by_gaps()`

**Purpose**: Prevent True Gap detection when ANY existing same-direction gap exists in same area

```pinescript
is_true_gap_suppressed_by_gaps(tg_top, tg_bottom, is_tg_bullish) =>
    if array.size(active_gaps) == 0
        false  // No existing gaps = no suppression
    else
        has_overlap = false
        for i = 0 to array.size(active_gaps) - 1
            gap = array.get(active_gaps, i)
            
            // Check overlap with ANY existing gap type of same direction
            if gap.is_bullish == is_tg_bullish and not gap.is_closed_through
                if tg_bottom < gap.top and tg_top > gap.bottom
                    has_overlap := true
                    break  // Early exit - suppression confirmed
        has_overlap
```

### Key Differences from VI Suppression

| Aspect | VI Suppression | True Gap Suppression |
|--------|----------------|---------------------|
| **Gap Type Filter** | Only higher-priority types | ANY gap type |
| **Boundary Logic** | `>= gap.bottom` (inclusive) | `> gap.bottom` (exclusive) |
| **Purpose** | Institutional hierarchy | Prevent duplicates |

## Suppression Scenarios

### Scenario 1: FVG Suppresses VI ✅
```
Timeline:
1. FVG detected → Added to active_gaps  
2. VI attempts formation in overlapping area
3. is_vi_suppressed_by_gaps() returns true
4. VI suppressed → Only FVG MBZ shows

Result: Clean institutional signal
```

### Scenario 2: True Gap Suppresses VI ✅  
```
Timeline:
1. True Gap detected → Added to active_gaps
2. VI attempts formation in overlapping area  
3. is_vi_suppressed_by_gaps() includes True Gaps in check
4. VI suppressed → Only True Gap MBZ shows

Result: Medium priority beats retail priority
```

### Scenario 3: FVG Suppresses True Gap ✅
```
Timeline:  
1. FVG detected → Added to active_gaps
2. True Gap attempts formation in overlapping area
3. is_true_gap_suppressed_by_gaps() detects existing FVG
4. True Gap suppressed → Only FVG MBZ shows

Result: Institutional priority maintained
```

### Scenario 4: No Suppression - Different Directions ✅
```
Timeline:
1. Bullish FVG detected → Added to active_gaps
2. Bearish VI attempts formation in same price area
3. Direction check fails: bullish != bearish  
4. No suppression → Both MBZs show

Result: Cross-direction signals coexist
```

## Historical Issues & Fixes

### v7.1 Problem: Over-Aggressive General Suppression
**Issue**: 80% overlap threshold blocked legitimate gaps
```pinescript
// PROBLEMATIC v7.1 logic (REMOVED)
if overlap_percentage >= 0.8
    suppress_gap = true  // Too broad!
```

**Fix**: Replaced with targeted, type-specific suppression

### v7.2-v7.4 Problem: Missing True Gap Suppression in VI Logic
**Issue**: VIs not suppressed by True Gaps
```pinescript
// INCOMPLETE logic (FIXED in v7.5-final)  
if (gap.gap_type == GAP_TYPE_FVG or gap.gap_type == GAP_TYPE_IMPLIED)
//  Missing: or gap.gap_type == GAP_TYPE_TRUE
```

**Fix**: Added True Gap to VI suppression logic

## Debugging Suppression Issues

### Common Problems

1. **Missing Suppressions**
   - Check gap type filters in suppression functions
   - Verify overlap calculation logic
   - Confirm direction matching

2. **Over-Suppressions**  
   - Verify suppression only applies to lower-priority types
   - Check for incorrect boundary conditions
   - Ensure closed gaps don't suppress

3. **Direction Issues**
   - Confirm bullish/bearish flags are consistent
   - Verify same-direction requirement

### Debug Techniques

```pinescript
// Temporary debug logging (REMOVE in production)
if suppression_detected
    log.info("Suppressed: " + gap_type + " by " + existing_gap.gap_type + 
             " | Directions: " + str.tostring(is_bullish) + "," + str.tostring(existing_gap.is_bullish))
```

## Performance Considerations

### Optimization Strategies
- **Early Exit**: Return false immediately if no active gaps
- **Loop Breaking**: Break as soon as suppression condition found  
- **Direction Pre-Check**: Skip gaps with different directions
- **Closed Gap Skip**: Skip gaps that are already filled

### Critical Path Analysis
- **VI Suppression**: Runs for every VI candidate (frequent)
- **True Gap Suppression**: Runs for every True Gap candidate (less frequent)
- **No Suppression**: FVGs and Implied FVGs bypass all checks (fastest)

---

**Key Success Factors**:
- ✅ Correct priority hierarchy implementation
- ✅ Accurate spatial overlap detection  
- ✅ Proper direction filtering
- ✅ Edge case boundary handling
- ✅ Performance optimization with early exits