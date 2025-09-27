# SIF Hunter° [Pro+] [v9.17-enhanced-controls-tooltips] - Technical Documentation

## Overview & Purpose

The SIF Hunter° [Pro+] indicator is a sophisticated Pine Script tool designed to detect Supply Imbalance Flow (SIFs) - areas where institutional trading has created imbalances in supply and demand. This v9.17-enhanced-controls-tooltips version includes comprehensive user experience improvements, enhanced controls, and advanced display logic built on the v9.13 performance foundation.

### Key Capabilities
- **4 Gap Source Types**: Fair Value Gaps (FVG), Implied FVGs, Volume Imbalances, True Gaps
- **🆕 Enhanced Controls & Tooltips**: Comprehensive inline help and explanations (v9.17)
- **🆕 Special Properties Menu**: Consolidated advanced SIF designations (v9.16+)
- **🆕 Professional Notation**: SIF⁺/SIF⁻ superscript notation throughout (v9.16+)
- **🆕 Immediate SIF Inversion**: Detection for formation candles that also close gaps (v9.15+)
- **🆕 Multi-Source Highlighting**: Enhanced borders for confluence zones (v9.14+)
- **Advanced Performance**: 20-25% reduction in memory usage and processing time (v9.13 base)
- **Smart Display Logic**: FVGs invisible when alone, visible when mixed with other types
- **Separate Limits System**: Independent control for valid vs invalidated SIF counts
- **Fibonacci Projections**: Complete projection system with all major levels
- **Wick Analysis**: Dominance ratio analysis with tier classifications

---

## Architecture Overview

### Core Components
```
SIF DETECTION ENGINE
├── Gap Source Detection (4 types)
│   ├── Fair Value Gaps (Standard 3-candle)
│   ├── Implied FVGs (Displacement validated)
│   ├── Volume Imbalances (2-candle body gaps)
│   └── True Gaps (Classic price gaps)
├── SIF Behavior Analysis
│   ├── Inclusion (Wick toward body direction)
│   └── Reflection (Wick away from body direction)
├── Display & Labeling System
│   ├── Special FVG Logic (invisible/visible)
│   ├── Extension Boxes with Breakdowns
│   └── Projection System
└── Performance Management
    ├── Optimized Array Limits
    ├── Smart Visual Updates
    └── Historical Backfill Control
```

### Visual Limits (v9.13)
```pine
INDICATOR_MAX_BOXES = 500    // Maximum boxes on chart
INDICATOR_MAX_LABELS = 500   // Maximum labels on chart  
INDICATOR_MAX_LINES = 500    // Maximum lines on chart
```

---

## Performance Optimizations (v9.13)

### Array Size Reductions
| Constant | v9.12 | v9.13 | Reduction | Impact |
|----------|--------|--------|-----------|---------|
| `MAX_SIF_RECORDS` | 75 | 60 | 20% | Faster iteration through SIF history |
| `MAX_BODY_HIGHLIGHTS` | 100 | 75 | 25% | Lower memory usage for body highlights |
| `MAX_WICK_HIGHLIGHTS` | 100 | 75 | 25% | Lower memory usage for wick highlights |
| `MAX_EXTENDED_BOXES` | 100 | 75 | 25% | Lower memory usage for extensions |
| `SUPER_SIF_SCAN_LIMIT` | 20 | 15 | 25% | Faster super SIF scanning |
| `HISTORICAL_LOOKBACK_LIMIT` | 100 | 75 | 25% | Faster breach processing |

### Performance Flags
```pine
ENABLE_HISTORICAL_BACKFILL = false      // Disable for faster loading
ENABLE_SMART_VISUAL_UPDATES = true      // Enable optimized rendering
```

### Memory Management
- **Separate Limits System**: Independent tracking of valid vs invalidated SIFs
- **Smart Array Pruning**: Automatic removal of oldest entries when limits exceeded
- **Conditional Processing**: Skip expensive calculations when features disabled

### Capacity Modes (v9.23 update)
- **Optimized**: Respects user-configured display limits and baseline array caps for balanced performance.
- **Boost**: Applies the `BOOST_MULTIPLIER` constant (2× base) for a clean doubling of valid-count and retention ceilings without overwhelming the chart.
- **Ultra Boost**: Uses `ULTRA_BOOST_MULTIPLIER` (4× base) to unlock deeper history while staying within comfortable visual limits.
- **Ultra Pro Boost**: Leverages `ULTRA_PRO_BOOST_MULTIPLIER` (6× base) with automatic clamping against `INDICATOR_MAX_*` so the script never exceeds platform object caps.
- **Future Scaling**: Because the multipliers are centralized constants, expanding or tuning these modes now only requires editing the shared multiplier values rather than every downstream calculation.

