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
} from "rxjs"
import {
  hasPlayedOverThreshold,
  isSameTrack,
  isTrackPlaying,
  PlayingTrack,
} from "./bluOs/player.js"
import { LastFmApi, NowPlayingResponse, ScrobblesResponse } from "./lastFm.js"
import { MaybeUnknown } from "./util.js"

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

export const updateNowPlaying = (
  lastFm: LastFmApi,
  sessionToken: string,
  playingTrack: Observable<TrackWithContext>,
): Observable<UpdateNowPlayingResult> => {
  return playingTrack.pipe(
    filter(({ track }) => shouldUpdateNowPlaying(track)),
    distinctUntilChanged(
      ({ track: a, logicalUnitId: unitA }, { track: b, logicalUnitId: unitB }) =>
        unitA === unitB && isSameTrack(a, b)
    ),
    mergeMap(({ track, logicalUnitId, groupName }) =>
      from(
        lastFm.nowPlaying(sessionToken, {
          artist: track.artist,
          album: track.album,
          track: track.title,
        }),
      ).pipe(
        map((result): UpdateNowPlayingResult => ({ type: "success", result })),
        tap(() => {
          console.log(
            `✓ Updated now playing for ${groupName ? `group "${groupName}"` : `logical unit ${logicalUnitId}`}: ${track.artist} - ${track.title}`,
          )
        }),
        catchError((e): Observable<UpdateNowPlayingResult> => {
          const errorMsg = `Unable to update now playing track for ${groupName ? `group "${groupName}"` : `logical unit ${logicalUnitId}`}`
          console.error(`✗ ${errorMsg}:`, e.message)
          return of({
            type: "error",
            error: e,
            message: errorMsg,
          })
        }),
      ),
    ),
  )
}

export const scrobbleTrack = (
  lastFm: LastFmApi,
  sessionToken: string,
  playingTrack: Observable<TrackWithContext>,
): Observable<SubmitScrobbleResult> => {
  return playingTrack.pipe(
    filter(({ track }) => shouldScrobble(track)),
    distinctUntilChanged(
      ({ track: a, logicalUnitId: unitA }, { track: b, logicalUnitId: unitB }) =>
        unitA === unitB && isSameTrack(a, b)
    ),
    mergeMap(({ track, logicalUnitId, groupName }) =>
      defer(() =>
        from(
          lastFm.scrobbleTrack(sessionToken, {
            artist: track.artist,
            album: track.album,
            track: track.title,
            ...(!!track.totalLength && { duration: track.totalLength }),
            timestamp: Math.floor(Date.now() / 1000),
          }),
        ).pipe(retry({ delay: 20000, count: 5 })),
      ).pipe(
        map((result): SubmitScrobbleResult => ({ type: "success", result })),
        tap(() => {
          console.log(
            `♪ Scrobbled track for ${groupName ? `group "${groupName}"` : `logical unit ${logicalUnitId}`}: ${track.artist} - ${track.title} (${track.secs}s)`,
          )
        }),
        catchError((e): Observable<SubmitScrobbleResult> => {
          const errorMsg = `Unable to scrobble track for ${groupName ? `group "${groupName}"` : `logical unit ${logicalUnitId}`}`
          console.error(`✗ ${errorMsg}:`, e.message)
          return of({
            type: "error",
            error: e,
            message: errorMsg,
          })
        }),
      ),
    ),
  )
}
