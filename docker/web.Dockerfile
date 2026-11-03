FROM node:22-alpine

WORKDIR /workspace

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

WORKDIR /workspace/apps/web
RUN npm install && npm run build

EXPOSE 5173

CMD ["npx", "next", "start", "--port", "5173"]
