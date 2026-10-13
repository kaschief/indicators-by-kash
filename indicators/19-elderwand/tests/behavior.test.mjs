import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadIndicator, runIndicator } from '../../../tests/runtime/run.mjs';
import { cmeMarket, nyTime, formatNy, isLive } from '../../../tests/runtime/scenario.mjs';

// Runs elderwand.pine bar by bar on synthetic NQ data and checks what the chart would show.
// functions.test.mjs pins individual functions; these pin the whole indicator. Expected VWAPs
// are recomputed here from the chart's own candles. They do not prove TradingView compilation or rendering.

const program = loadIndicator(new URL('../code/elderwand.pine', import.meta.url).pathname);
const ANCHORS = ['yearly', 'quarterly', 'monthly', 'weekly', 'rolling', 'daily', 'ny', 'nyEarlyHigh', 'nyEarlyLow'];

// Label merging is switched off except where a test is about merging, so every price keeps its own tag.
const SEPARATE_LABELS = { mergeOverlappingLabels: false };

// Thursday 8 October 2026 is the test day; the week opened Sunday 4 October at 18:00 NY.
const day = (hour, minute = 0, date = 8, month = 10) => nyTime(2026, month, date, hour, minute);

function elderwand({ at, chart = '1', from, mode = 'live', inputs = {}, market = cmeMarket() }) {
  const chartSpec = chart.startsWith('R') ? { type: 'range', size: Number(chart.slice(1)) * 0.25 } : { type: 'time', tf: chart };
  return runIndicator(program, { market, chart: chartSpec, from, until: at, mode, inputs: { ...SEPARATE_LABELS, ...inputs } });
}

// What one anchor currently shows: its centerline (start/end in NY time), band lines and fills.
function anchorView(result, name) {
  const anchor = result.global(name);
  const drawn = anchor.currentPeriod.polylines.filter(isLive);
  const lines = drawn.filter(p => !p.closed);
  const fills = drawn.filter(p => p.closed);
  const centerline = lines[0];
  return {
    anchor,
    lines,
    fills,
    start: centerline ? formatNy(centerline.points[0].time) : null,
    end: centerline ? formatNy(centerline.points.at(-1).time) : null,
    history: anchor.history.map(period => {
      const line = period.polylines.filter(isLive).find(p => !p.closed);
      return `${formatNy(line.points[0].time)} → ${formatNy(line.points.at(-1).time)}`;
    }),
  };
}

const labels = result => result.live('label').map(l => ({ text: l.text, price: l.y, time: formatNy(l.x), size: l.size }));
const labelTexts = result => labels(result).map(l => l.text).sort();
const labelNamed = (result, text) => labels(result).filter(l => l.text === text);

// Independent anchored VWAP over the chart's candles from `start` to `end` inclusive, weighting hlc3 by volume.
function expectedVwap(bars, start, end = Infinity) {
  let pv = 0, v = 0, p2v = 0, first = null, last = null;
  for (let i = 0; i < bars.time.length; i++) {
    const t = bars.time[i];
    if (t < start || t > end) continue;
    const price = (bars.high[i] + bars.low[i] + bars.close[i]) / 3;
    pv += price * bars.volume[i]; v += bars.volume[i]; p2v += price * price * bars.volume[i];
    first ??= t; last = t;
  }
  const vwap = pv / v;
  return { vwap, sd: Math.sqrt(Math.max(p2v / v - vwap * vwap, 0)), first, last };
}

const close = (actual, expected, what) => assert.ok(Math.abs(actual - expected) < 1e-6, `${what}: ${actual} != ${expected}`);

// The VWAP label and each σ pair sit exactly where the independent VWAP puts them.
function expectPrices(result, displayName, expected, sigmas) {
  const [vwapLabel] = labelNamed(result, `★ ${displayName} VWAP`);
  assert.ok(vwapLabel, `${displayName} VWAP label is on the chart`);
  close(vwapLabel.price, expected.vwap, `${displayName} VWAP`);
  for (const k of sigmas) {
    const tags = labelNamed(result, `${displayName} ${k}σ`).map(l => l.price).sort((a, b) => b - a);
    assert.equal(tags.length, 2, `${displayName} ${k}σ has an upper and lower tag`);
    close(tags[0], expected.vwap + k * expected.sd, `${displayName} +${k}σ`);
    close(tags[1], expected.vwap - k * expected.sd, `${displayName} -${k}σ`);
  }
}

