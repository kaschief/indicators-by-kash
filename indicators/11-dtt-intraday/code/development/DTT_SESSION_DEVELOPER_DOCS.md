# DTT Session Indicator - Developer Documentation

**⚠️ MUST READ BEFORE MODIFYING CODE ⚠️**

This documentation explains the business expectations, critical implementation details, and common pitfalls for maintaining the DTT Session indicator.

**READ THIS CAREFULLY** before making any modifications to prevent breaking functionality.

---

## 1. BUSINESS REQUIREMENTS & EXPECTATIONS

### 1.1 CRITICAL: Session High/Low Accuracy Across ALL Timeframes
- Session highs and lows MUST match EXACTLY across all supported timeframes (1m, 2m, 3m, 4m, 5m)
- This indicator has been verified against third-party DTT indicators to ensure 100% accuracy
- ANY discrepancy in session highs/lows across timeframes is considered a CRITICAL BUG
- Test case: The session high/low on a 1-minute chart MUST match the session high/low on a 5-minute chart

### 1.2 Exclusive Use of 1-Minute Intrabar Data
- ALL session high/low tracking MUST use 1-minute intrabar data via `request.security_lower_tf()`
- This ensures consistent results regardless of the chart's timeframe
- Never use the current bar's high/low directly without filtering through 1-minute data

### 1.3 Midnight-Wrapping Sessions
- Several sessions cross midnight boundaries (Nagasaki: 23:04-03:00, Turncoat: 03:00-03:44)
- These sessions MUST work correctly on all timeframes
- Midnight wrapping requires special handling in time calculations (see section 2.4)

### 1.4 Timeframe Support
- Indicator supports ONLY: 1m, 2m, 3m, 4m, 5m timeframes
- Runtime error is thrown for timeframes > 5 minutes (line 319)
- DO NOT extend to higher timeframes without extensive testing and approval

### 1.5 DTT Cycle Structure
- 15 sessions per 24-hour cycle (cascade order)
- Sessions must start/end at precise times defined in TIME_* constants
- Each session references the previous session's high/low for pattern detection
- Cascade order: Damasu → Osaka → Kyoto → Nagasaki → Turncoat → Bishop → Knight → Big Ben → NY Open → Judas → Model 11 → Model 110 → Lunch → Model 1001 → Model 111 → [repeats]

---

## 2. CRITICAL IMPLEMENTATION DETAILS

### 2.1 Session Initialization with Extreme Values (Line 500)

**WHY:** Sessions are initialized with `session_high = -1e10` and `session_low = 1e10`

**PURPOSE:** Ensures that the FIRST 1-minute bar's data will ALWAYS overwrite these values

**CRITICAL:** Do NOT change these initialization values

**REASONING:**
- Using `na` would require special handling in comparison logic
- Using `0` would fail for negative prices (forex) or cause incorrect comparisons
- Extreme values guarantee first real data point becomes the initial high/low

**CODE LOCATION:** Line 500 in session creation

**DO NOT:** Initialize with `na`, `0`, or any realistic price values

### 2.2 1-Minute Bar Filtering Within Session Time Range (Lines 620-659)

**WHY:** Not all 1-minute bars from `request.security_lower_tf()` belong to the session

**PROBLEM:** On a 5-minute bar at 09:55 (covering 09:55-10:00), if session ends at 09:57, bars at 09:58-09:59 would be incorrectly included without filtering

**SOLUTION:** Each 1-minute bar's timestamp is checked against session time range

**CRITICAL CHECKS:**
- Convert 1-min bar timestamp to minutes since midnight (lines 629-632)
- Adjust for midnight wrapping if needed (lines 639-640)
- Use INCLUSIVE boundary checking: `one_min_minutes >= start AND one_min_minutes <= end` (line 644)

**BOUNDARY INCLUSIVENESS:**
- Session ending at 09:01 includes the ENTIRE 09:01 minute (09:01:00 to 09:01:59)
- This is why we use `<=` instead of `<` for the end boundary

