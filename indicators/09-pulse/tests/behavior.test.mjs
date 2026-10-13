import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadIndicator, runIndicator, CME_NQ } from '../../../tests/runtime/run.mjs';
import { cmeMarket, nyTime, formatNy } from '../../../tests/runtime/scenario.mjs';

// Runs pulse.pine bar by bar on synthetic NQ data and checks what the chart would show.
// Expected levels are recomputed from the chart's own candles, so the tests pin the rules
// (which session, where a line starts, which candle ends it), not particular prices.
// They do not prove TradingView compilation or rendering.

const program = loadIndicator(new URL('../code/pulse.pine', import.meta.url).pathname);
const HOUR = 3_600_000;
const MINUTE = 60_000;

// Thursday 8 October 2026 is the test day.
const day = (hour, minute = 0, date = 8) => nyTime(2026, 10, date, hour, minute);

function pulse({ at, chart = '1', mode = 'live', inputs = {}, market = cmeMarket(), hoursOfChart = 40, symbol = CME_NQ }) {
  const chartSpec = chart.startsWith('R') ? { type: 'range', size: Number(chart.slice(1)) * 0.25 } : { type: 'time', tf: chart };
  return runIndicator(program, { market, chart: chartSpec, from: at - hoursOfChart * HOUR, until: at, mode, inputs, symbol });
}

const COLORS = {
  daily: '171,71,188', weekly: '236,64,122', monthly: '255,152,0', overnight: '76,175,80', premarket: '21,101,192',
  asia: '56,142,60', rafael: '239,83,80', depthExtension: '247,82,95', depthBlue: '3,169,244',
  rangeBox: '187,217,251', rangeMiddle: '184,184,184', close1600: '247,82,95', mno: '144,191,249', open830: '255,167,38', open930: '255,112,67',
};
const SESSION_POOLS = ['overnight', 'premarket', 'asia', 'rafael'];
const LABEL_NAMES = { daily: 'daily', weekly: 'weekly', monthly: 'monthly', overnight: 'overnight', premarket: 'premarket', asia: 'asia open', rafael: 'rafael' };
const rgb = color => `${color.r},${color.g},${color.b}`;

function view(result, object) {
  return {
    start: result.xTime(object.x1, object.xloc), end: result.xTime(object.x2, object.xloc), x1: object.x1, x2: object.x2,
    price: object.y1, y2: object.y2, style: object.style, width: object.width, transparency: object.color.t, color: rgb(object.color), xloc: object.xloc,
  };
}
const allLines = result => result.live('line').map(object => view(result, object));
const linesOf = (result, kind) => allLines(result).filter(line => line.color === COLORS[kind]);
const horizontal = line => line.price === line.y2 && line.start !== line.end;
// A pool level as drawn: a solid horizontal line in the pool's color.
const levels = (result, kind) => linesOf(result, kind).filter(line => horizontal(line) && line.style === 'line.style_solid');
const labelsAt = (result, price) => result.live('label').filter(object => object.y === price).map(object => object.text);

// Session high and low from the chart's candles opening in [from, to); the first candle wins ties.
function extremes(result, from, to) {
  const { time, high, low } = result.bars;
  let top = null;
  let bottom = null;
  for (let i = 0; i <= result.lastIndex; i++) {
    if (time[i] < from || time[i] >= to) continue;
    if (!top || high[i] > top.price) top = { price: high[i], time: time[i], index: i };
    if (!bottom || low[i] < bottom.price) bottom = { price: low[i], time: time[i], index: i };
  }
  return { high: top, low: bottom };
}

// First candle opening at or after `from` that trades through `price` on that side.
function firstTouch(result, from, price, side) {
  const { time, high, low } = result.bars;
  for (let i = 0; i <= result.lastIndex; i++) {
    if (time[i] >= from && (side === 'high' ? high[i] >= price : low[i] <= price)) return { time: time[i], index: i };
  }
  return null;
}

const lastCandle = result => ({ time: result.bars.time[result.lastIndex], index: result.lastIndex });
const sweepOrNow = (result, from, price, side) => firstTouch(result, from, price, side) ?? lastCandle(result);

