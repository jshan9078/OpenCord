# Extensions

Custom extensions for the pi coding agent.

## Token Count Footer

**File:** `token-count-footer.ts`

This extension replaces the default footer with one that shows actual token counts instead of percentages.

### Default Behavior
Shows context usage as: `45.2%/200k (auto)`

### With Extension
Shows context usage as: `90.4k/200k (auto)`

### Usage

Run pi with the extension:

```bash
pi -e ./extensions/token-count-footer.ts
```

Or add it to your pi configuration to load it automatically.

### Features

- Shows actual token count used vs total context window
- Maintains color coding (yellow at 70%, red at 90%)
- Preserves all other footer information (pwd, git branch, model info, costs, etc.)
- Compatible with auto-compaction indicator