**DO NOT:** Remove or modify this filtering logic without extensive testing

### 2.3 time_in_bar_range() Function - ROOT CAUSE FIX (Lines 366-400)

**WHY:** Determines if a specific HHMM time falls within the current bar's time range

**CRITICAL FOR:** Session start/end detection across different timeframes

**ROOT CAUSE FIX (Lines 385-388):**

**PROBLEM:** Nagasaki/Turncoat had NO highs/lows on 3-minute charts

**CAUSE:** When checking if session end time (e.g., 03:00) falls within a 3-min bar at 03:00, target time was adjusted for midnight wrapping (+1440) but bar times were NOT

**EXAMPLE:**
- Session ends at 03:00 (180 minutes)
- `target_minutes`: 180 → 1620 (adjusted for midnight wrap)
- `bar_start_minutes`: 180 (NOT adjusted) ❌
- `bar_end_minutes`: 183 (NOT adjusted) ❌
- Check: `1620 >= 180 and 1620 < 183` = FALSE (session end not detected!)

**FIX:** Also adjust bar times when target wraps midnight AND bar is in early morning (<720 min)

**DO NOT:** Modify this function without testing ALL midnight-wrapping sessions on ALL timeframes

### 2.4 Local Variable Copies to Prevent Mutation (Lines 591-602)

**WHY:** Each session calculation needs independent copies of bar time variables

**PROBLEM:** Multiple sessions are checked in a loop, and adjusting bar times for one session would affect subsequent sessions without local copies

**EXAMPLE:**
- Bar at 03:00 on 3-minute chart
- First iteration (Nagasaki): Adjusts `bar_start_minutes` from 180 to 1620
- Second iteration (Turncoat): Would see ALREADY-ADJUSTED value 1620 instead of 180 ❌

**SOLUTION:** Create local copies (`check_bar_start_minutes`, `check_bar_end_minutes`) for each session

**CRITICAL:** Lines 591-592 create local copies BEFORE any modifications

**DO NOT:** Reuse time variables across loop iterations without copying

### 2.5 Midnight Wrapping Handling Strategy

**DETECTION:** Session wraps midnight if `sess.start_time > sess.end_time` (e.g., 2304 > 300)

**ADJUSTMENT:** Add 1440 minutes (24 hours) to times after midnight (lines 596, 383, 640)

**RULES:**
- Times before noon (< 720 minutes) in midnight-wrapping sessions are treated as "next day"
- This converts 03:00 (180) to 27:00 (1620) for proper mathematical comparison
- Both target times AND bar times must be adjusted consistently

**LOCATIONS:**
- Session time range calculation: Lines 594-602
- Target time adjustment: Lines 382-388
- 1-minute bar adjustment: Lines 639-640

### 2.6 Session Boundary Inclusiveness

**START:** INCLUSIVE (session starting at 09:30 includes the bar at 09:30:00)

**END:** INCLUSIVE (session ending at 09:01 includes bars from 09:01:00 to 09:01:59)

**IMPLEMENTATION:**
- Use `>=` for start boundary: `one_min_minutes >= sess_start_minutes`
- Use `<=` for end boundary: `one_min_minutes <= sess_end_minutes`
- CRITICAL: Line 644 uses `<=` not `<` for end boundary

**RATIONALE:** A session ending at 09:01 means "up to and including 09:01", not "up to 09:00:59"

### 2.7 Time Range Overlap Detection (Lines 604-618)

**PURPOSE:** Determines if a bar (which covers a TIME RANGE) overlaps with a session

**COMPLEXITY:** Handles multiple edge cases:
- Bar crosses midnight but session doesn't
- Session crosses midnight but bar doesn't
- Both cross midnight
- Neither crosses midnight

**LOGIC:** Uses range intersection math: `NOT (bar_end <= sess_start OR bar_start > sess_end)`

