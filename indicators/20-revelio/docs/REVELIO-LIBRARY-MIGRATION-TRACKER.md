# Revelio Library Migration Tracker

Updated: 2026-08-01
Migration status: `Complete` — library migration, Auto Swept, input cleanup, and production promotion approved
Publishing status: The current canonical Revelio source and library chain are deployed and user-approved; exact versions live in the registry below

Canonical current library versions, publication instructions, source fingerprints, and copy-ready notes: [`TRADINGVIEW-LIBRARY-VERSION-REGISTRY.md`](../../../TRADINGVIEW-LIBRARY-VERSION-REGISTRY.md). Version references below are historical; current status lives only in the registry.

Status flow: `Not Started` → `In Progress` → `Local Code Complete` → `TradingView Validated` → `Approved`

## Current source roles

| File | Role | Status |
|---|---|---|
| Last committed pre-restructure `code/development/revelio.pine` at `968c5969c7a8059a89514ff54a5af8385154fbd8` | Stable Revelio baseline | Selected as migration source; staged and working-tree versions excluded |
| Commit `534b1904f04b74d4b641c8f296eebc9201223813` | Approved Slices 1–3 migration checkpoint | TradingView compiled, user tested, and principal reviewed |
| Commit `5cfa01f` | Approved Slice 5 migration checkpoint | Core/Gaps split compiled and passed user comparison |
| `code/development/indicator/revelio.pine` | Canonical production indicator source | Published first-hit build titled `revelio •`; current imports are enforced by the canonical version registry |
| `REVELIO-AUTO-SWEPT-ADR.md` | Auto Swept architecture decision | Accepted and closed after `/6` production approval |
| `REVELIO-AUTO-SWEPT-PARKED.md` | Auto Swept history and superseded designs | `/2` and `/3` behavior retained as historical evidence |
| `code/development/libraries/revelio-core-library.pine` | Promoted Revelio Core Library source | Production `/1` published as `midnightpaws87/RevelioCoreLibrary/1` |
| `code/development/libraries/revelio-gaps-library.pine` | Promoted Revelio Gaps Library source | Production `/1` published as `midnightpaws87/RevelioGapsLibrary/1` with Core `/1` |
| `code/development/libraries/revelio-interactions-library.pine` | Canonical Revelio Interactions Library source | Published and approved first-hit implementation; current publication status and fingerprint are maintained in the canonical version registry |
| `REVELIO-LIBRARY-MIGRATION-ASSESSMENT.md` | Architecture, effort, risks, and roadmap | Complete |

The two temporary spike clients were deleted after their historical, realtime, reload, and Range-chart gates passed. Their evidence remains below.

## Slice 0 — Library compatibility spike

- [x] Create a library source with a development title.
- [x] Export a UDT containing a collection field.
- [x] Include `varip int` and `varip bool` fields.
- [x] Export a constructor.
- [x] Export object-mutation functions.
- [x] Create a client that compares the collection count with the `varip` execution count.
- [x] Confirm the TradingView username that owns the private library.
- [x] Publish the library privately as `RevelioCore`, version `1`.
- [x] Replace the username placeholder with `midnightpaws87`.
- [x] Compile the client.
- [x] Validate historical behavior.
- [x] Validate forming-candle realtime behavior.
- [x] Validate reload behavior.
- [x] Validate a Range chart.
- [x] Approve the imported-UDT boundary.

### Realtime findings

- Version 1 compiled and imported, but failed the persistence check on a live NQ1! 5-minute candle: `Intrabar Updates` reached `21` while `Array Samples` remained at `2`.
- Pine rollback affected the collection field because the field itself was not intrabar-persistent.
- Version 2 declares `samples` as `varip array<float>`.
- Version 2 compiled, imported, and kept the counts aligned as they advanced from `27 / 27` to `33 / 33` over realtime ticks.
- After saving and recompiling the client, recalculated historical output returned `1 / 1`.
- On M6E1! 180R, the imported collection probe reached `14 / 14`.
- After reload on M6E1! 1-minute, the collection probe resumed at `4 / 4`.

## Slice 1 — Canonical Profile and constructors

- [x] Copy the committed 37-field `Profile` definition exactly.
- [x] Preserve the eight `varip` Touch Marker fields.
- [x] Export `newProfile`.
- [x] Export `newRemoteProfile`.
- [x] Verify 37 fields against 37 constructor arguments.
- [x] Publish private `RevelioCore` version `3`.
- [x] Compile the constructor-parity client.
- [x] Validate every empty-profile default.
- [x] Validate remote-profile row count, levels, alternate POC, and validity.
- [x] Validate realtime hit/consumed persistence.
- [x] Validate on M6E1! 180R.
- [x] Validate a hard reload.
- [x] Namespace the parallel migration host's `Profile` references.

