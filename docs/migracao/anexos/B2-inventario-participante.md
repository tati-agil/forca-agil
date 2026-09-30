> **Anexo B2 — inventário bruto (material de apoio).** Levantamento feito lendo o código na íntegra, no commit `c38cfe0` (merge da PR #244). Os números de linha valem para esse commit; se o arquivo mudar, localize pelo nome da função/trecho citado. Escopo: lado do participante e módulos compartilhados.
> Os documentos 01-12 já consolidam o que importa daqui; use este anexo para conferir detalhes, achar a linha exata de uma chamada ao Firebase ou checar se nada ficou de fora ao adaptar/testar uma tela.

---

# Força Ágil: inventário de uso do banco (lado do participante e módulos compartilhados)

Escopo: `forca-agil/app.js, aluno.js, avaliacao.js, checkin.js, dashboard.js, facilitador.js, game.js, game-data.js, turmas-util.js, pedidos.js, repo.js, certif.js, firebase.js, router.js, init.js, home-nav.js, conteudos-nav.js, stars.js`, as partes de `testes.js` que tocam o banco, `auth.js` da linha 640 até o fim e a ordem de scripts e as URLs externas do `index.html`. Quando uma afirmação depende de código fora desse escopo (admin.js, roteiro.js, trechos de auth.js antes da linha 640, database.rules.json), a referência aparece como **[contexto]** com o arquivo e a linha.

Convenções:
- `<eKey>` / `<uKey>` = chave do e-mail: `email.toLowerCase().replace(/[@.]/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,64)`. A mesma função está copiada em app.js:1065, aluno.js:38, avaliacao.js:65, checkin.js:7, facilitador.js:24, game.js:61 e firebase.js:87/98. **Obs.:** as regras de `avaliacoes` comparam `$userKey` com `auth.token.email.replace('@','_').replace('.','_')` (database.rules.json), sem minúsculas, sem remover caracteres e sem corte em 64. Um e-mail com hífen, `+` ou maiúscula geraria chaves diferentes no cliente e nas regras.
- "FULL" = `ref('<nó>').once/on` que lê a coleção inteira. "single" = um registro só.
- Hoje **toda leitura** abaixo passa pelas regras. Os nós de participante (`turmas-interesse`, `turmas-checkin`, `pedidos`, `fa-espera`, `fa-users`, `fa-progress`, `holocron`, `turmas-publico`, `eventos-publico`, `turmas-equipe`...) têm `.read` para qualquer usuário autenticado com e-mail que case `/.*@previ\.com\.br/`, e na maioria também `.write` nos filhos para **qualquer** usuário @previ, sem checar dono (ver §4). Só `avaliacoes` (leitura restrita a admin, escrita restrita à própria chave) e os nós de produto/squad/config têm regra mais fechada.

---

## 1. Operações no banco, arquivo por arquivo

### 1.1 `firebase.js` (inicialização + sincronização de progresso)

Config (L7-12): apiKey `AIzaSyAmnQ...`, authDomain `kyber-agil.firebaseapp.com`, databaseURL `https://kyber-agil-default-rtdb.firebaseio.com`, projectId `kyber-agil`. `firebase.initializeApp` em L16.

| Linhas | Caminho | Op | Escopo | Finalidade |
|---|---|---|---|---|
| 88 | `fa-progress/<eKey>` | `set` (sobrescreve tudo) | single | `faSyncProgress()`: copia chaves do localStorage para o servidor ("restaurar em qualquer navegador"). Chamado por game.js:169 (cada resposta do quiz, revelação, refazer) e repo.js:361 |
| 104-108 | `fa-progress/<eKey>` | `once` | single | `faLoadProgress(email)`: no login (chamado por auth.js:361 **[contexto]**), grava os valores no faStore. Se o nó não existe, **apaga** as chaves locais (L115-119) |
| 125-127 | `fa-reset-signal/<eKey>` | `on('value')` | single | Sinal de reset do admin. O 1º valor é ignorado (L128). Qualquer valor não nulo depois disso limpa as chaves de progresso e faz `location.reload()` (L129-138). O admin grava `{at: ServerValue.TIMESTAMP}` em admin.js:5641 **[contexto]** |

`faSyncPlayer` virou no-op (L144). `playerKey()`/`sanitizeKey()` (L44-49, formato legado `nome__turma`) só são usados por repo.js como `authorKey`.

### 1.2 `turmas-util.js`

| Linhas | Caminho | Op | Escopo | Finalidade |
|---|---|---|---|---|
| 317 | `turmas-interesse` | `once` | **FULL** | `listarPessoasVerComo()`: monta a lista de todas as pessoas presentes em qualquer turma, com rótulo de situação (confirmada > inscrita sem confirmação > interesse > removida) |
| 319 | `turmas` | `once` | **FULL** | rótulo da turma no mesmo seletor |

Chamado por app.js:735 e aluno.js:625, só quando `isAdmin()` é verdadeiro, **e essa checagem é só na interface**. O resto do arquivo é lógica pura: `formatDias`, `periodoCertificado` (texto do período no certificado), `formatHorario` (padrão 09:00–13:00), e os leitores de `fa-espera` que aceitam o formato antigo (`fa-espera/<e>` com os campos direto na raiz) e o novo (`fa-espera/<e>/<origem>`): `esperaEntradas/esperaAtivas/esperaNaFila` (L258-303). `origem` = `"lista"` (legado), `"lista:<eventoKey>"` (entrada direta pelo card) ou `<turmaKey>` (migrada de uma turma pelo admin).

### 1.3 `app.js` (página Turmas: vitrine, interesse, lista de espera)

| Linhas | Caminho | Op | Escopo | Finalidade |
|---|---|---|---|---|
| 290 | `turmas` | `once` | **FULL** | vitrine |
| 292 | `turmas-config` | `once` | **FULL** | flags `finalizada`, `encerrada` |
| 294 | `eventos` | `once` | **FULL** | agrupamento, textos da Missão, `publicado`, `esperaAtiva`, `restritoADiretores`, `publicoRestrito`, `formato`... |
| 335 | `turmas-publico` | `once` | **FULL** | **listas de e-mails** com permissão de ver cada turma restrita. Todo mundo baixa todas as listas; o filtro é feito no cliente (L375-382) |
| 336 | `eventos-publico` | `once` | **FULL** | o mesmo, por evento (L361-368) |
| 825 | `fa-espera/<eKey>` | `once` | single | estado do botão "Entrar na lista de espera" |
| 839 | `eventos/<ev>/publicoRestrito` | `once` | single (campo) | revalida no clique |
| 841 | `eventos-publico/<ev>/<eKey>` | `once` | single | revalida no clique |
| 855 | `fa-espera/<eKey>/lista:<eventoKey>` | `set` | single | entrar na fila |
| 872 | `fa-espera/<eKey>` | `once` | single | acha as origens ativas deste evento |
| 884 | raiz, multi-path `fa-espera/<eKey>/<origem>/{removed,removedDate,removedBySelf}` | `update` | single | sair da fila (remoção lógica) |
| 943 | `turmas-interesse/<t>/<eKey>` | `once` | single | estado do botão (interessado → "Remover interesse"; inscrito → bloqueado) |
| 964 | `turmas-config/<t>/finalizada` | `once` | single | revalida se o interesse foi encerrado |
| 992 | `eventos/<ev>/publicoRestrito`, depois `turmas/<t>/publicoRestrito` | `once` | single | revalida público restrito |
| 994 | `eventos-publico/<ev>/<eKey>`, `turmas-publico/<t>/<eKey>` | `once` | single | a pessoa está na lista? |
| 1001 | `turmas-interesse/<t>/<eKey>` | `set` (**sobrescreve o registro inteiro**, inclusive histórico de remoção anterior e campos do admin) | single | "Tenho interesse" |
| 1003 | `turmas-interesse-log/<t>/<eKey>` | `push` | append | log `action:'registrado'` |
| 1017 | `turmas-interesse/<t>/<eKey>` | `update {removed:true, removedDate, status:'removido'}` | single | "Remover interesse" |
| 1019 | `turmas-interesse-log/<t>/<eKey>` | `push` | append | log `action:'removido'` |
| 735 | via `listarPessoasVerComo` | FULL ×2 | admin | barra "Ver esta tela como" |

Cada visita a #turmas, `fa-auth-change`, `fa-diretor-ready` e `fa-admin-ready` dispara `initTurmaInterest` de novo (L1070-1088), ou seja, repete as 5 leituras FULL.

### 1.4 `aluno.js` (Minha Área)

| Linhas | Caminho | Op | Escopo | Finalidade |
|---|---|---|---|---|
| 95 | `turmas-interesse` | `once` | **FULL** | situação da pessoa em todas as turmas |
| 96 | `turmas` | `once` | **FULL** | |
| 97 | `turmas-config` | `once` | **FULL** | `encerrada`, `dataConclusao`, `finalizada` |
| 98 | `turmas-checkin` | `once` | **FULL** | **presença de todo mundo em toda turma**, usada para calcular a frequência da pessoa |
| 99 | `eventos` | `once` | **FULL** | `nome`, `cargaHoraria`, `percentualMinimo` |
| 100 | `pedidos` | `once` | **FULL** | **pedidos de todo mundo**, filtrados no cliente por `emailEnviou` (L425-428) |
| 101 | `fa-espera` | `once` | **FULL** | fila de espera de todo mundo |
| 102 | `turmas-publico` | `once` | **FULL** | listas de e-mails |
| 103 | `eventos-publico` | `once` | **FULL** | listas de e-mails |
| 123 | `avaliacoes/<tk>/<uKey>` | `once`, N leituras (uma por turma existente) | single | "já respondeu?". Um comentário explica que ler o nó inteiro vazaria respostas |
| 625 | via `listarPessoasVerComo` | FULL ×2 | admin | "Ver esta tela como" (L607-642). Re-renderiza com `uKey` de outra pessoa e lê as mesmas 9 coleções FULL |

Abrir a Minha Área custa 9 downloads de coleção inteira mais N leituras single. É um ponto óbvio para um endpoint `GET /me/area`.

### 1.5 `avaliacao.js` (Avaliação da Oficina)

| Linhas | Caminho | Op | Escopo | Finalidade |
|---|---|---|---|---|
| 601 | `avaliacoes/<t>/<uKey>` | `set` | single | envia a avaliação (reenviar sobrescreve; a interface impede, as regras não) |
| 658-659 | `eventos`, `turmas` | `once` | **FULL** | modo admin: escolher evento/turma |
| 710 | `avaliacoes/<t>/<uKey>` | `once` | single | modo admin: já respondeu o teste? |
| 766 | `turmas-interesse` | `once` | **FULL** | participante: turmas confirmadas (`status==='inscrito' && confirmedByAdmin`) |
| 781 | `turmas/<tk>` | `once` | single | `label`, `avaliacaoHabilitada` |
| 782 | `avaliacoes/<tk>/<uKey>` | `once` | single | já avaliou? |
| 827 | `turmas-interesse` | `once` | **FULL** | `checkNavVisibility()` mostra ou esconde o link do menu. Roda em `fa-auth-ready`, `fa-auth-change`, `DOMContentLoaded` e no carregamento do script (L844-848), então até 4 downloads FULL a cada carga de página, para qualquer pessoa enrolled |
| 836 | `turmas/<tk>/avaliacaoHabilitada` | `once` | single (campo) | visibilidade no menu |

### 1.6 `checkin.js` (check-in por QR)

| Linhas | Caminho | Op | Escopo | Finalidade |
|---|---|---|---|---|
| 131 | `turmas/<t>` | `once` | single | a turma existe? rótulo |
| 32 | `turmas-config/<t>` | `once` | single | `finalizada`, `diaAtivo` |
| 46 | `turmas-interesse/<t>/<eKey>` | `once` | single | exige `!removed && status==='inscrito'` (**não** exige `confirmedByAdmin`, ao contrário de auth.js:103 **[contexto]**) |
| 54 | `turmas-checkin/<t>/<diaAtivo>/<eKey>` | `once` | single | já fez check-in? |
| 61 | `turmas-checkin/<t>/<diaAtivo>/<eKey>` | `set` | single | registra presença |

### 1.7 `dashboard.js` (painel admin → Visão Geral das avaliações)

| Linhas | Caminho | Op | Escopo | Finalidade |
|---|---|---|---|---|
| 134 | `avaliacoes` | `once` | **FULL** | todas as respostas (as regras limitam a leitura a admin) |
| 135 | `turmas` | `once` | **FULL** | catálogo |
| 136 | `turmas-interesse` | `once` | **FULL** | contagem de participantes por turma |
| 137 | `eventos` | `once` | **FULL** | agrupamento por evento |

Sem escrita. Toda a agregação é feita no cliente (ver §3.8).

### 1.8 `facilitador.js` (#facilitador, "Minhas Facilitações")

| Linhas | Caminho | Op | Escopo | Finalidade |
|---|---|---|---|---|
| 55 | `turmas` | `once` | **FULL** | |
| 56 | `eventos` | `once` | **FULL** | |
| 57 | `turmas-config` | `once` | **FULL** | fase (`encerrada`) |
| 58 | `turmas-equipe` | `once` | **FULL** | todas as equipes; filtra `equipe[turma][minhaKey]` no cliente |
| 158 | `turmas-equipe/<t>` (via `faRoteiro.carregarEquipeTurma`, roteiro.js:613 **[contexto]**) | `once` | single | equipe da turma |
| 159 | via `faRoteiro.renderRoteiroTurma(..., {editable: papel==='responsavel'})` | leituras e escritas em `roteiros-evento/<ev>` e `turmas-roteiro/<t>/{customizacoes,exclusivas,facilitacao}` (roteiro.js:410-604 **[contexto]**) e `on roteiro-tipos-atividade` (roteiro.js:744) | | editar o roteiro. O papel "responsavel" só é imposto na interface. As regras deixam **qualquer** usuário @previ gravar em `turmas-roteiro/<t>` e `turmas-equipe/<t>` |

### 1.9 `game.js` (Treinamento: autodiagnóstico e patente)

| Linhas | Caminho | Op | Escopo | Finalidade |
|---|---|---|---|---|
| 90-97 | `fa-progress-historico/<eKey>/<treinoKey or '_'>/<pushId>` | `push()` + `set` | append | grava um resultado ao revelar a patente |
| 116 | `fa-progress-historico/<eKey>/<treinoKey or '_'>` | `once` | single (lista da própria pessoa) | lista "Seu histórico" |
| 169 | `fa-progress/<eKey>` (via `faSyncProgress`) | `set` | single | a cada resposta, revelação e refazer |
| 474 | `treinamentos` | `once` | **FULL** | treinamentos disponíveis |
| 478 | `treinamentos-conteudo` | `once` | **FULL** | conteúdo de treinamento criado no painel |
| 512 | `turmas-interesse` | `once` | **FULL** | quem não é admin: turmas em que a pessoa está `!removed && status==='inscrito'` (**não** checa `confirmedByAdmin`; é mais frouxo que o nível "enrolled" de auth.js) |
| 520 | `turmas` | `once` | **FULL** | turma → eventoKey |

`aplicarAcesso` roda no carregamento do script, em cada `fa-auth-change` e em cada visita a #treinamento (L660-670). Cada rodada repete as 4 leituras FULL.

### 1.10 `game-data.js`
Não acessa o banco. Guarda o catálogo estático `jedi` (20 afirmações em 4 blocos, escala Likert 0-3, patentes, missões legadas). Também exporta `window.faTreinoConteudo` (`normalizar`, `problemas`, `avisos`, L357-477), o contrato que valida `treinamentos-conteudo/<treinoKey>` e que o painel e a página compartilham.

### 1.11 `pedidos.js` (formulário na Ajuda + aba Pedidos do admin)

| Linhas | Caminho | Op | Escopo | Finalidade |
|---|---|---|---|---|
| 125-126 | `pedidos/<pushId>` | `push()` + `set` | append | participante envia pedido (timeout de 12s na interface, L117-123) |
| 199 | `fa-admins` | `once` | **FULL** | admin: lista "quem respondeu / quem está excluindo" |
| 201 | `fa-users/<superAdminKey>` (para cada e-mail em `window.faSuperAdmins`; a chave aqui é `replace(/[@.]/g,'_')`, **sem** a remoção de outros caracteres e o corte que emailKey aplica) | `once` | single | nomes dos super-admins |
| 520 | `pedidos` | `on('value')` | **FULL, tempo real** | lista do admin |
| 443 | `pedidos/<k>` | `update {tipo, tipoAnterior, tipoAlteradoEm, tipoAlteradoPor{name,email}}` | single | reenquadrar tipo |
| 477 | `pedidos/<k>` | `update {respondido:true, respondidoEm, respondidoPor{name,email}}` | single | marcar como respondido |
| 486 | `pedidos/<k>` | `update {respondido:false, respondidoEm:null, respondidoPor:null}` | single | desmarcar |
| 502 | `pedidos/<k>` | `update {excluido:true, excluidoEm, excluidoPor{name,email}, justificativaExclusao}` | single | exclusão lógica (lixeira) |
| 512 | `pedidos/<k>` | `update {excluido:false, excluidoEm:null, excluidoPor:null, justificativaExclusao:null}` | single | restaurar |

### 1.12 `repo.js` (Holocron / Repositório)

| Linhas | Caminho | Op | Escopo | Finalidade |
|---|---|---|---|---|
| 224-225 | `holocron` `.orderByChild('createdAt')` | `on('value')` | **FULL, tempo real** | grade |
| 380 | `fa-seeds-hidden` | `on('value')` | **FULL, tempo real** | recursos-semente escondidos pelo admin |
| 384 | `fa-holocron-hidden` | `on('value')` | **FULL, tempo real** | itens de usuário escondidos pelo admin |
| 325 | `holocron` | `once` | **FULL** | checagem de URL duplicada no cliente, antes do envio |
| 346 | `holocron/<pushId>` | `push(entry)` | append | enviar recurso |
| 215 | `holocron/<key>` | `remove` | single | apagar (a interface só mostra o botão para o autor ou admin, L97-101/130. As regras deixam qualquer @previ apagar qualquer item) |

### 1.13 `certif.js`
**Não acessa o banco.** Só carrega a imagem `forca-agil/cert-template-v4.png` (L104. O CLAUDE.md ainda fala em v3; `cert-template-v3.png` continua no repositório mas não é usado). Detalhes em §3.7.

### 1.14 `router.js`
Não lê nem grava nada no RTDB. Contato com a rede e com o Firebase acontece só no diagnóstico de conexão:
- L335: `firebase.auth().currentUser` (diagnóstico); L419: `firebase.auth().signOut()` (limpar sessão presa).
- L454/477-485: `fetch(no-cors)` para `https://identitytoolkit.googleapis.com/`, `https://securetoken.googleapis.com/`, `https://kyber-agil-default-rtdb.firebaseio.com/.json?shallow=true`.
- L468: `new WebSocket('wss://kyber-agil-default-rtdb.firebaseio.com/.ws?v=5')`.
- L488-492 e L516: nomes de domínio fixos no texto mostrado à pessoa ("encaminhe à TI").

### 1.15 `init.js`, `home-nav.js`, `conteudos-nav.js`, `stars.js`
Não acessam banco nem storage. init.js só mostra ou esconde `#adminGuard`/`#adminContent` conforme `isAdmin()`, em `fa-auth-ready`, `fa-auth-change` e `fa-admin-ready`. home-nav e conteudos-nav são navegação lateral por rolagem. stars.js é o canvas de estrelas (lê `document.documentElement.dataset.stars`).

### 1.16 `testes.js` (partes que tocam o banco)
- L16-26 (`fb-db-read`): `ref('fa-users').limitToFirst(1).once('value')`, teste de conectividade (limite de 1 registro).
- L1790-1799: durante a bateria de testes, troca `faSyncProgress`/`faSyncPlayer` por no-ops e restaura no fim ("impede que qualquer teste escreva no Firebase real").
- L707-760: os testes do quiz fazem backup, escrevem e restauram `fa-game-v3` (via faStore) e `fa-player` no localStorage. Com o stub de L1790, isso não chega a `fa-progress`.
- L81-84: confere se `QRCode` foi carregado do `forca-agil/qrcode.min.js` local, sem CDN.
- Não há outra chamada `firebase.database()` em testes.js.

### 1.17 `auth.js` L640 até o fim
Só interface: `updateNavState` (visibilidade de links por nível), handlers do modal, formulários de login/cadastro/esqueci a senha/reenviar verificação e a API exportada (L941-954): `corrigirEmailPorAdmin, getSession, isAdmin, isDiretor, isFacilitador, isPrevi, register, login, logout, sendPasswordReset, getAccessLevel, criarContaPorAdmin, resendVerification, isAuthReady, isAdminReady, isEnrolledReady, isFacilitadorReady, autoPreviDominio`. A única chamada Firebase nesse trecho é `firebase.auth().signOut()` em L873 (voltar do painel de verificação). O formulário de cadastro (L762-803) exige @previ.com.br e envia `{name, email, password, area, optinTurmas}`. A senha precisa ser **só números, ≥8 dígitos** (L431 **[contexto]**).
**[contexto, fora do intervalo pedido]**: `register` grava `fa-users/<eKey> = {email, name(UPPERCASE), area, optinTurmas, emailVerificationRequired:true, createdAt}` (L438-443). O perfil vem de `fa-users/<eKey>` no login. O nível enrolled vem de `once turmas` (FULL) seguido de `once`/`on` em `turmas-interesse/<t>/<eKey>` para cada turma (L130-190), com timeout de 8s (L128). Admin/diretor/facilitador vêm de `fa-admins/<eKey>`, `fa-diretores/<eKey>` e `fa-facilitadores/<eKey>` (L256/278/300), mais a lista fixa `ADMIN` de e-mails.

### 1.18 Leituras de coleção inteira (resumo, para desenho de API e exposição de dados)

| Nó | Onde é lido FULL | Quem aciona | Conteúdo sensível exposto |
|---|---|---|---|
| `turmas-interesse` | aluno.js:95, avaliacao.js:766, avaliacao.js:827, game.js:512, dashboard.js:136, turmas-util.js:317 (+ auth.js por turma **[contexto]**) | **qualquer participante** (aluno, avaliação, game); admin (dashboard, ver-como) | nome, e-mail, área, status, confirmação, motivo/destino de remoção, substituição, de todo mundo |
| `turmas-checkin` | aluno.js:98 | qualquer participante | presença por dia de todo mundo |
| `pedidos` | aluno.js:100; pedidos.js:520 (`on`) | qualquer participante (Minha Área); admin | texto livre e e-mail de todo pedido |
| `fa-espera` | aluno.js:101 | qualquer participante | fila de espera de todo mundo, com motivos |
| `turmas-publico` | app.js:335, aluno.js:102 | qualquer participante | listas de e-mails com permissão de ver turmas restritas |
| `eventos-publico` | app.js:336, aluno.js:103 | qualquer participante | listas de e-mails por evento |
| `turmas-equipe` | facilitador.js:58 | facilitador/admin | composição de todas as equipes |
| `turmas` | app.js:290, aluno.js:96, avaliacao.js:659, dashboard.js:135, facilitador.js:55, game.js:520, turmas-util.js:319 | todos | catálogo (baixa sensibilidade) |
| `turmas-config` | app.js:292, aluno.js:97, facilitador.js:57 | todos | `diaAtivo`, flags |
| `eventos` | app.js:294, aluno.js:99, avaliacao.js:658, dashboard.js:137, facilitador.js:56 | todos | catálogo, inclusive eventos não publicados e restritos a diretores (filtrados só na interface) |
| `treinamentos`, `treinamentos-conteudo` | game.js:474, 478 | todos os logados | conteúdo de todos os treinamentos, inclusive de eventos em que a pessoa não está |
| `holocron` | repo.js:224 (`on`), 325 | todos | `authorEmail`, `authorArea` de cada item |
| `fa-seeds-hidden`, `fa-holocron-hidden` | repo.js:380, 384 (`on`) | todos | flags de moderação |
| `avaliacoes` | dashboard.js:134 | só admin (as regras impõem) | todas as respostas **com `userEmail`** |
| `fa-admins` | pedidos.js:199 | admin | |
| `fa-users` | testes.js:20 (`limitToFirst(1)`) | admin (página de testes) | |

Os arquivos do escopo **não** leem FULL: `fa-progress`, `fa-progress-historico` (só o próprio), `fa-users` (fora o teste), `avaliacoes` no lado do participante (só o próprio registro).

---

## 2. Campos observados por nó (gravados pelos arquivos do escopo; os gravados pelo admin aparecem como **[admin.js]**)

### `turmas-interesse/<turmaKey>/<eKey>`
- app.js:960/1001 (set): `name, email, area, date (ISO), removed:false, status:'interessado'`
- app.js:1017 (update): `removed:true, removedDate, status:'removido'`
- **[admin.js:3834-3837, 4831-4839]** confirmar/mover: `status:'inscrito', confirmedByAdmin (e-mail do admin), confirmedByAdminName, confirmedDate, fromEspera:true` (mover da fila)
- **[admin.js:3865]** desconfirmar: `status:'interessado'`, zera `confirmedByAdmin*`, `confirmedDate`
- **[admin.js:1587-1605]** remover: `removed, removedParaTurma, removedParaTurmaLabel, removedDate, removedReason, removedMotivo, jaParticipouTurma, jaParticipouTurmaLabel, substituidaPor, substituidaPorNome, substituidaEm, substituidaPorAdmin, removedByAdmin, removedByAdminName`
- **[admin.js:4779-4790]** migrar para a fila: acima + `movedToEspera:true`
- Regra de "inscrita válida" (auth.js:103): `!removed && status==='inscrito' && confirmedByAdmin`. **Leitores inconsistentes:** checkin.js:48 e game.js:516 ignoram `confirmedByAdmin`.

### `turmas-interesse-log/<turmaKey>/<eKey>/<pushId>`
- app.js:1003/1019: `name, email, area, action ('registrado'|'removido'), date`
- **[admin.js:3848/3870]**: `action ('confirmado'|'desconfirmado'), adminName`

### `turmas-checkin/<turmaKey>/<YYYY-MM-DD>/<eKey>`
- checkin.js:61: `name, email, area, checkinAt (ISO), source:'qr'`
- **[admin.js:1905]** check-in manual: os mesmos campos com `source:'admin'`

### `turmas-config/<turmaKey>` (lido aqui; gravado pelo admin)
`finalizada` (interesse encerrado, **pré-requisito** do check-in), `encerrada` (turma concluída → certificado), `dataConclusao` (YYYY-MM-DD, vira `dataEmissao` do certificado), `diaAtivo` (YYYY-MM-DD ou null: dia de check-in aberto).

### `turmas/<turmaKey>` (lido)
`label, dias[] (YYYY-MM-DD), order, eventoKey, cmflexLink, publicoRestrito, horarioInicio, horarioFim, avaliacaoHabilitada`.

### `eventos/<eventoKey>` (lido)
`nome, order, cargaHoraria, percentualMinimo (padrão 75), missaoTitulo, missaoTexto, topicos, itinerario[], esperaAtiva, publicado, restritoADiretores, publicoRestrito, modalidadeLabel, modalidadeDesc, publicoLabel, publicoDesc, formato ('presencial'|'remoto'|'hibrido')`.

### `turmas-publico/<turmaKey>/<eKey>`, `eventos-publico/<eventoKey>/<eKey>`
Mapa de pertencimento (o valor só precisa ser truthy). Lido FULL e por chave.

### `fa-espera/<eKey>/<origem>`
- app.js:855 (entrada direta, origem `lista:<eventoKey>`): `name, email, area, date, removed:false, eventoKey`
- app.js:876-882 (sair): `removed:true, removedDate, removedBySelf:true`
- **[admin.js:4796-4808]** (migrada, origem `<turmaKey>`): `name, email, area, date (data do interesse original), migratedAt, migratedFrom, eventoKey, motivoEntrada, motivoEntradaDetalhe, migratedByName, removed:false`
- **[admin.js:4532]** remoção pelo admin: `removedByName`...
- Legado: `fa-espera/<eKey>` com os campos direto (`email, ..., migratedFrom`), aceito por turmas-util.js:287-289.

### `avaliacoes/<turmaKey>/<uKey>` (avaliacao.js:592-601)
Notas 0-10: `notaGeral, npsNota, orgGeral, conteudoRelevancia, conteudoAplicacao, facilitadoresNota, dinamicasNota, aplicacaoPreparado`; sub-itens 0-10: `orgItens{planejamento,horarios,comunicacao,clareza,estrutura,atividades}`, `facItens{clareza,dominio,duvidas,interacao,dinamicas,pratica}`; enums: `conteudoProfundidade (muito_superficial|superficial|adequado|profundo|muito_profundo)`, `dinamicasEquilibrio (muito_ruim|ruim|adequado|bom|excelente)`, `aplicacaoStatus (sim|ainda_nao|pretendo|ja_aplicava)`; arrays: `temasDesejados[], materiaisDesejados[], ferramentasDesejadas[]`; texto: `npsMotivo, conteudoGostou, conteudoAprofundar, facilitadoresGostou, dinamicasMarcou, aplicacaoPlanos, aplicacaoOque, temasOutro, materiaisEspecifico, ferramentasEspecifica, continuar, melhorar, espacoAberto`; controle: `timestamp, userEmail, turmaKey, turmaLabel, identificado (bool), nomeExibido (se identificado)`.
- **O "anonimato" é só de apresentação**: `userEmail` é gravado sempre (L594) e a chave do registro é o próprio emailKey. Só o dashboard esconde o nome (dashboard.js:428-430).
- **Bug:** `userName = session.displayName || userEmail` (L760), mas a sessão é `{email,name,area}` (auth.js:350 **[contexto]**), então `nomeExibido` sempre recebe o **e-mail**, não o nome.
- Admin respondendo "de teste" grava no mesmo nó real (L710-716) e entra na contagem do dashboard (dashboard.js:323 reconhece isso).

### `pedidos/<pushId>`
- pedidos.js:126-131: `tipo ('tema'|'curso'|'material'|'duvida'|'iniciativas'|'outros'), descricao, nomeEnviou, emailEnviou, dataEnvio`
- admin: `tipoAnterior, tipoAlteradoEm, tipoAlteradoPor{name,email}, respondido, respondidoEm, respondidoPor{name,email}, excluido, excluidoEm, excluidoPor{name,email}, justificativaExclusao`

### `holocron/<pushId>` (repo.js:307-317)
`type ('video'|'doc'|'tool'|'link'|'book'), title, url (https:// acrescentado se faltar), desc, authorName, authorEmail, authorArea, authorKey (nome__turma legado), createdAt`. **[admin.js:5585]** a correção de e-mail reescreve `authorEmail`.

### `fa-seeds-hidden/<seedKey>` = true, `fa-holocron-hidden/<pushId>` = true
seedKey = URL em minúsculas com não-alfanuméricos trocados por `_` e corte em 80 (repo.js:60-62). Gravados pelo admin (admin.js:4185-4248).

### `fa-progress/<eKey>` (firebase.js:82-88)
`updatedAt` mais, se presentes no faStore, strings brutas do localStorage com hífen trocado por underscore: `fa_game_v3` (string JSON `{<treinoKey|'_'>: {quiz:[0..3|null,...], revealed:bool}}`, ou legado `{quiz,revealed}`), `fa_patente_revealed`, `fa_patente_publicada`, `fa_content_read`, `fa_content_xp`, `fa_repo_xp`. Hoje só `fa_game_v3` e `fa_repo_xp` são gravados por código ativo. Os outros são legado que ainda é sincronizado se existir no navegador.

### `fa-progress-historico/<eKey>/<treinoKey|'_'>/<pushId>` (game.js:91-97)
`score, totalMax, rankName, rankTag, respondidoEm`. Tudo **calculado no cliente**, sem validação no servidor.

### `fa-reset-signal/<eKey>`
Escrito pelo admin com `{at: TIMESTAMP}`; lido por `on` em firebase.js:127.

### `turmas-equipe/<turmaKey>/<eKey>` (lido)
`papel ('responsavel'|'facilitador')`, mais dados da pessoa (ver roteiro.js:644 **[contexto]**).

### `treinamentos/<treinoKey>` e `treinamentos-conteudo/<treinoKey>` (lidos)
`treinamentos`: `nome, conteudoKey, eventos{<eventoKey>:true}, order`. `treinamentos-conteudo`: `{blocos:[{id,label,icon,afirmacoes[]}], levels[], ranks:[{id,name,tag,icon,sym,minDiag,maxDiag,desc,carac[],proximo[],frase}]}` (game-data.js:375-411). Arrays podem voltar do RTDB como objetos de chave numérica (`paraLista`, L366-373).

### `fa-users/<eKey>` **[contexto auth.js:438-443]**
`email, name (MAIÚSCULAS), area, optinTurmas, emailVerificationRequired, createdAt` (+ `adminApproved` e outros que admin.js grava).

---

## 3. Jornadas

### 3.1 Registrar interesse numa turma (app.js)
1. Ao abrir #turmas: FULL `turmas`, `turmas-config`, `eventos`, `turmas-publico`, `eventos-publico` (L290-336). No cliente: filtro de visibilidade (`publicado`, `restritoADiretores` via isDiretor/isAdmin, `publicoRestrito` via as listas) e estado do card pela data (`hoje > último dia` → Realizada; `hoje >= primeiro dia` → Em andamento; `finalizada` → Inscrições encerradas; senão, botão "Tenho interesse") (L384-457).
2. Para cada botão: `once turmas-interesse/<t>/<eKey>` (L943). `status==='inscrito'` → botão travado em "Inscrita". Qualquer outro registro não removido → "Remover interesse".
3. Clique (L955-1010): `once turmas-config/<t>/finalizada` → se verdadeiro, recusa. Senão `eventos/<ev>/publicoRestrito` (+ `eventos-publico/<ev>/<eKey>`) → `turmas/<t>/publicoRestrito` (+ `turmas-publico/<t>/<eKey>`) → `set turmas-interesse/<t>/<eKey> {name,email,area,date,removed:false,status:'interessado'}` → `push turmas-interesse-log/<t>/<eKey> {action:'registrado'}`.
4. A mensagem manda a pessoa ao CMFlex (`https://plataforma.intra.previ.com.br/RhUsoPessoal/InscricaoEventoTreinamento`, L1031). A inscrição oficial acontece **fora** do portal. O admin confirma depois (`status:'inscrito'` + `confirmedByAdmin`), e isso é o que concede o nível `enrolled`.
- Checagens que o backend precisa assumir: turma não finalizada/encerrada/iniciada, público restrito, não sobrescrever um registro `inscrito`/confirmado (a interface impede em L927; o `set` não), `name/email/area` vindos da sessão do servidor e não do cliente.

### 3.2 Cancelar interesse (app.js:1012-1024)
`update turmas-interesse/<t>/<eKey> {removed:true, removedDate, status:'removido'}` + `push log {action:'removido'}`. A interface bloqueia quem é `inscrito` (L927, L946-950). Só o admin pode desconfirmar. O servidor precisa garantir o mesmo.

### 3.3 Lista de espera (app.js:792-912)
- O card aparece por evento se `esperaAtiva !== false` e o evento está na vitrine.
- Estado: `once fa-espera/<eKey>` → alguma entrada ativa com `eventoKey` igual?
- Entrar: revalida `eventos/<ev>/publicoRestrito` + `eventos-publico/<ev>/<eKey>` → `set fa-espera/<eKey>/lista:<eventoKey> {name,email,area,date,removed:false,eventoKey}`.
- Sair: `once fa-espera/<eKey>` → multi-path update `removed:true, removedDate, removedBySelf:true` em cada origem ativa daquele evento.
- O admin move a pessoa da turma para a fila (admin.js:4770-4810) e da fila para uma turma (admin.js:4822+, que já grava `inscrito` confirmado e tira a pessoa das filas daquele evento).

### 3.4 Check-in por QR (checkin.js + admin.js)
- **O QR**: admin.js:3888 monta `window.location.origin + pathname + '#checkin?turma=<turmaKey>'` e desenha com `QRCode.toCanvas` (qrcode.min.js v1.5.1). É **estático**: o mesmo QR serve para todos os dias da turma. Não tem token, prazo, assinatura nem localização. aluno.js:24-28 esconde de propósito o QR da Minha Área, porque quem tiver o link pode registrar presença enquanto o dia estiver aberto.
- **Abrir o dia**: o admin grava `turmas-config/<t>/diaAtivo = 'YYYY-MM-DD'` (admin.js:1882-1893; avisa se não for hoje, mas deixa gravar) e fecha com `null` (admin.js:1896-1900).
- **Fluxo da pessoa** (checkin.js): a rota `#checkin?turma=<t>` (a key sai do hash, L11-15) → `once turmas/<t>` (existe?) → sem sessão: pede login e continua depois do `fa-auth-change` → `once turmas-config/<t>`: exige `finalizada` **e** `diaAtivo` → `once turmas-interesse/<t>/<eKey>`: exige `!removed && status==='inscrito'` (**não** exige `confirmedByAdmin`) → `once turmas-checkin/<t>/<diaAtivo>/<eKey>`: se existe, mostra "já registrada" → `set {name,email,area,checkinAt,source:'qr'}`.
- **Chave de data** = `diaAtivo` definido pelo admin, **não** a data do aparelho nem do servidor. Não há checagem de que `diaAtivo` pertence a `turmas/<t>/dias`, nem de horário.
- **Tudo é validado no cliente.** As regras deixam qualquer @previ gravar `turmas-checkin/<t>/<qualquer data>/<qualquer eKey>` e até `turmas-config/<t>/diaAtivo`. No backend: `POST /turmas/:t/checkin`, que lê `diaAtivo` no servidor, confere a inscrição confirmada e usa o timestamp do servidor.
- A frequência depois é calculada como `dias da turma com registro em turmas-checkin/<t>/<dia>/<eKey>` / `dias.length` (aluno.js:153-155).

### 3.5 Avaliação da oficina (avaliacao.js)
1. `init` espera `fa-auth-ready` e `fa-admin-ready` (L733-755).
2. Admin → seletor evento/turma (FULL `eventos`, `turmas`), podendo responder de teste no nó real.
3. Participante: FULL `turmas-interesse` → turmas com `status==='inscrito' && confirmedByAdmin` → para cada uma, `turmas/<tk>` (`avaliacaoHabilitada`, `label`) + `avaliacoes/<tk>/<uKey>` → escolhe entre pendentes e concluídas. Com várias pendentes aparece um seletor (L244-256).
4. Formulário: 13 seções, 1 a 7 obrigatórias (L47-61). Rascunho salvo automaticamente no localStorage `fa_aval_<turmaKey>_<uKey>` com debounce de 800ms (L379-413, 503-506).
5. Envio: `set avaliacoes/<t>/<uKey>` com os campos de §2 → apaga o rascunho → `init()` de novo.
6. Visibilidade no menu: FULL `turmas-interesse` + `turmas/<tk>/avaliacaoHabilitada` (L812-841).
- O backend precisa impor: pessoa confirmada na turma, `avaliacaoHabilitada`, uma resposta por pessoa e turma (ou regra de sobrescrita explícita), `userEmail` tirado da sessão. Também precisa decidir se o anonimato continua de fachada ou se passa a ser real (por exemplo, guardar a identidade separada quando `identificado=false`).

### 3.6 Autodiagnóstico e revelação da patente (game.js, firebase.js)
1. Login → `faLoadProgress` (firebase.js:96) lê `fa-progress/<eKey>`, preenche o faStore (localStorage com prefixo `fa-u-<eKey>-`) e começa a escutar `fa-reset-signal/<eKey>`.
2. #treinamento → `carregarDisponiveis` (L469-535): FULL `treinamentos` + `treinamentos-conteudo`. Admin vê tudo. Os outros: FULL `turmas-interesse` → turmas `inscrito` não removidas → FULL `turmas` → eventos → treinamentos cujo `eventos{}` intersecta e cujo conteúdo passa em `faTreinoConteudo.problemas()`. Se não existe treinamento cadastrado, entra o modo legado: conteúdo `jedi` para enrolled/admin (L625-643).
3. Responder: cada clique grava `state.quiz[i]=nível` → `save()`, que escreve `fa-game-v3` no faStore (mapa por treino) → `faSyncProgress()` faz **set em `fa-progress/<eKey>` a cada clique** (20+ escritas por rodada; no 4G isso pesa).
4. Com todas respondidas → "Revelar minha Patente" → `state.revealed=true` → `save()` → `registrarHistorico(ri)` faz push em `fa-progress-historico/<eKey>/<treino>`. Pontuação = soma dos níveis; patente = maior `RANKS[i].minDiag <= score` (L184-192). Tudo no cliente.
5. Resultado: `once fa-progress-historico/<eKey>/<treino>` → lista do histórico.
6. Refazer (L456-463): zera o estado local → save/sync. O histórico fica.
7. Reset pelo admin **[admin.js:5634-5641]**: apaga `fa-progress/<eKey>` e `fa-progress-historico/<eKey>` e grava `fa-reset-signal/<eKey>` → o `on` do cliente limpa o localStorage e recarrega.
- Na migração: o servidor recebe um blob opaco (string JSON) mais um histórico cujo score o cliente informa. Para ser confiável, o servidor recalcularia `score/rank` a partir de `quiz[]` e do conteúdo. O "sinal de reset" em tempo real precisaria virar polling ou SSE/WebSocket (ou ser checado no login e em cada carga de página).

### 3.7 Certificado (certif.js + aluno.js)
- **100% no cliente**, sem rede além do PNG do template. `draw()` desenha `cert-template-v4.png` (1448×1086) num `<canvas>` e sobrepõe 6 campos (L112-148, 269-291): `nomeParticipante, nomeEvento, identificacaoTurma, periodoTurma, cargaHoraria (+ "h"), dataEmissao ("Emitido em ...")`. Usa fontes do sistema (Georgia, Courier New), sem web font.
- PNG: canvas em 2× (2896×2172) → `toBlob` → download (L295-305). PDF: **escrito à mão, sem biblioteca** (`_canvasToPDFBlob`, L328-393): JPEG 0.93 embutido numa página de 864×648pt. **Não usa html2pdf.**
- Dados (aluno.js:560-571): `nome` = `session.name`; `evento.nome`; `turma.label`; `periodoCertificado(turma.dias)`; `evento.cargaHoraria || '20'`; `fmtDataLonga(turmas-config/<t>/dataConclusao)`.
- Elegibilidade (aluno.js:164-186, 395-405): `turmas-config/<t>/encerrada` **e** `freq >= evento.percentualMinimo (75)`, com freq calculada sobre o FULL `turmas-checkin`. O gate é só da interface: qualquer um consegue chamar `faCertif.download(...)` com dados arbitrários. O certificado não tem número, registro, QR de verificação nem assinatura. O admin emite pelo mesmo gerador (admin.js:6740-7045 **[contexto]**).
- Na migração: pode continuar no cliente. Se o objetivo é autenticidade, o backend emite um endpoint de elegibilidade e, opcionalmente, um registro verificável.

### 3.8 Agregações do dashboard (dashboard.js, só admin)
Lê FULL `avaliacoes`, `turmas`, `turmas-interesse`, `eventos` (L132-157) e calcula no cliente:
- participantes por turma = registros `!removed && status==='inscrito' && confirmedByAdmin` (L60-71);
- catálogo com turmas órfãs (avaliação de turma apagada, L80-130);
- filtro de escopo por evento e turma, com seleção múltipla (L706-875);
- `total`, `mediaGeral` (notaGeral), `mediaNps`, NPS = %≥9 − %≤6 (L164-167), %≥7, `comentarios` (tem `continuar|melhorar|espacoAberto`), `pctParticipacao = total/participantes`, distribuição em 5 faixas (L29-35), médias por turma e por evento, onde a média do evento é calculada sobre as respostas e não é média de médias (L189-217); destaques = média por seção + menções ≥8 (L219-225); contagem de temas (L227-232); os 3 `continuar` mais recentes (L234-236);
- respostas individuais com filtro por turma e por identificação; mostra "Anônimo" se `!identificado` (L427-527).
- Tudo isso cabe numa agregação do MongoDB (ou num endpoint que devolve as avaliações já com `userEmail` removido quando `!identificado`).

### 3.9 Minha Área (aluno.js)
Estados (L9-22): 1) turmas confirmadas agrupadas por fase (`encerrada` → concluída; primeiro dia no futuro → programada; senão em andamento) com frequência, certificado e avaliação; 2) interesses em análise (`!removed`, sem `inscrito+confirmedByAdmin`, status diferente de `removido`); 3) entradas ativas na fila (`esperaAtivas`, com nome do evento e turma de origem); 4) "Bem-vindo" com as turmas ainda abertas (não encerrada, não finalizada, não iniciada, visível para a pessoa); sempre 5) "Meus pedidos" (os próprios, sem os excluídos, status respondido ou em análise). Lê 9 coleções FULL + N `avaliacoes/<t>/<uKey>`. Não grava nada. "Ver como" (admin) repete tudo com a uKey de outra pessoa.

