interface TrackData {
  artist: string
  album: string
  title: string
  secs: number
  totalLength: number
  state: string
  etag: string
}

export const trackStreamingResponse = ({
  artist,
  album,
  title,
  secs,
  totalLength,
  state,
  etag,
}: TrackData): string =>
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

export const trackRadioResponse: string = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<status etag="d5748f55e3f800561066f5fd7d0529de">
<actions>
  <action name="back" />
  <action name="skip" url="/Action?service=RadioParadise&amp;next=2628777" />
</actions>
<album>Embers</album>
<artist>God Is an Astronaut</artist>
<canMovePlayback>true</canMovePlayback>
<canSeek>0</canSeek>
<currentImage>https://img.radioparadise.com/covers/l/19378_7f640f4e-225d-4ed2-8da2-afe623969211.jpg</currentImage>
<cursor>7</cursor>
<db>-100</db>
<image>https://img.radioparadise.com/covers/l/19378_7f640f4e-225d-4ed2-8da2-afe623969211.jpg</image>
<indexing>0</indexing>
<infourl>https://en.wikipedia.org/wiki/God_Is_an_Astronaut</infourl>
<inputId>RadioParadise</inputId>
<mid>31</mid>
<mode>1</mode>
<mqaOFS>44100</mqaOFS>
<mute>0</mute>
<pid>33</pid>
<prid>1</prid>
<quality>mqa</quality>
<repeat>2</repeat>
<schemaVersion>34</schemaVersion>
<service>RadioParadise</service>
<serviceIcon>/Sources/images/RadioParadiseIcon.png</serviceIcon>
<serviceName>Radio Paradise</serviceName>
<shuffle>0</shuffle>
<sid>6</sid>
<sleep></sleep>
<song>0</song>
<state>stream</state>
<stationImage>https://img.radioparadise.com/source/27/channel_logo/chan_0.png</stationImage>
<streamFormat>16/44.1</streamFormat>
<streamUrl>RadioParadise:/0:20</streamUrl>
<syncStat>272</syncStat>
<title1>RP Main Mix</title1>
<title2>Heart of Roots</title2>
<title3>God Is an Astronaut • Embers</title3>
<volume>0</volume>
<secs>45</secs>
</status>
  `