### Slice 1 findings

- Empty and remote constructor checks both remained `Pass`.
- Realtime fields remained `Pass` as the 180R client advanced through at least nine updates.
- After reload on M6E1! 1-minute, both constructor checks and realtime persistence remained `Pass` through four updates.

## Archived Slice 0–1 spike test card

### TradingView publication steps

1. Open `code/development/libraries/revelio-core-library.pine` in the `Revelio Core Library • development` Pine Editor script.
2. Save it with a clear development name.
3. Use TradingView's Publish Script flow and choose Publish Library.
4. Publish privately as `RevelioCore`.
5. Open the temporary validation client for the version under test.
6. Import the latest validated private version.
7. Save and add the client to the chart.

Do not publish the full Revelio indicator during this spike.

### Expected behavior

Historical bars:

- `Intrabar Updates` is `1`.
- `Array Samples` is `1`.
- The two plots overlap.
- The background is never red.

Open realtime candle:

- The first update starts at `1`.
- Later updates increment both counts together.
- The background becomes pale green after the second update.
- The background never becomes red.

Reload:

- Elapsed realtime bars recalculate as historical bars and show `1`.
- The currently forming candle starts a new live count.

Range chart:

- Counts continue to agree.
- The test does not rely on `time_close`.

### Failure evidence

If the client fails:

- Record the exact compiler/runtime error.
- Record the symbol, chart type, timeframe, and market state.
- Capture the table and plot if the client reaches the chart.
- Do not begin the production `Profile` migration until the failure is understood.

## Slice 2 — Profile preparation and histogram construction

- [x] Move profile sample compaction into `RevelioCore`.
- [x] Move bar-volume sample preparation and append logic.
- [x] Move histogram preparation and smoothing.
- [x] Move POC, alternate POC, VAH, and VAL construction.
- [x] Namespace every migrated call in the parallel host.
- [x] Publish private `RevelioCore` version `4`.
- [x] Pin the parallel host to `midnightpaws87/RevelioCore/4`.
- [x] Compile the full parallel host in TradingView.
- [x] Recalculate on NQ1! 1-minute and 5-minute.
- [x] Recalculate and hard reload on NQ1! 180R.
- [x] Hard reload on NQ1! 1-minute.
- [x] Compare all 167 production and development settings controls.
- [x] Compare the five profile anchors against the stable production chart.
- [x] Validate forming-candle realtime behavior.

### Slice 2 findings

- The first full host after the constructor-only extraction exhausted TradingView's compiler timeout after four attempts.
- The Slice 2 host contains 3,571 source lines and the development library contains 358 source lines.
- The full `RevelioCore/4` host compiled on NQ1! 1-minute in approximately 89 seconds.
- TradingView reported four existing consistency warnings around `calendarQuarterStart`, `calendarDayStart`, and locally scoped `marketRthInSession`.
- TradingView did not report the previous `104451` compiled-token failure or the four-attempt compiler-timeout failure.
- NQ1! 1-minute, 5-minute, and 180R recalculated without a runtime error.
- Hard reloads preserved the production indicator, development indicator, and single development-library instance on both 1-minute and 180R.
- Production and development exposed 167 settings controls with identical values, checked states, and enabled or disabled states.
- The published read-only production indicator and `new revelio • development` were compared side by side in TradingView Desktop.
- The user approved Slice 2 after confirming the library-backed version worked correctly.

### Development naming and chart hygiene

- The editable Pine script is named `Revelio Core Library • development`.
- Pine's canonical technical `library()` identifier is `RevelioCoreLibraryDevelopment`; it includes `Library` while omitting spaces and the bullet character required by the human-facing name.
- The editable Gaps script is named `Revelio Gaps Library • development`, with technical identifier `RevelioGapsLibraryDevelopment`.
- At the Slice 2 checkpoint, the published import was `RevelioCore`, pinned to version `4`.
- The parallel library-backed indicator title is `new revelio • development`.
- Completed spike panes and local spike files were removed.
- The testing chart should contain only the published read-only production `revelio •` and the current editable `new revelio • development`.
- Development libraries are edited separately and should not remain on the comparison chart.

Renaming the technical Core identifier starts a new TradingView lineage at `/1`; it does not rename the already published `RevelioCoreDevelopment/1–3` history. Publish and validate the new Core and Gaps lineages before deciding whether to retire the superseded development lineage. Production `RevelioCore/4` remains untouched.

