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
  const delayedMitigation = ['AsiaOpen', 'Rafael'].includes(period);
  const flag = `${period[0].toLowerCase()}${period.slice(1)}DepthActive`;
  const pool = period === 'AsiaOpen' ? 'asia_open' : period.toLowerCase();
  const nativeFlag = `effectiveEnable${period}LiquidityDepth`;

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
    assert.match(source, new RegExp(`pool_detect_breaches\\(${pool}_pool, [^,]+, ${flag}, ${intraday}, ${delayedMitigation}`));
    const spec = source.split('\n').find(line => line.includes(`PoolRenderSpec.new(${pool}_pool,`));
    assert.ok(spec);
    const distance = `${intraday ? 'daily' : pool}LiquidityDepthDistance`;
    assert.ok(spec.includes(`${nativeFlag}, ${flag}, ${intraday}, ${distance}`));
    const scans = source.split('\n').filter(line => line.includes(`pool_detect_breaches(${pool}_pool,`));
    assert.ok(scans.every(line => line.includes(`${flag}, ${intraday}, ${delayedMitigation}, ${distance}, high, low, time, bar_index)`)));
  });
}

test('Asia Open and Rafael track provisional LD touches while deferring parent confirmation until 05:00 NY', () => {
  const detectionBody = functionBody('pool_detect_breaches');
  const confirmationBody = functionBody('delayed_mitigation_confirmation_start');

  assert.match(confirmationBody, /timestamp\(NY_TIMEZONE, year\(sessionStartTime, NY_TIMEZONE\), month\(sessionStartTime, NY_TIMEZONE\), dayofmonth\(sessionStartTime, NY_TIMEZONE\) \+ 1, MITIGATION_START_HOUR, 0\)/);
  assert.match(detectionBody, /bool canConfirmMitigation = not delayedMitigation or eventTime >= delayed_mitigation_confirmation_start\(array\.get\(pool\.session_start_times, poolIndex\)\)/);
  for (const side of ['high', 'low']) {
    assert.match(detectionBody, new RegExp(`else if not array\\.get\\(pool\\.${side}_provisional_breached, poolIndex\\)\\n\\s+array\\.set\\(pool\\.${side}_provisional_breached, poolIndex, true\\)`));
    assert.match(detectionBody, new RegExp(`if ${side}Breached or array\\.get\\(pool\\.${side}_provisional_breached, poolIndex\\)\\n\\s+pool_detect_depth_breaches\\([^\\n]+depthStep, ${side}Breached\\)`));
  }
  assert.match(functionBody('pool_store_session'), /array\.push\(pool\.high_provisional_breached, false\)/);
  assert.match(functionBody('pool_store_session'), /array\.push\(pool\.low_provisional_breached, false\)/);
  assert.match(functionBody('prune_pool'), /array\.shift\(pool\.high_provisional_breached\)/);
  assert.match(functionBody('prune_pool'), /array\.shift\(pool\.low_provisional_breached\)/);
});

test('Forecast LD remains visible while a delayed parent breach is still provisional', () => {
  assert.equal(drawDepth(false, false, true), true);
  assert.equal(drawDepth(true, false, true), true);
  assert.equal(drawDepth(true, false, false), false);
  assert.equal(drawDepth(true, true, false), true);
});

test('provisional boundary coordinates are stored once and follow pool storage/pruning', () => {
  for (const side of ['high', 'low']) {
    for (const [field, value] of [['times', 'eventTime'], ['indices', 'candleIndex']]) {
      const name = `${side}_provisional_${field}`;
      assert.ok(functionBody('pool_store_session').includes(`array.push(pool.${name}, na)`));
      assert.ok(functionBody('prune_pool').includes(`array.shift(pool.${name})`));
      assert.ok(source.includes(`array.clear(weekly_pool.${name})`));
      const firstTouchBranch = functionBody('pool_detect_breaches').match(new RegExp(`else if not array\\.get\\(pool\\.${side}_provisional_breached, poolIndex\\)\\n((?: {20}[^\\n]+\\n)+)`))?.[1];
      assert.ok(firstTouchBranch?.includes(`array.set(pool.${name}, poolIndex, ${value})`));
    }
    assert.ok(functionBody('draw_liquidity_pool').includes(`draw_pool_boundary(all_lines, ${side}_val, ${side}_time, ${side}_index, ${side}_end_time, ${side}_end_index, array.get(pool.${side}_provisional_times, idx), array.get(pool.${side}_provisional_indices, idx), ${side}LineColor, renderSpec.lineWidth)`));
  }
});

