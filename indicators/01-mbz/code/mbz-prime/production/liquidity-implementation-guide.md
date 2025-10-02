# Liquidity Pool Implementation Guide
## Step-by-Step Template for Adding New Intraday Sessions to MBZ Prime

This guide documents the complete process for implementing a new liquidity pool (session) in MBZ Prime. Follow these steps in order for any new session (NY AM, NY PM, Lunch, etc.).

---

## Example: London Session Implementation

This guide uses the **London session** as the reference implementation. Simply replace "London" / "london" with your new session name.

---

## Step 1: Session Constants & Configuration

**Location**: Lines ~60-106 (Constants section)

### 1.1 Add Source Type Constant
```pine
LIQUIDITY_SOURCE_TYPE_LONDON = "london"
```
**After**: `LIQUIDITY_SOURCE_TYPE_ASIA`

### 1.2 Add Display Label
```pine
LIQUIDITY_LABEL_LONDON = "London"
```
**After**: `LIQUIDITY_LABEL_ASIA`

### 1.3 Add Short Label
```pine
LIQUIDITY_SHORT_LONDON = "L"
```
**After**: `LIQUIDITY_SHORT_ASIA`

### 1.4 Add Scan Cap
```pine
LONDON_LIQUIDITY_SCAN_CAP = 50        // Scan last 50 London sessions (~10 weeks)
```
**After**: `ASIA_LIQUIDITY_SCAN_CAP`

### 1.5 Add Timeframe Restriction
```pine
MAX_TF_LONDON_LIQUIDITY = 45          // London: show on 45m and below (timeframe must be <= 45m)
```
**After**: `MAX_TF_ASIA_LIQUIDITY`
**Note**: Changed from 15m to 45m to eliminate timeframe gaps (see Version History v1.1)

### 1.6 Add Default Session Time
```pine
DEFAULT_LONDON_SESSION_TIME = "0200-0500:23456"  // 2am-5am NY, Mon-Sat
```
**After**: `DEFAULT_ASIA_SESSION_TIME`

**Format**: `"HHMM-HHMM:DAYS"` where days are 23456 (Mon-Fri) or 23456 (Mon-Sat)
**Timezone**: All times in NY timezone

### 1.7 Add Default Line Width
```pine
DEFAULT_LONDON_LIQUIDITY_LINE_WIDTH = 1
```
**After**: `DEFAULT_ASIA_LIQUIDITY_LINE_WIDTH`

**Note**: Intraday sessions typically use width = 1

---

## Step 2: Alert Constants

**Location**: Lines ~400-430 (Alert constants section)

### 2.1 Add Alert Titles
```pine
ALERT_TITLE_LONDON_MBZ_PLUS = "London MBZ⁺"
ALERT_TITLE_LONDON_MBZ_MINUS = "London MBZ⁻"
```
**After**: `ALERT_TITLE_ASIA_MBZ_MINUS`

### 2.2 Add Alert Messages
```pine
ALERT_MSG_LONDON_MBZ_PLUS = "London MBZ⁺"
ALERT_MSG_LONDON_MBZ_MINUS = "London MBZ⁻"
```
**After**: `ALERT_MSG_ASIA_MBZ_MINUS`

---

## Step 3: Input Settings

**Location**: Lines ~455-485 (Input settings)

### 3.1 Add Session Enable & Time Input
```pine
enable_london_liquidity = input.bool(true, 'London Session', group=GROUP_LIQUIDITY_SOURCE_TYPES, inline='liq_london', tooltip='Detect MBZs from London session high/low breaches (only on 45m or lower timeframes)')
london_session_time = input.session(DEFAULT_LONDON_SESSION_TIME, 'Time', group=GROUP_LIQUIDITY_SOURCE_TYPES, inline='liq_london', tooltip='London session time range in NY timezone (default: 0200-0500 = 2am-5am)')
```
**After**: `asia_session_time` input
**Pattern**: Use `inline='liq_XXX'` to group session enable + time on same line
**Note**: Tooltip updated to reflect 45m timeframe (was 15m)

