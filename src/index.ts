import "dotenv/config"
import { Configuration, parseConfiguration } from "./configuration.js"
import { createScrobbler } from "./scrobbler.js"
import { obtainSessionToken } from "./session.js"
import {
  StatusQueryResponse,
  createBluOsStatusObservable,
  createDiscoveredPlayersStatusObservable,
} from "./bluOs/player.js"
import { pino } from "pino"
import { Observable } from "rxjs"
import { createLastFmApi } from "./lastFm.js"

const config = parseConfiguration(process.env)

const createApp = async (config: Configuration) => {
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

  const lastFm = createLastFmApi(lastFmConfig)
  const sessionToken = await obtainSessionToken(config.session.filePath, lastFm)

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

  return createScrobbler({ bluOsStatus, lastFm, sessionToken, logger })
}

const subscriptions = await createApp(config)

const shutdown = (signal: string) => {
  console.log(`Caught ${signal}, cleaning and waiting timeout...`)
  subscriptions.unsubscribe()
  setTimeout(() => {
    console.log("...Done!")
    process.exit()
  }, 5000).unref()
}

const handleUncaughtError = (err: unknown, origin: string) => {
  console.error(`Caught unknown error from ${origin}...`)
  console.error((err as Error).stack || err)
  shutdown("error")
}

process
  .once("SIGINT", shutdown)
  .once("SIGTERM", shutdown)
  .once("uncaughtException", handleUncaughtError)
