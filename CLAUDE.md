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
