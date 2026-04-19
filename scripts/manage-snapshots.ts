/**
 * Manage Vercel sandbox snapshots.
 * List, create, delete, and replace baseline snapshots.
 */
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { Sandbox, Snapshot } from "@vercel/sandbox"
import { SandboxManager } from "../src/sandbox-manager"

const USAGE = `
Usage: pnpm tsx scripts/manage-snapshots.ts <command> [options]

Commands:
  list                          List all snapshots
  create [--channel-id <id>]    Create a new baseline snapshot
  delete <snapshot-id>          Delete a snapshot
  replace <old-id> [--channel-id <id>]  Create new snapshot and delete old one

Options:
  --channel-id    Channel ID to use for sandbox name (default: "baseline")
  --expiration    Snapshot expiration in milliseconds (default: 7 days)
`

async function listSnapshots() {
  console.log("Fetching snapshots...")
  const result = await Snapshot.list()
  const snapshots = result.snapshots

  if (snapshots.length === 0) {
    console.log("No snapshots found.")
    return
  }

  console.log(`\nFound ${snapshots.length} snapshot(s):\n`)
  for (const snapshot of snapshots) {
    const createdAt = new Date(snapshot.createdAt).toISOString()
    const expiresAt = snapshot.expiresAt ? new Date(snapshot.expiresAt).toISOString() : "never"
    console.log(`ID:        ${snapshot.id}`)
    console.log(`Created:   ${createdAt}`)
    console.log(`Expires:   ${expiresAt}`)
    console.log(`Status:    ${snapshot.status}`)
    console.log(`Size:      ${(snapshot.sizeBytes / 1024 / 1024).toFixed(2)} MB`)
    console.log("---")
  }
}

async function createSnapshot(channelId: string, expirationMs?: number) {
  console.log(`Creating baseline snapshot for channel ${channelId}...`)
  const manager = new SandboxManager()
  const result = await manager.createRawBaselineSnapshot(channelId, expirationMs ?? 0)
  console.log(`\nSnapshot created: ${result.snapshotId}`)
  console.log(`Use this ID in your environment or pass to --replace`)
}

async function deleteSnapshot(snapshotId: string) {
  console.log(`Deleting snapshot ${snapshotId}...`)
  const snapshot = await Snapshot.get({ snapshotId })
  await snapshot.delete()
  console.log("Snapshot deleted.")
}

async function replaceSnapshot(oldSnapshotId: string, channelId: string, expirationMs?: number) {
  console.log(`Replacing snapshot ${oldSnapshotId}...`)

  console.log("\nStep 1: Creating new snapshot...")
  const manager = new SandboxManager()
  const result = await manager.createRawBaselineSnapshot(channelId, expirationMs ?? 0)
  console.log(`New snapshot created: ${result.snapshotId}`)

  console.log("\nStep 2: Deleting old snapshot...")
  const oldSnapshot = await Snapshot.get({ snapshotId: oldSnapshotId })
  await oldSnapshot.delete()
  console.log(`Old snapshot ${oldSnapshotId} deleted.`)

  console.log(`\nReplacement complete. New snapshot ID: ${result.snapshotId}`)
}

function parseArgs(args: string[]): { command: string; options: Record<string, string> } {
  const command = args[0]
  const options: Record<string, string> = {}

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i]
    const value = args[i + 1]
    if (key.startsWith("--") && value) {
      options[key.slice(2)] = value
    }
  }

  return { command, options }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(USAGE)
    process.exit(0)
  }

  const { command, options } = parseArgs(args)
  const channelId = options["channel-id"] || "baseline"
  const expiration = options.expiration ? parseInt(options.expiration, 10) : undefined

  try {
    switch (command) {
      case "list":
        await listSnapshots()
        break

      case "create":
        await createSnapshot(channelId, expiration)
        break

      case "delete":
        if (!args[1]) {
          console.error("Error: snapshot ID required")
          console.log(USAGE)
          process.exit(1)
        }
        await deleteSnapshot(args[1])
        break

      case "replace":
        if (!args[1]) {
          console.error("Error: old snapshot ID required")
          console.log(USAGE)
          process.exit(1)
        }
        await replaceSnapshot(args[1], channelId, expiration)
        break

      default:
        console.error(`Unknown command: ${command}`)
        console.log(USAGE)
        process.exit(1)
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