### 3.10 Página Facilitador (facilitador.js)
Espera `fa-admin-ready`. FULL `turmas`, `eventos`, `turmas-config`, `turmas-equipe` → filtra as turmas em que `turmas-equipe[t][minhaKey]` existe → agrupa por fase → "Abrir roteiro" → `faRoteiro.carregarEquipeTurma(t)` + `renderRoteiroTurma(..., {editable: papel==='responsavel'})`. As escritas do roteiro vão para `turmas-roteiro/<t>/...`. O papel responsável é imposto só na interface.

### 3.11 "Ver esta tela como" (turmas-util.listarPessoasVerComo)
Só admin (checagem de interface em app.js:774 e aluno.js:679-680). FULL `turmas-interesse` + FULL `turmas` → pessoas únicas por uKey com situações ordenadas (confirmada primeiro) → `<select>`. Em Turmas, só troca `_sess` para as regras de visibilidade. Interesse e fila continuam gravando com a sessão real (app.js:245-255, 758-762). Na Minha Área, recarrega todos os dados para a uKey escolhida. No backend: `GET /admin/pessoas` + `GET /admin/pessoas/:uKey/area`, protegidos por papel de admin.

### 3.12 Pedidos (pedidos.js)
Participante (Ajuda): escolhe o tipo, texto opcional → `push pedidos {tipo, descricao, nomeEnviou, emailEnviou, dataEnvio}` (timeout de 12s). Acompanha em Minha Área → Meus pedidos (via FULL `pedidos` + filtro no cliente). Admin: `on pedidos` em tempo real; **a resposta é um link `mailto:`** (L375-383). O sistema não envia e-mail nem guarda o texto da resposta: "respondido" é só uma marcação manual (quem respondeu, escolhido numa lista de admins, e quando, editável). Mudança de tipo registra `tipoAnterior`. Exclusão lógica com justificativa e restauração. **XSS:** L302 mostra `nomeEnviou/emailEnviou` sem escape, e L304 escapa só `&` e `<` de `descricao`.

