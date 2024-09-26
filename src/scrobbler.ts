import { Observable, filter, map, of } from "rxjs"
import { Logger } from "pino"
import {
  createPlayersStatusObservable,
  PlayingTrack,
  StatusQueryResponse,
} from "./bluOs/player.js"
import {
  SubmitScrobbleResult,
  UpdateNowPlayingResult,
  scrobbleTrack,
  updateNowPlaying,
} from "./submitTrack.js"
import { Configuration } from "./configuration.js"
import { LastFmApi } from "./lastFm.js"
import { discoverPlayersObservable } from "./bluOs/serviceDiscovery.js"

export interface ScrobblerDeps {
  config: Configuration
  logger: Logger
  lastFm: LastFmApi
  sessionToken: string
}

export interface ScrobblerOutput {
  updatedNowPlayingTrack: Observable<UpdateNowPlayingResult>
  scrobbledTrack: Observable<SubmitScrobbleResult>
}

export const createScrobbler = async ({
  config,
  logger,
  lastFm,
  sessionToken,
}: ScrobblerDeps): Promise<ScrobblerOutput> => {
  const playersObservable = config.bluOs
    ? of([{ ...config.bluOs }])
    : discoverPlayersObservable()
  const bluOsStatus: Observable<StatusQueryResponse> =
    createPlayersStatusObservable(logger, playersObservable)

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

  return {
    updatedNowPlayingTrack,
    scrobbledTrack,
  }
}
