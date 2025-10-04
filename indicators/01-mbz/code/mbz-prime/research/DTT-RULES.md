# DTT (Digital Time Theory) Session Rules & Specifications

## Overview
DTT sessions are 15 micro-sessions that form a continuous loop, creating a complete trading cycle every 24 hours. The cycle runs independently of which session is currently active - it's a perpetual rotation. While we use 18:00 to 18:00 NY time as the organizational boundary, the cycle itself is unbroken and repeats continuously (especially on 24/7 assets).

## Constants

All session names, times, and key values are defined as constants for maintainability:

```pine
const int SESSIONS_PER_CYCLE = 15
const int MILLISECONDS_PER_DAY = 86400000
const int LOOKBACK_BARS = 500
const string TIMEZONE = "America/New_York"
const string ARROW_UP = "▲"
const string ARROW_DOWN = "▼"
```

## Session Definitions (in cascade order)

| # | Session Name | Constant | Start Time | End Time | Duration | Previous Session |
|---|--------------|----------|------------|----------|----------|------------------|
| 1 | Damasu | SESSION_DAMASU | 18:00 | 19:01 | 1h 1m | Model 111 |
| 2 | Osaka | SESSION_OSAKA | 19:01 | 21:14 | 2h 13m | Damasu |
| 3 | Kyoto | SESSION_KYOTO | 21:14 | 23:04 | 1h 50m | Osaka |
| 4 | Nagasaki | SESSION_NAGASAKI | 23:04 | 03:00 | 3h 56m | Kyoto |
| 5 | Turncoat | SESSION_TURNCOAT | 03:00 | 03:44 | 44m | Nagasaki |
| 6 | Bishop | SESSION_BISHOP | 03:44 | 05:20 | 1h 36m | Turncoat |
| 7 | Knight | SESSION_KNIGHT | 05:20 | 06:39 | 1h 19m | Bishop |
| 8 | Big Ben | SESSION_BIGBEN | 06:39 | 09:30 | 2h 51m | Knight |
| 9 | NY Open | SESSION_NYOPEN | 09:30 | 09:55 | 25m | Big Ben |
| 10 | Judas | SESSION_JUDAS | 09:55 | 10:20 | 25m | NY Open |
| 11 | Model 11 | SESSION_MODEL11 | 10:20 | 11:10 | 50m | Judas |
| 12 | Model 110 | SESSION_MODEL110 | 11:10 | 11:49 | 39m | Model 11 |
| 13 | Lunch | SESSION_LUNCH | 11:49 | 12:35 | 46m | Model 110 |
| 14 | Model 1001 | SESSION_MODEL1001 | 12:35 | 14:09 | 1h 34m | Lunch |
| 15 | Model 111 | SESSION_MODEL111 | 14:09 | 18:00 | 3h 51m | Model 1001 |

**Total Cycle Duration**: 24 hours (18:00 to 18:00)

**Note**: The cycle is a continuous loop - Model 111 feeds back into Damasu, creating perpetual rotation. The 18:00 boundary is an organizational reference point, not a true start/stop.

## Visual Components

Each DTT session displays the following visual elements:

### 1. Start Boundary Line
- Vertical line at the bar where the session is first detected
- Uses `bar_index` positioning
- Marks the beginning of the session
- Customizable: color, width, style

### 2. End Boundary Line
- Vertical line at the **exact session end time**
- Uses `xloc.bar_time` positioning with calculated timestamp
- Drawn immediately when session is created (projects into future)
- Provides precise end boundary regardless of bar availability
- Customizable: color, width, style (shared with start boundary)

### 3. Previous Session High Line
- Horizontal line showing the **high** of the **previous session type**
- Extends from session start to session end using `xloc.bar_time`
- Example: Damasu displays Model 111's high
- Customizable: color, width, style (shared with low line)

### 4. Previous Session Low Line
- Horizontal line showing the **low** of the **previous session type**
- Extends from session start to session end using `xloc.bar_time`
- Example: Damasu displays Model 111's low
- Customizable: color, width, style (shared with high line)

### 5. Session Name Label
- Positioned at the midpoint between start and end timestamps
- Uses `xloc.bar_time` for accurate placement
- Displayed for all sessions (including currently active ones)

