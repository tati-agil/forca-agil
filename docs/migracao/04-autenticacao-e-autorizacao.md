# 04 — Autenticação e autorização

> Pré-requisitos: [01](01-diagnostico-sistema-atual.md), [02](02-arquitetura-alvo.md), [03](03-modelo-de-dados-mongodb.md).
> Este documento tem duas metades: **quem é a pessoa** (autenticação — substitui o Firebase Authentication) e **o que ela pode fazer** (autorização — substitui o `database.rules.json`).

---

## Parte I — Autenticação

## 1. Como funciona hoje (Firebase Authentication)

Fonte: [`forca-agil/auth.js`](../../forca-agil/auth.js).

| Funcionalidade | Onde (auth.js) | Comportamento exato que precisa ser preservado |
|---|---|---|
| Cadastro | `register()` l. 425-460 | E-mail obrigatoriamente `@previ.com.br` (regex `/^[^\s@]+@previ\.com\.br$/i`); **senha só com números e no mínimo 8 dígitos** (`/^\d{8,}$/`); nome obrigatório (gravado em MAIÚSCULAS); área obrigatória; opção `optinTurmas`. Cria a conta, grava `fa-users/<emailKey>` com `emailVerificationRequired: true` e `createdAt`, **envia e-mail de verificação e desloga**. |
| Verificação de e-mail | l. 339 | Só é exigida se `fa-users/<emailKey>.emailVerificationRequired === true` **e** `adminApproved` não é verdadeiro. Contas antigas (sem a flag) entram sem verificar. |
| Reenviar verificação | `resendVerification()` l. 554 | Precisa estar "logada" no Firebase (sessão não verificada). Erro `too-many-requests` → "Aguarde alguns minutos". |
| Login | `login()` l. 567 | Só `@previ.com.br`. Mensagem genérica "E-mail ou senha inválidos."; `too-many-requests` → "Muitas tentativas…". |
| Conta bloqueada | l. 325 | Se `fa-users/<emailKey>.blocked` → desloga imediatamente e mostra aviso. |
| Logout | `logout()` l. 581 | Desloga e volta para `#home`. |
| Esqueci minha senha | `sendPasswordReset()` l. 591 | Só `@previ.com.br`. Mensagem genérica mesmo se o e-mail não existir. |
| Admin dispara redefinição | `admin.js` l. 4262 | `sendPasswordResetEmail(email)` para qualquer cadastrado. |
| Admin cria conta para colaboradora | `criarContaPorAdmin()` l. 516 | Cria a conta com **senha padrão `12345678`**, grava `fa-users/<emailKey>` com `adminApproved: true`, `createdByAdmin: <email da admin>`, `createdAt`. Para isso o painel **entra como a conta nova e depois entra de volta como admin** usando a senha que a admin redigita. |
| Admin corrige e-mail de login | `corrigirEmailPorAdmin()` l. 473 | Só para contas com `createdByAdmin`. Entra na conta alvo com a senha `12345678`, troca o e-mail (`updateEmail`), sai e entra de volta como admin. Se a pessoa já trocou a senha, **falha de propósito**. Depois o `admin.js` (`moverDadosDePessoa`, l. 5525-5611) move todos os dados da `emailKey` antiga para a nova numa gravação multi-caminho. |
| Sessão | SDK | Persistente (a pessoa continua logada ao reabrir o navegador). `onAuthStateChanged` dispara `fa-auth-ready` e `fa-auth-change`, dos quais o site inteiro depende (router, menus, telas). |
| Reset de progresso | `firebase.js` l. 123-139 | O navegador da pessoa observa `fa-reset-signal/<emailKey>`; quando a admin reseta, limpa o `localStorage` e recarrega. |

### 1.1 Papéis e níveis (resumo — detalhado na Parte II)

- **Super-admin:** lista fixa `['tatianefdirene@previ.com.br', 'danielfrazao@previ.com.br']` (auth.js l. 8, e repetida em várias regras).
- **Admin:** super-admin **ou** existe `fa-admins/<emailKey>`.
- **Diretor:** existe `fa-diretores/<emailKey>` (só muda o que aparece na página Turmas).
- **Facilitador (flag):** existe `fa-facilitadores/<emailKey>` (libera a rota `#facilitador`).
- **Nível de acesso** (`getAccessLevel`): `member` (padrão) ou `enrolled` (inscrita confirmada em alguma turma **ou** admin).

