import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadIndicator, runIndicator } from '../../../tests/runtime/run.mjs';
import { cmeMarket, nyTime, formatNy, isLive } from '../../../tests/runtime/scenario.mjs';
import { localParts } from '../../../tests/runtime/timezone.mjs';

// Runs deviations.pine bar by bar on synthetic NQ data and checks what the chart would show.
// These pin approved behavior; they do not prove TradingView compilation or rendering.
// Every expected price is derived from the synthetic candles, never hardcoded.

const program = loadIndicator(process.env.DEVIATIONS_PINE ?? new URL('../code/deviations.pine', import.meta.url).pathname);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SESSION = { Rafael: 0, 'NY Early': 1, Premarket: 2, 'Asia Open': 3, IVB: 4 };

// No lookback here reaches further than two weeks, so a short history keeps the suite fast.
const market = cmeMarket({ start: nyTime(2026, 9, 20, 18), end: nyTime(2026, 10, 10, 17) });

// Thursday 8 October 2026 is the test day.
const day = (hour, minute = 0, date = 8, month = 10) => nyTime(2026, month, date, hour, minute);

const runs = new Map();
function deviations({ at, chart = '1', from, hoursOfChart = 20, mode = 'live', inputs = {} }) {
  const key = JSON.stringify({ at, chart, from, hoursOfChart, mode, inputs });
  if (!runs.has(key)) {
    const chartSpec = chart.startsWith('R') ? { type: 'range', size: Number(chart.slice(1)) * 0.25 } : { type: 'time', tf: chart };
    runs.set(key, runIndicator(program, { market, chart: chartSpec, from: from ?? at - hoursOfChart * HOUR, until: at, mode, inputs }));
  }
  return runs.get(key);
}

// ── Reading the chart ────────────────────────────────────────────────────────

const sessionsOf = (result, name) => [...result.global('sessions'), ...result.global('activeSessions')]
  .filter(sess => sess.sessionIndex === SESSION[name])
  .sort((a, b) => a.startTime - b.startTime);
const sessionStarting = (result, name, start) => {
  const sess = sessionsOf(result, name).find(candidate => candidate.startTime === start);
  assert.ok(sess, `${name} starting ${formatNy(start)} is on the chart`);
  return sess;
};
const span = object => `${formatNy(object.left ?? object.x1)} → ${formatNy(object.right ?? object.x2)}`;
const coreBoxes = sess => [sess.bodyBox, sess.wickBox].filter(isLive);
const zoneBoxes = sess => sess.deviationBoxes.filter(isLive);
const priceBand = box => [Math.min(box.top, box.bottom), Math.max(box.top, box.bottom)];
const close = (a, b) => Math.abs(a - b) < 1e-6;
const liveLinesAt = (result, price) => result.live('line').filter(ln => close(ln.y1, price) && close(ln.y2, price));
const lastBarTime = result => result.bars.time[result.lastIndex];

// ── Reading the candles ──────────────────────────────────────────────────────

const candlesBetween = (from, to) => market.candles.filter(candle => candle.time >= from && candle.time < to);
function wickRange(from, to) {
  const candles = candlesBetween(from, to);
  const high = Math.max(...candles.map(c => c.high));
  const low = Math.min(...candles.map(c => c.low));
  return {
    high, low,
    bodyHigh: Math.max(...candles.map(c => Math.max(c.open, c.close))),
    bodyLow: Math.min(...candles.map(c => Math.min(c.open, c.close))),
    highTime: candles.find(c => c.high === high).time,
    lowTime: candles.find(c => c.low === low).time,
  };
}

// Expected price bands of each "inner:outer" zone, above the high and below the low.
function expectedZones(zoneText, { high, low }) {
  const height = high - low;
  return zoneText.split(',').flatMap(token => {
    const [inner, outer] = token.trim().split(':').map(Number);
    return [[high + height * inner, high + height * outer], [low - height * outer, low - height * inner]];
  }).sort((a, b) => a[0] - b[0]);
}
function expectZones(sess, zoneText, range, label) {
  const actual = zoneBoxes(sess).map(priceBand).sort((a, b) => a[0] - b[0]);
  const expected = expectedZones(zoneText, range);
  assert.equal(actual.length, expected.length, `${label}: zone count`);
  actual.forEach((band, i) => assert.ok(close(band[0], expected[i][0]) && close(band[1], expected[i][1]), `${label}: zone ${i} is ${band}, expected ${expected[i]}`));
}
const expectSpan = (objects, start, end, label) => {
  assert.ok(objects.length > 0, `${label}: drawn`);
  for (const object of objects) assert.equal(span(object), `${formatNy(start)} → ${formatNy(end)}`, label);
};

// ── Defaults on 1m ───────────────────────────────────────────────────────────

