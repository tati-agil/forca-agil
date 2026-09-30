# 02 — Arquitetura-alvo e justificativa das decisões

> Pré-requisito: ter lido o [README](README.md) e o [01-diagnostico-sistema-atual.md](01-diagnostico-sistema-atual.md).

## 1. Resposta direta: "é viável usar um backend NestJS?"

**Sim — e não é só viável, é obrigatório.** Hoje o navegador de cada participante fala **direto** com o banco do Firebase, e a única coisa que impede alguém de ler ou alterar o que não deve são as regras do `database.rules.json`, **avaliadas pelos servidores do Google**. Um MongoDB **não tem** esse mecanismo: um MongoDB nunca pode ser exposto ao navegador. Então, fora do Firebase, **algum** servidor precisa ficar entre o navegador e o banco para:

1. autenticar a pessoa (substituir o Firebase Authentication);
2. aplicar as mesmas permissões que o `database.rules.json` aplica hoje;
3. gravar/ler no MongoDB;
4. avisar os navegadores quando um dado muda (substituir o tempo real do Firebase);
5. enviar os e-mails de verificação e de redefinição de senha (hoje o Google envia).

**NestJS** é uma escolha boa para esse servidor porque:

| Critério | Por que NestJS atende |
|---|---|
| Linguagem | TypeScript/JavaScript — a mesma do site. Funções puras do site (ex.: `emailKey`, validadores dos motores) podem ser copiadas para o backend sem tradução. |
| Estrutura | Módulos, controllers, services, guards e interceptors padronizados: uma IA ou uma pessoa nova encontra as coisas sempre no mesmo lugar. |
| Autorização | *Guards* são o lugar natural para reimplementar as regras do `database.rules.json`. |
| Tempo real | `@nestjs/websockets` + Socket.IO já integrados (substitui o `.on('value')` do Firebase). |
| MongoDB | `@nestjs/mongoose` (ou driver nativo) maduro; suporte a transações multi-documento. |
| Testes | Jest + Supertest já vêm configurados pelo CLI. |
| Container | Imagem Node Alpine pequena, build multi-estágio simples. |

Alternativas consideradas e descartadas estão no [12-riscos-decisoes-e-pendencias.md](12-riscos-decisoes-e-pendencias.md) (ADR-001).

---

## 2. Visão geral da arquitetura-alvo

```
                         Rede interna da empresa (HTTPS)
                                      │
                         ┌────────────▼─────────────┐
   Navegador             │  NGINX  (container)       │   porta 443 (TLS com certificado da empresa)
   (celular/PC)  ───────►│  • serve index.html,      │
   site sem mudança      │    forca-agil/*.js/.css   │
   de telas              │  • /api/*       → api:3000│
                         │  • /socket.io/* → api:3000│ (WebSocket)
                         │  • cabeçalhos CSP/cache   │
                         └────────────┬─────────────┘
                                      │ rede Docker interna (não exposta)
                         ┌────────────▼─────────────┐
                         │  API NestJS (container)   │
                         │  • AuthModule (login,     │──────► SMTP interno da empresa
                         │    cadastro, sessão,      │        (verificação de e-mail,
                         │    e-mails)               │         redefinição de senha)
                         │  • DataModule (API de     │
                         │    caminhos compatível)   │
                         │  • RulesModule (tradução  │
                         │    do database.rules.json)│
                         │  • RealtimeGateway        │
                         │    (Socket.IO)            │
                         │  • AdminModule (criar     │
                         │    conta, corrigir e-mail,│
                         │    bloquear, reset)       │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │  MongoDB 7 (container)    │
                         │  replica set "rs0" (1 nó) │  ← replica set é obrigatório para
                         │  volume persistente       │    transações e change streams
                         └──────────────────────────┘
                                      │
                         backup diário (mongodump) → diretório/NAS da empresa
```

**O navegador só conhece um endereço** (ex.: `https://forcaagil.previ.com.br`). Nginx, API e MongoDB ficam no mesmo servidor, na mesma rede Docker; **só o Nginx expõe porta**. MongoDB e API nunca ficam acessíveis de fora do servidor.

---