### 3.13 Repositório / Holocron (repo.js)
- **Não há upload de arquivo.** Um item é só metadado + URL (`type, title, url, desc`). Os "arquivos" ficam fora (YouTube, sites, etc.). Os 11 recursos-semente estão fixos no código (L17-29). Hoje não existe armazenamento de arquivos (não há Firebase Storage). Se no futuro houver upload na intranet, será preciso criar armazenamento (GridFS ou sistema de arquivos/objeto).
- Enviar: botão → exige sessão → formulário → FULL `holocron` → recusa URL duplicada (normalizada: minúsculas, sem `/` final) → `push holocron {...}` → **publicado na hora** (não há fila de aprovação) → XP local `fa-repo-xp` +10 (máx. 20) se a patente ainda não foi revelada → `faSyncProgress`.
- Moderação (posterior, pelo admin, admin.js:4135-4248): esconder a semente (`fa-seeds-hidden/<seedKey>=true`), esconder o item de usuário (`fa-holocron-hidden/<key>=true`) ou apagar (`remove holocron/<key>` + limpar a flag). Autor ou admin podem apagar pela interface (repo.js:215).
- Leitura em tempo real: `on` em `holocron`, `fa-seeds-hidden`, `fa-holocron-hidden`.

---

## 4. Router e controle de acesso

