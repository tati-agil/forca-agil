# 05 — Backend NestJS: estrutura, contrato da API, regras, transações e tempo real

> Pré-requisitos: [02](02-arquitetura-alvo.md), [03](03-modelo-de-dados-mongodb.md), [04](04-autenticacao-e-autorizacao.md).
> Tudo aqui vai para a pasta `backend/` (criada na Fase 2 do [plano](11-plano-de-execucao.md)).

---

## 1. Pilha e versões

| Item | Versão | Motivo |
|---|---|---|
| Node.js | **22 LTS** (imagem `node:22-alpine`) | LTS até 2027 |
| NestJS | 11.x (`@nestjs/core`, `common`, `platform-express`) | |
| TypeScript | 5.x, `strict: true` | |
| MongoDB driver | `mongodb` 6.x (**driver nativo**, não Mongoose) | O modelo é genérico (envelope `v`, doc. 03); *schemas* do Mongoose não agregam na Fase A e atrapalham o acesso por caminho. |
| Tempo real | `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` 4.x | |
| Senhas | `argon2` (argon2id), `firebase-scrypt` (verificar hash legado) | doc. 04 §3.4 |
| E-mail | `nodemailer` | |
| Logs | `nestjs-pino` + `pino-http` | JSON em stdout |
| Rate limit | `@nestjs/throttler` | |
| Config | `@nestjs/config` + `zod` (validação do `.env` na subida) | |
| Cookies | `cookie-parser` | |
| Testes | `jest`, `supertest`, `mongodb-memory-server` (**em modo replica set**), `socket.io-client` | |

> Não usar Prisma: o suporte a MongoDB dele exige esquema fixo e não combina com o acesso por caminho.

---

## 2. Estrutura de pastas

```
backend/
├── Dockerfile
├── .dockerignore
├── package.json
├── tsconfig.json / tsconfig.build.json
├── nest-cli.json
├── .eslintrc.cjs / .prettierrc
├── src/
│   ├── main.ts                         ← bootstrap: prefixo /api, cookie-parser, pino, shutdown hooks
│   ├── app.module.ts
│   ├── config/
│   │   ├── config.schema.ts            ← zod: todas as variáveis do .env (doc. 07 §4)
│   │   └── config.module.ts
│   ├── database/
│   │   ├── database.module.ts          ← MongoClient (replica set), provider 'MONGO_DB'
│   │   ├── indices.ts                  ← cria índices na subida (idempotente) — doc. 03 §5
│   │   └── transacao.ts                ← helper withTransaction com retry de TransientTransactionError
│   ├── path-mapping/
│   │   ├── mapa-colecoes.ts            ← TABELA do doc. 03 §5 (nó → coleção, profundidade)
│   │   ├── caminho.ts                  ← parse/validação de caminhos, resolução doc + subcaminho
│   │   └── normalizar-rtdb.ts          ← doc. 03 §4
│   ├── data/
│   │   ├── data.module.ts
│   │   ├── data.controller.ts          ← /api/db/*
│   │   ├── data.service.ts             ← ler, escrever (pares), transação CAS, consultas
│   │   ├── arvore.ts                   ← monta árvore a partir de vários documentos
│   │   ├── push-id.ts                  ← (só para testes/scripts: mesmo algoritmo do cliente)
│   │   └── dto/                        ← validação dos corpos
│   ├── rules/
│   │   ├── rules.module.ts
│   │   ├── rules.service.ts            ← avalia leitura/escrita (doc. 04 §8)
│   │   ├── predicados.ts               ← doc. 04 §5
│   │   ├── leitor-banco.ts             ← "root" (antes) e "newRoot" (depois) com cache por requisição
│   │   ├── regras.gerais.ts            ← tabela do doc. 04 §6
│   │   └── regras.apostas.ts           ← anexo A
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts          ← /api/auth/*
│   │   ├── auth.service.ts
│   │   ├── sessao.service.ts           ← cria/valida/renova/apaga sessões
│   │   ├── sessao.middleware.ts        ← lê o cookie, põe req.usuario
│   │   ├── senha.service.ts            ← argon2 + fallback firebase-scrypt
│   │   ├── provedor-identidade.ts      ← interface (doc. 04 §3.7)
│   │   ├── guards/ (autenticado.guard.ts, admin.guard.ts, csrf.guard.ts)
│   │   └── dto/
│   ├── usuarios-admin/
│   │   ├── usuarios-admin.controller.ts ← /api/admin/usuarios/*
│   │   └── usuarios-admin.service.ts
│   ├── mail/
│   │   ├── mail.module.ts
│   │   ├── mail.service.ts
│   │   └── templates/ (verificacao.ts, redefinicao.ts, conta-criada.ts)
│   ├── realtime/
│   │   ├── realtime.module.ts
│   │   ├── realtime.gateway.ts         ← Socket.IO: subscribe/unsubscribe, notificações
│   │   └── barramento.ts               ← interface + implementação em memória (doc. 02 §4.4)
│   ├── hooks/
│   │   └── efeitos-de-escrita.ts       ← efeitos colaterais após escrita (seção 8)
│   ├── health/
│   │   └── health.controller.ts        ← /api/health, /api/health/ready
│   └── common/
│       ├── erros.ts                    ← formato de erro e códigos (seção 4.5)
│       ├── filtro-excecoes.ts
│       └── req-id.ts
└── test/
    ├── utils/ (mongo-memoria.ts, semente.ts, cliente-teste.ts)
    ├── data.e2e-spec.ts
    ├── regras.gerais.e2e-spec.ts
    ├── regras.apostas.e2e-spec.ts      ← porte do .github/scripts/teste-rules.js
    ├── transacao.e2e-spec.ts
    ├── auth.e2e-spec.ts
    └── realtime.e2e-spec.ts
```

