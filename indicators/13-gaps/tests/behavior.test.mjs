import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadIndicator, runIndicator } from '../../../tests/runtime/run.mjs';
import { Market, isGlobexOpen } from '../../../tests/runtime/market.mjs';
import { cmeMarket, nyTime, formatNy, edge, isLive } from '../../../tests/runtime/scenario.mjs';
import { isNa } from '../../../tests/runtime/values.mjs';

// Runs gaps.pine bar by bar on scripted NQ prices and checks what the chart would show.
// These pin current behavior; they do not prove TradingView compilation or rendering.

const program = loadIndicator(new URL('../code/gaps.pine', import.meta.url).pathname);
const MINUTE = 60_000;
const member = (enumName, name) => program.enums.get(enumName).members[name];
const HISTORICAL = { displayMode: member('DisplayMode', 'historical') };

// October 2026: Friday 2nd, Sunday 4th, Monday 5th ... Friday 9th.
const day = (date, hour, minute = 0) => nyTime(2026, 10, date, hour, minute);

// One-minute candles that follow straight lines between [time, price] keyframes. Two keyframes at
// the same time make a price jump there, which is how a session opens away from the prior close.
// Candles have no wicks, so every high and low is chosen by the script.
function scriptedMarket(keys, start = day(1, 18), end = day(9, 17)) {
  const priceAt = (time, fromLeft) => {
    if (time <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t0, p0] = keys[i - 1];
      const [t1, p1] = keys[i];
      if (time < t1 || (fromLeft && time === t1)) return t0 === t1 ? p0 : Math.round((p0 + ((p1 - p0) * (time - t0)) / (t1 - t0)) * 4) / 4;
    }
    return keys.at(-1)[1];
  };
  const candles = [];
  for (let time = start; time < end; time += MINUTE) {
    if (!isGlobexOpen(time)) continue;
    const open = priceAt(time, false);
    const close = priceAt(time + MINUTE, true);
    candles.push({ time, open, close, high: Math.max(open, close), low: Math.min(open, close), volume: 100 });
  }
  return new Market(candles);
}

// Friday RTH closes at 20000. Sunday opens at 20100 (NWOG + NDOG 20000–20100). Monday opens RTH at
// 20200 (RTH gap 20000–20200) and sells to 20100 by noon (half filled). Monday 18:00 reopens at 20300
// (NDOG 20100–20300), Tuesday opens RTH at 20400 (RTH gap 20100–20400), then sells to 19950 by 11:00,
// filling everything: Tuesday's gaps at 10:29, Monday's RTH gap and the Sunday gap at 10:49.
const WEEK = scriptedMarket([
  [day(1, 18), 20000], [day(4, 18), 20000], [day(4, 18), 20100], [day(5, 8), 20100], [day(5, 9, 30), 20200],
  [day(5, 12), 20100], [day(5, 18), 20100], [day(5, 18), 20300], [day(6, 9, 30), 20400], [day(6, 11), 19950],
]);

// Price steps up 100 points every night between 18:00 and 09:30, so each day leaves an open RTH gap
// below price: Mon 20000–20100, Tue 20100–20200, Wed 20200–20300, Thu 20300–20400. Thursday at
// 12:00–13:00 sells to 20150, filling Thursday's and Wednesday's gaps and half of Tuesday's.
const STAIRCASE = scriptedMarket([
  [day(1, 18), 20000], [day(4, 18), 20000], [day(5, 9, 30), 20100], [day(5, 18), 20100], [day(6, 9, 30), 20200],
  [day(6, 18), 20200], [day(7, 9, 30), 20300], [day(7, 18), 20300], [day(8, 9, 30), 20400], [day(8, 12), 20400], [day(8, 13), 20150],
]);

