# Revelio Pine Library Migration Assessment

Updated: 2026-07-31
Status: Closed — selected Core, Gaps, and Interactions architecture implemented; production `/1` libraries published; release completion tracked in `REVELIO-LIBRARY-MIGRATION-TRACKER.md`
Authoritative migration baseline: committed `code/development/revelio.pine` at `968c5969c7a8059a89514ff54a5af8385154fbd8`
Approved migration checkpoints: `534b1904f04b74d4b641c8f296eebc9201223813`, `5cfa01f`

## Executive decision

Revelio should begin moving stable calculation infrastructure into private Pine libraries.

This is the best long-term response to the compiled-token ceiling because it can preserve one visible Revelio indicator while giving the indicator and its imported libraries separate compiled-token budgets. It is a better foundation for continued product development than repeatedly removing useful behavior whenever the monolithic indicator approaches TradingView's limit.

The migration should not begin by moving all of Revelio into one library or by treating the newest Auto Swept Lines feature as the whole solution. The primary long-term library should own the stable profile data model and shared profile engine. A focused Value Gaps library is an optional faster first production extraction if immediate compiler relief takes priority over the deeper foundation.

Inputs, Quick Filters, chart requests, session/calendar boundary decisions, central drawing budgets, and top-level execution order should remain in the indicator.

The recommended sequence is:

1. Prove that an imported library can safely own Revelio's `Profile` type, including collection fields and intrabar-persistent fields.
2. Choose the first production track:
   - Fast relief: extract the complete Value Gaps vertical.
   - Durable foundation: extract `Profile`, profile construction, and the shared profile engine.
3. Compile and compare an Auto-off library-backed Revelio against the last TradingView-validated baseline.
4. Complete the Profile Core extraction if the fast-relief track ran first.
5. Restore and validate full Auto Swept Lines after the main indicator has useful compiler headroom.

Earliest compatibility proof: half a focused working session after the library publication path is available.
Earliest production extraction: approximately 1–2 working days for a focused Value Gaps library.
Production-safe Profile Core migration: approximately 3–5 working days, driven mainly by TradingView compile, Replay, realtime, Range-chart, and visual validation.
Broader multi-library modularization: approximately 1–2 weeks if interaction/presentation logic is also extracted.

These ranges are planning estimates, not guarantees. Pine provides no local compiler or compiled-token breakdown, so TradingView feedback determines the actual number of iterations.

## Why this assessment exists

The pre-migration Auto Swept build reported:

- Compiled Revelio size: `104451`
- Enforced limit in the compiler response: `100256`
- Historical overage: `4195` compiled tokens
- Overage relative to the limit: approximately `4.2%`

The stability and performance-corrected `/3` Auto host later reported:

- Compiled Revelio size: `101659`
- Enforced limit in the compiler response: `100256`
- Current overage: `1403` compiled tokens
- Overage relative to the limit: approximately `1.4%`

This lower overflow confirms that the Core and Gaps extractions created relief, but it does not prove useful remaining headroom. TradingView does not report the token count of a successful compile, so the successful manual and `/2` checkpoints never established how far below the ceiling they were.

TradingView compiles Pine source into an Intermediate Language and measures the resulting IL tokens, not source lines or characters. The official documentation describes a nominal `100000`-token limit for each indicator, strategy, and library. Imported libraries have their own per-library limit, while all imported libraries together can total up to one million compiled tokens.

TradingView does not expose a successful script's exact IL or per-feature token usage. Exact savings therefore require an edit → publish/import → compile loop in TradingView.

Sources:

