Legilimens Indicator: Tier Controls, Styling Modes and Per-Profile Positioning
Objective

Update the Legilimens indicator to:

Make Delta and LVN tier selection clearer.
Add missing line-style and line-width controls.
Support two switchable Delta colour configurations.
Allow profile positioning and label placement to be configured independently for each profile.
Prevent labels and dots from colliding with profile boundary lines.

The attached screenshot demonstrates the current label and dot collision described in Workstream 2.

Workstream 1: Tier controls and styling

These changes all affect the Delta, LVN and level-style configuration and can be implemented together.

1.1 Rename and clarify the Delta and LVN tier controls
Current behaviour

The indicator currently has these dropdowns:

Show Outliers
Show LVN Zones

The dropdown values are numbered 1–5, but the numbers do not clearly communicate the strength threshold being selected.

Required changes

Rename the controls:

Show Outliers → Show Delta Tiers
Show LVN Zones → Show LVN Tiers

Replace the numeric options with the circle notation already used to represent the tier strengths:

●●●●●
●●●●
●●●
●●
●

The selected value should act as the minimum strength threshold:

●●●●● → show only ●●●●●
●●●● → show ●●●● and ●●●●●
●●● → show ●●●, ●●●● and ●●●●●
●● → show ●●, ●●●, ●●●● and ●●●●●
● → show all tiers

More circles must always mean greater strength:

●●●●● is the strongest tier.
● is the weakest tier.

Review the current internal tier numbering because it may currently run in the opposite direction. Reverse or remap it where necessary so that the internal logic and UI use the same strength order.

Apply the same labels and filtering logic to both Delta Tiers and LVN Tiers.

When migrating the existing settings, preserve the tiers currently being displayed by mapping the previous numeric value to the equivalent circle threshold.

1.2 Add a Delta Tier line-width control

Add a setting that controls the line width of the Delta Tiers that are rendered as lines.

This currently applies to:

●●●●●
●●●●

The selected width should apply to the line component of both tiers.

The lower-strength tiers do not require this setting unless they are also rendered using lines.

The default width should match the current line width.

Place the setting neatly within the Delta Tier styling section. Do not append it to an already crowded or visually unbalanced row.

1.3 Add two switchable Delta colour modes
Current behaviour

There is currently one colour configuration for:

Delta Tiers
Dominant Delta
Normal Delta

Changing between different colour setups requires manually changing every colour.

Required changes

Add two independently stored Delta colour configurations and one selector for switching between them.

Add a control such as:

Delta Colour Mode

Mode 1
Mode 2

Each mode should retain its own complete set of Delta-related colours, including:

Every Delta Tier colour
Dominant positive Delta
Dominant negative Delta
Normal positive Delta
Normal negative Delta
Any other existing colour setting specifically used by the Delta display

Switching the mode should change all Delta-related colours together without affecting unrelated indicator colours.

Editing Mode 1 must not overwrite Mode 2, and editing Mode 2 must not overwrite Mode 1.

Use the existing Delta colours as the initial values for Mode 1. Mode 2 can initially duplicate Mode 1 until it is customised.

Keep these controls organised within the existing Delta colour section. Prefer displaying the colour inputs for the currently selected mode while retaining the inactive mode’s values internally, rather than permanently showing two complete duplicate sets of colour controls.

1.4 Add a POC line-style control

Add a setting that allows the POC line style to be changed.

Use the line-style options already supported elsewhere in the indicator, such as:

Solid
Dashed
Dotted

The default should match the current POC line style.

Place this control within the existing POC styling section.

Do not simply attach it to an existing row if that makes the row crowded or visually unbalanced. Reorganise the POC controls into an additional row or a more appropriate grouping where necessary.

Workstream 2: Per-profile positioning and label rendering

These changes are related and should be implemented together because the label anchoring behaviour depends on the selected per-profile position.

2.1 Add per-profile Delta Profile positioning controls
Current behaviour

The following Delta Profile positioning settings are currently controlled globally:

Which side the Delta Profile is attached to.
Which direction the Delta Profile faces.

This forces all profiles to use the same configuration.

Required changes

Allow every individual profile to override the global Delta Profile positioning.

This should apply to all profiles that can display a Delta Profile, including examples such as:

New York
IVB
RTH
Rolling profiles
Any other applicable profile

Each profile should be able to control:

Attach Side: Left or Right
Facing Direction: Left or Right

Retain the current global controls as the master/default configuration.

Add a per-profile mode such as:

Use Global
Custom

When Use Global is selected, the profile inherits the global Attach Side and Facing Direction settings.

When Custom is selected, the profile uses its own Attach Side and Facing Direction settings.

All profiles should default to Use Global so that existing chart behaviour remains unchanged until a custom override is selected.

The purpose is to allow one profile to be adjusted on the fly without requiring every profile to be configured individually.

2.2 Add per-profile level-text position controls
Current behaviour

Profile level labels are currently fixed at the right side of the profile.

Required changes

Add a Text Position dropdown to every individual profile.

Options:

Left
Centre
Right

This setting must be configurable independently for each profile.

For example:

New York can use Centre.
IVB can use Left.
RTH can use Right.

