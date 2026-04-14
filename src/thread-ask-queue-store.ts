import { randomUUID } from "crypto"
import { del, get, list, put } from "@vercel/blob"

export interface ThreadAskQueueRun {
  id: string
  threadId: string
  interactionId: string
  applicationId: string
  token: string
  channelId: string
  userId: string
  prompt: string
  createdAt: number
}

export interface StoredThreadAskQueueRun extends ThreadAskQueueRun {
  pathname: string
}

function requireBlobToken(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required for thread ask queue storage.")
  }
}

function safeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "-")
}

function runsPrefix(threadId: string): string {
  return `runtime/ask-queues/threads/${safeKey(threadId)}/runs/`
}

function runPath(threadId: string, createdAt: number, runId: string): string {
  return `${runsPrefix(threadId)}${createdAt}-${runId}.json`
}

async function readRun(pathname: string): Promise<StoredThreadAskQueueRun | undefined> {
  try {
    const result = await get(pathname, { access: "private" })
    if (!result || !("stream" in result)) {
      return undefined
    }

    const raw = JSON.parse(await new Response(result.stream).text()) as Partial<ThreadAskQueueRun>
    if (
      typeof raw.id !== "string" ||
      typeof raw.threadId !== "string" ||
      typeof raw.interactionId !== "string" ||
      typeof raw.applicationId !== "string" ||
      typeof raw.token !== "string" ||
      typeof raw.channelId !== "string" ||
      typeof raw.userId !== "string" ||
      typeof raw.prompt !== "string" ||
      typeof raw.createdAt !== "number"
    ) {
      return undefined
    }

    return {
      id: raw.id,
      threadId: raw.threadId,
      interactionId: raw.interactionId,
      applicationId: raw.applicationId,
      token: raw.token,
      channelId: raw.channelId,
      userId: raw.userId,
      prompt: raw.prompt,
      createdAt: raw.createdAt,
      pathname,
    }
  } catch {
    return undefined
  }
}

export class ThreadAskQueueStore {
  async listRuns(threadId: string): Promise<StoredThreadAskQueueRun[]> {
    requireBlobToken()

    const all: StoredThreadAskQueueRun[] = []
    let cursor: string | undefined

    do {
      const page = await list({
        prefix: runsPrefix(threadId),
        limit: 1000,
        cursor,
      })

      const runs = await Promise.all(page.blobs.map((blob) => readRun(blob.pathname)))
      all.push(...runs.filter((run): run is StoredThreadAskQueueRun => Boolean(run)))
      cursor = page.hasMore ? page.cursor : undefined
    } while (cursor)

    return all.sort((a, b) => a.createdAt - b.createdAt)
  }

  async enqueue(input: Omit<ThreadAskQueueRun, "id" | "createdAt">): Promise<{ run: StoredThreadAskQueueRun; aheadCount: number; duplicate: boolean }> {
    const existing = await this.listRuns(input.threadId)
    const duplicate = existing.find((run) => run.interactionId === input.interactionId)
    if (duplicate) {
      return {
        run: duplicate,
        aheadCount: existing.findIndex((run) => run.id === duplicate.id),
        duplicate: true,
      }
    }

    const createdAt = Date.now()
    const id = randomUUID()
    const pathname = runPath(input.threadId, createdAt, id)
    const run: ThreadAskQueueRun = { ...input, id, createdAt }

    await put(pathname, JSON.stringify(run), {
      access: "private",
      allowOverwrite: false,
      contentType: "application/json",
    })

    return {
      run: { ...run, pathname },
      aheadCount: existing.length,
      duplicate: false,
    }
  }

  async peekNextRun(threadId: string): Promise<StoredThreadAskQueueRun | undefined> {
    const runs = await this.listRuns(threadId)
    return runs[0]
  }

  async removeRun(run: Pick<StoredThreadAskQueueRun, "pathname">): Promise<void> {
    requireBlobToken()
    await del(run.pathname)
  }

  async clearThread(threadId: string): Promise<void> {
    const runs = await this.listRuns(threadId)
    if (runs.length === 0) {
      return
    }
    await del(runs.map((run) => run.pathname))
  }
}
