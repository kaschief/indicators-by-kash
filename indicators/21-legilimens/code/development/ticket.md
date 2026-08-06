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
- The subsequent single-dot follow-up supersedes the earlier repeated-circle experiment. Individual level markers now always use exactly one plain `●`; the compact bullets remain input-only.
- `Show Level Markers` is the sole global toggle for individual POC, VAH, VAL, Delta, LVN and Cliff markers. It does not affect separate profile/session range text.
- Numeric dot sizes accept values from 0 through 100; their defaults are Tier 5 `12`, Tier 4 `8`, Tier 3 `7`, Tier 2 `6` and Tier 1 `5`.
- The two quick-filter groups are singular and named `Quick Filter: Show Only` and `Quick Filter: Settings`; no `Quick Filters` label is used.
- `Delta Color Mode` is intentionally placed in `Quick Filter: Settings` so the active Delta color configuration can be selected with the other quick controls.
- Delta color inputs identify their stored configuration directly with `Primary` or `Secondary` in the visible input label, including Buy, Sell, Line, Text and Zone controls.
- The optional color reference table also prefixes active Delta rows with `Primary` or `Secondary`, keeping its swatches tied to the selected configuration.
- Tier 5 and Tier 4 always draw both their lines and zones and retain independent Width and Style controls. Tier 4 defaults to width 2 and Dashed style. Tier 3 through Tier 1 remain zone-only and have no line controls.
- Line Style uses the existing level-style options `Solid`, `Dashed` and `Dotted`.

SUBSEQUENT UPDATE

Legilimens Workstream 1 Follow-Up: Single-Dot Level Markers and Per-Profile Marker Positioning
Scope amendment

This ticket now includes the following requirements that were previously assigned to Workstream 2:

The per-profile Left, Centre and Right position control for level labels
The boundary-line collision and padding correction

Because written level labels are being removed, these requirements must now be implemented specifically for the new single-dot level markers.

Do not implement these requirements again as separate text-positioning work in Workstream 2.

The only item that should remain in Workstream 2 is the independent per-profile Delta Profile attachment and facing configuration.

1. Replace all repeated-circle markers with one size-coded dot
   Current behaviour

The indicator currently supports:

Repeated-circle markers, such as ●●●●●, ●●●●, ●●●, ●● and ●
A separate single-circle mode in which each tier is represented by one circle with a configurable text size
Required change

Remove the repeated-circle rendering option completely.

There should no longer be a choice between repeated circles and single circles.

Every level marker must now always be represented by:

Exactly one circle: ●
A tier-specific dot size
The existing tier-specific colour

The previous Single Circle mode name or selector is no longer required because this is now the only rendering method.

Remove any obsolete input or code path used only to switch between repeated-circle and single-circle modes.

2. Retain one independently configurable dot-size input per tier

Retain the existing 0–100 size input for each of the five tiers.

Use these defaults:

Tier Strength Default dot size
Tier 5 Strongest 12
Tier 4 Second strongest 8
Tier 3 Middle 7
Tier 2 Second weakest 6
Tier 1 Weakest 5

Each tier size must remain independently configurable.

Changing one tier’s size must not alter another tier’s size.

Examples:

A Tier 5 level renders one dot at the Tier 5 size.
A Tier 3 level renders one dot at the Tier 3 size.
A Tier 1 level renders one dot at the Tier 1 size.

The configured tier colour should continue to determine the colour of the dot.

3. Remove all written text from individual level markers
   Current behaviour

Individual levels can currently display written information such as:

The session or profile name
The level type
The tier marker

Examples may include combinations such as:

RTH POC
New York VAH
Globex LVN
IVB Buy
A level name followed by dots or tier circles
Required change

Every applicable individual level must now display only one tier dot.

Remove both:

The session or profile name from the individual level marker
The written level-type name from the individual level marker

Remove written markers for:

POC
VAH
VAL
Buy
Sell
LVN
Cliff
Reminder versions of these levels shold also be removed, the feature to be removed
Any other tier-based level using the same label-generation system

