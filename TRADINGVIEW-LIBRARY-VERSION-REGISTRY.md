# TradingView Library Version Registry

Updated: 2026-08-14

This is the repository's single source of truth for TradingView library versions, publication status, publication instructions, source fingerprints, and required host imports. Pine imports are executable references, but version decisions and publication history are authoritative only here. Historical trackers must link here instead of maintaining a second current-version ledger.

## Required workflow

1. Read this file before changing a library, changing an import, or telling the user to publish.
2. When a published library source changes, reserve `highest published + 1` here before changing the host import.
3. Record every publication instruction as a new row before giving it to the user, including errors or superseded instructions.
4. Record the pending source SHA-256 and run `node scripts/check-library-version-registry.mjs`.
5. Give the user the exact private library name/version, source path, host to compile, test gate, and copy-ready version notes.
6. When the user confirms publication, mark that version published here immediately. Any later source edit requires another version.
7. Published versions are forward-only. Never move an import backward; an undo or restoration of older behavior must be released as the next new version.
8. In this repository, user confirmation that a version is published also confirms that it loads and is approved unless the user explicitly reports a partial or failed state. Do not create a separate awaiting-validation status after that confirmation.

## Current canonical state

<!-- VERSION_REGISTRY_CURRENT_START -->
| Library | Source | Highest published | Pending version | Development import | Production import | Pending SHA-256 | Status |
|---|---|---:|---:|---:|---:|---|---|
| RevelioCoreLibrary | `indicators/20-revelio/code/development/libraries/revelio-core-library.pine` | 10 | — | 10 | 10 | — | `PUBLISHED_RUNTIME_PERFORMANCE_REGRESSION` |
| RevelioGapsLibrary | `indicators/20-revelio/code/development/libraries/revelio-gaps-library.pine` | 10 | — | 10 | 10 | — | `PUBLISHED_RUNTIME_PERFORMANCE_REGRESSION` |
| RevelioInteractionsLibrary | `indicators/20-revelio/code/development/libraries/revelio-interactions-library.pine` | 16 | — | 16 | 16 | — | `PUBLISHED_RUNTIME_PERFORMANCE_REGRESSION` |
| RevelioProfileOrchestrationLibrary | `indicators/20-revelio/code/development/libraries/revelio-profile-orchestration-library.pine` | 1 | — | 1 | 1 | — | `PUBLISHED_RUNTIME_PERFORMANCE_REGRESSION` |
<!-- VERSION_REGISTRY_CURRENT_END -->

Development host: `indicators/20-revelio/code/development/indicator/revelio.pine`

Current truthful status: Core `/10`, Gaps `/10`, Interactions `/16`, and Profile Orchestration `/1` are published, and the reduced Revelio host compiles and loads against that chain. Runtime testing reports a first-load performance regression versus the previous committed Revelio baseline. Composite defaults Off; Quick Filter remains the sole authority over whether a composite source can consolidate or render, while Touch Markers can intentionally inspect hidden ordinary anchors through Include All Anchors.

## External pinned dependencies

These libraries are maintained outside this repository. Their versions are pinned in the host source and do not enter the internal publication workflow above. Check the linked TradingView release pages before intentionally advancing either import, then compile and visually test the dependent host.

