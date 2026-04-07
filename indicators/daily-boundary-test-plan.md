# Daily Boundary Toggle - Test Plan

## Overview

The daily boundary toggle adds two modes for how daily sessions are defined across Prime, Pulse, and Relay:

- **Exchange Session** (default): 18:00-17:59 ET boundaries matching futures/forex session cycles
- **Calendar Day**: Midnight-midnight ET (original behavior)

24/7 assets (crypto) are auto-detected and forced to Calendar Day mode.

---

## Test Matrix

### Assets to Test

| Asset Type     | Symbol Examples      | Expected Behavior                        |
|----------------|----------------------|------------------------------------------|
| Futures        | NQ, ES, YM, CL      | Both modes functional                    |
| Forex          | EURUSD, GBPJPY       | Both modes functional                    |
| Crypto         | BTCUSD, ETHUSD       | Forced Calendar Day (24/7 detection)     |
| Stocks         | AAPL, SPY             | Both modes functional                    |

### Timeframes to Test

| Timeframe | Priority | Notes                                              |
|-----------|----------|----------------------------------------------------|
| 1m        | High     | Most granular, good for verifying exact boundary    |
| 5m        | High     | Common working timeframe                           |
| 15m       | High     | Primary timeframe for Prime                        |
| 1H        | Medium   | Verify 18:00 boundary detection accuracy           |
| 4H        | Medium   | Bar at 16:00 and 20:00 straddle 18:00              |
| 1D        | High     | Falls back to calendar day logic                   |

---

## Per-Indicator Test Scenarios

### Prime

#### P1: Exchange Session mode - basic boundary detection
1. Set Daily Boundary to "Exchange Session" on NQ 5m chart
2. Enable Show Pool Debug
3. Verify debug table shows daily sessions starting at 18:00 ET
4. Check that session close dates align with exchange session boundaries (not midnight)

#### P2: Calendar Day mode - backward compatibility
1. Set Daily Boundary to "Calendar Day" on NQ 5m chart
2. Enable Show Pool Debug
3. Verify debug table matches pre-change behavior
4. Session boundaries should fire at midnight ET

