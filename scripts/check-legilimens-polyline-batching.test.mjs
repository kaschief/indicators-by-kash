import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../indicators/21-legilimens/code/libraries/legilimens-presentation-library.pine', import.meta.url), 'utf8');
const host = readFileSync(new URL('../indicators/21-legilimens/code/legilimens.pine', import.meta.url), 'utf8');

// Execute the Pine batching functions with drawing/coordinate adapters; this is not Pine compilation.
const context = vm.createContext({
  math: Math, int: Math.trunc, float: Number, na: value => value == null,
  array: {
    size: values => values.length, get: (values, index) => values[index],
    set: (values, index, value) => { values[index] = value; },
    push: (values, value) => values.push(value), first: values => values[0],
    clear: values => { values.length = 0; }, concat: (target, values) => target.push(...values),
    from: (...values) => values, new: (count = 0, value = null) => Array(count).fill(value),
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
for (const name of ['PROFILE_FRAME_BOX_COUNT', 'PROFILE_HEADING_LABEL_COUNT', 'PROFILE_POLYLINE_LAYER_COUNT', 'PROFILE_POLYLINE_POINT_LIMIT', 'OPTION_OFF', 'OPTION_ALL', 'DELTA_ROWS_BUY', 'DELTA_ROWS_SELL', 'DELTA_ROW_FILTER_OUTLIERS', 'DELTA_ROW_FILTER_SELECTED_TIER_OUTLIERS', 'PROFILE_POSITION_LEFT_LEFT', 'PROFILE_POSITION_LEFT_RIGHT', 'PROFILE_POSITION_RIGHT_LEFT', 'PROFILE_POSITION_RIGHT_RIGHT']) {
  const expression = source.match(new RegExp(`^const (?:int|string) ${name} = (.+)$`, 'm'))?.[1] ?? host.match(new RegExp(`^(?:const (?:int|string) )?${name} = (.+)$`, 'm'))?.[1];
  assert.ok(expression, name);
  context[name] = vm.runInContext(expression, context);
}
for (const name of ['profileDeltaPlusColor', 'profileDeltaMinusColor', 'profileDeltaPlusPlusColor', 'profileDeltaMinusMinusColor']) {
  context[name] = spec => `${name}:${spec.alternateStyles}`;
}
const expression = value => value.replace(/array\.new<[^>]+>/g, 'array.new')
  .replace(/\bna\b(?!\s*\()/g, 'null').replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!').replace(/:=/g, '=');
for (const typeName of ['ProfilePolylineLayer', 'ProfilePolylineBatch', 'ProfilePolylineLayout', 'ProfilePolylineRegion', 'ProfileRenderItem']) {
  const body = source.match(new RegExp(`^type ${typeName}\\n((?:    [^\\n]+\\n)+)`, 'm'))[1];
  const fields = body.trim().split('\n').map(line => line.trim().match(/^\S+ (\w+)(?: = (.+))?$/).slice(1));
  context[typeName] = { new: (...values) => Object.fromEntries(fields.map(([key, fallback], index) => [key, index < values.length ? values[index] : fallback ? vm.runInContext(expression(fallback), context) : null])) };
}
function compile(name) {
  const match = source.match(new RegExp(`^(?:export )?${name}\\(([^\\n]*)\\) =>\\n((?:[ \\t]+[^\\n]*\\n|\\n)+)`, 'm'));
  assert.ok(match, name);
  const parameters = match[1].split(',').map(value => value.trim().split(' ').at(-1)).join(',');
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
    else if (line.startsWith('for ')) {
      const range = line.match(/^for (\w+) = (.+) to (.+)$/);
      const each = line.match(/^for (\w+) in (.+)$/);
      line = range ? `for (let ${range[1]} = ${range[2]}; ${range[1]} <= ${range[3]}; ${range[1]}++) {` : `for (const ${each[1]} of ${each[2]}) {`;
    } else {
      block = false;
      line = line.replace(/^(?:array<[^>]+>|[\w.]+) (\w+) = /, 'let $1 = ').replace(/^\[([^\]]+)\] = /, 'let [$1] = ');
      line = line.replace(/polyline\.new\(layer.points, curved=false, closed=true, xloc=xloc.bar_time, line_color=color.new\(layer.fillColor, 100\), fill_color=layer.fillColor\)/, 'polyline.new(layer.points, layer.fillColor)');
      if (index === lines.length - 1 || (name === 'deltaOuterTime' && line.startsWith('chartTimeAtOffset('))) line = `return ${line}`;
      line += ';';
    }
    output.push(line);
    if (block) blocks.push(indent);
  }
  while (blocks.length) { output.push('}'); blocks.pop(); }
  vm.runInContext(`function ${name}(${parameters}) {\n${output.join('\n')}\n}`, context, { filename: `${name}.pine-adapter.js` });
}
for (const name of ['visibleDeltaTierSideCount', 'maximumCoreObjectCostsPerProfile', 'profileCapacityForObjectLimit', 'maximumProfileCapacity', 'chartTimeAtOffset', 'profileBaselineTime', 'profileOuterTime', 'deltaOuterTime', 'rowPassesDeltaFilter', 'appendDeltaRowPoints', 'deltaLayerIndex', 'histogramRegionRows', 'profilePolylineLayout', 'profilePolylineRegions', 'newProfilePolylineBatch', 'profilePolylineColor', 'canDrawPolyline', 'flushProfilePolylineLayer', 'flushProfilePolylineBatch', 'profilePolylineBounds', 'profilePolylineBatchCompatible', 'appendProfilePolylineRegion', 'processProfilePolylineBatch', 'profilePolylineCost']) compile(name);

const config = (overrides = {}) => ({ limits: { polylines: 100 }, delta: { visibleRows: context.OPTION_ALL, rowFilter: context.OPTION_ALL, showHistogram: true, histogramWidthPercent: 20, ...overrides } });
function profile(index, count = 12, low = 100) {
  const deltas = Array.from({ length: count }, (_, row) => (row % 2 ? -1 : 1) * (row % 4 < 2 ? 2 : 10));
  return { startTime: index * 100, endTime: index * 100 + 20, data: { rowCount: count, rowVolumes: Array(count).fill(100), rowDeltas: deltas, strengths: deltas.map(value => Math.abs(value) >= 10 ? 2 : 1), priceLow: low, priceHigh: low + count, maxAbsRowDelta: 10, maxRowVolume: 100 } };
}
const spec = (placement = 'PROFILE_POSITION_RIGHT_LEFT', key = 'Overnight', alternateStyles = false) => ({ key, alternateStyles, deltaWidthBars: 12, profilePosition: context[placement] });
function prepare(profiles, settings = config(), style = spec(), selected = null) {
  return profiles.map(value => {
    const geometry = context.profilePolylineLayout(value, style, [], settings);
    const rows = selected ?? Array(value.data.rowCount).fill(true);
    const regions = context.profilePolylineRegions(geometry, rows, settings.delta.showHistogram, [], settings);
    return { geometry, regions, historical: true, developing: false, contentVisible: true };
  });
}
function execute(items, settings = config(), histogram = true, draw = true) {
  const state = { drawnPolylines: [] };
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

test('irregular chart times and projected edges stay inside the reserved envelope', () => {
  const times = [0, 1, 4, 5, 20, 21, 35, 50, 100, 101, 109, 120];
  for (const placement of ['PROFILE_POSITION_LEFT_LEFT', 'PROFILE_POSITION_LEFT_RIGHT', 'PROFILE_POSITION_RIGHT_LEFT', 'PROFILE_POSITION_RIGHT_RIGHT']) {
    const settings = config();
    const value = profile(0, 400);
    const geometry = context.profilePolylineLayout(value, spec(placement), times, settings);
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
