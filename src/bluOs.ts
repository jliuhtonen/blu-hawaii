import { xml2js } from "xml-js"
import * as zod from "zod"

export interface PlayingTrack {
  artist: string
  album: string
  title: string
  secs: string
}

export function isSameTrack(a: PlayingTrack, b: PlayingTrack): boolean {
  return a.title === b.title && a.album === b.album && a.title === b.title
}

export function parsePlayingTrack(bluOsXml: string): PlayingTrack | undefined {
  const parsedJs = xml2js(bluOsXml, { compact: true })
  const parsedData = xmlJsStatus.safeParse(parsedJs)

  if (parsedData.success) {
    return parsedData.data
  } else {
    return undefined
  }
}

const xmlTextField = zod.object({
  _text: zod.string(),
})

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
