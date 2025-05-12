FROM node:22-alpine

WORKDIR /usr/src/app
COPY package*.json ./
RUN mkdir src
RUN npm install
COPY src/ /usr/src/app/src

COPY tsconfig.json ./
RUN npm run build
EXPOSE 3000

CMD ["npm", "start"]
