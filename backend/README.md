# Backend — Núcleo de Avaliação, Taxonomia e Mapa da Floresta

O backend é um **projeto NestJS único, organizado como monólito modular**, com PostgreSQL. Por enquanto existe só
como **ambiente local** de desenvolvimento, com dados sintéticos. O primeiro módulo funcional é o das
**Estruturas Organizacionais Concretas** (seção abaixo).

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
caminho relativo no repositório e na imagem Docker. Do mesmo jeito, `src/nucleo/posicionamento.ts` lê os **códigos
firmes** do próprio motor de Posicionamento (`forca-agil/motor-posicionamento-nucleo.js`): o backend não avalia O1–O9
nem muda a versão em vigor (v1; a v2 continua inativa). Quem verifica isso:

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
├── scripts/demonstrar-reinicio.js  ← registros sobrevivem ao reinício dos contêineres
├── src/
│   ├── main.ts, aplicacao.ts, app.module.ts
│   ├── configuracao/         ← variáveis de ambiente validadas na inicialização
│   ├── compartilhado/        ← filtro de erros; autenticacao/ (ID token do Firebase, perfis oficiais, guarda global)
│   ├── nucleo/               ← CAMADA 2: ponte para os núcleos do site (Estruturas; códigos firmes do motor)
│   ├── modulos/saude/        ← CAMADA 1: api/ (controller) e aplicacao/ (caso de uso + porta)
│   ├── modulos/estruturas/   ← CAMADA 1: api/ (controllers, filtro) e aplicacao/ (casos de uso, portas das fontes oficiais)
│   ├── persistencia/         ← CAMADA 3: contratos/ e postgres/ (pool, verificador, unidade de trabalho, migrações, repositório)
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
| `jose` (validação do ID token do Firebase) | 5.10.0 (a 6 é só ESM) |
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
| Aplicar migrações (cria as tabelas das Estruturas Concretas no banco local) | `docker compose exec api npm run migrar` |
| **Demonstrar o reinício** sem perder registros (dados sintéticos, schema próprio apagado no fim) | `npm ci` (uma vez) e `npm run demonstrar:reinicio` |
| **Parar** (mantém os dados) | `docker compose stop` |
| Reiniciar | `docker compose restart` |
| Derrubar (mantém o volume) | `docker compose down` |
| Apagar tudo, inclusive os dados | `docker compose down -v` |

### Testes, independentes de IA

| Comando | O que roda |
|---|---|
| `npm ci` | instala as dependências (uma vez) |
| `npm run typecheck` / `npm run build` | verificação de tipos e compilação |
| `npm test` | unitários, API (com dublê do banco), identidade Firebase e perfis, arquitetura e reaproveitamento do Núcleo |
| `npm run test:integracao` | contra um PostgreSQL **real**, usando as variáveis `POSTGRES_*`: migrações, unidade de trabalho e as Estruturas Concretas de ponta a ponta pela API (inclusive concorrência) |

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

## Estruturas Organizacionais Concretas

Estruturas concretas (dos 8 posicionamentos firmes, Squad e Capítulo), relações entre elas e o responsável principal
de cada objeto avaliado, com histórico. **Toda regra é do núcleo** (`forca-agil/estruturas-nucleo.js`, contratos E1–E6,
R1–R7, V1–V8 e S1–S3 em `docs/estruturas-nucleo-contratos.md`); o módulo só orquestra:

1. lê as referências oficiais (Taxonomia, códigos firmes do motor, Posicionamento vigente do objeto);
2. numa unidade de trabalho **serializável**, lê o estado, chama o núcleo com o contexto do servidor (identificadores,
   horário e o usuário do **token**) e grava a operação, as mudanças e os eventos juntos (tudo ou nada).

**Rotas** (todas exigem identidade Firebase + perfil oficial; *manter* = admin geral e Avaliação + Arquitetura;
*consultar* = também o perfil Avaliação). Gravações aceitam o cabeçalho opcional `Idempotency-Key`.