### 6. Breach Detection Arrows
- **High Breach**: Downward arrow (▼) placed ABOVE the first candle that breaches the previous session's high
- **Low Breach**: Upward arrow (▲) placed BELOW the first candle that breaches the previous session's low
- Only the FIRST breach is marked - subsequent breaches are ignored
- Each pool (high/low) is evaluated independently
- Customizable: high color, low color, arrow size
- Terminology: "breach" not "touch" - breach indicates potential liquidity pool interaction

## Key Technical Rules

### 1. Time Reference
- **All times are in TIMEZONE constant** (America/New_York)
- Use **bar time** (`time`), NOT real-world time (`timenow`)
- Bar time ensures correct historical playback and replay mode functionality

### 2. Session Creation
- Sessions are created when `current_time` is **within** the session's time range
- Not just at exact start time (allows creation mid-session)
- Only one active instance per session type at a time
- Check prevents duplicate sessions on the same bars

### 3. Midnight Wrapping
- Sessions can wrap around midnight (e.g., Nagasaki: 23:04 to 03:00)
- Special logic: `if end_time < start_time` then add MILLISECONDS_PER_DAY to end_timestamp
- In-session check: `current_time >= start_time OR current_time < end_time`

### 4. 24/7 Asset Auto-Detection
- Automatically detect crypto/24-7 assets by checking for weekend bars
- On first bar, scan last LOOKBACK_BARS (500) for Saturday/Sunday activity
- If weekend bars found: `is_247_asset = true`
- Process sessions on weekends for 24/7 assets, weekdays only for traditional markets
- No manual toggle required - fully automatic

### 5. Previous Session High/Low Cascade
- Each session references its **previous session type** (not previous instance)
- Use `get_last_session_of_type()` to find the most recent completed/active instance
- Example: Current Osaka gets high/low from previous Damasu instance
- Forms a cascade pattern through all 15 sessions

### 6. Line Drawing Using Time
- **Boundaries**: Use `xloc.bar_time` to draw at exact timestamps
- **End timestamp calculation**:
  ```pine
  end_timestamp = timestamp(TIMEZONE, year, month, day, end_hour, end_minute)
  if end_time < start_time: end_timestamp += MILLISECONDS_PER_DAY  // Next day
  if end_timestamp < current_time: end_timestamp += MILLISECONDS_PER_DAY  // Add day if in past
  ```

### 7. Cleanup Logic
- Keep only last N cycles (default: 1 cycle = SESSIONS_PER_CYCLE)
- `sessions_to_keep = show_last_n_days * SESSIONS_PER_CYCLE`
- Cleanup runs **before** creating new sessions (prevents race conditions)
- Delete visual elements (lines, labels, arrows) before removing from array

### 8. Session End Detection
- Check if `in_session = false` for active sessions (`na(sess.end_bar)`)
- Mark `end_bar = bar_index` when session ends
- End boundary already drawn at correct time (no repositioning needed)

### 9. Breach Detection & Pattern Formation

**Breach Detection:**
- Tracks whether high and low pools have been breached independently
- **High breach**: `high > prev_session.session_high` (STRICT - touching does NOT count as breach)
- **Low breach**: `low < prev_session.session_low` (STRICT - touching does NOT count as breach)
- **NOTE**: mbz-prime uses `>=` and `<=` (touching counts as breach) - DTT uses strict inequality
- Once breached, flags `high_breached` or `low_breached` are set to true
- Breach bar index is saved (`high_breach_bar`, `low_breach_bar`) - CRITICAL for pattern detection
- Arrows drawn only on first breach
- Detection runs on every bar during active AND ended sessions

**Pattern Formation:**
- After breach, pattern detection runs to check for MBZ patterns (IMM/STD/DEL)
- **Multiple patterns can be detected from the same breach**: IMM and STD commonly coexist
- **Each pattern creates its own label on its confirmation bar**
- Pattern detection happens across multiple bars:
  - **Bar A (breach bar)**: IMMEDIATE pattern checked (bars_since_breach = 0)
  - **Bar B (next bar)**: STANDARD and DELAYED patterns checked (bars_since_breach >= 1)
- `pattern_checked` flag is ONLY set after Bar B (when all patterns have been evaluated)
- Labels are created inline when each pattern is detected (not in a separate loop)
- This allows multiple labels per session on different bars

