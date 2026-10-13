import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createHarness, source, section, executedFunctions } from './lib/elderwand-harness.mjs';

const anchorKeys = ['yearly', 'quarterly', 'monthly', 'weekly', 'rolling', 'daily', 'ny', 'nyEarlyHigh', 'nyEarlyLow'];
const names = ['Yearly', 'Quarterly', 'Monthly', 'Weekly', 'Rolling', 'Daily', 'NY', 'NY Early High', 'NY Early Low'];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function configured(overrides = {}, pine = source) {
  const h = createHarness(pine);
  const controls = {};
  let currentInput;
  h.c.input = Object.fromEntries(['bool', 'string', 'int', 'float', 'color'].map(kind => [kind, (value, title, options = {}) => {
    controls[currentInput] = { kind, value, title, ...options };
    return Object.hasOwn(overrides, currentInput) ? overrides[currentInput] : value;
  }]));
  const inputs = section(pine, '// INPUTS — per anchor', '// VOLUME GUARD');
  for (const line of inputs.split('\n')) {
    const match = line.match(/^(\w+) = /);
    if (match) { currentInput = match[1]; h.globals(line); }
  }
  h.globals(section(pine, 'var VwapAnchor daily', '// QUICK FILTER\n'));
  h.controls = controls;
  return h;
}
function points(anchor, price = 100, deviation = 2) {
  Object.assign(anchor, { barTimes: [1000, 2000], vwapValues: [price, price], stdevValues: [deviation, deviation], visible: true });
  return anchor;
}
function flush(h, members) {
  h.c.pendingLabels.push(...members);
  h.c.flush_pending_labels();
  return h.c.renderedLabels;
}
function pending(h, name, width, overrides = {}) {
  const key = anchorKeys[names.indexOf(name)];
  const anchor = h.c[key];
  return { barTime: 2000, price: 100, displayPrice: 100, pricePriority: h.c.anchor_label_priority(name), identity: name,
    showPrice: false, textColor: anchor.lineColor, labelSize: anchor.labelSize, lineWidth: width,
    priority: h.c.anchor_label_priority(name), ...overrides };
}

function calendar(h) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = value => Object.fromEntries(formatter.formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  for (const [pineName, part] of [['year', 'year'], ['month', 'month'], ['dayofmonth', 'day'], ['hour', 'hour'], ['minute', 'minute']]) h.c[pineName] = value => parts(value)[part];
  h.c.dayofweek = value => { const p = parts(value); return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 1; };
  h.c.dayofweek.sunday = 1;
  h.c.timestamp = (zone, year, month, day, hour, minute) => {
    assert.equal(zone, 'America/New_York');
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let result = target;
    for (let iteration = 0; iteration < 3; iteration++) {
      const p = parts(result);
      result += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    }
    return result;
  };
  h.c.timeframe = { period: '5', change: unit => !!h.c.changes?.[unit], in_seconds: value => ({ '1D': 86400, '1W': 604800, '1M': 2629800, '3M': 7889400, '12M': 31557600 }[value] ?? Number(value) * 60) };
  h.c.pineTime = (period, window, zone) => {
    assert.equal(zone, 'America/New_York');
    const [from, to] = window.split(':')[0].split('-').map(part => Number(part.slice(0, 2)) * 60 + Number(part.slice(2)));
    const p = parts(h.c.time), minute = p.hour * 60 + p.minute;
    return (from < to ? minute >= from && minute < to : minute >= from || minute < to) ? h.c.time : NaN;
  };
  h.globals(section(h.pine, 'chartSecs    =', 'extension_cutoff('));
  return h;
}

function signals(h, date, previousDate) {
  h.c.time = Date.parse(date);
  h.c.previous.time = previousDate ? Date.parse(previousDate) : NaN;
  h.globals(section(h.pine, 'dayChange   =', 'extension_cutoff('));
}

test('all configured anchors preserve their independent colors, sizes, widths, fills and band choices', () => {
  const h = configured();
  for (const [index, key] of anchorKeys.entries()) {
    assert.equal(h.c[key].name, names[index]);
    assert.equal(h.c[key].labelSize, index < 3 ? 'normal' : key === 'weekly' ? 'small' : 'tiny');
    assert.equal(h.c[key].lineWidth, key.startsWith('nyEarly') ? 2 : 3);
    assert.equal(h.c[key].band1Enabled, key.startsWith('nyEarly'));
    assert.equal(h.c[key].band2Enabled, true);
    assert.equal(h.c[key].band3Enabled, true);
  }
  const custom = configured({ dailyColor: { r: 1, g: 2, b: 3, t: 7 }, dailyVwapWidthChoice: '5', dailyBand1Choice: '4', dailyBand2Choice: 'Off', dailyFillOpacity: 20 });
  assert.deepEqual(custom.c.daily.lineColor, { r: 1, g: 2, b: 3, t: 7 });
  assert.equal(custom.c.daily.lineWidth, 5);
  assert.equal(custom.c.daily.band1Width, 4);
  assert.equal(custom.c.daily.band2Enabled, false);
  assert.equal(custom.c.daily.fillOpacity, 20);
  assert.notDeepEqual(custom.c.weekly.lineColor, custom.c.daily.lineColor);
});

test('every quick filter selects exactly its advertised anchors and overrides manual toggles', () => {
  const h = configured();
  const filters = {
    YEARLY: ['Yearly'], QUARTERLY: ['Quarterly'], MONTHLY: ['Monthly'], WEEKLY: ['Weekly'], ROLLING: ['Rolling'], DAILY: ['Daily'], NY: ['NY'], NY_EARLY: ['NY Early High', 'NY Early Low'],
    WEEKLY_DAILY: ['Weekly', 'Daily'], WEEKLY_DAILY_NY_EARLY: ['Weekly', 'Daily', 'NY Early High', 'NY Early Low'],
    MONTHLY_WEEKLY: ['Monthly', 'Weekly'], MONTHLY_WEEKLY_DAILY: ['Monthly', 'Weekly', 'Daily'],
    QUARTERLY_MONTHLY: ['Quarterly', 'Monthly'], QUARTERLY_MONTHLY_WEEKLY: ['Quarterly', 'Monthly', 'Weekly'],
    QUARTERLY_MONTHLY_WEEKLY_DAILY: ['Quarterly', 'Monthly', 'Weekly', 'Daily'], YEARLY_QUARTERLY_MONTHLY: ['Yearly', 'Quarterly', 'Monthly'],
  };
  assert.equal(h.controls.quickFilter.options.length, Object.keys(filters).length + 1);
  for (const [filter, expected] of Object.entries(filters)) for (const manual of [false, true]) {
    h.c.quickFilter = h.c[`FILTER_${filter}`];
    assert.deepEqual(names.filter(name => h.c.filter_enabled(name, manual)), expected, filter);
  }
  h.c.quickFilter = h.c.FILTER_ALL;
  for (const name of names) for (const enabled of [false, true]) assert.equal(h.c.filter_enabled(name, enabled), enabled);
});