## Slice 3 — Shared anchor and maturity engine

- [x] Export `AnchorState`, `MergeState`, `AnchorProcessPolicy`, and `MaturityState`.
- [x] Export constructors for all four state and policy types.
- [x] Move anchor finalization and shared anchor processing.
- [x] Move profile storage, profile lookup, and histogram synchronization.
- [x] Move developing-profile maturity transitions and visibility decisions.
- [x] Pass chart time, previous time, last-bar state, tick size, row count, and value-area percentage explicitly.
- [x] Keep session-boundary decisions and the Quarterly request wrapper in the host.
- [x] Keep mitigation, sweep, rendering, requests, inputs, and drawing budgets in the host.
- [x] Publish the cleaned private development library as `RevelioCoreDevelopment/2`.
- [x] Import the private development library from `new revelio • development`.
- [x] Compile and update the full development indicator in TradingView Desktop.
- [x] Remove the temporary library instance from the comparison chart.
- [x] Complete the independent principal review of Slices 1–3.
- [x] Resolve all principal-review findings and republish the cleaned development library.
- [x] Receive user approval after side-by-side TradingView testing.

### Slice 3 findings

- The development host contains 3,362 source lines and the development library contains 628 source lines.
- TradingView displays the expected trailing blank lines as line 3,363 in the host and line 629 in the library.
- The cleaned development library compiled and was published privately as `midnightpaws87/RevelioCoreDevelopment/2`.
- `RevelioCore/4` remains the unchanged production library; the production version number was not advanced.
- The full development indicator compiled and updated on ES1! 5-minute without the `104451` compiled-token error.
- TradingView reported the same four existing consistency warnings at host lines 2,409, 2,410, 2,412, and 2,414 around `calendarQuarterStart`, `calendarDayStart`, and locally scoped `marketRthInSession`.
- The comparison chart contains only published read-only `revelio •` on the left and `new revelio • development` on the right.
- Auto Swept remains absent and parked.
- Local structural checks found balanced delimiters, no trailing whitespace, no local duplicates of the migrated engine, and no Auto Swept references.
- The user confirmed that the tested development indicator was working correctly and approved committing Slice 3.

### Slice 3 principal review

- No P0 or P1 implementation blockers were found.
- Pine legality, type and constructor parity, call arity, state persistence, short-session finalization, request ownership, development/production separation, and Auto Swept parking were verified.
- Compile validation does not equal behavioral approval. The remaining TradingView matrix is listed in the migration assessment.
- Documentation must use committed `968c5969c7a8059a89514ff54a5af8385154fbd8` as the authoritative migration code baseline.
- Historical Group B commit `962eb334` remains behavior evidence only.
- The published read-only indicator is the visual comparison oracle, not a third code baseline.
- Retired `ProfileProbe` scaffolding and unused host copies of migrated constants were removed in development version 2.
- The principal's post-remediation review found no remaining P0, P1, P2, or lower-severity blocker.

## Slice 4 — Core mitigation and manual sweep transitions

- [x] Move price-return mitigation into `RevelioCore`.
- [x] Move two-sided manual sweep transitions into `RevelioCore`.
- [x] Remove the migrated host function copies.
- [x] Pass current close and current time explicitly.
- [x] Keep activation policy, eligible price-range calculation, and confirmed-bar orchestration in the host.
- [x] Pin the local development host to `midnightpaws87/RevelioCoreDevelopment/3`.
- [x] Publish the private development library as `RevelioCoreDevelopment/3`.
- [x] Compile and update the full development indicator.
- [x] Compare Any Return, Same Session, and Until Swept behavior.
- [x] Validate RTH, Globex, Weekly, Monthly, and Quarterly anchors.
- [x] Validate realtime, reload, Bar Replay, 180R, and 360R behavior.
- [x] Record user approval before the next checkpoint.

Production `RevelioCore/4` remains unchanged. Auto Swept is not part of this slice.

The Slice 4 host contains 3,304 source lines and the Core library contains 695 source lines. The clean `/3` host compiled and was added to the ES1! 5-minute chart at 21:49:55 without a compiled-token or syntax error. Static checks found balanced delimiters, no trailing whitespace, five namespaced anchor-level calls, and no remaining host copies of the migrated transitions.

The user completed the Slice 4 comparison and confirmed that the affected behavior looked correct.

## Slice 5 — Separate Value Gap domain library

