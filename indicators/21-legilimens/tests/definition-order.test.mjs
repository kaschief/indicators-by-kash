import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Pine resolves user-defined functions top-down (CE10271), which the source adapters do not model.
const files = [
  '../code/legilimens.pine',
  '../code/libraries/legilimens-profile-library.pine',
  '../code/libraries/legilimens-profile-orchestration-library.pine',
  '../code/libraries/legilimens-presentation-library.pine',
];

function callsBeforeDefinition(source) {
  const lines = source.split('\n').map(line => line.replace(/\/\/.*$/, '').replace(/"(?:[^"\\]|\\.)*"/g, '""'));
  const definitions = new Map();
  lines.forEach((line, index) => {
    const match = line.match(/^(?:export )?(\w+)\(.*\) =>/);
    if (match && !definitions.has(match[1])) definitions.set(match[1], index);
  });
  const violations = [];
  for (const [name, definitionLine] of definitions) {
    const call = new RegExp(`(?<![\\w.])${name}\\(`);
    for (let index = 0; index < definitionLine; index++) {
      if (call.test(lines[index])) violations.push(`${name} used on line ${index + 1}, defined on line ${definitionLine + 1}`);
    }
  }
  return violations;
}

for (const file of files) {
  test(`${file.split('/').at(-1)} defines every function before its first use`, () => {
    assert.deepEqual(callsBeforeDefinition(readFileSync(new URL(file, import.meta.url), 'utf8')), []);
  });
}

test('definition-order check detects a helper called above its definition', () => {
  assert.deepEqual(callsBeforeDefinition('caller() =>\n    helper(1)\n\nhelper(int value) =>\n    value\n'), ['helper used on line 2, defined on line 4']);
});
