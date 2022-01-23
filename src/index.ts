import "dotenv/config"
import { got } from "../node_modules/got/dist/source/index.js"
import {
  distinctUntilChanged,
  filter,
  from,
  NEVER,
  of,
  switchMap,
  timer,
} from "rxjs"
import { isSameTrack, parsePlayingTrack } from "./bluOs.js"
import { obtainSessionToken } from "./session.js"

const bluOsPollInterval = 5000
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

const bluOsStatus = timer(0, bluOsPollInterval).pipe(
  switchMap(() =>
    from(Promise.resolve(got.get(statusUrl, { timeout: { response: 500 } }))),
  ),
)

const playingTrack = bluOsStatus.pipe(
  filter((r) => r.statusCode === 200),
  switchMap((r) => {
    const track = parsePlayingTrack(r.body)
    return track ? of(track) : NEVER
  }),
  distinctUntilChanged(isSameTrack),
)

const errorResponse = bluOsStatus.pipe(filter((r) => r.statusCode !== 200))

const subscriptions = playingTrack.subscribe((v) => {
  console.log("Playing track changed: ", JSON.stringify(v, null, 2))
})

subscriptions.add(
  errorResponse.subscribe((r) => {
    console.error("Error requesting BluOS status", r.statusCode, r.body, "\n\n")
  }),
)

process.on("exit", () => {
  subscriptions.unsubscribe()
})
