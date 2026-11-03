FROM node:22-alpine

WORKDIR /workspace

COPY packages/shared ./packages/shared
COPY apps/api/package.json apps/api/package-lock.json apps/api/prisma.config.ts ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY apps/indexer ./apps/indexer

WORKDIR /workspace/apps/api
RUN npm install && npx prisma generate

WORKDIR /workspace/apps/indexer
RUN npm install

CMD ["npx", "tsx", "src/index.ts"]