For example:

RTH POC ● becomes ●
New York VAH ● becomes ●
Globex LVN ● becomes ●

Do not leave behind:

Empty spaces
Separators
Abbreviations
Empty session-name prefixes
Repeated dots

The marker must contain exactly one circle character.

The indicator must still retain the underlying knowledge that a level is a POC, VAH, VAL, Buy, Sell, LVN or Cliff. Only the visible text is being removed.

4. Do not change the separate range/session text

This change applies only to the markers attached to individual levels.

It must not affect the separate text used to identify a profile or session range.

The following must remain unchanged:

Range High session text
Range Low session text
Profile or session range names
New York range text
RTH range text
IVB range text
Globex range text
Rolling-profile range text
Any equivalent text attached to the profile range itself

The range/session text and the individual level markers are separate systems.

Do not remove, rename, reposition or connect the range/session text to the new level-marker visibility control.

5. Remove obsolete controls from Price Labels and Tags
   Current behaviour

The Price Labels and Tags settings currently include separate controls for individual written level labels, including controls such as:

POC
Value Area High
Value Area Low
Buy
Sell
LVN
Cliff
Required change

Remove the controls that exist specifically to show or hide these written individual level names.

Remove the relevant controls for:

POC
VAH
VAL
Buy
Sell
LVN
Cliff
Any equivalent individual level-text control

Also remove any formatting inputs used only by the obsolete written individual level labels.

Do not remove:

Range/session text settings
Range High or Range Low session-name controls
Unrelated price-label controls
Underlying level calculations
Level lines 6. Add one global level-marker toggle to Quick Filter settings

Add one on/off control in the Quick Filter settings.

Use a clear name such as:

Show Level Markers

When enabled
Display one tier dot for every applicable enabled level.
Use the level’s tier colour.
Use the level’s configured tier size.
Display no session name within the marker.
Display no written level-type name.
When disabled
Display no individual level dots.
Display no obsolete individual level-label text.
Keep the underlying levels, lines and calculations active unless another existing control disables them.
Do not hide the separate range/session text.

This one toggle replaces the removed individual visibility controls for POC, VAH, VAL, Buy, Sell, LVN and Cliff text.

7. Add a per-profile Level Marker Position control

This requirement replaces the previous Workstream 2 Text Position requirement.

Because the visible content is now always a dot, name the new per-profile control:

Level Marker Position

Do not call it Text Position.

Add this dropdown independently to every profile that displays level markers.

Options:

Left
Centre
Right

Examples of applicable profiles include:

New York
IVB
RTH
Globex
Rolling profiles
Any other profile that displays these level markers

Each profile must retain its own selection.

For example:

New York can use Centre.
IVB can use Left.
RTH can use Right.

The default must be Right to preserve the current general placement.

This control affects only the individual tier dots. It must not reposition the separate profile/session range text.

8. Right-position behaviour

When Level Marker Position = Right:

Keep the level line ending at the existing right-side boundary, as it does now.
Place the entire single dot just to the right of that boundary.
Leave a small visible gap between the boundary line and the dot.
Do not centre the dot directly over the boundary line.
The complete dot must remain on the right side of the line.

The intended result is:

level line → boundary → small empty gap → dot

The developer may implement the gap using:

Positional padding
A bar or coordinate offset
Blank spacing
Another reliable approach supported by the current rendering system

The implementation method is not important. The visual requirement is that the dot must not touch, overlap or straddle the line.

9. Left-position behaviour

When Level Marker Position = Left:

Keep the level line ending at the existing left-side boundary.
Place the entire single dot just to the left of that boundary.
Leave a small visible gap between the dot and the boundary line.
Do not centre the dot directly over the boundary line.
The complete dot must remain on the left side of the line.

The intended result is:

dot ← small empty gap ← boundary ← level line

The implementation method is up to the developer, provided the marker does not collide with or straddle the line.

10. Centre-position behaviour

When Level Marker Position = Centre:

