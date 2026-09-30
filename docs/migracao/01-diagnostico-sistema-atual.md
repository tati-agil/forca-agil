# 01 — Diagnóstico do sistema atual (a "fotografia" antes da migração)

> Este documento descreve **o que existe hoje** e precisa continuar funcionando depois. Foi produzido lendo o código inteiro (não por amostragem). Os inventários linha a linha que embasam cada afirmação estão nos anexos:
> - [anexos/B1-inventario-admin.md](anexos/B1-inventario-admin.md) — `admin.js` (painel)
> - [anexos/B2-inventario-participante.md](anexos/B2-inventario-participante.md) — telas da participante e módulos compartilhados
> - [anexos/B3-inventario-aposta-roteiro.md](anexos/B3-inventario-aposta-roteiro.md) — Construção da Aposta e Roteiro
> - [anexos/B4-inventario-arquitetura-ci.md](anexos/B4-inventario-arquitetura-ci.md) — aba Arquitetura, CI/CD e scripts de operação
>
> **Números de linha** citados valem para o commit em que esta documentação foi escrita. Se o código mudou desde então, procure pelo nome da função.

---

## 1. Visão geral

| Item | Valor |
|---|---|
| Tipo de aplicação | SPA em **JavaScript puro** (sem framework, sem bundler, sem `package.json`), roteamento por `#hash` |
| Tamanho | `index.html` ~108 KB + ~34 arquivos em `forca-agil/` (~3,9 MB, dos quais ~1,2 MB são bibliotecas minificadas) |
| Hospedagem | Firebase Hosting, projeto `kyber-agil` (`kyber-agil.web.app`) |
| Banco | Firebase Realtime Database (`https://kyber-agil-default-rtdb.firebaseio.com`) |
| Autenticação | Firebase Authentication — e-mail/senha, só `@previ.com.br` |
| SDK | Firebase JS **compat 10.7.0**, carregado de `https://www.gstatic.com/firebasejs/10.7.0/` (`index.html` l. 1736-1738) |
| Backend próprio | **Nenhum.** O navegador fala direto com o Firebase. Toda a regra de negócio roda no navegador; a única proteção no servidor é o `database.rules.json`. |
| Deploy | GitHub Actions: push em `main` → `firebase deploy --only hosting,database` |
| Testes | ~32 scripts Playwright em `.github/scripts/` (28 usam um Firebase **falso** em memória), testes de regras contra o emulador (`teste-rules.js`), suíte "Automáticos" contra produção |

### 1.1 Ordem de carregamento dos scripts (`index.html` l. 1736-1781)

A ordem **importa** (cada arquivo pendura funções em `window.fa*` que os seguintes usam):

```
head-init.js (no <head>)
firebase-app-compat.js → firebase-database-compat.js → firebase-auth-compat.js   ← (gstatic — SERÃO TROCADOS)
firebase.js → turmas-util.js → roteiro.js → router.js → auth.js → stars.js → app.js
→ home-nav.js → conteudos-nav.js → repo.js → game-data.js → game.js → qrcode.min.js
→ certif.js → admin.js → avaliacao.js → checkin.js → manual.js → mapa.js → testes.js
→ pedidos.js → dashboard.js → questionarios-config.js → motor-arquitetura.js
→ avaliacao-produto.js → motor-squad.js → avaliacao-squad.js → aluno.js
→ facilitador.js → aposta.js → init.js
```

> O `CLAUDE.md` da raiz não lista os 5 scripts da aba Arquitetura (questionarios-config → avaliacao-squad). A ordem acima é a real.

---

## 2. Firebase Authentication — o que o site usa

Detalhado no [documento 04, Parte I](04-autenticacao-e-autorizacao.md). Resumo das chamadas ao SDK:

