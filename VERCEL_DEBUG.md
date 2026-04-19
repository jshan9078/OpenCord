# Vercel Debug Guide

## Vercel CLI

**CRITICAL**: Use the full path to run the CLI:
```
/Users/jonathan/Library/pnpm/vercel
```

The vercel command may not be in PATH. Always use the full path.

**Recommended**: Add to shell config (~/.zshrc):
```bash
alias vercel='/Users/jonathan/Library/pnpm/vercel'
alias vlogs='/Users/jonathan/Library/pnpm/vercel logs'
alias vblob='/Users/jonathan/Library/pnpm/vercel blob'
```

Then use as: `vlogs --follow` or `vblob list --prefix runtime/`

### Deployment from Local Environment

**CRITICAL**: When running `vercel --prod` locally in a linked project directory, it deploys **local files**, not git. This can cause issues:
- Build may fail but deployment uses cached artifacts
- Environment differences between local and Vercel's build system

**Recommended workflow for deploying code changes:**
1. Commit changes to git
2. Push to remote (triggers git integration auto-deploy)

**Do NOT run `vercel --prod` directly** to deploy code changes from this environment. Use git push instead.

## Viewing Logs

### Live log streaming
```bash
/Users/jonathan/Library/pnpm/vercel logs --follow
```

### Recent logs with filters
```bash
# Error logs from last hour
/Users/jonathan/Library/pnpm/vercel logs --level error --since 1h

# Expand full messages
/Users/jonathan/Library/pnpm/vercel logs --expand --limit 20

# Search for specific error
/Users/jonathan/Library/pnpm/vercel logs --query "error" --since 30m

# Filter by status code
/Users/jonathan/Library/pnpm/vercel logs --status-code 500 --since 1h
```

Key options:
- `--follow` / `-f`: Stream live logs
- `--level error|warning|info|fatal`: Filter by level
- `--since 1h|30m|24h`: Time range
- `--expand` / `-x`: Show full messages (not truncated)
- `--query` / `-q`: Full-text search
- `--status-code 500|5xx`: Filter by HTTP status
- `--json` / `-j`: Output JSON for piping to jq

## Vercel Blob CLI

The Blob CLI manages persistent storage for runtime state.

### Listing blobs
```bash
# List all files in the default store
/Users/jonathan/Library/pnpm/vercel blob list

# Filter by prefix
/Users/jonathan/Library/pnpm/vercel blob list --prefix runtime/

# Limit results
/Users/jonathan/Library/pnpm/vercel blob list --limit 100
```

### Reading blob content
```bash
# Print to stdout
/Users/jonathan/Library/pnpm/vercel blob get runtime/threads/1234567890.json

# Save to file
/Users/jonathan/Library/pnpm/vercel blob get runtime/threads/1234567890.json --output /tmp/state.json
```

### Deleting blobs (for testing)
```bash
/Users/jonathan/Library/pnpm/vercel blob del runtime/thread-locks/1234567890.json
```

### Managing stores
```bash
# List all stores
/Users/jonathan/Library/pnpm/vercel blob list-stores --all

# Get store details
/Users/jonathan/Library/pnpm/vercel blob get-store [store-id]
```

## Storage Paths

All blob operations require `BLOB_READ_WRITE_TOKEN`. Paths used by discord-bridge:

### Thread Runtime (`src/thread-runtime-store.ts`)
- `runtime/threads/[threadId].json` — Thread state (sandboxName, opencodePassword, sessionId)
- `runtime/thread-locks/[threadId].json` — Active run lock for queue processing

Thread state format:
```json
{
  "sandboxName": "sandbox-name",
  "opencodePassword": "...",
  "sessionId": "...",
  "updatedAt": 1713123456000
}
```

Thread lock format:
```json
{
  "runId": "uuid",
  "interactionId": "...",
  "startedAt": 1713123456000,
  "expiresAt": 1713123516000
}
```

### Thread Ask Queue (`src/thread-ask-queue-store.ts`)
- `runtime/ask-queues/threads/[safeKey(threadId)]/runs/[createdAt]-[runId].json` — Individual queued runs

Each run is a separate file (not a single queue array). Format:
```json
{
  "id": "run_abc123",
  "threadId": "...",
  "interactionId": "...",
  "applicationId": "...",
  "token": "...",
  "channelId": "...",
  "userId": "...",
  "prompt": "what is 2+2",
  "createdAt": 1713123456000
}
```

### Channel Projects (`src/channel-state-store.ts`)
- `runtime/channel-projects.json` — Channel-to-project mappings (all channels in one file)

Format:
```json
{
  "channels": {
    "channelId": {
      "repoUrl": "...",
      "branch": "...",
      "projectName": "..."
    }
  }
}
```

### Workspace Entries (`src/workspace-entry-store.ts`)
- `runtime/workspaces/users/[safeKey(userId)]/[safeKey(project)].json` — Workspace entries per user/project
- `runtime/workspaces/threads/[safeKey(threadId)].json` — Thread bindings
- `runtime/workspaces/raw-baseline.json` — Raw baseline snapshot reference

### Opencode Config (`src/sandbox-manager.ts`)
- `opencode-config/config-bundle.json` — Bundled `~/.config/opencode` config (optional, via `OPENCODE_CONFIG_BLOB_PATH`)

## Common Debug Workflows

### Check if a thread has an active lock
```bash
/Users/jonathan/Library/pnpm/vercel blob get runtime/thread-locks/[threadId].json
```

### View queued requests for a thread
```bash
/Users/jonathan/Library/pnpm/vercel blob list --prefix runtime/ask-queues/threads/[safeKey(threadId)]/runs/
```

### View thread runtime state
```bash
/Users/jonathan/Library/pnpm/vercel blob get runtime/threads/[threadId].json
```

### View channel project mappings
```bash
/Users/jonathan/Library/pnpm/vercel blob get runtime/channel-projects.json
```

### List all threads with locks
```bash
/Users/jonathan/Library/pnpm/vercel blob list --prefix runtime/thread-locks/
```

### List all queued runs across threads
```bash
/Users/jonathan/Library/pnpm/vercel blob list --prefix runtime/ask-queues/
```

### Search logs for specific thread
```bash
/Users/jonathan/Library/pnpm/vercel logs --query "threadId:1234567890" --since 1h
```

### Search logs for specific stage
```bash
/Users/jonathan/Library/pnpm/vercel logs --query "ask.stage" --since 1h
```

### Follow logs in real-time while testing
```bash
/Users/jonathan/Library/pnpm/vercel logs --follow --level error
```

## Documentation References

- Logs: `docs/vercel-logs.md`
- Blob CLI: `docs/vercel-blob-cli.md`
- Blob SDK: `docs/vercel-blob-sdk-reference.md`