describe('Deviations default sessions on 1m (11:00 NY)', () => {
  const at11 = () => deviations({ at: day(11) });

  test('each session sits on its New York window: Asia Open 18–21, Rafael 21:30–01:30, Premarket 05–09:15, NY Early 06–09, IVB 09:30–10', () => {
    const result = at11();
    expectSpan(coreBoxes(sessionStarting(result, 'Asia Open', day(18, 0, 7))), day(18, 0, 7), day(21, 0, 7), 'Asia Open core');
    expectSpan(coreBoxes(sessionStarting(result, 'Rafael', day(21, 30, 7))), day(21, 30, 7), day(1, 30), 'Rafael core');
    expectSpan(zoneBoxes(sessionStarting(result, 'Premarket', day(5))), day(5), day(9, 15), 'Premarket zones');
    expectSpan(coreBoxes(sessionStarting(result, 'NY Early', day(6))), day(6), day(9), 'NY Early core');
    expectSpan(coreBoxes(sessionStarting(result, 'IVB', day(9, 30))), day(9, 30), day(10), 'IVB core');
  });

  test('deviation zones are multiples of the session wick range from the 1-minute candles', () => {
    const result = at11();
    expectZones(sessionStarting(result, 'NY Early', day(6)), '0.25:0.5, 1.33:1.66', wickRange(day(6), day(9)), 'NY Early');
    expectZones(sessionStarting(result, 'Premarket', day(5)), '0.25:0.5, 0.75:1', wickRange(day(5), day(9, 15)), 'Premarket');
    expectZones(sessionStarting(result, 'IVB', day(9, 30)), '0.25:0.5, 1:1.5', wickRange(day(9, 30), day(10)), 'IVB');
  });

  test('NY Early zones run 6h past 09:00, IVB zones 3h past 10:00, Premarket zones stop at 09:15 and it draws no core', () => {
    const result = at11();
    expectSpan(zoneBoxes(sessionStarting(result, 'NY Early', day(6))), day(6), day(15), 'NY Early zones');
    expectSpan(zoneBoxes(sessionStarting(result, 'IVB', day(9, 30))), day(9, 30), day(13), 'IVB zones');
    expectSpan(zoneBoxes(sessionStarting(result, 'Premarket', day(5))), day(5), day(9, 15), 'Premarket zones');
    assert.equal(coreBoxes(sessionStarting(result, 'Premarket', day(5))).length, 0, 'Premarket has no core');
  });

  test('Asia Open and Rafael default to Core: a body box and a wick box from the candles, no zones', () => {
    const result = at11();
    for (const [name, from, to] of [['Asia Open', day(18, 0, 7), day(21, 0, 7)], ['Rafael', day(21, 30, 7), day(1, 30)]]) {
      const sess = sessionStarting(result, name, from);
      const range = wickRange(from, to);
      const bands = coreBoxes(sess).map(priceBand).map(String).sort();
      assert.deepEqual(bands, [String([range.bodyLow, range.bodyHigh]), String([range.low, range.high])].sort(), `${name} core bands`);
      assert.equal(zoneBoxes(sess).length, 0, `${name} has no deviation zones`);
    }
  });

  test('Rafael in Wick mode adds its zones, ±3 lines and sans-serif "W" labels from the 21:30–01:30 range', () => {
    const result = deviations({ at: day(11), inputs: { opening_2130_0129: 'Wick' } });
    const sess = sessionStarting(result, 'Rafael', day(21, 30, 7));
    const range = wickRange(day(21, 30, 7), day(1, 30));
    expectZones(sess, '0.5:1, 2:2.5, 4:4.5', range, 'Rafael');
    const height = range.high - range.low;
    const lines = sess.lines.filter(isLive).map(ln => ln.y1).sort((a, b) => a - b);
    assert.deepEqual(lines, [range.low - 3 * height, range.high + 3 * height], 'single 3 level is a dotted line on each side');
    const labels = sess.labels.filter(isLive).map(lbl => lbl.text);
    assert.ok(labels.includes('+𝟥W') && labels.includes('-𝟥W') && labels.includes('+𝟦.𝟧W'), `labels: ${labels.join(' ')}`);
  });

  test('a developing NY Early session already projects its zones to 15:00, sized from the range so far', () => {
    const result = deviations({ at: day(7, 30), hoursOfChart: 3 });
    const sess = sessionStarting(result, 'NY Early', day(6));
    expectZones(sess, '0.25:0.5, 1.33:1.66', wickRange(day(6), day(7, 30)), 'live NY Early');
    expectSpan(zoneBoxes(sess), day(6), day(15), 'live NY Early zones');
  });
});

// ── NY Early + IVB cores ─────────────────────────────────────────────────────

describe('Deviations NY Early + IVB cores', () => {
  const cores = (result, name, start) => coreBoxes(sessionStarting(result, name, start)).length;

  test("Auto hides today's NY Early and IVB cores 06:00–10:00, keeps yesterday's, and shows today's after 10:00", () => {
    const during = deviations({ at: day(9, 45), chart: '15', hoursOfChart: 30 });
    assert.equal(cores(during, 'NY Early', day(6)), 0, "today's NY Early core hidden at 09:45");
    assert.equal(cores(during, 'IVB', day(9, 30)), 0, 'developing IVB core hidden');
    assert.equal(cores(during, 'NY Early', day(6, 0, 7)), 2, "yesterday's NY Early core stays");
    const after = deviations({ at: day(10, 15), chart: '15', hoursOfChart: 30 });
    assert.equal(cores(after, 'NY Early', day(6)), 2, 'NY Early core returns after 10:00');
    assert.equal(cores(after, 'IVB', day(9, 30)), 2, 'IVB core returns after 10:00');
  });

  test("Hidden keeps today's cores off after 10:00 (yesterday's stay); Shown draws them during NY Early", () => {
    const hidden = deviations({ at: day(11), chart: '15', hoursOfChart: 30, inputs: { nyEarlyIvbCoreVisibility: 'Hidden' } });
    assert.equal(cores(hidden, 'NY Early', day(6)), 0);
    assert.equal(cores(hidden, 'IVB', day(9, 30)), 0);
    assert.equal(cores(hidden, 'NY Early', day(6, 0, 7)), 2);
    const shown = deviations({ at: day(7, 30), chart: '15', hoursOfChart: 30, inputs: { nyEarlyIvbCoreVisibility: 'Shown' } });
    assert.equal(cores(shown, 'NY Early', day(6)), 2);
  });
});

