# One image recipe for every service: docker build --build-arg SERVICE=appointment .
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install dependencies first so they are cached until a package.json changes.
COPY package.json package-lock.json ./
COPY packages/common/package.json packages/common/
COPY services/appointment/package.json services/appointment/
COPY services/repair-order/package.json services/repair-order/
COPY services/inventory/package.json services/inventory/
COPY services/notification/package.json services/notification/
COPY services/gateway/package.json services/gateway/
RUN npm ci --omit=dev --no-audit --no-fund

COPY packages packages
COPY services services

ARG SERVICE
ENV SERVICE=${SERVICE}
USER node
CMD ["sh", "-c", "exec node services/${SERVICE}/src/index.js"]
