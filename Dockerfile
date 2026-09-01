FROM node:24-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node adapters ./adapters
COPY --chown=node:node app.js data-platform.js mountain-data.js parking-model.js route-engine.js safety-engine.js scoring.js server.js service-worker.js ./
COPY --chown=node:node icon.svg index.html manifest.webmanifest styles.css ./

USER node

EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/readyz').then(response=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
