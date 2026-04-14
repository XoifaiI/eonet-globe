FROM node:24 AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=363055381330-0plgi35mnbtnro700c87kn4gn2aegds1.apps.googleusercontent.com
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24 AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/instrumentation.ts ./

EXPOSE 8080

USER node

CMD ["npm", "run", "start", "--", "-p", "8080"]
