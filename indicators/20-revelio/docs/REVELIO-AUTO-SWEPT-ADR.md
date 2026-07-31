# ADR-001 — Adaptive Auto Swept relevance

Date: 2026-07-31
Status: Accepted and closed — `/6` principal-reviewed, TradingView validated, and user-approved for the first production release

## Context

The current Auto Swept selector can show fewer continuations than the normal manual defaults, selects isolated levels independently per anchor, and may reveal a line only when price is already approaching it. Touch Markers correctly retain a broader detection universe, so they can mark an older level whose line was not visible beforehand. The first `/4` TradingView test also exposed two unacceptable properties: Auto recruited hidden source profiles outside the user's configured profile counts and added about seven seconds to loading.

Auction Market Theory does not give an old level a calendar expiry. A reference becomes less distinct when later auctions repeatedly accept value around it, while repeated control points, complementary level roles, and cross-timeframe overlap strengthen a price zone. ADR describes plausible reach; it does not establish importance.

## Decision

Auto Swept becomes a protected visibility floor plus a global relevance overlay:

1. Treat the configured recent RTH, Globex, Weekly, Monthly, and Quarterly profile counts as a hard source boundary. Auto cannot recruit a profile the user did not retain in that anchor's visible universe.
2. Preserve the current manual retention setting unconditionally inside that source universe. Its defaults remain three days for RTH and Globex and one native period for Weekly, Monthly, and Quarterly. Existing post-sweep grace through the next same-anchor finalization also remains protected.
3. Build one relevance plan across the enabled anchors at the Globex or UTC trading-day boundary.
4. Estimate reach from up to the latest 14 completed Globex/UTC ranges in the deep canonical archive. This ADR sample is separate from Auto source eligibility and does not make any older profile selectable or visible. When at least five samples exist, discard the largest and smallest range before averaging. No additional `request.*()` call is added.
5. Sort references by price and partition them into non-overlapping clusters whose maximum price span is `max(2 ticks, 0.1% of ADR)`. A source profile contributes at most one repetition vote, while distinct level roles remain separate evidence. An adaptive cluster requires support from at least two distinct source profiles; ranking is not permission to fill capacity with isolated levels.
6. Rank admitted clusters lexicographically:
   - highest contributing anchor: Quarterly, Monthly, Weekly, then RTH/Globex;
   - distinct anchors;
   - distinct completed source profiles;
   - distinct roles: POC, aPOC, VAH, VAL;
   - mean repeated later POC/aPOC overlap across the cluster's adaptive identities;
   - lower mean later value-area containment across those identities;
   - distance in ADR units;
   - source recency as the final tie-breaker.
7. Select clusters rather than unrelated per-anchor nearest levels. All qualifying swept identities inside an admitted cluster remain exact source levels so existing label merging can describe the confluence without inventing a synthetic average price. Selection identity includes both profile start and end times.
8. New clusters normally enter inside 1.25 ADR of the cycle open. Prior-cycle selections receive a 1.50 ADR exit envelope. One add-only, directionally bounded expansion may occur after price travels 1.00 ADR from the cycle open; it looks another 0.50 ADR beyond the traveled extreme.
9. Keep Touch Marker detection, identity, deduplication, retention, merged priority, color, and size behavior unchanged.
10. Reserve drawing capacity for the bounded selected set after the protected floor, including protection that activates after the cycle boundary and while Intraday Focus is active.

Later value-area containment is an acceptance proxy, not proof that a level has become irrelevant. Repeated control overlap can offset that demotion because it supplies specific evidence that the same price remains a control zone.

The `/6` performance pass changes lookups only: ordered recent-profile indices replace deep archive scans during selection, exact profile bitmasks replace repeated current-pick scans, and protected render masks are calculated once and reused. Ranking inputs, reference order, plan cadence, archive depth, ADR, Touch history, Focus behavior, and drawing order remain unchanged.

During validation, the temporary `Ⓐ` audit marks only lines supplied incrementally by Auto beyond the live manual/grace floor. The same audit exposes the plan's current trimmed Globex/UTC ADR in the indicator status line and Data Window. Neither diagnostic changes selection or drawing identity.

## Alternatives considered

