import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadIndicator, runIndicator } from '../../../tests/runtime/run.mjs';
import { cmeMarket, nyTime, formatNy } from '../../../tests/runtime/scenario.mjs';
import { isNa } from '../../../tests/runtime/values.mjs';

// Runs aegis.pine bar by bar on synthetic NQ data and checks what the chart would show.
// Entry prices are placed relative to the synthetic candles so fills are known in advance.
// These pin current behavior; they do not prove TradingView compilation or rendering.

const program = loadIndicator(new URL('../code/aegis.pine', import.meta.url).pathname);
const HOUR = 3_600_000;
const market = cmeMarket();
const day = (hour, minute = 0, date = 8) => nyTime(2026, 10, date, hour, minute);
const AT = day(10, 30);
const ENTRY_TIME = day(9, 31);
const price = value => value.toFixed(2);

// Lowest low and highest high of the 1m candles from the entry time to the last bar.
const bars = market.timeBars('1', AT, ENTRY_TIME);
const LOW = Math.min(...bars.low);
const HIGH = Math.max(...bars.high);

function aegis({ chart = '1', at = AT, hoursOfChart = 6, inputs = {}, currencyRates } = {}) {
  const chartSpec = chart.startsWith('R') ? { type: 'range', size: Number(chart.slice(1)) * 0.25 } : { type: 'time', tf: chart };
  return runIndicator(program, { market, chart: chartSpec, from: at - hoursOfChart * HOUR, until: at, inputs: { entryTime: ENTRY_TIME, ...inputs }, currencyRates });
}

const textOf = label => label.text;
const GREEN = 'rgb(76,175,80) t85';
const RED = 'rgb(242,54,69) t85';
const shade = color => (color ? `rgb(${color.r},${color.g},${color.b}) t${color.t}` : 'none');
const labelStarting = (result, prefix) => result.live('label').find(l => l.text.startsWith(prefix) && !isNa(l.x));
const visibleLabels = result => result.live('label').filter(l => !isNa(l.x));
const visibleLines = result => result.live('line').filter(l => !isNa(l.x1));
const lineAtPrice = (result, value) => visibleLines(result).find(l => l.y1 === value);
const zones = result => result.live('box').filter(b => !isNa(b.left));
const riskTable = result => result.live('table')[0];
const cell = (result, column, row) => riskTable(result).cells.get(`${column},${row}`);
// The summary row is one merged cell, so only cells that were written are joined.
const row = (result, index) => [0, 1, 2, 3, 4, 5].map(column => cell(result, column, index)?.text).filter(text => text !== undefined).join(' | ');
const levelPrices = result => visibleLines(result).map(l => l.y1).sort((a, b) => a - b);

