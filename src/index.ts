import "dotenv/config"
import { filter, map, Subscription } from "rxjs"
import { createBluOsStatusObservable, PlayingTrack } from "./bluOs.js"
import { obtainSessionToken } from "./session.js"
import { scrobbleTrack, updateNowPlaying } from "./submitTrack.js"

const bluOsConfig = {
  ip: process.env["BLUOS_IP"]!!,
  port: process.env["BLUOS_PORT"]!!,
}

const lastFmConfig = {
  apiKey: process.env["LAST_FM_API_KEY"]!!,
  apiSecret: process.env["LAST_FM_API_SECRET"]!!,
}

const sessionToken = await obtainSessionToken(lastFmConfig)

if (!sessionToken) {
  console.error("Unable to obtain session!")
  process.exit(1)
}

function createScrobbler(sessionToken: string): Subscription {
  const bluOsStatus = createBluOsStatusObservable(bluOsConfig)

  const playingTrack = bluOsStatus.pipe(
    map((s) => s.playingTrack),
    filter((t): t is PlayingTrack => t !== undefined),
  )

  const updatedNowPlayingTrack = updateNowPlaying(
    lastFmConfig,
    sessionToken,
    playingTrack,
  )

  const scrobbledTrack = scrobbleTrack(lastFmConfig, sessionToken, playingTrack)

  const subscriptions = updatedNowPlayingTrack.subscribe((response) => {
    console.log("UpdatedNowPlaying:", JSON.stringify(response, null, 2))
  })

  subscriptions.add(
    scrobbledTrack.subscribe((scrobbleResponse) => {
      console.log(`Scrobble:`, JSON.stringify(scrobbleResponse, null, 2))
    }),
  )

  return subscriptions
}

const subscriptions = createScrobbler(sessionToken)

process.on("exit", () => {
  subscriptions.unsubscribe()
})
