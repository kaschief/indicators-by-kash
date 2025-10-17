# DttWeeklySession.new() Parameter Map

## CRITICAL: Parameter Count = 78

**Total Fields:** 90
**Fields with Defaults (DON'T PASS):** 12
**Parameters to Pass:** 78

---

## Fields with Defaults (NEVER pass these as parameters):

| Position | Field Name | Default Value |
|----------|-----------|---------------|
| 18 | session_high | -1e10 |
| 19 | session_low | 1e10 |
| 61 | amrp_drawn | false |
| 62 | amrp_up_projections_drawn | false |
| 63 | amrp_dn_projections_drawn | false |
| 64 | amrp_broke_up | false |
| 65 | amrp_broke_dn | false |
| 70 | amrp_bars_total | 0 |
| 71 | amrp_bars_within_inner | 0 |
| 72 | amrp_bars_within_outer | 0 |
| 73 | amrp_bars_broke_outer | 0 |
| 90 | fib_drawn | false |

---

## Parameter Order (78 total parameters):

### Parameters 1-17: Session Constants
| Param | Field # | Field Name | Type | Example Value |
|-------|---------|------------|------|---------------|
| 1 | 1 | name | string | SESSION_ISCARIOT |
| 2 | 2 | start_time | int | TIME_ISCARIOT_START |
| 3 | 3 | start_day | int | DAY_ISCARIOT_START |
| 4 | 4 | end_time | int | TIME_ISCARIOT_END |
| 5 | 5 | end_day | int | DAY_ISCARIOT_END |
| 6 | 6 | root_time | int | TIME_ISCARIOT_ROOT |
| 7 | 7 | root_day | int | DAY_ISCARIOT_ROOT |
| 8 | 8 | interval1_time | int | TIME_ISCARIOT_INTERVAL1 |
| 9 | 9 | interval1_day | int | DAY_ISCARIOT_INTERVAL1 |
| 10 | 10 | interval2_time | int | TIME_ISCARIOT_INTERVAL2 |
| 11 | 11 | interval2_day | int | DAY_ISCARIOT_INTERVAL2 |
| 12 | 12 | interval3_time | int | TIME_ISCARIOT_INTERVAL3 |
| 13 | 13 | interval3_day | int | DAY_ISCARIOT_INTERVAL3 |
| 14 | 14 | start_bar | int | na or bar_index |
| 15 | 15 | end_bar | int | na |
| 16 | 16 | start_timestamp | int | na or calculated_start_timestamp |
| 17 | 17 | end_timestamp | int | na or calculated_end_timestamp |

### ⚠️ SKIP Fields 18-19 (session_high, session_low have defaults)

### Parameters 18-38: Root & Interval Data (21 params)
| Param | Field # | Field Name | Type | Typical Value |
|-------|---------|------------|------|---------------|
| 18 | 20 | root_high | float | na |
| 19 | 21 | root_low | float | na |
| 20 | 22 | root_price | float | na |
| 21 | 23 | root_timestamp | int | na |
| 22 | 24 | start_boundary_line | line | na |
| 23 | 25 | end_boundary_line | line | na |
| 24 | 26 | high_line | line | na |
| 25 | 27 | low_line | line | na |
| 26 | 28 | root_zone_box | box | na |
| 27 | 29 | root_eq_line | line | na |
| 28 | 30 | interval1_line | line | na |
| 29 | 31 | interval2_line | line | na |
| 30 | 32 | interval3_line | line | na |
| 31 | 33 | session_name_box | box | na |
| 32 | 34 | root_time_label | label | na |
| 33 | 35 | interval1_bar | int | na |
| 34 | 36 | interval2_bar | int | na |
| 35 | 37 | interval3_bar | int | na |
| 36 | 38 | interval1_timestamp | int | na |
| 37 | 39 | interval2_timestamp | int | na |
| 38 | 40 | interval3_timestamp | int | na |

### Parameters 39-58: AMRP Visual Elements (20 params)
| Param | Field # | Field Name | Type | Typical Value |
|-------|---------|------------|------|---------------|
| 39 | 41 | amrp_up_box | box | na |
| 40 | 42 | amrp_dn_box | box | na |
| 41 | 43 | amrp_up_eq_line | line | na |
| 42 | 44 | amrp_dn_eq_line | line | na |
| 43 | 45 | amrp_up_proj1 | line | na |
| 44 | 46 | amrp_up_proj2 | line | na |
| 45 | 47 | amrp_up_proj3 | line | na |
| 46 | 48 | amrp_up_proj4 | line | na |
| 47 | 49 | amrp_dn_proj1 | line | na |
| 48 | 50 | amrp_dn_proj2 | line | na |
| 49 | 51 | amrp_dn_proj3 | line | na |
| 50 | 52 | amrp_dn_proj4 | line | na |
| 51 | 53 | amrp_up_proj1_label | label | na |
| 52 | 54 | amrp_up_proj2_label | label | na |
| 53 | 55 | amrp_up_proj3_label | label | na |
| 54 | 56 | amrp_up_proj4_label | label | na |
| 55 | 57 | amrp_dn_proj1_label | label | na |
| 56 | 58 | amrp_dn_proj2_label | label | na |
| 57 | 59 | amrp_dn_proj3_label | label | na |
| 58 | 60 | amrp_dn_proj4_label | label | na |

### ⚠️ SKIP Fields 61-65 (AMRP bool flags have defaults)

### Parameters 59-62: AMRP Percentile Values (4 params)
| Param | Field # | Field Name | Type | Typical Value |
|-------|---------|------------|------|---------------|
| 59 | 66 | amrp_up_inner | float | na |
| 60 | 67 | amrp_up_outer | float | na |
| 61 | 68 | amrp_dn_inner | float | na |
| 62 | 69 | amrp_dn_outer | float | na |

### ⚠️ SKIP Fields 70-73 (AMRP bar counters have defaults)

### Parameters 63-78: Fibonacci Elements (16 params)
| Param | Field # | Field Name | Type | Typical Value |
|-------|---------|------------|------|---------------|
| 63 | 74 | fib_high_anchor | float | na |
| 64 | 75 | fib_low_anchor | float | na |
| 65 | 76 | fib_line_0 | line | na |
| 66 | 77 | fib_line_295 | line | na |
| 67 | 78 | fib_line_382 | line | na |
| 68 | 79 | fib_line_50 | line | na |
| 69 | 80 | fib_line_618 | line | na |
| 70 | 81 | fib_line_705 | line | na |
| 71 | 82 | fib_line_100 | line | na |
| 72 | 83 | fib_label_0 | label | na |
| 73 | 84 | fib_label_295 | label | na |
| 74 | 85 | fib_label_382 | label | na |
| 75 | 86 | fib_label_50 | label | na |
| 76 | 87 | fib_label_618 | label | na |
| 77 | 88 | fib_label_705 | label | na |
| 78 | 89 | fib_label_100 | label | na |

### ⚠️ SKIP Field 90 (fib_drawn has default)

---

## Example .new() Calls:

### Template Initialization (first 13 are constants, rest are na):
```pine
DttWeeklySession.new(
    SESSION_ISCARIOT,          // P1: name
    TIME_ISCARIOT_START,       // P2: start_time
    DAY_ISCARIOT_START,        // P3: start_day
    TIME_ISCARIOT_END,         // P4: end_time
    DAY_ISCARIOT_END,          // P5: end_day
    TIME_ISCARIOT_ROOT,        // P6: root_time
    DAY_ISCARIOT_ROOT,         // P7: root_day
    TIME_ISCARIOT_INTERVAL1,   // P8: interval1_time
    DAY_ISCARIOT_INTERVAL1,    // P9: interval1_day
    TIME_ISCARIOT_INTERVAL2,   // P10: interval2_time
    DAY_ISCARIOT_INTERVAL2,    // P11: interval2_day
    TIME_ISCARIOT_INTERVAL3,   // P12: interval3_time
    DAY_ISCARIOT_INTERVAL3,    // P13: interval3_day
    na,                        // P14-78: All remaining fields (65 na values)
    ... (64 more na values)
)
```

### Empty Session (all zeros/na):
```pine
DttWeeklySession.new(
    na,    // P1: name
    0,     // P2-13: int constants (use 0 for placeholders)
    ... (11 more int 0 values)
    na,    // P14-78: All remaining fields (65 na values)
    ... (64 more na values)
)
```

### New Session Creation (mix of values and na):
```pine
DttWeeklySession.new(
    template.name,             // P1: name
    template.start_time,       // P2-13: Copy from template
    ... (11 more template values)
    bar_index,                 // P14: start_bar
    na,                        // P15: end_bar
    calculated_start_timestamp, // P16: start_timestamp
    calculated_end_timestamp,  // P17: end_timestamp
    na,                        // P18-78: All remaining fields (61 na values)
    ... (60 more na values)
)
```

---

## Verification Script (Python):

```python
# Count commas in a .new() call - should be 77 (for 78 params)
line = "DttWeeklySession.new(...)"
comma_count = line.count(',')
print(f"Commas: {comma_count}, Parameters: {comma_count + 1}")
# Expected: "Commas: 77, Parameters: 78"
```

---

## VERIFICATION STATUS

**All 7 DttWeeklySession.new() calls verified:**
- ✓ Line 348 (Iscariot template): 78 parameters
- ✓ Line 349 (Aries template): 78 parameters
- ✓ Line 350 (Ash template): 78 parameters
- ✓ Line 351 (Icarus template): 78 parameters
- ✓ Line 497 (get_previous_session): 78 parameters
- ✓ Line 645 (new_session creation): 78 parameters
- ✓ Line 1036 (next_sess lookup): 78 parameters

**Last Verified:** 2025-10-17

---

## SUSTAINABLE SOLUTION

To regenerate correct .new() calls after modifying the type definition:

```bash
python3 /path/to/generate_dtt_session_new_calls.py
```

This script:
1. Parses the type definition from kash-dtt-weekly-pro.pine
2. Identifies fields with defaults (which are NOT passed as parameters)
3. Generates the exact parameter lists for all 7 .new() calls
4. Outputs to generated_new_calls.txt for easy copy/paste

**Script Location:** `./generate_dtt_session_new_calls.py`

---

**Last Updated:** 2025-10-17
**Related Files:** kash-dtt-weekly-pro.pine, WEEKLY_DTT_IMPLEMENTATION_NOTES.md, generate_dtt_session_new_calls.py