test('control activation follows manual toggles or the selected preset, including custom prices', () => {
  for (const filter of ['Manual', '● Weekly + Daily', '● ● ● Quarterly + Monthly', 'NY Early Only']) {
    const h = configured({ quickFilter: filter, dailyShow: true, quickPriceMode: 'Custom' });
    for (const key of ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'ny', 'rolling', 'nyEarly']) {
      const expected = h.c.filter_enabled(key === 'nyEarly' ? 'NY Early High' : h.c[key].name, key === 'daily');
      assert.equal(h.controls[`${key}Color`].active, expected, `${filter}/${key}`);
      assert.equal(h.controls[`${key}ShowPrice`].active, filter === 'Manual' || expected);
    }
  }
});

test('price Off/Active/Custom honors every anchor and never inherits another anchor toggle', () => {
  for (const mode of ['Off', 'Active', 'Custom']) for (const selected of [false, true]) {
    const h = configured({ quickPriceMode: mode, monthlyShowPrice: selected, nyEarlyShowPrice: selected });
    for (const key of anchorKeys) assert.equal(h.c[key].pricesEnabled, mode === 'Active' || (mode === 'Custom' && selected && ['monthly', 'nyEarlyHigh', 'nyEarlyLow'].includes(key)), `${mode}/${key}`);
  }
});

test('band and VWAP width choices parse all supported widths; Off suppresses the band', () => {
  const { c } = configured();
  for (let width = 1; width <= 5; width++) {
    assert.deepEqual(c.parse_band_choice(String(width)), [true, width]);
    assert.equal(c.parse_vwap_width(String(width)), width);
  }
  assert.deepEqual(c.parse_band_choice('Off'), [false, 1]);
});

test('merge presets preserve percentages and the one-tick minimum, including zero and negative prices', () => {
  for (const [preset, percent] of [['Strict', .005], ['Balanced', .01], ['Wide', .025], ['Custom', .037]]) {
    const h = configured({ labelMergePreset: preset, customLabelMergeDistancePercent: .037 });
    assert.equal(h.c.labelMergeDistancePercent, percent);
    for (const price of [0, .01, 100, 25000, -25000]) near(h.c.label_merge_tolerance(price), Math.max(.25, Math.abs(price) * percent / 100));
  }
});

test('Quarterly/Monthly 2sigma merged with thicker Daily 3sigma uses Quarterly color and normal size', () => {
  const h = configured();
  points(h.c.quarterly, 100, 2); points(h.c.monthly, 100, 2); points(h.c.daily, 98, 2);
  h.c.resolve_duplicate_display([h.c.quarterly, h.c.monthly, h.c.daily]);
  h.c.add_band_labels(h.c.quarterly, true, 2, h.c.quarterly.band2Color, 2);
  h.c.add_band_labels(h.c.daily, true, 3, h.c.daily.band3Color, 3);
  const rendered = flush(h, []);
  const merged = rendered.find(item => item.y === 104);
  assert.equal(merged.text, 'Quarterly • Monthly 2σ • Daily 3σ');
  assert.deepEqual(merged.textcolor, h.c.band_label_text_color(h.c.quarterly.band2Color));
  assert.equal(merged.size, 'normal');
});

test('timeframe priority wins all 27,300 pair/triple width and queue-order configurations', () => {
  const h = configured();
  let configurations = 0;
  function check(members, expected) {
    const best = members.reduce((winner, member, index) => winner < 0 || h.c.pending_label_precedes(member, index, members[winner], winner) ? index : winner, -1);
    assert.equal(members[best].identity, expected);
    configurations++;
  }
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) {
    for (let aw = 1; aw <= 5; aw++) for (let bw = 1; bw <= 5; bw++) {
      const pair = [pending(h, names[a], aw), pending(h, names[b], bw)];
      check(pair, names[a]); check(pair.toReversed(), names[a]);
    }
    for (let c = b + 1; c < 7; c++) for (let aw = 1; aw <= 5; aw++) for (let bw = 1; bw <= 5; bw++) for (let cw = 1; cw <= 5; cw++) {
      const triple = [pending(h, names[a], aw), pending(h, names[b], bw), pending(h, names[c], cw)];
      for (const order of [[0,1,2], [0,2,1], [1,0,2], [1,2,0], [2,0,1], [2,1,0]]) check(order.map(index => triple[index]), names[a]);
    }
  }
  assert.equal(configurations, 27300);
});

test('full label rendering retains winner color/size/position and independent numeric price selection', () => {
  const h = configured();
  const first = flush(h, [pending(h, 'Daily', 5, { price: 100.25, displayPrice: 101, showPrice: true }), pending(h, 'Quarterly', 1)])[0];
  assert.equal(first.y, 100);
  assert.equal(first.text, 'Quarterly • Daily • 101');
  assert.deepEqual(first.textcolor, h.c.quarterly.lineColor);
  assert.equal(first.size, 'normal');
  const second = flush(h, [pending(h, 'Daily', 5, { showPrice: true, displayPrice: 101 }), pending(h, 'Quarterly', 1, { showPrice: true, displayPrice: 102 })])[0];
  assert.equal(first.deleted, true);
  assert.equal(second.text, 'Quarterly • Daily • 102');
  assert.equal(h.c.pendingLabels.length, 0);
  flush(h, []);
  assert.equal(second.deleted, true);
  assert.equal(h.c.renderedLabels.length, 0);
});

test('merging disabled, distance boundaries, nearest cluster and non-transitive clusters', () => {
  const h = configured({ labelMergePreset: 'Custom', customLabelMergeDistancePercent: 0 });
  h.c.mergeOverlappingLabels = false;
  assert.equal(flush(h, [pending(h, 'Quarterly', 1), pending(h, 'Daily', 5)]).length, 2);
  h.c.mergeOverlappingLabels = true;
  assert.equal(flush(h, [pending(h, 'Quarterly', 1), pending(h, 'Daily', 5, { price: 100.25 })]).length, 1);
  assert.equal(flush(h, [pending(h, 'Quarterly', 1), pending(h, 'Daily', 5, { price: 100.5 })]).length, 2);
  assert.equal(h.c.nearest_label_cluster(100.2, [100, 100.25]), 1);
  assert.equal(flush(h, [pending(h, 'Daily', 5), pending(h, 'Monthly', 2, { price: 100.25 }), pending(h, 'Quarterly', 1, { price: 100.5 })]).length, 2);
});

