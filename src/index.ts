import "dotenv/config"
import { got } from "../node_modules/got/dist/source/index.js"
import {
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  from,
  map,
  share,
  switchMap,
  tap,
} from "rxjs"
import { isSameTrack, parsePlayingTrack, StatusQueryResponse } from "./bluOs.js"
import { obtainSessionToken } from "./session.js"

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
console.log("session token! ", sessionToken)

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
  distinctUntilChanged(isSameTrack),
)

const errorResponse = bluOsStatus.pipe(filter((r) => r.statusCode !== 200))

const subscriptions = playingTrack.subscribe((v) => {
  if (v === undefined) {
    console.log("Nothing playing")
  } else {
    console.log("Playing track: ", JSON.stringify(v, null, 2))
  }
})

subscriptions.add(
  errorResponse.subscribe((r) => {
    console.error("Error requesting BluOS status", r.statusCode, r.body, "\n\n")
  }),
)

process.on("exit", () => {
  subscriptions.unsubscribe()
})
