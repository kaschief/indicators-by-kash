import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../indicators/18-parallax/code/parallax.pine', import.meta.url), 'utf8');
const functionBody = name => {
  const body = source.match(new RegExp(`^${name}\\([\\s\\S]*?\\) =>\\n([\\s\\S]*?)(?=^\\S)`, 'm'))?.[1];
  assert.ok(body, `${name} must exist`);
  return body.trim();
};

// These checks validate source contracts and translated pure calculations, not Pine compilation or chart behavior.
test('Daily replaces the 4-hour slot as the default enabled profile', () => {
  assert.match(source, /^dailyProfileShow = input\.bool\(true, DAILY_PROFILE_NAME,/m);
  assert.match(source, /^slot2Show\s+= input\.bool\(false, "2",/m);
  assert.match(source, /^slot2TFIn\s+= input\.timeframe\("240",/m);
});

test('NYPM is the four-hour New York block after NYAM', () => {
  assert.match(source, /^const int NY_PM_START_MINUTE = NY_AM_END_MINUTE$/m);
  assert.match(source, /^const int NY_PM_DURATION_MINUTES = 4 \* MINUTES_PER_HOUR$/m);
  assert.match(source, /^const int NY_PM_END_MINUTE = NY_PM_START_MINUTE \+ NY_PM_DURATION_MINUTES$/m);
  assert.match(source, /^const string NY_PM_SLOT_TOOLTIP = .+12:00–16:00 NY\."$/m);
  assert.match(source, /sourceLabel=NY_PM_SLOT_NAME,\n     startMinute=NY_PM_START_MINUTE, endMinute=NY_PM_END_MINUTE, fullPeriod=false/);
});

test('intraday forecasts use a live duration-matched pre-session range', () => {
  const collectorBody = functionBody('collect_scheduled_profile_data');
  assert.match(collectorBody, /scheduleAnchorTime = scheduleFromEnd \? currentSessionEnd : currentSessionStart/);
  assert.match(collectorBody, /scheduled_profile_start_allowed\(scheduleAnchorTime, scheduleMode\)/);

  const fetchBody = functionBody('fetch_intraday_profile_data');
  assert.match(fetchBody, /referenceStartMinute = \(startMinute - forecastLeadMinutes \+ MINUTES_PER_DAY\) % MINUTES_PER_DAY/);
  assert.match(fetchBody, /collect_scheduled_profile_data\(\n         tailEnabled, referenceStartMinute, startMinute, forecastSchedule, false, true, false\)/);
  assert.doesNotMatch(source, /collect_forecast_reference_data/);
  for (const [prefix, duration] of [
    ['OVERNIGHT', 'OVERNIGHT_DURATION_MINUTES'],
    ['NY_EARLY', 'NY_EARLY_DURATION_MINUTES'],
    ['NY_AM', 'NY_AM_DURATION_MINUTES'],
    ['NY_PM', 'NY_PM_DURATION_MINUTES'],
    ['IVB', 'IVB_DURATION_MINUTES'],
    ['IVB_PLUS', 'IVB_PLUS_DURATION_MINUTES'],
  ]) {
    assert.match(source, new RegExp(`${prefix}_START_MINUTE, ${prefix}_END_MINUTE, ${duration}, INTRADAY_SAMPLING_SCHEDULE, INTRADAY_FORECAST_SCHEDULE`));
  }
  const forecastBody = functionBody('draw_scheduled_profile_forecast');
  assert.match(forecastBody, /forecastData\.referenceOpen, forecastData\.referenceHigh, forecastData\.referenceLow/);
  assert.doesNotMatch(forecastBody, /profileRuntime\.sessionOpen|profileRuntime\.currentHigh|profileRuntime\.currentLow/);
});

test('live forecast references start on the first tradable bar inside the lead window', () => {
  const collectorBody = functionBody('collect_scheduled_profile_data');
  assert.match(collectorBody, /fullPeriod or not requireExactStart or time == currentSessionStart/);

  const profileBody = functionBody('fetch_scheduled_profile_data');
  assert.match(profileBody, /samplingSchedule, fullPeriod, false, true\)/);

  const forecastBody = functionBody('fetch_intraday_profile_data');
  assert.match(forecastBody, /forecastSchedule, false, true, false\)/);
});

test('Overnight remains 00:00–07:00 while its forecast survives the 17:00 maintenance gap', () => {
  assert.match(source, /^const int OVERNIGHT_START_MINUTE = 0$/m);
  assert.match(source, /^const int OVERNIGHT_DURATION_MINUTES = 7 \* MINUTES_PER_HOUR$/m);
  assert.match(source, /^const int OVERNIGHT_END_MINUTE = OVERNIGHT_START_MINUTE \+ OVERNIGHT_DURATION_MINUTES$/m);
  assert.match(source, /^const string OVERNIGHT_SLOT_TOOLTIP = .+00:00–07:00 NY\."$/m);

  const startsNow = ({ collectThisBar, collecting, fullPeriod, requireExactStart, barTime, scheduledStart }) =>
    collectThisBar && !collecting && (fullPeriod || !requireExactStart || barTime === scheduledStart);
  const firstTradableBar = { collectThisBar: true, collecting: false, fullPeriod: false, barTime: 18 * 60, scheduledStart: 17 * 60 };
  assert.equal(startsNow({ ...firstTradableBar, requireExactStart: false }), true,
    'the 18:00 reopen starts the live reference even though the lead window began at 17:00');
  assert.equal(startsNow({ ...firstTradableBar, requireExactStart: true }), false,
    'an exact-start requirement reproduces the missing Overnight forecast');
});

test('each intraday forecast lead maps to its intended New York reference window', () => {
  const referenceStart = (profileStart, leadMinutes) => (profileStart - leadMinutes + 24 * 60) % (24 * 60);
  assert.deepEqual([
    referenceStart(0, 7 * 60),
    referenceStart(6 * 60, 3 * 60),
    referenceStart(8 * 60, 4 * 60),
    referenceStart(12 * 60, 4 * 60),
    referenceStart(9 * 60, 60),
    referenceStart(9 * 60, 90),
  ], [17 * 60, 3 * 60, 4 * 60, 8 * 60, 8 * 60, 7 * 60 + 30]);
});

test('intraday runtime wiring is shared across every recurring profile', () => {
  const body = functionBody('update_intraday_profile_runtime');
  assert.match(body, /next_scheduled_profile_bounds\(time, profileConfig\)/);
  assert.match(body, /profileRuntime\.forecast := profileData\.forecast/);
  assert.match(body, /scheduled_profile_forecast_visible\(profileConfig, valid, time, forecastStartTime\)/);
  for (const prefix of ['overnight', 'nyEarly', 'nyAm', 'nyPm', 'ivb', 'ivbPlus']) {
    assert.match(source, new RegExp(`update_intraday_profile_runtime\\(${prefix}Runtime, ${prefix}Config, ${prefix}Data, ${prefix}Valid, ${prefix}Transition,`));
    assert.doesNotMatch(source, new RegExp(`^${prefix}Runtime\\.forecast\\.`, 'm'));
  }
});

test('forecast values travel as one shared data object', () => {
  const forecastType = source.match(/^type ScheduledProfileForecastData\n((?:    .+\n)+)/m)?.[1];
  assert.ok(forecastType);
  for (const field of [
    'referenceOpen', 'referenceHigh', 'referenceLow',
    'medianHighOpen', 'meanHighOpen', 'medianOpenLow', 'meanOpenLow',
  ]) {
    assert.match(forecastType, new RegExp(`^    float ${field}$`, 'm'));
  }
  assert.match(source, /^type ScheduledProfileData[\s\S]*?^    ScheduledProfileForecastData forecast$/m);
  assert.match(source, /^type ScheduledProfileRuntime[\s\S]*?^    ScheduledProfileForecastData forecast$/m);
  assert.doesNotMatch(source, /^    float forecast(?:Open|High|Low|Median|Mean)/m);
  assert.match(functionBody('new_scheduled_profile_runtime'), /ScheduledProfileRuntime\.new\(forecast=ScheduledProfileForecastData\.new\(\)\)/);
});

test('intraday request objects are normalized before their fields are read', () => {
  const body = functionBody('scheduled_profile_data_or_empty');
  assert.match(body, /if na\(safeProfileData\)\n        safeProfileData := ScheduledProfileData\.new\(forecast=ScheduledProfileForecastData\.new\(\)\)/);
  assert.match(body, /else if na\(safeProfileData\.forecast\)\n        safeProfileData\.forecast := ScheduledProfileForecastData\.new\(\)/);

  for (const prefix of ['overnight', 'nyEarly', 'nyAm', 'nyPm', 'ivb', 'ivbPlus']) {
    assert.match(source, new RegExp(`^${prefix}Data := scheduled_profile_data_or_empty\\(${prefix}Data\\)$`, 'm'));
  }

  const requestIndex = source.indexOf('[overnightData, nyEarlyData, nyAmData, nyPmData, ivbData, ivbPlusData] = request.security(');
  const normalizationIndex = source.indexOf('overnightData := scheduled_profile_data_or_empty(overnightData)');
  const dereferenceIndex = source.indexOf('overnightChartState, scheduledProfileTrackOnChart, overnightData.startTime');
  assert.ok(requestIndex >= 0 && requestIndex < normalizationIndex);
  assert.ok(normalizationIndex < dereferenceIndex);
});

test('intraday forecast statistics include the latest completed occurrence', () => {
  const body = functionBody('fetch_scheduled_profile_data');
  assert.match(body, /if completedNow\n        record_excursion_sample[\s\S]*\[forecastMedHO, forecastMeanHO\] = sample_stats\(highOpenSamples\)/);
  assert.match(body, /\[forecastMedOL, forecastMeanOL\] = sample_stats\(openLowSamples\)/);
});

test('LD controls are centralized and retain independent profile selections', () => {
  assert.match(source, /^const string GROUP_LIQUIDITY_DEPTH = "Liquidity Depth"/m);
  assert.match(source, /^forecastLiquidityDepth = input\.bool\(false, "Forecast LD", inline="liquidity_depth_options", group=GROUP_LIQUIDITY_DEPTH\)/m);
  assert.match(source, /^showLiquidityDepthProfileNames = input\.bool\(true, "Profile Names on LD", inline="liquidity_depth_options", group=GROUP_LIQUIDITY_DEPTH\)/m);
  assert.match(source, /^dailyLiquidityDepth = input\.bool\(false, DAILY_PROFILE_NAME, group=GROUP_LIQUIDITY_DEPTH, active=dailyProfileShow\)/m);
  for (const [name, label, active] of [
    ['overnightLiquidityDepth', 'OVERNIGHT_SLOT_NAME', 'overnightShow'],
    ['nyEarlyLiquidityDepth', 'NY_EARLY_SLOT_NAME', 'nyEarlyShow'],
    ['nyAmLiquidityDepth', 'NY_AM_SLOT_NAME', 'nyAmShow'],
    ['nyPmLiquidityDepth', 'NY_PM_SLOT_NAME', 'nyPmShow'],
    ['ivbLiquidityDepth', 'IVB_SLOT_NAME', 'ivbShow'],
    ['ivbPlusLiquidityDepth', 'IVB_PLUS_SLOT_NAME', 'ivbPlusShow'],
  ]) {
    assert.match(source, new RegExp(`^${name} = input\\.bool\\(false, ${label}, inline="liquidity_depth_profiles", group=GROUP_LIQUIDITY_DEPTH, active=${active}`, 'm'));
  }
  assert.doesNotMatch(source, /UI_LD/);
  assert.doesNotMatch(source, /inline="(?:overnight|ny_early|ny_am|ny_pm|ivb|ivb_plus)"[^\n]+liquidityDepth/);
});

test('LD is wired to Daily and the six intraday scheduled profiles only', () => {
  assert.match(source, /dailyProfileShow[^\n]+liquidityDepthEnabled=dailyLiquidityDepth/);
  for (const [profile, control] of [
    ['overnightShow', 'overnightLiquidityDepth'],
    ['nyEarlyShow', 'nyEarlyLiquidityDepth'],
    ['nyAmShow', 'nyAmLiquidityDepth'],
    ['nyPmShow', 'nyPmLiquidityDepth'],
    ['ivbShow', 'ivbLiquidityDepth'],
    ['ivbPlusShow', 'ivbPlusLiquidityDepth'],
  ]) {
    assert.match(source, new RegExp(`${profile}[^\\n]+liquidityDepthEnabled=${control}`));
  }
  assert.doesNotMatch(source, /(?:weekly|monthly|slot[12])LiquidityDepth/);
  assert.doesNotMatch(source, /liquidityDepthEnabled=forecast/);
});

test('normal LD requires a breach while Forecast LD projects unbreached sides', () => {
  const body = functionBody('draw_liquidity_depth_side');
  assert.match(body, /if sideState\.activated or forecastEnabled/);
  assert.match(functionBody('draw_liquidity_depth_profile'), /draw_liquidity_depth_side\([^\n]+forecastEnabled\)/);
  assert.match(source, /draw_liquidity_depth_profile\([^\n]+forecastLiquidityDepth\)/);
});

test('every open LD level reaches its session end while stopped levels retain their own endpoint', () => {
  const expression = functionBody('liquidity_depth_end_time')
    .replace(/na\((\w+)\)/g, '($1 == null)');
  const endTime = new Function('sessionEndTime', 'storedEndTime', `return ${expression};`);

  assert.equal(endTime(12, null), 12, 'open NYAM levels reach noon');
  assert.equal(endTime(42, null), 42, 'open Globex levels reach the next-day 18:00 profile edge');
  assert.equal(endTime(12, 10), 10, 'mitigated LD retains its first-touch endpoint');
  assert.equal(endTime(42, 40), 40, 'finalized LD retains the existing cutoff endpoint');
  assert.equal(endTime(12, 16), 16, 'stored endpoints beyond the profile window remain unchanged');
  assert.deepEqual([10, null, null].map(stoppedAt => endTime(12, stoppedAt)), [10, 12, 12],
    'after L1 is mitigated, L2 and L3 still project to the session end');
  assert.deepEqual([10, 11, null].map(stoppedAt => endTime(12, stoppedAt)), [10, 11, 12],
    'mitigation of another level does not shorten the remaining open level');

  const body = functionBody('draw_liquidity_depth_side');
  assert.match(body, /liquidity_depth_end_time\(sessionState\.sessionEndTime, storedEndTime\)/);
  assert.match(body, /bool projectToSessionEnd = na\(storedEndTime\)/);
  assert.doesNotMatch(source, /forecastOnly/);
});

test('LD visibility depends on activation or Forecast LD but projection is per level in both modes', () => {
  const body = functionBody('draw_liquidity_depth_side');
  const visibilityExpression = body.match(/^if ([^\n]+)/)?.[1].replaceAll(' or ', ' || ');
  assert.ok(visibilityExpression);
  const visible = new Function('sideState', 'forecastEnabled', `return ${visibilityExpression};`);
  assert.equal(visible({ activated: false }, false), false);
  assert.equal(visible({ activated: false }, true), true);
  assert.equal(visible({ activated: true }, false), true);
  assert.equal(visible({ activated: true }, true), true);
  assert.match(body, /for levelIndex[^\n]+\n[\s\S]*bool projectToSessionEnd = na\(storedEndTime\)/);
  assert.doesNotMatch(body, /projectToSessionEnd = [^\n]*(?:forecastEnabled|activated)/);
});

test('Forecast LD for the next intraday occurrence uses upcoming bounds and forecast edges', () => {
  const body = functionBody('draw_liquidity_depth_forecast');
  assert.match(body, /forecastEnabled and depthActive and profileRuntime\.forecastVisible/);
  assert.match(body, /compute_forecast_levels\(\n             forecastData\.referenceOpen, forecastData\.referenceHigh, forecastData\.referenceLow,/);
  assert.match(body, /liquidity_depth_price\(forecastOuterHigh, true/);
  assert.match(body, /liquidity_depth_price\(forecastOuterLow, false/);
  assert.match(body, /make_horizontal_line\(true, profileRuntime\.forecastStartTime, na, profileRuntime\.forecastEndTime, na/);
  assert.doesNotMatch(body, /profileState\.currentSession|sessionStartTime|sessionEndTime/);
  assert.match(source, /forecastDepthVisible \? LIQUIDITY_DEPTH_LINES_PER_SESSION : 0/);
  assert.match(source, /forecastDepthVisible \? LIQUIDITY_DEPTH_LABELS_PER_SESSION : 0/);
});

test('open LD lines, connectors and labels share the profile time coordinates on Range charts', () => {
  const body = functionBody('draw_liquidity_depth_side');
  assert.match(body, /make_horizontal_line\(projectToSessionEnd, startTime, startIndex, endTime, endIndex,/);
  assert.match(body, /make_liquidity_depth_connector\(projectToSessionEnd, startTime, startIndex,/);
  assert.match(body, /make_liquidity_depth_label\(projectToSessionEnd, startTime, startIndex, endTime, endIndex,/);
  for (const helper of ['make_liquidity_depth_connector', 'make_liquidity_depth_label']) {
    assert.match(functionBody(helper), /xloc=drawing_xloc\(timeBased\)/);
    assert.doesNotMatch(functionBody(helper), /drawing_x(?:loc)?\([^\n]*false\)/);
  }
});

test('asset registry mirrors Pulse Daily fixed point steps', () => {
  for (const [symbols, step] of [
    ['"NQ", "MNQ"', '27'],
    ['"ES", "MES"', '9'],
    ['"YM", "MYM"', '27'],
    ['"RTY", "M2K"', '4'],
    ['"GC", "MGC"', '3'],
    ['"CL", "MCL", "QM"', '0.125'],
    ['"BTC", "MBT"', '100'],
    ['"ETH", "MET"', '10'],
  ]) {
    assert.ok(source.includes(`AssetFamily.new(array.from(${symbols}), ${step})`));
  }
  assert.doesNotMatch(source, /liquidityDepthPercent|liquidity_depth_percent|percentage-based|percentDepth/);
});

test('anchors use the outer profile edges independent of median and mean ordering', () => {
  const body = functionBody('liquidity_depth_anchors');
  assert.match(body, /math\.max\(medianUpper, meanUpper\)/);
  assert.match(body, /math\.min\(medianLower, meanLower\)/);
});

test('levels use one, two and three fixed steps from the anchor', () => {
  const body = functionBody('liquidity_depth_price');
  assert.match(body, /\(levelIndex \+ 1\) \* depthStep/);
  assert.match(body, /isHigh \? anchorPrice \+ depthOffset : anchorPrice - depthOffset/);
});

test('boundary breach activates depth and can mitigate all crossed levels', () => {
  const body = functionBody('update_liquidity_depth_side');
  assert.match(body, /barExtreme >= anchorPrice/);
  assert.match(body, /barExtreme <= anchorPrice/);
  assert.match(body, /if activationAllowed and not sideState\.activated and boundaryReached/);
  assert.match(body, /sideState\.activationTime := eventTime/);
  assert.match(body, /sideState\.activationIndex := eventIndex/);
  assert.match(body, /for levelIndex = 0 to NUM_LIQUIDITY_DEPTH_LEVELS - 1/);
  assert.match(body, /array\.set\(sideState\.endTimes, levelIndex, eventTime\)/);
  assert.match(body, /array\.set\(sideState\.endIndices, levelIndex, eventIndex\)/);
});

test('activated depth draws retrospectively from the matching profile edge', () => {
  const constructorBody = functionBody('new_liquidity_depth_session');
  assert.match(constructorBody, /sessionStartTime=sessionStartTime/);
  assert.match(constructorBody, /sessionStartIndex=sessionStartIndex/);
  assert.match(constructorBody, /sessionEndTime=sessionEndTime/);
  assert.match(functionBody('update_liquidity_depth_profile'), /new_liquidity_depth_session\(profileRuntime\.startTime, profileRuntime\.startIndex, profileRuntime\.endTime, highAnchor, lowAnchor\)/);

  const drawBody = functionBody('draw_liquidity_depth_side');
  assert.match(drawBody, /int startTime = sessionState\.sessionStartTime/);
  assert.match(drawBody, /int startIndex = sessionState\.sessionStartIndex/);
  assert.match(drawBody, /float anchorPrice = isHigh \? sessionState\.highAnchor : sessionState\.lowAnchor/);
  assert.doesNotMatch(drawBody, /startTime = sideState\.activationTime/);
  assert.doesNotMatch(drawBody, /startIndex = sideState\.activationIndex/);
});

test('activation is session-bound while activated levels track through the NY 16:00 cutoff', () => {
  const cutoffBody = functionBody('liquidity_depth_cutoff_time');
  assert.match(cutoffBody, /hour\(sessionStartTime, NY_TIMEZONE\) >= MARKET_CLOSE_HOUR \? 1 : 0/);
  assert.match(cutoffBody, /dayofmonth\(sessionStartTime, NY_TIMEZONE\) \+ cutoffDayOffset, MARKET_CLOSE_HOUR, 0, 0/);
  const body = functionBody('finalize_liquidity_depth_side');
  assert.match(body, /chart\.is_range \? nz\(sessionState\.lastEligibleTime, sideState\.activationTime\) : sessionState\.cutoffTime/);
  assert.match(body, /nz\(sessionState\.lastEligibleIndex, sideState\.activationIndex\)/);
  const updateBody = functionBody('update_liquidity_depth_profile');
  assert.match(updateBody, /bool trackingWindowOpen = profileStarted and time < currentSession\.cutoffTime/);
  assert.match(updateBody, /bool activationWindowOpen = trackingWindowOpen and time < profileRuntime\.endTime/);
  assert.match(updateBody, /update_liquidity_depth_side\(currentSession\.highSide, currentSession\.highAnchor, true, high, activationWindowOpen,/);
  assert.match(updateBody, /update_liquidity_depth_side\(currentSession\.lowSide, currentSession\.lowAnchor, false, low, activationWindowOpen,/);
});

test('presentation follows Pulse Today tiers and dual chart coordinates', () => {
  assert.match(source, /DEFAULT_LIQUIDITY_DEPTH_EXTENSION_COLOR = color\.new\(color\.rgb\(247, 82, 95\), 32\)/);
  assert.match(source, /DEFAULT_LIQUIDITY_DEPTH_LABEL_BACKGROUND = color\.new\(color\.rgb\(255, 255, 255\), 50\)/);
  assert.match(source, /DEFAULT_LIQUIDITY_DEPTH_LABEL_TEXT = color\.new\(color\.rgb\(156, 156, 156\), 0\)/);
  assert.match(functionBody('liquidity_depth_level_color'), /levelIndex == 0 \? profileColor : DEFAULT_LIQUIDITY_DEPTH_EXTENSION_COLOR/);
  assert.match(functionBody('liquidity_depth_level_width'), /levelIndex == 0 \? 2 : levelIndex == 2 \? 3 : 1/);
  assert.match(functionBody('liquidity_depth_level_style'), /levelIndex == 0 \? line\.style_dashed : line\.style_dotted/);
  assert.match(functionBody('liquidity_depth_profile_name'), /sourceLabel == OVERNIGHT_CHART_LABEL \? OVERNIGHT_SLOT_NAME : sourceLabel/);
  assert.match(functionBody('make_liquidity_depth_connector'), /color\.new\(profileColor, 80\).*width=1, style=line\.style_dashed/s);
  assert.match(functionBody('draw_liquidity_depth_side'), /make_horizontal_line\(projectToSessionEnd,/);
  assert.match(functionBody('make_liquidity_depth_label'), /drawing_x\(labelTime, labelIndex, timeBased\)/);
});

test('timeframe, history state and drawing budgets share centralized gates', () => {
  assert.match(source, /intradayLiquidityDepthTimeframeAllowed = chart\.is_range or timeframe\.in_seconds\(timeframe\.period\) <= INTRADAY_LIQUIDITY_DEPTH_MAX_TIMEFRAME/);
  assert.match(functionBody('scheduled_profile_liquidity_depth_active'), /config\.liquidityDepthEnabled and profileRuntime\.valid and intradayLiquidityDepthTimeframeAllowed and liquidityDepthAssetSupported/);
  assert.match(functionBody('update_liquidity_depth_profile'), /array\.push\(profileState\.history, profileState\.currentSession\)/);
  assert.match(functionBody('update_liquidity_depth_profile'), /historyLimit - 1/);
  const drawBody = functionBody('draw_liquidity_depth_profile');
  assert.match(drawBody, /int count = math\.min\(historyCap, array\.size\(profileState\.history\)\)/);
  assert.match(drawBody, /int historyIndex = array\.size\(profileState\.history\) - 1 - historyOffset/);
  assert.doesNotMatch(drawBody, /activated[^\n]+historyIndex|while[^\n]+activated/);
  assert.match(functionBody('allocate_history_liquidity_depth_caps'), /LIQUIDITY_DEPTH_LINES_PER_SESSION/);
  assert.match(functionBody('allocate_history_liquidity_depth_caps'), /LIQUIDITY_DEPTH_LABELS_PER_SESSION/);
  assert.match(source, /allocate_history_liquidity_depth_caps\(availableHistoryLinesBeforeDepth, availableHistoryLabelsBeforeDepth/);
});

test('scheduled profile requests scale to configured lookback and history', () => {
  const body = functionBody('scheduled_profile_request_bars');
  assert.match(body, /sampleLookback \+ historyLimit \+ SCHEDULED_PROFILE_REQUEST_SESSION_BUFFER/);
  assert.match(body, /math\.min\(SCHEDULED_PROFILE_REQUEST_BARS, requestedSourceBars\)/);
  assert.match(body, /DISABLED_PROFILE_REQUEST_BARS/);
  assert.equal(source.match(/calc_bars_count=scheduled_profile_request_bars\(/g)?.length, 1);
  assert.equal(source.match(/calc_bars_count=scheduled_intraday_request_bars\(/g)?.length, 1);
  assert.match(source, /request\.security\(\n     htfTickerId, SESSION_SOURCE_TIMEFRAME,\n     fetch_intraday_profiles_data\(/);
  assert.equal(source.match(/fetch_scheduled_profile_data\(/g)?.length, 3);
  assert.equal(source.match(/fetch_intraday_profile_data\(/g)?.length, 7);
  const combinedBody = functionBody('scheduled_intraday_request_bars');
  assert.equal(combinedBody.match(/math\.max\(/g)?.length, 5);
  assert.match(functionBody('profile_request_history_limit'), /latestOnlyEnabled \? 1 : historyLimit/);
  assert.equal(source.match(/profile_request_history_limit\(latestOnly,/g)?.length, 11);
  assert.equal(source.match(/SourceRequestBars = scheduled_profile_request_bars\(/g)?.length, 6);
  assert.match(functionBody('scheduled_profile_tail_enabled'), /bar_index >= last_bar_index - requestBars \+ 1/);
  assert.equal(functionBody('fetch_intraday_profile_data').match(/scheduled_profile_tail_enabled\(/g)?.length, 1);
});

test('disabled HTF profiles cannot seed a one-bar Daily request', () => {
  const openBody = functionBody('fetch_htf_open');
  const statsBody = functionBody('fetch_htf_stats');
  assert.match(openBody, /^if enabled\n        request\.security/);
  assert.match(statsBody, /if enabled and useConfirmedWeeklyStats\n        request\.security/);
  assert.match(statsBody, /else if enabled\n        request\.security/);
  assert.doesNotMatch(openBody + statsBody, /DISABLED_PROFILE_REQUEST_BARS|htf_(?:open|stats)_request_bars/);
  assert.equal(statsBody.match(/calc_bars_count=sampleLookback \+ SLOT_HISTORY_MAX \+ 2/g)?.length, 2);
  for (const enabledInput of ['slot1Show', 'slot2Show', 'weeklyProfileShow', 'monthlyProfileShow']) {
    assert.match(source, new RegExp(`fetch_htf_open\\([^\\n]+${enabledInput}`));
    assert.match(source, new RegExp(`fetch_htf_stats\\([^\\n]+${enabledInput}`));
  }
  assert.match(source, /fetch_htf_stats\(htfTickerId, "D", dailyProfileShow and not useMidnight, htfSlotLookback\)/);
});

test('HTF open requests share the deepest enabled history when timeframes overlap', () => {
  assert.match(source, /htfOpenRequestHistory = math\.max\(slot1Show \? slot1RequestHistory : 0, slot2Show \? slot2RequestHistory : 0,\n     weeklyProfileShow \? weeklyProfileRequestHistory : 0, monthlyProfileShow \? monthlyProfileRequestHistory : 0\)/);
  assert.equal(source.match(/fetch_htf_open\(htfTickerId, [^\n]+, htfOpenRequestHistory\)/g)?.length, 4);
  assert.match(functionBody('fetch_htf_open'), /calc_bars_count=historyLimit \+ 2/);
});

test('history budget allocators stop at the deepest requested layer', () => {
  assert.match(functionBody('max_requested_history_layers'), /math\.min\(historyLimit, requestedLayers\)/);
  assert.match(functionBody('allocate_history_zone_caps'), /for layer = 1 to requestedLayers/);
  assert.doesNotMatch(functionBody('allocate_history_zone_caps'), /for layer = 1 to maxHistoryZones/);
  assert.match(functionBody('allocate_history_liquidity_depth_caps'), /for layer = 1 to requestedLayers/);
  assert.doesNotMatch(functionBody('allocate_history_liquidity_depth_caps'), /for layer = 1 to SLOT_HISTORY_MAX/);

  const fibAllocator = source.match(/^allocate_history_fib_caps[\s\S]*?^    \[fibCaps, labelCaps\]$/m)?.[0];
  assert.ok(fibAllocator, 'allocate_history_fib_caps must exist');
  assert.match(fibAllocator, /for layer = 1 to requestedLayers/);
  assert.doesNotMatch(fibAllocator, /for layer = 1 to maxHistoryZones/);
});