// ── Session count, Quick Filter, chart support ───────────────────────────────

describe('Deviations session count and Quick Filter', () => {
  const sessionStartsDrawn = (result, name) => {
    const lefts = new Set(result.live('box').map(box => box.left));
    return sessionsOf(result, name).filter(sess => lefts.has(sess.startTime)).map(sess => formatNy(sess.startTime));
  };

  test('No. Of Sessions keeps the 3 most recent of each session by default; 1 keeps only the latest', () => {
    const three = deviations({ at: day(11), chart: '15', hoursOfChart: 24 * 5 });
    assert.deepEqual(sessionStartsDrawn(three, 'Asia Open'), [5, 6, 7].map(date => formatNy(day(18, 0, date))));
    assert.deepEqual(sessionStartsDrawn(three, 'NY Early'), [6, 7, 8].map(date => formatNy(day(6, 0, date))));
    const one = deviations({ at: day(11), chart: '15', hoursOfChart: 24 * 5, inputs: { maxSessions: 1 } });
    assert.deepEqual(sessionStartsDrawn(one, 'Asia Open'), [formatNy(day(18, 0, 7))]);
    assert.deepEqual(sessionStartsDrawn(one, 'NY Early'), [formatNy(day(6))]);
  });

  test('Quick Filter "Asia Open" shows only Asia Open; "Rafael + Asia Open" drops the New York sessions', () => {
    const asia = deviations({ at: day(11), chart: '15', hoursOfChart: 30, inputs: { quickFilter: 'Asia Open' } });
    assert.ok(sessionStartsDrawn(asia, 'Asia Open').length > 0);
    for (const name of ['Rafael', 'NY Early', 'Premarket', 'IVB']) assert.deepEqual(sessionStartsDrawn(asia, name), [], name);
    const evening = deviations({ at: day(11), chart: '15', hoursOfChart: 30, inputs: { quickFilter: 'Rafael + Asia Open' } });
    assert.ok(sessionStartsDrawn(evening, 'Rafael').length > 0 && sessionStartsDrawn(evening, 'Asia Open').length > 0);
    for (const name of ['NY Early', 'Premarket', 'IVB']) assert.deepEqual(sessionStartsDrawn(evening, name), [], name);
  });

  test('on 60m no session levels are drawn, while Show Only still greys candles', () => {
    const result = deviations({ at: day(11), chart: '60', hoursOfChart: 72 });
    for (const kind of ['box', 'line', 'label']) assert.equal(result.live(kind).length, 0, `${kind}s on 60m`);
    const greyed = result.plot('Hidden Candles').filter(value => !Number.isNaN(value));
    assert.ok(greyed.length > 0, 'candles outside 05:00–16:00 are greyed');
  });
});

// ── Show Only ────────────────────────────────────────────────────────────────

describe('Deviations Show Only candles', () => {
  const greyedAt = (result, time) => {
    const index = result.bars.time.indexOf(time);
    assert.ok(index >= 0, `bar at ${formatNy(time)}`);
    const value = result.plot('Hidden Candles')[index];
    if (Number.isNaN(value)) return false;
    assert.equal(value, result.bars.open[index], 'a greyed candle is redrawn from its own open');
    return true;
  };

  test('default ●● RTH lights 05:00–16:00 and greys the overnight', () => {
    const result = deviations({ at: day(11), chart: '15', hoursOfChart: 30 });
    assert.equal(greyedAt(result, day(4, 45)), true);
    assert.equal(greyedAt(result, day(5)), false);
    assert.equal(greyedAt(result, day(15, 45, 7)), false);
    assert.equal(greyedAt(result, day(16, 0, 7)), true);
  });

  test('RTH lights from 09:30; Most Recent Only greys yesterday as well', () => {
    const rth = deviations({ at: day(11), chart: '15', hoursOfChart: 30, inputs: { visibleWindow: 'RTH' } });
    assert.equal(greyedAt(rth, day(9, 15)), true);
    assert.equal(greyedAt(rth, day(9, 30)), false);
    const latest = deviations({ at: day(11), chart: '15', hoursOfChart: 30, inputs: { showOnlyMostRecent: true } });
    assert.equal(greyedAt(latest, day(10, 0, 7)), true);
    assert.equal(greyedAt(latest, day(10)), false);
  });
});

// ── Mitigation ───────────────────────────────────────────────────────────────