---

## 3. `main.ts` (modelo)

```ts
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.set('trust proxy', 1);                 // atrás do Nginx: IP real via X-Forwarded-For
  app.useBodyParser('json', { limit: '5mb' });
  app.enableShutdownHooks();
  // SEM app.enableCors(): site e API no mesmo domínio (proteção CSRF, doc. 04 §3.3)
  await app.listen(Number(process.env.API_PORTA ?? 3000), '0.0.0.0');
}
bootstrap();
```

---

## 4. API de dados (`/api/db/*`) — contrato

Todas as rotas exigem sessão válida (`AutenticadoGuard`). As de escrita exigem também o cabeçalho `X-FA-Requested: 1` (`CsrfGuard`).

### 4.1 Caminhos

- O caminho vem **na URL depois de `/api/db/`**, com cada segmento codificado com `encodeURIComponent` (ex.: `/api/db/fa-espera/maria_previ_com_br/lista%3A-NaB12`).
- Validação: segmentos não vazios, sem `. $ # [ ]`, primeiro segmento presente na tabela de mapeamento; profundidade máxima 32. Caminho vazio (`/api/db/`) = raiz → **sempre 403** (a raiz é negada).
- Caminhos especiais começam com `_` e **nunca** são nós (nenhum nó começa com `_`): `_multi`.

### 4.2 Endpoints

| Método e rota | Equivale a | Corpo | Resposta |
|---|---|---|---|
| `GET /api/db/<caminho>` | `ref(c).once('value')` | — | `200 { "valor": <json\|null>, "hash": "<sha1 canônico>" }` |
| `GET /api/db/<caminho>?orderBy=<campo>&equalTo=<json>&limitToFirst=<n>&limitToLast=<n>` | consultas | — | `200 { "itens": [["<chave>", <valor>], ...], "hash": null }` (lista ordenada de pares) |
| `PUT /api/db/<caminho>` | `ref(c).set(v)` | `{ "valor": <json\|null> }` | `204` |
| `DELETE /api/db/<caminho>` | `ref(c).remove()` | — | `204` |
| `POST /api/db/_multi` | `ref(base).update({...})` e `ref().update({...})` | `{ "escritas": { "<caminho absoluto>": <json\|null>, ... } }` | `204` |
| `POST /api/db/<caminho>/_transacao` | `ref(c).transaction(fn)` | `{ "valorNovo": <json\|null>, "hashEsperado": "<sha1>" }` | `200 { "comprometido": true, "valor": <json> }` ou `409 { "erro": {...}, "valor": <atual>, "hash": "<sha1 atual>" }` |

- `set`/`update` do cliente de compatibilidade **sempre** usam `_multi` quando há mais de um caminho, e `PUT`/`DELETE` quando há um só (ambos passam pelo mesmo serviço).
- `hash` = SHA-1 do **JSON canônico** (chaves ordenadas recursivamente) do valor; `null` → hash de `"null"`. Usado pela transação (seção 6).
- Valores de `ServerValue.TIMESTAMP` chegam como `{".sv":"timestamp"}` e são resolvidos no servidor (doc. 03 §4.5).

