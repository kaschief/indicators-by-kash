# Revelio — Publication Update Notes

These notes cover only changes since the last non-Auto, pre-library Revelio publication. Reuse the existing publication title and description.

## Copy-ready detailed notes

```text
[b]Major update: adaptive swept levels and a library-backed foundation[/b]

This version preserves Revelio's established profile calculations and presentation while introducing Auto Swept Lines, a simplified settings interface, several Value Area Gap refinements, and a version-pinned three-library architecture.

[b]New — Auto Swept Lines[/b]

Auto Swept Lines is an optional relevance layer for swept RTH, Globex, Weekly, Monthly, and Quarterly profile levels. It is off by default.

[list]
[*]The existing manual swept-line retention remains a protected minimum, so Auto does not show less context than the corresponding manual settings.
[*]Auto can select levels only from profiles inside each anchor's configured visible history. Older hidden profiles cannot unexpectedly populate the chart.
[*]Candidate areas require support from at least two source profiles rather than admitting isolated nearby levels.
[*]Selection considers higher-timeframe participation, distinct anchors, repeated source profiles, complementary POC/aPOC/VAH/VAL roles, later control overlap, later value acceptance, ADR-normalized distance, and recency.
[*]ADR bounds plausible reach; it does not determine importance by itself.
[*]Selections are planned at the futures or UTC trading-day boundary and remain stable through the cycle. One directional add-only expansion is possible after sufficient price travel; selected levels are not continuously removed or reordered as price moves.
[*]The normal Touch Marker, Intraday Focus, and older-level detection systems remain independent from Auto selection.
[/list]

An optional A audit is included temporarily and is off by default. When enabled, it marks only the levels added by Auto beyond the normal manual or grace floor. It also exposes the current trimmed Globex/UTC ADR in the status line and Data Window. The audit does not change selection.

[b]Value Area Gap refinements[/b]

[list]
[*]Upcoming Value Area Gaps now default to off. When enabled, they remain provisional and may move or disappear until the developing source profile closes.
[*]Confirmed gaps use a fixed 5% minimum size relative to the prior profile range; Upcoming gaps use 45%.
[*]Main gap labels and the 25%, 50%, and 75% internal references are now permanent parts of the display.
[*]The internal 50% text label remains on historical gaps only. Floating and Upcoming gaps omit it to keep the right edge clear.
[*]Gap text sizes, line styles, colors, widths, and settled fade values are now consistent code-defined presentation rules rather than user inputs.
[/list]

[b]Cleaner settings[/b]

The settings panel has been reduced from 237 inputs to 106 by removing mature appearance controls that no longer needed routine adjustment.

[list]
[*]Settled colors, line widths, line styles, label sizes, histogram colors, and fade percentages retain their previous visual values.
[*]Value Area remains fixed at 70%.
[*]Anchor labels remain in Reminder mode.
[*]The sweep-confirmation margin remains fixed at 5%.
[*]The Manual Focus price, width, and label offset remain adjustable; its settled color is fixed.
[*]The former color-reference table has been removed.
[*]Anchor and Value Area Gap controls have been repacked into clearer compact rows.
[/list]

Because the input surface changed substantially, review the settings after updating. Removed appearance controls use the established Revelio values automatically.

[b]Reliability and performance[/b]

[list]
[*]Revelio now uses version-pinned Core, Gaps, and Interactions libraries. This reduces the size of the main indicator and provides additional capacity for future development without changing how users add the indicator.
[*]Auto selection now scans only ordered eligible profile windows, reuses cached visibility information, and uses exact profile-selection lookups.
[*]Touch Marker source registration is rebuilt only when the last-bar presentation phase needs it, avoiding unnecessary historical work while preserving marker behavior.
[*]Quarterly On now explicitly forces the current Quarterly profile to display on 5-minute charts as it does on 15-minute charts.
[*]The current Quarterly profile was stabilized during 5-minute Bar Replay so it no longer intermittently disappears while advancing bars.
[/list]

[b]Compatibility[/b]

Auto Swept Lines is off by default, so the established manual swept-line workflow remains available. The library migration was validated against the preceding Revelio behavior, including RTH, Globex, Weekly, Monthly, Quarterly, Value Area Gaps, Intraday Focus, Touch Markers, realtime updates, reloads, and Bar Replay.
```

## Short fallback

Use this only if TradingView rejects the detailed note for length:

```text
Major Revelio update introducing optional Auto Swept Lines and a version-pinned Core, Gaps, and Interactions library architecture.

Auto Swept Lines is off by default. It preserves the manual retention floor, selects only from configured profile history, requires multi-profile evidence, ranks cross-anchor confluence within an ADR-normalized reach, and keeps selections stable through the trading-day cycle. The optional default-off A audit identifies only additional Auto-selected lines and displays the ADR used by the current plan.

The settings panel was reduced from 237 inputs to 106 by fixing mature colors, widths, styles, sizes, fades, Value Area at 70%, Anchor Labels at Reminders, and sweep confirmation at 5%. Existing visual values were preserved.

Value Area Gaps now use permanent main labels and 25/50/75 references; only historical gaps retain the internal 50% text label. Upcoming gaps default off. Quarterly display and 5-minute Replay stability were corrected. Auto and interaction processing were optimized without changing Touch Marker or Intraday Focus behavior.
```