**CRITICAL:** This logic was carefully developed and tested - do not modify without full understanding

### 2.8 Root Price Capture (Lines 685-746)

**PURPOSE:** Captures equilibrium price at specific moment within session

**METHOD:** Uses exact 1-minute bar matching root time

**⚠️ CRITICAL - ROOT TIMES ARE SACRED ⚠️:**
- **NEVER** change root time constants (lines 97-111)
- Root times are based on **YEARS OF STUDY** and intensive research
- These times have been proven through extensive market analysis
- Changing them will **BREAK** the indicator's effectiveness
- Root times may INTENTIONALLY occur BEFORE their session starts

**IMPORTANT DESIGN:** Some sessions have roots that occur BEFORE the session starts
- Example: Model 111 starts at 14:09 but root is at 13:30 (39 minutes earlier)
- Example: Judas starts at 09:55 but root is at 09:53 (2 minutes earlier)
- This is INTENTIONAL based on market dynamics
- Sessions are pre-created when their root time is reached (lines 484-496)
- This allows root capture even when session hasn't officially started

**STORED VALUES:**
- `root_high`: 1-minute bar's high at root time
- `root_low`: 1-minute bar's low at root time
- `root_price`: (root_high + root_low) / 2.0 (equilibrium)
- `root_timestamp`: Actual timestamp of the captured 1-minute bar

**DO NOT:**
- Change root time constants
- Use current bar's high/low or interpolate values
- Assume roots must fall within their session time range

### 2.9 Session Pre-Creation and Visual Element Drawing (Lines 509-543, 574-577, 599-605)

**⚠️ CRITICAL BUG FIXED - LINES MUST DRAW AT SESSION START, NOT ROOT TIME ⚠️**

**PROBLEM:** When sessions are pre-created for root capture (before session officially starts), visual elements (boundary lines, high/low lines) were being drawn at the ROOT TIME instead of the SESSION START TIME.

**EXAMPLES OF THE BUG:**
- Judas: Boundary line appeared at 09:53 (root) instead of 09:55 (session start)
- Model 111: High/low lines appeared at 13:30 (root) instead of 14:09 (session start)
- Result: Double lines, incorrect session marking

**ROOT CAUSE:** During session creation, if root time was reached, the session was created immediately and lines were drawn using `time` variable, which equaled the root time, not the session start time.

**THE FIX - TWO-PHASE APPROACH:**

**Phase 1 - Pre-Creation at Root Time (Line 541):**
- `session_start_timestamp = na` (indicates pre-creation)
- Session object created with `start_timestamp = na`
- **NO boundary lines drawn** (Line 574: `if show_boundaries and not na(session_start_timestamp)`)
- **NO high/low lines drawn** (Line 599: `if show_pool_lines ... and not na(session_start_timestamp)`)
- Root price captured when root time bar is processed

**Phase 2 - Official Start at Session Start Time (Lines 509-543):**
- When session start time is reached, update `sess.start_timestamp := time` (Line 513)
- **NOW draw start boundary line** at current time (Lines 515-517)
- **NOW draw high/low lines** at current time (Lines 519-541)
- All visual elements use the ACTUAL session start time, not root time

**CRITICAL CODE LOCATIONS:**

**Line 541:** Set `session_start_timestamp = na` during pre-creation
```pine
session_start_timestamp = session_should_start ? time : na
```

**Lines 509-543:** Update session when it officially starts
```pine
if session_exists and session_should_start and existing_session_index >= 0
    sess = array.get(session_instances, existing_session_index)
    if na(sess.start_timestamp)
        sess.start_timestamp := time
        // Draw start boundary line now
        if show_boundaries
            sess.start_boundary_line := line.new(time, 1e10, time, -1e6, ...)
        // Draw high/low lines now
        if show_pool_lines
            // ... calculate end_timestamp ...
            sess.pool_high_line := line.new(time, prev_high, end_timestamp, ...)
            sess.pool_low_line := line.new(time, prev_low, end_timestamp, ...)
```

