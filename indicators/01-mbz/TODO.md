# MBZ Hunter° Development TODO

## Pending Changes to Port from Development to Stable

### Recently Completed in Development Version (Need to Port)
- [x] **Named Constants Implementation** - All magic numbers replaced with descriptive constants
- [x] **Comprehensive Function Documentation** - Added @function, @description, @param, @returns format
- [x] **Complex Algorithm Documentation** - Detailed explanations for gap detection and suppression logic
- [x] **Inline Comments for Coordinate Calculations** - Mathematical formulas and overlap detection explained
- [x] **Array Size Limits with Named Constants** - Replaced hardcoded limits with MAX_* constants
- [x] **Fibonacci Projection Constants** - Replaced hardcoded values with FIBONACCI_* constants
- [x] **Displacement Multiplier Named Constant** - Updated input to use DEFAULT_DISPLACEMENT_MULTIPLIER

### Current Status
- **Development Version**: `/code/development/mbz-dev.pine` - Contains all improvements
- **Stable Version**: `/code/stable/mbz-7.5-final.pine` - Currently synced (last sync: 2025-08-29)

### Next Action Items
- [ ] **No immediate porting needed** - Both versions currently identical
- [ ] **Future workflow**: Modify dev version first, then port to stable when tested

---

## Future Development Priorities

### Potential Enhancements (Not Started)
- [ ] **Performance optimizations** - Review array cleanup efficiency
- [ ] **Enhanced MBZ classification** - Additional subtype detection
- [ ] **Advanced projection features** - Extended Fibonacci levels
- [ ] **User interface improvements** - Input organization refinements
- [ ] **Testing framework** - Automated validation system

### Code Quality Improvements (Ongoing)
- [ ] **Unit testing implementation** - Prevent coordinate reversal bugs
- [ ] **Error handling enhancement** - Graceful degradation patterns  
- [ ] **Code structure optimization** - Function organization review
- [ ] **Performance monitoring** - Array size tracking utilities

---

## Bug Watch List

### Critical Patterns to Monitor
- [ ] **Coordinate reversal** - Always verify top > bottom in gap creation
- [ ] **Suppression logic** - Ensure hierarchy (FVG > Implied > True > VI) maintained
- [ ] **Array bounds** - Monitor for size limit violations
- [ ] **Memory leaks** - Visual element cleanup verification

### Version Control Reminders
- [ ] **Always increment version** - Update both title and bottom comment
- [ ] **Document changes** - Clear descriptions in version comments
- [ ] **Test against baseline** - Compare with v7.0-gaps behavior when needed
- [ ] **Regression testing** - Verify no broken functionality

---

## Recent Bug Fix History (Reference)
- ✅ **v7.5-final**: Fixed FVG coordinate reversal bug (missing MBZs on candles 18, 20, 36)
- ✅ **v7.5-final**: Added True Gap suppression to VI hierarchy
- ✅ **v7.5-final**: Restored complete gap hierarchy system
- ✅ **Documentation**: Added comprehensive internal code documentation

---

**Last Updated**: 2025-08-29  
**Current Stable Version**: v7.5-final  
**Current Dev Status**: Synced with stable (ready for new development)