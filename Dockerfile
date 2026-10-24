FROM node:24.11.1-bookworm-slim
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/hardcase-browsers
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --ignore-scripts && npx playwright install --with-deps chromium
COPY . .
RUN npm run build && mkdir -p /var/lib/hardcase && chown node:node /var/lib/hardcase
ENV NODE_ENV=production ENGINE_DATA_DIR=/var/lib/hardcase HARDCASE_WEB_PORT=4327
USER node
EXPOSE 4327
VOLUME ["/var/lib/hardcase"]
CMD ["npm", "start"]
