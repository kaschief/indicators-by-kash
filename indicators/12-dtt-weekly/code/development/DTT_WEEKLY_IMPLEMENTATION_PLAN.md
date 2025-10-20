# DTT Weekly Pro - Implementation Plan

**Target File**: `kash-dtt-weekly-pro.pine`
**Location**: `/Users/kaschief/Desktop/indicators-by-kash/indicators/11-dtt-intraday/code/development/`

---

## 📊 Implementation Status

### ✅ Phase 1: Core Session Framework (COMPLETED)
- [x] Session structure with 4 weekly sessions (Iscariot, Aries, Ash, Icarus)
- [x] Session detection using day-of-week + time logic
- [x] PASS 1 & PASS 2 architecture (session end detection before session start creation)
- [x] High/Low tracking using 5-minute intrabar data with smart boundary bar filtering
- [x] Root capture from 5-minute bars
- [x] Visual elements (boundaries, high/low lines, session labels, intervals, root zones)
- [x] Session pruning and performance optimizations
- [x] Timeframe support: 5min, 15min, 30min, 1hr, 4hr
- [x] All Phase 1 bugs resolved (Issues #1-9)
- [x] Comprehensive documentation (WEEKLY_DTT_IMPLEMENTATION_NOTES.md)

**Status:** Production Ready ✅ | Last Updated: 2025-10-17

### 🔄 Phase 2: AMRP Zones & Fibonacci (PLANNED)
- [ ] AMRP storage arrays (historical expansion data per session type)
- [ ] AMRP calculation using IQR method (Q1/Q3 percentiles)
- [ ] AMRP zone drawing (Manual and Compare 3 modes)
- [ ] AMRP deviation projections (dynamic targets when price breaks zones)
- [ ] Dynamic Fibonacci levels (7 levels, trails with session high/low)
- [ ] Phase 2 testing and validation

**Prerequisite:** Phase 1 must be fully tested and validated

### 📈 Phase 3: Analytics Tables (PLANNED)
- [ ] AMRP Range Analysis table (Expected vs Actual range tracking)
- [ ] AMRP Accuracy table (Statistical performance metrics)
- [ ] Display mode controls (All Models / Active Only)
- [ ] Position and size controls (9-position grid)
- [ ] Phase 3 testing and validation

**Prerequisite:** Phase 2 must be fully tested and validated

---

## 🎯 Implementation Approach

This plan follows a **phased, test-driven approach**:
1. **Phase 1 Complete:** Core sessions framework is production-ready
2. **Phase 2 Next:** Add AMRP zones and Fibonacci after Phase 1 validation
3. **Phase 3 Final:** Add analytics tables after Phase 2 validation

Each phase MUST be fully tested before moving to the next. Parity with intraday DTT will be achieved after Phase 3 completion.

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

    // Visual elements - Phase 1
    line start_boundary_line
    line end_boundary_line
    line high_line                       // Shows PREVIOUS session's high
    line low_line                        // Shows PREVIOUS session's low
    box root_zone_box
    line root_eq_line
    label session_label
    label root_time_label
    line interval1_line
    line interval2_line
    line interval3_line

    // AMRP fields - Phase 2
    box amrp_up_box                      // Upper AMRP zone (above root)
    box amrp_dn_box                      // Lower AMRP zone (below root)
    line amrp_up_eq_line                 // EQ line for upper zone (midpoint)
    line amrp_dn_eq_line                 // EQ line for lower zone (midpoint)
    line amrp_up_proj1                   // Upper projection -1x
    line amrp_up_proj2                   // Upper projection -2x
    line amrp_up_proj3                   // Upper projection -2.5x
    line amrp_up_proj4                   // Upper projection -4x
    line amrp_dn_proj1                   // Lower projection -1x
    line amrp_dn_proj2                   // Lower projection -2x
    line amrp_dn_proj3                   // Lower projection -2.5x
    line amrp_dn_proj4                   // Lower projection -4x
    label amrp_up_proj1_label
    label amrp_up_proj2_label
    label amrp_up_proj3_label
    label amrp_up_proj4_label
    label amrp_dn_proj1_label
    label amrp_dn_proj2_label
    label amrp_dn_proj3_label
    label amrp_dn_proj4_label
    bool amrp_drawn                      // Flag to prevent redrawing
    bool amrp_up_projections_drawn
    bool amrp_dn_projections_drawn
    bool amrp_broke_up                   // Price broke above upper outer
    bool amrp_broke_dn                   // Price broke below lower outer
    float amrp_up_inner                  // Inner upper boundary price (Q1)
    float amrp_up_outer                  // Outer upper boundary price (Q3)
    float amrp_dn_inner                  // Inner lower boundary price (Q1)
    float amrp_dn_outer                  // Outer lower boundary price (Q3)
    int amrp_bars_total                  // Total bars during session
    int amrp_bars_within_inner           // Bars within inner zones
    int amrp_bars_within_outer           // Bars within outer zones
    int amrp_bars_broke_outer            // Bars that broke outer zones

    // Dynamic Fibonacci fields - Phase 2
    float fib_high_anchor                // Initially AMRP upper outer, trails session high
    float fib_low_anchor                 // Initially AMRP lower outer, trails session low
    line fib_line_0                      // 0% level (low anchor)
    line fib_line_295                    // 29.5% level
    line fib_line_382                    // 38.2% level
    line fib_line_50                     // 50% level
    line fib_line_618                    // 61.8% level
    line fib_line_705                    // 70.5% level
    line fib_line_100                    // 100% level (high anchor)
    label fib_label_0
    label fib_label_295
    label fib_label_382
    label fib_label_50
    label fib_label_618
    label fib_label_705
    label fib_label_100
    bool fib_drawn                       // Flag to prevent redrawing
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
- **Boundaries**: Vertical lines at session start/end (both drawn at session creation)
- **High/Low Lines**: Horizontal lines showing PREVIOUS session's high and low (drawn ONCE at session creation)
- **Session Labels**: Centered at session midpoint, positioned at current bar high, transparent background
- **Root Zones**: Box between root_high and root_low, extends through following session
- **Root EQ Line**: Horizontal line at root_price, extends through following session
- **Interval Lines**: 3 vertical lines per session at inner interval times

**CRITICAL Pattern:** Visual elements are created ONCE at the correct time (session creation or root capture), NEVER updated in loops. See Bug #5 and Pattern #1 in lessons learned.

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

### Prerequisites
- ✅ Phase 1 fully tested and working
- ✅ All 4 sessions (Iscariot, Aries, Ash, Icarus) displaying correctly
- ✅ Session highs/lows accurate across all timeframes (5m-4h)
- ✅ Root capture working from 5-minute bars

### Architecture Notes
**CRITICAL:** AMRP calculation requires historical session data. Each session type (Iscariot, Aries, Ash, Icarus) has separate AMRP arrays tracking expansion values from previous sessions.

**Performance:** AMRP disabled by default. Enable with `show_amrp = true`.

---

### Components

#### 2.1 AMRP Storage Arrays (Add After Session Templates)
```pine
// ⚠️ AMRP historical data - one array per session type
// Stores expansion values (session_high - root_price and root_price - session_low)
var array<float> amrp_iscariot_up = array.new<float>()
var array<float> amrp_iscariot_dn = array.new<float>()
var array<float> amrp_aries_up = array.new<float>()
var array<float> amrp_aries_dn = array.new<float>()
var array<float> amrp_ash_up = array.new<float>()
var array<float> amrp_ash_dn = array.new<float>()
var array<float> amrp_icarus_up = array.new<float>()
var array<float> amrp_icarus_dn = array.new<float>()

// ⚠️ CRITICAL: Arrays store expansion FROM ROOT (not full session range)
// up_expansion = session_high - root_price
// dn_expansion = root_price - session_low
// Zero values are filtered out before percentile calculation
```

#### 2.2 AMRP Helper Functions
```pine
// Calculate percentile from sorted array
calculate_percentile(arr, pct) =>
    result = 0.0
    if array.size(arr) > 0
        sorted = array.copy(arr)
        array.sort(sorted, order.ascending)
        idx = math.floor(array.size(sorted) * pct / 100.0)
        idx := math.max(0, math.min(idx, array.size(sorted) - 1))
        result := array.get(sorted, idx)
    result

// Calculate IQR (Interquartile Range) - returns Q1 and Q3
calculate_iqr(arr) =>
    q1 = 0.0
    q3 = 0.0
    if array.size(arr) > 0
        q1 := calculate_percentile(arr, 25)  // Q1 = 25th percentile = inner boundary
        q3 := calculate_percentile(arr, 75)  // Q3 = 75th percentile = outer boundary
    [q1, q3]

// Filter zeros from array (zero expansion values are invalid)
filter_zeros(arr) =>
    filtered = array.new<float>()
    if array.size(arr) > 0
        for i = 0 to array.size(arr) - 1
            val = array.get(arr, i)
            if val > 0.0
                array.push(filtered, val)
    filtered

// Get AMRP percentiles for a session (with optional custom lookback for Compare 3 mode)
get_amrp_percentiles(session_name, custom_lookback = 0) =>
    up_inner = 0.0
    up_outer = 0.0
    dn_inner = 0.0
    dn_outer = 0.0
    has_data = false

    // Select correct arrays based on session name
    up_arr_full = session_name == SESSION_ISCARIOT ? amrp_iscariot_up :
                  session_name == SESSION_ARIES ? amrp_aries_up :
                  session_name == SESSION_ASH ? amrp_ash_up :
                  session_name == SESSION_ICARUS ? amrp_icarus_up : array.new<float>()

    dn_arr_full = session_name == SESSION_ISCARIOT ? amrp_iscariot_dn :
                  session_name == SESSION_ARIES ? amrp_aries_dn :
                  session_name == SESSION_ASH ? amrp_ash_dn :
                  session_name == SESSION_ICARUS ? amrp_icarus_dn : array.new<float>()

    // Filter zeros
    up_arr_filtered = filter_zeros(up_arr_full)
    dn_arr_filtered = filter_zeros(dn_arr_full)

    // Apply custom lookback if specified (for Compare 3 mode)
    up_arr = custom_lookback > 0 and array.size(up_arr_filtered) > custom_lookback ?
             array.slice(up_arr_filtered, 0, custom_lookback) : up_arr_filtered
    dn_arr = custom_lookback > 0 and array.size(dn_arr_filtered) > custom_lookback ?
             array.slice(dn_arr_filtered, 0, custom_lookback) : dn_arr_filtered

    // Calculate IQR percentiles
    if array.size(up_arr) > 0 and array.size(dn_arr) > 0
        [up_q1, up_q3] = calculate_iqr(up_arr)
        [dn_q1, dn_q3] = calculate_iqr(dn_arr)
        up_inner := up_q1  // Q1 = inner boundary
        up_outer := up_q3  // Q3 = outer boundary
        dn_inner := dn_q1
        dn_outer := dn_q3
        has_data := true

    [up_inner, up_outer, dn_inner, dn_outer, has_data]
```

**Reference:** Intraday lines 820-1050 (percentile, IQR, filter_zeros, get_amrp_percentiles functions)

---

#### 2.3 AMRP Calculation at Session Completion
```pine
// ⚠️ When session ends (PASS 1: Session END detection)
if time_matches(template.end_day, template.end_time)
    // Find most recent active session
    DttWeeklySession completing_sess = // ... find logic ...

    if not na(completing_sess) and completing_sess.root_price > 0
        // Calculate expansion values
        float up_expansion = completing_sess.session_high - completing_sess.root_price
        float dn_expansion = completing_sess.root_price - completing_sess.session_low

        // Store in appropriate array
        if completing_sess.name == SESSION_ISCARIOT
            array.unshift(amrp_iscariot_up, up_expansion)
            array.unshift(amrp_iscariot_dn, dn_expansion)
        else if completing_sess.name == SESSION_ARIES
            array.unshift(amrp_aries_up, up_expansion)
            array.unshift(amrp_aries_dn, dn_expansion)
        else if completing_sess.name == SESSION_ASH
            array.unshift(amrp_ash_up, up_expansion)
            array.unshift(amrp_ash_dn, dn_expansion)
        else if completing_sess.name == SESSION_ICARUS
            array.unshift(amrp_icarus_up, up_expansion)
            array.unshift(amrp_icarus_dn, dn_expansion)

        // ⚠️ Keep max 15 values per array (memory management)
        // Weekly sessions = 4 per week, 15 = ~3.75 weeks of history
        int max_amrp_history = 15
        if array.size(amrp_iscariot_up) > max_amrp_history
            array.pop(amrp_iscariot_up)
            array.pop(amrp_iscariot_dn)
        // ... repeat for other session types ...
```

**Reference:** Intraday AMRP storage pattern (session completion updates AMRP arrays)

---

#### 2.4 AMRP Zone Drawing (At Session Creation)
```pine
// ⚠️ At session creation (PASS 2: Session START)
if show_amrp and time_matches(template.start_day, template.start_time)
    DttWeeklySession new_session = // ... creation logic ...

    // Get AMRP percentiles based on mode
    float up_inner = 0.0
    float up_outer = 0.0
    float dn_inner = 0.0
    float dn_outer = 0.0
    bool has_data = false

    if amrp_lookback_mode == "Manual"
        // Single lookback
        [up_inner, up_outer, dn_inner, dn_outer, has_data] =
            get_amrp_percentiles(template.name, amrp_lookback)
    else if amrp_lookback_mode == "Compare 3"
        // Get all 3 lookbacks (4, 6, 9)
        [up_inner_4, up_outer_4, dn_inner_4, dn_outer_4, has_data_4] =
            get_amrp_percentiles(template.name, 4)
        [up_inner_6, up_outer_6, dn_inner_6, dn_outer_6, has_data_6] =
            get_amrp_percentiles(template.name, 6)
        [up_inner_9, up_outer_9, dn_inner_9, dn_outer_9, has_data_9] =
            get_amrp_percentiles(template.name, 9)

        // Use largest zones (most conservative)
        up_inner := math.max(up_inner_4, math.max(up_inner_6, up_inner_9))
        up_outer := math.max(up_outer_4, math.max(up_outer_6, up_outer_9))
        dn_inner := math.max(dn_inner_4, math.max(dn_inner_6, dn_inner_9))
        dn_outer := math.max(dn_outer_4, math.max(dn_outer_6, dn_outer_9))
        has_data := has_data_4 or has_data_6 or has_data_9

    if has_data and new_session.root_price > 0
        // Calculate zone boundaries FROM ROOT
        new_session.amrp_up_inner := new_session.root_price + up_inner
        new_session.amrp_up_outer := new_session.root_price + up_outer
        new_session.amrp_dn_inner := new_session.root_price - dn_inner
        new_session.amrp_dn_outer := new_session.root_price - dn_outer

        // Draw AMRP boxes (upper and lower zones)
        int amrp_end_time = new_session.end_timestamp  // Extend to session end
        new_session.amrp_up_box := box.new(
            new_session.start_timestamp, new_session.amrp_up_outer,
            amrp_end_time, new_session.amrp_up_inner,
            border_color=color.new(amrp_zone_color, 100),
            bgcolor=amrp_zone_color
        )
        new_session.amrp_dn_box := box.new(
            new_session.start_timestamp, new_session.amrp_dn_inner,
            amrp_end_time, new_session.amrp_dn_outer,
            border_color=color.new(amrp_zone_color, 100),
            bgcolor=amrp_zone_color
        )

        // Draw EQ lines (midpoint of each zone)
        if show_amrp_eq
            float up_eq = (new_session.amrp_up_inner + new_session.amrp_up_outer) / 2
            float dn_eq = (new_session.amrp_dn_inner + new_session.amrp_dn_outer) / 2
            new_session.amrp_up_eq_line := line.new(
                new_session.start_timestamp, up_eq, amrp_end_time, up_eq,
                color=amrp_eq_color, style=amrp_eq_style_converted
            )
            new_session.amrp_dn_eq_line := line.new(
                new_session.start_timestamp, dn_eq, amrp_end_time, dn_eq,
                color=amrp_eq_color, style=amrp_eq_style_converted
            )

        new_session.amrp_drawn := true
```

**Reference:** Intraday AMRP zone drawing logic (boxes and EQ lines)

---

#### 2.5 AMRP Deviation Projections
```pine
// ⚠️ Draw deviation projections when price breaks outer zones
// Run in visual update loop on EVERY bar for active sessions

for i = 0 to array.size(session_instances) - 1
    sess = array.get(session_instances, i)

    // Only for sessions with AMRP drawn
    if sess.amrp_drawn and not na(sess.amrp_up_outer)

        // Check if price broke above upper outer zone
        if high > sess.amrp_up_outer and not sess.amrp_broke_up
            sess.amrp_broke_up := true

            // Calculate zone size (outer - inner)
            float zone_size = sess.amrp_up_outer - sess.amrp_up_inner

            // Parse projection multipliers from input string
            // Example: "1, 2, 2.5, 4" → [1.0, 2.0, 2.5, 4.0]

            // Draw projection lines
            if show_deviation_projections and not sess.amrp_up_projections_drawn
                float proj1 = sess.amrp_up_outer + (zone_size * multiplier1)
                sess.amrp_up_proj1 := line.new(
                    sess.start_timestamp, proj1, sess.end_timestamp, proj1,
                    color=projection_color, style=projection_style_converted
                )

                // Add projection labels at session end boundary
                if show_projection_labels
                    sess.amrp_up_proj1_label := label.new(
                        sess.end_timestamp, proj1, "-" + str.tostring(multiplier1),
                        style=label.style_none, color=projection_color
                    )

                // Repeat for proj2, proj3, proj4...

                sess.amrp_up_projections_drawn := true

        // Repeat for lower projections (amrp_broke_dn)
```

**Reference:** Intraday deviation projection drawing logic

**Lesson:** Projections are DYNAMIC - drawn when price breaks zones, not at session creation.

---

#### 2.6 Dynamic Fibonacci Implementation
```pine
// ⚠️ Draw Fibonacci levels for last N sessions
// Run in visual update loop

if show_fib
    // Get last N sessions
    int fib_start_idx = math.max(0, array.size(session_instances) - fib_last_n_sessions)

    for i = fib_start_idx to array.size(session_instances) - 1
        sess = array.get(session_instances, i)

        if not sess.fib_drawn and sess.amrp_drawn
            // Initialize anchors to AMRP outer boundaries
            sess.fib_high_anchor := sess.amrp_up_outer
            sess.fib_low_anchor := sess.amrp_dn_outer

            // Draw Fibonacci levels (7 levels)
            float fib_range = sess.fib_high_anchor - sess.fib_low_anchor

            // 0% level (low anchor)
            if show_fib_0
                sess.fib_line_0 := line.new(
                    sess.start_timestamp, sess.fib_low_anchor,
                    sess.end_timestamp, sess.fib_low_anchor,
                    color=fib_color_0, width=fib_width, style=fib_style_converted
                )
                if show_fib_labels
                    sess.fib_label_0 := label.new(
                        sess.end_timestamp, sess.fib_low_anchor, "0",
                        style=label.style_none, color=fib_color_0
                    )

            // 29.5% level
            if show_fib_295
                float level_295 = sess.fib_low_anchor + (fib_range * 0.295)
                sess.fib_line_295 := line.new(...)
                // ... repeat pattern ...

            // 38.2%, 50%, 61.8%, 70.5%, 100% levels
            // ... (similar pattern for each level) ...

            sess.fib_drawn := true

        // ⚠️ DYNAMIC TRAILING: Update anchors if price breaks AMRP
        if sess.fib_drawn
            // If price broke above AMRP, trail high anchor with session high
            if sess.session_high > sess.amrp_up_outer
                sess.fib_high_anchor := sess.session_high

            // If price broke below AMRP, trail low anchor with session low
            if sess.session_low < sess.amrp_dn_outer
                sess.fib_low_anchor := sess.session_low

            // Recalculate and update all Fibonacci line y2 coordinates
            float fib_range = sess.fib_high_anchor - sess.fib_low_anchor

            if not na(sess.fib_line_0)
                line.set_y1(sess.fib_line_0, sess.fib_low_anchor)
                line.set_y2(sess.fib_line_0, sess.fib_low_anchor)

            if not na(sess.fib_line_295)
                float level_295 = sess.fib_low_anchor + (fib_range * 0.295)
                line.set_y1(sess.fib_line_295, level_295)
                line.set_y2(sess.fib_line_295, level_295)

            // ... update remaining levels ...
```

**Reference:** Intraday Dynamic Fibonacci implementation (lines with trailing anchor updates)

**CRITICAL:** Fibonacci levels are DYNAMIC. They start anchored to AMRP outer boundaries, but trail with session high/low if price breaks AMRP zones.

---

### Testing Requirements (Phase 2)

#### AMRP Zones
- [ ] Zones appear at session start (not before root capture)
- [ ] Zones extend from session start to session end
- [ ] Inner boundaries use Q1 (25th percentile)
- [ ] Outer boundaries use Q3 (75th percentile)
- [ ] Zones are symmetric around root price
- [ ] EQ lines at midpoint of each zone
- [ ] Compare 3 mode shows overlay of 3 lookbacks (4, 6, 9)
- [ ] Zero expansion values filtered out

#### AMRP Projections
- [ ] Projections only draw when price breaks outer zone
- [ ] Upper projections when price > upper outer
- [ ] Lower projections when price < lower outer
- [ ] Projection multipliers parse correctly ("1, 2, 2.5, 4")
- [ ] Labels show multiplier value ("-1", "-2", etc.)
- [ ] Projections extend from session start to session end

#### Dynamic Fibonacci
- [ ] Fibonacci levels show for last N sessions (default: 1)
- [ ] Initially anchored to AMRP outer boundaries
- [ ] High anchor trails session_high when price breaks above AMRP
- [ ] Low anchor trails session_low when price breaks below AMRP
- [ ] All 7 levels calculate correctly (0%, 29.5%, 38.2%, 50%, 61.8%, 70.5%, 100%)
- [ ] Individual level enable/disable works
- [ ] Labels show level percentage

#### Performance
- [ ] AMRP disabled by default (user enables with toggle)
- [ ] Fibonacci disabled by default
- [ ] No lag when enabling AMRP on default settings (1 week)
- [ ] AMRP arrays capped at 15 values per session type
- [ ] Visual elements use flags to prevent redrawing

---

## Phase 3: Analytics Tables (After Phase 2 Tested)

### Prerequisites
- ✅ Phase 2 fully tested and working
- ✅ AMRP zones displaying correctly
- ✅ AMRP data being collected and stored in arrays
- ✅ Session high/low tracking accurate

### Architecture Notes
**CRITICAL:** Analytics tables require session completion data. Tables display rolling window of last N sessions.

**Performance:** Tables disabled by default. Enable individually with toggles.

---

### Components

#### 3.1 AMRP Range Analysis Table
**Purpose:** Display Expected vs Actual range for each session with % filled and room left

**Display Modes:**
- **All Models**: Last 15 sessions (rolling window)
- **Active Only**: Only currently active session

**Table Structure:**
```
┌─────────────┬──────────┬──────────┬──────────┬──────────┐
│ Session     │ Expected │ Actual   │ % Filled │ Room     │
├─────────────┼──────────┼──────────┼──────────┼──────────┤
│ Iscariot    │ 150.0    │ 120.5    │ 80.3%    │ 29.5     │
│ Aries       │ 200.0    │ 195.2    │ 97.6%    │ 4.8      │
│ Ash         │ 180.0    │ 210.3    │ 116.8%   │ -30.3    │
│ Icarus      │ 250.0    │ 180.0    │ 72.0%    │ 70.0     │
└─────────────┴──────────┴──────────┴──────────┴──────────┘
```

**Implementation:**
```pine
// ⚠️ Create table once at bar initialization
var table range_analysis_table = na

if show_range_analysis
    if barstate.isfirst or na(range_analysis_table)
        // Convert position inputs to table position constants
        h_pos = range_analysis_horizontal == POSITION_LEFT ? position.top_left :
                range_analysis_horizontal == POSITION_RIGHT ? position.top_right :
                position.top_center

        v_offset = range_analysis_vertical == POSITION_TOP ? "" :
                   range_analysis_vertical == POSITION_BOTTOM ? "bottom_" : "middle_"

        final_pos = str.replace(str.tostring(h_pos), "top_", v_offset)

        range_analysis_table := table.new(final_pos, 5, 17)  // 5 cols, 17 rows (header + 16 sessions max)

    // Update table on every bar
    if barstate.islast
        table.clear(range_analysis_table, 0, 0, 4, 16)

        // Header row
        table.cell(range_analysis_table, 0, 0, "Session", text_color=color.white, bgcolor=color.new(color.gray, 70))
        table.cell(range_analysis_table, 1, 0, "Expected", text_color=color.white, bgcolor=color.new(color.gray, 70))
        table.cell(range_analysis_table, 2, 0, "Actual", text_color=color.white, bgcolor=color.new(color.gray, 70))
        table.cell(range_analysis_table, 3, 0, "% Filled", text_color=color.white, bgcolor=color.new(color.gray, 70))
        table.cell(range_analysis_table, 4, 0, "Room", text_color=color.white, bgcolor=color.new(color.gray, 70))

        // Data rows
        int row = 1
        int sessions_to_show = range_analysis_display == DISPLAY_ACTIVE_ONLY ? 1 : 15
        int start_idx = math.max(0, array.size(session_instances) - sessions_to_show)

        for i = start_idx to array.size(session_instances) - 1
            sess = array.get(session_instances, i)

            // Calculate expected range (AMRP outer up + AMRP outer down)
            float expected_range = sess.amrp_up_outer - sess.root_price +
                                   sess.root_price - sess.amrp_dn_outer

            // Calculate actual range (session_high - session_low)
            float actual_range = sess.session_high - sess.session_low

            // Calculate % filled
            float pct_filled = expected_range > 0 ? (actual_range / expected_range) * 100 : 0

            // Calculate room left
            float room_left = expected_range - actual_range

            // Color coding for % filled
            color pct_color = pct_filled >= 100 ? color.new(color.red, 70) :
                             pct_filled >= 80 ? color.new(color.orange, 70) :
                             color.new(color.green, 70)

            // Populate table cells
            table.cell(range_analysis_table, 0, row, sess.name,
                      text_color=color.white, bgcolor=color.new(color.gray, 80))
            table.cell(range_analysis_table, 1, row, str.tostring(expected_range, "#.#"),
                      text_color=color.white, bgcolor=color.new(color.gray, 80))
            table.cell(range_analysis_table, 2, row, str.tostring(actual_range, "#.#"),
                      text_color=color.white, bgcolor=color.new(color.gray, 80))
            table.cell(range_analysis_table, 3, row, str.tostring(pct_filled, "#.#") + "%",
                      text_color=color.white, bgcolor=pct_color)
            table.cell(range_analysis_table, 4, row, str.tostring(room_left, "#.#"),
                      text_color=color.white, bgcolor=color.new(color.gray, 80))

            row += 1
```

**Reference:** Intraday Range Analysis table implementation

---

#### 3.2 AMRP Accuracy Table
**Purpose:** Statistical performance tracking for AMRP predictions

**Modes:**
- **Single Session**: Detailed analysis for one specific session type
- **Auto-Score**: Automated scoring system across all sessions

**Single Session Mode Table Structure:**
```
┌───────────────────────────────────┐
│ AMRP ACCURACY                     │
├───────────────────────────────────┤
│ Session:    Iscariot              │
│ Method:     IQR                   │
│ Lookback:   9                     │
├───────────────────────────────────┤
│ Within Inner:    65.2%            │
│ Within Outer:    89.1%            │
│ Broke Outer:     10.9%            │
├───────────────────────────────────┤
│ Total Bars:      150              │
│ Inner Bars:      98               │
│ Outer Bars:      134              │
│ Broke Bars:      16               │
└───────────────────────────────────┘
```

**Implementation:**
```pine
// ⚠️ Track AMRP accuracy during active sessions
// Run in high/low tracking loop

if sess.amrp_drawn and not na(sess.amrp_up_outer)
    // Increment total bars
    sess.amrp_bars_total := sess.amrp_bars_total + 1

    // Check price position relative to AMRP zones
    bool within_inner = high <= sess.amrp_up_inner and low >= sess.amrp_dn_inner
    bool within_outer = high <= sess.amrp_up_outer and low >= sess.amrp_dn_outer
    bool broke_outer = high > sess.amrp_up_outer or low < sess.amrp_dn_outer

    if within_inner
        sess.amrp_bars_within_inner := sess.amrp_bars_within_inner + 1

    if within_outer
        sess.amrp_bars_within_outer := sess.amrp_bars_within_outer + 1

    if broke_outer
        sess.amrp_bars_broke_outer := sess.amrp_bars_broke_outer + 1

// ⚠️ Display table
var table accuracy_table = na

if show_amrp_accuracy and amrp_accuracy_mode == "Single Session"
    if barstate.isfirst or na(accuracy_table)
        accuracy_table := table.new(position.middle_center, 3, 12)

    if barstate.islast
        // Find most recent completed session matching selected session name
        DttWeeklySession target_sess = na
        for i = array.size(session_instances) - 1 to 0
            sess = array.get(session_instances, i)
            if sess.name == amrp_accuracy_session and not na(sess.end_bar)
                target_sess := sess
                break

        if not na(target_sess) and target_sess.amrp_bars_total > 0
            // Calculate percentages
            float pct_inner = (target_sess.amrp_bars_within_inner / target_sess.amrp_bars_total) * 100
            float pct_outer = (target_sess.amrp_bars_within_outer / target_sess.amrp_bars_total) * 100
            float pct_broke = (target_sess.amrp_bars_broke_outer / target_sess.amrp_bars_total) * 100

            // Populate table
            table.cell(accuracy_table, 0, 0, "AMRP ACCURACY", bgcolor=color.new(color.purple, 50))
            table.merge_cells(accuracy_table, 0, 0, 2, 0)

            table.cell(accuracy_table, 0, 1, "Session", text_color=color.gray)
            table.cell(accuracy_table, 1, 1, target_sess.name, text_color=color.white)
            table.merge_cells(accuracy_table, 1, 1, 2, 1)

            table.cell(accuracy_table, 0, 2, "Method", text_color=color.gray)
            table.cell(accuracy_table, 1, 2, "IQR", text_color=color.white)
            table.merge_cells(accuracy_table, 1, 2, 2, 2)

            table.cell(accuracy_table, 0, 3, "Lookback", text_color=color.gray)
            table.cell(accuracy_table, 1, 3, str.tostring(amrp_lookback), text_color=color.white)
            table.merge_cells(accuracy_table, 1, 3, 2, 3)

            // Performance metrics
            table.cell(accuracy_table, 0, 5, "Within Inner:", text_color=color.white)
            table.cell(accuracy_table, 1, 5, str.tostring(pct_inner, "#.#") + "%", text_color=color.green)
            table.merge_cells(accuracy_table, 1, 5, 2, 5)

            table.cell(accuracy_table, 0, 6, "Within Outer:", text_color=color.white)
            table.cell(accuracy_table, 1, 6, str.tostring(pct_outer, "#.#") + "%", text_color=color.yellow)
            table.merge_cells(accuracy_table, 1, 6, 2, 6)

            table.cell(accuracy_table, 0, 7, "Broke Outer:", text_color=color.white)
            table.cell(accuracy_table, 1, 7, str.tostring(pct_broke, "#.#") + "%", text_color=color.red)
            table.merge_cells(accuracy_table, 1, 7, 2, 7)

            // Raw counts
            table.cell(accuracy_table, 0, 9, "Total Bars:", text_color=color.gray)
            table.cell(accuracy_table, 1, 9, str.tostring(target_sess.amrp_bars_total), text_color=color.white)
            table.merge_cells(accuracy_table, 1, 9, 2, 9)

            table.cell(accuracy_table, 0, 10, "Inner Bars:", text_color=color.gray)
            table.cell(accuracy_table, 1, 10, str.tostring(target_sess.amrp_bars_within_inner), text_color=color.white)
            table.merge_cells(accuracy_table, 1, 10, 2, 10)

            table.cell(accuracy_table, 0, 11, "Outer Bars:", text_color=color.gray)
            table.cell(accuracy_table, 1, 11, str.tostring(target_sess.amrp_bars_within_outer), text_color=color.white)
            table.merge_cells(accuracy_table, 1, 11, 2, 11)
```

**Reference:** Intraday AMRP Accuracy table implementation (lines 2580-2700)

**Auto-Score Mode:** Similar to Single Session but calculates aggregate score across all completed sessions. Displays overall AMRP effectiveness rating.

---

### Testing Requirements (Phase 3)

#### Range Analysis Table
- [ ] Table displays for "All Models" mode (last 15 sessions)
- [ ] Table displays for "Active Only" mode (current session)
- [ ] Expected range = AMRP outer up + AMRP outer down
- [ ] Actual range = session_high - session_low
- [ ] % Filled = (actual / expected) * 100
- [ ] Room left = expected - actual
- [ ] Color coding: Red (≥100%), Orange (≥80%), Green (<80%)
- [ ] Position controls work (9-position grid)
- [ ] Text size controls work

#### Accuracy Table
- [ ] Single Session mode shows selected session stats
- [ ] Within Inner % calculates correctly
- [ ] Within Outer % calculates correctly
- [ ] Broke Outer % calculates correctly
- [ ] Raw bar counts match percentages
- [ ] Auto-Score mode shows aggregate rating
- [ ] Table updates in real-time for active sessions
- [ ] Position controls work

#### Performance
- [ ] Tables disabled by default
- [ ] No lag when enabling tables on default settings
- [ ] Table updates only on last bar (barstate.islast)
- [ ] Table clearing efficient (clear before rebuild)

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
// At session creation (current implementation lines ~420-430)
DttWeeklySession prev_sess_for_lines = get_previous_session(template.name)
if show_high_low_lines and not na(prev_sess_for_lines.name) and
   prev_sess_for_lines.session_high < 1e9 and prev_sess_for_lines.session_low > -1e9
    new_session.high_line := line.new(time, prev_sess_for_lines.session_high, calculated_end_timestamp, prev_sess_for_lines.session_high, ...)
    new_session.low_line := line.new(time, prev_sess_for_lines.session_low, calculated_end_timestamp, prev_sess_for_lines.session_low, ...)
```

**Reference**: Subminute lines 417-418. High/low lines drawn ONCE at session creation.

**Lesson**: High/low lines are STATIC horizontal lines created once, never updated. They show PREVIOUS session's data.

**Note:** Current implementation uses `high_line` and `low_line` terminology (not "pool").

---

### 🔴 Bug #6: High/Low Lines Repeating When N Incremented
**Problem**: When user changed "Show Last N Weeks" from 1 to 2, high/low lines repeated the first week's data instead of calculating new data for week 2.

**Root Cause**: High/low lines being drawn/updated in visual loop on every bar, picking up stale session data.

**Fix**: Same as Bug #5 - draw at session creation, not in loop.

**Lesson**: Visual elements drawn in loops will always have stale data issues. Create them ONCE at the right time.

**Note:** Current implementation uses `high_line` and `low_line` fields in the type definition.

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
    new_session.high_line := line.new(...)  // Previous session's high
    new_session.low_line := line.new(...)   // Previous session's low

// ❌ WRONG: Create/update in visual loop
for i = 0 to total_sessions - 1
    if na(sess.high_line)
        sess.high_line := line.new(...)  // Don't do this!
```

**Why**: Creating visual elements in loops causes them to get stale data and wrong timestamps.

**Note:** Current implementation uses `high_line` and `low_line` terminology.

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