### 10. Preventing Double Boundaries
- When new session starts, delete previous session's end boundary
- Current session's start boundary serves as previous session's end
- Prevents overlapping lines between sessions

## Display Settings

### Show Last N Days
- Controls how many complete 24-hour cycles to display
- 1 = 15 sessions (one complete cycle)
- 2 = 30 sessions (two complete cycles)
- Max: 10 days (150 sessions)
- **Note**: Any 15 consecutive sessions = 1 complete cycle, regardless of where in the loop you are

### Customization Options

**Session Boundaries**:
- Color (default: blue)
- Width (1-5, default: 2)
- Style (solid/dashed/dotted)

**Previous Session High & Low**:
- Color (default: purple with 50% transparency)
- Width (1-5, default: 1) - shared between high and low
- Style (solid/dashed/dotted) - shared between high and low

**Breach Arrows**:
- High Breach Color (default: green)
- Low Breach Color (default: red)
- Size (tiny/small/normal/large, default: small)

**Session Labels**:
- Size (tiny/small/normal/large, default: small)

**Pattern Detection**:
- Enable/disable IMMEDIATE, STANDARD, DELAYED patterns individually
- Patterns checked in order: IMMEDIATE → STANDARD → DELAYED (matches mbz-prime)

## Session State Tracking

Each session instance stores:
- `start_time`, `end_time`: Session time range (HHMM format from constants)
- `name`: Session identifier (from constants)
- `prev_session_name`: Which session's high/low to display
- `start_bar`, `end_bar`: Bar indices when session started/ended
- `session_day`: Day number (based on completed Model 111 count)
- `session_high`, `session_low`: Actual high/low recorded during session
- `pool_high_line`, `pool_low_line`: Line objects for previous session's levels
- `start_boundary_line`, `end_boundary_line`: Vertical boundary line objects
- `session_label`: Label object for session name
- `high_breached`, `low_breached`: Boolean flags for first breach detection
- `high_breach_bar`, `low_breach_bar`: Bar index where breach occurred (CRITICAL for pattern detection timing)
- `high_arrow`, `low_arrow`: Arrow label objects for first breaches
- `high_pattern_checked`, `low_pattern_checked`: Boolean flags to ensure pattern detection completes (set after bars_since_breach >= 1)
- `pattern_is_high`: Array of booleans indicating if each pattern is for high (true) or low (false)
- `pattern_formation_rule`: Array of strings storing pattern types (PATTERN_IMMEDIATE, PATTERN_STANDARD, PATTERN_DELAYED)
- `pattern_labels`: Array of label objects - one label per pattern, created inline when pattern is detected
- `high_fail_reason`, `low_fail_reason`: String explaining PRIMARY reason pattern failed (only set when NO patterns formed)

## Debug Table

6-column layout showing last 15 sessions:

| Session | Time | H | H Pattern | L | L Pattern |
|---------|------|---|-----------|---|-----------|
| Session name | Start-End | ✓ if breached | Pattern type or failure reason | ✓ if breached | Pattern type or failure reason |

**Column Details:**
- **Session**: Session name (e.g., "Damasu", "Osaka")
- **Time**: Start-End time range (HHMM format)
- **H**: High breach status (✓ = breached, - = not breached)
- **H Pattern**:
  - Green background: Pattern formed (IMM/STD/DEL)
  - Red background: Failure reason (e.g., "IMM✗: A already touched the high")
  - Shows PRIMARY (first) failure only
- **L**: Low breach status (✓ = breached, - = not breached)
- **L Pattern**: Same as H Pattern but for low breaches

**Summary Row** (yellow on navy):
- **Col 0**: Current time (HHMM)
- **Col 1**: Day name | Active session | Total sessions count
- **Col 2**: 24/7 asset status (Y/N)
- **Col 3**: HIGH pattern totals (IMM:X STD:X DEL:X)
- **Col 4**: Empty
- **Col 5**: LOW pattern totals (IMM:X STD:X DEL:X)

## Common Patterns

