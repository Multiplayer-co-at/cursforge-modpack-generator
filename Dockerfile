FROM node:18

COPY . /curseforge-serverpack-generator
RUN yarn install
COPY node_modules/ /curseforge-serverpack-generator/node_modules

ENV CURSEFORGE_API_TOKEN=$INPUT_CURSEFORGE-API-TOKEN
ENV CLIENT_PACK_PATH=$INPUT_CLIENTPACK

RUN ["chmod", "+x", "/curseforge-serverpack-generator/index.js"]
ENTRYPOINT [ "node", "/curseforge-serverpack-generator/index.js" ]