FROM node:18

COPY . .
RUN yarn install
COPY node_modules/node-curseforge /node_modules/node-curseforge

ENV CURSEFORGE_API_TOKEN=$INPUT_CURSEFORGE-API-TOKEN
ENV CLIENT_PACK_PATH=$INPUT_CLIENTPACK
ENV WORKSPACE=$GITHUB_WORKSPACE

RUN ["chmod", "+x", "/index.js"]
ENTRYPOINT [ "node", "/index.js" ]