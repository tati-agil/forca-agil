# AGENTS.md — instruções compartilhadas para assistentes de código

Este arquivo vale para qualquer assistente: Claude Code, GitHub Copilot ou outro. **O resumo do projeto e as regras
de trabalho estão em `CLAUDE.md`**; o detalhamento por módulo, em `docs/arquitetura-detalhada.md`, e o dicionário do
banco e a tabela de módulos, em `docs/referencia-tecnica.md` (consulte sob demanda). Este arquivo não os repete.

## O repositório

- **Site FORÇA ÁGIL** (raiz e `forca-agil/`): JavaScript puro, sem build. É publicado no Firebase (Hosting +
  Realtime Database) pelo GitHub Actions ao entrar na `main`.
- **Backend local** (`backend/`): NestJS + PostgreSQL em Docker, só para desenvolvimento por enquanto. Guia em
  `backend/README.md`. O site não depende dele.
- **Núcleo de Avaliação, Taxonomia e Mapa da Floresta**: as regras de negócio puras (`forca-agil/*-nucleo.js` e os
  motores). Cada arquivo é a fonte única das suas regras. Não copie nem reescreva essas regras. Uso atual:
  - os motores e `motor-posicionamento-nucleo.js` são usados pelo site (e este último também pela fronteira em
    `functions/`); do motor, o backend só lê os códigos firmes oficiais;
  - `estruturas-nucleo.js` é usado pelo backend (módulo de Estruturas Concretas); o site o carrega, mas por enquanto só
    usa `posicionamentoEfetivo` (Catálogo preparatório do Mapa da Floresta, `mapa-floresta.js`).

  Quando um módulo do backend precisar de outro núcleo, ele carrega o mesmo arquivo, do mesmo jeito.

## Comandos (terminal, sem depender de IA)

| O quê | Comando |
|---|---|
| Suíte hermética do site | servir a raiz em `http://127.0.0.1:8811` (`python3 -m http.server 8811`) e rodar `node .github/scripts/rodar-suite.js` |
| Backend: testes | em `backend/`: `npm ci && npm run typecheck && npm test` |
| Backend: ambiente local | em `backend/`: `cp .env.example .env` (defina a senha), `docker compose up --build -d`, `npm run verificar:ambiente` |

## Regras que não se negociam

- **O site publicado continua funcionando no Firebase.** Não altere Hosting, regras do banco, autenticação, telas,
  motores, questionários ou dados sem pedido explícito.
- **Celular e computador são a mesma entrega**, e rede lenta é o caso normal (ver `CLAUDE.md`).
- **Padrão Visual Oficial** (`docs/padrao-visual.md`): toda funcionalidade nova ou modificada segue a identidade
  aprovada do FORÇA ÁGIL. Antes de qualquer mudança visual: consultar o documento (§3-A: hierarquia amarelo/azul/ciano e
  estados de links e botões), reutilizar classes existentes sem inventar cores, fontes ou estilos, verificar desktop e
  375 px (links, botões, contraste, navegação) e rodar `teste-padrao-visual.js` e `teste-padrao-visual-floresta.js`
  (obrigatório, bloqueia o merge). O padrão só muda com decisão expressa da dona.
- **"Se pode editar, pode gravar"**: tela de edição sem gravação real é defeito (ver `CLAUDE.md`).
- **Nada de segredos no Git.** Use `.env` (ignorado) e `.env.example`.
- **Paridade Firebase × PostgreSQL** (`docs/paridade-firebase-postgresql.md`): uma fonte oficial de gravação por vez
  (hoje o Firebase), horário do servidor, nenhuma gravação dupla; operação que grava nos dois bancos só é validada com o
  mesmo conjunto de cenários no núcleo, no emulador do Firebase e no PostgreSQL, comparados automaticamente.
- **Branch de trabalho + PR.** O merge e o deploy são da dona do repositório.
- **Execução eficiente** (detalhes em `CLAUDE.md`): investigar com buscas direcionadas, reutilizar o que existe,
  editar em blocos coerentes, testes direcionados no desenvolvimento e validação completa no commit final da PR — sem
  cortar testes de segurança, regressão, concorrência ou compatibilidade.
- **Critério de encerramento de PR** (política permanente em `CLAUDE.md`): só bloqueador real e comprovado impede o
  merge; o resto vai para o backlog; com o Definition of Done cumprido, parar e apresentar a PR para decisão.