### 4.1 O que o router.js faz
- Páginas (L7): `home, turmas, conteudos, treinamento, repositorio, avaliacao, minha-area, ajuda, admin, facilitador, checkin`. Hash desconhecido → `home` (L36-39). Query no hash (`#checkin?turma=...`) é ignorada para escolher a rota.
- Níveis (auth.js **[contexto]**): `member` (padrão) < `enrolled` (`isInscrito`: `!removed && status==='inscrito' && confirmedByAdmin` em alguma turma, auth.js:103) e admin (lista fixa + `fa-admins`), que sempre recebe `getAccessLevel()==='enrolled'` (auth.js:82-85). Flags ortogonais: `isFacilitador` (`fa-facilitadores`) libera #facilitador; `isDiretor` (`fa-diretores`) afeta só a vitrine (eventos `restritoADiretores`). **Não existe rota #diretor.**
- Portões:
  - `navigate()` (L41-74): #admin → exige `isAdmin` (se a lista de admins estiver pronta); #facilitador → admin ou facilitador; `conteudos|treinamento|avaliacao` → barra `member` só quando **sessão, lista de admins e inscrição** já estão resolvidas, com o aviso "Disponível após confirmação em uma turma."
  - `show()` (L87-173): as mesmas regras também para hash digitado direto, F5 e voltar, e só expulsa quem se **sabe** que não tem acesso (`isAuthReady && sessão && listas prontas && isEnrolledReady`). Usa `history.replaceState` para `#home`. Quando os dados chegam, os listeners `fa-admin-ready`, `fa-facilitador-ready` e `fa-enrolled-ready` (L622-632) refazem a decisão. Complementado por `enforceCurrentRouteAccess` em auth.js:205 **[contexto]**.
  - Os demais (`repositorio`, `minha-area`, `ajuda`, `turmas`, `checkin`) só exigem estar logado, e isso é garantido pelo portão "aguardando-auth", porque o site inteiro fica escondido sem sessão.
