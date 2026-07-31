# Revelio Auto Swept Lines — Parked Development Work

Updated: 2026-07-31
Status: Closed — retained only as the historical record of rejected `/2` and `/3` approaches
TradingView status: Superseded by the principal-reviewed, TradingView-validated, and user-approved `/6` design in ADR-001

## Why this was parked

The Auto Swept Lines experiment crossed TradingView's compiled-token ceiling while integrating the feature consistently with rendering, drawing budgets, Touch Markers, Intraday Focus, and historical Focus backfill.

At the time this work was parked, the manual swept-line controls remained sufficient for training use. Auto was later redesigned, validated, and approved through ADR-001; this document no longer governs current behavior.

This document preserves the rejected `/2` and `/3` work as historical evidence. The current decision is [ADR-001 — Adaptive Auto Swept relevance](REVELIO-AUTO-SWEPT-ADR.md); where this file conflicts with the ADR, the ADR governs.

The `/3` capacity build is stable, but its two boundary picks plus two intraday admissions per anchor are too sparse relative to the larger Touch-eligible archive. A level can therefore remain detectable after its line is removed, leaving the user unable to anticipate the touch. Touch Marker behavior itself is correct and must remain unchanged.

## Superseded `/4` design

- The current manual retention setting and same-anchor post-sweep grace are unconditional visibility floors.
- One plan ranks price zones across enabled anchors at each Futures/UTC trading-day boundary.
- A trimmed 14-profile Globex/UTC ADR bounds plausible reach without adding a request.
- Higher-timeframe overlap, distinct anchors, distinct completed profiles, complementary roles, and repeated later control strengthen a zone.
- Repeated later value-area containment is a transparent acceptance proxy that demotes, but does not automatically delete, a reference.
- Admitted identities keep their exact source prices; existing merged labels reveal why a zone matters.
- New zones normally enter inside 1.25 ADR. Prior selections receive a 1.50 ADR envelope.
- One directionally bounded add-only expansion can occur after price travels 1.00 ADR from the cycle open, extending the search another 0.50 ADR beyond that extreme. Nothing is evicted intraday.
- Manual/grace lines carry through the cycle without using adaptive quotas.
- Protected and selected lines reserve capacity before ordinary completed-profile history.
- Touch Marker behavior is unchanged.

The local publication chain is:

1. `RevelioCoreLibraryDevelopment/4`
2. `RevelioGapsLibraryDevelopment/4`, importing Core `/4`
3. `new revelio • development`, importing Core/Gaps `/4` and Interactions `/1`

## Historical `/3` product contract

When `Auto Swept Lines` is enabled:

1. POC, aPOC, VAH, and VAL are evaluated independently.
2. A swept continuation remains visible until a later profile of the same anchor finalizes.
3. At each futures trading-day or UTC-day boundary, choose up to two baseline swept levels per enabled anchor.
4. A level enters within one source-profile range and a prior baseline selection may survive the daily refresh within 1.5 ranges.
5. Up to two additional levels per anchor may activate when grace ends nearby or price newly enters proximity on a confirmed bar.
6. Newest profiles win exact-distance ties.
7. Intraday admissions are monotonic: they can add but cannot evict, remove, or reorder another active level.
8. Intraday Focus `Swept Levels` remains an explicit override.
9. Touch Marker mode, window, history, older-level inclusion, and daily-retouch settings cannot change line visibility.
10. Historical Focus backfill uses each admission timestamp so a line is never painted backward before it became active.

The current manual behavior remains the fallback:

- RTH and Globex use configured calendar-day windows.
- Weekly, Monthly, and Quarterly use their configured fixed-duration windows.
- The newest completed profile and Focus `Swept Levels` override the keep window.
- Manual retention remains profile-wide, based on the newest breach among POC, aPOC, VAH, and VAL.

## Preserved UI and constants

```pine
AUTO_SWEPT_BOUNDARY_PICKS_PER_ANCHOR = 2
AUTO_SWEPT_MAX_ACTIVE_PER_ANCHOR = 4
AUTO_SWEPT_ENTRY_PROFILE_RANGES = 1.0
AUTO_SWEPT_EXIT_PROFILE_RANGES = 1.5
AUTO_SWEPT_SELECTION_HISTORY_DAYS = MAX_LEVEL_HIT_TRADING_DAY_SCAN + 1
AUTO_SWEPT_ARCHIVE_PROFILES = 50

LABEL_AUTO_SWEPT_LINES = "Auto Swept Lines"
TOOLTIP_AUTO_SWEPT_LINES = "Keeps each swept level through its next anchor finalization. The daily refresh retains 2 nearby archived levels; up to 2 more can activate on confirmed proximity entries (4 per anchor maximum). Active lines stay fixed intraday, and a wider exit range prevents back-and-forth."

autoSweptLines = input.bool(false, LABEL_AUTO_SWEPT_LINES, active=anySweepControlsActive, tooltip=TOOLTIP_AUTO_SWEPT_LINES, group=GROUP_SWEEP)
```

