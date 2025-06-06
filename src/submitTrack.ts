import {
  Observable,
  distinctUntilChanged,
  mergeMap,
  from,
  filter,
  defer,
  retry,
  catchError,
  of,
  map,
  tap,
  groupBy,
} from "rxjs"
import {
  hasPlayedOverThreshold,
  isSameTrack,
  isTrackPlaying,
  PlayingTrack,
} from "./bluOs/player.js"
import { LastFmApi, NowPlayingResponse, ScrobblesResponse } from "./lastFm.js"
import { MaybeUnknown } from "./util.js"
import { Logger } from "pino"

const scrobbleThreshold = 0.5

type SubmitResult<A> =
  | { type: "success"; result: A }
  | { type: "error"; error: Error; message: string }

export type UpdateNowPlayingResult = SubmitResult<
  MaybeUnknown<NowPlayingResponse>
>
export type SubmitScrobbleResult = SubmitResult<MaybeUnknown<ScrobblesResponse>>

export interface TrackWithContext {
  track: PlayingTrack
  logicalUnitId: string
  groupName?: string
}

const shouldScrobble = (t: PlayingTrack) =>
  isTrackPlaying(t) && hasPlayedOverThreshold(t, scrobbleThreshold)

const shouldUpdateNowPlaying = (t: PlayingTrack) => isTrackPlaying(t)

// Generic function to handle both now playing and scrobbling
const createSubmitStream = <T>(
  playingTrack: Observable<TrackWithContext>,
  shouldSubmit: (track: PlayingTrack) => boolean,
  submitFn: (trackWithContext: TrackWithContext) => Observable<T>
): Observable<T> => {
  return playingTrack.pipe(
    filter(({ track }) => shouldSubmit(track)),
    groupBy(({ logicalUnitId }) => logicalUnitId),
    mergeMap((logicalUnitStream) =>
      logicalUnitStream.pipe(
        distinctUntilChanged(({ track: a }, { track: b }) => isSameTrack(a, b)),
        mergeMap(submitFn)
      )
    )
  )
}

export const updateNowPlaying = (
  logger: Logger,
  lastFm: LastFmApi,
  sessionToken: string,
  playingTrack: Observable<TrackWithContext>,
): Observable<UpdateNowPlayingResult> => {
  return createSubmitStream(
    playingTrack,
    shouldUpdateNowPlaying,
    ({ track, logicalUnitId, groupName }) =>
      from(
        lastFm.nowPlaying(sessionToken, {
          artist: track.artist,
          album: track.album,
          track: track.title,
        })
      ).pipe(
        map((result): UpdateNowPlayingResult => ({ type: "success", result })),
        tap(() => {
          logger.info(
            `✓ Updated now playing for ${groupName ? `group "${groupName}"` : `logical unit ${logicalUnitId}`}: ${track.artist} - ${track.title}`
          )
        }),
        catchError((e): Observable<UpdateNowPlayingResult> => {
          const errorMsg = `Unable to update now playing track for ${groupName ? `group "${groupName}"` : `logical unit ${logicalUnitId}`}`
          return of({
            type: "error",
            error: e,
            message: errorMsg,
          })
        })
      )
  )
}

export const scrobbleTrack = (
  logger: Logger,
  lastFm: LastFmApi,
  sessionToken: string,
  playingTrack: Observable<TrackWithContext>,
): Observable<SubmitScrobbleResult> => {
  return createSubmitStream(
    playingTrack,
    shouldScrobble,
    ({ track, logicalUnitId, groupName }) =>
      defer(() =>
        from(
          lastFm.scrobbleTrack(sessionToken, {
            artist: track.artist,
            album: track.album,
            track: track.title,
            ...(!!track.totalLength && { duration: track.totalLength }),
            timestamp: Math.floor(Date.now() / 1000),
          })
        ).pipe(retry({ delay: 20000, count: 5 }))
      ).pipe(
        map((result): SubmitScrobbleResult => ({ type: "success", result })),
        tap(() => {
          logger.info(
            `♪ Scrobbled track for ${groupName ? `group "${groupName}"` : `logical unit ${logicalUnitId}`}: ${track.artist} - ${track.title} (${track.secs}s)`
          )
        }),
        catchError((e): Observable<SubmitScrobbleResult> => {
          const errorMsg = `Unable to scrobble track for ${groupName ? `group "${groupName}"` : `logical unit ${logicalUnitId}`}`
          return of({
            type: "error",
            error: e,
            message: errorMsg,
          })
        })
      )
  )
}
