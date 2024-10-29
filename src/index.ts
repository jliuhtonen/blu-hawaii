import "dotenv/config"
import { createApp } from "./app.js"
import { parseConfiguration } from "./configuration.js"

const config = parseConfiguration(process.env)

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
