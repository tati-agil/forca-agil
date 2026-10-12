#!/bin/sh
# AMBIENTE DE TESTES — roda DENTRO do contêiner descartável (imagem com Node, Java e firebase-tools).
# Sobe só os emuladores de banco e de login, com as regras REAIS do repositório (database.rules.json), num projeto
# "demo-" que não existe na nuvem. Os dados ficam em /dados/export (pasta do atalho no Windows): importados ao
# iniciar, exportados ao encerrar (docker stop). Nunca fala com o Firebase de verdade.
set -e
mkdir -p /work /dados/export
cp /src/database.rules.json /work/database.rules.json
cp /src/.github/scripts/ambiente-local/firebase.json /work/firebase.json
cd /work
IMPORTAR=""
if [ -f /dados/export/firebase-export-metadata.json ]; then IMPORTAR="--import=/dados/export"; fi
exec /deps/node_modules/.bin/firebase emulators:start --only database,auth --project demo-forca-agil-local $IMPORTAR --export-on-exit=/dados/export
