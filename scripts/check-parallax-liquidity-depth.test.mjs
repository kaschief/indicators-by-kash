import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../indicators/18-parallax/code/parallax.pine', import.meta.url), 'utf8');
const functionBody = name => {
  const body = source.match(new RegExp(`^${name}\\([^\\n]+\\) =>\\n([\\s\\S]*?)(?=^\\S)`, 'm'))?.[1];
  assert.ok(body, `${name} must exist`);
  return body.trim();
};

// These checks validate source contracts. They do not compile Pine or prove chart behavior.
test('LD controls are centralized and retain independent profile selections', () => {
  assert.match(source, /^const string GROUP_LIQUIDITY_DEPTH = "Liquidity Depth"/m);
  assert.match(source, /^forecastLiquidityDepth = input\.bool\(false, "Forecast LD", inline="liquidity_depth_options", group=GROUP_LIQUIDITY_DEPTH\)/m);
  assert.match(source, /^showLiquidityDepthProfileNames = input\.bool\(true, "Profile Names on LD", inline="liquidity_depth_options", group=GROUP_LIQUIDITY_DEPTH\)/m);
  assert.match(source, /^dailyLiquidityDepth = input\.bool\(false, DAILY_PROFILE_NAME, group=GROUP_LIQUIDITY_DEPTH, active=dailyProfileShow\)/m);
  for (const [name, label, active] of [
    ['overnightLiquidityDepth', 'OVERNIGHT_SLOT_NAME', 'overnightShow'],
    ['nyEarlyLiquidityDepth', 'NY_EARLY_SLOT_NAME', 'nyEarlyShow'],
    ['nyAmLiquidityDepth', 'NY_AM_SLOT_NAME', 'nyAmShow'],
    ['ivbLiquidityDepth', 'IVB_SLOT_NAME', 'ivbShow'],
    ['ivbPlusLiquidityDepth', 'IVB_PLUS_SLOT_NAME', 'ivbPlusShow'],
  ]) {
    assert.match(source, new RegExp(`^${name} = input\\.bool\\(false, ${label}, inline="liquidity_depth_profiles", group=GROUP_LIQUIDITY_DEPTH, active=${active}`, 'm'));
  }
  assert.doesNotMatch(source, /UI_LD/);
  assert.doesNotMatch(source, /inline="(?:overnight|ny_early|ny_am|ivb|ivb_plus)"[^\n]+liquidityDepth/);
});

test('LD is wired to Daily and the five intraday scheduled profiles only', () => {
  assert.match(source, /dailyProfileShow[^\n]+liquidityDepthEnabled=dailyLiquidityDepth/);
  for (const [profile, control] of [
    ['overnightShow', 'overnightLiquidityDepth'],
    ['nyEarlyShow', 'nyEarlyLiquidityDepth'],
    ['nyAmShow', 'nyAmLiquidityDepth'],
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
  assert.match(functionBody('update_liquidity_depth_profile'), /new_liquidity_depth_session\(profileRuntime\.startTime, profileRuntime\.startIndex, highAnchor, lowAnchor\)/);

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
  assert.match(functionBody('draw_liquidity_depth_side'), /make_horizontal_line\(false,/);
  assert.match(functionBody('make_liquidity_depth_label'), /drawing_x\(labelTime, labelIndex, false\)/);
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
  assert.match(body, /DISABLED_SCHEDULED_PROFILE_REQUEST_BARS/);
  assert.equal(source.match(/calc_bars_count=scheduled_profile_request_bars\([^\n]+\)/g)?.length, 6);
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
