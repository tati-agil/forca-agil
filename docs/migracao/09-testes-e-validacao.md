# 09 — Testes e validação: como provar que nada quebrou

> Pré-requisitos: [05](05-backend-nestjs.md), [06](06-adaptacao-do-frontend.md).
> Regra de ouro (do `CLAUDE.md`): **provar rodando, não raciocinando sobre o código** — e sempre em **desktop e celular (375 px)**, e no **caminho lento** e no **caminho que nunca responde**, não só no feliz.

---

## 1. Camadas de teste

| Camada | O que prova | Ferramenta | Onde roda |
|---|---|---|---|
| 1. Unitários do backend | funções puras: `emailKey`, `normalizarComoRtdb`, parse de caminho, mapeamento, montagem de árvore, hash canônico, predicados | Jest | `backend/` — `npm test` |
| 2. Integração do backend | API de dados, **regras** (tabela completa + porte do `teste-rules.js`), transações, auth, tempo real | Jest + Supertest + `mongodb-memory-server` (replica set) + `socket.io-client` | `backend/` — `npm run test:e2e` |
| 3. **Diferencial de regras** | para uma bateria de casos, o backend decide **igual** ao emulador do Firebase com o `database.rules.json` atual | Script Node: emulador RTDB + API | CI |
| 4. Telas com banco falso | o site continua se comportando igual (os ~28 testes Playwright atuais) | Playwright + `firebase-falso.js` | CI (já existe) |
| 5. Telas com backend real | o cliente de compatibilidade é fiel ao SDK; fluxos ponta a ponta | Playwright + `docker compose` de teste | CI / homologação |
| 6. Manual guiado | celular real, Wi-Fi da Previ, oficina simulada | Roteiro (seção 7) | Homologação |

---

## 2. Testes das regras (a parte que não pode falhar)

### 2.1 Porte do `.github/scripts/teste-rules.js`

O arquivo atual (851 linhas, 115 verificações) testa `apostas/**` no emulador com `@firebase/rules-unit-testing`. Portar **um para um** para `backend/test/regras.apostas.e2e-spec.ts`:

| No `teste-rules.js` | No teste do backend |
|---|---|
| `initializeTestEnvironment({ database: { rules } })` | subir Nest + Mongo em memória |
| `withSecurityRulesDisabled(ctx => ctx.database().ref().set(semente))` | inserir a semente direto no Mongo com a função de importação (`importar.ts` em modo biblioteca) |
| `testEnv.authenticatedContext(uid, { email })` | criar sessão para aquele e-mail (helper `loginComo(email)` que grava em `sessoes` e devolve o cookie) |
| `assertSucceeds(ref.set(v))` / `assertFails(...)` | `PUT/POST` → esperar `204` / `403` |
| `ref().update({...})` multi-caminho | `POST /api/db/_multi` → `204` / `403`, e conferir que **nada** foi gravado no caso negado |
| leituras | `GET` → `200` / `403` |

Personas (mesmas do arquivo original): admin, super-admin, facilitadora com flag **e** vínculo, facilitadora só com flag, membro da equipe sem flag, participantes confirmadas A e A2 (grupo g1), participante B (grupo g2), pessoa @previ sem vínculo, anônimo.

**Critério:** as 115 verificações passam. Nenhuma pode ser "ajustada" para passar — se divergir, é o backend que está errado.

### 2.2 Tabela das regras gerais

`backend/test/regras.gerais.e2e-spec.ts`: um `describe` por linha da tabela do doc. 04 §6, com, no mínimo:
- anônimo → 401 em leitura e escrita;
- `@previ` comum → o que a regra diz (inclusive as permissões "largas" herdadas — **paridade**);
- admin → o que a regra diz;
- super-admin → `fa-admins`;
- `avaliacoes/<t>/<outra pessoa>` → 403 para ler e gravar;
- leitura de `avaliacoes` inteiro → só admin;
- escrita multi-caminho com **um** caminho negado → 403 e nada gravado.

### 2.3 Diferencial de regras (recomendado, alto valor)

Script `tools/diferencial-regras/rodar.ts`:
1. Sobe o **emulador do RTDB** com o `database.rules.json` (como o `teste-rules.yml` já faz) e a API com Mongo em memória.
2. Aplica a **mesma semente** nos dois.
3. Para cada persona × cada caso (lista gerada a partir da tabela do doc. 04 §6 e dos caminhos reais do anexo B — leitura do nó, leitura de um registro, gravação de um campo, gravação de um registro, remoção), executa no emulador e na API.
4. Compara **decisão** (permitido/negado) e **estado final** (hash do nó).
5. Relatório: 0 divergências = aprovado.