test('same-priority bands and NY Early sides use width then stable queue order', () => {
  const h = configured();
  assert.equal(flush(h, [pending(h, 'Quarterly', 1, { identity: 'VWAP' }), pending(h, 'Quarterly', 5, { identity: '2σ' })])[0].text, '2σ • VWAP');
  assert.equal(flush(h, [pending(h, 'NY Early High', 2), pending(h, 'NY Early Low', 2)])[0].text, 'NY Early High • NY Early Low');
  assert.equal(flush(h, [pending(h, 'NY Early High', 1), pending(h, 'NY Early Low', 2)])[0].text, 'NY Early Low • NY Early High');
});

test('identical anchors collapse into higher timeframe and absorb only missing bands and requested price', () => {
  const h = configured({ quarterlyBand2Choice: 'Off', monthlyBand2Choice: '5', quickPriceMode: 'Custom', monthlyShowPrice: true });
  for (const key of ['quarterly', 'monthly', 'daily']) points(h.c[key]);
  h.c.resolve_duplicate_display([h.c.quarterly, h.c.monthly, h.c.daily]);
  assert.equal(h.c.quarterly.displayName, 'Quarterly • Monthly • Daily');
  assert.equal(h.c.monthly.drawVisible, false); assert.equal(h.c.daily.drawVisible, false);
  assert.equal(h.c.quarterly.band2Width, 5); assert.equal(h.c.quarterly.band3Width, 2);
  assert.equal(h.c.quarterly.pricesEnabled, true); assert.equal(h.c.quarterly.labelPricePriority, 5);
  assert.deepEqual(h.c.quarterly.lineColor, h.c.DEFAULT_QUARTERLY_COLOR);
});

test('start-of-week Weekly/Daily collapse survives arbitrary widths and resets identity when they diverge', () => {
  const h = configured({ weeklyVwapWidthChoice: '1', dailyVwapWidthChoice: '5' });
  points(h.c.weekly); points(h.c.daily);
  h.c.resolve_duplicate_display([h.c.weekly, h.c.daily]);
  assert.equal(h.c.weekly.displayName, 'Weekly • Daily');
  assert.equal(h.c.weekly.labelSize, 'small');
  h.c.daily.vwapValues[1] = 110;
  h.c.resolve_duplicate_display([h.c.weekly, h.c.daily]);
  assert.equal(h.c.weekly.displayName, 'Weekly'); assert.equal(h.c.daily.drawVisible, true);
});

test('disabled, empty, differently anchored or materially different VWAP states never collapse', () => {
  for (const overrides of [{ visible: false }, { barTimes: [] }, { barTimes: [0, 2000] }, { vwapValues: [100, 101] }, { stdevValues: [2, 3] }]) {
    const h = configured();
    const high = h.anchor('Quarterly', overrides), low = h.anchor('Monthly');
    h.c.resolve_duplicate_display([high, low]);
    assert.equal(high.displayName, 'Quarterly'); assert.equal(low.drawVisible, true);
  }
});

test('fill ownership draws once using higher color and widest enabled coincident range', () => {
  const h = configured();
  const high = h.anchor('Quarterly', { fillRange: h.c.FILL_RANGE_1_SIGMA });
  const low = h.anchor('Daily', { fillRange: h.c.FILL_RANGE_3_SIGMA });
  assert.equal(h.c.owned_fill_range(high, [high, low]), h.c.FILL_RANGE_3_SIGMA);
  assert.equal(h.c.owned_fill_range(low, [high, low]), h.c.FILL_RANGE_NONE);
  high.visible = false;
  assert.equal(h.c.owned_fill_range(low, [high, low]), h.c.FILL_RANGE_3_SIGMA);
  high.visible = true; high.fillRange = h.c.FILL_RANGE_NONE;
  assert.equal(h.c.owned_fill_range(low, [high, low]), h.c.FILL_RANGE_3_SIGMA);
  high.fillRange = h.c.FILL_RANGE_1_SIGMA; low.barTimes[1] = 3000;
  assert.equal(h.c.owned_fill_range(high, [high, low]), h.c.FILL_RANGE_1_SIGMA);
  h.c.showBands = false;
  assert.equal(h.c.owned_fill_range(high, [high, low]), h.c.FILL_RANGE_NONE);
});

test('band offsets and closed fill geometry retain both endpoints and correct transparency', () => {
  const h = configured();
  const times = [1, 2, 3], values = [100, 101, 102], deviations = [1, 2, 3];
  const line = h.c.build_offset_line(times, values, deviations, -2, h.c.DEFAULT_DAILY_COLOR, 5);
  assert.deepEqual(line.points, [{ time: 1, price: 98 }, { time: 2, price: 97 }, { time: 3, price: 96 }]);
  assert.equal(line.line_width, 5); assert.equal(line.xloc, 'bar_time');
  const fill = h.c.build_fill_band(times, values, deviations, 2, -2, h.c.DEFAULT_DAILY_COLOR, 97);
  assert.deepEqual(fill.points.map(point => point.price), [102, 105, 108, 96, 97, 98]);
  assert.equal(fill.closed, true); assert.equal(fill.fill_color.t, 97);
});

test('long histories subsample below TradingView point cap and retain newest endpoint', () => {
  const h = configured();
  for (const count of [2, 4499, 4500, 4501, 8999, 9000, 9001, 20001]) {
    const times = Array.from({ length: count }, (_, index) => index);
    const values = times.map(() => 100), deviations = times.map(() => 2);
    const line = h.c.build_offset_line(times, values, deviations, 1, h.c.DEFAULT_DAILY_COLOR, 1);
    const fill = h.c.build_fill_band(times, values, deviations, 1, -1, h.c.DEFAULT_DAILY_COLOR, 95);
    assert.ok(line.points.length <= 10000); assert.ok(fill.points.length <= 10000);
    assert.equal(line.points[0].time, 0); assert.equal(line.points.at(-1).time, count - 1);
    assert.ok(fill.points.some(point => point.time === count - 1));
  }
});

test('all band masks, fill selections and VWAP-only settings draw the expected objects', () => {
  const h = configured();
  for (let mask = 0; mask < 8; mask++) for (let fill = 0; fill <= 3; fill++) for (const showBands of [false, true]) {
    h.c.showBands = showBands;
    const anchor = h.anchor('Daily', { band1Enabled: !!(mask & 1), band2Enabled: !!(mask & 2), band3Enabled: !!(mask & 4) });
    const period = h.c.build_period(anchor, true, h.c.fill_range_for_rank(fill));
    const enabled = [1, 2, 4].filter(bit => mask & bit).length;
    assert.equal(period.polylines.filter(item => !item.closed).length, 1 + (showBands ? 2 * enabled : 0));
    assert.equal(period.polylines.filter(item => item.closed).length, showBands && fill > 0 ? 1 : 0);
  }
});