When Auto is restored, the five manual retention controls should use `active=<anchor sweep controls> and not autoSweptLines`.

The archive limit is an internal bounded-history safeguard, not another user-selected display limit. It keeps Auto selection independent from ordinary profile visibility while preventing unbounded Pine collections.

## Performance revision

The `/3` candidate:

- Folds proximity admission into the existing confirmed-bar archive sweep pass.
- Synchronizes full archives only when an anchor can finalize or add a profile.
- Runs the Touch-only synchronization only while Touch detection is active.
- Caches archive visibility masks once per last-bar render refresh.
- Renders all selected Auto lines in a protected first pass before nonselected archive and ordinary completed-profile lines compete for capacity.

## Preserved state additions

`RenderBudgetAnchor` gained:

```pine
map<string, bool> autoSweptKeys
```

`FocusHitLevel` gained:

```pine
int autoGraceEndTime
```

Selection history:

```pine
type AutoSweptSelection
    string key
    int cycleSerial
```

Runtime collections:

```pine
var map<string, bool> rthAutoSweptKeys = map.new<string, bool>()
var map<string, bool> globexAutoSweptKeys = map.new<string, bool>()
var map<string, bool> weeklyAutoSweptKeys = map.new<string, bool>()
var map<string, bool> monthlyAutoSweptKeys = map.new<string, bool>()
var map<string, bool> quarterlyAutoSweptKeys = map.new<string, bool>()
var array<AutoSweptSelection> autoSweptSelectionHistory = array.new<AutoSweptSelection>()
```

## Preserved selection helpers

