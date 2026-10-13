import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../code/pulse.pine', import.meta.url), 'utf8');
const body = name => source.match(new RegExp(`^${name}\\([^\\n]+\\) =>\\n([\\s\\S]*?)(?=^\\S)`, 'm'))[1].trimEnd();
const expression = code => code.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!').replace(/\bmath\./g, 'Math.');

// Execute the actual pool rendering branches with drawing/array adapters; this is not a Pine compiler.
function compile(name, args, returnsExpression = false) {
  if (returnsExpression) return `function ${name}(${args}) { return ${expression(body(name).trim())}; }`;
  const lines = [`function ${name}(${args}) {`];
  const blocks = [];
  for (const raw of body(name).split('\n')) {
    const code = raw.trim();
    if (!code) continue;
    const indent = raw.length - raw.trimStart().length;
    while (blocks.length && indent <= blocks.at(-1)) { lines.push('}'); blocks.pop(); }
    const loop = code.match(/^for (\w+) = (.+) to (.+)$/);
    if (loop) {
      lines.push(`for (let ${loop[1]} = ${loop[2]}; ${loop[1]} <= ${loop[3]}; ${loop[1]}++) {`);
      blocks.push(indent);
    } else if (code.startsWith('if ')) {
      lines.push(`if (${expression(code.slice(3))}) {`);
      blocks.push(indent);
    } else {
      lines.push(expression(code.replace(/^(?:array<\w+>|int|float|bool|color|LiquidityPool|LiquidityDepthLevels) /, 'let ')) + ';');
    }
  }
  while (blocks.length) { lines.push('}'); blocks.pop(); }
  return lines.join('\n') + '\n}';
}

const renderCode = [
  compile('pool_context_transparency', 'breached, hasOpenDepth', true),
  compile('pool_drawing_allowed', 'contextTransparency, preservedPass, requiredLines', true),
  compile('draw_pool_depths', 'depthState, basePrice, startTime, startIndex, isHigh, renderSpec, preservedPass'),
  compile('draw_pool_boundary', 'drawn, levelPrice, startTime, startIndex, endTime, endIndex, provisionalTime, provisionalIndex, lineColor, lineWidth'),
  compile('draw_liquidity_pool', 'renderSpec, preservedPass = false'),
].join('\n');

function harness(preserve = true) {
  const env = {
    all_lines: [], pending_label_events: [], drawingLineLimit: 500, NUM_LIQUIDITY_DEPTH_LEVELS: 3,
    showUnmitigatedOnly: true, preserveMitigatedContext: preserve, forecastLiquidityDepth: false,
    showLabels: true, time: 1000, bar_index: 1000, LINE_WIDTH_1: 1,
    array: { size: a => a.length, get: (a, i) => a[i], push: (a, v) => a.push(v) },
    na: v => v == null,
    color: { new: (base, transparency) => ({ base, transparency }) },
    line: { style_solid: 'solid', style_dashed: 'dashed' },
    depth_has_unmitigated_level: state => state.breached.some(value => !value),
    should_draw_liquidity_depth: (enabled, breached, forecast) => forecast || (enabled && breached),
    liquidity_depth_price: (base, high, index, step) => base + (high ? 1 : -1) * (index + 1) * step,
    get_pool_liq_depth_color: (_, base) => base,
    get_pool_liq_depth_width: () => 1, get_pool_liq_depth_style: () => 'dotted',
    create_pool_line: (...args) => ({ kind: 'level', start: args[0], price: args[2], color: args[5] }),
    create_liq_depth_connector: (...args) => ({ kind: 'connector', start: args[0], transparency: args[5] }),
    buffer_liq_depth_labels: (pending, ...args) => pending.push({ kind: 'depth', args }),
    buffer_pool_label: (pending, ...args) => pending.push({ kind: 'pool', args }),
  };
  for (const side of ['high', 'low']) {
    env[`pool_get_${side}_end_time`] = (_, index) => index + 1;
    env[`pool_get_${side}_end_index`] = (_, index) => index + 1;
  }
  vm.createContext(env);
  vm.runInContext(renderCode, env);
  return env;
}

