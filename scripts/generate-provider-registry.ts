#!/usr/bin/env node

interface ModelsDevModel {
  id: string
  name?: string
}

interface ModelsDevProvider {
  env?: string[]
  models: Record<string, ModelsDevModel>
}

interface RegistryProvider {
  methods: Array<{ label: string }>
  models: Array<{ id: string; label?: string }>
}

const OAUTH_PROVIDER_LABELS: Record<string, string[]> = {
  chatgpt: ["OAuth (device flow)"],
}

function methodLabels(providerId: string, envVars: string[] | undefined): string[] {
  const oauth = OAUTH_PROVIDER_LABELS[providerId]
  if (oauth) {
    return oauth
  }
  if (!envVars || envVars.length === 0) {
    return ["No auth"]
  }
  return ["API Key"]
}

async function main(): Promise<void> {
  const response = await fetch("https://models.dev/api.json")
  if (!response.ok) {
    throw new Error(`Failed to fetch models.dev: ${response.status}`)
  }

  const data = (await response.json()) as Record<string, ModelsDevProvider>
  const registry: Record<string, RegistryProvider> = {}

  for (const [providerId, provider] of Object.entries(data)) {
    registry[providerId] = {
      methods: methodLabels(providerId, provider.env).map((label) => ({ label })),
      models: Object.values(provider.models || {}).map((model) => ({
        id: model.id,
        label: model.name,
      })),
    }
  }

  // Add bridge-specific auth-only providers that may not appear in models.dev.
  if (!registry.chatgpt) {
    registry.chatgpt = {
      methods: [{ label: "OAuth (device flow)" }],
      models: [],
    }
  }

  process.stdout.write(JSON.stringify(registry))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
