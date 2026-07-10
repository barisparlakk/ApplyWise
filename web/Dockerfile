FROM node:26-alpine AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM dependencies AS development

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=development

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM dependencies AS builder

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

COPY . .
RUN npm run build

FROM node:26-alpine AS production

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/validate-runtime-env.mjs ./scripts/validate-runtime-env.mjs

USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "node scripts/validate-runtime-env.mjs && node server.js"]
