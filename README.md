# blu-hawaii

blu-hawaii enables you to send whatever you are playing on your [BluOS player](https://bluos.net/) to Last.fm. It is intended to run in the background on a server-like computer in the same network as your BluOS player.

## Service discovery

If you do not provide ip address and port of your BluOS player, blu-hawaii will try to discover all players on the network using Lenbrook Service Discovery Protocol (LSDP) that is based on UDP broadcast. This requires that your BluOS players are reachable in the same network as the computer running blu-hawaii.

If you cannot use service discovery, you can always find out the IP address of your BluOS player from the BluOS app. The port is usually `11000`.

## Configuration

blu-hawaii supports configuration with the following environment variables:

- `LOG_LEVEL` output log level, see [Pino documentation](https://github.com/pinojs/pino/blob/master/docs/api.md#levels)
- `LOG_DEST` path to a logfile or `stdout` for, you know, standard out
- `BLUOS_IP` IP address of your BluOS player (optional if not using service discovery)
- `BLUOS_PORT` Port where BluOS Custom Integration API resides, this is usually `11000` (optional if not using service discovery)
- `LAST_FM_API_KEY` Your Last.fm API key
- `LAST_FM_API_SECRET` Your Last.fm API secret
- `SESSION_FILE_PATH` Path to file where blu-hawaii should store the Last.fm session token in a file

You can also use a `.env` file. See [configuration.ts](src/configuration.ts) for all the details.

If you don't have an API key and secret, you can [create API credentials on Last.fm](https://www.last.fm/api/account/create).

## Running

On the first run, you need to approve the login in Last.fm UI, so blu-hawaii starts in "interactive mode" prompting you to make the approval.

```
Please approve the Last.fm API client at https://www.last.fm/api/auth/?api_key=xxx&token=yyy
Then type 'yes' followed by return to continue:
```

Follow the instructions. On subsequent runs blu-hawaii can run unattended unless access is revoked from Last.fm or the session file gets removed.

So if you are running the process inside a container, for example, it is a good idea to run the container in an interactive mode on the first run.

### Running in container

There is a [Containerfile](Containerfile) for building and running blu-hawaii containerized. It has currently been tested with [Podman](https://podman.io/).