**Lines 574-577:** Prevent boundary line drawing during pre-creation
```pine
if show_boundaries and not na(session_start_timestamp)
    curr_sess.start_boundary_line := line.new(session_start_timestamp, ...)
```

**Lines 599-605:** Prevent high/low line drawing during pre-creation
```pine
if show_pool_lines and not na(prev_high) and not na(prev_low) and not na(session_start_timestamp)
    curr_sess.pool_high_line := line.new(session_start_timestamp, ...)
    curr_sess.pool_low_line := line.new(session_start_timestamp, ...)
```

**VERIFICATION:**
- Judas: NO lines at 09:53, ALL lines at 09:55 ✓
- Model 111: NO lines at 13:30, ALL lines at 14:09 ✓
- Model 1001: ALL lines at 12:35 ✓ (root and start are same time)
- NY Open: ALL lines at 09:30 ✓ (root and start are same time)

**DO NOT:**
- Remove `not na(session_start_timestamp)` checks from line drawing conditions
- Draw visual elements during session pre-creation
- Use `time` variable directly when session may be pre-created - use `session_start_timestamp` or wait for official start
- Assume session creation time equals session start time

**REMEMBER:** Visual elements (boundaries, high/low lines) must ONLY appear at session START times, never at root times, even though root capture happens earlier.

---

## 3. COMMON PITFALLS & HOW TO AVOID THEM

### 3.1 PITFALL: Changing Session Initialization Values

❌ **WRONG:** `new_sess = DttSession.new(..., 0, 999999, ...)`

❌ **WRONG:** `new_sess = DttSession.new(..., na, na, ...)`

✅ **CORRECT:** `new_sess = DttSession.new(..., -1e10, 1e10, ...)`

**WHY:** See section 2.1

### 3.2 PITFALL: Removing 1-Minute Bar Filtering

❌ **WRONG:** Using all 1-minute bars from `request.security_lower_tf()` without filtering

✅ **CORRECT:** Filter each 1-minute bar by checking if it falls within session time range

**WHY:** See section 2.2

**TEST:** Verify on 5-minute chart that session highs/lows match 1-minute chart

### 3.3 PITFALL: Not Testing Midnight-Wrapping Sessions

❌ **WRONG:** Only testing Damasu, Osaka, NY Open, etc. (non-wrapping sessions)

✅ **CORRECT:** ALWAYS test Nagasaki and Turncoat on 3-minute and 5-minute charts

**WHY:** Midnight wrapping is the most complex edge case and most likely to break

**REQUIREMENT:** Nagasaki and Turncoat MUST show highs/lows on ALL timeframes (1m-5m)

### 3.4 PITFALL: Using < Instead of <= for Session End Boundary

❌ **WRONG:** `is_in_session_range = one_min_minutes >= start and one_min_minutes < end`

✅ **CORRECT:** `is_in_session_range = one_min_minutes >= start and one_min_minutes <= end`

**WHY:** Session ending at 09:01 should include entire minute 09:01:00-09:01:59

**IMPACT:** Would exclude final minute of every session, causing incorrect highs/lows

### 3.5 PITFALL: Modifying time_in_bar_range() Without Understanding

**DANGER:** This function is the ROOT CAUSE fix for midnight-wrapping session bugs

**CRITICAL SECTION:** Lines 385-388 (bar time adjustment)

**BEFORE MODIFYING:**
1. Understand the Nagasaki/Turncoat bug that was fixed (see section 2.3)
2. Test on 3-minute chart with Nagasaki session (23:04-03:00)
3. Verify session end at 03:00 is detected correctly

**TEST CASE:** 3-minute bar at 03:00 must detect Nagasaki session end

### 3.6 PITFALL: Not Using Local Variable Copies in Loops

❌ **WRONG:** Directly modifying `bar_start_minutes` in session loop

