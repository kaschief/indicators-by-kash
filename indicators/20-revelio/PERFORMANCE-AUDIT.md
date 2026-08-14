# Revelio Performance Audit

## Scope

Baseline: commit `72e5ba2` (`feat(revelio): add manual composite profiles`).

Goal: recover first-load performance without changing session boundaries, profile calculations, Value Gap results, Manual Composite behavior, Auto Swept ranking, Touch Marker timing, or visible output except for the approved rule that Auto Swept output cannot outlive its displayed source profile.

## Confirmed findings

### Touch Marker replay dominated the regression

With Touch Markers enabled, Revelio reconstructed lower-timeframe contact ranges and repeatedly searched retained profile levels across visible and Include All Anchors sources. Turning Touch Markers Off restored baseline-like load time, isolating this path as the dominant runtime cost.

### Disabled Composite work was not fully inert

Composite Off still created source-specific disabled ranges and entered recovery/developing orchestration that could be avoided without changing state or output.

### Quarterly work ran when its result was unnecessary

The Quarterly request and remote transport performed avoidable work when Quarterly profiles, Composite, Focus, Touch Markers, and related consumers did not require them.

### Maturity checks rebuilt stable structures

Weekly, Monthly, and Quarterly automatic maturity processing continued structural work after the current period had permanently reached its standard developing threshold.

### Filled Value Gaps remained in the active scan

Filled historical gaps stayed in the per-bar update loop even though only open gaps can change.

### Auto Swept used duplicate presentation paths

The compact Auto Swept archive separately reserved and rendered lines, replayed Touch Markers, and registered presentations already available from retained source profiles. That allowed an Auto line to appear without its source profile under Show Last aging or drawing pressure.

## Applied remediation

- Composite Off reuses one disabled range and skips source-specific recovery and developing-composite work.
- Pine v6 dynamic request gating skips the complete Quarterly request when no active feature requires Quarterly data.
- Quarterly remote transport no longer carries unused composite warning/status fields.
- Weekly, Monthly, and Quarterly maturity work runs only on relevant period/session events and stops structural rebuilds after standard maturity.
- Value Gaps retain complete history while updating only a synchronized open-record collection.
- Touch Marker contact bounds are accumulated in the construction pass rather than rescanned.
- Historical same-day Touch state is checked before lower-timeframe contact search.
- Hidden-anchor Touch calculation demand is resolved independently per anchor.
- Default Touch contact replay starts inside the existing maximum retention horizon. Indeterminate Range-chart fallback and persistent daily-retouch state preserve the full replay path.
- Auto Swept selection remains bounded in Core, but visible continuations are emitted only through the retained source profile's ordinary level allocation, including profiles explicitly surfaced by Focus.
- Separate Auto Swept archive drawing, line reservation, Touch Marker replay, presentation, and retained-source registration passes were removed.

## Preserved contracts

- Quick Filter remains the authority for profile drawing and Manual Composite consolidation.
- Include All Anchors may still produce Touch Markers from Quick-Filter-hidden anchors without drawing those profiles.
- Include Older Levels still inspects swept levels whose continuations are hidden within retained source profiles.
- Focus may surface an older retained daily profile and its associated Auto Swept continuation.
- Auto Swept ranking, protected/manual/grace visibility, audit suffixes, sweep margins, and bounded selection history remain intact.
- Manual Composite recovery restores ordinary profiles and Value Gap lifecycle state.

## Validation status

Completed locally:

- Library registry validation.
- Pine indicator title validation.
- Static host/library API and source-path review.
- Principal review with no remaining confirmed P0-P3 findings.

Required in TradingView:

1. Publish Gaps `/11`, then Profile Orchestration `/2`.
2. Compile Revelio against Core `/10`, Gaps `/11`, Interactions `/16`, and Profile Orchestration `/2`.
3. Compare first-load and last-bar Profiler results with `72e5ba2` using identical chart history and settings.
4. Test Touch Markers Off/On, Include All Anchors, Include Older Levels, and Limit Daily Retouches.
5. Test time and Range charts, including live updates and Bar Replay.
6. Test Composite Off and all five Composite sources, including future Through and Show Last aging.
7. Test Value Gap creation, partial erosion, full fill, and recovery.
8. Test Auto Swept with low/high Show Last, Focus, Quick Filter changes, and near-500-line drawing pressure.

## Verdict

The implementation removes confirmed redundant work and tightly scopes the dominant Touch Marker replay path. Static analysis cannot quantify TradingView execution time, so the indicator should not be described as maximally optimized until the Profiler matrix confirms the improvement.
