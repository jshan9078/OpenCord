export default function handler(
  _req: unknown,
  res: {
    statusCode: number
    setHeader(name: string, value: string): void
    end(body?: string): void
  },
): void {
  res.statusCode = 200
  res.setHeader("Content-Type", "application/json")
  res.end(
    JSON.stringify({
      ok: true,
      time: new Date().toISOString(),
      env: {
        discordPublicKey: Boolean(process.env.DISCORD_PUBLIC_KEY),
        discordBotToken: Boolean(process.env.DISCORD_BOT_TOKEN),
        githubToken: Boolean(process.env.GITHUB_TOKEN),
      },
    }),
  )
}
