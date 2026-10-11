# AGENTS.md — instruções compartilhadas para assistentes de código

Este arquivo vale para qualquer assistente: Claude Code, GitHub Copilot ou outro. **O detalhamento completo do
projeto está em `CLAUDE.md`**, que continua sendo a referência; este arquivo não o repete.

## O repositório

- **Site FORÇA ÁGIL** (raiz e `forca-agil/`): JavaScript puro, sem build. É publicado no Firebase (Hosting +
  Realtime Database) pelo GitHub Actions ao entrar na `main`.
- **Backend local** (`backend/`): NestJS + PostgreSQL em Docker, só para desenvolvimento por enquanto. Guia em
  `backend/README.md`. O site não depende dele.
- **Núcleo de Avaliação, Taxonomia e Mapa da Floresta**: as regras de negócio puras (`forca-agil/*-nucleo.js` e os
  motores). Cada arquivo é a fonte única das suas regras. Não copie nem reescreva essas regras. Uso atual:
  - os motores e `motor-posicionamento-nucleo.js` são usados pelo site (e este último também pela fronteira em
    `functions/`); o backend ainda não os usa;
  - `estruturas-nucleo.js` é usado só pelo backend; o site ainda não o carrega.

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
- **"Se pode editar, pode gravar"**: tela de edição sem gravação real é defeito (ver `CLAUDE.md`).
- **Nada de segredos no Git.** Use `.env` (ignorado) e `.env.example`.
- **Branch de trabalho + PR.** O merge e o deploy são da dona do repositório.
