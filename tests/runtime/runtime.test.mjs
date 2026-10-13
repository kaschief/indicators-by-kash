import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from './parser.mjs';
import { compileSource, runIndicator } from './run.mjs';
import { Market, minuteCandles, nyTime } from './market.mjs';
import { localParts, zonedTimestamp } from './timezone.mjs';

// The behavior suites trust this engine, so its Pine semantics are pinned here first.

const market = new Market(minuteCandles({ start: nyTime(2026, 10, 5, 9), end: nyTime(2026, 10, 5, 13), seed: 3 }));
const run = (body, options = {}) => runIndicator(compileSource(`//@version=6\nindicator("t", overlay=true)\n${body}`), {
  market, chart: { type: 'time', tf: '1' }, until: nyTime(2026, 10, 5, 9, 10), ...options,
});
const plotted = (result, title) => result.plot(title).slice(0, result.lastIndex + 1);

test('every active indicator and library parses', () => {
  const files = [
    'indicators/06-kash-os/code/kash-os.pine', 'indicators/09-pulse/code/pulse.pine', 'indicators/13-gaps/code/gaps.pine',
    'indicators/14-deviations/code/deviations.pine', 'indicators/15-adr/code/adr.pine', 'indicators/18-parallax/code/parallax.pine',
    'indicators/19-elderwand/code/elderwand.pine', 'indicators/20-revelio/code/indicator/revelio.pine', 'indicators/21-legilimens/code/legilimens.pine',
    'indicators/24-aegis/code/aegis.pine',
  ];
  for (const file of files) assert.doesNotThrow(() => parse(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')), file);
});

test('var keeps its value across bars while plain declarations reset', () => {
  const result = run(`
var int counter = 0
counter += 1
int fresh = 0
fresh += 1
plot(counter, "counter")
plot(fresh, "fresh")`);
  assert.deepEqual(plotted(result, 'counter'), Array.from({ length: 10 }, (_, i) => i + 1));
  assert.deepEqual(plotted(result, 'fresh'), Array(10).fill(1));
});

test('history and var state are kept per call site', () => {
  const result = run(`
step(int increment) =>
    var int total = 0
    total += increment
    total
previous(float value) =>
    value[1]
a = step(1)
b = step(10)
plot(a, "a")
plot(b, "b")
plot(previous(bar_index * 2), "previous")`);
  assert.deepEqual(plotted(result, 'a'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(plotted(result, 'b'), [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.deepEqual(plotted(result, 'previous').slice(1), [0, 2, 4, 6, 8, 10, 12, 14, 16]);
  assert.ok(Number.isNaN(plotted(result, 'previous')[0]));
});

test('if and switch are expressions; loops honor dynamic bounds, direction, break and continue', () => {
  const result = run(`
label_for(int value) =>
    switch
        value < 3 => 1
        value < 6 => 2
        => 3
kind = if bar_index % 2 == 0
    10
else
    20
array<int> items = array.from(1, 2, 3)
int visited = 0
for i = 0 to array.size(items) - 1
    if i == 0
        array.push(items, 4)
    visited += 1
int down = 0
for i = 3 to 1
    down := down * 10 + i
int skipped = 0
for i = 0 to 5
    if i == 2
        continue
    if i == 4
        break
    skipped += 1
plot(label_for(bar_index), "switch")
plot(kind, "if")
plot(visited, "visited")
plot(down, "down")
plot(skipped, "skipped")`);
  assert.deepEqual(plotted(result, 'switch'), [1, 1, 1, 2, 2, 2, 3, 3, 3, 3]);
  assert.deepEqual(plotted(result, 'if').slice(0, 3), [10, 20, 10]);
  assert.equal(plotted(result, 'visited')[0], 4, 'v6 re-evaluates the upper bound each iteration');
  assert.equal(plotted(result, 'down')[0], 321);
  assert.equal(plotted(result, 'skipped')[0], 3);
});

test('and/or evaluate lazily', () => {
  const result = run(`
var int calls = 0
touch() =>
    calls += 1
    true
bool x = false and touch()
bool y = true or touch()
plot(calls, "calls")`);
  assert.deepEqual(plotted(result, 'calls'), Array(10).fill(0));
});

test('ta.change, ta.valuewhen and ta.sma follow their call site history', () => {
  const result = run(`
plot(ta.change(bar_index), "change")
plot(ta.valuewhen(bar_index % 3 == 0, bar_index, 1), "valuewhen")
plot(ta.sma(bar_index, 3), "sma")`);
  assert.deepEqual(plotted(result, 'change').slice(1), Array(9).fill(1));
  assert.deepEqual(plotted(result, 'valuewhen').slice(3), [0, 0, 0, 3, 3, 3, 6]);
  assert.deepEqual(plotted(result, 'sma').slice(2), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('request.security aligns higher-timeframe values with and without lookahead', () => {
  const body = `
[onTime, onClose] = request.security(syminfo.tickerid, "60", [time, close], lookahead=barmerge.lookahead_on)
offClose = request.security(syminfo.tickerid, "60", close, lookahead=barmerge.lookahead_off)
plot(onTime, "onTime")
plot(onClose, "onClose")
plot(offClose, "offClose")`;
  const result = run(body, { chart: { type: 'time', tf: '15' }, until: nyTime(2026, 10, 5, 12, 0), mode: 'loaded' });
  const hourly = market.timeBars('60', nyTime(2026, 10, 5, 12, 0));
  const nine = hourly.time.indexOf(nyTime(2026, 10, 5, 9, 0));
  assert.deepEqual(plotted(result, 'onTime').slice(0, 4), Array(4).fill(hourly.time[nine]));
  assert.deepEqual(plotted(result, 'onClose').slice(0, 4), Array(4).fill(hourly.close[nine]));
  assert.ok(Number.isNaN(plotted(result, 'offClose')[0]), 'lookahead off shows nothing before the first hour closes');
  assert.equal(plotted(result, 'offClose')[3], hourly.close[nine], 'the hour appears on its final 15m bar');
  assert.equal(plotted(result, 'offClose')[4], hourly.close[nine]);
});

test('drawings past the indicator limit delete the oldest one', () => {
  const result = run('label.new(bar_index, close, str.tostring(bar_index))', { until: nyTime(2026, 10, 5, 10, 0) });
  const live = result.live('label');
  assert.equal(live.length, 50);
  assert.equal(live[0].text, '10');
});

test('New York calendar math handles DST and day rollover', () => {
  const springForward = zonedTimestamp('America/New_York', 2026, 3, 8, 3, 0);
  assert.equal(localParts(springForward, 'America/New_York').hour, 3);
  assert.equal(springForward - zonedTimestamp('America/New_York', 2026, 3, 8, 1, 0), 3_600_000);
  const rolled = zonedTimestamp('America/New_York', 2026, 10, 31 + 1, 18, 0);
  assert.deepEqual([localParts(rolled, 'America/New_York').month, localParts(rolled, 'America/New_York').day], [11, 1]);
});

test('Range bars span exactly the range size and only the forming bar lacks a close time', () => {
  const size = 45;
  const bars = market.rangeBars(size);
  assert.ok(bars.time.length > 5);
  for (let i = 0; i < bars.time.length - 1; i++) {
    assert.equal(bars.high[i] - bars.low[i], size);
    assert.ok(bars.timeClose[i] >= bars.time[i] && bars.timeClose[i] === bars.time[i + 1]);
  }
  assert.ok(Number.isNaN(bars.timeClose.at(-1)));
});

test('a variable declared int keeps whole numbers from v6 fractional division', () => {
  const result = run(`
const int WINDOW = 7
int half = WINDOW / 2
ratio = WINDOW / 2
plot(half, "half")
plot(ratio, "ratio")`);
  assert.equal(plotted(result, 'half')[0], 3);
  assert.equal(plotted(result, 'ratio')[0], 3.5);
});

test('input overrides apply by variable name and reject unknown names or options', () => {
  const body = `
mode = input.string("A", "Mode", options=["A", "B"])
plot(mode == "B" ? 1 : 0, "mode")`;
  assert.equal(plotted(run(body, { inputs: { mode: 'B' } }), 'mode')[0], 1);
  assert.throws(() => run(body, { inputs: { mood: 'B' } }), /unknown inputs: mood/);
  assert.throws(() => run(body, { inputs: { mode: 'C' } }), /not one of/);
});

test('enum inputs accept the option title as an override', () => {
  const body = `
enum Mode
    auto = "Auto"
    on = "On"
mode = input.enum(Mode.auto, "Mode")
plot(mode == Mode.on ? 1 : 0, "mode")`;
  assert.equal(plotted(run(body, { inputs: { mode: 'On' } }), 'mode')[0], 1);
});

test('on Range charts a request without lookahead never returns a period that closes after the bar', () => {
  const result = run(`
[requestedClose, requestedEnd] = request.security(syminfo.tickerid, "5", [close, time_close])
plot(requestedEnd, "requestedEnd")
plot(time_close, "barEnd")`, { chart: { type: 'range', size: 10 }, until: nyTime(2026, 10, 5, 12, 0), mode: 'loaded' });
  const requested = plotted(result, 'requestedEnd');
  const barEnds = plotted(result, 'barEnd');
  for (let i = 0; i < result.lastIndex; i++) if (!Number.isNaN(requested[i])) assert.ok(requested[i] <= barEnds[i], `bar ${i} saw a period ending after its close`);
});

test('a finer request returns the last intrabar of a time-chart bar', () => {
  const result = run('plot(request.security(syminfo.tickerid, "1", close), "inner")\nplot(close, "outer")', { chart: { type: 'time', tf: '5' }, until: nyTime(2026, 10, 5, 10, 0), mode: 'loaded' });
  assert.deepEqual(plotted(result, 'inner'), plotted(result, 'outer'));
});

test('intrabar requests keep their state when the script skips a bar', () => {
  const body = skip => `
float[] values = ${skip ? 'bar_index % 2 == 0 ? ' : ''}request.security_lower_tf(syminfo.tickerid, "1", ta.ema(close, 5))${skip ? ' : array.new<float>()' : ''}
plot(array.size(values) > 0 ? array.last(values) : na, "last")`;
  const options = { chart: { type: 'time', tf: '5' }, until: nyTime(2026, 10, 5, 10, 0), mode: 'loaded' };
  const every = plotted(run(body(false), options), 'last');
  const alternate = plotted(run(body(true), options), 'last');
  alternate.forEach((value, i) => { if (!Number.isNaN(value)) assert.equal(value, every[i]); });
});

test('history inside a function called in a loop advances once per bar, like ta.*', () => {
  const result = run(`
smooth(float value) =>
    ta.sma(value, 3)
float direct = na
float wrapped = na
for i = 0 to 1
    direct := ta.sma(close, 3)
    wrapped := smooth(close)
plot(direct, "direct")
plot(wrapped, "wrapped")`);
  assert.deepEqual(plotted(result, 'wrapped'), plotted(result, 'direct'));
});

test('declared drawing limits are capped at TradingView maximums', () => {
  const result = runIndicator(compileSource('//@version=6\nindicator("t", overlay=true, max_lines_count=900)\nfor i = 0 to 9\n    line.new(bar_index, close, bar_index + 1, close)'), {
    market, chart: { type: 'time', tf: '1' }, until: nyTime(2026, 10, 5, 10, 0),
  });
  assert.equal(result.live('line').length, 500);
});

test('a non-bool condition is rejected, as TradingView would not compile it', () => {
  assert.throws(() => run('v = 1.0\nplot(v ? 1 : 2)'), /condition must be bool/);
});
