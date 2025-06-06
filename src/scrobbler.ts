import { Observable, filter, map, of, mergeMap, share, merge } from "rxjs"
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

class SimpleStateManager {
  private states = new Map<string, LogicalUnitState>()

  updateState(
    player: Player,
    playingTrack: PlayingTrack,
  ): LogicalUnitState | null {
    if (!isTrackPlaying(playingTrack)) {
      return null
    }

    const logicalUnitId = createLogicalUnitId(player, playingTrack)
    const existingState = this.states.get(logicalUnitId)

    if (
      !existingState ||
      !isSameTrack(existingState.currentTrack, playingTrack)
    ) {
      const newState: LogicalUnitState = {
        logicalUnitId,
        currentTrack: playingTrack,
        ...(playingTrack.groupName && { groupName: playingTrack.groupName }),
      }
      this.states.set(logicalUnitId, newState)
      return newState
    }

    const updatedState: LogicalUnitState = {
      ...existingState,
      currentTrack: playingTrack,
    }
    this.states.set(logicalUnitId, updatedState)

    return updatedState
  }
}

export const createScrobbler = async ({
  config,
  logger,
  lastFm,
  sessionToken,
}: ScrobblerDeps): Promise<ScrobblerOutput> => {
  const playersObservable = config.bluOs
    ? of([{ ...config.bluOs }])
    : discoverPlayersObservable()

  const stateManager = new SimpleStateManager()

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
              map(({ playingTrack }) =>
                stateManager.updateState(player, playingTrack!),
              ),
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
