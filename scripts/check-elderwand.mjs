import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export const testFiles = ['scripts/check-elderwand.test.mjs', 'scripts/check-elderwand-workflow.test.mjs'];
export const infrastructure = ['scripts/check-elderwand.mjs', 'scripts/lib/elderwand-harness.mjs', '.husky/pre-commit', ...testFiles];

export function runElderwandCheck({
  staged = false,
  read = path => readFileSync(resolve(root, path), 'utf8'),
  readStaged = path => execFileSync('git', ['show', `:${path}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  run = (command, args, options) => spawnSync(command, args, options),
} = {}) {
  if (staged) {
    for (const path of infrastructure) {
      let snapshot;
      try { snapshot = readStaged(path); }
      catch { throw new Error(`Elderwand regression check requires the staged test file: ${path}`); }
      if (snapshot !== read(path)) throw new Error(`Elderwand test infrastructure has unstaged changes: ${path}. Stage the intended test changes before committing.`);
    }
  }
  const result = run(process.execPath, ['--test', ...testFiles], {
    cwd: root, stdio: 'inherit', env: { ...process.env, ELDERWAND_TEST_STAGED: staged ? '1' : '0' },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--staged')) throw new Error('Usage: node scripts/check-elderwand.mjs [--staged]');
    process.exitCode = runElderwandCheck({ staged: args.includes('--staged') });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
