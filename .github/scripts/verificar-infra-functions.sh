#!/usr/bin/env bash
# B0 (H2-b): verificação SÓ DE LEITURA dos requisitos de Cloud Functions no projeto.
# Uso (no workflow): a ação google-github-actions/auth já autenticou e exportou GOOGLE_APPLICATION_CREDENTIALS;
# PROJETO no ambiente (padrão kyber-agil). Este script NÃO recebe credencial por argumento e NÃO a imprime.
# Nenhum comando aqui grava, habilita, desabilita ou altera nada (teste-infra-somente-leitura.js confere).
# Falta de permissão = "NÃO FOI POSSÍVEL VERIFICAR". Identificadores sensíveis saem mascarados.
set -u
PROJETO="${PROJETO:-kyber-agil}"
CRED="${GOOGLE_APPLICATION_CREDENTIALS:-}"
[ -n "$CRED" ] && [ -f "$CRED" ] || { echo "Sem credencial da ação de autenticação: nada verificado."; exit 1; }
SA=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('client_email',''))" "$CRED")
[ -n "$SA" ] && echo "::add-mask::$SA"
# tira do texto o e-mail da conta e números de conta de faturamento, antes de qualquer saída
SA_RE=$(printf '%s' "$SA" | sed -e 's/[][\.*^$/#|+?(){}]/\\&/g')
limpar() {
  if [ -n "$SA_RE" ]; then sed -E -e "s#${SA_RE}#<conta-de-servico>#g" -e 's#billingAccounts/[A-Za-z0-9-]+#billingAccounts/<oculta>#g' -e 's#[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}#<oculta>#g'
  else sed -E -e 's#billingAccounts/[A-Za-z0-9-]+#billingAccounts/<oculta>#g' -e 's#[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}#<oculta>#g'; fi
}
nao() { echo "  NÃO FOI POSSÍVEL VERIFICAR ($(echo "$1" | head -1 | limpar))"; }
echo "== Projeto: $PROJETO"

echo "== 1. Plano (Blaze = faturamento vinculado)"
if out=$(gcloud billing projects describe "$PROJETO" --format='value(billingEnabled)' 2>&1); then
  case "$out" in True|true) echo "  faturamento VINCULADO: o projeto está no Blaze";; False|false) echo "  sem faturamento: plano Spark (Cloud Functions indisponível)";; *) nao "$out";; esac
else nao "billing: $out"; fi

echo "== 2. APIs usadas por Cloud Functions (2ª geração) — habilitadas?"
if out=$(gcloud services list --enabled --project "$PROJETO" --format='value(config.name)' 2>&1); then
  for api in cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com eventarc.googleapis.com pubsub.googleapis.com; do
    if echo "$out" | grep -qx "$api"; then echo "  ✓ $api"; else echo "  ✗ $api (não habilitada — e NÃO foi habilitada por esta verificação)"; fi
  done
else nao "service usage: $out"; fi

echo "== 3. Papéis da conta de serviço do CI no projeto"
if out=$(gcloud projects get-iam-policy "$PROJETO" --flatten='bindings[].members' --filter="bindings.members:serviceAccount:$SA" --format='value(bindings.role)' 2>&1); then
  if [ -n "$out" ]; then echo "$out" | sed 's/^/  /' | limpar; else echo "  (nenhum papel direto encontrado)"; fi
else nao "IAM: $out"; fi

echo "== 4. Banco (região define onde a Function deve rodar)"
if out=$(npx --yes firebase-tools@13 database:instances:list --project "$PROJETO" 2>&1); then
  echo "$out" | tail -n 15 | sed 's/^/  /' | limpar
else nao "database:instances:list: $(echo "$out" | tail -1)"; fi

echo "== Fim. Nada foi gravado nem habilitado."