| Approach | Benefit | Reason not selected |
|---|---|---|
| Fixed age | Stable and cheap | Recreates manual retention and cannot adapt to market structure |
| Larger nearest-N limits | Small code change | Preserves isolated-level bias and wastes capacity on overlapping evidence |
| Absolute distance | Simple | Not volatility-normalized |
| Source-profile-range distance | Locally normalized | Incomparable across anchors and volatility regimes |
| Touch-triggered reveal | Uses proven contacts | Inherently too late for anticipation |
| ADR-only filtering | Volatility-aware | Reach is not market importance |
| Weighted score | Flexible | Opaque weights create false precision and unstable tuning |
| Per-bar rescoring/eviction | Continuously adaptive | Causes flicker and repeats the expensive archive work |
| Machine-learned ranking | Potentially expressive | No calibrated outcome dataset, poor explainability, and unsuitable Pine complexity |

The selected hybrid is deterministic, auditable, volatility-aware, and grounded in observable auction structure without claiming statistical certainty that the available profile records cannot provide.

## Consequences

- Auto On must never show fewer retained swept lines than Auto Off with the same manual settings.
- Every new Auto selection must come from the configured anchor profile count. An exact current-cycle pick may remain until the next cycle if an intracycle profile finalization rolls its source just outside that window.
- Isolated one-profile levels remain excluded from the adaptive overlay.
- Same-anchor repetition and cross-anchor confluence can retain levels older than the protected floor.
- The deep 50-profile canonical archive remains available for the 14-profile ADR sample and optional older Touch Markers, but it cannot supply Auto candidates, protected-floor lines, or drawing reservations.
- Quiet regimes use a narrower relevance horizon; volatile regimes expand naturally.
- A single extreme or compressed session cannot dominate ADR because both tails are trimmed.
- Daily planning replaces continuous ranking. Archive sweep work runs only when the confirmed close extends the archive's observed close range, plus one optional add-only expansion.
- Auto extras remain bounded by global cluster and constituent limits. Protected carry does not consume adaptive quotas.
- The maximum 32 adaptive identities reserve at most 64 line IDs; under drawing pressure, ordinary older profile lines yield first.
- Same-start short-session replacements can coexist only while the superseded snapshot is selected; superseded records do not contribute to ADR, confluence, or the next cycle.
- A superseded snapshot keeps its exact Touch presentation while selected, then becomes ineligible for new Touch events as soon as that exact selection expires.

## Invariants

- Auto Off behavior is unchanged.
- No future profile contributes evidence.
- Grace and the protected floor ignore ADR and scoring.
- A new selection must be eligible at selection time, and its exact identity remains visible through the complete cycle to prevent intracycle disappearance and reappearance.
- A selected line cannot move when its source profile is folded or replaced.
- Touch eligibility cannot outlive the visibility of a superseded exact snapshot.
- Expansion adds but never removes.
- Clustering does not alter source prices or Touch Marker histories.
- Historical replay produces the same plan from the same confirmed data.
- Static checks cannot replace TradingView compilation, replay, realtime, Range-chart, and visual validation.

## Validation gates

1. Auto Off parity against the approved library-backed development build.
2. Auto On contains every line visible under native manual retention.
3. Every adaptive identity comes from the configured recent profile counts.
4. Isolated single-profile clusters do not enter the adaptive overlay.
5. ADR still uses up to 14 canonical Globex/UTC profiles when the Globex display count is below 14.
6. `Include Older Levels` still detects eligible older Touch Marker sources beyond the Auto source window.
7. An exact selected identity survives an intracycle profile rollover, then is re-evaluated at the next cycle boundary.
8. Intraday Focus may explicitly surface an older profile without allowing it to seed the global Auto plan.
9. Known surprise-marker cases show the relevant line before contact.
10. Same-anchor multi-profile and RTH/Globex-to-Weekly/Monthly/Quarterly confluence.
11. Quiet, normal, and expansion days.
12. Futures reopen, weekends, holidays, 24/7 UTC cycles, and short-session merges.
13. 1m, 5m, 15m, 180R, 360R, Bar Replay, reload, and forming-candle realtime behavior.
14. Three comparable cold loads; target Auto overhead is no more than two seconds and no execution-limit warning.
15. With `Ⓐ` enabled, only incremental Auto lines carry the suffix and the displayed ADR matches the current plan value.
