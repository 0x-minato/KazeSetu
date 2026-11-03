FROM node:22-alpine

WORKDIR /workspace

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

WORKDIR /workspace/apps/api
RUN npm install && npx prisma generate

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/server.ts"]