test('Show Last includes current period, deletes oldest drawings and clears archived samples', () => {
  const h = configured();
  for (const depth of [1, 2, 10]) {
    const anchor = h.anchor('Daily', { historyDepth: depth });
    const start = h.calls.polylines.length;
    for (let cycle = 0; cycle < 12; cycle++) { points(anchor); h.c.archive_period(anchor, h.c.FILL_RANGE_NONE); }
    assert.equal(anchor.history.length, depth - 1);
    assert.deepEqual(anchor.barTimes, []); assert.deepEqual(anchor.vwapValues, []); assert.deepEqual(anchor.stdevValues, []);
    const alive = h.calls.polylines.slice(start).filter(item => !item.deleted);
    assert.equal(alive.length, (depth - 1) * 5);
    h.c.trim_period_history(anchor, 0);
    assert.ok(alive.every(item => item.deleted));
  }
});

test('period rollover archives before adding first new sample and ignores invalid/nonaccumulating samples', () => {
  const h = configured();
  const anchor = h.anchor('Daily', { historyDepth: 2 });
  h.c.time = 3000;
  h.c.update_anchor(anchor, true, true, 200, 3, h.c.FILL_RANGE_NONE);
  assert.equal(anchor.history.length, 1); assert.deepEqual(anchor.barTimes, [3000]); assert.deepEqual(anchor.vwapValues, [200]);
  for (const [enabled, price, deviation] of [[false, 201, 2], [true, NaN, 2], [true, 200, NaN]]) h.c.update_anchor(anchor, enabled, false, price, deviation, h.c.FILL_RANGE_NONE);
  assert.equal(anchor.barTimes.length, 1);
  h.c.archive_period(anchor, h.c.FILL_RANGE_NONE);
  assert.equal(anchor.history.length, 1);
});

test('redrawing replaces current objects; VWAP-only suppresses band labels and fills', () => {
  const h = configured({ vwapLinesOnly: true });
  const anchor = h.anchor('Daily');
  h.c.draw_current_lines(anchor); h.c.draw_current_fill(anchor, h.c.FILL_RANGE_3_SIGMA);
  assert.equal(anchor.currentPeriod.polylines.length, 1); assert.equal(h.c.pendingLabels.length, 1);
  assert.equal(h.c.pendingLabels[0].identity, '★ Daily VWAP');
  const old = anchor.currentPeriod.polylines[0];
  h.c.reset_current_period(anchor);
  assert.equal(old.deleted, true); assert.equal(anchor.currentPeriod.polylines.length, 0);
  anchor.drawVisible = false; h.c.draw_current_lines(anchor);
  assert.equal(anchor.currentPeriod.polylines.length, 0);
});

test('NY Early volume-weighted mean and deviation match an independently calculated sample set', () => {
  const h = configured();
  const avwap = h.c.new_continuing_avwap(1);
  const samples = [[100, 1], [104, 3], [99, 2], [106, 4]];
  for (const [index, [price, volume]] of samples.entries()) h.c.append_continuing_sample(avwap, index, price, volume);
  const total = samples.reduce((sum, [, volume]) => sum + volume, 0);
  const mean = samples.reduce((sum, [price, volume]) => sum + price * volume, 0) / total;
  const variance = samples.reduce((sum, [price, volume]) => sum + (price - mean) ** 2 * volume, 0) / total;
  near(avwap.vwapValues.at(-1), mean); near(avwap.stdevValues.at(-1), Math.sqrt(variance));
  for (const [price, volume] of [[NaN, 1], [100, NaN], [100, 0], [100, -1]]) h.c.append_continuing_sample(avwap, 99, price, volume);
  assert.equal(avwap.barTimes.length, 4);
});

test('NY Early high/low origins restart only on a new extreme, preserving first equal extreme', () => {
  for (const seekHigh of [false, true]) {
    const h = configured(); const avwaps = [];
    h.c.start_continuing_session(avwaps, 1, 3);
    h.c.update_continuing_origin(avwaps, 100, seekHigh); h.c.append_continuing_set(avwaps, 1, 100, 1);
    h.c.update_continuing_origin(avwaps, 100, seekHigh); h.c.append_continuing_set(avwaps, 2, 101, 1);
    assert.deepEqual(avwaps[0].barTimes, [1, 2]);
    h.c.update_continuing_origin(avwaps, seekHigh ? 99 : 101, seekHigh);
    assert.deepEqual(avwaps[0].barTimes, [1, 2]);
    h.c.update_continuing_origin(avwaps, seekHigh ? 102 : 98, seekHigh);
    assert.deepEqual(avwaps[0].barTimes, []); assert.equal(avwaps[0].sumVolume, 0);
    h.c.append_continuing_set(avwaps, 3, 102, 2);
    assert.deepEqual(avwaps[0].barTimes, [3]);
  }
});

test('NY Early selects prior locked sessions only, skips no-trade dates, retains requested history and binds buffers', () => {
  const h = configured(); const avwaps = [];
  for (const day of [1, 2, 5, 6]) {
    h.c.start_continuing_session(avwaps, day, 3);
    h.c.update_continuing_origin(avwaps, 100, true); h.c.append_continuing_set(avwaps, day, 100, 1);
    if (day !== 6) h.c.lock_continuing_session(avwaps);
  }
  assert.deepEqual(avwaps.map(item => item.sessionDay), [2, 5, 6]);
  assert.equal(h.c.selected_prior_avwap_index(avwaps, 1, 6), 1);
  assert.equal(h.c.selected_prior_avwap_index(avwaps, 2, 6), 0);
  assert.equal(h.c.selected_prior_avwap_index(avwaps, 3, 6), -1);
  assert.equal(h.c.selected_prior_avwap_index([], 1, 6), -1);
  const anchor = h.anchor('NY Early High'); h.c.bind_continuing_avwap(anchor, avwaps[1]);
  assert.equal(anchor.barTimes, avwaps[1].barTimes); assert.equal(anchor.vwapValues, avwaps[1].vwapValues);
  h.c.append_continuing_set(avwaps, 7, 110, 1);
  assert.equal(anchor.barTimes.at(-1), 7);
});

test('band transparency and label contrast preserve configured RGB and clamp text transparency', () => {
  const h = configured();
  for (const [multiplier, transparency] of [[1, 53], [2, 59], [3, 18]]) assert.equal(h.c.band_transparency_for_multiplier(multiplier), transparency);
  for (const [transparency, expected] of [[0, 0], [18, 0], [53, 0], [59, 4], [100, 12]]) {
    assert.deepEqual(h.c.band_label_text_color({ r: 1, g: 2, b: 3, t: transparency }), { r: 1, g: 2, b: 3, t: expected });
  }
});

