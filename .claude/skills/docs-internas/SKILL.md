---
name: docs-internas
description: Depois de editar código deste projeto (forca-agil), verifica se a mudança precisa ser refletida nas páginas de documentação interna do site — Manual (manual.js), Mapa (mapa.js) e Testes (testes.js) — e, se sim, avisa a pessoa. Use sempre que uma tarefa alterar rotas, permissões/personas, fluxos do admin, regras de negócio ou comportamento testável do site.
---

# Lembrete de documentação interna

O site tem três páginas de "documentação viva", editadas em `forca-agil/`:

- **Manual** (`manual.js`) — regras de "o que cada persona vê/pode fazer" em cada seção do site (menu, turmas, conteúdos, checkin, avaliação etc.), organizadas por `SECTIONS` × `PERSONAS` (`visitante`, `logado`, `inscrito`, `admin`).
- **Mapa** (`mapa.js`) — hierarquia de acesso (`PERSONAS`/`HIERARCHY`): o que cada nível desbloqueia, lista de abas do Painel Admin, e o diagrama de estados de `turmas-interesse` (interessado → inscrito → espera etc.).
- **Testes** (`testes.js`) — testes automatizados de regressão que rodam no navegador, verificando coisas como disponibilidade do Firebase/Auth, `window.faAuth`, elementos do DOM (`navLogout` etc.) e regras de acesso (`getAccessLevel()`).

## Quando avisar

Depois de terminar uma edição de código neste repositório, antes de encerrar a resposta, avalie se a mudança se encaixa em algum destes casos — e se sim, diga explicitamente qual arquivo de doc revisar e por quê:

1. **Mudou uma rota, página ou item de menu** (`router.js`, novo `.page-section`, navegação) → avisar sobre **Mapa** (lista de páginas/abas) e **Manual** (o que a persona vê nessa página).
2. **Mudou regra de acesso/nível/persona** (`auth.js`: `getAccessLevel`, `isAdmin`, `isInscrito`, o que cada nível libera) → avisar sobre **Mapa** (hierarquia) e **Manual** (comportamento por persona) e possivelmente **Testes** (se há um teste de `auth-access-level` ou similar cobrindo essa regra).
3. **Mudou fluxo de turmas/inscrição/lista de espera** (`turmas-util.js`, `admin.js`: status inscrito/interessado/espera, destino) → avisar sobre **Mapa** (diagrama de estados) e **Manual**.
4. **Mudou algo que o painel admin faz** (nova aba, nova ação em `admin.js`) → avisar sobre **Mapa** (lista de abas/ações do admin) e **Manual** (seção `admin`).
5. **Mudou comportamento testável** (nova função exposta em `window.fa*`, elemento de DOM com id fixo, integração com Firebase) → avisar sobre **Testes**, já que `testes.js` costuma checar esses pontos diretamente.
6. **Renomeou/removeu algo que os textos de Manual/Mapa/Testes citam por nome** (id de elemento, nome de campo do banco, label de seção) → avisar que a referência ficou desatualizada.

## Quando NÃO avisar

Mudanças puramente internas sem efeito observável por persona/fluxo/teste — refatoração sem mudança de comportamento, ajuste de CSS/estilo, correção de bug que não muda a regra descrita nas docs, mudanças em `scraps/`, `screenshots/`, `uploads/`. Nesses casos não mencione nada — evita alerta repetitivo sem valor.

## Como avisar

Uma frase curta ao final da resposta, nomeando o arquivo e o motivo, por exemplo:
"Isso muda [regra/fluxo]; vale atualizar `forca-agil/mapa.js` (hierarquia de acesso)."

Não edite `manual.js`, `mapa.js` ou `testes.js` por conta própria — apenas avise. Só edite se a pessoa pedir explicitamente.
