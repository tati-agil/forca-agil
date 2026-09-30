# 10 — CI/CD, ambientes e deploy

> Pré-requisitos: [07](07-infraestrutura-docker.md), [09](09-testes-e-validacao.md).

---

## 1. Ambientes

| Ambiente | Onde | Para quê | Dados | Quem publica |
|---|---|---|---|---|
| **dev** | máquina de quem desenvolve (Docker Desktop / Docker Engine) | desenvolver e testar | semente de teste + cópia anonimizada (opcional) | a própria pessoa |
| **homolog** | servidor Linux interno (pode ser o mesmo host de produção com outro `COMPOSE_PROJECT_NAME` e outra porta/nome, **mas de preferência outro servidor**) | ensaios de importação, testes manuais, ensaio de oficina, suíte "Automáticos" | cópia **real** importada do Firebase (com cuidado LGPD: acesso só da equipe) | pipeline, automático a cada merge na `main` |
| **prod** | servidor Linux interno | uso real | dados reais | pipeline, com **aprovação manual** |

Cada ambiente tem seu próprio `.env` (segredos diferentes) e seu próprio banco.

---

## 2. Onde o pipeline roda (decisão da TI — pendência P-07)

O GitHub Actions hospedado (`ubuntu-latest`) **não enxerga** a rede interna da empresa. Opções, em ordem de preferência:

| Opção | Como | Prós | Contras |
|---|---|---|---|
| **A. GitHub Actions + runner auto-hospedado** na rede interna | instalar o *runner* do GitHub numa VM interna (Linux), com Docker; *labels* `self-hosted, linux, forcaagil` | reaproveita os workflows e o histórico do repositório | runner precisa sair para `github.com` (HTTPS) |
| **B. CI corporativo** (GitLab CI, Jenkins, Azure DevOps) com espelho do repositório | espelhar o repo e traduzir os passos abaixo | tudo interno | manter o espelho |
| **C. Manual assistido** | pessoa roda `infra/scripts/deploy.sh` no servidor | zero infraestrutura extra | depende de disciplina; sem testes automáticos no deploy |

Os passos abaixo valem para qualquer opção. Os exemplos usam a opção A.

---

## 3. Pipeline

### 3.1 Em todo Pull Request

```
1. checkout
2. testes que JÁ existem (continuam valendo): teste-consistencia-docs.js; ~28 Playwright com banco falso
   (depois da Fase 6, com a interceptação nova — doc. 09 §3)
3. backend: npm ci → lint → typecheck → test (unitários) → test:e2e (Mongo em memória, replica set)
4. docker build das imagens web e api (sem publicar) — garante que o Dockerfile não quebrou
5. (Fase 5 em diante) Playwright no modo real contra a pilha docker-compose.test.yml (doc. 09 §4)
```

### 3.2 Merge na `main`

```
1. tudo do PR
2. build das imagens com tag = SHA curto do commit:  forcaagil/web:<sha>  forcaagil/api:<sha>
3. push para o registro interno (pendência P-06)
4. deploy automático em HOMOLOG (infra/scripts/deploy.sh)
5. smoke test em homolog: GET /api/health/ready; abrir / e conferir título; login com usuário de teste
6. suíte "Automáticos" contra homolog
7. deploy em PROD: job com "environment: producao" e APROVAÇÃO MANUAL (Settings → Environments → Required reviewers)
```

### 3.3 Exemplo de workflow (opção A) — `.github/workflows/deploy-interno.yml`

> **Não criar este arquivo antes da Fase 9 do plano.** Enquanto o Firebase estiver em produção, o `firebase-deploy.yml` continua sendo o deploy oficial.

```yaml
name: Deploy interno (homolog → prod)
on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency: { group: deploy-interno, cancel-in-progress: false }

jobs:
  build:
    runs-on: [self-hosted, linux, forcaagil]
    outputs:
      tag: ${{ steps.tag.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
      - id: tag
        run: echo "tag=$(git rev-parse --short HEAD)" >> "$GITHUB_OUTPUT"
      - name: Testes do backend
        working-directory: backend
        run: npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e
      - name: Build e push das imagens
        env:
          REGISTRO: ${{ vars.REGISTRO_IMAGENS }}      # ex.: registry.previ.com.br/forcaagil
        run: |
          docker login "$REGISTRO" -u "${{ secrets.REGISTRO_USUARIO }}" -p "${{ secrets.REGISTRO_SENHA }}"
          docker build -t "$REGISTRO/api:${{ steps.tag.outputs.tag }}" backend
          docker build -t "$REGISTRO/web:${{ steps.tag.outputs.tag }}" -f infra/web/Dockerfile .
          docker push "$REGISTRO/api:${{ steps.tag.outputs.tag }}"
          docker push "$REGISTRO/web:${{ steps.tag.outputs.tag }}"

  homolog:
    needs: build
    runs-on: [self-hosted, linux, forcaagil-homolog]
    environment: homolog
    steps:
      - name: Deploy
        run: TAG_IMAGEM=${{ needs.build.outputs.tag }} /opt/forcaagil/app/infra/scripts/deploy.sh
      - name: Smoke test
        run: curl -fsS https://${{ vars.DOMINIO_HOMOLOG }}/api/health/ready

  producao:
    needs: [build, homolog]
    runs-on: [self-hosted, linux, forcaagil-prod]
    environment: producao          # com revisores obrigatórios configurados no GitHub
    steps:
      - name: Deploy
        run: TAG_IMAGEM=${{ needs.build.outputs.tag }} /opt/forcaagil/app/infra/scripts/deploy.sh
      - name: Smoke test
        run: curl -fsS https://${{ vars.DOMINIO_PROD }}/api/health/ready
```

