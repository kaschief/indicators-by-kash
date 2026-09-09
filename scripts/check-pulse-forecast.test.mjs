import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../indicators/09-pulse/code/pulse.pine', import.meta.url), 'utf8');
const expression = source.match(/^should_draw_liquidity_depth\([^\n]+\) =>\n    ([^\n]+)/m)?.[1];
assert.ok(expression, 'Pulse must expose its shared LD visibility rule');

// Evaluate only the source predicate; this does not compile or execute the Pine indicator.
const drawDepth = new Function('depthEnabled', 'poolBreached', 'forecastEnabled', 'unmitigatedOnly',
  `return ${expression.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!')};`);

const scenarios = [
  ['both controls off, before break', false, false, false, false],
  ['both controls off, after break', false, true, false, false],
  ['forecast previews an unbroken pool with LD off', false, false, true, true],
  ['forecast cannot revive a broken historical pool with LD off', false, true, true, false],
  ['normal LD waits for the pool break', true, false, false, false],
  ['normal LD remains visible after the pool break', true, true, false, true],
  ['forecast previews before enabled LD activates', true, false, true, true],
  ['enabled LD takes over after the pool break', true, true, true, true],
];

for (const [name, enabled, breached, forecast, expected] of scenarios) {
  test(name, () => {
    for (const unmitigatedOnly of [false, true]) {
      assert.equal(drawDepth(enabled, breached, forecast, unmitigatedOnly), expected);
    }
  });
}

test('all seven pool types use the shared lifecycle rule on both sides', () => {
  for (const period of ['Daily', 'Weekly', 'Monthly']) {
    for (const side of ['high', 'low']) {
      assert.ok(source.includes(`should_draw_liquidity_depth(effectiveEnable${period}LiquidityDepth, ${side}_breached, forecastLiquidityDepth)`));
    }
  }
  for (const side of ['high', 'low']) {
    assert.ok(source.includes(`should_draw_liquidity_depth(enableLiqDepth, ${side}_breached, forecastLiquidityDepth)`));
  }
  for (const pool of ['asia_open', 'rafael', 'overnight', 'premarket']) {
    assert.ok(source.includes(`draw_intraday_pool(${pool}_pool,`));
  }
});