const renderBoundarySource = toJavaScript(functionBody('draw_pool_boundary'))
  .replace(/^(\s*)(bool|int) /gm, '$1let ')
  .replace(/^\s*if hasProvisionalTouch$/m, 'if (hasProvisionalTouch) {') + '\n}';
const renderBoundary = new Function('startTime', 'startIndex', 'endTime', 'endIndex', 'provisionalTime', 'provisionalIndex',
  `const drawn = [], levelPrice = 100, lineColor = 'pool-color', lineWidth = 2, LINE_WIDTH_1 = 1;
   const na = value => value == null;
   const array = { push: (values, value) => values.push(value) };
   const line = { style_solid: 'solid', style_dashed: 'dashed' };
   const create_pool_line = (startTime, startIndex, price, endTime, endIndex, color, width, style) =>
     ({ startTime, startIndex, endTime, endIndex, style, width });
   ${renderBoundarySource}
   return drawn;`);

test('untouched and directly confirmed boundaries retain a single solid segment', () => {
  for (const endTime of [2000, 3000]) {
    assert.deepEqual(renderBoundary(1000, 10, endTime, 30, null, null), [
      { startTime: 1000, startIndex: 10, endTime, endIndex: 30, style: 'solid', width: 2 },
    ]);
  }
});

test('provisional boundary splits at its first touch and the dashed segment stops at confirmation', () => {
  for (const [endTime, endIndex] of [[3000, 30], [4000, 40]]) {
    assert.deepEqual(renderBoundary(1000, 10, endTime, endIndex, 2000, 20), [
      { startTime: 1000, startIndex: 10, endTime: 2000, endIndex: 20, style: 'solid', width: 2 },
      { startTime: 2000, startIndex: 20, endTime, endIndex, style: 'dashed', width: 1 },
    ]);
  }
});