describe('Elderwand defaults (Weekly + Daily)', () => {
  test('on 1m, Daily starts at the 18:00 reopen and its VWAP and 2σ/3σ bands match the candles', () => {
    const result = elderwand({ at: day(10, 30), from: day(12, 0, 7) });
    const daily = anchorView(result, 'daily');
    assert.equal(daily.start, '2026-10-07 18:00 NY');
    assert.equal(daily.end, '2026-10-08 10:29 NY', 'Daily reaches the forming candle');
    assert.equal(daily.lines.length, 5, 'centerline plus 2σ and 3σ pairs; 1σ is off by default');
    assert.equal(daily.fills.length, 1, 'Daily carries its 2σ cloud');
    expectPrices(result, 'Daily', expectedVwap(result.bars, day(18, 0, 7)), [2, 3]);
    assert.deepEqual(labelTexts(result).filter(t => t.startsWith('★')), ['★ Daily VWAP', '★ Weekly VWAP']);
    for (const name of ['yearly', 'quarterly', 'monthly', 'rolling', 'ny', 'nyEarlyHigh', 'nyEarlyLow']) {
      assert.equal(anchorView(result, name).lines.length, 0, `${name} stays off by default`);
    }
  });

  test('on 15m, Weekly starts at the Sunday 18:00 open, Daily at 18:00 last night, both matching the candles', () => {
    const result = elderwand({ at: day(10, 30), chart: '15', from: day(12, 0, 2) });
    const weekly = anchorView(result, 'weekly');
    const daily = anchorView(result, 'daily');
    assert.equal(weekly.start, '2026-10-04 18:00 NY');
    assert.equal(daily.start, '2026-10-07 18:00 NY');
    assert.equal(weekly.fills.length, 0, 'Weekly has no cloud by default');
    assert.equal(weekly.lines.length, 5);
    expectPrices(result, 'Weekly', expectedVwap(result.bars, day(18, 0, 4)), [2, 3]);
    expectPrices(result, 'Daily', expectedVwap(result.bars, day(18, 0, 7)), [2, 3]);
    assert.equal(labelNamed(result, '★ Weekly VWAP')[0].size, 'size.small');
    assert.equal(labelNamed(result, '★ Daily VWAP')[0].size, 'size.tiny');
  });

  test('at the Sunday open, identical Weekly and Daily collapse into one "Weekly • Daily" set of lines and labels', () => {
    const result = elderwand({ at: day(19, 0, 4), from: day(17, 0, 4) });
    assert.deepEqual(labelTexts(result), ['Weekly • Daily 2σ', 'Weekly • Daily 2σ', 'Weekly • Daily 3σ', 'Weekly • Daily 3σ', '★ Weekly • Daily VWAP']);
    assert.equal(anchorView(result, 'weekly').start, '2026-10-04 18:00 NY');
    assert.equal(anchorView(result, 'weekly').lines.length, 5, 'one set of lines, in Weekly colour');
    assert.equal(anchorView(result, 'daily').lines.length, 0, 'Daily draws no duplicate lines');
    assert.equal(result.live('polyline').filter(p => p.closed).length, 1, 'a single 2σ cloud');
    expectPrices(result, 'Weekly • Daily', expectedVwap(result.bars, day(18, 0, 4)), [2, 3]);
  });

  test('VWAP Lines Only leaves just the centerlines and their two labels: no σ lines, tags or clouds', () => {
    const result = elderwand({ at: day(10, 30), from: day(12, 0, 7), inputs: { vwapLinesOnly: true } });
    assert.equal(result.live('polyline').length, 2);
    assert.deepEqual(labelTexts(result), ['★ Daily VWAP', '★ Weekly VWAP']);
  });
});

