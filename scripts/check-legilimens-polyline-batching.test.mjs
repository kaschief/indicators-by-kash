import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../indicators/21-legilimens/code/libraries/legilimens-presentation-library.pine', import.meta.url), 'utf8');
const host = readFileSync(new URL('../indicators/21-legilimens/code/legilimens.pine', import.meta.url), 'utf8');

// Execute the Pine batching functions with drawing/coordinate adapters; this is not Pine compilation.
const context = vm.createContext({
  map: { new: () => new Map(), put: (values, key, value) => values.set(key, value), get: (values, key) => values.get(key) ?? null },
  str: { tostring: String },
  math: Math, int: Math.trunc, float: Number, na: value => value == null,
  array: {
    size: values => values.length, get: (values, index) => values[index],
    set: (values, index, value) => { values[index] = value; },
    push: (values, value) => values.push(value), first: values => values[0],
    clear: values => { values.length = 0; }, concat: (target, values) => target.push(...values),
    from: (...values) => values, new: (count = 0, value = null) => Array(count).fill(value),
    last: values => values.at(-1), pop: values => values.pop(),
    insert: (values, index, value) => values.splice(index, 0, value),
    remove: (values, index) => values.splice(index, 1)[0],
  },
  chart: { point: { from_time: (time, price) => ({ time, price }) } },
  color: { new: (value, fade) => `${value}:${fade}`, rgb: (...channels) => channels.join(',') },
  polyline: { new: (points, fillColor) => ({ points: structuredClone(points), fillColor }) },
  nearestChartTimeIndex: (times, instant) => times.indexOf(instant),
  barSpanMs: () => 1,
  legilimensProfile: {
    isOutlierStrength: strength => strength >= 1.5,
    computeRowStrengths: data => data.strengths,
    profileValueLevels: (volumes, count, low, high) => [0, Math.floor(count / 3), Math.floor(count * 2 / 3), (low + high) / 2, low, high],
  },
});
for (const name of ['FIB_LOCATION_UNKNOWN', 'STYLE_DOTTED', 'STYLE_DASHED', 'SOURCE_FIXED', 'SOURCE_ROLLING', 'SOURCE_NY_EARLY', 'SOURCE_EXTENDED_NY_EARLY', 'SOURCE_IVB', 'SOURCE_ASIA_PREMARKET', 'SOURCE_FOMC', 'SOURCE_OVERNIGHT_NINE', 'SOURCE_RTH', 'SOURCE_NY_AFTERNOON', 'SOURCE_ALL_DAY_TO_AFTERNOON', 'AFTERNOON_END_MINUTE', 'SOURCE_GLOBEX', 'SOURCE_MIDNIGHT', 'NY_EARLY_END_MINUTE', 'DISPLAY_NY_EARLY_PLUS', 'PROFILE_FRAME_BOX_COUNT', 'PROFILE_HEADING_LABEL_COUNT', 'PROFILE_POLYLINE_LAYER_COUNT', 'PROFILE_POLYLINE_POINT_LIMIT', 'OPTION_OFF', 'OPTION_ALL', 'DELTA_ROWS_BUY', 'DELTA_ROWS_SELL', 'DELTA_ROW_FILTER_OUTLIERS', 'DELTA_ROW_FILTER_SELECTED_TIER_OUTLIERS', 'PROFILE_POSITION_LEFT_LEFT', 'PROFILE_POSITION_LEFT_RIGHT', 'PROFILE_POSITION_RIGHT_LEFT', 'PROFILE_POSITION_RIGHT_RIGHT']) {
  const expression = source.match(new RegExp(`^const (?:int|string) ${name} = (.+)$`, 'm'))?.[1] ?? host.match(new RegExp(`^(?:const (?:int|string) )?${name} = (.+)$`, 'm'))?.[1];
  assert.ok(expression, name);
  context[name] = vm.runInContext(expression, context);
}
for (const name of ['profileDeltaPlusColor', 'profileDeltaMinusColor', 'profileDeltaPlusPlusColor', 'profileDeltaMinusMinusColor']) {
  context[name] = spec => `${name}:${spec.alternateStyles}`;
}
const expression = value => value.replace(/(array|map)\.new<[^>]+>/g, '$1.new')
  .replace(/\bna\b(?!\s*\()/g, 'null').replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!').replace(/:=/g, '=');
for (const typeName of ['PendingOutlierLevel', 'RankedOutlierLevel', 'ProfilePolylineLayer', 'ProfilePolylineBatch', 'ProfileAnalysis', 'ProfilePolylineLayout', 'ProfilePolylineRegion', 'ProfileRenderItem', 'FocusProfile', 'FocusCandidate']) {
  const body = source.match(new RegExp(`^(?:export )?type ${typeName}\\n((?:    [^\\n]+\\n)+)`, 'm'))[1];
  const fields = body.trim().split('\n').map(line => line.trim().match(/^\S+ (\w+)(?: = (.+))?$/).slice(1));
  context[typeName] = { new: (...values) => Object.fromEntries(fields.map(([key, fallback], index) => [key, index < values.length ? values[index] : fallback ? vm.runInContext(expression(fallback), context) : null])) };
}
function compile(name, returnsValue = true, inputSource = source) {
  const match = inputSource.match(new RegExp(`^(?:export )?${name}\\(([^\\n]*)\\) =>\\n((?:[ \\t]+[^\\n]*\\n|\\n)+)`, 'm'));
  assert.ok(match, name);
  const parameters = match[1].split(/,(?![^<]*>)/).map(value => value.trim().split(' ').at(-1)).join(',');
  const lines = match[2].trimEnd().split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
  const output = [], blocks = [];
  for (let index = 0; index < lines.length; index++) {
    const indent = lines[index].search(/\S/);
    let line = expression(lines[index].trim());
    while (blocks.length && blocks.at(-1) >= indent) { output.push('}'); blocks.pop(); }
    let block = true;
    if (line.startsWith('if ')) line = `if (${line.slice(3)}) {`;
    else if (line.startsWith('else if ')) line = `else if (${line.slice(8)}) {`;
    else if (line === 'else') line = 'else {';
    else if (line.startsWith('while ')) line = `while (${line.slice(6)}) {`;
    else if (line.startsWith('for ')) {
      const range = line.match(/^for (\w+) = (.+) to (.+)$/);
      const each = line.match(/^for (\w+) in (.+)$/);
      line = range ? `for (let ${range[1]} = ${range[2]}; ${range[1]} <= ${range[3]}; ${range[1]}++) {` : `for (const ${each[1]} of ${each[2]}) {`;
    } else {
      block = false;
      line = line.replace(/^(?:(?:array|map)<[^>]+>|[\w.]+) (\w+) = /, 'let $1 = ').replace(/^\[([^\]]+)\] = /, 'let [$1] = ');
      line = line.replace(/polyline\.new\(layer.points, curved=false, closed=true, xloc=xloc.bar_time, line_color=color.new\(layer.fillColor, 100\), fill_color=layer.fillColor\)/, 'polyline.new(layer.points, layer.fillColor)');
      if (returnsValue && (index === lines.length - 1 || (name === 'deltaOuterTime' && line.startsWith('chartTimeAtOffset(')))) line = `return ${line}`;
      line += ';';
    }
    output.push(line);
    if (block) blocks.push(indent);
  }
  while (blocks.length) { output.push('}'); blocks.pop(); }
  vm.runInContext(`function ${name}(${parameters}) {\n${output.join('\n')}\n}`, context, { filename: `${name}.pine-adapter.js` });
}
for (const name of ['prepareProfileAnalysisCache', 'profileAnalysis', 'profileOutlierPeaks', 'profileLowVolumeCandidates', 'retainCompletedAnalyses', 'highestDeltaRow', 'highestDeltaMarkerGlyph', 'rankPendingOutlierLevels', 'deltaTierLineStyle', 'developingControlled', 'developingProfileVisible', 'visibleDeltaTierSideCount', 'maximumCoreObjectCostsPerProfile', 'profileCapacityForObjectLimit', 'maximumProfileCapacity', 'chartTimeAtOffset', 'profileBaselineTime', 'profileOuterTime', 'deltaOuterTime', 'rowPassesDeltaFilter', 'appendDeltaRowPoints', 'deltaLayerIndex', 'histogramRegionRows', 'profilePolylineLayout', 'profilePolylineRegions', 'newProfilePolylineBatch', 'profilePolylineColor', 'canDrawPolyline', 'flushProfilePolylineLayer', 'flushProfilePolylineBatch', 'profilePolylineBounds', 'profilePolylineBatchCompatible', 'appendProfilePolylineRegion', 'processProfilePolylineBatch', 'profilePolylineCost']) compile(name);

for (const [, name, value] of source.matchAll(/^const (?:int|float|string) (FIB_LOCATION_\w+|LEVEL_MARKER_GLYPH|LOW_VOLUME_LEVEL_RANK|LOW_VOLUME_LINE_WIDTH) = (.+)$/gm)) {
  context[name] = vm.runInContext(value, context);
}
for (const name of ['deltaTierFibLocationGrade', 'fibLocationMarkerGlyph', 'fibLocationBorderWidth']) compile(name);
compile('queueOutlierPeaks', false);
compile('renderLowVolumeStructures', false);
context.levelMarkerTime = value => value;
context.legilimensProfile.OutlierCandidate = { new: (...values) => values };

