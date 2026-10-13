import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runElderwandCheck, infrastructure, testFiles } from './check-elderwand.mjs';

test('staged gate verifies all test infrastructure and runs tests against the index', () => {
  const inspected = [];
  const result = runElderwandCheck({ staged: true, read: path => path, readStaged: path => { inspected.push(path); return path; }, run: (command, args, options) => {
    assert.equal(command, process.execPath); assert.deepEqual(args, ['--test', ...testFiles]);
    assert.equal(options.env.ELDERWAND_TEST_STAGED, '1'); return { status: 0 };
  } });
  assert.equal(result, 0); assert.deepEqual(inspected, infrastructure);
});

test('staged gate blocks missing or unstaged test infrastructure before executing it', () => {
  const run = () => assert.fail('must not execute mismatched tests');
  assert.throws(() => runElderwandCheck({ staged: true, readStaged: () => { throw new Error('missing'); }, run }), /requires the staged test file/);
  assert.throws(() => runElderwandCheck({ staged: true, read: () => 'unstaged', readStaged: () => 'staged', run }), /unstaged changes/);
});

test('local gate reads working source and propagates test failure, interruption and launch errors', () => {
  assert.equal(runElderwandCheck({ run: (command, args, options) => { assert.equal(options.env.ELDERWAND_TEST_STAGED, '0'); return { status: 1 }; } }), 1);
  assert.equal(runElderwandCheck({ run: () => ({ status: null, signal: 'SIGTERM' }) }), 1);
  assert.throws(() => runElderwandCheck({ run: () => ({ error: new Error('node missing') }) }), /node missing/);
});

test('staged source loader reads the index blob instead of the working Pine file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'elderwand-index-reader-'));
  const fixture = '// exact staged fixture, different from working source';
  const adapter = new URL('./lib/elderwand-harness.mjs', import.meta.url).href;
  writeFileSync(join(dir, 'git'), '#!/bin/sh\n[ "$1" = "show" ] || exit 9\n[ "$2" = ":indicators/19-elderwand/code/elderwand.pine" ] || exit 8\nprintf "%s" "$ELDERWAND_FIXTURE_SOURCE"\n', { mode: 0o755 });
  try {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import { source } from ${JSON.stringify(adapter)}; process.stdout.write(source);`], {
      encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, ELDERWAND_TEST_STAGED: '1', ELDERWAND_FIXTURE_SOURCE: fixture },
    });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, fixture);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Fake Git/Node executables exercise hook routing without staging or creating a repository.
function hookFixture(changed, status = 0) {
  const dir = mkdtempSync(join(tmpdir(), 'elderwand-hook-'));
  const hook = readFileSync(new URL('../.husky/pre-commit', import.meta.url), 'utf8');
  writeFileSync(join(dir, 'pre-commit'), hook);
  writeFileSync(join(dir, 'git'), '#!/bin/sh\ncase "$1" in\n  diff) printf "%s\\n" "$ELDERWAND_FIXTURE_CHANGED" ;;\n  show) printf "%s\\n" \'indicator("elderwand •")\' ;;\n  *) exit 9 ;;\nesac\n', { mode: 0o755 });
  writeFileSync(join(dir, 'node'), '#!/bin/sh\nprintf "%s\\n" "$*" > "$ELDERWAND_FIXTURE_LOG"\nexit "$ELDERWAND_FIXTURE_STATUS"\n', { mode: 0o755 });
  try {
    const log = join(dir, 'called');
    const result = spawnSync('/bin/sh', ['-e', join(dir, 'pre-commit')], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, ELDERWAND_FIXTURE_CHANGED: changed, ELDERWAND_FIXTURE_LOG: log, ELDERWAND_FIXTURE_STATUS: String(status) } });
    let called = ''; try { called = readFileSync(log, 'utf8').trim(); } catch {}
    return { result, called };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('pre-commit runs Elderwand tests for source and test-only changes and blocks failed tests', () => {
  for (const path of ['indicators/19-elderwand/code/elderwand.pine', ...infrastructure, '.husky/pre-commit']) {
    const { result, called } = hookFixture(path);
    assert.equal(result.status, 0, result.stderr); assert.equal(called, 'scripts/check-elderwand.mjs --staged');
  }
  assert.equal(hookFixture('indicators/19-elderwand/code/elderwand.pine', 1).result.status, 1);
});

test('pre-commit leaves unrelated changes outside the Elderwand gate', () => {
  const { result, called } = hookFixture('README.md');
  assert.equal(result.status, 0, result.stderr); assert.equal(called, '');
});