function findLevel(result, kind, extreme) {
  return levels(result, kind).find(line => line.price === extreme.price && line.start === extreme.time);
}

function expectLevel(result, kind, extreme, end, what) {
  const line = findLevel(result, kind, extreme);
  assert.ok(line, `${what}: no ${kind} level at ${extreme.price} from ${formatNy(extreme.time)}`);
  assert.equal(formatNy(line.end), formatNy(end), `${what}: ${kind} ${extreme.price} ends`);
  return line;
}

// Depth ladder lines (L1–L3) beyond a pool level, at whole multiples of the instrument's step.
function ladder(result, extreme, side, step) {
  const sign = side === 'high' ? 1 : -1;
  return [1, 2, 3].map(multiple => allLines(result).find(line => horizontal(line) && line.price === extreme.price + sign * step * multiple && line.start === extreme.time));
}

const sides = ['high', 'low'];

describe('Pulse Today mode on 1m (default settings)', () => {
  const result = pulse({ at: day(10) });
  const daily = extremes(result, day(18, 0, 6), day(17, 0, 7));

  test("yesterday's Daily high and low start at the candle that made them and stop at the first candle that trades through", () => {
    for (const side of sides) {
      const end = sweepOrNow(result, day(18, 0, 7), daily[side].price, side);
      const line = expectLevel(result, 'daily', daily[side], end.time, `Daily ${side}`);
      assert.equal(line.xloc, 'xloc.bar_time', 'time charts place levels by time');
    }
    assert.equal(levels(result, 'daily').length, 2, 'Today Show Last 1: one Daily high and one Daily low');
  });

  test('Overnight (16:00–05:00) and Premarket (05:00–09:15) levels mark their own session extremes', () => {
    const sessions = { overnight: [day(16, 0, 7), day(5)], premarket: [day(5), day(9, 15)] };
    for (const [kind, [from, to]] of Object.entries(sessions)) {
      const session = extremes(result, from, to);
      for (const side of sides) expectLevel(result, kind, session[side], sweepOrNow(result, to, session[side].price, side).time, `${kind} ${side}`);
    }
  });

  test('Asia Open and Rafael touched before 05:00 next morning turn dashed until a touch after 05:00 confirms the sweep', () => {
    let provisional = 0;
    for (const [kind, from, to] of [['asia', day(18, 0, 7), day(21, 0, 7)], ['rafael', day(21, 30, 7), day(1, 30)]]) {
      const session = extremes(result, from, to);
      for (const side of sides) {
        const extreme = session[side];
        const first = firstTouch(result, to, extreme.price, side);
        if (first && first.time < day(5)) {
          provisional++;
          expectLevel(result, kind, extreme, first.time, `${kind} ${side} solid part`);
          const confirmed = sweepOrNow(result, day(5), extreme.price, side);
          const dashed = linesOf(result, kind).find(line => line.style === 'line.style_dashed' && line.width === 1 && line.price === extreme.price);
          assert.ok(dashed, `${kind} ${side}: dashed provisional segment`);
          assert.equal(formatNy(dashed.start), formatNy(first.time), `${kind} ${side}: dashed starts at the early touch`);
          assert.equal(formatNy(dashed.end), formatNy(confirmed.time), `${kind} ${side}: dashed ends at the confirming touch`);
        } else {
          expectLevel(result, kind, extreme, (first ?? lastCandle(result)).time, `${kind} ${side}`);
        }
      }
    }
    assert.ok(provisional > 0, 'the scenario contains at least one early (provisional) touch');
  });

  test('a swept Daily level shows an NQ depth ladder at 27, 54 and 81 points; an unswept side shows none', () => {
    let swept = 0;
    let unswept = 0;
    for (const side of sides) {
      const extreme = daily[side];
      const sweep = firstTouch(result, day(18, 0, 7), extreme.price, side);
      const [l1, l2, l3] = ladder(result, extreme, side, 27);
      if (!sweep) {
        unswept++;
        assert.ok(!l1 && !l2 && !l3, `unswept Daily ${side} has no ladder`);
        continue;
      }
      swept++;
      assert.ok(l1 && l2 && l3, `swept Daily ${side} shows L1–L3`);
      assert.deepEqual([l1.color, l1.style, l1.width], [COLORS.daily, 'line.style_dashed', 2], 'L1 is a thick dashed line in the pool color');
      assert.deepEqual([l2.color, l2.style, l2.width], [COLORS.depthExtension, 'line.style_dotted', 1], 'L2 is thin dotted');
      assert.deepEqual([l3.color, l3.style, l3.width], [COLORS.depthExtension, 'line.style_dotted', 3], 'L3 is thick dotted');
      for (const level of [l1, l2, l3]) {
        assert.equal(formatNy(level.end), formatNy(sweepOrNow(result, sweep.time, level.price, side).time), `L at ${level.price} ends where it is traded through`);
        const connector = allLines(result).find(line => line.start === extreme.time && line.end === extreme.time && line.price === extreme.price && line.y2 === level.price);
        assert.ok(connector, `a dashed connector joins the pool to ${level.price}`);
      }
      assert.ok(labelsAt(result, l1.price).some(text => text.includes('L1 daily')), 'the ladder is labelled L1 daily');
    }
    assert.ok(swept > 0 && unswept > 0, 'scenario has one swept and one unswept Daily side');
  });

  test('every level is labelled with its pool name; Labels off removes them; merge off never joins names', () => {
    for (const kind of ['daily', ...SESSION_POOLS]) {
      for (const line of levels(result, kind)) {
        assert.ok(labelsAt(result, line.price).some(text => text.includes(LABEL_NAMES[kind])), `${kind} level ${line.price} is labelled`);
      }
    }
    assert.ok(result.live('label').some(text => text.text.includes(' • ')), 'merged labels join names with •');
    const unmerged = pulse({ at: day(10), inputs: { mergeOverlappingLabels: false } });
    assert.ok(unmerged.live('label').length > 0 && unmerged.live('label').every(object => !object.text.includes(' • ')));
    assert.equal(pulse({ at: day(10), hoursOfChart: 30, inputs: { showLabels: false } }).live('label').length, 0);
  });
});