describe('Elderwand period rollovers', () => {
  const autumnMarket = () => cmeMarket({ start: nyTime(2026, 9, 20, 18), end: nyTime(2026, 11, 4, 17) });
  const winterMarket = () => cmeMarket({ start: nyTime(2025, 12, 1, 18), end: nyTime(2026, 2, 6, 17) });

  test('in November, Quarterly still runs from the first Q4 session while Monthly has restarted on 1 November', () => {
    const inputs = { quickFilter: '● ● ● Quarterly + Monthly', monthlyShowLast: 2 };
    const result = elderwand({ at: day(10, 0, 3, 11), chart: '60', market: autumnMarket(), from: day(12, 0, 25, 9), inputs });
    const quarterly = anchorView(result, 'quarterly');
    const monthly = anchorView(result, 'monthly');
    assert.equal(quarterly.start, '2026-09-30 18:00 NY');
    assert.deepEqual(quarterly.history, [], 'Quarterly did not reset at the month change');
    assert.equal(monthly.start, '2026-11-01 18:00 NY');
    assert.deepEqual(monthly.history, ['2026-09-30 18:00 NY → 2026-10-30 16:00 NY'], 'October is kept as the previous Monthly');
    assert.deepEqual(labelTexts(result).filter(t => t.startsWith('★')), ['★ Monthly VWAP', '★ Quarterly VWAP']);
    expectPrices(result, 'Quarterly', expectedVwap(result.bars, day(18, 0, 30, 9)), [2, 3]);
    expectPrices(result, 'Monthly', expectedVwap(result.bars, day(18, 0, 1, 11)), [2, 3]);
  });

  test('in February, Yearly and Quarterly run from the first session of the year as one "Yearly • Quarterly" while Monthly rolls each month', () => {
    const inputs = { quickFilter: '● ● ● ● Yearly + Quarterly + Monthly', yearlyShowLast: 2, monthlyShowLast: 3 };
    const result = elderwand({ at: nyTime(2026, 2, 4, 10), chart: '60', market: winterMarket(), from: nyTime(2025, 12, 20), inputs });
    const yearly = anchorView(result, 'yearly');
    const newYear = nyTime(2025, 12, 31, 18);
    assert.equal(yearly.start, '2025-12-31 18:00 NY');
    assert.equal(result.global('quarterly').barTimes[0], newYear, 'Quarterly starts on the same bar');
    assert.equal(anchorView(result, 'quarterly').lines.length, 0, 'Quarterly draws no duplicate lines');
    assert.equal(yearly.history.length, 1, 'only the pre-January stretch is archived: no monthly resets');
    assert.equal(anchorView(result, 'monthly').start, '2026-02-01 18:00 NY');
    assert.equal(anchorView(result, 'monthly').history.at(-1), '2025-12-31 18:00 NY → 2026-01-30 16:00 NY');
    assert.deepEqual(labelTexts(result).filter(t => t.startsWith('★')), ['★ Monthly VWAP', '★ Yearly • Quarterly VWAP']);
    expectPrices(result, 'Yearly • Quarterly', expectedVwap(result.bars, newYear), [2, 3]);
  });

  test('Daily rolls at 18:00; Show Last 3 keeps the two previous sessions, each ending before the 17:00 break', () => {
    const at = day(18, 30);
    const shown = elderwand({ at, chart: '15', from: day(12, 0, 4), inputs: { quickFilter: 'Daily Only', dailyShowLast: 3 } });
    const daily = anchorView(shown, 'daily');
    assert.equal(daily.start, '2026-10-08 18:00 NY');
    assert.deepEqual(daily.history, ['2026-10-06 18:00 NY → 2026-10-07 16:45 NY', '2026-10-07 18:00 NY → 2026-10-08 16:45 NY']);
    for (const period of daily.anchor.history) {
      assert.equal(period.polylines.filter(p => p.closed && isLive(p)).length, 1, 'past sessions keep their 2σ cloud');
    }
    const latestOnly = anchorView(elderwand({ at, chart: '15', from: day(12, 0, 4), inputs: { quickFilter: 'Daily Only' } }), 'daily');
    assert.deepEqual(latestOnly.history, [], 'Show Last 1 shows only the session in progress');
    assert.equal(latestOnly.start, '2026-10-08 18:00 NY');
  });

  test('Quarterly and Monthly both restart with the first October session and merge into one "Quarterly • Monthly" on 60m', () => {
    const result = elderwand({ at: day(10, 0, 2), chart: '60', from: day(0, 0, 20, 9), inputs: { quickFilter: '● ● ● Quarterly + Monthly' } });
    const quarterly = anchorView(result, 'quarterly');
    assert.equal(quarterly.start, '2026-09-30 18:00 NY');
    assert.equal(anchorView(result, 'monthly').lines.length, 0);
    assert.equal(result.global('monthly').barTimes[0], day(18, 0, 30, 9), 'Monthly starts on the same bar');
    assert.deepEqual(labelTexts(result).filter(t => t.startsWith('★')), ['★ Quarterly • Monthly VWAP']);
    assert.equal(labelNamed(result, '★ Quarterly • Monthly VWAP')[0].size, 'size.normal');
    expectPrices(result, 'Quarterly • Monthly', expectedVwap(result.bars, day(18, 0, 30, 9)), [2, 3]);
  });

  test('after the November clock change, Daily and Weekly still restart at 18:00 New York time', () => {
    const result = elderwand({ at: day(10, 0, 3, 11), chart: '15', market: autumnMarket(), from: day(12, 0, 30) });
    assert.equal(anchorView(result, 'weekly').start, '2026-11-01 18:00 NY');
    assert.equal(anchorView(result, 'daily').start, '2026-11-02 18:00 NY');
    expectPrices(result, 'Daily', expectedVwap(result.bars, day(18, 0, 2, 11)), [2, 3]);
  });
});

