import { Observable, filter, map, of, mergeMap, tap, share } from "rxjs"
import { Logger } from "pino"
import {
  createPlayersStatusObservable,
  PlayingTrack,
  StatusQueryResponse,
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

interface PlayerStatusResponse extends StatusQueryResponse {
  playerId: string
  player: Player
}

interface LogicalUnitTrackingState {
  logicalUnitId: string
  groupName?: string
  players: Player[]
  currentTrack?: PlayingTrack
  trackStartTime?: number
  hasSeenTrack: boolean
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

class GroupAwarePlayerStateManager {
  private states: Map<string, LogicalUnitTrackingState> = new Map()

  updatePlayerState(
    playerStatus: PlayerStatusResponse,
  ): LogicalUnitTrackingState | null {
    const { player, playingTrack } = playerStatus

    if (!playingTrack || !isTrackPlaying(playingTrack)) {
      return null
    }

    const logicalUnitId = createLogicalUnitId(player, playingTrack)
    const existingState = this.states.get(logicalUnitId)
    const now = Date.now()

    let newState: LogicalUnitTrackingState

    if (
      !existingState ||
      !existingState.currentTrack ||
      !isSameTrack(existingState.currentTrack, playingTrack)
    ) {
      newState = {
        logicalUnitId,
        players: this.getPlayersForLogicalUnit(logicalUnitId, player),
        currentTrack: playingTrack,
        trackStartTime: now,
        hasSeenTrack: true,
        ...(playingTrack.groupName !== undefined && {
          groupName: playingTrack.groupName,
        }),
      }
    } else {
      newState = {
        ...existingState,
        currentTrack: playingTrack,
        players: this.getPlayersForLogicalUnit(logicalUnitId, player),
      }
    }

    this.states.set(logicalUnitId, newState)
    return newState
  }

  private getPlayersForLogicalUnit(
    logicalUnitId: string,
    currentPlayer: Player,
  ): Player[] {
    const existingState = this.states.get(logicalUnitId)
    const existingPlayers = existingState?.players || []

    const playerExists = existingPlayers.some(
      (p) => p.ip === currentPlayer.ip && p.port === currentPlayer.port,
    )

    if (!playerExists) {
      return [...existingPlayers, currentPlayer]
    }

    return existingPlayers
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

  const playerStatusStream: Observable<PlayerStatusResponse> =
    playersObservable.pipe(
      tap((players: Player[]) =>
        logger.debug({ players }, "Discovered players"),
      ),
      mergeMap((players: Player[]) =>
        players.map((player) => {
          const playerId = createPlayerId(player)

          return createPlayersStatusObservable(
            logger.child({ component: "bluOS", playerId }),
            of([player]),
          ).pipe(
            map(
              (status): PlayerStatusResponse => ({
                ...status,
                playerId,
                player,
              }),
            ),
            tap((status) => {
              logger.debug(
                {
                  playerId: status.playerId,
                  track: status.playingTrack?.title,
                  artist: status.playingTrack?.artist,
                  state: status.playingTrack?.state,
                  groupName: status.playingTrack?.groupName,
                },
                `Player ${status.playerId} status update`,
              )
            }),
          )
        }),
      ),
      mergeMap((playerObservable) => playerObservable),
    )

  const stateManager = new GroupAwarePlayerStateManager()

  const logicalUnitTracks: Observable<TrackWithContext> =
    playerStatusStream.pipe(
      map((playerStatus) => stateManager.updatePlayerState(playerStatus)),
      filter((state): state is LogicalUnitTrackingState => state !== null),
      filter((state) => !!state.currentTrack),
      map((state) => {
        const trackWithContext: TrackWithContext = {
          track: state.currentTrack!,
          logicalUnitId: state.logicalUnitId,
          ...(state.groupName !== undefined && { groupName: state.groupName }),
        }
        return trackWithContext
      }),
      tap(({ track, logicalUnitId, groupName }) => {
        logger.debug(
          {
            logicalUnitId,
            groupName,
            track: track.title,
            artist: track.artist,
            secs: track.secs,
          },
          `Track update for logical unit ${logicalUnitId}`,
        )
      }),
      share(),
    )

  const updatedNowPlayingTrack = updateNowPlaying(
    lastFm,
    sessionToken,
    logicalUnitTracks,
  )

  const scrobbledTrack = scrobbleTrack(lastFm, sessionToken, logicalUnitTracks)

  return {
    updatedNowPlayingTrack,
    scrobbledTrack,
  }
}
