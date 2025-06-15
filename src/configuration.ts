import { z } from "zod"

type LoggingDestination =
  | {
      type: "stdout"
    }
  | {
      type: "file"
      path: string
    }

const stringToLoggingDestination = (str: string): LoggingDestination => {
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

const configuration = z.object({
  log: z.object({
    level: z.string().default("info"),
    destination: z
      .string()
      .default("stdout")
      .transform(stringToLoggingDestination),
  }),
  bluOs: z
    .object({
      ip: z.string(),
      port: z.string().transform(Number),
    })
    .optional(),
  players: z
    .array(
      z.object({
        ip: z.string(),
        port: z.number(),
      }),
    )
    .optional(), // For testing multiple players
  lastFm: z.object({
    apiKey: z.string(),
    apiSecret: z.string(),
  }),
  session: z.object({
    filePath: z.string().default(".blu-hawaii-session"),
  }),
})

export type Configuration = z.infer<typeof configuration>

export const parseConfiguration = (
  source: Partial<Record<string, string>>,
): Configuration => {
  return configuration.parse({
    log: {
      level: source["LOG_LEVEL"],
      destination: source["LOG_DEST"],
    },
    logLevel: source["LOG_LEVEL"],
    bluOs:
      (source["BLUOS_IP"] && {
        ip: source["BLUOS_IP"],
        port: source["BLUOS_PORT"],
      }) ||
      undefined,
    lastFm: {
      apiKey: source["LAST_FM_API_KEY"],
      apiSecret: source["LAST_FM_API_SECRET"],
    },
    session: {
      filePath: source["SESSION_FILE_PATH"],
    },
  })
}
