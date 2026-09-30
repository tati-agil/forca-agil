# Migração da Força Ágil: Firebase → infraestrutura interna (Linux + Docker + NestJS + MongoDB)

> **Status deste documento:** planejamento. **Nenhuma linha de código do site foi alterada** para produzir esta documentação.
> O site continua funcionando exatamente como hoje (Firebase Hosting + Realtime Database + Authentication, projeto `kyber-agil`), e continua sendo publicado pelo GitHub Actions até o dia do corte descrito em [11-plano-de-execucao.md](11-plano-de-execucao.md).

Esta pasta contém **tudo o que é preciso para migrar** a Força Ágil para um servidor Linux da empresa, com:

| Camada | Hoje (Firebase) | Depois (interno) |
|---|---|---|
| Arquivos do site (HTML/JS/CSS) | Firebase Hosting (CDN do Google) | **Nginx** em container Docker, no servidor Linux da empresa |
| Banco de dados | Firebase **Realtime Database** (árvore JSON, acessada direto do navegador) | **MongoDB 7** (replica set de 1 nó, em container) |
| Regras de acesso ao banco | `database.rules.json` (avaliadas pelo Firebase) | **Backend NestJS** (guards + motor de regras em TypeScript) |
| Login / cadastro / e-mails | Firebase **Authentication** (e-mail + senha, e-mails enviados pelo Google) | **Backend NestJS** (módulo de autenticação próprio, senha com argon2id, sessão por cookie, e-mail pelo **SMTP interno**) |
| Tempo real (telas que se atualizam sozinhas) | WebSocket do Firebase (`.on('value')`) | **Socket.IO** no backend NestJS |
| Deploy | GitHub Actions → `firebase deploy` | Pipeline interno (ou manual) → `docker compose` no servidor |

---

## Para quem é esta documentação

1. **A IA de desenvolvimento da empresa** (que vai receber este repositório e executar a implementação).
2. **A pessoa desenvolvedora** que vai continuar a implementação **manualmente** quando os créditos da IA acabarem.

Por isso **tudo foi escrito para ser seguido passo a passo, sem depender de contexto que não esteja aqui**: cada roteiro diz *o que fazer*, *em quais arquivos*, *com quais comandos*, *como saber que terminou* (critério de aceite) e *o que não pode quebrar*.

---

## Ordem de leitura (obrigatória antes de começar)

| # | Documento | Para que serve | Quem precisa ler |
|---|---|---|---|
| 0 | **Este README** | Visão geral, princípios, glossário | Todos |
| 1 | [01-diagnostico-sistema-atual.md](01-diagnostico-sistema-atual.md) | Como o sistema funciona **hoje**: cada uso do Firebase, cada nó do banco, cada regra, cada dependência externa | Todos — é a "fotografia" do que precisa continuar funcionando |
| 2 | [02-arquitetura-alvo.md](02-arquitetura-alvo.md) | Como o sistema vai funcionar **depois**, e **por que** cada decisão foi tomada (NestJS é viável? sim — e o porquê) | Todos |
| 3 | [03-modelo-de-dados-mongodb.md](03-modelo-de-dados-mongodb.md) | Mapeamento nó do Firebase → coleção do MongoDB, formato dos documentos, índices | Backend, migração de dados |
| 4 | [04-autenticacao-e-autorizacao.md](04-autenticacao-e-autorizacao.md) | Login, cadastro, e-mails, sessões, papéis, e a tradução de **cada regra** do `database.rules.json` | Backend, segurança |
| 5 | [05-backend-nestjs.md](05-backend-nestjs.md) | Estrutura do projeto NestJS, módulos, endpoints, contrato da API, tempo real, transações | Backend |
| 6 | [06-adaptacao-do-frontend.md](06-adaptacao-do-frontend.md) | O que muda no site (pouca coisa, por design): cliente de compatibilidade, `auth.js`, CSP, fontes | Frontend |
| 7 | [07-infraestrutura-docker.md](07-infraestrutura-docker.md) | Dockerfiles, `docker-compose`, Nginx, MongoDB, backups, preparação do servidor Linux | Infra / DevOps |
| 8 | [08-migracao-de-dados.md](08-migracao-de-dados.md) | Exportar tudo do Firebase (dados **e** usuários com senha), transformar, importar, conferir | Backend, migração |
| 9 | [09-testes-e-validacao.md](09-testes-e-validacao.md) | Como provar que nada quebrou: testes de regras, testes de tela (Playwright), celular 375px, rede lenta | Todos |
| 10 | [10-cicd-e-deploy.md](10-cicd-e-deploy.md) | Pipeline de build/deploy interno, ambientes, rollback | Infra / DevOps |
| 11 | [11-plano-de-execucao.md](11-plano-de-execucao.md) | **Os roteiros de implementação**: fases, tarefas numeradas, comandos, critérios de aceite, prompts prontos para a IA | **Quem implementa — é o documento de trabalho diário** |
| 12 | [12-riscos-decisoes-e-pendencias.md](12-riscos-decisoes-e-pendencias.md) | Decisões arquiteturais (ADRs), riscos, perguntas que só a TI da empresa pode responder | Gestão, Infra, Backend |

