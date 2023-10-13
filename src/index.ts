import "dotenv/config"
import { filter, map, merge, mergeMap, Subscription, tap } from "rxjs"
import { createBluOsStatusObservable, PlayingTrack } from "./bluOs.js"
import { obtainSessionToken } from "./session.js"
import { scrobbleTrack, updateNowPlaying } from "./submitTrack.js"
import { pino } from "pino"
import { Configuration, parseConfiguration } from "./configuration.js"
import { discoverPlayersObservable, Player } from "./playerDiscovery.js"

const config = parseConfiguration(process.env)
const subscriptions = await createScrobbler(config)

process
  .once("SIGINT", shutdown)
  .once("SIGTERM", shutdown)
  .once("uncaughtException", handleUncaughtError)

async function createScrobbler(config: Configuration): Promise<Subscription> {
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

  const bluOsStatus = config.bluOs
    ? createBluOsStatusObservable({
        ...config.bluOs,
        logger: logger.child({ component: "bluOS" }),
      })
    : discoverPlayersObservable().pipe(
        tap((players: Player[]) =>
          logger.debug({ players }, "Discovered players"),
        ),
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
      )

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

function handleUncaughtError(err: unknown, origin: string) {
  console.error(`Caught unknown error from ${origin}...`)
  console.error((err as Error).stack || err)
  shutdown("error")
}

function shutdown(signal: string) {
  console.log(`Caught ${signal}, cleaning and waiting timeout...`)
  subscriptions.unsubscribe()
  setTimeout(() => {
    console.log("...Done!")
    process.exit()
  }, 5000).unref()
}