---

## 2. Decisão: autenticação própria no NestJS, com sessão por cookie

**Decisão (ADR-003 no documento 12):** o backend implementa contas locais (e-mail + senha) com **sessão opaca em cookie `HttpOnly`**, guardada no MongoDB. **Não** usar JWT no `localStorage`.

Por quê:
1. O site e a API ficam **no mesmo domínio** (Nginx faz o proxy) → cookie funciona sem CORS.
2. Cookie `HttpOnly` não é lido por JavaScript → um XSS não consegue roubar a sessão.
3. Sessão no banco é **revogável na hora**: bloquear uma conta apaga as sessões dela (hoje o bloqueio só age quando o navegador relê o perfil).
4. O Socket.IO autentica com o mesmo cookie, sem nenhuma lógica extra no cliente.
5. É mais simples de implementar corretamente do que refresh tokens.

**SSO corporativo (AD/LDAP, Keycloak, Azure AD/Entra ID)** é o destino ideal para uma ferramenta interna (acaba com senhas próprias), mas depende da TI (pendência P-04) e mudaria a experiência de login. Por isso fica na **Fase B**. O backend deve ser escrito com uma interface `ProvedorIdentidade` (seção 3.7) para que o SSO entre depois sem reescrever o resto.

---

## 3. Especificação da autenticação no backend

### 3.1 Coleções

```js
// usuarios_auth  — credenciais (separado de fa_users, que é o PERFIL visível ao site)
{
  _id: "maria_silva_previ_com_br",          // emailKey (mesma chave do perfil)
  email: "maria.silva@previ.com.br",         // minúsculas, único
  senhaHash: "$argon2id$v=19$m=19456,t=2,p=1$...",   // null enquanto só houver hash do Firebase
  firebaseHash: { hash: "...", salt: "..." }, // só para contas migradas; apagado após 1º login
  emailVerificado: true,
  firebaseUid: "abc123...",                   // rastreabilidade da migração
  criadoEm: ISODate, atualizadoEm: ISODate,
  ultimoLoginEm: ISODate,
  tentativasFalhas: 0, bloqueadoAte: null      // anti força-bruta (seção 3.6)
}

// sessoes
{ _id: "<256 bits aleatórios em base64url>", usuarioId: "maria_silva_previ_com_br",
  criadaEm: ISODate, expiraEm: ISODate, ultimoUsoEm: ISODate, ip: "...", userAgent: "..." }
// índice TTL em expiraEm (expireAfterSeconds: 0)

// tokens_email  (verificação de e-mail e redefinição de senha)
{ _id: "<sha256 do token>", tipo: "verificacao" | "redefinicao", usuarioId, criadoEm, expiraEm, usadoEm: null }
// índice TTL em expiraEm
```

> O token enviado por e-mail **nunca** é gravado em claro: grava-se o SHA-256; ao receber o link, calcula-se o SHA-256 e procura-se.

### 3.2 Endpoints (`/api/auth/*`)

Todos devolvem JSON. Erros no formato `{ "erro": { "codigo": "auth/...", "mensagem": "texto para a tela" } }`. Os **códigos de erro imitam os do Firebase** para que o `auth.js` continue tratando com o mesmo `err.code` (ver documento 06).