Determine the actual horizontal start and end boundaries of the profile range.
Calculate the midpoint between those two boundaries.
Centre the single dot at that midpoint.
Do not calculate the midpoint using the additional outer shell, line extension or label offset.
Do not apply the left-side or right-side boundary padding to the centred marker.

The centre position should remain the centre of the profile’s actual range even when the outer frame or extension changes.

This requirement does not refer to the midpoint between the Range High and Range Low prices. It refers to the horizontal midpoint of the profile range box whose vertical bounds are the Range High and Range Low.

11. Apply the positioning consistently to all applicable level types

The selected per-profile marker position must apply consistently to the single-dot markers for:

POC
VAH
VAL
Buy
Sell
LVN
Cliff
Reminder levels
Extended versions of these levels
Any other level rendered through the same tier-marker system

There must not be separate positioning behaviour for different level types unless an existing feature explicitly requires it.

12. Remove obsolete positioning logic

Remove or replace code that:

Centres repeated circles over the outer-frame boundary
Places half of a marker on either side of the boundary
Assumes the marker contains written session or level text
Uses the same coordinate as both the line endpoint and the centre point of the marker
Applies the old text-positioning system to the new dot-only markers

The new calculation should treat these as separate concepts:

The line boundary or endpoint
The marker position
The small visual gap between them when using Left or Right 13. Required rendering sequence

For every applicable level, use this sequence:

Determine whether Show Level Markers is enabled.
Determine the level’s tier.
Retrieve the colour configured for that tier.
Retrieve the size configured for that tier.
Retrieve the Level Marker Position selected for that profile.
Calculate the Left, Centre or Right marker location.
Render exactly one circle at the calculated location.
Do not add a session name or level-type name. 14. Settings-panel cleanup

After implementing the changes, remove obsolete inputs related only to:

Repeated-circle rendering
Switching between repeated circles and single circles
Written session names inside individual level markers
Written POC, VAH, VAL, Buy, Sell, LVN and Cliff markers
Individual written-label visibility toggles
The old global or incomplete text-positioning control, if one exists

Keep:

Five independent tier-size controls
Tier colour controls
One Quick Filter level-marker toggle
One per-profile Level Marker Position dropdown
Separate range/session text controls
Acceptance criteria

The ticket is complete when all of the following are true:

Repeated-circle level markers no longer render anywhere.
Every displayed tier marker contains exactly one circle.
Default sizes are:
Tier 5: 12
Tier 4: 8
Tier 3: 7
Tier 2: 6
Tier 1: 5
Individual levels display no session names.
Individual levels display no POC, VAH, VAL, Buy, Sell, LVN or Cliff text.
Separate profile/session range text remains unchanged.
Obsolete individual label toggles have been removed.
One Quick Filter toggle controls all level markers.
Every profile has its own Left, Centre and Right marker-position selection.
Right-positioned dots appear completely to the right of the boundary with a visible gap.
Left-positioned dots appear completely to the left of the boundary with a visible gap.
Centre-positioned dots use the midpoint of the actual profile range.
No dot overlaps or straddles a profile boundary line.
Turning level markers off does not hide the profile/session range text.
Revised remaining scope for Workstream 2

After this amendment, Workstream 2 should contain only the following feature:

Per-profile override of the Delta Profile’s Attach Side
Per-profile override of the Delta Profile’s Facing Direction
The option for each profile to use either:
Use Global
Custom

The old Workstream 2 sections concerning level-text position and label collision should be removed because they are now fully covered by this follow-up ticket.

UPDATE 2

1. there is no 1.

2. Keep Delta Profile attachment and direction global
The Delta Profile itself must use one shared global positioning configuration for every profile.

Keep only these global Delta Profile controls:

Attach To
Direction
Every Delta Profile must use the same global values, including New York, IVB, RTH, Globex, Rolling and all other applicable profiles.

Default Attach To

Right Edge

Default Direction

Left

With the defaults active, the Delta Profile is attached to the right edge of the profile range and faces or extends toward the left.

