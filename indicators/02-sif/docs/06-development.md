# Development Guide

## Overview

Comprehensive development guide for SIF Hunter° including coding standards, testing procedures, version control workflow, and debugging techniques.

## 🛠️ **Development Workflow**

### **Directory Structure**
```
/indicators/sif/
├── code/
│   ├── stable/          # Production-ready versions
│   │   └── sif-v[X.Y].pine
│   └── development/     # Development and testing versions
│       ├── sif-dev-*.pine
│       └── sif-test-*.pine
├── docs/               # Documentation system
│   ├── README.md
│   ├── 01-architecture.md
│   ├── 02-gap-detection.md
│   └── ... [other docs]
└── TODO-SIF-IMPROVEMENTS.md
```

### **Development Process**
```
1. Stable Baseline → 2. Development Branch → 3. Incremental Testing → 4. Production Release
      ↓                        ↓                       ↓                     ↓
   Known Working         Feature Development      Anchoring Validation   Stable Version
```

## 📝 **Coding Standards**

### **Function Documentation**
**Required Format**: All functions must use `@function` documentation
```pinescript
// @function function_name
// @description Clear description of purpose and algorithm
// @param param1 type Description of parameter
// @param param2 type Description of parameter  
// @returns type Description of return value
// @coordinate_warning Special warnings for coordinate assignment
function_name(param1, param2) =>
    // Implementation with inline comments for complex logic
```

### **Coordinate Assignment Standards**
**Critical Rule**: Always ensure `TOP > BOTTOM` in gap creation
```pinescript
// COORDINATE VALIDATION PATTERN (prevents MBZ v7.1-v7.4 bugs)
if is_bearish_fvg()
    // COORDINATE VALIDATION: Bearish FVG - ensure TOP > BOTTOM
    gap_top = low[2]     // 2-bars-ago low (HIGHER value)
    gap_bottom = high    // Current high (LOWER value)  
    // CRITICAL: gap_top > gap_bottom guaranteed by detection logic
    
    // Additional validation
    if gap_top <= gap_bottom
        // CRITICAL ERROR: Coordinate reversal detected - abort gap creation
```

### **Named Constants Requirements**
**Mandatory**: Replace all magic numbers with descriptive constants
```pinescript
// PERFORMANCE & THRESHOLD CONSTANTS
MAX_ACTIVE_GAPS = 100           // Active gap tracking limit (performance optimized)
MAX_SIF_RECORDS = 75            // SIF history limit (visual clarity + performance)
DEFAULT_DISPLACEMENT_MULTIPLIER = 1.5    // Displacement detection threshold
DEFAULT_TRANSPARENCY = 80       // Default visual transparency level

// NEVER use magic numbers directly
// BAD:  while array.size(active_gaps) > 100
// GOOD: while array.size(active_gaps) > MAX_ACTIVE_GAPS
```

### **Array Management Standards**
```pinescript
// Standard FIFO cleanup pattern
cleanup_array_with_visuals(arr, limit, cleanup_function) =>
    while array.size(arr) > limit
        old_element = array.shift(arr)
        if not na(cleanup_function)
            cleanup_function(old_element)  // Clean visuals first

// Usage example
cleanup_array_with_visuals(sif_records, MAX_SIF_RECORDS, cleanup_sif_visuals)
```

## 🧪 **Testing Standards**

### **Incremental Testing Protocol**
**Required**: Test changes in small batches to isolate anchoring issues

**Testing Workflow**:
```
1. Copy working baseline to development file
2. Make minimal targeted changes (single feature)
3. Test on FRESH CHART (avoid TradingView rendering conflicts)
4. Verify visual anchoring intact
5. Confirm functionality working
6. Only then proceed to next change
```

### **Visual Anchoring Validation**
**Critical Test**: Boxes and labels must remain attached to correct candles
```pinescript
// Testing checklist for each batch:
// ✅ Compile without errors  
// ✅ Visual elements anchor to correct bars
// ✅ Gap detection accuracy maintained
// ✅ No regression in existing functionality
// ✅ Performance acceptable (no lag)
```

