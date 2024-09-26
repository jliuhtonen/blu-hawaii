import { BehaviorSubject, distinctUntilChanged, map } from "rxjs"
import { omit } from "../util.js"

export const createEtagCache = () => {
  const playerEtagsCache: BehaviorSubject<Partial<Record<string, string>>> =
    new BehaviorSubject({})

  const cachePlayerEtag = (ip: string, etag: string) => {
    playerEtagsCache.next({
      ...playerEtagsCache.getValue(),
      [ip]: etag,
    })
  }

  const evictPlayerEtag = (ip: string) => {
    playerEtagsCache.next(omit(playerEtagsCache.getValue(), ip))
  }

  const cachedPlayerEtag = (ip: string) =>
    playerEtagsCache.pipe(
      map((playerMap) => playerMap[ip]),
      distinctUntilChanged(),
    )

  return {
    cachePlayerEtag,
    evictPlayerEtag,
    cachedPlayerEtag,
  }
}