## 3. A decisão mais importante: migrar em duas fases

### 3.1 O problema

O frontend tem ~20 arquivos que chamam o banco diretamente (`firebase.database().ref('...').once/on/set/update/push/remove/transaction`), com **mais de 400 pontos de chamada** — só o `admin.js` tem ~100 `ref(...)` e o `aposta.js` usa transações e ouvintes em tempo real. A lógica de negócio (quem pode ser confirmada, como mover alguém da lista de espera, o merge do roteiro, os motores de classificação) mora **no navegador**, dentro dessas telas.

Reescrever tudo isso para chamar endpoints REST específicos antes de sair do Firebase significaria reescrever e retestar o site inteiro — exatamente o tipo de mudança que já causou incidentes em oficinas (ver `CLAUDE.md`).

### 3.2 A evidência que resolve o problema

O próprio repositório já prova que existe uma saída barata: **a suíte de testes automáticos inteira roda sem Firebase**. O arquivo [`.github/scripts/firebase-falso.js`](../../.github/scripts/firebase-falso.js) implementa, em poucas centenas de linhas, um objeto global `firebase` "de mentira" com `ref()`, `once()`, `on()`, `off()`, `set()`, `update()`, `push()`, `remove()`, `transaction()` e `auth()`, e **o site inteiro funciona em cima dele** sem nenhuma alteração nas telas. Ou seja: a superfície do SDK que o site realmente usa é **pequena, conhecida e emulável**.

### 3.3 A estratégia

**Fase A — Migração com paridade (é esta que faz o corte do Firebase).**

