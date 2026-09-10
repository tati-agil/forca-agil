---
name: pre-publicacao
description: Antes de dar git push num branch de trabalho e abrir PR neste projeto (forca-agil), roda checagens rápidas nos arquivos alterados — sintaxe JS e validade de database.rules.json — e corrige qualquer erro antes de publicar. Use sempre, logo antes do push que precede a abertura do PR.
---

# Checagens antes de publicar

Este repositório não tem bundler, linter nem suíte de testes automatizada local (ver `CLAUDE.md`). O que dá para verificar sem subir o site é sintaxe. A cobertura funcional de verdade — a suíte "▶ Automáticos" da aba Testes do painel Admin (`forca-agil/testes.js`) — roda contra o Firebase real e por isso não pode ser executada por esta skill: veja "Suíte completa" abaixo.

## O que rodar, sempre, antes do push que antecede o PR

1. Para cada arquivo `.js` alterado nesta mudança (`git diff --name-only` contra a base), rode:
   ```
   node --check <arquivo>
   ```
   Se algum falhar, corrija o erro de sintaxe antes de continuar — nunca publique um arquivo que não passa nisso.

2. Se `database.rules.json` foi alterado, valide que é JSON bem formado:
   ```
   python3 -c "import json; json.load(open('database.rules.json'))"
   ```

3. Se `index.html` foi alterado, uma checagem rápida de sanidade (tags balanceadas é demais para checar sem parser HTML de verdade — pelo menos confirme visualmente, na revisão do diff, que toda tag `<div>`/`<section>` aberta para uma feature nova foi fechada).

4. **Se a mudança tem efeito visual ou depende de leitura do Firebase, carregue a página de verdade — nos dois formatos de tela.** Sintaxe não vê tela, e provas de lógica escritas à mão testam uma cópia do código, não o código. Rode `node .github/scripts/teste-tela-preta.js` (com o site servido em `127.0.0.1:8811`, como o CI faz): ele já carrega o `index.html` real em desktop e celular, com o Firebase substituído por um falso, e não precisa de rede nem de segredo. Se a sua mudança mexe em algo que aquele teste não cobre, copie o padrão dele — servidor local + `page.route('**/firebasejs/**')` para o falso + `devices['Pixel 5']` ao lado do desktop — e meça o que interessa, em vez de raciocinar sobre o que deveria acontecer.

   O motivo está no `CLAUDE.md`: celular e computador são a mesma entrega, e rede lenta é condição normal de celular. Os dois piores defeitos deste projeto (expulsão de rota por corrida de leitura, e a tela preta na espera do login) eram invisíveis no computador do escritório e só apareceram com 20 pessoas no 4G de uma sala.

Só depois de tudo passar, siga com o `git push` e a abertura do PR, como já é de praxe neste projeto.

## Se algo falhar

Corrija o problema você mesma (mesmo padrão da skill `docs-internas`: resolver direto, sem perguntar antes), rode a checagem de novo, e só publique quando estiver limpo. Nunca pule uma checagem que falhou "pra resolver depois".

## Suíte completa (Playwright contra o Firebase real)

A suíte "▶ Automáticos" de `testes.js` (grupos Técnicos + Comportamento) precisa de um navegador de verdade, logado como admin, batendo no Firebase real (Auth + Realtime Database do projeto `kyber-agil` — não há emulador neste repo). Isso **não roda dentro desta sessão de coding**: o proxy de saída deste ambiente bloqueia `www.gstatic.com` (onde ficam os SDKs do Firebase) e não suporta upgrade de WebSocket (que o Realtime Database usa) — não é algo para contornar, é política de rede do ambiente.

Por isso essa suíte roda como CI de verdade, no workflow `.github/workflows/testes-automaticos.yml`, disparado em toda PR contra `main`/`v2`/`v3-quiz`, usando os secrets do repositório `FA_TEST_ADMIN_EMAIL`/`FA_TEST_ADMIN_PASSWORD` (conta admin de teste — hoje `teste_admin@previ.com.br`) para logar e clicar em "▶ Automáticos". O script fica em `.github/scripts/run-testes-automaticos.js`.

Depois de abrir o PR, esse CI é só mais um check a observar — segue as mesmas regras de "PRs você criou são suas" já em vigor: se ele falhar, é para investigar e corrigir antes de considerar a PR pronta, não para ignorar.
