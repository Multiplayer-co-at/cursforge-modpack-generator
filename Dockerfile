FROM node:16

COPY package.json ./package.json
COPY yarn.lock ./yarn.lock
RUN yarn

COPY node_modules ./node_modules
COPY index.js ./index.js
COPY entrypoint.sh ./entrypoint.sh

ENV CURSEFORGE_API_TOKEN=$INPUT_CURSEFORGE-API-TOKEN
ENV CLIENT_PACK_PATH=$INPUT_CLIENTPACK

ENTRYPOINT [ "entrypoint.sh" ]