| Host | External library | Pinned version | TradingView release page | Last verified |
|---|---|---:|---|---|
| `indicators/23-news/code/development/news.pine` | `toodegrees/forex_factory_utility` | 17 | [forex factory utility](https://www.tradingview.com/script/DHRsmWy1-forex-factory-utility/) | 2026-08-02 |
| `indicators/23-news/code/development/news.pine` | `toodegrees/forex_factory_decoding` | 44 | [forex factory decoding](https://www.tradingview.com/script/Q78LeoTL-forex-factory-decoding/) | 2026-08-02 |

## Publication history

| Library | Version | Status | Change carried by that version | Source fingerprint |
|---|---:|---|---|---|
| RevelioCoreLibrary | 1 | Published · superseded | Initial library-backed Revelio production release | Not captured before registry creation |
| RevelioCoreLibrary | 2 | Published · production · approved | Behavior-preserving developing-profile maturity short-circuit | `2185e21f5501ba520492a707f1adad381fd62e6e6f9a06dedc77676d515a47e3` |
| RevelioCoreLibrary | 3 | Published · superseded before host compile | Earlier multi-slot Manual Composite contract | `3f6217f0019fbb245194d52e7f9cb13f5d40e7d3d7823ad1b3c66bb6942aaad1` |
| RevelioCoreLibrary | 4 | Published · superseded · runtime rejected | Single manual RTH/Globex composite accumulation, pinned retention, and composite identity transport | `7c96d881f4549993f6d0493292a11af86df62c8ed7ada530aef06edac4c362da` |
| RevelioCoreLibrary | 5 | Published · production · approved | Full selected-range histogram geometry for RTH/Globex manual composites | `e38b81f5d7a046f9b8cde8b47c293204741e74198a8127076947bbd89b3645ac` |
| RevelioCoreLibrary | 6 | Published · production · runtime defect reported | Full-range composites across all five anchors with pinned remote retention | `0c7d7d94de705215adedf8b8f9782e4f2c53a7f233228d9f2e68851240a27412` |
| RevelioCoreLibrary | 7 | Published · superseded before corrected host compile | Version-aligned Core contract preceding the corrected `/8` submission | `0c7d7d94de705215adedf8b8f9782e4f2c53a7f233228d9f2e68851240a27412` |
| RevelioCoreLibrary | 8 | Published · production · testing | Version-aligned Core contract for the corrected Manual Composite host chain | `0c7d7d94de705215adedf8b8f9782e4f2c53a7f233228d9f2e68851240a27412` |
| RevelioCoreLibrary | 9 | Published · host compile token limit | Recoverable Manual Composite consolidation constrained to actual Show Last chronology | `e3edfa118791544c61d5e7360acebba89f92b6520d2b24b28909dc3d898deda6` |
| RevelioCoreLibrary | 10 | Published · runtime performance regression | Exports the canonical profile row-count invariant for the complete Revelio chain | `ec6e2995c5dc906437dd7b5628a372745f4ed6cbe2d40dd70c1822f9b4c1c142` |
| RevelioGapsLibrary | 1 | Published · superseded | Initial library-backed Revelio production release | Not captured before registry creation |
| RevelioGapsLibrary | 2 | Published · production · approved | Core `/2` dependency alignment with unchanged Value Gap logic | `a2aa61d0246c2434c2e80563135f465baa9aa54a8f47978baa022f65fbed409e` |
| RevelioGapsLibrary | 3 | Published · superseded before host compile | Core `/3` dependency alignment for the superseded contract | `beea413d4a62daaac0d0a5eef8422c7a84069e0ffc7fac8b9912c6efb32a37c4` |
| RevelioGapsLibrary | 4 | Published · superseded · runtime rejected | Core `/4` dependency alignment for consolidated completed-profile sequences | `ac87fcbb5860ba34830ac0545880e5f744cb889ce1e448291f69bbcb81de0e29` |
| RevelioGapsLibrary | 5 | Published · production · approved | Core `/5` dependency alignment for full-range manual composites | `532dddd4972c6e451daae13113c08a553a0aaa50f15cdcef9a5cda1ff2c37c98` |
| RevelioGapsLibrary | 6 | Published · production · runtime defect reported in host chain | Core `/6` dependency alignment for all-anchor manual composites | `c73b0b2ee767dcda222f2a44222e31b0d940c4d0997a1e7b8f219ab35aa8ccf1` |
| RevelioGapsLibrary | 7 | Published · superseded before corrected host compile | Core `/7` dependency alignment preceding the corrected `/8` submission | `cd2e49ae1c11b54e9ab232fa9aa387d75e0940bca761d340fd7c6674c35b9f4f` |
| RevelioGapsLibrary | 8 | Published · production · testing | Core `/8` dependency alignment with unchanged Value Gap behavior | `c9518dd8d18f13acb9c0b9b20840e512aa35aab91f6f8ebc689214520065cf4b` |
| RevelioGapsLibrary | 9 | Published · host compile token limit | Core `/9` dependency alignment for recoverable Show Last-bounded composites | `d3c4613534c0e3b91a6804d9858e544582fc2bde96cc6cde50d80397460d9f2f` |
| RevelioGapsLibrary | 10 | Published · runtime performance regression | Core `/10` dependency alignment with unchanged Value Gap behavior | `373337c6f1a3fd90db2e909bd9dfc3ec55b1bcafa16af4c542037ef5aafb6633` |
| RevelioInteractionsLibrary | 1 | Published · superseded | Initial interaction compositor production release | Not captured before registry creation |
| RevelioInteractionsLibrary | 2 | Published · superseded | Mature appearance-input cleanup and obsolete Anchor Label contract removal | Not captured before registry creation |
| RevelioInteractionsLibrary | 3 | Published · superseded | First-hit context candidate before final principal-remediation library changes | Not captured before registry creation |
| RevelioInteractionsLibrary | 4 | Published · superseded · approved | Principal-remediated optional first-hit direction context | `01c9303c48b30d6cef6eb1671c0cb48d4c02dc2c6df400662b4da9d7e776545f` |
| RevelioInteractionsLibrary | 5 | Published · superseded · incomplete | Structured one-line right-edge label compression without mixed dated-anchor grouping | `623d47217147901d952a0e5136549dc5720355743b46da498e6bf3ff94de3433` |
| RevelioInteractionsLibrary | 6 | Published · superseded · incomplete | Mixed dated-anchor compression and its toggle for right-edge labels only | `73174ae4df0b08db9648119dff9552ae78d7fbb2ca7cd9dcfeff176819fbbe7f` |
| RevelioInteractionsLibrary | 7 | Published · superseded · not approved | Complete all-label-path compression plus expanded merge-distance controls | `aa17d7a8f2e3faf63a55e78053f7b47b029f3f9f86c02ea1ab017a44a3779929` |
| RevelioInteractionsLibrary | 8 | Published · superseded · approved | Fixed level-first merged-label hierarchy across all label paths | `1179309cbd3100b0775ce75934c6e59853fb7c76cf13e66f50c2d7e92656fae4` |
| RevelioInteractionsLibrary | 9 | Published · superseded · not approved | Initial progressive condensation-scope test control before clarified order and shortening controls | `de636833727ebfea22c998e4e225322fa0163bf993579afbf9a9eee3e55154b1` |
| RevelioInteractionsLibrary | 10 | Published · superseded · approved | Independent profile-label order and shortening controls with completed Quarterly histogram transport correction | `a2be262039f67b5635f63190c7ef298956e7967150efb8844bc882fcec212a56` |
| RevelioInteractionsLibrary | 11 | Published · superseded · rejected | Temporary right-edge labels incorrectly reused Touch Marker dot color and glyph size | `db6cbd7e1434ae940dfdc599dec00b65acbb2734641654d192773daead775d61` |
| RevelioInteractionsLibrary | 12 | Published · superseded · rejected | Native label styling with an incorrect touched-versus-ordinary merge isolation rule | `6868a36cf78ec6ef60fe9f963b497610856dbbd9577f17869e819f0f94f25e4a` |
| RevelioInteractionsLibrary | 13 | Published · superseded · approved | Original merge behavior first; winning touched anchor's native label style only after composition | `35ab0ce9451707593e63a9fcbaab01bd0fce1d9d5d9ef83dc4c06a6881f21e1b` |
| RevelioInteractionsLibrary | 14 | Published · superseded · not production-approved | Prior external publication; version confirmed occupied before the current handoff | Not captured at confirmation |
| RevelioInteractionsLibrary | 15 | Published · production · approved | One Shorten Labels contract plus redundant compositor membership-scan removal | `6bf9d3b6445066f184b96e26add7e15e83eb1f31e02a3a63ee09b17b81317a9d` |
| RevelioInteractionsLibrary | 16 | Published · runtime performance regression | Exports shared label-size, fade, reminder, label-retention, and weekday-distance helpers used by the host | `8bb1965dc6626a3bb74ccb7a1ec8fea3e7faf8a4db62c4125b97ba852dc0093d` |
| RevelioCompositeLibrary | 1 | Superseded before publication | Initial narrow name for the extracted profile-orchestration source | `65b615d84e3dbdf9d86f32868e429fad9110bb81e13aa875c47b6ec33c712d16` |
| RevelioProfileOrchestrationLibrary | 1 | Published · runtime performance regression | Extracted profile orchestration with corrected maturity typing, literal enum titles required by CE10125, one shared session/domain vocabulary, exported calendar identity, and typed Focus, merge, and developing modes | `7c74ef575dba8f92ac8b3caf57b820c94c9698381c67ba2906550be4cc4c6606` |

## Publication-instruction log

Entries before this registry was created are reconstructed from the task history. Future entries must be appended once per publication handoff before that handoff is sent.

<!-- VERSION_REGISTRY_INSTRUCTIONS_START -->
| Instruction ID | Date | Library | Version | What Codex told the user | Result |
|---|---|---|---:|---|---|
| PUB-2026-07-31-01 | 2026-07-31 | RevelioInteractionsLibrary | 2 | Publish the first-hit candidate as `/2` | `INVALID_ALREADY_USED` |
| PUB-2026-07-31-02 | 2026-07-31 | RevelioInteractionsLibrary | 3 | Publish the first-hit candidate as `/3` | `PUBLISHED_THEN_SUPERSEDED` |
| PUB-2026-08-01-01 | 2026-08-01 | RevelioInteractionsLibrary | 3 | Publish the principal-remediated source as `/3` | `INVALID_VERSION_ALREADY_PUBLISHED` |
| PUB-2026-08-01-02 | 2026-08-01 | RevelioInteractionsLibrary | 4 | Publish the principal-remediated source privately as `/4` | `PUBLISHED_APPROVED` |
| PUB-2026-08-01-03 | 2026-08-01 | RevelioInteractionsLibrary | 5 | Publish the structured one-line label compositor privately as `/5`, then compile the development Revelio host against `/5` | `PUBLISHED_CURRENT` |
| PUB-2026-08-01-04 | 2026-08-01 | RevelioInteractionsLibrary | 6 | Publish the mixed dated-anchor compression correction privately as `/6`, then compile the development Revelio host against `/6` | `PUBLISHED_INCOMPLETE` |
| PUB-2026-08-01-05 | 2026-08-01 | RevelioInteractionsLibrary | 7 | Publish the complete all-label-path compression correction privately as `/7`, then compile the development Revelio host against `/7` | `PUBLISHED_TESTING` |
| PUB-2026-08-01-06 | 2026-08-01 | RevelioInteractionsLibrary | 8 | Publish the fixed level-first merged-label compositor privately as `/8`, then compile the development Revelio host against `/8` | `PUBLISHED_APPROVED` |
| PUB-2026-08-02-01 | 2026-08-02 | RevelioInteractionsLibrary | 9 | Publish the progressive condensation-scope test compositor privately as `/9`, then compile the development Revelio host against `/9` | `PUBLISHED_TESTED_THEN_SUPERSEDED` |
| PUB-2026-08-02-02 | 2026-08-02 | RevelioInteractionsLibrary | 10 | Publish the clarified profile-label order and shortening compositor privately as `/10`, then compile the development Revelio host containing the Quarterly histogram transport correction against `/10` | `PUBLISHED_APPROVED` |
| PUB-2026-08-03-01 | 2026-08-03 | RevelioInteractionsLibrary | 11 | Publish the Touch Marker right-edge style synchronization privately as `/11`, then compile and visually test the development Revelio host against `/11` | `PUBLISHED_TESTED_REJECTED` |
| PUB-2026-08-03-02 | 2026-08-03 | RevelioInteractionsLibrary | 12 | Publish the native-level label-style correction privately as `/12`, then compile and visually compare the development Revelio host against the rejected `/11` screenshot | `PUBLISHED_TESTED_REJECTED` |
| PUB-2026-08-03-03 | 2026-08-03 | RevelioInteractionsLibrary | 13 | Publish the merge-preserving native-label-style correction privately as `/13`, then compile and compare every merge preset, Custom percentage and Merge Off against the approved pre-style behavior | `PUBLISHED_TESTED_APPROVED` |
| PUB-2026-08-03-04 | 2026-08-03 | RevelioInteractionsLibrary | 14 | Publish the single-toggle Profile First condensation refactor privately as `/14`, then compile and compare Shorten Labels On/Off across right-edge labels, active-anchor reminders and swept reminders | `SUPERSEDED_BEFORE_PUBLICATION` |
| PUB-2026-08-04-01 | 2026-08-04 | RevelioCoreLibrary | 2 | Publish the behavior-preserving maturity optimization privately as `/2` before publishing dependent libraries | `PUBLISHED_TESTED_APPROVED` |
| PUB-2026-08-04-02 | 2026-08-04 | RevelioGapsLibrary | 2 | After Core `/2` is published, publish the dependency-aligned Value Gap library privately as `/2` | `PUBLISHED_TESTED_APPROVED` |
| PUB-2026-08-04-03 | 2026-08-04 | RevelioInteractionsLibrary | 14 | Publish the refreshed Shorten Labels and compositor-performance source privately as `/14`, then compile the development host against Core `/2`, Gaps `/2`, and Interactions `/14` | `SUPERSEDED_BEFORE_PUBLICATION` |
| PUB-2026-08-04-04 | 2026-08-04 | RevelioInteractionsLibrary | 14 | Publish the unchanged pending `/14` library source, then compile the revised development host and verify explicit previous-profile wording with Shorten Labels On across right-edge labels and both reminder paths | `INVALID_VERSION_ALREADY_USED` |
| PUB-2026-08-04-05 | 2026-08-04 | RevelioInteractionsLibrary | 15 | Publish the current Shorten Labels and compositor-performance source privately as `/15`, then compile the revised development host and verify explicit previous-profile wording with Shorten Labels On across right-edge labels and both reminder paths | `PUBLISHED_TESTED_APPROVED` |
| PUB-2026-08-13-01 | 2026-08-13 | RevelioCoreLibrary | 3 | Publish the earlier Manual Composite core source privately as `/3` before publishing its dependent Gaps library | `PUBLISHED_SUPERSEDED_CONTRACT` |
| PUB-2026-08-13-02 | 2026-08-13 | RevelioGapsLibrary | 3 | After Core `/3` is published, publish the dependency-aligned Value Gaps source privately as `/3`, then compile the development Revelio host against Core `/3`, Gaps `/3`, and Interactions `/15` | `PUBLISHED_HOST_COMPILE_FAILED` |
| PUB-2026-08-13-03 | 2026-08-13 | RevelioCoreLibrary | 4 | Publish the simplified single Manual Composite core source privately as `/4` before publishing its dependent Gaps library | `PUBLISHED_RUNTIME_REJECTED` |
| PUB-2026-08-13-04 | 2026-08-13 | RevelioGapsLibrary | 4 | After Core `/4` is published, publish the dependency-aligned Value Gaps source privately as `/4`, then compile the development Revelio host against Core `/4`, Gaps `/4`, and Interactions `/15` | `PUBLISHED_RUNTIME_REJECTED` |
| PUB-2026-08-13-05 | 2026-08-13 | RevelioCoreLibrary | 5 | Publish the full-range Manual Composite core source privately as `/5` before publishing its dependent Gaps library | `PUBLISHED_APPROVED` |
| PUB-2026-08-13-06 | 2026-08-13 | RevelioGapsLibrary | 5 | After Core `/5` is published, publish the dependency-aligned Value Gaps source privately as `/5`, then compile the development Revelio host against Core `/5`, Gaps `/5`, and Interactions `/15` | `PUBLISHED_APPROVED` |
| PUB-2026-08-13-07 | 2026-08-13 | RevelioCoreLibrary | 6 | Publish the all-anchor Manual Composite core source privately as `/6` before publishing its dependent Gaps library | `PUBLISHED_RUNTIME_DEFECT_REPORTED` |
| PUB-2026-08-13-08 | 2026-08-13 | RevelioGapsLibrary | 6 | After Core `/6` is published, publish the dependency-aligned Value Gaps source privately as `/6`, then compile the development Revelio host against Core `/6`, Gaps `/6`, and Interactions `/15` | `PUBLISHED_RUNTIME_DEFECT_REPORTED` |
| PUB-2026-08-13-09 | 2026-08-13 | RevelioCoreLibrary | 7 | Publish the composite-only visibility and Auto Swept correction privately as `/7` before publishing its dependent Gaps library | `SUPERSEDED_BEFORE_PUBLICATION` |
| PUB-2026-08-13-10 | 2026-08-13 | RevelioGapsLibrary | 7 | After Core `/7` is published, publish the dependency-aligned Value Gaps source privately as `/7`, then compile the development Revelio host against Core `/7`, Gaps `/7`, and Interactions `/15` | `SUPERSEDED_BEFORE_PUBLICATION` |
| PUB-2026-08-13-11 | 2026-08-13 | RevelioCoreLibrary | 7 | Publish the version-aligned Manual Composite Core source privately as `/7` before publishing its dependent Gaps library | `PUBLISHED_SUPERSEDED_BEFORE_HOST_COMPILE` |
| PUB-2026-08-13-12 | 2026-08-13 | RevelioGapsLibrary | 7 | After Core `/7` is published, publish the dependency-aligned Value Gaps source privately as `/7`, then compile the corrected development host against Core `/7`, Gaps `/7`, and Interactions `/15` | `PUBLISHED_SUPERSEDED_BEFORE_HOST_COMPILE` |
| PUB-2026-08-13-13 | 2026-08-13 | RevelioCoreLibrary | 8 | Publish the corrected Manual Composite Core source privately as `/8` before publishing its dependent Gaps library | `PUBLISHED_TESTING` |
| PUB-2026-08-13-14 | 2026-08-13 | RevelioGapsLibrary | 8 | After Core `/8` is published, publish the dependency-aligned Value Gaps source privately as `/8`, then compile the corrected development host against Core `/8`, Gaps `/8`, and Interactions `/15` | `PUBLISHED_TESTING` |
| PUB-2026-08-13-15 | 2026-08-13 | RevelioCoreLibrary | 9 | Publish the recoverable Show Last-bounded Manual Composite Core source privately as `/9` before publishing its dependent Gaps library | `PUBLISHED_HOST_TOKEN_LIMIT` |
| PUB-2026-08-13-16 | 2026-08-13 | RevelioGapsLibrary | 9 | After Core `/9` is published, publish the dependency-aligned Value Gaps source privately as `/9`, then compile the development Revelio host against Core `/9`, Gaps `/9`, and Interactions `/15` | `PUBLISHED_HOST_TOKEN_LIMIT` |
| PUB-2026-08-14-01 | 2026-08-14 | RevelioCompositeLibrary | 1 | Publish the initial extracted Revelio profile-orchestration source privately as `/1`, then compile the development Revelio host against Composite `/1`, Core `/9`, Gaps `/9`, and Interactions `/15` | `DRAFT_SUPERSEDED_BEFORE_HANDOFF` |
| PUB-2026-08-14-02 | 2026-08-14 | RevelioCompositeLibrary | 1 | Publish the consolidated Revelio profile-orchestration source privately as `/1`, then compile the development Revelio host against Composite `/1`, Core `/9`, Gaps `/9`, and Interactions `/15` | `RENAMED_BEFORE_PUBLICATION` |
| PUB-2026-08-14-03 | 2026-08-14 | RevelioProfileOrchestrationLibrary | 1 | Publish the accurately named Revelio profile-orchestration source privately as `/1`, then compile the development Revelio host against Profile Orchestration `/1`, Core `/9`, Gaps `/9`, and Interactions `/15` | `LIBRARY_COMPILE_FAILED_CE10123` |
| PUB-2026-08-14-04 | 2026-08-14 | RevelioProfileOrchestrationLibrary | 1 | Publish the CE10123-corrected profile-orchestration source privately as `/1`, then compile the development Revelio host against Profile Orchestration `/1`, Core `/9`, Gaps `/9`, and Interactions `/15` | `SUPERSEDED_BEFORE_PUBLICATION` |
| PUB-2026-08-14-05 | 2026-08-14 | RevelioCoreLibrary | 10 | Publish the shared profile-row invariant Core source privately as `/10` before publishing its dependent libraries | `PUBLISHED_RUNTIME_PERFORMANCE_REGRESSION` |
| PUB-2026-08-14-06 | 2026-08-14 | RevelioGapsLibrary | 10 | After Core `/10` is published, publish the dependency-aligned Value Gaps source privately as `/10` | `PUBLISHED_RUNTIME_PERFORMANCE_REGRESSION` |
| PUB-2026-08-14-07 | 2026-08-14 | RevelioProfileOrchestrationLibrary | 1 | After Core `/10` is published, publish the domain-deduplicated profile-orchestration source privately as `/1`, then compile the development host against Core `/10`, Gaps `/10`, Interactions `/15`, and Profile Orchestration `/1` | `SUPERSEDED_BEFORE_PUBLICATION` |
| PUB-2026-08-14-08 | 2026-08-14 | RevelioProfileOrchestrationLibrary | 1 | After Core `/10` is published, publish the fully centralized session-spec and domain-vocabulary profile-orchestration source privately as `/1`, then compile the development host against Core `/10`, Gaps `/10`, Interactions `/15`, and Profile Orchestration `/1` | `SUPERSEDED_BEFORE_PUBLICATION` |
| PUB-2026-08-14-09 | 2026-08-14 | RevelioProfileOrchestrationLibrary | 1 | After Core `/10` is published, publish the centralized session/time-domain profile-orchestration source privately as `/1`, then compile the development host against Core `/10`, Gaps `/10`, Interactions `/15`, and Profile Orchestration `/1` | `SUPERSEDED_BEFORE_PUBLICATION` |
| PUB-2026-08-14-10 | 2026-08-14 | RevelioProfileOrchestrationLibrary | 1 | After Core `/10` is published, publish the calendar-deduplicated profile-orchestration source privately as `/1` | `SUPERSEDED_BEFORE_PUBLICATION` |
| PUB-2026-08-14-11 | 2026-08-14 | RevelioInteractionsLibrary | 16 | Publish the shared-presentation-helper Interactions source privately as `/16`, then compile the development host against Core `/10`, Gaps `/10`, Interactions `/16`, and Profile Orchestration `/1` | `PUBLISHED_RUNTIME_PERFORMANCE_REGRESSION` |
| PUB-2026-08-14-12 | 2026-08-14 | RevelioProfileOrchestrationLibrary | 1 | After Core `/10` is published, publish the final domain-deduplicated profile-orchestration source privately as `/1` | `LIBRARY_COMPILE_FAILED_CE10125` |
| PUB-2026-08-14-13 | 2026-08-14 | RevelioProfileOrchestrationLibrary | 1 | After Core `/10` is published, publish the CE10125-corrected literal-enum-title profile-orchestration source privately as `/1` | `PUBLISHED_RUNTIME_PERFORMANCE_REGRESSION` |
<!-- VERSION_REGISTRY_INSTRUCTIONS_END -->

## Current production status

Canonical library sources: `indicators/20-revelio/code/development/libraries/revelio-core-library.pine`, `indicators/20-revelio/code/development/libraries/revelio-gaps-library.pine`, `indicators/20-revelio/code/development/libraries/revelio-interactions-library.pine`, and `indicators/20-revelio/code/development/libraries/revelio-profile-orchestration-library.pine`.

Highest published private libraries: `midnightpaws87/RevelioCoreLibrary/10`, `midnightpaws87/RevelioGapsLibrary/10`, `midnightpaws87/RevelioInteractionsLibrary/16`, and `midnightpaws87/RevelioProfileOrchestrationLibrary/1`.

Production Revelio host imports: Core `/10`, Gaps `/10`, Interactions `/16`, and Profile Orchestration `/1`.

Development Revelio host imports: Core `/10`, Gaps `/10`, Interactions `/16`, and Profile Orchestration `/1`.

Validation: Core `/10`, Gaps `/10`, Interactions `/16`, and Profile Orchestration `/1` are user-confirmed published; the host compiles and loads against that chain. Runtime testing reports slower first load than the previous committed Revelio baseline. Replay, visual regression, and TradingView Profiler comparisons remain pending.

## Published `/5` validation status

Published private library: `midnightpaws87/RevelioInteractionsLibrary/5`

Interactions `/5` provides the initial one-line right-edge label compression. TradingView validation confirmed that same-profile and same-level grouping works through the new compositor, but dated members whose levels and dates both differ do not remove their repeated anchor. `/6` corrects that incomplete case without moving backward.

### Copy-ready `/5` version notes

```text
Compresses merged right-edge profile labels onto one line without replacing identities with counts. Independent profile groups retain the pipe separator, repeated levels or periods share one heading, and swept, Auto, archived and unselected symbols remain attached to their own members. Existing merge distance, identity priority, carrier color, label size, Touch Marker prefix and optional price behavior are preserved.
```

## Published `/6` status

Interactions `/6` extends the one-line grammar to dated right-edge members that share an anchor while carrying different levels and dates. Its `Condense Merged Labels` toggle does not reach active-anchor or swept reminder compositors, so those labels still show the original repeated identities.

### Copy-ready `/6` version notes

```text
Extends merged right-edge profile labels so a repeated dated anchor is shown once even when its members use different levels and dates. Mixed RTH and Globex groups remain separated by a pipe, while entries such as Globex POC Jul 27 and Globex VAL Jul 26 become Globex: POC Jul 27, VAL Jul 26. Condense Merged Labels controls this right-edge grammar; active-anchor and swept reminder labels remain uncondensed in this version.
```

## Published `/7` testing status

Interactions `/7` gives right-edge labels, active-anchor reminders, and swept reminders the same structured identity composer. `Condense Merged Labels` controls all three paths; turning it off restores the full identities on all three. The merge dropdown adds `Extra Wide` at `0.050%`, while Custom accepts values through `0.5%`. Publication is complete and visual testing is in progress.

### Copy-ready `/7` version notes

```text
Completes compact merged-label formatting across right-edge labels, active-anchor reminders and swept reminders. Condense Merged Labels now controls the same structured one-line grammar everywhere; turning it off restores every full identity separated by a pipe. Adds an Extra Wide merge-distance preset at 0.050% and raises the Custom maximum to 0.5%. Existing brackets, capitalization, per-member symbols, carrier styling, label size, optional price and merge-off behavior are preserved.
```

## Published `/8` status

Interactions `/8` replaces adaptive shortest-string grouping with one fixed level-first hierarchy across right-edge labels, active-anchor reminders and swept reminders. Dated contributors are regrouped across the complete cluster only when both level and anchor match. Pipes start new groups, commas continue periods, and live or bracketed previous identities remain complete single contributors. `Condense Merged Labels` gates the feature. The published host compiled and the user approved the visible result.

### Copy-ready `/8` version notes

```text
Replaces adaptive merged-label formatting with a consistent level-first hierarchy across right-edge labels and reminders. POC, aPOC, VAH or VAL always leads each group; pipes separate different level/profile groups, while commas join periods only when both level and profile match. Touch Marker and First Hit prefixes, brackets, per-member status symbols, shared price, carrier styling, merge distances and condensation-off behavior are preserved.
```

## Published `/9` status

Interactions `/9` introduced the first progressive condensation-scope test control. It was published and compiled, and the user's test exposed that its control name and combined modes did not clearly describe the actual profile-label scope. Those revisions were carried forward and approved in `/10`.

### Copy-ready `/9` version notes

```text
Adds progressive merged-label condensation scopes while retaining the approved Standard format as the default. Dated shortens completed profiles with R, G and W tokens plus natural Monthly and Quarterly periods; Dated + Previous also shortens previous identities; All Profiles also shortens live identities. Compact modes retain swept and Auto status on-chart while keeping Touch Marker source provenance in hover. Off, First Hit, shared price, carrier styling, merge distances and all reminder paths remain supported.
```

## Published `/10` status

Interactions `/10` separates profile-label order from shortening scope. `Profile Label Order` offers `Profile First` and `Level First`; `Shorten` offers `None`, `Dated Profiles`, `Dated + Previous`, and `All Profiles`. The approved `/8` output remains the default through `Level First` plus `None`. Shortened identities consistently use `R`, `G`, `W`, `M`, and `Q`, while the order choice independently controls whether the profile or level leads. The same settings are used by right-edge labels, active-anchor reminders, and swept reminders. Touch Marker provenance stays at the rear of affected shortened identities and remains explained in hover; Value Gap labels are outside the profile-label controls. The companion host exposes completed Quarterly histogram rows throughout the bounded completion day so intraday higher-timeframe bars can receive them without an additional request or repeated host copy. Final principal source review found no P0–P3 issue, and the user approved the published build after TradingView testing.

### Copy-ready `/10` version notes

```text
Separates Profile Label Order from profile-name shortening while retaining the approved Level First plus None combination as the default. Profile First and Level First can be tested independently with None, Dated Profiles, Dated + Previous, or All Profiles. Shortened identities consistently use R, G, W, M and Q; swept and Auto status remain attached, while Touch Marker source provenance stays at the rear of affected identities and in hover. First Hit, shared price, carrier styling, merge distances and all reminder paths remain supported.
```

## Published `/11` rejected status

Interactions `/11` gave each temporarily touched right-edge label the same dot color and glyph size as its corresponding Touch Marker group. TradingView compilation succeeded, but visual testing showed that the label text became much larger than the anchor's native level label and used the dot palette rather than the native label palette. The user rejected this presentation. The screenshot also confirmed `⁺` off-filter identities from the companion host's enabled Include All Anchors default; those are temporary Touch Marker labels rather than native level-line mutations.

### Copy-ready `/11` version notes

```text
Synchronizes temporary Touch Marker labels in the right column with their corresponding marker dots by applying the dominant marker's dot color and glyph size to the merged label. This published version was rejected after visual testing because those properties do not match the anchor's native level-label styling.
```

## Published `/12` rejected status

Interactions `/12` keeps the dominant Touch Marker anchor selection and gives the temporary right-edge label that anchor's native `labelColor` and `labelSize`. It also introduced a touched-versus-ordinary cluster boundary. TradingView comparison showed that this boundary prevented labels from merging under the same configured percentage, so the user rejected `/12`.

The principal review found no P0–P3 issue only because it was given the incorrect isolation criterion. It did not establish merge parity and is superseded by the `/13` review requirement.

### Copy-ready `/12` version notes

```text
Corrects temporary Touch Marker labels so the dominant anchor supplies its native level-label color and text size rather than the marker dot's color and glyph size. Quarterly, Monthly, Weekly, then RTH or Globex still determines the winning anchor, but the right-column text now looks exactly as that anchor's native level label would. Touched groups are isolated from unrelated nearby labels and line-carrier fading, while ordinary labels retain their existing merge behavior. The override remains limited to the active detection window; marker dots, history, reminders and native level-line properties are unchanged. The companion host defaults Include All Anchors on, Profile Label Order to Profile First, and Shorten to All Profiles.
```

## Published `/13` approved status

Interactions `/13` removes the new touched-versus-ordinary cluster boundary and restores the approved `/10` merger's control flow. Every label again uses the pre-existing Touch Marker group mapping and then the same `nearestLabelCluster()` fallback driven by Merge Off or the selected preset/Custom percentage. This deliberately retains `/10` behavior, including its same-marker-group colocation when Merge Off is selected; `/13` introduces no new cluster-membership rule. Existing carrier selection and secondary-line fading operate on that unchanged cluster. Only after the merged text and carrier are determined does an active Touch Marker winner replace the final label's text color and text size with its native `labelColor` and `labelSize`. Marker dots continue to use `lineColor` and `circleSize`. The publication-time host defaulted Include All Anchors on, Profile Label Order to Profile First, and Shorten to All Profiles; the current host-only follow-up replaces the two format dropdowns with one enabled `Shorten Labels` toggle while fixing Profile First ordering.

Final principal review compared `/13` directly with approved commit `980f0c64` and found no P0–P3 issue: cluster membership, composition, carrier selection, carrier price and line fading are unchanged, while the new native text style assignment occurs only after composition.

### Copy-ready `/13` version notes

```text
Restores the approved `/10` profile-label merger before applying Touch Marker presentation. The pre-existing Touch Marker group mapping, Merge Off behavior, every merge preset and every Custom percentage determine clusters exactly as they did before the style feature; no touched-versus-ordinary boundary is added. Existing carrier selection and secondary-line fading are preserved. After composition, an active touched cluster uses the highest anchor's native level-label color and text size. Marker dots, history, prices, reminders and native line properties are unchanged. The publication-time companion host defaulted Include All Anchors on, Profile Label Order to Profile First, and Shorten to All Profiles; a later host-only follow-up collapses the two format controls into one enabled `Shorten Labels` toggle with fixed Profile First ordering.
```

### Copy-ready `/4` version notes

```text
Adds optional Touch Marker first-hit context for the selected session window. The first right-edge cluster can show ① with its above/below direction, while the marker tooltip identifies FIRST, approach direction and NY hit time. Existing Touch Marker labels and tooltip behavior remain unchanged when First Hit is disabled. Includes the final reviewed timing and live-Focus retention corrections required by revelio • development importing RevelioInteractionsLibrary/4.
```

## Published Core `/2` status

Core `/2` preserves the existing maturity result while skipping early-volume calculations unless Current is `Auto`, normal session maturity has not yet been reached, and the caller is evaluating the last bar. The host separately advances Weekly, Monthly, and Quarterly maturity state only while that visible anchor uses `Auto`. Current `On` and `Off`, all maturity thresholds, stability rules, completed profiles, and developing-profile values remain unchanged.

### Copy-ready `/2` version notes

```text
Reduces developing-profile maturity work without changing when Weekly, Monthly, or Quarterly current profiles appear. Early-volume maturity is evaluated only while Auto still needs it; Current On, Current Off, maturity thresholds, profile values, completed history, and drawings remain unchanged.
```

## Published Gaps `/2` status

Gaps `/2` advances only its private Core dependency to `/2` so the development host uses one compatible `Profile` type throughout the Core and Value Gap chain. Detection, retention, traversal fill, selection, geometry, labels, and every Value Gap input remain unchanged.

### Copy-ready `/2` version notes

```text
Aligns the Value Gap library with Revelio Core `/2`. Value Gap detection, fills, history, floating selection, geometry, labels, settings, and visible behavior are unchanged.
```

The initial host-only Shorten Labels toggle candidate was superseded before runtime validation because it still carried removed formatting modes through the library API. The `/14` version slot is already occupied; `/15` carries the complete library refactor and the behavior-preserving compositor scan removal.

## Published `/15` status

Interactions `/15` removes the obsolete Level First renderer, per-profile shortening scope selector, legacy formatting branches, and four-boolean compositor signatures. `composedClusterIdentities()` now accepts only `shortenLabels`: Off returns ordered full Profile First identities, while On uses the single shortened Profile First grammar. The companion host keeps dated and live profile shortening while supplying explicit previous prefixes: `[PREV RTH]`, `[PREV GLOBEX]`, `[LAST WEEK]`, `[LAST MONTH]`, and `[LAST QUARTER]`. Right-edge labels, active-anchor reminders and swept reminders each pass the same structured identity through their simplified exported APIs. The right-edge compositor also removes its redundant `drawnLines` argument and linear membership lookup: every non-`na` active carrier line is already retained by the host constructor contract. Merge membership, carrier selection, line fading, Touch Marker presentation, prices, reminders and drawing budgets are unchanged.

The library source passes local static and call-arity checks. Final principal implementation review confirmed the retained-line constructor invariant and found no P0–P3 source issue before the latest host-only revisions. The revised host passes static, title, exact-prefix, and shared-compositor-path checks and is user-confirmed loaded and approved in TradingView.

### Copy-ready `/15` version notes

```text
Replaces the separate Profile Label Order and Shorten dropdowns with one enabled-by-default Shorten Labels toggle. Profile First is now the sole label order. On keeps dated and live names compact while previous profiles remain explicit as PREV RTH, PREV GLOBEX, LAST WEEK, LAST MONTH and LAST QUARTER; Off keeps the full Profile First identities. The same setting applies to right-edge labels, active-anchor reminders and swept reminders. Removes a redundant carrier-line membership scan while preserving the same carrier fading. Existing merge distances, Touch Marker styling, prices, provenance symbols and drawing behavior are unchanged.
```

## Published Core `/4` rejected status

Core `/4` replaced the superseded multi-slot `/3` contract with one host-configured manual composite range for completed RTH or Globex sessions. The development host loaded it, but runtime testing rejected the composite presentation because its histogram width remained limited to the longest constituent session.

### Core Copy-ready `/4` version notes

```text
Adds one manual RTH or Globex composite profile built from the original raw session samples. Inclusive selected sessions, including holiday or shortened sessions, consolidate into one recalculated distribution after the final session closes. Constituents never enter level, Touch Marker, Auto Swept or Value Gap lifecycles. Incomplete history is rejected, and the completed composite retains its identity and drawing priority.
```

## Published Gaps `/4` rejected status

Gaps `/4` changed only its Core dependency from `/3` to `/4`. Its gap calculations were unchanged, but the dependency chain was superseded with the rejected Core `/4` presentation.

### Gaps Copy-ready `/4` version notes

```text
Aligns Value Gaps with Revelio Core /4 so confirmed gaps are derived from the consolidated completed-profile sequence after the manual composite dissolves its constituent sessions. Gap detection, minimum-size filtering, traversal fills, retention and presentation are unchanged.
```

## Published Core `/5` status

Core `/5` preserves the single-composite state machine while allowing a manual composite histogram to use the entire selected start-to-end duration. The host also retains the original click guides, draws separate resolved session boundaries, and removes the constituent session presentation inside the selected range. Sweep tracking begins from the recalculated composite levels and applies the same 5% composite-range margin used by ordinary completed profiles and the Auto Swept archive.

### Core Copy-ready `/5` version notes

```text
Expands each manual composite histogram across the complete selected session range while preserving one recalculated POC, VAH, VAL and volume distribution. The original From and Through positions remain visible for editing, and separate resolved boundaries identify the exact sessions included. Constituent session profiles stay dissolved inside the composite, while sweep confirmation uses the same 5% recalculated profile-range margin as standard completed profiles.
```

## Published Gaps `/5` status

Gaps `/5` changes only its Core dependency from `/4` to `/5`. Value Gap detection and presentation remain unchanged.

### Gaps Copy-ready `/5` version notes

```text
Aligns Value Gaps with Revelio Core /5 so the library shares the full-range Manual Composite profile contract. Gap detection, minimum-size filtering, traversal fills, retention and presentation are unchanged.
```

## Published Core `/6` status

Core `/6` retains full selected-range histogram geometry and pins remotely transported Quarterly composites under the same retention policy as local anchors. The host expands the one-at-a-time Manual Composite source to RTH, Globex, Weekly, Monthly, or Quarterly. Runtime testing found that selecting a source excluded by Quick Filter can still consolidate that hidden source.

### Core Copy-ready `/6` version notes

```text
Expands the single Manual Composite to RTH, Globex, Weekly, Monthly and Quarterly with one recalculated histogram, POC, aPOC, VAH and VAL using the selected anchor's boundaries.
```

## Published Gaps `/6` status

Gaps `/6` changes only its Core dependency from `/5` to `/6`; Value Gap sources remain RTH and Globex, and their calculations are unchanged.

### Gaps Copy-ready `/6` version notes

```text
Aligns Value Gaps with Revelio Core /6 while preserving the existing RTH and Globex Value Gap sources. Gap detection, minimum-size filtering, traversal fills, retention and presentation are unchanged.
```

## Published Core `/8` testing status

Core `/8` is published. Its profile contract remains equivalent to `/7`; the host correction makes Quick Filter authoritative over whether a Manual Composite source can consolidate or render. Runtime testing is in progress.

### Core Copy-ready `/8` version notes

```text
Maintains the all-anchor Manual Composite profile contract for the corrected Revelio host. The host now prevents a source excluded by Quick Filter from being consolidated or rendered, while Touch Markers can still inspect hidden ordinary anchors through Include All Anchors.
```

## Published Gaps `/8` testing status

Gaps `/8` is published and imports Core `/8`. This advances only the Core dependency; Value Gap behavior remains unchanged. Runtime testing is in progress.

### Gaps Copy-ready `/8` version notes

```text
Aligns Value Gaps with Revelio Core /8 while preserving the existing RTH and Globex Value Gap behavior.
```

## Published Core `/9` status

Core `/9` is published. The dependent host did not compile because it exceeded TradingView's compiled-token limit, so runtime validation of this chain remains blocked until Composite `/1` is published and the reduced host is compiled.

### Core Copy-ready `/9` version notes

```text
Constrains Manual Composite activation to the selected anchor's actual Show Last profile chronology, including holidays and configured short-session folding. Keeps a bounded ordinary-profile recovery sequence while a composite is active so an unfinished or completed composite that leaves Show Last restores the same ordinary profiles instead of leaving holes. Preserves composite histogram, value-area, sweep-margin, developing-profile and all-anchor behavior while adding recovery-level lifecycle synchronization.
```

## Published Gaps `/9` status

Gaps `/9` is published and imports Core `/9`. The dependent host did not compile because it exceeded TradingView's compiled-token limit, so runtime validation remains blocked until Composite `/1` is published and the reduced host is compiled.

### Gaps Copy-ready `/9` version notes

```text
Aligns Value Gaps with Revelio Core /9 while preserving the existing RTH and Globex Value Gap calculations and presentation.
```

## Published Core `/10`, Gaps `/10`, Interactions `/16`, and Profile Orchestration `/1` handoff

Core `/10`, Gaps `/10`, Interactions `/16`, and Profile Orchestration `/1` are published. The Revelio host compiles and loads against this chain; the reported first-load regression is the baseline for the next performance remediation.

### Core Copy-ready `/10` version notes

```text
Exports Revelio's canonical profile row-count invariant so the host and every dependent library use one definition without changing profile calculations.
```

### Gaps Copy-ready `/10` version notes

```text
Aligns Value Gaps with Revelio Core /10 while preserving existing RTH and Globex Value Gap calculations and presentation.
```

### Interactions Copy-ready `/16` version notes

```text
Exports Revelio's shared presentation primitives for label sizing, fading, reminder placement, bounded label retention, and weekday-distance calculation so the host and interaction compositor use one implementation without changing visual behavior.
```

### Profile Orchestration Copy-ready `/1` version notes

```text
Extracts Revelio's Manual Composite and related profile orchestration from the indicator host to restore compiled-token headroom. Centralizes session, timezone, anchor, period and option vocabulary, and exposes typed Focus Direction, short-session merge and developing-profile modes. Session-boundary resolution, exact Show Last chronology, developing and confirmed composites, maturity, Quarterly remote processing, Focus ranking, calendar labels and price-window sampling retain their existing behavior.
```

## Next version rule

Core `/10`, Gaps `/10`, Interactions `/16`, and Profile Orchestration `/1` are the highest published chain. Any later source edit requires Core `/11`, Gaps `/11`, Interactions `/17`, or Profile Orchestration `/2` as applicable. Never move an import backward to an earlier published version.
