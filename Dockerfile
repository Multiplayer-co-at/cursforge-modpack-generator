FROM node:18

COPY . .
RUN yarn install
COPY node_modules/node-curseforge /node_modules/node-curseforge

RUN ["chmod", "+x", "/index.js"]
ENTRYPOINT [ "node", "/index.js" ]