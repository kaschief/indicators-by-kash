# MBZ Hunter° [Pro+] [v9.17-deeper-wick-special-properties] Technical Documentation

## Table of Contents
1. [Overview & Purpose](#overview--purpose)
2. [Architecture Overview](#architecture-overview)
3. [Constants System](#constants-system)
4. [Label Display Logic](#label-display-logic)
5. [Gap Source Detection](#gap-source-detection)
6. [MBZ Behaviors & Classification](#mbz-behaviors--classification)
7. [Breach Detection System](#breach-detection-system)
8. [Extension & Projection Systems](#extension--projection-systems)
9. [Performance Features](#performance-features)
10. [Configuration Groups & Settings](#configuration-groups--settings)
11. [Technical Implementation Details](#technical-implementation-details)
12. [Usage Guidelines](#usage-guidelines)
13. [Troubleshooting & Common Issues](#troubleshooting--common-issues)

---

## Overview & Purpose

The **MBZ Hunter° [Pro+]** is an advanced Pine Script indicator designed to detect and analyze Mitigation Block Zones (MBZs) - previously called SIFs (Smart Institutional Fills). This indicator identifies areas where institutional traders are likely to fill gaps in price action, providing sophisticated entry and exit opportunities.

### Core Philosophy
- **Gap-Driven Detection**: All MBZs are created from underlying gaps (FVGs, Implied, Volume Imbalances, True Gaps)
- **Behavioral Analysis**: Classifies MBZs based on inclusion vs reflection patterns
- **Deeper Wick Analysis**: Detects when formation candles penetrate deeper into source gaps than mitigating candles
- **Real-Time Monitoring**: Tracks breach status and invalidation levels dynamically
- **Visual Clarity**: Clean labeling system with detailed breakdowns when needed

### Key Features
- 4 Gap Source Types with advanced detection algorithms
- 2 Primary Behaviors (Inclusion/Reflection) with nested variations
- **🆕 Deeper Wick Detection System** with visual marking options
- **🆕 Enhanced Border Controls** with priority system
- **🆕 Special Properties Menu** for advanced detection features
- Separate limits system for valid vs invalidated MBZs
- Advanced breach detection with multiple methods
- Extension system with 3 modes
- Performance-optimized for high-frequency analysis

---

## Architecture Overview

### System Components

```
MBZ Hunter° Architecture
│
├── Gap Detection Layer
│   ├── Fair Value Gaps (FVG)
│   ├── Implied FVGs (with displacement validation)
│   ├── Volume Imbalances (2-candle gaps)
│   └── True Gaps (classic price gaps)
│
├── Behavior Classification Layer
│   ├── Inclusion (wick toward body direction)
│   └── Reflection (wick away from body direction)
│
├── 🆕 Deeper Wick Detection Layer (v9.17)
│   ├── Standard Detection (formation vs mitigating penetration)
│   ├── Reflection Pattern Detection (geometric projection)
│   └── Visual Marking (stars, borders, or both)
│
├── Consolidation Layer
│   ├── Group same-direction overlapping MBZs
│   └── Generate consolidated labels and zones
│
├── Breach Detection Layer
│   ├── Trade Through Method (any price movement)
│   └── Body Breach Method (open/close only)
│
├── Extension System
│   ├── Fixed Length
│   ├── To Current Price
│   └── Beyond Current Price
│
└── Visual Output Layer
    ├── Candle Labels with Deeper Wick Symbols
    ├── Extension Boxes
    ├── Enhanced Border System (1-5px priority-based)
    ├── Breach Lines
    └── Projection Lines
```

### Performance Limits (v9.17)
```pinescript
INDICATOR_MAX_BOXES = 500      // Maximum boxes allowed
INDICATOR_MAX_LABELS = 500     // Maximum labels allowed
INDICATOR_MAX_LINES = 500      // Maximum lines allowed

// Optimized Array Limits (v9.13 base)
MAX_MBZ_RECORDS = 40            // Reduced from 50 (20% reduction)
MAX_BODY_HIGHLIGHTS = 50        // Reduced from 60 (17% reduction)
MAX_WICK_HIGHLIGHTS = 50        // Reduced from 60 (17% reduction)
SUPER_MBZ_SCAN_LIMIT = 20       // Reduced from 25 (20% reduction)
HISTORICAL_LOOKBACK_LIMIT = 100 // Reduced from 200 (50% reduction)
```

---

## Constants System (v9.17)

The indicator uses a comprehensive constants system (40+ constants) to eliminate hardcoded strings and improve maintainability, including new deeper wick detection constants.

### Gap Source Constants
```pinescript
// Gap types
GAP_TYPE_FVG = "fvg"
GAP_TYPE_IMPLIED = "implied" 
GAP_TYPE_VOLUME = "volume"
GAP_TYPE_TRUE = "true"

// Display constants (CRITICAL for label logic)
GAP_SOURCE_FVG_DISPLAY = ""                    // Invisible for clean single FVG displays
GAP_SOURCE_FVG_BREAKDOWN_DISPLAY = "fvg"       // Visible for breakdown displays
GAP_SOURCE_IMPLIED_DISPLAY = "imp"
GAP_SOURCE_VOLUME_DISPLAY = "vol"
GAP_SOURCE_TRUE_DISPLAY = "gap"
```

### 🆕 Deeper Wick Detection Constants (v9.17)
```pinescript
// Visual marking options
SOURCE_GAP_DEEPER_WICK_OFF = "Off"
SOURCE_GAP_DEEPER_WICK_STAR = "Star"
SOURCE_GAP_DEEPER_WICK_BORDER = "Border"
SOURCE_GAP_DEEPER_WICK_BOTH = "Star + Border"

// Symbol style options
DEEPER_WICK_SYMBOL_CIRCLE = "Circle (◉)"
DEEPER_WICK_SYMBOL_TEXT = "Text (deeper)"

// Display constants
SOURCE_GAP_DEEPER_WICK_SYMBOL_CIRCLE = "◉"
SOURCE_GAP_DEEPER_WICK_SYMBOL_TEXT = "[deeper]"
SOURCE_GAP_DEEPER_WICK_DESCRIPTION_TEXT = "Has deeper wick into source gap"
```

### MBZ Behavior Constants
```pinescript
// Primary behaviors
SUBTYPE_INCLUSION = "inclusion"
SUBTYPE_REFLECTION = "reflection"

// Nested variations
SUBTYPE_IMPLIED_INCLUSION = "implied_inclusion"
SUBTYPE_IMPLIED_REFLECTION = "implied_reflection"
SUBTYPE_VOLUME_INCLUSION = "volume_inclusion"
SUBTYPE_VOLUME_REFLECTION = "volume_reflection"
```

### UI Group Constants
```pinescript
GROUP_DETECTION = "🎯 DETECTION"
GROUP_MBZ_LABELLING = "🏷️ MBZ LABELLING"
GROUP_SIF_EXTENSION = "✨ SIF EXTENSION"
GROUP_GAP_SOURCES = "🎯 GAP SOURCES"
GROUP_SIF_BEHAVIORS = "🎭 SIF BEHAVIORS"
GROUP_BREACH_DETECTION = "🚨 BREACH DETECTION"
```

### Display Mode Constants
```pinescript
DISPLAY_MODE_ARROW_ONLY = "Arrow Only"
DISPLAY_MODE_TEXT_ONLY = "Text Only"
DISPLAY_MODE_ARROW_TEXT = "Arrow + Text"
```

### Text Size Constants
```pinescript
TEXT_SIZE_TINY = "Tiny"
TEXT_SIZE_SMALL = "Small"
TEXT_SIZE_NORMAL = "Normal"
TEXT_SIZE_LARGE = "Large"
```

---

## 🆕 Deeper Wick Detection System (v9.17)

The deeper wick detection system identifies MBZs where the formation candle's wick penetrated deeper into the source gap than the mitigating candle's wick.

### Core Detection Logic
```pinescript
// For bullish gaps (formation candle above gap)
formation_low < mitigating_low  // Formation wick went deeper (lower)

// For bearish gaps (formation candle below gap)
formation_high > mitigating_high  // Formation wick went deeper (higher)
```

### Detection Types

#### 1. Standard Deeper Wick Detection
**Always Active**: Compares formation candle's wick penetration vs mitigating candle
- **Bullish MBZ**: Formation low < Gap mitigating low
- **Bearish MBZ**: Formation high > Gap mitigating high
- **Result**: Sets `wicked_into_source_gap = true` in MBZRecord

#### 2. Enhanced Reflection Detection (Optional)
**User Configurable**: Advanced geometric projection for reflection MBZs
- Uses gap boundaries and candle positioning
- Projects ideal wick behavior for reflection patterns
- **Default**: Disabled (minimal performance impact)
- **Result**: Sets `reflection_pattern_deeper = true` in MBZRecord

### Visual Marking Options

#### Symbol Styles
```pinescript
Circle Style: "◉"        // Clean, professional symbol
Text Style: "[deeper]"   // Descriptive text marker
```

#### Marking Modes
```pinescript
Off: No special marking
Star: Adds symbol to candle label ("MBZ+ ◉")
Border: Adds 3px colored border around extension box
Star + Border: Both visual enhancements combined
```

### Border Priority System
```
1. Deeper Wick Borders (3px) - Highest priority
2. Multi-Source Borders (2px) - Medium priority  
3. Default Borders (1px) - Standard priority
```

### Enhanced Data Structure
```pinescript
type MBZRecord
    // ... existing fields ...
    bool wicked_into_source_gap        // 🆕 Standard deeper wick detection
    bool reflection_pattern_deeper     // 🆕 Enhanced reflection detection
```

### Core Detection Function
```pinescript
// Main detection function
check_deeper_wick_penetration(mbz_high, mbz_low, mbz_open, mbz_close, 
                              is_bullish, subtype, mitigating_high, 
                              mitigating_low, source_gap_id)
    // Returns [standard_deeper, reflection_pattern_deeper]
```

---

## Label Display Logic

The indicator uses a sophisticated two-constant FVG display system for clean visual presentation:

### Core Display Rules
1. **Single FVG Only**: Shows clean "MBZ+" (GAP_SOURCE_FVG_DISPLAY = "")
2. **Mixed Gap Types**: Shows detailed "MBZ+ (fvg, vol)" (GAP_SOURCE_FVG_BREAKDOWN_DISPLAY = "fvg")
3. **Multiple Same Type**: Shows multiplier "MBZ+ (fvg×2)"

### Candle Label Examples

#### Single Gap Type Labels
```
1 FVG only:     "MBZ+"              // Clean, no gap type shown
1 Implied only: "MBZ+ (imp)"        // Gap type shown for non-FVG
1 Volume only:  "MBZ+ (vol)"        // Gap type shown for non-FVG
1 True only:    "MBZ+ (gap)"        // Gap type shown for non-FVG
```

#### Multiple Same Type Labels
```
2 FVGs:         "MBZ+ (fvg×2)"      // Multiplier used
3 FVGs:         "MBZ+ (fvg×3)"      // Multiplier used
2 Implied:      "MBZ+ (imp×2)"      // Multiplier used
2 Volume:       "MBZ+ (vol×2)"      // Multiplier used
```

#### Mixed Type Labels  
```
1 FVG + 1 Vol:         "MBZ+ (fvg, vol)"        // FVG now visible
1 FVG + 1 Imp:         "MBZ+ (fvg, imp)"        // FVG now visible
2 FVG + 1 Vol:         "MBZ+ (fvg×2, vol)"      // Multiple FVGs with others
1 FVG + 1 Imp + 1 Vol: "MBZ+ (fvg, imp, vol)"  // All types shown
2 FVG + 2 Vol + 1 Imp: "MBZ+ (fvg×2, vol×2, imp)" // All with multipliers
```

### Extension Box Labels

Extension boxes follow different logic - they show gap breakdowns or remain empty:

#### Extension Box Examples
```
1 FVG only:            ""                    // Empty (clean)
2 FVGs only:           "fvg×2"               // Count shown
3 FVGs only:           "fvg×3"               // Count shown
1 FVG + 1 Vol:         "2: fvg, vol"         // Total count + breakdown
2 FVG + 1 Vol:         "3: fvg×2, vol"       // Total count + breakdown
1 FVG + 1 Imp + 1 Vol: "3: fvg, imp, vol"   // Total count + breakdown
2 FVG + 2 Vol:         "4: fvg×2, vol×2"     // Total count + breakdown
```

### Label Generation Algorithm

```pinescript
// Simplified logic for candle labels
get_candle_label_text(fvg_count, imp_count, vol_count, true_count) =>
    total_types = (fvg_count > 0 ? 1 : 0) + (imp_count > 0 ? 1 : 0) + 
                  (vol_count > 0 ? 1 : 0) + (true_count > 0 ? 1 : 0)
    
    if total_types == 1
        // Single type - FVG shows nothing, others show type
        if fvg_count > 0
            fvg_count == 1 ? "MBZ+" : "MBZ+ (fvg×" + str.tostring(fvg_count) + ")"
        else
            // Non-FVG types always show
            "MBZ+ (" + gap_type + (count > 1 ? "×" + str.tostring(count) : "") + ")"
    else
        // Mixed types - FVG becomes visible
        "MBZ+ (" + build_breakdown_string() + ")"
```

---

## Gap Source Detection

The indicator detects four types of gaps that can create MBZs:

### 1. Fair Value Gaps (FVG)
**Definition**: 3-candle gaps where C0 doesn't overlap with C2
```pinescript
// Bullish FVG: C0.low > C2.high
is_bullish_fvg() => low > high[2]

// Bearish FVG: C0.high < C2.low  
is_bearish_fvg() => high < low[2]
```

**Characteristics**:
- Most common gap type
- Foundation of MBZ detection
- Clean labels when alone: "MBZ+"
- Visible in mixed scenarios: "MBZ+ (fvg, vol)"

### 2. Implied FVGs
**Definition**: 3-candle institutional gaps with displacement validation
```pinescript
// Requires C2 body displacement above average
displacement_threshold = ta.sma(math.abs(close[2] - open[2]), lookback_candles) * displacement_multiplier
c2_body_size = math.abs(close[2] - open[2])
is_displacement_valid = c2_body_size >= displacement_threshold
```

**Characteristics**:
- Validates institutional movement
- Always shows type: "MBZ+ (imp)"
- Default displacement multiplier: 1.5x
- Lookback period: configurable

### 3. Volume Imbalances  
**Definition**: 2-candle body gaps between retail candles
```pinescript
// Bullish: C0.body_bottom > C1.body_top
// Bearish: C0.body_top < C1.body_bottom
```

**Characteristics**:
- Retail gap detection
- Always shows type: "MBZ+ (vol)"
- Faster detection (2 candles vs 3)

### 4. True Gaps
**Definition**: Classic price gaps between candle ranges
```pinescript
// Bullish: C0.low > C1.high
// Bearish: C0.high < C1.low
```

**Characteristics**:
- Traditional gap analysis
- Shows type: "MBZ+ (gap)"
- Less common in modern markets

### Gap Source Priority
When multiple gap types occur simultaneously:
1. All detected gaps are counted
2. Labels show all types with appropriate multipliers
3. No priority filtering - complete transparency

---

## MBZ Behaviors & Classification

MBZs are classified based on wick behavior relative to body direction:

### Inclusion Behavior
**Definition**: Wick points toward body direction
- **Bullish Inclusion**: Lower wick on bullish candle (wick points down, body moves up)
- **Bearish Inclusion**: Upper wick on bearish candle (wick points up, body moves down)

```pinescript
// Bullish inclusion detection
is_bullish_inclusion = (close > open) and (low < math.min(open, close))

// Bearish inclusion detection  
is_bearish_inclusion = (close < open) and (high > math.max(open, close))
```

**Visual Markers**: 
- Arrow: "↓inc" (bullish), "↑inc" (bearish)
- Label detail: "MBZ+ (vol) ↓inc"

### Reflection Behavior
**Definition**: Wick points away from body direction
- **Bullish Reflection**: Upper wick on bullish candle (wick points up, body moves up)
- **Bearish Reflection**: Lower wick on bearish candle (wick points down, body moves down)

```pinescript
// Bullish reflection detection
is_bullish_reflection = (close > open) and (high > math.max(open, close))

// Bearish reflection detection
is_bearish_reflection = (close < open) and (low < math.min(open, close))
```

**Visual Markers**:
- Arrow: "↑ref" (bullish), "↓ref" (bearish)  
- Label detail: "MBZ+ (vol) ↑ref"

### Nested Classifications
Each gap source can exhibit either behavior:
```pinescript
SUBTYPE_IMPLIED_INCLUSION = "implied_inclusion"
SUBTYPE_IMPLIED_REFLECTION = "implied_reflection"
SUBTYPE_VOLUME_INCLUSION = "volume_inclusion"
SUBTYPE_VOLUME_REFLECTION = "volume_reflection"
SUBTYPE_TRUE_INCLUSION = "true_inclusion"
SUBTYPE_TRUE_REFLECTION = "true_reflection"
```

### Super MBZs
MBZs overlapping with same-direction MBZs receive checkmark: "✔️ MBZ+"

---

## Breach Detection System

Advanced breach detection with configurable methods and thresholds:

### Breach Methods

#### 1. Trade Through Method (Default)
**Definition**: Any price movement into the MBZ zone
```pinescript
// Detects any wick or body penetration
breach_detected = bullish_mbz ? (low <= zone_threshold) : (high >= zone_threshold)
```

**Use Case**: 
- More sensitive detection
- Catches institutional wick tests
- Earlier breach alerts

#### 2. Body Breach Method  
**Definition**: Only candle body (open/close) enters zone
```pinescript
// Only counts when body breaches
body_low = math.min(open, close)
body_high = math.max(open, close)
breach_detected = bullish_mbz ? (body_low <= zone_threshold) : (body_high >= zone_threshold)
```

**Use Case**:
- Less sensitive detection  
- Filters out wick tests
- Confirms commitment to direction

### Breach Thresholds
Configurable percentage of zone that must be filled:

#### Invalidation Modes
```pinescript
INVALIDATION_STRICT = "Strict (55%)"      // 55% fill required
INVALIDATION_LENIENT = "Lenient (85%)"    // 85% fill required  
INVALIDATION_CUSTOM = "Custom"            // User-defined (1-99%)
```

#### Threshold Calculation
```pinescript
// For bullish MBZ
zone_height = zone_top - zone_bottom
threshold_level = zone_bottom + (zone_height * (threshold_percent / 100.0))

// Breach occurs when price <= threshold_level
```

### Real-Time Breach Status
- **[BREACHED]**: Shows immediately when threshold exceeded
- **[X]**: Shows after candle closes with confirmation
- **Color Change**: Labels change to breach color when detected
- **Zone Fading**: Extension boxes fade when breached (if enabled)

### Breach Lines
Optional visual lines at breach levels:
- **Breach Lines**: Red dashed lines at breach threshold
- **Invalidation Lines**: Gray solid lines at invalidation threshold
- **Configurable**: Style, width, color, enable/disable

---

## Extension & Projection Systems

### Extension System

#### Extension Modes
```pinescript
EXTENSION_FIXED = "Fixed Length"           // Extend N bars from formation
EXTENSION_TO_CURRENT = "To Current Price"  // Extend at least to current bar
EXTENSION_BEYOND_CURRENT = "Beyond Current Price" // Extend N bars beyond current
```

#### Mode Behaviors
1. **Fixed Length**: 
   - Extends exactly N bars from MBZ formation
   - Static length, doesn't change with time
   - Good for historical analysis

2. **To Current Price**:
   - Always extends to current bar minimum  
   - Prevents boxes from shrinking as time progresses
   - Real-time relevance maintained

3. **Beyond Current Price**:
   - Extends N bars beyond current bar
   - Dynamic forward projection
   - Most aggressive real-time mode

#### Extension Box Labels
Extension boxes show gap source breakdowns:
```pinescript
// Extension box label examples
single_fvg: ""                    // Empty for clean display
multiple_fvgs: "fvg×2"           // Show multiplier
mixed_types: "3: fvg×2, vol"     // Total count + breakdown
```

### Projection System

#### Projection Levels
The indicator can project multiple levels from MBZ zones:

**Boundary Levels**:
- **0**: Zone close level
- **1**: Zone open level

**Intermediate Levels**:
- **CE (0.5)**: 50% equilibrium level
- **Quadrants (0.25, 0.75)**: Quarter levels

**Stop Levels** (beyond open):
- **1.25, 1.5, 2.0**: Potential stop loss levels

**Target Levels** (beyond close):
- **-2.33, -2.5, -4, -4.5**: Fibonacci-based profit targets

**Custom Levels**:
- User-defined comma-separated values
- Example: "0, 1, 1.5, -2.33, -4"

#### Projection Settings
```pinescript
project_last_n_sifs = 5          // Number of recent MBZs to project
projection_extend_bars = 20      // Bars to extend projections
projection_line_style = "Dotted" // Visual style
projection_label_side = "Right"  // Label positioning
```

---

## Performance Features

### Optimized Array Limits
```pinescript
MAX_ACTIVE_GAPS = 100        // Active gap tracking (optimized)
MAX_SIF_RECORDS = 75         // MBZ history (visual clarity + performance)
MAX_BODY_HIGHLIGHTS = 100    // Body highlight boxes
MAX_WICK_HIGHLIGHTS = 100    // Wick highlight boxes
MAX_EXTENDED_BOXES = 100     // Extension boxes
MAX_PROJECTION_LINES = 200   // Projection lines
MAX_PROJECTION_LABELS = 200  // Projection labels
```

### Separate Limits System (v9.3 Feature)
Independent control over valid vs invalidated MBZs:

```pinescript
DEFAULT_MAX_VALID_SIFS = 20           // Default valid MBZs to show
DEFAULT_MAX_INVALIDATED_SIFS = 5      // Default invalidated MBZs to show
MAX_VALID_SIFS_LIMIT = 100           // UI maximum for valid
MAX_INVALIDATED_SIFS_LIMIT = 50      // UI maximum for invalidated
```

**Benefits**:
- Show fewer invalidated MBZs to reduce chart clutter
- Keep more valid MBZs for trading opportunities
- Independent limits prevent interference
- Improved visual clarity

### Performance Optimizations
- **Historical Lookback Limit**: 75 bars (25% reduction from v9.12)
- **Consolidated Processing**: Groups overlapping same-direction MBZs
- **Smart Array Management**: Automatic cleanup of old records
- **Efficient Gap Detection**: Optimized detection algorithms

---

## Configuration Groups & Settings

### Input Groups Structure

#### 🎯 DETECTION
- **Max Valid MBZs**: 0-100 (default: 20)
- **Max Invalidated MBZs**: 0-50 (default: 5)  
- **Show Invalidated MBZs**: Off/Labels Only/Labels + Zones
- **Invalidation Threshold**: Strict/Lenient/Custom
- **Custom %**: 1-99% (when Custom selected)

#### 🎯 DIRECTIONAL FILTER  
- **Show MBZ+**: Enable/disable bullish MBZs
- **Show MBZ-**: Enable/disable bearish MBZs

#### 🚨 BREACH DETECTION
- **Enable Breach Detection**: Master switch
- **Method**: Trade Through vs Body Breach
- **Threshold %**: 1-99% of zone fill required
- **Fade Extension Box on Breach**: Visual feedback
- **Opacity%**: 10-90% transparency when breached
- **Enable Alternative Text**: Change label colors on breach
- **Breached Text Color**: Color for breached labels
- **Breach Lines**: Enable visual breach lines
- **Invalidation Lines**: Enable visual invalidation lines

#### 🏷️ MBZ LABELLING
- **Label Style**: Arrow Only/Text Only/Arrow + Text
- **Valid MBZ Size**: Tiny/Small/Normal/Large
- **Invalidated MBZ Size**: Tiny/Small/Normal/Large  
- **MBZ+ Color**: Bullish label color
- **MBZ- Color**: Bearish label color
- **Invalidated Color**: Color for invalidated labels
- **Enable Labels on MBZ Candles**: Master label switch

#### ✨ MBZ EXTENSION
- **MBZ+ Color**: Bullish extension box color
- **MBZ- Color**: Bearish extension box color
- **Enable Extension**: Master extension switch
- **Extension Mode**: Fixed/To Current/Beyond Current
- **No. of Bars**: Extension length (meaning varies by mode)
- **Label Size**: Extension box label size
- **Label Color**: Extension box label color

#### 🎯 GAP SOURCES
- **Fair Value Gaps**: Enable standard FVGs
- **Implied FVGs**: Enable institutional displacement FVGs
- **Volume Imbalances**: Enable 2-candle body gaps
- **True Gaps**: Enable classic price gaps

#### 📦 SOURCE GAP
- **Box Color**: Color for source gap boxes
- **Max Boxes**: Maximum gap boxes to display
- **Enable Gaps**: Show gaps that created each MBZ
- **Label Size**: Gap label text size
- **Label Color**: Gap label text color

#### 🎭 MBZ WICK BEHAVIORS (Renamed v9.17)
- **Inclusion**: Enable inclusion behavior detection
- **Reflection**: Enable reflection behavior detection

#### 🆕 🏷️ MBZ SPECIAL PROPERTIES (v9.17)
- **Deeper Wick Detection**: Off/Star/Border/Star + Border
- **Deeper Wick Border Color**: Color for deeper wick borders (default: blue)
- **Deeper Wick Border Width**: 1-5px (default: 3px)
- **Deeper Wick Symbol Style**: Circle (◉) or Text ([deeper])
- **Enhanced Reflection Detection**: Enable geometric projection detection
- **Multi-Source Border Color**: Color for multi-source borders (default: orange) 
- **Multi-Source Border Width**: 1-5px (default: 2px)
- **Nested MBZs**: Mark overlapping same-direction MBZs
- **Show Label Details**: Display source types and behaviors
- **Wick Dominance Markers**: Enable wick-to-body ratio stars

#### ⚙️ SOURCE SETTINGS
- **Implied: Displacement**: Multiplier for displacement validation (default: 1.5)
- **Lookback**: Bars for displacement average calculation

#### 📈 PROJECTIONS
- **Project Last N**: Number of recent MBZs to project (1-10)
- **Enable Projections**: Master projection switch
- **No. of Bars**: Projection extension length
- **Line Width**: Projection line thickness (1-3)
- **Line Style**: Solid/Dashed/Dotted
- **Label Side**: Left/Right positioning
- **Label Gap (bars)**: Distance from line to label

**Level Controls**:
- **Boundaries (0, 1)**: Zone boundary levels
- **CE (0.5)**: Equilibrium center level  
- **Quadrants (0.25, 0.75)**: Quarter levels
- **Stops (1.25, 1.5, 2.0)**: Stop loss levels
- **Targets (-2.33, -2.5, -4, -4.5)**: Profit target levels
- **Custom Levels**: User-defined level list
- **Custom List**: Comma-separated values

---

## Technical Implementation Details

### Data Structures

#### GapData Type
```pinescript
type GapData
    string gap_type        // "fvg", "implied", "volume", "true"
    float gap_top          // Upper boundary of gap
    float gap_bottom       // Lower boundary of gap  
    int gap_bar_index      // Bar index where gap formed
    bool is_bullish        // Gap direction
```

#### MBZData Type (Consolidated SIF)
```pinescript
type ConsolidatedSIF
    bool is_bullish                    // Direction
    float consolidated_zone_top        // Zone upper boundary
    float consolidated_zone_bottom     // Zone lower boundary
    int consolidated_bar_index         // Formation bar
    array<SIFData> sif_group          // Individual MBZs in group
    bool is_consolidated_invalidated   // Breach status
    string consolidated_label_text     // Display text
```

### Core Algorithms

#### Gap Detection Flow
1. **Scan Current Bar**: Check all 4 gap types
2. **Validate Conditions**: Apply displacement/size filters
3. **Create GapData**: Store gap information
4. **Queue for Processing**: Add to active gaps array

#### MBZ Formation Flow  
1. **Analyze Wick Patterns**: Determine inclusion/reflection
2. **Create MBZData**: Generate individual MBZ record
3. **Consolidation Check**: Group with overlapping same-direction MBZs
4. **Label Generation**: Create display text using gap source logic
5. **Visual Creation**: Generate labels and extension boxes

#### Breach Detection Flow
1. **Monitor Active MBZs**: Check price against zones
2. **Apply Method**: Trade Through vs Body Breach
3. **Calculate Threshold**: Apply percentage rules
4. **Update Status**: Set breach flags and invalidation
5. **Visual Response**: Update colors, add lines, fade boxes

### Memory Management
- **Array Sizing**: All arrays have fixed maximum sizes
- **Historical Cleanup**: Automatic removal of old records
- **Efficient Indexing**: Bar-based indexing for fast lookups
- **Consolidated Processing**: Reduces individual MBZ tracking

---

## Usage Guidelines

### Best Practices

#### For Day Trading
- **Use Trade Through Method**: Catches quick institutional moves
- **Enable Real-Time Extensions**: "Beyond Current Price" mode
- **Focus on FVGs and Implied**: Higher probability setups
- **Lower Breach Threshold**: 25-35% for early entries
- **Show More Valid MBZs**: 15-25 for opportunity scanning

#### For Swing Trading  
- **Use Body Breach Method**: Filters noise, confirms commitment
- **Use Fixed Extensions**: Historical analysis preferred
- **Include All Gap Sources**: Broader opportunity set
- **Higher Breach Threshold**: 55-85% for confirmed breaks
- **Show Fewer MBZs**: 5-10 for clarity

#### For Analysis
- **Enable All Features**: Full picture of market structure
- **Show Label Details**: Understand source types and behaviors
- **Enable Projections**: Identify potential levels
- **Use Source Gap Boxes**: See gap-to-MBZ relationships
- **Enable Nested Marking**: Identify confluence zones

### Common Setups

#### Scalping Configuration
```
Max Valid MBZs: 25
Invalidation: Strict (55%)
Method: Trade Through  
Threshold: 25%
Extension Mode: Beyond Current
Gap Sources: FVG + Implied only
```

#### Position Trading Configuration
```
Max Valid MBZs: 10
Invalidation: Lenient (85%)
Method: Body Breach
Threshold: 65%  
Extension Mode: Fixed Length
Gap Sources: All enabled
```

### Interpretation Guide

#### Strong MBZ Signals
- **Multiple Gap Sources**: "MBZ+ (fvg×2, vol)"
- **Super MBZ Marking**: "✔️ MBZ+"  
- **High Wick Dominance**: ⭐ markers present
- **Clear Behavior**: Obvious inclusion/reflection

#### Weak MBZ Signals  
- **Single Volume Gap**: "MBZ+ (vol)" only
- **Small Wick Ratio**: No star markers
- **Mixed Behavior**: Unclear inclusion/reflection
- **Immediate Breach**: Quick invalidation

#### Confluence Zones
- **Multiple MBZs**: Same area, different timeframes
- **Nested MBZs**: Overlapping same-direction zones
- **Projection Overlaps**: Multiple MBZs projecting to same levels
- **Gap Source Diversity**: Different gap types creating MBZs

---

## Troubleshooting & Common Issues

### Performance Issues

#### High CPU Usage
- **Reduce Max Valid MBZs**: Lower from 20 to 10-15
- **Disable Projections**: Turn off if not needed
- **Limit Gap Sources**: Enable only FVG and Implied
- **Increase Breach Threshold**: Reduce false breach calculations

#### Memory Warnings
- **Check Array Limits**: Ensure within TradingView limits
- **Disable Source Gap Boxes**: Reduce visual element count
- **Lower Extension Length**: Reduce box creation
- **Disable Wick Stars**: Reduce label count

### Visual Issues

#### Overlapping Labels
- **Adjust Label Size**: Use Tiny instead of Small/Normal
- **Reduce Max MBZs**: Show fewer simultaneous MBZs
- **Disable Label Details**: Use clean "MBZ+" labels only
- **Smart Positioning**: Reflection MBZs auto-adjust positioning

#### Extension Box Issues
- **Check Extension Mode**: Ensure appropriate for timeframe
- **Verify Color Contrast**: Extension colors may blend with background
- **Box Limit Reached**: Increase max boxes or reduce scope
- **Fading Issues**: Check breach detection settings

### Detection Issues

#### Missing MBZs
- **Check Gap Source Settings**: Ensure required types enabled
- **Verify Displacement Settings**: Implied FVGs may need adjustment
- **Review Behavior Settings**: Inclusion/Reflection both needed
- **Check Directional Filter**: MBZ+/MBZ- both enabled
- **Threshold Too Strict**: Breach detection may be too aggressive

#### False MBZs  
- **Increase Displacement Multiplier**: Reduce Implied FVG sensitivity
- **Enable Body Breach Only**: Filter wick-based false signals
- **Increase Breach Threshold**: Require more confirmation
- **Disable Volume Gaps**: Remove if causing noise

### Configuration Issues

#### Settings Not Saving
- **TradingView Limits**: Check browser storage
- **Template Issues**: Save as template after configuration
- **Version Conflicts**: Ensure using latest indicator version

#### Unexpected Behavior
- **Input Validation**: Check min/max values respected
- **Mode Conflicts**: Ensure compatible settings combinations
- **Real-time vs Historical**: Some features behave differently
- **Timeframe Dependencies**: Certain features work better on specific timeframes

### Support Information

#### System Requirements
- **TradingView Pro+**: Required for advanced features
- **Modern Browser**: Chrome/Firefox recommended
- **Sufficient RAM**: 8GB+ for optimal performance
- **Stable Internet**: Real-time features require good connection

#### Compatibility
- **All Timeframes**: Optimized for 1m to 1D
- **All Markets**: Forex, Crypto, Stocks, Futures
- **All Sessions**: Works 24/7 markets and regular hours
- **All Symbols**: No specific symbol requirements

---

## Appendix

### Version History
- **v9.17**: 🆕 Deeper wick detection system, enhanced border controls, menu reorganization
- **v9.16**: Enhanced visual controls and special properties consolidation
- **v9.15**: Performance improvements and architectural refinements  
- **v9.14**: Multi-source detection and filtering capabilities
- **v9.13**: Performance optimized, reduced historical lookback
- **v9.12**: Constants architecture implementation  
- **v9.11**: Extension box fading system
- **v9.10**: Body breach method addition
- **v9.3**: Separate limits system introduction

### Changelog Summary
- **🆕 v9.17**: Deeper wick detection system with visual marking options
- **🆕 v9.17**: Enhanced border controls with priority system (1-5px)
- **🆕 v9.17**: Special properties menu consolidation
- **🆕 v9.17**: Menu reorganization for improved user experience
- Constants system eliminates hardcoded strings
- Two-tier FVG display system for clean labels
- Performance optimizations for high-frequency analysis (20-50% reductions)
- Advanced breach detection with multiple methods
- Extension system with real-time modes
- Comprehensive projection level system

### Future Enhancements  
- Multi-timeframe MBZ detection
- Volume-weighted gap scoring
- Machine learning breach probability
- Advanced confluence detection
- Enhanced mobile compatibility
- Deeper wick detection refinements based on user feedback

---

*This documentation covers the complete MBZ Hunter° [Pro+] system as implemented in v9.17-deeper-wick-special-properties. For the most current version and updates, refer to the indicator source code and release notes.*