# Snapshot Management

## Overview

Baseline snapshots include OpenCode, GitHub CLI (gh), and uv package manager pre-installed. Use snapshots to avoid reinstalling these tools on every sandbox creation.

**Baseline snapshots have no expiration** - they persist indefinitely until manually replaced.

## Creating a Baseline Snapshot

```bash
pnpm tsx scripts/manage-snapshots.ts create
```

This creates a snapshot with:
- OpenCode server
- GitHub CLI (gh)
- uv package manager
- Git configuration
- User config from Blob storage

Options:
- `--channel-id <id>` - Channel ID for sandbox naming (default: "baseline")
- `--expiration <ms>` - Expiration time in milliseconds (default: 0 = no expiration)

## Listing Snapshots

```bash
pnpm tsx scripts/manage-snapshots.ts list
```

Shows all snapshots with ID, creation date, expiration, status, and size.

## Replacing a Snapshot

To replace an old baseline snapshot with a new one:

```bash
pnpm tsx scripts/manage-snapshots.ts replace <old-snapshot-id>
```

This:
1. Creates a new baseline snapshot
2. Deletes the old snapshot

Options:
- `--channel-id <id>` - Channel ID for sandbox naming
- `--expiration <ms>` - Expiration time in milliseconds

## Deleting a Snapshot

```bash
pnpm tsx scripts/manage-snapshots.ts delete <snapshot-id>
```

## Using Snapshots

Set the `BASELINE_SNAPSHOT_ID` environment variable to use a specific snapshot when creating sandboxes:

```bash
BASELINE_SNAPSHOT_ID=snap_abc123 pnpm dev
```

Or pass it programmatically when initializing the sandbox manager.

## What's Included in Baseline

The baseline snapshot includes:

- **OpenCode** - AI coding assistant server
- **GitHub CLI (gh)** - GitHub command-line tool
- **uv** - Fast Python package installer
- **Git** - Version control with configured user info
- **Config files** - OpenCode config from Blob storage
- **Auth** - API keys from environment variables

## Expiration & Fallback

Baseline snapshots are created with **no expiration** (`expiration: 0`). They persist indefinitely.

If a snapshot becomes invalid or corrupted:
- The system automatically detects the failure when creating a new sandbox
- A fresh baseline snapshot is created on-the-fly
- The user experiences no interruption
- The old snapshot ID is replaced in storage

## Package Managers Available

| Runtime | Pre-installed | Notes |
|---------|---------------|-------|
| node24 (default) | npm, pnpm, uv | uv installed via script |
| node22 | npm, pnpm, uv | uv installed via script |
| python3.13 | pip, uv, npm, pnpm | pip pre-installed, uv added |

## Updating the Baseline

When you need to update what's included in the baseline:

1. Modify `sandbox-manager.ts` `createRawBaselineSnapshot()` method
2. Run: `pnpm tsx scripts/manage-snapshots.ts replace <current-snapshot-id>`
3. Update `BASELINE_SNAPSHOT_ID` env var if needed