### 3.2 Add Source Origins Display Inputs
```pine
show_london_liquidity_lines = input.bool(true, LIQUIDITY_LABEL_LONDON, group=GROUP_SOURCE_ORIGINS, inline='src8', tooltip='Show London session liquidity pool level lines (horizontal lines at London session highs/lows that spawned MBZs)')
london_liquidity_color = input.color(color.new(#00bcd4, 0), '', group=GROUP_SOURCE_ORIGINS, inline='src8', tooltip='Line color for London session liquidity pool levels')
london_liquidity_line_width = input.int(DEFAULT_LONDON_LIQUIDITY_LINE_WIDTH, INPUT_LABEL_WIDTH, minval=MIN_BORDER_WIDTH, maxval=MAX_BORDER_WIDTH, group=GROUP_SOURCE_ORIGINS, inline='src8', tooltip='Line thickness for London session liquidity pool level lines')
show_london_liquidity_labels = input.bool(true, INPUT_LABEL_SHOW_DATE, group=GROUP_SOURCE_ORIGINS, inline='src8', tooltip='Show date/time labels on London session liquidity pool lines (format set by Label Format setting)')
```
**After**: Asia liquidity inputs
**Increment**: `inline='src8'` (next number after last session)
**Color**: **CRITICAL - Use cyan `#00bcd4` for ALL intraday sessions (Asia, London, NY AM, Lunch, NY PM)**

### 3.3 Add Alert Enable Inputs
```pine
enable_london_mbz_plus = input.bool(true, ALERT_TITLE_LONDON_MBZ_PLUS, group=GROUP_ALERT_SETTINGS, inline="liq5", tooltip=ALERT_TOOLTIP_PREFIX + ALERT_TITLE_LONDON_MBZ_PLUS + ALERT_TOOLTIP_SUFFIX)
enable_london_mbz_minus = input.bool(true, ALERT_TITLE_LONDON_MBZ_MINUS, group=GROUP_ALERT_SETTINGS, inline="liq5", tooltip=ALERT_TOOLTIP_PREFIX + ALERT_TITLE_LONDON_MBZ_MINUS + ALERT_TOOLTIP_SUFFIX)
```
**After**: Asia alert inputs
**Increment**: `inline="liq5"` (next number after last session)

---

## Step 4: Data Structures & Variables

### 4.1 Update SourceTypeStats Type
**Location**: Line ~734

```pine
type SourceTypeStats
    int group_size
    int distinct_types
    int liquidity_daily_count
    int liquidity_weekly_count
    int liquidity_monthly_count
    int liquidity_asia_count
    int liquidity_london_count      // ADD THIS
    int liquidity_total_count
```

### 4.2 Add Visual Arrays
**Location**: Lines ~780-785

```pine
// London session liquidity tracking
var array<line> london_liquidity_lines = array.new<line>()
var array<label> london_liquidity_labels = array.new<label>()
```
**After**: Asia liquidity arrays

### 4.3 Add Profiling Variables
**Location**: Lines ~803-822

```pine
var int profile_london_liq_added = 0           // After profile_asia_liq_added
var int profile_london_liq_total = 0           // After profile_asia_liq_total
var int profile_london_sessions = 0            // After profile_asia_sessions
var int profile_london_liq_invalidated = 0     // After profile_asia_liq_invalidated
```

### 4.4 Add Liquidity Pool Instance
**Location**: Lines ~1202-1205

```pine
// Initialize London session liquidity pool instance
var LiquidityPoolCollection london_session_pool = create_liquidity_pool()
```
**After**: `asia_session_pool`

---

## Step 5: Alert Variables

**Location**: Lines ~26-29 (Top of file, after other alert vars)

```pine
london_mbz_bullish_formed = false
london_mbz_bearish_formed = false
```
**After**: `asia_mbz_bearish_formed`

---

## Step 6: Session Tracking Logic

**Location**: Lines ~4058-4081 (After Asia session tracking)

### 6.1 Add Timeframe Check
```pine
enable_london_liquidity_tracking = current_tf_minutes_for_tracking <= MAX_TF_LONDON_LIQUIDITY
```
**After**: `enable_asia_liquidity_tracking`

### 6.2 Add Session Tracking Block
```pine
// London session liquidity pool tracking
if enable_london_liquidity_tracking and (show_source_origins or liquidity_detection_enabled)
    in_london_session = not na(time(timeframe.period, london_session_time, NY_TIMEZONE))
    was_in_london_session = not na(time(timeframe.period, london_session_time, NY_TIMEZONE)[1])

    // Detect session boundaries
    session_just_started = in_london_session and not was_in_london_session
    session_just_ended = not in_london_session and was_in_london_session

    if session_just_ended
        // Finalize the session that just ended
        liquidity_pool_finalize_session(london_session_pool, nz(time[1], time), liquidity_pool_max_entries)

    if session_just_started
        // Start new session - always capture the start bar
        liquidity_pool_reset_current(london_session_pool, high, low, time, bar_index)

    if in_london_session
        // Update extremes during session (handles both start bar after reset and continuation bars)
        liquidity_pool_update_current_extremes(london_session_pool, high, low, time, bar_index)

    // Always mark breaches (both during and after session)
    liquidity_pool_mark_breaches(london_session_pool, high, low, time)
else if barstate.isnew
    liquidity_pool_clear_current(london_session_pool)
```
**After**: Asia session tracking block
**Copy Pattern**: Use exact same structure as Asia

