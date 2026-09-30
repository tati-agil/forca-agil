# 06 — Adaptação do frontend

> Pré-requisitos: [02](02-arquitetura-alvo.md) (estratégia), [04](04-autenticacao-e-autorizacao.md) (auth), [05](05-backend-nestjs.md) (contrato da API).
> **Objetivo:** o site continuar exatamente igual para quem usa, trocando só a camada que fala com o servidor.

---

## 1. Resumo do que muda (Fase A)

| Arquivo | Mudança | Tamanho |
|---|---|---|
| `forca-agil/fa-api-client.js` | **NOVO.** Cliente de compatibilidade: expõe o objeto global `firebase` (compat) falando com `/api` e `/socket.io`. | ~800-1200 linhas |
| `forca-agil/vendor/socket.io.min.js` | **NOVO.** Cliente Socket.IO 4.x (arquivo local, sem CDN). | biblioteca |
| `forca-agil/fonts/` + `forca-agil/fonts/fonts.css` | **NOVO.** Fontes locais (Anton, Oswald, Barlow, Space Mono) em woff2. | assets |
| `index.html` | Trocar os 3 `<script>` do gstatic pelos 2 locais; trocar o `<link>` do Google Fonts pelo `fonts.css` local. | ~6 linhas |
| `forca-agil/styles.css` | Remover o `@import` do Google Fonts (l. 5). | 1 linha |
| `forca-agil/roteiro.js` | Documento de impressão (l. 1378-1379): apontar para o `fonts.css` local. | 2 linhas |
| `forca-agil/auth.js` | `register`, `criarContaPorAdmin`, `corrigirEmailPorAdmin` passam a chamar endpoints do backend (seção 4). | ~100 linhas |
| `forca-agil/router.js` | Diagnóstico de conexão e "limpar sessão" (seção 4.4). | ~60 linhas |
| `forca-agil/testes.js` | Grupo "Firebase" do painel de testes (seção 4.5). | ~20 linhas |
| **tela nova** `#conta` | Página que processa links de e-mail (verificar e-mail, redefinir senha) — seção 5. Pode ser um arquivo novo `forca-agil/conta.js` + uma `.page-section` no `index.html`. | ~200 linhas |
| `forca-agil/firebase.js` | **Nenhuma mudança obrigatória** (`initializeApp` vira no-op no cliente novo). Limpar a configuração do projeto `kyber-agil` na Fase B. | 0 |
| **todas as outras telas** (`admin.js`, `aposta.js`, `app.js`, `aluno.js`, `avaliacao*.js`, `motor-*.js`, `roteiro.js` (exceto fontes), `checkin.js`, `game.js`, `pedidos.js`, `repo.js`, `dashboard.js`, `facilitador.js`…) | **Nenhuma.** | 0 |

> Se durante a implementação aparecer a necessidade de mudar uma tela, **pare** e registre no `PROGRESSO.md` o motivo: quase sempre é sinal de que o cliente de compatibilidade não está fiel ao Firebase em algum detalhe, e o certo é corrigir o cliente, não a tela.

---

## 2. `index.html` — antes e depois