// Charts start on Friday 2 October at noon, before the first RTH close the scripts depend on.
const runs = new Map();
function gaps({ at, chart = '1', mode = 'live', inputs = {}, market = WEEK }) {
  const key = JSON.stringify([at, chart, mode, inputs, market === WEEK]);
  if (!runs.has(key)) {
    const chartSpec = chart.startsWith('R') ? { type: 'range', size: Number(chart.slice(1)) * 0.25 } : { type: 'time', tf: chart };
    runs.set(key, runIndicator(program, { market, chart: chartSpec, from: day(2, 12), until: at, mode, inputs }));
  }
  return runs.get(key);
}

const findGap = (result, type, created) => {
  const gap = result.global('gaps').find(item => item.gapType.name === type && item.creationTime === created);
  assert.ok(gap, `no ${type} gap created ${formatNy(created)}`);
  return gap;
};

const shown = color => !isNa(color);
const band = box => [box.bottom, box.top];

// What a gap's anchored (historical) drawing shows, or null when it has none.
function zone(result, gap) {
  const boxes = [gap.topUnfilledBox, gap.filledBox, gap.bottomUnfilledBox];
  if (!boxes.every(isLive)) return null;
  const [top, filled, bottom] = boxes;
  return {
    from: edge(result, top, 'left'),
    to: edge(result, top, 'right'),
    unfilled: [top, bottom].filter(box => shown(box.bgcolor)).map(band),
    filled: shown(filled.bgcolor) ? band(filled) : null,
    label: gap.dateLabel.text,
  };
}

// What a floating gap in the right margin shows, or null when it is blank.
function float(result, floating) {
  if (isNa(floating) || floating.dateLabel.text === '') return null;
  const boxes = [floating.topUnfilledBox, floating.filledBox, floating.bottomUnfilledBox];
  return {
    from: edge(result, boxes[0], 'left').barsPastLast,
    to: edge(result, boxes[0], 'right').barsPastLast,
    unfilled: [boxes[0], boxes[2]].filter(box => shown(box.bgcolor)).map(band),
    filled: shown(boxes[1].bgcolor) ? band(boxes[1]) : null,
    label: floating.dateLabel.text,
    border: floating.topBorderLine.color,
  };
}

const at = time => formatNy(time);
const timeSpan = view => `${at(view.from.time)} → ${at(view.to.time)}`;
const liveEdge = result => result.bars.time[result.lastIndex] + 3 * (result.bars.time[1] - result.bars.time[0]);

