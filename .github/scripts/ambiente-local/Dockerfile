# AMBIENTE DE TESTES — imagem descartável do Firebase Emulator (banco + login): Node, Java e firebase-tools.
# Montada pelo atalho do Windows quando ainda não existe:  docker build -t fa-emulador-regras:local <esta pasta>
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jre-headless && rm -rf /var/lib/apt/lists/*
WORKDIR /deps
RUN npm init -y >/dev/null && npm install --no-audit --no-fund firebase-tools@13 @firebase/rules-unit-testing firebase
ENV NODE_PATH=/deps/node_modules
