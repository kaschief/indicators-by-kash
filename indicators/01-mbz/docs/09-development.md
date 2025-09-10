# Development Guide

## Development Standards & Best Practices

This guide establishes coding standards, debugging practices, and change management procedures for the MBZ Hunter° indicator.

## Version Management

### Version Numbering Scheme
```
v[Major].[Minor]-[suffix]

Examples:
v7.5-final          (Stable release)
v7.6-gap-fixes      (Development branch)  
v8.0-major-refactor  (Major version bump)
```

### Mandatory Version Updates
**CRITICAL**: Every change must update BOTH locations:

```pinescript
// 1. Indicator title
indicator('MBZ Hunter° [Pro+] [v7.5-final]', ...)

// 2. Bottom comment  
// MBZ Hunter° [Pro+] [v7.5-final] - Description of changes
```

**Consequences of Missing Version Updates**:
- 🚫 Version confusion in production
- 🚫 Unable to track which fixes are deployed
- 🚫 Difficult to reproduce bugs
- 🚫 Support issues become impossible to resolve

## Coding Standards

### Gap Coordinate Assignment (CRITICAL)

```pinescript
// ✅ CORRECT FVG Coordinates
// Bullish FVG
GapData.new(anchor, low, high[2], true, ...)
//                  ↑     ↑  
//                top  bottom

// Bearish FVG  
GapData.new(anchor, low[2], high, false, ...)
//                   ↑      ↑
//                 top    bottom

// ❌ WRONG - This caused v7.1-v7.4 bugs
GapData.new(anchor, high, low[2], true, ...)  // Reversed!
```

**Memory Aid**: 
- **Bullish**: Gap goes UP, so current `low` becomes new `top`
- **Bearish**: Gap goes DOWN, so current `high` becomes new `bottom`

### Suppression Function Standards

```pinescript
// ✅ Standard suppression function template
is_[type]_suppressed_by_gaps(gap_top, gap_bottom, is_gap_bullish) =>
    if array.size(active_gaps) == 0
        false  // No gaps = no suppression
    else
        has_overlap = false
        for i = 0 to array.size(active_gaps) - 1
            gap = array.get(active_gaps, i)
            
            // 1. Type filter (specify which gaps can suppress)
            if (gap.gap_type == GAP_TYPE_[HIGHER_PRIORITY]) and
            // 2. Direction filter (same direction only)  
               gap.is_bullish == is_gap_bullish and
            // 3. Active filter (unfilled gaps only)
               not gap.is_closed_through
               
                // 4. Spatial overlap check
                if gap_bottom < gap.top and gap_top > gap.bottom
                    has_overlap := true
                    break  // Early exit for performance
        has_overlap
```

### Array Management Standards

```pinescript
// ✅ Safe array access pattern
if array.size(gaps_array) > 0
    for i = 0 to array.size(gaps_array) - 1
        element = array.get(gaps_array, i)
        // Process element...

// ✅ Proper cleanup with size limits  
while array.size(visual_array) > MAX_SIZE
    visual_element = array.shift(visual_array)
    [type].delete(visual_element)  // Delete visual first
```

### Debugging Standards

```pinescript
// ✅ Conditional debug logging (REMOVE in production)
DEBUG_MODE = false  // Set to true only during development

if DEBUG_MODE and gap_detected
    log.info("Gap detected: " + gap_type + 
             " | Top: " + str.tostring(top) + 
             " | Bottom: " + str.tostring(bottom) +
             " | Direction: " + (is_bullish ? "Bullish" : "Bearish"))
```

## Change Management Process

### Before Making Changes

1. **Read Documentation**: Review relevant docs (this file, architecture, etc.)
2. **Understand Current Behavior**: Test current version thoroughly  
3. **Identify Root Cause**: Don't patch symptoms, fix actual problems
4. **Plan the Fix**: Document what needs to change and why

### Making Changes

1. **Update Version Number**: FIRST, before any code changes
2. **Implement Fix**: Follow coding standards above
3. **Test Thoroughly**: Verify fix works and doesn't break anything
4. **Update Documentation**: Modify relevant docs if behavior changes

### Testing Requirements

#### Unit Testing Checklist
- [ ] **Gap Detection**: Each gap type detects correctly
- [ ] **Coordinates**: All gaps have `top` > `bottom`  
- [ ] **Directions**: `is_bullish` matches coordinate relationship
- [ ] **Suppression**: Higher priority gaps suppress lower priority
- [ ] **Edge Cases**: Boundary conditions work correctly

#### Integration Testing Checklist  
- [ ] **Complete Flow**: Gaps → Suppression → MBZ Formation → Display
- [ ] **Memory Management**: No array size explosions
- [ ] **Visual Cleanup**: No orphaned chart elements
- [ ] **Performance**: No significant slowdown

