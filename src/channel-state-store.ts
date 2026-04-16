/**
 * Persists state per Discord channel (provider, model, repo, branch, sessions).
 * Uses local filesystem for synchronous access.
 * Note: For serverless, use ChannelProjectStore for durable repo/branch persistence.
 */
import fs from "fs"
import { getConfigDir, getConfigPath } from "./storage-paths.js"

export interface ChannelState {
  channelId: string
  sandboxId?: string
  opencodePassword?: string
  activeProviderId?: string
  activeModelId?: string
  repoUrl?: string
  branch?: string
  projectName?: string
  threadId?: string
  pendingOAuth?: {
    providerId: string
    deviceAuthId?: string
    timestamp: number
  }
}

interface ChannelStateConfig {
  channels: Record<string, ChannelState>
}

function stateFilePath(): string {
  return getConfigPath("channel-state.json")
}

function ensureConfigDir(): void {
  const dir = getConfigDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function loadAll(): ChannelStateConfig {
  ensureConfigDir()
  const file = stateFilePath()
  if (!fs.existsSync(file)) {
    return { channels: {} }
  }
  return JSON.parse(fs.readFileSync(file, "utf-8")) as ChannelStateConfig
}

function saveAll(config: ChannelStateConfig): void {
  ensureConfigDir()
  fs.writeFileSync(stateFilePath(), JSON.stringify(config, null, 2))
}

export class ChannelStateStore {
  get(channelId: string): ChannelState {
    const config = loadAll()
    return config.channels[channelId] || { channelId }
  }

  set(state: ChannelState): void {
    const config = loadAll()
    config.channels[state.channelId] = {
      ...state,
    }
    saveAll(config)
  }

  setActiveProvider(channelId: string, providerId: string): ChannelState {
    const state = this.get(channelId)
    state.activeProviderId = providerId
    this.set(state)
    return state
  }

  setActiveModel(channelId: string, modelId: string): ChannelState {
    const state = this.get(channelId)
    state.activeModelId = modelId
    this.set(state)
    return state
  }

  setProject(channelId: string, repoUrl: string, branch: string, projectName?: string): ChannelState {
    const state = this.get(channelId)
    state.repoUrl = repoUrl
    state.branch = branch
    state.projectName = projectName
    this.set(state)
    return state
  }

  clearProject(channelId: string): ChannelState {
    const state = this.get(channelId)
    delete state.repoUrl
    delete state.branch
    delete state.projectName
    this.set(state)
    return state
  }
}

/**
 * Persists project info (repo, branch) per Discord channel using Vercel Blob.
 * This is separate from ChannelStateStore because Blob operations are async.
 */
import { get, put } from "@vercel/blob"
interface ChannelProjectConfig {
  channels: Record<string, { repoUrl?: string; branch?: string; projectName?: string }>
}

const PROJECT_BLOB_PATH = "runtime/channel-projects.json"

function requireBlobToken(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required for channel project storage.")
  }
}

async function loadProjects(): Promise<ChannelProjectConfig> {
  requireBlobToken()
  try {
    const result = await get(PROJECT_BLOB_PATH, { access: "private" })
    if (!result || !("stream" in result)) {
      return { channels: {} }
    }
    const text = await new Response(result.stream).text()
    return JSON.parse(text) as ChannelProjectConfig
  } catch {
    return { channels: {} }
  }
}

async function saveProjects(config: ChannelProjectConfig): Promise<void> {
  requireBlobToken()
  await put(PROJECT_BLOB_PATH, JSON.stringify(config, null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
  })
}

export class ChannelProjectStore {
  async getProject(channelId: string): Promise<{ repoUrl?: string; branch?: string; projectName?: string }> {
    const config = await loadProjects()
    return config.channels[channelId] || {}
  }

  async setProject(channelId: string, repoUrl: string, branch: string, projectName?: string): Promise<void> {
    const config = await loadProjects()
    config.channels[channelId] = { repoUrl, branch, projectName }
    await saveProjects(config)
  }

  async clearProject(channelId: string): Promise<void> {
    const config = await loadProjects()
    delete config.channels[channelId]
    await saveProjects(config)
  }
}
