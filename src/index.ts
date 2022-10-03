import "dotenv/config"
import { got } from "../node_modules/got/dist/source/index.js"
import {
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  from,
  map,
  mergeMap,
  share,
  switchMap,
  tap,
} from "rxjs"
import {
  isSameTrack,
  parsePlayingTrack,
  PlayingTrack,
  StatusQueryResponse,
} from "./bluOs/model.js"
import { obtainSessionToken } from "./session.js"
import * as lastFm from "./lastFm.js"

const bluOsConfig = {
  ip: process.env["BLUOS_IP"]!!,
  port: process.env["BLUOS_PORT"]!!,
}

const lastFmConfig = {
  apiKey: process.env["LAST_FM_API_KEY"]!!,
  apiSecret: process.env["LAST_FM_API_SECRET"]!!,
}

const statusUrl = `http://${bluOsConfig.ip}:${bluOsConfig.port}/Status`

const sessionToken = await obtainSessionToken(lastFmConfig)

if (!sessionToken) {
  console.error("Unable to obtain session!")
  process.exit(1)
}

const trackPlayingStates = ["play", "stream"]

const previousResponseEtag = new BehaviorSubject<string | undefined>(undefined)

const bluOsStatus = previousResponseEtag.pipe(
  switchMap((etag) => {
    return from(
      Promise.resolve(
        got.get(statusUrl, {
          searchParams: { etag, timeout: 100 },
        }),
      ),
    )
  }),
  share(),
)

const playingTrack = bluOsStatus.pipe(
  filter((r) => r.statusCode === 200),
  map((r) => parsePlayingTrack(r.body)),
  tap((status: StatusQueryResponse) => {
    if (status !== undefined) {
      previousResponseEtag.next(status.etag)
    }
  }),
  map((s) => s.playingTrack),
  filter((t): t is PlayingTrack => t !== undefined),
)

const errorResponse = bluOsStatus.pipe(filter((r) => r.statusCode !== 200))

const updatedNowPlayingTrack = playingTrack.pipe(
  distinctUntilChanged(isSameTrack),
  mergeMap((t) =>
    from(
      lastFm.nowPlaying(lastFmConfig, sessionToken, {
        artist: t.artist,
        album: t.album,
        track: t.title,
      }),
    ),
  ),
)

const scrobbledTrack = playingTrack.pipe(
  filter(shouldScrobble),
  distinctUntilChanged(isSameTrack),
  mergeMap((t) =>
    from(
      lastFm.scrobbleTrack(lastFmConfig, sessionToken, {
        artist: t.artist,
        album: t.album,
        track: t.title,
        duration: t.totalLength,
        timestamp: Math.floor(Date.now() / 1000),
      }),
    ),
  ),
)

const subscriptions = updatedNowPlayingTrack.subscribe((response) => {
  console.log("UpdatedNowPlaying:", JSON.stringify(response, null, 2))
})

subscriptions.add(
  scrobbledTrack.subscribe((scrobbleResponse) => {
    console.log(`Scrobble:`, JSON.stringify(scrobbleResponse, null, 2))
  }),
)

subscriptions.add(
  errorResponse.subscribe((r) => {
    console.error("Error requesting BluOS status", r.statusCode, r.body, "\n\n")
  }),
)

process.on("exit", () => {
  subscriptions.unsubscribe()
})

function isTrackPlaying(t: PlayingTrack) {
  return trackPlayingStates.includes(t.state)
}

function shouldScrobble(t: PlayingTrack) {
  return isTrackPlaying(t) && hasPlayedLongEnough(t)
}

function hasPlayedLongEnough(t: PlayingTrack) {
  return t.secs >= 99 || t.totalLength < 99
}