test('reference row allocation matches actual rows for every visibility/band combination', () => {
  const h = configured();
  for (const visible of [false, true]) for (const bands of [false, true]) for (let mask = 0; mask < 8; mask++) {
    h.c.showBands = bands;
    const anchor = h.anchor('Daily', { band1Enabled: !!(mask & 1), band2Enabled: !!(mask & 2), band3Enabled: !!(mask & 4) });
    const rows = h.c.count_visible_rows(visible, anchor);
    const tbl = h.c.table.new('top_right', 6, 1 + rows, {});
    assert.equal(h.c.add_anchor_rows(tbl, 1, 'Daily', visible, anchor), 1 + rows);
    assert.equal(tbl.cells.size, rows * 6);
    if (visible) assert.equal(tbl.cells.get('1,1').text, 'R:255 G:167 B:38');
  }
});

test('Daily holiday-safe resets use the 18:00 NY reopen; opt-out uses TradingView daily change', () => {
  for (const skip of [false, true]) {
    const h = calendar(configured({ dailySkipHolidayResets: skip }));
    h.c.changes = { D: true };
    signals(h, '2026-10-13T12:00:00-04:00', '2026-10-13T11:55:00-04:00');
    assert.equal(h.c.dailyChange, !skip);
    h.c.changes = {};
    signals(h, '2026-10-13T18:00:00-04:00', '2026-10-13T16:55:00-04:00');
    assert.equal(h.c.dailyChange, skip);
    h.c.previous.inDailyReopen = true;
    signals(h, '2026-10-13T18:05:00-04:00', '2026-10-13T18:00:00-04:00');
    assert.equal(h.c.dailyChange, false);
  }
});

test('Weekly holiday-safe resets require Sunday reopen; opt-out follows TradingView weekly change', () => {
  for (const skip of [false, true]) {
    const h = calendar(configured({ weeklySkipHolidayResets: skip }));
    signals(h, '2026-10-11T18:00:00-04:00', '2026-10-09T16:55:00-04:00');
    assert.equal(h.c.weeklyChange, skip);
    signals(h, '2026-10-12T18:00:00-04:00', '2026-10-12T16:55:00-04:00');
    assert.equal(h.c.weeklyChange, false);
    h.c.changes = { W: true };
    signals(h, '2026-10-16T12:00:00-04:00', '2026-10-16T11:55:00-04:00');
    assert.equal(h.c.weeklyChange, !skip);
  }
});

test('NY session boundaries include 09:30, exclude 16:00, and reset once per opening', () => {
  const h = calendar(configured());
  for (const [clock, inside, opened] of [['09:29', false, false], ['09:30', true, true], ['09:35', true, false], ['15:59', true, false], ['16:00', false, false]]) {
    signals(h, `2026-10-13T${clock}:00-04:00`);
    assert.equal(h.c.inNYSession, inside, clock); assert.equal(h.c.nyOpen, opened, clock);
    h.c.previous.inNYSession = inside;
  }
});

test('NY extension reaches 18:00 NY across winter/summer time and excludes later bars', () => {
  const h = calendar(configured());
  for (const [day, offset] of [['2026-01-13', '-05:00'], ['2026-07-13', '-04:00'], ['2026-11-02', '-05:00']]) {
    const opened = Date.parse(`${day}T09:30:00${offset}`);
    const cutoff = h.c.extension_cutoff(h.c.EXT_TO_NEXT_OPEN, opened);
    assert.equal(cutoff, Date.parse(`${day}T18:00:00${offset}`));
    assert.ok(Number.isNaN(h.c.extension_cutoff(h.c.EXT_SESSION_ONLY, opened)));
    h.c.time = cutoff; assert.equal(h.c.within_extension(cutoff), true);
    h.c.time = cutoff + 1; assert.equal(h.c.within_extension(cutoff), false);
    assert.equal(h.c.within_extension(NaN), false);
  }
  const late = Date.parse('2026-10-13T19:00:00-04:00');
  assert.equal(h.c.extension_cutoff(h.c.EXT_TO_NEXT_OPEN, late), Date.parse('2026-10-14T18:00:00-04:00'));
  for (const shown of [false, true]) for (const inSession of [false, true]) {
    h.c.nyShown = shown; h.c.inNYSession = inSession; h.c.nyExtensionCutoff = NaN;
    assert.equal(h.assignment('nyAccumulating'), shown && inSession);
  }
});

test('each calendar VWAP uses its own fixed call site, reset signal and one-sigma difference', () => {
  const h = configured(); h.c.hlc3 = 123;
  for (const [name, flag] of [['daily', 'dailyChange'], ['weekly', 'weeklyChange'], ['monthly', 'monthChange'], ['quarterly', 'quarterChange'], ['yearly', 'yearChange'], ['ny', 'nyOpen']]) {
    for (const reset of [false, true]) for (const priorMissing of [false, true]) {
      h.c[flag] = reset; h.c.previous.hlc3 = priorMissing ? NaN : 122;
      assert.deepEqual(h.c[`vwap_${name}`](), [100, 2]);
      assert.deepEqual(h.calls.vwap.at(-1), [123, reset || priorMissing, 1]);
    }
    assert.equal((h.body(`vwap_${name}`).match(/ta\.vwap\(/g) ?? []).length, 1);
    assert.match(source, new RegExp(`^\\[${name}Vwap,\\s*${name}Stdev\\]\\s*= vwap_${name}\\(\\)$`, 'm'));
  }
});

test('month/quarter/year change signals remain separate and use their exact calendar periods', () => {
  const h = calendar(configured());
  for (const unit of ['D', 'W', 'M', '3M', '12M']) {
    h.c.changes = { [unit]: true }; signals(h, '2026-10-13T12:00:00-04:00');
    for (const [key, expectedUnit] of [['dayChange', 'D'], ['weekChange', 'W'], ['monthChange', 'M'], ['quarterChange', '3M'], ['yearChange', '12M']]) assert.equal(h.c[key], unit === expectedUnit, key);
  }
});

test('host update wiring passes each calendar anchor its own visibility, reset, VWAP and deviation', () => {
  const h = calendar(configured({ quickFilter: 'Manual', dailyShow: true, weeklyShow: true, monthlyShow: true, quarterlyShow: true, yearlyShow: true, nyShow: true }));
  signals(h, '2026-10-13T10:00:00-04:00');
  h.c.nyExtensionCutoff = NaN;
  h.globals(section(source, 'dailyEnabled        =', 'nyEarlyTimeframeAllowed ='));
  Object.assign(h.c, { nyEarlyHighShown: false, nyEarlyLowShown: false });
  h.globals(section(source, 'daily.visible     :=', 'dailyArchiveFillRange'));
  const contexts = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'ny'];
  const resets = ['dailyChange', 'weeklyChange', 'monthChange', 'quarterChange', 'yearChange', 'nyOpen'];
  contexts.forEach((key, index) => { h.c[`${key}Vwap`] = 100 + index; h.c[`${key}Stdev`] = 1 + index; });
  for (let enabledReset = 0; enabledReset < contexts.length; enabledReset++) {
    resets.forEach((key, index) => { h.c[key] = index === enabledReset; });
    const received = [];
    h.c.update_anchor = (...args) => { received.push(args); };
    h.globals(section(source, 'dailyArchiveFillRange', '// ROLLING VWAP'));
    assert.equal(received.length, contexts.length);
    received.forEach(([anchor, accumulating, reset, value, deviation], index) => {
      assert.equal(anchor, h.c[contexts[index]]); assert.equal(accumulating, true);
      assert.equal(reset, index === enabledReset); assert.equal(value, 100 + index); assert.equal(deviation, 1 + index);
    });
  }
});

