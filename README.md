# blu-hawaii 🍹

[![blu-hawaii CI](https://github.com/jliuhtonen/blu-hawaii/actions/workflows/blu-hawaii.yml/badge.svg)](https://github.com/jliuhtonen/blu-hawaii/actions/workflows/blu-hawaii.yml)

blu-hawaii enables you to scrobble what music you are playing on your [BluOS player](https://bluos.io/) like Bluesound Node to Last.fm. It is intended to run in the background on a server-like computer that can access the BluOS player. To use blu-hawaii you will currently need your own set of Last.fm API keys. If you don't have an API key and secret, you can [create API credentials on Last.fm](https://www.last.fm/api/account/create).

A [docker image](https://hub.docker.com/r/jliuhtonen/blu-hawaii/) is available on Dockerhub.

## Service discovery

If you do not provide ip address and port of your BluOS player, blu-hawaii will try to discover all players on the network using Lenbrook Service Discovery Protocol (LSDP) that is based on UDP broadcast. This requires that your BluOS players are reachable in the same network as the computer running blu-hawaii. For the service discovery to work, blu-hawaii needs to be able to listen for UDP broadcast traffic to port `11430`, be sure to open it from your firewall if you want to use this feature.

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

## Installing

You can install blu-hawaii from Dockerhub:

```
docker pull jliuhtonen/blu-hawaii:latest
```

Or with npm:

```
npm install -g @jliuhtonen/blu-hawaii
```

## Running

On the first run, you need to approve the login in Last.fm UI, so blu-hawaii starts in "interactive mode" prompting you to make the approval.

```
Please approve the Last.fm API client at https://www.last.fm/api/auth/?api_key=xxx&token=yyy
Then type 'yes' followed by return to continue:
```

Copy the url provided and paste into your browser to approve. Then return to the shell session and enter 'yes', as instructed. On subsequent runs blu-hawaii can run unattended unless access is revoked from Last.fm or the session file gets removed.

So if you are running the process inside a container, for example, it is a good idea to run the container in an interactive mode on the first run.

### Running in container

There is a [Containerfile](Containerfile) for building and running blu-hawaii containerized and the image is released to [Dockerhub](https://hub.docker.com/r/jliuhtonen/blu-hawaii/).

To run the container in a production like setting, you'd want to do something like this

```
podman run --replace -d --name=blu-hawaii --network=host --mount type=volume,src=blu-hawaii-home,dst=/home/blu-hawaii --mount type=volume,src=blu-hawaii-logs,dst=/var/log/blu-hawaii -e LAST_FM_API_KEY=xxx -e LAST_FM_API_SECRET=yyy docker.io/jliuhtonen/blu-hawaii:latest
```
or
````
sudo docker run -it  --network=host -v /volume1/docker/blu-hawaii:/home/blu-hawaii -v /volume1/docker/bh-logs:/var/log/blu-hawaii -e LAST_FM_API_KEY=xxx -e LAST_FM_API_SECRET=yyy docker.io/jliuhtonen/blu-hawaii:latest
````
_Note that this uses the host network mode to be able to receive UDP broadcast traffic needed for LSDP discovery! You might want to disable service discovery and specify IP and port instead in some settings._

## Releasing

To release a new version, do the following:

```
npm version [major|minor|patch]
git push && git push --tags
npm run release
```
