import { Observable, Subscription, filter, map } from "rxjs"
import { Logger } from "pino"
import { PlayingTrack, StatusQueryResponse } from "./bluOs/player.js"
import { scrobbleTrack, updateNowPlaying } from "./submitTrack.js"
import { LastFmApi } from "./lastFm.js"

export interface ScrobblerDeps {
  logger: Logger
  lastFm: LastFmApi
  sessionToken: string
  bluOsStatus: Observable<StatusQueryResponse>
}

export const createScrobbler = async ({
  bluOsStatus,
  lastFm,
  sessionToken,
  logger,
}: ScrobblerDeps): Promise<Subscription> => {
  const playingTrack = bluOsStatus.pipe(
    map((s) => s.playingTrack),
    filter((t): t is PlayingTrack => t !== undefined),
  )

  const updatedNowPlayingTrack = updateNowPlaying(
    lastFm,
    sessionToken,
    playingTrack,
  )

  const scrobbledTrack = scrobbleTrack(lastFm, sessionToken, playingTrack)

  const subscriptions = updatedNowPlayingTrack.subscribe((response) => {
    switch (response.type) {
      case "error":
        logger.error(response.error, response.message)
        return
      case "success":
        logger.info(response.result.value, "Updated now playing track")
        return
    }
  })

  subscriptions.add(
    scrobbledTrack.subscribe((response) => {
      switch (response.type) {
        case "error":
          logger.error(response.error, response.message)
          return
        case "success":
          logger.info(response.result.value, "Scrobbled track")
          return
      }
    }),
  )

  return subscriptions
}