---

## 🆕 Immediate SIF Inversion System (v9.15)

The immediate SIF inversion system detects rare instances where the formation candle both creates a SIF and immediately begins closing the source gap.

### Core Detection Logic
```pinescript
// Immediate inversion occurs when:
// 1. Formation candle creates a SIF from source gap
// 2. Same candle's body begins filling the source gap
// 3. Indicates potential quick reversal or failed institutional move
```

### Visual Marking
- **Symbol Options**: Configurable ☆ star or `[IMM]` tag applied to candle labels and tooltips
- **Example**: "SIF+ (fvg) ↓inc ☆" (star) or "SIF+ (fvg) ↓inc [IMM]" (text) indicates immediate inversion
- **Border Priority**: 3px borders take precedence over multi-source borders
- **Specialized Alerts**: Dedicated alert conditions available

### Trading Implications
- **Higher Risk**: Immediate inversions may indicate failed institutional moves
- **Quick Reversals**: Often followed by rapid price movement in opposite direction
- **Confluence Zones**: More significant when combined with multiple gap sources

---

## 🆕 Multi-Source Highlighting System (v9.14)

Enhanced detection and visualization of SIFs created from multiple gap sources, indicating higher probability confluence zones. v9.23 adds configurable "STRONG" tagging for the highest-confidence multi-source clusters.

### Detection Criteria
```pinescript
// Multi-source SIF requires:
// 2 or more gap contributions on the same candle (distinct or same type)
// Default: 2 sources minimum, distinct types enabled, identical types optional
// Examples: FVG + Volume Imbalance, Implied + True Gap + FVG, Vol×3 (if enabled)
```

### Visual Enhancement
- **Border Enhancement**: 2px orange borders around extension boxes
- **Label Integration**: Multi-source breakdowns in candle labels
- **Filter Options**: 
  - All SIFs (no filtering)
  - Single-Source Only
  - Multi-Source Only

### Border Priority System (v9.17)
```
1. Immediate SIF Inversion (3px) - Highest Priority
2. Multi-Source (2px) - Medium Priority
3. Default (1px) - Standard Priority
```

### STRONG Multi-Source Tag (v9.23)
- **Purpose**: Highlight confluence zones that exceed the configurable multi-source strength threshold.
- **Controls**:
  - `Label Tag` / `Extension Tag`: independent toggles for candle and extension displays.
  - `Min Sources`: minimum combined sources (default 2; supports up to 10).
  - `Distinct Types` / `Same Type`: decide whether mixed-only, repeated-only, or both qualify.
  - `Extension Placement`: choose whether `[STRONG]` renders above or below the extension label (candle labels always place `[STRONG]` after ☆ and before status markers).
- **Order of Appearance**:
  - Candle labels: `… ☆ → [STRONG] → [BREACHED] → [X]`.
  - Extensions: `[STRONG]` line placement depends on the Extension Placement setting.
- **Alerts**: Dedicated Strong SIF⁺ / SIF⁻ grouped alerts supersede traditional multi-source alerts when fired, with individual alertcondition support.

---

## 🆕 Special Properties Menu (v9.16)

Consolidated menu section for advanced SIF designations and special detection features.

### Included Features
- **Immediate SIF Inversion Controls**: Off/Star/Border/Star+Border with symbol selector (☆ or `[IMM]`)
- **Multi-Source Highlighting**: Enhanced borders for confluence zones
- **Nested SIF Markers**: ✔️ checkmarks for overlapping same-direction SIFs
- **Wick Dominance Markers**: Color-coded stars for significant wick-to-body ratios
- **Professional Notation**: SIF⁺/SIF⁻ superscript throughout interface

### Menu Organization Benefits
- **Logical Grouping**: Related advanced features in one location
- **Enhanced Tooltips**: Comprehensive explanations for each feature
- **Improved UX**: Cleaner main menu with advanced options consolidated

---

## Constants Architecture (v9.17)

### Enhanced Constants System (40+ constants)
Complete standardization expanded with professional notation and enhanced controls:

