import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../indicators/09-pulse/code/pulse.pine', import.meta.url), 'utf8');
const body = name => {
  const match = source.match(new RegExp(`^${name}\\([^\\n]+\\) =>\\n([\\s\\S]*?)(?=^\\S)`, 'm'));
  assert.ok(match, name);
  return match[1];
};
const expression = code => code.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!')
  .replace(/array\.new<\w+>\(\)/g, '[]').replace(/\bmath\./g, 'Math.');

// Execute the source's cluster-building block with array shims, not the Pine runtime.
const statements = [];
const blocks = [];
for (const raw of body('flush_label_events').split('        array<int> component_roots')[0].trimEnd().split('\n')) {
  const code = raw.trim();
  if (!code) continue;
  const indent = raw.length - raw.trimStart().length;
  while (blocks.length && indent <= blocks.at(-1)) {
    statements.push('}');
    blocks.pop();
  }
  const loop = code.match(/^for (\w+) = (.+) to (.+)$/);
  if (loop) {
    statements.push(`for (let ${loop[1]} = ${loop[2]}; ${loop[1]} <= ${loop[3]}; ${loop[1]}++) {`);
    blocks.push(indent);
  } else if (code.startsWith('if ')) {
    statements.push(`if (${expression(code.slice(3))}) {`);
    blocks.push(indent);
  } else {
    assert.match(code, /^(array<\w+> |int |float |bool |PendingLabelEvent |array\.(push|set)\()/);
    statements.push(expression(code.replace(/^(array<\w+>|int|float|bool|PendingLabelEvent) /, 'let ')) + ';');
  }
}
while (blocks.length > 1) {
  statements.push('}');
  blocks.pop();
}
statements.push('return parents.map((_, index) => label_event_root(parents, index));', '}');
const cluster = new Function('pending', 'mergeOverlappingLabels', `
  const POOL_TYPE_ASIA_OPEN = 'asia open', POOL_TYPE_RAFAEL = 'rafael';
  const na = null;
  const array = {
    size: values => values.length,
    get: (values, index) => values[index],
    push: (values, value) => values.push(value),
    set: (values, index, value) => { values[index] = value; }
  };
  const label_requires_price_anchor = eventState => ${expression(body('label_requires_price_anchor').trim())};
  const label_cluster_prices_compatible = (hasPriceAnchor, minimumPrice, maximumPrice) => ${expression(body('label_cluster_prices_compatible').trim())};
  const label_event_root = (parents, index) => {
    while (parents[index] !== index) index = parents[index];
    return index;
  };
  const label_events_overlap = () => true;
  ${statements.join('\n')}
`);
const boundary = (identity, price) => ({ identity, price, core: true, inline_label: false, context_transparency: 0 });
const depth = price => ({ identity: 'L1', price, core: false, inline_label: true, context_transparency: 0 });

test('Asia Open and Rafael keep separate labels when a wide tolerance includes both prices', () => {
  for (const prices of [[7800, 7802], [7800, 7798]]) {
    assert.deepEqual(cluster([boundary('asia open', prices[0]), boundary('rafael', prices[1])], true), [0, 1]);
  }
});

test('Asia Open and Rafael can share a label at the same price', () => {
  assert.deepEqual(cluster([boundary('asia open', 7800), boundary('rafael', 7800)], true), [0, 0]);
});

test('a third pool cannot bridge distinct session prices through transitive merging', () => {
  for (const events of [
    [boundary('asia open', 7800), boundary('daily', 7801), boundary('rafael', 7802)],
    [boundary('daily', 7801), boundary('weekly', 7802), boundary('asia open', 7800)],
    [boundary('daily', 7800), boundary('asia open', 7800), boundary('rafael', 7802)],
  ]) {
    const roots = cluster(events, true);
    for (let index = 0; index < events.length; index++) {
      if (!['asia open', 'rafael'].includes(events[index].identity)) continue;
      const members = events.filter((_, other) => roots[other] === roots[index]);
      assert.ok(members.every(member => member.price === events[index].price));
    }
  }
});

test('depth labels cannot move a session name to another price', () => {
  assert.deepEqual(cluster([depth(7801), boundary('rafael', 7800)], true), [0, 1]);
  assert.deepEqual(cluster([depth(7800), boundary('rafael', 7800)], true), [0, 0]);
});

test('other pools retain tolerance-based merging and disabling merging keeps labels separate', () => {
  assert.deepEqual(cluster([boundary('daily', 7800), boundary('weekly', 7801)], true), [0, 0]);
  assert.deepEqual(cluster([boundary('asia open', 7800), boundary('rafael', 7800)], false), [0, 1]);
});

test('completed context labels stay separate from active and partial context at fixed 93%', () => {
  const completed = { ...boundary('daily', 7800), context_transparency: 93 };
  for (const transparency of [0, 85]) {
    const active = { ...boundary('weekly', 7800), context_transparency: transparency };
    assert.deepEqual(cluster([completed, active], true), [0, 1]);
  }
  assert.deepEqual(cluster([completed, { ...completed, identity: 'weekly' }], true), [0, 0]);
});

test('active labels have priority over partial and completed context', () => {
  const precedes = new Function('candidate', 'candidate_order', 'current', 'current_order',
    `return ${expression(body('label_event_precedes').trim())};`);
  for (const [stronger, weaker] of [[0, 85], [0, 93], [85, 93]]) {
    const foreground = { ...boundary('daily', 7800), context_transparency: stronger };
    const background = { ...boundary('monthly', 7800), context_transparency: weaker };
    assert.equal(precedes(foreground, 1, background, 0), true);
    assert.equal(precedes(background, 0, foreground, 1), false);
  }
});