### **Fresh Chart Testing**
**Important**: Always use fresh charts when testing new versions
- **Issue**: TradingView caches visual elements between indicator versions
- **Symptoms**: Boxes/labels appear detached from candles
- **Solution**: Remove indicator → Add to fresh chart OR switch assets

### **Regression Testing**
```pinescript
// Test against known baseline scenarios:
// 1. FVG detection accuracy (compare with MBZ reference)
// 2. Suppression hierarchy working (FVG > Implied > True > VI)
// 3. Coordinate assignment correct (no reversal bugs)
// 4. Visual elements rendering properly
// 5. Alerts triggering correctly
```

## 🐛 **Debugging Techniques**

### **Coordinate Debugging**
```pinescript
// Add temporary debug logging for coordinate issues
debug_coordinates(gap_type, top, bottom, is_bullish) =>
    if enable_debug_mode  // Add debug input setting
        log_message = gap_type + ": top=" + str.tostring(top) + 
                     " bottom=" + str.tostring(bottom) + 
                     " bullish=" + str.tostring(is_bullish) +
                     " valid=" + str.tostring(top > bottom)
        label.new(bar_index, high, log_message, style=label.style_label_down, size=size.tiny)
```

### **Suppression Analysis**
```pinescript
// Debug suppression decisions
debug_suppression(new_gap_type, suppressed, suppressor_type) =>
    if enable_debug_mode and suppressed
        debug_text = new_gap_type + " suppressed by " + suppressor_type
        label.new(bar_index, low, debug_text, color=color.red, size=size.tiny)
```

### **Performance Monitoring**
```pinescript
// Monitor array sizes for performance issues
debug_performance() =>
    if enable_debug_mode and bar_index % 100 == 0  // Every 100 bars
        info_text = "Gaps: " + str.tostring(array.size(active_gaps)) + 
                   " SIFs: " + str.tostring(array.size(sif_records))
        label.new(bar_index, close, info_text, color=color.blue, size=size.tiny)
```

## 📋 **Version Control Standards**

### **Version Naming Convention**
```
Format: v[MAJOR].[MINOR].[PATCH]-[DESCRIPTION]

Examples:
- v8.5-coordinate-fix     # Critical bug fix  
- v8.6-medium-docs       # Documentation improvements
- v8.7-performance       # Performance optimizations
- v9.0-major-release     # Major feature additions
```

### **Mandatory Version Updates**
**Required**: Update BOTH title and bottom comment with every change
```pinescript
// Title update
indicator('SIF Hunter° [Pro+] [v8.6-medium-docs]', overlay=true, ...)

// Bottom comment update (end of file)
// SIF Hunter° [Pro+] [v8.6-medium-docs] - DOCUMENTATION: Added comprehensive gap hierarchy and candle relationship documentation
```

### **Change Documentation**
**Required**: Every version must document what changed
```pinescript
// Version comment should specify:
// 1. What was changed (feature, fix, improvement)
// 2. Why it was changed (problem solved, requirement)
// 3. Impact level (critical, major, minor)

// Examples:
// v8.5-coordinate-fix - CRITICAL FIX: Fixed bearish FVG coordinate reversal bug
// v8.6-medium-docs - DOCUMENTATION: Added comprehensive gap hierarchy documentation
```

## 🔧 **Code Quality Standards**

### **Error Prevention Patterns**
```pinescript
// Always validate before operations
safe_gap_creation(top, bottom, gap_type, is_bullish) =>
    // Coordinate validation
    if top <= bottom
        false  // Invalid coordinates - prevent gap creation
    
    // Type validation  
    else if gap_type != GAP_TYPE_FVG and gap_type != GAP_TYPE_IMPLIED and 
            gap_type != GAP_TYPE_TRUE and gap_type != GAP_TYPE_VOLUME
        false  // Invalid type - prevent gap creation
        
    // Direction consistency
    else if is_bullish and top <= bottom
        false  // Direction mismatch - prevent gap creation
        
    else
        true   // All validations passed
```

