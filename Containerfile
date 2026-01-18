FROM node:lts-trixie-slim AS base

FROM base AS builder

RUN mkdir -p /opt/build
WORKDIR /opt/build

COPY ./package.json .
COPY ./package-lock.json .
RUN npm ci

COPY ./src ./src
COPY ./tsconfig.json .

RUN npx tsc --incremental false

FROM base AS runner

ENV LOG_DEST /var/log/blu-hawaii/blu-hawaii.log
ENV SESSION_FILE_PATH /home/blu-hawaii/.blu-hawaii-session

RUN useradd -r -s /usr/sbin/nologin -M blu-hawaii

RUN mkdir -p /opt/blu-hawaii
RUN chown blu-hawaii:blu-hawaii /opt/blu-hawaii

COPY --from=builder /opt/build/package.json /opt/blu-hawaii
COPY --from=builder /opt/build/node_modules /opt/blu-hawaii/node_modules
COPY --from=builder /opt/build/dist /opt/blu-hawaii/dist

USER blu-hawaii
WORKDIR /opt/blu-hawaii
ENTRYPOINT ["node", "dist/index.js"]
