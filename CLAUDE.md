# Code Quality Rules

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