**Antes** (l. 23-25):
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@300;400;500;600;700&family=Barlow:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
```
**Depois:**
```html
<link href="forca-agil/fonts/fonts.css" rel="stylesheet" />
```

**Antes** (l. 1735-1738):
```html
<!-- Firebase SDK primeiro -->
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js"></script>
```
**Depois:**
```html
<!-- Cliente da API interna (compatível com o SDK compat do Firebase usado pelo site) -->
<script src="forca-agil/vendor/socket.io.min.js"></script>
<script src="forca-agil/fa-api-client.js"></script>
```
O resto da ordem de scripts **não muda** (`firebase.js` continua logo em seguida).

---

## 3. `forca-agil/fa-api-client.js` — especificação completa

### 3.1 Regras gerais

- JavaScript **ES2017 sem módulos** (igual ao resto do site: IIFE, sem `import`), para funcionar carregado por `<script>`.
- Expõe `window.firebase` com **só** o que o site usa (doc. 01 §3.1). Qualquer método não implementado deve **lançar erro claro** (`throw new Error('fa-api-client: X não suportado')`), nunca falhar em silêncio.
- Todas as chamadas `fetch` usam `credentials: 'same-origin'` e, nas que alteram estado, o cabeçalho `X-FA-Requested: 1`.
- Não guarda nada em `localStorage` (a sessão é o cookie `HttpOnly`).
- Referência de comportamento: [`.github/scripts/firebase-falso.js`](../../.github/scripts/firebase-falso.js). **Tudo que o falso faz, o cliente real precisa fazer igual** (é por isso que os testes passam hoje).

### 3.2 Superfície a implementar

```text
firebase.initializeApp(config)            → no-op; registra um app em firebase.apps (testes.js e router.js checam firebase.apps.length)
firebase.apps                             → array (1 item após initializeApp)
firebase.app()                            → o app registrado
firebase.database()                       → objeto Database (singleton)
firebase.database.ServerValue.TIMESTAMP   → { ".sv": "timestamp" }
firebase.auth()                           → objeto Auth (singleton)

Database.ref(caminho?)                    → Ref (sem caminho = raiz)

Ref.key                                   → último segmento (null na raiz)
Ref.child(sub)                            → Ref
Ref.push(valor?, onComplete?)             → Ref "filho" com chave nova; se valor: grava (retorna thenable)
Ref.once('value', ok?, erro?)             → Promise<Snapshot>; chama ok/erro
Ref.on('value', cb, erro?)                → devolve cb
Ref.off('value'?, cb?)                    → remove ouvinte(s) deste caminho
Ref.set(valor, onComplete?)               → Promise<void>
Ref.update(objeto, onComplete?)           → Promise<void>  (multi-caminho relativo a este ref)
Ref.remove(onComplete?)                   → Promise<void>
Ref.transaction(fn, onComplete?)          → Promise<{committed, snapshot}>
Ref.orderByChild(campo) / .equalTo(v) / .limitToFirst(n) / .limitToLast(n)   → Query (mesmos once/on/off)

Snapshot.val()                            → valor (cópia)
Snapshot.exists()                         → val() !== null
Snapshot.key                              → chave
Snapshot.forEach(fn)                      → percorre filhos (na ordem da consulta, se houver); para se fn retornar true
Snapshot.child(sub)                       → Snapshot do filho
Snapshot.numChildren() / hasChild(k)      → (implementar: baratos e comuns)

Auth.currentUser                          → User | null
Auth.onAuthStateChanged(cb)               → devolve função para cancelar
Auth.signInWithEmailAndPassword(e, s)     → Promise<{user}>
Auth.signOut()                            → Promise<void>
Auth.sendPasswordResetEmail(e)            → Promise<void>
User.email, User.emailVerified, User.uid
User.sendEmailVerification()              → Promise<void>
User.getIdToken()                         → Promise<string> (devolver "cookie" — não usado pelo site, mas evita quebra)
Auth.createUserWithEmailAndPassword, User.updateEmail   → NÃO suportados (o auth.js deixa de usá-los — seção 4)
```

### 3.3 Leitura (`once`)

```text
once('value', ok, erro):
  se Query: GET /api/db/<caminho>?orderBy=..&equalTo=..&limitToFirst=..  → {itens}
  senão:    GET /api/db/<caminho>                                         → {valor}
  sucesso → cria Snapshot, chama ok(snap), resolve a Promise
  falha   → cria Error com .code (PERMISSION_DENIED, UNAVAILABLE...), chama erro(e), rejeita a Promise
  timeout: 25 s → falha com code 'UNAVAILABLE'
```

> **Timeouts:** o SDK do Firebase, sem rede, **espera** em vez de falhar; o site tem seus próprios limites (8 s no `auth.js`, 10 s no socorro do `router.js`, 12 s em pedidos e avaliações). O timeout de 25 s do cliente só existe para garantir que a Promise sempre termina — **não** reduza abaixo de 15 s, senão ele dispara antes dos tratamentos do site.

### 3.4 Escrita (`set`/`update`/`remove`/`push`)

```text
set(v, cb)       → pares = { caminho: v }
remove(cb)       → pares = { caminho: null }
update(obj, cb)  → pares = { caminho + '/' + chave: obj[chave] } para cada chave (chave pode conter '/')
                   (na raiz: caminho = '' → pares com caminhos absolutos)
