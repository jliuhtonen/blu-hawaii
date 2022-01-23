import { xml2js } from "xml-js"
import * as zod from "zod"

export interface StatusQueryResponse {
  etag: string
  playingTrack?: PlayingTrack
}

export interface PlayingTrack {
  artist: string
  album: string
  title: string
  secs: string
}

export function isSameTrack(
  a: PlayingTrack | undefined,
  b: PlayingTrack | undefined,
): boolean {
  if (a === undefined && b === undefined) {
    return true
  } else if (a === undefined || b === undefined) {
    return false
  } else {
    return a.title === b.title && a.album === b.album && a.title === b.title
  }
}

export function parsePlayingTrack(bluOsXml: string): StatusQueryResponse {
  const parsedJs = xml2js(bluOsXml, { compact: true })

  const etag = xmlJsEtag.parse(parsedJs)
  const parsedData = xmlJsStatus.safeParse(parsedJs)

  if (parsedData.success) {
    return { etag, playingTrack: parsedData.data }
  } else {
    return { etag }
  }
}

const xmlTextField = zod.object({
  _text: zod.string(),
})

const xmlJsEtag = zod
  .object({
    status: zod.object({
      _attributes: zod.object({
        etag: zod.string(),
      }),
    }),
  })
  .transform((s) => s.status._attributes.etag)

const xmlJsStatus = zod
  .object({
    status: zod.object({
      artist: xmlTextField,
      album: xmlTextField,
      title1: xmlTextField,
      secs: xmlTextField,
    }),
  })
  .transform((value) => ({
    artist: value.status.artist._text,
    album: value.status.album._text,
    title: value.status.title1._text,
    secs: value.status.secs._text,
  }))
