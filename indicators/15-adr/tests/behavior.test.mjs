import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadIndicator, runIndicator } from '../../../tests/runtime/run.mjs';
import { cmeMarket, nyTime, formatNy } from '../../../tests/runtime/scenario.mjs';
import { localParts } from '../../../tests/runtime/timezone.mjs';

// Runs adr.pine bar by bar on synthetic NQ data and checks what the chart would show.
// Expected prices are derived from the synthetic candles, never hard-coded.
// These pin current behavior; they do not prove TradingView compilation or rendering.

const program = loadIndicator(new URL('../code/adr.pine', import.meta.url).pathname);
const HOUR = 3_600_000;
const NY = 'America/New_York';
const SUNDAY = 1;
const market = cmeMarket();

// Thursday 8 October 2026 is the test day.
const day = (hour, minute = 0, date = 8) => nyTime(2026, 10, date, hour, minute);
// The chart starts on a Monday midnight so the first NY day on it is complete.
const MONDAY_START = nyTime(2026, 9, 28, 0, 0);

function adr({ at = day(10), chart = '15', from = MONDAY_START, mode = 'live', inputs = {} } = {}) {
  const chartSpec = chart.startsWith('R') ? { type: 'range', size: Number(chart.slice(1)) * 0.25 } : { type: 'time', tf: chart };
  return runIndicator(program, { market, chart: chartSpec, from, until: at, mode, inputs });
}

// NY-midnight days as the indicator sees them: the Sunday 18:00 reopen belongs to Friday's day.
function nyDays(from, until) {
  const days = [];
  for (const candle of market.candles) {
    if (candle.time < from) continue;
    if (candle.time >= until) break;
    const parts = localParts(candle.time, NY);
    const start = nyTime(parts.year, parts.month, parts.day);
    const current = days.at(-1);
    if (!current || (start !== current.start && !(parts.dayOfWeek === SUNDAY && current))) {
      days.push({ start, open: candle.open, high: candle.high, low: candle.low, candles: [candle] });
    } else {
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.candles.push(candle);
    }
  }
  days.forEach((entry, index) => {
    const prior = days.slice(Math.max(0, index - 5), index).map(d => d.high - d.low);
    entry.adr = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : NaN;
  });
  return days;
}