describe('Deviations mitigation', () => {
  // Rafael and Asia Open only confirm a take from 05:00 the next morning; an earlier overnight
  // touch is provisional: solid up to the touch, then dashed until confirmed.
  function expectBoundary(result, name, sessionFrom, sessionTo, side) {
    const range = wickRange(sessionFrom, sessionTo);
    const level = side === 'high' ? range.high : range.low;
    const origin = side === 'high' ? range.highTime : range.lowTime;
    const confirmFrom = nyTime(...ymd(sessionFrom + 24 * HOUR), 5);
    const touches = candlesBetween(sessionTo, lastBarTime(result) + MINUTE).filter(c => (side === 'high' ? c.high >= level : c.low <= level));
    const overnight = touches.find(c => c.time < confirmFrom);
    const confirmed = touches.find(c => c.time >= confirmFrom);
    const lines = liveLinesAt(result, level);
    const solid = lines.filter(ln => ln.style === 'line.style_solid');
    const dashed = lines.filter(ln => ln.style === 'line.style_dashed');
    const labels = result.live('label').filter(lbl => close(lbl.y, level) && lbl.text === name);
    const label = `${name} ${side}`;
    if (overnight) {
      expectSpan(solid, origin, overnight.time, `${label} solid to the overnight touch`);
      expectSpan(dashed, overnight.time, confirmed?.time ?? lastBarTime(result), `${label} dashed pending`);
      assert.equal(labels.length, confirmed ? 0 : 1, `${label} pending tag`);
    } else if (confirmed) {
      expectSpan(solid, origin, confirmed.time, `${label} ends where it was taken`);
      assert.equal(dashed.length + labels.length, 0, `${label} no pending line or tag`);
    } else {
      expectSpan(solid, origin, lastBarTime(result), `${label} untouched runs to the current bar`);
      assert.equal(labels.length, 1, `${label} tagged at the right edge`);
      assert.equal(labels[0].x, lastBarTime(result));
    }
    return overnight ? 'provisional' : confirmed ? 'confirmed' : 'untouched';
  }
  const ymd = time => { const p = localParts(time, 'America/New_York'); return [p.year, p.month, p.day]; };

  test('Asia Open and Rafael boundaries: untouched runs to now with a tag, overnight touches stay dashed, 05:00+ touches end the line', () => {
    const result = deviations({ at: day(11) });
    const states = [
      expectBoundary(result, 'Asia Open', day(18, 0, 7), day(21, 0, 7), 'high'),
      expectBoundary(result, 'Asia Open', day(18, 0, 7), day(21, 0, 7), 'low'),
      expectBoundary(result, 'Rafael', day(21, 30, 7), day(1, 30), 'high'),
      expectBoundary(result, 'Rafael', day(21, 30, 7), day(1, 30), 'low'),
    ];
    // The synthetic day exercises every branch, so none of them is checked vacuously.
    assert.deepEqual([...new Set(states)].sort(), ['confirmed', 'provisional', 'untouched']);
  });

  test('Unmitigated mode keeps only untouched Rafael and Asia Open boundaries', () => {
    const result = deviations({ at: day(11), inputs: { mitigationMode: 'Unmitigated' } });
    for (const [name, from, to] of [['Asia Open', day(18, 0, 7), day(21, 0, 7)], ['Rafael', day(21, 30, 7), day(1, 30)]]) {
      const range = wickRange(from, to);
      const confirmFrom = nyTime(...ymd(from + 24 * HOUR), 5);
      for (const side of ['high', 'low']) {
        const level = range[side];
        const taken = candlesBetween(confirmFrom, lastBarTime(result) + MINUTE).some(c => (side === 'high' ? c.high >= level : c.low <= level));
        const solid = liveLinesAt(result, level).filter(ln => ln.style === 'line.style_solid');
        assert.equal(solid.length, taken ? 0 : 1, `${name} ${side} ${taken ? 'taken' : 'untouched'}`);
      }
    }
  });

  // The IVB line turns dashed at the first wick through it and is confirmed only by a
  // 30-minute candle closing beyond it, ending on that candle's last chart bar.
  function expectIvbBoundary(result, side, barMs) {
    const ivb = wickRange(day(9, 30), day(10));
    const level = ivb[side];
    const beyond = value => (side === 'high' ? value >= level : value <= level);
    const wick = candlesBetween(day(10), lastBarTime(result) + barMs).find(c => beyond(side === 'high' ? c.high : c.low));
    const thirty = market.timeBars('30', lastBarTime(result) + barMs, day(10));
    const closeIndex = thirty.time.findIndex((start, i) => start + 30 * MINUTE <= lastBarTime(result) && (side === 'high' ? thirty.close[i] > level : thirty.close[i] < level));
    const dashed = liveLinesAt(result, level).filter(ln => ln.style === 'line.style_dashed');
    if (!wick) return assert.equal(dashed.length, 0);
    const wickBar = result.bars.time.findLast(time => time <= wick.time);
    const end = closeIndex >= 0 ? thirty.time[closeIndex] + 30 * MINUTE - barMs : lastBarTime(result);
    expectSpan(dashed, wickBar, end, `IVB ${side} pending`);
    return closeIndex >= 0;
  }

  test('an IVB wick break stays dashed until a 30-minute close beyond it confirms the take', () => {
    const early = deviations({ at: day(11) });
    const late = deviations({ at: day(15), chart: '15', hoursOfChart: 8 });
    const confirmations = ['high', 'low'].flatMap(side => [expectIvbBoundary(early, side, MINUTE), expectIvbBoundary(late, side, 15 * MINUTE)]);
    assert.ok(confirmations.includes(false) && confirmations.includes(true), 'both pending and confirmed IVB takes are exercised');
  });
});

// ── IVB breakout extensions ──────────────────────────────────────────────────

