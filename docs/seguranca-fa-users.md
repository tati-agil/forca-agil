# Segurança de `fa-users`: endurecimento das regras em duas PRs

Objetivo: as regras de gravação de `fa-users/<chave>` passam a aceitar só:

- o **admin geral** (a lista fixa das regras + `fa-admins`), em qualquer cadastro;
- a **própria pessoa**, na chave do próprio e-mail, para **criar** o cadastro só com os campos do cadastro público
  (`email`, `name`, `area`, `optinTurmas`, `emailVerificationRequired: true`, `createdAt`) e para a anotação da
  confirmação do e-mail (`emailConfirmado` / `emailConfirmadoEm`, que já tem regra própria).

Antes disso, o código precisa parar de fazer a única gravação legítima que as regras novas recusam. Por isso são duas PRs, nesta ordem.

## PR 1-A — só código (compatível com as regras atuais)

- **Criar conta para colaboradora** (`auth.js` `criarContaPorAdmin`), na ordem nova:
  1. reautenticar o admin antes de criar qualquer coisa. Com a senha errada, nada é criado.
  2. criar o login da conta nova;
  3. sair, voltar à sessão do admin e conferir que é mesmo a dele;
  4. gravar o cadastro **com a sessão do admin**, por transação que nunca sobrescreve.

  Até aqui, o cadastro era gravado ainda conectado como a conta nova, com `adminApproved`.
- **Criação parcial** (existe o login e não existe o cadastro): mensagem explícita, sem nova tentativa automática. A conta incompleta não é liberada pelo painel; a pessoa entra, confirma o e-mail e completa o cadastro.
- **Porta de entrada** (`auth.js` `aplicarAcesso`). Vale só quando a leitura respondeu que o cadastro não existe; demora e erro de leitura seguem os caminhos de sempre.

  | Login sem cadastro | Antes | Agora |
  |---|---|---|
  | e-mail fora da Previ | entrava sem cadastro | sai |
  | @previ.com.br, e-mail não confirmado | entrava sem cadastro | painel de verificação; nenhum módulo |
  | @previ.com.br, e-mail confirmado | entrava sem cadastro | só "Complete seu cadastro" (nome e área); grava os campos públicos e passa pelas verificações normais |

  Em 31/10/2026 não havia nenhum login @previ.com.br sem cadastro, então ninguém perde acesso. Contas com cadastro continuam exatamente como antes (`teste-login-contas-existentes.js`).
- **Testes:**
  - `teste-seguranca-fa-users-1a.js` (suíte hermética, desktop e 375 px);
  - `teste-rules-fa-users-compat.js` (emulador, com as regras do repositório).

A 1-A foi publicada em 31/10/2026 (merge `04cbd2d`).

## PR 1-B — só regras (depois da 1-A publicada)

Só o nó `fa-users` muda, e só a **gravação**: as regras de leitura, a autenticação, as senhas e os dados ficam como
estão. O nó é gerado por `.github/scripts/montar-regras-fa-users.js` (não editar à mão).

- `fa-users/$userKey/.write`: a própria chave com `newData.exists()`, **ou** o admin geral. A exclusão fica barrada
  aqui, porque o `.validate` não roda quando o nó é apagado.
- `.validate`, para quem não é admin:
  - **criação:** chave vazia, só os campos públicos, `emailVerificationRequired === true` e `email` igual ao do login;
  - **alteração:** o cadastro precisa ser da pessoa (`email` gravado = o do login) e nenhum campo conhecido muda —
    públicos e administrativos (`blocked`, `adminApproved`, `approvedAt`, `approvedByAdmin`, `approvedByAdminName`,
    `createdByAdmin`, `cadastroCompletadoEm`, `cadastroCompletadoPorAdmin`, `emailCorrigidoDe`), inclusive apagar.
    Sobra só a anotação `emailConfirmado`/`emailConfirmadoEm`, com a regra própria, mantida sem mudança;
  - **campo desconhecido** (`$outro`): só o admin acrescenta ou muda.
- **A chave da própria pessoa** reproduz a `emailKey()` do site: minúsculas; `@` e `.` viram `_`; os 30 caracteres
  imprimíveis ASCII restantes que não são `[a-z0-9_]` são removidos um a um; o corte em 64 é conferido com `beginsWith`.
  As regras não têm "remover qualquer caractere" nem corte de texto, então a equivalência é **exata para todo e-mail de
  caracteres imprimíveis ASCII**. E-mail com acento ou de outro alfabeto: a própria pessoa não grava e o admin cadastra
  (decisão da dona, 31/10/2026). Em 31/10/2026: 0 cadastros e 0 logins precisam de tratamento especial, 0 colisões.
- **Colisão** (e-mails diferentes, mesma chave, ex. `a-b@` e `ab@`): a chave sozinha nunca dá posse — criar exige a
  chave vazia e alterar exige o e-mail gravado igual ao do login.
- Os outros usos da chave nas regras (derivação simplificada: troca `@` e `.` por `_`, sem remover outros caracteres)
  ficam como estão; fora desta PR.
- **Testes:**
  - `teste-rules-fa-users.js` (emulador): regressão por tipo de conta (admins, avaliação, arquitetura, diretor,
    gerente, facilitadora, conta antiga, confirmada, liberada, criada pelo admin, bloqueada); os fluxos legítimos; as
    gravações indevidas (terceiros, autoliberação, desbloqueio, exclusão, campos administrativos, campo privilegiado na
    criação, chave alheia, colisão, acento), por campo, por update, por multipath da raiz e regravando o cadastro;
  - `teste-rules-fa-users-compat.js` e `teste-rules-email-confirmado.js`, sem mudança, contra as regras novas;
  - `teste-regras-fa-users-chave.js` (hermético): a chave das regras = `emailKey()` em mais de 30 mil e-mails.

## Ordem obrigatória de implantação

1. Merge e deploy da **1-A** (com autorização).
2. Conferir:
   - que os arquivos publicados são os do commit;
   - que a criação de conta funciona no site publicado;
   - que os admins recarregaram as abas abertas. Os `.js` são servidos com `no-cache`, então só uma aba aberta desde antes do deploy ainda roda o código antigo.
3. Merge e deploy da **1-B** (com autorização).
4. Conferir: Smoke, que só lê, e os fluxos legítimos reais, só com autorização. Nunca testar explorações em produção.

## Matriz de compatibilidade

| | Regras atuais | Regras da 1-B |
|---|---|---|
| **Código antigo** (antes da 1-A) | Funciona (a situação anterior). | **Criar conta pelo admin falha:** o login é criado e o cadastro é recusado (criação parcial). Os outros fluxos funcionam. |
| **Código da 1-A** | Funciona: hermético + `teste-rules-fa-users-compat.js` com as regras atuais. | Funciona: a provar na 1-B com o mesmo `teste-rules-fa-users-compat.js` contra as regras novas. |

## Reversão

- **Antes da 1-B:** reverter a 1-A sozinha é seguro (código antigo com as regras atuais).
- **Depois da 1-B:**
  - **Não reverter a 1-A sozinha.** Código antigo com as regras novas quebra a criação de conta pelo admin e deixa contas incompletas.
  - Problema nas regras: reverter só a 1-B, republicando o `database.rules.min.json` anterior por uma PR de reversão. As regras não mudam dados e a troca vale na hora; o código da 1-A funciona com as regras antigas.
  - Problema no código: corrigir para a frente. Se for preciso voltar o código, primeiro reverter a 1-B e só depois a 1-A.