- [TradingView: Compiled tokens](https://www.tradingview.com/pine-script-docs/writing/limitations/#compiled-tokens)
- [TradingView: Libraries](https://www.tradingview.com/pine-script-docs/concepts/libraries/)
- [TradingView: Type system](https://www.tradingview.com/pine-script-docs/language/type-system/)
- [TradingView: Objects](https://www.tradingview.com/pine-script-docs/language/objects/)

## Historical pre-migration Revelio size and shape

Static source measurements are only architectural indicators; they are not equivalent to compiled-token counts.

| Measure | Historical Auto build |
|---|---:|
| Source lines | 3948 |
| Input declarations | 235 |
| Inputs in the five anchor sections | 134 |
| User-defined types | 19 |
| Collection constructions | 125 |
| `Profile` fields | 37 |
| `Profile` references | 91 |
| Auto Swept references | 99 |

The largest live-code regions are:

| Region | Approximate live source lines | Notes |
|---|---:|---|
| Rendering functions | 1134 | Gaps, labels, reminders, Touch Marker presentation, budgets, profile rendering |
| Calculation functions | 469 | Profile construction, sample preparation, maturity, gaps, calendars |
| Anchor engine and Touch Marker logic | 461 | Finalization, Quarterly context, detection, Focus backfill, sweep |
| Inputs | 294 | Five independently styled anchors plus global controls |
| Types and early state | 245 | Profile, styles, render metadata, Focus and Touch records |
| Main processing and rendering | 300 | Per-bar orchestration and five-anchor call sites |

This is not primarily a dead-code problem. Most large paths affect configurable output and therefore remain in the compiled program even when their corresponding input defaults to Off.

## Why Auto Swept Lines triggered the failure

Auto Swept Lines is the proximate trigger, but not the underlying architectural cause.

The checkbox and constants are small. The complete feature affects:

- Per-level visibility
- Five anchor-specific selected-key maps
- Daily candidate ranking and selection latching
- Profile line-cost calculation
- The 500-line drawing allocator
- Normal profile rendering
- Touch Marker archived/visible provenance
- Intraday Focus selection
- Historical Focus backfill

This breadth is correct for behavioral consistency, but it expanded a monolith that was already operating without useful compiler headroom.

Moving Auto alone to a library is not the recommended first extraction. Auto is new, stateful, coupled to UI policy, and still awaiting TradingView validation. The stable profile engine is a better first boundary.

## Principal review outcome

An independent principal review agrees that libraries are viable and that the user-facing product can remain one Revelio indicator.

The principal recommends keeping the current two focused domain libraries:

1. `RevelioCore` — profile data, construction, anchors, maturity, mitigation, manual sweep transitions, and compact Auto Swept selection state.
2. `RevelioGaps` — Value Gap lifecycle and selection.

The `/3` compiler failure activates the interaction-library boundary now. The first Interactions slice moves Touch Marker and level-label presentation/composition while retaining detection, Focus reconstruction, Auto selection, and host-owned drawing registries. This creates a lower-risk capacity boundary before any realtime detector state moves.

The review also recommends:

- Keep every input and the unchanged settings UI in the host.
- Keep every `request.*()` call in the host initially.
- Keep session/calendar boundaries and top-level execution order in the host.
- Keep central drawing budgets and global render order authoritative in the host.
- Do not recreate the current ceiling by putting the entire indicator into one oversized library.
- Treat Value Gaps as the lower-risk fast extraction and Profile Core as the larger, more durable extraction.
- Leave Touch/Focus migration until exported-UDT and realtime parity are established.

## What a Pine library changes

A Pine library is a separately published script containing exported functions, methods, enums, constants, and user-defined types. Revelio would import a specific published version:

```pine
import <tradingview-user>/RevelioCore/1 as revelioCore
```

The main benefit is structural capacity:

- The Revelio indicator remains subject to its own compiled-token limit.
- Each imported library has its own compiled-token limit.
- Imported libraries collectively have a much larger aggregate allowance.
- Users still add one Revelio indicator to the chart.

This is not equivalent to merely moving text into another local file. TradingView must publish the library before another Pine script can import it.

## TradingView library constraints that affect Revelio

### Publication is mandatory

A library must be published before Revelio can import it. There is no relative local import.

The library can be published privately for a private or personal Revelio script. TradingView libraries are open-source publications; privacy controls who can access a private publication, but the library does not use protected-source packaging.

This requires an explicit product decision about:

- The TradingView account that owns the library
- Whether private publication is acceptable
- Whether Revelio is personal/private, public open-source, Protected, or Invite-only
- Who is responsible for publishing new library versions

### Imports are version-pinned

Imports identify an explicit version such as `/1`. They do not automatically follow the latest version.

A library update therefore follows this release sequence:

1. Publish a new library version.
2. Change Revelio's import from the old version to the new version.
3. Compile and validate Revelio.
4. Publish or distribute the updated Revelio version.

This is additional release work, but it also makes the indicator reproducible: an older Revelio build cannot silently change because its library changed.

### Exported functions must be explicitly typed

Every exported function parameter requires a Pine type. Reference types, including UDT objects and collections, carry the `series` qualifier.

Revelio's calculation functions are already substantially parameterized, which helps. Any remaining reads of indicator inputs or mutable globals must become explicit parameters before the function can move.

### Exported functions cannot read mutable library globals

Exported library functions:

- Can read library constants
- Cannot depend on mutable library-global arrays or maps
- Cannot depend on variables initialized from inputs
- Cannot contain `input.*()` calls

The indicator should continue owning all user inputs and pass their effective values to the library.

### `request.*()` calls require special care

Library functions can contain requests under Pine's rules, but request expressions have restrictions involving exported parameters. Moving the special Quarterly lower-timeframe request into the first library would combine two migration risks.

The Quarterly request should remain in Revelio during the initial extraction. It can call exported core functions after receiving its data.

### Intrabar persistence is a release gate

`Profile` contains four `varip` hit timestamps and four `varip` daily-consumed flags used by realtime Touch Markers.

Pine supports `varip` fields on UDTs, and libraries can export UDTs. However, Revelio depends on exact rollback behavior across:

- Realtime updates inside the forming candle
- Historical bars
- Bar Replay's active edge
- Range charts
- Reloading the script

An exported `Profile` prototype must verify this behavior before the production type moves.

## Proposed target architecture

```text
Revelio indicator
├── Inputs and Quick Filters
├── Chart/session boundary detection
├── Lower-timeframe requests
├── Runtime orchestration
├── SessionStyle and all visual policy
├── Central drawing budgets and global render order
├── Touch contact detection and Focus reconstruction
└── Auto Swept input, calendar policy, rendering, and Focus policy
        │
        ├── imports RevelioCore
        │   ├── Profile data model
        │   ├── Sample preparation and compaction
        │   ├── Volume-at-price construction
        │   ├── POC, aPOC, VAH, and VAL calculation
        │   ├── Histogram smoothing
        │   ├── Shared anchor finalization
        │   ├── Maturity calculations
        │   ├── Mitigation and manual sweep state transitions
        │   └── Auto Swept typed state, grace, ranking, and bounded history
        │
        ├── imports RevelioGaps
        │   ├── Gap data model and lifecycle
        │   ├── Partial-fill and traversal logic
        │   ├── Historical/floating selection
        │   └── Gap drawing functions under host budgets
        │
        └── imports RevelioInteractions
            ├── Touch event and presentation records
            ├── Label and reminder clustering
            ├── Hit-event grouping and label buffering
            └── Touch Marker circle composition
```

The first published version should contain only the upper half of the proposed `RevelioCore` responsibilities. Anchor finalization, maturity, mitigation, and sweep should move in later slices.

## Implementation checkpoint — 2026-07-30

Private `RevelioCore` version `4` now contains:

- The canonical 37-field `Profile`
- Empty and remote constructors
- Sample compaction
- Bar-volume sample preparation and append logic
- Histogram preparation and smoothing
- POC, alternate POC, VAH, and VAL construction

At the Slice 2 checkpoint, the parallel host imported `midnightpaws87/RevelioCore/4`. Its first complete TradingView compile finished in approximately 89 seconds on NQ1! 1-minute. It produced four consistency warnings but did not reproduce either the `104451` compiled-token failure or the four-attempt compiler timeout.

This establishes compiler relief, not production parity. The five anchors, reload behavior, realtime Touch Marker state, Range charts, settings retention, and visual output remain acceptance gates before replacing the development monolith.

### Slice 3 implementation checkpoint — 2026-07-30

Private development library `RevelioCoreDevelopment/2` now also contains:

- `AnchorState`, `MergeState`, `AnchorProcessPolicy`, and `MaturityState`
- Constructors for the shared state and policy types
- Anchor finalization and lifecycle processing
- Profile storage, lookup, and histogram synchronization
- Developing-profile maturity transitions and visibility decisions

The development host imports `midnightpaws87/RevelioCoreDevelopment/2`. Production `RevelioCore/4` remains unchanged until the migration is approved for release. Session-boundary decisions, the Quarterly request wrapper, mitigation, sweep, requests, inputs, rendering, and drawing budgets remain in the host.

The Slice 3 host contains 3,362 source lines and the development library contains 628 source lines. The complete development indicator compiled and updated on ES1! 5-minute without the `104451` compiled-token error. TradingView reported the same four existing consistency warnings at host lines 2,409, 2,410, 2,412, and 2,414. The independent principal review found no remaining blocker after its documentation and retired-code findings were resolved in development version 2. The user then approved the tested side-by-side development build for migration continuation. Production promotion remains deferred until the broader release gates are intentionally closed.

## Production-track choice after the compatibility spike

### Track A — Fast compiler relief

Extract `RevelioGaps` first.

Candidate scope:

- `ValueGap` and `ValueGapStyle`
- Gap creation from consecutive value areas
- Partial-fill and traversal-fill lifecycle
- Historical/floating/upcoming selection
- Gap box, label, and internal-reference rendering

Keep the host responsible for:

- Gap inputs
- The source-profile selection
- Drawing budgets
- Global drawing deletion order
- Request data

Where practical, pass primitive profile values to `RevelioGaps` instead of making it depend immediately on `RevelioCore.Profile`.

Advantages:

- Smaller consumer refactor than moving 91 `Profile` references
- Several hundred source lines form a coherent vertical
- Likely to clear the immediate `4195`-token overage
- Provides real library/release experience before the central type moves

Risks:

- Exact token relief remains unknown until TradingView compiles it
- Drawing-ID tracking and deletion order must remain coordinated with the host
- A wide rendering API could offset some savings if the boundary is poorly designed

Planning estimate: 1–2 working days including TradingView comparison.

### Track B — Durable foundation

Extract `RevelioCore` first.

Advantages:

- Moves the stable engine shared by all five anchors
- Creates a reusable foundation for future profile features
- Reduces the chance of repeatedly revisiting the same monolithic calculations

Risks:

- Requires moving the canonical `Profile` type
- Approximately 91 type references must change
- Eight `varip` fields make realtime parity a critical gate
- Larger first migration and broader regression surface

Planning estimate: 3–5 working days including TradingView comparison.

### Recommended choice

Run Slice 0 first in either case.

If the immediate priority is to get full Auto Swept Lines compiling for testing, use Track A and then continue into Track B. If the current monolith can remain temporarily uncompiled while the durable architecture is built, go directly to Track B.

## Recommended first library boundary

Proposed local source:

```text
indicators/20-revelio/code/development/libraries/revelio-core-library.pine
```

Proposed TradingView publication:

```text
RevelioCore
```

Proposed import alias:

```pine
import <tradingview-user>/RevelioCore/1 as revelioCore
```

### Move in the first production slice

Types:

- `Profile`

Constants used only by profile calculation:

- Profile row count
- Histogram smoothing
- Sample-compaction thresholds
- aPOC qualification constants

Functions:

- `newProfile`
- `newRemoteProfile`
- `clampRow`
- `compactSamples`
- `compactIfNeeded`
- `prepareBarVolumeSamples`
- `appendPreparedBarVolume`
- `appendBarVolume`
- `prepareProfileHistogram`
- `buildProfile`

### Keep in Revelio initially

- All `input.*()` declarations
- Quick Filter and effective-mode calculations
- `SessionStyle`
- Rendering and drawing allocation
- Pending labels and reminders
- Touch Marker events, presentations, detection, and Focus backfill
- Auto Swept input, cycle calculation, rendering, and Focus policy
- Value Gap state and rendering
- Calendar and market-session boundaries
- `request.security_lower_tf()` calls
- Quarterly remote context
- Developing-profile fallback-bucket orchestration

### Why the `Profile` type must move

An external library cannot operate directly on a UDT declared privately inside the importing indicator. Meaningful extraction therefore requires exporting `Profile` from the library.

This causes a broad but mostly mechanical consumer change:

```pine
Profile profile
array<Profile> profiles
```

becomes:

```pine
revelioCore.Profile profile
array<revelioCore.Profile> profiles
```

The current source contains approximately 91 `Profile` references. That breadth is the main implementation cost of the first extraction.

The benefit is that future profile calculations can evolve inside the library without consuming the indicator's full token budget.

## Boundaries not recommended for version 1

### Do not start with rendering

Rendering contains chart drawings, global style inputs, pending buffers, label merging, reminders, and drawing-budget coordination. Moving it first would require an excessively wide exported API and make visual parity harder to isolate.

### Do not start with Touch Markers

Touch Markers are realtime-sensitive and depend on `varip`, lower-timeframe contacts, Bar Replay behavior, Focus reconstruction, presentation merging, and source provenance. They are a future library candidate only after the `Profile` boundary is proven.

### Do not move only fragments of Value Gaps

Value Gaps are separable and can be the fast production track after Slice 0. If selected, move a complete lifecycle/presentation vertical. Moving isolated helpers would create a wide cross-library API without enough token relief.

### Do not start with Auto Swept Lines

Auto is new and currently responsible for crossing the limit. Moving unstable policy into the first library would make it harder to distinguish migration regressions from Auto behavior defects.

## Migration plan

Every slice must remain independently testable. Do not replace the existing development source until its parallel library-backed client passes its assigned gate.

### Slice 0 — Compatibility spike

Goal: prove Pine's library boundary before migrating production code.

Create:

- A minimal `RevelioCore` library
- A small client indicator or parallel Revelio client
- An exported prototype UDT containing:
  - Fundamental fields
  - An `array<float>` field
  - A `varip int` field
  - A `varip bool` field
- One exported constructor
- One exported mutating function

Validate in TradingView:

- Private publication succeeds
- The client can import the private library
- Arrays of the exported UDT compile
- Consumer code can read and mutate fields
- Library functions can mutate the object
- `varip` values survive multiple realtime updates on one candle
- Reload behavior matches the monolith

Expected effort:

- Local implementation: 30–90 minutes
- TradingView publication and validation: 30–90 minutes
- Total: approximately half a working session

Stop condition:

- If exported `Profile` semantics cannot preserve realtime state, do not migrate the production UDT. Reassess a calculation-only library returning primitive/collection results or use a companion-indicator split.

### Slice 0A — Optional Value Gaps fast lane

Goal: clear the immediate compiler ceiling with a complete, separable production vertical.

Move:

- Gap UDTs
- Gap lifecycle calculations
- Gap selection
- Gap rendering under explicit host-provided settings and budgets

Validate:

- Historical, Historical + Floating, Most Recent + Floating, and Floating Only
- Source RTH and Globex
- Upcoming gap creation and disappearance
- Traversal on and off
- Partial fills, completed fills, and latest-filled emphasis
- 25%, 50%, and 75% references and reminders
- Drawing deletion and budget pressure

Expected effort:

- Implementation: 4–8 hours
- TradingView compile and visual comparison: 4–8 hours

Stop condition:

- If the main indicator still has insufficient headroom, proceed to Profile Core rather than adding narrow micro-cuts.

### Slice 1 — Profile type and constructors

Goal: make the library own the canonical `Profile` identity without changing calculations.

Move:

- `Profile`
- `newProfile`
- `newRemoteProfile`

Change:

- Namespace the approximately 91 type references
- Replace direct `Profile.new(...)` use with library constructors
- Keep all profile field names and order unchanged

Validation:

- Library and client compile
- Constructor arity and default state match exactly
- Remote Quarterly snapshots still materialize correctly
- Touch Marker hit/consumed fields retain realtime semantics

Expected effort:

- Implementation: 2–4 hours
- TradingView compile and targeted validation: 2–4 hours

### Slice 2 — Profile calculation core

Goal: move the expensive stable calculations and create meaningful indicator headroom.

Move:

- Sample preparation
- Sample compaction
- Histogram construction and smoothing
- POC, aPOC, VAH, and VAL calculation

Required refactoring:

- Pass `valueAreaPercent` explicitly
- Pass row-count and calculation constants where Pine's export rules require it
- Pass fallback/current-bar data rather than reading indicator mutable globals
- Keep lower-timeframe requests in Revelio

Validation:

- RTH, Globex, Weekly, Monthly, and Quarterly levels match the monolith
- aPOC presence, absence, and price match
- Histogram row widths and value-area colors match
- Developing and completed profiles match
- Five-minute fallback parity remains intact
- No new loop-time or memory errors

Expected effort:

- Implementation: 4–8 hours
- TradingView comparison: approximately one working day

This is the earliest slice likely to create substantial compiled-token relief. Exact relief is unknown until TradingView compiles the imported build.

### Slice 3 — Shared anchor engine

Goal: move stable state transitions after profile parity has been proven.

Candidate types:

- `AnchorState`
- `MergeState`
- `AnchorProcessPolicy`
- `MaturityState`

Candidate functions:

- Anchor constructors and process-policy constructors
- `finalizePeriod`
- `processAnchor`
- Profile storage and histogram synchronization
- Maturity state transitions
- Mitigation and sweep transitions

Required refactoring:

- Pass `valueAreaPercent`, current timestamps, and current OHLC values explicitly
- Keep session-boundary decisions in Revelio
- Keep the Quarterly request wrapper in Revelio
- Preserve the original finalization timestamp during short-session folds

Validation:

- Normal RTH and Globex sessions
- Early closes and holidays
- Every short-session merge mode
- Weekly, Monthly, and Quarterly boundaries
- UTC versus New York calendar selection
- Most-recent profile rules
- Sweep and touch separation
- Deep retained profiles used by Focus

Expected effort:

- Implementation: approximately one working day
- TradingView validation: approximately one working day

### Slice 6 — Restore full Auto Swept Lines

Goal: validate the desired latched proximity lifecycle after compiler capacity exists.

Preserve:

- Per-level grace through the next same-anchor finalization
- Two daily baseline levels plus two reserved non-evicting intraday admissions per enabled anchor
- One source-profile-range distance band
- A wider 1.5-range daily exit band
- Confirmed-bar admission when grace ends nearby or price newly enters proximity
- No intraday eviction, removal, or reorder churn
- Focus `Swept Levels` override
- Touch Marker independence
- Auto candidate retention independent of `Show Last` and Focus retention
- Auto-selected line priority under the 500-line drawing cap

Validate:

- Auto off matches manual behavior
- Auto selection does not oscillate intraday
- A later sibling sweep cannot revive an older level
- RTH/Globex and Weekly/Monthly/Quarterly grace boundaries
- Focus and archived-marker provenance
- Standard charts, Replay, realtime, and Range charts

Expected effort:

- Refactor and compile: 2–4 hours
- TradingView behavior testing: approximately one working day

## Delivery-speed scenarios

| Goal | Earliest realistic result | Included | Not yet included |
|---|---|---|---|
| Feasibility answer | Half a working session | Published private spike, exported UDT, import proof | Production Revelio |
| Fast production extraction | 1–2 working days | Value Gaps library and compiler test | Profile Core |
| Compiling Profile Core test build | 1–2 focused working days | `Profile` ownership and initial core extraction | Full regression matrix |
| Safe core migration | 3–5 working days | Profile core, anchor engine as approved, parity testing | Interaction library; Gap library is optional |
| Broader modular Revelio | 1–2 weeks | Additional stable subsystems and release workflow | Unlimited future growth |

The fastest responsible path is Slice 0 followed by Slice 0A. The cleanest direct foundation is Slice 0 followed by Slices 1 and 2. Attempting a one-shot migration would make failures difficult to diagnose and would put recently validated realtime behavior at unnecessary risk.

## Compiler-headroom policy

Simply compiling at `100255` is not a successful migration.

Recommended targets:

- Emergency ceiling: below approximately `95000`
- Healthy main-indicator target: approximately `80000–85000`
- No new large feature should begin while the main indicator is known to be close to the ceiling

Because TradingView does not display the exact IL count for successful scripts, the project cannot directly certify `85000` after a successful compile. Instead:

1. Record every overflow total TradingView reports.
2. Record which functions/types moved in each slice.
3. Compile after each slice.
4. Treat substantial library ownership—not one-token success—as the durable headroom signal.
5. Optionally use a disposable compile-stress probe to bracket remaining headroom, recognizing that it is approximate because compiler optimization is nonlinear.

## Token-reduction audit — 2026-07-31

Status dots:

- 🟢 Extracted and validated in an earlier TradingView checkpoint
- 🟡 Active capacity slice; local implementation is not yet TradingView proof
- ⚪ Audited candidate for later use
- 🔴 Keep in the host unless a separate design review changes the boundary

Compiled-token estimates below are directional only. Pine exposes no successful IL count, and source-line totals are not token totals.

| Status | Boundary | Current evidence | Expected host relief | Behavior risk | Decision |
|---|---|---|---|---|---|
| 🟢 | Revelio Core Library | 1,200 library lines; profile model, construction, anchor processing, mitigation, manual sweep transitions, and compact Auto state | Already realized, exact amount unavailable | Previously validated in bounded slices | Keep separate and pinned |
| 🟢 | Revelio Gaps Library | 232 library lines; complete Value Gap lifecycle and selection | Already realized, exact amount unavailable | Low after side-by-side approval | Keep separate and pinned |
| 🟡 | Revelio Interactions Library — presentation/compositor | Local slice removes 518 net host lines: hit/presentation records, label clustering, reminder composition, event grouping, label buffering, and Touch Marker circles; `/1` host compiled and was added to the chart | Proven to clear the `1403` deficit; exact remaining headroom unavailable | Medium-low; host arrays, limits, and render order remain explicit | Validate behavior, then run the compile-stress probe |
| ⚪ | Remaining interaction detector and Focus backfill | Approximately 360 host lines around contact ranges, event insertion, archive provenance, Focus reconstruction, and realtime state | Likely additional several thousand tokens; a complete interaction domain should provide well over the immediate deficit | Medium-high because `varip`, Replay, and live forming-candle semantics are involved | Use only if the first Interactions slice does not create a healthy margin |
| ⚪ | Five-anchor orchestration consolidation | Repeated RTH, Globex, Weekly, Monthly, and Quarterly calls in sync, selection, budget, and render passes | Rough estimate `1800–3000` tokens across a careful DRY pass | Low-medium; ordering and per-anchor exceptions must remain explicit | Good housekeeping after the compile blocker is cleared |
| ⚪ | Profile rendering policy extraction | Completed-profile level rendering, archive passes, and repeated cost calculations remain host-heavy | Potentially several thousand tokens | Medium; drawing priority and 500-line allocation are product behavior | Consider as the next durable library slice, not an emergency cut |
| ⚪ | Color-reference and ancillary presentation utilities | Table-row collection and repeated presentation adapters | Small to modest | Low if inputs and color formats remain untouched | Batch only with a coherent presentation slice |
| 🔴 | Inputs and saved-setting order | Approximately 235 declarations historically | Large source area, but moving inputs is not supported by the intended library boundary | High product risk from settings drift | Keep in indicator |
| 🔴 | `request.*()` calls and session/calendar ownership | Lower-timeframe contacts, Quarterly context, and asset/session classification | Uncertain and can consume separate request slots in libraries | High | Keep in indicator |
| 🔴 | Top-level execution and central drawing budgets | Defines deterministic update/render order and global object priority | Some tokens, but moving it would hide cross-domain behavior | High | Keep in indicator |

Capacity acceptance is now two-stage:

1. The new host must compile with the Interactions import.
2. A disposable, behavior-neutral compile-stress probe should then bracket approximate spare capacity before another major feature begins.

Crossing the limit by only a small amount, or compiling after a micro-cut, is not acceptance.

## Validation strategy

### Baseline

Use committed `968c5969c7a8059a89514ff54a5af8385154fbd8` as the authoritative code baseline for the library migration. It is the last committed pre-restructure source selected by the user; staged and working-tree variants are excluded.

Commit `962eb334` remains the historical Group B Touch Marker behavioral baseline recorded in `REVELIO-CHANGE-TRACKER.md`. It is evidence for that feature's approved behavior, not the source from which the library migration was built.

The published read-only `revelio •` instance is the visual comparison oracle in TradingView. It does not replace the authoritative code baseline because its exact source commit is not asserted here.

The library migration must first prove manual swept-line parity. Auto should be tested only after the shared baseline is stable.

### Required chart matrix

| Area | Required tests |
|---|---|
| Intraday profiles | NQ1! 1m, 5m, 15m, and 1h |
| Higher anchors | Weekly, Monthly, Quarterly on 5m, 15m, and 1h |
| Realtime | Interior revisit without a new chart-bar high/low |
| Replay | Active-edge Touch Markers and session boundaries |
| Non-standard | 180R and 360R |
| 24/7 | BTC or another continuous symbol across UTC boundaries |
| Holidays | RTH/Globex short-session merging and finalization |
| Stress | All anchors, histograms, Value Gaps, Focus, and Touch Markers |

### Per-slice evidence

For every slice, record:

- Library version
- Revelio import version
- TradingView compile result
- Chart/symbol/timeframe
- Settings used
- Screenshot before and after
- Expected behavior
- Observed behavior
- Approval or rejection

Static checks remain useful for constructor arity, delimiter structure, stale references, and parameter consistency, but they are not runtime proof.

## Risk register

| Risk | Probability | Impact | Mitigation |
|---|---:|---:|---|
| Exported `Profile` changes realtime rollback behavior | Medium | Critical | Slice 0 `varip` spike before production migration |
| Library extraction saves fewer tokens than expected | Medium | High | Compile after Slice 2; expand to anchor engine or reassess boundary |
| UDT namespace changes introduce constructor/type mistakes | Medium | High | Library factory functions, arity scans, one mechanical slice |
| Quarterly remote profile cannot cross the imported type boundary cleanly | Medium | High | Keep request wrapper in indicator; test remote constructor in Slice 1 |
| Input or style migration resets saved settings | Low | High | Keep all inputs and ordering in indicator |
| Short-session folding changes profile identity/finalization | Medium | High | Move only in Slice 3 and test every merge mode |
| Touch Marker `varip` state regresses | Medium | Critical | Realtime and Replay gate before accepting Slice 1 |
| Version mismatch leaves Revelio on an old library | Medium | Medium | Record pinned version in tracker and release checklist |
| Library publication model is unacceptable | Unknown | High | Decide ownership/privacy before implementation |
| Public/Invite-only distribution cannot access dependency | Low–medium | High | Prove the intended publication combination in Slice 0 |
| A library draws objects outside the host allocator's knowledge | Medium | High | Pass host budgets/registries or keep central allocation in host |
| Equivalent host/library requests consume separate request slots | Medium | Medium | Keep requests in the host initially |
| One-shot migration obscures the failing boundary | High | High | Parallel client and independently testable slices |

## Release and rollback model

### Development

Keep separate local files during the spike:

```text
code/development/
├── indicator/
│   ├── revelio.pine
│   └── revelio.pine
└── libraries/
    ├── revelio-core-library.pine
    └── revelio-gaps-library.pine
```

The completed spike clients were deleted after passing their historical, realtime, reload, and Range-chart gates. The existing development source remains the reference while the parallel library-backed host is tested.

### Promotion

1. Validate a library version.
2. Pin that version in the library-backed Revelio client.
3. Complete the full TradingView test card.
4. Replace the main development implementation only after approval.
5. Remove only the word ` development` from the indicator title for an explicitly authorized final commit/publish step; retain the permanent bullet so the production title ends in ` •`.

### Rollback

Rollback is an import-version change or restoration of the parallel monolith source. Do not overwrite the only known-good source during the spike.

No Git actions are part of this assessment. Branching, staging, committing, or publishing requires separate user authorization.

## Alternatives if a library is rejected

### Continue optimizing one monolithic indicator

Advantages:

- No publication dependency
- Simplest user workflow

Disadvantages:

- Repeated feature cuts
- Little long-term capacity
- Every major change risks another compiler failure

Assessment: acceptable as an emergency rescue, not recommended for a product expected to keep evolving.

### Split Revelio into companion indicators

Possible split:

- Revelio Profiles
- Revelio Context: Value Gaps, Touch Markers, or utilities

Advantages:

- Large, predictable capacity increase
- No Pine library publication/versioning

Disadvantages:

- Two chart indicators
- Duplicate settings or calculations
- Harder visual coordination
- Higher user workflow cost

Assessment: strongest fallback if library publication or source visibility is unacceptable.

### Remove features

Low-impact candidates:

- Color & Widths Reference Table
- Optional Value Gap internal reminders and labels

High-impact candidates:

- Reminder families
- Deep Focus backfill
- Value Gaps
- Per-anchor style customization

Assessment: useful for emergency headroom, but it does not solve the product's long-term architecture.

## Decisions recorded for Slices 0–5

1. TradingView owner: `midnightpaws87`.
2. Development publication: private libraries are acceptable.
3. Production distribution: the published read-only Revelio remains unchanged during migration.
4. Library visibility: keep the migration library private; decide production promotion visibility only after the validation gates pass.
5. Migration track: extract the durable `RevelioCore` profile and anchor engine.
6. TradingView workflow: Codex prepares and audits the local sources; the user performs large Pine pastes and publication steps.
7. Source isolation: preserve the manual development host and build the library-backed host in parallel.

## Closure

The selected architecture was implemented through version-pinned Core, Gaps, and Interactions libraries. The final Auto Swept design passed principal review, TradingView testing, and user acceptance. Production library lineages are published at `/1`; the remaining indicator compile and publication steps are tracked only in `REVELIO-LIBRARY-MIGRATION-TRACKER.md`.

Core v3 moves the four stable transition functions out of the host and passes current close and time explicitly. Its source split is 3,304 host lines and 695 Core-library lines. The private development library is published as `/3`. The renamed host compiled and was added to the ES1! 5-minute chart at 21:49:55 without a compiled-token or syntax error, and the user approved its behavioral comparison.

### Canonical development library naming — 2026-07-30

The local filenames and TradingView editor names now identify their role explicitly:

- `revelio-core-library.pine` → `Revelio Core Library • development`
- `revelio-gaps-library.pine` → `Revelio Gaps Library • development`

Their Pine identifiers are `RevelioCoreLibraryDevelopment` and `RevelioGapsLibraryDevelopment`. Because a Pine library title forms part of its import address, Core begins a new development lineage at `/1`; the already published `RevelioCoreDevelopment/1–3` versions are not renamed in place. The safe migration order is Core Library `/1`, Gaps Library `/1`, then the library-backed indicator. The superseded development lineage remains a rollback source until that chain passes compilation and behavioral comparison. Production `RevelioCore/4` is unaffected.

Both new development libraries were published privately at `/1`, and the 3,133-line development host compiled against them without reproducing the compiled-token error. Behavioral comparison, reload, Replay, realtime, Range-chart, and drawing-pressure gates remain open.
