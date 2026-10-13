import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadIndicator, runIndicator } from '../../../tests/runtime/run.mjs';
import { cmeMarket, nyTime, formatNy } from '../../../tests/runtime/scenario.mjs';
import { profileView } from './profile-view.mjs';

// Runs parallax.pine bar by bar on synthetic NQ data and checks what the chart would show.
// These pin approved behavior; they do not prove TradingView compilation or rendering.

const program = loadIndicator(new URL('../code/parallax.pine', import.meta.url).pathname);
const HOUR = 3_600_000;
const ALL_INTRADAY = { overnightShow: true, nyEarlyShow: true, nyAmShow: true, nyPmShow: true, ivbShow: true, ivbPlusShow: true };
const QUIET = { allTimeHighShow: false };
const SLOTS = {
  Daily: 'dailyProfileSlot', Overnight: 'overnightSlot', NYE: 'nyEarlySlot', NYAM: 'nyAmSlot', NYPM: 'nyPmSlot', IVB: 'ivbSlot', 'IVB+': 'ivbPlusSlot',
};

// Thursday 8 October 2026 is the test day; history starts in April so every lookback is full.
const day = (hour, minute = 0, date = 8) => nyTime(2026, 10, date, hour, minute);

function parallax({ at, chart = '1', mode = 'live', inputs = {}, market = cmeMarket(), hoursOfChart = 22, now }) {
  const chartSpec = chart.startsWith('R') ? { type: 'range', size: Number(chart.slice(1)) * 0.25 } : { type: 'time', tf: chart };
  return runIndicator(program, { market, chart: chartSpec, from: at - hoursOfChart * HOUR, until: at, mode, now, inputs: { ...QUIET, ...inputs } });
}

const view = (result, profile) => profileView(result, SLOTS[profile]);
const window = segment => (segment ? `${formatNy(segment.left.time)} → ${formatNy(segment.right.time)}` : 'hidden');
const expectWindow = (result, profile, start, end, part = 'current') => {
  assert.equal(window(view(result, profile)[part]), `${formatNy(start)} → ${formatNy(end)}`, `${profile} ${part}`);
};
const expectHidden = (result, profile, part = 'current') => assert.equal(view(result, profile)[part], null, `${profile} ${part} should be hidden`);

describe('Parallax session windows', () => {
  test('each intraday profile starts and ends at its New York time on 1m', () => {
    const result = parallax({ at: day(9, 30), inputs: { ...ALL_INTRADAY, hideCompleted: false } });
    expectWindow(result, 'Overnight', day(0), day(7));
    expectWindow(result, 'NYE', day(6), day(9));
    expectWindow(result, 'NYAM', day(8), day(12));
    expectWindow(result, 'IVB', day(9), day(10));
    expectWindow(result, 'IVB+', day(9), day(10, 30));
    expectWindow(result, 'NYPM', day(12, 0, 7), day(16, 0, 7));
  });

  test('the same windows hold on 15m', () => {
    const result = parallax({ at: day(9, 30), chart: '15', hoursOfChart: 72, inputs: { ...ALL_INTRADAY, hideCompleted: false } });
    expectWindow(result, 'Overnight', day(0), day(7));
    expectWindow(result, 'NYE', day(6), day(9));
    expectWindow(result, 'NYAM', day(8), day(12));
    expectWindow(result, 'IVB', day(9), day(10));
    expectWindow(result, 'IVB+', day(9), day(10, 30));
  });

  test('Daily runs 18:00 to 18:00 in Globex mode and midnight to midnight in Midnight mode', () => {
    expectWindow(parallax({ at: day(9, 30), chart: '15', hoursOfChart: 72 }), 'Daily', day(18, 0, 7), day(18));
    expectWindow(parallax({ at: day(9, 30), chart: '15', hoursOfChart: 72, inputs: { useMidnight: true } }), 'Daily', day(0), day(0, 0, 9));
  });

  test('on 60m, IVB (one hour) is unavailable while IVB+ (90 minutes) still shows', () => {
    const result = parallax({ at: day(10, 15), chart: '60', hoursOfChart: 24 * 7, inputs: { ivbShow: true, ivbPlusShow: true } });
    expectHidden(result, 'IVB');
    expectWindow(result, 'IVB+', day(9), day(10, 30));
  });

  test('windows stay on New York time across the November daylight-saving change', () => {
    const market = cmeMarket({ start: nyTime(2026, 6, 1, 18), end: nyTime(2026, 11, 4, 17) });
    const at = nyTime(2026, 11, 2, 9, 30);
    const result = parallax({ at, market, inputs: { ...ALL_INTRADAY, hideCompleted: false } });
    expectWindow(result, 'NYE', nyTime(2026, 11, 2, 6), nyTime(2026, 11, 2, 9));
    expectWindow(result, 'Overnight', nyTime(2026, 11, 2, 0), nyTime(2026, 11, 2, 7));
  });
});