describe('Gaps: what each gap draws (Historical display, 1m)', () => {
  test('Sunday 18:00 opening above Friday\'s close draws one shared NWOG / NDOG zone running to the live candle', () => {
    const result = gaps({ at: day(5, 13), inputs: HISTORICAL });
    const nwog = zone(result, findGap(result, 'nwog', day(4, 18)));
    assert.equal(timeSpan(nwog), `${at(day(4, 18))} → ${at(liveEdge(result))}`);
    assert.deepEqual(nwog.unfilled, [[20000, 20100]]);
    assert.equal(nwog.label, 'NWOG / NDOG 0%\nOct 4, 2026');
    assert.equal(zone(result, findGap(result, 'ndog', day(4, 18))), null, 'the Sunday NDOG twin is not drawn twice');
  });

  test('RTH gap spans the 16:14 close to the 09:30 open; a half fill from above greys the top half and reads 50%', () => {
    const result = gaps({ at: day(5, 13), inputs: HISTORICAL });
    const rth = zone(result, findGap(result, 'rth', day(5, 9, 30)));
    assert.equal(at(rth.from.time), at(day(5, 9, 30)));
    assert.deepEqual(rth.filled, [20100, 20200]);
    assert.deepEqual(rth.unfilled, [[20000, 20100]]);
    assert.equal(rth.label, 'RTH 50%\nOct 5, 2026');
  });

  test('a weekday 18:00 reopen away from the 17:00 close draws an NDOG dated that evening', () => {
    const result = gaps({ at: day(5, 19), inputs: HISTORICAL });
    const ndog = zone(result, findGap(result, 'ndog', day(5, 18)));
    assert.equal(timeSpan(ndog), `${at(day(5, 18))} → ${at(liveEdge(result))}`);
    assert.deepEqual(ndog.unfilled, [[20100, 20300]]);
    assert.equal(ndog.label, 'NDOG 0%\nOct 5, 2026');
  });

  test('a filled gap turns grey with ✓ and stops at the later of its fill and the next RTH open', () => {
    const tuesday = gaps({ at: day(6, 12), inputs: HISTORICAL });
    const monday = zone(tuesday, findGap(tuesday, 'rth', day(5, 9, 30)));
    assert.equal(at(monday.to.time), at(day(6, 10, 49)), 'filled after Tuesday\'s open: ends at the fill');
    assert.deepEqual(monday.filled, [20000, 20200]);
    assert.deepEqual(monday.unfilled, []);
    assert.equal(monday.label, 'RTH ✓\nOct 5, 2026');
    const sameDay = zone(tuesday, findGap(tuesday, 'rth', day(6, 9, 30)));
    assert.equal(at(sameDay.to.time), at(liveEdge(tuesday)), 'filled the same day: runs on until the next RTH open');

    const wednesday = gaps({ at: day(7, 10), inputs: HISTORICAL });
    assert.equal(at(zone(wednesday, findGap(wednesday, 'rth', day(6, 9, 30))).to.time), at(day(7, 9, 30)));
    assert.equal(at(zone(wednesday, findGap(wednesday, 'ndog', day(5, 18))).to.time), at(day(6, 18)), 'NDOG stops at the next 18:00 open');
    assert.equal(at(zone(wednesday, findGap(wednesday, 'nwog', day(4, 18))).to.time), at(liveEdge(wednesday)), 'NWOG runs until next Sunday');
  });

  test('on 15m the same gaps fill on the 15m candle that trades through them', () => {
    const result = gaps({ at: day(6, 12), chart: '15', inputs: HISTORICAL });
    const monday = zone(result, findGap(result, 'rth', day(5, 9, 30)));
    assert.equal(timeSpan(monday), `${at(day(5, 9, 30))} → ${at(day(6, 10, 45))}`);
    assert.equal(monday.label, 'RTH ✓\nOct 5, 2026');
    assert.equal(result.global('gaps').length, 5);
  });

  test('30m and 60m charts draw no gaps at all', () => {
    for (const chart of ['30', '60']) {
      const result = gaps({ at: day(6, 12), chart, inputs: HISTORICAL });
      assert.equal(result.global('gaps').length, 0, `${chart}m stores no gaps`);
      for (const kind of ['box', 'line', 'label']) assert.equal(result.live(kind).length, 0, `${chart}m draws no ${kind}s`);
    }
  });
});

describe('Gaps: Upcoming RTH preview', () => {
  const draftView = result => {
    const draft = result.global('rthDraft');
    if (isNa(draft)) return null;
    return { band: band(draft.bodyBox), from: edge(result, draft.bodyBox, 'left').barsPastLast, to: edge(result, draft.bodyBox, 'right').barsPastLast, label: draft.dateLabel.text };
  };

  test('after Friday\'s 16:15 close the preview spans RTH close to price, 200 bars right, dated Monday', () => {
    const view = draftView(gaps({ at: day(4, 19) }));
    assert.deepEqual(view, { band: [20000, 20100], from: 200, to: 210, label: 'Upcoming RTH\nOct 5, 2026' });
  });

  test('on a weekday evening it is dated the next day, and it disappears at the 09:30 open', () => {
    assert.equal(draftView(gaps({ at: day(5, 19) })).label, 'Upcoming RTH\nOct 6, 2026');
    const afterOpen = gaps({ at: day(6, 9, 31) });
    assert.equal(draftView(afterOpen), null);
    assert.equal(afterOpen.live('box').filter(box => shown(box.bgcolor) && box.bgcolor.r === 255 && box.bgcolor.g === 152).length, 0, 'no orange preview box remains');
  });
});

