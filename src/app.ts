import pino from "pino"
import type { Configuration } from "./configuration.ts"
import { createLastFmApi } from "./lastFm.ts"
import { createScrobbler } from "./scrobbler.ts"
import { loadSessionToken } from "./session.ts"

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
  const sessionToken = await loadSessionToken(config.session.filePath)

  if (!sessionToken) {
    const errorMsg = "Unable to obtain session!"
    logger.error({ error: errorMsg })
    throw new Error(errorMsg)
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
