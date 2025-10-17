# DTT Weekly Pro - Implementation Plan

**Target File**: `kash-dtt-weekly-pro.pine`
**Location**: `/Users/kaschief/Desktop/indicators-by-kash/indicators/11-dtt-intraday/code/development/`

---

## Critical Requirements from Intraday Learnings

### 1. **High/Low Accuracy (NON-NEGOTIABLE)**
- Must use `request.security_lower_tf()` with **5-minute bars** (not 1-minute)
- Session highs/lows MUST match across ALL supported timeframes (5min to 4hr)
- Initialize with extreme values: `session_high = -1e10`, `session_low = 1e10`

### 2. **Timeframe Gating**
- **Minimum**: 5 minutes (block sub-5min with runtime error)
- **Maximum**: 4 hours (block >4hr with runtime error)
- User must use timeframes: 5m, 10m, 15m, 30m, 1h, 2h, 4h

### 3. **Root Capture from 5-Minute Bars**
- Roots captured from 5-minute bars (higher timeframe than intraday's 1-minute)
- Root times can occur BEFORE session starts (pre-creation pattern)
- Visual elements (boundaries, high/low lines) draw at SESSION START, not root time

### 4. **Multi-Day Session Handling (Icarus)**
- Icarus: Wed 12:45 → Sun 18:00 (77.3 hours, spans 3+ days)
- NO daily boundaries shown within Icarus
- Must handle non-24h markets (stocks stop at market close, crypto continues)
- Session detection uses day-of-week + time combinations

### 5. **Performance Optimizations**
- Cache `request.security_lower_tf()` once per bar (not per session)
- Pre-calculate all 5-minute bar time conversions before session loop
- Limit to N most recent sessions for display (default: 2 weeks shown)

---

## Weekly DTT Session Structure

### Session Definitions

| Session   | Start             | End               | Duration | Root Time       | Inner Intervals                        |
|-----------|-------------------|-------------------|----------|-----------------|----------------------------------------|
| Iscariot  | Sun 18:00         | Mon 07:00         | 13h      | Sun 19:30       | Sun 19:30, Sun 22:40, Mon 01:20       |
| Aries     | Mon 07:00         | Tue 12:25         | 29.4h    | Mon 09:45       | Mon 09:45, Mon 20:45, Tue 01:45       |
| Ash       | Tue 12:25         | Wed 12:45         | 24.3h    | Tue 15:05       | Tue 15:05, Tue 21:50, Wed 02:35       |
| Icarus    | Wed 12:45         | Sun 18:00         | 77.3h    | Wed 19:25       | Wed 19:25, Thu 07:50, Thu 19:00       |

**Cycle**: 4 sessions = 1 week, repeats weekly
**Default Display**: Last 2 weeks (8 sessions total)

### Time Complexity Notes
- **Iscariot**: Simple overnight session (Sun→Mon)
- **Aries**: 29-hour session spanning Mon→Tue
- **Ash**: 24-hour session spanning Tue→Wed
- **Icarus**: LONGEST session, spans Wed→Thu→Fri→Sat→Sun (3+ days)

---

## Phase 1: Core Session Framework

### Objective
Build complete session infrastructure with boundaries, high/low tracking, labels, roots, and intervals.

### Components

#### 1.1 Constants & Timeframe Gating
```pine
const int SESSIONS_PER_CYCLE = 4
const string TIMEZONE = "America/New_York"

// Time Constants (HHMM format + day-of-week)
// Sunday = 1, Monday = 2, Tuesday = 3, Wednesday = 4, Thursday = 5, Friday = 6, Saturday = 7

const int DAY_SUNDAY = 1
const int DAY_MONDAY = 2
const int DAY_TUESDAY = 3
const int DAY_WEDNESDAY = 4

// Iscariot: Sun 18:00 → Mon 07:00
const int TIME_ISCARIOT_START = 1800
const int DAY_ISCARIOT_START = DAY_SUNDAY
const int TIME_ISCARIOT_END = 700
const int DAY_ISCARIOT_END = DAY_MONDAY
const int TIME_ISCARIOT_ROOT = 1930
const int DAY_ISCARIOT_ROOT = DAY_SUNDAY
// ... (similar for Aries, Ash, Icarus)

// Runtime check for timeframe
if timeframe.in_seconds(timeframe.period) < 300  // < 5 minutes
    runtime.error("Weekly DTT requires minimum 5-minute timeframe")
if timeframe.in_seconds(timeframe.period) > 14400  // > 4 hours
    runtime.error("Weekly DTT requires maximum 4-hour timeframe")
```

#### 1.2 DttWeeklySession Type
```pine
type DttWeeklySession
    string name
    int start_time  // HHMM
    int start_day   // 1=Sun, 2=Mon, ..., 7=Sat
    int end_time    // HHMM
    int end_day
    int root_time   // HHMM
    int root_day

    // Interval times (3 inner intervals)
    int interval1_time
    int interval1_day
    int interval2_time
    int interval2_day
    int interval3_time
    int interval3_day

    // Session tracking
    int start_bar
    int end_bar
    int start_timestamp
    int end_timestamp

    // High/Low tracking (initialize with extreme values)
    float session_high = -1e10  // CRITICAL: See intraday docs section 2.1
    float session_low = 1e10

    // Root prices
    float root_high
    float root_low
    float root_price
    int root_timestamp

    // Visual elements
    line start_boundary_line
    line end_boundary_line
    line pool_high_line
    line pool_low_line
    box root_zone_box
    line root_eq_line
    label session_label
    label root_time_label
```

#### 1.3 Session Templates
```pine
var array<DttWeeklySession> session_templates = array.new<DttWeeklySession>()

if barstate.isfirst
    // Iscariot
    array.push(session_templates, DttWeeklySession.new(
        "Iscariot", 1800, DAY_SUNDAY, 700, DAY_MONDAY,
        1930, DAY_SUNDAY,
        1930, DAY_SUNDAY, 2240, DAY_SUNDAY, 120, DAY_MONDAY,
        na, na, na, na, -1e10, 1e10, na, na, na, na,
        na, na, na, na, na, na, na, na, na
    ))

    // Aries
    array.push(session_templates, DttWeeklySession.new(
        "Aries", 700, DAY_MONDAY, 1225, DAY_TUESDAY,
        945, DAY_MONDAY,
        945, DAY_MONDAY, 2045, DAY_MONDAY, 145, DAY_TUESDAY,
        na, na, na, na, -1e10, 1e10, na, na, na, na,
        na, na, na, na, na, na, na, na, na
    ))

    // Ash
    array.push(session_templates, DttWeeklySession.new(
        "Ash", 1225, DAY_TUESDAY, 1245, DAY_WEDNESDAY,
        1505, DAY_TUESDAY,
        1505, DAY_TUESDAY, 2150, DAY_TUESDAY, 235, DAY_WEDNESDAY,
        na, na, na, na, -1e10, 1e10, na, na, na, na,
        na, na, na, na, na, na, na, na, na
    ))

    // Icarus (LONGEST - spans 3+ days)
    array.push(session_templates, DttWeeklySession.new(
        "Icarus", 1245, DAY_WEDNESDAY, 1800, DAY_SUNDAY,
        1925, DAY_WEDNESDAY,
        1925, DAY_WEDNESDAY, 750, DAY_THURSDAY, 1900, DAY_THURSDAY,
        na, na, na, na, -1e10, 1e10, na, na, na, na,
        na, na, na, na, na, na, na, na, na
    ))
```

#### 1.4 Session Detection Logic
```pine
// Get current day of week and time
current_day = dayofweek(time)
current_time = hour(time) * 100 + minute(time)

// Check if we're in a session
// CRITICAL: Must handle multi-day sessions like Icarus
for i = 0 to array.size(session_templates) - 1
    template = array.get(session_templates, i)

    in_session = false

    // Simple case: session within same day
    if template.start_day == template.end_day
        in_session := current_day == template.start_day and
                     current_time >= template.start_time and
                     current_time <= template.end_time

    // Multi-day case (Iscariot, Aries, Ash, Icarus)
    else
        // ... implement day-spanning logic ...
```

#### 1.5 High/Low Tracking with 5-Minute Intrabar Data
```pine
// CRITICAL OPTIMIZATION: Cache 5-minute data ONCE per bar (not per session)
// See intraday CHANGELOG: 66% performance improvement
[five_min_highs, five_min_lows, five_min_times] = request.security_lower_tf(syminfo.tickerid, "5", [high, low, time])

// Pre-calculate time conversions for all 5-minute bars
// See intraday CHANGELOG: 10-15% additional performance improvement
var array<int> five_min_days = array.new<int>()
var array<int> five_min_hhmm = array.new<int>()

if not na(five_min_times)
    array.clear(five_min_days)
    array.clear(five_min_hhmm)

    for j = 0 to array.size(five_min_times) - 1
        bar_time = array.get(five_min_times, j)
        array.push(five_min_days, dayofweek(bar_time))
        array.push(five_min_hhmm, hour(bar_time) * 100 + minute(bar_time))

// Now process sessions with cached data
for i = 0 to array.size(session_instances) - 1
    sess = array.get(session_instances, i)

    // Filter 5-minute bars within session day+time range
    for j = 0 to array.size(five_min_highs) - 1
        bar_day = array.get(five_min_days, j)
        bar_time = array.get(five_min_hhmm, j)

        // Check if 5-min bar is within session
        if is_in_session_range(bar_day, bar_time, sess)
            bar_high = array.get(five_min_highs, j)
            bar_low = array.get(five_min_lows, j)

            // Update session high/low
            if bar_high > sess.session_high
                sess.session_high := bar_high
            if bar_low < sess.session_low
                sess.session_low := bar_low
```

#### 1.6 Visual Elements
- **Boundaries**: Vertical lines at session start/end
- **High/Low Lines**: Horizontal lines spanning session duration
- **Session Labels**: Centered at session midpoint (day+time calculation)
- **Root Zones**: Box between root_high and root_low
- **Root EQ Line**: Horizontal line at root_price
- **Interval Lines**: 3 vertical lines per session at inner intervals

#### 1.7 Root Capture
```pine
// CRITICAL: Roots captured from 5-MINUTE bars (not 1-minute like intraday)
// Root time can be BEFORE session starts (pre-creation pattern)

// Check if current 5-min bar matches root time
if current_day == sess.root_day and current_time == sess.root_time
    // Capture root from THIS 5-minute bar
    sess.root_high := high
    sess.root_low := low
    sess.root_price := (high + low) / 2.0
    sess.root_timestamp := time
```

---

## Phase 2: AMRP Zones & Fibonacci (After Phase 1 Tested)

### Components

#### 2.1 AMRP Zones
- AMRP zone calculation using IQR method
- Lookback: N previous weekly sessions (default: 9)
- Manual mode: Single lookback
- Compare 3 mode: Overlay lookbacks 4, 6, 9
- Deviation projections beyond outer zones
- Equilibrium lines at session midpoint

#### 2.2 Dynamic Fibonacci
- Fibonacci levels anchored to AMRP boundaries
- Trails with session high/low extremes
- 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100% levels
- Show for last N sessions (default: 1)
- Style/width/label controls
- Disabled by default (performance optimization)

---

## Phase 3: Analytics Tables (After Phase 2 Tested)

### Components
- **AMRP Range Analysis Table**: Expected vs Actual range per session
- **AMRP Accuracy Table**: Statistical performance tracking
- Size/position controls (9-position grid)
- Rolling window: Show last N sessions (default: 8 sessions = 2 weeks)

---

## Critical Testing Requirements

### Test Matrix
| Timeframe | Verify                                          |
|-----------|-------------------------------------------------|
| 5min      | Session highs/lows (baseline)                  |
| 15min     | Highs/lows MUST match 5min                     |
| 30min     | Highs/lows MUST match 5min                     |
| 1hr       | Highs/lows MUST match 5min                     |
| 4hr       | Highs/lows MUST match 5min                     |

### Critical Test Cases
1. **Icarus multi-day span**: Wed 12:45 → Sun 18:00
   - Test on 24h asset (BTC): Session should be continuous
   - Test on non-24h asset (ES): Session respects market hours

2. **Session boundaries**: All 4 sessions align at exact times

3. **Root capture**:
   - Iscariot root at Sun 19:30 (1.5h after session starts)
   - Aries root at Mon 09:45 (2h 45m after session starts)
   - All roots captured from 5-minute bars

4. **Cascade order**: Iscariot → Aries → Ash → Icarus → [repeat]

5. **Visual element timing**:
   - Boundaries/lines appear at session START, not root time
   - No double lines (common bug in intraday)

---

## Critical Bug Fixes & Lessons Learned (Phase 1 Implementation)

### 🔴 Bug #1: Session Detection Using Wrong Pattern
**Problem**: Initial implementation used `is_in_session()` check that only worked if chart loaded during active session. Historical sessions never created.

**Root Cause**: Weekly sessions use time-point detection (session start time), not continuous time-range checks.

**Fix**: Changed to explicit time-point matching using `time_matches()` function:
```pine
// ❌ WRONG: Continuous check
if is_in_session(current_day, current_time, template)
    create_session()

// ✅ CORRECT: Time-point detection
if time_matches(template.start_day, template.start_time)
    create_session()
```

**Reference**: See intraday session detection logic. Sessions are created when a specific time point is reached, not during time ranges.

---

### 🔴 Bug #2: Array Access Without Size Checks
**Problem**: `Error on bar 6: In 'array.get()' function. Index 0 is out of bounds, array size is 0.`

**Root Cause**: Accessing arrays from `request.security_lower_tf()` and `session_instances` without verifying they contain elements.

**Fix**: Add comprehensive size checks before ALL array access:
```pine
// ❌ WRONG: Direct access
if not na(five_min_times)
    bar = array.get(five_min_times, 0)  // Crashes if empty!

// ✅ CORRECT: Check size first
if not na(five_min_times) and not na(five_min_highs) and not na(five_min_lows) and
   array.size(five_min_times) > 0 and array.size(five_min_highs) > 0 and
   array.size(five_min_lows) > 0 and array.size(session_instances) > 0
    bar = array.get(five_min_times, 0)  // Safe
```

**Lesson**: ALWAYS check array size before calling `array.get()`, even if you checked for `na`.

---

### 🔴 Bug #3: String Literals Without Constants
**Problem**: Using string literals like `"Iscariot"`, `"Aries"` directly in code.

**Fix**: Define constants for all string literals at the top:
```pine
// At file top
const string SESSION_ISCARIOT = "Iscariot"
const string SESSION_ARIES = "Aries"
const string SESSION_ASH = "Ash"
const string SESSION_ICARUS = "Icarus"

// Use constants everywhere
if sess.name == SESSION_ISCARIOT  // ✅ CORRECT
if sess.name == "Iscariot"        // ❌ WRONG
```

**Lesson**: No magic strings. All strings must be constants.

---

### 🔴 Bug #4: End Boundaries Not Drawn (Sessions "Illegal" Without Both Boundaries)
**Problem**: Icarus (active session) had no end boundary. User: "it cant have been plotted without one this is illegal all sessions MUST have their start AND end boundary to exist"

**Root Cause**: End boundary only drawn for completed sessions (`if not is_active`). Active sessions need both boundaries too.

**Fix**: Calculate `end_timestamp` at session creation, draw BOTH boundaries immediately:
```pine
// At session creation (lines 333-355)
int calculated_end_timestamp = timestamp(TIMEZONE, current_year, current_month, current_date, end_hour, end_minute)

// Handle multi-day sessions
int days_to_add = 0
if template.end_day < template.start_day
    days_to_add := (7 - template.start_day) + template.end_day
else if template.end_day > template.start_day
    days_to_add := template.end_day - template.start_day

calculated_end_timestamp := calculated_end_timestamp + (days_to_add * 86400000)

// ✅ CORRECT: Draw BOTH boundaries immediately (intraday lines 1490, 1494)
if show_boundaries
    new_session.start_boundary_line := line.new(time, 1e10, time, -1e6, ...)
    new_session.end_boundary_line := line.new(calculated_end_timestamp, 1e10, calculated_end_timestamp, -1e6, ...)
```

**Reference**: Intraday lines 1490, 1494. Both boundaries drawn at session creation.

**Lesson**: NEVER create a session without both boundaries. Calculate end timestamp using `timestamp()` + day offset.

---

### 🔴 Bug #5: High/Low Lines Showing Wrong Session's Data
**Problem**: Each session showed its OWN high/low instead of the PREVIOUS session's high/low.

**Root Cause**: High/low lines being drawn/updated in the visual loop using current session's data.

**Fix**: Draw high/low lines AT SESSION CREATION using previous session's data:
```pine
// At session creation (lines 371-376)
DttWeeklySession prev_sess_for_lines = get_previous_session(template.name)
if show_pool_lines and not na(prev_sess_for_lines.name) and
   prev_sess_for_lines.session_high < 1e9 and prev_sess_for_lines.session_low > -1e9
    new_session.pool_high_line := line.new(time, prev_sess_for_lines.session_high, calculated_end_timestamp, prev_sess_for_lines.session_high, ...)
    new_session.pool_low_line := line.new(time, prev_sess_for_lines.session_low, calculated_end_timestamp, prev_sess_for_lines.session_low, ...)
```

**Reference**: Subminute lines 417-418. High/low lines drawn ONCE at session creation.

**Lesson**: High/low lines are STATIC horizontal lines created once, never updated. They show PREVIOUS session's data.

---

### 🔴 Bug #6: High/Low Lines Repeating When N Incremented
**Problem**: When user changed "Show Last N Weeks" from 1 to 2, high/low lines repeated the first week's data instead of calculating new data for week 2.

**Root Cause**: High/low lines being drawn/updated in visual loop on every bar, picking up stale session data.

**Fix**: Same as Bug #5 - draw at session creation, not in loop.

**Lesson**: Visual elements drawn in loops will always have stale data issues. Create them ONCE at the right time.

---

### 🔴 Bug #7: Double Boundaries Between Adjacent Sessions
**Problem**: Two boundary lines visible at Aries end / Ash start (Tue 12:25) because both sessions share the same transition time.

**Root Cause**: Drawing both start and end boundaries for every session creates overlapping lines at transition points.

**Fix**: Delete previous session's end boundary when creating new session (intraday lines 1477-1478, 1639-1640):
```pine
// At session creation (lines 360-364)
DttWeeklySession prev_sess_for_deletion = get_previous_session(template.name)
if not na(prev_sess_for_deletion.end_boundary_line)
    line.delete(prev_sess_for_deletion.end_boundary_line)

// Then draw new session's boundaries
new_session.start_boundary_line := line.new(...)
new_session.end_boundary_line := line.new(...)
```

**Reference**: Intraday lines 1477-1478, 1639-1640.

**Lesson**: Adjacent sessions share boundaries. Delete previous session's end boundary to avoid double lines.

---

### 🔴 Bug #8: Root Zone Anchored to Session Start Instead of Root Time
**Problem**: Root zone box started at session beginning instead of at the actual root candle.

**Root Cause**: Using `sess.start_timestamp` for box left edge instead of `sess.root_timestamp`.

**Fix**: Anchor to actual root timestamp (intraday line 2051):
```pine
// ❌ WRONG
sess.root_zone_box := box.new(sess.start_timestamp, sess.root_high, extension_end_time, sess.root_low, ...)

// ✅ CORRECT (line 636)
sess.root_zone_box := box.new(sess.root_timestamp, sess.root_high, extension_end_time, sess.root_low, ...)
```

**Reference**: Intraday line 2051. Root box anchored to `root_timestamp`.

**Lesson**: Root zones start at the root candle time, not session start time.

---

### 🔴 Bug #9: Extension Behavior Wrong (Roots vs High/Low Lines)
**Problem**: Both roots and high/low lines extending the same way. User clarified:
- High/low lines should ONLY extend through the session they're displayed in
- Roots should extend through the ENTIRE following session

**Fix**: Use different end times for each:
```pine
// For high/low lines (lines 375-376) - extend to current session end
new_session.pool_high_line := line.new(time, prev_sess.session_high, calculated_end_timestamp, ...)

// For root zones (lines 636, 643) - extend to NEXT session end
sess.root_zone_box := box.new(sess.root_timestamp, sess.root_high, extension_end_time, sess.root_low, ...)
sess.root_eq_line := line.new(sess.root_timestamp, sess.root_price, extension_end_time, sess.root_price, ...)

// Where extension_end_time is calculated (lines 586-605)
DttWeeklySession next_sess = // find next session in cycle
int extension_end_time = not na(next_sess.name) ? next_sess.end_timestamp : display_end_time
```

**Lesson**: High/low lines and roots have different extension rules. High/low stops at current session end, roots extend to next session end.

---

### 🔴 Bug #10: Session Labels Positioned Incorrectly
**Problem**: Labels positioned using session high/low offset instead of being centered and at current bar high.

**Fix**: Match intraday pattern (lines 1522, 1691):
```pine
// ❌ WRONG
float label_y = sess.session_high + (sess.session_high - sess.session_low) * 0.1
sess.session_label := label.new(mid_time, label_y, label_text, style=label.style_label_down, ...)

// ✅ CORRECT (lines 585-594)
int mid_time = math.round((sess.start_timestamp + display_end_time) / 2)
sess.session_label := label.new(mid_time, high, text=label_text, style=label.style_none, ...)
```

**Reference**: Intraday lines 1522, 1691.

**Lesson**: Session labels are centered horizontally at session midpoint, positioned at current bar `high`, with transparent background (`label.style_none`).

---

### 🔴 Bug #11: Missing Intervals Toggle
**Problem**: Interval lines always shown, no way to toggle them off.

**Fix**: Add inputs for interval toggle and color:
```pine
show_intervals = input.bool(false, "Intervals?", group=GROUP_SESSIONS, inline="interval")
interval_color = input.color(DEFAULT_INTERVAL_COLOR, "", group=GROUP_SESSIONS, inline="interval")

// Use in drawing
if show_intervals
    sess.interval1_line := line.new(interval1_time, 1e10, interval1_time, -1e6, color=color.new(interval_color, 40), ...)
```

**Lesson**: All visual elements need toggles and color controls.

---

### 🟡 Critical Implementation Patterns (MUST FOLLOW)

#### Pattern #1: Visual Elements Created ONCE, Never Updated in Loops
```pine
// ✅ CORRECT: Create at session start
if time_matches(template.start_day, template.start_time)
    new_session.start_boundary_line := line.new(...)
    new_session.pool_high_line := line.new(...)

// ❌ WRONG: Create/update in visual loop
for i = 0 to total_sessions - 1
    if na(sess.pool_high_line)
        sess.pool_high_line := line.new(...)  // Don't do this!
```

**Why**: Creating visual elements in loops causes them to get stale data and wrong timestamps.

#### Pattern #2: Always Use Calculated end_timestamp
```pine
// ✅ CORRECT
int display_end_time = sess.end_timestamp  // Always use this

// ❌ WRONG
int display_end_time = is_active ? time : sess.end_timestamp  // Don't use current bar time
```

**Why**: Active sessions need their lines to extend to the calculated end time, not current bar.

#### Pattern #3: Delete Before Draw to Avoid Doubles
```pine
// ✅ CORRECT
if not na(prev_sess.end_boundary_line)
    line.delete(prev_sess.end_boundary_line)

new_session.start_boundary_line := line.new(...)
new_session.end_boundary_line := line.new(...)
```

**Why**: Adjacent sessions share transition points. Delete previous end boundary before drawing new boundaries.

#### Pattern #4: High/Low Tracking - Only Update MOST RECENT Active Session
```pine
// ✅ CORRECT (lines 427-452)
for tmpl_idx = 0 to array.size(session_templates) - 1
    DttWeeklySession template = array.get(session_templates, tmpl_idx)

    // Find MOST RECENT active session for this template
    DttWeeklySession active_sess = na
    for i = array.size(session_instances) - 1 to 0
        sess = array.get(session_instances, i)
        if sess.name == template.name and not na(sess.start_bar) and na(sess.end_bar)
            active_sess := sess
            break  // Stop at most recent

    // Update only this session
    if not na(active_sess)
        // ... update high/low ...

// ❌ WRONG: Update all sessions with same name
for i = 0 to array.size(session_instances) - 1
    if sess.name == template.name and na(sess.end_bar)
        // ... update high/low ...  // Will update old sessions too!
```

**Why**: Multiple sessions of same type exist (week 1 Aries, week 2 Aries, etc.). Must only update the MOST RECENT active one.

---

## Bugs to Avoid (Learned from Intraday)

### 🚨 CRITICAL
1. **DON'T change initialization values** (-1e10, 1e10)
2. **DON'T use < for session end boundary** (must use <=)
3. **DON'T draw visual elements in loops** (draw at session creation)
4. **DON'T call request.security_lower_tf() per session** (cache once)
5. **DON'T skip array size checks** (ALWAYS verify before array.get())
6. **DON'T use string literals** (all strings must be constants)
7. **DON'T skip end boundary for active sessions** (both boundaries required)
8. **DON'T anchor root zones to session start** (use root_timestamp)

### ⚠️ IMPORTANT
9. Always use local variable copies in session loops
10. Test all timeframes (5m through 4hr)
11. Verify highs/lows match across timeframes (MANDATORY)
12. Handle empty intrabar data (fallback to current bar)
13. Delete previous session's end boundary before drawing new one
14. Use calculated end_timestamp for active sessions (not current time)
15. High/low lines show PREVIOUS session's data, not current
16. Only update MOST RECENT active session per template type

---

## File Structure

```
kash-dtt-weekly-pro.pine
├── CONSTANTS (sessions per cycle, timezone, time constants)
├── INPUTS (show last N weeks, boundaries, labels, roots, etc.)
├── TYPE DEFINITIONS (DttWeeklySession)
├── SESSION TEMPLATES (4 weekly sessions)
├── TIMEFRAME GATING (runtime errors for invalid timeframes)
├── CACHED 5-MINUTE DATA (request.security_lower_tf once per bar)
├── TIME CONVERSIONS (pre-calculate all 5-min bar day+time)
├── SESSION DETECTION (day-of-week + time logic)
├── SESSION LOOP
│   ├── Session start/end detection
│   ├── 5-minute bar filtering
│   ├── High/low tracking
│   ├── Root capture
│   └── Visual element drawing
└── DISPLAY (boundaries, labels, high/low lines, roots, intervals)
```

---

## Success Criteria (Phase 1)

✅ **MUST PASS BEFORE PHASE 2:**
- [ ] Indicator compiles without errors
- [ ] 4 weekly sessions display correctly
- [ ] Session highs/lows match across 5min, 15min, 1hr, 4hr timeframes
- [ ] Icarus spans Wed→Sun without daily boundaries
- [ ] All root times captured from 5-minute bars
- [ ] Visual elements appear at session start (not root time)
- [ ] Session labels centered at midpoint
- [ ] 3 inner intervals per session displayed
- [ ] Tested on 24h asset (BTC) and non-24h asset (ES)
- [ ] Performance acceptable (no timeouts when changing inputs)

---

## Next Steps

1. Create `kash-dtt-weekly-pro.pine` in development folder
2. Implement Phase 1 components sequentially
3. Test each component before moving to next
4. User validates Phase 1 before starting Phase 2
5. Iterate based on feedback

**Note**: This plan prioritizes ACCURACY over speed. Session highs/lows MUST be correct across all timeframes.