- **Tela preta ("aguardando-auth")**: o `<body class="aguardando-auth">` e o CSS inline (index.html:6-16) escondem tudo menos `#authModal`/`#bootStatus` até `fa-auth-ready`. Handlers: `fa-auth-ready` (L280-286) → sem sessão, `forcarLogin()` (modal que não fecha); `unverified` → painel de verificação de e-mail; senão `revelarSite()`. `fa-auth-change` (L608-613) trata também `blocked` (conta bloqueada). **Socorro de 10s** (L561-605): se a auth não resolveu, na 1ª vez por aba (flag `sessionStorage fa-sessao-limpa`) e com chave `firebase:*` no localStorage, apaga a sessão guardada (`limparArmazenamentoAuth`: `signOut`, chaves `firebase:*` no local/session storage, IndexedDB `firebaseLocalStorageDb`) e recarrega. Senão, força o login com aviso e os botões "Limpar sessão" e "Testar conexão" (diagnóstico dos domínios, WebSocket, tempos de carga, armazenamento e `window.__faErros` de head-init.js).
- Outros timeouts: `checkEnrolledStatus` responde `false` depois de 8s (auth.js:128), sem marcar a inscrição como resolvida. Pedidos: 12s (pedidos.js:118). Teste de IndexedDB: 5s (L398). Teste de conexão: 8s (L455, 473). Rolagem até âncora: 160ms (L69).
- Bloqueio global de Backspace fora de campos de texto (L197-205).

