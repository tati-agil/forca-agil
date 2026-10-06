---
name: docs-internas
description: Depois de editar código deste projeto (forca-agil), verifica se a mudança precisa ser refletida na documentação — o ADMIN › Manual (forca-agil/manual.js, para pessoas) e a referência técnica do repositório (docs/referencia-tecnica.md, checklist pós-deploy e backlog de testes) — e atualiza esses arquivos diretamente, sem perguntar antes. Use sempre que uma tarefa alterar rotas, acessos/perfis, fluxos do admin, regras de negócio, nós do banco, arquivos de forca-agil/ ou o que só uma pessoa consegue conferir.
---

# Manutenção da documentação

Desde a Etapa 6.2 a documentação tem dois lugares, cada um para um público. Nenhum deles é fonte
de verdade: a fonte é o código, as regras do banco (`database.rules.json`) e, para conceitos,
ADMIN › Taxonomia. Documentação **explica e aponta** a fonte; não copia regra, conceito nem
lista de botões.

- **ADMIN › Manual** (`forca-agil/manual.js`) — para pessoas (a administradora, a facilitação).
  Organizado por **área** (`AREAS`): o que é, quem usa, o que é importante saber, fonte oficial e
  prova automatizada. Abre com as **quatro dimensões de acesso** (`DIMENSOES`: autenticação,
  participação, perfil funcional, privilégio administrativo — não é uma escada) e traz os
  **estados de uma pessoa numa turma** (`ESTADOS`/`TRANSICOES`). Carregado sob demanda por
  `admin.js`.
- **Repositório** (`docs/`) — para quem desenvolve, mantém ou migra:
  - `docs/referencia-tecnica.md` — fontes de verdade, modelo de acesso, módulos e ordem de carga,
    **dicionário do banco**, regras (resumo), deploy/CI, padrões em uso. O CI confere nós, módulos
    e a coluna Carga (`teste-consistencia-docs.js`).
  - `docs/checklist-pos-deploy.md` — só o que exige uma pessoa depois de publicar.
  - `docs/backlog-testes.md` — roteiros automatizáveis que ainda não têm prova.

## Quando atualizar

Antes de encerrar uma edição de código, veja se ela cai num destes casos e, se sim, **edite você
mesmo, no mesmo commit/PR**, sem perguntar:

1. **Rota, página ou item de menu** (`router.js`, `.page-section`) → área correspondente do
   **Manual**; rotas também no `CLAUDE.md` (o CI confere).
2. **Regra de acesso** (`auth.js`, `router.js`, perfis, listas de acesso) → `DIMENSOES` e a área
   do **Manual**; tabela "Modelo de acesso" da referência técnica se mudou uma dimensão.
3. **Fluxo de turmas/inscrição/lista de espera** (status, destino de saída, botões do ciclo) →
   `ESTADOS`/`TRANSICOES` do **Manual** (o teste confere que as ações citadas existem nos botões).
4. **Nó novo, removido ou renomeado no banco** → dicionário em `docs/referencia-tecnica.md`
   (finalidade, módulos, observação; a contagem "**N nós**"). O CI reprova se faltar.
5. **Arquivo novo/removido em `forca-agil/`, ou mudança de como ele carrega** → tabela de módulos
   da referência técnica (com a coluna Carga). O CI reprova se faltar.
6. **Teste novo que prova uma área** → lista "prova" daquela área no Manual, quando for relevante
   para quem lê. Teste citado tem que existir (`teste-manual.js` confere).
7. **Algo que só uma pessoa consegue conferir** (impressão, e-mail, QR com câmera, conta real) →
   uma linha em `docs/checklist-pos-deploy.md`. Se for automatizável e ainda não tiver prova →
   `docs/backlog-testes.md`.
8. **Funcionalidade removida** → acrescente um texto que só ela usava em `REMOVIDAS`
   (`teste-consistencia-docs.js`), para o CI garantir que nada sobrou.

## Quando NÃO mexer

Mudança interna sem efeito para quem usa nem para o modelo de dados (refatoração, CSS, correção que
não muda a regra descrita). Não mencione nada nesses casos.

## Como escrever

- **Manual**: frases curtas, do ponto de vista de quem usa. Nada de inventário de botões, contagem
  de abas, nome de nó do banco como conteúdo, definição da Taxonomia ou conteúdo do Mapa da
  Floresta — aponte ADMIN › Taxonomia / ADMIN › Arquitetura. Use sempre "Avaliar oficina"
  (`#avaliacao`) e "Avaliação de Produto/Serviço" (`#avaliacoes`); nunca "Avaliação" sozinho.
- **Referência técnica**: objetiva, conferida no código antes de escrever. Não registre o que não
  dá para comprovar no repositório.
- Ao final da resposta, uma frase dizendo o que foi atualizado e por quê.
