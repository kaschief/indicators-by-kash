# SIF Hunter° Documentation

**Smart Institutional Flow (SIF) Detection System**

## Overview

SIF Hunter° is an advanced Pine Script indicator that detects institutional trading patterns through gap analysis and smart institutional flow recognition. Built on proven gap detection algorithms with MBZ-style hierarchy enforcement.

## 🎯 **Core Functionality**

SIF identifies and tracks institutional trading activity through:
- **Fair Value Gaps (FVGs)**: 3-candle institutional imbalances
- **Implied FVGs**: Displacement-validated institutional gaps  
- **True Gaps**: Classic 2-candle price gaps
- **Volume Imbalances**: Body-separated retail gaps with wick overlap

## 📊 **Key Features**

### **Smart Institutional Flow Detection**
- Multi-timeframe gap analysis
- Wick dominance classification (Standard/Relaxed/Risky)
- Institutional vs retail gap hierarchy
- Targeted suppression system (no arbitrary percentage thresholds)

### **Advanced Visualization**
- Color-coded gap zones and projections
- Dynamic labels with gap type identification
- Fibonacci projection levels
- Invalidation tracking and alerts

### **Risk Management**
- Configurable invalidation thresholds (Strict 55% / Lenient 85%)
- Breach confirmation modes (Distance/Time/Hybrid)
- Super SIF strength indicators
- Real-time alert system

## 🔧 **Technical Architecture**

Built with:
- **MBZ-proven suppression logic** (v8.5+ coordinate fix applied)
- **Named constants** for all thresholds and limits
- **Comprehensive validation** preventing coordinate reversal bugs
- **Performance-optimized arrays** with proper cleanup patterns

## 📖 **Documentation Structure**

1. **[Architecture Overview](01-architecture.md)** - System design and data flow
2. **[Gap Detection Logic](02-gap-detection.md)** - Core algorithms and patterns  
3. **[Suppression System](03-suppression.md)** - Hierarchy enforcement rules
4. **[Data Structures](04-data-structures.md)** - Types, constants, and arrays
5. **[Function Reference](05-function-reference.md)** - Complete API documentation
6. **[Development Guide](06-development.md)** - Coding standards and workflow
7. **[Version History](07-version-history.md)** - Change log and bug fixes

## 🚨 **Critical Fixes Applied**

### **v8.5-coordinate-fix (2025-08-29)**
- **FIXED**: Critical bearish FVG coordinate reversal bug (same as MBZ v7.1-v7.4)
- **ADDED**: Comprehensive coordinate validation documentation
- **REPLACED**: Dangerous 80% overlap threshold with MBZ-proven targeted suppression

### **v8.6-medium-docs**  
- **ADDED**: Complete gap hierarchy documentation
- **ADDED**: C1, C2, C3 candle relationship explanations
- **ADDED**: Spatial overlap mathematics documentation

## ⚡ **Quick Start**

1. **Current Stable**: `/code/stable/sif-[version].pine`
2. **Load Settings**: Recommended configuration in development guide
3. **Key Alerts**: SIF+ (bullish) and SIF- (bearish) formations
4. **Invalidation**: Monitor for breach confirmations and zone fills

## 🛡️ **Bug Prevention**

SIF includes comprehensive validation to prevent:
- **Coordinate reversal bugs** (TOP > BOTTOM enforcement)
- **Over-suppression issues** (targeted hierarchy vs percentage thresholds)  
- **Memory leaks** (proper array cleanup with size limits)
- **Performance degradation** (optimized detection algorithms)

---

**Last Updated**: 2025-09-08  
**Current Version**: v9.18-dual-alert-system  
**Status**: Production Ready with Comprehensive Documentation  
**Compatibility**: Pine Script v6

Additional docs:
- [Dual Alert System](sif-dual-alert-system.md)