---

## Step 7: MBZ Detection & Processing

**Location**: Lines ~4100-4400 (In liquidity detection section)

### 7.1 Add Scan Cap Variable
```pine
london_scan_cap = LONDON_LIQUIDITY_SCAN_CAP
```
**After**: `asia_scan_cap`

### 7.2 Add Processing Block
```pine
// Process LONDON SESSION liquidity pool (if enabled)
if enable_london_liquidity
    [london_events_is_high, london_events_rules, london_events_is_exact, london_events_source_price, london_events_source_bar_index] = process_liquidity_pool(london_session_pool, LIQUIDITY_SOURCE_TYPE_LONDON, london_scan_cap, enable_liquidity_immediate, enable_liquidity_standard, enable_liquidity_delayed, a_open, a_close, a_high, a_low, a_midpoint, b_open, b_close, b_high, b_low)

    // Create MBZ records from London session events
    london_event_count = array.size(london_events_is_high)
    if london_event_count > 0
        for event_index = 0 to london_event_count - 1
            event_is_high = array.get(london_events_is_high, event_index)
            event_rule = array.get(london_events_rules, event_index)
            event_is_exact = array.get(london_events_is_exact, event_index)
            event_source_price = array.get(london_events_source_price, event_index)
            event_source_bar_index = array.get(london_events_source_bar_index, event_index)

            pool_boundary = event_is_high ? POOL_BOUNDARY_HIGH : POOL_BOUNDARY_LOW
            is_bullish_event = not event_is_high

            [_,
             formed_bull_flag,
             formed_bear_flag,
             strong_plus_flag,
             strong_minus_flag,
             multi_plus_flag,
             multi_minus_flag,
             nested_plus_flag,
             nested_minus_flag] = create_liquidity_mbz_record(
                 bar_index,
                 b_open,
                 b_high,
                 b_low,
                 b_close,
                 LIQUIDITY_SOURCE_TYPE_LONDON,
                 pool_boundary,
                 event_rule,
                 event_source_price,
                 event_source_bar_index,
                 is_bullish_event,
                 LIQUIDITY_SOURCE_TYPE_LONDON,
                 event_is_exact,
                 london_session_pool,
                 event_is_high
             )

            if formed_bull_flag
                mbz_bullish_formed := true
                london_mbz_bullish_formed := true
            if formed_bear_flag
                mbz_bearish_formed := true
                london_mbz_bearish_formed := true
            if multi_plus_flag
                multi_source_mbz_bullish_formed := true
            if multi_minus_flag
                multi_source_mbz_bearish_formed := true
            if strong_plus_flag
                strong_mbz_bullish_formed := true
            if strong_minus_flag
                strong_mbz_bearish_formed := true
            needs_visual_update := true
```
**After**: Asia processing block
**Copy Pattern**: Identical structure to Asia, just replace session name

---

## Step 8: Source Statistics Integration

### 8.1 Update get_source_type_stats Function
**Location**: Line ~2502 (Initialization) & ~2529-2534 (Counting)

```pine
// Update initialization
stats = SourceTypeStats.new(0, 0, 0, 0, 0, 0, 0, 0)  // Add 2 zeros for Asia & London

// Add counting (after monthly check)
else if token == LIQUIDITY_SOURCE_TYPE_ASIA
    stats.liquidity_asia_count += 1
    counted_token := true
else if token == LIQUIDITY_SOURCE_TYPE_LONDON
    stats.liquidity_london_count += 1
    counted_token := true
```

### 8.2 Update build_source_breakdown Function
**Location**: Lines ~2717-2720

```pine
if stats.liquidity_asia_count > 0
    array.push(parts, format_source_token(LIQUIDITY_SOURCE_TYPE_ASIA, stats.liquidity_asia_count))
if stats.liquidity_london_count > 0
    array.push(parts, format_source_token(LIQUIDITY_SOURCE_TYPE_LONDON, stats.liquidity_london_count))
```
**After**: Monthly count check