```pine
autoSweptCycleSerial(int eventTime) =>
    isTwentyFourSevenAsset ? calendarDateSerial(eventTime, UTC_TIMEZONE) : calendarDateSerial(eventTime + GLOBEX_REOPEN_SHIFT_MS, NY_TIMEZONE)

firstProfileFinalizedAfter(array<Profile> profiles, int eventTime) =>
    int firstFinalizedTime = na
    if not na(eventTime) and array.size(profiles) > 0
        for profileIndex = 0 to array.size(profiles) - 1
            int finalizedTime = array.get(profiles, profileIndex).finalizedTime
            if not na(finalizedTime) and finalizedTime > eventTime
                firstFinalizedTime := finalizedTime
                break
    firstFinalizedTime

profileFinalizedAfter(array<Profile> profiles, int eventTime) =>
    Profile latestProfile = array.size(profiles) > 0 ? array.last(profiles) : na
    int latestFinalizedTime = not na(latestProfile) ? latestProfile.finalizedTime : na
    not na(eventTime) and not na(latestFinalizedTime) and latestFinalizedTime > eventTime

retainNearestAutoSweptLevel(array<string> keys, array<float> distances, string key, float distance) =>
    int insertAt = array.size(distances)
    if array.size(distances) > 0
        for candidateIndex = 0 to array.size(distances) - 1
            if distance < array.get(distances, candidateIndex)
                insertAt := candidateIndex
                break
    if insertAt >= array.size(distances)
        array.push(keys, key)
        array.push(distances, distance)
    else
        array.insert(keys, insertAt, key)
        array.insert(distances, insertAt, distance)
    if array.size(keys) > AUTO_SWEPT_NEAREST_PER_ANCHOR
        array.pop(keys)
        array.pop(distances)
    true

considerAutoSweptLevel(array<Profile> profiles, Profile profile, SessionStyle style, string levelName, float levelPrice, int breachTime, float referencePrice, array<string> keys, array<float> distances) =>
    float profileRange = math.max(syminfo.mintick, profile.priceHigh - profile.priceLow)
    float distance = math.abs(referencePrice - levelPrice)
    bool archived = not na(breachTime) and profileFinalizedAfter(profiles, breachTime)
    if archived and not na(levelPrice) and distance <= profileRange * AUTO_SWEPT_MAX_DISTANCE_PROFILE_RANGES
        string sourceProfileKey = levelHitSourceProfileKey(profile.startTime, profile.endTime, style)
        retainNearestAutoSweptLevel(keys, distances, levelHitKey(sourceProfileKey, levelName), distance)
    true

pruneAutoSweptSelectionHistory(array<AutoSweptSelection> selections, int currentCycleSerial) =>
    bool pruning = array.size(selections) > 0
    while pruning
        AutoSweptSelection oldestSelection = array.first(selections)
        if currentCycleSerial - oldestSelection.cycleSerial > AUTO_SWEPT_SELECTION_HISTORY_DAYS
            array.shift(selections)
            pruning := array.size(selections) > 0
        else
            pruning := false
    true

selectAutoSweptLevels(array<Profile> profiles, SessionStyle style, bool active, float referencePrice, map<string, bool> selectedKeys, array<AutoSweptSelection> selectionHistory, int cycleSerial) =>
    map.clear(selectedKeys)
    array<string> nearestKeys = array.new<string>()
    array<float> nearestDistances = array.new<float>()
    if active and style.extensionMode == LEVEL_BREACH_SWEEP and not na(referencePrice) and array.size(profiles) > 0
        for profileIndex = array.size(profiles) - 1 to 0
            Profile profile = array.get(profiles, profileIndex)
            if profile.isValid
                if style.showPoc
                    considerAutoSweptLevel(profiles, profile, style, LABEL_POC, profile.pocPrice, profile.pocBreachTime, referencePrice, nearestKeys, nearestDistances)
                if style.showAlternatePoc and profile.hasAlternatePoc
                    considerAutoSweptLevel(profiles, profile, style, LABEL_ALTERNATE_POC, profile.alternatePocPrice, profile.alternatePocBreachTime, referencePrice, nearestKeys, nearestDistances)
                if style.showValueArea
                    considerAutoSweptLevel(profiles, profile, style, LABEL_VAH, profile.valueAreaHighPrice, profile.valueAreaHighBreachTime, referencePrice, nearestKeys, nearestDistances)
                    considerAutoSweptLevel(profiles, profile, style, LABEL_VAL, profile.valueAreaLowPrice, profile.valueAreaLowBreachTime, referencePrice, nearestKeys, nearestDistances)
    if array.size(nearestKeys) > 0
        for keyIndex = 0 to array.size(nearestKeys) - 1
            string key = array.get(nearestKeys, keyIndex)
            map.put(selectedKeys, key, true)
            array.push(selectionHistory, AutoSweptSelection.new(key, cycleSerial))
    pruneAutoSweptSelectionHistory(selectionHistory, cycleSerial)
    true

autoSweptSelectedAtTime(array<AutoSweptSelection> selections, string key, int eventTime) =>
    bool selected = false
    int cycleSerial = autoSweptCycleSerial(eventTime)
    if array.size(selections) > 0
        for selectionIndex = array.size(selections) - 1 to 0
            AutoSweptSelection selection = array.get(selections, selectionIndex)
            if selection.cycleSerial < cycleSerial
                break
            if selection.cycleSerial == cycleSerial and selection.key == key
                selected := true
                break
    selected

autoSweptCurrentCycleKey(array<AutoSweptSelection> selections, int eventTime) =>
    int cycleSerial = autoSweptCycleSerial(eventTime)
    string key = str.tostring(cycleSerial)
    if array.size(selections) > 0
        for selectionIndex = array.size(selections) - 1 to 0
            AutoSweptSelection selection = array.get(selections, selectionIndex)
            if selection.cycleSerial < cycleSerial
                break
            if selection.cycleSerial == cycleSerial
                key += "|" + selection.key
    key
```

## Runtime selection hook

The selector ran after the five anchor processors so boundary-bar finalizations were already known:

```pine
if autoSweptLines and globexDayStart
    int autoSweptCycle = autoSweptCycleSerial(time)
    selectAutoSweptLevels(rthState.profiles, rthStyle, rthFilterEnabled, open, rthAutoSweptKeys, autoSweptSelectionHistory, autoSweptCycle)
    selectAutoSweptLevels(globexState.profiles, globexStyle, globexFilterEnabled, open, globexAutoSweptKeys, autoSweptSelectionHistory, autoSweptCycle)
    selectAutoSweptLevels(weeklyState.profiles, weeklyStyle, weeklyFilterEnabled, open, weeklyAutoSweptKeys, autoSweptSelectionHistory, autoSweptCycle)
    selectAutoSweptLevels(monthlyState.profiles, monthlyStyle, monthlyFilterEnabled, open, monthlyAutoSweptKeys, autoSweptSelectionHistory, autoSweptCycle)
    selectAutoSweptLevels(quarterlyState.profiles, quarterlyStyle, quarterlyFilterEnabled, open, quarterlyAutoSweptKeys, autoSweptSelectionHistory, autoSweptCycle)
```

