import * as fs from "node:fs/promises"
import { LastFmApi } from "./lastFm.js"
import * as readline from "node:readline"

const rl = readline.createInterface(process.stdin, process.stdout)

const question = (text: string): Promise<string> => {
  return new Promise((res) => {
    rl.question(text, res)
  })
}

const persistSessionToken = async (
  sessionFilePath: string,
  token: string,
): Promise<void> => {
  await fs.writeFile(sessionFilePath, token, { encoding: "utf8", mode: 0o600 })
}

export const login = async (
  sessionFilePath: string,
  lastFm: LastFmApi,
): Promise<boolean> => {
  const sessionToken = await createNewSession(lastFm)
  const isLoggedIn = sessionToken !== undefined
  if (isLoggedIn) {
    await persistSessionToken(sessionFilePath, sessionToken)
  }
  return isLoggedIn
}

const createNewSession = async (
  lastFm: LastFmApi,
): Promise<string | undefined> => {
  const authToken = await lastFm.getAuthToken()
  const answer = await question(
    `Please approve the Last.fm API client at ${lastFm.createApproveApiClientUrl(
      authToken,
    )}\n Then type 'yes' followed by return to continue: `,
  )
  if (answer !== "yes") {
    return undefined
  } else {
    return await lastFm.getSession(authToken)
  }
}

export const loadSessionToken = async (
  sessionFilePath: string,
): Promise<string | undefined> => {
  try {
    return await fs.readFile(sessionFilePath, "utf8")
  } catch (e) {
    return undefined
  }
}
