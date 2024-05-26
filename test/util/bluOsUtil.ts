export const trackPlayingResponse = ({
  artist,
  album,
  title,
  secs,
  totalLength,
  state,
  etag,
}: {
  artist: string
  album: string
  title: string
  secs: number
  totalLength: number
  state: string
  etag: string
}): string =>
  `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<status etag="${etag}">
<actions>
  <action name="back" url="/Action?service=TidalConnect&amp;action=Previous" />
  <action name="skip" url="/Action?service=TidalConnect&amp;action=Next" />
  <action androidAction="android.intent.action.VIEW" androidPackage="com.aspiro.tidal" desktopApp="tidal://" desktopInstall="https://tidal.com/download" icon="/Sources/images/TidalIcon.png" iosApp="tidal://" itunesUrl="https://apps.apple.com/us/app/tidal-music/id913943275" name="contextMenuItem" text="Open TIDAL Music app" />
</actions>
<album>${album}</album>
<artist>${artist}</artist>
<canSeek>1</canSeek>
<codecPrivateData></codecPrivateData>
<currentImage>https://resources.tidal.com/images/1062426b/77c8/4ca3/bd2e/b68326273066/1280x1280.jpg</currentImage>
<cursor>0</cursor>
<db>-100</db>
<image>https://resources.tidal.com/images/1062426b/77c8/4ca3/bd2e/b68326273066/1280x1280.jpg</image>
<indexing>0</indexing>
<inputId>TidalConnect</inputId>
<mid>0</mid>
<mode>1</mode>
<mute>0</mute>
<pid>1</pid>
<prid>0</prid>
<quality>cd</quality>
<repeat>0</repeat>
<seek>6.201</seek>
<service>TidalConnect</service>
<serviceIcon>/Sources/images/TidalIcon.png</serviceIcon>
<serviceName>TIDAL connect</serviceName>
<shuffle>0</shuffle>
<sid>8</sid>
<sleep></sleep>
<song>0</song>
<state>${state}</state>
<stationImage>/Sources/images/TidalIconNP_960.png</stationImage>
<streamFormat>FLAC 16/44.1</streamFormat>
<streamUrl>TidalConnect:405:https://sp-pr-fa.audio.tidal.com/mediatracks/abc/0.flac</streamUrl>
<syncStat>254</syncStat>
<title1>${title}</title1>
<title2>${artist}</title2>
<title3>${album}</title3>
<totlen>${totalLength}</totlen>
<volume>0</volume>
<secs>${secs}</secs>
</status>
`.trim()