```pine
// Detection Group
INPUT_LABEL_MAX_VALID_SIFS = 'Max Valid SIFs'
INPUT_LABEL_MAX_INVALIDATED_SIFS = 'Max Invalidated SIFs'
INPUT_LABEL_SHOW_INVALIDATED_SIFS = 'Show Invalidated SIFs'
INPUT_LABEL_INVALIDATION_THRESHOLD = 'Invalidation Threshold'

// SIF Labelling Group  
INPUT_LABEL_LABEL_STYLE = 'Label Style'
INPUT_LABEL_VALID_SIF = 'Valid SIF'
INPUT_LABEL_INVALIDATED_SIF = 'Invalidated SIF'
INPUT_LABEL_SIF_PLUS = 'SIF+'
INPUT_LABEL_SIF_MINUS = 'SIF-'

// Extension Group
INPUT_LABEL_EXTENSION_MODE = 'Extension Mode'
INPUT_LABEL_ENABLE_EXTENSION = 'Enable Extension'
INPUT_LABEL_EXTENSION_BARS = 'No. of Bars'

// And 15+ more...
```

### Two-Constant FVG Display System
```pine
GAP_SOURCE_FVG_DISPLAY = ""                    // Invisible for clean displays
GAP_SOURCE_FVG_BREAKDOWN_DISPLAY = "fvg"       // Visible for breakdown displays
```

### UI Group Constants
```pine
GROUP_DETECTION = '🎯 Detection'
GROUP_SIF_LABELLING = '🎨 SIF Labelling (Type, Size & Color)'
GROUP_SIF_EXTENSION = '✨ SIF Extension'
GROUP_GAP_SOURCES = '🎯 Gap Sources'
GROUP_SIF_BEHAVIORS = '🎭 SIF Behaviors'
GROUP_SIF_ANALYSIS = '🔍 SIF Analysis'
GROUP_PROJECTIONS = '📈 Projections'
```

### Fibonacci Constants (Now Used in Arrays)
```pine
FIBONACCI_CENTER = 0.5                  // 50% center level
FIBONACCI_QUARTER_LOW = 0.25            // 25% level  
FIBONACCI_QUARTER_HIGH = 0.75           // 75% level
FIBONACCI_STOP_125 = 1.25               // 125% stop level
FIBONACCI_TARGET_233 = -2.33            // -233% target level
FIBONACCI_TARGET_400 = -4.0             // -400% target level
```

### 🆕 Professional Notation Constants (v9.16)
```pine
// Professional Superscript Notation
SIF_PLUS = "SIF⁺"                      // Replaces "SIF+"
SIF_MINUS = "SIF⁻"                     // Replaces "SIF-"
IMMEDIATE_SIF_INVERSION_SYMBOL = "☆"    // Star suffix for immediate inversions
CHECKMARK_SYMBOL = "✔️ "               // Nested SIF marker
```

### 🆕 Enhanced Visual Constants (v9.17)
```pine
// Border Width Constants
SINGLE_SOURCE_SIF_BORDER_WIDTH = 1
MULTI_SOURCE_SIF_BORDER_WIDTH = 2
IMMEDIATE_SIF_INVERSION_BORDER_WIDTH = 3

// UI Group Constants (Updated)
GROUP_SIF_SPECIAL_PROPERTIES = '🏷️ SIF Special Properties'  // v9.16+ consolidated menu
GROUP_SIF_BEHAVIORS = '🎭 SIF Wick Behaviors'              // v9.17 renamed for clarity
```

---

## Label Display Logic (CRITICAL)

### Special FVG Logic
FVGs have unique display behavior to maintain clean charts while providing detailed breakdowns when needed.

#### Rules:
1. **Single FVG Alone**: INVISIBLE (clean "SIF+" display)
2. **Single FVG Mixed**: VISIBLE (shows "fvg" in breakdown)  
3. **Multiple FVGs**: VISIBLE (shows "fvg×2", etc.)

### Candle Label Examples

#### Single Gap Types
```
1 FVG only:        "SIF+"           (clean - FVG invisible)
1 Implied only:    "SIF+ (imp)"     (implied always visible)
1 Volume only:     "SIF+ (vol)"     (volume always visible)
1 True Gap only:   "SIF+ (gap)"     (true gap always visible)
```