describe('Pulse Show in Today', () => {
  test('None hides Asia Open and Rafael; Key Opens adds MNO, 8:30, 9:30, the 16:00 close and the Range Box', () => {
    const none = pulse({ at: day(10), hoursOfChart: 30, inputs: { todayAdditionalPools: 'None' } });
    assert.equal(linesOf(none, 'asia').length + linesOf(none, 'rafael').length, 0);
    assert.ok(levels(none, 'overnight').length > 0, 'core Today pools stay');
    const keyOpens = pulse({ at: day(10), inputs: { todayAdditionalPools: 'Key Opens' } });
    for (const kind of ['mno', 'open830', 'open930', 'rangeBox', 'rangeMiddle']) assert.ok(linesOf(keyOpens, kind).length > 0, `${kind} shown`);
    assert.ok(keyOpens.live('label').some(object => object.text === '16:00'), '16:00 close shown');
    assert.equal(linesOf(keyOpens, 'asia').length, 0, 'Asia Open hidden when Key Opens is chosen');
  });
});

describe('Pulse sessions and timeframes', () => {
  test('the Daily pool rolls at the 18:00 reopen, not at the 17:00 break', () => {
    const atBreak = pulse({ at: day(17, 30), hoursOfChart: 48 });
    const previous = extremes(atBreak, day(18, 0, 6), day(17, 0, 7));
    for (const side of sides) assert.ok(findLevel(atBreak, 'daily', previous[side]), `during the break Daily ${side} is still Wednesday's session`);
    const afterReopen = pulse({ at: day(18, 30), hoursOfChart: 30 });
    const thursday = extremes(afterReopen, day(18, 0, 7), day(17));
    for (const side of sides) assert.ok(findLevel(afterReopen, 'daily', thursday[side]), `after 18:00 Daily ${side} is Thursday's session`);
  });

  test('on 30m session pools still show; on 60m only Daily, Weekly and Monthly do', () => {
    const thirty = pulse({ at: day(10), chart: '30', hoursOfChart: 48 });
    for (const kind of ['overnight', 'premarket', 'asia', 'rafael', 'daily']) assert.ok(levels(thirty, kind).length > 0, `30m shows ${kind}`);
    const sixty = pulse({ at: day(10), chart: '60', hoursOfChart: 24 * 12 });
    for (const kind of SESSION_POOLS) assert.equal(linesOf(sixty, kind).length, 0, `60m hides ${kind}`);
    for (const kind of ['daily', 'weekly', 'monthly']) assert.equal(levels(sixty, kind).length, 2, `60m shows one ${kind} high and low`);
  });

  describe('Monday after the Sunday reopen (15m)', () => {
    const market = cmeMarket({ start: nyTime(2026, 9, 6, 18), end: nyTime(2026, 10, 13, 17) });
    const monday = (hour, minute = 0) => nyTime(2026, 10, 12, hour, minute);
    const sunday = hour => nyTime(2026, 10, 11, hour);
    const friday = hour => nyTime(2026, 10, 9, hour);

    test("Exchange Session: Monday's Daily level is Friday's session (Thu 18:00–Fri 17:00) and can be swept from the Sunday reopen", () => {
      const result = pulse({ at: monday(10), chart: '15', market, hoursOfChart: 90 });
      const session = extremes(result, nyTime(2026, 10, 8, 18), friday(17));
      for (const side of sides) expectLevel(result, 'daily', session[side], sweepOrNow(result, sunday(18), session[side].price, side).time, `Daily ${side}`);
    });

    test('Calendar Day: Sunday evening extends Friday\'s Daily level, and sweeps only count from Monday 00:00', () => {
      const result = pulse({ at: monday(10), chart: '15', market, hoursOfChart: 90, inputs: { daily_boundary_mode: 'Calendar Day' } });
      const fridayDay = extremes(result, friday(0), friday(17));
      const sundayEvening = extremes(result, sunday(18), monday(0));
      let extendedBySunday = 0;
      for (const side of sides) {
        const sundayWins = side === 'high' ? sundayEvening.high.price > fridayDay.high.price : sundayEvening.low.price < fridayDay.low.price;
        const extreme = sundayWins ? sundayEvening[side] : fridayDay[side];
        if (sundayWins) extendedBySunday++;
        expectLevel(result, 'daily', extreme, sweepOrNow(result, monday(0), extreme.price, side).time, `Calendar Daily ${side}`);
      }
      assert.ok(extendedBySunday > 0, 'scenario has a Sunday-evening extreme');
    });

    test('Overnight covers the Sunday reopen through 05:00, and Asia Open forms 18:00–21:00 on Sunday', () => {
      const result = pulse({ at: monday(10), chart: '15', market, hoursOfChart: 90 });
      const overnight = extremes(result, sunday(18), monday(5));
      for (const side of sides) expectLevel(result, 'overnight', overnight[side], sweepOrNow(result, monday(5), overnight[side].price, side).time, `Overnight ${side}`);
      const asia = extremes(result, sunday(18), sunday(21));
      for (const side of sides) {
        assert.ok(linesOf(result, 'asia').some(line => horizontal(line) && line.price === asia[side].price && line.start === asia[side].time), `Sunday Asia Open ${side}`);
      }
    });
  });
});