### 8.3 Update build_source_breakdown_extension_from_stats Function
**Location**: Lines ~2742-2745

```pine
if stats.liquidity_asia_count > 0
    array.push(parts, format_source_token(LIQUIDITY_SOURCE_TYPE_ASIA, stats.liquidity_asia_count))
if stats.liquidity_london_count > 0
    array.push(parts, format_source_token(LIQUIDITY_SOURCE_TYPE_LONDON, stats.liquidity_london_count))
```
**After**: Monthly count check
**⚠️ Critical**: Missing this causes "array index out of bounds" errors!

---

## Step 8.5: Label Formatter Functions (CRITICAL)

**Location**: Lines ~909-978

### 8.5.1 Update format_liquidity_pool_time_label Function

⚠️ **CRITICAL**: This function formats date/time for liquidity pool labels. Missing London case causes "Unknown" to display.

```pine
format_liquidity_pool_time_label(pool_type, time_value) =>
    switch pool_type
        LIQUIDITY_SOURCE_TYPE_DAILY =>
            day_abbr = get_day_abbreviation(time_value)
            date_str = str.tostring(month(time_value, NY_TIMEZONE)) + '/' + str.tostring(dayofmonth(time_value, NY_TIMEZONE))
            day_abbr + ' ' + date_str
        LIQUIDITY_SOURCE_TYPE_WEEKLY =>
            // ... weekly formatting ...
        LIQUIDITY_SOURCE_TYPE_MONTHLY =>
            // ... monthly formatting ...
        LIQUIDITY_SOURCE_TYPE_ASIA =>
            day_abbr = get_day_abbreviation(time_value)
            date_str = str.tostring(month(time_value, NY_TIMEZONE)) + '/' + str.tostring(dayofmonth(time_value, NY_TIMEZONE))
            day_abbr + ' ' + date_str
        LIQUIDITY_SOURCE_TYPE_LONDON =>                    // ADD THIS CASE
            day_abbr = get_day_abbreviation(time_value)
            date_str = str.tostring(month(time_value, NY_TIMEZONE)) + '/' + str.tostring(dayofmonth(time_value, NY_TIMEZONE))
            day_abbr + ' ' + date_str
        => 'Unknown'
```

### 8.5.2 Update build_liquidity_pool_label Function

⚠️ **CRITICAL**: This function builds the final label text. Missing London case causes lowercase "london" to display instead of "London".

Add London case to **THREE** switch statements:

**1. full_prefix switch:**
```pine
full_prefix = switch pool_type
    LIQUIDITY_SOURCE_TYPE_DAILY => LIQUIDITY_LABEL_DAILY
    LIQUIDITY_SOURCE_TYPE_WEEKLY => LIQUIDITY_LABEL_WEEKLY
    LIQUIDITY_SOURCE_TYPE_MONTHLY => LIQUIDITY_LABEL_MONTHLY
    LIQUIDITY_SOURCE_TYPE_ASIA => LIQUIDITY_LABEL_ASIA
    LIQUIDITY_SOURCE_TYPE_LONDON => LIQUIDITY_LABEL_LONDON    // ADD THIS
    => pool_type
```

**2. short_prefix switch:**
```pine
short_prefix = switch pool_type
    LIQUIDITY_SOURCE_TYPE_DAILY => LIQUIDITY_SHORT_DAILY
    LIQUIDITY_SOURCE_TYPE_WEEKLY => LIQUIDITY_SHORT_WEEKLY
    LIQUIDITY_SOURCE_TYPE_MONTHLY => LIQUIDITY_SHORT_MONTHLY
    LIQUIDITY_SOURCE_TYPE_ASIA => LIQUIDITY_SHORT_ASIA
    LIQUIDITY_SOURCE_TYPE_LONDON => LIQUIDITY_SHORT_LONDON    // ADD THIS
    => pool_type
```

**3. date_only switch:**
```pine
date_only = switch pool_type
    LIQUIDITY_SOURCE_TYPE_DAILY =>
        str.tostring(month(time_value, NY_TIMEZONE)) + '/' + str.tostring(dayofmonth(time_value, NY_TIMEZONE))
    LIQUIDITY_SOURCE_TYPE_ASIA =>
        str.tostring(month(time_value, NY_TIMEZONE)) + '/' + str.tostring(dayofmonth(time_value, NY_TIMEZONE))
    LIQUIDITY_SOURCE_TYPE_LONDON =>                           // ADD THIS
        str.tostring(month(time_value, NY_TIMEZONE)) + '/' + str.tostring(dayofmonth(time_value, NY_TIMEZONE))
    LIQUIDITY_SOURCE_TYPE_WEEKLY =>
        // ... weekly formatting ...
    LIQUIDITY_SOURCE_TYPE_MONTHLY =>
        // ... monthly formatting ...
    => 'Unknown'
```

