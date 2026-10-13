# Tests

Run everything from the repo root:

```sh
node --test "**/*.test.mjs"
```

One indicator: `node --test "indicators/18-parallax/tests/*.test.mjs"`.

## Layout

```
indicators/<nn>-<name>/
  code/                     the Pine source (published to TradingView)
  tests/
    behavior.test.mjs       runs the real Pine source bar by bar on synthetic NQ data
    <topic>.test.mjs        source-level contract checks, where an indicator has them
tests/
  runtime/                  the shared Pine engine and its self-test
  tooling/                  tests for the checkers in scripts/ and the Elder Wand commit hook
```

- **behavior.test.mjs** — one per indicator. Time charts, Range charts, a freshly loaded chart and Bar Replay, checking what the chart shows. Test names are in trader terms.
- **<topic>.test.mjs** — constants, call signatures, definition order and translated calculations read straight from the source. Elder Wand's `harness.mjs` supports its function tests.
- **tests/runtime/** — the local Pine engine. Its [README](runtime/README.md) lists the TradingView behaviors it has to assume.
- **scripts/** holds only the tools you run directly: identifier, title and library-registry checks, plus the Elder Wand commit gate.

## Rules

- Tests pin approved behavior. When a change has to alter pinned behavior, update the test on purpose and say so in the handoff. Never weaken a test to make it pass.
- A new indicator gets `tests/behavior.test.mjs` in its folder. A new feature gets new scenarios there, named after what the trader sees.
- Behavior tests prove logic, not TradingView compilation or visuals. Those still need a chart check.
