# SIF Hunter° Architecture

## System Overview

SIF Hunter° implements a sophisticated institutional flow detection system built on proven gap analysis algorithms with MBZ-style hierarchy enforcement.

## 🏗️ **Core Architecture**

### **Detection Pipeline**
```
Raw Price Data → Gap Detection → Suppression Filter → SIF Formation → Visualization
```

1. **Price Analysis**: Multi-candle pattern recognition (2-3 candle structures)
2. **Gap Classification**: FVG, Implied FVG, True Gap, Volume Imbalance identification  
3. **Hierarchy Enforcement**: Institutional priority suppression (FVG > Implied > True > VI)
4. **SIF Formation**: Valid gaps converted to Smart Institutional Flow zones
5. **Visual Rendering**: Dynamic zones, labels, projections, and alerts

### **Data Flow Architecture**

```
Input Settings → Detection Functions → Gap Validation → Array Management → Visual Output
     ↓                ↓                    ↓               ↓                ↓
- Gap Sources    - is_bullish_fvg()   - Coordinate     - active_gaps    - Zones
- Thresholds     - is_bearish_fvg()     Validation     - sif_records    - Labels  
- Display        - detect_implied()   - Suppression    - Visual Arrays  - Alerts
- Colors         - detect_vi()          Check                            - Extensions
```

## 📊 **Component Architecture**

### **1. Gap Detection Layer**
**Purpose**: Identify institutional and retail gap patterns
- **FVG Detection**: 3-candle fair value gap patterns (C0.low > C2.high)
- **Implied FVG**: Displacement-validated institutional gaps with wick overlap
- **True Gap Detection**: Classic 2-candle price gaps (C1.high < C0.low)
- **Volume Imbalance**: Body-separated gaps with wick connection

### **2. Suppression Engine** 
**Purpose**: Enforce institutional priority hierarchy
- **Targeted Suppression**: Gap-type specific rules (no percentage thresholds)
- **Spatial Overlap**: Mathematical intersection detection
- **Priority Enforcement**: FVG > Implied FVG > True Gap > Volume Imbalance
- **Direction Matching**: Same-direction gap conflict resolution

### **3. SIF Formation System**
**Purpose**: Convert validated gaps to institutional flow zones  
- **Wick Dominance Analysis**: Standard/Relaxed/Risky classification
- **Zone Calculation**: Dynamic top/bottom boundaries with projection
- **Strength Assessment**: Normal vs Super SIF designation
- **Invalidation Tracking**: Fill percentage and breach detection

### **4. Visualization Engine**
**Purpose**: Render institutional flow zones and alerts
- **Dynamic Zones**: Color-coded gap visualization with transparency
- **Label System**: Gap type identification and strength indicators
- **Fibonacci Projections**: Extended zone forecasting
- **Real-time Alerts**: SIF formation and breach notifications

## 🔄 **Processing Flow**

### **Main Detection Loop** (Per Bar Confirmation)
```pinescript
if barstate.isconfirmed
    1. Check gap sources (FVG, Implied, True, VI)
    2. Validate coordinates (TOP > BOTTOM enforcement)
    3. Apply suppression filter (hierarchy enforcement)  
    4. Create SIF record if gap survives
    5. Update visual elements
    6. Process invalidations and breaches
    7. Trigger alerts if applicable
```

### **Gap Lifecycle**
```
Detection → Validation → Suppression Check → SIF Creation → Zone Rendering → Invalidation Tracking
```

## 💾 **Memory Architecture**

### **Primary Data Structures**
- **`active_gaps`**: Array<GapData> - Currently valid gaps (max 100)
- **`sif_records`**: Array<SIFRecord> - Formed SIF zones (max 75) 
- **Visual Arrays**: Separate arrays for boxes, labels, lines, projections

### **Memory Management**
- **FIFO Cleanup**: Oldest entries removed when limits exceeded
- **Visual Element Deletion**: Proper cleanup before array removal
- **Performance Optimization**: Named constants for all size limits

## 🛡️ **Error Prevention Architecture**

### **Coordinate Validation System**
```pinescript
// Critical validation at gap creation
coordinates_valid = gap_top > gap_bottom and not na(gap_top) and not na(gap_bottom)
// Prevents MBZ v7.1-v7.4 style coordinate reversal bugs
```

### **Suppression Safety**
```pinescript
// Targeted suppression prevents over-suppression
// FVGs and Implied FVGs: NEVER suppressed (institutional priority)
// True Gaps: Only suppressed by FVG/Implied  
// Volume Imbalances: Suppressed by all higher priority types
```

## ⚡ **Performance Architecture**

### **Optimization Strategies**
1. **Early Exit Patterns**: Skip processing when conditions not met
2. **Efficient Loops**: Minimal iteration with break conditions
3. **Array Size Limits**: Prevent unlimited growth
4. **Visual Cleanup**: Regular deletion of expired elements
5. **Conditional Processing**: Only run detection when sources enabled

### **Resource Management**
```pinescript
MAX_ACTIVE_GAPS = 100    // Gap tracking limit
MAX_SIF_RECORDS = 75     // SIF history limit  
DEFAULT_TRANSPARENCY = 80 // Visual performance
```

## 🔧 **Configuration Architecture**

### **Input Organization**
- **🎯 Detection**: Core gap sources and thresholds
- **⚙️ Source Settings**: Per-gap-type configuration
- **🎨 Visual**: Colors, transparency, display modes
- **🚨 Alerts**: Formation and breach notifications
- **📊 Advanced**: Fibonacci, projections, debug options

### **Hierarchical Settings**
```
Global Settings → Gap Type Settings → Visual Settings → Alert Settings
```

## 🚀 **Extension Architecture**

### **Modular Design**
- **Gap Detection**: Easily add new gap types
- **Suppression Rules**: Configurable hierarchy enforcement
- **Visual Elements**: Pluggable rendering components
- **Alert System**: Extensible notification framework

### **Development Workflow**
```
Stable Version → Development Branch → Testing → Integration → Production
```

---

## 📈 **Scalability Features**

- **Multi-timeframe Support**: Works across all timeframes
- **Asset Agnostic**: Functions on all tradeable instruments  
- **Performance Optimized**: Handles high-frequency data efficiently
- **Memory Efficient**: Bounded resource usage with cleanup

## 🔍 **Debugging Architecture**

- **Comprehensive Logging**: Gap formation and suppression tracking
- **Visual Debugging**: Color-coded gap type identification
- **Alert Integration**: Real-time formation notifications
- **Version Tracking**: Complete change documentation

---

**Architecture Benefits**:
- ✅ **Reliability**: Proven MBZ algorithms with bug fixes applied
- ✅ **Performance**: Optimized for real-time trading analysis  
- ✅ **Maintainability**: Clean separation of concerns with documentation
- ✅ **Extensibility**: Modular design supports future enhancements