**Bug Impact**: Without these cases, London labels display lowercase "london" or "Unknown"

---

## Step 9: Visual Rendering

**Location**: Lines ~3350-3365 (Cleanup) & ~3893-3952 (Rendering)

### 9.1 Add Cleanup in Visual Update
```pine
for liq_line in london_liquidity_lines
    line.delete(liq_line)
array.clear(london_liquidity_lines)

for liq_label in london_liquidity_labels
    label.delete(liq_label)
array.clear(london_liquidity_labels)
```
**After**: Asia cleanup

### 9.2 Add Deduplication Array
```pine
displayed_london_levels = array.new_float()
```
**After**: `displayed_asia_levels` (around line 3458)

### 9.3 Add Source Origin Rendering
```pine
// London session liquidity source line creation
if show_source_origins and show_london_liquidity_lines
    for current_mbz_index = 0 to array.size(current_consolidated_mbz.mbz_group) - 1
        // Check capacity before processing each MBZ
        if array.size(london_liquidity_lines) >= max_source_displays_effective
            break

        current_mbz_in_group = array.get(current_consolidated_mbz.mbz_group, current_mbz_index)

        if current_mbz_in_group.source_family != SOURCE_FAMILY_LIQUIDITY
            continue

        if current_mbz_in_group.source_origin_token != LIQUIDITY_SOURCE_TYPE_LONDON
            continue

        source_price_key = current_mbz_in_group.source_high
        if na(source_price_key)
            continue
        if not array.includes(displayed_london_levels, source_price_key)
            session_count = liquidity_pool_session_count(london_session_pool)
            for session_idx = 0 to session_count - 1
                session_high = array.get(london_session_pool.highs, session_idx)
                session_low = array.get(london_session_pool.lows, session_idx)

                level_matched = false
                level_price = 0.0
                level_time = 0
                level_end_time = 0
                level_label_time = 0
                is_high_level = false

                if session_high == source_price_key
                    level_matched := true
                    level_price := session_high
                    level_time := array.get(london_session_pool.high_times, session_idx)
                    level_end_time := liquidity_pool_get_high_line_end_time(london_session_pool, session_idx, time)
                    level_label_time := array.get(london_session_pool.session_close_times, session_idx)
                    is_high_level := true
                else if session_low == source_price_key
                    level_matched := true
                    level_price := session_low
                    level_time := array.get(london_session_pool.low_times, session_idx)
                    level_end_time := liquidity_pool_get_low_line_end_time(london_session_pool, session_idx, time)
                    level_label_time := array.get(london_session_pool.session_close_times, session_idx)
                    is_high_level := false

                if level_matched
                    liquidity_line = line.new(level_time, level_price, level_end_time, level_price, xloc=xloc.bar_time, color=london_liquidity_color, width=london_liquidity_line_width, style=line.style_solid)
                    array.push(london_liquidity_lines, liquidity_line)

                    if show_london_liquidity_labels
                        label_text = build_liquidity_pool_label(LIQUIDITY_SOURCE_TYPE_LONDON, level_label_time)
                        final_label_time = level_end_time != level_time ? int((level_time + level_end_time) / 2) : level_time
                        label_style = is_high_level ? label.style_label_down : label.style_label_up
                        liquidity_label = label.new(final_label_time, level_price, label_text, xloc=xloc.bar_time, yloc=yloc.price, style=label_style, textcolor=color.black, size=get_source_label_size(), color=color.new(color.white, 100))
                        array.push(london_liquidity_labels, liquidity_label)

                    array.push(displayed_london_levels, source_price_key)
                    break
```
**After**: Asia rendering block
**Copy Pattern**: Identical to Asia, just replace session name

---

## Step 10: Alert System

**Location**: Lines ~4757-4858 (Alert conditions and grouped alerts)

### 10.1 Add Alert Conditions
```pine
alertcondition(london_mbz_bullish_formed, title=ALERT_TITLE_LONDON_MBZ_PLUS, message='{{interval}}')
alertcondition(london_mbz_bearish_formed, title=ALERT_TITLE_LONDON_MBZ_MINUS, message='{{interval}}')
```
**After**: Asia alert conditions

