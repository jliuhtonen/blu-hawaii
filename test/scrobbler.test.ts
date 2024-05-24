import { after, afterEach, before, describe, it } from "node:test"
import nock from "nock"
import path from "node:path"
import { createScrobbler } from "../src/scrobbler.js"
import { Configuration } from "../src/configuration.js"
import { pino } from "pino"
import { createLastFmApi } from "../src/lastFm.js"
import assert from "node:assert"
import { gatherObservableResults } from "./util/rxUtil.js"
import { trackPlayingResponse } from "./util/bluOsUtil.js"

const createTestScrobbler = () => {
  const config: Configuration = {
    log: {
      level: "debug",
      destination: {
        type: "stdout",
      },
    },
    lastFm: {
      apiKey: "api-key",
      apiSecret: "api-secret",
    },
    session: {
      filePath: path.join(
        import.meta.dirname,
        "testData",
        "blu-hawaii-session",
      ),
    },
    bluOs: {
      ip: "10.0.0.10",
      port: 11000,
    },
  }
  const logger = pino({
    transport: {
      target: "pino-pretty",
    },
    level: config.log.level,
  })
  return createScrobbler({
    config,
    logger,
    lastFm: createLastFmApi({ ...config.lastFm, logger }),
    sessionToken: "SESSIONTOKEN",
  })
}

describe("Scrobbler", () => {
  before(() => {
    nock.disableNetConnect()
  })

  it("should update now playing track", async () => {
    nock("http://10.0.0.10:11000")
      .get("/Status")
      .query({
        timeout: "100",
      })
      .reply(
        200,
        trackPlayingResponse({
          artist: "Rättö ja Lehtisalo",
          album: "Valon nopeus",
          title: "Valonnopeus",
          secs: 10,
          totalLength: 100,
          state: "stream",
        }),
      )
    nock("https://ws.audioscrobbler.com")
      .post("/2.0")
      .matchHeader("content-type", "application/x-www-form-urlencoded")
      .matchHeader("accept", "application/json")
      .reply(200, {
        nowplaying: {
          artist: { corrected: "0", "#text": "Rättö ja Lehtisalo" },
          track: { corrected: "0", "#text": "Valonnopeus" },
          ignoredMessage: { code: "0", "#text": "" },
          albumArtist: { corrected: "0", "#text": "" },
          album: { corrected: "0", "#text": "Valon nopeus" },
        },
      })
    const { updatedNowPlayingTrack } = await createTestScrobbler()
    const nowPlayingTracks = await gatherObservableResults(
      updatedNowPlayingTrack,
      1,
    )
    assert.deepEqual(nowPlayingTracks, [
      {
        type: "success",
        result: {
          type: "known",
          value: {
            nowplaying: {
              artist: {
                value: "Rättö ja Lehtisalo",
                corrected: false,
              },
              album: {
                value: "Valon nopeus",
                corrected: false,
              },
              albumArtist: {
                value: "",
                corrected: false,
              },
              track: {
                value: "Valonnopeus",
                corrected: false,
              },
              ignoredMessage: {
                code: "0",
                value: "",
              },
            },
          },
        },
      },
    ])
  })

  afterEach(() => {
    nock.cleanAll()
  })
})