describe('Aegis position tool on 1m', () => {
  test('an unfilled long plan draws entries, AVG, TP and SL from the entry candle to the current candle, labels one bar right', () => {
    const [e1, e2, stop, target] = [LOW - 2, LOW - 7, LOW - 17, LOW + 13];
    const result = aegis({ inputs: { entry1Input: e1, entry2Input: e2, stopInput: stop, targetInput: target } });
    const entryIndex = result.bars.time.indexOf(ENTRY_TIME);
    assert.deepEqual(levelPrices(result), [stop, e2, LOW - 4.5, e1, target].sort((a, b) => a - b));
    for (const level of visibleLines(result)) {
      assert.equal(formatNy(result.bars.time[level.x1]), '2026-10-08 09:31 NY');
      assert.equal(level.x2, result.lastIndex);
    }
    for (const label of visibleLabels(result)) {
      assert.equal(label.x, result.lastIndex + 1);
      assert.equal(label.style, 'label.style_label_left');
    }
    assert.equal(result.bars.time[entryIndex], ENTRY_TIME);
    assert.deepEqual(visibleLabels(result).map(textOf).sort(), [
      `#1  •  1 NQ  •  ${price(e1)}`, `#2  •  1 NQ  •  ${price(e2)}`, `AVG  •  ${price(LOW - 4.5)}`, 'SL  - 500.00 USD', 'TP  + 700.00 USD',
    ].sort());
    assert.equal(row(result, 0), 'LONG  •  1.4R');
  });

  test('the RR zones fill from AVG to TP and from AVG to SL across the same span', () => {
    const [e1, e2, stop, target] = [LOW - 2, LOW - 7, LOW - 17, LOW + 13];
    const result = aegis({ inputs: { entry1Input: e1, entry2Input: e2, stopInput: stop, targetInput: target } });
    const spans = zones(result).map(b => `${b.bottom}..${b.top} ${formatNy(result.bars.time[b.left])}→${b.right === result.lastIndex ? 'now' : b.right}`).sort();
    assert.deepEqual(spans, [`${LOW - 4.5}..${target} 2026-10-08 09:31 NY→now`, `${stop}..${LOW - 4.5} 2026-10-08 09:31 NY→now`].sort());
    assert.equal(zones(aegis({ inputs: { entry1Input: e1, entry2Input: e2, stopInput: stop, targetInput: target, showZones: false } })).length, 0, 'RR Zones off');
  });

  test('after entry 1 fills, AVG hides on it and TP/SL show entry 1 only; the summary shows stage 1', () => {
    const [e1, e2, stop, target] = [LOW + 6, LOW - 2, LOW - 12, LOW + 26];
    const result = aegis({ inputs: { entry1Input: e1, entry2Input: e2, stopInput: stop, targetInput: target } });
    assert.equal(labelStarting(result, 'AVG'), undefined, 'AVG sits on entry 1 and is hidden');
    assert.equal(textOf(labelStarting(result, 'TP')), 'TP  + 400.00 USD');
    assert.equal(textOf(labelStarting(result, 'SL')), 'SL  - 360.00 USD');
    assert.equal(row(result, 0), 'LONG  •  1.11R');
    assert.equal(row(result, 1), 'Entries | Qty | Risk | Total Risk | TP | Total TP');
    assert.equal(row(result, 2), `#1  •  ${price(e1)} | 1 | 360.00 USD | 360.00 USD | 400.00 USD | 400.00 USD`);
    assert.equal(row(result, 3), `#2  •  ${price(e2)} | 1 | 200.00 USD | 560.00 USD | 560.00 USD | 960.00 USD`);
  });

  test('once both entries fill, AVG returns at the blended price and TP/SL cover both', () => {
    const [e1, e2, stop, target] = [LOW + 6, LOW + 1, LOW - 9, LOW + 23];
    const result = aegis({ inputs: { entry1Input: e1, entry2Input: e2, stopInput: stop, targetInput: target } });
    assert.equal(textOf(labelStarting(result, 'AVG')), `AVG  •  ${price(LOW + 3.5)}`);
    assert.equal(textOf(labelStarting(result, 'SL')), `SL  - ${price((15 + 10) * 20)} USD`);
    assert.equal(textOf(labelStarting(result, 'TP')), `TP  + ${price(19.5 * 2 * 20)} USD`);
  });

  test('a stop above the entries makes a short plan, filled when price trades up to entry 1', () => {
    const [e1, e2, stop, target] = [HIGH + 2, HIGH + 7, HIGH + 17, HIGH - 13];
    const result = aegis({ inputs: { entry1Input: e1, entry2Input: e2, stopInput: stop, targetInput: target } });
    assert.equal(row(result, 0), 'SHORT  •  1.4R');
    assert.equal(textOf(labelStarting(result, 'SL')), 'SL  - 500.00 USD');
    assert.equal(textOf(labelStarting(result, 'AVG')), `AVG  •  ${price(HIGH + 4.5)}`, 'price never reached the entries');
  });

  test('entry prices snap to the 0.25 tick and quantities pluralise the root symbol', () => {
    const result = aegis({ inputs: { entry1Input: LOW - 2.1, entry2Input: LOW - 7, entry1Quantity: 2, stopInput: LOW - 17, targetInput: LOW + 13 } });
    assert.equal(textOf(labelStarting(result, '#1')), `#1  •  2 NQs  •  ${price(LOW - 2)}`);
    assert.equal(textOf(labelStarting(result, '#2')), `#2  •  1 NQ  •  ${price(LOW - 7)}`);
  });
});

