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
} from "rxjs"
import {
  hasPlayedOverThreshold,
  isSameTrack,
  isTrackPlaying,
  PlayingTrack,
} from "./bluOs.js"
import * as lastFm from "./lastFm.js"

const scrobbleThreshold = 0.5

export function updateNowPlaying(
  lastFmConfig: lastFm.LastFmConfig,
  sessionToken: string,
  playingTrack: Observable<PlayingTrack>,
): Observable<unknown> {
  return playingTrack.pipe(
    distinctUntilChanged(isSameTrack),
    mergeMap((t) =>
      from(
        lastFm.nowPlaying(lastFmConfig, sessionToken, {
          artist: t.artist,
          album: t.album,
          track: t.title,
        }),
      ).pipe(
        catchError((e) =>
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
  lastFmConfig: lastFm.LastFmConfig,
  sessionToken: string,
  playingTrack: Observable<PlayingTrack>,
): Observable<unknown> {
  return playingTrack.pipe(
    filter(shouldScrobble),
    distinctUntilChanged(isSameTrack),
    mergeMap((t) =>
      defer(() =>
        lastFm.scrobbleTrack(lastFmConfig, sessionToken, {
          artist: t.artist,
          album: t.album,
          track: t.title,
          duration: t.totalLength,
          timestamp: Math.floor(Date.now() / 1000),
        }),
      ).pipe(
        retry({ delay: 20000, count: 5 }),
        catchError((e) =>
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
