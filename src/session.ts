import * as fs from "node:fs/promises"
import * as lastFm from "./lastFm.js"
import * as readline from "node:readline"

const sessionFile = ".blu-hawaii-session"

const rl = readline.createInterface(process.stdin, process.stdout)

export async function obtainSessionToken(
  lastFmConfig: lastFm.LastFmConfig,
): Promise<string | undefined> {
  const persistedSession = await loadSessionToken()
  if (persistedSession !== undefined) {
    return persistedSession
  } else {
    const sessionToken = await createNewSession(lastFmConfig)
    if (sessionToken !== undefined) {
      await persistSessionToken(sessionToken)
    }
    return sessionToken
  }
}

async function createNewSession(
  lastFmConfig: lastFm.LastFmConfig,
): Promise<string | undefined> {
  const authToken = await lastFm.getAuthToken(lastFmConfig.apiKey!!)
  const answer = await question(
    `Please approve the Last.fm API client at ${lastFm.createApproveApiClientUrl(
      lastFmConfig.apiKey!!,
      authToken,
    )}\n Then type 'yes' followed by return to continue: `,
  )
  if (answer !== "yes") {
    return undefined
  } else {
    return await lastFm.getSession(lastFmConfig, authToken)
  }
}

async function loadSessionToken(): Promise<string | undefined> {
  try {
    return await fs.readFile(sessionFile, "utf8")
  } catch (e) {
    return undefined
  }
}

async function persistSessionToken(token: string): Promise<void> {
  await fs.writeFile(sessionFile, token, { encoding: "utf8", mode: 0o600 })
}

function question(text: string): Promise<string> {
  return new Promise((res) => {
    rl.question(text, res)
  })
}