describe('Aegis risk table', () => {
  const stageShades = result => [2, 3].map(index => shade(cell(result, 0, index).bgcolor));

  test('only the stage price has reached is highlighted: green for a long, red for a short, none before a fill', () => {
    const unfilled = aegis({ inputs: { entry1Input: LOW - 2, entry2Input: LOW - 7, stopInput: LOW - 17, targetInput: LOW + 13 } });
    assert.ok(!stageShades(unfilled).includes(GREEN), stageShades(unfilled).join(', '));
    const longFirst = aegis({ inputs: { entry1Input: LOW + 6, entry2Input: LOW - 2, stopInput: LOW - 12, targetInput: LOW + 26 } });
    assert.equal(stageShades(longFirst)[0], GREEN, 'stage 1 green');
    assert.notEqual(stageShades(longFirst)[1], GREEN, 'stage 2 not highlighted');
    const longBoth = aegis({ inputs: { entry1Input: LOW + 6, entry2Input: LOW + 1, stopInput: LOW - 9, targetInput: LOW + 23 } });
    assert.equal(stageShades(longBoth)[1], GREEN, 'stage 2 green');
    assert.notEqual(stageShades(longBoth)[0], GREEN, 'stage 1 no longer highlighted');
    const shortFirst = aegis({ inputs: { entry1Input: HIGH - 6, entry2Input: HIGH + 2, stopInput: HIGH + 12, targetInput: HIGH - 26 } });
    assert.equal(row(shortFirst, 0), 'SHORT  •  1.11R');
    assert.equal(stageShades(shortFirst)[0], RED, 'short stage 1 red');
    assert.equal(shade(cell(longFirst, 0, 0).bgcolor), GREEN, 'valid long summary is green');
  });

  test('amounts of 1,000 or more use thousands separators on labels and in the table', () => {
    const result = aegis({ inputs: { entry1Input: LOW - 2, entry2Input: LOW - 7, stopInput: LOW - 47, targetInput: LOW + 33 } });
    assert.equal(textOf(labelStarting(result, 'TP')), 'TP  + 1,500.00 USD');
    assert.equal(textOf(labelStarting(result, 'SL')), 'SL  - 1,700.00 USD');
    assert.equal(row(result, 3), `#2  •  ${price(LOW - 7)} | 1 | 800.00 USD | 1,700.00 USD | 800.00 USD | 1,500.00 USD`);
  });
});

describe('Aegis invalid plans', () => {
  test('a stop between the entries reads "STOP MUST CLEAR ALL ENTRIES", hides the risk zone and marks stage 2 Invalid', () => {
    const result = aegis({ inputs: { entry1Input: LOW - 2, entry2Input: LOW - 12, stopInput: LOW - 8, targetInput: LOW + 13 } });
    assert.equal(row(result, 0), 'STOP MUST CLEAR ALL ENTRIES');
    assert.equal(textOf(labelStarting(result, 'SL')), 'SL');
    assert.equal(textOf(labelStarting(result, 'TP')), 'TP');
    assert.equal(zones(result).length, 0);
    assert.equal(cell(result, 3, 2).text, '120.00 USD');
    assert.equal(cell(result, 3, 3).text, 'Invalid');
  });

  test('a TP on the stop side reads "TP MUST OPPOSE STOP" and keeps only the risk zone', () => {
    const result = aegis({ inputs: { entry1Input: LOW - 2, entry2Input: LOW - 7, stopInput: LOW - 17, targetInput: LOW - 10 } });
    assert.equal(row(result, 0), 'TP MUST OPPOSE STOP');
    assert.deepEqual(zones(result).map(b => [b.bottom, b.top]), [[LOW - 17, LOW - 4.5]]);
    assert.equal(textOf(labelStarting(result, 'SL')), 'SL  - 500.00 USD');
  });

  test('with no entry time picked nothing is drawn and the table stays empty', () => {
    const result = aegis({ inputs: { entryTime: 0, entry1Input: LOW - 2, entry2Input: LOW - 7, stopInput: LOW - 17, targetInput: LOW + 13 } });
    assert.equal(visibleLines(result).length, 0);
    assert.equal(zones(result).length, 0);
    assert.equal(riskTable(result).cells.size, 0);
  });
});

describe('Aegis Max Risk stop', () => {
  const plan = { stopMode: 'Max Risk', entry1Input: LOW - 2, entry2Input: LOW - 7.5, targetInput: LOW + 13 };

  test('places the stop so a full fill loses at most Max Risk, rounded toward the entries', () => {
    const result = aegis({ inputs: { ...plan, maxRiskAmount: 516 } });
    assert.ok(lineAtPrice(result, LOW - 17.5), `stop at ${LOW - 17.5}`);
    assert.equal(textOf(labelStarting(result, 'SL')), 'SL  - 510.00 USD');
    assert.match(row(result, 0), /^LONG {2}• {2}/);
  });

  test('without a TP the table asks for one and no stop is drawn; an impossible amount reads "MAX RISK TOO HIGH"', () => {
    const noTarget = aegis({ inputs: { ...plan, targetInput: 0 } });
    assert.equal(row(noTarget, 0), 'SET TP DIRECTION');
    assert.equal(labelStarting(noTarget, 'SL'), undefined);
    assert.equal(row(aegis({ inputs: { ...plan, maxRiskAmount: 10_000_000 } }), 0), 'MAX RISK TOO HIGH');
  });

  test('in EUR, Max Risk and every amount use the EUR rate', () => {
    const result = aegis({ inputs: { ...plan, maxRiskAmount: 464.4, displayCurrency: 'EUR' }, currencyRates: { 'USD/EUR': 0.9 } });
    assert.ok(lineAtPrice(result, LOW - 17.5), '464.40 EUR = 516 USD sets the same stop');
    assert.equal(textOf(labelStarting(result, 'SL')), 'SL  - 459.00 EUR');
    assert.equal(cell(result, 3, 2).text, `${price(15.5 * 20 * 0.9)} EUR`);
  });
});

