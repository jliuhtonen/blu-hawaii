import { z } from "zod"

const configuration = z.object({
  logLevel: z.string().default("info"),
  bluOs: z.object({
    ip: z.string(),
    port: z.string().transform(Number),
  }),
  lastFm: z.object({
    apiKey: z.string(),
    apiSecret: z.string(),
  }),
})

export type Configuration = z.infer<typeof configuration>

export function parseConfiguration(
  source: Partial<Record<string, string>>,
): Configuration {
  return configuration.parse({
    logLevel: source["LOG_LEVEL"],
    bluOs: {
      ip: source["BLUOS_IP"],
      port: source["BLUOS_PORT"],
    },
    lastFm: {
      apiKey: source["LAST_FM_API_KEY"],
      apiSecret: source["LAST_FM_API_SECRET"],
    },
  })
}