- [x] Create `code/development/libraries/revelio-gaps-library.pine`.
- [x] Export the Value Gap direction enum and canonical Value Gap state.
- [x] Move gap detection, creation, erosion, fill lifecycle, profile synchronization, and selection.
- [x] Move pure geometry and cost calculations only when they do not create drawings.
- [x] Keep Value Gap inputs, fill-window policy, requested price data, drawing calls, and central budgets in the host.
- [x] Publish the renamed Core privately as `RevelioCoreLibraryDevelopment/1`.
- [x] Publish Gaps privately as `RevelioGapsLibraryDevelopment/1`.
- [x] Import both new development library lineages from `new revelio • development`.
- [x] Compile the full `new revelio • development` host in TradingView without the compiled-token error.
- [x] Compare every Historical, Most Recent, Floating, Upcoming, fill-window, label, and reminder mode.
- [x] Validate the user-selected comparison scenarios.
- [x] Record user approval and commit the checkpoint as `5cfa01f`.

Value Gaps remain separate from `RevelioCore` so one oversized library does not recreate the original maintenance problem.

The validated checkpoint imports Core Library `/1` and Gaps Library `/1`. The Auto Swept candidate requires one aligned update: publish Core Library `/2`, publish Gaps Library `/2` with its Core `/2` import, then compile the host with both `/2` imports.

## Slice 6 — Auto Swept restoration

- [x] Preserve the parked product contract with Auto off by default.
- [x] Complete a fresh principal architecture review.
- [x] Keep Auto Swept state and pure selection logic in the existing Core Library.
- [x] Replace five key maps with one compact typed state per anchor.
- [x] Retain a bounded 50-profile compact archive per anchor independently of `Show Last` and Focus retention.
- [x] Bound the initial candidate to two current levels and historical selection state to 11 daily cycles per anchor.
- [x] Select the initial candidate once at the Futures/UTC boundary open and replace each anchor set atomically.
- [x] Keep POC, aPOC, VAH, and VAL visibility independent in Auto mode.
- [x] Preserve the exact manual profile-wide predicate when Auto is off.
- [x] Keep rendering, budgets, Touch policy, Focus policy, calendar classification, and controls in the host.
- [x] Reserve drawing capacity for selected Auto lines before ordinary completed-profile lines.
- [x] Reconstruct historical Focus visibility from per-level grace and retained daily selection history.
- [x] Resolve the principal P1 archive-dependency and drawing-allocation findings.
- [x] Complete the post-remediation principal re-review with no remaining P0/P1 blocker.
- [x] Publish `RevelioCoreLibraryDevelopment/2`.
- [x] Publish `RevelioGapsLibraryDevelopment/2`.
- [x] Compile the `/2` host without the prior compiled-token error.
- [x] Compare Auto off against the published read-only Revelio and confirm manual behavior remains unchanged.
- [x] Complete the Auto Swept TradingView validation matrix.
- [x] Record user approval of the final Auto behavior.

### Initial Auto-on behavior test

The checked once-daily/two-pick items above describe the compiled `/2` attempt and are superseded by the `/3` correction below.

- Auto on compiled and rendered without a runtime error.
- The user observed a small performance slowdown.
- Some swept lines appeared and disappeared instead of looking stable.
- Some levels considered important were absent even while price was nearby.
- Auto-on behavior is not approved. Do not commit or publish the indicator until lifecycle strictness and redraw stability are resolved.

### Sticky-proximity `/3` correction

- [x] Preserve two deterministic daily baseline picks.
- [x] Reserve two additional non-evicting intraday admissions per anchor.
- [x] Admit on confirmed proximity entry or nearby grace expiry.
- [x] Record the exact activation timestamp for historical Focus reconstruction.
- [x] Apply a wider 1.5-range daily exit band.
- [x] Admit only grace-complete archived levels so grace-visible levels cannot consume sticky slots.
- [x] Keep the grace-expiry bar continuous and rearm proximity entry at each daily reset.
- [x] Store confirmed-close activation time for historical Focus reconstruction.
- [x] Restrict full archive synchronization to anchor profile-change events.
- [x] Run Touch-only synchronization only while Touch detection is active.
- [x] Cache archive visibility masks once per render refresh.
- [x] Guarantee selected lines with a protected first render pass under the 500-line cap.
- [x] Publish Core `/3`, then Gaps `/3`.
- [x] Compile the `/3` host and record the result.
- [ ] Re-test stability, current-price relevance, and Auto-on responsiveness.

The `/3` host failed with `101659` compiled tokens against the `100256` limit. This is `1403` tokens over and provides no safe growth margin. The Interactions boundary is therefore required before Auto validation can continue.