test('provisional boundary preserves distinct Range bars sharing a timestamp', () => {
  assert.deepEqual(renderBoundary(1000, 10, 2000, 30, 2000, 20), [
    { startTime: 1000, startIndex: 10, endTime: 2000, endIndex: 20, style: 'solid', width: 2 },
    { startTime: 2000, startIndex: 20, endTime: 2000, endIndex: 30, style: 'dashed', width: 1 },
  ]);
  assert.match(functionBody('create_pool_line'), /chart\.is_range \? line\.new\(range_start_index/);
});

// Execute the depth helper's source with Pine array/na shims; this is not a Pine compiler.
const depthDetectionStatements = [];
const depthDetectionBlocks = [];
for (const rawLine of functionBody('pool_detect_depth_breaches').split('\n')) {
  const statement = rawLine.trim();
  if (!statement) continue;
  const indent = rawLine.length - rawLine.trimStart().length;
  while (depthDetectionBlocks.length && indent <= depthDetectionBlocks.at(-1)) {
    depthDetectionStatements.push('}');
    depthDetectionBlocks.pop();
  }
  const loop = statement.match(/^for (\w+) = (.+) to (.+)$/);
  if (loop) {
    depthDetectionStatements.push(`for (let ${loop[1]} = ${loop[2]}; ${loop[1]} <= ${loop[3]}; ${loop[1]}++) {`);
    depthDetectionBlocks.push(indent);
  } else if (statement.startsWith('if ')) {
    depthDetectionStatements.push(`if (${toJavaScript(statement.slice(3))}) {`);
    depthDetectionBlocks.push(indent);
  } else {
    assert.match(statement, /^(float |bool |array\.set\()/);
    depthDetectionStatements.push(toJavaScript(statement.replace(/^(float|bool) /, 'let ')) + ';');
  }
}
depthDetectionStatements.push(...depthDetectionBlocks.map(() => '}'));
const detectDepth = new Function('depthState', 'basePrice', 'isHigh', 'barExtreme', 'eventTime', 'candleIndex', 'depthStep', 'parentBreached',
  `const NUM_LIQUIDITY_DEPTH_LEVELS = 3;
   const array = { get: (values, index) => values[index], set: (values, index, value) => { values[index] = value; } };
   const na = value => value == null;
   const liquidity_depth_price = (basePrice, isHigh, levelIndex, depthStep) => {
     ${functionBody('liquidity_depth_price').replace(/^float /, 'let ').replace(/\n\s+(isHigh \?)/, ';\nreturn $1')}
   };
   ${depthDetectionStatements.join('\n')}`);
const newDepthState = () => ({ breached: [false, false, false], breach_times: [null, null, null], breach_indices: [null, null, null] });

for (const isHigh of [false, true]) {
  const side = isHigh ? 'high' : 'low';
  const extreme = distance => 100 + (isHigh ? distance : -distance);

  test(`${side}: acceptance restores each earlier touch endpoint without consuming untouched L3`, () => {
    const state = newDepthState();
    detectDepth(state, 100, isHigh, extreme(10), 1000, 11, 10, false);
    detectDepth(state, 100, isHigh, extreme(20), 2000, 12, 10, false);
    assert.deepEqual(state.breached, [false, false, false]);
    assert.deepEqual(state.breach_times, [1000, 2000, null]);
    detectDepth(state, 100, isHigh, extreme(0), 3000, 13, 10, true);
    assert.deepEqual(state.breached, [true, true, false]);
    assert.deepEqual(state.breach_times, [1000, 2000, null]);
    assert.deepEqual(state.breach_indices, [11, 12, null]);
    detectDepth(state, 100, isHigh, extreme(30), 4000, 14, 10, true);
    assert.deepEqual(state.breached, [true, true, true]);
    assert.deepEqual(state.breach_times, [1000, 2000, 4000]);
    assert.deepEqual(state.breach_indices, [11, 12, 14]);
  });

  test(`${side}: confirmation candle can consume new depths while preserving an earlier Range bar at the same timestamp`, () => {
    const state = newDepthState();
    detectDepth(state, 100, isHigh, extreme(10), 1000, 21, 10, false);
    detectDepth(state, 100, isHigh, extreme(30), 1000, 22, 10, true);
    assert.deepEqual(state.breached, [true, true, true]);
    assert.deepEqual(state.breach_times, [1000, 1000, 1000]);
    assert.deepEqual(state.breach_indices, [21, 22, 22]);
  });

  test(`${side}: fully touched provisional ladder remains unmitigated until acceptance`, () => {
    const state = newDepthState();
    detectDepth(state, 100, isHigh, extreme(30), 1000, 31, 10, false);
    detectDepth(state, 100, isHigh, extreme(0), 2000, 32, 10, false);
    assert.deepEqual(state.breached, [false, false, false]);
    detectDepth(state, 100, isHigh, extreme(0), 3000, 33, 10, true);
    assert.deepEqual(state.breached, [true, true, true]);
    assert.deepEqual(state.breach_indices, [31, 31, 31]);
  });

  test(`${side}: immediate confirmation retains normal first-touch mitigation`, () => {
    const state = newDepthState();
    detectDepth(state, 100, isHigh, extreme(9), 1000, 41, 10, true);
    assert.deepEqual(state, newDepthState());
    detectDepth(state, 100, isHigh, extreme(20), 2000, 42, 10, true);
    assert.deepEqual(state.breached, [true, true, false]);
    assert.deepEqual(state.breach_times, [2000, 2000, null]);
  });
}

test('all seven pools share drawing, visibility and price calculation', () => {
  assert.equal((source.match(/PoolRenderSpec\.new\(/g) || []).length, 7);
  assert.match(source, /for renderSpec in poolRenderSpecs\n        draw_liquidity_pool\(/);
  for (const side of ['high', 'low']) {
    assert.ok(source.includes(`should_draw_liquidity_depth(renderSpec.depthEnabled, ${side}_breached, forecastLiquidityDepth)`));
  }
  assert.match(functionBody('draw_liquidity_pool'), /renderSpec\.depthActive and should_draw_liquidity_depth/);
  for (const name of ['draw_pool_depths', 'pool_detect_depth_breaches']) {
    assert.match(functionBody(name), /liquidity_depth_price\(/);
  }
});

test('Unmitigated Only preserves faded breached context only for a partly active ladder', () => {
  assert.doesNotMatch(functionBody('draw_liquidity_pool'), /showUnmitigatedOnly and high_breached and low_breached/);
  const body = functionBody('draw_pool_depths');
  assert.match(body, /bool hasUnmitigatedLevel = depth_has_unmitigated_level\(depthState\)/);
  assert.match(body, /bool mitigatedContext = showUnmitigatedOnly and hasUnmitigatedLevel and levelBreached/);
  assert.match(body, /color\.new\(levelColor, 85\)/);
  assert.match(body, /buffer_liq_depth_labels\([^\n]+mitigatedContext\)/);
  assert.match(body, /create_liq_depth_connector\([^\n]+connectorTransparency\)/);
  assert.doesNotMatch(source, /mitigatedContextTransparency|Mitigated Context Transparency/);
  const poolBody = functionBody('draw_liquidity_pool');
  for (const side of ['high', 'low']) {
    const title = `${side[0].toUpperCase()}${side.slice(1)}`;
    assert.match(poolBody, new RegExp(`bool ${side}MitigatedContext = showUnmitigatedOnly and ${side}_breached and ${side}DepthVisible and depth_has_unmitigated_level\\(${side}DepthState\\)`));
    assert.match(poolBody, new RegExp(`color ${side}LineColor = ${side}MitigatedContext \\? color\\.new\\(renderSpec\\.lineColor, 85\\)`));
    assert.match(poolBody, new RegExp(`buffer_pool_label\\([^\\n]+${side}MitigatedContext\\)`));
    assert.match(poolBody, new RegExp(`bool show${title}Pool = not showUnmitigatedOnly or not ${side}_breached or ${side}MitigatedContext`));
  }
  assert.match(functionBody('flush_label_events'), /component_mitigated_context/);
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

test('Today additions default to Asia Open + Rafael and do not change dedicated session preferences', () => {
  assert.match(source, /todayAdditionalPools = input.string\(FILTER_ASIA_OPEN_RAFAEL, "Show in Today", [^\n]*options=\["None", FILTER_KEY_OPENS, FILTER_ASIA_OPEN_RAFAEL, FILTER_ALL\]/);
  assert.doesNotMatch(source, /showKeyOpensInToday|showAsiaOpenRafaelInToday/);
  for (const enabled of [false, true]) {
    for (const name of ['AsiaOpen', 'Rafael']) {
      assert.equal(evaluate(assignment(`show${name}Filtered`), {
        ...modes, pulseModeFilter: 'Asia Open + Rafael', asiaOpenRafaelVisible: true, [`show${name}`]: enabled,
      }), enabled);
    }
  }
});

for (const name of ['AsiaOpen', 'Rafael']) {
  test(`${name}: Today forces LD on while dedicated mode respects its toggle`, () => {
    const nativeFlag = `enable${name}LiquidityDepth`;
    const effectiveFlag = `effectiveEnable${name}LiquidityDepth`;
    for (const enabled of [false, true]) {
      assert.equal(evaluate(assignment(effectiveFlag), {
        isTodayFilter: true,
        [nativeFlag]: enabled,
      }), true);
      assert.equal(evaluate(assignment(effectiveFlag), {
        isTodayFilter: false,
        [nativeFlag]: enabled,
      }), enabled);
    }
    const pool = name === 'AsiaOpen' ? 'asia_open' : 'rafael';
    const spec = source.split('\n').find(line => line.includes(`PoolRenderSpec.new(${pool}_pool,`));
    assert.ok(spec?.includes(`${effectiveFlag}, ${name[0].toLowerCase()}${name.slice(1)}DepthActive`));
  });
}

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