The default should be Right so that existing charts retain their current appearance.

Left

Place the level labels at the left side of the profile’s actual range.

The complete label or complete group of dots should be positioned on the left side of the boundary rather than being centred over it.

Centre

Place the labels at the horizontal midpoint between the left and right boundaries of the profile’s actual range.

The midpoint must be calculated from the profile range itself and must not be calculated from the additional outer shell, frame extension or offset area.

The label should be centred at this midpoint.

Right

Place the level labels at the right side of the profile’s actual range.

The complete label or complete group of dots should be positioned on the right side of the boundary rather than being centred over it.

2.3 Prevent labels and dots from colliding with the boundary line
Current behaviour

The labels or dots accompanying each level are currently centred on the vertical boundary of the outer frame.

This causes the content to straddle the line:

Part of a label appears inside the frame and part appears outside it.
In Dots Only mode, some dots appear on the left side of the frame and the remaining dots appear on the right.
Labels and dots visually collide with the vertical boundary line.
The current offset appears to be used both as the endpoint of the level line and as the centre position of the label.

The attached screenshot demonstrates this issue on the right side of the rolling profile.

Required behaviour

The level line should continue to end at the existing profile boundary, as it does now.

The only required visual change is that the label or dots must be placed entirely on the appropriate side of that line, with a small visible gap so that the content does not collide with the line.

The exact implementation is up to the developer. The gap could be created through positional padding, spacing, prefixed or suffixed blank space, or any other reliable method supported by the current rendering system.

The important result is:

The line continues to end at the boundary.
The label does not overlap the line.
The label is not centred on the line.
All text or dots remain entirely on the selected side.
Right position

When Text Position = Right:

Keep the level line ending at the right boundary.
Place the complete label or complete group of dots just to the right of the line.
Include a small visual gap between the line and the label.
In Dots Only mode, all dots must appear to the right of the boundary.

Conceptually:

Level line → boundary → small gap → label

Left position

When Text Position = Left:

Keep the level line ending at the left boundary.
Place the complete label or complete group of dots just to the left of the line.
Include a small visual gap between the label and the line.
In Dots Only mode, all dots must appear to the left of the boundary.

Conceptually:

Label ← small gap ← boundary ← level line

Centre position

When Text Position = Centre:

Calculate the horizontal midpoint of the profile’s actual range.
Centre the label at that midpoint.
Do not use the left or right boundary offset when calculating the centre.
Do not use the additional outer shell or frame extension as part of the midpoint calculation.
Scope

Apply the corrected positioning and collision prevention consistently to all profile-level labels that use this rendering system, including:

Full text labels
Abbreviated labels
Dots Only mode
Delta Tier labels
LVN labels
POC labels
Buy and Sell labels
Cliff labels
Any other applicable profile-level labels
General implementation requirements

All new controls should be placed within their relevant settings sections.

Pay attention to the layout of the settings panel:

Keep rows visually balanced.
Avoid overcrowding existing rows.
Add new rows or logical subgroups where necessary.
Keep related controls together.
Preserve existing behaviour through appropriate default values.

Unless explicitly changed in this ticket, all other indicator calculations and display behaviour should remain unchanged.

Deliberate Workstream 1 UI deviations (As Agreed with Owner)

The following implementation choices intentionally differ from the original circle-only dropdown examples:

- The Delta Tier and LVN Tier input dropdowns use compact filled bullets to reduce input-row width.
- The input options are `•••••`, `••••⁺`, `•••⁺`, `••⁺` and `•⁺`. The superscript plus indicates the selected minimum tier and every stronger tier; `•••••` remains strongest-only.
- The default `Repeated Circles` chart style uses the larger `●` glyphs. The compact bullets are not used for chart labels.
- The chart-only `Tier Marker Style` selector is intentionally placed in `Quick Filter: Settings`. `Repeated Circles` preserves the existing marker counts; `Single Circle` replaces every tier marker with one plain `●` and adds independent numeric Tier 5 through Tier 1 dot-size controls.
- The single-circle option uses only the circle glyph. It does not append a count, use superscript text, or change the compact input threshold bullets.
- Numeric dot sizes accept values from 1 through 100; their defaults are Tier 5 `24`, Tier 4 `18`, Tier 3 `12`, Tier 2 `10` and Tier 1 `7`.
- The two quick-filter groups are singular and named `Quick Filter: Show Only` and `Quick Filter: Settings`; no `Quick Filters` label is used.
- `Delta Color Mode` is intentionally placed in `Quick Filter: Settings` so the active Delta color configuration can be selected with the other quick controls.
- Delta color inputs identify their stored configuration directly with `Primary` or `Secondary` in the visible input label, including Buy, Sell, Line, Text and Zone controls.
- The optional color reference table also prefixes active Delta rows with `Primary` or `Secondary`, keeping its swatches tied to the selected configuration.
- Tier 5 and Tier 4 always draw both their lines and zones and retain independent Width and Style controls. Tier 4 defaults to width 2 and Dashed style. Tier 3 through Tier 1 remain zone-only and have no line controls.
- Line Style uses the existing level-style options `Solid`, `Dashed` and `Dotted`.
