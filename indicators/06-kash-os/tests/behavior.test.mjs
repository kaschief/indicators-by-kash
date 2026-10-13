import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadIndicator, runIndicator } from '../../../tests/runtime/run.mjs';
import { cmeMarket, nyTime, formatNy } from '../../../tests/runtime/scenario.mjs';

// Runs kash-os.pine bar by bar on synthetic NQ data and checks what the chart would show.
// These pin current behavior; they do not prove TradingView compilation or rendering.

const program = loadIndicator(new URL('../code/kash-os.pine', import.meta.url).pathname);
const DAY = 86_400_000;
const member = (enumName, name) => program.enums.get(enumName).members[name];
const MIDNIGHT = member('DividerBoundary', 'midnight');
const REOPEN = member('DividerBoundary', 'sessionReopen');

// Thursday 8 October 2026 at 13:00 is "now"; charts show the ten days before it
// (Monday 28 September 13:00 onward), which spans one month end and one weekend.
const day = (date, hour, minute = 0, month = 10) => nyTime(2026, month, date, hour, minute);
const NOW = day(8, 13);

const runs = new Map();
function kashOs({ chart = '1', mode = 'live', inputs = {}, at = NOW, days = 10 } = {}) {
  const key = JSON.stringify([chart, mode, inputs, at, days]);
  if (!runs.has(key)) {
    const chartSpec = chart.startsWith('R') ? { type: 'range', size: Number(chart.slice(1)) * 0.25 } : { type: 'time', tf: chart };
    runs.set(key, runIndicator(program, { market: cmeMarket(), chart: chartSpec, from: at - days * DAY, until: at, mode, inputs }));
  }
  return runs.get(key);
}

const rgbt = color => `${color.r},${color.g},${color.b},${color.t}`;
// Vertical dividers, oldest first, as "<NY time> <style> w<width> <colour>".
const dividers = result => result.live('line')
  .filter(line => line.xloc === 'xloc.bar_time' && line.x1 === line.x2)
  .map(line => `${formatNy(line.x1)} ${line.style.replace('line.style_', '')} w${line.width} ${rgbt(line.color)}`);
const dividerTimes = result => dividers(result).map(text => text.slice(0, 19));
const firesAt = (result, title) => result.plot(title).flatMap((value, index) => (value === true ? [formatNy(result.bars.time[index])] : []));
const widgets = result => result.live('table').filter(table => table.columns === 1)
  .map(table => ({ position: table.position, text: table.cells.get('0,0').text }));
const ny = (date, hour, minute = 0, month = 10) => formatNy(day(date, hour, minute, month));

describe('Kash OS widgets', () => {
  test('default chart shows "kash os •" top centre and "NQ1! / 1m" top right', () => {
    assert.deepEqual(widgets(kashOs()), [
      { position: 'position.top_center', text: 'kash os •' },
      { position: 'position.top_right', text: 'NQ1!\n\n1m' },
    ]);
  });

  test('the symbol widget names the chart: 15m, 30m, 1H, and R on a Range chart', () => {
    const timeframeOf = chart => widgets(kashOs({ chart })).find(widget => widget.position === 'position.top_right').text.split('\n\n')[1];
    assert.deepEqual(['15', '30', '60', 'R180'].map(timeframeOf), ['15m', '30m', '1H', 'R']);
  });

  test('a name preset replaces the custom name, and an empty custom name hides the name widget', () => {
    assert.equal(widgets(kashOs({ inputs: { indicatorNamePreset: '🩵 range demon •' } }))[0].text, '🩵 range demon •');
    assert.deepEqual(widgets(kashOs({ inputs: { indicatorNameText: '' } })).map(widget => widget.position), ['position.top_right']);
  });
});

