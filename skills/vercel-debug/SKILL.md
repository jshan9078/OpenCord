---
name: vercel-debug
description: Debug Vercel deployments using CLI tools like vercel logs and vercel blob. Use this skill when the user asks to check Vercel logs, inspect Blob storage, or investigate deployment issues.
license: Complete terms in LICENSE.txt
---

This skill provides workflows for debugging Vercel deployments, including viewing logs and inspecting Blob storage.

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

**Verify installation:**
```bash
which vercel
# or
/Users/jonathan/Library/pnpm/vercel --version
```

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
/Users/jonathan/Library/pnpm/vercel blob get runtime/thread-locks/1234567890

# Save to file
/Users/jonathan/Library/pnpm/vercel blob get runtime/thread-locks/1234567890 --output /tmp/lock.json
```

### Deleting blobs (for testing)
```bash
/Users/jonathan/Library/pnpm/vercel blob del runtime/thread-locks/1234567890
```

### Managing stores
```bash
# List all stores
/Users/jonathan/Library/pnpm/vercel blob list-stores --all

# Get store details
/Users/jonathan/Library/pnpm/vercel blob get-store [store-id]
```

## Storage Paths

Thread data is stored in these Blob prefixes:
- `runtime/threads/[threadId].json` - Thread runtime state (sandbox, session)
- `runtime/thread-locks/[threadId].json` - Active lock for queue processing
- `runtime/thread-queues/[threadId].json` - Queued `/ask` runs

Queue format:
```json
{
  "runs": [
    {
      "id": "run_abc123",
      "interactionId": "...",
      "prompt": "what is 2+2",
      "createdAt": 1713123456000
    }
  ]
}
```

Lock format:
```json
{
  "runId": "run_abc123",
  "interactionId": "queue:1234567890",
  "startedAt": 1713123456000,
  "expiresAt": 1713123516000
}
```

## Common Debug Workflows

### Check if a thread has an active lock
```bash
/Users/jonathan/Library/pnpm/vercel blob get runtime/thread-locks/[threadId]
```

### View queued requests for a thread
```bash
/Users/jonathan/Library/pnpm/vercel blob get runtime/thread-queues/[threadId]
```

### View thread runtime state
```bash
/Users/jonathan/Library/pnpm/vercel blob get runtime/threads/[threadId]
```

### List all threads with locks or queues
```bash
/Users/jonathan/Library/pnpm/vercel blob list --prefix runtime/thread-locks/
/Users/jonathan/Library/pnpm/vercel blob list --prefix runtime/thread-queues/
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

- Logs: `/Users/jonathan/Desktop/discord-bridge/docs/vercel-logs.md`
- Blob CLI: `/Users/jonathan/Desktop/discord-bridge/docs/vercel-blob-cli.md`