The rejected `/2` candidate contained 3,383 host lines, 1,095 Core Library lines, and 232 Gaps Library lines. The revised local `/3` candidate contains 3,456 host lines, 1,200 Core Library lines, and 232 Gaps Library lines. Local checks found 34 `AutoSweptProfile` fields and 34 constructor arguments, four `AutoSweptPick` fields and four constructor arguments, balanced delimiters, aligned `/3` imports, no trailing whitespace, and no stale map-based Auto symbols. These are structural checks only; TradingView compilation and runtime testing remain authoritative.

## Slice 7 — Interactions capacity extraction

- [x] Record the `/3` compiler result: `101659 / 100256`.
- [x] Complete the interaction-boundary and token-savings audit.
- [x] Select the lower-risk presentation/compositor boundary.
- [x] Create `revelio-interactions-library.pine` with the development library identity.
- [x] Move hit and presentation records, label clustering, reminder composition, event grouping, label buffering, and Touch Marker circle rendering.
- [x] Keep contact detection, Focus backfill, Auto selection, inputs, requests, and top-level render order in the host.
- [x] Pass host-owned drawing registries, limits, settings, and maps explicitly.
- [x] Publish `RevelioInteractionsLibraryDevelopment/1`.
- [x] Prepare the Interactions `/1` import beside Core `/3` and Gaps `/3`.
- [x] Compile in TradingView and record that the host was added to the chart without the compiled-token error.
- [ ] Validate merged-marker priority, archived symbols, labels, reminders, Replay, realtime, and drawing pressure.
- [ ] Run a disposable compile-stress probe after successful behavior validation.
- [x] Complete the independent principal static review with no P0–P3 findings.

### Slice 7 local findings

- The host decreased from 3,456 to 2,938 source lines, a net reduction of 518 lines.
- The Interactions library contains 610 source lines because settings, limits, time context, and drawing registries cross the boundary explicitly.
- Constructor arity and ordering align for all seven exported UDTs.
- Merged Touch Marker color and size still come from the same highest-priority anchor presentation.
- Label, reminder, retention, and host-owned drawing-registry behavior match the pre-extraction implementation in static review.
- Token-stress probing and visual/runtime validation remain required.
- The user confirmed Interactions `/1` compiled successfully and the host was added to the chart.
- Exact remaining compiled-token headroom remains unavailable until the planned stress probe brackets it.

### Auto `/3` chart findings after the capacity extraction

- The Auto display remained stable during the user's chart test.
- Enabling Auto increased initial chart load by approximately seven seconds.
- Touch Markers behaved correctly while price moved.
- The Auto display removed older lines that remained eligible for Touch detection, so markers could appear at levels the user could not see approaching.
- The current `2` setting is two boundary-selected levels per anchor, not two retained days. Intraday admission raises the maximum to four selected levels per anchor.
- Auto is not approved until visible context anticipates touch-eligible levels without restoring excessive clutter.

## Slice 8 — Adaptive global Auto Swept relevance

- [x] Reject per-anchor nearest-N and per-bar proximity admission as the product model.
- [x] Complete an independent principal design assessment.
- [x] Record the decision and alternatives in `REVELIO-AUTO-SWEPT-ADR.md`.
- [x] Preserve the current manual retention setting and same-anchor grace as a protected floor.
- [x] Restore the exact profile-wide manual keep predicate inside Auto mode.
- [x] Build one cycle-stable relevance plan across enabled RTH, Globex, Weekly, Monthly, and Quarterly anchors.
- [x] Use a request-free trimmed 14-profile Globex/UTC ADR for reach, not importance.
- [x] Rank confluence by higher-timeframe participation, distinct anchors, distinct source profiles, distinct roles, later control overlap, later value acceptance, distance, and recency.
- [x] Keep every admitted source identity at its exact price so existing merged labels expose the confluence.
- [x] Carry grace/manual-floor lines through the cycle without consuming adaptive quotas.
- [x] Add one directional expansion checkpoint after price travels 1.00 ADR from the cycle open.
- [x] Reserve bounded drawing capacity for both protected lines and scored selections.
- [x] Reserve dynamically protected lines under Intraday Focus, not only cycle-boundary picks.
- [x] Key selections by exact profile start/end identity so short-session folding cannot move an admitted line.
- [x] Exclude superseded same-start snapshots from ADR, confluence, and later cycles.
- [x] Keep a superseded snapshot's exact Touch presentation only while that exact level remains selected and visible.
- [x] Make an expired superseded snapshot ineligible for new Touch events before the next archive cleanup.
- [x] Replace dense radius rescoring with one price sort, stable cluster partition, and at most 12 best-candidate scans.
- [x] Scan compact sweep archives only when the confirmed close extends their observed close range.
- [x] Leave Touch Marker detection, history, priority, color, size, and deduplication paths unchanged.
- [x] Prepare the local Core `/4`, Gaps `/4`, and indicator import chain.
- [x] Complete the post-implementation principal review.
- [x] Publish Core `/4`, then Gaps `/4`.
- [x] Compile the `/4` indicator host and record compiled-token status.
- [x] Complete the Auto Swept TradingView matrix.
- [x] Record user approval of the final Auto behavior.

