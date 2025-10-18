FROM node:trixie-slim AS build

RUN echo Updating existing packages and installing build tooling for Node modules.
RUN apt-get update -y && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

RUN echo Copying the Mythical Mysfits Node service into a service directory.
WORKDIR /MythicalMysfitsService
COPY package.json package-lock.json ./

RUN echo Installing Node packages listed in package.json
RUN npm ci

COPY tsconfig.json ./
COPY service ./service

RUN echo Building production bundle.
RUN npm run build
RUN npm prune --omit=dev

FROM node:trixie-slim

WORKDIR /MythicalMysfitsService
ENV NODE_ENV=production

COPY --from=build /MythicalMysfitsService/package.json ./
COPY --from=build /MythicalMysfitsService/package-lock.json ./
COPY --from=build /MythicalMysfitsService/node_modules ./node_modules
COPY --from=build /MythicalMysfitsService/dist ./dist

EXPOSE 8080

CMD ["node", "dist/mythicalMysfitsService.js"]
