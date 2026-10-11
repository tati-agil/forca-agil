# Backend — Núcleo de Avaliação, Taxonomia e Mapa da Floresta

O backend é um **projeto NestJS único, organizado como monólito modular**, com PostgreSQL. Por enquanto existe só
como **ambiente local** de desenvolvimento, com dados sintéticos.

O FORÇA ÁGIL publicado continua inteiramente no Firebase (Spark) e **não depende deste backend**:

- o site não chama a API;
- o Hosting não publica `backend/`;
- o deploy da `main` continua sendo só hosting + database.

## Arquitetura: três camadas no mesmo projeto

| Camada | Onde | Responsabilidade | Pode depender de |
|---|---|---|---|
| **1. API e aplicação** | `src/modulos/<módulo>/api` e `…/aplicacao` | controllers, validação de entrada, casos de uso, autenticação/autorização (futura), erros e respostas | contratos (portas), Núcleo |
| **2. Núcleo de Avaliação, Taxonomia e Mapa da Floresta** | `src/nucleo` → **os arquivos do site** (`forca-agil/*-nucleo.js`) | regras de negócio puras | nada de infraestrutura |
| **3. Contratos e adaptadores de persistência** | `src/persistencia/contratos` e `src/persistencia/postgres` | interfaces de acesso a dados, repositórios, adaptadores PostgreSQL, transações e concorrência, eventos e histórico | driver `pg` (só os adaptadores) |

O sentido das dependências é verificado por `test/arquitetura.spec.ts`:

- o Núcleo não importa NestJS, `pg` nem Firebase;
- API e aplicação não importam o adaptador PostgreSQL;
- só a persistência usa o driver.

A aplicação conhece **portas** (por exemplo, `VERIFICADOR_BANCO` e `UNIDADE_DE_TRABALHO`), e o `PersistenciaModule`
liga cada porta ao seu adaptador. Trocar de banco é trocar só esse módulo.

### O Núcleo não é reescrito nem copiado

`src/nucleo/estruturas.ts` carrega **o mesmo arquivo** que o site usa, `forca-agil/estruturas-nucleo.js`, pelo mesmo
caminho relativo no repositório e na imagem Docker. Quem verifica isso:

- `test/nucleo-estruturas.spec.ts` confere que é o mesmo arquivo, que não há cópia e que o resultado é o mesmo do site;
- `.github/scripts/teste-backend-isolado.js` faz a mesma conferência no repositório.

Os contratos do núcleo estão em `docs/estruturas-nucleo-contratos.md`. Os motores (P1–P16, O1–O9 v1 em vigor e v2
inativa, S1–S8) continuam onde estão. Cada um entra no backend do mesmo jeito, quando o seu módulo chegar.

### Estrutura

```
backend/
├── compose.yaml              ← os dois contêineres (api + postgres)
├── Dockerfile                ← imagem da API (contexto = raiz do repositório)
├── Dockerfile.dockerignore   ← só o necessário entra na imagem
├── .env.example              ← modelo de configuração (copie para .env, que não vai para o Git)
├── package.json / package-lock.json / tsconfig*.json / jest.integracao.config.js
├── migracoes/                ← migrações versionadas do esquema (NNNN_descricao.sql)
├── scripts/verificar-ambiente.js   ← verificação do ambiente Docker de verdade
├── src/
│   ├── main.ts, aplicacao.ts, app.module.ts
│   ├── configuracao/         ← variáveis de ambiente validadas na inicialização
│   ├── compartilhado/        ← filtro de erros; porta de identidade (Firebase Auth, futura)
│   ├── nucleo/               ← CAMADA 2: ponte para o Núcleo do site
│   ├── modulos/saude/        ← CAMADA 1: api/ (controller) e aplicacao/ (caso de uso + porta)
│   ├── persistencia/         ← CAMADA 3: contratos/ e postgres/ (pool, verificador, unidade de trabalho, migrações)
│   └── scripts/migrar.ts
└── test/                     ← unitários e de API; integracao/ contra PostgreSQL real
```

## Requisitos na sua máquina

- **Docker Desktop**, com Docker Compose v2. No Windows, use o backend WSL 2, que é o padrão do Docker Desktop.
- **Git.**
- **Node.js 22 LTS.** Só é necessário para rodar os testes e scripts fora do Docker; para subir o ambiente, basta o Docker.

### Versões usadas

| Item | Versão |
|---|---|
| Node.js (imagem `node:22-alpine`) | 22 LTS |
| NestJS | 11.2.7 |
| TypeScript | 5.9.3 |
| PostgreSQL (imagem `postgres:17-alpine`) | 17 |
| Driver `pg` | 8.23.1 |
| Jest / ts-jest | 29.7.0 / 29.4.14 |