The local candidate contains 1,469 Core lines, 232 Gaps lines, 610 Interactions lines, and 2,989 host lines. Static validation is structural only; TradingView remains authoritative for compiler legality, compiled-token headroom, runtime cost, replay determinism, and visual behavior.

The `/4` design is intentionally not a larger retention count. ADR bounds the reachable universe, auction evidence ranks non-overlapping zones, the manual setting is a hard floor, and daily/add-only planning prevents the repeated disappearance and reappearance seen in the rejected selectors.

TradingView result: the published Core `/4` and Gaps `/4` chain compiles successfully in the indicator with Auto off. No compiled-token error was reported; exact unused token headroom remains unavailable from TradingView.

### Auto `/4` failed TradingView result and `/5` correction

- Auto `/4` recruited levels from the fixed 50-profile archives even when the user retained only 10 daily profiles, producing hidden May/June sources and an unreadable chart.
- Auto `/4` still added approximately seven seconds to loading.
- [x] Make each configured RTH, Globex, Weekly, Monthly, and Quarterly profile count a hard Auto source boundary.
- [x] Preserve the deep 50-profile canonical archive while maintaining a separate recent-N Auto eligibility window.
- [x] Apply the same recent-N boundary to Auto references, later evidence, manual/grace protection, visibility masks, line budgeting, and rendering.
- [x] Limit synchronization from a Focus-retained host archive to its newest 50 profiles.
- [x] Require at least two distinct source profiles before an adaptive cluster can enter.
- [x] Keep the manual swept retention and grace floor inside the configured source universe.
- [x] Preserve exact current-cycle picks through an intracycle source-window rollover.
- [x] Preserve the deep 14-profile ADR sample and optional older Touch Marker sources.
- [x] Keep Intraday Focus surfacing independent from global Auto candidacy.
- [x] Prepare the corrected Core `/5`, Gaps `/5`, and indicator import chain.
- [x] Complete the focused principal re-review with no P0–P3 correctness findings.
- [x] Publish and compile the `/5` chain.
- [ ] Confirm that no adaptive label date falls outside its configured source window.
- [ ] Repeat three cold loads against the two-second target.

The `/5` candidate contains 1,502 Core lines, 232 Gaps lines, 610 Interactions lines, and 2,994 host lines. A destructive intermediate correction that physically pruned the canonical archive was rejected during review because it would have damaged ADR, older Touch Markers, and cycle-stable picks; it was replaced before TradingView testing. The user confirmed that `/5` compiles and appears behaviorally correct, with only a small Auto-on load delay remaining.

### Auto `/6` behavior-neutral performance pass

- [x] Complete an independent principal performance audit.
- [x] Replace recent-source linear membership scans with direct membership and ordered eligible archive indices.
- [x] Iterate only the configured recent-N indices when collecting references and later evidence.
- [x] Replace repeated current-pick scans with exact start/end profile bitmask maps.
- [x] Preserve historical pick records for Intraday Focus reconstruction.
- [x] Cache protected archive visibility masks once beside ordinary visibility masks.
- [x] Preserve ranking inputs, reference order, archive depth, ADR14, Touch history, Focus, plan cadence, and drawing order.
- [x] Add a temporary host-only `Ⓐ` audit for incremental Auto lines and the active ADR value.
- [x] Prepare the local Core `/6`, Gaps `/6`, and indicator import chain.
- [x] Complete the final principal implementation review with no P0–P3 static defects.
- [x] Publish and compile the `/6` chain.
- [x] Compile the host-only `Ⓐ` audit and confirm it can be used for periodic selection review.
- [ ] Confirm Auto `/5` and `/6` select and render the same identities.
- [ ] Compare three `/5` and `/6` cold loads on the same chart and settings.

The local `/6` candidate contains 1,498 Core lines, 232 Gaps lines, 610 Interactions lines, and 3,016 host lines after the host-only Auto audit, Quarterly Replay cache/force-On correction, and last-bar retained-source optimization. The user approved Auto Swept behavior and retained the default-off `Ⓐ` audit temporarily for periodic observation. Exact profiler totals and extended rollover soak remain optional follow-up evidence rather than release-blocking product defects.