#### P3: Sunday 18:00 in Exchange Session mode
1. Scroll to a Sunday evening on NQ 5m chart
2. In Exchange Session mode: Sunday 18:00 should start a new daily session (Monday's)
3. Verify the session labeled in debug table starts at Sunday 18:00
4. `should_skip_sunday_liquidity` should return false (never skip in exchange mode)

#### P4: Sunday 18:00 in Calendar Day mode
1. Same chart, switch to Calendar Day mode
2. With "Include Sunday Evening" ON: Sunday evening data included in daily H/L
3. With "Include Sunday Evening" OFF: Sunday evening bars should be frozen (skip)
4. Verify the guard `coming_from_sunday_evening` works correctly at midnight

#### P5: 24/7 asset auto-detection
1. Load BTCUSD on 5m chart
2. Verify Daily Boundary dropdown shows "Exchange Session" but debug table footer shows "Calendar Day"
3. The 24/7 detection forces Calendar Day regardless of user selection

#### P6: Pool debug table format
1. Enable "Show Pool Debug" in Color Reference group
2. Verify table appears at bottom_right
3. Columns: #, Close, High, H date, Low, L date, H br, L br, Count
4. Footer row shows: "Prime Daily", "1=newest", effective boundary mode
5. Newest session is row 1, up to 10 rows shown

#### P7: MBZ detection parity
1. On NQ 15m with Exchange Session mode
2. Compare MBZ formations from daily pools between both modes
3. In Exchange Session mode, daily H/L should capture 18:00-17:59 range
4. Verify no duplicate MBZ formations at midnight boundary

#### P8: Daily chart fallback
1. Load NQ on 1D chart
2. Set Exchange Session mode
3. Verify daily pool tracking still works (falls back to dayofmonth change)
4. Each daily bar should still trigger a new session

### Pulse

#### U1: Exchange Session mode - daily bar detection
1. Set Daily Boundary to "Exchange Session" on NQ 5m chart
2. Enable Daily pool + Show Pool Debug
3. Verify `is_new_daily_bar` fires at 18:00 ET instead of midnight

#### U2: Sunday continuation block disabled
1. On NQ 5m chart in Exchange Session mode
2. Scroll to a Sunday evening
3. The Sunday continuation block (updating Friday's H/L) should NOT execute
4. Instead, Sunday 18:00 should start a new session

#### U3: Calendar Day mode - Sunday continuation
1. Switch to Calendar Day mode with "Include Sunday Evening" OFF
2. Scroll to Sunday evening
3. The continuation block should execute (update Friday's stored H/L)
4. Sunday 18:00-00:00 bars should NOT create a new session

#### U4: Weekly pool interaction
1. In Exchange Session mode with "Include Sunday Evening" ON
2. Verify weekly pool reset still works correctly
3. Trading week detection (Sunday 18:00 reopen) should still function

#### U5: Debug table boundary label
1. Enable Show Pool Debug
2. Verify footer shows the effective boundary mode
3. Switch between modes and verify label updates

#### U6: Intraday session pools unaffected
1. Verify Asia, London, NYAM, Lunch, NYPM pools are NOT affected by the daily boundary toggle
2. These use `time()` session strings, not `dayofmonth` logic

### Relay

#### R1: Exchange Session mode - daily pool tracking
1. Set Daily Boundary to "Exchange Session" on NQ 5m chart
2. Enable Show Pool Debug
3. Verify daily sessions use 18:00 ET boundary
4. `sec_daily_high[1]`/`sec_daily_low[1]` override is removed -- verify H/L values are tracked natively

#### R2: Backfill gating
1. In Exchange Session mode: backfill should be active (if enabled)
2. In Calendar Day mode: backfill should be disabled
3. Verify by checking debug table -- Exchange mode should show "bf" entries, Calendar Day should not

#### R3: Sunday evening toggle (new)
1. Relay now has "Include Sunday Evening" toggle
2. Only applies in Calendar Day mode
3. When ON: Sunday evening included in daily pool
4. When OFF: Sunday evening skipped
5. In Exchange Session mode: toggle is ignored

#### R4: Weekly/Monthly pool override preserved
1. Verify `sec_weekly_high[1]`/`sec_weekly_low[1]` override still works for weekly pool
2. Verify `sec_monthly_high[1]`/`sec_monthly_low[1]` override still works for monthly pool
3. Only daily override was removed

#### R5: 24/7 asset detection (new)
1. Relay now has 24/7 asset detection (previously had none)
2. Load BTCUSD -- should force Calendar Day mode
3. Load NQ -- should respect user selection

#### R6: Debug table boundary label
1. Enable Show Pool Debug
2. Verify the daily detail table footer shows effective boundary mode
3. Switch between modes and verify

---

## Cross-Indicator Comparison

### C1: Daily H/L parity across indicators
1. Load NQ on 5m chart
2. Enable pool debug tables on all three indicators
3. Set all three to "Exchange Session" mode
4. Compare the last 10 daily sessions:
   - Session dates should match
   - H/L values should match (or be very close)
   - H date/time should match
   - L date/time should match
   - Breach status should match

### C2: Calendar Day parity
1. Set all three to "Calendar Day" mode
2. Repeat comparison from C1
3. Values should match the original pre-change behavior

### C3: Mode switching consistency
1. Switch all three from Exchange Session to Calendar Day
2. Pool data should rebuild correctly
3. No stale data from previous mode should remain

---

## Edge Cases

### E1: DST transitions
- March (spring forward): 18:00 ET changes UTC offset
- November (fall back): 18:00 ET changes UTC offset
- Pine uses `NY_TIMEZONE` which handles DST automatically
- Verify no double-fire or missed session at DST transition

### E2: Market holidays
- On early-close days (e.g., Thanksgiving half-day), market closes at 13:00
- Exchange session still runs 18:00-17:59 window
- Verify no issues when there's a gap from 13:00 to next Sunday 18:00

### E3: 4H chart straddle
- 4H chart bars: 16:00, 20:00, 00:00...
- The 18:00 boundary falls WITHIN the 16:00-20:00 bar
- `hour(time, NY_TIMEZONE)` returns 16 for that bar (bar start time)
- `hour(time[1], NY_TIMEZONE)` returns 12 for the previous bar
- Session change fires when bar at 16:00 (prev was 12:00): cur_hour=16 < 18, no fire
- Next bar at 20:00 (prev was 16:00): cur_hour=20 >= 18, prev_hour=16 < 18, same day -> fires
- This is correct: the 20:00 bar is the first bar of the new session

### E4: First bar handling
- All `is_new_exchange_daily_session()` functions return `false` when `time[1]` is `na`
- No session finalization on first bar

### E5: Weekend gap (Friday 17:00 -> Sunday 18:00)
- `cur_dow != prev_dow` and `cur_hour >= 18` -> fires correctly
- Friday's session is finalized, Sunday 18:00 starts Monday's session

### E6: Mode change mid-session
- Changing from Exchange to Calendar Day mid-chart:
  - Pool arrays persist but boundaries shift
  - Next boundary detection uses new mode
  - Existing pool entries are not retroactively modified

---

## Known Risks and Side Effects

### Risk 1: Relay backfill data granularity
- Backfill uses `request.security("D", ...)` which returns calendar-day H/L
- In Exchange Session mode, this is an approximation (real session is 18:00-17:59, not midnight-midnight)
- The Sunday-evening overlap means backfill H/L may slightly differ from native tracking
- Mitigated: backfill is historical seed data; native tracking corrects going forward

### Risk 2: Relay daily pool without sec_daily override
- Previously Relay used `request.security("D", [high, low])` to override daily pool H/L
- This override was removed because it returns calendar-day data that conflicts with exchange session boundaries
- Native bar-by-bar tracking may have slightly different H/L on very low timeframes due to bar timing
- This is the correct behavior for exchange session alignment

### Risk 3: Pine Script `time()` session string limitation
- The exchange session detection uses explicit `hour()`/`dayofweek()` logic instead of `time()` session strings
- `time()` with `"1800-1800:23456"` would not correctly handle Sunday (day 1)
- The explicit logic correctly handles Sunday 18:00 as a session start

### Risk 4: Calendar Day backward compatibility
- All indicators default to Exchange Session, not Calendar Day
- Users who relied on the previous midnight-based behavior need to switch to Calendar Day
- The Calendar Day codepath is intentionally unchanged from the pre-toggle behavior
