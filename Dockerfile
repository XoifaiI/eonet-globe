FROM node:24 AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV VITE_GOOGLE_CLIENT_ID=363055381330-0plgi35mnbtnro700c87kn4gn2aegds1.apps.googleusercontent.com

RUN npx vite build

FROM node:24 AS production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server ./server

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

USER node

CMD ["node", "--import", "tsx/esm", "server/index.ts"]