describe('Deviations IVB breakout extensions', () => {
  test('a confirmed IVB breakout projects average and +1σ lines from the first break, using prior days only', () => {
    const at = day(15);
    const result = deviations({ at, chart: '15', from: day(18, 0, 27, 9) });
    const bars = result.bars;
    const minutesOf = time => { const p = localParts(time, 'America/New_York'); return p.hour * 60 + p.minute; };
    const dayOf = time => ymd15(time);
    function ymd15(time) { const p = localParts(time, 'America/New_York'); return `${p.year}-${p.month}-${p.day}`; }

    // Rolling samples: each prior day's furthest 10:00–16:00 excursion beyond IVB, as a ratio of its range.
    const ratios = [];
    const days = [...new Set(bars.time.map(dayOf))].filter(key => key !== dayOf(at));
    for (const key of days) {
      const inDay = bars.time.map((time, i) => i).filter(i => dayOf(bars.time[i]) === key);
      const ivbBars = inDay.filter(i => minutesOf(bars.time[i]) >= 570 && minutesOf(bars.time[i]) < 600);
      if (!ivbBars.length) continue;
      const high = Math.max(...ivbBars.map(i => bars.high[i]));
      const low = Math.min(...ivbBars.map(i => bars.low[i]));
      const after = inDay.filter(i => minutesOf(bars.time[i]) >= 600 && minutesOf(bars.time[i]) < 960);
      const above = Math.max(0, ...after.map(i => bars.high[i] - high));
      const below = Math.max(0, ...after.map(i => low - bars.low[i]));
      if (above > 0) ratios.push(above / (high - low));
      if (below > 0) ratios.push(below / (high - low));
    }
    const samples = ratios.slice(-15);
    assert.ok(samples.length >= 5, 'enough samples to project');
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const deviation = Math.sqrt(samples.reduce((sum, value) => sum + (value - average) ** 2, 0) / samples.length);

    const ivb = wickRange(day(9, 30), day(10));
    const height = ivb.high - ivb.low;
    const thirty = market.timeBars('30', at, day(10));
    let projected = 0;
    for (const side of ['high', 'low']) {
      const sign = side === 'high' ? 1 : -1;
      const confirmed = thirty.time.some((start, i) => start + 30 * MINUTE <= lastBarTime(result) && minutesOf(start) < 960 && sign * (thirty.close[i] - ivb[side]) > 0);
      const breakIndex = bars.time.findIndex(time => time >= day(10) && time < day(16) && sign * ((side === 'high' ? bars.high : bars.low)[bars.time.indexOf(time)] - ivb[side]) > 0);
      for (const [ratio, caption] of [[average, 'ivb avg'], [average + deviation, 'ivb +1σ']]) {
        const level = ivb[side] + sign * height * ratio;
        const lines = result.live('line').filter(ln => Math.abs(ln.y1 - level) < 1e-6 && ln.style === 'line.style_dashed');
        if (!confirmed) { assert.equal(lines.length, 0, `${side} ${caption} waits for a 30-minute close`); continue; }
        const start = bars.time[breakIndex];
        expectSpan(lines, start, Math.max(day(16), start + 6 * HOUR), `${side} ${caption}`);
        assert.ok(result.live('label').some(lbl => lbl.text === caption && Math.abs(lbl.y - level) < 1e-6), `${side} ${caption} label`);
        projected++;
      }
    }
    assert.ok(projected > 0, 'at least one side projected');
  });
});

// ── Range and Replay ─────────────────────────────────────────────────────────

describe('Deviations on Range charts (180R)', () => {
  test('Asia Open keeps 18:00–21:00 and 1-minute levels; NY Early ends at its last Range candle and extends 6h from there', () => {
    const result = deviations({ at: day(11), chart: 'R180', hoursOfChart: 48 });
    const asia = sessionStarting(result, 'Asia Open', day(18, 0, 7));
    const range = wickRange(day(18, 0, 7), day(21, 0, 7));
    expectSpan(coreBoxes(asia), day(18, 0, 7), day(21, 0, 7), 'Asia Open core');
    assert.ok(coreBoxes(asia).some(box => String(priceBand(box)) === String([range.low, range.high])), 'Asia wick box from 1-minute data');

    const inNyEarly = result.bars.time.filter(time => time >= day(6) && time < day(9));
    const [first, last] = [inNyEarly[0], inNyEarly.at(-1)];
    assert.ok(first > day(6) || last < day(9, 0) - MINUTE, 'Range candles do not open exactly on the window edges');
    const nyEarly = sessionStarting(result, 'NY Early', first);
    expectSpan(coreBoxes(nyEarly), first, last, 'NY Early core');
    expectSpan(zoneBoxes(nyEarly), first, last + 6 * HOUR, 'NY Early zones');
  });
});

describe('Deviations in Bar Replay', () => {
  test('replaying 07:30 shows the developing NY Early zones exactly as a live chart does', () => {
    const replay = sessionStarting(deviations({ at: day(7, 30), hoursOfChart: 3, mode: 'replay' }), 'NY Early', day(6));
    const live = sessionStarting(deviations({ at: day(7, 30), hoursOfChart: 3 }), 'NY Early', day(6));
    expectZones(replay, '0.25:0.5, 1.33:1.66', wickRange(day(6), day(7, 30)), 'replay NY Early');
    expectSpan(zoneBoxes(replay), day(6), day(15), 'replay NY Early zones');
    assert.deepEqual(zoneBoxes(replay).map(box => [box.left, box.right, box.top, box.bottom]), zoneBoxes(live).map(box => [box.left, box.right, box.top, box.bottom]));
  });
});

// ── Asia + Rafael Focus ──────────────────────────────────────────────────────