### 10.2 Add to Grouped Alert Logic
```pine
// Add to alert parts collection
if enable_london_mbz_plus and london_mbz_bullish_formed
    array.push(mbz_alert_parts, ALERT_MSG_LONDON_MBZ_PLUS)
    mbz_grouped_alert_active := true
if enable_london_mbz_minus and london_mbz_bearish_formed
    array.push(mbz_alert_parts, ALERT_MSG_LONDON_MBZ_MINUS)
    mbz_grouped_alert_active := true
```
**After**: Asia alert parts

### 10.3 Update Priority Comment & Lead Selection
```pine
// Update comment
// Select a lead by priority: Strong > Multi-Source > Monthly > Weekly > Daily > Asia > London > Baseline MBZ

// Add to priority cascade (after Asia checks)
else if array.includes(mbz_alert_parts, ALERT_MSG_LONDON_MBZ_PLUS)
    lead_text := ALERT_MSG_LONDON_MBZ_PLUS
else if array.includes(mbz_alert_parts, ALERT_MSG_LONDON_MBZ_MINUS)
    lead_text := ALERT_MSG_LONDON_MBZ_MINUS
```

---

## Step 11: Profiling Table

**Location**: Lines ~4626-4682 (Profiling updates) & ~4908-4973 (Table display)

### 11.1 Add Customization Inputs (One-time setup)

⚠️ **Only needed once** when setting up profiling table infrastructure:

```pine
profiling_table_text_size = input.string(TEXT_SIZE_TINY, 'Table Text Size', options=[TEXT_SIZE_TINY, TEXT_SIZE_SMALL, TEXT_SIZE_NORMAL, TEXT_SIZE_LARGE], group=GROUP_PERFORMANCE_PROFILING, inline='prof_table')
profiling_table_bg_color = input.color(color.black, 'Table BG', group=GROUP_PERFORMANCE_PROFILING, inline='prof_table')
```
**After**: `age_limit_label_size` input

Add helper function:
```pine
get_profiling_table_size() => get_text_size(profiling_table_text_size)
```
**After**: Other `get_*_size()` helpers

### 11.2 Add to Profiling Reset
```pine
profile_london_liq_total := 0           // After profile_asia_liq_total
profile_london_liq_invalidated := 0     // After profile_asia_liq_invalidated
```

### 11.3 Add to Profiling Loop
```pine
else if rec.source_origin_token == LIQUIDITY_SOURCE_TYPE_LONDON
    profile_london_liq_total += 1
    if rec.is_invalidated
        profile_london_liq_invalidated += 1
```
**After**: Asia profiling check

### 11.4 Add Session Count
```pine
profile_london_sessions := liquidity_pool_session_count(london_session_pool)
```
**After**: `profile_asia_sessions`

### 11.5 Update Table Display

⚠️ **New Compact Layout (v1.1)**: Table is now 4 columns × 11 rows instead of 2 columns × 30 rows

**Table initialization** (use customizable background):
```pine
profiling_table := table.new(position.top_right, 4, 15, bgcolor=profiling_table_bg_color, border_width=1, border_color=color.white)
```

**Header Row**:
```pine
table.cell(profiling_table, 0, 0, "TF", text_color=color.white, bgcolor=color.new(color.orange, 30), text_size=get_profiling_table_size())
table.cell(profiling_table, 1, 0, "Tot", text_color=color.white, bgcolor=color.new(color.orange, 30), text_size=get_profiling_table_size())
table.cell(profiling_table, 2, 0, "Vis", text_color=color.white, bgcolor=color.new(color.orange, 30), text_size=get_profiling_table_size())
table.cell(profiling_table, 3, 0, "Inv", text_color=color.white, bgcolor=color.new(color.orange, 30), text_size=get_profiling_table_size())
```

**Add London Row** (row 5):
```pine
// London
table.cell(profiling_table, 0, 5, LIQUIDITY_LABEL_LONDON, text_color=color.white, text_size=get_profiling_table_size())
table.cell(profiling_table, 1, 5, str.tostring(profile_london_liq_total), text_color=color.aqua, text_size=get_profiling_table_size())
table.cell(profiling_table, 2, 5, str.tostring(profile_london_liq_added), text_color=color.lime, text_size=get_profiling_table_size())
table.cell(profiling_table, 3, 5, str.tostring(profile_london_liq_invalidated), text_color=color.orange, text_size=get_profiling_table_size())
```