function spec(count = 40, activeNewest = true, provisional = false) {
  const pool = {};
  for (const side of ['high', 'low']) {
    pool[`${side}s`] = Array.from({ length: count }, (_, i) => 20000 + i * 200 + (side === 'high' ? 100 : 0));
    pool[`${side}_times`] = pool[`${side}_indices`] = Array.from({ length: count }, (_, i) => i);
    pool[`${side}_breached`] = Array.from({ length: count }, (_, i) => !(activeNewest && i === count - 1));
    pool[`${side}_provisional_times`] = pool[`${side}_provisional_indices`] = Array(count).fill(provisional ? 1 : null);
    pool[`${side}_liquidity_depths`] = Array.from({ length: count }, () => ({ breached: [true, true, true], breach_times: [1, 2, 3], breach_indices: [1, 2, 3] }));
  }
  return { poolState: pool, visible: true, showLast: count, intradayDepth: false, depthActive: true, depthEnabled: true, depthStep: 27, lineColor: 'daily', lineWidth: 2, poolType: 'daily' };
}

test('40 Daily pools preserve open levels when 39 completed ladders exceed remaining capacity', () => {
  const env = harness();
  const input = spec();
  env.draw_liquidity_pool(input);
  assert.equal(env.all_lines.length, 2);
  const openLevels = [...env.all_lines];
  env.draw_liquidity_pool(input, true);
  assert.ok(env.all_lines.length <= 500);
  assert.ok(env.all_lines.length >= 498);
  assert.deepEqual(env.all_lines.slice(0, 2), openLevels);
  assert.equal(env.all_lines.filter(item => item.start === 39).length, 2);
  assert.ok(env.all_lines.some(item => item.start === 38));
  assert.ok(!env.all_lines.some(item => item.start === 0));
});

test('preserved depth/connector pairs and provisional boundary segments never overrun spare slots', () => {
  for (const provisional of [false, true]) {
    for (const occupied of [497, 498, 499, 500, 510]) {
      const env = harness();
      env.all_lines.push(...Array.from({ length: occupied }, () => ({ kind: 'foreground' })));
      env.draw_liquidity_pool(spec(1, false, provisional), true);
      assert.ok(env.all_lines.length <= Math.max(500, occupied));
      assert.equal(env.all_lines.filter(item => item.kind === 'foreground').length, occupied);
      assert.equal(env.pending_label_events.filter(event => event.kind === 'depth').length,
        env.all_lines.filter(item => item.kind === 'connector').length);
    }
  }
});

test('other foreground drawings consume capacity before preserved history', () => {
  const env = harness();
  const input = spec();
  env.draw_liquidity_pool(input);
  env.all_lines.push(...Array.from({ length: 496 }, () => ({ kind: 'open-or-range' })));
  env.draw_liquidity_pool(input, true);
  assert.equal(env.all_lines.length, 500);
  assert.equal(env.all_lines.filter(item => item.kind === 'open-or-range').length, 496);
  const preservedCall = source.indexOf('draw_liquidity_pool(renderSpec, true)');
  assert.ok(preservedCall > source.lastIndexOf('draw_timeframe_opens(daily_open,'));
  assert.ok(preservedCall > source.lastIndexOf('draw_intraday_closes(sixteen_hundred_close,'));
  assert.ok(preservedCall > source.lastIndexOf('middle_line = line.new('));
  assert.ok(source.indexOf('flush_label_events(pending_label_events, all_labels)', preservedCall) > preservedCall);
  assert.match(body('flush_label_events'), /drawingLabelLimit - array.size\(drawn\)/);
});

test('preservation off retains hiding and Show Last bounds the completed pass', () => {
  const off = harness(false);
  off.draw_liquidity_pool(spec());
  off.draw_liquidity_pool(spec(), true);
  assert.equal(off.all_lines.length, 2);
  const env = harness();
  const input = spec();
  input.showLast = 2;
  env.draw_liquidity_pool(input);
  env.draw_liquidity_pool(input, true);
  assert.equal(env.all_lines.length, 16);
  assert.ok(env.all_lines.every(item => item.start >= 38));
});