| Chamada | Onde | Uso |
|---|---|---|
| `onAuthStateChanged` | `auth.js` l. 248, 275, 296, 313 | 4 ouvintes: resolve admin, diretor, facilitador e a sessão (lê `fa-users/<emailKey>`, checa `blocked` e verificação de e-mail, calcula nível `enrolled`) |
| `createUserWithEmailAndPassword` | `auth.js` l. 436 (cadastro), 529 (admin cria conta) | |
| `signInWithEmailAndPassword` | `auth.js` l. 571 (login), 490/494/540 (vai-e-vem do admin) | |
| `signOut` | `auth.js` l. 330, 450, 489, 538, 584, 873; `router.js` l. 419 | |
| `sendEmailVerification` | `auth.js` l. 448, 557 | |
| `sendPasswordResetEmail` | `auth.js` l. 594; `admin.js` l. 4262 | |
| `currentUser.updateEmail` | `auth.js` l. 495 | corrigir e-mail (só contas criadas pelo admin, senha padrão `12345678`) |
| `currentUser` | `auth.js` l. 447, 555; `router.js` l. 335 | |

**Eventos do site que dependem da autenticação** (o cliente novo precisa disparar os mesmos, na mesma ordem): `fa-auth-ready`, `fa-auth-change`, `fa-admin-ready`, `fa-diretor-ready`, `fa-facilitador-ready`, `fa-enrolled-ready`. Esses eventos são disparados pelo **`auth.js`** a partir do `onAuthStateChanged` — ou seja, se o cliente de compatibilidade implementar `onAuthStateChanged` fielmente, **os eventos continuam saindo sozinhos**.

---

## 3. Firebase Realtime Database — os nós (as "tabelas")

A árvore tem **41 nós de primeiro nível** declarados nas regras; 40 são usados pelo código (`fa-ranking` é legado — conferido pelo `teste-consistencia-docs.js`). A descrição de negócio de cada um está em [`forca-agil/mapa.js`](../../forca-agil/mapa.js) (seção "Firebase Realtime Database", ~l. 627). Resumo técnico:

| Nó | Chave(s) abaixo do nó | Quem escreve | Quem lê | Tempo real? |
|---|---|---|---|---|
| `fa-users` | `<emailKey>` | cadastro, admin (editar/bloquear/aprovar/corrigir e-mail) | auth, admin, pedidos, testes | não |
| `fa-users-log` | `<emailKey>/<pushKey>` | admin | admin | não |
| `fa-admins` | `<emailKey>` | super-admin | auth, admin, pedidos | não |
| `fa-diretores` | `<emailKey>` | admin | auth, admin | não |
| `fa-facilitadores` | `<emailKey>` | admin | auth, admin, aposta | não |
| `fa-progress` | `<emailKey>` | a própria pessoa (a cada clique do quiz) | a própria pessoa no login | não |
| `fa-progress-historico` | `<emailKey>/<treino>/<pushKey>` | a própria pessoa | a própria pessoa | não |
| `fa-reset-signal` | `<emailKey>` | admin (`{at: ServerValue.TIMESTAMP}`) | a própria pessoa | **sim** (`firebase.js` l. 127) |
| `fa-espera` | `<emailKey>/<origem>` (`<turmaKey>` \| `lista:<eventoKey>` \| `lista` legado) — **formato legado:** campos direto em `<emailKey>` | participante, admin | participante, admin | não |
| `fa-seeds-hidden`, `fa-seeds-deleted`, `fa-holocron-hidden` | `<seedKey>` / `<pushKey>` | admin | repositório | **sim** (`repo.js` l. 380, 384) |
| `fa-ranking`, `players` | — | legado | `players`: só no "resetar progresso" (query por e-mail) | não |
| `eventos` | `<eventoKey>` | admin | todos | não |
| `eventos-publico` | `<eventoKey>/<emailKey>` | admin | todos (lista inteira baixada para filtrar a vitrine) | não |
| `turmas` | `<turmaKey>` | admin | todos | não |
| `turmas-config` | `<turmaKey>` | admin | todos | não |
| `turmas-interesse` | `<turmaKey>/<emailKey>` | participante (interesse), admin (confirmar etc.) | todos (várias telas baixam o nó **inteiro**) | **sim** (`auth.js` l. 188 — nível de acesso ao vivo, um ouvinte por turma) |
| `turmas-interesse-log` | `<turmaKey>/<emailKey>/<pushKey>` | participante, admin | admin | não |
| `turmas-publico` | `<turmaKey>/<emailKey>` | admin | todos | não |
| `turmas-checkin` | `<turmaKey>/<AAAA-MM-DD>/<emailKey>` | participante (QR), admin | participante (Minha Área baixa **inteiro**), admin | não |
| `turmas-sorteio` | `<turmaKey>/<pushKey>` | admin | admin | não |
| `turmas-equipe` | `<turmaKey>/<emailKey>` | admin | admin, facilitador, aposta | não |
| `turmas-roteiro` | `<turmaKey>` (`customizacoes`, `exclusivas`, `facilitacao`) | admin, responsável | admin, equipe | não |
| `roteiros-evento` | `<eventoKey>` (`dias`, `atividades`) | admin | admin, equipe | não |
| `roteiro-tipos-atividade` | `<pushKey>` | admin | admin, roteiro | **sim** (`roteiro.js` l. 744, nunca desligado) |
| `treinamentos` | `<treinamentoKey>` | admin | todos | não |
| `treinamentos-conteudo` | `<treinamentoKey>` | admin | todos | não |
| `avaliacoes` | `<turmaKey>/<emailKey>` | a própria pessoa | a própria pessoa; admin lê tudo | não |
| `pedidos` | `<pushKey>` | participante (cria), admin (marca) | participante (Minha Área baixa **inteiro**), admin | **sim** (`pedidos.js` l. 520) |
| `holocron` | `<pushKey>` | participante, admin | todos | **sim** (`repo.js` l. 224, com `orderByChild('createdAt')`) |
| `apostas` | `<turmaKey>/...` (árvore profunda — anexo A) | participantes, facilitação | idem, com regras finas | **sim** (5 ouvintes, `aposta.js`) |
| `avaliacoes-produto` | `<pushKey>` | admin | admin | **sim** (coleção inteira, `avaliacao-produto.js` l. 4058, `avaliacao-squad.js` l. 1445) |
| `avaliacoes-squad` | `<pushKey>` | admin | admin | **sim** (coleção inteira, `avaliacao-squad.js` l. 1430) |
| `questionarios-config` | `<codigo>` | admin | admin | **sim** (`questionarios-config.js` l. 249) |
| `questionarios-auditoria` | `<codigo>/<pushKey>` | admin | admin | não |
| `motor-arquitetura-config`, `motor-squad-config` | documento único | admin | admin | **sim** (`motor-*.js`) |
| `motor-arquitetura-auditoria`, `motor-squad-auditoria` | `<pushKey>` | admin | admin | não |

