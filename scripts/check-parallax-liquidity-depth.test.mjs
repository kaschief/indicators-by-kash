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
  assert.match(source, /^const color NY_AM_COLOR = color\.rgb\(247, 82, 95\)$/m);
  assert.match(source, /^const color NY_PM_COLOR = color\.rgb\(198, 40, 40\)$/m);
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
  assert.match(body, /var ScheduledProfileData emptyProfileData = ScheduledProfileData\.new\(forecast=ScheduledProfileForecastData\.new\(\)\)/);
  assert.match(body, /if na\(safeProfileData\)\n        safeProfileData := emptyProfileData/);
  assert.match(body, /else if na\(safeProfileData\.forecast\)\n        safeProfileData\.forecast := ScheduledProfileForecastData\.new\(\)/);

  for (const prefix of ['overnight', 'nyEarly', 'nyAm', 'nyPm', 'ivb', 'ivbPlus']) {
    assert.match(source, new RegExp(`^${prefix}Data := scheduled_profile_data_or_empty\\(${prefix}Data\\)$`, 'm'));
  }

  const requestIndex = source.indexOf('[overnightData, nyEarlyData, nyAmData, nyPmData, ivbData, ivbPlusData] = if ');
  const normalizationIndex = source.indexOf('overnightData := scheduled_profile_data_or_empty(overnightData)');
  const dereferenceIndex = source.indexOf('overnightChartState, scheduledProfileTrackOnChart, overnightData.startTime');
  assert.ok(requestIndex >= 0 && requestIndex < normalizationIndex);
  assert.ok(normalizationIndex < dereferenceIndex);
});