describe('Gaps: floating display modes', () => {
  test('default: the newest open RTH and NWOG float in the right margin (RTH at 200, NWOG at 228) instead of on history', () => {
    const result = gaps({ at: day(5, 13) });
    const rth = float(result, result.global('floatingRTH'));
    assert.equal(rth.from, 200);
    assert.equal(rth.to, 210);
    assert.deepEqual(rth.filled, [20100, 20200]);
    assert.equal(rth.label, 'RTH 50%\nOct 5, 2026');
    const nwog = float(result, result.global('floatingNWOG'));
    assert.equal(nwog.from, 228);
    assert.equal(nwog.label, 'NWOG / NDOG 0%\nOct 4, 2026');
    assert.ok(isNa(result.global('floatingNDOG')), 'the Sunday NDOG twin does not float separately');
    assert.equal(zone(result, findGap(result, 'rth', day(5, 9, 30))), null, 'a floating gap is not also drawn on history');
  });

  test('default: once everything fills the floats go blank and the gaps draw on history', () => {
    const result = gaps({ at: day(6, 12) });
    for (const name of ['floatingRTH', 'floatingNWOG', 'floatingNDOG']) assert.equal(float(result, result.global(name)), null, `${name} blank`);
    assert.ok(zone(result, findGap(result, 'rth', day(5, 9, 30))));
    assert.ok(zone(result, findGap(result, 'nwog', day(4, 18))));
  });

  test('Floating Only keeps only today\'s filled RTH gap on history; Preserve Today off hides it too', () => {
    const inputs = { displayMode: member('DisplayMode', 'floatingOnly') };
    const result = gaps({ at: day(6, 12), inputs });
    const drawn = result.global('gaps').filter(gap => zone(result, gap));
    assert.deepEqual(drawn.map(gap => `${gap.gapType.name} ${at(gap.creationTime)}`), [`rth ${at(day(6, 9, 30))}`]);
    const without = gaps({ at: day(6, 12), inputs: { ...inputs, preserveTodayFilledRTH: false } });
    assert.equal(without.global('gaps').filter(gap => zone(without, gap)).length, 0);
  });

  test('Float Nearest Unfilled adds the closest older RTH gaps to the column, each in its own colour', () => {
    const result = gaps({ at: day(8, 11), market: STAIRCASE, inputs: { nearestRTHCount: 2 } });
    const primary = float(result, result.global('floatingRTH'));
    const nearest = result.global('nearestRTHFloats').map(item => float(result, item));
    assert.equal(primary.label, 'RTH 0%\nOct 8, 2026');
    assert.deepEqual(nearest.map(item => item.label), ['RTH 0%\nOct 7, 2026', 'RTH 0%\nOct 6, 2026'], 'closest first');
    assert.deepEqual([primary, ...nearest].map(item => item.from), [200, 200, 200]);
    assert.deepEqual([primary, ...nearest].map(item => `${item.border.r},${item.border.g},${item.border.b}`), ['76,175,80', '156,39,176', '0,150,136']);
    assert.ok(zone(result, findGap(result, 'rth', day(5, 9, 30))), 'the farthest gap stays on history');
  });

  test('after a sell-off fills the newest gaps, the half-filled older gap becomes the main float', () => {
    const result = gaps({ at: day(8, 14), market: STAIRCASE, inputs: { nearestRTHCount: 2 } });
    const primary = float(result, result.global('floatingRTH'));
    assert.equal(primary.label, 'RTH 50%\nOct 6, 2026');
    assert.deepEqual(primary.unfilled, [[20100, 20150]]);
    const nearest = result.global('nearestRTHFloats').map(item => float(result, item));
    assert.deepEqual(nearest.map(item => item.label), ['RTH 0%\nOct 5, 2026']);
  });
});

