# Gaps Indicator — Phase 1 Performance Refactor (Handoff)

**Status:** Paused mid-refactor on 2026-04-15. Title + drawing limits shipped. Larger dedupe/gating work not yet started.

**Context file:** `indicators/13-gaps/code/development/gaps.pine` (1887 lines)

**Symptom:** TradingView occasionally times out when loading the indicator, especially on 1m charts with high gap counts.

---

## What's already done

1. **Title renamed to `gaps • development`** (line 2) per CLAUDE.md dev-naming rule. Remove the `-development` suffix before production publish.
2. **Added `max_labels_count=500` and `max_bars_back=5000`** to the `indicator()` declaration (line 2). The file had `max_boxes_count=500, max_lines_count=500` but was silently allowing unbounded label growth — this is one of the memory-pressure sources because projection drawings can produce ~10 labels per gap × up to ~85 gaps.

Current line 2:
```pine
indicator("gaps • development", overlay=true, max_boxes_count=500, max_lines_count=500, max_labels_count=500, max_bars_back=5000)
```

---

## Remaining Phase 1 work (in priority order)

### A. Consolidate the 5 duplicate 1-minute array scans

The file caches 1m data once via `request.security_lower_tf` at line 218:
```pine
[cached_1m_times, cached_1m_opens, cached_1m_closes] = request.security_lower_tf(syminfo.tickerid, "1", [time, open, close])
```

...and then iterates that same cached array **five separate times per bar**, each with its own lookback filter and `dayofweek/hour/minute` checks. These loops are:

| # | Lines | Job | Lookback |
|---|---|---|---|
| 1 | 933–950 | Mark NWOG `passedNextSession` on Sunday 18:00 | `nwogLimit * 3 * MILLISECONDS_PER_WEEK` |
| 2 | 1348–1376 | Create NWOG from Fri 16:59 close + Sun 18:00 open | `nwogLimit * 3 * MILLISECONDS_PER_WEEK` |
| 3 | 1513–1532 | Populate NDOG/NWOG divider arrays | `maxGapsToShow * 3 * lookbackPeriod` |
| 4 | 1544–1575 | Create NDOG from prev-day close + next-day open | `ndogLimit * 3 * MILLISECONDS_PER_DAY` |
| 5 | 1587–1605 | Mark NDOG `passedNextSession` on any 18:00 session open | `ndogLimit * 3 * MILLISECONDS_PER_DAY` |

**Refactor target:** one master loop over `cached_1m_times` per bar. Each job keeps its own lookback cutoff (skip with `continue` when `barTime < jobLookback`). Within a single session-detection block, call creation **before** passed-marking — though the existing safety windows (6 days for NWOG, 20 hours for NDOG) already prevent a new gap from being marked "passed" on its own creation bar, so ordering is defensive only.