### Post-`/6` behavior-preserving performance audit

- [x] Rebuild retained Touch source identities only on the last bar immediately before event pruning consumes them.
- [x] Resolve explicit Quarterly `On` in the host and forward-fill the latest 15m developing snapshot without adding a request.
- [x] Deduplicate forward-filled completed Quarterly histogram transfers by the stored profile's populated rows.
- [x] Complete an independent principal review of the Quarterly force-On correction with no P0–P3 static defect.
- [x] Validate the Quarterly force-On correction on 5m; the user approved the observed result.
- [x] Confirm qualitative performance parity with production: the development build is sometimes faster and not noticeably slower on the working chart.
- [ ] Validate one quarter rollover for stale-profile reappearance or a prolonged blank.
- [ ] Compare three Auto-off and Auto-on cold loads on the same 5m chart after the retained-source change.
- [ ] Capture Pine Profiler totals and the three hottest regions with Auto off and on.
- [ ] Consider gating inactive anchor and Quarterly engines only if the Profiler shows requested-context or profile-processing cost and every Quick Filter, Value Gap, Touch All Anchors, Focus, and Auto dependency remains explicit.
- [ ] Consider persistent drawing updates only as a separate architectural slice. Completed histograms, dynamic continuations, merged labels, Focus selection, and drawing-budget order must retain exact identities.
- [ ] Consider a sorted archived-Touch price index only as a separate interaction slice with Replay, live forming-candle, Include Older Levels, and merged-marker parity tests.
- [x] Reject reducing profile rows, source counts, archive depth, lower-timeframe coverage, or Replay history as performance shortcuts.

The retained-source move is behavior-neutral by control flow: the map had one consumer, `pruneLevelHitEvents()`, inside the last-bar render phase. Deferring its clear and ten source-registration passes removes unused historical string construction, archive scans, and map writes while rebuilding the same map before that consumer. The user reported qualitative performance parity with the published production build: the development build is sometimes faster and not noticeably slower. This is not a timed benchmark; the remaining candidates require profiler evidence because TradingView can execute requested contexts and drawing lifecycles differently from apparent host-source placement.

### Mature appearance-input cleanup

- [x] Inventory each settled color, width, line style, and text-size input before removal.
- [x] Inline every existing visual value directly into its rendering/style consumer.
- [x] Preserve behavioral toggles, counts, offsets, retention, and Manual Focus price/width/offset except the separately approved permanent behaviors.
- [x] Repack anchor controls into plain compact rows without the rejected category prefixes.
- [x] Fix Sweep confirmation at 5% and remove its input.
- [x] Make Value Gap main labels and 25% / 50% / 75% lines permanent; retain 50% internal labels on historical gaps only and remove quartile labels.
- [x] Fix Value Area at 70%, Anchor Labels at Reminders, Gap minimums at 5% / 45%, and all settled fades through named constants.
- [x] Remove the settled Manual Focus color input and the complete color reference table subsystem.
- [x] Remove obsolete Anchor Label mode fields through published Interactions `/2`; reminders are unconditional.
- [x] Verify zero remaining `input.color`, no style/size dropdowns, balanced delimiters, and constructor arity.
- [x] Compile in TradingView and compare RTH, Globex, Weekly, Monthly, Quarterly, Value Gaps, and Manual Focus against the preceding development build.

The host now contains 2,713 lines and 106 inputs, down from 3,016 lines and 237 inputs. The first 109 removals were appearance-only; six more fixed Sweep confirmation and Value Gap display behavior; the final 16 fixed Value Area, Anchor Labels, Gap minimums, settled fades, Manual Focus color, and the reference-table toggle. Core and Gaps are unchanged; published Interactions `/2` removes three obsolete Anchor Label mode fields and their dead branch. The user compiled and visually approved the cleaned host in TradingView; historical gaps retain their 50% internal labels while Floating and Upcoming gaps do not.

## Manual Revelio restoration gate

- [x] Remove the Auto Swept input and its active-control conditions.
- [x] Remove Auto constants, state collections, and history type.
- [x] Remove Auto selection helpers and boundary selection.
- [x] Remove Auto state from rendering and line-budget signatures.
- [x] Restore manual historical Focus visibility reconstruction.
- [x] Preserve the development title.
- [x] The stable-baseline library-backed host compiles in TradingView.
- [x] The five manual swept retention controls are visible.
- [x] Auto Swept Lines is absent.
- [x] Auto off/manual output matches the previous training build.
- [x] Touch Markers and Intraday Focus still compile and render.

If compilation still exceeds the limit, record TradingView's new compiled-token total before making another reduction.