push(v, cb)      → k = gerarPushId(); ref filho = caminho/k; se v !== undefined: set(v) nele
enviar: 1 par → PUT /api/db/<c> {valor} (ou DELETE se null); vários → POST /api/db/_multi {escritas}
sucesso → (1) atualizar ouvintes afetados (seção 3.7, passo "eco local")  (2) cb(null)  (3) resolve
falha   → cb(erro) e rejeita (code como na leitura)
timeout: 30 s
```

- `update({})` (vazio) → resolve sem requisição.
- Nunca enviar `undefined`: converter para `null` antes do `JSON.stringify` (o Firebase lança erro com `undefined`; para paridade, **lançar** `Error('first argument contains undefined')` — igual ao SDK).

### 3.5 Transação

```text
transaction(fn, onComplete):
  tentativas = 0
  {valor, hash} = GET /api/db/<c>
  loop:
    tentativas++
    novo = fn(copiaProfunda(valor))
    se novo === undefined → onComplete(null, false, snap(valor)); resolve({committed:false, snapshot}); fim
    resp = POST /api/db/<c>/_transacao {valorNovo: novo, hashEsperado: hash}
    200 → eco local (3.7); onComplete(null, true, snap(resp.valor)); resolve({committed:true, snapshot}); fim
    409 → valor = resp.valor; hash = resp.hash; se tentativas >= 25 → onComplete(erro 'maxretry', false, snap(valor)); fim
          senão continua o loop
    outro erro → onComplete(erro, false, null); rejeita
```

> Detalhe importante (PR #244): `fn` pode rodar **mais de uma vez**; o código dos motores já foi escrito para isso (variáveis `alteradasReais`/`eraNoOp` refletem a última execução). Não "otimizar" para rodar uma vez só.

### 3.6 Geração de *push keys* (tem que ser idêntica ao Firebase)

Mesmo algoritmo do SDK (chaves ordenáveis por tempo, usadas por `aposta.js` para ordenar grupos/ciclos e pelo painel para ordenar listas):

```js
var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
var ultimoTempo = 0, ultimosAleatorios = [];
function gerarPushId() {
  var agora = Date.now(), duplicado = (agora === ultimoTempo);
  ultimoTempo = agora;
  var chars = new Array(8);
  for (var i = 7; i >= 0; i--) { chars[i] = PUSH_CHARS.charAt(agora % 64); agora = Math.floor(agora / 64); }
  var id = chars.join('');
  if (!duplicado) {
    for (i = 0; i < 12; i++) ultimosAleatorios[i] = Math.floor(Math.random() * 64);
  } else {
    for (i = 11; i >= 0 && ultimosAleatorios[i] === 63; i--) ultimosAleatorios[i] = 0;
    ultimosAleatorios[i]++;
  }
  for (i = 0; i < 12; i++) id += PUSH_CHARS.charAt(ultimosAleatorios[i]);
  return id;
}
```

### 3.7 Ouvintes em tempo real (`on`/`off`)

```text
on('value', cb, erro):
  registrar {id, caminho, consulta, cbs:[cb]} (vários on() no mesmo caminho+consulta compartilham a inscrição)
  1) leitura inicial: once() → cb(snap)            (o Firebase também entrega o valor inicial)
  2) socket.emit('inscrever', {id, caminho, consulta})
  3) 'inscricao-negada' → erro(e) se houver
  4) 'alterado' {ids} → para cada id: (debounce 150 ms) GET e chamar TODOS os cbs com o snap novo
     — só chamar se o hash mudou em relação ao último entregue (evita re-render à toa)