**Pseudocode:**
```pine
if array.size(cached_1m_times) > 0
    nwogLookback = time - nwogLimit * 3 * MILLISECONDS_PER_WEEK
    ndogLookback = time - ndogLimit * 3 * MILLISECONDS_PER_DAY
    dividerLookback = time - (showNWOGDividers ? nwogLimit : ndogLimit) * 3 * (showNWOGDividers ? MILLISECONDS_PER_WEEK : MILLISECONDS_PER_DAY)
    earliestLookback = math.min(nwogLookback, math.min(ndogLookback, dividerLookback))

    for i = 0 to array.size(cached_1m_times) - 1
        barTime = array.get(cached_1m_times, i)
        if barTime < earliestLookback
            continue

        barDay = dayofweek(barTime, TIMEZONE)
        barHour = hour(barTime, TIMEZONE)
        barMinute = minute(barTime, TIMEZONE)

        isSessionOpen = ((barDay >= 2 and barDay <= 6) or barDay == 1) and barHour == SESSION_OPEN_HOUR and barMinute == ZERO_MINUTE
        isSundayOpen = barDay == 1 and barHour == SESSION_OPEN_HOUR and barMinute == ZERO_MINUTE
        isWeekdayClose = barDay >= 2 and barDay <= 6 and barHour == CLOSE_HOUR and barMinute == CLOSE_MINUTE

        // JOB 3: dividers (cheapest, no state) — barTime >= dividerLookback
        if isSessionOpen and barTime >= dividerLookback
            if showNDOGDividers
                array.push(ndogDividers.dividerTimes, barTime)
            if showNWOGDividers and isSundayOpen
                array.push(nwogDividers.dividerTimes, barTime)

        // JOB 4: capture NDOG prev-day close
        if isWeekdayClose and displayNDOG and isValidNWOGTimeframe and barTime >= ndogLookback
            prevDayClosePrice := array.get(cached_1m_closes, i)

        // JOB 1: mark NWOG passed-next-session BEFORE creating new one
        if isSundayOpen and displayNWOG and isValidNWOGTimeframe and barTime >= nwogLookback
            for j = 0 to array.size(gapsArray) - 1
                gap = array.get(gapsArray, j)
                if gap.gapType == GAP_TYPE_NWOG and (barTime - gap.creationTime) >= 518400000
                    gap.passedNextSession := true
            // JOB 2: create NWOG
            if not na(fridayClosePrice)
                sundayOpenPrice := array.get(cached_1m_opens, i)
                // ...existing NWOG creation block
                fridayClosePrice := na

        // Capture NWOG Friday close (independent of Sunday check)
        if barDay == 6 and barHour == CLOSE_HOUR and barMinute == CLOSE_MINUTE and displayNWOG and isValidNWOGTimeframe and barTime >= nwogLookback
            fridayClosePrice := array.get(cached_1m_closes, i)

        // JOB 5: mark NDOG passed-next-session
        if isSessionOpen and displayNDOG and isValidNWOGTimeframe and barTime >= ndogLookback
            for j = 0 to array.size(gapsArray) - 1
                gap = array.get(gapsArray, j)
                if gap.gapType == GAP_TYPE_NDOG and (barTime - gap.creationTime) >= 72000000
                    gap.passedNextSession := true
            // JOB 4 (continued): create NDOG
            if not na(prevDayClosePrice)
                newDayOpenPrice := array.get(cached_1m_opens, i)
                // ...existing NDOG creation block
                prevDayClosePrice := na
```

**Gotcha during refactor:** the divider arrays are `push`-only and grow unbounded. Before the merged loop pushes to them, call `array.clear()` once at top of the consolidated block — otherwise you'll get duplicate divider times on every bar. Check existing divider rendering logic (not in my notes) to confirm current clear semantics before changing.

### B. Move NWOG/NDOG label merge out of per-bar loop

**Current problem (lines 1035–1045):** O(n²) nested loop runs on every bar:

```pine
for i = 0 to array.size(gapsArray) - 1
    nwogGap = array.get(gapsArray, i)
    if nwogGap.gapType == GAP_TYPE_NWOG
        for j = 0 to array.size(gapsArray) - 1
            ndogGap = array.get(gapsArray, j)
            if ndogGap.gapType == GAP_TYPE_NDOG and ndogGap.top == nwogGap.top and ndogGap.bottom == nwogGap.bottom
                if not na(nwogGap.dateLabel)
                    label.set_text(nwogGap.dateLabel, getGapLabelWithFill(nwogGap, GAP_TYPE_NWOG_NDOG))
                if not na(ndogGap.dateLabel)
                    label.set_text(ndogGap.dateLabel, "")
```

**Why this is redundant every bar:** gap geometry is immutable after creation. Once an NDOG is created with the same top/bottom as an existing NWOG, the merge decision never changes until one of them is deleted.

**Refactor target:** do the merge **once** at NDOG creation time. On Sunday 18:00 the NWOG is created first (line 1370 in current file), then the NDOG is created (line 1570 in current file) — so right after `array.push(gapsArray, ndogGap)` at line 1571, scan backward for an existing NWOG with matching top/bottom:

```pine
// After line 1571 (array.push(gapsArray, ndogGap))
for k = array.size(gapsArray) - 2 to 0
    existingGap = array.get(gapsArray, k)
    if existingGap.gapType == GAP_TYPE_NWOG and existingGap.top == ndogGap.top and existingGap.bottom == ndogGap.bottom
        if not na(existingGap.dateLabel)
            label.set_text(existingGap.dateLabel, getGapLabelWithFill(existingGap, GAP_TYPE_NWOG_NDOG))
        if not na(ndogGap.dateLabel)
            label.set_text(ndogGap.dateLabel, "")
        break
```

**Cleanup:** once this creation-time merge works, delete lines 1035–1045 entirely (not just comment out — per CLAUDE.md "Never Take Shortcuts" rule).

