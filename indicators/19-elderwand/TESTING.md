# Elderwand regression checks

Run from the repository root with Node 22 or newer:

```sh
node scripts/check-elderwand.mjs
```

The repository pre-commit hook runs this suite automatically when Elderwand source,
its tests, its adapter, its runner, or the hook changes. It tests the **staged Pine
source**, and blocks if test infrastructure differs between the index and the
working files. Include the intended test changes when staging. No dependencies,
build step, or TradingView login are needed for these local checks.

## Coverage

The tests extract functions and execution blocks from the current Pine file.
Assertions use independent expected results; the temporary model from the merge
investigation is no longer needed. Every source helper must be exercised, so a
new helper without a scenario fails the suite. This is function-execution coverage,
not a claim of complete branch coverage or Pine runtime equivalence.

| Feature | Local regression coverage |
| --- | --- |
| Settings and styles | Defaults, all quick filters, Manual overrides, active controls, every anchor's colors/sizes, width dropdowns, band Off and widths 1–5 |
| Prices | Off/Active/Custom, per-anchor selection, merged price authority independent of styling |
| Label merging | Original Quarterly/Monthly/Daily regression, 27,300 pair/triple width/order configurations, full rendering, priority/ties, tolerance/presets, disabled merging, cleanup |
| Identical anchors | Weekly/Daily and Quarterly/Monthly/Daily collapse, missing-band inheritance, price inheritance, disabled/empty/diverging states |
| Fills and bands | All band masks and fill ranges, VWAP-only, one fill owner, widest shared fill, RGB/transparency, positive/negative offsets |
| Drawings and history | Current-object replacement, fill-before-line order, last-bar gate, Show Last 1/2/10, rollover/cleanup, long-history sampling and endpoints |
| Calendar VWAPs | Independent fixed call sites, reset signals, initial bar, one-sigma extraction, timeframe visibility boundaries |
| Daily/Weekly holiday resets | Reopen edges, Sunday-only Weekly reset, opt-out to TradingView timeframe changes |
| NY | Session edges, Session only / 18:00 extension, winter/summer NY timestamps, accumulation gate |
| NY Early | Both sides/windows, first equal extreme, restart at new extreme, weighted mean/deviation, locked prior sessions, no-trade dates, retention, live binding, complete High window pipeline |
| Rolling | Independent weighted mean/deviation oracle, whole-session eviction, synchronized buffers, 24/7 weekends and no-trade gaps, confirmed-bar gate, missing/zero volume |
| Show Only | All four windows, midnight/boundaries, 1-hour and Range gates, Most Recent Only, disabled state |
| Reference table | All visibility/band masks, allocation versus rendered rows, duplicate visibility, NY Early side, Show Only row, VWAP-only, disabled table |
| Guards/workflow | No-volume error, function definition order, staged-source gate, test-only changes, failure propagation |

Eight in-memory mutation cases deliberately restore width-first selection or break
rendered size, fill ownership, history retention, NY Early equal-extreme handling,
rolling eviction, a quick filter, and VWAP-only. Each must fail its acceptance
assertion. These mutations never edit the Pine file.

## TradingView checks still required

The adapter supplies lightweight arrays, dates and drawing objects. `ta.vwap()` is
a spy for call/reset wiring, not a replacement implementation. It does not emulate
TradingView compilation, feed/session classification, realtime rollback, Bar Replay,
actual visual layering, chart timestamp behavior or the 100-polyline object cap.
Passing locally therefore cannot guarantee the absence of every regression.

Before releasing changes, compile in TradingView and test the affected rows:

| Chart/scenario | Check |
| --- | --- |
| Original overlap chart; NQ/ES 5m and 180R/360R | Quarterly/Monthly/Daily labels use Quarterly styling; Weekly/Daily at week start uses Weekly; vary widths, bands, prices, merge preset and VWAP-only |
| NQ/ES 5m around Sunday 18:00, daily reopen, month/quarter/year change and CME holiday | Correct resets with holiday protection on/off; no unexpected jumps in other anchors |
| NQ/ES 1m or 5m, 06:00–09:30, 09:30–16:00 and extension to 18:00 | Both NY Early sides/windows and Anchor From 1/10; first extreme remains the origin; prior session continues; NY extension ends correctly |
| BTC 5m/daily versus NQ 5m/daily | Rolling counts printed sessions across weekends/gaps; test 2, 14 and 60 sessions and zero/missing-volume behavior where available |
| 5m, 60m, >60m and Range, around NY midnight | Show Only windows and Most Recent Only, with calculations/drawings unaffected |
| Show Last 1/10, many anchors/bands/fills, reference table on | History cleanup, active table rows and TradingView drawing-limit pressure |
| Realtime, Replay, reload and timeframe/settings changes | No stale labels, duplicated objects, shifting AVWAP origins or history differences |

The user confirmed the timeframe-first merge visually on 2026-10-13. The broader
chart matrix above has not been independently run as part of adding these tests.