### 3.1 Operações usadas (a superfície do SDK que o cliente novo precisa emular)

| Operação | Uso no código | Observação |
|---|---|---|
| `ref(caminho)`, `.child(p)` | em todo lugar | caminhos com `/` |
| `once('value', ok, err)` e `once('value').then` | ~150 pontos | o site **trata erro** (callback `err` e `.catch`) — timeouts e "tela preta" dependem disso |
| `on('value', cb)` / `off()` | 17 ouvintes (tabela acima) | nenhum `child_added`/`child_changed` |
| `set(valor, cb)` | ~50 | `null` = apagar |
| `update(objeto, cb)` | ~60, sendo **~30 multi-caminho na raiz** (`ref().update({'a/b': 1, 'c/d': 2})`) — **atômicos** | detalhados nos anexos B1 §2 e B3 |
| `push()` / `push().key` / `push(valor)` | ~40 | chaves **geradas no cliente**, ordenáveis por tempo |
| `remove(cb)` | ~30 | |
| `transaction(fn, onComplete)` | **7**: 5 em `aposta.js` (travas de criação de execução/ciclo e contador), 1 em cada motor (`publicarRegras`) | detalhado no documento 05, seção 6 |
| `orderByChild` + `equalTo` | 1 (`admin.js` l. 5642, `players` por e-mail) | |
| `orderByChild('createdAt')` | 1 (`repo.js` l. 224) | ordena o `forEach` |
| `limitToFirst(1)` | 1 (`testes.js` l. 20) | teste de conectividade |
| `firebase.database.ServerValue.TIMESTAMP` | 1 (`admin.js` l. 5641) | |
| snapshot: `val()`, `exists()`, `key`, `forEach()` | em todo lugar | `forEach` na ordem da consulta |
| `onDisconnect`, `child_*` events, `startAt/endAt` | **não usados** | não precisam ser emulados |

