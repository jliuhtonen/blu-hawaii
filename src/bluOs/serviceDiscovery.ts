import {
  Observable,
  distinctUntilChanged,
  filter,
  from,
  map,
  scan,
  switchMap,
} from "rxjs"
import type {
  AnnounceMessage,
  DeleteMessage,
  Packet,
  ReceivedMessage,
  ReceivedPacket,
} from "@jliuhtonen/nightvision"
import { createConnection } from "@jliuhtonen/nightvision"
import { omit } from "../util.ts"

const playerClassId = "0001"
const supportedMessageTypes: ReceivedMessage["type"][] = ["announce", "delete"]
type SupportedMessageType = AnnounceMessage | DeleteMessage

export interface Player {
  ip: string
  port: number
}

const discoverPlayersWithLsdp = (): Observable<Packet> =>
  from(createConnection()).pipe(
    switchMap((connection): Observable<Packet> => {
      return new Observable((observer) => {
        connection.onData((err, packet) => {
          if (err) {
            observer.error(err)
          } else if (packet !== undefined) {
            observer.next(packet)
          }
        })

        connection.sendMessage({
          type: "query",
          messageType: "standard",
          classIds: [playerClassId],
        })

        return () => {
          try {
            connection.close()
          } catch (e: any) {
            if (e.code !== "ERR_SOCKET_DGRAM_NOT_RUNNING") {
              throw e
            }
          }
        }
      })
    }),
  )

type ServiceRecord = Partial<Record<string, AnnounceMessage>>

export const discoverPlayersObservable = (): Observable<Player[]> =>
  discoverPlayersWithLsdp().pipe(
    filter(
      (packet: Packet): packet is ReceivedPacket => packet.type === "lsdp",
    ),
    map((packet: ReceivedPacket) => packet.message),
    filter((message): message is SupportedMessageType =>
      supportedMessageTypes.includes(message.type),
    ),
    scan((acc: ServiceRecord, message: SupportedMessageType) => {
      switch (message.type) {
        case "announce":
          return {
            ...acc,
            [message.nodeId]: message,
          }
        case "delete":
          return omit(acc, message.nodeId)
      }
    }, {}),
    map((announcements: ServiceRecord) =>
      Object.values(announcements).flatMap(
        (a: AnnounceMessage | undefined): Player[] =>
          a?.records
            .filter((r) => r.classId === playerClassId)
            .map((r) => ({
              ip: a.address,
              port: Number(r.txtRecords["port"]!),
            })) || [],
      ),
    ),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
  )
