import { Observable, filter, map, of, mergeMap, share, merge, scan } from "rxjs"
import { Logger } from "pino"
import {
  createPlayersStatusObservable,
  PlayingTrack,
  isTrackPlaying,
  isSameTrack,
} from "./bluOs/player.js"
import {
  SubmitScrobbleResult,
  UpdateNowPlayingResult,
  scrobbleTrack,
  updateNowPlaying,
  TrackWithContext,
} from "./submitTrack.js"
import { Configuration } from "./configuration.js"
import { LastFmApi } from "./lastFm.js"
import { discoverPlayersObservable } from "./bluOs/serviceDiscovery.js"
import { Player } from "./bluOs/serviceDiscovery.js"

export interface ScrobblerDeps {
  config: Configuration
  logger: Logger
  lastFm: LastFmApi
  sessionToken: string
}

export interface ScrobblerOutput {
  updatedNowPlayingTrack: Observable<UpdateNowPlayingResult>
  scrobbledTrack: Observable<SubmitScrobbleResult>
}

interface LogicalUnitState {
  logicalUnitId: string
  groupName?: string
  currentTrack: PlayingTrack
}

const createPlayerId = (player: Player): string => `${player.ip}:${player.port}`

const createLogicalUnitId = (
  player: Player,
  playingTrack?: PlayingTrack,
): string => {
  if (playingTrack?.groupName) {
    return `group:${playingTrack.groupName}`
  }
  return `player:${player.ip}:${player.port}`
}

const createLogicalUnitState = (
  logicalUnitId: string,
  playingTrack: PlayingTrack,
): LogicalUnitState => ({
  logicalUnitId,
  currentTrack: playingTrack,
  ...(playingTrack.groupName && { groupName: playingTrack.groupName }),
})

const shouldEmitNewState = (
  previousState: LogicalUnitState | null,
  logicalUnitId: string,
  playingTrack: PlayingTrack,
): boolean =>
  !previousState ||
  previousState.logicalUnitId !== logicalUnitId ||
  !isSameTrack(previousState.currentTrack, playingTrack)

const updatePlayerState = (
  previousState: LogicalUnitState | null,
  { player, playingTrack }: { player: Player; playingTrack: PlayingTrack },
): LogicalUnitState | null => {
  if (!isTrackPlaying(playingTrack)) return null

  const logicalUnitId = createLogicalUnitId(player, playingTrack)

  return shouldEmitNewState(previousState, logicalUnitId, playingTrack)
    ? createLogicalUnitState(logicalUnitId, playingTrack)
    : { ...previousState!, currentTrack: playingTrack }
}

export const createScrobbler = async ({
  config,
  logger,
  lastFm,
  sessionToken,
}: ScrobblerDeps): Promise<ScrobblerOutput> => {
  const playersObservable = config.players
    ? of(config.players)
    : config.bluOs
      ? of([{ ...config.bluOs }])
      : discoverPlayersObservable()

  const logicalUnitTracks: Observable<TrackWithContext> =
    playersObservable.pipe(
      mergeMap((players: Player[]) =>
        merge(
          ...players.map((player) =>
            createPlayersStatusObservable(
              logger.child({
                component: "bluOS",
                playerId: createPlayerId(player),
              }),
              of([player]),
            ).pipe(
              filter(({ playingTrack }) => !!playingTrack),
              map(({ playingTrack }) => ({
                player,
                playingTrack: playingTrack!,
              })),
              scan(updatePlayerState, null),
              filter((state): state is LogicalUnitState => state !== null),
              map((state) => ({
                track: state.currentTrack,
                logicalUnitId: state.logicalUnitId,
                ...(state.groupName && { groupName: state.groupName }),
              })),
            ),
          ),
        ),
      ),
      share(),
    )

  return {
    updatedNowPlayingTrack: updateNowPlaying(
      logger,
      lastFm,
      sessionToken,
      logicalUnitTracks,
    ),
    scrobbledTrack: scrobbleTrack(
      logger,
      lastFm,
      sessionToken,
      logicalUnitTracks,
    ),
  }
}
