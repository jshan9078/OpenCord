export default async function handler(): Promise<Response> {
  return new Response(
    JSON.stringify({
      ok: true,
      time: new Date().toISOString(),
      env: {
        discordPublicKey: Boolean(process.env.DISCORD_PUBLIC_KEY),
        discordBotToken: Boolean(process.env.DISCORD_BOT_TOKEN),
        githubToken: Boolean(process.env.GITHUB_TOKEN),
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  )
}