1. O backend NestJS expõe uma **API de dados baseada em caminhos** (`GET/PUT/PATCH/DELETE /api/db/<caminho>`, `POST /api/db/_multi`, `POST /api/db/<caminho>/_transacao`), que entende os **mesmos caminhos** do RTDB (`turmas-interesse/t1/maria_previ_com_br`).
2. Cada caminho é mapeado para uma **coleção de verdade** do MongoDB (documento 03 — não é "jogar a árvore JSON inteira num documento só").
3. Cada leitura/escrita passa pelo **motor de regras** do backend, que reimplementa o `database.rules.json` regra por regra (documento 04). Mesmas permissões de hoje, nem mais nem menos.
4. Um **gateway Socket.IO** substitui o `.on('value')`: o navegador se inscreve num caminho e é avisado quando algo nele muda.
5. No frontend, os três `<script>` do Firebase (gstatic.com) são trocados por **um arquivo novo**, `forca-agil/fa-api-client.js`, que expõe o **mesmo objeto global `firebase`** (compat), mas implementado com `fetch` + Socket.IO falando com o backend. É o `firebase-falso.js` dos testes, só que ligado a um servidor de verdade.
6. As **únicas** alterações em arquivos existentes do site na Fase A são (lista completa no [documento 06, seção 1](06-adaptacao-do-frontend.md#1-resumo-do-que-muda-fase-a)):
   - `index.html` — trocar os 3 `<script>` do gstatic pelo cliente novo e passar a usar fontes locais (a intranet pode bloquear Google Fonts);
   - `forca-agil/auth.js` — o cadastro e os dois fluxos de admin que hoje "entram como outra pessoa" (criar conta para colaboradora e corrigir e-mail) passam a chamar endpoints dedicados do backend;
   - `forca-agil/router.js` — o diagnóstico de conexão e o "limpar sessão" (que citam domínios e chaves do Firebase);
   - `forca-agil/styles.css` e `forca-agil/roteiro.js` — referência às fontes do Google;
   - `forca-agil/testes.js` — só textos do grupo "Firebase" do painel de testes;
   - uma tela pequena nova (`#conta`) para os links de verificação de e-mail e redefinição de senha;
   - cabeçalho CSP (que hoje libera `*.firebaseio.com` e `gstatic.com`) — passa a ser `self` apenas.

   `forca-agil/firebase.js` **não precisa mudar** (o `initializeApp` vira uma operação vazia no cliente novo). **Nenhuma tela é reescrita. Nenhuma regra de negócio muda.**

**Fase B — Evolução (opcional, depois do corte estabilizado).**

Com o Firebase desligado e tudo rodando internamente, os caminhos genéricos podem ser substituídos **aos poucos**, um domínio por vez, por endpoints de negócio (`POST /api/turmas/:id/participantes/:email/confirmar` etc.), movendo validações do navegador para o servidor, reduzindo leituras de coleções inteiras (hoje qualquer pessoa logada lê `fa-users` inteiro, por exemplo — ver documento 04, seção 9), e integrando login com o AD/SSO da empresa. A Fase B **não é pré-requisito** para desligar o Firebase e está descrita só em linhas gerais no documento 11 (Fase 9).

### 3.4 Por que essa estratégia é segura

| Risco | Como a estratégia trata |
|---|---|
| Quebrar uma tela | As telas não são alteradas; o comportamento do cliente de compatibilidade é validado pela **mesma suíte Playwright** que já existe, rodando contra o backend real em Docker. |
| Abrir brecha de segurança | O motor de regras é testado com a **mesma bateria** do `.github/scripts/teste-rules.js` (hoje roda contra o emulador do Firebase), portada para rodar contra a API. Regra que não for portada = acesso **negado** por padrão (a raiz tem `.read: false`/`.write: false`, e o backend replica isso). |
| Perder dados | Exportação completa + importação idempotente + conferência por contagem/amostragem + Firebase mantido somente-leitura por 30 dias. |
| Senhas | O Firebase Auth permite exportar os *hashes* das senhas (scrypt modificado). O backend valida o hash antigo no primeiro login e regrava em argon2id. **Ninguém precisa redefinir senha no dia do corte.** (documento 04, seção 3.4) |
| Custos de IA acabarem no meio | Cada tarefa do plano é pequena, independente, com critério de aceite; o `PROGRESSO.md` registra onde parou. |

---

## 4. Componentes em detalhe

### 4.1 Nginx (container `web`)

- Imagem `nginx:1.27-alpine` com os arquivos estáticos do site copiados para `/usr/share/nginx/html` (mesmas exclusões do `firebase.json`: `scraps/`, `screenshots/`, `uploads/`, `preview-chars.html`, `*.md`, `*.txt` exceto `robots.txt`, arquivos ocultos, `backend/`, `infra/`, `tools/`, `docs/`).
- **Reproduz** o que o `firebase.json` faz hoje:
  - `Cache-Control: no-cache` em `*.js`, `*.css`, `/` e `/index.html`;
  - cabeçalho `Content-Security-Policy` (atualizado: sem Firebase/gstatic/Google Fonts);
  - *rewrite* de qualquer caminho desconhecido para `/index.html` (o roteamento é por `#hash`, mas o fallback existe hoje e deve continuar).
- Termina TLS (HTTPS) com o certificado da empresa.
- Faz *proxy* de `/api/` e `/socket.io/` para o container `api` (com *upgrade* de WebSocket).
- Configuração completa no [07-infraestrutura-docker.md](07-infraestrutura-docker.md).

### 4.2 API NestJS (container `api`)

Módulos (detalhados no [05-backend-nestjs.md](05-backend-nestjs.md)):

| Módulo | Responsabilidade |
|---|---|
| `ConfigModule` | Lê variáveis de ambiente (`.env`), valida na inicialização (falha rápido se faltar algo). |
| `DatabaseModule` | Conexão MongoDB (replica set), sessões para transação. |
| `AuthModule` | Cadastro, login, logout, sessão (cookie), verificação de e-mail, redefinição de senha, "quem sou eu", compatibilidade com hash do Firebase. |
| `UsersAdminModule` | Endpoints que hoje o `auth.js` faz com "truques" de login: criar conta para colaboradora, corrigir e-mail de login, disparar redefinição de senha, bloquear conta. |
| `RulesModule` | Tradução do `database.rules.json` para TypeScript. Uma função por padrão de caminho, com as mesmas variáveis (`auth`, `root`, `data`, `newData`, `$turmaKey`…). |
| `DataModule` | API de caminhos: leitura, `set`, `update` multi-caminho (transação MongoDB), `push` (IDs compatíveis), `remove`, `transaction` (compare-and-swap otimista), consultas `orderByChild/equalTo/limitToFirst`. |
| `PathMappingModule` | Tabela que diz em qual coleção/documento/campo cada caminho mora (documento 03). |
| `RealtimeModule` | Gateway Socket.IO: inscrição por caminho, verificação de permissão de leitura na inscrição, notificação após cada escrita confirmada. |
| `MailModule` | Envio de e-mails via SMTP interno (templates em português iguais aos atuais). |
| `HealthModule` | `GET /api/health` (liveness) e `/api/health/ready` (readiness: Mongo + SMTP). |
| `AuditModule` (opcional Fase A) | Log estruturado de toda escrita (quem, quando, caminho) — hoje o Firebase não guarda isso. |

### 4.3 MongoDB (container `mongo`)

- `mongo:7.0`, **replica set de 1 nó** (`rs0`). Motivo: transações multi-documento (necessárias para reproduzir o `update()` multi-caminho atômico do Firebase) e *change streams* só funcionam em replica set.
- Autenticação ligada (`--auth` + *keyfile*), usuário da aplicação com permissão só no banco `forcaagil`.
- Volume Docker nomeado para os dados; backup diário com `mongodump` (documento 07, seção 8).
- **Nunca** expõe a porta 27017 para fora do servidor.

### 4.4 Tempo real

Hoje, telas como a Construção da Aposta (facilitadora vê os grupos avançando), o motor de classificação (cache sincronizado), pedidos, repositório e o próprio nível de acesso (removida de uma turma → perde o acesso na hora) dependem de `.on('value')`.

Na arquitetura-alvo:

1. O cliente de compatibilidade abre **uma** conexão Socket.IO por aba (autenticada pelo mesmo cookie de sessão).
2. `ref(caminho).on('value', cb)` → o cliente faz `GET /api/db/<caminho>` (entrega o valor inicial, como o Firebase) e envia `subscribe {caminho}` pelo socket.
3. O servidor verifica **permissão de leitura** daquele caminho para aquela pessoa antes de aceitar a inscrição.
4. Depois de **cada escrita confirmada no MongoDB**, o `DataService` publica "caminho X mudou" num barramento interno; o gateway avisa todas as inscrições cujo caminho é **ancestral, igual ou descendente** do caminho alterado.
5. O cliente, ao receber o aviso, refaz o `GET` daquele caminho (com *debounce* de ~150 ms) e chama o `cb` com o valor novo — passando de novo pelas regras de leitura, ou seja, **nunca vaza dado que a pessoa não pode ler**.

Com **uma** instância da API (suficiente para o volume da Força Ágil — centenas de usuários, dezenas simultâneos numa oficina), o barramento é em memória. Se um dia houver mais de uma instância, troca-se o barramento por *MongoDB change streams* ou Redis Pub/Sub (adaptador do Socket.IO) — a interface já é isolada para isso (documento 05, seção 7).

### 4.5 Transações

O site usa `ref(...).transaction(fn)` em 7 lugares (5 no `aposta.js`, 1 em cada motor de classificação). No Firebase, a função `fn` roda **no navegador**, com o valor atual; o servidor só aceita se o valor não mudou nesse meio-tempo; senão o SDK roda `fn` de novo (até 25 vezes).

O cliente de compatibilidade reproduz exatamente isso:

1. `GET /api/db/<caminho>?comRevisao=1` → `{ valor, revisao }`;
2. roda `fn(valor)` no navegador;
3. se `fn` devolveu `undefined` → aborta (igual Firebase: `committed=false`);
4. senão `POST /api/db/<caminho>/_transacao { valorNovo, revisaoEsperada }`;
5. o servidor faz `findOneAndUpdate({ _id, _rev: revisaoEsperada }, { $set: ..., $inc: { _rev: 1 } })`; se nenhum documento casou → **409 Conflito** → o cliente volta ao passo 1 (máx. 25 tentativas).

Detalhes, incluindo o caso de caminho cujo documento ainda não existe, no documento 05, seção 6.

### 4.6 E-mails

O Firebase envia hoje 3 e-mails (verificação de cadastro, "esqueci minha senha", redefinição disparada pelo admin). O backend passa a enviar pelo **SMTP interno** da empresa, com links que apontam para o próprio site (`/#conta?acao=verificar&token=...`), processados por uma pequena tela nova (documento 06, seção 5). Em desenvolvimento, um container **Mailpit** captura os e-mails (nenhum e-mail real sai da máquina de dev).

### 4.7 O que continua 100% no navegador (e está certo continuar)

Estas partes não usam o Firebase e não mudam:

- Geração de **PDF** (certificados, relatórios de avaliação) com `html2pdf.bundle.min.js` — local.
- Exportação **Excel** com `xlsx.mini.min.js` — local.
- **QR Code** do check-in com `qrcode.min.js` — local.
- Motores de classificação (`identificarCamada`, `simular`, `validarRegras`, `diffRegras`) — funções puras.
- Roteamento por hash (`router.js`), merge do roteiro (`roteiro.js`), cálculo de patente (`game.js`).

---

## 5. Fluxo de uma requisição típica (exemplo: confirmar participante)

Hoje (Firebase):
```
admin.js → firebase.database().ref().update({
   'turmas-interesse/t1/maria_previ_com_br/status': 'inscrito',
   'turmas-interesse/t1/maria_previ_com_br/confirmedByAdmin': 'tatiane...',
   ... }) → servidores Google avaliam database.rules.json → grava
```

Depois (Fase A) — **o `admin.js` não muda uma linha**:
```
admin.js → firebase.database().ref().update({...})        (mesmo código)
   → fa-api-client.js → POST /api/db/_multi  { "turmas-interesse/t1/maria_previ_com_br/status": "inscrito", ... }
      (cookie de sessão enviado automaticamente)
   → Nginx → API
      → AuthGuard: sessão válida? conta não bloqueada? e-mail verificado (se exigido)?
      → RulesService: para CADA caminho do update, a regra .write do database.rules.json
        (aqui: auth != null && e-mail @previ.com.br) → OK
      → PathMapping: 'turmas-interesse/t1/maria_previ_com_br/status'
        → coleção turmas_interesse, _id "t1|maria_previ_com_br", campo "status"
      → MongoDB: transação { updateOne(... $set ...) } para todos os caminhos juntos
      → RealtimeBus: publica "turmas-interesse/t1/maria_previ_com_br" alterado
   ← 200 OK
   → navegadores inscritos em turmas-interesse/t1/maria_previ_com_br (ex.: a própria Maria,
     via watchEnrolledStatus do auth.js) recebem aviso, refazem o GET, e o menu de
     Conteúdos/Treinamento aparece para ela na hora — igual hoje.
```

---

## 6. Requisitos não funcionais

| Requisito | Meta | Como |
|---|---|---|
| Disponibilidade | Horário comercial + oficinas agendadas | `restart: unless-stopped` em todos os containers; healthchecks; monitoramento (documento 10). |
| Latência (rede da Previ) | Leitura < 150 ms p95 no servidor; tela inicial < 3 s no 4G | Nginx com gzip/brotli; índices MongoDB; *debounce* do tempo real. |
| Concorrência | ~100 conexões simultâneas numa oficina | 1 instância da API aguenta com folga (Node + Socket.IO). |
| Capacidade | Base atual é pequena (MBs) | Servidor mínimo: 2 vCPU, 4 GB RAM, 40 GB disco (documento 07, seção 2). |
| Backup | RPO 24 h, RTO 2 h | `mongodump` diário + retenção 30 dias + teste de restauração mensal. |
| Segurança | Nenhum dado acessível sem login @previ.com.br | Motor de regras com *deny by default*; TLS; cookies `HttpOnly; Secure; SameSite=Strict`; *rate limit* no login; senhas argon2id. |
| LGPD | Dados pessoais (nome, e-mail, área) | Ficam dentro da infraestrutura da empresa (ganho em relação ao Firebase); logs sem senha/token. |
| Observabilidade | Saber que caiu antes da oficina começar | Logs JSON (pino) → `docker logs`/coletor da empresa; `/api/health`; alerta. |