✅ **CORRECT:** Create local copies (`check_bar_start_minutes`) for each session iteration

**WHY:** See section 2.4

**SYMPTOM:** First session works correctly, but subsequent sessions show incorrect values

### 3.7 PITFALL: Inconsistent Midnight Adjustment

❌ **WRONG:** Adjusting target time but not bar time (or vice versa)

✅ **CORRECT:** Both must be adjusted consistently using same logic

**LOCATIONS TO CHECK:**
- Line 383: Target time adjustment
- Lines 386-388: Bar time adjustment (MUST match target adjustment conditions)
- Lines 599-602: Session calculation bar time adjustment
- Lines 639-640: 1-minute bar time adjustment

### 3.8 PITFALL: Testing Only on 1-Minute Chart

❌ **WRONG:** "It works on 1-minute, ship it!"

✅ **CORRECT:** Test on ALL supported timeframes (1m, 2m, 3m, 4m, 5m)

**WHY:** Bugs often only appear on higher timeframes due to time range calculations

**CRITICAL TEST:** Compare session highs/lows across all timeframes - they MUST match

### 3.9 PITFALL: Changing Root Time Constants

❌ **WRONG:** Adjusting root times to "make more sense" or align with session starts

❌ **WRONG:** Changing root times based on personal preference or logic

✅ **CORRECT:** **NEVER EVER CHANGE ROOT TIMES** - they are sacred constants

**WHY:** Root times are based on years of intensive market research and study

**CONSEQUENCES:**
- Changing root times will break the indicator's effectiveness
- Years of backtesting and validation will be invalidated
- The indicator will no longer match reference DTT analysis

**EXAMPLES OF INTENTIONAL DESIGN:**
- Model 111 root at 13:30 comes 39 minutes BEFORE session starts at 14:09
- Judas root at 09:53 comes 2 minutes BEFORE session starts at 09:55
- These are NOT bugs - they're intentional based on market dynamics
- Do NOT "fix" these by moving roots to align with session starts

**REMEMBER:** If root times seem unusual or "wrong", they're not - they're based on extensive research

### 3.10 PITFALL: Drawing Visual Elements at Root Time Instead of Session Start Time

❌ **WRONG:** Drawing boundary/high/low lines when session is created (which may be at root time)

❌ **WRONG:** Using `time` variable for line drawing without checking if session is pre-created

❌ **WRONG:** Removing `not na(session_start_timestamp)` checks from line drawing conditions

✅ **CORRECT:** Only draw visual elements when session OFFICIALLY starts, not when pre-created for root capture

**WHY:** Sessions can be pre-created before they start (for root capture), but lines should only appear at session start

**SYMPTOMS:**
- Double boundary lines (one at root time, one at session start time)
- High/low lines appearing too early (e.g., Judas lines at 09:53 instead of 09:55)
- Confusion about when sessions actually start

**THE FIX:**
- Use `session_start_timestamp = na` during pre-creation (Line 541)
- Add `not na(session_start_timestamp)` check before drawing lines (Lines 574, 599)
- Draw lines when session officially starts in Phase 2 (Lines 515-541)

**CRITICAL CHECKS:**
- Line 574: Boundary line drawing must check `not na(session_start_timestamp)`
- Line 599: High/low line drawing must check `not na(session_start_timestamp)`
- Lines 515-541: Visual elements drawn when pre-created session officially starts

**TEST CASES:**
- Judas: Lines must appear at 09:55, NOT at 09:53 (root time)
- Model 111: Lines must appear at 14:09, NOT at 13:30 (root time)

**SEE:** Section 2.9 for comprehensive explanation of the two-phase approach

---

## 4. ARCHITECTURE DECISIONS & RATIONALE

### 4.1 Why request.security_lower_tf() Instead of Current Bar Data

**DECISION:** Use 1-minute intrabar data for ALL high/low tracking

