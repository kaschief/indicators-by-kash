# SIF Incremental Testing Plan - Anchoring Issue Resolution

## Current Status
- **Baseline**: `/indicators/sif/code/stable/sif-v7.1.pine` (known good anchoring)
- **Issue**: Previous comprehensive changes caused "boxes and labels dont appear attached to the candle anymore"
- **Solution**: Implement critical changes in small testable batches

## Batch Implementation Plan

### ✅ Batch 1: Critical Suppression Fix ONLY (v8.1.2-minimal-suppression)
**File**: `/indicators/sif/code/development/sif-dev-minimal.pine`
**Changes Made**:
- Replaced dangerous 80% overlap threshold with MBZ-proven targeted suppression
- Only modified `is_gap_overlapping()` function and related suppression logic
- **NO changes to visual anchoring, constants, or documentation**

**Test Requirements**:
- Verify boxes and labels remain attached to candles
- Confirm suppression works correctly (no false signals)
- Validate gap hierarchy (FVG > Implied > True > VI)

---

### 📋 Batch 2: Named Constants (PENDING - after Batch 1 test passes)
**Planned Changes**:
- Add performance constants (MAX_ACTIVE_GAPS = 100, MAX_SIF_RECORDS = 75)
- Add threshold constants (DEFAULT_DISPLACEMENT_MULTIPLIER = 1.5)
- Replace magic numbers with descriptive constants
- **NO visual or algorithmic changes**

---

### 📋 Batch 3: Function Documentation (PENDING)
**Planned Changes**:
- Add @function, @description, @param, @returns format
- Document complex algorithms (gap detection, suppression logic)
- Add inline comments for coordinate calculations
- **NO code logic changes**

---

### 📋 Batch 4: Coordinate Validation (PENDING)
**Planned Changes**:
- Add coordinate assignment documentation from MBZ lessons learned
- Implement validation patterns that prevent reversal bugs
- Document proper gap boundary calculations
- **NO visual element changes**

---

## Testing Protocol

### For Each Batch:
1. **Compile Test**: Ensure no syntax errors
2. **Visual Anchoring Test**: Verify boxes/labels attach to correct candles
3. **Functionality Test**: Confirm gap detection works as expected
4. **Regression Test**: Compare against baseline behavior

### Success Criteria:
- ✅ Clean compilation
- ✅ Visual elements properly anchored to candles
- ✅ Gap detection maintains accuracy
- ✅ No loss of existing functionality

### Failure Response:
- Immediately revert to previous working version
- Identify specific problematic change
- Create smaller sub-batch if needed

---

## Risk Mitigation

### High-Risk Changes (Monitor Closely):
- Any coordinate calculation modifications
- Visual element creation/positioning code
- Bar indexing or timing logic

### Low-Risk Changes (Safe to batch):
- Documentation additions
- Named constants (if no logic changes)
- Comment additions

---

## Current Action Required:
**TEST BATCH 1** (`v8.1.2-minimal-suppression`) for anchoring issues before proceeding to Batch 2.

**File Location**: `/Users/kaschief/Desktop/indicators-by-kash/indicators/sif/code/development/sif-dev-minimal.pine`

---

**Created**: 2025-08-29
**Status**: Batch 1 ready for testing