describe('Elderwand NY session VWAP', () => {
  test('Session only: the NY VWAP covers 09:30 to the 15:59 candle and matches the cash-session candles', () => {
    const result = elderwand({ at: day(16, 30), from: day(9), inputs: { quickFilter: 'NY Only' } });
    const ny = anchorView(result, 'ny');
    assert.equal(ny.start, '2026-10-08 09:30 NY');
    assert.equal(ny.end, '2026-10-08 15:59 NY');
    assert.equal(ny.fills.length, 1, 'NY carries its 2σ cloud');
    expectPrices(result, 'NY', expectedVwap(result.bars, day(9, 30), day(15, 59)), [2, 3]);
  });

  test('To 18:00: the NY VWAP keeps accumulating after the close through the 18:00 candle, then stops', () => {
    const result = elderwand({ at: day(19), from: day(9), inputs: { quickFilter: 'NY Only', nyExtension: 'To 18:00' } });
    const ny = anchorView(result, 'ny');
    assert.equal(ny.start, '2026-10-08 09:30 NY');
    assert.equal(ny.end, '2026-10-08 18:00 NY');
    expectPrices(result, 'NY', expectedVwap(result.bars, day(9, 30), day(18)), [2, 3]);
  });

  test('before the next open, yesterday\'s NY VWAP stays on the chart', () => {
    const result = elderwand({ at: day(8, 0, 9), chart: '15', from: day(6), inputs: { quickFilter: 'NY Only' } });
    const ny = anchorView(result, 'ny');
    assert.equal(ny.start, '2026-10-08 09:30 NY');
    assert.equal(ny.end, '2026-10-08 15:45 NY');
  });
});

