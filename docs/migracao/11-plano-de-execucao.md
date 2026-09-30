# 11 — Plano de execução: roteiros de implementação

> **Este é o documento de trabalho.** Os documentos 01-10 explicam *o quê* e *por quê*; este diz *em que ordem* e *como saber que terminou*.
> Cada tarefa tem: **objetivo**, **pré-requisitos**, **passos**, **critério de aceite** (sem ele a tarefa não está pronta) e, quando útil, **não fazer**. As estimativas são para **uma pessoa desenvolvedora** com experiência média em Node/NestJS, trabalhando sem IA.

---

## 0. Como trabalhar neste plano

### 0.1 Regras

1. **Uma tarefa por vez, na ordem.** As dependências estão indicadas; não pule.
2. **Um PR por tarefa** (ou por grupo pequeno de tarefas da mesma fase), com o ID no título: `[MIG 4.3] Motor de regras: tabela geral`.
3. **Nunca** alterar comportamento do site nem regra de negócio (princípios do [README](README.md)). Se parecer necessário, **pare** e registre no `PROGRESSO.md`.
4. Até a Fase 8 (corte), a `main` continua sendo publicada no Firebase pelo GitHub Actions. **Nenhuma mudança no site pode ir para a `main` antes da Fase 6 estar completa e testada** — trabalhe as Fases 6+ num branch longo `migracao/frontend` (seção 0.3).
5. Ao terminar cada tarefa: marcar `[x]` aqui **e** registrar no `PROGRESSO.md` (data, quem, PR, desvios).

### 0.2 `docs/migracao/PROGRESSO.md` (criar na Tarefa 0.3)

```markdown
# Progresso da migração

| Tarefa | Status | Data | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|
| 0.1 | feito | 2026-10-05 | Fulana | #300 | P-01..P-12 respondidas (ver doc. 12) |
| 0.2 | em andamento | | | | |

## Decisões tomadas durante a execução
- (data) decisão, motivo, quem aprovou

## Problemas encontrados
- (data) problema, impacto, solução
```

### 0.3 Estratégia de branches

```
main  ──────────────────────────────────────────────────────────────►  (continua indo para o Firebase até o corte)
  │
  ├── migracao/infra-backend   (Fases 1-5: backend/, infra/, tools/ — não afetam o site; podem ir para a main
  │                             a qualquer momento, pois o firebase.json não publica essas pastas… ver nota)
  │
  └── migracao/frontend        (Fase 6: mudanças no site — só vai para a main NO DIA DO CORTE)
```

> **Nota importante sobre o `firebase.json`:** hoje ele publica **a raiz inteira** exceto algumas pastas. Antes de fazer merge de `backend/`, `infra/`, `tools/` na `main`, a Tarefa 1.1 adiciona essas pastas (e `docs/`) ao `ignore` do `firebase.json` — senão o código do backend seria publicado no Firebase Hosting. Essa é a **única** mudança permitida em arquivo do site antes do corte.

### 0.4 Estimativa total

| Fase | Esforço (pessoa-dia) |
|---|---|
| 0 Preparação | 2-5 (depende da TI) |
| 1 Infraestrutura | 3 |
| 2 Esqueleto do backend | 2 |
| 3 Autenticação | 5 |
| 4 API de dados + regras | 10 |
| 5 Tempo real | 3 |
| 6 Frontend | 7 |
| 7 Migração de dados | 4 |
| 8 Homologação + corte | 5 |
| 9 Pós-corte | 3 |
| **Total** | **~45 pessoa-dia** (≈ 2 a 3 meses de calendário com uma pessoa, contando esperas) |

Com IA fazendo a maior parte do código, o esforço humano cai para revisão e testes manuais, mas as esperas (TI, ensaios, oficina) continuam.

---

## Fase 0 — Preparação

