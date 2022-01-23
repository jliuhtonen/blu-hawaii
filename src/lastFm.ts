import got from "../node_modules/got/dist/source/index.js"
import { URLSearchParams } from "url"
import * as zod from "zod"
import crypto from "node:crypto"

const baseUrl = "https://ws.audioscrobbler.com/2.0"

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

export async function getSession(
  config: LastFmConfig,
  authToken: string,
): Promise<string> {
  const callParams = {
    api_key: config.apiKey,
    method: "auth.getSession",
    token: authToken,
  }
  const apiSignature = createApiSignature(callParams, config.apiSecret)
  const searchParams = {
    ...callParams,
    api_sig: apiSignature,
    format: "json",
  }
  const response = await got(baseUrl, { searchParams }).json()
  const parsedSession = sessionResponse.parse(response)
  return parsedSession.session.key
}

export function createApproveApiClientUrl(
  apiKey: string,
  authToken: string,
): string {
  const searchParams = new URLSearchParams({
    api_key: apiKey,
    token: authToken,
  })

  return `https://www.last.fm/api/auth/?${searchParams.toString()}`
}

function createApiSignature(
  params: Partial<Record<string, string | number>>,
  secret: string,
): string {
  const sortedParamPairsByKey = Object.entries(params).sort(([k1], [k2]) =>
    k1.localeCompare(k2, "en", { sensitivity: "base" }),
  )
  const keyValueStr = sortedParamPairsByKey.reduce(
    (str, [k, v]) => `${str}${k}${v}`,
    "",
  )
  const fullSignature = `${keyValueStr}${secret}`
  const hashedSignature = crypto
    .createHash("md5")
    .update(fullSignature)
    .digest("hex")
  return hashedSignature
}

const sessionResponse = zod.object({
  session: zod.object({
    name: zod.string(),
    key: zod.string(),
  }),
})

const tokenResponse = zod.object({
  token: zod.string(),
})