**RATIONALE:**
- Ensures consistency across all timeframes
- Current bar on 5-minute chart doesn't capture intrabar price action
- Matches behavior of third-party DTT indicators used as reference

**TRADEOFF:** Slightly higher computational cost, but accuracy is non-negotiable

### 4.2 Why Mathematical Time Range Checking Instead of time() Functions

**DECISION:** Convert times to "minutes since midnight" for range calculations

**RATIONALE:**
- More reliable than string-based time comparisons
- Easier to handle midnight wrapping with +1440 adjustment
- Explicit control over inclusiveness of boundaries

**ALTERNATIVE CONSIDERED:** Using PineScript's `time()` with session strings - rejected due to complexity

### 4.3 Why Extreme Values (-1e10, 1e10) for Initialization

**DECISION:** Use impossible price values instead of `na`

**RATIONALE:**
- Simpler comparison logic (no need for `na()` checks)
- Guaranteed to be overwritten by first real price
- Works for all asset types (stocks, forex, crypto)

**ALTERNATIVE CONSIDERED:** Using `na` and adding `na()` checks - rejected due to code complexity

### 4.4 Why Cascade Order Matters

**DECISION:** Sessions are defined in strict cascade order

**RATIONALE:**
- Each session's pattern detection depends on PREVIOUS session's high/low
- Model 111 is followed by Damasu (wraps to next day)
- Breaking cascade order breaks pattern detection logic

**CRITICAL:** Never reorder session templates array (lines 302-316)

### 4.5 Why Two-Stage Pattern Detection (Immediate vs Standard/Delayed)

**DECISION:** Check IMMEDIATE on breach bar, check STD/DEL one bar after breach

**RATIONALE:**
- IMMEDIATE pattern = breach and reversal happen on same bar
- STANDARD/DELAYED = breach on one bar, reversal confirmation on next bar
- Must wait one bar to determine if STD/DEL conditions are met

**IMPLEMENTATION:** Lines 854-888 (immediate), lines 909-1005 (standard/delayed)

### 4.6 Why Session Labels Are Centered

**DECISION:** Labels appear at midpoint between session start and end (line 565)

**RATIONALE:**
- Better visual clarity - labels don't cluster at boundaries
- Easier to identify which session you're looking at
- User feedback: "names are off they should be in the middle"

**CALCULATION:** `session_midpoint_timestamp = math.round((start + end) / 2)`

### 4.7 Why Root Times Can Occur Before Session Starts

**DECISION:** Root times are independent of session boundaries and based on market research

**RATIONALE:**
- Root times represent key equilibrium moments in market structure
- These moments are determined by years of market study and backtesting
- The optimal root capture time may occur before the "official" session starts
- Examples:
  - Model 111 root at 13:30 captures key price level 39 minutes before session starts at 14:09
  - Judas root at 09:53 captures equilibrium 2 minutes before session starts at 09:55

**IMPLEMENTATION:**
- Sessions are pre-created when their root time is reached (lines 484-496)
- This allows root capture even if session hasn't officially started
- Root times are NEVER adjusted to fit within session boundaries

**ALTERNATIVE CONSIDERED:** Forcing roots to be within session time range - rejected because it would invalidate years of research

**CRITICAL:** Root times are based on empirical market data, not logical constraints

---

## 5. TESTING REQUIREMENTS

### 5.1 MANDATORY: Test on ALL Timeframes

**REQUIREMENT:** Any code change MUST be tested on: 1m, 2m, 3m, 4m, 5m

**VERIFICATION:** Session highs/lows must match across all timeframes

**METHOD:**
1. Load indicator on 1-minute chart
2. Record session high/low for Osaka (or any session)
3. Switch to 3-minute chart
4. Verify session high/low for Osaka EXACTLY matches 1-minute chart
5. Repeat for all timeframes

### 5.2 MANDATORY: Test Midnight-Wrapping Sessions

