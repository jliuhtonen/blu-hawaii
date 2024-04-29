import ky from "ky"
import { URLSearchParams } from "url"
import * as zod from "zod"
import crypto from "node:crypto"
import { Logger } from "pino"
import { z } from "zod"
import {
  asUrlEncodedFormData,
  knownValue,
  MaybeUnknown,
  unknownValue,
} from "./util.js"

const baseUrl = "https://ws.audioscrobbler.com/2.0"

export interface LastFmConfig {
  apiKey: string
  apiSecret: string
  logger: Logger
}

export interface LastFmTrack {
  artist: string
  track: string
  timestamp: number
  album?: string
  duration?: number
}

export const createLastFmApi = (config: LastFmConfig) => ({
  getAuthToken: () => getAuthToken(config.apiKey),
  getSession: (authToken: string) => getSession(config, authToken),
  createApproveApiClientUrl: (authToken: string) =>
    createApproveApiClientUrl(config.apiKey, authToken),
  scrobbleTrack: (sessionKey: string, track: LastFmTrack) =>
    scrobbleTrack(config, sessionKey, track),
  nowPlaying: (sessionKey: string, track: NowPlayingTrack) =>
    nowPlaying(config, sessionKey, track),
})

export type LastFmApi = ReturnType<typeof createLastFmApi>

async function getAuthToken(apiKey: string): Promise<string> {
  const searchParams = {
    method: "auth.gettoken",
    api_key: apiKey,
    format: "json",
  }
  const response = await ky(baseUrl, { searchParams }).json()
  return tokenResponse.parse(response).token
}

async function getSession(
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
  const response = await ky(baseUrl, { searchParams }).json()
  const parsedSession = sessionResponse.parse(response)
  config.logger.info({ msg: "Fetched Last.Fm session" })
  return parsedSession.session.key
}

function createApproveApiClientUrl(apiKey: string, authToken: string): string {
  const searchParams = new URLSearchParams({
    api_key: apiKey,
    token: authToken,
  })

  return `https://www.last.fm/api/auth/?${searchParams.toString()}`
}

async function scrobbleTrack(
  config: LastFmConfig,
  sessionKey: string,
  track: LastFmTrack,
): Promise<MaybeUnknown<ScrobblesResponse>> {
  config.logger.debug({ msg: "Scrobbling track", track })
  const callParams = {
    ...track,
    method: "track.scrobble",
    api_key: config.apiKey,
    sk: sessionKey,
  }

  const body = asUrlEncodedFormData({
    ...callParams,
    api_sig: createApiSignature(callParams, config.apiSecret),
    format: "json",
  })

  const response = await ky
    .post(baseUrl, {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
    .json()
  const maybeResponse = scrobblesResponse.safeParse(response)
  if (maybeResponse.success) {
    return knownValue(maybeResponse.data)
  } else {
    config.logger.error(maybeResponse.error, "Unable to parse response")
    return unknownValue(response)
  }
}

export interface NowPlayingTrack {
  artist: string
  track: string
  album?: string
}

async function nowPlaying(
  config: LastFmConfig,
  sessionKey: string,
  track: NowPlayingTrack,
): Promise<MaybeUnknown<NowPlayingResponse>> {
  config.logger.debug({ msg: "Updating now playing", track })
  const callParams = {
    ...track,
    method: "track.updateNowPlaying",
    api_key: config.apiKey,
    sk: sessionKey,
  }

  const body = asUrlEncodedFormData({
    ...callParams,
    api_sig: createApiSignature(callParams, config.apiSecret),
    format: "json",
  })

  const response = await ky
    .post(baseUrl, {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
    .json()
  const playingResponse = nowPlayingResponse.safeParse(response)
  if (playingResponse.success) {
    return knownValue(playingResponse.data)
  } else {
    config.logger.error(playingResponse.error, "Unable to parse response")
    return unknownValue(response)
  }
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

const textNode = zod.object({
  "#text": zod.string(),
})

const scrobbleInfoField = z
  .intersection(
    textNode,
    zod.object({
      corrected: zod.union([zod.literal("0"), zod.literal("1")]),
    }),
  )
  .transform((r) => ({
    value: r["#text"],
    corrected: r.corrected === "1",
  }))

const scrobble = zod.object({
  artist: scrobbleInfoField,
  album: scrobbleInfoField,
  albumArtist: scrobbleInfoField,
  track: scrobbleInfoField,
  ignoredMessage: z
    .intersection(
      textNode,
      z.object({
        code: z.string(),
      }),
    )
    .transform((v) => ({ code: v.code, value: v["#text"] })),
})

const scrobbleResponse = zod.object({
  scrobble,
})

const scrobblesResponse = zod
  .object({
    scrobbles: z.union([scrobbleResponse, z.array(scrobbleResponse)]),
  })
  .transform((r) =>
    Array.isArray(r.scrobbles) ? r : { scrobbles: [r.scrobbles] },
  )

const nowPlayingResponse = zod.object({
  nowplaying: scrobble,
})

export type ScrobblesResponse = z.infer<typeof scrobblesResponse>
export type NowPlayingResponse = z.infer<typeof nowPlayingResponse>
