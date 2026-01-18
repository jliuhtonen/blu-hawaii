#!/usr/bin/env node
import { createApp } from "./app.js"
import { parseConfiguration } from "./configuration.js"
import { login } from "./session.js"
import { createLastFmApi } from "./lastFm.js"
import pino from "pino"

const config = parseConfiguration(process.env)

const args = process.argv.slice(2)

type Mode = "login" | "scrobbler" | "usage"

const parseMode = (cmdArgs: string[]): Mode => {
  if (cmdArgs.length === 0) {
    return "scrobbler"
  } else if (args[0] === "login") {
    return "login"
  } else {
    return "usage"
  }
}

const doLogin = async (): Promise<boolean> => {
  const logger = pino(
    {
      level: config.log.level,
      name: "blu-hawaii",
    },
    pino.destination(0),
  )
  const lastFm = createLastFmApi({ ...config.lastFm, logger })
  return await login(config.session.filePath, lastFm)
}

const printUsage = () => {
  console.log("Usage: blu-hawaii [login]")
  console.log("  login: Login to Last.fm")
  console.log("  (no arguments): Start scrobbler")
}

const mode = parseMode(args)

if (mode === "login") {
  const loginSuccess = await doLogin()
  process.exit(loginSuccess ? 0 : 1)
} else if (mode === "usage") {
  printUsage()
  process.exit(0)
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