test('anchor visibility respects exact timeframe boundaries and disabled state; Rolling includes daily', () => {
  const h = calendar(configured()); signals(h, '2026-10-13T12:00:00-04:00');
  const limits = { daily: 86400, weekly: 604800, monthly: 2629800, quarterly: 7889400, yearly: 31557600, ny: 86400, rolling: 86400 };
  for (const [key, limit] of Object.entries(limits)) for (const enabled of [false, true]) for (const seconds of [300, limit - 1, limit, limit + 1, NaN]) {
    h.c[`${key}Enabled`] = enabled; h.c.chartSecs = seconds;
    assert.equal(h.assignment(`${key}Shown`), enabled && (key === 'rolling' ? seconds <= limit : seconds < limit), `${key}/${seconds}`);
  }
  for (const range of [false, true]) for (const seconds of [300, 86400, NaN]) {
    h.c.chart.is_range = range; h.c.chartSecs = seconds;
    assert.equal(h.assignment('nyEarlyTimeframeAllowed'), range || seconds < 86400);
  }
});

test('NY Early windows, side selection, display names and prior-session retention follow settings', () => {
  for (const extended of [false, true]) for (const side of ['High', 'Low']) {
    const h = calendar(configured({ nyEarlyWindow: extended ? '06:00–09:30' : '06:00–09:00', nyEarlyAnchorSide: side, nyEarlyAnchorFrom: 10 }));
    Object.assign(h.c, { nyEarlyEnabled: true, chartSecs: 300 });
    for (const [clock, minute] of [['05:59', 359], ['06:00', 360], ['08:59', 539], ['09:00', 540], ['09:29', 569], ['09:30', 570]]) {
      h.c.time = Date.parse(`2026-10-13T${clock}:00-04:00`);
      h.globals(section(source, 'nyEarlyTimeframeAllowed =', 'if nyEarlyWindowStart'));
      assert.equal(h.c.nyEarlyInWindow, minute >= 360 && minute < (extended ? 570 : 540), clock);
      assert.equal(h.c.nyEarlyHighRequested, side === 'High'); assert.equal(h.c.nyEarlyLowRequested, side === 'Low');
      assert.equal(h.c.nyEarlyOriginRetention, 11);
    }
    assert.equal(h.c.nyEarlyHigh.name, `${extended ? 'Extended NY Early' : 'NY Early'} High`);
    h.c.nyEarlyEnabled = false;
    h.assignment('nyEarlyInWindow'); assert.equal(h.c.nyEarlyInWindow, false);
  }
});

test('NY Early actual window pipeline locks yesterday, continues accumulation and selects its exact extreme', () => {
  const h = calendar(configured({ nyEarlyAnchorSide: 'High' }));
  Object.assign(h.c, { nyEarlyEnabled: true, chartSecs: 300 });
  const advance = (date, high, price) => {
    Object.assign(h.c, { time: Date.parse(date), high, low: high - 5, hlc3: price, volume: 1 });
    h.globals(section(source, 'nyEarlyTimeframeAllowed =', 'if nyEarlyWindowStart'));
    h.run(section(source, 'if nyEarlyWindowStart', 'int currentNySessionDay'));
    h.globals(section(source, 'int currentNySessionDay', 'if selectedHighAvwapIndex'));
    h.run(section(source, 'if selectedHighAvwapIndex', 'nyEarlyHighShown ='));
    h.assignment('nyEarlyHighShown'); h.assignment('nyEarlyLowShown');
    h.c.previous.nyEarlyInWindow = h.c.nyEarlyInWindow;
  };
  advance('2026-10-12T06:00:00-04:00', 105, 100);
  advance('2026-10-12T07:00:00-04:00', 110, 105);
  advance('2026-10-12T08:00:00-04:00', 110, 106);
  advance('2026-10-12T09:00:00-04:00', 120, 108);
  assert.equal(h.c.nyEarlyHighShown, false);
  assert.equal(h.c.nyEarlyHighAvwaps[0].originLevel, 110);
  assert.equal(h.c.nyEarlyHighAvwaps[0].locked, true);
  advance('2026-10-13T06:00:00-04:00', 130, 112);
  assert.equal(h.c.nyEarlyHighShown, true); assert.equal(h.c.nyEarlyLowShown, false);
  assert.equal(h.c.nyEarlyHigh.barTimes[0], Date.parse('2026-10-12T07:00:00-04:00'));
  near(h.c.nyEarlyHigh.vwapValues.at(-1), (105 + 106 + 108 + 112) / 4);
  assert.equal(h.c.nyEarlyHighAvwaps.length, 2);
});

