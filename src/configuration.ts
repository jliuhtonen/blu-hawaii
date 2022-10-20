import { z } from "zod"

const configuration = z.object({
  log: z.object({
    level: z.string().default("info"),
    destination: z.string().transform(stringToLoggingDestination),
  }),
  bluOs: z.object({
    ip: z.string(),
    port: z.string().transform(Number),
  }),
  lastFm: z.object({
    apiKey: z.string(),
    apiSecret: z.string(),
  }),
  session: z.object({
    filePath: z.string().default(".blu-hawaii-session"),
  }),
})

export type Configuration = z.infer<typeof configuration>

export function parseConfiguration(
  source: Partial<Record<string, string>>,
): Configuration {
  return configuration.parse({
    log: {
      level: source["LOG_LEVEL"],
      destination: source["LOG_DEST"],
    },
    logLevel: source["LOG_LEVEL"],
    bluOs: {
      ip: source["BLUOS_IP"],
      port: source["BLUOS_PORT"],
    },
    lastFm: {
      apiKey: source["LAST_FM_API_KEY"],
      apiSecret: source["LAST_FM_API_SECRET"],
    },
    session: {
      filePath: source["SESSION_FILE_PATH"],
    },
  })
}

type LoggingDestination =
  | {
      type: "stdout"
    }
  | {
      type: "file"
      path: string
    }

function stringToLoggingDestination(str: string): LoggingDestination {
  if (str === "stdout") {
    return {
      type: "stdout",
    }
  } else {
    return {
      type: "file",
      path: str,
    }
  }
}