### Session Wraps Midnight
```pine
if sess.end_time > sess.start_time
    // Normal session (e.g., 10:20 to 11:10)
    in_session := current_time >= sess.start_time and current_time < sess.end_time
else
    // Wraps midnight (e.g., 23:04 to 03:00)
    in_session := current_time >= sess.start_time or current_time < sess.end_time
```

### Drawing Lines with Exact Time
```pine
// Start boundary at current bar
line.new(bar_index, y1, bar_index, y2, color=boundary_color)

// End boundary at exact timestamp
line.new(end_timestamp, y1, end_timestamp, y2, xloc=xloc.bar_time, color=boundary_color)

// Horizontal lines spanning session duration
line.new(start_timestamp, price, end_timestamp, price, xloc=xloc.bar_time, color=pool_color)
```

### Breach Detection
```pine
// Check for first breach of high
if not sess.high_breached and not na(prev_high)
    if high >= prev_high
        sess.high_breached := true
        sess.high_breach_bar := bar_index  // CRITICAL: Save bar index for pattern detection
        sess.high_arrow := label.new(bar_index, high, text=ARROW_DOWN,
            style=label.style_none, textcolor=arrow_high_color, yloc=yloc.abovebar)

// Check for first breach of low
if not sess.low_breached and not na(prev_low)
    if low <= prev_low
        sess.low_breached := true
        sess.low_breach_bar := bar_index  // CRITICAL: Save bar index for pattern detection
        sess.low_arrow := label.new(bar_index, low, text=ARROW_UP,
            style=label.style_none, textcolor=arrow_low_color, yloc=yloc.belowbar)
```

### Pattern Detection (MBZ Integration)

**Detection Order**: IMMEDIATE → STANDARD → DELAYED (matches mbz-prime)

**Critical Rules:**
1. Pattern detection spans multiple bars (not single-bar evaluation)
2. **IMMEDIATE**: Checked when `breach_is_current_high = true` (bars_since_breach = 0)
3. **STANDARD/DELAYED**: Checked when `bars_since_breach >= 1` (breach happened on previous bar)
4. `pattern_checked` flag is ONLY set inside `bars_since_breach >= 1` block (after STD/DEL checked)
5. **Multiple patterns can form**: All three patterns (IMM, STD, DEL) are checked independently
6. Each pattern that passes is added to `pattern_formation_rule` and `pattern_is_high` arrays
7. Labels are created inline immediately when each pattern is detected
8. Failure reasons are stored in temporary local variables, only written to session if NO patterns formed
9. Uses helper function `dtt_check_midpoint(is_bearish, close_price, midpoint)` for uniform midpoint confirmation

**Candle Assignments:**
- **IMMEDIATE**: A = bar BEFORE breach, B = breach bar (current bar when breach happens)
- **STANDARD/DELAYED**: A = breach bar, B = bar AFTER breach (current bar when bars_since_breach >= 1)

**Two-Bar Detection Flow:**

**Bar A (Breach Bar - bars_since_breach = 0):**
```pine
if high_ready  // breach detected, not checked yet
    breach_is_current_high = true

    // IMMEDIATE check
    if show_immediate and breach_is_current_high
        // A = open[1], close[1], high[1], low[1]  (bar before breach)
        // B = open, close, high, low  (breach bar)
        // Check conditions, create label if passes
        // Add to pattern arrays

    // bars_since_breach = 0, so STANDARD/DELAYED block is SKIPPED
    // pattern_checked NOT set yet
```

**Bar B (Confirmation Bar - bars_since_breach = 1):**
```pine
if high_ready  // still true, pattern not checked yet
    breach_is_previous_high = true

    // IMMEDIATE block skipped (breach_is_current_high = false)

    if bars_since_breach >= 1
        // A = open[1], close[1], high[1], low[1]  (breach bar)
        // B = open, close, high, low  (current bar)

        // STANDARD check
        if show_standard and breach_is_previous_high
            // Check conditions, create label if passes
            // Add to pattern arrays

        // DELAYED check
        if show_delayed and breach_is_previous_high
            // Check conditions, create label if passes
            // Add to pattern arrays

        // NOW mark as checked
        sess.high_pattern_checked := true
```

**Pattern Condition Checks (Bearish HIGH example):**