> **Evidência de que essa superfície é suficiente:** [`.github/scripts/firebase-falso.js`](../../.github/scripts/firebase-falso.js) implementa exatamente isso (e só isso) e 28 testes Playwright rodam o site inteiro em cima dele.

### 3.2 Particularidades do RTDB que o backend precisa reproduzir

1. **`null` apaga.** `set(null)`, `update({x: null})` e campos `null` dentro de objetos simplesmente não são gravados. Um nó que fica vazio **deixa de existir** (`exists()` = false).
2. **Objeto vazio não existe.** Gravar `{}` equivale a apagar.
3. **Arrays viram objetos com chaves numéricas** e voltam como array só quando "densos". O código já trata os dois formatos (`paraLista`, `game-data.js` l. 366-373; `roteiro.js`; `aposta.js`).
4. **`update()` multi-caminho é tudo-ou-nada**, e caminhos sobrepostos na mesma chamada são proibidos (o código já evita).
5. **Chaves** não podem conter `. $ # [ ] /` — isso casa bem com nomes de campo do MongoDB (que proíbem `.` e `$` inicial).
6. **Timestamps são do cliente** (`new Date().toISOString()`) em praticamente tudo; só `fa-reset-signal` usa hora do servidor.

---

## 4. Regras de segurança (`database.rules.json`)

