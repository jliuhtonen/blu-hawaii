import { after, afterEach, before, beforeEach, describe, it } from "node:test"
import nock from "nock"
import path from "node:path"
import { createScrobbler } from "../src/scrobbler.js"
import { Configuration } from "../src/configuration.js"
import { pino } from "pino"
import { createLastFmApi } from "../src/lastFm.js"
import { assertObservableResults } from "./util/rxUtil.js"
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
          etag: "etag11",
        }),
      )
    nock("https://ws.audioscrobbler.com")
      .post(
        "/2.0",
        "artist=R%C3%A4tt%C3%B6+ja+Lehtisalo&album=Valon+nopeus&track=Valonnopeus&method=track.updateNowPlaying&api_key=api-key&sk=SESSIONTOKEN&api_sig=8830930383e3f16ccdf242330b1bd5b8&format=json",
      )
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
    await assertObservableResults(updatedNowPlayingTrack, [
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

  it("should update now playing track only once if there are many events", async () => {
    nock("http://10.0.0.10:11000")
      .get("/Status")
      .query({
        timeout: "100",
      })
      .reply(
        200,
        trackPlayingResponse({
          artist: "Convextion",
          album: "R-CNVX2",
          title: "Ebulience",
          secs: 20,
          totalLength: 558,
          state: "stream",
          etag: "etag21",
        }),
      )
    nock("https://ws.audioscrobbler.com")
      .post(
        "/2.0",
        "artist=Convextion&album=R-CNVX2&track=Ebulience&method=track.updateNowPlaying&api_key=api-key&sk=SESSIONTOKEN&api_sig=d1dfd4fc2b564ee91d7f2bb541e9bd48&format=json",
      )
      .matchHeader("content-type", "application/x-www-form-urlencoded")
      .matchHeader("accept", "application/json")
      .reply(200, {
        nowplaying: {
          artist: { corrected: "0", "#text": "Convextion" },
          track: { corrected: "0", "#text": "Ebulience" },
          ignoredMessage: { code: "0", "#text": "" },
          albumArtist: { corrected: "0", "#text": "" },
          album: { corrected: "0", "#text": "R-CNVX2" },
        },
      })
    const { updatedNowPlayingTrack } = await createTestScrobbler()
    await assertObservableResults(updatedNowPlayingTrack, [
      {
        type: "success",
        result: {
          type: "known",
          value: {
            nowplaying: {
              artist: {
                value: "Convextion",
                corrected: false,
              },
              album: {
                value: "R-CNVX2",
                corrected: false,
              },
              albumArtist: {
                value: "",
                corrected: false,
              },
              track: {
                value: "Ebulience",
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