> **Se você é a IA da empresa:** leia os documentos 0 → 12 **inteiros** antes de escrever qualquer código. Depois trabalhe **exclusivamente** pelo [11-plano-de-execucao.md](11-plano-de-execucao.md), uma tarefa por vez, marcando o checklist. Nunca pule um critério de aceite.
>
> **Se você é a pessoa desenvolvedora retomando o trabalho:** abra o [11-plano-de-execucao.md](11-plano-de-execucao.md), consulte a **legenda e o painel de status** no topo (`[ ]` não iniciada, `[~]` em andamento, `[x]` concluída, `[!]` bloqueada, `[-]` dispensada), procure a primeira tarefa que não esteja `[x]` — começando pelas `[~]` — e continue dali. O arquivo [`PROGRESSO.md`](PROGRESSO.md) registra o que já foi feito, por quem, e qualquer desvio do plano.

---

## Princípios que valem para toda a migração (não negociáveis)

Estes princípios vêm do próprio histórico do projeto (ver [`CLAUDE.md`](../../CLAUDE.md) na raiz) e de incidentes reais que já aconteceram em oficinas.

1. **Paridade funcional antes de melhoria.** A migração troca a *infraestrutura*, não o *comportamento*. Nenhuma regra de negócio (quem é inscrita, quem é admin, quando uma turma está aberta, como o motor de classificação decide, como a Construção da Aposta avança) pode mudar durante a migração. Melhorias vêm **depois** do corte, em PRs separados.