### 4.2 O que fica no cliente e o que vai para o backend
**Pode continuar no cliente (é UX):** o roteamento por hash e a troca de seções; a espera "não expulsar enquanto não sabe" (ela passa a depender de uma chamada `GET /me` que devolva sessão + `nivel` + `isAdmin/isFacilitador/isDiretor` + turmas confirmadas de uma vez, o que elimina as 3-4 leituras paralelas e os eventos `*-ready`); o socorro de 10s e o diagnóstico (reescritos para os endpoints da intranet); o rascunho da avaliação; a renderização do certificado; os filtros de vitrine como apresentação.

**O backend precisa impor (hoje só a interface impõe, e as regras deixam qualquer @previ gravar):**
1. **Autenticação**: substituir Firebase Auth (cadastro, login, verificação de e-mail, reset de senha, "criar conta pelo admin" com senha padrão 12345678, correção de e-mail pelo admin). Considerar SSO/AD da Previ. Exigir domínio e verificação no servidor. Hoje as regras não conferem `email_verified`, e a regex `/.*@previ\.com\.br/` não é ancorada no fim.
2. **Autorização por papel**: admin (lista fixa + coleção), facilitador, diretor, responsável pela turma.
3. **Propriedade dos registros**: `turmas-interesse/<t>/<eKey>` (a pessoa só mexe no próprio registro, só como `interessado`/`removido`, nunca `inscrito`/`confirmedByAdmin`; **hoje qualquer @previ consegue se autoconfirmar e ganhar `enrolled`** escrevendo esses campos), `fa-espera/<eKey>`, `turmas-checkin` (servidor valida `diaAtivo`, inscrição confirmada e horário), `avaliacoes` (as regras já restringem à própria chave; faltam inscrição e `avaliacaoHabilitada`), `pedidos` (participante só cria; flags de resposta e exclusão só admin), `holocron` (apagar só autor ou admin), `fa-progress*` (só o dono), `turmas-config/diaAtivo`, `turmas-equipe`, `turmas-roteiro` (só admin ou o responsável).
4. **Filtro de leitura**: nada de coleção inteira para participante. Endpoints `/me/*` e vitrine já filtrada no servidor (publicado, restrito a diretores, público restrito), sem mandar as listas de e-mails `turmas-publico`/`eventos-publico`.
5. **Regras de negócio** hoje duplicadas em leitores inconsistentes: definir uma única regra de "inscrita válida" (checkin.js e game.js hoje ignoram `confirmedByAdmin`); frequência e elegibilidade de certificado; pontuação e patente.
6. **Datas no servidor** (`date`, `checkinAt`, `dataEnvio`, `timestamp` hoje vêm do relógio do cliente).

