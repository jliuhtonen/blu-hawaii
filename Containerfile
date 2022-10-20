FROM node:18-bullseye-slim

VOLUME /home/blu-hawaii /var/log/blu-hawaii

ENV LOG_DEST /var/log/blu-hawaii/blu-hawaii.log
ENV SESSION_FILE_PATH /home/blu-hawaii/.blu-hawaii-session

RUN useradd -r -s /usr/sbin/nologin -M blu-hawaii

RUN mkdir -p /opt/blu-hawaii
RUN chown blu-hawaii:blu-hawaii /opt/blu-hawaii

COPY package.json /opt/blu-hawaii
COPY node_modules/ /opt/blu-hawaii/node_modules
COPY dist/ /opt/blu-hawaii/dist

USER blu-hawaii
WORKDIR /opt/blu-hawaii
ENTRYPOINT ["node", "dist/index.js"]
