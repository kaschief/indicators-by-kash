import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../indicators/09-pulse/code/pulse.pine', import.meta.url), 'utf8');
const toJavaScript = value => value.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!');
const assignment = name => {
  const value = source.match(new RegExp(`^${name} = (.+)$`, 'm'))?.[1];
  assert.ok(value, `${name} must exist`);
  return toJavaScript(value);
};
const functionBody = name => {
  const value = source.match(new RegExp(`^${name}\\([^\\n]+\\) =>\\n([\\s\\S]*?)(?=^\\S)`, 'm'))?.[1];
  assert.ok(value, `${name} must exist`);
  return value.trim();
};
const evaluate = (expression, values) => new Function(...Object.keys(values), `return ${expression};`)(...Object.values(values));

// These tests evaluate source expressions and wiring. They do not compile Pine or prove chart rendering.
const drawDepth = new Function('depthEnabled', 'poolBreached', 'forecastEnabled', `return ${toJavaScript(functionBody('should_draw_liquidity_depth'))};`);
const depthActive = new Function('depthEnabled', 'forecastEnabled', 'eligible', `return ${toJavaScript(functionBody('liquidity_depth_enabled'))};`);

for (const enabled of [false, true]) {
  for (const breached of [false, true]) {
    test(`Forecast ON overrides LD=${enabled} for breached=${breached}`, () => {
      assert.equal(drawDepth(enabled, breached, true), true);
    });
    test(`Forecast OFF preserves LD=${enabled} for breached=${breached}`, () => {
      assert.equal(drawDepth(enabled, breached, false), enabled && breached);
    });
  }
}

test('Forecast applies to every selected pool, not only pools with LD enabled', () => {
  const pools = [
    { enabled: false, breached: false },
    { enabled: true, breached: false },
    { enabled: false, breached: true },
    { enabled: true, breached: true },
    { enabled: false, breached: false },
  ];
  assert.equal(pools.filter(pool => drawDepth(pool.enabled, pool.breached, true)).length, 5);
  assert.equal(pools.filter(pool => drawDepth(pool.enabled, pool.breached, false)).length, 1);
});

for (const period of ['Daily', 'Weekly', 'Monthly', 'Overnight', 'Premarket', 'AsiaOpen', 'Rafael']) {
  const intraday = !['Daily', 'Weekly', 'Monthly'].includes(period);
  const flag = `${period[0].toLowerCase()}${period.slice(1)}DepthActive`;
  const pool = period === 'AsiaOpen' ? 'asia_open' : period.toLowerCase();
  const nativeFlag = `${['AsiaOpen', 'Rafael'].includes(period) ? 'enable' : 'effectiveEnable'}${period}LiquidityDepth`;

  test(`${period}: Forecast overrides LD only inside normal eligibility`, () => {
    for (const enabled of [false, true]) {
      for (const forecast of [false, true]) {
        for (const eligible of [false, true]) {
          const values = {
            liquidity_depth_enabled: depthActive,
            [nativeFlag]: enabled,
            forecastLiquidityDepth: forecast,
            ...(intraday ? {
              intradaySessionTimeframeAllowed: eligible,
              isAssetSupported: true,
              dailyLiquidityDepthDistance: 27,
            } : {
              isAssetSupported: true,
              [`effectiveIs${period}LiquidityDepthTimeframeValid`]: eligible,
              [`${pool}LiquidityDepthDistance`]: 27,
            }),
          };
          assert.equal(evaluate(assignment(flag), values), eligible && (enabled || forecast));
          assert.equal(evaluate(assignment(flag), { ...values, isAssetSupported: false }), false);
          assert.equal(evaluate(assignment(flag), { ...values, [`${intraday ? 'daily' : pool}LiquidityDepthDistance`]: 0 }), false);
        }
      }
    }
  });

  test(`${period}: drawing and touch tracking share the resolved eligibility`, () => {
    assert.match(source, new RegExp(`pool_detect_breaches\\(${pool}_pool, [^,]+, ${flag}, ${intraday}`));
    const spec = source.split('\n').find(line => line.includes(`PoolRenderSpec.new(${pool}_pool,`));
    assert.ok(spec);
    const distance = `${intraday ? 'daily' : pool}LiquidityDepthDistance`;
    assert.ok(spec.includes(`${nativeFlag}, ${flag}, ${intraday}, ${distance}`));
    const scans = source.split('\n').filter(line => line.includes(`pool_detect_breaches(${pool}_pool,`));
    assert.ok(scans.every(line => line.includes(`${flag}, ${intraday}, ${distance}, high, low, time, bar_index)`)));
  });
}