#### Multiple Same Types  
```
2 FVGs only:       "SIF+ (fvg×2)"   (FVG visible with multiplier)
2 Implied only:    "SIF+ (imp×2)"   (implied with multiplier)  
3 Volumes only:    "SIF+ (vol×3)"   (volume with multiplier)
2 True Gaps only:  "SIF+ (gap×2)"   (true gap with multiplier)
```

#### Mixed Types
```
1 FVG + 1 Vol:           "SIF+ (fvg, vol)"         (FVG becomes visible)
1 FVG + 1 Imp:           "SIF+ (fvg, imp)"         (FVG becomes visible)
2 FVG + 1 Vol:           "SIF+ (fvg×2, vol)"       (multiplier + mixed)
1 FVG + 2 Vol:           "SIF+ (fvg, vol×2)"       (mixed + multiplier)
1 FVG + 1 Imp + 1 Vol:   "SIF+ (fvg, imp, vol)"   (three types)
2 FVG + 1 Imp + 2 Vol:   "SIF+ (fvg×2, imp, vol×2)" (complex mixed)

All four types:
1 FVG + 1 Imp + 1 Vol + 1 Gap: "SIF+ (fvg, imp, vol, gap)"
```

### Extension Box Label Examples

#### Single Gap Types
```
1 FVG only:        ""              (empty - invisible extension)
1 Implied only:    "imp"            (simple display)
1 Volume only:     "vol"            (simple display) 
2 FVGs only:       "fvg×2"          (FVG visible with multiplier)
3 Implied only:    "imp×3"          (implied with multiplier)
```

#### Mixed Types (Show Count + Breakdown)
```
1 FVG + 1 Vol:           "2: fvg, vol"         (total count: breakdown)
1 FVG + 1 Imp:           "2: fvg, imp"         (FVG visible when mixed)
2 FVG + 1 Vol:           "3: fvg×2, vol"       (count: multipliers)
1 FVG + 2 Vol:           "3: fvg, vol×2"       (count: mixed multipliers)
1 FVG + 1 Imp + 1 Vol:   "3: fvg, imp, vol"   (count: three types)
2 FVG + 1 Imp + 2 Vol:   "5: fvg×2, imp, vol×2" (count: complex)

Complex example:
3 FVG + 2 Imp + 1 Vol + 1 Gap: "7: fvg×3, imp×2, vol, gap"
```

### Algorithm Implementation
```pine
// SPECIAL FVG LOGIC: FVGs are invisible when alone, visible when mixed
if fvg_count > 0
    types_present_count = (fvg_count > 0 ? 1 : 0) + (imp_count > 0 ? 1 : 0) + (vol_count > 0 ? 1 : 0) + (true_count > 0 ? 1 : 0)
    if fvg_count == 1 and types_present_count == 1
        // Single FVG alone: INVISIBLE - don't add to parts array
        na  
    else if fvg_count == 1
        // Single FVG mixed: show "fvg"
        array.push(parts, GAP_SOURCE_FVG_BREAKDOWN_DISPLAY)
    else
        // Multiple FVGs: show "fvg×2", "fvg×3", etc.
        array.push(parts, GAP_SOURCE_FVG_BREAKDOWN_DISPLAY + MULTIPLIER_SYMBOL + str.tostring(fvg_count))
```

---

## Gap Source Detection

### 1. Fair Value Gaps (FVG)
**Standard 3-candle institutional gaps - the foundation of SIF detection**

#### Detection Logic:
```pine
// Bullish FVG: Current low > High 2 bars ago
is_bullish_fvg() => low > high[2]

// Bearish FVG: Current high < Low 2 bars ago  
is_bearish_fvg() => high < low[2]
```

#### Characteristics:
- Most common gap type in institutional trading
- Strong indication of order flow imbalance
- Foundation for SIF formation

### 2. Implied FVGs
**3-candle institutional gaps with displacement validation**

#### Detection Requirements:
- Standard FVG pattern present
- Displacement validation: C2 body size must exceed recent average
- Configurable displacement multiplier (default 1.5x)
- Lookback period for averaging (default 4 candles)

#### Configuration:
```pine
displacement_multiplier = 1.5    // C2 body vs recent average
lookback_candles = 4            // Bars to average for comparison
```

### 3. Volume Imbalances  
**2-candle retail body gaps indicating supply/demand imbalance**