## Production track decision

Choose only after Slice 0 passes:

### Track A — Fast compiler relief

- [x] Extract the complete Value Gaps vertical into `RevelioGapsLibraryDevelopment`.
- [x] Keep inputs, source selection, requests, and central drawing budgets in Revelio.
- [ ] Compile after the extraction.
- [ ] Validate every Value Gap display and fill mode.

Planning range: 1–2 working days.

### Track B — Durable profile foundation

- [x] Export the real 37-field `Profile` type.
- [x] Move constructors.
- [x] Namespace all parallel-host consumer type references.
- [x] Move sample preparation, compaction, profile construction, and histogram smoothing.
- [x] Compile after each independently testable step.
- [x] Validate all five anchors before moving finalization.
- [x] Move anchor finalization and maturity state.
- [x] Move mitigation and manual sweep state in a dedicated reviewed and validated slice.

Planning range: 3–5 working days.

## Auto restoration gate

Auto Swept Lines may advance from local development when:

- [x] The manual two-library checkpoint is TradingView validated.
- [x] Auto's state architecture is redesigned to reduce collection and parameter fan-out.
- [x] The redesign receives a fresh principal review.
- [x] Auto compiles and passes its TradingView product-acceptance matrix.

## First production release gate

- [x] Auto Swept receives user approval.
- [x] Keep the `Ⓐ` audit default off in the first release for short post-approval observation.
- [x] Promote the exact approved development sources in place; do not create a parallel local production codebase.
- [x] Select the production publication privacy and visibility modes in TradingView.
- [x] Publish the promoted Core source as `midnightpaws87/RevelioCoreLibrary/1`.
- [x] Publish the promoted Gaps source as `midnightpaws87/RevelioGapsLibrary/1`.
- [x] Publish the promoted Interactions source as `midnightpaws87/RevelioInteractionsLibrary/1`.
- [x] Pin the promoted indicator to the production `/1` library versions.
- [x] Replace the obsolete manual host with the promoted library-backed `revelio.pine` source.
- [x] Change the promoted indicator title to `revelio •`, removing only `development` and retaining the permanent bullet.
- [x] Default Upcoming Value Gaps to off without changing their enabled behavior.
- [x] Compile the complete production import chain and run the final TradingView smoke test.
- [x] Prepare the first production release commit.
- [x] Publish the first production indicator release.
- [x] Record final user approval of the deployed production indicator.

Final result: the production `/1` library chain and `revelio •` indicator were deployed successfully. The user confirmed that the production indicator works and approved the complete migration and release.

## Post-release Interactions — optional first-hit direction context

- [x] Extend Touch Marker events with approach direction.
- [x] Reuse the existing lower-timeframe request by adding the sub-bar open; do not add another request.
- [x] Preserve consecutive-update live crossing detection and use its prior price as the approach origin.
- [x] Add a default-off `First Hit` control that is active only with `Touch Marker Labels`.
- [x] Register `① ▼` or `① ▲` only for the earliest current-window marker cluster; use `①` alone when direction cannot be resolved.
- [x] Render the selected right-column format: `● ① ▼ [LAST WEEK'S] VAL | [PREV RTH] POC`.
- [x] Render the selected tooltip footer without an arrow: `① FIRST · From above · 09:42 NY`.
- [x] Reuse the established right-column merge and keep the first-hit context outside individual identities.
- [x] Preserve merged-dot identity, color, and size priority.
- [x] Preserve the legacy tooltip timestamp when `First Hit` is off by carrying a separate first-contact time.
- [x] Compact live Focus backfill to one range per minute per chart bar so first-contact context remains bounded by the existing retention budget.
- [x] Complete principal review, remediate both P2 findings, and pass re-review with no remaining P0–P3 findings.
- [x] Record the already-published pre-remediation version, corrected pending candidate, source fingerprint, and publication-instruction history in the canonical version registry.
- [x] Pin the canonical Revelio source to the registry's reserved Interactions `/4` version.
- [x] Publish the private Interactions `/4` version recorded in the canonical registry.
- [x] Compile and publish the canonical Revelio source against Interactions `/4`.
- [x] Validate NQ1! 5m Bar Replay from above and below.
- [x] Validate a merged first marker and a same-timestamp co-first case.
- [x] Validate `First Hit` off/on, Labels off, Window changes, reload, and a forming-candle live touch.
- [x] Record user approval of the published feature; the development source remains the canonical production source.

Final result: private `midnightpaws87/RevelioInteractionsLibrary/4` and the Revelio host importing `/4` were published. The user confirmed that the optional first-hit Touch Marker feature is good to go.
