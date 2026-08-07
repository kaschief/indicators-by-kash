# Legilimens Data Consistency and Replay Canon

Status: active investigation  
Last updated: 2026-08-07

## Objective

NY Early, Extended NY Early, and IVB profiles should use the most granular practical source data while remaining trustworthy in normal charts and Bar Replay.

## Separate Problems

### 1. Time-chart inconsistency

Before experiment A, the automatic intrabar resolution depended on the host chart. A 1-minute chart used 1-second samples while a 5-minute chart used 1-minute samples. Delta direction and price-row allocation are calculated per sample, so aggregating finer samples cannot reproduce calculations performed from a coarser candle. Histogram shape, POC, tiers, and zones could therefore differ.

### 2. Range-chart inconsistency

Range candles are price-formed and do not share the boundaries of time candles. Time-based intrabars can be absent, incomplete, or mapped differently inside a Range candle. The current Range path also rejects some samples and intentionally has no chart-bar fallback, which can omit volume and split bounded sessions.

This is related to time-chart inconsistency because both are host-chart-dependent acquisition, but it is a separate mapping problem.

### 3. Replay compatibility

Bar Replay must work on TradingView-supported time charts. Range-chart Replay is outside the contract because TradingView does not support Replay on Range charts.

## Confirmed Calculation Constraint

Legilimens signs each source candle's volume from that candle's direction and distributes it across its high-low range. This calculation is non-associative. Results can only match across host charts when they consume the same source samples and apply the same session boundaries.

Extended NY Early's optional 09:30 break increases the impact of sampling differences: a small difference can include or exclude the entire 09:30-09:35 extension.

## Attempted Approach: Central Canonical Buffer

A separate `request.security()` context accumulated granular NY samples into arrays and returned one `CanonicalNyBuffer` to the host chart.

### What worked

- Normal 1-minute and 5-minute charts received the same granular source data.
- The resulting profiles were visually consistent and more detailed.

### Why it was abandoned

- The array buffer was returned only at the requested context's latest market-data edge.
- A Replay endpoint is not reliably exposed as that edge.
- Normal mode worked, but Replay loaded without receiving a buffer and drew nothing.
- Treating the Replay edge as realtime did not resolve the requested-context behavior.

Do not reintroduce this raw collection-return architecture without proving Replay delivery first.

## Principal Review Findings

1. One canonical intrabar resolution is required for comparable time-chart results.
2. Range bars currently lose data when their lower-timeframe request has no accepted sample.
3. The 09:30-break decision must be calculated from the same feed as the profile it extends.

## Required Acceptance Criteria

1. Normal mode loads without runtime errors.
2. Bar Replay loads, advances, rewinds, and restarts on 1-minute and 5-minute charts.
3. The same completed session produces the same POC, tiers, zones, and histogram on 1-minute and 5-minute charts when the same source resolution is available.
4. Developing sessions do not duplicate or lose samples during Replay updates.
5. Extended NY Early includes 09:30-09:35 only when that candle range breaks the pre-09:30 range.
6. Range charts never silently omit an entire chart bar because a lower-timeframe array is empty.
7. Any unavoidable Range-chart limitation is explicit; Range equality must not be claimed without visual evidence.
8. Ten historical sessions remain within TradingView request and drawing budgets.

## Next Experiments

### A. Fixed lower-timeframe arrays on supported time charts

Use one resolution for NY Early, Extended NY Early, and IVB through `request.security_lower_tf()`. Accumulate samples in the host context, which is Replay-compatible, instead of returning a growing collection from `request.security()`.

First target: prove identical completed-session results on 1-minute and 5-minute charts using the same recent-history resolution.

Current implementation under test: 1-minute through 15-minute time charts use 10-second samples. Ten-second and lower charts retain 1-second sampling. Range charts remain on 1-minute sampling until experiment A is validated.

### B. Safe Range fallback and accounting

Separately repair empty/rejected Range-bar handling so bounded sessions do not lose or split data. This improves Range reliability but does not by itself prove equality with time charts.

### C. Compact requested-context aggregation

Only if experiment A cannot meet the history requirement, investigate calculating profiles inside the requested context and returning compact scalar results rather than raw sample arrays. Replay delivery must be proven before integrating it.

## Test Order

1. NQ1!, 1-minute, normal mode.
2. NQ1!, 5-minute, normal mode; compare one completed NY Early, Extended NY Early, and IVB session.
3. NQ1!, 1-minute Replay on the same session.
4. NQ1!, 5-minute Replay on the same session.
5. Recent Range chart comparison, treated as a separate accuracy test.
6. Older Replay dates to verify automatic source-resolution fallback.

## Validation Rule

Static checks establish source integrity only. TradingView compile, normal loading, Replay behavior, and visual level comparisons are the authority.
