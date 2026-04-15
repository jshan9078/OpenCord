/**
 * Bootstraps provider credentials into OpenCode session.
 * Checks stored credentials, syncs to runtime, returns auth status.
 */
import type { RuntimeClientAdapter } from "./prompt-orchestrator.js"
import type { CredentialStore } from "./credential-store.js"
import type { ProviderRegistry } from "./provider-registry.js"

export type AuthResult =
  | { type: "ok" }
  | { type: "needs_local_oauth" }
  | { type: "needs_local_api_key" }

function providerEnvCandidates(providerId: string): string[] {
  const normalized = providerId.toUpperCase().replace(/[^A-Z0-9]/g, "_")
  const candidates = [
    `${normalized}_API_KEY`,
  ]

  if (providerId === "google") {
    candidates.push("GOOGLE_GENERATIVEAI_API_KEY")
  }

  return candidates
}

function getProviderApiKeyFromEnv(providerId: string): string | undefined {
  const candidates = providerEnvCandidates(providerId)
  console.log("[AuthBootstrap] Looking for env vars:", candidates)
  for (const key of candidates) {
    const value = process.env[key]
    if (typeof value === "string" && value.trim().length > 0) {
      console.log("[AuthBootstrap] Found env var:", key)
      return value.trim()
    }
  }
  console.log("[AuthBootstrap] No env API key found for", providerId)
  return undefined
}

export async function ensureProviderAuth(
  client: RuntimeClientAdapter,
  registry: ProviderRegistry,
  credentials: CredentialStore,
  providerId: string,
): Promise<AuthResult> {
  if (providerId === "opencode") {
    return { type: "ok" }
  }

  const provider = registry.getProvider(providerId)
  if (!provider) {
    return { type: "needs_local_oauth" }
  }

  const stored = credentials.getProviderAuth(providerId)
  if (stored) {
    try {
      await client.auth.set({ path: { id: providerId }, body: stored })
      return { type: "ok" }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error))
      console.log("[AuthBootstrap] Stored auth set failed:", errorMsg)
      // Continue to try auth methods
    }
  }

  const methods = provider.methods
  const hasOAuth = methods.some((m) => m.kind === "oauth")
  const hasApiKey = methods.some((m) => m.kind === "api-key")
  const envApiKey = getProviderApiKeyFromEnv(providerId)

  if (envApiKey) {
    console.log("[AuthBootstrap] Found env API key for", providerId)
    try {
      await client.auth.set({ path: { id: providerId }, body: { type: "api-key", api_key: envApiKey } })
      console.log("[AuthBootstrap] Env API key auth set succeeded for", providerId)
      return { type: "ok" }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error))
      console.log("[AuthBootstrap] Env API key auth set failed:", errorMsg)
      // Continue to try other auth methods
    }
  }

  if (hasApiKey && !stored) {
    return { type: "needs_local_api_key" }
  }
  if (hasOAuth && !stored) {
    return { type: "needs_local_oauth" }
  }

  return { type: "ok" }
}
