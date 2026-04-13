const MAX_SENDS_PER_WINDOW = 2
const WINDOW_MS = 5000
const MAX_429_RETRIES = 3

const queue: Array<() => void> = []
let sentInWindow = 0
let windowStart = Date.now()
let flushTimer: ReturnType<typeof setTimeout> | undefined

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resetWindowIfNeeded(): void {
  const now = Date.now()
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now
    sentInWindow = 0
  }
}

function queueDrain(delayMs: number): void {
  if (flushTimer) {
    return
  }

  flushTimer = setTimeout(() => {
    flushTimer = undefined
    void drainQueue()
  }, Math.max(1, delayMs))
}

async function drainQueue(): Promise<void> {
  resetWindowIfNeeded()

  while (queue.length > 0) {
    resetWindowIfNeeded()

    if (sentInWindow >= MAX_SENDS_PER_WINDOW) {
      const elapsed = Date.now() - windowStart
      queueDrain(WINDOW_MS - elapsed)
      return
    }

    const item = queue.shift()
    if (!item) {
      return
    }

    sentInWindow += 1
    item()
  }
}

function schedule<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      void run().then(resolve, reject)
    })
    void drainQueue()
  })
}

function parseRetryAfterMs(response: Response): number {
  const retryAfter = Number(response.headers.get("retry-after") || "")
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.ceil(retryAfter * 1000)
  }

  const resetAfter = Number(response.headers.get("x-ratelimit-reset-after") || "")
  if (Number.isFinite(resetAfter) && resetAfter > 0) {
    return Math.ceil(resetAfter * 1000)
  }

  return WINDOW_MS
}

export async function sendDiscordRateLimitedRequest(url: string, init: RequestInit): Promise<Response> {
  return await schedule(async () => {
    let response = await fetch(url, init)

    for (let attempt = 1; response.status === 429 && attempt < MAX_429_RETRIES; attempt += 1) {
      await sleep(parseRetryAfterMs(response))
      response = await fetch(url, init)
    }

    return response
  })
}