describe('Parallax Hide Completed', () => {
  test('on: NYE disappears once 09:00 passes; off: it stays and ends at 09:00', () => {
    expectHidden(parallax({ at: day(9, 5), inputs: { nyEarlyShow: true } }), 'NYE');
    expectWindow(parallax({ at: day(9, 5), inputs: { nyEarlyShow: true, hideCompleted: false } }), 'NYE', day(6), day(9));
  });

  test('on: a finished profile stays hidden until its next window starts, then returns', () => {
    const beforeOpen = parallax({ at: day(5, 55, 9), inputs: { nyEarlyShow: true } });
    expectHidden(beforeOpen, 'NYE');
    const afterOpen = parallax({ at: day(6, 1, 9), inputs: { nyEarlyShow: true } });
    expectWindow(afterOpen, 'NYE', day(6, 0, 9), day(9, 0, 9));
  });

  test('on: Overnight hides at 07:00 while NYE and NYAM are still live', () => {
    const result = parallax({ at: day(8, 30), inputs: ALL_INTRADAY });
    expectHidden(result, 'Overnight');
    expectWindow(result, 'NYE', day(6), day(9));
    expectWindow(result, 'NYAM', day(8), day(12));
  });
});

describe('Parallax on Range charts (180R)', () => {
  // Price is flat from 08:40 to 09:20, so the last Range candle opens before 09:00 and is still forming.
  const flatMarket = () => cmeMarket({ flat: [[day(8, 40), day(9, 20)]] });
  const lastCandleOpen = result => result.bars.time[result.lastIndex];

  test('a chart loaded after 09:00 hides NYE even though its last candle opened before 09:00', () => {
    const result = parallax({ at: day(9, 5), chart: 'R180', mode: 'loaded', market: flatMarket(), hoursOfChart: 48, inputs: { nyEarlyShow: true } });
    assert.ok(lastCandleOpen(result) < day(9), `last candle opened ${formatNy(lastCandleOpen(result))}`);
    expectHidden(result, 'NYE');
  });

  test('with Hide Completed off, a finished NYE ends at 09:00 instead of running ahead', () => {
    const result = parallax({ at: day(9, 5), chart: 'R180', mode: 'loaded', market: flatMarket(), hoursOfChart: 48, inputs: { nyEarlyShow: true, hideCompleted: false } });
    expectWindow(result, 'NYE', day(6), day(9));
  });

  test('a live NYE reaches a capped number of bars past the last candle', () => {
    const result = parallax({ at: day(7, 30), chart: 'R180', hoursOfChart: 48, inputs: { nyEarlyShow: true } });
    const nye = view(result, 'NYE').current;
    assert.ok(nye?.right.barsPastLast > 1, `expected a projected edge, got ${JSON.stringify(nye?.right)}`);
    assert.ok(nye.right.barsPastLast <= 100, 'never beyond the Range Line Length');
  });

  test('a forecast starts where its own live profile ends and reaches one step further', () => {
    const result = parallax({ at: day(8, 30), chart: 'R180', hoursOfChart: 48, inputs: { ...ALL_INTRADAY, forecastMode: 'All' } });
    const daily = view(result, 'Daily');
    assert.ok(daily.current && daily.forecast, 'Daily shows both its live profile and its forecast');
    assert.equal(daily.forecast.left.barsPastLast, daily.current.right.barsPastLast, 'Daily forecast starts at the live Daily edge');
    const reach = profile => view(result, profile).forecast;
    for (const profile of ['Daily', 'NYPM', 'IVB', 'IVB+']) {
      const forecast = reach(profile);
      assert.equal(forecast.right.barsPastLast, 2 * forecast.left.barsPastLast, `${profile} forecast spans one step`);
    }
    assert.ok(reach('IVB').left.barsPastLast < reach('IVB+').left.barsPastLast, 'longer profiles reach further');
    assert.ok(reach('IVB+').left.barsPastLast < reach('NYPM').left.barsPastLast, 'longer profiles reach further');
  });
});

