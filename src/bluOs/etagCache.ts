import { BehaviorSubject, map } from "rxjs"
import { omit } from "../util.js"

const playerEtagsCache: BehaviorSubject<Partial<Record<string, string>>> =
  new BehaviorSubject({})

export const cachePlayerEtag = (ip: string, etag: string) => {
  playerEtagsCache.next({
    ...playerEtagsCache.getValue(),
    [ip]: etag,
  })
}

export const evictPlayerEtag = (ip: string) => {
  playerEtagsCache.next(omit(playerEtagsCache.getValue(), ip))
}

export const cachedPlayerEtag = (ip: string) =>
  playerEtagsCache.pipe(map((playerMap) => playerMap[ip]))