O NestJS 12 existe, mas é exclusivamente ESM e saiu em agosto/2026. Ficamos no 11, maduro e suportado. A
atualização para o 12 é uma tarefa futura, à parte.

## Comandos (sempre dentro de `backend/`)

| O quê | Comando |
|---|---|
| Configurar (uma vez) | `cp .env.example .env` e troque `POSTGRES_PASSWORD` por uma senha local qualquer. No PowerShell: `Copy-Item .env.example .env` |
| **Subir** (constrói a imagem) | `docker compose up --build -d` |
| Ver o estado | `docker compose ps` |
| Saúde da API | `curl http://127.0.0.1:3000/api/saude` ou abrir no navegador |
| Disponibilidade do banco | `curl http://127.0.0.1:3000/api/saude/banco` (200 = disponível; 503 = indisponível) |
| **Verificar tudo** | `npm run verificar:ambiente` (precisa de Node no computador) |
| Logs | `docker compose logs -f api` ou `docker compose logs -f postgres` |
| Aplicar migrações | `docker compose exec api npm run migrar` |
| **Parar** (mantém os dados) | `docker compose stop` |
| Reiniciar | `docker compose restart` |
| Derrubar (mantém o volume) | `docker compose down` |
| Apagar tudo, inclusive os dados | `docker compose down -v` |

### Testes, independentes de IA

| Comando | O que roda |
|---|---|
| `npm ci` | instala as dependências (uma vez) |
| `npm run typecheck` / `npm run build` | verificação de tipos e compilação |
| `npm test` | unitários, API (com dublê do banco), arquitetura e reaproveitamento do Núcleo |
| `npm run test:integracao` | contra um PostgreSQL **real**, usando as variáveis `POSTGRES_*` |

O PostgreSQL do Compose não publica porta. Para rodar a integração contra ele, use um contêiner na rede interna:

```
docker run --rm --network forca-agil-local_interna -v "${PWD}/..:/repo" -w /repo/backend --env-file .env -e POSTGRES_HOST=postgres node:22-alpine npx jest --config jest.integracao.config.js
```

O CI faz o mesmo, em `.github/workflows/backend.yml`.

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `required variable POSTGRES_PASSWORD is missing` | falta o `.env` | `cp .env.example .env` e defina a senha |
| `429 Too Many Requests` ao baixar imagens | limite anônimo do Docker Hub | faça `docker login`, ou use um espelho/registro corporativo: defina `POSTGRES_IMAGE` e `NODE_IMAGE` no `.env` |
| `npm ci` falha no build com erro de certificado | rede com proxy de inspeção TLS (comum em redes corporativas) | crie um `compose.override.yaml` local (não versionado) passando a CA da empresa como *build secret* `ca_corporativa` (exemplo abaixo); ela é usada só no build e não fica na imagem |
| porta 3000 ocupada | outro programa | defina `API_PORTA` no `.env` |

```yaml
# compose.override.yaml — só na sua máquina, nunca no Git
services:
  api:
    build:
      secrets: [ca_corporativa]
secrets:
  ca_corporativa:
    file: C:/caminho/para/ca-da-empresa.crt
```

## Autenticação (preparada, não ligada)

A identidade continua sendo a do **Firebase Authentication**. Não haverá autenticação paralela. O login do site não muda.

**Como vai funcionar quando houver rotas de negócio:**

1. O navegador envia o ID token do Firebase: `Authorization: Bearer <token>`.
2. Um *guard* NestJS valida o token com o Firebase Admin SDK (`verifyIdToken`): assinatura pelas chaves públicas do Google, emissor e audiência iguais ao projeto Firebase, e validade.
   - Validar o token exige só o ID do projeto, sem conta de serviço.
3. O guard implementa a porta `VerificadorIdentidade` (`src/compartilhado/autenticacao`).
4. Os perfis (admin geral, Avaliação, Avaliação + Arquitetura) continuam vindo das mesmas listas oficiais, com as mesmas regras de hoje.

**Regras que valem desde já:**

- nenhuma rota de negócio existirá sem esse guard;
- hoje só existem `/api/saude` e `/api/saude/banco`, que não expõem dados nem detalhes de conexão.

## Segredos

- O `.env` e o `compose.override.yaml` não vão para o Git.
- O `.env.example` só tem valores de exemplo.
- A senha do banco nunca aparece em logs nem em respostas: a configuração inválida cita só o nome da variável.
- A imagem roda como usuário sem privilégios (`node`).
- O banco só é alcançável pela rede interna do Docker, e a API só em `127.0.0.1`.