| Método e rota | Corpo | Resposta de sucesso | Regras |
|---|---|---|---|
| `POST /api/auth/cadastro` | `{ email, senha, nome, area, optinTurmas }` | `201 { precisaVerificar: true }` | Valida `@previ.com.br`, senha `^\d{8,}$`, nome e área não vazios. E-mail já existe → `409 auth/email-already-in-use`. Cria `usuarios_auth` (argon2id), cria `fa_users/<emailKey>` com `{ email, name: NOME.toUpperCase(), area, optinTurmas, emailVerificationRequired: true, createdAt }` **na mesma transação**, envia e-mail de verificação. **Não cria sessão** (igual hoje: desloga após cadastrar). |
| `POST /api/auth/login` | `{ email, senha }` | `200 { usuario }` + `Set-Cookie` | Só `@previ.com.br`. Senha errada/usuário inexistente → `401 auth/invalid-credential` (mesma mensagem). Excesso → `429 auth/too-many-requests`. Se `fa_users.blocked` → `403 auth/user-disabled` (não cria sessão). Se precisa verificar e não verificou → cria sessão **restrita** (só pode chamar `/me`, `/reenviar-verificacao`, `/logout`) e devolve `usuario.emailVerificado=false` — imita o Firebase, onde a pessoa fica "logada mas não verificada". |
| `POST /api/auth/logout` | — | `204` + apaga cookie | Apaga a sessão no banco. |
| `GET /api/auth/me` | — | `200 { usuario }` ou `401` | `usuario = { email, emailVerificado, uid: emailKey }`. É o que alimenta o `onAuthStateChanged` do cliente de compatibilidade. |
| `POST /api/auth/reenviar-verificacao` | — | `204` | Exige sessão (mesmo restrita). Máx. 1 a cada 60 s por usuário → `429 auth/too-many-requests`. |
| `POST /api/auth/verificar-email` | `{ token }` | `200` | Marca `emailVerificado=true`, invalida o token. Token inválido/expirado → `400 auth/invalid-action-code`. |
| `POST /api/auth/esqueci-senha` | `{ email }` | **sempre** `204` | Se existir, envia link (validade 1 h). Nunca revela se o e-mail existe. Rate limit por IP e por e-mail. |
| `POST /api/auth/redefinir-senha` | `{ token, novaSenha }` | `204` | Valida token; aplica a **mesma regra de senha do cadastro** (`^\d{8,}$`) — ver nota abaixo; grava argon2id; **apaga todas as sessões** do usuário. |
| `POST /api/auth/trocar-senha` | `{ senhaAtual, novaSenha }` | `204` | (Novo — hoje não existe no site; opcional na Fase A. Útil para quem recebeu a senha padrão.) |

> **Nota sobre a regra de senha:** hoje o cadastro exige `^\d{8,}$`, mas a página de redefinição do Firebase aceita qualquer senha com 6+ caracteres. Para **paridade**, o backend aceita na redefinição **qualquer senha com 8+ caracteres** (mais rígido que o Firebase, compatível com as senhas numéricas existentes). Qualquer mudança da política é decisão de negócio (pendência P-11).

Endpoints administrativos (`/api/admin/usuarios/*`, exigem **admin**):

| Método e rota | Corpo | O que faz (substitui) |
|---|---|---|
| `POST /api/admin/usuarios` | `{ email, nome, area }` | Substitui `criarContaPorAdmin`. Cria `usuarios_auth` com senha padrão `12345678` (**paridade**; ver pendência P-12 para trocar por "definir senha no primeiro acesso") e `emailVerificado: true`; cria `fa_users/<emailKey>` com `{ email, name: NOME.toUpperCase(), area, adminApproved: true, createdByAdmin: <email da admin logada>, createdAt }` na mesma transação. **Não mexe na sessão da admin** — o vai-e-vem de login deixa de existir. Não exige mais que a admin redigite a própria senha (pode continuar exigindo por segurança: `{ senhaAdmin }` opcional validada no servidor — decidir na Tarefa 3.5). |
| `POST /api/admin/usuarios/:emailKey/corrigir-email` | `{ emailNovo }` | Substitui `corrigirEmailPorAdmin` (**só a parte de login**). Só permitido se `fa_users/<emailKey>.createdByAdmin` existe **e** o hash de senha atual ainda corresponde a `12345678` (mesma trava de hoje: "se a pessoa já trocou a senha, a conta é dela"). Proibido para o próprio e-mail da admin. Troca `usuarios_auth.email` e o `_id` (nova emailKey) numa transação; apaga sessões da conta alvo. **A movimentação dos dados** (`moverDadosDePessoa`) continua sendo feita pelo `admin.js` via API de dados, exatamente como hoje — ver documento 06, seção 4.2. |
| `POST /api/admin/usuarios/:emailKey/redefinir-senha` | — | Substitui `sendPasswordResetEmail` do painel. Envia o mesmo e-mail de redefinição. |
| (bloquear) | — | **Não precisa de endpoint próprio:** o painel continua gravando `fa-users/<emailKey>/blocked` pela API de dados; o backend, ao ver essa escrita, **apaga as sessões** da pessoa (hook no `DataService`, documento 05, seção 8). |

