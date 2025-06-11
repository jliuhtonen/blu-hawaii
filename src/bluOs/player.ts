import ky from "ky"
import {
  defer,
  finalize,
  from,
  map,
  merge,
  mergeMap,
  Observable,
  retry,
  share,
  switchMap,
  tap,
} from "rxjs"
import { xml2js } from "xml-js"
import * as zod from "zod"
import { Logger } from "pino"
import { createEtagCache } from "./etagCache.js"
import { Player } from "./serviceDiscovery.js"

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
      name: xmlTextField.optional(),
      title1: xmlTextField,
      title2: xmlTextField,
      title3: xmlTextField.optional(),
      secs: xmlTextField,
      totlen: xmlTextField.optional(),
      state: xmlTextField,
      groupName: xmlTextField.optional(),
    }),
  })
  .transform((value) => ({
    artist: value.status.artist._text,
    album: value.status.album._text,
    name: value.status.name?._text,
    title1: value.status.title1._text,
    title2: value.status.title2._text,
    title3: value.status.title3?._text,
    secs: Number(value.status.secs._text),
    totalLength: value.status.totlen && Number(value.status.totlen._text),
    state: value.status.state._text,
    groupName: value.status.groupName?._text,
  }))

export interface BluOsConfig {
  ip: string
  port: number
  logger: Logger
}

export interface StatusQueryResponse {
  etag: string
  playingTrack?: PlayingTrack
}

export type PlayingBluOsTrack = zod.infer<typeof xmlJsStatus>

export type PlayingTrack = {
  artist: string
  album: string
  title: string
  secs: number
  totalLength: number | undefined
  state: string
  groupName?: string
}

const longPollTimeoutSecs = 100
const httpRequestTimeoutMillis = (longPollTimeoutSecs + 2) * 1000
const trackPlayingStates = ["play", "stream"]
const fallbackTrackLength = 90

export const isTrackPlaying = (t: PlayingTrack) =>
  trackPlayingStates.includes(t.state)

export const isSameTrack = (a: PlayingTrack, b: PlayingTrack): boolean =>
  a.title === b.title && a.album === b.album && a.artist === b.artist

export const hasPlayedOverThreshold = (t: PlayingTrack, threshold: number) =>
  t.secs / longPollTimeoutSecs >=
  ((t.totalLength ?? fallbackTrackLength) / longPollTimeoutSecs) * threshold

const fetchBluOsStatus = (
  logger: Logger,
  statusUrl: string,
  etag: string | undefined,
  abortSignal: AbortSignal,
): Promise<string> => {
  logger.debug(`Calling BluOS status API with etag ${etag}`)
  const queryObj = {
    ...(etag ? { etag } : {}),
    timeout: longPollTimeoutSecs.toString(),
  }

  return ky
    .get(statusUrl, {
      searchParams: new URLSearchParams(queryObj),
      timeout: httpRequestTimeoutMillis,
      signal: abortSignal,
    })
    .text()
}

/**
 * When playing from a file, the BluOS API returns the track name in the `name` field.
 * When playing from a streaming service, the BluOS API returns the track name in the `title1` field.
 * When playing from certain network radios, the BluOS API returns the track name in the `title2` field, like so
 * ```
 * <title1>Radio Stream</title1>
 * <title2>Title</title2>
 * <title3>Artist • Album</title3>
 * ```
 **/
const resolveTrackName = (t: PlayingBluOsTrack): string =>
  t.name ??
  (t.artist === t.title2 && (t.album === t.title3 || t.album === t.title1) ? t.title1 : t.title2)

const parseBluOsStatus = (bluOsXml: string): StatusQueryResponse => {
  const parsedJs = xml2js(bluOsXml, { compact: true })

  const etag = xmlJsEtag.parse(parsedJs)
  const parsedData = xmlJsStatus.safeParse(parsedJs)

  if (parsedData.success) {
    const { artist, album, secs, totalLength, state, groupName } =
      parsedData.data
    const title = resolveTrackName(parsedData.data)
    return {
      etag,
      playingTrack: {
        artist,
        album,
        title,
        secs,
        totalLength,
        state,
        ...(groupName !== undefined && { groupName }),
      },
    }
  } else {
    return { etag }
  }
}

const createBluOsStatusObservable = ({
  ip,
  port,
  logger,
}: BluOsConfig): Observable<StatusQueryResponse> => {
  const statusUrl = `http://${ip}:${port}/Status`
  const etagCache = createEtagCache()

  const bluOsStatus = etagCache.cachedPlayerEtag(ip).pipe(
    switchMap((etag) => {
      return defer(() => {
        const abortController = new AbortController()

        return from(
          fetchBluOsStatus(logger, statusUrl, etag, abortController.signal),
        ).pipe(
          finalize(() => {
            abortController.abort()
          }),
        )
      }).pipe(retry({ delay: 10000 }))
    }),
    map((r) => parseBluOsStatus(r)),
    tap((status: StatusQueryResponse) => {
      logger.debug({ bluOsStatus: status })
      if (status !== undefined) {
        etagCache.cachePlayerEtag(ip, status.etag)
      } else {
        etagCache.evictPlayerEtag(ip)
      }
    }),
    share(),
  )

  return bluOsStatus
}

export const createPlayersStatusObservable = (
  logger: Logger,
  playersObservable: Observable<Player[]>,
): Observable<StatusQueryResponse> => {
  return playersObservable.pipe(
    tap((players: Player[]) => logger.debug({ players }, "Discovered players")),
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
    share(),
  )
}
