# MBZ Deeper Wick Logic - Final Test Against User Scenarios

## Understanding Gap Coordinates:

**Bullish FVG Example:**
- C1 (2 bars ago): OHLC = 99.5/99.9/99.4/99.7 (high = 99.9)
- C2 (1 bar ago): OHLC = 99.8/100.1/99.6/100.0 (transition)  
- C3 (current): OHLC = 100.3/100.8/100.2/100.6 (low = 100.2)

**Gap Structure:** high[2] < low → 99.9 < 100.2 ✓ (bullish FVG detected)
**Gap Coordinates:** 
```pine
GapData.new(..., low, high[2], true, ...)  // (top=100.2, bottom=99.9)
```

**Gap Closure:** Price goes DOWN to gap.bottom (99.9) to close

## Testing User's Scenarios:

### **Scenario 1: Bullish gap: mitigating wick = -2 ticks, MBZ wick = -5 ticks → Show ◉**

**Setup:**
- Gap: top=100.2, bottom=99.9 (bullish gap)
- Mitigating candle [1]: Wick goes -2 ticks from gap boundary
- MBZ candle [0]: Wick goes -5 ticks from gap boundary

**Question: Which boundary do the ticks measure from?**

**Interpretation A: From gap.top (100.2)**
- Mitigating wick: 100.2 - 0.02 = 100.18 (barely enters gap)
- MBZ wick: 100.2 - 0.05 = 100.15 (deeper into gap)
- Both are between gap.bottom (99.9) and gap.top (100.2) ✓

**Interpretation B: From gap.bottom (99.9)**  
- Mitigating wick: 99.9 - 0.02 = 99.88 (goes BELOW gap - doesn't make sense)
- MBZ wick: 99.9 - 0.05 = 99.85 (goes further below gap)

**Most Logical: Interpretation A (from gap.top)**

### **Current Logic Test:**

**Bullish Gap Logic:**
```pine
if gap.is_bullish
    mitigating_penetration = mitigating_high  // How high mitigating went
    mbz_penetration = mbz_high                // How high MBZ went
    
    if mbz_penetration >= gap.bottom and mitigating_penetration >= gap.bottom
        wicked_deeper_than_mitigating := mbz_penetration > mitigating_penetration
```

**Problem Found:** For bullish gaps, we're checking HIGHS but the scenario talks about wicks going DOWN into the gap!

### **The Real Issue:**

For a **bullish gap above current price level:**
- Gap coordinates: top=100.2, bottom=99.9  
- Current price around 99.5 (below gap)
- Wicks reach UP into gap (high values matter)
- Deeper penetration = higher high values ✓

But the user's scenario talks about **NEGATIVE ticks** going into a bullish gap, which suggests wicks going DOWN from some reference point.

## **Conclusion:**

I think the confusion is about **reference point for tick measurement**. Let me ask for clarification:

**User's Scenario:** "Bullish gap: mitigating wick = -2 ticks, MBZ wick = -5 ticks"

**Questions:**
1. What is the reference point for measuring ticks? (gap.top, gap.bottom, or current price?)
2. For a bullish gap, do wicks go UP into the gap or DOWN into the gap?
3. Does "bullish gap" mean a gap above current price or below current price?

**My Current Understanding:**
- Bullish FVG = gap left behind by bullish price move (gap above current price)  
- To test this gap, price must move UP
- Higher high values = deeper penetration into bullish gap
- Current logic should be correct for this interpretation

**But if user means:**
- Bullish gap = gap below current price that bullish move is testing
- Negative ticks = distance DOWN from current price level
- Then logic needs to be flipped to use LOW values for bullish gaps