test('all seven pools share drawing, visibility and price calculation', () => {
  assert.equal((source.match(/PoolRenderSpec\.new\(/g) || []).length, 7);
  assert.match(source, /for renderSpec in poolRenderSpecs\n        draw_liquidity_pool\(/);
  for (const side of ['high', 'low']) {
    assert.ok(source.includes(`should_draw_liquidity_depth(renderSpec.depthEnabled, ${side}_breached, forecastLiquidityDepth)`));
  }
  assert.match(functionBody('draw_liquidity_pool'), /if renderSpec\.depthActive/);
  for (const name of ['draw_pool_depths', 'pool_detect_depth_breaches']) {
    assert.match(functionBody(name), /liquidity_depth_price\(/);
  }
});

test('fixed projections keep the instrument distances at every base price', () => {
  const statements = functionBody('liquidity_depth_price').split('\n').map(line => line.trim());
  const result = statements.pop();
  const price = new Function('basePrice', 'isHigh', 'levelIndex', 'depthStep',
    `${statements.map(line => line.replace(/^float /, 'let ') + ';').join('\n')} return ${result};`);
  for (const [symbol, offsets] of [
    ['NQ', [27, 54, 81]], ['ES', [9, 18, 27]], ['YM', [27, 54, 81]],
    ['RTY', [4, 8, 12]], ['GC', [3, 6, 9]], ['CL', [0.125, 0.25, 0.375]],
    ['BTC', [100, 200, 300]], ['ETH', [10, 20, 30]],
  ]) {
    const registry = source.split('\n').find(line => line.includes(`AssetFamily.new(array.from("${symbol}"`));
    assert.ok(registry, symbol);
    const step = Number(registry.match(/\), ([\d.]+),/)[1]);
    for (const basePrice of [100, 1200, 29600, 30000]) {
      for (const isHigh of [false, true]) {
        assert.deepEqual([0, 1, 2].map(i => price(basePrice, isHigh, i, step)),
          offsets.map(offset => isHigh ? basePrice + offset : basePrice - offset), symbol);
      }
    }
  }
});

test('session LD has no percentage fallback or stale percentage UI', () => {
  assert.doesNotMatch(source, /intradayLiquidityDepthPercent|intraday_liquidity_depth_percent|DEFAULT_INTRADAY_LIQUIDITY_DEPTH_PERCENT|percentDepth|percentage-based/);
  assert.match(source, /intradayLevels = depth_distances_text\(dailyLiquidityDepthDistance\)/);
  assert.equal((source.match(/LD uses Daily point distances\./g) || []).length, 4);
});

const modes = {
  FILTER_TODAY: 'Today', FILTER_KEY_OPENS: 'Key Opens',
  FILTER_ASIA_OPEN_RAFAEL: 'Asia Open + Rafael', FILTER_ALL: 'All',
};
for (const [selection, keyOpens, sessions] of [
  ['None', false, false], ['Key Opens', true, false],
  ['Asia Open + Rafael', false, true], ['All', true, true],
]) {
  test(`Today dropdown ${selection} enables the selected additions`, () => {
    const values = { ...modes, pulseModeFilter: 'Today', todayAdditionalPools: selection };
    assert.equal(evaluate(assignment('keyOpensVisible'), values), keyOpens);
    assert.equal(evaluate(assignment('asiaOpenRafaelVisible'), values), sessions);
    for (const name of ['AsiaOpen', 'Rafael']) {
      assert.equal(evaluate(assignment(`show${name}Filtered`), {
        ...values, asiaOpenRafaelVisible: sessions, [`show${name}`]: false,
      }), sessions);
    }
    assert.equal(evaluate(assignment('effectiveAsiaOpenRafaelShowLast'), {
      isTodayFilter: true, todayShowLast: 3, asiaOpenRafaelShowLast: 20,
    }), 3);
  });
}

test('Today additions default to None and do not change dedicated session preferences', () => {
  assert.match(source, /todayAdditionalPools = input.string\("None", "Show in Today", [^\n]*options=\["None", FILTER_KEY_OPENS, FILTER_ASIA_OPEN_RAFAEL, FILTER_ALL\]/);
  assert.doesNotMatch(source, /showKeyOpensInToday|showAsiaOpenRafaelInToday/);
  for (const enabled of [false, true]) {
    for (const name of ['AsiaOpen', 'Rafael']) {
      assert.equal(evaluate(assignment(`show${name}Filtered`), {
        ...modes, pulseModeFilter: 'Asia Open + Rafael', asiaOpenRafaelVisible: true, [`show${name}`]: enabled,
      }), enabled);
    }
  }
});

test('line and merged-label priority share Monthly through Rafael ranking', () => {
  const order = ['RAFAEL', 'ASIA_OPEN', 'PREMARKET', 'OVERNIGHT', 'DAILY', 'WEEKLY', 'MONTHLY'];
  const values = Object.fromEntries(order.map(name => [`POOL_TYPE_${name}`, name]));
  const priority = pool_type => evaluate(toJavaScript(functionBody('pool_priority')), { ...values, pool_type });
  assert.deepEqual(order.map(priority), [3, 4, 5, 6, 7, 8, 9]);
  assert.match(source, /pool_priority\(previousSpec.poolType\) <= pool_priority\(movingSpec.poolType\)/);
  assert.match(source, /int rank = pool_priority\(pool_type\)/);
});

for (const pool of ['Daily', 'Weekly', 'Monthly', 'Overnight', 'Premarket', 'Asia Open', 'Rafael']) {
  test(`${pool}: LD is blue outside Today and uses the shared tier colors in Today`, () => {
    for (const isTodayFilter of [false, true]) {
      for (const level_idx of [0, 1, 2]) {
        const lineColor = `${pool}-color`;
        const actual = evaluate(toJavaScript(functionBody('get_pool_liq_depth_color')), {
          level_idx, lineColor, isTodayFilter,
          DEFAULT_LIQUIDITY_DEPTH_EXTENSION_COLOR: 'extension-red',
          DEFAULT_LIQUIDITY_DEPTH_BLUE: 'depth-blue',
        });
        const expected = isTodayFilter ? (level_idx === 0 ? lineColor : 'extension-red') : 'depth-blue';
        assert.equal(actual, expected);
      }
    }
  });
}