**IMMEDIATE:**
1. `a_stayed_inside = a_imm_high <= prev_high` (A can touch but not exceed)
2. `b_swept = b_high > prev_high and b_open < prev_high` (B sweeps through)
3. `b_is_bearish = b_close < b_open` (B closes down)
4. `midpoint_passed = dtt_check_midpoint(true, b_close, a_imm_mid)` (B close < A midpoint)

**STANDARD:**
1. `wick_only = a_open < prev_high and a_high > prev_high and a_close < prev_high` (A wicked only)
2. `b_started_below = b_open < prev_high` (B started inside)
3. `no_new_extreme = b_high < a_high` (B didn't exceed A's high)
4. `b_is_bearish = b_close < b_open` (B closes down)
5. `midpoint_passed = dtt_check_midpoint(true, b_close, a_mid)` (B close < A midpoint)

**DELAYED:**
1. `body_closed_beyond = a_close > prev_high` (A body closed beyond level)
2. `b_started_above = b_open > prev_high` (B started beyond)
3. `b_is_bearish = b_close < b_open` (B closes down)
4. `midpoint_passed = dtt_check_midpoint(true, b_close, a_mid)` (B close < A midpoint)

**Key Difference from Prime:**
- **Prime**: Multiple pools, priority system unifies all patterns to highest priority for ONE label per candle
- **DTT**: Single pool per session, each pattern gets its OWN label on its confirmation bar, allowing multiple labels per session

**Failure Reason Format:**
- Pattern type prefix with ✗: `IMM✗:`, `STD✗:`, `DEL✗:`
- Explicit reasons:
  - `IMM✗: A high exceeded the level` (A went beyond)
  - `IMM✗: B didn't sweep the high` (B didn't breach)
  - `IMM✗: B not bearish` (B didn't close down)
  - `IMM✗: B close above A midpoint` (Midpoint not passed)
  - `STD✗: A body touched the high` (Body closed beyond, not wick-only)
  - `STD✗: B didn't start below the high` (B started beyond level)
  - `STD✗: B made new extreme` (B exceeded A's high)
  - `STD✗: B not bearish` (B didn't close down)
  - `STD✗: B close above A midpoint` (Midpoint not passed)
  - `DEL✗: A didn't close above the high` (A body didn't close beyond)
  - `DEL✗: B didn't start above the high` (B didn't start beyond)
  - `DEL✗: B not bearish` (B didn't close down)
  - `DEL✗: B close above A midpoint` (Midpoint not passed)
- Specifies "the high" or "the low" (not just "level")
- Uses directional terms: "bearish" / "bullish" (not colors)

## Implementation Notes

- All session names and times are constants for easy modification
- Auto-detection of 24/7 assets eliminates manual configuration
- Breach arrows provide immediate visual feedback
- Breach bar index tracking is CRITICAL for accurate pattern detection
- Pattern detection integrated with MBZ liquidity pool logic (IMM/STD/DEL)
- Debug table shows pattern formation success/failure with human-readable reasons
- Cleanup logic prevents memory/performance issues with long-running charts

## Solution: Multiple Pattern Labels Per Session

**Problem:** Originally, only one label was created per session using a priority system (DEL > STD > IMM). When both IMMEDIATE and STANDARD formed from the same breach, only the higher priority pattern's label appeared, hiding the other pattern.

**Root Cause:** Label creation was done in a separate loop AFTER all patterns were detected, using `array.size(sess.pattern_labels) == 0` check that prevented creating more than one label per session.

**Solution:** Create labels **inline immediately** when each pattern is detected:
- IMMEDIATE label created on breach bar (when bars_since_breach = 0)
- STANDARD label created on confirmation bar (when bars_since_breach >= 1)
- DELAYED label created on confirmation bar (when bars_since_breach >= 1)
- Each pattern adds its label to `pattern_labels` array at detection time
- Removed the separate label creation loop entirely

**Result:** Multiple patterns from the same breach each get their own label on their respective confirmation bars. Example: IMM label on candle 12, STD label on candle 11 - both visible from the same session breach.

**Key Insight:** DTT differs from prime because DTT has ONE pool per session (previous session's high/low), while prime has MULTIPLE pools per candle (daily, weekly, monthly highs/lows). In prime, priority unification makes sense to show one pattern per candle. In DTT, each pattern deserves its own label since they're all interacting with the same single pool at different confirmation points.