describe('Elderwand NY Early AVWAP', () => {
  // The first candle of the window that sets the extreme (a later equal extreme does not move it).
  function extremeBar(bars, from, to, side) {
    let best = -1;
    for (let i = 0; i < bars.time.length; i++) {
      if (bars.time[i] < from || bars.time[i] >= to) continue;
      const value = side === 'high' ? bars.high[i] : bars.low[i];
      const current = best < 0 ? null : side === 'high' ? bars.high[best] : bars.low[best];
      if (best < 0 || (side === 'high' ? value > current : value < current)) best = i;
    }
    return bars.time[best];
  }

  test('default: anchors at yesterday\'s 06:00–09:00 high candle on 1m and runs through the forming candle', () => {
    const result = elderwand({ at: day(10), from: day(18, 0, 6), inputs: { quickFilter: 'NY Early Only' } });
    const origin = extremeBar(result.bars, day(6, 0, 7), day(9, 0, 7), 'high');
    const high = anchorView(result, 'nyEarlyHigh');
    assert.equal(high.start, formatNy(origin));
    assert.equal(high.end, '2026-10-08 09:59 NY');
    assert.equal(high.lines.length, 7, 'centerline plus 1σ, 2σ and 3σ pairs');
    assert.equal(high.fills.length, 1, '1σ cloud');
    assert.equal(anchorView(result, 'nyEarlyLow').lines.length, 0, 'only the High side draws');
    expectPrices(result, 'NY Early High', expectedVwap(result.bars, origin), [1, 2, 3]);
  });

  test('Low side, 06:00–09:30 window, Anchor From 2: anchors at the low of two sessions ago on 15m', () => {
    const inputs = { quickFilter: 'NY Early Only', nyEarlyAnchorSide: 'Low', nyEarlyWindow: '06:00–09:30', nyEarlyAnchorFrom: 2 };
    const result = elderwand({ at: day(10), chart: '15', from: day(12, 0, 4), inputs });
    const origin = extremeBar(result.bars, day(6, 0, 6), day(9, 30, 6), 'low');
    const low = anchorView(result, 'nyEarlyLow');
    assert.equal(low.start, formatNy(origin));
    assert.equal(anchorView(result, 'nyEarlyHigh').lines.length, 0);
    expectPrices(result, 'Extended NY Early Low', expectedVwap(result.bars, origin), [1, 2, 3]);
  });
});

describe('Elderwand on Range charts (180R)', () => {
  const at = day(10);
  const from = day(12, 0, 2);
  const firstRangeBarFrom = (bars, time) => bars.time.find(t => t >= time);

  test('Daily and Weekly start at the first Range candle that opens after the 18:00 reopen and match its candles', () => {
    const result = elderwand({ at, chart: 'R180', from });
    const dailyStart = firstRangeBarFrom(result.bars, day(18, 0, 7));
    const weeklyStart = firstRangeBarFrom(result.bars, day(18, 0, 4));
    assert.equal(anchorView(result, 'daily').start, formatNy(dailyStart));
    assert.equal(anchorView(result, 'weekly').start, formatNy(weeklyStart));
    assert.equal(result.global('daily').barTimes[0], dailyStart);
    const daily = expectedVwap(result.bars, dailyStart);
    const weekly = expectedVwap(result.bars, weeklyStart);
    assert.equal(formatNy(daily.last), anchorView(result, 'daily').end, 'Daily reaches the forming Range candle');
    expectPrices(result, 'Daily', daily, [2, 3]);
    expectPrices(result, 'Weekly', weekly, [2, 3]);
    // The merge test below relies on this picture: Weekly VWAP sits within 0.025% of a Daily 3σ edge but not within 0.005%.
    const gap = Math.min(...[1, -1].map(side => Math.abs(weekly.vwap - (daily.vwap + side * 3 * daily.sd))));
    assert.ok(gap <= weekly.vwap * 0.00025 && gap > weekly.vwap * 0.00005, `gap ${gap}`);
  });

  test('labels within the Wide distance share one tag led by the higher timeframe; Strict or Merge off splits them', () => {
    const wide = elderwand({ at, chart: 'R180', from, inputs: { mergeOverlappingLabels: true } });
    const [merged] = labelNamed(wide, '★ Weekly VWAP • Daily 3σ');
    assert.ok(merged, 'Weekly VWAP and the nearby Daily 3σ share one label');
    close(merged.price, expectedVwap(wide.bars, firstRangeBarFrom(wide.bars, day(18, 0, 4))).vwap, 'merged label sits on Weekly VWAP');
    assert.equal(merged.size, 'size.small', 'Weekly styling wins');
    assert.equal(wide.live('label').length, 9);
    for (const inputs of [{ mergeOverlappingLabels: true, labelMergePreset: 'Strict' }, { mergeOverlappingLabels: false }]) {
      const split = elderwand({ at, chart: 'R180', from, inputs });
      assert.equal(split.live('label').length, 10, JSON.stringify(inputs));
      assert.equal(labelNamed(split, '★ Weekly VWAP').length, 1);
      assert.equal(labelNamed(split, 'Daily 3σ').length, 2);
    }
  });
});

