# MBZ Hunter° [Pro+] Technical Documentation

## Version: v8.7-minimal-boundary-fix (Final Development)

This documentation provides comprehensive technical details for the MBZ Hunter° indicator, including architecture, gap detection logic, suppression mechanisms, and development guidelines.

## 📚 Documentation Structure

### Core Documentation
- **[Architecture Overview](./01-architecture.md)** - High-level system design and data flow
- **[Gap Detection System](./02-gap-detection.md)** - Complete gap type detection logic
- **[MBZ Formation Logic](./03-mbz-formation.md)** - How MBZs are created from gaps
- **[Suppression Mechanisms](./04-suppression.md)** - Gap hierarchy and overlap handling

### Reference Documentation  
- **[Data Structures](./05-data-structures.md)** - All types, enums, and data models
- **[Function Reference](./06-function-reference.md)** - Complete API documentation
- **[Configuration Guide](./07-configuration.md)** - Input parameters and settings
- **[Visual Elements](./08-visual-elements.md)** - Display and styling system

### Development Documentation
- **[Development Guide](./09-development.md)** - Coding standards and best practices  
- **[Troubleshooting](./10-troubleshooting.md)** - Common issues and debugging
- **[Version History](./11-version-history.md)** - Detailed changelog and bug fixes
- **[Testing Guide](./12-testing.md)** - How to validate functionality

## 🎯 Quick Reference

### Gap Type Priority Hierarchy
1. **FVGs** (Fair Value Gaps) - Highest institutional priority
2. **Implied FVGs** - High institutional priority  
3. **True Gaps** - Medium priority (classic price gaps)
4. **Volume Imbalances** - Lowest priority (retail patterns)

### Final Fix in v8.7-minimal-boundary-fix
- ✅ **Surgical precision** - Changed only 4 boundary operators (`</>` → `<=/>= `)
- ✅ **Zero complexity** - Built on stable v8.0-final with no other modifications  
- ✅ **Universal solution** - Resolves all reported overlap detection cases
- ✅ **Production ready** - Minimal, tested, and stable implementation

### Key Functions
- `is_bullish_fvg()` / `is_bearish_fvg()` - FVG detection
- `is_vi_suppressed_by_gaps()` - VI suppression logic  
- `is_true_gap_suppressed_by_gaps()` - True Gap suppression logic
- `classify_mbz_subtype()` - MBZ classification system
- **`detect_mbz_strength()`** - SUPER MBZ nested detection (v8.1 reflection fix)
- **`get_mbz_subtype_zone()`** - Zone boundary calculation for all MBZ subtypes

## 🚀 Getting Started

1. Read the [Architecture Overview](./01-architecture.md) for system understanding
2. Study [Gap Detection System](./02-gap-detection.md) for core logic
3. Review [Development Guide](./09-development.md) before making changes
4. Use [Function Reference](./06-function-reference.md) for API details

## ⚠️ Important Notes

- **Always increment version number** in both indicator title and comment when making changes
- **Test against v7.0-gaps behavior** to ensure no regressions  
- **FVG coordinates are critical** - bullish uses `low` → `high[2]`, bearish uses `low[2]` → `high`
- **Gap suppression is directional** - only same-direction gaps suppress each other

## 📞 Support

For technical questions or bug reports related to this documentation, reference the specific document and version number.

---
*Last Updated: 2025-08-29 | Version: v7.5-final*