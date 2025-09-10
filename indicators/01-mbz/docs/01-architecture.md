# Architecture Overview

## System Design

The MBZ Hunter° indicator follows a **hierarchical gap detection and suppression architecture** with clear separation of concerns:

```
📊 Market Data Input
    ↓
🔍 Gap Detection Engine
    ↓  
🎯 Gap Hierarchy & Suppression
    ↓
📝 MBZ Formation & Classification  
    ↓
🎨 Visual Rendering & Display
```

## Core Components

### 1. Gap Detection Engine
**Purpose**: Identify different types of price gaps from market data

**Gap Types Detected**:
- **FVGs** (Fair Value Gaps) - 3-candle institutional gaps
- **Implied FVGs** - Complex institutional body gaps  
- **True Gaps** - Classic price gaps between ranges
- **Volume Imbalances** - 2-candle retail body gaps

### 2. Gap Hierarchy System
**Purpose**: Prioritize gaps based on institutional importance

**Priority Order**:
```
🏦 Institutional (Always Win)
├── FVGs (Priority #1)
└── Implied FVGs (Priority #2)

📈 Medium Priority  
└── True Gaps (Priority #3)

🛒 Retail (Lowest Priority)
└── Volume Imbalances (Priority #4)
```

### 3. Suppression Engine
**Purpose**: Prevent duplicate or overlapping gap signals

**Suppression Rules**:
- **FVGs**: No suppression (always detect)
- **Implied FVGs**: No suppression (always detect)
- **True Gaps**: Suppressed by ANY same-direction existing gap
- **Volume Imbalances**: Suppressed by FVGs, Implied FVGs, AND True Gaps

### 4. MBZ Formation System
**Purpose**: Convert validated gaps into MBZ trading signals

**Classification Types**:
- **Standard**: Basic MBZ formation
- **Inclusion**: Wick-dominant formations
- **Reflection**: Opposite-direction wick dominance
- **Gap-specific subtypes**: TRUE, IMPLIED, VOLUME variations

### 5. Visual Rendering System
**Purpose**: Display MBZ signals and manage chart elements

**Visual Components**:
- **Arrows**: MBZ signal indicators
- **Labels**: Text descriptions and classifications
- **Zones**: Price level highlighting
- **Extensions**: Projection lines and levels

## Data Flow Architecture

### Phase 1: Gap Detection (Per Bar)
```
Market Data → Gap Detection Functions → Temporary Gap Candidates
```

### Phase 2: Suppression & Validation  
```
Gap Candidates → Hierarchy Check → Overlap Analysis → Valid Gaps
```

### Phase 3: Gap Storage
```
Valid Gaps → active_gaps Array → Memory Management (100 max)
```

### Phase 4: MBZ Formation
```
Active Gaps → MBZ Classification → MBZ Records → Visual Display
```

## Memory Management Strategy

### Array Size Limits
```pinescript
active_gaps: 100 entries max
all_mbz_records: 75 entries max  
visual_elements: 100-200 entries max per type
```

### Cleanup Strategy
- **FIFO Removal**: Oldest entries removed first via `array.shift()`
- **Visual Cleanup**: Proper deletion with `box.delete()`, `line.delete()`, `label.delete()`
- **Performance Optimization**: Cleanup happens every bar to prevent memory issues

## Key Design Principles

### 1. Institutional Priority
**Higher institutional importance = Higher detection priority**
- FVGs and Implied FVGs never suppressed
- Retail patterns (VIs) always lose to institutional patterns

### 2. Directional Suppression
**Only same-direction gaps suppress each other**
- Bullish gaps only suppress bullish gaps
- Bearish gaps only suppress bearish gaps  
- Cross-direction gaps coexist

### 3. Spatial Overlap Detection
**Precise mathematical overlap calculation**
```pinescript  
// Overlap condition
if gap_bottom < existing_top and gap_top > existing_bottom
    // Overlap exists
```

### 4. Edge Case Handling
**Boundary conditions properly managed**
```pinescript
// Inclusive boundary for edge cases
if vi_top >= gap.bottom  // Note: >= not >
```

## Performance Considerations

### Optimization Strategies
1. **Early Exit**: Functions return immediately when no gaps exist
2. **Loop Breaking**: Break loops as soon as suppression condition found
3. **Array Size Management**: Strict limits prevent exponential growth
4. **Conditional Processing**: Skip processing when no MBZ records exist

### Critical Paths
- **Gap Detection**: Runs every confirmed bar
- **Suppression Logic**: Runs only when overlaps detected
- **Visual Updates**: Runs only when MBZs form or settings change

## Error Prevention Architecture

### Input Validation
- **Array bounds checking**: Always verify array size before access
- **Gap coordinate validation**: Ensure top > bottom for all gaps
- **Direction consistency**: Verify bullish/bearish flags match coordinates

### State Management
- **Immutable gap data**: Gap coordinates never modified after creation
- **Clear ownership**: Each component owns its data arrays
- **Proper cleanup**: All visual elements properly deleted

---

This architecture ensures **reliable gap detection**, **logical priority handling**, and **maintainable code structure** for the MBZ Hunter° indicator.