describe('Kash OS time dividers', () => {
  const ALL = { showDailyDividers: true, showWeeklyDividers: true, showMonthlyDividers: true };

  test('defaults on 1m: dashed daily lines at NY midnight (none for Sunday), the week at Sunday 18:00, the month at the 30 Sep 18:00 reopen', () => {
    const result = kashOs({ inputs: ALL });
    const daily = '184,184,184,40';
    assert.deepEqual(dividers(result), [
      `${ny(29, 0, 0, 9)} dashed w1 ${daily}`,
      `${ny(30, 0, 0, 9)} dashed w1 ${daily}`,
      `${ny(30, 18, 0, 9)} dotted w3 184,184,184,0`,
      `${ny(1, 0)} dashed w1 ${daily}`,
      `${ny(2, 0)} dashed w1 ${daily}`,
      `${ny(4, 18)} dashed w2 248,187,208,50`,
      `${ny(5, 0)} dashed w1 ${daily}`,
      `${ny(6, 0)} dashed w1 ${daily}`,
      `${ny(7, 0)} dashed w1 ${daily}`,
      `${ny(8, 0)} dashed w1 ${daily}`,
    ]);
    for (const line of result.live('line')) assert.equal(line.extend, 'extend.both', 'dividers run the full pane height');
  });

  test('switching boundaries: daily at every 18:00 reopen (Sunday included), week at Monday 00:00, month at 1 Oct 00:00', () => {
    const result = kashOs({ chart: '15', inputs: { ...ALL, dailyDividerBoundary: REOPEN, weeklyDividerBoundary: MIDNIGHT, monthlyDividerBoundary: MIDNIGHT } });
    assert.deepEqual(dividerTimes(result), [
      ny(28, 18, 0, 9), ny(29, 18, 0, 9), ny(30, 18, 0, 9), ny(1, 0), ny(1, 18), ny(4, 18), ny(5, 0), ny(5, 18), ny(6, 18), ny(7, 18),
    ]);
  });

  test('on 60m the dividers sit on the same hours as on 1m', () => {
    assert.deepEqual(dividerTimes(kashOs({ chart: '60', inputs: ALL })), dividerTimes(kashOs({ inputs: ALL })));
  });

  test('on R180 each divider sits on the first Range candle opening at or after the boundary', () => {
    const result = kashOs({ chart: 'R180', inputs: { showDailyDividers: true, dailyDividerBoundary: REOPEN } });
    const lines = result.live('line');
    assert.equal(lines.length, 8);
    for (const line of lines) {
      const index = result.bars.time.indexOf(line.x1);
      const [, y, m, d] = /^(\d+)-(\d+)-(\d+)/.exec(formatNy(line.x1)).map(Number);
      const reopen = nyTime(y, m, d, 18);
      assert.ok(index > 0 && result.bars.time[index - 1] < reopen && line.x1 >= reopen, `${formatNy(line.x1)} is the first Range candle after 18:00`);
    }
    assert.equal(formatNy(lines.at(-1).x1).slice(0, 13), ny(7, 18).slice(0, 13));
  });

  test('Show Last keeps only the newest dividers and Bar Replay draws the same ones', () => {
    const inputs = { showDailyDividers: true, dailyDividerShowLast: 3 };
    assert.deepEqual(dividerTimes(kashOs({ inputs })), [ny(6, 0), ny(7, 0), ny(8, 0)]);
    assert.deepEqual(dividerTimes(kashOs({ inputs, mode: 'replay' })), dividerTimes(kashOs({ inputs })));
  });

  test('on a Daily chart the daily dividers switch off while weekly ones stay', () => {
    const result = kashOs({ chart: 'D', days: 60, inputs: { showDailyDividers: true, showWeeklyDividers: true } });
    const times = result.live('line').map(line => line.x1);
    assert.ok(times.length >= 7, `weekly dividers drawn: ${times.length}`);
    for (const time of times) assert.match(formatNy(time), /18:00 NY$/, 'each sits on a session-reopen bar');
    for (let i = 1; i < times.length; i++) assert.equal(times[i] - times[i - 1], 7 * DAY, 'one per week, no daily lines');
  });
});