### 4.3 Por que as consultas devolvem lista de pares

No Firebase, `snapshot.forEach` percorre os filhos **na ordem da consulta** (ex.: `holocron` por `createdAt`), mas `snapshot.val()` devolve um objeto. JSON não garante ordem de chaves de forma confiável para chaves "numéricas", então a API devolve `itens` (pares ordenados) e o cliente de compatibilidade monta: `val()` = objeto; `forEach` = na ordem de `itens`.

### 4.4 Limites

- Corpo máximo 5 MB (Nginx `client_max_body_size` e Nest `json limit`).
- Máximo de 500 caminhos por `_multi` (maior uso real hoje: "corrigir e-mail", dezenas de caminhos).
- Rate limit geral por sessão: 600 req/min (a Minha Área faz ~10 leituras; o quiz grava a cada clique).

### 4.5 Erros

Formato único:
```json
{ "erro": { "codigo": "PERMISSION_DENIED", "mensagem": "Sem permissão para escrever em turmas-publico/t1/maria_previ_com_br" } }
```

| HTTP | `codigo` | Quando | O cliente de compatibilidade converte em |
|---|---|---|---|
| 400 | `INVALID_PATH` / `INVALID_DATA` | caminho/valor inválido | `Error` com `code` igual |
| 401 | `UNAUTHENTICATED` | sem sessão / sessão expirada | dispara `onAuthStateChanged(null)` + erro `PERMISSION_DENIED` (o site trata como o Firebase) |
| 403 | `PERMISSION_DENIED` | regra negou | `Error` com `code: 'PERMISSION_DENIED'` (**mesmo código do Firebase** — o site já trata, ex.: `avaliacao-produto.js` l. 4074) |
| 409 | `CONFLICT` | transação: valor mudou | re-executa `fn` (até 25 vezes) |
| 413 | `PAYLOAD_TOO_LARGE` | | erro |
| 429 | `TOO_MANY_REQUESTS` | rate limit | erro |
| 5xx | `INTERNAL` / `UNAVAILABLE` | falha interna / Mongo fora | erro (o site já tem tratamento de "não respondeu") |

---

## 5. Motor de regras (`RulesService`)

### 5.1 Interface

```ts
type Predicado = (c: Ctx) => boolean | Promise<boolean>;
interface Regra { padrao: string; read?: Predicado; write?: Predicado; }   // padrao: 'turmas-interesse/$turmaKey/$userKey'

@Injectable()
export class RulesService {
  constructor(private readonly regras: Regra[] /* regras.gerais + regras.apostas */, private readonly leitor: LeitorBancoFactory) {}

  async podeLer(auth: Auth | null, caminho: string[]): Promise<boolean> {
    // verdadeiro se ALGUMA regra .read casando com caminho[0..i] (i = 0..len) permitir
  }

  async podeEscrever(auth: Auth | null, pares: Par[], estado: EstadoEscrita): Promise<{ ok: true } | { ok: false; caminho: string }> {
    // para CADA par: alguma regra .write casando com o caminho ou um ancestral permite,
    // avaliada com data (antes) e newData (depois de aplicar TODOS os pares).
  }
}
```

### 5.2 Casamento de padrões

- Um padrão é uma lista de segmentos; `$nome` casa com qualquer segmento e o captura em `vars.nome`.
- **Precedência igual ao RTDB:** para um caminho `a/b/c`, avaliam-se as regras dos prefixos `a`, `a/b`, `a/b/c` (e, para leitura, qualquer regra num prefixo concede). Se nenhum prefixo tem regra que conceda → negado.
- Quando dois padrões casam no mesmo nível (ex.: literal `atual` e `$filho`), o RTDB **dá preferência ao literal** — implementar igual.

### 5.3 `root`, `data`, `newData`

- `root` / `data`: estado **antes** da escrita. Implementado por `LeitorBanco` que lê do MongoDB **dentro da mesma sessão/transação** da escrita (consistência), com cache por requisição.
- `newData` / "root depois": `LeitorBanco` com uma **sobreposição** (*overlay*) dos pares pendentes — ler um caminho aplica, em memória, as escritas pendentes que o afetam. As regras de `apostas` usam isso (ex.: `newData.parent()...child('membros').child(<eu>).exists()` e o `nome` de `grupos-resumo` igual ao `nome` do grupo **depois** da escrita).
- Ordem dentro do `DataService.escrever`:
  ```
  withTransaction(session => {
     1. normalizar pares (doc. 03 §4); resolver ServerValue
     2. carregar documentos afetados (por _id) na sessão
     3. rules.podeEscrever(auth, pares, {antes, depois(overlay)})  → se negar: abortar (403), NADA é gravado
     4. aplicar operações MongoDB (doc. 03 §6.2), $inc _rev, _em, _por
     5. apagar documentos cujo v ficou vazio
  })
  após o commit: barramento.publicar(caminhosEscritos); efeitos.processar(pares)
  ```