### 3.3 Cookie de sessão

```
Set-Cookie: fa_sessao=<id>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000
```
- `SameSite=Lax` (e não `Strict`) para que o link do e-mail de verificação/redefinição, aberto a partir do cliente de e-mail, já chegue com a sessão quando existir.
- **Proteção CSRF:** toda requisição que altera estado (`POST/PUT/PATCH/DELETE`) precisa do cabeçalho `X-FA-Requested: 1` (o cliente de compatibilidade sempre envia). Um formulário de outro site não consegue enviar cabeçalho customizado sem CORS, e o backend **não** habilita CORS. Adicionalmente, conferir `Origin`/`Referer` = domínio do site.
- Renovação deslizante: se faltar menos da metade do prazo, estender `expiraEm` e reenviar o cookie.
- Duração padrão 30 dias (`SESSAO_DURACAO_HORAS`) — o Firebase mantém a pessoa logada indefinidamente; 30 dias com renovação deslizante é equivalente na prática.

### 3.4 Migração das senhas do Firebase (ninguém precisa redefinir senha)

O Firebase Authentication guarda senhas com um **scrypt modificado** e permite exportá-las:

1. No console do Firebase: **Authentication → Users → ⋮ (menu) → Password hash parameters**. Anotar `base64_signer_key`, `base64_salt_separator`, `rounds`, `mem_cost`. Guardar como segredo (`FIREBASE_SCRYPT_*` no `.env`).
2. Exportar usuários (conta com papel **Owner/Editor** no projeto `kyber-agil`):
   ```bash
   npx firebase-tools@13 auth:export usuarios-firebase.json --format=json --project kyber-agil
   ```
   Cada usuário vem com `localId` (uid), `email`, `emailVerified`, `passwordHash`, `salt`, `createdAt`, `lastSignedInAt`, `disabled`.