test('Rolling VWAP evicts whole printed sessions and matches independent weighted mean/deviation', () => {
  const h = calendar(configured({ rollingSessions: 2 }));
  h.c.rollingShown = true;
  const block = section(source, 'if rollingShown and barstate.isconfirmed', 'if barstate.islast\n');
  const observations = [];
  for (const [date, price, volume] of [['2026-10-09T10:00:00-04:00', 100, 1], ['2026-10-09T11:00:00-04:00', 102, 3], ['2026-10-12T10:00:00-04:00', 110, 2], ['2026-10-12T11:00:00-04:00', 114, 4], ['2026-10-13T10:00:00-04:00', 120, 3]]) {
    Object.assign(h.c, { time: Date.parse(date), hlc3: price, volume });
    h.assignment('tradingSessionOpen'); h.run(block); h.c.previous.time = h.c.time;
    observations.push({ day: date.slice(0, 10), time: h.c.time, price, volume });
    const days = [...new Set(observations.map(item => item.day))].slice(-2);
    const kept = observations.filter(item => days.includes(item.day));
    const total = kept.reduce((sum, item) => sum + item.volume, 0);
    const mean = kept.reduce((sum, item) => sum + item.price * item.volume, 0) / total;
    const variance = kept.reduce((sum, item) => sum + item.volume * (item.price - mean) ** 2, 0) / total;
    near(h.c.rolling.vwapValues.at(-1), mean); near(h.c.rolling.stdevValues.at(-1), Math.sqrt(variance));
    assert.deepEqual(h.c.rolling.barTimes, kept.map(item => item.time));
    assert.equal(h.c.rollPV.length, kept.length); assert.equal(h.c.rollVol.length, kept.length); assert.equal(h.c.rollP2V.length, kept.length);
  }
  assert.equal(h.c.rollSessionStarts.length, 2);
  const before = structuredClone(h.c.rolling.barTimes);
  for (const state of [{ rollingShown: false, confirmed: true, price: 123, volume: 1 }, { rollingShown: true, confirmed: false, price: 123, volume: 1 }, { rollingShown: true, confirmed: true, price: NaN, volume: 1 }, { rollingShown: true, confirmed: true, price: 123, volume: NaN }]) {
    Object.assign(h.c, { rollingShown: state.rollingShown, hlc3: state.price, volume: state.volume }); h.c.barstate.isconfirmed = state.confirmed;
    h.run(block); assert.deepEqual(h.c.rolling.barTimes, before);
  }
});

test('Rolling counts weekend sessions on 24/7 assets and handles zero cumulative volume', () => {
  const h = calendar(configured({ rollingSessions: 2 })); h.c.rollingShown = true;
  const block = section(source, 'if rollingShown and barstate.isconfirmed', 'if barstate.islast\n');
  for (const day of [9, 10, 11]) {
    Object.assign(h.c, { time: Date.parse(`2026-10-${day.toString().padStart(2, '0')}T12:00:00-04:00`), hlc3: 100, volume: 0 });
    h.assignment('tradingSessionOpen'); h.run(block); h.c.previous.time = h.c.time;
  }
  assert.equal(h.c.rollSessionStarts.length, 2);
  assert.equal(h.c.rolling.barTimes.length, 2);
  assert.ok(Number.isNaN(h.c.rolling.vwapValues.at(-1)));
});

test('Show Only respects all NY windows, midnight, one-hour/Range gates and Most Recent Only', () => {
  const h = calendar(configured({ showOnlyEnabled: true }));
  h.c.last_bar_time = Date.parse('2026-10-13T15:00:00-04:00');
  for (const [window, start, end] of [['Overnight', 960, 300], ['● ● RTH', 300, 960], ['● RTH', 510, 960], ['RTH', 570, 960]]) {
    h.c.visibleWindow = window; h.assignment('activeShowOnlySession');
    for (const minute of [0, 299, 300, 509, 510, 569, 570, 959, 960, 1439]) {
      h.c.time = Date.parse(`2026-10-13T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00-04:00`);
      h.assignment('showOnlyTimeframeAllowed'); h.assignment('showOnlyInVisibleWindow');
      h.c.showOnlyInMostRecentDay = true;
      const inside = start > end ? minute >= start || minute < end : minute >= start && minute < end;
      assert.equal(h.assignment('hideThisBar'), !inside, `${window}/${minute}`);
    }
  }
  h.c.visibleWindow = 'RTH'; h.assignment('activeShowOnlySession');
  for (const range of [false, true]) for (const period of ['60', '61', '240']) {
    h.c.chart.is_range = range; h.c.timeframe.period = period;
    assert.equal(h.assignment('showOnlyTimeframeAllowed'), range || Number(period) <= 60);
  }
  h.c.chart.is_range = true; h.c.showOnlyMostRecent = true;
  h.c.time = Date.parse('2026-10-12T12:00:00-04:00');
  h.run(section(source, 'showOnlyTimeframeAllowed =', 'plotcandle(').replace('hideThisBar =', 'hideThisBar :='));
  assert.equal(h.c.hideThisBar, true);
  h.c.showOnlyEnabled = false; assert.equal(h.assignment('hideThisBar'), false);
});

test('reference table integrates duplicate visibility, NY Early selection, Show Only and VWAP-only rows', () => {
  const h = configured({ showTable: true });
  for (const key of anchorKeys) { points(h.c[key]); h.c[key].drawVisible = true; h.c[key].displayName = h.c[key].name; }
  Object.assign(h.c, { nyEarlyHighRequested: true, nyEarlyLowRequested: false, nyEarlyTimeframeAllowed: true, showOnlyEnabled: true, showOnlyTimeframeAllowed: true });
  h.c.monthly.drawVisible = false;
  const block = section(source, 'if showTable and barstate.islast', '// elderwand •');
  h.run(block);
  const tbl = h.calls.tables.at(-1);
  assert.equal(tbl.cells.size, tbl.rows * 6);
  const labels = [...tbl.cells.entries()].filter(([key]) => key.startsWith('0,')).map(([, cell]) => cell.text);
  assert.equal(labels[0], 'Setting'); assert.equal(labels.at(-1), 'Hidden Candles');
  assert.ok(!labels.some(label => label.startsWith('Monthly') || label.startsWith('NY Early Low')));
  h.c.showBands = false; h.c.showOnlyEnabled = false; h.run(block);
  const compact = h.calls.tables.at(-1);
  assert.equal(compact.rows, 8); assert.equal(compact.cells.size, compact.rows * 6);
  h.c.showTable = false; const count = h.calls.tables.length; h.run(block); assert.equal(h.calls.tables.length, count);
});

test('volume guard raises only on last bar with zero cumulative volume', () => {
  const h = configured(); h.c.runtime = { error: message => { throw new Error(message); } };
  const block = section(source, 'if barstate.islast and cumulativeVolume', '// ANCHOR SIGNALS');
  for (const last of [false, true]) for (const volume of [0, 100]) {
    h.c.barstate.islast = last; h.c.cumulativeVolume = volume;
    if (last && volume === 0) assert.throws(() => h.run(block), /No volume is provided/);
    else assert.doesNotThrow(() => h.run(block));
  }
});

test('input defaults and constrained dropdowns retain the current product configuration', () => {
  const h = configured();
  assert.equal(h.c.quickFilter, '● Weekly + Daily'); assert.equal(h.c.quickPriceMode, 'Off');
  assert.equal(h.c.mergeOverlappingLabels, true); assert.equal(h.c.labelMergePreset, 'Wide');
  assert.equal(h.c.vwapLinesOnly, false); assert.equal(h.c.showOnlyEnabled, false); assert.equal(h.c.showTable, false);
  assert.equal(h.c.rollingSessions, 14); assert.equal(h.c.nyEarlyAnchorFrom, 1); assert.equal(h.c.nyEarlyAnchorSide, 'High');
  for (const [name, control] of Object.entries(h.controls)) {
    if (name.endsWith('VwapWidthChoice')) assert.deepEqual(control.options, ['1', '2', '3', '4', '5']);
    if (/Band[123]Choice$/.test(name)) assert.deepEqual(control.options, ['Off', '1', '2', '3', '4', '5']);
    if (name.endsWith('ShowLast') || name === 'nyEarlyAnchorFrom') assert.deepEqual(control.options, [1,2,3,4,5,6,7,8,9,10]);
  }
});

