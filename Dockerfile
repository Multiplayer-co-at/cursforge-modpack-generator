FROM node:18
WORKDIR /curseforge-serverpack-generator

COPY . /app
RUN yarn

ENV CURSEFORGE_API_TOKEN=$INPUT_CURSEFORGE-API-TOKEN
ENV CLIENT_PACK_PATH=$INPUT_CLIENTPACK

RUN ["chmod", "+x", "/app/index.js"]
ENTRYPOINT [ "node", "/app/index.js" ]