describe('Deviations Asia + Rafael Focus', () => {
  const focusFrom = day(18, 0, 27, 9);

  test('↕ Around keeps the 3 recent Asia Open and Rafael sessions and adds the 3 nearest with untouched levels', () => {
    const result = deviations({ at: day(11), chart: '15', from: focusFrom, inputs: { focusMode: 'Price' } });
    const anchor = result.bars.close[result.lastIndex];
    const lefts = new Set(result.live('box').map(box => box.left));
    const windows = { 'Asia Open': [18 * 60, 21 * 60], Rafael: [21 * 60 + 30, 25 * 60 + 30] };
    for (const [name, [startMin, endMin]] of Object.entries(windows)) {
      const sessions = sessionsOf(result, name);
      assert.ok(sessions.length > 6, `${name}: enough history to rank`);
      const ranked = sessions.map(sess => {
        const from = sess.startTime;
        const range = wickRange(from, from + (endMin - startMin) * MINUTE);
        const confirmFrom = nyTime(...(t => { const p = localParts(t, 'America/New_York'); return [p.year, p.month, p.day]; })(from + 24 * HOUR), 5);
        const later = candlesBetween(confirmFrom, lastBarTime(result) + 15 * MINUTE);
        const untouched = [['high', range.high], ['low', range.low]].filter(([side, level]) => !later.some(c => (side === 'high' ? c.high >= level : c.low <= level)));
        const pool = untouched.length ? untouched : [['high', range.high], ['low', range.low]];
        return { start: from, untouched: untouched.length > 0, distance: Math.min(...pool.map(([, level]) => Math.abs(anchor - level))) };
      }).sort((a, b) => (a.untouched !== b.untouched ? (a.untouched ? -1 : 1) : a.distance !== b.distance ? a.distance - b.distance : b.start - a.start));
      const expected = new Set([...sessions.slice(-3).map(sess => sess.startTime), ...ranked.slice(0, 3).map(entry => entry.start)]);
      const drawn = sessions.filter(sess => lefts.has(sess.startTime)).map(sess => formatNy(sess.startTime));
      assert.deepEqual(drawn, [...expected].sort((a, b) => a - b).map(formatNy), name);
      assert.ok(drawn.length > 3, `${name}: Focus adds older sessions`);
    }
  });

  test('every session in Both mode with labels and 20 Focus sessions stays inside the 500-drawing limits', () => {
    const both = Object.fromEntries(['2130_0129', '1800_2100', '0600_0900', '0500_0915', '0930_1000'].flatMap(key => [[`opening_${key}`, 'Both'], [`opening_${key}_showLabels`, 'Both']]));
    const result = deviations({ at: day(11), chart: '15', from: focusFrom, inputs: { ...both, quickFilter: 'All', focusMode: 'Price', focusSessionCount: 20 } });
    for (const kind of ['box', 'line', 'label']) {
      const removed = result.all(kind).filter(object => object.garbageCollected);
      assert.equal(removed.length, 0, `${removed.length} ${kind}s were dropped by the ${kind} limit`);
      assert.ok(result.live(kind).length <= 500);
    }
    assert.ok(result.live('box').length > 100, 'the scenario is dense enough to matter');
  });
});

// ── Asia + Rafael Date Focus ─────────────────────────────────────────────────

describe('Deviations Asia + Rafael Date Focus', () => {
  const focusFrom = day(18, 0, 27, 9);
  const focusTypes = ['Asia Open', 'Rafael'];
  const endDate = { focusEndYear: 2026, focusEndMonth: 10, focusEndDay: 1 };
  const between = { ...endDate, focusDateFilter: 'Between', focusStartYear: 2026, focusStartMonth: 9, focusStartDay: 29 };
  const drawnStarts = (result, name) => {
    const lefts = new Set(result.live('box').map(box => box.left));
    return sessionsOf(result, name).filter(sess => lefts.has(sess.startTime)).map(sess => sess.startTime);
  };
  const asNy = starts => [...starts].sort((a, b) => a - b).map(formatNy);

  test('On or Before keeps the 3 recent sessions and adds the 3 latest opening on or before midday on End', () => {
    const result = deviations({ at: day(11), chart: '15', from: focusFrom, inputs: { focusMode: 'Date', ...endDate } });
    for (const name of focusTypes) {
      const starts = sessionsOf(result, name).map(sess => sess.startTime);
      const recent = starts.slice(-3);
      const focused = starts.filter(start => start <= day(12, 0, 1) && !recent.includes(start)).slice(-3);
      assert.equal(focused.length, 3, `${name}: enough history before End`);
      assert.deepEqual(asNy(drawnStarts(result, name)), asNy(new Set([...focused, ...recent])), name);
    }
  });

  test('Between keeps every session from 18:00 NY before Start through 18:00 NY on End', () => {
    const result = deviations({ at: day(11), chart: '15', from: focusFrom, inputs: { focusMode: 'Date', focusSessionCount: 10, ...between } });
    for (const name of focusTypes) {
      const sessions = sessionsOf(result, name);
      const recent = sessions.slice(-3).map(sess => sess.startTime);
      const inWindow = sessions.filter(sess => sess.startTime < day(18, 0, 1) && sess.endTime > day(18, 0, 28, 9)).map(sess => sess.startTime);
      assert.equal(inWindow.length, 3, `${name}: three trading dates in the window`);
      assert.deepEqual(asNy(drawnStarts(result, name)), asNy(new Set([...inWindow, ...recent])), name);
    }
  });

  test('Price + Date ranks only inside the date window', () => {
    const priceOnly = deviations({ at: day(11), chart: '15', from: focusFrom, inputs: { focusMode: 'Price', focusSessionsOnly: true, focusSessionCount: 10 } });
    const result = deviations({ at: day(11), chart: '15', from: focusFrom, inputs: { focusMode: 'Price + Date', focusSessionsOnly: true, focusSessionCount: 10, ...between } });
    for (const name of focusTypes) {
      const drawn = drawnStarts(result, name);
      assert.ok(drawn.length > 0 && drawn.every(start => start < day(18, 0, 1) && start >= day(18, 0, 28, 9)), `${name}: only window sessions`);
      assert.ok(drawnStarts(priceOnly, name).some(start => !drawn.includes(start)), `${name}: the window changes the selection`);
    }
  });

  test('Focus Sessions Only hides the recent and developing sessions', () => {
    const result = deviations({ at: day(11), chart: '15', from: focusFrom, inputs: { focusMode: 'Date', focusSessionsOnly: true, ...endDate } });
    for (const name of focusTypes) {
      const starts = sessionsOf(result, name).map(sess => sess.startTime);
      assert.deepEqual(asNy(drawnStarts(result, name)), asNy(starts.filter(start => start <= day(12, 0, 1)).slice(-3)), name);
    }
    const developing = deviations({ at: day(23, 30, 7), chart: '15', from: focusFrom, inputs: { focusMode: 'Date', focusSessionsOnly: true, ...endDate } });
    const rafael = sessionStarting(developing, 'Rafael', day(21, 30, 7));
    assert.equal(coreBoxes(rafael).length + zoneBoxes(rafael).length, 0, 'developing Rafael is hidden');
    const normal = deviations({ at: day(23, 30, 7), chart: '15', from: focusFrom, inputs: { focusMode: 'Date', ...endDate } });
    assert.ok(coreBoxes(sessionStarting(normal, 'Rafael', day(21, 30, 7))).length > 0, 'developing Rafael shows without Focus Sessions Only');
  });

  test('invalid dates or Start after End switch Focus off', () => {
    const off = deviations({ at: day(11), chart: '15', from: focusFrom });
    for (const inputs of [{ ...endDate, focusEndMonth: 2, focusEndDay: 30 }, { ...between, focusStartMonth: 10, focusStartDay: 2 }]) {
      const result = deviations({ at: day(11), chart: '15', from: focusFrom, inputs: { focusMode: 'Date', focusSessionsOnly: true, ...inputs } });
      for (const name of focusTypes) assert.deepEqual(drawnStarts(result, name), drawnStarts(off, name), name);
    }
  });

  test('Bar Replay matches a live chart, and a Range chart selects by the same dates', () => {
    const inputs = { focusMode: 'Date', focusSessionsOnly: true, ...between };
    const live = deviations({ at: day(11), chart: '15', from: focusFrom, inputs });
    const replay = deviations({ at: day(11), chart: '15', from: focusFrom, mode: 'replay', inputs });
    const range = deviations({ at: day(11), chart: 'R180', from: focusFrom, inputs });
    for (const name of focusTypes) {
      assert.deepEqual(drawnStarts(replay, name), drawnStarts(live, name), `${name}: replay`);
      const rangeDrawn = drawnStarts(range, name);
      assert.ok(rangeDrawn.length > 0 && rangeDrawn.every(start => start < day(18, 0, 1) && start >= day(18, 0, 28, 9)), `${name}: range window`);
    }
  });
});

