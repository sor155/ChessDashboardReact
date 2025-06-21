FROM node:18-alpine AS builder
WORKDIR /app

# copy only lockfiles/metadata first for better cache
COPY package*.json ./

# disable audit + skip optional deps + favor offline cache
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_OPTIONAL=false \
    NPM_CONFIG_PREFER_OFFLINE=true

RUN npm install

COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80