### [ ] 0.1 Responder as pendências com a TI e a dona do repositório
- **Objetivo:** fechar as decisões que só a empresa pode tomar.
- **Passos:** percorrer a tabela de pendências do [doc. 12 §3](12-riscos-decisoes-e-pendencias.md#3-pendências-perguntas-para-a-ti-e-para-a-dona-do-repositório) (P-01 a P-14) e registrar as respostas nela (editar o doc. 12).
- **Aceite:** P-01, P-02, P-03, P-05, P-06, P-07 respondidas (as demais podem ficar para depois, com dono e data).

### [ ] 0.2 Corrigir o problema K-01 (antes de migrar)
- **Objetivo:** não migrar com um defeito conhecido de concorrência (doc. 01 §9, K-01).
- **Passos:** em `forca-agil/avaliacao-produto.js` (chamada `publicarRegras` ~l. 2579) e `forca-agil/avaliacao-squad.js` (~l. 1214), passar `c.versaoBase` como 4º argumento. Criar teste de tela que abre "Editar regras" (versão N), publica em outro "usuário" (N+1) e tenta publicar pelo primeiro → deve mostrar a tela de conflito.
- **Aceite:** teste novo falha sem a correção e passa com ela; suíte existente verde. PR próprio, **fora** do fluxo da migração (vai para a `main` normalmente).

### [ ] 0.3 Criar `PROGRESSO.md` e ler toda a documentação
- **Passos:** criar `docs/migracao/PROGRESSO.md` com o modelo da seção 0.2. Quem vai implementar lê os documentos 00-12 inteiros.
- **Aceite:** arquivo criado; primeira linha registrada.

### [ ] 0.4 Criar as contas de teste no Firebase (para validar a migração de senhas depois)
- **Passos:** no site atual (produção), criar: (a) uma conta pelo cadastro normal e verificá-la; (b) uma conta pelo painel "+ Criar conta para colaboradora" (senha `12345678`); (c) uma conta que fez "esqueci minha senha" e trocou a senha. Anotar e-mails e senhas num cofre.
- **Aceite:** as 3 contas entram no site atual.

---

## Fase 1 — Infraestrutura base

### [ ] 1.1 Proteger o deploy atual e preparar o repositório
- **Pré-requisitos:** 0.1.
- **Passos:**
  1. No `firebase.json`, adicionar ao array `hosting.ignore`: `"backend/**"`, `"infra/**"`, `"tools/**"`, `"docs/**"`.
  2. Criar `.dockerignore` na raiz (conteúdo no doc. 07 §7.1).
  3. Criar/atualizar `.gitignore`: `infra/.env`, `infra/certs-dev/`, `node_modules/`, `backend/dist/`, `tools/**/dist/`, `*.archive.gz`, `rtdb-*.json`, `auth-*.json`.
- **Aceite:** PR na `main`; o deploy do Firebase continua funcionando e o site em produção **não muda** (conferir que `https://kyber-agil.web.app/docs/` dá 404).

### [ ] 1.2 Preparar o servidor Linux (homolog primeiro)
- **Pré-requisitos:** P-01 (servidor), P-02 (DNS/certificado).
- **Passos:** doc. 07 §2 inteiro (Docker, usuário `forcaagil`, diretórios, firewall, certificado).
- **Aceite:** checklist do doc. 07 §11, itens 1-4.

### [ ] 1.3 Criar `infra/` com compose, Nginx e Mongo
- **Passos:** criar os arquivos do doc. 07 §3-§7 (`docker-compose*.yml`, `.env.example`, `web/Dockerfile`, `web/nginx.conf`, `web/seguranca.conf`, `mongo/*.sh`). Nesta tarefa o serviço `api` ainda não existe: comentar o bloco `api` e o `depends_on` do `web`, e trocar temporariamente o `location /api/` por `return 503;`.
- **Aceite:** `docker compose ... up -d` sobe `mongo`, `mongo-init` (sai com 0) e `web`; `rs.status()` = PRIMARY.

### [ ] 1.4 Marco: site atual servido pelo Nginx interno
- **Objetivo:** validar rede, certificado, Nginx e cabeçalhos **antes** de escrever backend.
- **Passos:** usar **temporariamente** a CSP antiga do `firebase.json` no `seguranca.conf` (o site ainda fala com o Firebase). Abrir `https://<dominio-homolog>/` num celular na rede da Previ.
- **Aceite:** o site abre e funciona **falando com o Firebase de produção** (login inclusive) — OU, se a rede interna bloquear `gstatic.com`/`firebaseio.com`, registrar isso no `PROGRESSO.md` (é mais um motivo para a migração, e o marco passa a ser "o `index.html` abre e os JS/CSS locais carregam"). Conferir cabeçalhos com `curl -skI https://<dominio>/index.html`.
- **Não fazer:** divulgar esse endereço para participantes.

### [ ] 1.5 Backup e restauração
- **Passos:** doc. 07 §8. Rodar backup manual, restaurar num banco `forcaagil_restore_teste`, conferir.
- **Aceite:** restauração testada e registrada.

---

## Fase 2 — Esqueleto do backend

### [ ] 2.1 Criar o projeto NestJS
- **Passos:**
  ```bash
  npx @nestjs/cli@11 new backend --package-manager npm --skip-git --strict
  cd backend
  npm i mongodb @nestjs/config zod nestjs-pino pino-http cookie-parser @nestjs/throttler \
        @nestjs/websockets @nestjs/platform-socket.io socket.io argon2 firebase-scrypt nodemailer
  npm i -D @types/cookie-parser @types/nodemailer mongodb-memory-server supertest @types/supertest socket.io-client
  ```
  Estrutura de pastas do doc. 05 §2 (pastas vazias com `.gitkeep` onde ainda não há código).
- **Aceite:** `npm run build`, `npm run lint`, `npm test` passam.

### [ ] 2.2 Configuração validada
- **Passos:** `src/config/config.schema.ts` com `zod` validando **todas** as variáveis do doc. 07 §4; a API **não sobe** se faltar uma obrigatória (mensagem clara).
- **Aceite:** teste unitário: sem `SESSAO_SEGREDO` → erro na inicialização.

### [ ] 2.3 Conexão MongoDB + índices + health
- **Passos:** `DatabaseModule` (MongoClient com `replicaSet`, `retryWrites`), `indices.ts` (todos os índices do doc. 03 §5 + TTL de `sessoes`/`tokens_email`), `HealthController` (doc. 05 §10), `main.ts` (doc. 05 §3), logs pino.
- **Aceite:** `GET /api/health/ready` = 200 com Mongo no ar e 503 com Mongo parado; índices criados (conferir com `db.turmas_interesse.getIndexes()`).

### [ ] 2.4 Dockerfile e integração no compose
- **Passos:** `backend/Dockerfile` e `.dockerignore` (doc. 05 §11); descomentar o serviço `api` no compose; `location /api/` volta a fazer proxy.
- **Aceite:** `https://<dominio>/api/health/ready` = 200 via Nginx em dev e homolog.

---

## Fase 3 — Autenticação

> Especificação: doc. 04, Parte I.

### [ ] 3.1 Coleções e serviço de sessão
- **Passos:** `usuarios_auth`, `sessoes`, `tokens_email` (doc. 04 §3.1); `SessaoService` (criar, validar, renovar, apagar todas do usuário); `SessaoMiddleware`; cookie (doc. 04 §3.3); `CsrfGuard` (cabeçalho `X-FA-Requested` + `Origin`).
- **Aceite:** testes e2e: cookie emitido com `HttpOnly; Secure; SameSite=Lax`; requisição de escrita sem o cabeçalho → 403; sessão expirada → 401.

### [ ] 3.2 Senhas (argon2id + fallback do Firebase)
- **Passos:** `SenhaService.gerarHash`, `verificar(usuario, senha)`: se `senhaHash` → argon2; senão se `firebaseHash` → `firebase-scrypt` com os 4 parâmetros do `.env`; em caso de sucesso, regravar argon2id e apagar `firebaseHash`.
- **Aceite:** teste unitário com um **vetor de teste do Firebase** (gerar criando uma conta num projeto Firebase de teste, exportando com `auth:export` e usando os parâmetros daquele projeto) → senha correta aceita, errada recusada, e após o primeiro sucesso o documento tem `senhaHash` e não tem `firebaseHash`.

### [ ] 3.3 Endpoints `/api/auth/*`
- **Passos:** todos da tabela do doc. 04 §3.2 com os códigos de erro `auth/*`; rate limit (doc. 04 §3.6); sessão restrita para não verificados; checagem de `fa_users.<k>.blocked` no login.
- **Aceite:** e2e para cada endpoint, incluindo: cadastro com senha `abc12345` → `auth/weak-password`; e-mail `@gmail.com` → recusado; 11 logins errados → `auth/too-many-requests`; conta bloqueada → `auth/user-disabled`.

### [ ] 3.4 E-mails
- **Passos:** `MailService` (nodemailer), templates (copiar textos dos templates atuais do Firebase Console → Authentication → Templates), links `#conta?acao=…` (doc. 04 §3.5). Em dev/test, SMTP = Mailpit.
- **Aceite:** e2e: cadastro gera e-mail no Mailpit (API `GET /api/v1/messages`) com link válido; token usado duas vezes → `auth/invalid-action-code`.

### [ ] 3.5 Endpoints administrativos `/api/admin/usuarios/*`
- **Passos:** criar conta (senha padrão `12345678`, `adminApproved`, `createdByAdmin`), corrigir e-mail (com as travas do doc. 04 §3.2), disparar redefinição. `AdminGuard`.
- **Aceite:** e2e: não-admin → 403; corrigir e-mail de conta que já trocou a senha → `auth/wrong-password`; corrigir o próprio e-mail → recusado; conta criada consegue logar com `12345678`.

### [ ] 3.6 Decisão: exigir a senha da admin nos endpoints administrativos?
- Hoje o painel pede a senha da admin (efeito colateral do vai-e-vem de login). Decidir com a dona do repositório (P-13) se o backend continua exigindo `senhaAdmin` (mais seguro) ou não (mais simples). Registrar em `PROGRESSO.md`. **Default: exigir** (a tela já pede; nada muda para quem usa).

---

## Fase 4 — API de dados e regras

> Especificação: doc. 03 (mapeamento), doc. 04 Parte II (regras), doc. 05 §4-§6.

### [ ] 4.1 Mapeamento de caminhos + normalização RTDB
- **Passos:** `mapa-colecoes.ts` (tabela do doc. 03 §5 **completa**), `caminho.ts` (parse/validação, resolução documento + subcaminho), `normalizar-rtdb.ts` (doc. 03 §4), `arvore.ts` (montar árvore a partir de vários documentos), hash canônico.
- **Aceite:** testes unitários para: cada nó da tabela resolve para a coleção/profundidade certa; `normalizar({a:null,b:{},c:[1,null]})` → `{c:[1]}`; montar árvore de `turmas_checkin` com 3 níveis reproduz o JSON original.

### [ ] 4.2 `DataService`: ler, escrever pares, `_multi`, consultas
- **Passos:** doc. 03 §6 e doc. 05 §4, **sem regras ainda** (tudo permitido para admin de teste, atrás de um *flag* só de teste). Transação MongoDB envolvendo todos os pares; apagar documentos que ficaram vazios; `_rev`, `_em`, `_por`; `ServerValue`.
- **Aceite:** e2e reproduzindo os exemplos do doc. 03 §6.3 (confirmar participante, excluir turma, semear tipos, check-in, entrar em grupo) e conferindo o estado no Mongo; um `_multi` com um caminho inválido não grava nada.

### [ ] 4.3 Motor de regras — tabela geral
- **Passos:** `predicados.ts` (doc. 04 §5), `leitor-banco.ts` (antes/depois com overlay), `rules.service.ts` (doc. 05 §5), `regras.gerais.ts` (doc. 04 §6 inteira). Remover o flag da 4.2.
- **Aceite:** `test/regras.gerais.e2e-spec.ts` (doc. 09 §2.2) 100% verde.

### [ ] 4.4 Motor de regras — `apostas`
- **Passos:** `regras.apostas.ts` a partir do [anexo A](anexos/A-apostas-regras.md), linha por linha.
- **Aceite:** porte do `teste-rules.js` (doc. 09 §2.1) com **as 115 verificações** verdes.

### [ ] 4.5 Transações (compare-and-swap)
- **Passos:** `POST /api/db/<c>/_transacao` (doc. 05 §6), comparação por hash canônico dentro de transação MongoDB; 409 devolvendo valor e hash atuais.
- **Aceite:** e2e: duas requisições concorrentes com o mesmo `hashEsperado` → exatamente uma 200 e uma 409; transação acima da profundidade do documento → 400.

### [ ] 4.6 Diferencial de regras contra o emulador
- **Passos:** `tools/diferencial-regras/` (doc. 09 §2.3).
- **Aceite:** 0 divergências. Qualquer divergência vira correção no backend (não no teste).

---

## Fase 5 — Tempo real

### [ ] 5.1 Gateway Socket.IO + barramento
- **Passos:** doc. 05 §7 (autenticação no handshake por cookie, `inscrever`/`cancelar`/`alterado`, checagem de leitura na inscrição, casamento ancestral/descendente, sala `usuario:<k>`).
- **Aceite:** e2e com `socket.io-client`: escrita em `apostas/t1/execucoes/e1/grupos/g2/dados/x` avisa inscrição em `…/e1` e em `…/grupos/g2`, **não** avisa `…/grupos/g3`; inscrição num caminho sem permissão → `inscricao-negada`.

### [ ] 5.2 Efeitos de escrita
- **Passos:** doc. 05 §8 (bloqueio derruba sessões e avisa pelo socket).
- **Aceite:** e2e: admin grava `fa-users/<k>/blocked = true` → a sessão de `<k>` passa a receber 401 e o socket dela recebe `sessao-encerrada`.

---

## Fase 6 — Frontend (branch `migracao/frontend`)

> Especificação: doc. 06.

### [ ] 6.1 `fa-api-client.js` — banco
- **Passos:** doc. 06 §3.1-§3.7 (sem auth ainda: usar um cookie de sessão obtido por `curl` para testar manualmente). Incluir `vendor/socket.io.min.js` (baixar a versão igual à do servidor).
- **Aceite:** abrir o site em dev com o cliente novo e um usuário admin logado manualmente: painel carrega, grava e relê.

### [ ] 6.2 `fa-api-client.js` — auth
- **Passos:** doc. 06 §3.8-§3.9.
- **Aceite:** login/logout/esqueci-senha funcionam pela tela atual sem mudar o `auth.js`.

### [ ] 6.3 `index.html`, fontes locais, CSP
- **Passos:** doc. 06 §2 e §4.6; `seguranca.conf` com a CSP nova (doc. 07 §7.3).
- **Aceite:** checklist do doc. 06 §6, itens 1 e 2.

### [ ] 6.4 `auth.js` (cadastro, criar conta, corrigir e-mail)
- **Passos:** doc. 06 §4.1-§4.2.
- **Aceite:** os três fluxos funcionam em desktop e 375 px; mensagens iguais às atuais.

### [ ] 6.5 `router.js` e `testes.js`
- **Passos:** doc. 06 §4.4-§4.5.
- **Aceite:** "Testar conexão" mostra os 4 itens novos; socorro de 10 s testado com a API parada (não fica tela preta calada).

### [ ] 6.6 Tela `#conta`
- **Passos:** doc. 06 §5.
- **Aceite:** link de verificação e de redefinição abertos num navegador **sem sessão** funcionam em 375 px.

### [ ] 6.7 Testes Playwright: nova interceptação
- **Passos:** doc. 09 §3 (helper `interceptarCliente` e troca nos ~28 scripts).
- **Aceite:** todos verdes sem mudar asserções.

### [ ] 6.8 Testes Playwright no modo real + tempo real com 3 aparelhos
- **Passos:** doc. 09 §4 (compose de teste, semente, `FA_MODO=real`, `teste-aposta-tempo-real.js`).
- **Aceite:** lista obrigatória do doc. 09 §4.2 verde, desktop e celular.

---

## Fase 7 — Migração de dados

> Especificação: doc. 08.

### [ ] 7.1 `importar.ts` + `conferir.ts`
- **Aceite:** com um JSON de teste (gerado a partir da semente), importação + conferência 100% igual; rodar duas vezes dá o mesmo resultado.

### [ ] 7.2 Primeira exportação real e importação em homolog
- **Pré-requisitos:** P-03 (acesso Owner), 7.1.
- **Aceite:** relatório de conferência 100% igual; as 3 contas de teste (0.4) entram em homolog **com a mesma senha**.

### [ ] 7.3 Validação manual em homolog com dados reais
- **Passos:** matriz do doc. 09 §7.1 inteira.
- **Aceite:** 100% ✅.

### [ ] 7.4 Segundo e terceiro ensaio de importação
- **Aceite:** tempos medidos e registrados; roteiro do dia do corte (Fase 8) ajustado com os tempos reais.

### [ ] 7.5 `exportar-para-rtdb.ts` (plano de volta)
- **Aceite:** Mongo → JSON → importado de volta (com `importar.ts`) numa base limpa → conferência 100% igual (ida e volta sem perda).

### [ ] 7.6 Ensaio do plano de volta num projeto Firebase de teste
- **Aceite:** `database:set` do JSON num projeto de teste; site antigo apontado para esse projeto mostra os dados.

---

## Fase 8 — Homologação final e corte

### [ ] 8.1 Ensaio de oficina
- **Passos:** doc. 09 §7.3.
- **Aceite:** sem incidentes; tempos registrados.

### [ ] 8.2 Critérios de liberação
- **Aceite:** todos os itens do doc. 09 §8 marcados; aprovação escrita da dona do repositório no `PROGRESSO.md`.

### [ ] 8.3 Comunicação
- **Passos:** 1 semana antes: e-mail/aviso às pessoas cadastradas com data, janela e novo endereço ("seu login e seus dados continuam os mesmos"; "terminem avaliações pendentes"). No dia: aviso de início e de fim.

### [ ] 8.4 Dia do corte — roteiro

| Hora | Passo | Responsável | Feito |
|---|---|---|---|
| T-60 | Conferir: servidor prod saudável, backup recente, imagens da versão aprovada no registro, `.env` de prod conferido | infra | [ ] |
| T-30 | Deploy da versão aprovada em prod com banco **vazio** (API cria índices) | infra | [ ] |
| T-0 | Congelar Firebase (regras somente leitura) — doc. 08 §6.3 | dev | [ ] |
| T+5 | Página de manutenção no Firebase Hosting — doc. 08 §6.4 | dev | [ ] |
| T+10 | Exportar RTDB + Auth; `sha256sum` | dev | [ ] |
| T+20 | Importar em prod; conferir (hashes 100% iguais) | dev | [ ] |
| T+40 | Merge de `migracao/frontend` na `main` **com o `firebase-deploy.yml` desativado no mesmo PR** (doc. 10 §6); deploy da imagem `web` com o site novo | dev + infra | [ ] |
| T+50 | Teste de fumaça em prod: 3 contas de teste + 1 participante voluntária; cada tela principal no celular | dev | [ ] |
| T+70 | Trocar página de manutenção do Firebase por redirecionamento | dev | [ ] |
| T+75 | Comunicar "no ar" | dona do repositório | [ ] |
| T+75 → D+1 | Monitorar logs (`docker compose logs -f api`) e `/api/health/ready` | infra | [ ] |

**Critério para abortar (antes do T+70):** conferência de dados diferente, ou login das contas de teste falhando, ou qualquer tela principal quebrada no celular → executar doc. 08 §6.5.

**Critério para voltar ao Firebase (depois de liberado, até D+30):** perda de dado, falha de segurança, ou indisponibilidade que impeça uma oficina e não possa ser corrigida em 24 h → doc. 08 §5 (exportar-para-rtdb) + republicar regras e site no Firebase + comunicar.

---

## Fase 9 — Pós-corte

### [ ] 9.1 CI/CD interno definitivo
- **Passos:** doc. 10 §2-§4 (runner, `deploy-interno.yml`, `deploy.sh`, `rollback.sh`, ambientes com aprovação).
- **Aceite:** um PR de teste trivial passa pelo pipeline e chega a prod com aprovação.

### [ ] 9.2 Desligar workflows do Firebase e portar scripts de operação
- **Passos:** doc. 10 §5-§6.
- **Aceite:** nenhum workflow do Firebase dispara em push; scripts `tools/ops/*` rodam contra o Mongo.

### [ ] 9.3 Monitoramento e alertas
- **Passos:** doc. 07 §9 (health a cada 1 min, alerta) e alerta de tamanho de documento de `apostas` (doc. 03 §8).
- **Aceite:** derrubar a API em homolog gera alerta em ≤ 3 min.

### [ ] 9.4 Atualizar a documentação viva do site e do repositório
- **Passos:**
  - `CLAUDE.md` (raiz): seções "What this is", "Architecture", "Data layer", "Deploy" → descrever backend/infra novos; **manter** os "Working agreements".
  - `.claude/skills/*` (`criterio-de-estado`, `docs-internas`, `editar-e-salvar`, `pre-publicacao`): trocar referências a `database.rules.json`/Firebase pelas regras do backend (`backend/src/rules/*`) e pelo novo ponto de interceptação dos testes — detalhes no anexo B4 §2.6.
  - `forca-agil/mapa.js` e `forca-agil/manual.js`: seção de tecnologias ("Firebase Authentication/Realtime Database/Hosting") → "Servidor interno: Nginx + API NestJS + MongoDB"; seguir a skill `docs-internas`.
  - `teste-consistencia-docs.js`: manter lendo `database.rules.json` enquanto ele existir (doc. 09 §6).
- **Aceite:** `teste-consistencia-docs.js` verde; nenhuma página interna do site afirma que o banco é o Firebase.

### [ ] 9.5 Dia 30 — decisão sobre o projeto Firebase
- **Passos:** doc. 08 §7. Exportar uma última cópia; decidir com a dona do repositório e a TI se o projeto `kyber-agil` é desativado.

---

## Fase 10 — Encerramento e Fase B

### [ ] 10.1 Retrospectiva e backlog da Fase B
- Criar issues para: brechas B-1..B-6 (doc. 04 §9), endpoints de domínio (doc. 05 §14), problemas K-02..K-13 (doc. 01 §9), SSO (doc. 04 §3.7), ID estável de pessoa (doc. 03 §11), validação de esquema (doc. 03 §10).

### [ ] 10.2 Teste de restauração mensal agendado
- **Aceite:** evento recorrente na agenda da equipe de infra.

---

## Apêndice — Prompts prontos para a IA da empresa

Use um prompt por tarefa. Sempre inclua o contexto fixo abaixo e troque `<ID>`.

**Contexto fixo (colar no início de toda sessão):**
```
Você está implementando a migração do projeto Força Ágil (Firebase → NestJS + MongoDB + Docker)
seguindo a documentação em docs/migracao/. Regras:
1. Leia docs/migracao/README.md e o documento indicado pela tarefa antes de escrever código.
2. Trabalhe SOMENTE na tarefa indicada. Não altere regras de negócio nem telas do site fora do que a tarefa manda.
3. Siga exatamente os contratos (caminhos, códigos de erro, nomes de coleção) da documentação.
   Se a documentação estiver errada ou incompleta, PARE e explique — não improvise.
4. Todo código novo vem com testes; a tarefa só termina quando o "critério de aceite" for cumprido e demonstrado.
5. Ao final: atualize docs/migracao/PROGRESSO.md e marque [x] na tarefa em docs/migracao/11-plano-de-execucao.md.
```

**Tarefa:**
```
Execute a tarefa <ID> de docs/migracao/11-plano-de-execucao.md.
Documentos de referência: <ex.: 03-modelo-de-dados-mongodb.md §5-§6, 05-backend-nestjs.md §4>.
Mostre, ao final, a saída dos testes que comprovam o critério de aceite.
```

**Para retomar depois de uma interrupção:**
```
Leia docs/migracao/PROGRESSO.md e o plano em docs/migracao/11-plano-de-execucao.md.
Identifique a primeira tarefa não concluída, verifique no código o que dela já foi feito,
e continue a partir daí. Antes de começar, rode os testes existentes e informe o estado.
```
