# TradingView Library Version Registry

Updated: 2026-09-02

This is the repository's single source of truth for TradingView library versions and publication history. The compact current-state table is authoritative; the host import and pending source fingerprint are verified from it rather than duplicated in extra columns.

## Required workflow

1. Read this file before changing a library, changing an import, or telling the user to publish.
2. When a published library source changes, reserve the highest recorded version plus one here before changing the host import. Published, pending, and discarded versions are never reused.
3. Record every publication instruction as a new row before giving it to the user, including errors or superseded instructions.
4. Record the pending source SHA-256 in Publication history and run `node scripts/check-library-version-registry.mjs`.
5. Give the user the exact private library name/version, source path, host to compile, test gate, and copy-ready version notes.
6. When the user confirms publication, mark that version published here immediately. Any later source edit requires another version.
7. Published versions are forward-only. Never move an import backward; an undo or restoration of older behavior must be released as the next new version.
8. User feedback about a version's runtime or visual behavior confirms that version was published, loaded, and tested. Record whether the feedback approved or rejected it. If the feedback does not identify the tested version clearly enough, ask before changing publication state or reserving the next version.

## Current canonical state

<!-- VERSION_REGISTRY_CURRENT_START -->
| Library | Source | Host | Published | Pending |
|---|---|---|---:|---:|
| RevelioCoreLibrary | `indicators/20-revelio/code/libraries/revelio-core-library.pine` | `indicators/20-revelio/code/indicator/revelio.pine` | 10 | — |
| RevelioGapsLibrary | `indicators/20-revelio/code/libraries/revelio-gaps-library.pine` | `indicators/20-revelio/code/indicator/revelio.pine` | 11 | — |
| RevelioInteractionsLibrary | `indicators/20-revelio/code/libraries/revelio-interactions-library.pine` | `indicators/20-revelio/code/indicator/revelio.pine` | 21 | — |
| RevelioProfileOrchestrationLibrary | `indicators/20-revelio/code/libraries/revelio-profile-orchestration-library.pine` | `indicators/20-revelio/code/indicator/revelio.pine` | 8 | — |
| LegilimensProfileLibrary | `indicators/21-legilimens/code/libraries/legilimens-profile-library.pine` | `indicators/21-legilimens/code/legilimens.pine` | 4 | — |
| LegilimensProfileOrchestrationLibrary | `indicators/21-legilimens/code/libraries/legilimens-profile-orchestration-library.pine` | `indicators/21-legilimens/code/legilimens.pine` | 2 | — |
<!-- VERSION_REGISTRY_CURRENT_END -->

Development hosts are recorded per library in the current-state table.