off('value', cb): remove cb; se não sobrou nenhum → socket.emit('cancelar', {id})
off() sem cb: remove todos os cbs daquele caminho
```

**Eco local (ordem igual ao Firebase):** o SDK do Firebase dispara os ouvintes **antes** de chamar o `onComplete` da escrita (eventos otimistas locais). Parte do site depende disso (ex.: o cache dos motores atualizado pelo `on('value')` antes do callback de publicação renderizar o painel; o `firebase-falso.js` também faz assim — l. 162-196). Por isso, depois de uma escrita **confirmada** pelo servidor e **antes** de chamar o `onComplete`, o cliente:
1. identifica as inscrições locais cujo caminho é ancestral/igual/descendente dos caminhos escritos;
2. faz o `GET` delas (em paralelo) e chama os `cb`;
3. só então chama o `onComplete` da escrita.

(O aviso `alterado` que chegará depois pelo socket para essas mesmas inscrições será ignorado porque o hash não mudou.)

**Reconexão:** ao reconectar o socket (queda de Wi-Fi/4G), reenviar todas as inscrições e fazer um `GET` de cada (pode ter perdido avisos). Ao trocar de usuário (login/logout), desconectar e reconectar o socket.

### 3.8 Auth compat

```text
Na carga do script:
  estado = 'desconhecido'; currentUser = null
  GET /api/auth/me  → 200: currentUser = User(resp.usuario) | 401: null
  estado = 'resolvido'; notificar TODOS os ouvintes onAuthStateChanged (assíncrono, como o Firebase)

onAuthStateChanged(cb):
  guardar cb; se estado resolvido → setTimeout(() => cb(currentUser), 0)
  devolver função de cancelamento

signInWithEmailAndPassword(email, senha):
  POST /api/auth/login → 200: currentUser = User(resp.usuario); reconectar socket; notificar ouvintes; resolve {user}
                        → erro: rejeita Error com .code = resp.erro.codigo  (auth/invalid-credential, auth/too-many-requests, auth/user-disabled)
signOut():
  POST /api/auth/logout; currentUser = null; reconectar socket; notificar ouvintes; resolve
sendPasswordResetEmail(email):   POST /api/auth/esqueci-senha {email}  → resolve (sempre)
User.sendEmailVerification():    POST /api/auth/reenviar-verificacao   → resolve | Error auth/too-many-requests

socket 'sessao-encerrada' {motivo} ou qualquer resposta 401 da API de dados:
  currentUser = null; notificar ouvintes (o auth.js/router.js já sabem o que fazer com "saiu")
```

> **Por que isso basta:** o `auth.js` registra 4 `onAuthStateChanged` e, a partir deles, lê `fa-users`, `fa-admins`, `fa-diretores`, `fa-facilitadores`, `turmas`/`turmas-interesse` pela API de dados e dispara os eventos `fa-auth-ready`, `fa-admin-ready` etc. Nada disso muda.

### 3.9 Erros — mapeamento

`Error` com propriedade `code` igual à do Firebase (o site compara `err.code`):
- dados: `PERMISSION_DENIED`, `UNAVAILABLE`, `INVALID_PATH`, `INVALID_DATA`, `maxretry` (transação);
- auth: `auth/invalid-credential`, `auth/wrong-password` (sinônimo, para o `auth.js` antigo), `auth/too-many-requests`, `auth/user-disabled`, `auth/email-already-in-use`, `auth/invalid-email`, `auth/weak-password`, `auth/user-not-found`.

---

## 4. Mudanças em arquivos existentes

### 4.1 `auth.js` — `register()` (l. 425-460)

Trocar o bloco `firebase.auth().createUserWithEmailAndPassword(...)...` por uma chamada única. **Manter** validações, mensagens e o formato do callback:

```js
fetch('/api/auth/cadastro', {
  method: 'POST', credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json', 'X-FA-Requested': '1' },
  body: JSON.stringify({ email: email, senha: pwd, nome: name, area: area, optinTurmas: !!data.optinTurmas })
})
  .then(function (r) { return r.ok ? { ok: true } : r.json().then(function (j) { return { ok: false, codigo: j.erro && j.erro.codigo }; }); })
  .then(function (res) {
    if (res.ok) return cb({ success: true, needsVerification: true });
    var msg = 'Erro ao cadastrar. Tente novamente.';
    if (res.codigo === 'auth/email-already-in-use') msg = 'E-mail já cadastrado. Faça login.';
    if (res.codigo === 'auth/weak-password')        msg = 'Senha deve conter apenas números e ter mínimo 8 dígitos.';
    if (res.codigo === 'auth/invalid-email')        msg = 'E-mail inválido.';
    cb({ error: msg });
  })
  .catch(function () { cb({ error: 'Erro ao cadastrar. Tente novamente.' }); });
