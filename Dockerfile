FROM node:24 AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_GOOGLE_CLIENT_ID
RUN VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID} npx vite build

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