Development import rule: import `Pending` when present; otherwise import `Published`.

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
| RevelioGapsLibrary | 11 | Published · host loaded · testing | Removes filled Value Gaps from the per-bar fill scan while preserving retained historical records | `0f8344c9837dea494c4fa4f83773a376760e3920ce59b3b24394dbcc07c4e524` |
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
| RevelioInteractionsLibrary | 17 | Published · host loaded · visual density rejected | Scales active-anchor and swept reminder density logarithmically across actual chart bars without viewport-triggered recalculation | `9ac3cc723167ed554e4f6baf9c76601fce987b2a941d1c7351fe7748da38644e` |
| RevelioInteractionsLibrary | 18 | Published · host loaded · visual density rejected | Staggers reminders within separate adaptive cells to break mechanical columns while preserving bounded chart-bar density and coverage | `7bdb2fa9f1cb8576fcfbe0971d7d5f6cab29070566790b48f1c054d6bef23ba0` |
| RevelioInteractionsLibrary | 19 | Published · superseded | Restores the committed timestamp-based reminder density and level-specific placement after the rejected chart-bar redesign | `8bb1965dc6626a3bb74ccb7a1ec8fea3e7faf8a4db62c4125b97ba852dc0093d` |
| RevelioInteractionsLibrary | 20 | Discarded before publication | Carrier-interval-safe merged-reminder correction reverted; version permanently retired | `a4e7b662cce29b703496457e0e4f986bea607092b2f9641bdcf88e52ba8c74fa` |
| RevelioInteractionsLibrary | 21 | Published · tested · approved | Orders merged label text by semantic rank before visual width while preserving width-based carrier styling and fading | `60651b357d223963bcf23d48c231aa2adf6ef345860f98c0e2093265178a6402` |
| RevelioCompositeLibrary | 1 | Superseded before publication | Initial narrow name for the extracted profile-orchestration source | `65b615d84e3dbdf9d86f32868e429fad9110bb81e13aa875c47b6ec33c712d16` |
| RevelioProfileOrchestrationLibrary | 1 | Published · runtime performance regression | Extracted profile orchestration with corrected maturity typing, literal enum titles required by CE10125, one shared session/domain vocabulary, exported calendar identity, and typed Focus, merge, and developing modes | `7c74ef575dba8f92ac8b3caf57b820c94c9698381c67ba2906550be4cc4c6606` |
| RevelioProfileOrchestrationLibrary | 2 | Published · host loaded · testing | Event-gates calendar maturity work and removes unused Quarterly transport fields | `a5849c1df3efbec7c32045bbae8890a77d7597709bc49d7ce207e21713f54786` |
| RevelioProfileOrchestrationLibrary | 3 | Published · superseded | Adds latched RTH and Globex volume maturity from eligible full-session history and removes the obsolete RTH cutoff-style helper | `0d35808f51caa4085f105a2a2fc00db1508bd6f8d08fc4a0e133f55c9b6b2a7f` |
| RevelioProfileOrchestrationLibrary | 4 | Published · superseded | Adds one shared Standard / Conservative / Strict threshold preset for RTH and Globex Auto maturity | `a6154f6284e3514078ca8c0adaffe4d5dae8676fbd141d978f49d515da3aeaec` |
| RevelioProfileOrchestrationLibrary | 5 | Published · tested · approved | Fixes RTH and Globex Auto maturity at the strict 65% threshold and removes the preset selector contract | `2355df08eae115d857b80ccca0fa0737397ed0a5a2a2a50ba8f96a3ae1aa935a` |
| RevelioProfileOrchestrationLibrary | 6 | Published · host loaded · runtime issues reported | Builds Weekly, Monthly, and Quarterly profiles from RTH-only samples when RTH Data Only is enabled | `0b2ad8c4ed01020425cd9aac91b85ac1372e3a6ac6b56c080bcca16e86d063ff` |
| RevelioProfileOrchestrationLibrary | 7 | Published · superseded · principal review rejected Quarterly eligibility | Preserves RTH-only calendar profiles and aligns Manual Composite eligibility with post-composite retention, merge resets, and source coverage | `8722770985e7818f729c9ee31e960f6dc921b4e8c47f678b8a724ba6c1abadf1` |
| RevelioProfileOrchestrationLibrary | 8 | Published · tested · approved | Validates Quarterly Manual Composite eligibility inside its deep remote history instead of requiring the selected boundary in host-chart history | `14283772373ecb96390d3f1f0f964f6ec813a3b0542d38fafe7863c22ee1609d` |
| LegilimensProfileLibrary | 1 | Published · host compile return-type defect | Extracts profile sample storage, histogram construction, and value-area calculations from the Legilimens host | `a3d05564b9ce62240a4ce15e0f2022e2fd24e9b896d5076553b4ab9af58739da` |
| LegilimensProfileLibrary | 2 | Published · tested · approved | Restores void return contracts for mutation helpers used inside host control-flow branches | `d65e604bcc817f621311729db8f733437e7d86199f1cc16c5287eaa4630241c3` |
| LegilimensProfileLibrary | 3 | Published · tested · approved | Extracts rolling sample storage, compaction, pruning, window selection, and profile calculation while preserving host lifecycle and presentation ownership | `5e3cd93d7621d8e793d546f6d13fbd0863a2e90c43bb2dfec973dca403bff227` |
| LegilimensProfileLibrary | 4 | Published · tested · approved | Extracts pure row-strength, LVN/cliff, outlier peak, clustering, ranking, and selected-row-mask analytics | `d0fb6868335b8322a436443ee5ec76bba66688b4b5d240be0099e868702f1239` |
| LegilimensProfileOrchestrationLibrary | 1 | Published · host compile missing function reference | Extracts anchor state, boundary calculations, profile retention, and selection lifecycle into compact orchestration types | `6580a8976ad93eb9c5d5531a8b92522de4277b9c6ef99092cfb8e0e0ee76b37b` |
| LegilimensProfileOrchestrationLibrary | 2 | Published · host compiled · runtime validation pending | Exports the NY cutoff boundary used by the reorganized host | `560b8ae0a37c38f15eb033ccef2eb7a6926cb55c52b5d85c47493158ad32b68e` |

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
| PUB-2026-08-14-14 | 2026-08-14 | RevelioProfileOrchestrationLibrary | 2 | After Gaps `/11` is published, publish the maturity and Quarterly-transport performance remediation privately as `/2`, then compile the development host against Core `/10`, Gaps `/11`, Interactions `/16`, and Profile Orchestration `/2` | `PUBLISHED_HOST_LOADED_TESTING` |
| PUB-2026-08-14-15 | 2026-08-14 | RevelioGapsLibrary | 11 | Publish the open-only Value Gap lifecycle performance remediation privately as `/11` before compiling the development host | `PUBLISHED_HOST_LOADED_TESTING` |
| PUB-2026-08-21-01 | 2026-08-21 | RevelioInteractionsLibrary | 17 | Publish the actual-chart-bar reminder compositor privately as `/17`; after Gaps `/11` and Profile Orchestration `/2` are also published, compile and visually test the development host against Core `/10`, Gaps `/11`, Interactions `/17`, and Profile Orchestration `/2` | `PUBLISHED_TESTED_REJECTED_EXCESSIVE_DENSITY` |
| PUB-2026-08-21-02 | 2026-08-21 | RevelioInteractionsLibrary | 18 | Publish the staggered adaptive-cell reminder compositor privately as `/18`, then compile and visually compare the development host against Interactions `/17` on NQ 1H, 4H, Daily, and Range charts | `PUBLISHED_TESTED_REJECTED_EXCESSIVE_INTRADAY_DENSITY` |
| PUB-2026-08-21-03 | 2026-08-21 | RevelioInteractionsLibrary | 19 | Publish the exact committed-reminder restoration privately as `/19`, then compile and visually compare the development host against the last committed Revelio presentation on NQ 5-minute, 1H, 4H, Daily, and Range charts | `PUBLISHED_HOST_LOADED_TESTING` |
| PUB-2026-08-23-01 | 2026-08-23 | RevelioInteractionsLibrary | 20 | Publish the carrier-interval-safe reminder compositor privately as `/20`, then compile and visually test the development Revelio host against Core `/10`, Gaps `/11`, Interactions `/20`, and Profile Orchestration `/2` with Merge Off, Strict, Balanced, and Extra Wide | `DISCARDED_BEFORE_PUBLICATION` |
| PUB-2026-08-27-01 | 2026-08-27 | RevelioInteractionsLibrary | 21 | Publish the semantic merged-label ordering correction privately as `/21`, then compile and visually verify the development Revelio host against Core `/10`, Gaps `/11`, Interactions `/21`, and Profile Orchestration `/2` with Shorten Labels On and Off across right-edge labels, active-anchor reminders, swept reminders, and Touch Marker hover text | `PUBLISHED_TESTED_APPROVED` |
| PUB-2026-08-27-02 | 2026-08-27 | RevelioProfileOrchestrationLibrary | 3 | Publish the daily volume-maturity orchestration privately as `/3`, then compile and visually verify the development Revelio host against Core `/10`, Gaps `/11`, Interactions `/21`, and Profile Orchestration `/3` across RTH, market Globex, and 24/7 UTC cycles; confirm the removed RTH Developing Profile / Until row and native live-RTH styling | `PUBLISHED_SUPERSEDED` |
| PUB-2026-08-27-03 | 2026-08-27 | RevelioProfileOrchestrationLibrary | 4 | Publish the shared Auto Maturity preset orchestration privately as `/4`, then compile and visually verify the development Revelio host against Core `/10`, Gaps `/11`, Interactions `/21`, and Profile Orchestration `/4` using Standard 45%, Conservative 55%, and Strict 65% across RTH, market Globex, and 24/7 UTC cycles | `PUBLISHED_SUPERSEDED` |
| PUB-2026-08-28-01 | 2026-08-28 | RevelioProfileOrchestrationLibrary | 5 | Publish the strict-only Auto maturity orchestration privately as `/5`, then compile and visually verify the development Revelio host against Core `/10`, Gaps `/11`, Interactions `/21`, and Profile Orchestration `/5` across RTH, market Globex, and 24/7 UTC cycles | `PUBLISHED_TESTED_APPROVED` |
| PUB-2026-08-28-02 | 2026-08-28 | RevelioProfileOrchestrationLibrary | 6 | Publish the RTH-only calendar-profile orchestration privately as `/6`, then compile and visually verify the development Revelio host against Core `/10`, Gaps `/11`, Interactions `/21`, and Profile Orchestration `/6` across Weekly, Monthly, Quarterly, developing, Manual Composite, Touch Marker, swept-level, time-chart, Range-chart, holiday, and DST cases | `PUBLISHED_RUNTIME_ISSUES_REPORTED` |
| PUB-2026-08-30-02 | 2026-08-30 | RevelioProfileOrchestrationLibrary | 7 | Publish the composite-budget correction privately as `/7`, then compile and verify the development Revelio host against Core `/10`, Gaps `/11`, Interactions `/21`, and Profile Orchestration `/7` with Manual Composite ranges at and beyond the ordinary Show Last boundary, double-width composite histograms, labeled anchor contours, and Boost-controlled daily counts | `PUBLISHED_PRINCIPAL_REVIEW_REJECTED_QUARTERLY_ELIGIBILITY` |
| PUB-2026-08-30-01 | 2026-08-30 | LegilimensProfileLibrary | 1 | Publish the extracted Legilimens profile calculation source privately as `/1`, then compile and visually verify the development Legilimens host against `/1` across session, Rolling, Fixed, developing, Replay, and Range-chart profiles | `PUBLISHED_HOST_COMPILE_FAILED_RETURN_TYPE` |
| PUB-2026-08-30-03 | 2026-08-30 | LegilimensProfileLibrary | 2 | Publish the void-contract correction privately as `/2`, then compile and visually verify the development Legilimens host against `/2` across session, Rolling, Fixed, developing, Replay, and Range-chart profiles | `PUBLISHED_TESTED_APPROVED` |
| PUB-2026-08-30-04 | 2026-08-30 | RevelioProfileOrchestrationLibrary | 8 | Publish the remote Quarterly eligibility correction privately as `/8`, then compile and verify the development Revelio host against Core `/10`, Gaps `/11`, Interactions `/21`, and Profile Orchestration `/8` with prior-to-current Quarterly Manual Composite ranges on host charts that do not contain the selected quarter boundary, plus partial, missing, future, reversed, and Show Last-exceeded ranges | `PUBLISHED_TESTED_APPROVED` |
| PUB-2026-09-02-01 | 2026-09-02 | LegilimensProfileLibrary | 3 | Publish the rolling sample-store and profile-mechanics extraction privately as `/3`, then compile the development Legilimens host against `/3` and verify Rolling, seven-day Weekly, thirty-day Monthly, calendar Weekly/Monthly with Use Rolling disabled, history ordering and retention, mitigation, Replay, Range charts, visuals, object budgets, and Profiler behavior | `PUBLISHED_TESTED_APPROVED` |
| PUB-2026-09-02-02 | 2026-09-02 | LegilimensProfileLibrary | 4 | Publish the pure profile-analytics extraction privately as `/4`, then compile the development Legilimens host against `/4` and verify Delta tiers, selected-tier outliers, LVN/cliff levels, overlap merging, mitigation registration, Replay, Range charts, visuals, object budgets, and Profiler behavior | `PUBLISHED_TESTED_APPROVED` |
| PUB-2026-09-02-03 | 2026-09-02 | LegilimensProfileOrchestrationLibrary | 1 | Publish the Legilimens anchor, boundary, retention, and selection lifecycle privately as `/1`, then compile the reorganized development host against Profile `/4` and Profile Orchestration `/1` and verify every profile mode, developing/history behavior, Replay, Range charts, mitigation, visuals, object budgets, and Profiler behavior | `PUBLISHED_HOST_COMPILE_FAILED_MISSING_FUNCTION_REFERENCE` |
| PUB-2026-09-02-04 | 2026-09-02 | LegilimensProfileOrchestrationLibrary | 2 | Publish the NY cutoff export correction privately as `/2`, then compile the reorganized development host against Profile `/4` and Profile Orchestration `/2` and verify Rolling Through clock cutoffs plus the full profile-mode regression set | `PUBLISHED_HOST_COMPILED_RUNTIME_VALIDATION_PENDING` |
<!-- VERSION_REGISTRY_INSTRUCTIONS_END -->

