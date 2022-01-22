import got from "../node_modules/got/dist/source/index.js"
import { URLSearchParams } from "url"
import * as zod from "zod"

const baseUrl = "http://ws.audioscrobbler.com/2.0"

export interface LastFmConfig {
  apiKey: string
  apiSecret: string
}

export async function getAuthToken(apiKey: string): Promise<string> {
  const searchParams = {
    method: "auth.gettoken",
    api_key: apiKey,
    format: "json",
  }
  const response = await got(baseUrl, { searchParams }).json()
  return tokenResponse.parse(response).token
}

export function createApproveApiClientUrl(
  apiKey: string,
  authToken: string,
): string {
  const searchParams = new URLSearchParams({
    api_key: apiKey,
    token: authToken,
  })

  return `http://www.last.fm/api/auth/?${searchParams.toString()}`
}

const tokenResponse = zod.object({
  token: zod.string(),
})