**Edge case:** if NWOG gets `removeOldestGap()`'d and the NDOG survives, the NDOG's label is still hidden. Before ripping out the old loop, check if that case is already handled or if the fill-percentage label updater at line 1287 accidentally restores the NDOG label.

### C. Gate projection management loop with dirty flag

**Current (lines 1378–1409):** recomputes "most recent unfilled gap per type" and reassigns projections every bar, even when nothing changed.

**Refactor:** introduce `var bool projectionsDirty = true` at top of file. Set to `true` when:
- A new gap is created (after each `array.push(gapsArray, ...)`)
- A gap becomes filled (inside the `gap.filled := true` branches around lines 1150, 1168, 1184, 1198)
- `showNWOGProjections / showNDOGProjections / showRTHProjections` inputs change (use `input_var != input_var[1]` detection on bar 0 or `ta.change()`)

Wrap the lines 1378–1409 block in `if projectionsDirty`, and reset `projectionsDirty := false` at the end.

**Risk:** if any code path mutates `gap.filled` without setting the flag, projections won't update. Audit the main fill-detection block (lines 1139–1210) carefully — there are ~6 places where `gap.filled := true` happens. Might be cleaner to wrap those in a helper `markFilled(gap)` that sets the flag.

---

## Phase 2 (not yet scoped in detail, reference only)

- Gate the entire display loop (lines 1065–1402) behind `barstate.islast OR stateDirty`, splitting into three passes: (1) visibility filter, (2) right-edge extension only on `islast`, (3) fill detection on every confirmed bar. See original audit for full risk discussion — fill detection is the trap.
- Cap projection drawings to N most recent unfilled (already half-done via `mostRecentNWOGBar/NDOGBar/RTHBar` tracking — just needs strict enforcement).

## Phase 3 (optional, high risk)

- Replace 1m session-boundary scanning with actual `request.security()` HTF calls à la relay's backfill-batch tuples. Only do if Phase 1+2 doesn't eliminate timeouts.

---

---

## Regression test checklist (run after ANY Phase 1 change)

Symbol: ES on 1m chart, chart zoomed to cover at least 6 weeks of history.

Gap creation:
- [ ] NWOG appears at each Fri 16:59 → Sun 18:00 transition
- [ ] NDOG appears at each weekday 16:59 → 18:00 transition
- [ ] NDOG appears at Fri 16:59 → Sun 18:00 (shares geometry with NWOG)
- [ ] RTH appears at each 09:30 session open when prior close ≠ open
- [ ] FVG+ and FVG- appear per 3-bar displacement

Fill behavior:
- [ ] Each gap type transitions to filled color when wick/body breaches
- [ ] `penetrationLevel` partial-fill visualization works (top/filled/bottom 3-box split)
- [ ] 100% filled gaps get `✓` suffix in label
- [ ] RTH "Today's RTH filled" alert fires once per day

Filter modes (cycle through each and confirm correct gaps visible):
- [ ] All
- [ ] Fresh
- [ ] Fresh + FVGs
- [ ] NWOG
- [ ] NDOG
- [ ] NWOG + NDOG
- [ ] RTH
- [ ] FVG

Label merging:
- [ ] When NWOG and NDOG share geometry (Sunday open), label reads "NWOG / NDOG"
- [ ] NDOG label is hidden (empty string) when NWOG absorbs it
- [ ] If NWOG is removed via limit, NDOG label restores or stays consistent

Projections:
- [ ] Only most recent unfilled NWOG/NDOG/RTH has projections
- [ ] Projections clear when gap fills
- [ ] Right-edge of projections tracks current bar

Dividers:
- [ ] NWOG dividers only on Sunday 18:00
- [ ] NDOG dividers on all 18:00 session opens
- [ ] Dividers do not duplicate (check after merged 1m scan refactor)

Performance:
- [ ] No TV timeout on 1m ES chart with full history
- [ ] Frame rate acceptable when scrubbing through history

---

## Files touched so far (in git)

- `indicators/13-gaps/code/development/gaps.pine` — line 2 only (title + limits). Uncommitted.

## Where we stopped

User interrupted to fix a production bug in `mbz-sif-relay.pine` (insertion sort crash when only HTF1 active). Gaps work deferred until relay is fully audited and fixed.
