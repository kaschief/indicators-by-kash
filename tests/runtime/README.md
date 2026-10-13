# Pine runtime

The engine behind each indicator's `tests/behavior.test.mjs`: it runs the real indicator source bar by bar on synthetic
CME data. `runtime.test.mjs` pins the Pine semantics the behavior suites rely on.

| File | Role |
| --- | --- |
| `lexer.mjs`, `parser.mjs` | Pine v6 source → syntax tree (all active indicators and libraries parse) |
| `compiler.mjs` | Tree → closures with Pine's execution model: per-bar passes, `var`, per-call-site history, lazy `and`/`or`, block-valued `if`/`switch`, UDTs, enums, methods, libraries |
| `builtins.mjs`, `ta.mjs`, `drawings.mjs` | Built-ins; drawings keep TradingView's per-kind count limits |
| `market.mjs` | Synthetic one-minute NQ candles on the Globex schedule; time, Range and higher-timeframe bars |
| `run.mjs` | Runs an indicator in `live`, `loaded` or `replay` mode and exposes drawings, plots and top-level variables |
| `scenario.mjs` | Shared scenario helpers (cached markets, drawing-edge readers) |

## Modelling assumptions

These are TradingView behaviors the runtime has to assume. A test that depends on one is only as
reliable as the assumption, so chart checks are still needed for them.

- **Range bars** are built from one-minute candles walked open → nearer extreme → farther extreme → close.
  A closed bar's `time_close` is the next bar's open; the forming bar has none. `timeframe.period` on a
  Range chart is `"1"`. Future bar times (`time(bars_back=-n)`) on Range charts are `na`.
- **request.security** evaluates the expression once per higher-timeframe bar on that bar's final data.
  On time charts a request finer than the chart bar returns the bar's last intrabar value.
  Otherwise `lookahead_on` returns the containing period's value; `lookahead_off` returns the previous period
  until the chart bar that closes it. Intraday periods align to the 18:00 New York session start.
  Values that the requested expression reads from top-level variables come from the chart bar that
  first needs that period.
- **Realtime** is one pass per bar: the last candle is evaluated once. There are no intrabar ticks or
  rollback, `varip` behaves like `var`, and `barstate.isnew` is always true, so tick-level bugs (alerts
  firing every tick, `varip` drift) are not caught.
- **Modes:** `live` makes the last candle realtime with `timenow` at the data cut-off. `loaded` is a
  freshly opened chart before its first tick: the last candle is historical (`isrealtime` false,
  `isconfirmed` true). `replay` makes the last candle realtime while `timenow` stays at the real clock,
  days later. The `loaded` and `replay` clock behavior should be confirmed on a chart.
- **Range charts and requests:** without lookahead, a Range bar sees the last period completed by its
  close; with lookahead, the period holding its open.
- **Comparisons with na**, including `!=`, return false (unverified; `ta.change(time) != 0` on the first
  bar depends on it).
- **Function history** advances once per bar for each call site, like `ta.*`.
- **Conditions** must be bool and drawing limits are capped at 500 (100 for polylines).
- **Variables declared `int`** truncate fractional values (TradingView accepts `int half = 7 / 2`).
- **Libraries** resolve to the local source in the repo, whatever version the import names, so tests
  exercise unpublished library changes before TradingView can.
- **Currency rates** other than same-currency (1.0) must be supplied by the scenario.
- **Seconds timeframes** are cut from each one-minute candle along its price path, so intrabar detail
  below one minute is synthetic. Range bars only receive intrabars that start inside them.
- **Holidays** are not modelled; every weekday is a full Globex session.
