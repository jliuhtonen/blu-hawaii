import {
  Observable,
  Subscription,
  filter,
  map,
  merge,
  mergeMap,
  share,
  tap,
} from "rxjs"
import { Logger, pino } from "pino"
import {
  createBluOsStatusObservable,
  PlayingTrack,
  StatusQueryResponse,
} from "./bluOs/player.js"
import { Configuration } from "./configuration.js"
import { obtainSessionToken } from "./session.js"
import { scrobbleTrack, updateNowPlaying } from "./submitTrack.js"
import { discoverPlayersObservable, Player } from "./bluOs/serviceDiscovery.js"

const createDiscoveredPlayersStatusObservable = (
  logger: Logger,
): Observable<StatusQueryResponse> => {
  return discoverPlayersObservable().pipe(
    tap((players: Player[]) => logger.debug({ players }, "Discovered players")),
    mergeMap((players: Player[]) =>
      merge(
        ...players.map((p) =>
          createBluOsStatusObservable({
            ...p,
            logger: logger.child({ component: "bluOS" }),
          }),
        ),
      ),
    ),
    share(),
  )
}

export const createScrobbler = async (
  config: Configuration,
): Promise<Subscription> => {
  const logger = pino(
    {
      level: config.log.level,
      name: "blu-hawaii",
    },
    pino.destination(
      config.log.destination.type === "stdout"
        ? 0
        : config.log.destination.path,
    ),
  )

  const lastFmConfig = {
    ...config.lastFm,
    logger: logger.child({ component: "lastFm" }),
  }

  const sessionToken = await obtainSessionToken(
    config.session.filePath,
    lastFmConfig,
  )

  if (!sessionToken) {
    logger.error({ error: "Unable to obtain session!" })
    process.exit(1)
  }

  const bluOsStatus: Observable<StatusQueryResponse> = config.bluOs
    ? createBluOsStatusObservable({
        ...config.bluOs,
        logger: logger.child({ component: "bluOS" }),
      })
    : createDiscoveredPlayersStatusObservable(logger)

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