describe('Pulse depth calibration per instrument', () => {
  test('ES uses 9-point steps', () => {
    const es = { ...CME_NQ, root: 'ES', ticker: 'ES1!', tickerid: 'CME_MINI:ES1!', main_tickerid: 'CME_MINI:ES1!' };
    const result = pulse({ at: day(10), symbol: es });
    const daily = extremes(result, day(18, 0, 6), day(17, 0, 7));
    const sweptSides = sides.filter(side => firstTouch(result, day(18, 0, 7), daily[side].price, side));
    assert.ok(sweptSides.length > 0);
    for (const side of sweptSides) assert.ok(ladder(result, daily[side], side, 9).every(Boolean), `ES Daily ${side} ladder at 9/18/27`);
    for (const side of sweptSides) assert.ok(ladder(result, daily[side], side, 27).slice(1).every(line => !line), 'no NQ-sized 54/81 levels on ES');
  });

  test('an unsupported instrument shows pools without any depth ladder', () => {
    const bonds = { ...CME_NQ, root: 'ZB', ticker: 'ZB1!', tickerid: 'CBOT:ZB1!', main_tickerid: 'CBOT:ZB1!' };
    const result = pulse({ at: day(10), hoursOfChart: 30, symbol: bonds });
    assert.ok(levels(result, 'daily').length > 0 && levels(result, 'overnight').length > 0);
    assert.equal(allLines(result).filter(line => line.style === 'line.style_dotted').length, 0);
    assert.equal(result.live('label').filter(object => /\bL[123]\b/.test(object.text)).length, 0);
  });

  test('outside Today, Daily LD shows blue ladders on 15m but is unavailable on 1m', () => {
    const inputs = { pulseModeFilter: 'Daily', enableDailyLiquidityDepth: true, dailyShowLast: 3 };
    const fifteen = pulse({ at: day(10), chart: '15', hoursOfChart: 96, inputs });
    assert.equal(levels(fifteen, 'daily').length, 6, 'Daily mode shows Show Last (3) sessions, high and low');
    assert.ok(allLines(fifteen).every(line => line.color === COLORS.daily || line.color === COLORS.depthBlue), 'Daily mode shows nothing but Daily');
    let ladders = 0;
    for (const session of [[day(18, 0, 4), day(17, 0, 5)], [day(18, 0, 5), day(17, 0, 6)], [day(18, 0, 6), day(17, 0, 7)]]) {
      const pool = extremes(fifteen, ...session);
      for (const side of sides) {
        if (!firstTouch(fifteen, session[1] + HOUR, pool[side].price, side)) continue;
        const lines = ladder(fifteen, pool[side], side, 27);
        assert.ok(lines.every(line => line?.color === COLORS.depthBlue), `swept ${side} has a blue ladder`);
        assert.deepEqual(lines.map(line => line.style), ['line.style_dashed', 'line.style_dotted', 'line.style_dotted']);
        ladders++;
      }
    }
    assert.ok(ladders > 0);
    const one = pulse({ at: day(10), hoursOfChart: 30, inputs });
    assert.equal(linesOf(one, 'depthBlue').length, 0);
  });
});