test('Daily-only charts skip the intraday request instead of returning disabled profile objects', () => {
  const requestBlock = source.match(/^\[overnightData, nyEarlyData, nyAmData, nyPmData, ivbData, ivbPlusData\] = if ([^\n]+)\n([\s\S]*?)^overnightData :=/m);
  assert.ok(requestBlock);
  const expectedValids = ['overnightValid', 'nyEarlyValid', 'nyAmValid', 'nyPmValid', 'ivbValid', 'ivbPlusValid'];
  assert.deepEqual(requestBlock[1].split(' or '), expectedValids);
  const [enabledBranch, disabledBranch] = requestBlock[2].split('\nelse\n');
  assert.match(enabledBranch, /^    request\.security\(/);
  assert.match(enabledBranch, /fetch_intraday_profiles_data\(/);
  assert.doesNotMatch(disabledBranch, /request\.|\.new\(/);
  assert.match(disabledBranch, /ScheduledProfileData unavailableData = na/);
  assert.equal(disabledBranch.match(/unavailableData/g)?.length, 7);
});

test('disabled sessions and bars outside their requested history return no object payload', () => {
  const body = functionBody('fetch_intraday_profile_data');
  const constructorGate = body.indexOf('if tailEnabled\n');
  assert.ok(constructorGate >= 0);
  assert.doesNotMatch(body.slice(0, constructorGate), /ScheduledProfile(?:Forecast)?Data\.new\(/);
  assert.match(body, /ScheduledProfileData profileData = na\n    if tailEnabled/);
  assert.match(body, /if tailEnabled\n        ScheduledProfileForecastData forecastData = ScheduledProfileForecastData\.new\(/);
  assert.match(body, /        profileData := ScheduledProfileData\.new\(/);
  assert.match(body, /\n    profileData$/);
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
  for (const [name, enabledByDefault, label, active] of [
    ['overnightLiquidityDepth', true, 'OVERNIGHT_SLOT_NAME', 'overnightShow'],
    ['nyEarlyLiquidityDepth', true, 'NY_EARLY_SLOT_NAME', 'nyEarlyShow'],
    ['nyAmLiquidityDepth', true, 'NY_AM_SLOT_NAME', 'nyAmShow'],
    ['nyPmLiquidityDepth', true, 'NY_PM_SLOT_NAME', 'nyPmShow'],
    ['ivbLiquidityDepth', false, 'IVB_SLOT_NAME', 'ivbShow'],
    ['ivbPlusLiquidityDepth', false, 'IVB_PLUS_SLOT_NAME', 'ivbPlusShow'],
  ]) {
    assert.match(source, new RegExp(`^${name} = input\\.bool\\(${enabledByDefault}, ${label}, inline="liquidity_depth_profiles", group=GROUP_LIQUIDITY_DEPTH, active=${active}`, 'm'));
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
  const endTime = (sessionEndTime, storedEndTime) =>
    storedEndTime == null || storedEndTime >= sessionEndTime ? sessionEndTime : storedEndTime;

  assert.equal(endTime(12, null), 12, 'open NYAM levels reach noon');
  assert.equal(endTime(42, null), 42, 'open Globex levels reach the next-day 18:00 profile edge');
  assert.equal(endTime(12, 10), 10, 'mitigated LD retains its first-touch endpoint');
  assert.equal(endTime(42, 40), 40, 'mitigation inside the profile retains its endpoint');
  assert.equal(endTime(12, 12), 12, 'a touch at the profile boundary ends at the profile boundary');
  assert.equal(endTime(12, 16), 12, 'an endpoint after the profile window is clamped to the profile boundary');
  assert.deepEqual([10, null, null].map(stoppedAt => endTime(12, stoppedAt)), [10, 12, 12],
    'after L1 is mitigated, L2 and L3 still project to the session end');
  assert.deepEqual([10, 11, null].map(stoppedAt => endTime(12, stoppedAt)), [10, 11, 12],
    'mitigation of another level does not shorten the remaining open level');

  const body = functionBody('draw_liquidity_depth_side');
  assert.match(functionBody('liquidity_depth_end_time'), /na\(storedEndTime\) or storedEndTime >= sessionEndTime \? sessionEndTime : storedEndTime/);
  assert.match(body, /liquidity_depth_end_time\(sessionState\.sessionEndTime, storedEndTime\)/);
  assert.match(body, /bool endAtSession = na\(storedEndTime\) or storedEndTime >= sessionState\.sessionEndTime/);
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
  assert.match(body, /for levelIndex[^\n]+\n[\s\S]*bool endAtSession = na\(storedEndTime\) or storedEndTime >= sessionState\.sessionEndTime/);
  assert.doesNotMatch(body, /endAtSession = [^\n]*(?:forecastEnabled|activated)/);
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
  assert.match(body, /make_horizontal_line\(endAtSession, startTime, startIndex, endTime, endIndex,/);
  assert.match(body, /make_liquidity_depth_connector\(endAtSession, startTime, startIndex,/);
  assert.match(body, /make_liquidity_depth_label\(endAtSession, startTime, startIndex, endTime, endIndex,/);
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

test('Daily Boundary Exceeded controls configure reusable profile-edge qualification', () => {
  assert.match(source, /^const string GROUP_DAILY_BOUNDARY_EXCEEDED = "Daily Boundary Exceeded"$/m);
  assert.doesNotMatch(source, /Daily Outer Touch/);
  assert.match(source, /^dailyBoundaryExceededEnabled = input\.bool\(true, "Enable",/m);
  assert.match(source, /^dailyBoundaryExceededCutoff = input\.string\("08:00", "", options=\[/m);
  assert.match(source, /^dailyBoundaryExceededHistory = input\.bool\(false, "History", inline="daily_boundary_exceeded", group=GROUP_DAILY_BOUNDARY_EXCEEDED, active=dailyProfileShow and dailyBoundaryExceededEnabled\)$/m);
  assert.match(source, /inline="daily_boundary_exceeded", group=GROUP_DAILY_BOUNDARY_EXCEEDED, active=dailyProfileShow and dailyBoundaryExceededEnabled/);
  assert.doesNotMatch(source, /dailyBoundaryExceededColor|dailyBoundaryExceededWidth|DEFAULT_DAILY_BOUNDARY_EXCEEDED_COLOR/);
  const cutoffOptionsBlock = source.match(/^dailyBoundaryExceededCutoff = input\.string\("08:00", "", options=\[([\s\S]*?)\],\n     inline="daily_boundary_exceeded"/m)?.[1];
  assert.ok(cutoffOptionsBlock, 'Daily cutoff options must exist');
  const cutoffOptions = [...cutoffOptionsBlock.matchAll(/"(\d{2}:\d{2})"/g)].map(match => match[1]);
  const expectedCutoffOptions = Array.from({ length: 96 }, (_, index) => {
    const minutes = index * 15;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });
  assert.deepEqual(cutoffOptions, expectedCutoffOptions);
  assert.match(functionBody('time_option_minutes'), /str\.substring\(timeOption, 0, 2\)[\s\S]*str\.substring\(timeOption, 3, 5\)/);
  assert.match(source, /^type ProfileEdgeQualificationState\n    ProfileEdgeQualificationSnapshot currentSnapshot\n    array<ProfileEdgeQualificationSnapshot> history\n    box currentOutline\n    array<box> historyOutlines\n    bool currentDirty\n    bool historyDirty$/m);
  assert.match(source, /^type ScheduledProfile[\s\S]*?^    ProfileEdgeQualification edgeQualification$/m);
  assert.doesNotMatch(source, /^type ProfileEdgeQualificationState[\s\S]*?^    (?:int profileStart|float outer|bool triggered)/m);
  assert.match(source, /dailyProfileEdgeQualificationConfig = ProfileEdgeQualificationConfig\.new\(\n     enabled=dailyBoundaryExceededEnabled/);
  assert.match(source, /historyEnabled=dailyBoundaryExceededHistory/);
  assert.match(source, /cutoffMinute=time_option_minutes\(dailyBoundaryExceededCutoff\)/);
  assert.match(source, /outlineColor=color\.orange,\n     outlineWidth=2/);
  assert.match(source, /edgeQualification=ProfileEdgeQualification\.new\(config=dailyProfileEdgeQualificationConfig, state=new_profile_edge_qualification_state\(\)\)/);
  assert.equal(source.match(/edgeQualification=na/g)?.length, 6);
  assert.doesNotMatch(source, /disabledProfileEdgeQualificationConfig/);

  const updateBody = functionBody('update_profile_edge_qualification_state');
  assert.match(updateBody, /\[highAnchor, lowAnchor\] = liquidity_depth_anchors\(/);
  assert.match(updateBody, /profile_edge_observation_qualifies\(/);
  assert.doesNotMatch(updateBody, /\btime_close\b|\bbarstate\b|\bsyminfo\b|\btimenow\b/);
  assert.match(source, /time, time_close, barstate\.isconfirmed, high, low, syminfo\.mintick\)/);

  const outlineBody = functionBody('make_profile_edge_qualification_outline');
  assert.match(outlineBody, /drawing_x\(qualificationSnapshot\.profileStartTime, qualificationSnapshot\.profileStartIndex, timeBased\), qualificationSnapshot\.outerHigh/);
  assert.match(outlineBody, /drawing_x\(qualificationSnapshot\.profileEndTime, qualificationSnapshot\.profileEndIndex, timeBased\), qualificationSnapshot\.outerLow/);
  assert.match(outlineBody, /xloc=drawing_xloc\(timeBased\)/);
  assert.match(outlineBody, /bgcolor=na, border_color=outlineColor, border_width=outlineWidth/);
  assert.match(source, /scheduledProfileQualificationBoxReserve \+= latestOnly or not edgeQualification\.config\.historyEnabled \? 1 : profileConfig\.historyLimit/);
  assert.match(source, /qualificationHistoryCap = latestOnly or not edgeQualification\.config\.historyEnabled \? 0 : array\.get\(boxHistZoneCaps, profileBudgetIndex\)/);
  assert.doesNotMatch(source, /addRow\(colorTable, row, profileConfig\.sourceLabel \+ " Outer Touch"/);
});

test('profile-edge observations require a complete confirmed bar inside the profile and cutoff', () => {
  const qualifies = ({ start, end, confirmed, profileStart, profileEnd, deadline, barHigh, barLow, highAnchor, lowAnchor, tolerance }) =>
    confirmed && start != null && end != null && start >= profileStart && end <= profileEnd && end <= deadline &&
    (barHigh >= highAnchor - tolerance || barLow <= lowAnchor + tolerance);
  const base = { start: 100, end: 110, confirmed: true, profileStart: 100, profileEnd: 200, deadline: 150, barHigh: 109, barLow: 91, highAnchor: 110, lowAnchor: 90, tolerance: 1 };
  assert.equal(qualifies(base), true, 'one-tick proximity qualifies');
  assert.equal(qualifies({ ...base, start: 99 }), false, 'a Range bar spanning the profile start is excluded');
  assert.equal(qualifies({ ...base, start: 149, end: 151 }), false, 'a bar spanning the cutoff is excluded');
  assert.equal(qualifies({ ...base, confirmed: false }), false, 'an unconfirmed realtime bar is excluded');
  assert.equal(qualifies({ ...base, barHigh: 108, barLow: 92 }), false, 'price outside the touch tolerance does not qualify');

  const body = functionBody('profile_edge_observation_qualifies');
  assert.match(body, /observationStartTime >= profileStartTime/);
  assert.match(body, /observationEndTime <= profileEndTime/);
  assert.match(body, /observationEndTime <= qualificationDeadline/);
  assert.match(body, /profile_edge_touched\(observedHigh, observedLow, highAnchor, lowAnchor, touchTolerance\)/);
  assert.match(functionBody('profile_edge_touched'), /observedHigh >= highAnchor - touchTolerance or observedLow <= lowAnchor \+ touchTolerance/);
});

test('profile-edge snapshots are copied into the recent profile window without aliasing', () => {
  const recentWindow = [true, false, false, true, false].slice(-3);
  assert.deepEqual(recentWindow, [false, true, false]);
  assert.deepEqual(recentWindow.filter(Boolean), [true]);

  const currentSnapshot = { profileStartTime: 100, profileEndTime: 200, outerHigh: 110, outerLow: 90, qualified: true };
  const archivedSnapshot = { ...currentSnapshot };
  currentSnapshot.profileStartTime = 200;
  currentSnapshot.profileEndTime = 300;
  currentSnapshot.outerHigh = 120;
  currentSnapshot.qualified = false;
  assert.deepEqual(archivedSnapshot, { profileStartTime: 100, profileEndTime: 200, outerHigh: 110, outerLow: 90, qualified: true });

  const updateBody = functionBody('update_profile_edge_qualification_state');
  assert.match(updateBody, /if historyCap > 0 and profile_edge_snapshot_has_bounds\(currentSnapshot\)/);
  assert.match(updateBody, /array\.push\(qualificationState\.history, copy_profile_edge_snapshot\(currentSnapshot\)\)/);
  assert.match(updateBody, /while array\.size\(qualificationState\.history\) > historyCap/);
  assert.doesNotMatch(updateBody, /if currentSnapshot\.qualified and historyCap/);
  const copyBody = functionBody('copy_profile_edge_snapshot');
  assert.match(copyBody, /ProfileEdgeQualificationSnapshot\.new\(/);
  assert.match(copyBody, /qualified=sourceSnapshot\.qualified/);
  assert.doesNotMatch(updateBody, /array\.push\(qualificationState\.history, currentSnapshot\)/);
});

test('profile-edge rendering updates current geometry without rebuilding unchanged history', () => {
  const geometryChanged = (snapshot, next) => snapshot.qualified &&
    (snapshot.profileEndTime !== next.profileEndTime || snapshot.outerHigh !== next.outerHigh || snapshot.outerLow !== next.outerLow);
  const qualifiedSnapshot = { qualified: true, profileEndTime: 200, outerHigh: 110, outerLow: 90 };
  assert.equal(geometryChanged(qualifiedSnapshot, { profileEndTime: 200, outerHigh: 110, outerLow: 90 }), false);
  assert.equal(geometryChanged(qualifiedSnapshot, { profileEndTime: 200, outerHigh: 112, outerLow: 90 }), true);
  assert.equal(geometryChanged({ ...qualifiedSnapshot, qualified: false }, { profileEndTime: 200, outerHigh: 112, outerLow: 90 }), false);

  const renderCounts = { currentUpdates: 0, historyRebuilds: 0 };
  const render = ({ currentDirty, historyDirty }) => {
    if (historyDirty) renderCounts.historyRebuilds += 1;
    if (currentDirty) renderCounts.currentUpdates += 1;
  };
  render({ currentDirty: true, historyDirty: false });
  render({ currentDirty: true, historyDirty: false });
  assert.deepEqual(renderCounts, { currentUpdates: 2, historyRebuilds: 0 });

  const updateBody = functionBody('update_profile_edge_qualification_state');
  const drawBody = functionBody('draw_profile_edge_qualification_state');
  assert.doesNotMatch(source, /stateUpdated/);
  assert.match(updateBody, /currentBoundsChanged = currentSnapshot\.qualified/);
  assert.match(updateBody, /qualificationState\.currentDirty := qualificationState\.currentDirty or currentBoundsChanged/);
  assert.match(drawBody, /^if qualificationState\.historyDirty/);
  assert.match(drawBody, /if qualificationState\.currentDirty/);
  assert.match(drawBody, /if qualificationSnapshot\.qualified/);
  assert.match(drawBody, /make_profile_edge_qualification_outline\(qualificationSnapshot, false,/);
  assert.match(drawBody, /update_profile_edge_qualification_outline\(qualificationState\.currentOutline, currentSnapshot, true\)/);
  assert.match(functionBody('update_profile_edge_qualification_outline'), /box\.set_left[\s\S]*box\.set_right[\s\S]*box\.set_top[\s\S]*box\.set_bottom/);
  assert.match(drawBody, /qualificationState\.historyDirty := false/);
  assert.match(drawBody, /qualificationState\.currentDirty := false/);
  assert.match(drawBody, /qualificationState\.currentDirty or qualificationState\.historyDirty$/);
});

test('profile-edge cutoff follows the configured profile across midnight', () => {
  const cutoffDayOffset = (profileStartMinute, cutoffMinute) => cutoffMinute <= profileStartMinute ? 1 : 0;
  assert.equal(cutoffDayOffset(18 * 60, 8 * 60), 1, '08:00 belongs to the next NY date for the Globex Daily profile');
  assert.equal(cutoffDayOffset(18 * 60, 20 * 60), 0, '20:00 belongs to the opening NY date for the Globex Daily profile');
  assert.equal(cutoffDayOffset(0, 8 * 60), 0, '08:00 remains on the same NY date in Midnight mode');
  assert.equal(cutoffDayOffset(0, 0), 1, 'a cutoff equal to the profile start covers the complete Daily window');

  const body = functionBody('profile_edge_cutoff_time');
  assert.match(body, /cutoffMinute <= profileStartMinute \? 1 : 0/);
  assert.match(body, /scheduled_profile_timestamp\(profileStartTime, cutoffMinute, cutoffDayOffset\)/);
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

test('activation and mitigation are session-bound and open levels stop at the profile end', () => {
  const body = functionBody('finalize_liquidity_depth_side');
  assert.match(body, /int finalTime = sessionState\.sessionEndTime/);
  assert.match(body, /nz\(sessionState\.lastEligibleIndex, sideState\.activationIndex\)/);
  const updateBody = functionBody('update_liquidity_depth_profile');
  assert.match(updateBody, /bool trackingWindowOpen = profileStarted and time < currentSession\.sessionEndTime/);
  assert.match(updateBody, /update_liquidity_depth_side\(currentSession\.highSide, currentSession\.highAnchor, true, high, true,/);
  assert.match(updateBody, /update_liquidity_depth_side\(currentSession\.lowSide, currentSession\.lowAnchor, false, low, true,/);
  assert.match(updateBody, /if time >= currentSession\.sessionEndTime\n            finalize_liquidity_depth_session\(currentSession\)/);
  assert.doesNotMatch(source, /liquidity_depth_cutoff_time|cutoffTime|MARKET_CLOSE_HOUR|lastEligibleTime/);
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
  assert.match(functionBody('draw_liquidity_depth_side'), /make_horizontal_line\(endAtSession,/);
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
  assert.match(source, /request\.security\(\n         htfTickerId, SESSION_SOURCE_TIMEFRAME,\n         fetch_intraday_profiles_data\(/);
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

test('Fibonacci history uses one shared amount with independent profile selections', () => {
  assert.match(source, /GROUP_FIB_HISTORY\s+= "Fibonacci: History"/);
  assert.match(source, /GROUP_FIB_DEFAULT_LEVELS = "Fibonacci: Default Levels"/);
  assert.match(source, /GROUP_FIB_ALTERNATIVE_LEVELS = "Fibonacci: Alternative Levels"/);
  assert.match(source, /GROUP_FIB_PALETTE\s+= "Fibonacci: Colors & Key Labels"/);
  assert.match(source, /GROUP_FIB_LABELS\s+= "Fibonacci: Labels"/);

  assert.match(source, /^fibHistoryAmount = input\.int\(1, "History", inline="fib_history_options", group=GROUP_FIB_HISTORY, active=fibInputsActive, minval=1, maxval=FIB_HISTORY_MAX\)$/m);
  assert.match(source, /^fibTrailing = input\.bool\(false, "Trailing", inline="fib_history_options", group=GROUP_FIB_HISTORY/m);

  for (const [profileName, inlineGroup] of [
    ['slot1', 'fib_history_profiles'],
    ['slot2', 'fib_history_profiles'],
    ['weeklyProfile', 'fib_history_profiles'],
    ['monthlyProfile', 'fib_history_profiles'],
    ['dailyProfile', 'fib_history_profiles'],
    ['overnight', 'fib_history_intraday_profiles'],
    ['nyEarly', 'fib_history_intraday_profiles'],
    ['nyAm', 'fib_history_intraday_profiles'],
    ['nyPm', 'fib_history_intraday_profiles'],
    ['ivb', 'fib_history_intraday_profiles'],
    ['ivbPlus', 'fib_history_intraday_profiles'],
  ]) {
    assert.match(source, new RegExp(`^${profileName}FibHistory = input\\.bool\\(false,`, 'm'));
    assert.match(source, new RegExp(`^${profileName}FibHistory = [^\\n]+inline="${inlineGroup}"`, 'm'));
    assert.match(source, new RegExp(`^int ${profileName}FibHistoryLimit = ${profileName}FibHistory \\? fibHistoryAmount : 0$`, 'm'));
  }

  assert.doesNotMatch(source, /(?:slot1|slot2|weeklyProfile|monthlyProfile|dailyProfile|overnight|nyEarly|nyAm|nyPm|ivb|ivbPlus)FibHistoryAmount/);
  assert.match(functionBody('fib_history_zone_request'), /latestOnlyEnabled \? 0 : math\.min\(fibHistoryN, retainedProfileHistory\)/);
  assert.equal(source.match(/fibHistoryLimit=/g)?.length, 7);
  assert.doesNotMatch(source, /fibHistoryInput|FIB_HISTORY_OFF/);
});

test('saved Fib sets cannot outnumber displayed historical profiles', () => {
  assert.match(functionBody('history_zone_request'), /math\.max\(0, historyN - 1\)/);
  assert.match(functionBody('fib_history_zone_request'), /latestOnlyEnabled \? 0 : math\.min\(fibHistoryN, retainedProfileHistory\)/);
  assert.match(source, /fib_history_zone_request\(latestOnly, slot1FibHistoryLimit, s1BoxHistZoneCap\)/);
  assert.match(source, /fib_history_zone_request\(latestOnly, profileConfig\.fibHistoryLimit, array\.get\(boxHistZoneCaps, HTF_PROFILE_COUNT \+ profileIndex\)\)/);
  assert.match(functionBody('update_slot'), /while array\.size\(s\.histFibLines\) > fibHistCap/);
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

test('color reference table lists only active color inputs', () => {
  const tableBlock = source.slice(source.indexOf('if showTable and barstate.islast'));
  assert.match(tableBlock, /int activeColorInputCount = \(slot1Show \? 1 : 0\) \+ \(slot2Show \? 1 : 0\) \+ \(weeklyProfileShow \? 1 : 0\) \+ \(monthlyProfileShow \? 1 : 0\)/);
  assert.match(tableBlock, /activeColorInputCount \+= profile\.config\.enabled \? 1 : 0/);
  assert.match(tableBlock, /activeColorInputCount \+= fibInputsActive \? 9 : 0/);
  assert.match(tableBlock, /activeColorInputCount \+= showOnlyEnabled \? 1 : 0/);
  assert.match(tableBlock, /if slot1Show\n        addRow\(colorTable, row, "Slot 1", slot1Color\)/);
  assert.match(tableBlock, /if slot2Show\n        addRow\(colorTable, row, "Slot 2", slot2Color\)/);
  assert.match(tableBlock, /if weeklyProfileShow\n        addRow\(colorTable, row, WEEKLY_PROFILE_NAME, weeklyProfileColor\)/);
  assert.match(tableBlock, /if monthlyProfileShow\n        addRow\(colorTable, row, MONTHLY_PROFILE_NAME, monthlyProfileColor\)/);
  assert.match(tableBlock, /if profileConfig\.enabled\n            addRow\(colorTable, row, profileConfig\.sourceLabel, profileConfig\.slotColor\)/);
  assert.match(tableBlock, /if fibInputsActive\n        addRow\(colorTable, row, "Fib 1\.0", fibColor100\)/);
  assert.match(tableBlock, /if showOnlyEnabled\n        addRow\(colorTable, row, "Hidden Candles", hiddenCandleColor\)/);
  assert.doesNotMatch(tableBlock, /if showOnlyEnabled and showOnlyTimeframeAllowed/);
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
