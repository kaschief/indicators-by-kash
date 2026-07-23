# Code Quality Rules

## Development Naming Rule

The suffix is ` development`, appended after the brand bullet. Never `-dev`.

**During Development**

- Append " development" to the indicator title the moment you begin changing it
- Applies to any indicator you touch that does not already carry the suffix
- Adding it is part of the change, not a separate step

**Removing the Suffix**

- Remove it ONLY after the user explicitly approves the work
- Never strip it preemptively "before commit" or "before build"
- The production version never contains the suffix

### Example

```pine
// During development
indicator("deviations • development", overlay=true, ...)

// After the user approves
indicator("deviations •", overlay=true, ...)
```

## Never Take Shortcuts - Always Refactor Properly

**CORE PRINCIPLE: Be an expert developer who values clean code. NEVER take shortcuts.**

When removing UI controls (inputs) that are no longer needed:

- ❌ **WRONG**: Remove from UI and create a hardcoded variable
- ✅ **CORRECT**: Remove the variable entirely and use the value directly where it's used

### Examples

#### ❌ LAZY (WRONG)

```pine
// Removed input, but kept variable with hardcoded value
show_labels = true  // This shouldn't exist
projection_style = STYLE_DOTTED  // This shouldn't exist
amrp_eq_style_converted = line.style_dashed  // This shouldn't exist

// Later in code:
if show_labels
    label.new(...)

line.new(..., style=projection_style_converted)
```

#### ✅ CLEAN (CORRECT)

```pine
// Variable removed entirely, value used directly

// Later in code:
label.new(...)  // Always drawn, no check needed

line.new(..., style=line.style_dotted)  // Value used directly
```

### When Refactoring

1. **Remove the variable completely** - don't leave it as a hardcoded value
2. **Find all usages** - use Grep to find where the variable is used
3. **Replace with direct values** - use the actual value directly in each location
4. **Remove conditional checks** - if something is always on, don't check a variable

### Why This Matters

Lazy refactoring leaves "dead" code controls that serve no purpose and confuse future developers. Clean code means removing unnecessary abstractions entirely.

## Always Keep Code DRY - Parameterize Functions

**CORE PRINCIPLE: Never duplicate code. Always parameterize functions to make them reusable.**

When similar logic is needed for multiple contexts (e.g., multiple timeframes, multiple data sources):

- ❌ **WRONG**: Duplicate the function with different variable names
- ✅ **CORRECT**: Parameterize the function to accept the data it needs

### Examples

#### ❌ WRONG (Duplicated Functions)

```pine
// Duplicated function for HTF1
is_htf_displacement_candle() =>
    float c2_body = math.abs(htf_c2 - htf_o2)
    float avg_body = (math.abs(htf_c3 - htf_o3) + math.abs(htf_c4 - htf_o4)) / 2
    c2_body >= avg_body * 1.25

// Duplicated function for HTF2 - BAD!
is_htf2_displacement_candle() =>
    float c2_body = math.abs(htf2_c2 - htf2_o2)
    float avg_body = (math.abs(htf2_c3 - htf2_o3) + math.abs(htf2_c4 - htf2_o4)) / 2
    c2_body >= avg_body * 1.25
```

#### ✅ CORRECT (Parameterized Function)

```pine
// Single parameterized function - works for any HTF
is_displacement_candle(float o2, float c2, float o3, float c3, float o4, float c4) =>
    float c2_body = math.abs(c2 - o2)
    float avg_body = (math.abs(c3 - o3) + math.abs(c4 - o4)) / 2
    c2_body >= avg_body * 1.25

// Usage:
is_displacement_candle(htf_o2, htf_c2, htf_o3, htf_c3, htf_o4, htf_c4)   // HTF1
is_displacement_candle(htf2_o2, htf2_c2, htf2_o3, htf2_c3, htf2_o4, htf2_c4) // HTF2
```

### What MUST Be Separate (Unavoidable)

- **State variables** - Each context needs its own state (`htf_open` vs `htf2_open`)
- **Storage arrays** - Each context needs its own arrays (`gap_array` vs `gap_array_htf2`)

### What MUST Be Parameterized (No Duplication)

- **Detection functions** - Pass OHLC data as parameters
- **Calculation functions** - Pass values, don't read globals
- **Validation functions** - Accept the data they operate on

### Why This Matters

- Bugs fixed in one place are fixed everywhere
- Changes only need to be made once
- Code is easier to understand and maintain
- Reduces file size and cognitive load

## Never Add Subjective Commentary

**NEVER add subjective or editorial comments in code such as:**

- "(most important)"
- "(2nd most important)"
- "(3rd importance)"
- Any commentary about priority, ranking, or personal opinion
- Any parenthetical explanations that aren't objectively technical

**Only include comments that provide:**

- Technical clarification (e.g., "positioned after behavior")
- Context about behavior (e.g., "Reverse the array for bearish stacking")
- Warnings or constraints (e.g., "Must be called before X")

## Never Convert Color Formats Without Permission

**NEVER convert color constants between formats without explicit permission.**

### The Rule

- Do NOT convert hex colors to RGB (e.g., `#2962ff` → `color.rgb(41, 98, 255)`)
- Do NOT convert RGB to hex (e.g., `color.rgb(41, 98, 255)` → `#2962ff`)
- Do NOT convert named colors to RGB (e.g., `color.purple` → `color.rgb(155, 39, 176)`)
- Do NOT standardize color format syntax without asking first

### Why This Matters

Color format choices are intentional decisions:

- Hex values may come from design systems or brand guidelines
- RGB values may be programmatically calculated
- Named colors may be used for readability
- Converting formats changes the source code unnecessarily

### When User Says "standardize colors" or "make colors consistent"

**ASK FIRST** what format they want:

