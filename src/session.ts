import * as fs from "node:fs/promises"
import * as lastFm from "./lastFm.js"
import * as readline from "node:readline"

const rl = readline.createInterface(process.stdin, process.stdout)

export async function obtainSessionToken(
  sessionFilePath: string,
  lastFmConfig: lastFm.LastFmConfig,
): Promise<string | undefined> {
  const persistedSession = await loadSessionToken(sessionFilePath)
  if (persistedSession !== undefined) {
    return persistedSession
  } else {
    const sessionToken = await createNewSession(lastFmConfig)
    if (sessionToken !== undefined) {
      await persistSessionToken(sessionFilePath, sessionToken)
    }
    return sessionToken
  }
}

async function createNewSession(
  lastFmConfig: lastFm.LastFmConfig,
): Promise<string | undefined> {
  const authToken = await lastFm.getAuthToken(lastFmConfig.apiKey)
  const answer = await question(
    `Please approve the Last.fm API client at ${lastFm.createApproveApiClientUrl(
      lastFmConfig.apiKey,
      authToken,
    )}\n Then type 'yes' followed by return to continue: `,
  )
  if (answer !== "yes") {
    return undefined
  } else {
    return await lastFm.getSession(lastFmConfig, authToken)
  }
}

async function loadSessionToken(
  sessionFilePath: string,
): Promise<string | undefined> {
  try {
    return await fs.readFile(sessionFilePath, "utf8")
  } catch (e) {
    return undefined
  }
}

async function persistSessionToken(
  sessionFilePath: string,
  token: string,
): Promise<void> {
  await fs.writeFile(sessionFilePath, token, { encoding: "utf8", mode: 0o600 })
}

function question(text: string): Promise<string> {
  return new Promise((res) => {
    rl.question(text, res)
  })
}
