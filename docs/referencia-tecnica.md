# Referência técnica — Força Ágil

Documento para quem **desenvolve, mantém ou migra** o site. Não é para quem usa o site:
para isso existe o ADMIN › Manual.

Este documento **não é fonte de verdade de nada**. Ele descreve e aponta onde cada coisa é
decidida de fato. Quando ele e o código divergirem, o código está certo e este documento
está errado — corrija o documento.

O CI confere parte deste documento a cada PR (`.github/scripts/teste-consistencia-docs.js`):

- todo nó de `database.rules.json` está no [dicionário do banco](#3-dicionário-do-banco), com
  a contagem certa, e nó que nenhum código usa está marcado como LEGADO;
- todo arquivo `forca-agil/*.js` e `*.css` está na [tabela de módulos](#2-módulos-e-ordem-de-carga),
  e nenhum arquivo citado deixou de existir;
- todo script carregado pelo `index.html` aparece na tabela com a carga "index.html";
- as rotas do `router.js` batem com as seções do `index.html`.

O resto (finalidade, observações) é prosa e depende de quem muda o código atualizar aqui.

---

## 1. Onde mora cada decisão (fontes de verdade)

| Assunto | Fonte de verdade | Prova automatizada |
|---|---|---|
| Quem acessa cada rota e o que aparece no menu | `forca-agil/router.js` (decisão de rota) e `forca-agil/auth.js` (sessão, níveis, perfis, menu) | testes herméticos de rota/acesso (ex.: `teste-avaliacoes-acessos.js`, `teste-tela-preta.js`, `teste-rolagem-decisao-tardia.js`) |
| Quem lê e grava cada dado | `database.rules.json` | `teste-rules*.js` no emulador (job `testes-rules`) |
| Conceitos arquiteturais e organizacionais (nome, definição) | ADMIN › Taxonomia (nó `taxonomia`) | `teste-rules-taxonomia*.js`, `teste-taxonomia*.js` |
| Mapa da Floresta e documentos de Arquitetura | ADMIN › Arquitetura › Documentação e mapas (nós `arquitetura-definicoes`, `arquitetura-documentos`) | `teste-mapa-floresta.js`, `teste-rules-perfis-avaliacao.js` |
| Comportamento das telas | o próprio código + testes herméticos (`.github/scripts/suite-hermetica.json`) | os 80+ testes da suíte |
| Deploy e CI | `.github/workflows/*.yml`, `firebase.json`, `.firebaserc` | — |
| Convenções de trabalho | `CLAUDE.md` e `.claude/skills/` | — |
| O que só uma pessoa consegue conferir depois do deploy | [`docs/checklist-pos-deploy.md`](checklist-pos-deploy.md) | — |

### Modelo de acesso (quatro dimensões independentes)

O acesso **não é uma escada** "Visitante → Logado → Inscrito → Admin". O código tem quatro
dimensões que se combinam:

| Dimensão | Estados | Onde é decidido |
|---|---|---|
| A. Autenticação | sem sessão · com sessão válida (@previ.com.br, e-mail verificado ou conta criada pelo painel) | `auth.js` |
| B. Participação no programa | `member` · `enrolled` (status `inscrito` + `confirmedByAdmin` em alguma turma; admin recebe `enrolled`). Por turma: interessada, inscrita, removida, lista de espera | `auth.js` (`getAccessLevel`), `router.js`, nó `turmas-interesse` |
| C. Perfis funcionais | Facilitador (`fa-facilitadores`) · Diretor (`fa-diretores`) · Avaliação / Avaliação + Arquitetura (`fa-avaliacao-autorizados`) · equipe de uma turma (`turmas-equipe`, papel responsável ou facilitador) | `auth.js`, `router.js`, `roteiro.js`, regras do banco |
| D. Privilégio administrativo | Admin (lista fixa em `auth.js` + `fa-admins`) · super-admin (lista fixa; é quem gerencia a lista de admins) | `auth.js`, regras do banco |

---

## 2. Módulos e ordem de carga

Não há bundler: cada arquivo é um `<script>` global que pendura funções em `window.fa*`. A
ordem do `index.html` importa. A coluna **Carga** diz como o arquivo chega ao navegador:
`index.html` (sempre, para todo mundo), `sob demanda` (injetado por outro módulo só quando
alguém precisa).

| Arquivo | Carga | O que faz |
|---|---|---|
| `forca-agil/head-init.js` | index.html | Marca `<html>` com a classe `js` antes do corpo renderizar. |
| `forca-agil/styles.css` | index.html | Estilos globais e tokens. |
| `forca-agil/pages.css` | index.html | Estilos das páginas e do ADMIN. |
| `forca-agil/firebase.js` | index.html | Configuração do Firebase; progresso do treinamento (`faLoadProgress`, `faSyncProgress`). |
| `forca-agil/turmas-util.js` | index.html | Utilitários de turma (datas, mês, pessoas por turma) usados por várias telas. |
| `forca-agil/roteiro.js` | index.html | Roteiro de facilitação (base por evento + personalização por turma), sem rota própria; usado por ADMIN e `#facilitador` (`window.faRoteiro`). |
| `forca-agil/router.js` | index.html | Roteador por hash e controle de acesso às rotas (`window.faRouter`). |
| `forca-agil/auth.js` | index.html | Login, cadastro, sessão, níveis e perfis de acesso, menu (`window.faAuth`). |
| `forca-agil/stars.js` | index.html | Fundo animado. |
| `forca-agil/app.js` | index.html | Início e Turmas: vitrine de eventos/turmas, interesse, lista de espera, abertura animada. |
| `forca-agil/home-nav.js` | index.html | Navegação lateral do Início. |
| `forca-agil/conteudos-nav.js` | index.html | Navegação lateral de Conteúdos. |
| `forca-agil/repo.js` | index.html | Repositório (nó `holocron`). |
| `forca-agil/game-data.js` | index.html | Catálogo de conteúdos de treinamento (blocos, níveis, patentes). |
| `forca-agil/game.js` | index.html | Treinamento: autodiagnóstico, patente, histórico. |
| `forca-agil/qrcode.min.js` | index.html | Biblioteca de QR Code (vendorizada). |
| `forca-agil/certif.js` | index.html | Geração do certificado sobre `cert-template-v3.png`. |
| `forca-agil/admin.js` | index.html | Painel ADMIN (eventos, turmas, participantes, cadastros, admins, diretores, facilitadores, sorteios, roteiro); exportações CSV (`toXls`). Carrega o Manual sob demanda. |
| `forca-agil/avaliacao.js` | index.html | "Avaliar oficina" (`#avaliacao`): formulário da oficina por turma. |
| `forca-agil/checkin.js` | index.html | Check-in por QR Code (`#checkin`). |
| `forca-agil/pedidos.js` | index.html | "Faça um pedido" (Ajuda) e aba Pedidos do ADMIN. |
| `forca-agil/dashboard.js` | index.html | Aba Dashboard (agrega "Avaliar oficina"). |
| `forca-agil/questionarios-config.js` | index.html | Conteúdo editorial publicado dos questionários (`window.faQuestionarios`), e as correções editoriais entregues pelo código (`CORRECOES_EDITORIAIS`: campo simples ou aninhado como `textoAjuda.significado`, campo novo, campo retirado), que só uma administradora aplica e viram versão nova. |
| `forca-agil/naturezas-config.js` | index.html | Catálogo da Natureza complementar (`window.faNaturezas`). |
| `forca-agil/motor-arquitetura.js` | index.html | Motor de classificação arquitetural (`window.faMotorArquitetura`). Mudança que o editor não consegue fazer (tirar condição, trocar estrutura) vem como proposta entregue pelo código (`PROPOSTAS_REGRAS`: conflito de naturezas sobre a versão 3; Capacidade G sobre a versão 5; versão 7 — incoerência, conflito de naturezas P9–P16 e recorte do objeto — sobre a versão 6, com a matriz dos 28 pares em `MATRIZ_NATUREZAS`), que só vale sobre a versão-base exata e só entra em vigor quando alguém a carrega no editor, simula e publica. |
| `forca-agil/classificacoes.js` | index.html | Nome e definição das classificações lidos da Taxonomia (`window.faClassificacoes`). |
| `forca-agil/avaliacao-produto.js` | index.html | Avaliação de Produto/Serviço (`#avaliacoes`) e ADMIN › Arquitetura. |
| `forca-agil/taxonomia.js` | index.html | ADMIN › Taxonomia (`window.faTaxonomia`). |
| `forca-agil/motor-squad.js` | index.html | Motor de Adequação à Squad (`window.faMotorSquad`). |
| `forca-agil/avaliacao-squad.js` | index.html | Adequação à Squad (área Avaliação e ADMIN › Arquitetura). |
| `forca-agil/aluno.js` | index.html | Minha Área (`#minha-area`). |
| `forca-agil/facilitador.js` | index.html | Minhas Facilitações (`#facilitador`). |
| `forca-agil/aposta.js` | index.html | Construção da Aposta (convite dentro do Treinamento, tela cheia). |
| `forca-agil/init.js` | index.html | Inicialização no `DOMContentLoaded` e guarda do painel ADMIN. |
| `forca-agil/manual.js` | sob demanda | ADMIN › Manual (documentação para pessoas). Injetado por `admin.js` na primeira vez que a aba é aberta. |
| `forca-agil/html2pdf.bundle.min.js` | sob demanda | Geração de PDF (Avaliação de Produto/Serviço e Squad). |
| `forca-agil/xlsx.mini.min.js` | sob demanda | Exportação Excel (Avaliação, Squad, Taxonomia). |

Imagens e templates ficam em `forca-agil/assets/` e `forca-agil/cert-template-*.png`.

---

## 3. Dicionário do banco

Firebase Realtime Database, projeto `kyber-agil`. **54 nós** na raiz de `database.rules.json`.
"Módulos" lista os arquivos que leem ou gravam o nó (conferido por busca no código).
Para **quem pode ler e gravar**, a fonte é sempre `database.rules.json`.

### Pessoas e acessos

| Nó | Finalidade | Módulos | Observação |
|---|---|---|---|
| `fa-users` | Perfil de cada cadastro (nome, área, e-mail, situação). | admin, auth, avaliacao-produto, pedidos | Nome/área editáveis no ADMIN › Cadastrados. |
| `fa-users-log` | Histórico das correções de cadastro feitas pelo ADMIN. | admin | Só admin grava. |
| `fa-admins` | Quem é admin (além da lista fixa em `auth.js`). | admin, auth, pedidos | Cada pessoa lê só o próprio registro. |
| `fa-diretores` | Quem vê eventos marcados "só para diretores e administradores". | admin, auth | Não dá acesso de admin. |
| `fa-facilitadores` | Quem vê a página `#facilitador`. | admin, auth | Não põe a pessoa em nenhuma turma (isso é `turmas-equipe`). |
| `fa-avaliacao-autorizados` | Quem acessa a Avaliação de Produto/Serviço: tipo `avaliacao` ou `avaliacao-arquitetura`. | auth, avaliacao-produto | Ouvido ao vivo; só admin geral grava. |
| `fa-avaliacao-autorizados-auditoria` | Histórico de concessão, alteração e remoção desses acessos. | avaliacao-produto | Só acréscimo. |
| `fa-avaliacao-acessos` | LEGADO: perfis antigos consulta/avaliador/gestor. | — | Congelado; nenhum código lê nem grava; não concede nada. |

### Eventos, turmas e participação

| Nó | Finalidade | Módulos | Observação |
|---|---|---|---|
| `eventos` | Evento: nome, carga horária, frequência mínima, conteúdo público, publicação e restrições. Turmas e treinamentos pertencem a um evento. | admin, aluno, app, avaliacao, dashboard, facilitador | Escrita de admin. |
| `eventos-publico` | Público restrito de um evento fechado (quem pode vê-lo e participar). | admin, aluno, app | Só admin grava. |
| `turmas` | Turma: nome, datas, evento a que pertence, link do CMFlex, restrição. | admin, aluno, aposta, app, auth, avaliacao, checkin, dashboard, facilitador, game, roteiro, turmas-util | Criada e editada no ADMIN. |
| `turmas-publico` | Público restrito de uma turma fechada. | admin, aluno, app | Só admin grava; é a barreira real da restrição. |
| `turmas-interesse` | Ligação pessoa ↔ turma: interessada, inscrita (`confirmedByAdmin`), removida, com motivo e destino da saída. | admin, aluno, aposta, app, auth, avaliacao, checkin, dashboard, game, turmas-util | Base do nível `enrolled`. |
| `turmas-interesse-log` | Histórico de interesse registrado/removido. | admin, app | |
| `fa-espera` | Lista de espera por evento, uma entrada por pessoa e origem. | admin, aluno, app | Remoção é lógica (`removed`). |
| `turmas-config` | Configuração da turma: finalizada, encerrada, dia de check-in ativo. | admin, aluno, app, checkin, facilitador | |
| `turmas-checkin` | Presença registrada por dia. | admin, aluno, checkin | |
| `turmas-sorteio` | Sorteios feitos na turma. | admin | |
| `turmas-equipe` | Equipe de facilitação da turma (responsável ou facilitador). | admin, aposta, facilitador, roteiro | Diferente de `fa-facilitadores`. |
| `avaliacoes` | Respostas do "Avaliar oficina", por turma e pessoa. | aluno, avaliacao, dashboard | Cada pessoa lê e grava só a própria. |

### Roteiro de facilitação

| Nó | Finalidade | Módulos | Observação |
|---|---|---|---|
| `roteiros-evento` | Roteiro-base do evento (dias e atividades). | roteiro | Toda turma herda. |
| `turmas-roteiro` | Personalização do roteiro naquela turma (só as diferenças). | admin, roteiro | O roteiro efetivo é base + personalização. |
| `roteiro-tipos-atividade` | Lista editável de tipos de atividade. | admin, roteiro | Semeada na primeira abertura da aba. |

### Treinamento, conteúdo e progresso

| Nó | Finalidade | Módulos | Observação |
|---|---|---|---|
| `treinamentos` | Treinamento e a quais eventos pertence. | admin, game | `conteudoKey` vazio = conteúdo próprio em `treinamentos-conteudo`. |
| `treinamentos-conteudo` | Blocos, níveis e patentes de um treinamento criado no painel. | admin, game | |
| `fa-progress` | Progresso de cada pessoa (autodiagnóstico, conteúdos lidos). | admin, firebase | |
| `fa-progress-historico` | Uma linha por patente revelada, por treinamento. | admin, game | Refazer não apaga. |
| `fa-reset-signal` | AUXILIAR: avisa o navegador da pessoa que o admin resetou o progresso. | admin, firebase | |
| `holocron` | Conteúdos enviados no Repositório. | admin, repo | |
| `fa-holocron-hidden` | AUXILIAR: conteúdos do Repositório ocultos pela moderação. | admin, repo | |
| `fa-seeds-hidden` | AUXILIAR: conteúdos-semente ocultos pela moderação. | admin, repo | |
| `fa-seeds-deleted` | AUXILIAR: conteúdos-semente excluídos pela moderação. | admin | |
| `pedidos` | Pedidos abertos pelas pessoas ("Faça um pedido"), com status e resposta. | admin, aluno, pedidos | Exclusão é lógica (lixeira). |
| `apostas` | Construção da Aposta por turma: execuções, grupos, ciclos e resumo de grupos. | aposta | Regras de leitura e escrita próprias por grupo e equipe (ver `teste-rules.js`). |

### Avaliação de Produto/Serviço, Squad e Arquitetura

| Nó | Finalidade | Módulos | Observação |
|---|---|---|---|
| `avaliacoes-produto` | Avaliações de Produto/Serviço: respostas, resultado do motor, classificação, curadoria e decisão; versões encadeadas. | avaliacao-produto, avaliacao-squad | Exclusão lógica; curadoria e decisão só para admin geral e Avaliação + Arquitetura. Cada resposta guarda a pergunta e a versão do questionário em que foi dada; publicar texto novo, reavaliar ou reprocessar nunca troca isso (`teste-versionamento-historico.js`). |
| `curadoria-auditoria` | Auditoria de curadoria e da decisão final, por avaliação. | avaliacao-produto | Só acréscimo, gravada junto com a alteração. |
| `avaliacoes-squad` | Avaliações de Adequação à Squad (S1–S8), independentes da arquitetural. | avaliacao-squad | O resultado da combinação é exibido como "Recomendação de gestão por Squad"; o campo gravado continua `indicacaoOrganizacional`. |
| `motor-arquitetura-config` | Regras publicadas, versões e rascunho do motor arquitetural. | motor-arquitetura | |
| `motor-arquitetura-auditoria` | Auditoria do motor arquitetural. | avaliacao-produto, motor-arquitetura | Só acréscimo. |
| `motor-squad-config` | Regras publicadas, versões, rascunho e textos do motor de Squad. | motor-squad | |
| `motor-squad-auditoria` | Auditoria do motor de Squad. | motor-squad | Só acréscimo. |
| `questionarios-config` | Conteúdo editorial publicado dos questionários (P1–P16, S1–S8). | questionarios-config | O código estável da pergunta só existe no código. |
| `questionarios-auditoria` | Auditoria das publicações de questionário. | questionarios-config | Só acréscimo. |
| `naturezas-complementares-config` | Catálogo da Natureza complementar. | naturezas-config | Nada se apaga (desativar). |
| `naturezas-complementares-auditoria` | Auditoria da natureza complementar (por avaliação e do catálogo). | avaliacao-produto, naturezas-config | Só acréscimo. |
| `arquitetura-documentos` | Documentação e mapas de Arquitetura (link https). | avaliacao-produto | Arquivar em vez de apagar. |
| `arquitetura-documentos-auditoria` | Auditoria desses documentos. | avaliacao-produto | Só acréscimo. |
| `arquitetura-definicoes` | Definições de artefatos de Arquitetura com chave estável (hoje `MAPA_FLORESTA`). | avaliacao-produto | Nunca apagada. |
| `arquitetura-definicoes-auditoria` | Auditoria dessas definições. | avaliacao-produto | Só acréscimo. |

### Taxonomia

| Nó | Finalidade | Módulos | Observação |
|---|---|---|---|
| `taxonomia` | Dicionário conceitual: domínios arquitetural e organizacional (conceitos, fontes, critérios, atributos, perfis, relações, auditoria, carga inicial). | classificacoes, taxonomia | Fonte única dos conceitos. A audiência da Avaliação lê só nome/ativo/definição vigente dos conceitos arquiteturais. Camadas organizacionais: A, B, C, `trabalho` ("Organização do trabalho": Squad, Capítulo) e `auxiliar`; A ⇄ `trabalho` só com motivo e auditoria (`camadaAlteracao`). |
| `avaliacao-classificacoes` | Ligação canônica classificação do motor ↔ conceito arquitetural de mesmo código. | taxonomia | Só admin geral; criada uma vez, nunca alterada nem apagada. |
| `avaliacao-classificacoes-auditoria` | Histórico dessas ligações. | taxonomia | Só acréscimo. |

### Legado

| Nó | Finalidade | Módulos | Observação |
|---|---|---|---|
| `fa-ranking` | LEGADO: ranking de versões antigas. | — | Nenhum código lê nem grava. |
| `players` | LEGADO: jogadores de versões antigas. | admin | Só uma limpeza por e-mail no ADMIN ainda toca o nó. |

---

## 4. Regras de segurança (resumo)

A fonte é `database.rules.json`; aqui só os princípios, para orientar quem lê as regras:

- Nada é público: todo nó exige autenticação com e-mail `@previ.com.br`, verificado no
  servidor (`auth.token.email`), não na tela.
- A raiz do banco não é lida nem gravada diretamente.
- Admin é a lista fixa de super-admins **ou** `fa-admins`. Só super-admins mexem em `fa-admins`.
- Avaliação de Produto/Serviço, Squad e Arquitetura têm audiência própria
  (`fa-avaliacao-autorizados`), aplicada nas regras de todos os nós dessa área.
- Auditorias são só de acréscimo: as regras recusam reescrever ou apagar.
- `apostas` restringe leitura e escrita por grupo e por equipe da turma.

Provas: `teste-rules.js`, `teste-rules-avaliacoes.js`, `teste-rules-perfis-avaliacao.js`,
`teste-rules-taxonomia.js`, `teste-rules-taxonomia-governanca.js` (emulador, job `testes-rules`).

---

## 5. Deploy e CI

Hospedagem: Firebase Hosting, projeto `kyber-agil` (`.firebaserc`). `firebase.json` publica a
raiz do repositório, ignora `*.md`, `*.txt`, arquivos ocultos, `scraps/`, `screenshots/`,
`uploads/`, `preview-chars.html` e `node_modules`, reescreve toda rota para `/index.html` e
manda `Cache-Control: no-cache` em JS, CSS, `/index.html` e `/` (com CSP nos dois últimos).

| Workflow | Quando roda | O que faz |
|---|---|---|
| `firebase-deploy.yml` | push em `main` | Publica hosting e regras do banco em produção. |
| `firebase-preview.yml` | push em `v2` | Publica no canal de preview `v2-preview`. |
| `firebase-preview-v3.yml` | push em `v3-quiz` | Publica no canal `v3quiz` e grava a URL em `PREVIEW_URL_V3.txt`. |
| `testes-automaticos.yml` | PR para `main`, `v2`, `v3-quiz` | Suíte hermética em 4 grupos (bloqueia o merge) + Smoke com login real (não bloqueia). |
| `teste-rules.yml` | PR para `main`, `v2`, `v3-quiz` | Testes das regras do banco no emulador (bloqueia o merge). |
| `aquecer-cache-playwright.yml` | push em `main` que muda o preparo de testes, diariamente e manual | Aquece o cache do Playwright. |
| `audit-facilitadores-turmas.yml`, `backfill-grupos-resumo.yml`, `diagnostico-execucao-vazamento-grupo.yml` | manual (e push no próprio script) | Ferramentas pontuais da Construção da Aposta. |

Não há hook de pre-commit versionado no repositório nem passo de `node --check` no CI: erro de
sintaxe é pego indiretamente pelos testes herméticos (erro de página).

### Testes

- **Suíte hermética** (`.github/scripts/suite-hermetica.json`, executor `rodar-suite.js`):
  Playwright com Firebase falso, sem rede e sem segredo, desktop e 375 px. Roda local com
  `node .github/scripts/rodar-suite.js` e a raiz servida em `http://127.0.0.1:8811`.
- **Regras do banco**: `teste-rules*.js` no emulador.
- **Smoke** (`.github/scripts/smoke-site-real.js`): o site do PR servido localmente, com o
  Firebase **real** (Auth e banco de produção), login de uma conta admin de teste. Verifica que o
  site sobe, o banco responde, as rotas principais carregam com dados reais e nenhuma página
  lança erro. Não grava dados reais.
- **Checklist pós-deploy**: [`docs/checklist-pos-deploy.md`](checklist-pos-deploy.md) — o que só
  uma pessoa consegue conferir.
- **Backlog de testes**: [`docs/backlog-testes.md`](backlog-testes.md) — roteiros que poderiam
  ser automatizados e ainda não têm prova.

---

## 6. Padrões em uso

Só o que o código atual segue de fato. Convenções de trabalho (como abrir PR, celular primeiro,
"editar sem salvar é quebrado") estão no `CLAUDE.md` e nas skills e não são repetidas aqui.

- **Módulos globais**: cada arquivo é uma IIFE (`(function(){ 'use strict'; … })()`) e expõe a
  API em `window.fa*`. A maior parte do código usa `var` e funções ES5.
- **"Ainda não sei" não é "não tem acesso"**: decisões de acesso esperam a leitura terminar
  (`isAdminReady`, `isAvaliacaoReady`, `isEnrolledReady`) e são refeitas quando ela chega.
- **Leitura que pode não responder** mostra estado ("Carregando…", erro com "Tentar novamente"),
  nunca tela vazia.
- **Bibliotecas pesadas sob demanda** (`carregarScript` em `avaliacao-produto.js`; o Manual em
  `admin.js`): só são baixadas por quem usa.
- **CSV**: `toXls` (interna de `admin.js`) gera CSV com `;` e UTF-8 com BOM, que o Excel abre
  editável.
- **Tabelas do ADMIN** ficam dentro de `.table-scroll-wrap` (rolagem horizontal própria).
- **Atributo `hidden`** em itens de menu é controlado pelo JavaScript; CSS de layout não deve
  forçar `display` nesses elementos.