## Current handoff

- Published chain: Core `/10`, Gaps `/11`, Interactions `/21`, Profile Orchestration `/8`.
- Pending: none.
- Discarded: Interactions `/20`; it remains permanently retired.
- Development host: `indicators/20-revelio/code/indicator/revelio.pine`, importing Interactions `/21` and Profile Orchestration `/8`.
- Runtime status: Interactions `/21` and Profile Orchestration `/8` are published, tested, and approved. Profile Orchestration `/7` remains recorded as superseded after principal review found the Quarterly host-history eligibility defect.
- Host-only changes retained: shared Daily calendar ceiling, Weekly boundary correction, explicit Quick Filter names, Show Only ceiling, and reminders wherever the selected source profile is visible.
- Legilimens: Profile Library `/4` is published, tested, and approved. Development imports `/4`.
- Legilimens: Profile Orchestration Library `/1` is published but the host compile failed because the NY cutoff helper was not exported.
- Legilimens: Profile Orchestration Library `/2` is published and development imports `/2`. The reorganized host compiles live against Profile `/4` and Orchestration `/2`; runtime and visual validation remain pending.

## Pending release notes

## Invariants

- Version numbers are forward-only across published, pending, and discarded rows. The next version is the highest recorded version plus one. A discarded version is never reused; an active unpublished pending version may still be corrected in place.
- Runtime or visual feedback confirms publication and testing of the referenced version. If the referenced version is unclear, ask before advancing it.
- The development host imports `Pending` when present; otherwise it imports `Published`.
- Every pending version has exactly one pending history row, one `CURRENT_PENDING` instruction, one SHA-256 fingerprint, and copy-ready notes.
- Any source edit after a publication requires another forward version. Host-only configuration changes do not.
