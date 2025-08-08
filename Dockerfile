FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S eventbuddy -u 1001

COPY package*.json ./

RUN npm ci --only=production && \
    npm cache clean --force

COPY --chown=eventbuddy:nodejs src/ src/
COPY --chown=eventbuddy:nodejs .env.example .env

RUN mkdir -p logs && \
    chown -R eventbuddy:nodejs logs

USER eventbuddy

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "src/app.js"]