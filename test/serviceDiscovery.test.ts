import { describe, it } from "node:test"
import assert from "node:assert"
import { Observable, take, toArray, firstValueFrom } from "rxjs"
import { Player } from "../src/bluOs/serviceDiscovery.js"

describe("Service Discovery", () => {
  it("should discover multiple players progressively", async () => {
    const expectedPlayers: Player[] = [
      { ip: "192.168.1.100", port: 11000 },
      { ip: "192.168.1.101", port: 11000 },
      { ip: "192.168.1.102", port: 11001 },
    ]

    const mockDiscoveryObservable = new Observable<Player[]>((subscriber) => {
      setTimeout(() => subscriber.next([expectedPlayers[0]]), 10)
      setTimeout(
        () => subscriber.next([expectedPlayers[0], expectedPlayers[1]]),
        20,
      )
      setTimeout(() => subscriber.next(expectedPlayers), 30)
      setTimeout(() => subscriber.complete(), 40)
    })

    const discoveredPlayers = await firstValueFrom(
      mockDiscoveryObservable.pipe(take(3), toArray()),
    )

    assert.equal(discoveredPlayers.length, 3)
    assert.equal(discoveredPlayers[0].length, 1)
    assert.equal(discoveredPlayers[1].length, 2)
    assert.equal(discoveredPlayers[2].length, 3)

    const finalPlayers = discoveredPlayers[2]
    assert.deepEqual(finalPlayers, expectedPlayers)
  })

  it("should handle player disconnections", async () => {
    const mockDiscoveryWithDisconnection = new Observable<Player[]>(
      (subscriber) => {
        const allPlayers = [
          { ip: "192.168.1.100", port: 11000 },
          { ip: "192.168.1.101", port: 11000 },
        ]

        setTimeout(() => subscriber.next(allPlayers), 10)
        setTimeout(() => subscriber.next([allPlayers[0]]), 20)
        setTimeout(() => subscriber.complete(), 30)
      },
    )

    const results = await firstValueFrom(
      mockDiscoveryWithDisconnection.pipe(take(2), toArray()),
    )

    assert.equal(results.length, 2)
    assert.equal(results[0].length, 2)
    assert.equal(results[1].length, 1)
    assert.equal(results[1][0].ip, "192.168.1.100")
  })

  it("should handle duplicate announcements without creating duplicates", async () => {
    const mockDiscoveryWithDuplicates = new Observable<Player[]>(
      (subscriber) => {
        const player = { ip: "192.168.1.100", port: 11000 }

        setTimeout(() => subscriber.next([player]), 10)
        setTimeout(() => subscriber.next([player]), 20)
        setTimeout(() => subscriber.complete(), 30)
      },
    )

    const results = await firstValueFrom(
      mockDiscoveryWithDuplicates.pipe(take(2), toArray()),
    )

    assert.equal(results[0].length, 1)
    assert.equal(results[1].length, 1)
    assert.deepEqual(results[0], results[1])
  })
})