3. Remove per-profile Delta Profile overrides
Remove the per-profile override implementation only for the Delta Profile's attachment and direction.

Remove from every profile:

The Delta Profile Use Global / Custom selector.
The profile-specific Delta Profile Attach Side input.
The profile-specific Delta Profile Direction input.
Variables used only to store those profile-specific values.
Conditional logic that chooses between global and custom Delta Profile placement.
Helpers, arrays or parameters used only by that override system.
Do not leave hidden, disabled or unused per-profile Delta Profile positioning controls.

Every profile's Delta Profile rendering logic should read directly from the same two global inputs.

4. Keep Level Marker Position configurable per profile
Do not remove or globalize the per-profile Level Marker Position control.

The single-dot level markers must still be positionable independently for each profile.

Each applicable profile must retain its own:

Level Marker Position

Options:

Left
Center
Right
The default remains Right.

Examples:

New York markers may use Center.
IVB markers may use Left.
RTH markers may use Right.
Changing one profile's Level Marker Position must not change any other profile.

This control affects only the position of the single-dot level markers. It does not control the Delta Profile histogram's attachment or facing direction.

5. Keep the existing marker-position behavior
Left
Place the single dot to the left of the profile boundary.
Keep a visible horizontal gap between the dot and the boundary line.
The dot must not touch, overlap or straddle the boundary.
Center
Calculate the horizontal midpoint between the actual start and end of that profile range.
Place the dot at that horizontal midpoint.
Do not include the outer shell, frame extension or label offset in the midpoint calculation.
Right
Place the single dot to the right of the profile boundary.
Keep a visible horizontal gap between the boundary line and the dot.
The dot must not touch, overlap or straddle the boundary.
6. Keep the marker-padding and vertical-alignment feedback
Marker Padding
Retain the requested adjustable Marker Padding control.

It controls the horizontal gap between the profile boundary and Left- or Right-positioned markers.
Increasing it moves Right markers farther right.
Increasing it moves Left markers farther left.
It must not move the level line or outer frame.
It does not apply to Center-positioned markers.
Exact vertical alignment
The center of every dot must use exactly the same price coordinate as its corresponding horizontal level line.

If the level line is at price 9.5, the center of the dot must also be at 9.5.

Do not add a vertical price offset.
Do not align the level using the top or bottom of the label box.
The visual center of the dot must sit directly on the line.
This must work for all five configured dot sizes.
7. Keep marker controls in their respective tier sections
Marker controls must not live in Quick Filter.

Delta Tier dot controls belong in the Delta Tiers section.
LVN Tier dot controls belong in the LVN Tiers section.
Any marker-specific visibility, size, color or padding input belongs beside the tier controls that it affects.
Remove the global Show Level Markers control from Quick Filter.

The per-profile Level Marker Position dropdown should remain inside each individual profile's settings because its value is profile-specific.

8. Separation of responsibilities
Global Delta Profile controls

Attach Side
Direction
Shared by every profile
Defaults: Right Edge and Left
Per-profile level-marker control

Level Marker Position
Left, Center or Right
Stored separately for each profile
Default: Right
Do not use the global Delta Profile Attach Side or Direction to determine where the level dots are placed.

Do not use the per-profile Level Marker Position to determine where the Delta Profile histogram is attached or which direction it faces.

9. Acceptance criteria
No marker-group or pyramid-justification logic is implemented.
There is one global Delta Profile Attach Side input.
There is one global Delta Profile Direction input.
The global defaults are Attach Side = Right Edge and Direction = Left.
All Delta Profiles respond to those same global values.
No profile-specific Delta Profile Use Global, Custom, Attach Side or Direction controls remain.
Every applicable profile retains its own Level Marker Position dropdown.
Changing one profile's marker position does not change another profile.
The marker-position options remain Left, Center and Right.
The marker-position default remains Right.
Left and Right markers retain an adjustable horizontal gap from the profile boundary.
Center markers use the horizontal midpoint of the actual profile range.
Every dot is vertically centered at exactly the same price as its corresponding level line.
Dot controls live in their respective tier sections rather than Quick Filter.
The Delta Profile controls and Level Marker Position controls remain logically and technically independent.