| Rota | Permissão | O que faz |
|---|---|---|
| `GET /api/estruturas?situacao=ativa\|encerrada\|todas&tipo=` | consultar | lista |
| `GET /api/estruturas/:id` · `GET /api/estruturas/:id/historico` | consultar | estrutura com relações e objetos · histórico |
| `POST /api/estruturas` | manter | cadastra (`tipo`, `nome`, `sigla?`, `descricao?`) |
| `PATCH /api/estruturas/:id` | manter | altera nome, sigla, descrição (`revisaoEsperada?`, `justificativa?`); tipo imutável |
| `POST /api/estruturas/:id/encerramento` | manter | encerra com `motivo` (sem exclusão nem reativação) |
| `GET /api/relacoes?situacao=…&revisao=pendente` · `GET /api/relacoes/:id[/historico]` | consultar | relações com a situação calculada (válida / a revisar) |
| `POST /api/relacoes` · `POST /api/relacoes/:id/substituicao` · `POST /api/relacoes/:id/encerramento` | manter | cria · encerra e cria a substituta, com `motivo` · encerra com `motivo` |
| `GET /api/objetos/:objetoId/responsavel` | consultar | responsável principal e situação (válido / ausente / precisa de revisão / não aplicável) |
| `POST /api/objetos/:objetoId/responsavel` | manter | vincula (`estruturaId`) pelo Posicionamento vigente |
| `GET /api/vinculos/:id[/historico]` · `POST /api/vinculos/:id/substituicao` · `POST /api/vinculos/:id/encerramento` | consultar · manter | consulta, substitui (com `motivo`) e encerra |

Respostas de erro: `{ erro: { status, mensagem, codigo, erros? } }` — recusa do núcleo = 422 com os códigos dele
(`REVISAO_DESATUALIZADA` = 409); outra operação gravou antes = 409; alvo inexistente = 404; fonte oficial fora do ar = 503.

**Banco** (`migracoes/0001_estruturas_concretas.sql`): `estruturas`, `estruturas_relacoes`, `estruturas_vinculos`,
`estruturas_eventos` e `estruturas_operacoes`. Cada registro guarda o objeto do núcleo e o próprio banco recusa:
apagar, reativar, trocar o tipo (ou origem/tipo/destino, ou objeto/estrutura/base do vínculo), pular revisão, alterar
eventos, duas relações ativas iguais e dois responsáveis principais ativos para o mesmo objeto. Ciclos em "compõe" são
barrados pelo núcleo dentro da transação serializável.

### Fontes oficiais: o que ainda falta ligar

O backend **não inventa** conceito, código, correspondência ou classificação. As portas `FonteTaxonomia`,
`FontePosicionamento` (em `modulos/estruturas/aplicacao/portas.ts`, com o caminho de cada dado no Firebase) e
`FontePerfis` estão definidas, mas **ainda sem adaptador**: ler o banco de produção a partir do backend pede uma
decisão de credencial e de rede. Até lá, em execução, **toda rota de negócio é recusada (503)** — nunca liberada nem
executada com valor presumido. Os testes usam fontes **sintéticas** (`test/sinteticos.ts`, prefixo `SINT_`, e-mails
`.invalid`).

## Autenticação

A identidade é a do **Firebase Authentication**. Não há autenticação paralela e o login do site não muda.

1. O navegador envia o ID token do Firebase: `Authorization: Bearer <token>`.
2. A guarda global (`compartilhado/autenticacao/guarda-acesso.ts`) valida o token
   (`verificador-identidade-firebase.ts`, biblioteca `jose`), como o Firebase documenta para bibliotecas JWT:
   - RS256, assinado por uma das chaves públicas do Google para o Firebase;
   - audiência e emissor iguais ao projeto de `FIREBASE_PROJECT_ID` (só o ID público, sem conta de serviço);
   - validade, horário de login e e-mail presentes.
3. O perfil vem da `FontePerfis` (as mesmas listas oficiais do site). O usuário de cada operação vem **só do token**:
   identificador, autor, data ou situação no corpo do pedido são recusados.
4. Toda rota exige permissão declarada; só `/api/saude` e `/api/saude/banco` são públicas (não expõem dados).

Sem `FIREBASE_PROJECT_ID`: 503 `AUTENTICACAO_NAO_CONFIGURADA`. Chaves do Google inalcançáveis: 503. Perfis
indisponíveis: 503 `PERFIS_INDISPONIVEIS`. Nunca uma liberação por conveniência.

## Segredos

- O `.env` e o `compose.override.yaml` não vão para o Git.
- O `.env.example` só tem valores de exemplo.
- A senha do banco nunca aparece em logs nem em respostas: a configuração inválida cita só o nome da variável.
- A imagem roda como usuário sem privilégios (`node`).
- O banco só é alcançável pela rede interna do Docker, e a API só em `127.0.0.1`.
