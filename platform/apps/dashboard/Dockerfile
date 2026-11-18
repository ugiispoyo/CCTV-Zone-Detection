FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/dashboard ./apps/dashboard
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @cctv/dashboard build

FROM nginx:1.29-alpine
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=20s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