- "Should I convert all colors to `color.new(color.rgb(R, G, B), transparency)` format?"
- "Do you want hex, RGB, or named color formats?"
- Show examples of the current formats and proposed changes

### Exceptions

You may convert colors ONLY when:

1. User explicitly requests a specific format conversion
2. User provides explicit permission after seeing the proposed changes

## Always Keep Color Reference Table in Sync

**CORE PRINCIPLE: The color reference table must always reflect ALL color inputs in the indicator.**

### When Adding a Color

When adding ANY new color input to an indicator:

1. **Add to color reference table** - Create a new row with the color name, RGB values, and transparency
2. **Increase table row count** - Update `table.new()` to accommodate the new row
3. **Use consistent naming** - The table label should clearly identify what the color controls

### When Removing a Color

When removing ANY color input from an indicator:

1. **Remove from color reference table** - Delete the corresponding table row
2. **Decrease table row count** - Update `table.new()` to reflect fewer rows
3. **Update row indices** - Shift remaining row numbers if needed

### When Renaming a Color

When renaming a color variable:

1. **Update table label** - Change the display name in the table to match
2. **Update all references** - Variable name, input label, and table label should be consistent

### Why This Matters

The color reference table is a debugging and documentation tool. If it doesn't match the actual colors in the indicator, it becomes useless and misleading.

### Color Reference Table Design

The color reference table must follow this standard format:

```pine
// Helper function for DRY code
addColorRow(table tbl, int row, string name, color clr) =>
    table.cell(tbl, 0, row, name, text_size=size.small, text_color=color.black)
    table.cell(tbl, 1, row, str.format("R:{0} G:{1} B:{2}", int(color.r(clr)), int(color.g(clr)), int(color.b(clr))), text_size=size.small, text_color=color.black)
    table.cell(tbl, 2, row, str.tostring(int(color.t(clr))), text_size=size.small, text_color=color.black)

if show_color_table and barstate.islast
    var table color_table = table.new(position.top_right, 3, ROW_COUNT, bgcolor=color.white, border_width=1, border_color=color.gray, frame_width=1, frame_color=color.gray)

    // Header row
    table.cell(color_table, 0, 0, "Setting", bgcolor=color.new(color.gray, 50), text_color=color.white, text_size=size.small)
    table.cell(color_table, 1, 0, "RGB", bgcolor=color.new(color.gray, 50), text_color=color.white, text_size=size.small)
    table.cell(color_table, 2, 0, "Trans", bgcolor=color.new(color.gray, 50), text_color=color.white, text_size=size.small)

    // Data rows using counter (no magic numbers)
    int row = 1
    addColorRow(color_table, row, "Color Name", color_variable)
    row += 1
    // ... more rows
```

**Key requirements:**

1. **Helper function** - Use `addColorRow()` for DRY code
2. **White background** - `bgcolor=color.white` on the table
3. **Header text** - Use "Setting" (not "Color") as the first column header
4. **RGB format** - Use `R:{0} G:{1} B:{2}` format with `int()` to round values
5. **Row counter** - Use a `row` variable and increment it (no magic numbers like 1, 2, 3)
6. **Transparency** - Use `int(color.t(clr))` to round transparency values

# Git Command Rules

## Core Rule

**NEVER execute ANY git command without EXPLICIT permission for EACH specific command.**

## What This Means

- Do NOT run git commands proactively
- Do NOT assume permission from previous commands
- Do NOT batch git commands without asking
- ALWAYS wait for explicit approval for each git operation

## Examples

### ❌ WRONG

```
User: "the changes look good"
Assistant: *runs git add && git commit*
```

### ✅ CORRECT

```
User: "the changes look good"
Assistant: "Would you like me to stage and commit these changes?"
User: "yes"
Assistant: *asks* "Should I run 'git add' now?"
```

## Exceptions

None. This rule applies to ALL git commands including but not limited to:

- git add
- git commit
- git push
- git pull
- git checkout
- git branch
- git merge
- git rebase
- git stash
- git reset
- git restore
- git status (even read-only commands require permission)
- git diff (even read-only commands require permission)
- git log (even read-only commands require permission)

## When User Says "commit"

This is explicit permission ONLY for that specific commit operation. You must still:

1. Ask before running `git add` if files aren't staged
2. Ask before running `git status` to check current state
3. Only run `git commit` after receiving permission for each preceding command

## Enforcement

If you execute a git command without explicit permission, the user will interrupt and remind you of this rule. Always acknowledge and apologize when this occurs.

# Principal Engineer Delegation Rules

## Never Pre-Solve When Delegating

When asked to have the principal engineer fix or investigate something, describe ONLY the problem and symptoms. **NEVER** include:

- Proposed solutions or fixes
- Root cause analysis or theories
- Code path traces or suggested approaches
- "The fix is...", "The issue is probably...", "Replace X with Y"

The principal must debug independently with fresh eyes. Pre-feeding solutions biases the investigation and leads to implementing flawed logic.

### What to Include

- The symptom (what's wrong, what's expected)
- File paths
- User-provided context (screenshots, error messages)
- Which indicators are affected

### What to EXCLUDE

- Your analysis of why it's broken
- Your proposed fix
- Code snippets showing "the problem is here"
- Suggestions like "check this function" or "the issue is in the timing"

## Never Speculate Without Reading Code

**NEVER guess or speculate about root causes, solutions, or behavior without first reading the relevant code.** If you don't know, say "I don't know, let me read the code" — do not pattern-match against documentation, plan files, or prior conversations and present it as analysis.

- ❌ **WRONG**: Confidently explaining a root cause based on memory or plan docs without verifying against current code
- ✅ **CORRECT**: Reading the actual functions involved, then explaining what the code does

Speculation wastes time, erodes trust, and leads to wrong fixes. Read first, speak second.