describe('Gaps: filters', () => {
  test('Hide Filled RTH removes filled RTH gaps except today\'s', () => {
    const result = gaps({ at: day(6, 12), inputs: { ...HISTORICAL, hideFilledRTH: true } });
    assert.equal(zone(result, findGap(result, 'rth', day(5, 9, 30))), null);
    assert.ok(zone(result, findGap(result, 'rth', day(6, 9, 30))));
    assert.ok(zone(result, findGap(result, 'nwog', day(4, 18))), 'other types are unaffected');
  });

  test('Quick Filter NWOG shows only the weekly opening gap, even with its own toggle off', () => {
    const result = gaps({ at: day(6, 12), inputs: { ...HISTORICAL, quickFilter: member('QuickFilter', 'nwogOnly'), showNWOGInput: false } });
    const drawn = result.global('gaps').filter(gap => zone(result, gap));
    assert.deepEqual(drawn.map(gap => gap.gapType.name), ['nwog']);
    assert.equal(zone(result, drawn[0]).label, 'NWOG ✓\nOct 4, 2026', 'with NDOG hidden the shared label drops "/ NDOG"');
  });
});

describe('Gaps on Range charts (180R) and in Bar Replay', () => {
  const rangeCandleAt = (result, time) => result.bars.time.findLastIndex(open => open <= time);

  test('a loaded R180 chart finds the Sunday and Monday gaps from 1-minute data and anchors them to Range candles', () => {
    const result = gaps({ at: day(5, 13), chart: 'R180', mode: 'loaded', inputs: HISTORICAL });
    const nwog = zone(result, findGap(result, 'nwog', day(4, 18)));
    const rth = zone(result, findGap(result, 'rth', day(5, 9, 30)));
    assert.equal(nwog.from.index, rangeCandleAt(result, day(4, 18)));
    assert.equal(rth.from.index, rangeCandleAt(result, day(5, 9, 30)));
    assert.equal(rth.to.barsPastLast, 3, 'open gaps reach three bars past the forming candle');
    assert.deepEqual(rth.filled, [20100, 20200], 'the fill comes from 1-minute lows, not Range candles');
    assert.equal(rth.label, 'RTH 50%\nOct 5, 2026');
    assert.equal(nwog.label, 'NWOG / NDOG 0%\nOct 4, 2026');
  });

  test('live R180 and Bar Replay show the same gaps on the same Range candles', () => {
    const loaded = gaps({ at: day(5, 13), chart: 'R180', mode: 'loaded', inputs: HISTORICAL });
    for (const mode of ['live', 'replay']) {
      const result = gaps({ at: day(5, 13), chart: 'R180', mode, inputs: HISTORICAL });
      const summary = run => run.global('gaps').map(gap => `${gap.gapType.name} ${gap.bottom}-${gap.top} @${gap.creationBar}`);
      assert.deepEqual(summary(result), summary(loaded), mode);
      assert.ok(zone(result, findGap(result, 'rth', day(5, 9, 30))), `${mode} draws the RTH gap`);
    }
  });

  test('Bar Replay on 1m matches the live chart', () => {
    const live = gaps({ at: day(5, 13), inputs: HISTORICAL });
    const replay = gaps({ at: day(5, 13), mode: 'replay', inputs: HISTORICAL });
    const shape = run => run.global('gaps').map(gap => JSON.stringify(zone(run, gap)));
    assert.deepEqual(shape(replay), shape(live));
  });
});

describe('Gaps drawing budget', () => {
  test('months of 15m history with every type at its 50-gap limit: nothing is silently removed', () => {
    const result = runIndicator(program, {
      market: cmeMarket(), chart: { type: 'time', tf: '15' }, from: nyTime(2026, 7, 20), until: day(8, 11), mode: 'live',
      inputs: { rthLimit: 50, nwogLimit: 50, ndogLimit: 50, nearestRTHCount: 10 },
    });
    for (const kind of ['box', 'line', 'label']) {
      const removed = result.all(kind).filter(object => object.garbageCollected);
      assert.equal(removed.length, 0, `${removed.length} ${kind}s were dropped by the ${kind} limit`);
      assert.ok(result.live(kind).length <= 500);
    }
    const drawn = result.global('gaps').filter(gap => zone(result, gap)).length;
    assert.ok(drawn > 0 && drawn <= 86, `${drawn} historical gaps drawn (shared budget is 86)`);
  });
});