3. O script de importação (documento 08) cria `usuarios_auth` com `senhaHash: null` e `firebaseHash: { hash: passwordHash, salt }`.
4. No **login**, se `senhaHash` é `null` e existe `firebaseHash`:
   - verificar a senha digitada com o algoritmo do Firebase (pacote npm [`firebase-scrypt`](https://www.npmjs.com/package/firebase-scrypt), que implementa exatamente esse algoritmo com os 4 parâmetros);
   - se bater: gravar `senhaHash = argon2id(senha)`, apagar `firebaseHash`, seguir o login normal;
   - se não bater: `401 auth/invalid-credential`.
5. Critério de aceite (Tarefas 0.4 e 7.2): **três contas reais de teste** criadas no Firebase antes da exportação (uma verificada, uma criada pelo admin com `12345678`, uma que redefiniu senha) conseguem entrar no ambiente de homologação **com a mesma senha**.

> Se por qualquer motivo não for possível obter os parâmetros de hash (sem acesso de Owner), o plano B é: importar sem senha e **disparar e-mail de redefinição para todos** no dia do corte, com comunicação prévia. Isso é pior para as participantes — só usar se o plano A for impossível (pendência P-03).

### 3.5 E-mails (substituem os templates do Firebase)

Três modelos, em português, texto simples + HTML mínimo, enviados pelo SMTP interno (`MailModule`, `nodemailer`):

| Modelo | Assunto | Link |
|---|---|---|
| Verificação | "Confirme seu e-mail — Força Ágil" | `${URL_PUBLICA}/#conta?acao=verificar&token=<token>` (validade 48 h) |
| Redefinição | "Redefinição de senha — Força Ágil" | `${URL_PUBLICA}/#conta?acao=redefinir&token=<token>` (validade 1 h) |
| Conta criada pela admin (novo, opcional) | "Sua conta na Força Ágil" | `${URL_PUBLICA}/` + instrução de senha provisória |

Antes de escrever os textos, **copiar os textos atuais** dos templates do Firebase (Console → Authentication → Templates) para manter a mesma comunicação (Tarefa 3.4).

A tela `#conta` (nova, pequena) é descrita no documento 06, seção 5.

### 3.6 Proteções

- **Rate limit** (`@nestjs/throttler`): login 10/min por IP e 5/min por e-mail; esqueci-senha 3/h por e-mail; cadastro 5/h por IP.
- **Bloqueio progressivo:** 10 falhas seguidas no mesmo e-mail → `bloqueadoAte = agora + 15 min` → `429 auth/too-many-requests`.
- **argon2id** com parâmetros OWASP (`memoryCost 19456 KiB, timeCost 2, parallelism 1`).
- Comparações de token em tempo constante; tokens de 32 bytes aleatórios (`crypto.randomBytes`).
- Logs nunca contêm senha, token ou cookie.

### 3.7 Interface para SSO futuro

```ts
export interface ProvedorIdentidade {
  autenticar(email: string, senha: string): Promise<{ email: string; emailVerificado: boolean }>;
  // Fase B: iniciarLoginExterno(), callbackLoginExterno() para OIDC/SAML
}
```
Fase A: `ProvedorLocal` (usuarios_auth + argon2 + fallback firebase-scrypt). Fase B: `ProvedorLdap` ou `ProvedorOidc`. O resto do sistema (sessões, guards, regras) só conhece a `emailKey`.

---

## Parte II — Autorização

## 4. Como funciona hoje

Toda a proteção do banco está em [`database.rules.json`](../../database.rules.json). O navegador pode tentar ler/escrever **qualquer caminho**; o Firebase avalia, **no servidor**, a regra `.read`/`.write` mais próxima no caminho. Características que o backend precisa reproduzir **exatamente**:

1. **Negado por padrão:** a raiz tem `.read: false` e `.write: false`. Caminho sem regra = negado.
2. **Regras em cascata:** uma permissão concedida num nível **vale para todos os níveis abaixo** (no RTDB, `.read`/`.write` concedidos num pai não podem ser revogados num filho). Ex.: `turmas/.read` concede leitura de `turmas/<qualquer coisa>/<qualquer coisa>`.
3. **Escrita é avaliada no caminho de cada escrita**, e também em todos os ancestrais: uma escrita em `a/b/c` é permitida se **qualquer** das regras `.write` de `a`, `a/b`, `a/b/c` permitir.
4. **`update()` multi-caminho é tudo-ou-nada:** se **uma** das escritas for negada, **nenhuma** é aplicada.
5. **Leitura de um nó inteiro exige permissão no próprio nó** (ou acima). Ex.: ler `avaliacoes` (todas as turmas) exige a regra de `avaliacoes/.read` (só admin); uma participante só pode ler `avaliacoes/<turma>/<sua emailKey>`.
6. Variáveis disponíveis nas regras: `auth` (`auth.token.email`), `root` (banco inteiro **antes** da escrita), `data` (valor atual no caminho), `newData` (valor depois da escrita), `$variavel` (segmento do caminho).
7. `.validate` e `.indexOn`: **não são usados** neste projeto (conferido — 0 ocorrências).

## 5. Predicados reutilizáveis (TypeScript)

Toda regra do arquivo é combinação destes predicados. Implementar em `backend/src/rules/predicados.ts`:

```ts
export const SUPER_ADMINS = (process.env.SUPER_ADMINS ?? 'tatianefdirene@previ.com.br,danielfrazao@previ.com.br')
  .split(',').map(s => s.trim().toLowerCase());

// ATENÇÃO — duas funções diferentes de chave existem hoje:
// (a) emailKey do SITE (auth.js l. 28): minúsculas, [@.]→_, remove [^a-z0-9_], corta em 64.
//     É a chave usada para GRAVAR os dados.
// (b) chave usada NAS REGRAS: auth.token.email.replace('@','_').replace('.','_')
//     (sem toLowerCase na maioria das regras; com toLowerCase nas regras de apostas).
//     No RTDB, String.replace substitui TODAS as ocorrências.
// Para e-mails comuns (@previ.com.br, só letras/números/ponto) as duas dão o mesmo resultado.
// O backend usa SEMPRE (a) — é o que casa com as chaves já gravadas. Ver documento 03, seção 2.
export function emailKey(email: string): string {
  return (email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
}

export interface Ctx {
  auth: { email: string; emailKey: string } | null;  // null = não autenticado
  root: LeitorBanco;          // lê qualquer caminho do estado ATUAL (antes da escrita)
  data: unknown;              // valor atual no caminho avaliado
  newData: unknown;           // valor final no caminho avaliado (após aplicar TODA a escrita multi-caminho)
  vars: Record<string, string>; // $turmaKey, $userKey, ...
}

export const autenticado      = (c: Ctx) => c.auth !== null;
export const dominioPrevi     = (c: Ctx) => !!c.auth && /.*@previ\.com\.br$/.test(c.auth.email);
export const superAdmin       = (c: Ctx) => !!c.auth && SUPER_ADMINS.includes(c.auth.email.toLowerCase());
export const admin            = async (c: Ctx) => superAdmin(c) || !!c.auth && await c.root.existe(`fa-admins/${c.auth.emailKey}`);
export const facilitadorFlag  = async (c: Ctx) => !!c.auth && await c.root.existe(`fa-facilitadores/${c.auth.emailKey}`);
export const naEquipeDaTurma  = async (c: Ctx, turma: string) => !!c.auth && await c.root.existe(`turmas-equipe/${turma}/${c.auth.emailKey}`);
export const inscritaConfirmada = async (c: Ctx, turma: string) => {
  if (!c.auth) return false;
  const r = await c.root.ler(`turmas-interesse/${turma}/${c.auth.emailKey}`) as any;
  return !!r && r.status === 'inscrito' && r.confirmedByAdmin != null && r.removed !== true;
};
```

> **Nota sobre `matches(/.*@previ\.com\.br/)`:** a regex das regras **não tem âncora `^`/`$` completa** (é `.*@previ\.com\.br`, que casa como *substring*); o site só aceita `@previ.com.br` no final. O backend usa `@previ\.com\.br$` — mais correto e equivalente para todos os e-mails que o cadastro aceita.

## 6. Tabela de regras (tradução completa do `database.rules.json`)

Legenda: **D** = `dominioPrevi` (autenticado com e-mail @previ.com.br) · **A** = `admin` · **SA** = `superAdmin` · **—** = negado (sem regra).

> Todas as regras abaixo foram extraídas do arquivo atual. Qualquer mudança futura no `database.rules.json` **antes do corte** precisa ser replicada aqui e no backend (checklist da Tarefa 4.x).

| Caminho | `.read` | `.write` | Observações |
|---|---|---|---|
| `/` (raiz) | — | — | negado por padrão |
| `fa-users` | D | — | leitura do nó inteiro por qualquer @previ (usado no "＋ Participante", público restrito, busca) |
| `fa-users/$userKey` | D | D | **qualquer @previ pode gravar o perfil de qualquer pessoa** (paridade — ver seção 9) |
| `fa-ranking` | D | — | legado, não usado |
| `fa-ranking/$userKey` | — | D | legado |
| `fa-progress` | D | — | |
| `fa-progress/$userKey` | D | D | |
| `fa-progress-historico` | D | — | |
| `fa-progress-historico/$userKey` | D | D | |
| `fa-admins` | D | — | |
| `fa-admins/$userKey` | D | **SA** | só os 2 super-admins adicionam/removem admins |
| `fa-diretores` | D | — | |
| `fa-diretores/$userKey` | D | A | |
| `fa-facilitadores` | D | — | |
| `fa-facilitadores/$userKey` | D | A | |
| `turmas-equipe` | D | — | |
| `turmas-equipe/$turmaKey` | (herda D) | D | |
| `roteiros-evento` | D | — | |
| `roteiros-evento/$eventoKey` | (herda) | A | |
| `roteiro-tipos-atividade` | D | D | escrita no nó inteiro por qualquer @previ |
| `turmas-roteiro` | D | — | |
| `turmas-roteiro/$turmaKey` | (herda) | D | |
| `eventos` | D | — | |
| `eventos/$eventoKey` | (herda) | A | |
| `eventos-publico` | D | — | |
| `eventos-publico/$eventoKey` | (herda) | A | |
| `eventos-publico/$eventoKey/$userKey` | (herda) | A | |
| `turmas` | D | — | |
| `turmas/$turmaKey` | (herda) | D | |
| `treinamentos` | D | — | |
| `treinamentos/$treinamentoKey` | (herda) | D | |
| `treinamentos-conteudo` | D | — | |
| `treinamentos-conteudo/$treinamentoKey` | (herda) | D | |
| `turmas-interesse` | D | — | |
| `turmas-interesse/$turmaKey` | (herda) | D | |
| `turmas-interesse/$turmaKey/$userKey` | (herda) | D | |
| `fa-users-log` | D | — | |
| `fa-users-log/$userKey` | (herda) | A | |
| `turmas-interesse-log` | D | — | |
| `turmas-interesse-log/$turmaKey[/$userKey]` | (herda) | D | |
| `turmas-publico` | D | — | |
| `turmas-publico/$turmaKey[/$userKey]` | (herda) | A | único nó de turma com escrita só de admin |
| `turmas-config` | D | — | |
| `turmas-config/$turmaKey` | (herda) | D | |
| `turmas-checkin` | D | — | |
| `turmas-checkin/$turmaKey` (e `/$data/$userKey`) | (herda) | D | |
| `turmas-sorteio` | D | — | |
| `turmas-sorteio/$turmaKey[/$sorteioKey]` | (herda) | D | |
| `apostas/**` | **ver seção 7** | **ver seção 7** | a única área com regras finas |
| `fa-seeds-hidden` | D | — | |
| `fa-seeds-hidden/$key` | (herda) | D | |
| `fa-seeds-deleted` / `$key` | D / (herda) | — / D | |
| `fa-holocron-hidden` / `$key` | D / (herda) | — / D | |
| `fa-reset-signal/$userKey` | D | D | (sem regra no nó pai: ler `fa-reset-signal` inteiro é negado) |
| `players` / `$key` | D / (herda) | — / D | legado |
| `holocron` / `$itemId` | D / (herda) | — / D | |
| `pedidos` / `$pedidoKey` | D / (herda) | — / D | |
| `fa-espera` / `$userKey` | D / (herda) | — / D | |
| `avaliacoes` | **A** | — | só admin lê todas |
| `avaliacoes/$turmaKey/$userKey` | D **e** `$userKey == emailKey da pessoa` | D **e** `$userKey == emailKey da pessoa` | cada pessoa lê/grava só a própria avaliação |
| `avaliacoes-produto` | A | A | |
| `avaliacoes-squad` | A | A | |
| `questionarios-config` | A | A | |
| `questionarios-auditoria` | A | A | |
| `motor-squad-config` | A | A | |
| `motor-squad-auditoria` | A | A | |
| `motor-arquitetura-config` | A | A | |
| `motor-arquitetura-auditoria` | A | A | |

**Como ler "(herda)":** o nó pai já concede leitura a D; como regras não podem ser revogadas em filhos, qualquer filho é legível por D.

## 7. `apostas/**` — matriz de autorização da Construção da Aposta

> Esta seção é preenchida a partir do inventário detalhado do `aposta.js` e das regras de `apostas` (anexo [A-apostas-regras.md](anexos/A-apostas-regras.md)). É a parte mais delicada da autorização: a Fase 5 da dinâmica depende de que uma participante **não consiga ler o conteúdo dos grupos dos outros**, e de que uma execução encerrada seja **imutável no servidor**.

Papéis usados:

| Papel | Definição |
|---|---|
| `conduz(t)` | `dominioPrevi && ( superAdmin || admin || (facilitadorFlag && naEquipeDaTurma(t)) )` — com as chaves calculadas **com `toLowerCase()`** (as regras de apostas usam `auth.token.email.toLowerCase()`). |
| `participa(t)` | `dominioPrevi && inscritaConfirmada(t)` |
| `membro(t, e, g)` | existe `apostas/t/execucoes/e/grupos/g/membros/<emailKey>` |

A tabela completa (caminho × leitura × escrita × condições de `data`/`newData`) está no anexo A e é **implementada literalmente** em `backend/src/rules/apostas.rules.ts`, com um teste para cada linha (documento 09, seção 2).

## 8. Como o backend aplica as regras

Implementação no `RulesService` (documento 05, seção 5):

1. **Tabela de padrões:** cada linha da seção 6/7 vira uma entrada `{ padrao: 'turmas-interesse/$turmaKey/$userKey', read?: Predicado, write?: Predicado }`.
2. **Leitura de um caminho `P`:** permitido se **alguma** regra `.read` casando com `P` **ou com qualquer ancestral de `P`** der verdadeiro. Senão `403 PERMISSION_DENIED`.
   - Diferença importante em relação ao RTDB: o RTDB **nunca filtra** — se você não pode ler o nó inteiro, a leitura do nó inteiro falha, mesmo que possa ler alguns filhos. O backend faz igual (não "filtra silenciosamente"). Isso preserva o comportamento de erro que o site já trata.
3. **Escrita (inclui `set`, `update`, `push`, `remove`, `transaction`):** decompor a operação em pares `(caminho, valorNovo)`; para **cada** par, permitido se alguma regra `.write` casando com o caminho **ou com um ancestral** der verdadeiro, avaliada com `data` = valor atual e `newData` = valor final **após aplicar todos os pares**. Se **qualquer** par for negado → `403` e **nada** é gravado.
4. `root` é um leitor do estado **antes** da escrita, com cache por requisição (várias regras consultam `fa-admins/<eu>`).
5. **Testes obrigatórios:** a suíte `.github/scripts/teste-rules.js` (hoje contra o emulador) é portada para rodar contra a API (documento 09, seção 2). Nenhuma regra entra em produção sem teste.

## 9. Brechas herdadas (paridade consciente) — corrigir na Fase B, não na Fase A

As regras atuais concedem mais do que as telas usam. **Na Fase A o backend reproduz as regras como estão** (para não quebrar nada que dependa delas). Estas brechas estão registradas para a Fase B:

| # | Brecha | Risco | Correção sugerida (Fase B) |
|---|---|---|---|
| B-1 | Qualquer @previ logado pode **gravar** `fa-users/<qualquer pessoa>` — inclusive `blocked`, `adminApproved`, `name` | Alto | Pessoa só grava o próprio perfil e só campos não sensíveis; `blocked`/`adminApproved`/`createdByAdmin` só admin. |
| B-2 | Qualquer @previ pode gravar `turmas-interesse/<turma>/<qualquer pessoa>` — incluindo `status: 'inscrito'` e `confirmedByAdmin` | **Alto** (autoinscrição, burla de público restrito — hoje a restrição de público só existe no navegador) | Endpoints de domínio: participante só registra/cancela o **próprio** interesse; confirmar/mover/inscrever só admin, com checagem de público restrito e exclusividade no servidor. |
| B-3 | Qualquer @previ pode gravar `turmas/*`, `turmas-config/*`, `turmas-checkin/*`, `treinamentos/*`, `treinamentos-conteudo/*`, `turmas-sorteio/*`, `turmas-equipe/*`, `turmas-roteiro/*`, `roteiro-tipos-atividade` | Médio/alto | Restringir a admin (e à equipe da turma onde fizer sentido: roteiro, check-in). |
| B-4 | Qualquer @previ lê `fa-users`, `turmas-interesse`, `pedidos`, `fa-espera`, `fa-progress` inteiros (nomes, e-mails, áreas, pedidos de todos) | Médio (LGPD) | Endpoints que devolvem só o necessário para cada tela. |
| B-5 | Qualquer @previ pode gravar `fa-progress/<outra pessoa>` e `fa-reset-signal/<outra pessoa>` | Baixo/médio | Só a própria pessoa (progress) e só admin (reset-signal). |
| B-6 | Senha padrão `12345678` para contas criadas pela admin | Médio | "Definir senha no primeiro acesso" com token por e-mail. |

> **Importante para a IA/pessoa que implementa:** **não** corrija essas brechas durante a Fase A, mesmo que pareça óbvio. Corrigir uma delas pode fazer um botão que hoje funciona passar a falhar ao salvar — o que viola o princípio "se pode mexer, pode gravar". Cada correção é um PR próprio na Fase B, com a tela ajustada junto.