describe('Elderwand Rolling VWAP and Bar Replay', () => {
  test('Rolling 2 sessions starts at midnight NY yesterday and waits for each candle to close; a loaded chart includes the last one', () => {
    const inputs = { quickFilter: 'Rolling Only', rollingSessions: 2 };
    const live = elderwand({ at: day(10), chart: '15', from: day(0, 0, 5), inputs });
    const rolling = anchorView(live, 'rolling');
    assert.equal(rolling.start, '2026-10-07 00:00 NY');
    assert.equal(rolling.end, '2026-10-08 09:30 NY', 'the forming 09:45 candle is not in the line yet');
    assert.equal(rolling.fills.length, 0);
    expectPrices(live, 'Rolling', expectedVwap(live.bars, day(0, 0, 7), day(9, 30)), [2, 3]);
    const loaded = elderwand({ at: day(10), chart: '15', from: day(0, 0, 5), mode: 'loaded', inputs });
    assert.equal(anchorView(loaded, 'rolling').end, '2026-10-08 09:45 NY');
    expectPrices(loaded, 'Rolling', expectedVwap(loaded.bars, day(0, 0, 7), day(9, 45)), [2, 3]);
  });

  test('in Bar Replay the anchors track the replayed candle exactly as on a live chart', () => {
    const replay = elderwand({ at: day(9, 45), from: day(5, 30, 7), mode: 'replay', inputs: { quickFilter: '● Weekly + Daily + NY Early' } });
    const live = elderwand({ at: day(9, 45), from: day(5, 30, 7), mode: 'live', inputs: { quickFilter: '● Weekly + Daily + NY Early' } });
    assert.deepEqual(labels(replay), labels(live));
    assert.equal(anchorView(replay, 'daily').end, '2026-10-08 09:44 NY');
    assert.equal(anchorView(replay, 'daily').start, '2026-10-07 18:00 NY');
    assert.ok(labelNamed(replay, '★ NY Early High VWAP').length === 1, 'NY Early High shows in Replay');
  });
});

describe('Elderwand drawing budget', () => {
  test('every anchor, band and cloud on together stays inside the polyline and label limits', () => {
    const inputs = { quickFilter: 'Manual', rollingSessions: 5 };
    for (const key of ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'ny', 'nyEarly', 'rolling']) {
      Object.assign(inputs, { [`${key}Show`]: true, [`${key}Band1Choice`]: '1', [`${key}Band2Choice`]: '2', [`${key}Band3Choice`]: '3', [`${key}FillRange`]: '3σ to -3σ' });
    }
    const result = elderwand({ at: day(12, 30), chart: '60', from: day(0, 0, 1, 9), inputs });
    for (const name of ANCHORS.filter(name => name !== 'nyEarlyLow')) {
      assert.ok(anchorView(result, name).lines.length > 0 || !result.global(name).drawVisible, `${name} draws`);
    }
    for (const kind of ['polyline', 'label']) {
      const removed = result.all(kind).filter(object => object.garbageCollected);
      assert.equal(removed.length, 0, `${removed.length} ${kind}s were dropped by the ${kind} limit`);
      assert.ok(result.live(kind).length <= 100);
    }
    assert.ok(result.live('label').length >= 40, 'every anchor keeps its VWAP and σ tags');
    assert.equal(anchorView(result, 'yearly').lines.length, 7, 'Yearly draws on its own, apart from Quarterly • Monthly');
    assert.equal(labelNamed(result, '★ Quarterly • Monthly VWAP').length, 1);
  });
});