### **Performance Optimization Patterns**
```pinescript
// Early exit for performance
process_gaps_efficiently() =>
    // Skip processing if no sources enabled
    if not (enable_fair_value_gaps or enable_implied or enable_volume_imbalance or enable_true_gaps)
        return
    
    // Pre-filter before expensive operations
    if not barstate.isconfirmed
        return
        
    // Cache array sizes to avoid repeated calls
    gaps_count = array.size(active_gaps)
    if gaps_count == 0
        // No existing gaps - skip suppression checks
```

### **Memory Safety Patterns**
```pinescript
// Always clean visuals before array removal
safe_array_cleanup(arr, limit, visual_cleanup_function) =>
    while array.size(arr) > limit
        old_element = array.shift(arr)
        
        // Clean associated visual elements
        if not na(visual_cleanup_function)
            visual_cleanup_function(old_element)
            
        // Element removed from array automatically by shift()
```

## 📊 **Development Tools**

### **Debug Mode Settings**
```pinescript
// Add to input section for development
enable_debug_mode = input.bool(false, 'Debug Mode', group='🔧 Development')
show_coordinate_info = input.bool(false, 'Show Coordinates', group='🔧 Development')  
show_suppression_info = input.bool(false, 'Show Suppression', group='🔧 Development')
show_performance_info = input.bool(false, 'Show Performance', group='🔧 Development')
```

### **Development Helpers**
```pinescript
// Coordinate validation helper
validate_and_warn(top, bottom, gap_type, bar_idx) =>
    if top <= bottom
        if show_coordinate_info
            label.new(bar_idx, high, "⚠️ COORDINATE ERROR: " + gap_type, 
                     color=color.red, size=size.small)
        false
    else
        true
```

## 🚀 **Deployment Guidelines**

### **Pre-Release Checklist**
- [ ] ✅ All functions documented with `@function` format
- [ ] ✅ Coordinate validation comments added to critical sections  
- [ ] ✅ Named constants used (no magic numbers)
- [ ] ✅ Version numbers updated (title + bottom comment)
- [ ] ✅ Fresh chart testing completed
- [ ] ✅ Visual anchoring verified
- [ ] ✅ Performance acceptable
- [ ] ✅ No compilation errors or warnings

### **Stable Release Process**
```
1. Final development testing complete
2. Copy development version to stable directory  
3. Update filename to version number
4. Update TODO file with completion status
5. Create release documentation
6. Archive old stable version (if keeping)
```

### **Backup Strategy**  
```
- Keep previous stable version for rollback
- Document all changes in TODO file
- Maintain development versions for reference
- Regular documentation updates
```

## ⚠️ **Common Development Issues**

### **TradingView Rendering Issues**
**Problem**: Indicators appear broken when replacing existing version
**Solution**: Always test on fresh charts or different assets

### **Coordinate Reversal Bugs**
**Problem**: Mixed up gap_top and gap_bottom assignments
**Prevention**: Comprehensive validation comments and mathematical checks

### **Performance Degradation**  
**Problem**: Unlimited array growth or inefficient loops
**Prevention**: Named constants for limits and early exit patterns

### **Visual Element Memory Leaks**
**Problem**: Visual elements not properly deleted
**Prevention**: Always delete visuals before array cleanup

## 📈 **Performance Guidelines**

### **Optimization Targets**
- **Array Sizes**: Stay within named constant limits
- **Loop Efficiency**: Use early exit patterns  
- **Visual Elements**: Regular cleanup and bounded creation
- **Memory Usage**: Monitor with debug tools

### **Scaling Considerations**
- **Multi-timeframe**: Test on various timeframes
- **High-frequency data**: Ensure smooth operation on 1m charts
- **Long histories**: Verify performance with extended backtesting

---

**Development Best Practices Summary**:
- 🔒 **Safety First**: Comprehensive validation prevents critical bugs
- 📚 **Document Everything**: Clear documentation for maintenance
- 🧪 **Test Incrementally**: Small changes reduce debugging complexity  
- ⚡ **Optimize Performance**: Bounded resources and efficient algorithms
- 📝 **Version Control**: Clear versioning and change documentation