#### Detection Logic:
- Gap between candle bodies (not full ranges)
- Typically smaller than FVGs but still significant
- Often precede larger institutional moves

### 4. True Gaps
**Classic price gaps between complete candle ranges**

#### Characteristics:
- Most obvious gap type
- Complete separation between high/low ranges
- Often occur at market open or major news events

---

## SIF Behaviors & Classification

### Inclusion vs Reflection
SIFs are classified by wick behavior relative to body direction:

#### Inclusion (Wick toward body direction)
- **Bullish SIF**: Lower wick extends toward gap below
- **Bearish SIF**: Upper wick extends toward gap above
- **Interpretation**: Price seeking liquidity in gap direction

#### Reflection (Wick away from body direction)  
- **Bullish SIF**: Upper wick extends away from gap below
- **Bearish SIF**: Lower wick extends away from gap above
- **Interpretation**: Price rejecting gap area, showing strength

### Nested Subtypes
Complex SIF classifications for mixed gap sources:

```pine
SUBTYPE_IMPLIED_INCLUSION = "implied_inclusion"
SUBTYPE_IMPLIED_REFLECTION = "implied_reflection"  
SUBTYPE_VOLUME_INCLUSION = "volume_inclusion"
SUBTYPE_VOLUME_REFLECTION = "volume_reflection"
SUBTYPE_TRUE_INCLUSION = "true_inclusion"
SUBTYPE_TRUE_REFLECTION = "true_reflection"
```

### Super SIF Detection
SIFs overlapping with same-direction SIFs are marked with ✔️ checkmark:
- Indicates confluence of multiple institutional areas
- Higher probability setups
- Enhanced by nested gap detection

---

## Separate Limits System

### Independent Controls
```pine
MAX_VALID_SIFS_LIMIT = 52         // 87.5% ratio (matches MBZ)
MAX_INVALIDATED_SIFS_LIMIT = 22   // 37.5% ratio (matches MBZ)

DEFAULT_MAX_VALID_SIFS = 20       // Default valid SIFs shown
DEFAULT_MAX_INVALIDATED_SIFS = 5  // Default invalidated SIFs shown
```

### Benefits:
- **Chart Cleanliness**: Control visual clutter independently
- **Historical Analysis**: Keep invalidated SIFs for context
- **Performance**: Limit processing load while maintaining insight
- **Flexibility**: Different ratios for different trading styles

### Usage Scenarios:
```
Scalping:     Valid: 10, Invalidated: 2   (clean, recent focus)
Day Trading:  Valid: 20, Invalidated: 5   (balanced view)
Swing:        Valid: 35, Invalidated: 15  (historical context)
Analysis:     Valid: 52, Invalidated: 22  (maximum detail)
```

---

## Breach Detection System

### Methods
1. **Trade Through**: Any price movement into zone (wicks + bodies)
2. **Body Breach**: Only when candle body enters zone

### Invalidation Modes
```pine
INVALIDATION_STRICT = "Strict (55%)"      // More sensitive
INVALIDATION_LENIENT = "Lenient (85%)"    // Less sensitive  
INVALIDATION_CUSTOM = "Custom"            // User-defined threshold
```

### Threshold Behavior:
- **[BREACHED]** appears immediately when threshold exceeded
- **[X]** appears after candle closes with confirmation
- Separate breach vs invalidation allows for nuanced interpretation

---

## Extension & Projection Systems

### Extension Modes
```pine
EXTENSION_FIXED = "Fixed Length"           // Extend N bars from formation
EXTENSION_TO_CURRENT = "To Current Price"  // Extend to current bar minimum  
EXTENSION_BEYOND_CURRENT = "Beyond Current Price"  // Extend N bars beyond current
```

### Fibonacci Projection Levels
Complete projection system with all major Fibonacci levels:

#### Boundaries (Core Levels)
```pine
0 (close) - Bottom of SIF zone
1 (open)  - Top of SIF zone
```

#### Center Level  
```pine  
0.5 (50%) - Equilibrium level
```

#### Quarter Levels
```pine
0.25 (25%) - Lower quarter
0.75 (75%) - Upper quarter  
```

#### Stop Levels (Beyond Open)
```pine
1.25 (125%) - First stop level
1.5  (150%) - Second stop level
2.0  (200%) - Major stop level
```