describe('Pulse Unmitigated Only', () => {
  test('hides swept levels, or fades them to 93% with Fade Mitigated Levels', () => {
    const inputs = { pulseModeFilter: 'Daily', dailyShowLast: 5 };
    const all = levels(pulse({ at: day(10), chart: '15', hoursOfChart: 24 * 7, inputs }), 'daily');
    const swept = all.filter(line => line.end < day(9, 45));
    assert.ok(swept.length > 0 && swept.length < all.length);
    const unmitigated = levels(pulse({ at: day(10), chart: '15', hoursOfChart: 24 * 7, inputs: { ...inputs, showUnmitigatedOnly: true } }), 'daily');
    assert.deepEqual(unmitigated.map(line => line.price).sort(), all.filter(line => !swept.includes(line)).map(line => line.price).sort());
    const faded = levels(pulse({ at: day(10), chart: '15', hoursOfChart: 24 * 7, inputs: { ...inputs, showUnmitigatedOnly: true, preserveMitigatedContext: true } }), 'daily');
    const ghosts = faded.filter(line => line.transparency === 93);
    assert.deepEqual(ghosts.map(line => `${line.price}@${line.end}`).sort(), swept.map(line => `${line.price}@${line.end}`).sort());
  });

  test('in Today, a swept Daily level stays at 85% while its ladder still has an untouched level', () => {
    const result = pulse({ at: day(10), inputs: { showUnmitigatedOnly: true } });
    const daily = extremes(result, day(18, 0, 6), day(17, 0, 7));
    let checked = 0;
    for (const side of sides) {
      const sweep = firstTouch(result, day(18, 0, 7), daily[side].price, side);
      if (!sweep) continue;
      checked++;
      const ladderOpen = [1, 2, 3].some(n => !firstTouch(result, sweep.time, daily[side].price + (side === 'high' ? 27 : -27) * n, side));
      const line = levels(result, 'daily').find(level => level.price === daily[side].price);
      if (ladderOpen) assert.equal(line?.transparency, 85, `swept Daily ${side} with open depth is faded to 85`);
      else assert.equal(line, undefined, `fully swept Daily ${side} is hidden`);
    }
    assert.ok(checked > 0);
  });
});