// ── Asia + Rafael retracement forecast ───────────────────────────────────────

describe('Deviations Asia + Rafael retracement forecast', () => {
  const forecastFrom = day(18, 0, 27, 9);
  const forecastRun = (inputs = {}) => deviations({ at: day(11), chart: '15', from: forecastFrom, inputs: { focusMode: 'Price', focusSessionCount: 20, retracementForecastEnabled: true, ...inputs } });
  const forecastLines = result => result.global('retracementForecastLines').filter(isLive);
  const windows = { 'Asia Open': 3 * HOUR, Rafael: 4 * HOUR };
  const BAR = 15 * MINUTE;

  // Expected unreached levels, from the candles: wick midpoint and the 0.618 back from the first
  // extreme taken, untouched after the origin bar. A replaced leg also counts its own start bar.
  function expectedForecasts(result) {
    const expected = [];
    for (const [name, length] of Object.entries(windows)) {
      for (const sess of sessionsOf(result, name)) {
        if (!sess.retraceOriginSide || sess.retraceTraversalCompleted || Number.isNaN(sess.actualEndTime)) continue;
        const range = wickRange(sess.startTime, sess.startTime + length);
        const height = range.high - range.low;
        const retracingUp = sess.retraceOriginSide === -1;
        const legStart = Number.isNaN(sess.retraceLegStartBar) ? sess.retraceOriginBar : sess.retraceLegStartBar;
        const from = Math.max(result.bars.time[sess.retraceOriginBar] + BAR, result.bars.time[legStart]);
        const after = candlesBetween(from, lastBarTime(result) + BAR);
        const levels = [(range.high + range.low) / 2, retracingUp ? range.low + height * 0.618 : range.high - height * 0.618];
        for (const level of levels) {
          const touched = after.some(c => (retracingUp ? c.high >= level : c.low <= level));
          if (!touched) expected.push({ name, start: sess.endTime, level, sess });
        }
      }
    }
    return expected;
  }
  const keyOf = (start, level) => `${formatNy(start)} @ ${level.toFixed(4)}`;

  test('Forecast draws every unreached Rafael and Asia Open 0.5 and 0.618 dotted from the session end to the current bar, tagged "0.5" / "0.618" inline and at its end', () => {
    const result = forecastRun({ forecastWithinAdrEnabled: false });
    const expected = expectedForecasts(result);
    assert.ok(expected.length > 3, 'the scenario has unreached levels to forecast');
    const drawn = forecastLines(result);
    assert.deepEqual(drawn.map(ln => keyOf(ln.x1, ln.y1)).sort(), expected.map(entry => keyOf(entry.start, entry.level)).sort());
    for (const ln of drawn) {
      const owner = expected.find(entry => keyOf(entry.start, entry.level) === keyOf(ln.x1, ln.y1)).sess;
      assert.equal(ln.style, 'line.style_dotted');
      assert.notEqual(ln.extend, 'extend.right');
      assert.equal(ln.x2, lastBarTime(result), 'stops at the current bar');
      assert.equal(ln.color, owner.mitigationColor, 'session mitigation color');
    }
    const forecastLabels = result.global('retracementForecastLabels').filter(isLive);
    for (const entry of expected) {
      const isMid = close(entry.level, (entry.sess.wickHigh + entry.sess.wickLow) / 2);
      const onLevel = forecastLabels.filter(lbl => close(lbl.y, entry.level));
      assert.ok(onLevel.length > 0, `${keyOf(entry.start, entry.level)} has inline tags`);
      for (const lbl of onLevel) {
        assert.equal(lbl.text, isMid ? '0.5' : '0.618');
        assert.equal(lbl.textcolor, entry.sess.retraceLabelTextColor);
        assert.equal(lbl.color, entry.sess.retraceLabelBgColor);
      }
      assert.equal(onLevel.filter(lbl => lbl.x === lastBarTime(result) && lbl.style === 'label.style_label_left').length, 1, `${keyOf(entry.start, entry.level)} has its end tag at the current bar`);
    }
  });

  test('Only Within ADR keeps just the levels inside Globex open ± 5-day ADR × multiplier', () => {
    const multiplier = 0.5;
    const tradingDayOf = t => { const p = localParts(t + 6 * HOUR, 'America/New_York'); return p.year * 10000 + p.month * 100 + p.day; };
    const days = new Map();
    for (const c of market.candles) {
      const key = tradingDayOf(c.time);
      const d = days.get(key) ?? { open: c.open, high: -Infinity, low: Infinity };
      d.high = Math.max(d.high, c.high);
      d.low = Math.min(d.low, c.low);
      days.set(key, d);
    }
    const keys = [...days.keys()].sort((a, b) => a - b);
    const today = keys.indexOf(tradingDayOf(day(11)));
    const adr = keys.slice(today - 5, today).reduce((sum, key) => sum + days.get(key).high - days.get(key).low, 0) / 5;
    const open = days.get(keys[today]).open;
    const [bandLow, bandHigh] = [open - adr * multiplier, open + adr * multiplier];

    const unfiltered = forecastLines(forecastRun({ forecastWithinAdrEnabled: false })).map(ln => keyOf(ln.x1, ln.y1) + '|' + ln.y1);
    const filtered = forecastLines(forecastRun({ forecastAdrMultiplier: multiplier })).map(ln => keyOf(ln.x1, ln.y1));
    const inside = unfiltered.filter(entry => { const level = Number(entry.split('|')[1]); return level >= bandLow && level <= bandHigh; }).map(entry => entry.split('|')[0]);
    assert.ok(inside.length > 0 && inside.length < unfiltered.length, 'the band keeps some levels and drops others');
    assert.deepEqual(filtered.sort(), inside.sort());
  });

  test('turning Forecast on leaves every other drawing exactly as it was', () => {
    const shape = (result, exclude) => ['box', 'line', 'label'].flatMap(kind => result.live(kind).filter(object => !exclude.has(object)).map(object => `${kind} ${JSON.stringify([object.x1 ?? object.left ?? object.x, object.y1 ?? object.top ?? object.y, object.x2 ?? object.right, object.y2 ?? object.bottom, object.text, object.color, object.style])}`)).sort();
    const off = forecastRun({ retracementForecastEnabled: false });
    const on = forecastRun({ forecastWithinAdrEnabled: false });
    const forecastObjects = new Set([...on.global('retracementForecastLines'), ...on.global('retracementForecastLabels')]);
    assert.deepEqual(shape(on, forecastObjects), shape(off, new Set()));
  });

  test('Forecast stays inside the 500-drawing limits with every session in Both mode and 20 Focus sessions', () => {
    const both = Object.fromEntries(['2130_0129', '1800_2100', '0600_0900', '0500_0915', '0930_1000'].flatMap(key => [[`opening_${key}`, 'Both'], [`opening_${key}_showLabels`, 'Both']]));
    const result = forecastRun({ ...both, quickFilter: 'All', forecastWithinAdrEnabled: false });
    for (const kind of ['box', 'line', 'label']) {
      const removed = result.all(kind).filter(object => object.garbageCollected);
      assert.equal(removed.length, 0, `${removed.length} ${kind}s were dropped by the ${kind} limit`);
    }
  });

  test('Bar Replay draws the same forecasts as a live chart, and a Range chart forecasts its own unreached levels', () => {
    const live = forecastLines(forecastRun({ forecastWithinAdrEnabled: false })).map(ln => keyOf(ln.x1, ln.y1)).sort();
    const replay = forecastLines(deviations({ at: day(11), chart: '15', from: forecastFrom, mode: 'replay', inputs: { focusMode: 'Price', focusSessionCount: 20, retracementForecastEnabled: true, forecastWithinAdrEnabled: false } })).map(ln => keyOf(ln.x1, ln.y1)).sort();
    assert.deepEqual(replay, live);
    const range = deviations({ at: day(11), chart: 'R180', hoursOfChart: 24 * 3, inputs: { retracementForecastEnabled: true, forecastWithinAdrEnabled: false } });
    const drawn = forecastLines(range);
    assert.ok(drawn.length > 0, 'Range chart draws forecasts');
    const owners = [...sessionsOf(range, 'Asia Open'), ...sessionsOf(range, 'Rafael')];
    for (const ln of drawn) {
      const owner = owners.find(sess => sess.actualEndTime === ln.x1 && (close(sess.midLevel, ln.y1) || close(sess.retraceLevel618, ln.y1)));
      assert.ok(owner, `forecast ${keyOf(ln.x1, ln.y1)} belongs to a session`);
      assert.equal(close(owner.midLevel, ln.y1) ? owner.midMitigated : owner.retrace618Mitigated, false, 'only unreached levels');
    }
  });

  test('Unmitigated mode draws no forecast', () => {
    assert.equal(forecastLines(forecastRun({ mitigationMode: 'Unmitigated', forecastWithinAdrEnabled: false })).length, 0);
  });
});