## Visibility contract

The Auto implementation replaced profile-wide manual visibility with a shared per-level predicate:

```pine
levelSweptContinuationVisible(array<Profile> profiles, Profile profile, int breachTime, bool isMostRecentCompleted, SessionStyle style, bool focusSurfaced, map<string, bool> autoSweptKeys, string levelName) =>
    bool visible = false
    if style.extensionMode == LEVEL_BREACH_SWEEP and not na(breachTime)
        if autoSweptLines
            string key = levelHitKey(levelHitSourceProfileKey(profile.startTime, profile.endTime, style), levelName)
            bool graceActive = not profileFinalizedAfter(profiles, breachTime)
            visible := isMostRecentCompleted or focusSurfaced or graceActive or map.contains(autoSweptKeys, key)
        else
            visible := profileCustomSweptContinuationVisible(profile, isMostRecentCompleted, style.extensionMode, style.sweptKeepMs, focusSurfaced)
    visible
```

This predicate was threaded through:

- `profileLineCount`
- `liveProfileLineCount`
- `allocateProfileBudget`
- `profileLevelHitPresentation`
- `registerProfileLevelHitPresentations`
- `renderProfile`
- `updateProfileLevelHitTrace`
- `updateLevelHitTrace`
- `updateFocusedLevelHitTrace`
- `renderAnchor`
- Every `RenderBudgetAnchor` constructor

## Focus backfill additions

The historical path stored the first later profile-finalization timestamp for each level, retained daily selection history, and included the current selection set in `focusedHitBackfillKey`.

Restoration points:

- Add `autoGraceEndTime` back to `FocusHitLevel`.
- Calculate it with `firstProfileFinalizedAfter(...)` for every POC/aPOC/VAH/VAL.
- Pass selection history to `focusHitLevelVisibleAtTime(...)`.
- In Auto mode, historical visibility is `autoGraceActive or autoSelected`.
- Pass selection history to `backfillFocusedLevelHitTrace(...)`.
- Append `autoSweptCurrentCycleKey(...)` to the Focus backfill cache key.

## Required redesign before restoration

Do not restore the implementation unchanged merely because compiler headroom exists.

Before restoration:

1. Replace five selected-key maps with the smallest state representation that preserves one selection set per anchor.
2. Avoid threading Auto collections through every renderer and Touch Marker function where a narrower state contract works.
3. Decide whether exact historical Auto selection reconstruction is required for Focus, or whether Focus may classify Auto-selected history as archived.
4. Recompile after each Auto slice.
5. Keep the main indicator materially below the compiled-token ceiling after Auto returns.

## TradingView validation matrix

- Auto off matches manual swept-line output.
- POC, aPOC, VAH, and VAL sweep independently.
- A later sibling sweep cannot revive an older continuation.
- Grace ends only after a later same-anchor profile finalizes.
- The two nearest eligible archived levels are selected at the boundary open.
- Intraday proximity can add a line, but no active line is removed, replaced, or reordered before the next daily checkpoint.
- Touch Marker settings do not alter line visibility.
- Focus `Swept Levels` remains an explicit override.
- Historical Focus markers preserve visible-versus-archived provenance.
- NQ1! on 1m, 5m, 15m, 1h, and 4h.
- BTC or another 24/7 symbol across UTC boundaries.
- Friday, weekend, and holiday boundaries.
- 180R and 360R Range charts.
- Full five-anchor drawing-budget stress.

## Restoration gate

Restore Auto only after:

- [x] The chosen library-backed manual Revelio client compiles.
- [x] The manual swept-line baseline passes TradingView comparison.
- [x] The Auto redesign has a current principal review.
- [x] The `/2` library chain and Auto host compiled without the compiled-token error.
- [x] The revised `/3` Core/Gaps libraries were published and the host compile result was recorded.
- [x] The Interactions `/1` capacity build compiles and was added to the chart.
- [ ] Auto passes Replay, realtime, Range-chart, and visual validation.