describe('Kash OS day labels', () => {
  test('with the 00:00 boundary each weekday is named at noon, Monday included and never Sunday', () => {
    const result = kashOs({ inputs: { showDayLabels: true } });
    assert.deepEqual(firesAt(result, 'MON'), [ny(5, 12)]);
    assert.deepEqual(firesAt(result, 'THU'), [ny(1, 12), ny(8, 12)]);
    assert.deepEqual(firesAt(result, 'FRI'), [ny(2, 12)]);
    assert.deepEqual(firesAt(result, 'SUN'), []);
    assert.deepEqual(firesAt(result, 'SAT'), []);
  });

  test('with the 18:00 boundary the label moves to 06:00, on 15m and on the first R180 candle after 06:00', () => {
    const inputs = { showDayLabels: true, dailyDividerBoundary: REOPEN };
    assert.deepEqual(firesAt(kashOs({ chart: '15', inputs }), 'TUE'), [ny(29, 6, 0, 9), ny(6, 6)]);
    for (const time of firesAt(kashOs({ chart: 'R180', inputs }), 'WED')) assert.match(time, / 06:\d\d NY$/);
  });

  test('day labels stay off above 4-hour charts', () => {
    const result = kashOs({ chart: 'D', days: 30, inputs: { showDayLabels: true } });
    for (const title of ['MON', 'TUE', 'WED', 'THU', 'FRI']) assert.deepEqual(firesAt(result, title), [], title);
  });
});

describe('Kash OS round numbers', () => {
  test('19 levels every 50 points around price: solid pink 100s, dashed purple 50s, labelled 51 bars right', () => {
    const result = kashOs({ chart: '15', inputs: { showRoundNumbers: true } });
    const close = result.bars.close[result.lastIndex];
    const lines = result.live('line');
    const labels = result.live('label');
    assert.equal(lines.length, 19);
    assert.equal(labels.length, 19);
    const prices = lines.map(line => line.y1);
    const centre = Math.round(close / 100) * 100;
    assert.deepEqual(prices, Array.from({ length: 19 }, (_, i) => centre + (i - 9) * 50));
    for (const line of lines) {
      const main = line.y1 % 100 === 0;
      assert.equal(`${line.style} ${rgbt(line.color)}`, main ? 'line.style_solid 244,143,177,0' : 'line.style_dashed 75,69,161,50');
      assert.equal(line.extend, 'extend.right');
      assert.equal(line.x1, result.lastIndex);
    }
    for (const label of labels) {
      assert.equal(label.x, result.lastIndex + 51);
      assert.equal(label.text, String(label.y));
      assert.equal(label.size, label.y % 100 === 0 ? 'normal' : 'small');
    }
  });
});

describe('Kash OS colour table and drawing budget', () => {
  test('the colour table lists only the active pieces', () => {
    const table = kashOs({ inputs: { showColorTable: true, showDailyDividers: true, showRoundNumbers: true, roundNumberCount: 1 } }).live('table').find(item => item.columns === 3);
    const names = Array.from({ length: table.rows }, (_, row) => table.cells.get(`0,${row}`).text);
    assert.deepEqual(names, ['Setting', 'Indicator Name Text', 'Indicator Name Border', 'Symbol Info Text', 'Symbol Info Border', 'Daily Divider', 'Round Numbers Main Line', 'Round Numbers Main Text']);
    assert.equal(table.cells.get('1,5').text, 'R:184 G:184 B:184');
    assert.equal(table.cells.get('2,5').text, '40');
  });

  test('every feature at its maximum over six months of 15m: nothing is silently removed', () => {
    const result = kashOs({
      chart: '15', days: 180,
      inputs: {
        showDailyDividers: true, showWeeklyDividers: true, showMonthlyDividers: true, showDayLabels: true, showRoundNumbers: true,
        dailyDividerShowLast: 160, weeklyDividerShowLast: 160, monthlyDividerShowLast: 160, showColorTable: true,
      },
    });
    for (const kind of ['line', 'label']) {
      const removed = result.all(kind).filter(object => object.garbageCollected);
      assert.equal(removed.length, 0, `${removed.length} ${kind}s were dropped by the ${kind} limit`);
    }
    assert.equal(result.live('label').length, 19);
    assert.ok(result.live('line').length > 160, `${result.live('line').length} lines`);
  });
});
