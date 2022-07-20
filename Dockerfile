FROM node:16

COPY package.json .
COPY yarn.lock .
RUN yarn

COPY index.js .

CMD ["node", "index.js"]