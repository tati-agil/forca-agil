#!/usr/bin/env bash
# B0 (H2-b): verificação SÓ DE LEITURA dos requisitos de Cloud Functions no projeto.
# Uso: verificar-infra-functions.sh <chave-da-conta-de-servico.json>   (PROJETO no ambiente; padrão kyber-agil)
# Nenhum comando aqui grava, habilita, desabilita ou altera nada. Falta de permissão = "NÃO FOI POSSÍVEL VERIFICAR".
set -u
CHAVE="$1"; PROJETO="${PROJETO:-kyber-agil}"
SA=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['client_email'])" "$CHAVE")
gcloud auth activate-service-account --key-file="$CHAVE" --quiet >/dev/null 2>&1 || { echo "NÃO FOI POSSÍVEL autenticar a conta de serviço"; exit 1; }
nao() { echo "  NÃO FOI POSSÍVEL VERIFICAR ($1)"; }
echo "== Projeto: $PROJETO · conta de serviço: $SA"

echo "== 1. Plano (Blaze = faturamento vinculado)"
if out=$(gcloud billing projects describe "$PROJETO" --format='value(billingEnabled,billingAccountName)' 2>&1); then
  echo "  billingEnabled / conta: $out"
  case "$out" in True*|true*) echo "  → faturamento VINCULADO: o projeto está no Blaze";; *) echo "  → sem faturamento: plano Spark (Cloud Functions indisponível)";; esac
else nao "billing: $(echo "$out" | head -1)"; fi

echo "== 2. APIs usadas por Cloud Functions (2ª geração) — habilitadas?"
if out=$(gcloud services list --enabled --project "$PROJETO" --format='value(config.name)' 2>&1); then
  for api in cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com eventarc.googleapis.com pubsub.googleapis.com secretmanager.googleapis.com firebaseextensions.googleapis.com; do
    if echo "$out" | grep -qx "$api"; then echo "  ✓ $api"; else echo "  ✗ $api (não habilitada — NÃO foi habilitada por esta verificação)"; fi
  done
else nao "service usage: $(echo "$out" | head -1)"; fi

echo "== 3. Papéis da conta de serviço do CI no projeto"
if out=$(gcloud projects get-iam-policy "$PROJETO" --flatten='bindings[].members' --filter="bindings.members:serviceAccount:$SA" --format='value(bindings.role)' 2>&1); then
  echo "$out" | sed 's/^/  /'
  for papel in roles/cloudfunctions.developer roles/cloudfunctions.admin roles/iam.serviceAccountUser roles/artifactregistry.admin roles/run.admin roles/firebase.admin roles/editor roles/owner; do
    if echo "$out" | grep -qx "$papel"; then echo "  ✓ tem $papel"; fi
  done
else nao "IAM: $(echo "$out" | head -1)"; fi

echo "== 4. Banco (região define onde a Function deve rodar)"
if out=$(GOOGLE_APPLICATION_CREDENTIALS="$CHAVE" npx --yes firebase-tools@13 database:instances:list --project "$PROJETO" 2>&1); then
  echo "$out" | sed 's/^/  /' | tail -n 15
else nao "database:instances:list: $(echo "$out" | tail -1)"; fi

echo "== Fim. Nada foi gravado nem habilitado."
