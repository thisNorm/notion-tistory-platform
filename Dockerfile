FROM mcr.microsoft.com/playwright:v1.59.1-noble AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.59.1-noble AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/playwright ./playwright
COPY --from=builder /app/.env.example ./.env.example

EXPOSE 3000

CMD ["node", "server.js"]
