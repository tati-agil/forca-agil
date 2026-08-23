# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Força Ágil" is a vanilla JavaScript single-page site (gamified onboarding/training experience, Star Wars-themed) for Previ. There is **no build step, no bundler, no package manager, no test suite** — the repo is deployed to Firebase Hosting exactly as committed.

## Commands

There is no `package.json` and no local dev/build/lint/test tooling in this repo. The only commands that exist are the deploy commands run by CI (see Deploy below) via `npx firebase-tools@13`. To preview locally, serve the repo root over HTTP (e.g. `npx firebase-tools@13 serve` or any static file server) — opening `index.html` via `file://` will break Firebase Auth/CSP.

## Architecture

**Single giant `index.html`** (~100KB) contains markup for every route as `.page-section` elements, plus an inline SVG library (icons and the game's character art/gradients). It loads:
1. `forca-agil/head-init.js` early in `<head>`.
2. The Firebase **compat** SDKs (app/database/auth) from gstatic, then `firebase.js`.
3. All feature scripts in `forca-agil/` as plain global `<script>` tags, in a specific order that matters because there is no bundler resolving dependencies — each file attaches functions to `window.fa*` namespaces (e.g. `window.faAuth`, `window.faStore`) that later scripts rely on: `firebase.js` → `turmas-util.js` → `router.js` → `auth.js` → `stars.js` → `app.js` → `home-nav.js`/`conteudos-nav.js` → `repo.js` → `game-data.js`/`game.js` → `qrcode.min.js` → `certif.js` → `admin.js` → `avaliacao.js` → `checkin.js` → `manual.js` → `mapa.js` → `testes.js` → `pedidos.js` → `dashboard.js` → `aluno.js` → `init.js` (bootstraps on `DOMContentLoaded`).

**Routing** (`forca-agil/router.js`): hash-based router over a fixed page list (`home`, `turmas`, `conteudos`, `treinamento`, `repositorio`, `avaliacao`, `minha-area`, `ajuda`, `admin`, `checkin`). `navigate()`/`show()` toggle `.page-section[hidden]` and enforce access control on both programmatic navigation and direct hash access (so refreshing on a gated route doesn't leak content while Firebase Auth is still resolving).

**Auth & access control** (`forca-agil/auth.js`): wraps Firebase Auth (compat SDK) behind `window.faAuth`. Three access levels: `member` (default) < `enrolled` (confirmed participant in a turma, read from the `turmas`/`turmas-interesse` RTDB nodes) < `admin`. Admins are a hardcoded email allowlist plus entries in the `fa-admins` RTDB node. `conteudos`, `treinamento` and `avaliacao` routes require `enrolled` or higher.

**Data layer**: Firebase Realtime Database is the only backend (project `kyber-agil`, config in `forca-agil/firebase.js`, security rules in `database.rules.json`). There is no server-side code in this repo — feature scripts read/write the DB directly from the client (e.g. `turmas-util.js`, `admin.js`, `checkin.js`, `dashboard.js`).

**Feature scripts** roughly map one file per route/feature: `game.js`/`game-data.js` (quiz, XP, ranks), `admin.js` (admin dashboard — turmas, participants, status/destino filters), `avaliacao.js`, `checkin.js` (QR check-in, uses `qrcode.min.js`), `certif.js` (certificate generation from `cert-template-v3.png`), `mapa.js`, `manual.js`, `pedidos.js`, `dashboard.js`, `aluno.js`. Styling is plain CSS in `styles.css` and `pages.css` (no preprocessor).

## Deploy

Firebase Hosting, project `kyber-agil` (`.firebaserc`). `firebase.json` serves the whole repo root (`"public": "."`) except `scraps/`, `screenshots/`, `uploads/`, `preview-chars.html`, `*.md`, `*.txt`, and dotfiles; it rewrites every path to `/index.html` (the hash router handles the rest) and sets CSP + no-cache headers for `index.html`/JS/CSS.

Deploys are driven entirely by GitHub Actions (`.github/workflows/`), using `firebase-tools@13` and the `FIREBASE_SERVICE_ACCOUNT_KYBER_AGIL` secret — there is no manual deploy step:
- push to `main` → `firebase-deploy.yml` deploys `hosting,database` to the live `kyber-agil` project.
- push to `v2` → `firebase-preview.yml` deploys to preview channel `v2-preview` (30-day expiry).
- push to `v3-quiz` → `firebase-preview-v3.yml` deploys to preview channel `v3quiz` and commits the resulting preview URL into `PREVIEW_URL_V3.txt`.

`database.rules.json` (RTDB security rules) deploys alongside hosting on `main`.