test('current drawing pipeline resolves duplicates, fills before lines, then flushes labels only on last bar', () => {
  const h = configured(); const events = [];
  for (const key of anchorKeys) points(h.c[key]);
  for (const name of ['resolve_duplicate_display', 'reset_current_period', 'draw_current_fill', 'draw_current_lines', 'flush_pending_labels']) {
    const implementation = h.c[name];
    h.c[name] = (...args) => { events.push([name, args[0]?.name]); return implementation(...args); };
  }
  const block = section(source, 'if barstate.islast\n', 'showOnlyTimeframeAllowed =');
  h.run(block);
  assert.equal(events[0][0], 'resolve_duplicate_display'); assert.equal(events.at(-1)[0], 'flush_pending_labels');
  assert.ok(events.findLastIndex(([name]) => name === 'draw_current_fill') < events.findIndex(([name]) => name === 'draw_current_lines'));
  assert.deepEqual(events.filter(([name]) => name === 'draw_current_lines').map(([, name]) => name), names.toReversed());
  h.c.barstate.islast = false; events.length = 0; h.run(block); assert.deepEqual(events, []);
});

test('Pine functions remain defined before use and all source helpers are recognized by the adapter', () => {
  const h = configured();
  const stripped = source.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/\/\/[^\n]*/g, '');
  for (const name of h.functionNames) {
    const firstCall = stripped.search(new RegExp(`(?<![\\w.])${name}\\(`));
    const definition = stripped.search(new RegExp(`^${name}\\(.*=>`, 'm'));
    assert.equal(firstCall, definition, name);
  }
  assert.equal(h.functionNames.length, (source.match(/^\w+\(.*=>$/gm) ?? []).length);
});

const mutations = [
  {
    name: 'width-first merge regression',
    from: 'candidate.priority > current.priority or (candidate.priority == current.priority and (candidate.lineWidth > current.lineWidth or (candidate.lineWidth == current.lineWidth and candidateOrder < currentOrder)))',
    to: 'candidate.lineWidth > current.lineWidth or (candidate.lineWidth == current.lineWidth and (candidate.priority > current.priority or (candidate.priority == current.priority and candidateOrder < currentOrder)))',
    verify: h => {
      const result = flush(h, [pending(h, 'Daily', 5), pending(h, 'Quarterly', 1)])[0];
      assert.equal(result.size, 'normal'); assert.deepEqual(result.textcolor, h.c.quarterly.lineColor);
    },
  },
  {
    name: 'wrong rendered size even when priority is correct', from: 'size=carrier.labelSize', to: 'size=size.tiny',
    verify: h => assert.equal(flush(h, [pending(h, 'Quarterly', 1)])[0].size, 'normal'),
  },
  {
    name: 'fill range shrinks to narrower coincident anchor', from: 'math.max(widestRank, fill_rank(other.fillRange))', to: 'math.min(widestRank, fill_rank(other.fillRange))',
    verify: h => {
      const high = h.anchor('Quarterly', { fillRange: h.c.FILL_RANGE_1_SIGMA }), low = h.anchor('Daily', { fillRange: h.c.FILL_RANGE_3_SIGMA });
      assert.equal(h.c.owned_fill_range(high, [high, low]), h.c.FILL_RANGE_3_SIGMA);
    },
  },
  {
    name: 'Show Last retains one extra completed period', from: 'anchor.historyDepth - 1', to: 'anchor.historyDepth',
    verify: h => { const anchor = h.anchor('Daily'); h.c.archive_period(anchor, h.c.FILL_RANGE_NONE); assert.equal(anchor.history.length, 0); },
  },
  {
    name: 'equal NY Early extreme moves origin to later bar', from: 'candidateLevel > currentAvwap.originLevel', to: 'candidateLevel >= currentAvwap.originLevel',
    verify: h => {
      const avwaps = []; h.c.start_continuing_session(avwaps, 1, 2); h.c.update_continuing_origin(avwaps, 100, true);
      h.c.append_continuing_set(avwaps, 1, 99, 1); h.c.update_continuing_origin(avwaps, 100, true);
      assert.deepEqual(avwaps[0].barTimes, [1]);
    },
  },
  {
    name: 'rolling eviction adds expired volume', from: 'rollSumVol -= array.shift(rollVol)', to: 'rollSumVol += array.shift(rollVol)',
    verify: h => {
      h.c.rollingShown = true; h.c.rollingSessions = 2; h.c.tradingSessionOpen = true; h.c.volume = 1;
      for (const [time, price] of [[1, 100], [2, 200], [3, 300]]) {
        h.c.time = time; h.c.hlc3 = price;
        h.run(section(h.pine, 'if rollingShown and barstate.isconfirmed', 'if barstate.islast\n'));
      }
      assert.equal(h.c.rolling.vwapValues.at(-1), 250);
    },
  },
  {
    name: 'Weekly/Daily preset loses Daily', from: 'FILTER_WEEKLY_DAILY           => name == NAME_DAILY or name == NAME_WEEKLY', to: 'FILTER_WEEKLY_DAILY           => name == NAME_WEEKLY',
    verify: h => assert.equal(h.c.filter_enabled('Daily', false), true),
  },
  {
    name: 'VWAP-only leaks band labels', from: 'showBands = not vwapLinesOnly', to: 'showBands = true',
    verify: h => {
      h.c.vwapLinesOnly = true; h.assignment('showBands');
      const anchor = h.anchor('Daily'); h.c.draw_current_lines(anchor);
      assert.equal(h.c.pendingLabels.length, 1);
    },
  },
];
for (const mutation of mutations) test(`regression sensitivity: detects ${mutation.name}`, () => {
  assert.equal(source.split(mutation.from).length - 1, 1, `mutation target must occur exactly once: ${mutation.name}`);
  mutation.verify(configured());
  const broken = configured({}, source.replace(mutation.from, mutation.to));
  assert.throws(() => mutation.verify(broken), assert.AssertionError);
});

after(() => {
  const missing = createHarness().functionNames.filter(name => !executedFunctions.has(name));
  assert.deepEqual(missing, [], 'Every Elderwand helper must have an exercised scenario; new helpers require coverage.');
});
