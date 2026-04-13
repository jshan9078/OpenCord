import { get, put } from "@vercel/blob"

export interface ThreadSandboxState {
  sandboxId: string
  opencodePassword: string
  updatedAt: number
}

function requireBlobToken(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required for thread sandbox storage.")
  }
}

function threadPath(threadId: string): string {
  return `sandboxes/threads/${threadId}.json`
}

export class ThreadSandboxStore {
  async get(threadId: string): Promise<ThreadSandboxState | undefined> {
    requireBlobToken()

    try {
      const result = await get(threadPath(threadId), { access: "private" })
      if (!result || !("stream" in result)) {
        return undefined
      }

      const text = await new Response(result.stream).text()
      const parsed = JSON.parse(text) as Partial<ThreadSandboxState>
      if (!parsed.sandboxId || !parsed.opencodePassword) {
        return undefined
      }

      return {
        sandboxId: parsed.sandboxId,
        opencodePassword: parsed.opencodePassword,
        updatedAt: parsed.updatedAt || Date.now(),
      }
    } catch {
      return undefined
    }
  }

  async set(threadId: string, state: Omit<ThreadSandboxState, "updatedAt">): Promise<void> {
    requireBlobToken()
    await put(
      threadPath(threadId),
      JSON.stringify({
        sandboxId: state.sandboxId,
        opencodePassword: state.opencodePassword,
        updatedAt: Date.now(),
      }),
      {
        access: "private",
        allowOverwrite: true,
        contentType: "application/json",
      },
    )
  }

  async clear(threadId: string): Promise<void> {
    requireBlobToken()
    await put(threadPath(threadId), JSON.stringify({}), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
    })
  }
}