---

## 5. Dependências externas em runtime (index.html) e bibliotecas locais

Ordem real dos scripts (index.html): L20 `head-init.js`; L1736-1738 Firebase SDK; L1739-1781: `firebase.js → turmas-util.js → roteiro.js → router.js → auth.js → stars.js → app.js → home-nav.js → conteudos-nav.js → repo.js → game-data.js → game.js → qrcode.min.js → certif.js → admin.js → avaliacao.js → checkin.js → manual.js → mapa.js → testes.js → pedidos.js → dashboard.js → questionarios-config.js → motor-arquitetura.js → avaliacao-produto.js → motor-squad.js → avaliacao-squad.js → aluno.js → facilitador.js → aposta.js → init.js`. (O CLAUDE.md não lista os 5 scripts de questionários/motores entre dashboard e aluno.)

| Recurso | Origem | Onde | Sem internet na intranet |
|---|---|---|---|
| Firebase JS SDK **compat 10.7.0**: `firebase-app-compat.js`, `firebase-database-compat.js`, `firebase-auth-compat.js` | `https://www.gstatic.com/firebasejs/10.7.0/` | index.html:1736-1738 | **Bloqueado.** Vai ser removido (substituído por um cliente de API REST próprio), não hospedado localmente |
| Firebase Auth (em runtime) | `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `kyber-agil.firebaseapp.com` (authDomain) | SDK; router.js:478-490 | **Bloqueado.** Substituir por auth própria ou SSO. E-mails de verificação e reset hoje saem pelo Firebase: o backend precisa de SMTP |
| Firebase RTDB | `https://` e `wss://kyber-agil-default-rtdb.firebaseio.com` | firebase.js:10; router.js:468, 484 | **Bloqueado.** Os listeners em tempo real (`on`) de repo.js, pedidos.js, firebase.js (reset-signal), roteiro.js (tipos de atividade) e auth.js (watchEnrolledStatus) precisam de polling, SSE ou WebSocket do NestJS |
| Google Fonts CSS: Anton; Oswald 300-700; Barlow 300-700; Space Mono 400/700 | `https://fonts.googleapis.com/css2?...` + arquivos em `https://fonts.gstatic.com` | index.html:23-25; **também** `@import` em styles.css:5; roteiro.js:1378-1379 (documento gerado para impressão/popup do roteiro: Anton, Oswald 400-700, Barlow 400-700) | **Bloqueado → hospedar localmente** (woff2 + `@font-face`), nos três lugares |
| QR Code **qrcode v1.5.1** (soldair/node-qrcode) | local `forca-agil/qrcode.min.js` (23,7 KB), carregado de cara | index.html:1759; usado em admin.js:3894 | Já é local |
| **html2pdf.js v0.10.2** (html2canvas + jsPDF) | local `forca-agil/html2pdf.bundle.min.js` (906 KB), sob demanda | avaliacao-produto.js:1013, avaliacao-squad.js:957 (**não** usado em certif.js) | Já é local |
| **SheetJS xlsx v0.18.5 "mini"** | local `forca-agil/xlsx.mini.min.js` (251 KB), sob demanda | avaliacao-produto.js:1189 | Já é local |
| Template do certificado | local `forca-agil/cert-template-v4.png` | certif.js:104 | Local |