describe('Pulse 16:00 close, Range Box and key opens', () => {
  test('16:00 closes start at the 16:00 candle and can only be mitigated from 13 hours later', () => {
    const result = pulse({ at: day(10), hoursOfChart: 70, inputs: { pulseModeFilter: 'Range Box + 1600' } });
    const closes = linesOf(result, 'close1600');
    let earlyTouchIgnored = 0;
    for (const capture of [day(16, 0, 5), day(16, 0, 6), day(16, 0, 7)]) {
      const index = result.bars.time.indexOf(capture);
      const price = result.bars.close[index];
      const touches = from => {
        for (let i = 0; i <= result.lastIndex; i++) {
          const t = result.bars.time[i];
          if (t >= from && ((result.bars.high[i] >= price && result.bars.low[i] <= price) || result.bars.close[i] === price)) return t;
        }
        return null;
      };
      const early = touches(capture + MINUTE);
      if (early !== null && early < capture + 13 * HOUR) earlyTouchIgnored++;
      const end = touches(capture + 13 * HOUR) ?? lastCandle(result).time;
      const line = closes.find(candidate => candidate.price === price && candidate.start === capture);
      assert.ok(line, `16:00 close of ${formatNy(capture)}`);
      assert.equal(formatNy(line.end), formatNy(end));
      assert.ok(labelsAt(result, price).includes('16:00'));
    }
    assert.equal(closes.length, 3);
    assert.ok(earlyTouchIgnored > 0, 'scenario has a touch inside the 13-hour wait');
  });

  test('the Range Box frames 02:00–02:15 with a dotted midpoint, extending to the next box or the current candle', () => {
    const result = pulse({ at: day(10), inputs: { pulseModeFilter: 'Range Box' } });
    const box = linesOf(result, 'rangeBox');
    for (const [date, extendTo] of [[8, lastCandle(result).time], [7, day(2)]]) {
      const { high, low } = extremes(result, day(2, 0, date), day(2, 15, date));
      const find = (price, y2, start, end) => box.find(line => line.price === price && line.y2 === y2 && line.start === start && line.end === end);
      assert.ok(find(high.price, high.price, day(2, 0, date), extendTo), `top of ${date} Oct`);
      assert.ok(find(low.price, low.price, day(2, 0, date), extendTo), `bottom of ${date} Oct`);
      assert.ok(find(high.price, low.price, day(2, 0, date), day(2, 0, date)), 'left edge at 02:00');
      assert.ok(find(high.price, low.price, day(2, 15, date), day(2, 15, date)), 'right edge at 02:15');
      const middle = linesOf(result, 'rangeMiddle').find(line => line.price === (high.price + low.price) / 2 && line.start === day(2, 0, date));
      assert.equal(middle?.style, 'line.style_dotted');
      assert.equal(middle.end, extendTo);
    }
  });

  test("Midnight, 8:30 and 9:30 opens start at their candle's open; earlier days stop at 16:00", () => {
    for (const chart of ['1', '15']) {
      const result = pulse({ at: day(10), chart, hoursOfChart: 60, inputs: { pulseModeFilter: 'Key Opens' } });
      for (const [kind, hour, minute, prefix] of [['mno', 0, 0, 'MNO'], ['open830', 8, 30, '8:30'], ['open930', 9, 30, '9:30']]) {
        for (const [date, end] of [[8, lastCandle(result).time], [7, day(16, 0, 7)]]) {
          const start = day(hour, minute, date);
          const price = result.bars.open[result.bars.time.indexOf(start)];
          const line = linesOf(result, kind).find(candidate => candidate.start === start);
          assert.ok(line, `${chart}m ${prefix} open on ${date} Oct`);
          assert.equal(line.price, price);
          assert.equal(formatNy(line.end), formatNy(end));
          assert.ok(result.live('label').some(object => object.text === `${prefix} Open` && object.x === end && object.y === price));
        }
      }
    }
  });
});

