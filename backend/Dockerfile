# Backend do Núcleo de Avaliação, Taxonomia e Mapa da Floresta (NestJS).
# Contexto de build = raiz do repositório (ver compose.yaml), para levar o núcleo do site SEM copiá-lo para backend/.
# NODE_IMAGE permite usar um espelho ou o registro corporativo de imagens; o padrão é a imagem oficial.
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
# CA_CORPORATIVA (opcional): certificado de uma rede com proxy de inspeção TLS, passado como build secret — usado só
# durante o npm ci e nunca gravado na imagem. Sem ele, o build é o normal.
RUN --mount=type=secret,id=ca_corporativa,required=false \
    if [ -s /run/secrets/ca_corporativa ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_corporativa; fi; \
    npm ci --no-audit --no-fund
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build

FROM ${NODE_IMAGE} AS execucao
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN --mount=type=secret,id=ca_corporativa,required=false \
    if [ -s /run/secrets/ca_corporativa ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_corporativa; fi; \
    npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/backend/dist ./dist
COPY backend/migracoes ./migracoes
# o núcleo de regras é o MESMO arquivo do site (fonte única), no mesmo caminho relativo de backend/
COPY forca-agil/estruturas-nucleo.js /app/forca-agil/estruturas-nucleo.js
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