#### Target Levels (Beyond Close)
```pine
-2.33 (-233%) - Primary target
-2.5  (-250%) - Secondary target
-4.0  (-400%) - Extended target
-4.5  (-450%) - Maximum target
```

### Custom Levels
User-configurable projection levels with comma-separated input:
```
Default: "0, 1, 1.5, -2.33, -4"
Advanced: "0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2.0, -2.33, -2.5, -4.0, -4.5"
```

---

## Wick-to-Body Ratio Analysis

### Tier Classifications
- **Standard**: ≥100% wick dominance (wick ≥ body size)
- **Relaxed**: ≥85% wick dominance  
- **Risky**: ≥80% wick dominance
- **None**: Below 80% (filtered out)

### Visual Indicators
Color-coded stars mark SIFs with significant wick dominance:
- **Blue Star**: Standard tier (≥100%)
- **Black Star**: Relaxed tier (≥85%)  
- **Orange Star**: Risky tier (≥80%)

### Interpretation:
- Higher wick dominance = stronger rejection/attraction
- Standard tier most reliable for trade decisions
- Risky tier requires additional confirmation

---

## Configuration Groups & Settings

### 🎯 Detection
- **Separate Limits**: Independent valid vs invalidated controls
- **Invalidation Threshold**: Strict (55%) vs Lenient (85%) vs Custom
- **Custom Percentage**: 1-99% user-defined threshold

### 🎯 Directional Filter  
- **Show SIF+**: Enable bullish SIFs
- **Show SIF-**: Enable bearish SIFs

### 🚨 Breach Detection
- **Method**: Trade Through vs Body Breach
- **Threshold %**: Percentage of zone fill for breach alert
- **Visual Response**: Fade boxes, change colors, show alternative text
- **Breach Lines**: Configurable lines at breach levels
- **Invalidation Lines**: Configurable lines at invalidation levels

### 🎨 SIF Labelling  
- **Label Style**: Arrow Only, Text Only, Arrow + Text
- **Size Controls**: Separate sizes for valid vs invalidated SIFs
- **Color Controls**: Bullish, bearish, and invalidated colors
- **Enable Labels**: Master control for candle labels

### ✨ SIF Extension
- **Extension Mode**: Fixed Length, To Current Price, Beyond Current Price
- **Extension Bars**: Number of bars for extension
- **Colors**: Separate bullish/bearish extension colors
- **Enable Extension**: Master control for extension boxes

### 🎯 Gap Sources
- **Fair Value Gaps**: Standard 3-candle FVGs
- **Implied FVGs**: Displacement-validated institutional gaps
- **Volume Imbalances**: 2-candle body gaps
- **True Gaps**: Classic price gaps

### 🎭 SIF Behaviors
- **Inclusion**: Wick toward body direction
- **Reflection**: Wick away from body direction

### 🔍 SIF Analysis  
- **Nested SIFs**: Mark overlapping same-direction SIFs with ✔️
- **Show Label Details**: Display source types and behaviors in labels

### ⚙️ Source Settings
- **Displacement Multiplier**: For Implied FVG validation (1.0-5.0)
- **Lookback Candles**: Bars for displacement comparison (3-5)

### ⭐ Wick-to-Body Ratio Analysis
- **Tier Colors**: Standard (blue), Relaxed (black), Risky (orange)
- **Star Size**: Size of wick dominance markers
- **Enable Markers**: Master control for wick dominance stars

### 📦 Source Gap
- **Max Boxes**: Maximum source gap boxes (1-50)
- **Enable Gaps**: Show boxes for gaps that created SIFs
- **Label Size/Color**: Source gap label formatting

### 📈 Projections
- **Project Last N**: Number of recent SIFs to project (1-20)
- **Enable Projections**: Master control for projection system
- **Projection Bars**: Bars to extend projections (5-100)
- **Line Settings**: Width, style, label side (fixed 1-bar label offset; color/size inputs use blank titles for compact UI)
- **Level Controls**: 
  - Boundaries (0, 1)
  - Center (0.5) 
  - Quadrants (0.25, 0.75)
  - Stops (1.25, 1.5, 2.0)
  - Targets (-2.33, -2.5, -4, -4.5)
  - Custom Levels (user-defined)

---

## Technical Implementation