2. **Celular e computador são a mesma entrega.** As participantes usam o site **no celular, na sala da oficina, na rede da Previ**. Toda tela migrada precisa ser verificada em **375px de largura** e em **rede lenta**. "Ainda não sei" nunca pode ser tratado como "não tem acesso" (incidente da oficina de 08-09/09/2026, PR #111), e o site nunca pode ficar esperando calado com a tela preta (PR #116).

3. **"Se pode mexer, pode gravar."** Toda tela é *só consulta* ou *edição de verdade* — nunca uma edição que falha ao salvar. Na migração isso significa: **as permissões do backend precisam ser exatamente as mesmas das regras do Firebase** (`database.rules.json`), nem mais frouxas (brecha de segurança) nem mais rígidas (botão que abre mas não salva). O documento 04 traduz regra por regra.

4. **Dados nunca se perdem.** Toda coleção migrada é conferida por contagem e por amostragem (documento 08). O Firebase **não é desligado** no dia do corte: fica em modo somente-leitura por no mínimo 30 dias como plano de retorno.

5. **Tudo em container.** Desenvolvimento, homologação e produção sobem com o mesmo `docker compose`, mudando só o arquivo `.env`. Ninguém instala MongoDB ou Node "na mão" no servidor.

6. **Mudar o mínimo possível no frontend.** O site tem ~4 MB de JavaScript sem framework e mais de 400 chamadas ao banco espalhadas em ~20 arquivos. Reescrever todas é caro e arriscado. A estratégia (documento 02) é trocar a **biblioteca** do Firebase por um **cliente de compatibilidade** que fala com o backend novo, mantendo as chamadas existentes funcionando. As telas não precisam ser reescritas para o corte.

---

## Glossário

| Termo | Significado |
|---|---|
| **RTDB** | Firebase Realtime Database — o banco atual. É uma **única árvore JSON**; cada "tabela" é um galho de primeiro nível (ex.: `turmas`, `fa-users`). |
| **Nó** | Um galho da árvore do RTDB. Ex.: `turmas-interesse/<turmaKey>/<emailKey>`. |
| **`emailKey`** | Chave derivada do e-mail usada em quase todos os nós: e-mail em minúsculas, `@` e `.` viram `_`, outros caracteres removidos, máximo 64 caracteres. Ex.: `maria.silva@previ.com.br` → `maria_silva_previ_com_br`. **Tem que continuar idêntica** (documento 03, seção "Chaves"). |
| **push key** | Chave gerada pelo Firebase ao chamar `.push()` (ex.: `-NxYz...`, 20 caracteres, ordenável por tempo). Várias coleções usam essas chaves como ID e elas **precisam ser preservadas**. |
| **Regras** | `database.rules.json` — hoje é a **única** proteção do banco (o navegador fala direto com o Firebase). Depois, o backend é a proteção. |
| **Super-admin** | Os dois e-mails fixos no código e nas regras: `tatianefdirene@previ.com.br` e `danielfrazao@previ.com.br`. Únicos que podem adicionar/remover admins. |
| **Admin** | Super-admin **ou** quem está no nó `fa-admins`. |
| **Inscrita / enrolled** | Pessoa com `turmas-interesse/<turma>/<emailKey>` com `status: 'inscrito'`, `confirmedByAdmin` preenchido e `removed` diferente de `true`. |
| **Facilitador(a)** | Duas coisas diferentes: `fa-facilitadores` (flag que libera a página `#facilitador`) e `turmas-equipe/<turma>/<emailKey>` (quem de fato faz parte da equipe daquela turma). Ver `CLAUDE.md`. |
| **Cliente de compatibilidade** | Arquivo JavaScript novo (`forca-agil/fa-api-client.js`) que expõe o mesmo objeto global `firebase` usado hoje, mas fala com o backend NestJS. Detalhado no documento 06. |
| **Fase A / Fase B** | Fase A = migração com paridade (corte do Firebase). Fase B = evolução opcional depois do corte (endpoints por domínio, SSO etc.). Ver documento 02. |
| **Corte (cutover)** | O momento em que o tráfego real passa do Firebase para o servidor interno. |

---

## Estrutura de pastas que a migração vai criar neste repositório

Nada disto existe ainda. É o que a implementação vai criar (detalhes no documento 11):

```
forca-agil/                      ← raiz do repositório (continua igual)
├── index.html                   ← site (mudanças mínimas: troca dos <script> do Firebase)
├── forca-agil/                  ← JS/CSS do site (mudanças mínimas: auth.js, firebase.js, novo fa-api-client.js)
├── database.rules.json          ← MANTIDO como referência/fonte da verdade das permissões até o fim da Fase A
├── backend/                     ← NOVO: projeto NestJS (API + WebSocket + regras + auth)
├── infra/                       ← NOVO: docker-compose, Dockerfile do Nginx, nginx.conf, init do Mongo, scripts de backup
├── tools/migracao-dados/        ← NOVO: scripts de exportação do Firebase e importação no MongoDB
└── docs/migracao/               ← ESTA documentação (+ PROGRESSO.md durante a execução)
```

O site **continua na raiz**, exatamente onde está. Isso é proposital: enquanto a migração não termina, o GitHub Actions continua publicando no Firebase sem nenhuma alteração, e o Nginx simplesmente copia os mesmos arquivos para dentro da imagem Docker.