**Summary Section** (rows 7-10, uses 2×2 layout within 4 columns):
```pine
table.cell(profiling_table, 2, 8, "Intraday", text_color=color.white, text_size=get_profiling_table_size())
table.cell(profiling_table, 3, 8, str.tostring(profile_asia_sessions) + "/" + str.tostring(profile_london_sessions), text_color=color.aqua, text_size=get_profiling_table_size())
```

**Layout Structure**:
- **Rows 0**: Header (TF | Tot | Vis | Inv)
- **Rows 1-5**: Daily, Weekly, Monthly, Asia, London (full width, 4 columns each)
- **Row 6**: Spacer
- **Rows 7-10**: Summary metrics (2×2 grid using all 4 columns)

**⚠️ Note**: Use `get_profiling_table_size()` for ALL text_size parameters (44 total cells)

---

## Quick Reference Checklist

Use this checklist when implementing a new session:

- [ ] **Step 1**: Add all constants (type, labels, scan cap, timeframe, session time, line width)
- [ ] **Step 2**: Add alert constants (titles and messages)
- [ ] **Step 3**: Add input settings (enable, time, source origins, alerts)
- [ ] **Step 4**: Update SourceTypeStats type and add data structures
- [ ] **Step 5**: Add alert variables at top of file
- [ ] **Step 6**: Add session tracking logic
- [ ] **Step 7**: Add MBZ detection and processing
- [ ] **Step 8**: ⚠️ **CRITICAL** - Update source statistics functions
- [ ] **Step 8.5**: ⚠️ **CRITICAL** - Update label formatter functions (format_liquidity_pool_time_label & build_liquidity_pool_label)
- [ ] **Step 9**: Add visual rendering (cleanup, deduplication, source origins)
- [ ] **Step 10**: Add to alert system (conditions and grouped alerts)
- [ ] **Step 11**: Update profiling table (compact 4-column layout with customizable options)

---

## Common Patterns

### Intraday Session Defaults
- **Timeframe restriction**: `<= 45` (45m and below) ⚡ v1.1 update
- **Line width**: `1` (thinner than HTF)
- **Color**: `#00bcd4` (cyan, same as other intraday)
- **Scan cap**: `50` sessions

### HTF Session Defaults
- **Timeframe restriction**: `>= 45` (45m and above) ⚡ v1.1 update
- **Line width**: `2-4` (thicker)
- **Scan cap**: `30-100` sessions

### Timeframe Coverage (v1.1)
- **≤45m**: All liquidity types enabled (Daily, Weekly, Monthly, Asia, London)
- **≥60m**: HTF only (Daily, Weekly, Monthly) — intraday disabled
- **No gaps**: 45m is the pivot point where everything is available

### Naming Conventions
- **Constants**: `UPPERCASE_WITH_UNDERSCORES`
- **Variables**: `lowercase_with_underscores`
- **Source type**: Lowercase, no spaces (e.g., "london", "nyam")
- **Display label**: Title Case (e.g., "London", "NY AM")
- **Short label**: Single letter (e.g., "L", "N")

---

## Files Modified Summary

**File**: `/Users/kaschief/Desktop/indicators-by-kash/indicators/01-mbz/code/mbz-prime/production/mbz-prime.pine`

**Total Sections Modified**: 11
**Total Lines Added**: ~200-250 per session

---

## Version History

### v1.3.1 - Profiling Counter Bug Fix
- **Date**: 2025-10-02
- **Bug Fixed**: NY AM and Lunch invalidation counters not incrementing
- **Issue**: Profiling table showed incorrect invalidated MBZ counts for NY AM and Lunch sessions
  - Visual display showed 3 invalidated Lunch MBZs
  - Profiling table showed only 1 invalidated
  - Root cause: Missing counter logic in profiling section (lines 5098-5105)
- **Fix**:
  - Added NY AM invalidation counter: `profile_nyam_liq_invalidated += 1`
  - Added Lunch invalidation counter: `profile_lunch_liq_invalidated += 1`
  - Added NY AM session counter: `profile_nyam_sessions := liquidity_pool_session_count(nyam_session_pool)`
  - Added Lunch session counter: `profile_lunch_sessions := liquidity_pool_session_count(lunch_session_pool)`
- **Files Modified**: `mbz-prime.pine` (lines 5098-5114), `liquidity-implementation-guide.md`

