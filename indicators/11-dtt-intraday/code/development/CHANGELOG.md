# Kash DTT Intraday Pro - Changelog

Record of all changes and WHY they were made.

---

## [2025-10-13] - Fixed label and boundary timing for pre-created sessions

**PROBLEM:** Model 111 label appeared at 13:30 (root time) instead of 14:09 (start time). Model 1001 end boundary disappeared at 13:30 when Model 111 was pre-created.

**ROOT CAUSE:** Visual elements were drawing during pre-creation instead of session start.

**FIX:** Added `not na(session_start_timestamp)` checks before drawing visual elements. Only delete previous boundary when session officially starts, not during pre-creation. Added end boundary and label drawing in phase 2 (when pre-created session starts).

**LOCATIONS:** Lines 983, 1008, 1025, 918-967 (phase 2)

**TEST:** Model 111 label must appear at 14:09, Model 1001 boundary must stay until 14:09

---

## [2025-10-13] - Fixed end_timestamp calculation bug

**PROBLEM:** Lines extending 24 hours into future when changing "Show Last N Days"

**ROOT CAUSE:** `if calculated_end_timestamp <= time` incorrectly added a day for historical sessions

**FIX:** Only add day if session wraps midnight, not if end_timestamp is in the past

**LOCATION:** Line 966

**TEST:** Change "Show Last N Days" to 2, verify lines don't extend into tomorrow

---

## [2025-10-13] - Added fallback for empty intrabar data

**PROBLEM:** request.security_lower_tf() returns empty arrays on real-time bars/chart load

**ROOT CAUSE:** TradingView data availability issues

**FIX:** If array empty, push current bar's high/low/time as fallback

**LOCATIONS:** Lines 1092-1099, 1192-1197

**TEST:** Big Ben and NY Open high/low lines must appear on fresh chart load

---

## [2025-10-13] - Protected session initialization extreme values

**PROBLEM:** Risk of changing -1e10, 1e10 to realistic values

**ROOT CAUSE:** Could cause wrong high/low if session starts mid-bar

**FIX:** Added protective comments and documentation

**LOCATION:** Line 969

**TEST:** Session highs/lows must match across all timeframes (1m-5m)

---

## [2025-10-13] - Added comprehensive inline documentation

**PROBLEM:** Previous changes were lost when context reset, causing regressions

**ROOT CAUSE:** No CHANGELOG tracking what works and why

**FIX:** Added this CHANGELOG and protective comments throughout code

**PURPOSE:** Prevent future regressions by documenting WHAT changed, WHY, and HOW to test

---

## [2025-10-13] - CRITICAL BUG FIX: Separated root capture from root display

**PROBLEM:** AMRP zones not showing when "Show Root Prices" toggle was OFF

**ROOT CAUSE:** Root CAPTURE was gated by `if show_roots` at line 1179

**FIX:** Changed to `if true` - root capture now ALWAYS happens, display toggle only affects visualization

**LOCATION:** Line 1181 (changed from `if show_roots` to `if true`)

**TEST:** Turn OFF "Show Root Prices", AMRP zones should still appear

**WHY CRITICAL:** AMRP requires root data to calculate zones - data capture MUST be independent of display

---

## [2025-10-13] - CRITICAL BUG FIX: Validate session high/low before drawing lines

**PROBLEM:** Judas and NY Open missing high/low lines on instruments without 9:30 bar (e.g., NQ on 1-min)

**ROOT CAUSE:** Previous sessions had high/low still at initialization values (-1e10, 1e10). These pass `not na()` check but are invalid data that draw lines off-screen.

**FIX:** Added validation: high < 1e9 AND low > -1e9 (realistic price ranges)

**LOCATIONS:** Lines 953-955 (phase 2), Lines 1053-1055 (session creation)

**TEST:** Load NQ on 1-minute chart, check if Judas/NY Open gracefully handle missing data

**WHY INSTRUMENT-SPECIFIC:** Some instruments (e.g., NQ) don't have bars at certain times (9:30). Code should gracefully degrade instead of drawing invisible lines.