### 5.4 Leitura

`DataService.ler(auth, caminho)`: **primeiro** `rules.podeLer`; se negar → 403 **sem** consultar/filtrar dados (igual ao RTDB: leitura sem permissão falha inteira, não "filtra").

### 5.5 Testes das regras (obrigatórios)

- Uma tabela de casos por linha do doc. 04 §6 (persona × caminho × operação → permitido/negado).
- Porte **completo** do `.github/scripts/teste-rules.js` (115 verificações de `apostas`) para `test/regras.apostas.e2e-spec.ts`, com as mesmas personas (admin, facilitadora com e sem vínculo, membro da equipe sem flag, participantes A/A2/B, pessoa de fora, anônimo).
- Critério: 100% dos casos do `teste-rules.js` passando **antes** de qualquer tela usar a API.

---

## 6. Transações (`ref.transaction`) — compare-and-swap por valor

Semântica do Firebase a preservar: a função `fn` roda **no navegador**; o servidor só aceita o valor novo se o valor no caminho **não mudou** desde que o navegador o leu; senão o SDK roda `fn` de novo com o valor atual; `fn` devolvendo `undefined` aborta; `onComplete(err, committed, snapshot)`.

### 6.1 Protocolo

```
cliente                                         servidor
───────                                         ────────
GET /api/db/P            ─────────────────────► podeLer? → {valor, hash}
v2 = fn(valor)
se v2 === undefined → onComplete(null, false, snap(valor)); fim
POST /api/db/P/_transacao {valorNovo: v2, hashEsperado: hash}
                         ─────────────────────► withTransaction:
                                                  atual = ler P (na sessão)
                                                  se sha1(canonico(atual)) != hashEsperado
                                                      → 409 {valor: atual, hash: sha1(atual)}
                                                  senão: podeEscrever(P, v2)? → grava (como set)
                                                         → 200 {comprometido: true, valor: v2 normalizado}
se 409: valor = resposta.valor; hash = resposta.hash; volta a rodar fn (máx. 25 vezes)
se 200: onComplete(null, true, snap(valor))
```

- Comparar **valor** (via hash canônico), e não `_rev` do documento, evita conflitos falsos: no `apostas/<turma>` vários grupos gravam ao mesmo tempo no mesmo documento, mas as travas (`criacaoExecucaoEmAndamento`, `ciclos/criacaoCicloEmAndamento`) e o contador só conflitam se **aquele caminho** mudou — exatamente o comportamento do Firebase.
- A leitura + comparação + gravação acontecem **dentro de uma transação MongoDB**; se outra escrita no mesmo documento acontecer no meio, o MongoDB aborta com `WriteConflict` e o helper `withTransaction` repete — a comparação de hash é refeita, garantindo o compare-and-swap.
- Transação em caminho **acima** da profundidade do documento (abrangendo vários documentos) → `400 INVALID_PATH` (não existe no site; falhar alto se um dia aparecer).

### 6.2 As 7 transações do site e onde caem

| # | Onde | Caminho | Documento MongoDB |
|---|---|---|---|
| T1 | `aposta.js` l. 2343 (adquirir trava de execução) | `apostas/<t>/criacaoExecucaoEmAndamento` | `apostas` `_id=<t>` |
| T2 | `aposta.js` l. 2372 (liberar trava) | idem | idem |
| T3 | `aposta.js` l. 2404 (contador) | `apostas/<t>/contadorExecucoes` | idem |
| T4 | `aposta.js` l. 2674 (trava de ciclo) | `apostas/<t>/execucoes/<e>/grupos/<g>/ciclos/criacaoCicloEmAndamento` | idem |
| T5 | `aposta.js` l. 2688 (liberar trava de ciclo) | idem | idem |
| T6 | `motor-arquitetura.js` `publicarRegras` | `motor-arquitetura-config` | `motor_arquitetura_config` `_id=_raiz` |
| T7 | `motor-squad.js` `publicarRegras` | `motor-squad-config` | `motor_squad_config` `_id=_raiz` |

