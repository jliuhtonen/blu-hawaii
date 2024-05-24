import { pino } from "pino"
import { Configuration } from "./configuration.js"
import { createLastFmApi } from "./lastFm.js"
import { createScrobbler } from "./scrobbler.js"
import { obtainSessionToken } from "./session.js"

export const createApp = async (config: Configuration) => {
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

  const { updatedNowPlayingTrack, scrobbledTrack } = await createScrobbler({
    config,
    logger,
    lastFm,
    sessionToken,
  })

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