Tradução completa no [documento 04, Parte II](04-autenticacao-e-autorizacao.md#parte-ii--autorização). Resumo:

- Raiz negada; **todo nó exige login com e-mail `@previ.com.br`**.
- A maioria dos nós permite **leitura e escrita para qualquer pessoa logada** (`fa-users`, `turmas`, `turmas-interesse`, `turmas-checkin`, `turmas-config`, `turmas-equipe`, `turmas-roteiro`, `pedidos`, `holocron`…). **As restrições de papel (só admin confirma, só o responsável edita o roteiro, público restrito…) são aplicadas só na tela.**
- Nós só de admin: `eventos`, `eventos-publico`, `turmas-publico`, `roteiros-evento`, `fa-users-log`, `fa-diretores`, `fa-facilitadores`, e os 8 nós da aba Arquitetura.
- Só super-admin: `fa-admins`.
- `avaliacoes/<turma>/<emailKey>`: cada pessoa só a própria; admin lê tudo.
- `apostas/**`: regras finas (papéis condutor/participante/membro, execução encerrada imutável, ciclo finalizado imutável, `qtdMembros` só +1 junto com a própria entrada) — anexo A.
- **Sem `.validate`** (nenhuma validação de tipo/formato) e **sem `.indexOn`**.

---

## 5. Tempo real — o que realmente precisa de "push"

Dos 17 ouvintes `.on('value')`:

| Necessidade | Ouvintes | Por quê |
|---|---|---|
| **Crítico (oficina ao vivo)** | `aposta.js`: `execucoes/<exec>` (facilitadora vê os grupos avançarem e o Mapa projetado), `revelado` (o "momento da revelação" para todos os grupos ao mesmo tempo), `grupos-resumo` (grupos aparecendo enquanto as pessoas escolhem), `grupos/<meu grupo>` | É a experiência central da dinâmica |
| **Importante** | `auth.js` `turmas-interesse/<t>/<eu>` (confirmada/removida → acesso muda na hora), `firebase.js` `fa-reset-signal/<eu>` | Evita "saia e entre de novo" |
| **Conveniência** | `pedidos` (admin), `holocron` + moderação (repositório), `avaliacoes-produto`/`avaliacoes-squad`, `motor-*-config`, `questionarios-config` (mantêm caches), `roteiro-tipos-atividade` | Poderiam ser leituras pontuais, mas **o código conta com eles** (ex.: sem o ouvinte do motor, `versaoAtual()` fica em 1) |
| **Não precisa** | todo o `admin.js` (0 ouvintes — relê tudo após cada ação) | — |

Conclusão: o tempo real é necessário, mas **com volume baixíssimo** (dezenas de conexões simultâneas numa oficina). Socket.IO numa única instância atende com folga.

---

## 6. Dependências externas em tempo de execução

| Recurso | Origem | Na intranet sem internet | Ação na migração |
|---|---|---|---|
| Firebase SDK compat 10.7.0 (app/database/auth) | `www.gstatic.com` | bloqueado | **Remover** — substituído pelo cliente de compatibilidade |
| Firebase Auth / RTDB | `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `*.firebaseio.com` (https e wss) | bloqueado | Substituídos pelo backend |
| Google Fonts (Anton, Oswald, Barlow, Space Mono) | `fonts.googleapis.com` + `fonts.gstatic.com` — em **3 lugares**: `index.html` l. 23-25, `@import` em `styles.css` l. 5, e o documento de impressão gerado em `roteiro.js` l. 1378-1379 | bloqueado | **Hospedar localmente** (woff2 + `@font-face`) — documento 06, seção 6 |
| qrcode 1.5.1, html2pdf 0.10.2, SheetJS xlsx 0.18.5 "mini" | já locais em `forca-agil/` | ok | nada |
| `cert-template-v4.png` | local | ok | nada |
| Links de navegação (CMFlex, YouTube, etc.) | externos | podem não abrir | nada (não são dependências de execução) |

`router.js` (l. 441-545) tem um **diagnóstico de conexão** que testa os domínios do Firebase e o WebSocket `wss://kyber-agil-default-rtdb.firebaseio.com` e limpa chaves `firebase:*` do navegador — precisa ser adaptado (documento 06, seção 4.4).

---

## 7. Armazenamento no navegador (impacto da troca de domínio)

`localStorage` é **por origem**. Ao trocar `kyber-agil.web.app` por `forcaagil.previ.com.br` (por exemplo), cada pessoa começa com o armazenamento local **vazio**:

| Chave | Impacto |
|---|---|
| `fa-u-<emailKey>-fa-game-v3` (progresso do quiz) | **Recuperado** do servidor no login (`fa-progress/<emailKey>` → `faLoadProgress`) — desde que `fa-progress` seja migrado. |
| `fa_aval_<turma>_<emailKey>` (rascunho da avaliação) | Perdido (é só rascunho local). Comunicar: "terminem as avaliações pendentes antes do dia X". |
| `fa-player` | Recriado no login. |
| `firebase:*`, IndexedDB `firebaseLocalStorageDb` | Deixam de existir (sessão agora é cookie). |

---

## 8. CI/CD e operação atuais

| Workflow | Gatilho | Faz | Segredo |
|---|---|---|---|
| `firebase-deploy.yml` | push `main` | `firebase deploy --only hosting,database` | `FIREBASE_SERVICE_ACCOUNT_KYBER_AGIL` |
| `firebase-preview.yml` | push `v2` | canal de preview `v2-preview` | idem |
| `firebase-preview-v3.yml` | push `v3-quiz` | canal `v3quiz`, grava URL em `PREVIEW_URL_V3.txt` | idem + `GITHUB_TOKEN` |
| `teste-rules.yml` | PR | `teste-rules.js` no emulador do RTDB | — |
| `testes-automaticos.yml` | PR | ~28 testes Playwright com Firebase falso + suíte "Automáticos" **contra produção** | `FA_TEST_ADMIN_EMAIL/PASSWORD` |
| `audit-facilitadores-turmas.yml`, `diagnostico-execucao-vazamento-grupo.yml` | manual | relatórios só-leitura via REST | idem |
| `backfill-grupos-resumo.yml` | manual (com confirmação) | grava `grupos-resumo` faltantes | idem |

Nenhum script usa `firebase-admin`. Detalhes no anexo B4, seção 2.

---

## 9. Problemas conhecidos do código atual (herdados pela migração)

Encontrados durante a análise. **Não são causados pela migração e não devem ser corrigidos "de carona" nela** (princípio de paridade). Cada um merece um PR próprio — antes ou depois da migração, a critério da dona do repositório. Estão aqui para que ninguém os confunda com regressões da migração.

| # | Problema | Onde | Impacto |
|---|---|---|---|
| K-01 | **As telas de publicação de regras dos motores não passam o `versaoBase` do rascunho** para `publicarRegras` (a PR #243 passou só para `salvarRascunhoRegras`). Assim a base usada é a versão em cache no momento do clique, não a versão em que a edição começou: se B abriu a edição na v3 e A publicou a v4 enquanto isso, o cache de B se atualiza para v4 e a publicação de B **sobrescreve a v4 sem conflito**. Os testes da PR #243 chamaram a API direto com `versaoBase` e por isso não pegaram. | `avaliacao-produto.js` l. 2579, `avaliacao-squad.js` l. 1214 | Médio — é exatamente o cenário que a PR #243 queria bloquear. Correção de 1 linha em cada arquivo + teste de tela. **Recomenda-se corrigir antes da migração.** |
| K-02 | Motor de squad não tem `validarRegras` — configuração malformada pode ser publicada | `motor-squad.js` | Baixo |
| K-03 | Publicação do questionário não tem controle de concorrência (`novaVersao = cache + 1`); salvar rascunho e publicar correm em paralelo | `questionarios-config.js` l. 342-367; `avaliacao-produto.js` l. 2057-2058 | Baixo |
| K-04 | Publicação da regra e gravação da auditoria são duas operações (auditoria pode faltar se a segunda falhar) | `motor-*.js` `publicarRegras` | Baixo |
| K-05 | Excluir turma não apaga `avaliacoes/<turma>`, `apostas/<turma>` nem entradas de fila com origem na turma | `admin.js` l. 3250 | Baixo (órfãos) |
| K-06 | Corrigir e-mail não migra `fa-progress-historico`, `players`, `turmas/<t>/responsavelFacilitadorKey` | `admin.js` l. 5503-5611 | Baixo |
| K-07 | Critério "inscrita" inconsistente: `checkin.js`, `game.js` e partes do `admin.js` ignoram `confirmedByAdmin` | ver skill `criterio-de-estado` | Médio |
| K-08 | "Mover para turma" (lista de espera) não checa exclusividade de inscrição | `admin.js` l. 4815 | Baixo |
| K-09 | Avaliação: `nomeExibido` recebe o e-mail em vez do nome; "anonimato" é só visual (`userEmail` sempre gravado) | `avaliacao.js` l. 594, 760 | Baixo |
| K-10 | Pedidos: `nomeEnviou`/`emailEnviou` exibidos sem escape; `descricao` com escape parcial (XSS armazenado) | `pedidos.js` l. 302-304 | Médio |
| K-11 | Provável perda de `fontePrevista`/`comoSeraMedido` da etapa Evidência no modo "registrando" | `aposta.js` l. 3947-3950 (não confirmado em execução) | Baixo |
| K-12 | Comentários citam `check-motor-arquitetura-equivalencia.js`, que não existe no repositório | `motor-arquitetura.js` l. 19 | Nenhum (documentação) |
| K-13 | Chave de e-mail das regras (`replace('@','_').replace('.','_')`, às vezes sem `toLowerCase`) difere da do site (`emailKey`) para e-mails com `-`, `+` ou maiúsculas | regras vs. `auth.js` l. 28 | Baixo hoje (e-mails @previ são simples); **resolvido na migração** (backend usa só a do site) |
| K-14 | Brechas de permissão (qualquer @previ grava `turmas-interesse`, `fa-users`, `turmas-equipe`… de qualquer pessoa) | `database.rules.json` | **Alto** — ver documento 04, seção 9 (Fase B) |

---

## 10. O que isso significa para a migração (conclusões)

1. **A superfície a substituir é pequena e bem definida:** ~10 métodos de banco + ~7 de auth. Isso viabiliza o **cliente de compatibilidade** (documento 02, seção 3).
2. **As permissões são o ponto mais sensível:** o backend precisa reproduzir o `database.rules.json` com fidelidade, inclusive a matriz de `apostas` (anexo A), e ter testes para cada regra.
3. **Atomicidade importa em ~30 gravações multi-caminho e 7 transações** → MongoDB em **replica set** (transações multi-documento).
4. **Tempo real é necessário mas leve** → Socket.IO em uma instância.
5. **Os e-mails de autenticação** passam a ser responsabilidade da empresa (SMTP interno).
6. **Senhas podem ser preservadas** (exportação do hash scrypt do Firebase).
7. **Fontes precisam ser locais** e a CSP precisa ser reescrita.
8. **Os testes existentes são reaproveitáveis**: a interceptação troca de `**/firebasejs/**` para o arquivo do cliente novo (documento 09).