### Data Structures
```pine
// Gap metadata cached during detection
type GapData
    int bar_index
    float top
    float bottom
    bool is_bullish
    bool is_inverted
    int creation_bar
    SIFCandidate first_tapper
    int gap_id
    string gap_type

// Core SIF record with cached visuals
type SIFRecord
    int bar_index
    float sif_open
    float sif_close
    float sif_high
    float sif_low
    bool is_bullish
    bool is_invalidated
    float max_fill_percentage
    bool has_dominant_wick
    string sif_subtype
    string cached_label_text
    string cached_tooltip
    float cached_zone_top
    float cached_zone_bottom
    bool cached_data_valid
    label sif_label
    int source_gap_id
    int source_gap_bar_index
    float source_gap_top
    float source_gap_bottom
    string source_gap_type
    bool is_super_sif
    float overlap_percentage
    int overlapping_sif_bar_index
    bool is_immediate_sif_inversion

// Consolidated grouping for per-candle rendering
type ConsolidatedSIF
    array<SIFRecord> sif_group
    int bar_index
    bool is_bullish
    float consolidated_zone_top
    float consolidated_zone_bottom
    bool is_consolidated_breached
    bool is_consolidated_invalidated
    string consolidated_candle_label
    string consolidated_extension_label

// Multi-source aggregation cache powering STRONG logic
type SourceTypeStats
    int group_size
    int distinct_types
    int fvg_count
    int imp_count
    int vol_count
    int true_count
    int rdrb_count
```

### Memory Management
```pine
// Performance-optimized limits
MAX_SIF_RECORDS = 60           // SIF history (20% reduction)
MAX_EXTENDED_BOXES = 75        // Extension boxes (25% reduction)
MAX_BODY_HIGHLIGHTS = 75       // Body highlights (25% reduction)  
MAX_WICK_HIGHLIGHTS = 75       // Wick highlights (25% reduction)
```

### Processing Flow
1. **Gap Detection**: Scan for all 4 gap types
2. **SIF Validation**: Check wick criteria and behaviors  
3. **Consolidation**: Group overlapping SIFs
4. **Classification**: Apply subtypes and strength analysis
5. **Display Logic**: Apply FVG visibility rules
6. **Extension/Projection**: Create visual elements
7. **Breach Monitoring**: Track invalidation status

---

## Performance Features

### Smart Visual Updates
```pine
ENABLE_SMART_VISUAL_UPDATES = true    // Optimized rendering
ENABLE_HISTORICAL_BACKFILL = false    // Skip historical processing
```

### Conditional Processing
- Skip expensive calculations when features disabled
- Lazy evaluation of complex display logic
- Efficient array management with automatic pruning

### Memory Optimization
- 20-25% reduction in array sizes
- Separate tracking pools for valid vs invalidated
- Smart cleanup of expired visual elements

---

## Usage Guidelines

### Day Trading Setup
```
Timeframe: 1m, 5m
Valid SIFs: 15-25
Invalidated SIFs: 3-5
Extension Mode: To Current Price  
Breach Method: Trade Through
Invalidation: Strict (55%)
```

### Swing Trading Setup  
```
Timeframe: 1H, 4H, 1D
Valid SIFs: 30-45
Invalidated SIFs: 10-15  
Extension Mode: Fixed Length (20-30 bars)
Breach Method: Body Breach
Invalidation: Lenient (85%)
```

### Signal Interpretation

#### Strong SIF Signals
- Super SIF (✔️ checkmark)
- Standard wick dominance (blue star)
- Multiple gap sources (fvg×2, vol)
- Clean extension without breaches

#### Weak SIF Signals  
- Single risky tier wick (orange star)
- Already breached ([BREACHED])
- Mixed conflicting gap types
- Low wick-to-body ratio

### Best Practices
1. **Confluence**: Look for multiple SIFs in same area
2. **Wick Quality**: Prioritize standard tier dominance
3. **Gap Variety**: Mixed gap types often stronger than single type
4. **Historical Context**: Use invalidated SIFs for market structure
5. **Timeframe Alignment**: Higher timeframe SIFs more significant

---

## Troubleshooting

### Performance Issues
**Symptom**: Slow chart loading, lag during updates
**Solutions**:
- Reduce valid SIF limit (15-25 for active trading)
- Disable historical backfill (default in v9.13)
- Turn off unused features (projections, source gaps)
- Use Body Breach instead of Trade Through

### Visual Issues
**Symptom**: Missing labels, incorrect displays
**Solutions**:
- Check FVG display logic (single FVG should show clean "SIF+")
- Verify extension mode setting
- Ensure label size not set to invisible
- Check directional filter settings