const average = values => values.reduce((a, b) => a + b, 0) / values.length;
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`);
const liveLabels = result => result.live('label');
const labelNamed = (result, text) => {
  const found = liveLabels(result).filter(l => l.text === text);
  assert.equal(found.length, 1, `one "${text}" label, saw ${liveLabels(result).map(l => l.text).join(', ')}`);
  return found[0];
};
const lineAt = (result, price, x1) => result.live('line').find(l => Math.abs(l.y1 - price) < 1e-6 && l.x1 === x1);
const cellText = (table, column, row) => table.cells.get(`${column},${row}`)?.text;
const tableRows = table => {
  const rows = [];
  for (let row = 0; row < table.rows; row++) {
    if (!table.cells.has(`0,${row}`)) continue;
    rows.push([0, 1, 2].map(column => cellText(table, column, row)).join(' | '));
  }
  return rows;
};
const statisticsTable = result => result.live('table').find(t => t.position === 'position.bottom_right');

function expectBands(result, { prefix, suffix = '', open, range, start, end, openLabel }) {
  const bands = [[`${prefix}${suffix}`, 1], [`1/3ADR${suffix}`, 1 / 3], [`2/3ADR${suffix}`, 2 / 3]];
  for (const [name, fraction] of bands) {
    for (const [sign, direction] of [['+', 1], ['-', -1]]) {
      const label = labelNamed(result, name + sign);
      close(label.y, open + direction * range * fraction, `${name}${sign} price`);
      assert.equal(formatNy(label.x), formatNy(end), `${name}${sign} label sits at the period end`);
      const level = lineAt(result, label.y, start);
      assert.ok(level, `${name}${sign} line starts at ${formatNy(start)}`);
      assert.equal(formatNy(level.x2), formatNy(end), `${name}${sign} line ends at the period end`);
    }
  }
  const anchor = labelNamed(result, openLabel);
  close(anchor.y, open, `${openLabel} price`);
  assert.ok(lineAt(result, open, start), `${openLabel} line starts at ${formatNy(start)}`);
}

describe('ADR daily levels (NY Midnight)', () => {
  test('on 15m, ADR, 1/3 and 2/3 bands and MNO run from midnight to the next midnight around the midnight open', () => {
    const today = nyDays(MONDAY_START, day(10)).at(-1);
    assert.equal(formatNy(today.start), formatNy(day(0)));
    const result = adr();
    expectBands(result, { prefix: '5ADR', open: today.open, range: today.adr, start: day(0), end: day(0, 0, 9), openLabel: 'MNO' });
  });

  test('the ADR is the average of the last five completed NY days, with Friday absorbing the Sunday reopen', () => {
    const days = nyDays(MONDAY_START, day(10));
    const fridayIndex = days.findIndex(d => d.start === nyTime(2026, 10, 2));
    const friday = days[fridayIndex];
    assert.ok(friday.candles.some(c => localParts(c.time, NY).dayOfWeek === SUNDAY), 'Friday holds Sunday evening candles');
    assert.equal(days[fridayIndex + 1].start, nyTime(2026, 10, 5), 'the next day is Monday');
    const expected = average(days.slice(-6, -1).map(d => d.high - d.low));
    close(labelNamed(adr(), '5ADR+').y - days.at(-1).open, expected, 'ADR size');
  });

  test('on Monday, Friday stays as history from Friday midnight to Monday midnight, with no labels', () => {
    const at = nyTime(2026, 10, 5, 10);
    const result = adr({ at });
    const friday = nyDays(MONDAY_START, at).find(d => d.start === nyTime(2026, 10, 2));
    const fridayLines = result.live('line').filter(l => l.x1 === nyTime(2026, 10, 2));
    assert.equal(fridayLines.length, 7, 'three band pairs and the open');
    for (const level of fridayLines) assert.equal(formatNy(level.x2), formatNy(nyTime(2026, 10, 5)));
    assert.ok(lineAt(result, friday.open, nyTime(2026, 10, 2)), 'Friday MNO stays at Friday\'s midnight open');
    assert.equal(liveLabels(result).length, 7, 'only the current day is labelled');
  });

  test('1m, 15m and 60m charts show the same ADR levels', () => {
    const from = nyTime(2026, 10, 5);
    const inputs = { adrLookback: 2 };
    const levels = chart => liveLabels(adr({ chart, from, inputs })).map(l => `${l.text}=${l.y.toFixed(6)}@${formatNy(l.x)}`).sort();
    const fifteen = levels('15');
    assert.equal(fifteen.length, 7);
    assert.deepEqual(levels('1'), fifteen);
    assert.deepEqual(levels('60'), fifteen);
    assert.ok(fifteen.some(text => text.startsWith('2ADR+')), 'the lookback shows in the label');
  });

  test('yesterday stays as history by default; Show Historical Days off leaves only today', () => {
    const withHistory = adr();
    assert.equal(withHistory.live('line').length, 14);
    assert.equal(withHistory.live('line').filter(l => l.x1 === day(0, 0, 7) && l.x2 === day(0)).length, 7, 'yesterday ends at midnight');
    const withoutHistory = adr({ inputs: { showHistoricalDays: false } });
    assert.equal(withoutHistory.live('line').length, 7);
    assert.ok(withoutHistory.live('line').every(l => l.x1 === day(0)));
  });

  test('×1.5 widens every band and names the multiplier in the labels', () => {
    const today = nyDays(MONDAY_START, day(10)).at(-1);
    const result = adr({ inputs: { adrMultiplier: 1.5 } });
    expectBands(result, { prefix: '5ADR', suffix: ' ×1.5', open: today.open, range: today.adr * 1.5, start: day(0), end: day(0, 0, 9), openLabel: 'MNO' });
  });
});

describe('ADR Globex Open mode', () => {
  test('levels anchor at the 18:00 Globex open, end at 17:00 and size from the last five daily candles', () => {
    const daily = market.timeBars('D');
    const index = daily.time.indexOf(day(18, 0, 7));
    assert.ok(index >= 5);
    const range = average([1, 2, 3, 4, 5].map(back => daily.high[index - back] - daily.low[index - back]));
    const result = adr({ inputs: { calcType: 'Globex Open' } });
    expectBands(result, { prefix: '5ADR • G', open: daily.open[index], range, start: day(18, 0, 7), end: day(17), openLabel: 'GXO' });
  });
});

describe('ADR weekly and monthly ranges', () => {
  test('AWR runs Sunday 18:00 to Friday 17:00 from the weekly open; AMR spans the month\'s trading sessions', () => {
    const result = adr({ chart: '60', inputs: { showAwr: true, showAmr: true } });
    const expectPeriod = (tf, name, openLabel, lookback, start, end) => {
      const bars = market.timeBars(tf);
      const index = bars.time.indexOf(start);
      assert.ok(index >= lookback, `${tf} period starting ${formatNy(start)}`);
      const range = average(Array.from({ length: lookback }, (_, k) => bars.high[index - 1 - k] - bars.low[index - 1 - k]));
      const open = bars.open[index];
      for (const [text, price] of [[`${lookback}${name}+`, open + range], [`${lookback}${name}-`, open - range], [`1/3${name}+`, open + range / 3], [`2/3${name}-`, open - range * 2 / 3], [openLabel, open]]) {
        const label = labelNamed(result, text);
        close(label.y, price, text);
        assert.equal(formatNy(label.x), formatNy(end), `${text} at period end`);
        assert.ok(lineAt(result, price, start), `${text} line starts ${formatNy(start)}`);
      }
    };
    expectPeriod('W', 'AWR', 'W Open', 4, nyTime(2026, 10, 4, 18), day(17, 0, 9));
    expectPeriod('M', 'AMR', 'M Open', 4, nyTime(2026, 9, 30, 18), nyTime(2026, 10, 30, 17));
    for (const kind of ['line', 'label']) assert.ok(result.live(kind).length > 0);
  });

  test('Quick Filter Off hides every range; "AWR + AMR" replaces the ticked ADR', () => {
    const off = adr({ inputs: { quickFilter: 'Off', showAwr: true, showAmr: true } });
    assert.equal(off.live('line').length, 0);
    assert.equal(off.live('label').length, 0);
    const names = adr({ chart: '60', inputs: { quickFilter: 'AWR + AMR' } }).live('label').map(l => l.text);
    assert.ok(names.includes('W Open') && names.includes('M Open'));
    assert.ok(!names.some(text => text.includes('ADR') || text === 'MNO'), names.join(', '));
  });
});

describe('ADR by chart type', () => {
  test('a 180R Range chart draws no ADR, AWR or AMR levels', () => {
    const result = adr({ chart: 'R180', from: day(10) - 72 * HOUR, inputs: { showAwr: true, showAmr: true, judasEnabled: true } });
    for (const kind of ['line', 'label', 'box']) assert.equal(result.live(kind).length, 0, kind);
  });

  test('4H hides ADR (its candles cross midnight) but keeps AWR; Daily keeps AWR and AMR', () => {
    const fourHour = adr({ chart: '240', from: nyTime(2026, 8, 1), inputs: { showAwr: true } }).live('label').map(l => l.text);
    assert.ok(fourHour.includes('W Open') && !fourHour.includes('MNO'), fourHour.join(', '));
    const daily = adr({ chart: 'D', from: nyTime(2026, 5, 1), inputs: { showAwr: true, showAmr: true } }).live('label').map(l => l.text);
    assert.ok(daily.includes('W Open') && daily.includes('M Open') && !daily.includes('MNO'), daily.join(', '));
  });

  test('Bar Replay at 09:30 and a chart loaded at 09:30 show the same levels as live', () => {
    const snapshot = mode => liveLabels(adr({ at: day(9, 30), mode, inputs: { showAwr: true } })).map(l => `${l.text}=${l.y}@${l.x}`).sort();
    const live = snapshot('live');
    assert.equal(live.length, 14);
    assert.deepEqual(snapshot('replay'), live);
    assert.deepEqual(snapshot('loaded'), live);
  });
});

describe('ADR Judas detection and alerts', () => {
  // Expected Judas days from 15m candles: a bar opening 00:00–08:00 reaches open ± ADR/3.
  const fifteenMinuteDays = (until, judasFraction = 1 / 3, cutoffMinutes = 8 * 60) => {
    const bars = market.timeBars('15', until, MONDAY_START);
    const days = nyDays(MONDAY_START, until);
    return days.map((entry, index) => {
      const end = days[index + 1]?.start ?? Infinity;
      const own = bars.time.flatMap((time, i) => (time >= entry.start && time < end ? [{ time, high: bars.high[i], low: bars.low[i] }] : []));
      const reach = entry.adr * judasFraction;
      const judas = own.some(bar => {
        const p = localParts(bar.time, NY);
        return p.hour * 60 + p.minute <= cutoffMinutes && (bar.high >= entry.open + reach || bar.low <= entry.open - reach);
      });
      return { ...entry, judas, bars: own };
    });
  };

  test('reaching 1/3 ADR before 08:00 frames the day high and low in an orange box to midnight and alerts once', () => {
    const at = day(10);
    const days = fifteenMinuteDays(at);
    const today = days.at(-1);
    const yesterday = days.at(-2);
    assert.ok(today.judas, 'the test day is a Judas day');
    const result = adr({ at, inputs: { judasEnabled: true } });
    const boxes = result.live('box');
    const todayBox = boxes.find(b => b.left === day(0));
    assert.ok(todayBox, 'today has a Judas box');
    assert.equal(formatNy(todayBox.right), formatNy(day(0, 0, 9)));
    assert.equal(todayBox.top, Math.max(...today.bars.map(b => b.high)));
    assert.equal(todayBox.bottom, Math.min(...today.bars.map(b => b.low)));
    assert.equal(Boolean(boxes.find(b => b.left === day(0, 0, 7))), yesterday.judas, 'yesterday keeps its box only if it was a Judas day');
    const judasAlerts = result.alerts.filter(a => a.message === 'ADR exhausted early' && a.time >= day(0));
    assert.equal(judasAlerts.length, 1, 'the Judas alert fires once');
  });

  test('with a 02:00 cutoff, only the days that reached 1/3 ADR by 02:00 keep a box', () => {
    const days = fifteenMinuteDays(day(10), 1 / 3, 2 * 60).slice(1).filter(d => !Number.isNaN(d.adr));
    assert.ok(days.some(d => d.judas) && days.some(d => !d.judas), 'the data has both kinds of morning');
    const result = adr({ at: day(10), inputs: { judasEnabled: true, judasHour: 2, adrHistory: 20 } });
    const boxedDays = result.live('box').map(b => formatNy(b.left)).sort();
    assert.deepEqual(boxedDays, days.filter(d => d.judas).map(d => formatNy(d.start)).sort());
  });

  test('each band alert fires once per NY day, on the first bar that touches it', () => {
    const at = day(16);
    const days = fifteenMinuteDays(at).filter(d => !Number.isNaN(d.adr));
    const result = adr({ at });
    for (const entry of days) {
      for (const [message, reached] of [
        ['1/3 ADR+ reached', b => b.high >= entry.open + entry.adr / 3],
        ['1/3 ADR- reached', b => b.low <= entry.open - entry.adr / 3],
        ['2/3 ADR+ reached', b => b.high >= entry.open + entry.adr * 2 / 3],
        ['ADR- reached', b => b.low <= entry.open - entry.adr],
      ]) {
        const fired = result.alerts.filter(a => a.message === message && entry.bars.some(b => b.time === a.time));
        const first = entry.bars.find(reached);
        assert.deepEqual(fired.map(a => formatNy(a.time)), first ? [formatNy(first.time)] : [], `${message} on ${formatNy(entry.start)}`);
      }
    }
    assert.ok(result.alerts.some(a => a.message === '1/3 ADR+ reached'), 'the data reaches a band');
  });
});

describe('ADR tables and Show Only', () => {
  test('the statistics table counts today and yesterday inside ±1/3, ±2/3 and the full ADR', () => {
    const at = day(10);
    const [yesterday, today] = nyDays(MONDAY_START, at).slice(-2);
    const result = adr({ at, inputs: { showStatisticsTable: true } });
    const within = fraction => [yesterday, today].filter(d => d.high <= d.open + d.adr * fraction && d.low >= d.open - d.adr * fraction).length;
    const rate = (count, total) => `${(count * 100 / total).toFixed(1)}%`;
    const [third, twoThirds, full] = [1 / 3, 2 / 3, 1].map(within);
    assert.deepEqual(tableRows(statisticsTable(result)), [
      'ADR | Days | Rate',
      'Displayed | 2 | 100.0%',
      `Within ±⅓ | ${third} | ${rate(third, 2)}`,
      `Within ±⅔ | ${twoThirds} | ${rate(twoThirds, 2)}`,
      `Within ±ADR | ${full} | ${rate(full, 2)}`,
      `Exceeded ADR | ${2 - full} | ${rate(2 - full, 2)}`,
    ]);
    assert.equal(tableRows(statisticsTable(adr({ at }))).length, 0, 'hidden by default');
  });

  test('Show Only RTH dims candles outside 09:30–16:00 on 15m and Range, never above 1 hour', () => {
    const hidden = (result, time) => {
      const index = result.bars.time.indexOf(time);
      assert.ok(index >= 0, `bar at ${formatNy(time)}`);
      return !Number.isNaN(result.plot('Hidden Candles')[index]);
    };
    const fifteen = adr({ at: day(16, 30), inputs: { showOnlyEnabled: true } });
    assert.equal(hidden(fifteen, day(9, 15)), true, '09:15 dimmed');
    assert.equal(hidden(fifteen, day(9, 30)), false, '09:30 shown');
    assert.equal(hidden(fifteen, day(15, 45)), false, '15:45 shown');
    assert.equal(hidden(fifteen, day(16)), true, '16:00 dimmed');
    assert.equal(hidden(fifteen, day(10, 0, 7)), false, 'earlier days\' RTH shown');

    const recentOnly = adr({ at: day(16, 30), inputs: { showOnlyEnabled: true, showOnlyMostRecent: true } });
    assert.equal(hidden(recentOnly, day(10, 0, 7)), true, 'Most Recent Only dims yesterday\'s RTH');
    assert.equal(hidden(recentOnly, day(10)), false, 'today\'s RTH still shown');

    const twoHour = adr({ chart: '120', at: day(16, 30), inputs: { showOnlyEnabled: true } });
    assert.ok(twoHour.plot('Hidden Candles').every(Number.isNaN), '2H never dims');

    const range = adr({ chart: 'R180', from: day(0), at: day(16, 30), inputs: { showOnlyEnabled: true } });
    const rangeHidden = range.plot('Hidden Candles').map(value => !Number.isNaN(value));
    const insideRth = range.bars.time.map(t => t >= day(9, 30) && t < day(16));
    assert.ok(insideRth.some(Boolean) && insideRth.some(v => !v));
    assert.deepEqual(rangeHidden, insideRth.map(v => !v), 'Range candles dim exactly outside RTH');
  });

  test('the color table lists every visible element of the enabled ranges', () => {
    const result = adr({ inputs: { showColorTable: true, judasEnabled: true, showAwr: true } });
    const colors = result.live('table').find(t => t.position === 'position.top_right');
    assert.deepEqual(tableRows(colors).map(row => row.split(' | ')[0]), ['Setting', 'ADR', '1/3 ADR', '2/3 ADR', 'MNO', 'Judas', 'AWR', '1/3 AWR', '2/3 AWR', 'Weekly Open']);
  });
});

describe('ADR drawing budget', () => {
  test('all three ranges with 20 periods of history and Judas stay within TradingView limits', () => {
    const history = { adrHistory: 20, awrHistory: 20, amrHistory: 20 };
    const result = adr({ chart: '60', from: nyTime(2026, 5, 10, 18), inputs: { showAwr: true, showAmr: true, judasEnabled: true, ...history } });
    for (const kind of ['line', 'label', 'box']) {
      const removed = result.all(kind).filter(object => object.garbageCollected);
      assert.equal(removed.length, 0, `${removed.length} ${kind}s were dropped by the ${kind} limit`);
    }
    // ADR and AWR keep the current period plus 20; AMR keeps the three months the synthetic history can average.
    assert.equal(result.live('line').length, 7 * (21 + 21 + 3), 'every range keeps its current period plus its history');
    assert.equal(result.live('label').length, 21, 'only current periods are labelled');
    assert.ok(result.live('box').length <= 21);
  });
});