### v1.3 - Lunch Session Implementation
- **Date**: 2025-10-02
- **Session Added**: Lunch (12pm-1:30pm NY)
- **Changes**:
  - Complete implementation following all 11 steps
  - **Short label**: "Lunch"
  - **Color**: Cyan `#00bcd4` (matching all intraday sessions)
  - **Timeframe**: ≤45m only
  - **Session count optimization**: Intraday display now dynamically shows only active sessions
    - Examples: "50" (Asia only), "50/25" (Asia + London), "50/25/30/15" (all 4 intraday)
    - Eliminates "0/0/0" clutter when sessions disabled or unavailable on current TF
  - **HTF session count optimization**: Extended dynamic display to Daily/Weekly/Monthly sessions
- **Files Modified**: `mbz-prime.pine`, `liquidity-implementation-guide.md`

### v1.2 - NY AM Session Implementation & Dynamic Profiling Table
- **Date**: 2025-10-02
- **Session Added**: NY AM (9:30am-12pm NY)
- **Changes**:
  - Complete implementation following all 11 steps
  - **Short label**: "NYAM" (not "N")
  - **Color**: Cyan `#00bcd4` (matching all intraday sessions: Asia, London, NY AM)
  - **Timeframe**: ≤45m only
  - **Profiling table optimization**: Made dynamic - only shows active liquidity pools
    - Filters based on: user enabled (enable_*_liquidity) AND timeframe available (*_liquidity_tracking)
    - Table height adapts from 6 rows (1H chart: D/W/M only) to 10 rows (15m chart: all 6 pools)
    - Eliminates clutter, shows only relevant data
    - Zero performance impact (simple boolean checks)
  - **Intraday sessions display**: Updated to show "Asia/London/NYAM"
- **Files Modified**: `mbz-prime.pine`, `liquidity-implementation-guide.md`
- **IMPORTANT**: All intraday sessions (Asia, London, NY AM, Lunch, NY PM) MUST use cyan color `#00bcd4` for visual consistency

### v1.1 - Timeframe Optimization & Label Bug Fixes
- **Date**: 2025-10-02
- **Changes**:
  - **Timeframe restrictions**: Changed from 15/60/240m to unified **45m pivot point**
    - Eliminated 30m gap where no liquidity tracking was active
    - ≤45m: All liquidity types enabled (Daily, Weekly, Monthly, Asia, London)
    - ≥60m: HTF only (Daily, Weekly, Monthly)
  - **Profiling table redesign**: Optimized from 2-column × 30-row → 4-column × 11-row layout
    - 50% height reduction for small screens
    - Added customizable text size (`profiling_table_text_size`)
    - Added customizable background color (`profiling_table_bg_color`)
    - Uses constants for timeframe labels (LIQUIDITY_LABEL_*)
    - All 44 cells use `get_profiling_table_size()` helper
  - **Label formatter bug fixes** (Step 8.5 added):
    - Fixed `format_liquidity_pool_time_label`: Added missing London case (was showing "Unknown")
    - Fixed `build_liquidity_pool_label`: Added London to 3 switch statements (was showing lowercase "london")
- **Files Modified**: `mbz-prime.pine`, `liquidity-implementation-guide.md`

### v1.0 - London Session Implementation
- **Date**: 2025-10-02
- **Session Added**: London (2am-5am NY)
- **Changes**: Complete implementation following all 11 steps
- **Bug Fixes**: Fixed SourceTypeStats to include Asia & London (prevented array index errors)

---

## Playful Session Reference

These are the **official session times** from Playful (all in NY timezone):

| Session | Time Range | Duration | Status |
|---------|------------|----------|--------|
| **Asia** | `2000-0000` | 8pm-12am (4h) | ✅ Implemented |
| **London** | `0200-0500` | 2am-5am (3h) | ✅ Implemented |
| **NY AM** | `0930-1200` | 9:30am-12pm (2.5h) | ✅ Implemented |
| **Lunch** | `1200-1330` | 12pm-1:30pm (1.5h) | ✅ Implemented |
| **NY PM** | `1330-1600` | 1:30pm-4pm (2.5h) | 📋 Planned |

**Notes:**
- All times are in NY timezone
- Days pattern: `:23456` (Mon-Sat) for all sessions
- Default session time format: `"HHMM-HHMM:23456"`
- **CRITICAL**: All intraday sessions MUST use cyan color `#00bcd4` for consistency
- Source: `playful-minimal-test.pine` lines 86-105

---

## Next Sessions Planned

1. **NY AM** (New York Morning) - `0930-1200:23456`
2. **Lunch** (Lunch Session) - `1200-1330:23456`
3. **NY PM** (New York Afternoon) - `1330-1600:23456`

Use this guide as the template for each implementation.