### Detection Issues  
**Symptom**: Missing SIFs, false positives
**Solutions**:
- Adjust displacement multiplier for Implied FVGs
- Review wick tier requirements
- Check gap source enables (FVG, Implied, Volume, True)
- Verify invalidation threshold settings

### Common Configuration Errors
1. **All Gap Sources Disabled**: Enable at least FVG for basic detection
2. **Extreme Thresholds**: Custom invalidation <10% or >95% problematic  
3. **Too Many Visuals**: High limits + projections + source gaps = performance issues
4. **Conflicting Settings**: Body Breach with very low thresholds creates noise

---

## Version History & Changelog

### 🆕 v9.23-multi-source-strength
**Major Changes:**
- STRONG multi-source tagging for candle labels and extension boxes
- Configurable strength threshold (min sources + distinct/same-type toggles)
- Dedicated Strong SIF alerts with grouped-alert priority
- Special Properties menu reorganization for STRONG controls
- Ultra Pro Boost capacity mode with constantized multipliers for future scaling

**User Experience Improvements:**
- Candle labels automatically insert `[STRONG]` after ☆ and before status markers
- Extension placement control keeps `[STRONG]` readable in tight layouts
- Tooltips clarify when STRONG applies and how filters interact with gap enables
- Capacity mode tooltips now document Optimized → Ultra Pro tiers and reference shared multiplier constants

### 🆕 v9.17-enhanced-controls-tooltips
**Major Changes:**
- Enhanced border controls with individual width specifications
- Comprehensive tooltips with inline help and explanations  
- Menu reorganization for improved logical flow
- SIF Wick Behaviors renamed for consistency with MBZ
- Cross-pollination of applicable MBZ v9.17 enhancements

**User Experience Improvements:**
- Group tooltips with detailed feature explanations
- Max limit information clearly displayed (e.g., "Max: 52")
- Enhanced inline help with bullet points and examples
- Feature interaction explanations for better understanding

### v9.16-special-properties
**Major Changes:**
- Professional superscript notation (SIF⁺/SIF⁻) throughout interface
- Special Properties menu consolidation for advanced designations
- Enhanced immediate SIF inversion with dropdown options
- Immediate SIF border priority system implementation
- Enhanced label details moved to SIF Labelling section

### v9.15-immediate-sif-inversion
**Major Changes:**
- Immediate SIF inversion detection system
- ☆ symbol marking for formation candles that also close gaps
- Specialized alert conditions for immediate inversions
- Enhanced risk warnings for quick reversal scenarios

### v9.14-multi-source-highlighting
**Major Changes:**
- Source filtering system (All/Single-Source/Multi-Source)
- Multi-source highlighting with 2px orange borders
- Enhanced confluence zone detection and visualization
- Automatic alerts for multi-source SIFs

### v9.13-performance-optimized (Foundation)
**Major Changes:**
- 20-25% performance improvements across all array operations
- Complete INPUT_LABEL constants architecture  
- Two-constant FVG display system
- Fibonacci constants properly implemented in arrays
- Smart visual updates and historical backfill control
- Separate limits system with MBZ ratio parity

**Performance Optimizations:**
- MAX_SIF_RECORDS: 75 → 60 (20% reduction)
- MAX_BODY_HIGHLIGHTS: 100 → 75 (25% reduction)
- MAX_WICK_HIGHLIGHTS: 100 → 75 (25% reduction)  
- MAX_EXTENDED_BOXES: 100 → 75 (25% reduction)
- SUPER_SIF_SCAN_LIMIT: 20 → 15 (25% reduction)
- HISTORICAL_LOOKBACK_LIMIT: 100 → 75 (25% reduction)

**Architecture Improvements:**
- 28+ INPUT_LABEL constants for full standardization
- GAP_SOURCE_FVG_BREAKDOWN_DISPLAY constant for semantic clarity
- Enhanced comments and documentation throughout codebase
- Proper Pine Script syntax compliance (fixed empty code blocks)

---

This comprehensive documentation serves as the definitive reference for the SIF Hunter° [Pro+] indicator as implemented in v9.23-multi-source-strength. It covers every aspect of the system architecture, from basic gap detection to advanced user experience enhancements, ensuring that both developers and traders can fully understand and utilize all features effectively.
