FROM node:16

RUN yarn

CMD ["node", "index.js"]