> T6/T7 incluem, dentro de `fn`, a decisão "no-op × mudança real × conflito de versaoBase" (PRs #243/#244). Como `fn` roda no navegador e o servidor faz compare-and-swap do documento inteiro, **a lógica e os testes dessas PRs continuam valendo sem alteração**. Os testes `teste-motor-concorrencia-publicacao.js` e `teste-motor-noop-atomico.js` passam a rodar também contra o backend real (doc. 09).

---

## 7. Tempo real (`RealtimeGateway`)

### 7.1 Conexão

- Socket.IO no caminho `/socket.io/`, **mesmo domínio**, transporte `websocket` com fallback `polling`.
- Autenticação no *handshake*: o middleware lê o cookie `fa_sessao`, valida a sessão; sem sessão válida → recusa (`connect_error: UNAUTHENTICATED`).
- Cada socket entra na sala `usuario:<emailKey>` (para avisos dirigidos, ex.: sessão encerrada).

### 7.2 Mensagens

| Direção | Evento | Carga | Efeito |
|---|---|---|---|
| cliente → servidor | `inscrever` | `{ id: "<id local>", caminho: "turmas-interesse/t1/maria…", consulta?: {orderBy, equalTo, limitToFirst, limitToLast} }` | Servidor checa `podeLer`; se negar responde `inscricao-negada {id, codigo}`; senão registra. |
| cliente → servidor | `cancelar` | `{ id }` | Remove a inscrição. |
| servidor → cliente | `alterado` | `{ ids: ["<id>", ...] }` | Cliente refaz `GET` de cada inscrição (com *debounce* ~150 ms) e chama os `cb` de `on('value')`. |
| servidor → cliente | `sessao-encerrada` | `{ motivo: "bloqueada" \| "logout" \| "expirada" }` | Cliente dispara `onAuthStateChanged(null)` (ou o evento de bloqueio). |

### 7.3 Quem é avisado

Após cada escrita confirmada, o `DataService` publica no barramento a lista de caminhos escritos. O gateway avisa toda inscrição cujo caminho seja **ancestral, igual ou descendente** de algum caminho escrito (comparação de prefixo por segmentos). Exemplos:
- escrita em `apostas/t1/execucoes/e1/grupos/g2/dados/hipotese` → avisa quem ouve `apostas/t1/execucoes/e1` (facilitadora) e `apostas/t1/execucoes/e1/grupos/g2` (membros do g2); **não** avisa quem ouve `grupos/g3`.
- escrita em `turmas-interesse/t1/maria…/status` → avisa o ouvinte de nível de acesso da Maria (`auth.js` l. 188).

### 7.4 Por que "avisar e reler" em vez de mandar o valor

O aviso não carrega dados; o cliente relê pelo `GET`, que **passa de novo pelas regras**. Assim é impossível vazar pelo tempo real um dado que a pessoa não pode ler (ex.: participante que ouve `grupos-resumo` nunca recebe dados de `grupos/<outro grupo>`). O custo (uma leitura a mais) é irrelevante no volume da Força Ágil.

### 7.5 Barramento

```ts
export interface Barramento { publicar(caminhos: string[]): void; assinar(fn: (caminhos: string[]) => void): void; }
// Fase A: BarramentoMemoria (EventEmitter). Com mais de uma instância da API: BarramentoRedis
// (Redis Pub/Sub + @socket.io/redis-adapter) ou BarramentoChangeStream (MongoDB change streams).
```

---

## 8. Efeitos colaterais de escrita (`efeitos-de-escrita.ts`)

Algumas escritas feitas pelo site pela API de dados precisam de efeito no servidor que o Firebase fazia "de graça" ou que o novo modelo de sessão exige:

| Escrita observada | Efeito |
|---|---|
| `fa-users/<k>/blocked = true` (ou `fa-users/<k>` com `blocked: true`) | Apagar todas as sessões de `<k>` e emitir `sessao-encerrada {motivo:'bloqueada'}` na sala `usuario:<k>`. |
| `fa-users/<k>/adminApproved = true` | Nada extra (o `/me` já considera). |
| `fa-reset-signal/<k>` | Nada extra: o navegador da pessoa já ouve esse caminho pelo tempo real. |

Os efeitos rodam **depois** do commit e nunca derrubam a escrita (erros só são logados).

---

## 9. Autenticação — pontos de implementação

(Especificação funcional no doc. 04, Parte I.)

- `SessaoMiddleware` (global): lê `fa_sessao`, busca em `sessoes` (com cache LRU de 30 s), confere `expiraEm`, carrega `fa_users/<k>` para saber `blocked` e se a sessão é **restrita** (não verificada — doc. 04 §3.2). Popula `req.usuario = { email, emailKey, emailVerificado, restrita }`.
- `AutenticadoGuard`: exige `req.usuario` e **não restrita** para `/api/db/*`. Exceção: sessão restrita pode `GET/PUT/_multi` **somente** em `fa-users/<própria emailKey>` (o `auth.js` precisa ler o próprio perfil para descobrir que falta verificar o e-mail).
- `AdminGuard`: `superAdmin || existe fa_admins/<emailKey>` (mesmo predicado das regras).
- Renovação deslizante do cookie no `SessaoMiddleware`.
- Rotas `/api/auth/*` com `@Throttle` específicos (doc. 04 §3.6).

---

## 10. Observabilidade e saúde

- `GET /api/health` → `200 {ok:true}` (processo vivo).
- `GET /api/health/ready` → checa `db.admin().ping()` e `rs.status` (PRIMARY) e, opcionalmente, conexão SMTP → `200` ou `503`.
- Logs pino com `reqId` (cabeçalho `X-Request-Id` gerado no Nginx ou na API), `usuario` (emailKey), `rota`, `status`, `ms`. **Redigir** `req.headers.cookie`, `body.senha`, `body.novaSenha`, `body.token`.
- Métrica simples (opcional): `/api/health/metricas` (só admin) com contagem de sockets, inscrições ativas e requisições por minuto — útil em dia de oficina.

---

## 11. `backend/Dockerfile`

```dockerfile
# ---------- base ----------
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini

# ---------- dependências ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- desenvolvimento (hot reload; usado pelo docker-compose.dev.yml) ----------
FROM deps AS dev
COPY . .
CMD ["npm", "run", "start:dev"]

# ---------- build ----------
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# ---------- produção ----------
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
```

`backend/.dockerignore`: `node_modules`, `dist`, `coverage`, `.env*`, `test/**/*.snap`.

> `argon2` tem binário nativo: no Alpine ele usa o *prebuild* musl. Se o `npm ci` tentar compilar (sem acesso à internet para baixar o prebuild), adicionar ao estágio `deps`: `RUN apk add --no-cache python3 make g++`.

---

## 12. `package.json` — scripts mínimos

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "format": "prettier --write \"{src,test}/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:e2e": "jest --config test/jest-e2e.json --runInBand",
    "test:regras": "jest --config test/jest-e2e.json --runInBand test/regras"
  }
}
```

---

## 13. Testes de integração com MongoDB em memória (replica set)

```ts
// test/utils/mongo-memoria.ts
import { MongoMemoryReplSet } from 'mongodb-memory-server';
export async function subirMongo() {
  const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGO_URI = rs.getUri('forcaagil_teste');
  return rs;
}
```

> `mongodb-memory-server` baixa o binário do MongoDB na primeira execução. Sem internet, configure `MONGOMS_DOWNLOAD_URL`/`MONGOMS_SYSTEM_BINARY` para um binário interno, ou rode os testes de integração contra o container `mongo` do compose (`docker compose -f ... run --rm api npm run test:e2e` com `MONGO_URI` apontando para um banco `forcaagil_teste`).

---

## 14. Fase B (depois do corte) — endpoints de domínio

Não fazer na Fase A. Lista sugerida, na ordem de valor (fecha as brechas do doc. 04 §9):

1. `POST /api/turmas/:t/interesse` e `DELETE /api/turmas/:t/interesse` (a própria pessoa; servidor preenche nome/e-mail/área da sessão; valida público restrito e estado da turma).
2. `POST /api/turmas/:t/participantes/:k/confirmar` / `desconfirmar` / `remover` / `mover` (admin; exclusividade e público restrito no servidor; log na mesma transação).
3. `POST /api/turmas/:t/checkin` (servidor lê `diaAtivo`, exige inscrição confirmada, usa hora do servidor).
4. `GET /api/me/area` (substitui as 9 leituras de coleção inteira da Minha Área).
5. `GET /api/vitrine` (já filtrada: publicado, restrito a diretores, público restrito — sem mandar listas de e-mail).
6. Endpoints da Aposta (criar execução, criar grupo, entrar no grupo, salvar etapa, criar ciclo) substituindo travas no cliente por transações no servidor (anexo B3 §5).
7. Publicação de regras/questionários com validação e auditoria atômicas no servidor.