Isso pega exatamente o tipo de erro mais provável da migração: uma regra traduzida um pouco mais frouxa ou um pouco mais rígida.

---

## 3. Testes de tela com banco falso (os que já existem)

Hoje os ~28 scripts fazem:
```js
await page.route('**/firebasejs/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
```
Depois da Fase A não existe mais `firebasejs`: o site carrega `forca-agil/fa-api-client.js` (que define o mesmo `window.firebase`). Mudança **mecânica**:

```js
// .github/scripts/lib/interceptar.js (novo helper compartilhado)
module.exports.interceptarCliente = async function (page, FALSO) {
  await page.route('**/forca-agil/fa-api-client.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**/forca-agil/vendor/socket.io.min.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '/* socket.io desligado no teste */' }));
};
```
e em cada script trocar a linha do `page.route('**/firebasejs/**', ...)` pela chamada ao helper. Cenários "SDK fora do ar" (`r.abort()` em `**/firebasejs/**`, ex.: `teste-tela-preta.js`) passam a abortar `**/forca-agil/fa-api-client.js`.

**Critério:** todos passam **sem mudar nenhuma asserção**. O `firebase-falso.js` continua sendo a referência de comportamento do cliente.

> Os testes dos motores (`teste-motor-*.js`) chamam `window.faMotorArquitetura.publicarRegras(...)` direto — continuam iguais.

---

## 4. Testes de tela com backend real (novos)

### 4.1 Pilha de teste

`infra/docker-compose.test.yml` (sobreposição): Mongo sem volume persistente, API com `NODE_ENV=test`, Mailpit, Nginx com certificado autoassinado. Subir:
```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.test.yml up -d --build --wait
node ../tools/semente-teste/semear.js    # usuários de teste (admin, facilitadora, participantes), turmas, eventos, uma Aposta
```

### 4.2 Rodar os mesmos testes contra o backend

Cada teste Playwright passa a aceitar `FA_MODO=real`:
- `FA_MODO=falso` (padrão): usa `interceptarCliente` (seção 3).
- `FA_MODO=real`: **não** intercepta o cliente; faz login de verdade (`POST /api/auth/login` via `page.request` e cookie no contexto) com o usuário semeado equivalente ao `__CFG.user`; a semente equivalente ao `__CFG.db` é aplicada por `tools/semente-teste` antes do teste.

Nem todo teste precisa rodar nos dois modos. **Obrigatórios no modo real** (cobrem o que o falso não prova):
- `teste-tela-preta.js` (auth e carregamento, desktop + celular);
- `teste-motor-concorrencia-publicacao.js` e `teste-motor-noop-atomico.js` (agora o *compare-and-swap* é do servidor);
- `teste-aposta.js` (tempo real e regras finas);
- `teste-corrigir-email.js` e `teste-editar-cadastro.js` (auth + multi-caminho grande);
- `teste-pedido-envio.js` (escrita que nunca volta);
- um teste novo de ponta a ponta de **cadastro → e-mail (Mailpit API `http://mailpit:8025/api/v1/messages`) → verificar → login**.

### 4.3 Rede lenta e "nunca responde" contra o backend real

O Playwright intercepta as requisições da API **e continua** depois de esperar — o mesmo efeito dos `delays`/`fail` do falso:
```js
await page.route('**/api/db/turmas-interesse**', async r => { await new Promise(res => setTimeout(res, 6000)); await r.continue(); }); // lento
await page.route('**/api/db/fa-users/**', r => {});                                                                             // nunca responde
await page.route('**/api/db/turmas-config**', r => r.fulfill({ status: 403, body: '{"erro":{"codigo":"PERMISSION_DENIED"}}' })); // negado
```
Para o tempo real: `page.routeWebSocket('**/socket.io/**', ...)` (Playwright ≥ 1.48) permite derrubar ou atrasar o socket.

### 4.4 Tempo real com vários "aparelhos"

Teste novo `teste-aposta-tempo-real.js`: 3 contextos Playwright (facilitadora desktop, participante A iPhone, participante B Pixel) logados com usuários diferentes; a facilitadora cria grupos → aparecem nos dois celulares em < 2 s; A entra no g1 → `qtdMembros` atualiza para B; A salva uma etapa → o Mapa projetado da facilitadora atualiza; facilitadora revela → os dois celulares mostram a revelação.

---

## 5. Suíte "Automáticos" (`run-testes-automaticos.js`) e aba Testes

Hoje roda **contra produção** (`kyber-agil`). Depois:
- Apontar para **homologação** (`FA_BASE_URL=https://forcaagil-homolog.<dominio>`), com o usuário `teste_admin@previ.com.br` recriado lá.
- `FA_TEST_MEMBER_EMAIL/PASSWORD` passam a ser configurados (hoje não são — a checagem "participante não entra no #admin" é pulada).
- Nunca rodar contra produção depois do corte (a suíte grava rascunhos locais e navega com a conta de admin).

