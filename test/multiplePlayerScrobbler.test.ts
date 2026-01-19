import { afterEach, before, describe, it } from "node:test"
import nock from "nock"
import path from "node:path"
import { pino } from "pino"
import { assertObservableResults } from "./util/rxUtil.ts"
import { trackStreamingResponse } from "./util/bluOsUtil.ts"
import type { Player } from "../src/bluOs/serviceDiscovery.ts"
import { createScrobbler } from "../src/scrobbler.ts"
import { createLastFmApi } from "../src/lastFm.ts"
import type { Configuration } from "../src/configuration.ts"
import assert from "node:assert"

const mockPlayerStatus = (
  player: Player,
  trackData: {
    artist: string
    album: string
    title: string
    secs: number
    totalLength: number
    state: string
    etag: string
    groupName?: string
  },
) => {
  const responseXml = trackData.groupName
    ? trackStreamingResponse(trackData).replace(
        "</status>",
        `<groupName>${trackData.groupName}</groupName></status>`,
      )
    : trackStreamingResponse(trackData)

  return nock(`http://${player.ip}:${player.port}`)
    .get("/Status")
    .query({
      timeout: "100",
    })
    .reply(200, responseXml)
}

const mockPlayerStatusWithEtag = (
  player: Player,
  etag: string,
  trackData: {
    artist: string
    album: string
    title: string
    secs: number
    totalLength: number
    state: string
    etag: string
    groupName?: string
  },
) => {
  const responseXml = trackData.groupName
    ? trackStreamingResponse(trackData).replace(
        "</status>",
        `<groupName>${trackData.groupName}</groupName></status>`,
      )
    : trackStreamingResponse(trackData)

  return nock(`http://${player.ip}:${player.port}`)
    .get("/Status")
    .query({
      timeout: "100",
      etag,
    })
    .reply(200, responseXml)
}

