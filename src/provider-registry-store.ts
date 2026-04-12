/**
 * Loads and refreshes the durable provider registry snapshot.
 * The snapshot is stored in a GitHub gist so slash commands do not depend on models.dev on every request.
 */
import { classifyAuthMethod, ProviderRegistry, type ProviderRecord } from "./provider-registry.js"
import { loadProviderRegistryFromEnv } from "./provider-registry-env.js"

const REGISTRY_GIST_DESCRIPTION = "Discord Bridge provider registry"
const REGISTRY_GIST_FILENAME = "provider-registry.json"
const CACHE_TTL_MS = 5 * 60 * 1000

type RegistryDocument = Record<
  string,
  {
    methods?: Array<{ label: string }>
    models?: Array<{ id: string; label?: string }>
  }
>

type ModelsDevModel = {
  id: string
  name?: string
}

type ModelsDevProvider = {
  env?: string[]
  models?: Record<string, ModelsDevModel>
}

type GitHubGistSummary = {
  id: string
  html_url: string
  files?: Record<string, { filename?: string; raw_url?: string }>
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
    models: (value.models || []).map((model) => ({ id: model.id, label: model.label })),
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

async function githubRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "discord-bridge",
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function findRegistryGist(token: string): Promise<GitHubGistSummary | undefined> {
  const gists = await githubRequest<GitHubGistSummary[]>(token, "/gists?per_page=100")
  return gists.find((gist) => gist.files && REGISTRY_GIST_FILENAME in gist.files)
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

async function fetchStoredRegistryDocument(token: string): Promise<{ document: RegistryDocument; url: string } | undefined> {
  const gist = await findRegistryGist(token)
  const file = gist?.files?.[REGISTRY_GIST_FILENAME]
  const rawUrl = file?.raw_url
  if (!gist || !rawUrl) {
    return undefined
  }

  const response = await fetch(rawUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch provider registry gist: ${response.status}`)
  }

  return {
    document: (await response.json()) as RegistryDocument,
    url: gist.html_url,
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

  const token = process.env.GITHUB_TOKEN
  if (token) {
    try {
      const stored = await fetchStoredRegistryDocument(token)
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
  gistUrl: string
  providerCount: number
  modelCount: number
  created: boolean
}> {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error("GITHUB_TOKEN is required to create or update the provider registry gist.")
  }

  const document = await fetchModelsDevRegistryDocument()
  const payload = JSON.stringify(document)
  const existing = await findRegistryGist(token)

  const body = JSON.stringify({
    description: REGISTRY_GIST_DESCRIPTION,
    public: false,
    files: {
      [REGISTRY_GIST_FILENAME]: {
        content: payload,
      },
    },
  })

  const gist = existing
    ? await githubRequest<GitHubGistSummary>(token, `/gists/${existing.id}`, { method: "PATCH", body })
    : await githubRequest<GitHubGistSummary>(token, "/gists", { method: "POST", body })

  const registry = toRegistry(document)
  setRegistryCache(registry)

  return {
    gistUrl: gist.html_url,
    providerCount: registry.listProviders().length,
    modelCount: registry.listProviders().reduce((sum, provider) => sum + provider.models.length, 0),
    created: !existing,
  }
}