---

## 6. `teste-consistencia-docs.js`

Lê o `database.rules.json` para listar os nós e cruzar com o código e o `mapa.js`. **Durante a Fase A o `database.rules.json` permanece no repositório** (é a fonte da verdade das permissões que o backend reproduz), então o teste continua funcionando. Na Fase B, quando as regras passarem a viver só no backend, trocar a fonte do teste para `backend/src/path-mapping/mapa-colecoes.ts`.

---

## 7. Validação manual guiada (homologação)

### 7.1 Matriz de telas × formatos

Para **cada** linha: desktop (1280 px) **e** celular (375 px, e um celular real), logado com a persona indicada. Marcar ✅ / ❌ e anotar no `PROGRESSO.md`.

| Tela / fluxo | Persona | O que conferir |
|---|---|---|
| Login, logout, "esqueci minha senha", link do e-mail | qualquer | mensagens iguais às de hoje; e-mail chega pelo SMTP interno |
| Cadastro novo + verificação | nova | e-mail chega; antes de verificar, painel de verificação aparece |
| Página Turmas: vitrine, "Tenho interesse", lista de espera | participante | card muda de estado; público restrito e "restrito a diretores" respeitados |
| Minha Área | participante confirmada | turmas, frequência, certificado (PNG e PDF), avaliação, pedidos |
| Check-in por QR | participante confirmada | ler QR com a câmera do celular → presença registrada |
| Conteúdos / Treinamento (quiz, revelar patente, histórico) | confirmada | progresso volta após trocar de navegador |
| Repositório: enviar link, moderação | participante / admin | aparece ao vivo em outra aba |
| Avaliação da oficina | confirmada | envio; rascunho local |
| Pedidos (Ajuda) + aba Pedidos | participante / admin | aparece ao vivo na aba do admin |
| Painel: Eventos/Turmas (criar, editar, confirmar, remover, mover da espera, sorteio, check-in manual, público restrito, equipe) | admin | todas as ações gravam; recarregar mostra o estado |
| Painel: Cadastrados (editar, corrigir e-mail, bloquear, resetar, criar conta, redefinir senha) | admin | pessoa bloqueada é deslogada na hora; reset limpa o navegador dela |
| Painel: Admins / Diretores / Facilitadores / Tipos de atividade / Treinamentos / Certificados / Dashboard | admin / super-admin | só super-admin gerencia admins |
| Roteiro (base e da turma) | admin / responsável / apoio | apoio vê sem editar |
| Página Facilitador | facilitadora | só as turmas da equipe dela |
| Construção da Aposta completa (seção 4.4, com aparelhos reais) | facilitadora + 2 participantes | tudo ao vivo |
| Arquitetura: avaliação de produto/squad, reprocessar, PDF, Excel, configuração dos motores (publicar, conflito, rollback), questionários | admin | igual a hoje |

### 7.2 Rede lenta

Com o Chrome DevTools em **"Slow 4G"** e depois **"Offline" no meio de uma ação**: abrir o site, logar, abrir Minha Área e o painel. Nunca pode ficar **tela preta calada**; todo botão de salvar precisa terminar em sucesso ou em mensagem de erro.

### 7.3 Ensaio de oficina (obrigatório antes do corte)

Em homologação, com **aparelhos reais na rede da Previ** (Wi-Fi da sala e 4G):
- 1 facilitadora (notebook projetado) + no mínimo 6 participantes em celulares;
- roteiro: check-in por QR → avaliação → Construção da Aposta completa (2 ciclos) → revelação;
- medir: tempo até cada grupo aparecer para as outras pessoas; nenhuma tela preta; nenhum "não disponível para o seu nível de acesso" indevido.

---

## 8. Critérios de aceite para liberar o corte

- [ ] Camada 1 e 2: 100% verde; porte do `teste-rules.js` com as 115 verificações.
- [ ] Diferencial de regras: 0 divergências.
- [ ] Camada 4: os ~28 testes com banco falso verdes (só a interceptação mudou).
- [ ] Camada 5: testes obrigatórios no modo real verdes, desktop e celular.
- [ ] Matriz manual (7.1) 100% ✅ em desktop e 375 px.
- [ ] Rede lenta (7.2) sem tela preta calada.
- [ ] Ensaio de oficina (7.3) sem incidente.
- [ ] Importação ensaiada 3× com relatório de conferência 100% igual (doc. 08).
- [ ] Restauração de backup testada (doc. 07 §8).