**REQUIREMENT:** Nagasaki (23:04-03:00) and Turncoat (03:00-03:44) MUST show highs/lows

**CRITICAL:** These sessions are most likely to break with time calculation changes

**VERIFICATION:**
- Nagasaki session MUST show session high and low on 3-minute chart
- Turncoat session MUST show session high and low on 3-minute chart
- Lines connecting highs/lows must appear (not na)

**FAILURE SYMPTOM:** "no nagastic still has NO highs and lows on 3 min"

### 5.3 MANDATORY: Verify Against Third-Party DTT Indicator

**REQUIREMENT:** Compare session highs/lows against reference DTT indicator

**PURPOSE:** This indicator was developed to match existing DTT analysis tools

**METHOD:**
1. Load this indicator and reference indicator on same chart
2. Compare session high/low values
3. Values must match EXACTLY (not approximately)

**FAILURE:** Any discrepancy indicates a bug in high/low tracking

### 5.4 MANDATORY: Test Session Boundaries Alignment

**REQUIREMENT:** Session start/end boundaries must align with specified times

**VERIFICATION:**
- Osaka starts at 19:01 (not 19:00 or 19:02)
- Nagasaki ends at 03:00 (not 03:01)
- Boundaries must align on all timeframes

**METHOD:** Enable "Session Boundaries" toggle and verify visual alignment

### 5.5 OPTIONAL: Test Pattern Detection

**SCOPE:** IMM/STD/DEL pattern detection (if `enable_pattern_detection = true`)

**VERIFICATION:**
- Patterns only appear when previous session high/low is breached
- Pattern labels show correct session name
- Candle highlighting works when patterns form

**NOTE:** Pattern detection depends on accurate session high/low tracking (see 5.1-5.3)

### 5.6 Edge Cases to Test

- Bar exactly at session boundary (e.g., bar at 09:30 when session starts at 09:30)
- Session ending on last minute of hour (e.g., 09:59-10:00)
- Very short sessions (Judas: 09:55-10:20, only 25 minutes)
- Very long sessions (Model 111: 14:09-18:00, ~4 hours)
- 24/7 assets (crypto) vs weekday-only assets (stocks)

---

## 6. MODIFICATION CHECKLIST

Before committing ANY changes to this file, verify:

- [ ] 1. Session highs/lows match across all timeframes (1m, 2m, 3m, 4m, 5m)
- [ ] 2. Nagasaki session shows highs/lows on 3-minute chart
- [ ] 3. Turncoat session shows highs/lows on 3-minute chart
- [ ] 4. Session boundaries align with specified times
- [ ] 5. Session labels appear centered in sessions
- [ ] 6. No extreme values (-1e10, 1e10) were changed
- [ ] 7. **⚠️ ROOT TIME CONSTANTS WERE NOT MODIFIED (lines 97-111) - CRITICAL!**
- [ ] 8. Root prices display correctly (including Model 111 at 13:30, Judas at 09:53)
- [ ] 9. 1-minute bar filtering logic is intact (lines 620-659)
- [ ] 10. time_in_bar_range() function preserves bar time adjustment (lines 385-388)
- [ ] 11. Local variable copies are used in session loops (lines 591-592)
- [ ] 12. Session end boundary uses <= not < (line 644)
- [ ] 13. Midnight wrapping adjustment is consistent across all locations
- [ ] 14. Cascade order of session templates is preserved (lines 302-316)
- [ ] 15. Values match third-party DTT indicator
- [ ] 16. Code compiles without errors
- [ ] 17. All toggles work correctly (boundaries, labels, root prices)
- [ ] 18. **⚠️ Visual elements (boundaries/high/low lines) draw at SESSION START, not root time**
- [ ] 19. **Judas: NO lines at 09:53 root, ALL lines at 09:55 session start**
- [ ] 20. **Model 111: NO lines at 13:30 root, ALL lines at 14:09 session start**
- [ ] 21. **`not na(session_start_timestamp)` checks present before drawing lines (Lines 574, 599)**
- [ ] 22. **Phase 2 drawing logic intact for pre-created sessions (Lines 515-541)**