test('midpoint labels preserve bar-centered placement or align to the tier right edge', () => {
  const originalMarkerTime = context.levelMarkerTime;
  const originalBarSpan = context.barSpanMs;
  context.DOT_MARKER_OFFSET_BARS = Number(source.match(/^const float DOT_MARKER_OFFSET_BARS = (.+)$/m)[1]);
  context.barSpanMs = () => 100;
  compile('levelMarkerTime');
  compile('profileMidpointLabelTime');
  try {
    for (const [times, endTime, expectedCenter] of [
      [[100, 125, 150, 175, 200], 200, 150],
      [[100, 110, 130, 190, 200], 200, 130],
      [[100, 110, 130, 190, 200], 300, 200],
      [[], 200, 150],
      [[100], 100, 100],
    ]) {
      assert.equal(context.profileMidpointLabelTime(100, endTime, times, false), expectedCenter);
      assert.equal(context.profileMidpointLabelTime(100, endTime, times, true), endTime + 10);
    }
    assert.match(host, /midpointLabelPosition = input\.string\("Middle", "Midpoint Label Position", options=\["Middle", "Right edge"\].*active=showProfileMidpointLine/);
    assert.match(host, /LevelSettings\.new\(showValueAreaLevels, showPocLevel, showProfileMidpointLine, midpointLabelPosition == "Right edge", mergeOverlaps, mergeDistancePercent\)/);
    assert.match(source, /style=labelAtRight \? label\.style_label_left : label\.style_label_center/);
    assert.match(source, /textalign=labelAtRight \? text\.align_left : text\.align_center/);
  } finally {
    context.levelMarkerTime = originalMarkerTime;
    context.barSpanMs = originalBarSpan;
  }
});

const config = (overrides = {}) => ({ limits: { polylines: 100 }, delta: { visibleRows: context.OPTION_ALL, rowFilter: context.OPTION_ALL, showHistogram: true, histogramWidthPercent: 20, ...overrides } });
function profile(index, count = 12, low = 100) {
  const deltas = Array.from({ length: count }, (_, row) => (row % 2 ? -1 : 1) * (row % 4 < 2 ? 2 : 10));
  return { startTime: index * 100, endTime: index * 100 + 20, data: { rowCount: count, rowVolumes: Array(count).fill(100), rowDeltas: deltas, strengths: deltas.map(value => Math.abs(value) >= 10 ? 2 : 1), priceLow: low, priceHigh: low + count, maxAbsRowDelta: 10, maxRowVolume: 100 } };
}
const spec = (placement = 'PROFILE_POSITION_RIGHT_LEFT', key = 'Overnight', alternateStyles = false) => ({ key, alternateStyles, deltaWidthBars: 12, profilePosition: context[placement] });
function prepare(profiles, settings = config(), style = spec(), selected = null) {
  return profiles.map(value => {
    const geometry = context.profilePolylineLayout(value, style, context.profileAnalysis({ completedAnalyses: [] }, value, style, false), [], settings);
    const rows = selected ?? Array(value.data.rowCount).fill(true);
    const regions = context.profilePolylineRegions(geometry, rows, settings.delta.showHistogram, [], settings);
    return { geometry, regions, historical: true, developing: false, contentVisible: true };
  });
}
function execute(items, settings = config(), histogram = true, draw = true) {
  const state = { drawnPolylines: [], completedAnalyses: [] };
  const batch = context.newProfilePolylineBatch();
  for (const item of items) if (item.contentVisible) context.processProfilePolylineBatch(state, batch, item.geometry, item.historical && !item.developing, histogram, item.regions.filter(region => histogram || region.layerIndex >= 2), draw, settings);
  context.flushProfilePolylineBatch(state, batch, draw, settings);
  return { state, count: batch.completedCount };
}
const signedArea = points => points.reduce((sum, p, index) => {
  const next = points[(index + 1) % points.length];
  return sum + p.time * next.price - next.time * p.price;
}, 0) / 2;
function winding(points, x, y) {
  let turns = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const cross = (b.time - a.time) * (y - a.price) - (x - a.time) * (b.price - a.price);
    if (a.price <= y && b.price > y && cross > 0) turns++;
    if (a.price > y && b.price <= y && cross < 0) turns--;
  }
  return turns;
}

test('batching preserves polygon area and filled coverage in all four placements and palettes', () => {
  for (const placement of ['PROFILE_POSITION_LEFT_LEFT', 'PROFILE_POSITION_LEFT_RIGHT', 'PROFILE_POSITION_RIGHT_LEFT', 'PROFILE_POSITION_RIGHT_RIGHT']) for (const alternate of [false, true]) {
    const items = prepare([profile(0), profile(1), profile(2)], config(), spec(placement, 'Overnight', alternate));
    const { state, count } = execute(items);
    assert.equal(count, 6);
    assert.equal(state.drawnPolylines.length, 6);
    for (let layer = 0; layer < 6; layer++) {
      const original = items.flatMap(item => item.regions.filter(region => region.layerIndex === layer).map(region => region.points));
      const drawing = state.drawnPolylines[layer];
      assert.equal(signedArea(drawing.points), original.reduce((sum, points) => sum + signedArea(points), 0));
      for (let x = -15.37; x < 235; x += 3.1) for (let y = 99.13; y < 114; y += 0.71) {
        assert.equal(winding(drawing.points, x, y), original.reduce((sum, points) => sum + winding(points, x, y), 0), `${placement}, layer ${layer}, ${x}, ${y}`);
      }
    }
  }
});

test('48 prior profiles plus current use shared objects within the point and object budgets', () => {
  const settings = config();
  const items = prepare(Array.from({ length: 49 }, (_, i) => profile(i, 400)), settings);
  items.at(-1).historical = false;
  const rendered = execute(items, settings);
  const planned = context.profilePolylineCost({ drawnPolylines: [] }, items, true, settings);
  assert.equal(planned, rendered.count);
  assert.equal(rendered.state.drawnPolylines.length, planned);
  assert.ok(planned < 100, `${planned} polylines`);
  assert.ok(planned < 49 * 4);
  for (const drawing of rendered.state.drawnPolylines) assert.ok(drawing.points.length <= 9900);
});

test('overlapping envelopes, different sources, disjoint prices, and current profiles split batches', () => {
  for (const change of ['overlap', 'source', 'price', 'current']) {
    const items = prepare([profile(0), profile(1)]);
    if (change === 'overlap') { items[1].geometry.deltaLeftTime = 0; items[1].geometry.deltaRightTime = 105; }
    if (change === 'source') items[1].geometry.source = spec('PROFILE_POSITION_RIGHT_LEFT', 'NY Early');
    if (change === 'price') items[1].geometry.profile.data.priceLow = 200;
    if (change === 'current') items[1].historical = false;
    const { count } = execute(items);
    assert.equal(count, 12, change);
  }
});

test('selected-tier subsets never exceed the outlier reservation and preserve absent sides', () => {
  const settings = config({ rowFilter: context.DELTA_ROW_FILTER_SELECTED_TIER_OUTLIERS, visibleRows: context.DELTA_ROWS_BUY });
  const rows = Array.from({ length: 12 }, (_, row) => row === 2);
  const items = prepare([profile(0), profile(1)], settings, spec(), rows);
  for (const item of items) for (let layer = 0; layer < 6; layer++) {
    const actual = item.regions.filter(region => region.layerIndex === layer).reduce((sum, region) => sum + region.points.length + 3, 0);
    assert.ok(actual <= item.geometry.pointCounts[layer]);
  }
  const rendered = execute(items, settings);
  assert.ok(rendered.state.drawnPolylines.length <= context.profilePolylineCost({ drawnPolylines: [] }, items, true, settings));
  assert.equal(items[0].geometry.pointCounts[3], 0);
  assert.equal(items[0].geometry.pointCounts[5], 0);
});

test('empty delta and hidden content consume no objects; histogram remains optional', () => {
  const settings = config({ visibleRows: context.OPTION_OFF, showHistogram: false });
  const items = prepare([profile(0)], settings);
  assert.equal(execute(items, settings, false).count, 0);
  const hidden = prepare([profile(1)]);
  hidden[0].contentVisible = false;
  assert.equal(context.profilePolylineCost({ drawnPolylines: [] }, hidden, true, config()), 0);
  const visible = prepare([profile(2)]);
  assert.equal(execute(visible, config(), false).count, 4);
  assert.equal(execute(visible).count, 6);
});

test('layout envelopes cover every generated point across filters and placements', () => {
  for (const placement of ['PROFILE_POSITION_LEFT_LEFT', 'PROFILE_POSITION_LEFT_RIGHT', 'PROFILE_POSITION_RIGHT_LEFT', 'PROFILE_POSITION_RIGHT_RIGHT']) for (const filter of [context.OPTION_ALL, context.DELTA_ROW_FILTER_OUTLIERS]) {
    const settings = config({ rowFilter: filter });
    for (const item of prepare([profile(0, 400)], settings, spec(placement))) {
      const [left, right] = context.profilePolylineBounds(item.geometry, true);
      for (const region of item.regions) for (const point of region.points) assert.ok(point.time >= left && point.time <= right);
      for (let layer = 0; layer < 6; layer++) {
        const actual = item.regions.filter(region => region.layerIndex === layer).reduce((sum, region) => sum + region.points.length + 3, 0);
        assert.equal(actual, item.geometry.pointCounts[layer]);
      }
    }
  }
});