```
(O backend cria credencial + `fa-users/<emailKey>` numa transação e envia o e-mail — doc. 04 §3.2.)

### 4.2 `auth.js` — `criarContaPorAdmin()` (l. 516-551) e `corrigirEmailPorAdmin()` (l. 473-514)

- `criarContaPorAdmin`: substituir o vai-e-vem (`createUser` → `set` → `signOut` → `signIn`) por `POST /api/admin/usuarios {email, nome, area, senhaAdmin}`. **Manter a assinatura** `(data, adminPwd, cb)` e as mensagens (o `admin.js` l. 6013 não muda). O `_criandoConta` deixa de ser necessário (pode ficar sempre `false`).
- `corrigirEmailPorAdmin`: substituir por `POST /api/admin/usuarios/<emailKeyAntigo>/corrigir-email {emailNovo, senhaAdmin}`. Códigos de erro que o backend devolve e a mensagem que o `auth.js` já mostra:
  - `auth/wrong-password` → "A senha desta conta não é mais a padrão (12345678)…" (mesmo texto de hoje)
  - `auth/email-already-in-use` → "Já existe uma conta com esse e-mail."
  - `auth/user-not-found` → "Não existe conta de login com o e-mail antigo."
- **Não mexer** no `moverDadosDePessoa` do `admin.js` (l. 5525-5611): ele continua movendo os dados da `emailKey` antiga para a nova com um `update()` multi-caminho — que agora vira um `POST /api/db/_multi` atômico.

### 4.3 `auth.js` — nada mais

`login`, `logout`, `sendPasswordReset`, `resendVerification` e os 4 `onAuthStateChanged` continuam como estão (o cliente de compatibilidade implementa o que eles usam).

### 4.4 `router.js` — diagnóstico e "limpar sessão"

| Trecho | Hoje | Depois |
|---|---|---|
| l. 299-308 (tempos de carga) | mede recursos de `gstatic.com` | medir `fa-api-client.js` e `/api/auth/me` |
| l. 332-335 | "Sistema iniciado" = `firebase.apps.length` | continua funcionando (o cliente registra um app); trocar o texto "não conseguiu iniciar o Firebase" por "não conseguiu iniciar o cliente da API" |
| l. 413-431 `limparArmazenamentoAuth` | apaga chaves `firebase:*`, IndexedDB `firebaseLocalStorageDb` | `POST /api/auth/logout` (apaga o cookie no servidor) + limpar `fa-player` e chaves `fa-u-*` só se a pessoa pedir |
| l. 448-492 "Testar conexão" | testa gstatic, identitytoolkit, securetoken, firebaseio (https e wss) | testar `GET /api/health`, `GET /api/auth/me`, conexão Socket.IO (conectar e desconectar); textos: "Servidor do site", "Login", "Dados do site", "Conexão em tempo real" |
| l. 488-516 textos "encaminhe à TI" com domínios | domínios do Google | domínio interno do site |
| l. 561-605 socorro de 10 s | só limpa sessão se existir chave `firebase:*` no `localStorage` | trocar a condição por "`GET /api/auth/me` respondeu, mas o `fa-auth-ready` não disparou" (sinal de que o problema é no carregamento de dados, não na sessão); o resto do fluxo (forçar login com aviso, botões "Limpar sessão" e "Testar conexão") continua |

### 4.5 `testes.js` (aba "Testes" do painel)

- Grupo `'Firebase'` (l. 11-47): renomear para `'Servidor'`; `fb-init` (`firebase.apps`) continua válido; `fb-auth`/`fb-db` continuam válidos (as funções existem no cliente); `fb-db-read` (`limitToFirst(1)` em `fa-users`) continua válido.
- l. 47 (nota sobre regras do Firebase) e os textos de `motivo` que citam "Firebase" (l. 1107-1588): atualizar redação para "servidor/banco" — **só texto**, sem mudar a lógica dos testes.

### 4.6 Fontes locais

1. Baixar (numa máquina com internet) os woff2 de **Anton 400; Oswald 300-700; Barlow 300-700; Space Mono 400, 700** (latin + latin-ext). Ferramenta sugerida: <https://gwfh.mranftl.com/fonts> ("google-webfonts-helper"), que gera os arquivos e o CSS.
2. Colocar em `forca-agil/fonts/` e criar `forca-agil/fonts/fonts.css` com os `@font-face` (`font-display: swap`).
3. Trocar os 3 lugares: `index.html` (seção 2), `styles.css` l. 5 (remover o `@import`; o `fonts.css` já é carregado pelo `index.html`), `roteiro.js` l. 1378-1379 (no HTML do documento de impressão, usar `<link href="' + location.origin + '/forca-agil/fonts/fonts.css" rel="stylesheet">`).
4. Conferir licenças (todas SIL Open Font License — uso interno permitido) e guardar o arquivo `OFL.txt` junto.

---

## 5. Tela nova `#conta` (links dos e-mails)