UPDATE 3

Follow-up Ticket: Marker Alignment, Tier Line Origin and Default Styling

This ticket addresses the remaining issues following the implementation of the single-dot marker system.

1. Correct the vertical alignment of the level markers
Current issue

The dots are still not vertically aligned with their corresponding level lines.

As shown in the attached screenshots, the dots appear slightly above the line instead of sitting directly on it.

The desired behavior already exists elsewhere in the codebase (for example, in Revelio and Deviations), where labels are perfectly centered on their lines.

Required change

Investigate how Revelio and Deviations position their labels and use the same approach for these markers.

The center of the dot must sit exactly on the level line.

For example:

If the level line is at price 9.5, the center of the dot must also be at 9.5.
It must not render at 9.4, 9.6 or any other vertically offset position.

The dot should appear attached to the level itself rather than floating above or below it.

If using the same implementation as Revelio or Deviations naturally resolves the horizontal spacing as well, use that implementation instead of introducing additional padding logic.

2. Remove the Marker Padding feature if no longer required

The previous ticket introduced a configurable Marker Padding value.

If implementing the marker using the same positioning approach as Revelio or Deviations naturally produces the correct spacing from the level line, then:

Remove the Marker Padding setting.
Remove the associated logic.
Use the native positioning approach instead.

Only retain Marker Padding if it is genuinely required after the marker alignment has been corrected.

3. Start tier lines at the right edge of the range
Current behavior

The tier lines currently extend through the profile range.

They begin at the left side (or profile origin) and continue beyond the profile.

Required change

Tier lines should no longer pass through the profile.

Instead:

Begin every tier line at the right edge of the profile range.
Continue extending the line only to the right.

The portion of the line inside the profile should no longer be drawn.

This applies to all tier lines.

4. Remove dots from VAH, VAL and POC

The previous implementation added dots to every level.

This is no longer the desired behavior.

Remove the dots from:

Value Area High (VAH)
Point of Control (POC)
Value Area Low (VAL)

Tier markers should continue to be used only for the applicable tier-based levels.

5. Restore the POC label

POC should remain identifiable by text.

Restore the POC label.

No other level should display text.

6. Expose the POC text size

Add a numeric input allowing the POC label text size to be adjusted.

A simple numeric input is sufficient.

The user should be able to increase or decrease the POC label size independently of every other label.

This setting applies only to the POC text.

7. Update the default colors

Update the default colors to match the attached reference screenshot.

Do not manually enter RGB values from the ticket.

Instead:

Use the attached screenshot as the source of truth.
Match each current setting to its corresponding element from the screenshot, even if the names differ because the screenshot comes from an older version of the indicator.

The objective is to reproduce the same default visual appearance shown in the reference image using the current naming structure.

Only the default values should change.

The existing color controls and settings should remain unchanged.

IMPLEMENTATION NOTES

The follow-up has been implemented with these deliberate decisions:

- Marker anchoring follows the native ADR/Revelio-style endpoint approach. Right markers use the level endpoint with `label.style_label_left`; Left markers use the corresponding right-facing anchor; Centre markers use the native centred style. The marker keeps the exact level price as its y-coordinate.
- Marker Padding was removed because native label anchoring provides the required horizontal separation from the line endpoint.
- Delta tier lines, LVN boundaries and Cliff lines begin at the profile's right edge and extend only to the right. VAH/L and POC remain the only optional level lines that may span the profile range.
- VAH, VAL and POC no longer receive tier dots. Tier markers remain on applicable Delta, LVN and Cliff levels.
- POC text was restored as the only individual level text. Its color and numeric text-size controls are independent from the other marker controls.
- Default colors were updated from the supplied muted reference screenshots. The later reference screenshot changed only the VAH/L and POC line defaults; the Tier 5 Buy line width was intentionally left unchanged.
- Clarification: Delta tier zones must also begin at the profile's right edge and extend only outward. Only optional VAH/L and POC lines may span the profile.