describe("Multiple Player Scrobbler", () => {
  before(() => {
    nock.disableNetConnect()
  })

  it("should handle grouped players and individual player correctly with multiple status updates", async () => {
    const player1: Player = { ip: "192.168.1.100", port: 11000 }
    const player2: Player = { ip: "192.168.1.101", port: 11000 }
    const player3: Player = { ip: "192.168.1.102", port: 11000 }

    // Initial status updates for all players
    mockPlayerStatus(player1, {
      artist: "Group Artist",
      album: "Group Album",
      title: "Group Track",
      secs: 280,
      totalLength: 500,
      state: "stream",
      etag: "etag1",
      groupName: "Living Room",
    })

    mockPlayerStatus(player2, {
      artist: "Group Artist",
      album: "Group Album",
      title: "Group Track",
      secs: 280,
      totalLength: 500,
      state: "stream",
      etag: "etag2",
      groupName: "Living Room",
    })

    mockPlayerStatus(player3, {
      artist: "Solo Artist",
      album: "Solo Album",
      title: "Solo Track",
      secs: 300,
      totalLength: 500,
      state: "stream",
      etag: "etag3",
    })

    // Additional status updates with progress (same tracks, more time elapsed)
    mockPlayerStatusWithEtag(player1, "etag1", {
      artist: "Group Artist",
      album: "Group Album",
      title: "Group Track",
      secs: 320,
      totalLength: 500,
      state: "stream",
      etag: "etag1-2",
      groupName: "Living Room",
    })

    mockPlayerStatusWithEtag(player2, "etag2", {
      artist: "Group Artist",
      album: "Group Album",
      title: "Group Track",
      secs: 320,
      totalLength: 500,
      state: "stream",
      etag: "etag2-2",
      groupName: "Living Room",
    })

    mockPlayerStatusWithEtag(player3, "etag3", {
      artist: "Solo Artist",
      album: "Solo Album",
      title: "Solo Track",
      secs: 350,
      totalLength: 500,
      state: "stream",
      etag: "etag3-2",
    })

    nock("https://ws.audioscrobbler.com")
      .persist()
      .post("/2.0")
      .reply((_, requestBody) => {
        const bodyStr =
          typeof requestBody === "string" ? requestBody : String(requestBody)

        if (bodyStr.includes("method=track.updateNowPlaying")) {
          if (bodyStr.includes("Group+Artist")) {
            return [
              200,
              {
                nowplaying: {
                  artist: { corrected: "0", "#text": "Group Artist" },
                  track: { corrected: "0", "#text": "Group Track" },
                  ignoredMessage: { code: "0", "#text": "" },
                  albumArtist: { corrected: "0", "#text": "" },
                  album: { corrected: "0", "#text": "Group Album" },
                },
              },
            ]
          } else if (bodyStr.includes("Solo+Artist")) {
            return [
              200,
              {
                nowplaying: {
                  artist: { corrected: "0", "#text": "Solo Artist" },
                  track: { corrected: "0", "#text": "Solo Track" },
                  ignoredMessage: { code: "0", "#text": "" },
                  albumArtist: { corrected: "0", "#text": "" },
                  album: { corrected: "0", "#text": "Solo Album" },
                },
              },
            ]
          }
        } else if (bodyStr.includes("method=track.scrobble")) {
          if (bodyStr.includes("Group+Artist")) {
            return [
              200,
              {
                scrobbles: {
                  scrobble: {
                    artist: { corrected: "0", "#text": "Group Artist" },
                    track: { corrected: "0", "#text": "Group Track" },
                    ignoredMessage: { code: "0", "#text": "" },
                    albumArtist: { corrected: "0", "#text": "" },
                    album: { corrected: "0", "#text": "Group Album" },
                  },
                },
              },
            ]
          } else if (bodyStr.includes("Solo+Artist")) {
            return [
              200,
              {
                scrobbles: {
                  scrobble: {
                    artist: { corrected: "0", "#text": "Solo Artist" },
                    track: { corrected: "0", "#text": "Solo Track" },
                    ignoredMessage: { code: "0", "#text": "" },
                    albumArtist: { corrected: "0", "#text": "" },
                    album: { corrected: "0", "#text": "Solo Album" },
                  },
                },
              },
            ]
          }
        }
        return [500, { error: "Unknown method or artist" }]
      })

    const config: Configuration = {
      log: { level: "debug", destination: { type: "stdout" } },
      lastFm: { apiKey: "api-key", apiSecret: "api-secret" },
      session: {
        filePath: path.join(
          import.meta.dirname,
          "testData",
          "blu-hawaii-session",
        ),
      },
      players: [player1, player2, player3],
    }

    const logger = pino({ level: "debug" })
    const { updatedNowPlayingTrack, scrobbledTrack } = await createScrobbler({
      config,
      logger,
      lastFm: createLastFmApi({ ...config.lastFm, logger }),
      sessionToken: "SESSIONTOKEN",
    })

    await Promise.all([
      assertObservableResults(updatedNowPlayingTrack, [
        {
          type: "success",
          result: {
            type: "known",
            value: {
              nowplaying: {
                artist: { value: "Group Artist", corrected: false },
                album: { value: "Group Album", corrected: false },
                albumArtist: { value: "", corrected: false },
                track: { value: "Group Track", corrected: false },
                ignoredMessage: { code: "0", value: "" },
              },
            },
          },
        },
        {
          type: "success",
          result: {
            type: "known",
            value: {
              nowplaying: {
                artist: { value: "Solo Artist", corrected: false },
                album: { value: "Solo Album", corrected: false },
                albumArtist: { value: "", corrected: false },
                track: { value: "Solo Track", corrected: false },
                ignoredMessage: { code: "0", value: "" },
              },
            },
          },
        },
      ]),

      assertObservableResults(scrobbledTrack, [
        {
          type: "success",
          result: {
            type: "known",
            value: {
              scrobbles: [
                {
                  scrobble: {
                    artist: { value: "Group Artist", corrected: false },
                    album: { value: "Group Album", corrected: false },
                    albumArtist: { value: "", corrected: false },
                    track: { value: "Group Track", corrected: false },
                    ignoredMessage: { code: "0", value: "" },
                  },
                },
              ],
            },
          },
        },
        {
          type: "success",
          result: {
            type: "known",
            value: {
              scrobbles: [
                {
                  scrobble: {
                    artist: { value: "Solo Artist", corrected: false },
                    album: { value: "Solo Album", corrected: false },
                    albumArtist: { value: "", corrected: false },
                    track: { value: "Solo Track", corrected: false },
                    ignoredMessage: { code: "0", value: "" },
                  },
                },
              ],
            },
          },
        },
      ]),
    ])

    assert(nock.isDone(), "Expected Last.fm API calls were made")
  })

  afterEach(() => {
    nock.cleanAll()
  })
})