Hoje os links de verificação e redefinição abrem páginas do Firebase. Depois, abrem o próprio site:

- `https://<dominio>/#conta?acao=verificar&token=XYZ`
- `https://<dominio>/#conta?acao=redefinir&token=XYZ`

Implementação (arquivo `forca-agil/conta.js`, carregado antes do `init.js`; uma `<section class="page-section" id="page-conta" hidden>` no `index.html`; rota `conta` adicionada em `router.js` **como rota pública** — única que não exige sessão):

| Ação | Tela | Chamada |
|---|---|---|
| `verificar` | "Confirmando seu e-mail…" → "E-mail confirmado! Entrar" (botão abre o modal de login) ou "Link inválido ou expirado — reenviar" | `POST /api/auth/verificar-email {token}` |
| `redefinir` | Formulário "Nova senha" + "Confirmar senha" (mesma regra: só números, mín. 8) → "Senha alterada! Entrar" | `POST /api/auth/redefinir-senha {token, novaSenha}` |

Requisitos: funcionar em 375 px; mensagens em português; não expor se o e-mail existe; depois de concluir, remover o `token` da URL (`history.replaceState`).

> Atenção ao `router.js`: hoje **todas** as rotas exigem sessão (o `body.aguardando-auth` esconde tudo até o login). A rota `conta` precisa ser liberada **antes** do `fa-auth-ready` — mesmo tratamento que o `#authModal` recebe hoje (fica visível durante a espera). Teste obrigatório: abrir o link num navegador **sem sessão** e sem ficar preso na tela preta.

---

## 6. Checklist de aceite do frontend (Fase A)

- [ ] Nenhuma requisição para `gstatic.com`, `googleapis.com`, `firebaseio.com` ou `fonts.*` na aba Rede do navegador em nenhuma tela.
- [ ] Nenhuma violação de CSP no console em nenhuma tela (incluindo gerar PDF, Excel, certificado e QR Code).
- [ ] Os ~28 testes Playwright com Firebase falso passam **sem alteração de asserções**, só com o ponto de interceptação trocado (doc. 09 §3).
- [ ] Os mesmos testes passam contra o **backend real** em Docker (doc. 09 §4).
- [ ] Login, logout, cadastro, verificação, esqueci-senha, redefinição, criar conta pelo admin e corrigir e-mail funcionam em desktop e 375 px.
- [ ] Construção da Aposta: com 2 celulares e 1 computador (facilitadora), criar execução, grupos, entrar em grupo, avançar etapas e revelar — tudo aparece ao vivo como hoje.
- [ ] Removida de uma turma pelo painel → perde acesso a Conteúdos/Treinamento **sem recarregar** (ouvinte de `turmas-interesse`).
- [ ] Resetar progresso pelo painel → o navegador da pessoa limpa e recarrega (ouvinte de `fa-reset-signal`).
- [ ] Bloquear conta pelo painel → a pessoa é deslogada na hora.