Ajustes relacionados: a CSP em `firebase.json` (`script-src https://www.gstatic.com`, `connect-src *.firebaseio.com wss://*.firebaseio.com *.googleapis.com`, `font-src fonts.gstatic.com`, `style-src fonts.googleapis.com`) precisa ser reescrita para o servidor novo. As mensagens e testes do diagnóstico (router.js:441-545) citam domínios do Firebase e `forca-agil.previ.com.br`. Links externos que **não** são dependências de runtime (só navegação): CMFlex intranet (app.js:1031), sementes do repositório (YouTube, scrumguides, Udemy etc., repo.js:17-29), agilemanifesto.org e previ.com.br (index.html). Na intranet eles podem simplesmente não abrir.

---

## 6. localStorage / sessionStorage / IndexedDB relevantes

| Chave | Armazenamento | Onde | Papel e impacto na migração |
|---|---|---|---|
| `fa-u-<eKey>-<k>` (faStore) | localStorage | auth.js:400-422 **[contexto]** | prefixa por usuário as chaves de jogo. Migra chaves legadas sem prefixo (`_GAME_KEYS`) no primeiro acesso |
| `fa-game-v3` (via faStore) | localStorage | game.js:15, 141-170; firebase.js:55, 71 | **progresso do quiz**: `{<treinoKey|'_'>:{quiz[],revealed}}`, espelhado em `fa-progress/<eKey>.fa_game_v3`. Hoje é a fonte de verdade: o servidor recebe cópia. Na migração, decidir se o servidor passa a ser a fonte |
| `fa-repo-xp` (via faStore) | localStorage | repo.js:356-362; firebase.js:62, 72 | XP de contribuição (legado, máx. 20) |
| `fa-patente-revealed`, `fa-patente-publicada`, `fa-content-read`, `fa-content-xp` | localStorage | firebase.js:61, 71-72; repo.js:357 | **legado**: nenhum código ativo grava, mas ainda são sincronizados e restaurados se existirem |
| `fa-player` | localStorage | gravado em auth.js:351 `{name, area, turma:''}`, removido em 389; lido por firebase.js:42, game.js:173, repo.js:37 | cache do nome e da área. `requirePlayer()` em game.js exige `name` |
| `fa_aval_<turmaKey>_<uKey>` | localStorage | avaliacao.js:379-413 | rascunho da avaliação (pode ficar só no cliente) |
| `fa-sessao-limpa` | sessionStorage | router.js:222-224, 436, 570 | marca que o socorro de 10s já limpou a sessão nesta aba (evita laço de recarga) |
| `firebase:*`, `firebaseLocalStorage*` | localStorage/sessionStorage | router.js:418-431, 574 | sessão do Firebase Auth. Some com a migração. O socorro precisa passar a olhar o token ou cookie novo |
| `firebaseLocalStorageDb` | IndexedDB | router.js:430 | persistência do Firebase Auth. Some |
| `__fa_teste` | localStorage + IndexedDB | router.js:371-372, 393-394 | só diagnóstico |
| `window.__faErros` | memória | head-init.js:7-21 | erros capturados para o diagnóstico |

Observação: como o localStorage é por origem, **trocar de domínio** (Firebase Hosting → servidor da intranet) faz a pessoa perder `fa-game-v3`/rascunhos locais. O progresso volta de `fa-progress` só se esse nó for migrado para o MongoDB e o endpoint equivalente a `faLoadProgress` for implementado.