describe('Pulse on Range charts (180R)', () => {
  test('levels are placed on candles and end on the Range candle that sweeps them', () => {
    const result = pulse({ at: day(10), chart: 'R180' });
    const pools = { daily: [day(18, 0, 6), day(17, 0, 7)], overnight: [day(16, 0, 7), day(5)] };
    for (const [kind, [from, to]] of Object.entries(pools)) {
      const session = extremes(result, from, to);
      for (const side of sides) {
        const end = sweepOrNow(result, to, session[side].price, side);
        const line = levels(result, kind).find(candidate => candidate.price === session[side].price);
        assert.ok(line, `${kind} ${side} on Range`);
        assert.equal(line.xloc, 'xloc.bar_index');
        assert.equal(line.x1, session[side].index, `${kind} ${side} starts on the candle that made it`);
        assert.equal(line.x2, end.index, `${kind} ${side} ends on the sweeping candle`);
      }
    }
  });

  test('Show Only RTH greys candles outside 09:30–16:00 on 1m and Range, never on 4H; Most Recent Only also greys earlier days', () => {
    const outsideRth = time => { const clock = formatNy(time).slice(11, 16); return clock < '09:30' || clock >= '16:00'; };
    for (const chart of ['1', 'R180']) {
      const result = pulse({ at: day(10), chart, hoursOfChart: 30, inputs: { showOnlyEnabled: true } });
      const hidden = result.plot('Hidden Candles');
      result.bars.time.forEach((time, i) => assert.equal(!Number.isNaN(hidden[i]), outsideRth(time), `${chart} candle ${formatNy(time)}`));
    }
    const fourHour = pulse({ at: day(10), chart: '240', hoursOfChart: 24 * 10, inputs: { showOnlyEnabled: true } });
    assert.ok(fourHour.plot('Hidden Candles').every(Number.isNaN));
    const recent = pulse({ at: day(10), hoursOfChart: 30, inputs: { showOnlyEnabled: true, showOnlyMostRecent: true } });
    const hidden = recent.plot('Hidden Candles');
    recent.bars.time.forEach((time, i) => {
      const today = formatNy(time).startsWith('2026-10-08');
      assert.equal(!Number.isNaN(hidden[i]), outsideRth(time) || !today, `most recent ${formatNy(time)}`);
    });
  });
});

describe('Pulse in Bar Replay and on load', () => {
  test('Bar Replay and a freshly loaded chart draw exactly what the live chart draws', () => {
    const snapshot = result => JSON.stringify([allLines(result), result.live('label').map(object => [object.x, object.y, object.text])]);
    const live = snapshot(pulse({ at: day(10), hoursOfChart: 30 }));
    assert.equal(snapshot(pulse({ at: day(10), hoursOfChart: 30, mode: 'replay' })), live);
    assert.equal(snapshot(pulse({ at: day(10), hoursOfChart: 30, mode: 'loaded' })), live);
  });
});

describe('Pulse drawing budget', () => {
  const extras = {
    showOvernightBackground: true, showPremarketBackground: true, showAsiaOpenBackground: true, showRafaelBackground: true,
    showRangeBox: true, showDailyOpen: true, showMnoOpen: true, show830Open: true, show930Open: true, show1600Close: true, allTimeHighShow: true,
  };
  for (const [name, inputs] of [
    ['Today with Show Last 5 and every extra pool', { todayShowLast: 5, todayAdditionalPools: 'All', ...extras }],
    ['All with Daily LD and every overlay', { pulseModeFilter: 'All', enableDailyLiquidityDepth: true, ...extras }],
  ]) {
    test(`${name}: nothing is silently removed by TradingView limits on 15m`, () => {
      const result = pulse({ at: day(10), chart: '15', hoursOfChart: 24 * 40, inputs });
      for (const kind of ['line', 'label', 'box']) {
        const removed = result.all(kind).filter(object => object.garbageCollected);
        assert.equal(removed.length, 0, `${removed.length} ${kind}s were dropped by the ${kind} limit`);
      }
      assert.ok(result.live('line').length > 100);
    });
  }
});