test('history and render admission retain non-polyline budgets and shared planning', () => {
  assert.match(host, /priorProfiles = input.int\(10, "", options=\[1, 2, 3,.*50\], inline="profile_history"/);
  assert.doesNotMatch(host, /ADDITIONAL_SESSION_MAX_COUNT|SESSION_PROFILE_RETENTION/);
  assert.match(host, /sessionProfileRetention = legilimensPresentation.maximumProfileCapacity/);
  assert.match(host, /math.min\(priorProfiles, math.max\(0, sessionProfileRetention - 1\)\)/);
  assert.match(source, /trimBindings\(bindings, previousCount - 1, config, context\)/);
  assert.match(source, /profilePolylineCost\(state, items, false, config\) > availablePolylines/);
  assert.match(source, /config.delta.showHistogram and profilePolylineCost\(state, items, true, config\) <= availablePolylines/);
  for (const category of ['lines', 'labels', 'boxes']) assert.match(source, new RegExp(`profileCapacityForObjectLimit\\(limits.${category}`));
  assert.doesNotMatch(source, /deltaPolylineLayersPerProfile|renderDeltaPolylines|histogramLayersPerProfile/);
});


test('history capacity follows heavy and light configurations rather than a universal profile count', () => {
  const limits = { lines: 500, labels: 500, boxes: 500, polylines: 100 };
  const levels = { showValueArea: false, showPoc: false, showMidpoint: true };
  const delta = { showTiers: true, visibleTierSides: context.OPTION_ALL, visibleTierCount: 2, showHighestDeltaLevels: true, showLvnTiers: true, visibleLvnTierCount: 2, showDots: true, showDotLabels: false };
  assert.equal(context.maximumProfileCapacity(limits, delta, levels), 50);
  assert.equal(context.maximumProfileCapacity(limits, { ...delta, visibleTierCount: 5, visibleLvnTierCount: 5 }, levels), 26);
  assert.equal(context.maximumProfileCapacity(limits, { ...delta, showTiers: false, showLvnTiers: false, showHighestDeltaLevels: false }, { ...levels, showMidpoint: false }), 250);
  assert.equal(context.maximumProfileCapacity({ ...limits, polylines: 20 }, delta, levels), 50);
  assert.ok(context.maximumProfileCapacity({ ...limits, boxes: 200 }, delta, levels) < 50);
});

test('all-tier labels reserve one text label per marker across sides and LVNs', () => {
  const limits = { lines: 500, labels: 500, boxes: 500, polylines: 100 };
  const levels = { showValueArea: false, showPoc: false, showMidpoint: true };
  const delta = { showTiers: true, visibleTierSides: context.OPTION_ALL, visibleTierCount: 5, showHighestDeltaLevels: true, showLvnTiers: true, visibleLvnTierCount: 5, showDots: true, showDotLabels: true };
  assert.equal(context.maximumCoreObjectCostsPerProfile(delta, levels)[1], 33);
  assert.equal(context.maximumProfileCapacity(limits, delta, levels), 15);
  assert.equal(context.maximumCoreObjectCostsPerProfile({ ...delta, showDots: false }, levels)[1], 3);
  assert.equal(context.maximumCoreObjectCostsPerProfile({ ...delta, visibleTierSides: context.DELTA_ROWS_BUY }, levels)[1], 23);
  assert.match(host, /dotDisplay = input.string\(DOT_DISPLAY_DOTS_LABELS,/);
});

test('irregular chart times and projected edges stay inside the reserved envelope', () => {
  const times = [0, 1, 4, 5, 20, 21, 35, 50, 100, 101, 109, 120];
  for (const placement of ['PROFILE_POSITION_LEFT_LEFT', 'PROFILE_POSITION_LEFT_RIGHT', 'PROFILE_POSITION_RIGHT_LEFT', 'PROFILE_POSITION_RIGHT_RIGHT']) {
    const settings = config();
    const value = profile(0, 400);
    const geometry = context.profilePolylineLayout(value, spec(placement), context.profileAnalysis({ completedAnalyses: [] }, value, spec(placement), false), times, settings);
    const regions = context.profilePolylineRegions(geometry, Array(400).fill(true), true, times, settings);
    const [left, right] = context.profilePolylineBounds(geometry, true);
    for (const region of regions) for (const point of region.points) assert.ok(point.time >= left && point.time <= right);
    const batch = context.newProfilePolylineBatch(), state = { drawnPolylines: [] };
    context.processProfilePolylineBatch(state, batch, geometry, true, true, regions, true, settings);
    context.flushProfilePolylineBatch(state, batch, true, settings);
    assert.equal(state.drawnPolylines.length, batch.completedCount);
  }
});

test('rebuilding live or Replay geometry does not reuse stale data for unchanged timestamps', () => {
  const value = profile(0);
  const first = prepare([value])[0];
  value.data = { ...value.data, rowDeltas: value.data.rowDeltas.map(delta => -delta), priceLow: 200, priceHigh: 212 };
  const next = prepare([value])[0];
  assert.notDeepEqual(first.regions, next.regions);
  assert.ok(next.regions.every(region => region.points.every(point => point.price >= 200)));
});


test('new session profiles follow the existing content, shell-only, and hidden visibility states', () => {
  for (const key of [context.SOURCE_FOMC, context.SOURCE_OVERNIGHT_NINE, context.SOURCE_NY_EARLY, context.SOURCE_NY_AFTERNOON, context.SOURCE_ALL_DAY_TO_AFTERNOON]) {
    for (const developingContentVisible of [false, true]) for (const showDevelopingShell of [false, true]) {
      const style = { key, developingContentVisible };
      assert.equal(context.developingControlled(style), true);
      assert.equal(context.developingProfileVisible(style, { showDevelopingShell }), developingContentVisible || showDevelopingShell);
    }
  }
  for (const key of ['Fixed', 'Rolling', 'Weekly', 'Monthly']) {
    assert.equal(context.developingControlled({ key }), false);
    assert.equal(context.developingProfileVisible({ key, developingContentVisible: false }, { showDevelopingShell: false }), true);
  }
});

test('bounded-session visibility inputs reach both profile selection and rendering', () => {
  assert.match(host, /showDevelopingShell = input.bool\(true, "Show Inner Frames \+ Titles", group=GROUP_DEVELOPING/);
  assert.match(host, /presentationInteractionSettings, showDevelopingShell, extendedNyEarlyModeActive/);
  for (const inputRow of host.split('\n').filter(row => /^show\w+DevelopingContent =/.test(row))) assert.ok(inputRow.includes('input.bool(false,'));
  for (const [prefix, toggle, defaultVisible] of [['fomc', 'showFomcDevelopingContent', false], ['overnightNine', 'showOvernightNineDevelopingContent', false], ['nyAfternoon', 'showNyAfternoonDevelopingContent', false], ['allDayToAfternoon', 'showAllDayToAfternoonDevelopingContent', false]]) {
    const inputRow = host.split('\n').find(row => row.startsWith(`${toggle} =`));
    assert.ok(inputRow.includes(`input.bool(${defaultVisible},`));
    assert.ok(inputRow.includes(`active=${prefix}Selected`));
    const sourceRow = host.split('\n').find(row => row.includes(`SourceSpec ${prefix}PresentationSource =`));
    assert.ok(sourceRow.includes(`${prefix}Selected, ${toggle},`));
    assert.ok(host.includes(`selectSessionProfiles(priorProfilesToShow, ${prefix}InSession, legilimensPresentation.developingProfileVisible(${prefix}PresentationSource, presentationConfig), ${prefix}Anchor`));
  }
});


test('Extend Unmitigated forces dotted tier lines regardless of the selected style', () => {
  for (const chosen of [context.STYLE_DASHED, context.STYLE_DOTTED]) {
    for (const extendUnmitigated of [false, true]) {
      const settings = { delta: { tierLineStyle: chosen }, interactions: { extendUnmitigated } };
      assert.equal(context.deltaTierLineStyle(settings, context.STYLE_DASHED), extendUnmitigated ? context.STYLE_DOTTED : chosen);
    }
  }
  assert.doesNotMatch(host + source, /tierLineStyleOverride/);
  assert.match(source, /string lineStyle = deltaTierLineStyle\(config, appearanceLineStyle\(appearance\)\)/);
  assert.match(source, /PendingMitigatedZone.new\([^\n]+lineStyle, levelRank/);
  assert.match(source, /queueRightLine\([^\n]+lineStyle, levelRank/);
});


function queuedPeaks(rowDeltas, peaks, showHighestDeltaLevels = true) {
  const value = profile(0, rowDeltas.length);
  value.data.rowDeltas = rowDeltas;
  value.data.rangeLow = value.data.priceLow;
  value.data.rangeHigh = value.data.priceHigh;
  const state = { pendingOutlierLevels: [] };
  context.queueOutlierPeaks(state, value, { key: 'FOMC' }, peaks, '', 100, 1, false, {
    delta: { showTiers: true, showHighestDeltaLevels },
  });
  return { value, state };
}
const peak = (buySide, firstRow, lastRow = firstRow) => ({ buySide, firstRow, lastRow, price: 100 + firstRow, zoneLow: 100 + firstRow, zoneHigh: 101 + lastRow, delta: buySide ? 10 : -10, strength: 2 });

test('Delta peaks always retain Fib grades and midpoint without qualification switches', () => {
  const { state } = queuedPeaks(Array(100).fill(1), [
    peak(true, 10), peak(true, 30), peak(true, 45), peak(true, 80),
    peak(false, 90), peak(false, 70), peak(false, 55), peak(false, 20),
  ]);
  assert.deepEqual(Array.from(state.pendingOutlierLevels, item => item.fibLocationGrade), [3, 2, 1, 0, 3, 2, 1, 0]);
  assert.ok(state.pendingOutlierLevels.every(item => item.fibMidpointPrice === 150));
  assert.deepEqual(Array.from(state.pendingOutlierLevels, item => context.fibLocationMarkerGlyph(item.fibLocationGrade)), ['✦', '◆', '●', '●', '✦', '◆', '●', '●']);
});

test('optional LVN/cliff Fib styling restores previous visuals when disabled', () => {
  const cases = [
    [100, 2, '✦'], [214, 1, '◆'], [382, 1, '◆'], [450, 1, '●'],
    [500, 0, '●'], [550, 1, '●'], [618, 1, '◆'], [786, 1, '◆'], [900, 2, '✦'],
  ];
  context.fibQualificationColor = value => value;
  context.tierMarkerSize = value => value;
  for (const matchLowVolumeFibStyling of [false, true]) {
    for (const alternateStyles of [false, true]) {
      for (const [price, width, glyph] of cases) {
        const zones = [], markers = [], cliffs = [];
        context.renderLowVolumeZone = (...args) => { zones.push(args); return false; };
        context.queueLevelMarker = (...args) => markers.push(args);
        context.queueRightLine = (...args) => cliffs.push(args);
        context.renderLowVolumeStructures({}, { startTime: 0, endTime: 20, data: { rangeLow: 0, rangeHigh: 1000 } },
          { key: 'Globex', alternateStyles }, [
            { isLvn: true, zoneLow: price - 2, zoneHigh: price + 2 },
            { isLvn: false, price },
          ], '', 100, 1, false, false, [], {}, {
            delta: { showLvnTiers: true, visibleLvnTierCount: 5, matchLowVolumeFibStyling, showDotLabels: false, lvnFibBorderTransparency: 90, lvnFibMarkerTransparency: 50 },
          });
        assert.equal(zones.length, 1, 'cliffs must not create zones');
        assert.equal(zones[0][10], matchLowVolumeFibStyling ? width : price === 500 ? 0 : 1, `border at ${price}`);
        assert.deepEqual(markers.map(args => args[3]), [glyph, matchLowVolumeFibStyling ? glyph : '●']);
        const directionalColor = `${price < 500 ? 'profileDeltaPlusPlusColor' : 'profileDeltaMinusMinusColor'}:${alternateStyles}`;
        const markerColor = price === 500 ? '15,15,15:75' : `${directionalColor}:50`;
        const cliffColor = matchLowVolumeFibStyling ? markerColor : '15,15,15:75';
        assert.deepEqual(markers.map(args => args[5]), [markerColor, cliffColor]);
        if (price !== 500) assert.equal(zones[0][11], `${directionalColor}:90`);
        assert.equal(cliffs.length, 1);
        assert.equal(cliffs[0][1], price);
        assert.equal(cliffs[0][4], cliffColor);
        assert.equal(cliffs[0][5], context.LOW_VOLUME_LINE_WIDTH);
        assert.equal(cliffs[0][6], context.STYLE_DOTTED);
      }
    }
  }
  assert.match(host, /matchLowVolumeFibStyling = input\.bool\(false, "Match LVN\/Cliff Fib Styling to Delta"/);
  assert.match(host, /visibleLvnTierCount, matchLowVolumeFibStyling, showDots, showDotLabels/);
});

test('highest-row flags use raw delta magnitude, preserve tie handling, and respect Highest Delta Levels', () => {
  const peaks = [peak(true, 0), peak(true, 2), peak(false, 3, 4), peak(true, 5)];
  const { value, state } = queuedPeaks([3, -4, 12, -6, -20, 12], peaks);
  assert.equal(context.highestDeltaRow(value, true), 2);
  assert.equal(context.highestDeltaRow(value, false), 4);
  assert.deepEqual(Array.from(state.pendingOutlierLevels, item => item.containsHighestDeltaRow), [false, true, true, false]);
  assert.ok(queuedPeaks([3, -4, 12, -6, -20, 12], peaks, false).state.pendingOutlierLevels.every(item => !item.containsHighestDeltaRow));
  assert.equal(context.highestDeltaRow(queuedPeaks([0, -4, -12], []).value, true), -1);
  assert.ok(queuedPeaks([3, -4, 12], [peak(true, 0)]).state.pendingOutlierLevels.every(item => !item.containsHighestDeltaRow));
});

test('a merged tier keeps the highest-row flag from any member, including a nonrepresentative member', () => {
  const { state } = queuedPeaks([3, -4, 12, -6, -20, 5], [peak(true, 0), peak(true, 2), peak(false, 3, 4), peak(true, 5)]);
  const group = (memberIndices, buySide, firstRow, lastRow) => ({ memberIndices, representativeIndex: memberIndices[0], price: 101, zoneLow: 100, zoneHigh: 106, buySide, firstRow, lastRow, strengthRank: 1 });
  context.legilimensProfile.rankOutlierCandidates = () => [group([0, 1], true, 0, 2), group([2], false, 3, 4), group([3], true, 5, 5)];
  const [ranked] = context.rankPendingOutlierLevels(state, { tickSize: .25 }, { levels: { mergeOverlaps: true, mergeDistancePercent: 0 }, delta: { visibleTierCount: 5 } });
  assert.deepEqual(Array.from(ranked, item => item.containsHighestDeltaRow), [true, true, false]);
  assert.equal(state.pendingOutlierLevels.length, 0);
  for (const glyph of ['●', '◆', '✦']) {
    assert.equal(context.highestDeltaMarkerGlyph(glyph, ranked[0].containsHighestDeltaRow, ranked[0].buySide), glyph + '⁺');
    assert.equal(context.highestDeltaMarkerGlyph(glyph, ranked[1].containsHighestDeltaRow, ranked[1].buySide), glyph + '⁻');
    assert.equal(context.highestDeltaMarkerGlyph(glyph, ranked[2].containsHighestDeltaRow, ranked[2].buySide), glyph);
  }
});

test('regular and extended tier markers share the decorated glyph without adding drawing objects', () => {
  assert.match(source, /string markerGlyph = highestDeltaMarkerGlyph\(baseMarkerGlyph, ranked.containsHighestDeltaRow, ranked.buySide\)/);
  assert.match(source, /PendingMitigatedZone.new\([^\n]+markerGlyph, markerLabel/);
  assert.match(source, /queueLevelMarker\(state, ranked.price, ranked.markerTime, markerGlyph, markerLabel/);
  assert.match(source, /queueLevelMarker\(state, pending.price, levelMarkerTime\(rightTime\), pending.markerGlyph/);
});

context.FocusDirection = { off: 'Off', above: 'Above', around: 'Around', below: 'Below' };
context.FocusMode = { off: 'Off', price: 'Price', date: 'Date', priceAndDate: 'Price + Date' };
for (const name of ['SOURCE_WEEKLY', 'SOURCE_MONTHLY', 'DELTA_TIER_VISIBILITY_BUY', 'DELTA_TIER_VISIBILITY_SELL']) {
  context[name] = source.match(new RegExp(`^const string ${name} = "([^"]+)"`, 'm'))[1];
}
context.sourceSpec = (sources, key) => sources.find(item => item.key === key);
for (const name of ['focusSourceAllowed', 'focusDateAllowsProfile', 'focusPriceDistance', 'focusHistoryCutoff', 'focusCandidateOutranks', 'retainFocusCandidate', 'focusOccurrenceKey', 'focusComparisonIndices', 'focusRenderDecision', 'focusedCandidates', 'appendFocusedItems', 'deltaTierSideVisible', 'profileFocusPrices', 'cacheFocusProfile']) compile(name);

const orchestrationSource = readFileSync(new URL('../indicators/21-legilimens/code/libraries/legilimens-profile-orchestration-library.pine', import.meta.url), 'utf8');
context.nyMinuteBoundaryValue = (value, minute) => Math.floor(value / 86400000) * 86400000 + minute * 60000;
context.tradingDayKeyValue = value => Math.floor(value / 86400000);
context.RenderDecision = { new: (shouldRender, displayNameOverride, pairedHeadings) => ({ shouldRender, displayNameOverride, pairedHeadings }) };
for (const name of ['profileOccurrenceKey', 'matchingProfile', 'hasPostBoundarySamples', 'rangesMatch', 'renderDecision']) compile(name, true, orchestrationSource);
context.legilimensOrchestration = {
  renderDecision: context.renderDecision,
  nyMinuteBoundary: context.nyMinuteBoundaryValue,
  tradingDayKey: context.tradingDayKeyValue,
  ProfileSelection: { new: (profiles, currentIndex, currentDeveloping) => ({ profiles, currentIndex, currentDeveloping }) },
};
const selectFocusedCandidates = context.focusedCandidates;
context.focusedCandidates = (archive, bindings, fallbackTime, settings, extendedNyModeActive = false, tickSize = .25) => selectFocusedCandidates(archive, bindings, fallbackTime, settings, extendedNyModeActive, tickSize);

const focusSettings = (direction = 'Above', anchorPrice = 100, extraProfiles = 10, overrides = {}) => ({ mode: direction === 'Off' ? context.FocusMode.off : context.FocusMode.price, direction, anchorPrice, extraProfiles, searchDepth: 250, dateTime: null, startDateTime: null, hideNonFocusProfiles: false, ...overrides });
const archivedProfile = (index, prices, sourceName = context.SOURCE_GLOBEX) => ({ profile: profile(index), prices, sourceName });
const focusBindings = (indices, sourceName = context.SOURCE_GLOBEX) => [{ source: spec(undefined, sourceName), selection: { profiles: indices.map(index => profile(index)), currentIndex: indices.length - 1 } }];

test('Focus selects additional older profiles, excludes the full requested recent set, and breaks distance ties by recency', () => {
  const archive = [archivedProfile(1, [102]), archivedProfile(2, [102]), archivedProfile(3, [101]), archivedProfile(4, [100.1]), archivedProfile(5, [100.01]), archivedProfile(0, [100.001], context.SOURCE_RTH)];
  const bindings = focusBindings([4, 5]);
  const selected = context.focusedCandidates(archive, bindings, 600, focusSettings('Above', 100, 10));
  assert.deepEqual(Array.from(selected, item => item.archived.profile.startTime), [300, 200, 100]);
  assert.equal(bindings[0].selection.currentIndex, 1);
  assert.deepEqual(bindings[0].selection.profiles.map(item => item.startTime), [400, 500]);
  assert.equal(context.focusedCandidates(archive, bindings, 600, focusSettings('Off')).length, 0);
  assert.equal(context.focusedCandidates(archive, bindings, 600, focusSettings('Above', 100, 0)).length, 0);
});

test('Focus direction is strict, Around includes equality, and manual zero/negative prices are honored', () => {
  for (const [direction, expected] of [['Above', 2], ['Below', 1], ['Around', 0]]) {
    assert.equal(context.focusPriceDistance([-1, 0, 2], focusSettings(direction, 0)), expected);
  }
  assert.equal(context.focusPriceDistance([-9, -5], focusSettings('Above', -10)), 1);
  assert.equal(context.focusPriceDistance([100], focusSettings('Above', 100)), null);
  assert.equal(context.focusPriceDistance([100], focusSettings('Below', 100)), null);
  assert.equal(context.focusPriceDistance([], focusSettings()), null);
  assert.equal(context.focusPriceDistance([101], focusSettings('Above', null)), null);
});

test('Focus supports every recurring source with capped counts and independently changing price anchors', () => {
  for (const sourceName of [context.SOURCE_GLOBEX, context.SOURCE_WEEKLY, context.SOURCE_MONTHLY, context.SOURCE_RTH, context.SOURCE_NY_EARLY, context.SOURCE_IVB, context.SOURCE_ASIA_PREMARKET, context.SOURCE_FOMC, context.SOURCE_OVERNIGHT_NINE, context.SOURCE_NY_AFTERNOON, context.SOURCE_ALL_DAY_TO_AFTERNOON, context.SOURCE_MIDNIGHT]) {
    const archive = Array.from({ length: 250 }, (_, index) => archivedProfile(index, [index + 1], sourceName));
    assert.equal(context.focusedCandidates(archive, focusBindings([250], sourceName), 25100, focusSettings('Around', 150, 10)).length, 10);
    const choose = price => context.focusedCandidates(archive, focusBindings([250], sourceName), 25100, focusSettings('Around', price, 1))[0].archived.profile.startTime;
    assert.equal(choose(1), 0);
    assert.equal(choose(200), 19900);
  }
  for (const sourceName of ['Rolling', 'Fixed']) assert.equal(context.focusSourceAllowed(sourceName), false);
  assert.match(host, /focusControlsActive = not fixedSelected and not rollingSelected/);
  assert.match(host, /focusMode = input.enum\(legilimensPresentation.FocusMode.off/);
  assert.match(host, /focusDirection = input.enum\(legilimensPresentation.FocusDirection.above/);
});

test('recurring sources honor all Focus modes, while Fixed and standalone Rolling remain excluded even with bindings', () => {
  const recurring = [context.SOURCE_GLOBEX, context.SOURCE_WEEKLY, context.SOURCE_MONTHLY, context.SOURCE_RTH, context.SOURCE_NY_EARLY, context.SOURCE_IVB, context.SOURCE_ASIA_PREMARKET, context.SOURCE_FOMC, context.SOURCE_OVERNIGHT_NINE, context.SOURCE_NY_AFTERNOON, context.SOURCE_ALL_DAY_TO_AFTERNOON, context.SOURCE_MIDNIGHT];
  for (const sourceName of [...recurring, context.SOURCE_FIXED, context.SOURCE_ROLLING]) {
    for (const mode of [context.FocusMode.price, context.FocusMode.date, context.FocusMode.priceAndDate]) {
      const archive = [archivedProfile(1, [101], sourceName), archivedProfile(2, [102], sourceName)];
      const result = context.focusedCandidates(archive, focusBindings([3], sourceName), 400, focusSettings('Above', 100, 1, { mode, dateTime: 250 }));
      assert.equal(result.length, recurring.includes(sourceName) ? 1 : 0, `${sourceName}: ${mode}`);
      if (result.length) assert.equal(result[0].archived.profile.startTime, mode === context.FocusMode.date ? 200 : 100);
    }
  }
  assert.match(host, /for profileSource in presentationSources\n            if profileSource.selected and profileSource.key != SOURCE_FIXED and profileSource.key != SOURCE_ROLLING/);
});

test('NY Focus shares overlap suppression and heading decisions before applying the requested count', () => {
  const day = 86400000, hour = 3600000;
  const archivedNy = (sourceName, endHour, high = 110) => ({ sourceName, prices: [101], profile: { startTime: day + 6 * hour, endTime: day + endHour * hour, data: { rangeLow: 90, rangeHigh: high } } });
  const primary = archivedNy(context.SOURCE_NY_EARLY, 9);
  const extended = archivedNy(context.SOURCE_EXTENDED_NY_EARLY, 9.5);
  const bindings = [context.SOURCE_NY_EARLY, context.SOURCE_EXTENDED_NY_EARLY, context.SOURCE_IVB].map(key => ({ source: { key }, selection: { profiles: [] } }));
  const settings = focusSettings('Above', 100, 2, { mode: context.FocusMode.date, dateTime: day * 3 });
  const choose = (archive, cap = 2, enabled = true) => context.focusedCandidates(archive, bindings, day * 4, { ...settings, extraProfiles: cap }, enabled);
  let result = choose([primary, extended], 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].archived.sourceName, context.SOURCE_NY_EARLY);
  assert.equal(result[0].displayNameOverride, context.DISPLAY_NY_EARLY_PLUS);
  assert.equal(result[0].pairedHeadings, false);
  result = choose([primary, archivedNy(context.SOURCE_EXTENDED_NY_EARLY, 9, 120)]);
  assert.equal(result.length, 1, 'no samples after primary close');
  const distinct = archivedNy(context.SOURCE_EXTENDED_NY_EARLY, 9.5, 120);
  result = choose([primary, distinct]);
  assert.equal(result.length, 2);
  assert.ok(result.every(item => item.pairedHeadings && item.displayNameOverride === ''));
  const ivb = archivedNy(context.SOURCE_IVB, 10.5, 130);
  result = choose([primary, distinct, ivb], 2);
  assert.equal(result.length, 2, 'combined sources share one cap');
  assert.equal(choose([distinct]).length, 0, 'missing primary cannot render an orphan extended profile');
  result = choose([primary, ivb], 2, false);
  assert.equal(result.length, 2);
  assert.ok(result.every(item => !item.pairedHeadings && item.displayNameOverride === ''));
  assert.match(source, /ProfileRenderItem.new\(geometry, candidate.displayNameOverride, candidate.pairedHeadings, true, false, true\)/);
});

test('session lifecycles preserve one occurrence across sample gaps and separate subsequent dates', () => {
  for (const name of ['boundedNySessionStart', 'boundedNyDevelopingEnd']) compile(name, true, host);
  for (const name of ['processBoundedNyAnchor', 'processAnchor', 'processKeyedBoundedNyAnchor']) compile(name, true, orchestrationSource);
  const names = ['START_TIME_UNSET', 'nySessionStartBoundary', 'nySessionStartBoundaryValue', 'nySessionEndBoundaryValue', 'nyMinuteBoundary', 'activeNySessionStart', 'appendBatch', 'appendBatchSample', 'finalizePeriod'];
  const saved = Object.fromEntries(names.map(name => [name, context[name]]));
  const day = 86400000, minute = 60000;
  const boundary = (value, startMinute) => Math.floor(value / day) * day + startMinute * minute;
  context.START_TIME_UNSET = -1;
  context.nySessionStartBoundary = boundary;
  context.nySessionStartBoundaryValue = boundary;
  context.nySessionEndBoundaryValue = (value, startMinute, endMinute) => boundary(value, endMinute);
  context.nyMinuteBoundary = boundary;
  context.activeNySessionStart = (value, enabled, startMinute, endMinute) => enabled && value >= boundary(value, startMinute) && value < boundary(value, endMinute) ? boundary(value, startMinute) : -1;
  const savedCompact = context.legilimensProfile.compactIfNeeded;
  context.legilimensProfile.compactIfNeeded = () => {};
  context.appendBatchSample = (state, samples, index) => state.volumes.push(samples.volumes[index]);
  context.appendBatch = (state, samples) => state.volumes.push(...samples.volumes);
  context.finalizePeriod = (state, startTime, endTime) => {
    state.profiles.push({ startTime, endTime, samples: [...state.volumes] });
    state.volumes.length = 0;
  };
  try {
    for (const [startMinute, endMinute] of [[360, 540], [360, 575], [570, 630]]) {
      const state = { startTime: -1, lastBarTime: -1, volumes: [], profiles: [] };
      let previousStart = -1;
      const step = (value, volume, confirmed = true) => {
        const observed = volume > 0;
        const currentStart = context.boundedNySessionStart(value, true, observed, observed ? value : null, startMinute, endMinute, false);
        const active = currentStart !== -1;
        context.processBoundedNyAnchor(state, true, 50, startMinute, endMinute, active, active && currentStart !== previousStart, !active && previousStart !== -1, currentStart, observed ? value + 1000 : null, confirmed, { volumes: observed ? [volume] : [] }, 400, .25);
        previousStart = currentStart;
      };
      const startTime = day + startMinute * minute;
      step(startTime, 0);
      step(startTime + minute, 10);
      step(startTime + 2 * minute, 0);
      step(startTime + 3 * minute, 20);
      step(startTime + 4 * minute, 0, false);
      assert.equal(state.profiles.length, 0, 'empty bars must not finalize an active session');
      assert.equal(context.boundedNyDevelopingEnd(null, state.lastBarTime, state.startTime, endMinute), startTime + 3 * minute + 1000);
      step(startTime + 5 * minute, 30);
      step(day + endMinute * minute, 0);
      assert.deepEqual(state.profiles, [{ startTime, endTime: startTime + 5 * minute + 1000, samples: [10, 20, 30] }]);
      step(startTime + day, 40);
      step(startTime + 2 * day, 50);
      step(3 * day + endMinute * minute, 0);
      assert.deepEqual(state.profiles.map(item => item.startTime), [startTime, startTime + day, startTime + 2 * day]);
      assert.deepEqual(state.profiles.map(item => item.samples), [[10, 20, 30], [40], [50]]);
      assert.equal(context.boundedNySessionStart(startTime, false, true, startTime, startMinute, endMinute, false), -1);
      assert.equal(context.boundedNySessionStart(day + endMinute * minute, true, true, startTime, startMinute, endMinute, false), startTime, 'a final bar with in-session samples still belongs to that occurrence');
    }
    for (const prefix of ['asiaPremarket', 'fomc', 'overnightNine', 'nyAfternoon', 'allDayToAfternoon', 'midnight']) {
      assert.ok(host.includes(`processKeyedBoundedNyAnchor(${prefix}Anchor,`));
      const state = { startTime: -1, lastBarTime: -1, volumes: [], profiles: [] };
      const startTime = day + 360 * minute;
      const step = (instant, volume, active = true) => context.processKeyedBoundedNyAnchor(state, true, 50, 360, 540, active, active ? startTime : -1, volume ? [startTime] : [], volume ? [instant] : [], { volumes: volume ? [volume] : [] }, 400, .25);
      step(startTime + minute, 10);
      step(startTime + 2 * minute, 0);
      assert.equal(state.profiles.length, 0, prefix);
      step(startTime + 3 * minute, 20);
      step(startTime + 4 * minute, 0);
      step(day + 540 * minute, 0, false);
      assert.deepEqual(state.profiles, [{ startTime, endTime: startTime + 3 * minute, samples: [10, 20] }], prefix);
    }
    for (const prefix of ['rth', 'globex', 'weekly', 'monthly']) {
      assert.ok(host.includes(`processAnchor(${prefix}Anchor,`));
      const state = { startTime: -1, lastBarTime: -1, volumes: [], profiles: [] };
      const startTime = day + 360 * minute;
      for (const [index, volume] of [10, 0, 20, 0].entries()) {
        context.processAnchor(state, true, 50, true, index === 0, false, startTime + index * minute, startTime + (index - 1) * minute, true, { volumes: volume ? [volume] : [] }, false, 400, .25);
        assert.equal(state.profiles.length, 0, prefix);
      }
      context.processAnchor(state, true, 50, false, false, true, day + 540 * minute, startTime + 3 * minute, true, { volumes: [] }, false, 400, .25);
      assert.deepEqual(state.profiles, [{ startTime, endTime: startTime + 2 * minute, samples: [10, 20] }], prefix);
    }
    for (const prefix of ['nyEarly', 'extendedNyEarly', 'ivb']) {
      assert.ok(host.includes(`${prefix}SessionStart = ${prefix}InSession and (na(${prefix}CurrentSessionStart[1]) or ${prefix}CurrentSessionStart != ${prefix}CurrentSessionStart[1])`));
      assert.ok(host.includes(`${prefix}SessionEnd, ${prefix}CurrentSessionStart,`));
    }
  } finally {
    Object.assign(context, saved);
    context.legilimensProfile.compactIfNeeded = savedCompact;
  }
});

test('Date Focus selects completed profiles on or before the chosen day, nearest first', () => {
  const archive = [1, 2, 3, 4, 5].map(index => archivedProfile(index, []));
  const bindings = focusBindings([5]);
  const selected = context.focusedCandidates(archive, bindings, 600, focusSettings('Above', 100, 2, { mode: context.FocusMode.date, dateTime: 350 }));
  assert.deepEqual(Array.from(selected, item => item.archived.profile.startTime), [300, 200]);
  assert.equal(context.focusedCandidates(archive, bindings, 600, focusSettings('Above', 100, 2, { mode: context.FocusMode.date, dateTime: null })).length, 0);
});

test('Price + Date filters by date before ranking eligible levels by price', () => {
  const archive = [archivedProfile(1, [101]), archivedProfile(2, [105]), archivedProfile(3, [102]), archivedProfile(4, [100.01])];
  const selected = context.focusedCandidates(archive, focusBindings([5]), 600, focusSettings('Above', 100, 2, { mode: context.FocusMode.priceAndDate, dateTime: 350 }));
  assert.deepEqual(Array.from(selected, item => item.archived.profile.startTime), [100, 300]);
});

test('hidden normal profiles let Date and Price + Date surface a selected recent completed session', () => {
  const archive = [archivedProfile(1, [101]), archivedProfile(2, [102]), archivedProfile(3, [100.1]), archivedProfile(4, [100.01])];
  const bindings = focusBindings([3, 4]);
  for (const mode of [context.FocusMode.date, context.FocusMode.priceAndDate]) {
    const hidden = focusSettings('Above', 100, 1, { mode, dateTime: 350, hideNonFocusProfiles: true });
    const shown = focusSettings('Above', 100, 1, { mode, dateTime: 350, hideNonFocusProfiles: false });
    assert.equal(context.focusedCandidates(archive, bindings, 500, hidden)[0].archived.profile.startTime, 300);
    assert.equal(context.focusedCandidates(archive, bindings, 500, shown)[0].archived.profile.startTime, mode === context.FocusMode.date ? 200 : 100);
  }
});

test('Between includes both boundary sessions, excludes outside profiles, and preserves price ranking', () => {
  const archive = [archivedProfile(1, [100.01]), archivedProfile(2, [101]), archivedProfile(3, [103]), archivedProfile(4, [102]), archivedProfile(5, [100.001])];
  const bindings = focusBindings([4, 5]);
  const bounds = { startDateTime: 200, dateTime: 419, hideNonFocusProfiles: true };
  const choose = mode => Array.from(context.focusedCandidates(archive, bindings, 600, focusSettings('Above', 100, 3, { ...bounds, mode })), item => item.archived.profile.startTime);
  assert.deepEqual(choose(context.FocusMode.date), [400, 300, 200]);
  assert.deepEqual(choose(context.FocusMode.priceAndDate), [200, 400, 300]);
  const capped = context.focusedCandidates(archive, bindings, 600, focusSettings('Above', 100, 1, { ...bounds, mode: context.FocusMode.date }));
  assert.equal(capped.length, 1);
  assert.equal(capped[0].archived.profile.startTime, 400);
});

test('Between keeps whole overlapping profiles and rejects disjoint or reversed windows', () => {
  const settings = focusSettings('Above', 100, 10, { mode: context.FocusMode.date, startDateTime: 200, dateTime: 299 });
  assert.equal(context.focusDateAllowsProfile({ startTime: 100, endTime: 400 }, settings), true);
  assert.equal(context.focusDateAllowsProfile({ startTime: 100, endTime: 200 }, settings), false);
  assert.equal(context.focusDateAllowsProfile({ startTime: 300, endTime: 400 }, settings), false);
  assert.equal(context.focusDateAllowsProfile({ startTime: 200, endTime: 300 }, settings), true);
  assert.equal(context.focusDateAllowsProfile({ startTime: 100, endTime: 400 }, { ...settings, startDateTime: 400 }), false);
  assert.equal(context.focusDateAllowsProfile({ startTime: 100, endTime: 150 }, { ...settings, mode: context.FocusMode.price }), true);
});

test('Between archive retains only profiles overlapping the requested dates', () => {
  const settings = { delta: { showTiers: false, showLvnTiers: false }, focus: focusSettings('Above', 100, 10, { mode: context.FocusMode.date, startDateTime: 200, dateTime: 419 }) };
  const state = { focusProfiles: [], mitigatedProfiles: [] };
  for (let index = 1; index <= 300; index++) context.cacheFocusProfile(state, profile(index), spec(undefined, context.SOURCE_GLOBEX), {}, settings);
  assert.deepEqual(Array.from(state.focusProfiles, item => item.profile.startTime), [200, 300, 400]);
});

test('trading-date boundaries include full dates through DST and calendar rollover', () => {
  compile('validFocusDate', true, host);
  compile('focusTradingDateBoundary', true, host);
  context.NY_TIMEZONE = 'America/New_York';
  context.UTC_TIMEZONE = 'GMT+0';
  context.SUNDAY_REOPEN_START_HOUR = 18;
  const savedTimestamp = context.timestamp;
  context.timestamp = (zone, year, month, day, hour, minute) => {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone === 'GMT+0' ? 'UTC' : zone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let value = target;
    for (let attempt = 0; attempt < 4; attempt++) {
      const p = Object.fromEntries(formatter.formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
      value += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    }
    return value;
  };
  try {
    const boundary = context.focusTradingDateBoundary;
    assert.equal(boundary(2026, 3, 8, false, false), Date.parse('2026-03-07T23:00:00Z'));
    assert.equal(boundary(2026, 3, 8, false, true), Date.parse('2026-03-08T22:00:00Z'));
    assert.equal(boundary(2026, 11, 1, false, true) - boundary(2026, 11, 1, false, false), 25 * 3600000);
    assert.equal(boundary(2024, 2, 29, true, false), Date.parse('2024-02-29T00:00:00Z'));
    assert.equal(boundary(2024, 2, 29, true, true), Date.parse('2024-03-01T00:00:00Z'));
    assert.equal(boundary(2026, 12, 31, true, true), Date.parse('2027-01-01T00:00:00Z'));
    for (const [year, month, day, valid] of [[2024, 2, 29, true], [2000, 2, 29, true], [2100, 2, 29, false], [2026, 2, 29, false], [2026, 4, 31, false], [2026, 9, 23, true]]) {
      assert.equal(context.validFocusDate(year, month, day), valid);
    }
  } finally {
    context.timestamp = savedTimestamp;
  }
});

test('Focus Profiles Only keeps Focus candidates and skips the normal render items', () => {
  assert.match(host, /focusHideNonFocusProfiles = input.bool\(false, "Focus Profiles Only"/);
  assert.match(source, /array<FocusCandidate> candidates = focusedCandidates\(state.focusProfiles, bindings, context.barTime, config.focus, config.extendedNyModeActive, context.tickSize\)/);
  assert.match(source, /showRecentProfiles = config.focus.mode == FocusMode.off or not config.focus.hideNonFocusProfiles/);
  assert.match(source, /if showRecentProfiles\n        items := profileRenderItems\(/);
  assert.match(source, /appendFocusedItems\(state, items, candidates, sources, availablePolylines, showRecentProfiles and renderHistograms, config\)/);
  assert.match(host, /"Delta Histogram"/);
  assert.match(host, /"Delta Tiers"/);
  assert.match(host, /showFocusAnchorGuide = focusUsesPrice and focusDateInputsValid and profileChartAllowed/);
  assert.match(host, /if showFocusAnchorGuide and focusSearchActive and not na\(presentationFocusSettings.anchorPrice\)/);
});

test('Delta Histogram Off leaves the selected right-side tier visibility intact', () => {
  const settings = config({ visibleRows: context.OPTION_OFF, showTiers: true, visibleTierSides: context.OPTION_ALL });
  const geometry = context.profilePolylineLayout(profile(1), spec(), context.profileAnalysis({ completedAnalyses: [] }, profile(1), spec(), false), [], settings);
  assert.equal(geometry.pointCounts.slice(2).reduce((total, count) => total + count, 0), 0);
  assert.equal(context.deltaTierSideVisible(true, settings), true);
  assert.equal(context.deltaTierSideVisible(false, settings), true);
});

test('Focus additions preserve base profiles and stop at core-object or polyline capacity, including base histograms', () => {
  const settings = config({ showTiers: false, visibleTierCount: 2, showLvnTiers: false, showHighestDeltaLevels: false });
  settings.levels = { showValueArea: false, showPoc: false, showMidpoint: false };
  settings.limits = { lines: 500, labels: 500, boxes: 4, polylines: 100 };
  const style = spec(undefined, context.SOURCE_GLOBEX);
  const baseline = prepare([profile(100)], settings, style);
  const first = baseline[0];
  const candidates = [1, 2, 3].map(index => ({ archived: archivedProfile(index, [101]), distance: index, displayNameOverride: "", pairedHeadings: false }));
  context.appendFocusedItems({ drawnPolylines: [], cachedChartTimes: [], completedAnalyses: [] }, baseline, candidates, [style], 100, true, settings);
  assert.equal(baseline.length, 2);
  assert.equal(baseline[0], first);
  assert.equal(baseline[1].geometry.profile.startTime, 100);
  settings.limits.boxes = 500;
  const crowded = prepare([profile(100)], settings, style);
  crowded[0].historical = false;
  const allowed = context.profilePolylineCost({ drawnPolylines: [] }, crowded, true, settings);
  context.appendFocusedItems({ drawnPolylines: [], cachedChartTimes: [], completedAnalyses: [] }, crowded, candidates, [style], allowed, true, settings);
  assert.equal(crowded.length, 1);
  assert.equal(context.profilePolylineCost({ drawnPolylines: [] }, crowded, true, settings), allowed);
});

test('Focus scoring shares tier ranking and side visibility; LVN midpoints and cliffs match displayed prices', () => {
  context.newRenderState = () => ({ pendingOutlierLevels: [] });
  context.legilimensOrchestration.tradingDayKey = value => value;
  context.legilimensProfile.collectOutlierPeaks = () => [peak(true, 0), peak(false, 1)];
  context.legilimensProfile.selectLowVolumeCandidates = () => [{ isLvn: true, zoneLow: 90, zoneHigh: 94, price: 90 }, { isLvn: false, price: 108 }];
  context.legilimensProfile.rankOutlierCandidates = () => [
    { memberIndices: [0], representativeIndex: 0, price: 101, buySide: true, strengthRank: 1 },
    { memberIndices: [1], representativeIndex: 1, price: 105, buySide: false, strengthRank: 1 },
  ];
  const settings = { delta: { showTiers: true, showLvnTiers: true, visibleLvnTierCount: 2, visibleTierCount: 2, visibleTierSides: context.DELTA_TIER_VISIBILITY_BUY }, levels: { mergeOverlaps: true, mergeDistancePercent: 0 } };
  const score = () => Array.from(context.profileFocusPrices(profile(1), spec(undefined, context.SOURCE_GLOBEX), { tickSize: .25 }, settings));
  assert.deepEqual(score(), [101, 92, 108]);
  settings.delta.visibleTierSides = context.DELTA_TIER_VISIBILITY_SELL;
  assert.deepEqual(score(), [105, 92, 108]);
  settings.delta.showTiers = false;
  assert.deepEqual(score(), [92, 108]);
  settings.delta.showLvnTiers = false;
  assert.deepEqual(score(), []);
});

test('Focus archive expiry also expires mitigation metadata and leaves other sources intact', () => {
  const settings = { delta: { showTiers: false, showLvnTiers: false }, focus: focusSettings('Above', 100, 10, { searchDepth: 2 }) };
  const state = { focusProfiles: [archivedProfile(0, [], context.SOURCE_WEEKLY)], mitigatedProfiles: [{ sourceName: context.SOURCE_WEEKLY, startTime: 0 }, { sourceName: context.SOURCE_GLOBEX, startTime: 100 }] };
  const expired = [];
  context.removeMitigatedProfile = (state, sourceName, startTime) => expired.push([sourceName, startTime]);
  for (const index of [1, 2, 3]) context.cacheFocusProfile(state, profile(index), spec(undefined, context.SOURCE_GLOBEX), {}, settings);
  assert.deepEqual(Array.from(state.focusProfiles, item => item.profile.startTime), [0, 200, 300]);
  assert.deepEqual(expired, [[context.SOURCE_GLOBEX, 100]]);
  assert.deepEqual(state.mitigatedProfiles, [{ sourceName: context.SOURCE_WEEKLY, startTime: 0 }]);
});

test('Date archive retains target-era profiles even when many newer sessions are loaded', () => {
  const settings = { delta: { showTiers: false, showLvnTiers: false }, focus: focusSettings('Above', 100, 10, { mode: context.FocusMode.date, dateTime: 350, searchDepth: 2 }) };
  const state = { focusProfiles: [], mitigatedProfiles: [] };
  for (let index = 1; index <= 300; index++) context.cacheFocusProfile(state, profile(index), spec(undefined, context.SOURCE_GLOBEX), {}, settings);
  assert.deepEqual(Array.from(state.focusProfiles, item => item.profile.startTime), [200, 300]);
  assert.deepEqual(Array.from(state.focusProfiles, item => item.prices.length), [0, 0]);
});

test('deeper Rolling Weekly/Monthly history preserves recent period boundaries and sample membership across DST', () => {
  const orchestration = readFileSync(new URL('../indicators/21-legilimens/code/libraries/legilimens-profile-orchestration-library.pine', import.meta.url), 'utf8');
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  const parts = value => Object.fromEntries(formatter.formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  context.NY_TIMEZONE = 'America/New_York';
  context.START_TIME_UNSET = -1;
  context.MS_PER_HOUR = 3600000;
  for (const name of ['year', 'month', 'hour', 'minute']) context[name] = value => parts(value)[name];
  context.dayofmonth = value => parts(value).day;
  context.dayofweek = Object.assign(value => { const p = parts(value); return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 1; }, { saturday: 7, sunday: 1 });
  context.timestamp = (zone, year, month, day, hour, minute) => {
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let value = target;
    for (let attempt = 0; attempt < 3; attempt++) {
      const p = parts(value);
      value += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    }
    return value;
  };
  for (const name of ['previousNyCutoff', 'nextNyCutoff', 'lookbackDaysStart', 'lookforwardDaysEndValue', 'processRollingPeriodAnchor']) compile(name, true, orchestration);
  compile('rollingFocusPeriodCount', true, host);
  context.legilimensProfile.compactIfNeeded = () => {};
  context.appendBatchSample = (state, samples, index) => state.volumes.push(samples.volumes[index]);
  context.finalizePeriod = (state, startTime, endTime, keepProfiles) => {
    if (state.volumes.length) {
      state.profiles.push({ startTime, endTime, members: [...state.volumes] });
      while (state.profiles.length > keepProfiles) state.profiles.shift();
      state.volumes.length = 0;
    }
  };
  for (const twentyFourSeven of [false, true]) for (const periodDays of [7, 30]) for (const finalDate of [[2026, 3, 30], [2026, 9, 22], [2026, 11, 9]]) {
    const finalTime = context.timestamp('', ...finalDate, 18, 0);
    const firstTime = context.timestamp('', finalDate[0] - 1, finalDate[1], finalDate[2], 18, 0);
    const count = context.rollingFocusPeriodCount(finalTime, firstTime, periodDays, 4, 250);
    assert.ok(count > 4 && count <= 250);
    const run = periods => {
      const startTime = context.lookbackDaysStart(finalTime, periodDays * periods, twentyFourSeven);
      const state = { startTime: -1, periodEndTime: -1, volumes: [], highs: [], lows: [], deltas: [], profiles: [] };
      for (let instant = firstTime; instant <= finalTime; instant = context.nextNyCutoff(instant, 18, 0)) {
        const weekday = context.dayofweek(instant);
        const volume = twentyFourSeven || (weekday !== 7 && weekday !== 1) ? [instant] : [];
        const samples = { startTimes: [instant], endTimes: [instant + 60000], volumes: volume };
        context.processRollingPeriodAnchor(state, true, periodDays, startTime, finalTime, twentyFourSeven, true, instant, samples, 50, 400, .25);
      }
      return state.profiles;
    };
    const base = run(4);
    assert.equal(base.length, 4);
    assert.deepEqual(run(count).slice(-4), base, `${periodDays} days; 24/7=${twentyFourSeven}; end=${finalDate}`);
  }
  assert.equal(context.rollingFocusPeriodCount(Date.UTC(2026, 1), Date.UTC(1990, 1), 30, 4, 250), 250);
  assert.match(host, /focusSearchActive and rollingPeriodSelected and \(na\(rollingFocusEndTime\)/);
});

test('every Delta and LVN tier keeps its profile label and developing suffix', () => {
  compile('developingLevelLabel');
  compile('renderRankedOutlierLevels', false);
  const markers = [];
  context.sourceSpec = (sources, key) => sources.find(item => item.key === key);
  context.deltaTierAppearance = () => ({});
  for (const name of ['appearanceLineStyle', 'appearanceZoneColor', 'appearanceLineColor', 'appearanceTextColor']) context[name] = () => 'style';
  context.appearanceHasLine = () => false;
  context.mitigationEnabled = () => false;
  context.deltaTierSideVisible = () => true;
  context.renderZoneFill = () => {};
  context.queueLevelMarker = (...args) => markers.push(args);
  context.renderLowVolumeZone = () => false;
  const profileSource = { key: 'NY Early', labelName: 'NY Early' };
  const settings = { delta: { showDotLabels: true, showLvnTiers: true }, interactions: { extendUnmitigated: false } };
  const ranked = Array.from({ length: 10 }, (_, index) => ({ sourceName: profileSource.key, strengthRank: index % 5 + 1, buySide: index < 5, fibLocationGrade: 0 }));
  const candidates = Array.from({ length: 5 }, (_, index) => ({ isLvn: index < 4, zoneLow: 100 + index, zoneHigh: 102 + index, price: 120 }));
  for (const developing of [true, false]) {
    const caption = context.developingLevelLabel('NY Early', developing);
    assert.equal(caption, developing ? 'NY Early (dev)' : 'NY Early');
    for (const showLabels of [true, false]) {
      markers.length = 0;
      settings.delta.showDotLabels = showLabels;
      context.renderRankedOutlierLevels({}, ranked.map(item => ({ ...item, displayNameOverride: caption })), false, [profileSource], {}, settings);
      context.renderLowVolumeStructures({}, { data: { rangeLow: 100, rangeHigh: 200 } }, profileSource, candidates, caption, 100, 1, false, false, [], {}, settings);
      assert.equal(markers.length, 15);
      assert.ok(markers.every(args => args[4] === (showLabels ? caption : '')));
    }
  }
});

test('disabling Extended preserves NY Early and IVB in the combined mode', () => {
  for (const [, name, value] of host.matchAll(/^const string (PROFILE_EMOJI_\w+) = (.+)$/gm)) context[name] = vm.runInContext(value, context);
  for (const key of ['MODE_NY_EARLY', 'MODE_NY_EARLY_IVB', 'MODE_IVB']) {
    context[key] = vm.runInContext(host.match(new RegExp(`^${key} = (.+)$`, 'm'))[1], context);
  }
  compile('nyEarlyModeSelected', true, host);
  compile('ivbModeSelected', true, host);
  const extendedSelection = expression(host.match(/^extendedNyEarlySelected = (.+)$/m)[1]);
  const groupedSelection = expression(host.match(/^    bool groupedNyProfilesActive = (.+)$/m)[1]);
  for (const mode of [context.MODE_NY_EARLY, context.MODE_NY_EARLY_IVB, context.MODE_IVB]) {
    context.nyEarlySelected = context.nyEarlyModeSelected(mode);
    context.nyEarlyModeActive = context.nyEarlySelected;
    context.ivbModeActive = context.ivbModeSelected(mode);
    for (const enabled of [false, true]) {
      context.nyEarlyExtended = enabled;
      context.extendedNyEarlyModeActive = vm.runInContext(extendedSelection, context);
      assert.equal(context.extendedNyEarlyModeActive, enabled && mode !== context.MODE_IVB);
      assert.equal(vm.runInContext(groupedSelection, context), mode === context.MODE_NY_EARLY_IVB || (mode === context.MODE_NY_EARLY && enabled));
    }
  }
});

function useActualProfileAnalytics() {
  const analyticsSource = readFileSync(new URL('../indicators/21-legilimens/code/libraries/legilimens-profile-library.pine', import.meta.url), 'utf8');
  context.array.max = values => Math.max(...values);
  for (const [, name, value] of analyticsSource.matchAll(/^const (?:int|float) (VALUE_AREA_PERCENT|OUTLIER_\w+|LOW_VOLUME_\w+) = (.+)$/gm)) {
    context[name] = vm.runInContext(value, context);
  }
  for (const typeName of ['LowVolumeCandidate', 'OutlierPeak']) {
    const fields = analyticsSource.match(new RegExp(`^export type ${typeName}\\n((?:    [^\\n]+\\n)+)`, 'm'))[1].trim().split('\n').map(line => line.trim().split(' ')[1]);
    context[typeName] = { new: (...values) => Object.fromEntries(fields.map((key, index) => [key, values[index]])) };
  }
  for (const name of ['computeRowStrengths', 'profileValueLevels', 'isOutlierStrength', 'smoothProfileVolumes', 'volumeWindowAverage', 'collectLowVolumeCandidates', 'lowVolumeCandidatesOverlap', 'selectLowVolumeCandidates', 'outlierPeak', 'collectSideOutlierPeaks', 'collectOutlierPeaks']) compile(name, true, analyticsSource);
  const calls = { computeRowStrengths: 0, profileValueLevels: 0, collectOutlierPeaks: 0, selectLowVolumeCandidates: 0 };
  for (const name of Object.keys(calls)) context.legilimensProfile[name] = (...args) => { calls[name]++; return context[name](...args); };
  return calls;
}

test('completed NY analyses reuse real analytics across forward steps while developing data stays fresh', () => {
  const calls = useActualProfileAnalytics();
  const state = { completedAnalyses: [], analysisBarTime: null };
  const settings = config({ showTiers: true, showHighestDeltaLevels: true, showLvnTiers: true, visibleLvnTierCount: 5 });
  const profiles = Array.from({ length: 25 }, (_, index) => {
    const value = profile(index, 80 + index % 4 * 20);
    value.data.rowVolumes = value.data.rowVolumes.map((_, row) => 10 + (row % 40 < 12 ? 1 : 100) + row % 7);
    return value;
  });
  const sources = [spec(undefined, context.SOURCE_NY_EARLY), spec(undefined, context.SOURCE_EXTENDED_NY_EARLY)];
  const analyze = (value, style, completed) => {
    const analysis = context.profileAnalysis(state, value, style, completed);
    context.profileOutlierPeaks(analysis, value, settings);
    context.profileLowVolumeCandidates(analysis, value, settings);
    return analysis;
  };
  const items = profiles.flatMap(value => sources.map(style => ({ geometry: { profile: value, source: style, analysis: analyze(value, style, true) }, developing: false, contentVisible: true })));
  assert.ok(items.some(item => item.geometry.analysis.lowVolumeCandidates.length > 0));
  assert.ok(items.some(item => item.geometry.analysis.outlierPeaks.length > 0));
  context.retainCompletedAnalyses(state, items);
  assert.equal(state.completedAnalyses.length, 50);
  const snapshots = items.map(item => structuredClone(item.geometry.analysis));
  const live = profile(30, 100);
  let lastLive = null;
  for (let step = 0; step < 20; step++) {
    context.prepareProfileAnalysisCache(state, 4000 + step);
    for (const [index, item] of items.entries()) {
      const reused = analyze(item.geometry.profile, item.geometry.source, true);
      assert.equal(reused, item.geometry.analysis);
      assert.deepEqual(reused, snapshots[index]);
    }
    live.data.rowDeltas[0] = 1000 + step;
    const freshLive = analyze(live, sources[0], false);
    if (lastLive) assert.notDeepEqual(freshLive.strengths, lastLive.strengths);
    assert.notEqual(freshLive, lastLive);
    lastLive = freshLive;
    context.retainCompletedAnalyses(state, [...items, { geometry: { source: sources[0], analysis: freshLive }, developing: true, contentVisible: true }]);
  }
  for (const count of Object.values(calls)) assert.equal(count, 70, '50 completed calculations once, plus 20 live updates');
  for (const item of items) {
    const fresh = analyze(item.geometry.profile, item.geometry.source, false);
    assert.deepEqual(fresh, item.geometry.analysis, 'cached values must equal an independent fresh calculation');
  }
});

test('cache admission, occurrence keys, backward Replay and chart geometry prevent stale reuse', () => {
  useActualProfileAnalytics();
  const state = { completedAnalyses: [], analysisBarTime: 1000 };
  const style = spec('PROFILE_POSITION_RIGHT_RIGHT', context.SOURCE_NY_EARLY);
  const settings = config({ showTiers: true, showLvnTiers: true, visibleLvnTierCount: 5 });
  const value = profile(1);
  const saved = context.profileAnalysis(state, value, style, true);
  const item = { geometry: { source: style, analysis: saved }, developing: false, contentVisible: true };
  context.retainCompletedAnalyses(state, [item,
    { ...item, developing: true }, { ...item, contentVisible: false },
    { ...item, geometry: { source: { key: context.SOURCE_FIXED }, analysis: saved } },
    { ...item, geometry: { source: { key: context.SOURCE_ROLLING }, analysis: saved } },
  ]);
  assert.equal(state.completedAnalyses.length, 1);
  assert.equal(context.profileAnalysis(state, value, style, true), saved);
  assert.notEqual(context.profileAnalysis(state, value, { ...style, key: context.SOURCE_EXTENDED_NY_EARLY }, true), saved);
  assert.notEqual(context.profileAnalysis(state, { ...value, endTime: value.endTime + 1 }, style, true), saved);
  const oldGeometry = context.profilePolylineLayout(value, style, saved, [100, 105, 120, 140], settings);
  const nextGeometry = context.profilePolylineLayout(value, style, saved, [100, 105, 120, 130, 131, 132, 133, 140], settings);
  assert.notEqual(oldGeometry.deltaRightTime, nextGeometry.deltaRightTime, 'geometry must follow the current chart even when analytics are reused');
  const freshGeometry = context.profilePolylineLayout(value, style, context.profileAnalysis(state, value, style, false), [100, 105, 120, 130, 131, 132, 133, 140], settings);
  assert.deepEqual(nextGeometry, freshGeometry);
  context.prepareProfileAnalysisCache(state, 999);
  assert.equal(state.completedAnalyses.length, 0);
  assert.notEqual(context.profileAnalysis(state, value, style, true), saved);
  context.retainCompletedAnalyses(state, [item]);
  context.retainCompletedAnalyses(state, []);
  assert.equal(state.completedAnalyses.length, 0, 'profiles leaving the rendered set must release their cache');
});