---

## 4. Scripts de deploy e rollback

### 4.1 `infra/scripts/deploy.sh`

```bash
#!/usr/bin/env bash
# Uso: TAG_IMAGEM=<sha> ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."                      # infra/
: "${TAG_IMAGEM:?defina TAG_IMAGEM}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "[deploy] versão atual: $(cat .versao-atual 2>/dev/null || echo nenhuma) → nova: $TAG_IMAGEM"

echo "[deploy] backup antes do deploy"
$COMPOSE exec -T backup bash /backup.sh || { echo "backup falhou — abortando"; exit 1; }

echo "[deploy] baixando imagens"
TAG_IMAGEM=$TAG_IMAGEM $COMPOSE pull api web

echo "[deploy] subindo"
TAG_IMAGEM=$TAG_IMAGEM $COMPOSE up -d --no-build api web

echo "[deploy] aguardando saúde"
for i in $(seq 1 30); do
  if curl -fsSk https://127.0.0.1/api/health/ready >/dev/null; then ok=1; break; fi
  sleep 2
done
if [ "${ok:-0}" != 1 ]; then
  echo "[deploy] API não ficou saudável — executando rollback"
  ./scripts/rollback.sh
  exit 1
fi

cp -f .versao-atual .versao-anterior 2>/dev/null || true
echo "$TAG_IMAGEM" > .versao-atual
echo "[deploy] ok: $TAG_IMAGEM"
```

### 4.2 `infra/scripts/rollback.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ANTERIOR=$(cat .versao-anterior 2>/dev/null || true)
[ -n "$ANTERIOR" ] || { echo "sem versão anterior registrada"; exit 1; }
echo "[rollback] voltando para $ANTERIOR"
TAG_IMAGEM=$ANTERIOR docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build api web
echo "$ANTERIOR" > .versao-atual
```

> **Rollback de código ≠ rollback de dados.** O backend da Fase A não altera o formato dos dados (envelope `v`), então voltar a imagem anterior é seguro. Se uma versão futura (Fase B) mudar formato, ela precisa trazer script de migração **e** de reversão, testados em homologação.

---

## 5. Scripts de operação (substituem os que falavam com o Firebase)

| Hoje | Depois | Como rodar |
|---|---|---|
| `audit-facilitadores-turmas.js` (lê via REST do Firebase) | `tools/ops/auditoria-facilitadores.ts` (lê MongoDB, só leitura, usuário Mongo **somente-leitura**) | `docker compose ... run --rm api node dist-tools/ops/auditoria-facilitadores.js` ou `workflow_dispatch` no runner interno |
| `diagnostico-execucao-vazamento-grupo.js` | `tools/ops/diagnostico-aposta.ts` (mesma lógica, sobre `apostas`) | idem |
| `backfill-grupos-resumo.js` (grava com confirmação) | `tools/ops/backfill-grupos-resumo.ts` — `updateOne` com filtro `{"v.execucoes.<e>.grupos-resumo.<g>": {$exists: false}}`, **dry-run por padrão**, `--confirmar` para gravar | idem |

Criar o usuário Mongo somente-leitura (uma vez):
```js
db.getSiblingDB('forcaagil').createUser({ user: 'forcaagil_leitura', pwd: '<<gerar>>', roles: [{ role: 'read', db: 'forcaagil' }] })
```

---

## 6. O que acontece com os workflows do Firebase

| Workflow | Até o corte | No dia do corte | Depois |
|---|---|---|---|
| `firebase-deploy.yml` | continua publicando o site na `main` | **desativar** (senão o próximo push "descongela" as regras — doc. 08 §6.3). Forma recomendada: trocar o gatilho para `workflow_dispatch` num PR do dia do corte | remover na Fase 10 |
| `firebase-preview.yml`, `firebase-preview-v3.yml` | inalterados (branches `v2`, `v3-quiz`) | desativar | remover |
| `teste-rules.yml` | continua | continua (o `database.rules.json` é a especificação; o diferencial de regras depende dele) | na Fase B, substituir pelos testes do backend |
| `testes-automaticos.yml` | continua | último passo (`run-testes-automaticos.js`) passa a apontar para homolog | — |
| `audit-*`, `backfill-*`, `diagnostico-*` | continuam contra o Firebase | desativar | substituídos pelos da seção 5 |

---

## 7. Segredos

| Segredo | Onde fica | Quem acessa |
|---|---|---|
| `.env` de cada ambiente (Mongo, sessão, SMTP, scrypt do Firebase) | no servidor, `/opt/forcaagil/app/infra/.env`, `chmod 600` | equipe de infra |
| Credenciais do registro de imagens | segredo do CI | CI |
| Parâmetros de hash do Firebase | `.env` (só enquanto houver contas com `firebaseHash`; depois de ~6 meses, se todas já logaram, remover) | infra |
| `FA_TEST_ADMIN_*`, `FA_TEST_MEMBER_*` | segredo do CI | CI |

Nunca commitar `.env`, exportações do Firebase, relatórios de conferência com dados pessoais, ou certificados.

---

## 8. Atualização de dependências e imagens

- Mensal: `npm outdated` no `backend/`, atualizar patches/minors, rodar a suíte.
- Imagens base (`node:22-alpine`, `nginx:1.27-alpine`, `mongo:7.0`): rebuild mensal para pegar correções de segurança.
- MongoDB: atualizações de versão maior (7 → 8) só com plano próprio, testado em homologação com restauração de backup.
