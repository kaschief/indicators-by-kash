Follow-up Ticket: Remove Delta Color Modes and Simplify Dot Positioning
Objective

This ticket contains two cleanup tasks:

Remove the previously implemented Primary/Secondary Delta Color Mode feature.
Revert the recent dot-positioning changes and return to a simpler, cleaner positioning model.
Part 1: Remove Delta Color Modes
Current behavior

The indicator currently supports:

Delta Color Mode
Mode 1
Mode 2

Each mode maintains its own complete set of Delta colors, along with duplicate rendering logic and supporting code.

After testing, I have decided this feature is unnecessary.

Required change

Completely remove the Delta Color Mode feature.

The indicator should return to having a single Delta color configuration.

This is not simply a UI change.

Remove every part of the implementation.

Remove

Remove:

Delta Color Mode selector.
Mode 1.
Mode 2.
All duplicated Delta color inputs.
All duplicated default values.
All rendering logic that switches between modes.
All helper functions.
All variables.
All arrays.
All state used exclusively by the mode system.
Any comments or documentation referring to Delta Color Modes.
Keep

Retain one complete Delta color configuration containing the existing controls for:

Delta Tier colors.
Dominant Delta colors.
Normal Delta colors.
Any other Delta-specific colors.

The user should edit these colors directly.

Default values

Keep the current primary/default colors.

Do not merge the two modes.

Simply remove Mode 2 completely.

Settings cleanup

After removal:

Only one Delta color section should remain.
There should be no disabled controls.
There should be no empty groups.
The settings should appear as though the color-mode feature never existed.
Part 2: Revert and simplify the dot positioning
Current issue

The most recent dot-positioning changes made the layout worse.

The additional alignment logic has introduced unnecessary complexity and produced inconsistent visual results.

Required behavior

Revert the recent alignment changes.

Return to a simple positioning model.

Horizontal positioning

All dots should share one common horizontal center axis.

Every dot should use the same X-coordinate.

Different dot sizes should expand equally to the left and right around that shared center.

Do not:

Left-align dots.
Right-align dots.
Offset dots based on their radius.
Apply different horizontal calculations depending on dot size.

The visual result should be one clean vertical column.

Position relative to the outer frame

The dots should sit outside the profile's outer frame.

The level line should continue ending at the outer-frame boundary exactly as it does now.

The dot should begin immediately after that boundary.

Conceptually:

Level line → Outer-frame boundary → Dot

The dot must not:

Overlap the frame.
Touch the frame.
Render inside the frame.
Vertical positioning

Every dot must remain vertically centered on its corresponding level.

The center of the dot must use exactly the same Y-coordinate as the level line.

For example:

If the level line is drawn at 9.5, the center of the dot must also be at 9.5.

It must not appear above or below the line.

The behavior should match the alignment already used in indicators such as Revelio and Deviations.

Remove the recent positioning logic

Remove the recently introduced logic for:

Radius-based compensation.
Edge-based alignment.
Left-justification.
Right-justification.
Per-size horizontal offsets.
Any calculations added solely to compensate for different dot sizes.

Return to one shared center X-coordinate for every marker.

Acceptance criteria
Delta colors
Delta Color Mode no longer exists.
Mode 1 and Mode 2 no longer exist.
Only one set of Delta color controls remains.
No rendering logic references multiple Delta color modes.
No obsolete mode-related code remains.
Dot positioning
Every dot shares the same horizontal center axis.
Larger dots expand equally on both sides of that axis.
The dots form one clean vertical column.
Every dot sits outside the outer frame.
The level line still ends at the outer-frame boundary.
No dot overlaps or touches the outer frame.
Every dot is vertically centered on its corresponding level line.
The recent radius-based and edge-based alignment logic has been removed.

IMPLEMENTATION NOTES

- Delta color modes and their duplicate inputs, selectors, derived colors and reference-table labels were removed. The former default color set remains as the single editable configuration.
- Marker-position inputs and edge-specific marker styles were removed. All markers use one shared x-coordinate after the outer-frame endpoint, `label.style_none`, and centered text alignment.
- The marker clearance is now exposed as the numeric `Dot Offset` setting in bars so its spacing can be titrated without changing marker size or alignment.
- Default line widths are VAH/L 3, POC 1, Tier 5 2 and Tier 4 1.
- Default colors were refreshed from the latest supplied reference table, including the NY Early/IVB profile colors and all Delta tier marker and zone defaults.
