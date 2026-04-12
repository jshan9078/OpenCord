/**
 * Loads and refreshes the durable provider registry snapshot.
 * The snapshot is stored in Vercel Blob so slash commands do not depend on models.dev on every request.
 */
import { head, put } from "@vercel/blob"
import { classifyAuthMethod, ProviderRegistry, type ProviderRecord } from "./provider-registry.js"
import { loadProviderRegistryFromEnv } from "./provider-registry-env.js"

const REGISTRY_BLOB_PATH = "provider-registry/provider-registry.json"
const CACHE_TTL_MS = 5 * 60 * 1000

type RegistryDocument = Record<
  string,
  {
    methods?: Array<{ label: string }>
    models?: Array<{ id: string; label?: string; contextWindow?: number }>
  }
>

type ModelsDevModel = {
  id: string
  name?: string
  limit?: {
    context?: number
  }
}

type ModelsDevProvider = {
  env?: string[]
  models?: Record<string, ModelsDevModel>
}

let cachedRegistry: { registry: ProviderRegistry; expiresAt: number } | undefined

function toRegistry(document: RegistryDocument): ProviderRegistry {
  const registry = new ProviderRegistry()
  const providers: ProviderRecord[] = Object.entries(document).map(([id, value]) => ({
    id,
    methods: (value.methods || []).map((method) => ({
      label: method.label,
      kind: classifyAuthMethod(method.label),
    })),
    models: (value.models || []).map((model) => ({ id: model.id, label: model.label, contextWindow: model.contextWindow })),
  }))
  registry.setProviders(providers)
  return registry
}

function methodLabels(providerId: string, envVars: string[] | undefined): string[] {
  if (providerId === "chatgpt") {
    return ["OAuth (device flow)"]
  }
  if (!envVars || envVars.length === 0) {
    return ["No auth"]
  }
  return ["API Key"]
}

async function fetchModelsDevRegistryDocument(): Promise<RegistryDocument> {
  const response = await fetch("https://models.dev/api.json")
  if (!response.ok) {
    throw new Error(`Failed to fetch models.dev: ${response.status}`)
  }

  const data = (await response.json()) as Record<string, ModelsDevProvider>
  const document: RegistryDocument = {}

  for (const [providerId, provider] of Object.entries(data)) {
    document[providerId] = {
      methods: methodLabels(providerId, provider.env).map((label) => ({ label })),
      models: Object.values(provider.models || {}).map((model) => ({
        id: model.id,
        label: model.name,
        contextWindow: model.limit?.context,
      })),
    }
  }

  if (!document.chatgpt) {
    document.chatgpt = {
      methods: [{ label: "OAuth (device flow)" }],
      models: [],
    }
  }

  return document
}

async function fetchStoredRegistryDocument(): Promise<{ document: RegistryDocument; url: string } | undefined> {
  let blob
  try {
    blob = await head(REGISTRY_BLOB_PATH)
  } catch {
    return undefined
  }

  const response = await fetch(blob.url)
  if (!response.ok) {
    throw new Error(`Failed to fetch provider registry blob: ${response.status}`)
  }

  return {
    document: (await response.json()) as RegistryDocument,
    url: blob.url,
  }
}

function setRegistryCache(registry: ProviderRegistry): ProviderRegistry {
  cachedRegistry = {
    registry,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }
  return registry
}

export async function loadProviderRegistry(): Promise<ProviderRegistry> {
  if (cachedRegistry && cachedRegistry.expiresAt > Date.now()) {
    return cachedRegistry.registry
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const stored = await fetchStoredRegistryDocument()
      if (stored) {
        return setRegistryCache(toRegistry(stored.document))
      }
    } catch (error) {
      console.error("Failed to load stored provider registry:", error)
    }
  }

  return setRegistryCache(loadProviderRegistryFromEnv())
}

export async function refreshProviderRegistry(): Promise<{
  blobUrl: string
  providerCount: number
  modelCount: number
  created: boolean
}> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to create or update the provider registry blob.")
  }

  const document = await fetchModelsDevRegistryDocument()
  const payload = JSON.stringify(document)
  const existing = await fetchStoredRegistryDocument().catch(() => undefined)

  const blob = await put(REGISTRY_BLOB_PATH, payload, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  })

  const registry = toRegistry(document)
  setRegistryCache(registry)

  return {
    blobUrl: blob.url,
    providerCount: registry.listProviders().length,
    modelCount: registry.listProviders().reduce((sum, provider) => sum + provider.models.length, 0),
    created: !existing,
  }
}