**CRITICAL REMINDER:** Root times (lines 97-111) are based on years of research. If you changed them, REVERT immediately!

**NEW CRITICAL REMINDER:** Visual elements must ONLY appear at session start times. If you see double lines or lines at root times, check section 2.9 and 3.10!

---

## 7. CONTACT & REVISION HISTORY

This documentation was added after extensive debugging and fixes to ensure:
- Session highs/lows are accurate across all timeframes
- Midnight-wrapping sessions (Nagasaki, Turncoat) work correctly
- Session boundaries and labels display properly
- Root prices capture correctly, even when root time precedes session start
- Visual elements (boundaries, high/low lines) draw at session START time, not root time

**Key fixes that led to this documentation:**
- Fixed session end time boundary inclusiveness (< changed to <=)
- Added 1-minute bar filtering within session time ranges
- Fixed time_in_bar_range() bar time adjustment for midnight wrapping
- Added local variable copies to prevent mutation across sessions
- Centered session labels at midpoint of sessions
- Fixed session boundaries toggle functionality
- **Implemented pre-creation of sessions when root time is reached (lines 484-496)**
- **Fixed root capture logic to handle roots that occur before session starts**
- **Added critical documentation about root times being sacred constants**
- **FIXED: Visual elements now draw at session start time, not root time (2025-10-13)**

**LATEST FIX (2025-10-13) - Visual Element Drawing Bug:**
- **Problem:** Boundary lines and high/low lines were drawing at root time instead of session start time
- **Symptom:** Double boundary lines (e.g., Judas at 09:53 AND 09:55, Model 111 at 13:30 AND 14:09)
- **Root Cause:** Lines were drawn when session was created (at root time) rather than when session officially started
- **Solution:** Two-phase approach with `session_start_timestamp = na` during pre-creation, visual elements drawn only when session officially starts
- **Code Changes:**
  - Line 541: Set `session_start_timestamp = na` during pre-creation
  - Lines 515-517: Draw start boundary when pre-created session officially starts
  - Lines 519-541: Draw high/low lines when pre-created session officially starts
  - Line 574: Added `not na(session_start_timestamp)` check before drawing boundary lines
  - Line 599: Added `not na(session_start_timestamp)` check before drawing high/low lines
- **Documentation Added:**
  - Section 2.9: Comprehensive explanation of visual element drawing fix
  - Section 3.10: Pitfall warning about drawing at root time vs session start time
  - Checklist items 18-22: Verification steps for visual element timing

**CRITICAL ADDITIONS:**
- Section 2.8: Comprehensive documentation on root time capture
- Section 2.9: **NEW - Visual element drawing and session pre-creation (2025-10-13)**
- Section 3.9: Pitfall warning about never changing root times
- Section 3.10: **NEW - Pitfall warning about drawing visual elements at wrong time (2025-10-13)**
- Section 4.7: Architecture decision explaining why roots can precede sessions
- Updated checklist to verify root times haven't been modified
- **Updated checklist with visual element timing verification (items 18-22)**

If you encounter issues or have questions about this implementation, review the **CRITICAL IMPLEMENTATION DETAILS** (section 2) and **COMMON PITFALLS** (section 3) before making changes.

**Remember:**
- Accuracy is non-negotiable. Session highs/lows MUST match across all timeframes
- Root times are SACRED - never change them
- Visual elements must ONLY draw at session START times, never at root times
- Test thoroughly before deploying changes

---

**File Location:** `/Users/kaschief/Desktop/indicators-by-kash/indicators/11-dtt-sessions/code/development/dtt-session-test.pine`

**Documentation Created:** 2025-10-13

**Root Time Implementation:** 2025-10-13

**Visual Element Drawing Fix:** 2025-10-13
