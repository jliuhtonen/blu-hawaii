import { after, before, describe, it } from "node:test"
import nock from "nock"
import type { Player } from "../src/bluOs/serviceDiscovery.ts"
import { trackStreamingResponse } from "./util/bluOsUtil.ts"
import { createPlayersStatusObservable } from "../src/bluOs/player.ts"
import pino from "pino"
import { of } from "rxjs"
import {
  assertNumberOfObservableResults,
  assertObservableResults,
} from "./util/rxUtil.ts"

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

  it("should return status for multiple players properly", async () => {
    const numberOfPlayers = 20
    const players = generatePlayers(numberOfPlayers)
    mockPlayersStatus(players)

    const responseObservable = createPlayersStatusObservable(
      pino({
        // Avoid pino-pretty in tests/CI: it spawns a worker thread and can
        // introduce flakiness and extra handles on newer Node versions.
        level: "fatal",
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

  it("should keep numeric-only metadata as strings", async () => {
    const player: Player = { ip: "192.168.1.50", port: 11000 }
    const numericTrack = {
      artist: "311",
      album: "21",
      title: "1989",
      secs: 5,
      totalLength: 100,
      state: "stream",
      etag: "numEtag",
    }
    nock(`http://${player.ip}:${player.port}`)
      .get("/Status")
      .query({ timeout: "100" })
      .reply(200, trackStreamingResponse(numericTrack))
      .get("/Status")
      .query({ timeout: "100", etag: "numEtag" })
      .reply(200, trackStreamingResponse(numericTrack))

    const responseObservable = createPlayersStatusObservable(
      pino({ level: "fatal" }),
      of([player]),
    )

    await assertObservableResults(responseObservable, [
      {
        etag: "numEtag",
        playingTrack: {
          artist: "311",
          album: "21",
          title: "1989",
          secs: 5,
          totalLength: 100,
          state: "stream",
        },
      },
    ])
  })

  it("should decode numeric character references in metadata", async () => {
    const player: Player = { ip: "192.168.1.51", port: 11000 }
    const escapedTrack = {
      artist: "Guns N&#39; Roses",
      album: "Punk Goes 80&#x27;s",
      title: "Cities In Dust (7&#34; Version) &amp; More",
      secs: 5,
      totalLength: 100,
      state: "stream",
      etag: "entityEtag",
    }
    nock(`http://${player.ip}:${player.port}`)
      .get("/Status")
      .query({ timeout: "100" })
      .reply(200, trackStreamingResponse(escapedTrack))
      .get("/Status")
      .query({ timeout: "100", etag: "entityEtag" })
      .reply(200, trackStreamingResponse(escapedTrack))

    const responseObservable = createPlayersStatusObservable(
      pino({ level: "fatal" }),
      of([player]),
    )

    await assertObservableResults(responseObservable, [
      {
        etag: "entityEtag",
        playingTrack: {
          artist: "Guns N' Roses",
          album: "Punk Goes 80's",
          title: 'Cities In Dust (7" Version) & More',
          secs: 5,
          totalLength: 100,
          state: "stream",
        },
      },
    ])
  })

  it("should not expand DOCTYPE-declared entities", async () => {
    const player: Player = { ip: "192.168.1.52", port: 11000 }
    const track = {
      artist: "Artist",
      album: "Album",
      title: "&boom;",
      secs: 5,
      totalLength: 100,
      state: "stream",
      etag: "doctypeEtag",
    }
    const response = trackStreamingResponse(track).replace(
      "<status ",
      '<!DOCTYPE status [<!ENTITY boom "BOOM">]>\n<status ',
    )
    nock(`http://${player.ip}:${player.port}`)
      .get("/Status")
      .query({ timeout: "100" })
      .reply(200, response)
      .get("/Status")
      .query({ timeout: "100", etag: "doctypeEtag" })
      .reply(200, response)

    const responseObservable = createPlayersStatusObservable(
      pino({ level: "fatal" }),
      of([player]),
    )

    await assertObservableResults(responseObservable, [
      {
        etag: "doctypeEtag",
        playingTrack: {
          artist: "Artist",
          album: "Album",
          title: "&boom;",
          secs: 5,
          totalLength: 100,
          state: "stream",
        },
      },
    ])
  })
})
