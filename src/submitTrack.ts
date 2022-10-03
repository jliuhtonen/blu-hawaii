import { Observable, distinctUntilChanged, mergeMap, from, filter } from "rxjs"
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
      from(
        lastFm.scrobbleTrack(lastFmConfig, sessionToken, {
          artist: t.artist,
          album: t.album,
          track: t.title,
          duration: t.totalLength,
          timestamp: Math.floor(Date.now() / 1000),
        }),
      ),
    ),
  )
}

function shouldScrobble(t: PlayingTrack) {
  return isTrackPlaying(t) && hasPlayedOverThreshold(t, scrobbleThreshold)
}
