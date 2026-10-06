FROM node:22-alpine
WORKDIR /app
COPY api ./api
COPY lib ./lib
COPY data ./data
COPY public ./public
COPY server.js package.json ./
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "server.js"]
