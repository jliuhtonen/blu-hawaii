import { after, before, describe, it, mock } from "node:test"
import nock from "nock"
import type { Player } from "../src/bluOs/serviceDiscovery.ts"
import { trackStreamingResponse } from "./util/bluOsUtil.ts"
import { createPlayersStatusObservable } from "../src/bluOs/player.ts"
import pino from "pino"
import { of } from "rxjs"
import { assertNumberOfObservableResults } from "./util/rxUtil.ts"

const generatePlayers = (count: number): Player[] => {
  const players: Player[] = []
  for (let i = 0; i < count; i++) {
    players.push({
      ip: `192.168.1.${i}`,
      port: 11000,
    })
  }
  return players
}

const mockPlayersStatus = (players: Player[]) => {
  players.forEach((player, i) => {
    nock(`http://${player.ip}:${player.port}`)
      .get("/Status")
      .query({
        timeout: "100",
      })
      .delay(i * 100)
      .reply(
        200,
        trackStreamingResponse({
          artist: `Artist${i}`,
          title: `Title${i}`,
          album: `Album${i}`,
          secs: i,
          totalLength: 100,
          state: "stream",
          etag: `etag${i}`,
        }),
      )
      .get("/Status")
      .query({
        timeout: "100",
        etag: `etag${i}`,
      })
      .delay(i * 100)
      .reply(
        200,
        trackStreamingResponse({
          artist: `Artist${i}`,
          title: `Title${i}`,
          album: `Album${i}`,
          secs: 100 - i,
          totalLength: 100,
          state: "stream",
          etag: `etag${i}`,
        }),
      )
  })
}

describe("BluOS player status", () => {
  before(() => {
    nock.disableNetConnect()
  })

  after(() => {
    nock.cleanAll()
    nock.enableNetConnect()
  })

  mock.timers.enable({ apis: ["setTimeout"] })

  it("should return status for multiple players properly", async () => {
    const numberOfPlayers = 20
    const players = generatePlayers(numberOfPlayers)
    mockPlayersStatus(players)

    const responseObservable = createPlayersStatusObservable(
      pino({
        transport: {
          target: "pino-pretty",
        },
        level: "debug",
      }),
      of(players),
    )

    await assertNumberOfObservableResults(
      responseObservable,
      numberOfPlayers * 2,
      // Node 25 CI can have more scheduling jitter; leave some headroom.
      15000,
    )
  })
})
