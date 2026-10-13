import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadIndicator, loadLibraryFolder, runIndicator } from '../../../tests/runtime/run.mjs';
import { cmeMarket, nyTime, formatNy } from '../../../tests/runtime/scenario.mjs';

// Runs legilimens.pine with its local libraries bar by bar on synthetic NQ data and checks what
// the chart would show. These pin approved behavior; they do not prove TradingView compilation
// or rendering. Volume-profile levels are rebuilt independently from the one-minute candles.
//
// Not covered here: IVB titles (being renamed), Range-chart profile prices and Range-chart
// Bar Replay.

const code = new URL('../code/', import.meta.url).pathname;
const library = name => `${code}libraries/legilimens-${name}-library.pine`;
const program = loadIndicator(`${code}legilimens.pine`, {
  libraries: loadLibraryFolder([library('profile'), library('profile-orchestration'), library('presentation')]),
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const TICK = 0.25;
const PROFILE_ROWS = 400;
// Five weeks of history keeps runs fast while still holding 20+ RTH sessions.
const market = cmeMarket({ start: nyTime(2026, 9, 6, 18) });
// 1m charts read 1-second intrabars; a short market keeps the cut seconds tape small.
const minuteMarket = cmeMarket({ start: nyTime(2026, 10, 6, 18) });
const SECOND = 1000;

// Thursday 8 October 2026 is the test day.
const day = (hour, minute = 0, date = 8) => nyTime(2026, 10, date, hour, minute);
const AT = day(10, 30);

// Identical scenarios share one run.
const runs = new Map();
function legilimens({ at = AT, chart = '15', mode = 'live', hoursOfChart = 30, inputs = {} } = {}) {
  const key = JSON.stringify({ at, chart, mode, hoursOfChart, inputs });
  if (!runs.has(key)) {
    const chartSpec = chart.startsWith('R') ? { type: 'range', size: Number(chart.slice(1)) * TICK } : { type: 'time', tf: chart };
    runs.set(key, runIndicator(program, { market: chart === '1' ? minuteMarket : market, chart: chartSpec, from: at - hoursOfChart * HOUR, until: at, mode, inputs }));
  }
  return runs.get(key);
}

// Profile menu entries are looked up by emoji so a title rename does not break the scenario.
const profileOptions = legilimens({ hoursOfChart: 1 }).inputs.get('anchorMode').options;
const profileMode = emoji => profileOptions.find(option => option.startsWith(emoji));
const RTH = profileMode('🗽');
const IVB = profileMode('🏄');
const NY_EARLY = profileMode('🌄');
const NY_AFTERNOON = profileMode('☀️');

const ny = time => formatNy(time).slice(11, 16);
const span = object => `${formatNy(object.left)} → ${formatNy(object.right)}`;
const isBuyColor = color => color.g > color.r;
const sameColor = (a, b) => a && b && a.r === b.r && a.g === b.g && a.b === b.b && a.t === b.t;

// Inner profile frame colors from the presentation library: they mark each session's own box.
const INNER_FRAME = {
  rth: { r: 144, g: 191, b: 249, t: 30 },
  ivb: { r: 249, g: 121, b: 246, t: 55 },
  nyEarly: { r: 128, g: 222, b: 234, t: 50 },
  fixed: { r: 187, g: 217, b: 251, t: 30 },
};
const OUTER_FRAME = {
  rth: { r: 41, g: 98, b: 255, t: 90 },
  nyEarly: { r: 128, g: 222, b: 234, t: 94 },
};
const innerFrames = (result, palette) => result.live('box').filter(box => sameColor(box.border_color, INNER_FRAME[palette])).sort((a, b) => a.left - b.left);
const outerFrames = (result, palette) => result.live('box').filter(box => sameColor(box.border_color, OUTER_FRAME[palette])).sort((a, b) => a.left - b.left);
const headings = (result, title) => result.live('label').filter(label => label.text === title);

// One-minute candles whose whole minute sits inside [start, end).
const candlesIn = (start, end) => market.candles.filter(candle => candle.time >= start && candle.time + MINUTE <= end);
const secondsIn = (start, end) => minuteMarket.secondCandles('1S').filter(sample => sample.time >= start && sample.time + SECOND <= end);
const sessionHigh = candles => Math.max(...candles.map(candle => candle.high));
const sessionLow = candles => Math.min(...candles.map(candle => candle.low));

// Same tape rule as the indicator: candle direction, then the change from the previous close,
// then the last known direction. The tape starts with the chart's first candle.
function tapeDeltas(from, until, tape = market.candles) {
  const deltas = new Map();
  let lastDirection = 1;
  let previousClose = null;
  for (const candle of tape) {
    if (candle.time < from) continue;
    if (candle.time >= until) break;
    let direction = candle.close > candle.open ? 1 : candle.close < candle.open ? -1 : lastDirection;
    if (candle.close === candle.open && previousClose !== null && candle.close !== previousClose) direction = candle.close > previousClose ? 1 : -1;
    lastDirection = direction;
    previousClose = candle.close;
    deltas.set(candle.time, candle.volume * direction);
  }
  return deltas;
}

// Independent volume profile: tick rows when the range fits 400 rows, otherwise 400 equal rows,
// each candle's volume and delta spread evenly over the rows its high-low covers.
function referenceProfile(candles, deltas) {
  const rawHigh = sessionHigh(candles);
  const rawLow = sessionLow(candles);
  const tickRows = Math.round((rawHigh - rawLow) / TICK) + 1;
  const tickGranular = tickRows <= PROFILE_ROWS;
  const rowCount = tickGranular ? tickRows : PROFILE_ROWS;
  const priceLow = tickGranular ? Math.round(rawLow / TICK) * TICK - TICK / 2 : rawLow;
  const rowHeight = tickGranular ? TICK : Math.max(rawHigh - rawLow, TICK * rowCount) / rowCount;
  const volumes = new Array(rowCount).fill(0);
  const rowDeltas = new Array(rowCount).fill(0);
  const row = price => Math.max(0, Math.min(rowCount - 1, Math.floor((price - priceLow) / rowHeight)));
  for (const candle of candles) {
    const first = row(candle.low);
    const last = row(candle.high);
    const covered = last - first + 1;
    for (let index = first; index <= last; index++) {
      volumes[index] += candle.volume / covered;
      rowDeltas[index] += deltas.get(candle.time) / covered;
    }
  }
  let poc = 0;
  for (let index = 1; index < rowCount; index++) if (volumes[index] > volumes[poc]) poc = index;
  const total = volumes.reduce((sum, volume) => sum + volume, 0);
  let low = poc;
  let high = poc;
  let accumulated = volumes[poc];
  while (accumulated < total * 0.7 && (low > 0 || high < rowCount - 1)) {
    const below = low > 0 ? volumes[low - 1] : -1;
    const above = high < rowCount - 1 ? volumes[high + 1] : -1;
    if (above >= below) { high += 1; accumulated += Math.max(0, above); } else { low -= 1; accumulated += Math.max(0, below); }
  }
  const strongest = side => rowDeltas.reduce((best, delta, index) => (Math.sign(delta) === side && Math.abs(delta) > Math.abs(rowDeltas[best] ?? 0) ? index : best), -1);
  const rowBand = index => [priceLow + index * rowHeight, priceLow + (index + 1) * rowHeight];
  return {
    high: rawHigh, low: rawLow,
    poc: priceLow + (poc + 0.5) * rowHeight,
    vah: priceLow + (high + 1) * rowHeight,
    val: priceLow + low * rowHeight,
    strongestBuyRow: rowBand(strongest(1)),
    strongestSellRow: rowBand(strongest(-1)),
  };
}

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`);
const nothingDropped = result => {
  for (const kind of ['box', 'line', 'label', 'polyline']) {
    const removed = result.all(kind).filter(object => object.garbageCollected);
    assert.equal(removed.length, 0, `${removed.length} ${kind}s were dropped by the ${kind} limit`);
  }
  for (const kind of ['box', 'line', 'label']) assert.ok(result.live(kind).length <= 500, `${kind} count within 500`);
  assert.ok(result.live('polyline').length <= 100, 'polyline count within 100');
};

describe('Legilimens out of the box', () => {
  test('with no Fixed Range points placed, nothing is drawn and only candles outside 09:30–16:00 are dimmed', () => {
    const result = legilimens();
    for (const kind of ['box', 'line', 'label', 'polyline']) assert.equal(result.live(kind).length, 0, `no ${kind}s`);
    const dimmed = result.plot('Hidden Candles');
    for (let index = 0; index <= result.lastIndex; index++) {
      const clock = ny(result.bars.time[index]);
      const inRth = clock >= '09:30' && clock < '16:00';
      if (inRth) assert.ok(Number.isNaN(dimmed[index]), `${formatNy(result.bars.time[index])} stays visible`);
      else assert.equal(dimmed[index], result.bars.open[index], `${formatNy(result.bars.time[index])} is dimmed`);
    }
  });
});

describe('Legilimens Fixed Range', () => {
  const start = day(9, 30, 7);
  const end = day(12, 0, 7);
  const fixed = (inputs = {}) => legilimens({ inputs: { fixedRangeStartInput: start, fixedRangeEndInput: end, ...inputs } });
  const title = '🎯 2.5-Hour Fixed Range';

  test('the profile spans the placed points, whichever is placed first, with Fixed Start/End and duration titles', () => {
    for (const result of [fixed(), fixed({ fixedRangeStartInput: end, fixedRangeEndInput: start })]) {
      const [frame] = innerFrames(result, 'fixed');
      assert.equal(span(frame), `${formatNy(start)} → ${formatNy(end)}`);
      const candles = candlesIn(start, end);
      assert.equal(frame.top, sessionHigh(candles), 'frame top is the 1m high inside the range');
      assert.equal(frame.bottom, sessionLow(candles), 'frame bottom is the 1m low inside the range');
      const marker = text => result.live('label').find(label => label.text === text);
      assert.equal(marker('Fixed Start').x, start);
      assert.equal(marker('Fixed End').x, end);
      assert.equal(headings(result, title).length, 2, 'title above and below the profile');
    }
  });

  test('POC and VAH/VAL match a 70% value area rebuilt from the one-minute volume and run 6 hours past the end', () => {
    const result = fixed({ showPocLevel: true, showValueAreaLevels: true });
    const expected = referenceProfile(candlesIn(start, end), tapeDeltas(AT - 30 * HOUR, AT));
    const levels = result.live('line').filter(line => line.x1 === start);
    const poc = levels.filter(line => line.style === 'line.style_dashed');
    const valueArea = levels.filter(line => line.style === 'line.style_solid').map(line => line.y1).sort((a, b) => a - b);
    assert.equal(poc.length, 1, 'one POC line');
    close(poc[0].y1, expected.poc, 'POC');
    assert.equal(valueArea.length, 2, 'VAH and VAL lines');
    close(valueArea[0], expected.val, 'VAL');
    close(valueArea[1], expected.vah, 'VAH');
    for (const line of [...poc, ...levels]) assert.equal(line.x2, end + 6 * HOUR, 'levels end at the Hours endpoint');
    const pocLabel = result.live('label').find(label => label.text === `${title} POC`);
    assert.ok(pocLabel && pocLabel.x > end + 6 * HOUR && pocLabel.y === poc[0].y1, 'POC is labelled just right of the line end');
  });

  test('Highest Only draws just the biggest buying row in green and the biggest selling row in red', () => {
    const result = fixed({ deltaRowFilter: 'Highest Only' });
    const expected = referenceProfile(candlesIn(start, end), tapeDeltas(AT - 30 * HOUR, AT));
    const buys = result.live('polyline').filter(polyline => isBuyColor(polyline.fill_color));
    const sells = result.live('polyline').filter(polyline => !isBuyColor(polyline.fill_color));
    assert.equal(buys.length, 1, 'one green Delta shape');
    assert.equal(sells.length, 1, 'one red Delta shape');
    // Each shape is one row rectangle closed along the profile's floor (its spine).
    const floor = Math.min(...result.live('polyline').flatMap(polyline => polyline.points.map(point => point.price)));
    const rowEdges = ([polyline]) => [...new Set(polyline.points.map(point => point.price))].filter(price => price !== floor).sort((a, b) => a - b);
    const expectRow = (actual, [bottom, top], side) => {
      const expectedEdges = [bottom, top].filter(price => Math.abs(price - floor) > 1e-9);
      assert.equal(actual.length, expectedEdges.length, `${side} row edges ${actual} vs ${expectedEdges}`);
      actual.forEach((price, index) => close(price, expectedEdges[index], `${side} row edge`));
    };
    expectRow(rowEdges(buys), expected.strongestBuyRow, 'green row is the strongest positive delta row:');
    expectRow(rowEdges(sells), expected.strongestSellRow, 'red row is the strongest negative delta row:');
  });

  test('Delta Histogram Delta+ shows only buying rows and Delta- only selling rows', () => {
    const buyOnly = fixed({ deltaRowFilter: 'All', deltaHistogramRows: 'Delta+' }).live('polyline');
    const sellOnly = fixed({ deltaRowFilter: 'All', deltaHistogramRows: 'Delta-' }).live('polyline');
    assert.ok(buyOnly.length > 0 && buyOnly.every(polyline => isBuyColor(polyline.fill_color)), 'Delta+ draws green rows only');
    assert.ok(sellOnly.length > 0 && sellOnly.every(polyline => !isBuyColor(polyline.fill_color)), 'Delta- draws red rows only');
    assert.equal(fixed({ deltaHistogramRows: 'Off' }).live('polyline').length, 0, 'Off draws no Delta rows');
  });
});

describe('Legilimens RTH sessions on 15m', () => {
  // From Friday 2 October 08:30, so every session on the chart is complete from its open.
  const RTH_HISTORY = 6 * 24 + 2;
  const rth = (inputs = {}, options = {}) => legilimens({ hoursOfChart: RTH_HISTORY, ...options, inputs: { anchorMode: RTH, ...inputs } });

  test('completed RTH profiles start at 09:30, end at the last RTH candle and hold that session\'s high and low', () => {
    const result = rth();
    const completed = innerFrames(result, 'rth').slice(0, -1);
    assert.ok(completed.length >= 4, `${completed.length} completed sessions`);
    for (const frame of completed) {
      const date = Number(formatNy(frame.left).slice(8, 10));
      const month = Number(formatNy(frame.left).slice(5, 7));
      const open = nyTime(2026, month, date, 9, 30);
      assert.equal(frame.left, open, `${formatNy(frame.left)} starts at 09:30`);
      assert.ok(frame.right >= nyTime(2026, month, date, 15, 45) && frame.right <= nyTime(2026, month, date, 16), `${span(frame)} ends with the cash close`);
      const candles = candlesIn(open, nyTime(2026, month, date, 16));
      assert.equal(frame.top, sessionHigh(candles), `${formatNy(open)} high`);
      assert.equal(frame.bottom, sessionLow(candles), `${formatNy(open)} low`);
    }
  });

  test('the developing session shows only its inner frame and two titles until the content toggle is on', () => {
    const result = rth({ showPriorProfiles: false });
    const [frame] = innerFrames(result, 'rth');
    assert.equal(span(frame), `${formatNy(day(9, 30))} → ${formatNy(day(10, 15))}`, 'frame runs from the open to the forming candle');
    assert.equal(outerFrames(result, 'rth').length, 0, 'no outer frame while developing');
    assert.deepEqual(result.live('label').map(label => label.text), [RTH, RTH], 'only the titles');
    assert.equal(result.live('line').length + result.live('polyline').length, 0, 'no levels or Delta rows');
    const withContent = rth({ showPriorProfiles: false, showRthDevelopingContent: true, showPocLevel: true });
    assert.ok(withContent.live('label').some(label => label.text === 'RTH POC (dev)'), 'content toggle shows the developing POC');
  });

  test('Show Prior Profiles keeps the requested number of completed sessions behind the developing one', () => {
    const count = result => headings(result, RTH).length / 2;
    assert.equal(count(rth({ priorProfiles: 3 })), 4, '3 prior + developing');
    assert.equal(count(rth({ showPriorProfiles: false })), 1, 'developing only');
    assert.equal(count(rth()), 5, 'default 10 asks for more than the 4 sessions loaded');
  });

  test('Friday\'s RTH levels skip the weekend closure and resume Sunday at 18:00', () => {
    const result = rth();
    const friday = innerFrames(result, 'rth').find(frame => formatNy(frame.left).startsWith('2026-10-02'));
    const outer = outerFrames(result, 'rth').find(frame => frame.left === friday.left);
    const beforeWeekend = nyTime(2026, 10, 2, 18) - friday.right;
    assert.equal(outer.right, nyTime(2026, 10, 4, 18) + 6 * HOUR - beforeWeekend, `${span(outer)} carries 6 market hours`);
    const tuesday = innerFrames(result, 'rth').find(frame => formatNy(frame.left).startsWith('2026-10-06'));
    assert.equal(outerFrames(result, 'rth').find(frame => frame.left === tuesday.left).right, tuesday.right + 6 * HOUR, 'midweek levels run straight 6 hours');
  });
});

describe('Legilimens bounded New York sessions', () => {
  test('IVB covers exactly 09:30–10:00 on 15m and on 180R Range charts', () => {
    for (const chart of ['15', 'R180']) {
      const result = legilimens({ chart, inputs: { anchorMode: IVB, showPriorProfiles: false } });
      const [frame] = innerFrames(result, 'ivb');
      assert.equal(span(frame), `${formatNy(day(9, 30))} → ${formatNy(day(10))}`, chart);
      if (chart === '15') {
        const candles = candlesIn(day(9, 30), day(10));
        assert.equal(frame.top, sessionHigh(candles), 'IVB high');
        assert.equal(frame.bottom, sessionLow(candles), 'IVB low');
      }
    }
  });

  test('NY Early runs 05:00–09:00 by default and 06:00–09:00 with Start 06:00, levels reaching 3 hours past 09:00', () => {
    const fromFive = legilimens({ inputs: { anchorMode: NY_EARLY, showPriorProfiles: false } });
    assert.equal(span(innerFrames(fromFive, 'nyEarly')[0]), `${formatNy(day(5))} → ${formatNy(day(9))}`);
    assert.equal(outerFrames(fromFive, 'nyEarly')[0].right, day(12), 'levels end at 12:00');
    assert.ok(fromFive.live('label').some(label => label.text.startsWith('NY Early 05:00')), 'title names the 05:00 start');
    const fromSix = legilimens({ inputs: { anchorMode: NY_EARLY, showPriorProfiles: false, nyEarlyStart: '06:00', nyEarlyExtended: false } });
    assert.equal(span(innerFrames(fromSix, 'nyEarly')[0]), `${formatNy(day(6))} → ${formatNy(day(9))}`);
    const [sixFrame] = innerFrames(fromSix, 'nyEarly');
    const titles = headings(fromSix, 'NY Early').filter(label => label.y === sixFrame.top || label.y === sixFrame.bottom);
    assert.equal(titles.length, 2, 'plain NY Early title above and below');
  });
});

describe('Legilimens in Bar Replay (15m)', () => {
  test('replaying 08:55 keeps NY Early developing although the real clock is a month later', () => {
    const result = legilimens({ at: day(8, 55), mode: 'replay', inputs: { anchorMode: NY_EARLY, showPriorProfiles: false, nyEarlyExtended: false } });
    const [frame] = innerFrames(result, 'nyEarly');
    assert.equal(frame.left, day(5));
    assert.ok(frame.right < day(9), `still developing at ${formatNy(frame.right)}`);
    assert.equal(outerFrames(result, 'nyEarly').length, 0, 'no completed outer frame yet');
  });

  test('replaying 10:30 shows NY Early completed and NY Afternoon still developing', () => {
    const nyEarly = legilimens({ mode: 'replay', inputs: { anchorMode: NY_EARLY, showPriorProfiles: false, nyEarlyExtended: false } });
    assert.equal(span(innerFrames(nyEarly, 'nyEarly')[0]), `${formatNy(day(5))} → ${formatNy(day(9))}`);
    assert.equal(outerFrames(nyEarly, 'nyEarly').length, 1, 'completed outer frame');
    const afternoon = legilimens({ mode: 'replay', inputs: { anchorMode: NY_AFTERNOON, showPriorProfiles: false } });
    assert.equal(span(innerFrames(afternoon, 'rth')[0]), `${formatNy(day(9, 30))} → ${formatNy(AT)}`, 'frame runs to the last replayed minute');
    assert.equal(afternoon.live('box').length, 1, 'developing: inner frame only');
  });
});

describe('Legilimens drawing budget', () => {
  test('50 prior RTH profiles with every level on keep the newest that fit and nothing is dropped by TradingView limits', () => {
    const result = legilimens({
      hoursOfChart: 24 * 26,
      inputs: {
        anchorMode: RTH, priorProfiles: 50, showPocLevel: true, showValueAreaLevels: true, showHistogram: true,
        minimumDeltaTierStrength: 'Weak⁺', minimumLvnTierStrength: 'Weak⁺', deltaRowFilter: 'All', showRthDevelopingContent: true,
      },
    });
    nothingDropped(result);
    const frames = innerFrames(result, 'rth');
    // Per profile: 34 labels (2 titles, POC, midpoint, 5 LVN and 10 Delta tiers with two labels each),
    // so 500 labels fit 14 profiles: the developing session plus the 13 sessions before it.
    assert.equal(frames.length, 14, 'label capacity sets the profile count');
    assert.equal(formatNy(frames[0].left), formatNy(nyTime(2026, 9, 21, 9, 30)), 'oldest kept session is 13 sessions back');
    assert.equal(frames.at(-1).left, day(9, 30), 'the developing session is kept');
    const tradingDays = [...new Set(frames.map(frame => formatNy(frame.left).slice(0, 10)))];
    assert.equal(tradingDays.length, frames.length, 'one profile per session');
  });
});

describe('Legilimens on 1m charts (1-second intrabars)', () => {
  const minute = inputs => legilimens({ chart: '1', hoursOfChart: 1.5, inputs });

  test('IVB covers 09:30–10:00 and the developing RTH profile starts at 09:30, each with its own high and low', () => {
    const [ivb] = innerFrames(minute({ anchorMode: IVB, showPriorProfiles: false }), 'ivb');
    assert.equal(span(ivb), `${formatNy(day(9, 30))} → ${formatNy(day(10))}`);
    const ivbSeconds = secondsIn(day(9, 30), day(10));
    assert.equal(ivb.top, sessionHigh(ivbSeconds), 'IVB high');
    assert.equal(ivb.bottom, sessionLow(ivbSeconds), 'IVB low');
    const [rth] = innerFrames(minute({ anchorMode: RTH }), 'rth');
    assert.equal(span(rth), `${formatNy(day(9, 30))} → ${formatNy(day(10, 29))}`, 'frame runs from the open to the forming candle');
    const rthSeconds = secondsIn(day(9, 30), AT);
    assert.equal(rth.top, sessionHigh(rthSeconds), 'RTH high so far');
    assert.equal(rth.bottom, sessionLow(rthSeconds), 'RTH low so far');
  });

  test('Fixed Range POC and VAH/VAL match a value area rebuilt from the 1-second tape', () => {
    const start = day(9, 30);
    const end = day(10);
    const result = minute({ fixedRangeStartInput: start, fixedRangeEndInput: end, showPocLevel: true, showValueAreaLevels: true });
    const expected = referenceProfile(secondsIn(start, end), tapeDeltas(AT - 1.5 * HOUR, AT, minuteMarket.secondCandles('1S')));
    const levels = result.live('line').filter(line => line.x1 === start);
    const [poc] = levels.filter(line => line.style === 'line.style_dashed');
    const [val, vah] = levels.filter(line => line.style === 'line.style_solid').map(line => line.y1).sort((a, b) => a - b);
    close(poc.y1, expected.poc, 'POC');
    close(val, expected.val, 'VAL');
    close(vah, expected.vah, 'VAH');
    for (const line of levels) assert.equal(line.x2, end + 6 * HOUR, 'levels end at the Hours endpoint');
  });
});
