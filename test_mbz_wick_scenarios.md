# MBZ Deeper Wick Detection - Test Scenarios Analysis

## Current Logic Issues Identified:

### 🚨 **Major Bug: UNUSED PARAMETER**
- Function `check_mbz_wick_into_source_gap()` receives `mbz_is_bullish` but NEVER USES IT
- This means logic doesn't consider MBZ direction vs gap type

### 🚨 **Wrong Wick Analysis**
- Uses generic `mbz_low`/`mbz_high` instead of analyzing relevant formation wick
- Bullish inclusion MBZ = lower wick matters, but logic ignores behavior type

## Test Scenarios (20 Cases):

### **Bullish Gap Scenarios (Gap Above Price)**

**Scenario 1: Bullish Gap + Bullish MBZ (Inclusion)**
```
Gap: 100.0-100.5 (bullish gap above price)
Mitigating Candle [1]: H:99.8 L:99.2 (doesn't enter gap)
MBZ Candle [0]: H:101.2 L:99.9 O:100.0 C:101.0 (bullish inclusion)
Formation Wick: Lower wick to 99.9 (enters gap)
Expected: ◉ (MBZ lower wick entered, mitigating didn't)
Current Logic: mbz_low(99.9) <= gap.bottom(100.0) ✓ AND mitigating_low(99.2) <= gap.bottom(100.0) ✗
Result: ❌ NO DETECTION (Bug: requires both to enter)
```

**Scenario 2: Bullish Gap + Bullish MBZ (Reflection)**  
```
Gap: 102.0-102.5 (bullish gap above price)
Mitigating Candle [1]: H:101.8 L:101.0 (doesn't enter gap)
MBZ Candle [0]: H:103.0 L:101.5 O:101.8 C:102.2 (bullish reflection)
Formation Wick: Upper wick to 103.0 (goes through gap)
Expected: ◉ (MBZ upper wick went deeper than mitigating)
Current Logic: Only checks lows for bullish gaps, ignores upper wick
Result: ❌ MISSED (Bug: wrong wick analysis)
```

**Scenario 3: Bullish Gap + Both Enter, MBZ Deeper**
```
Gap: 100.0-100.8
Mitigating Candle [1]: H:100.3 L:99.8 (low enters slightly)
MBZ Candle [0]: H:101.0 L:99.5 (low enters deeper)
Expected: ◉ (MBZ went deeper: 99.5 < 99.8)
Current Logic: 99.5 <= 100.0 ✓ AND 99.8 <= 100.0 ✓, then 99.5 < 99.8 ✓
Result: ✅ CORRECT
```

**Scenario 4: Bullish Gap + Bearish MBZ (Should this even trigger?)**
```
Gap: 100.0-100.5 (bullish gap)
Mitigating Candle [1]: H:99.8 L:99.0
MBZ Candle [0]: H:100.2 L:99.2 O:100.0 C:99.5 (bearish MBZ)
Question: Does bearish MBZ from bullish gap make sense for deeper wick analysis?
Current Logic: Ignores MBZ direction entirely
Result: ❓ UNCLEAR SPECIFICATION
```

### **Bearish Gap Scenarios (Gap Below Price)**

**Scenario 5: Bearish Gap + Bearish MBZ (Inclusion)**
```
Gap: 98.0-98.5 (bearish gap below price)
Mitigating Candle [1]: H:99.2 L:99.0 (doesn't enter gap)
MBZ Candle [0]: H:98.8 L:97.5 O:98.2 C:97.8 (bearish inclusion)
Formation Wick: Upper wick to 98.8 (enters gap)
Expected: ◉ (MBZ upper wick entered, mitigating didn't)
Current Logic: mbz_high(98.8) >= gap.top(98.5) ✓ AND mitigating_high(99.2) >= gap.top(98.5) ✓
Then: 98.8 > 99.2? ✗ (Wrong direction!)
Result: ❌ BUG (Logic thinks higher is deeper for bearish gaps, but 98.8 is actually deeper into gap than 99.2)
```

**Scenario 6: Bearish Gap + Bearish MBZ (Reflection)**
```
Gap: 97.5-98.0 (bearish gap below price)  
Mitigating Candle [1]: H:99.0 L:98.8 (high doesn't enter gap)
MBZ Candle [0]: H:99.5 L:97.0 O:98.5 C:97.2 (bearish reflection)
Formation Wick: Lower wick to 97.0 (goes through gap)
Expected: ◉ (MBZ lower wick went deeper than mitigating)
Current Logic: Only checks highs for bearish gaps, ignores lower wick
Result: ❌ MISSED (Bug: wrong wick analysis)
```

### **Edge Cases**

**Scenario 7: Mitigating Candle is 2 bars ago**
```
Gap: 100.0-100.5
Candle [2]: H:100.2 L:99.8 (actual mitigating candle)
Candle [1]: H:99.9 L:99.7 (not the mitigating candle)
MBZ Candle [0]: H:101.0 L:99.6
Current Logic: Compares with [1], not actual mitigating candle [2]
Result: ❌ WRONG REFERENCE CANDLE
```

**Scenario 8: Gap Boundaries Wrong**
```
Gap object: top=100.5, bottom=100.0
Question: Is "entering gap" really <= bottom for bullish gaps?
Or should it be >= bottom and <= top?
Current Logic: mbz_low <= gap.bottom (100.0)
Real penetration: Should be mbz_low >= gap.bottom AND mbz_low <= gap.top?
Result: ❓ BOUNDARY LOGIC UNCLEAR
```

## **Summary of Bugs Found:**

1. **CRITICAL**: `mbz_is_bullish` parameter unused - logic doesn't adapt to MBZ behavior type
2. **CRITICAL**: Wrong penetration direction for bearish gaps (thinks 99.2 > 98.8 is "deeper")  
3. **MAJOR**: Wrong wick analysis - doesn't consider inclusion vs reflection behavior
4. **MAJOR**: Too restrictive - requires both candles to enter gap
5. **MEDIUM**: Wrong mitigating candle reference (assumes [1])
6. **MEDIUM**: Gap boundary logic unclear

## **Recommended Fixes:**

1. Consider MBZ behavior type (inclusion/reflection) to determine relevant wick
2. Fix bearish gap penetration logic (deeper = closer to gap center, not higher number)
3. Allow detection when only MBZ candle enters gap significantly  
4. Identify actual mitigating candle, not just previous one
5. Clarify gap boundary penetration rules