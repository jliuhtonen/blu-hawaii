import { Observable, filter, from, map, scan, switchMap } from "rxjs"
import {
  AnnounceMessage,
  DeleteMessage,
  Packet,
  ReceivedMessage,
  ReceivedPacket,
  createConnection,
} from "@jliuhtonen/nightvision"
import { omit } from "./util.js"

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

export const discoverPlayersObservable = (): Observable<Player[]> =>
  discoverPlayersWithLsdp().pipe(
    filter(
      (packet: Packet): packet is ReceivedPacket => packet.type === "lsdp",
    ),
    map((packet: ReceivedPacket) => packet.message),
    filter((message): message is SupportedMessageType =>
      supportedMessageTypes.includes(message.type),
    ),
    scan(
      (acc: Record<string, AnnounceMessage>, message: SupportedMessageType) => {
        switch (message.type) {
          case "announce":
            return {
              ...acc,
              [message.nodeId]: message,
            }
          case "delete":
            return omit(acc, message.nodeId)
        }
      },
      {},
    ),
    map((announcements) =>
      Object.values(announcements).flatMap((a) =>
        a.records
          .filter((r) => r.classId === playerClassId)
          .map((r) => ({ ip: a.address, port: Number(r.txtRecords["port"]!) })),
      ),
    ),
  )
