# Discord AI Coding Agent - Quick Setup Guide

This guide gets you from nothing to working Discord bot in ~15 minutes.

---

## TL;DR

```
You need:
  1. Discord bot token     (5 min)
  2. Vercel account        (2 min)
  3. Run setup            (3 min)

Done. Start coding from Discord.
```

---

## Before You Start

You'll need accounts at:
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Vercel](https://vercel.com) (free hobby tier)

---

## Step 1: Get Discord Bot Token (5 min)

1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it (e.g., "Coding Bot")
3. Go to **Bot** → click **Reset Token** → copy it
4. Under **Privileged Gateway Intents** → enable **Message Content Intent**
5. Go to **OAuth2 → URL Generator**
6. Select scopes: `bot`
7. Select permissions: `Send Messages`, `Read Message History`, `Attach Files`
8. Copy the generated URL → open in browser → select your Discord server

**Token:** Save it for later.

---

## Step 2: Set Up Vercel (2 min)

1. Go to https://vercel.com → Sign up/Login
2. Create a new project (empty is fine - just needs to exist)
3. Run locally:
   ```bash
   vercel link
   vercel env pull
   ```
4. This creates `.env.local` with `VERCEL_OIDC_TOKEN`

---

## Step 3: Deploy the Serverless Bridge

```bash
# Deploy to Vercel
pnpm run deploy  # or `vercel deploy --prod`

# Set these environment variables in Vercel:
export DISCORD_APPLICATION_ID=...  # Discord application ID
export DISCORD_PUBLIC_KEY=...     # Discord app public key (hex)
export BRIDGE_SECRET=...          # >= 16 chars, for encrypting credentials
export GITHUB_TOKEN=...           # GitHub personal access token

# Provider API keys (optional - set for providers you want to use):
export OPENAI_API_KEY=sk-...      # OpenAI API key
export ANTHROPIC_API_KEY=sk-ant-... # Anthropic API key
export GOOGLE_GENERATIVEAI_API_KEY=... # Google AI API key
# etc - format: {PROVIDER}_API_KEY
```

### Register Discord Commands

Set the Interactions endpoint URL in Discord Developer Portal to:
- `https://<your-vercel-project>.vercel.app/api/discord/interactions`

Then register commands:

```bash
# Guild scope (fast updates, recommended while iterating)
DISCORD_APPLICATION_ID=... pnpm exec bun scripts/register-commands.ts

# Global scope (slower, for production)
DISCORD_APPLICATION_ID=... pnpm exec bun scripts/register-commands.ts
```

---

## Step 3.1: Configure Auth (via Environment Variables)

All provider credentials are set as environment variables in Vercel - no secrets in Discord.

### API Keys

For providers that use API keys (OpenAI, Anthropic, Google, etc.), just set the env var:

```
# In Vercel dashboard → Settings → Environment Variables
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVEAI_API_KEY=...
```

Format: `{PROVIDER}_API_KEY` (uppercase, underscores)

### OAuth Providers

For OAuth-based providers (ChatGPT Pro/Plus, etc.), you need to get tokens manually. The flow is:

1. User authenticates on their machine (outside Discord)
2. Tokens get stored somehow
3. Bridge passes tokens to sandbox

This requires more setup - check the auth docs for details.

---

## Step 4: Set a Project

In Discord, run:

```
/project select
```

This opens an interactive menu to select a GitHub repository and branch.

---

## Step 5: Start Coding

Now just send prompts:

```
/ask add a login feature
/ask fix the bug in auth.ts
/ask write tests for user.ts

# Provider/model controls
/providers
/models
/use-provider openai
/use-model openai/gpt-5.1-mini
```

---

## How It Works

```
Discord → Bridge → Vercel Sandbox
                    ↓
              Per channel sandbox
              (persistent, auto-save)
                    ↓
              OpenCode CLI
```

Each Discord channel gets its own persistent sandbox:
- Name: `discord-channel-{channelId}`
- Auto-saves on stop
- Resumes automatically on next message

---

## Common Issues

### Slash commands not responding

- Verify the Interactions endpoint URL is set in Discord Developer Portal
- Check Vercel function logs for errors

### "Provider needs auth"

- Run host-local auth commands from Step 3.1
- Do not paste API keys into Discord

### "GitHub not configured"

- Set `GITHUB_TOKEN` in Vercel environment variables

---

## Cost

| Item | Cost |
|------|------|
| Vercel Hobby | Free (4 CPU-hours/month, non-commercial) |
| Vercel Pro | $20/mo + usage (1M invocations, 1TB bandwidth included) |
| Per task | ~$0.01-0.03 typical |
| Idle | $0 |

Hobby plan handles ~100-200 typical tasks/month. Pro adds commercial use rights.
