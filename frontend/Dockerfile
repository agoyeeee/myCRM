# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /src
COPY --from=deps /src/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /src
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /src ./
EXPOSE 3000
CMD ["npm", "start"]