describe('Aegis placement options', () => {
  const plan = { entry1Input: LOW - 2, entry2Input: LOW - 7, stopInput: LOW - 17, targetInput: LOW + 13 };

  test('Latest Bar anchor projects the tool 2 bars past the current candle, 100 bars wide', () => {
    const result = aegis({ inputs: { ...plan, toolAnchorChoice: 'Latest Bar' } });
    for (const level of visibleLines(result)) assert.deepEqual([level.x1, level.x2], [result.lastIndex + 2, result.lastIndex + 102]);
    for (const label of visibleLabels(result)) assert.equal(label.x, result.lastIndex + 103);
  });

  test('To Current Bar off keeps the entry-time start with the fixed width; Labels Left sit one bar before the start', () => {
    const fixed = aegis({ inputs: { ...plan, extendToCurrentBar: false, toolWidthBars: 30 } });
    const start = fixed.bars.time.indexOf(ENTRY_TIME);
    for (const level of visibleLines(fixed)) assert.deepEqual([level.x1, level.x2], [start, start + 30]);
    const left = aegis({ inputs: { ...plan, labelSideChoice: 'Left' } });
    for (const label of visibleLabels(left)) {
      assert.equal(label.x, start - 1);
      assert.equal(label.style, 'label.style_label_right');
    }
  });

  test('Show Table off leaves the table empty; Position moves it', () => {
    assert.equal(riskTable(aegis({ inputs: { ...plan, showTable: false } })).cells.size, 0);
    assert.equal(riskTable(aegis({ inputs: { ...plan, tablePositionChoice: 'Top Right' } })).position, 'position.top_right');
  });
});

describe('Aegis on other chart types', () => {
  const plan = { entry1Input: LOW - 2, entry2Input: LOW - 7, stopInput: LOW - 17, targetInput: LOW + 13 };

  test('on 180R, an entry time picked on a Range candle anchors the tool there and fills track Range candles', () => {
    const probe = aegis({ chart: 'R180', hoursOfChart: 48, inputs: plan });
    const anchor = probe.bars.time.findIndex(t => t >= ENTRY_TIME);
    const rangeEntry = probe.bars.time[anchor];
    const lows = probe.bars.low.slice(anchor);
    const e1 = Math.min(...lows) + 6;
    const result = aegis({ chart: 'R180', hoursOfChart: 48, inputs: { entryTime: rangeEntry, entry1Input: e1, entry2Input: Math.min(...lows) - 2, stopInput: Math.min(...lows) - 12, targetInput: e1 + 20 } });
    for (const level of visibleLines(result)) assert.deepEqual([level.x1, level.x2], [anchor, result.lastIndex]);
    assert.equal(textOf(labelStarting(result, 'TP')), 'TP  + 400.00 USD', 'entry 1 filled on a Range candle');
    assert.equal(labelStarting(result, 'AVG'), undefined);
  });

  test('current behavior: a 09:31 entry time on a 15m chart matches no candle, so the tool falls back to Latest Bar placement', () => {
    const result = aegis({ chart: '15', hoursOfChart: 24, inputs: plan });
    for (const level of visibleLines(result)) assert.deepEqual([level.x1, level.x2], [result.lastIndex + 2, result.lastIndex + 102]);
    assert.equal(row(result, 0), 'LONG  •  1.4R');
  });
});

describe('Aegis drawing budget', () => {
  test('three entries reuse 6 lines, 6 labels and 2 zones; nothing is removed by TradingView limits', () => {
    const result = aegis({ hoursOfChart: 24, inputs: { entryCount: 3, entry1Input: LOW - 2, entry2Input: LOW - 7, entry3Input: LOW - 9, stopInput: LOW - 17, targetInput: LOW + 3 } });
    assert.equal(textOf(labelStarting(result, '#3')), `#3  •  1 NQ  •  ${price(LOW - 9)}`);
    for (const [kind, count] of [['line', 6], ['label', 6], ['box', 2], ['table', 1]]) {
      assert.equal(result.all(kind).length, count, `${kind}s created`);
      assert.equal(result.all(kind).filter(object => object.garbageCollected).length, 0);
    }
    assert.equal(row(result, 4).split(' | ')[0], `#3  •  ${price(LOW - 9)}`);
  });
});
