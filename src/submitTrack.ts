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

type UpdateNowPlayingResult = SubmitResult<MaybeUnknown<NowPlayingResponse>>

type SubmitScrobbleResult = SubmitResult<MaybeUnknown<ScrobblesResponse>>

export function updateNowPlaying(
  lastFm: LastFmApi,
  sessionToken: string,
  playingTrack: Observable<PlayingTrack>,
): Observable<UpdateNowPlayingResult> {
  return playingTrack.pipe(
    distinctUntilChanged(isSameTrack),
    mergeMap((t) =>
      from(
        lastFm.nowPlaying(sessionToken, {
          artist: t.artist,
          album: t.album,
          track: t.title,
        }),
      ).pipe(
        map((result): UpdateNowPlayingResult => ({ type: "success", result })),
        catchError(
          (e): Observable<UpdateNowPlayingResult> =>
            of({
              type: "error",
              error: e,
              message: "Unable to update now playing track",
            }),
        ),
      ),
    ),
  )
}

export function scrobbleTrack(
  lastFm: LastFmApi,
  sessionToken: string,
  playingTrack: Observable<PlayingTrack>,
): Observable<SubmitScrobbleResult> {
  return playingTrack.pipe(
    filter(shouldScrobble),
    distinctUntilChanged(isSameTrack),
    mergeMap((t) =>
      defer(() =>
        lastFm.scrobbleTrack(sessionToken, {
          artist: t.artist,
          album: t.album,
          track: t.title,
          duration: t.totalLength,
          timestamp: Math.floor(Date.now() / 1000),
        }),
      ).pipe(
        retry({ delay: 20000, count: 5 }),
        map((result): SubmitScrobbleResult => ({ type: "success", result })),
        catchError(
          (e): Observable<SubmitScrobbleResult> =>
            of({
              type: "error",
              error: e,
              message: "Unable to scrobble track",
            }),
        ),
      ),
    ),
  )
}

function shouldScrobble(t: PlayingTrack) {
  return isTrackPlaying(t) && hasPlayedOverThreshold(t, scrobbleThreshold)
}