#### Regression Testing
- [ ] **Compare with v7.0-gaps**: Ensure same MBZ detection behavior
- [ ] **Historical Data**: Test on known problematic datasets
- [ ] **Edge Scenarios**: Test boundary conditions and overlaps

## Common Bug Patterns & Prevention

### 1. Coordinate Reversal Bugs
**Symptom**: Gaps not detecting or detecting incorrectly  
**Prevention**: Always double-check coordinate assignment  
**Detection**: Add validation `assert top > bottom`

### 2. Suppression Logic Errors
**Symptom**: Wrong gaps being suppressed or not suppressed
**Prevention**: Follow suppression function template exactly
**Detection**: Add debug logging to suppression decisions

### 3. Array Bounds Errors  
**Symptom**: Runtime errors or unexpected behavior
**Prevention**: Always check array size before access
**Detection**: Add bounds checking assertions

### 4. Memory Leaks
**Symptom**: Gradual performance degradation
**Prevention**: Proper visual element deletion before array cleanup
**Detection**: Monitor array sizes during testing

### 5. Version Confusion
**Symptom**: Can't reproduce reported bugs
**Prevention**: ALWAYS update version numbers
**Detection**: Check version matches in both title and comment

## Debugging Techniques

### Issue Investigation Process

1. **Reproduce the Problem**
   ```pinescript
   // Add specific debug for the issue
   if bar_index == [PROBLEMATIC_BAR]
       log.info("Debug at bar: " + str.tostring(bar_index))
   ```

2. **Check Data Flow**  
   ```pinescript
   // Trace data through the system
   log.info("Gap detected: " + gap_type)
   log.info("Suppression check: " + str.tostring(is_suppressed))  
   log.info("MBZ created: " + str.tostring(mbz_formed))
   ```

3. **Verify Assumptions**
   ```pinescript
   // Check critical assumptions
   assert gap.top > gap.bottom, "Gap coordinates invalid"
   assert array.size(active_gaps) <= 100, "Gap array too large"
   ```

### Common Debug Scenarios

#### Missing MBZ Signals
1. Check if gap is detected: Add logging in gap detection
2. Check if gap is suppressed: Add logging in suppression functions  
3. Check if MBZ formation fails: Add logging in MBZ creation
4. Check coordinates: Verify `top` > `bottom`

#### False MBZ Signals  
1. Check gap detection conditions: Are they too loose?
2. Check suppression logic: Should this gap be suppressed?
3. Check overlap calculation: Is spatial logic correct?

#### Performance Issues
1. Check array sizes: Are cleanup limits being enforced?
2. Check loop efficiency: Any unnecessary iterations?
3. Check visual cleanup: Are elements being deleted properly?

## Code Review Checklist

### Before Submitting Changes
- [ ] Version number updated in both locations
- [ ] Code follows standards documented here
- [ ] All debug logging removed or conditionally compiled  
- [ ] Tests pass (manual testing at minimum)
- [ ] Documentation updated if behavior changed
- [ ] Change description added to bottom comment

### Code Review Focus Areas
- [ ] **Correctness**: Does the fix actually solve the problem?
- [ ] **Completeness**: Are all related areas updated?  
- [ ] **Safety**: Could this break existing functionality?
- [ ] **Performance**: Does this impact execution speed?
- [ ] **Maintainability**: Is the code clear and well-documented?

## Emergency Bug Fixes

### Critical Bug Response Process

1. **Immediate Assessment**
   - How widespread is the issue?
   - What functionality is broken?  
   - Is there a workaround?

2. **Quick Fix Implementation**
   - Focus on minimal change to restore functionality
   - Don't optimize or refactor during emergency fix
   - Test thoroughly despite time pressure

3. **Hot Fix Deployment**
   - Version increment: Add `-hotfix` suffix (e.g., `v7.5-final-hotfix`)
   - Clear change description in bottom comment
   - Document what was fixed and why

4. **Follow-Up**
   - Plan proper long-term fix if hot fix is suboptimal
   - Update documentation with lessons learned
   - Consider adding tests to prevent similar issues

## Documentation Maintenance

### When to Update Documentation
- **Function signatures change**: Update function reference
- **New constants added**: Update data structures doc
- **Logic flow changes**: Update architecture or relevant system docs  
- **Bug fixes**: Add to troubleshooting guide
- **New features**: Update configuration guide

### Documentation Standards
- Keep examples current with actual code
- Update version numbers in documentation
- Cross-reference related documentation  
- Include both "what" and "why" in explanations

---

**Key Development Principles**:
- ✅ **Always increment version numbers**
- ✅ **Test thoroughly before deployment**  
- ✅ **Follow coordinate assignment standards**
- ✅ **Document significant changes**
- ✅ **Prioritize correctness over optimization**