import { got, Response } from "../node_modules/got/dist/source/index.js"
import { BehaviorSubject, map, Observable, share, switchMap, tap } from "rxjs"
import { xml2js } from "xml-js"
import * as zod from "zod"
import { Logger, LoggerOptions } from "pino"
import { asRetryable } from "./requestUtil.js"

export interface BluOsConfig {
  ip: string
  port: number
  logger: Logger
}

export interface StatusQueryResponse {
  etag: string
  playingTrack?: PlayingTrack
}

export type PlayingTrack = zod.infer<typeof xmlJsStatus>

const longPollTimeoutSecs = 100
const httpRequestTimeoutMillis = longPollTimeoutSecs * 1000 + 2
const trackPlayingStates = ["play", "stream"]

export function createBluOsStatusObservable({
  ip,
  port,
  logger,
}: BluOsConfig): Observable<StatusQueryResponse> {
  const statusUrl = `http://${ip}:${port}/Status`

  const previousResponseEtag = new BehaviorSubject<string | undefined>(
    undefined,
  )

  const bluOsStatus = previousResponseEtag.pipe(
    switchMap((etag) =>
      asRetryable(() => fetchBluOsStatus(logger, statusUrl, etag)),
    ),
    map((r) => parseBluOsStatus(r)),
    tap((status: StatusQueryResponse) => {
      logger.debug({ bluOsStatus: status })
      if (status !== undefined) {
        previousResponseEtag.next(status.etag)
      } else {
        previousResponseEtag.next(undefined)
      }
    }),
    share(),
  )

  return bluOsStatus
}

export function isTrackPlaying(t: PlayingTrack) {
  return trackPlayingStates.includes(t.state)
}

export function isSameTrack(a: PlayingTrack, b: PlayingTrack): boolean {
  return a.title === b.title && a.album === b.album && a.title === b.title
}

export function hasPlayedOverThreshold(t: PlayingTrack, threshold: number) {
  return (
    t.secs / longPollTimeoutSecs >=
    (t.totalLength / longPollTimeoutSecs) * threshold
  )
}

function fetchBluOsStatus(
  logger: Logger<LoggerOptions>,
  statusUrl: string,
  etag: string | undefined,
): Promise<Response<string>> {
  logger.debug(`Calling BluOS status API with etag ${etag}`)
  return Promise.resolve(
    got.get(statusUrl, {
      searchParams: { etag, timeout: longPollTimeoutSecs },
      timeout: { request: httpRequestTimeoutMillis },
    }),
  )
}

function parseBluOsStatus(bluOsXml: string): StatusQueryResponse {
  const parsedJs = xml2js(bluOsXml, { compact: true })

  const etag = xmlJsEtag.parse(parsedJs)
  const parsedData = xmlJsStatus.safeParse(parsedJs)

  if (parsedData.success) {
    return { etag, playingTrack: parsedData.data }
  } else {
    return { etag }
  }
}

const xmlTextField = zod.object({
  _text: zod.string(),
})

const xmlJsEtag = zod
  .object({
    status: zod.object({
      _attributes: zod.object({
        etag: zod.string(),
      }),
    }),
  })
  .transform((s) => s.status._attributes.etag)

const xmlJsStatus = zod
  .object({
    status: zod.object({
      artist: xmlTextField,
      album: xmlTextField,
      title1: xmlTextField,
      secs: xmlTextField,
      totlen: xmlTextField,
      state: xmlTextField,
    }),
  })
  .transform((value) => ({
    artist: value.status.artist._text,
    album: value.status.album._text,
    title: value.status.title1._text,
    secs: Number(value.status.secs._text),
    totalLength: Number(value.status.totlen._text),
    state: value.status.state._text,
  }))