describe('Parallax in Bar Replay', () => {
  test('replaying 08:55 keeps NYE live although the real clock is days later', () => {
    expectWindow(parallax({ at: day(8, 55), mode: 'replay', inputs: { nyEarlyShow: true } }), 'NYE', day(6), day(9));
  });

  test('replaying 09:05 hides the finished NYE', () => {
    expectHidden(parallax({ at: day(9, 5), mode: 'replay', inputs: { nyEarlyShow: true } }), 'NYE');
  });
});

describe('Parallax forecasts', () => {
  const everything = mode => ({ ...ALL_INTRADAY, forecastMode: mode });

  test('Off shows no forecast', () => {
    const result = parallax({ at: day(8, 30), inputs: everything('Off') });
    for (const profile of Object.keys(SLOTS)) expectHidden(result, profile, 'forecast');
  });

  test('All shows every forecast inside its lead window, placed on its next session', () => {
    const result = parallax({ at: day(8, 30), inputs: everything('All') });
    expectWindow(result, 'IVB', day(9), day(10), 'forecast');
    expectWindow(result, 'IVB+', day(9), day(10, 30), 'forecast');
    expectWindow(result, 'NYPM', day(12), day(16), 'forecast');
    expectWindow(result, 'Daily', day(18), day(18, 0, 9), 'forecast');
    for (const profile of ['Overnight', 'NYE', 'NYAM']) expectHidden(result, profile, 'forecast');
  });

  test('Next shows only the soonest session, and sessions starting together show together', () => {
    const result = parallax({ at: day(8, 30), inputs: everything('Next') });
    expectWindow(result, 'IVB', day(9), day(10), 'forecast');
    expectWindow(result, 'IVB+', day(9), day(10, 30), 'forecast');
    for (const profile of ['NYPM', 'Daily', 'Overnight', 'NYE', 'NYAM']) expectHidden(result, profile, 'forecast');
  });

  test('Next moves to the Daily forecast once Daily is the soonest session', () => {
    const result = parallax({ at: day(16, 30), inputs: everything('Next') });
    expectWindow(result, 'Daily', day(18), day(18, 0, 9), 'forecast');
    for (const profile of ['Overnight', 'NYE', 'NYAM', 'NYPM', 'IVB', 'IVB+']) expectHidden(result, profile, 'forecast');
  });

  test('the Overnight forecast appears after the 17:00 maintenance break', () => {
    const result = parallax({ at: day(19), inputs: { overnightShow: true, forecastMode: 'All' } });
    expectWindow(result, 'Overnight', day(0, 0, 9), day(7, 0, 9), 'forecast');
  });

  test('weekday forecasts skip the weekend', () => {
    const result = parallax({ at: day(16, 30, 9), inputs: { ...ALL_INTRADAY, dailyProfileShow: false, forecastMode: 'All' } });
    for (const profile of ['Overnight', 'NYE', 'NYAM', 'NYPM', 'IVB', 'IVB+']) expectHidden(result, profile, 'forecast');
  });
});

describe('Parallax drawing budget', () => {
  test('with every profile and feature on, nothing is silently removed by TradingView limits', () => {
    const result = parallax({
      at: day(11), chart: '5', hoursOfChart: 24 * 5,
      inputs: {
        ...ALL_INTRADAY, slot1Show: true, slot2Show: true, weeklyProfileShow: true, monthlyProfileShow: true,
        latestOnly: false, forecastMode: 'All', forecastLiquidityDepth: true, ringScope: 'Active', ringStyle: 'Ring + Bands',
        dailyLiquidityDepth: true, ivbLiquidityDepth: true, ivbPlusLiquidityDepth: true, fibLabelHistory: true, hideCompleted: false,
      },
    });
    for (const kind of ['box', 'line', 'label']) {
      const removed = result.all(kind).filter(object => object.garbageCollected);
      assert.equal(removed.length, 0, `${removed.length} ${kind}s were dropped by the ${kind} limit`);
      assert.ok(result.live(kind).length <= 500);
    }
    assert.ok(result.live('box').length > 0 && result.live('line').length > 0);
  });
});