The dot-alignment follow-up has been implemented deliberately:

- Left markers use a native right-edge anchor, Center markers use a native center anchor, and Right markers use a native left-edge anchor. Text alignment follows the selected anchor so changing numeric dot sizes does not change the intended edge.
- The default POC line and POC label now use the same deep-indigo color from the latest reference, and the default POC label size is 11. The existing POC controls remain independent.


Follow-up Ticket: Dot Justification and POC Default Styling

This ticket contains only the issues described below.

1. Left-justify all level markers along the Y-axis
Current issue

The horizontal positioning of the dots has now been corrected.

However, because each tier uses a different dot size, the markers no longer share the same left edge.

As shown in the attached screenshot, some larger dots begin farther to the left than the smaller dots, making the vertical column appear uneven.

The column should have one perfectly aligned left edge.

Required behavior

All dots must be left-justified, regardless of their size.

The left-most edge of every dot should align vertically with the others, even though the dot diameters differ.

The desired result is a clean vertical column where only the right side changes as the dot size increases.

The current implementation appears to center each dot around the same X coordinate. This is not the desired behavior.

Instead, align the left edge of every marker.

Implementation

Investigate whether TradingView already provides a way to anchor labels or text from their left edge rather than their center.

If TradingView provides a native solution, use it.

If not, implement another reliable approach that produces the same visual result.

The implementation method is not important.

The visual result is.

2. Update the default POC styling

Update the default POC styling to match the attached reference screenshot.

Use the screenshot as the source of truth.

Do not manually copy RGB values into the ticket.

Update both:

POC Line default color
POC Label default color

using the colors shown in the attached reference.

3. Update the default POC text size

Change the default POC label text size to:

11

This changes only the default value.

The existing user control for POC text size should remain available and continue functioning normally.

Acceptance criteria

The ticket is complete when:

Every level marker shares the same left edge regardless of dot size.
The vertical marker column appears visually straight.
Dot size affects only how far the marker extends to the right.
The default POC Line color matches the attached reference screenshot.
The default POC Label color matches the attached reference screenshot.
The default POC text size is 11.

Follow-up Ticket Update: Dot Alignment by Marker Position

Replace the previous requirement that all dots must always be left-justified.

Current issue

The dots use different sizes, but they are currently anchored inconsistently. This creates the zigzag appearance shown in the screenshot.

The alignment must account for each dot’s radius so that different-sized dots still form one clean vertical column.

Required behavior

The anchoring must depend on the selected Level Marker Position:

Center

When the marker position is Center:

All dots must share the same center X-coordinate.
Each dot must be centered equally around that X-coordinate, regardless of its radius.
Larger dots may extend farther on both sides, but their centers must remain perfectly aligned.
The result must be one straight vertical line through the center of every dot.
Left

When the marker position is Left:

Right-align the dots.
All dots must share the same right edge.
Larger dots should expand toward the left.
The right edge nearest the profile boundary must remain consistent.
Right

When the marker position is Right:

Left-align the dots.
All dots must share the same left edge.
Larger dots should expand toward the right.
The left edge nearest the profile boundary must remain consistent.
Implementation requirement

Do not position all dots using the same raw X-coordinate unless the chosen anchor mode accounts for their different radii.

Use whichever TradingView label, text-alignment or coordinate approach can reliably produce:

center anchoring for Center,
right-edge anchoring for Left,
left-edge anchoring for Right.

The implementation method is flexible. The visible result is mandatory.

Acceptance criteria
Center-positioned dots share one exact center axis.
Left-positioned dots share one exact right edge.
Right-positioned dots share one exact left edge.
Different dot sizes do not create a zigzag column.
Changing tier size does not shift the intended anchor edge or center.
The dots remain vertically aligned with their corresponding price levels.
