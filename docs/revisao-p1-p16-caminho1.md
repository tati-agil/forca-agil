# Revisão crítica de P1–P16 — Caminho 1 (19/10/2026)

Base da análise: a regra **publicada em produção** (`motor-arquitetura-config`, versão 7 — lida só para consulta), as
definições oficiais publicadas da Taxonomia Arquitetural (as 15 naturezas) e a redação vigente do questionário
(versão 3 em produção). Nada desta revisão foi aplicado em produção: a redação nova é a proposta editorial
`caminho1-ajudas-p1-p16` (questionarios-config.js), que só vale quando a administração geral a aplicar no ADMIN.

## Como a regra v7 usa as respostas (resumo)

Precedência (a primeira que bate decide): **Incoerência** (P5 = SIM com SIM em P13, P14, P15 ou P16) → **Produto/Serviço**
(P1, P2, P3, P4, P5, P8 = SIM e nenhum teste 9–16 SIM) → **Conflito** (dois testes SIM de um par incompatível) →
**Recorte** (quaisquer dois testes SIM) → Funcionalidade/Operação → Canal → Documento/Informação → Unidade de valor →
Capacidade → Componente → Modalidade/Subproduto → Regra/Opção → Processo/Etapa → **A validar** (sem classificação).

Consequências que a pessoa precisa saber ao responder:

- os testes 9–16 são **mutuamente exclusivos**: SIM em dois deles sempre leva a "A validar";
- P6 e P7 **não entram** em nenhuma condição (são evidência, não decisão);
- Processo, Regra e Componente exigem **P2 = NÃO** na regra; Componente exige também P12 = NÃO e P14 = NÃO;
  Capacidade exige P15 = NÃO; Modalidade exige P15 = NÃO e P16 = NÃO;
- **verificado nas 65.536 combinações (teste-caminho1.js):** com P2 = SIM e P12 = SIM, a v7 dá sempre "A validar"
  (16.384 combinações: 128 sem classificação, 1.280 recorte, 7.296 conflito, 7.680 incoerência); com P2 = NÃO e
  P12 = SIM, 64 combinações dão Processo/Etapa e o resto "A validar"; **Unidade de valor** exige P12 = NÃO (e os demais
  testes NÃO) e nenhuma combinação com P12 = SIM chega a ela — a precedência dela não interfere em P2 × P12.

## Matriz

| # | Pergunta atual (v3) | O que investiga | Ambiguidades / sobreposições | Coerência com Taxonomia e precedências | Decisão | Justificativa |
|---|---|---|---|---|---|---|
| P1 | Necessidade identificável de um cliente ou público? | Existência de público e necessidade | Público interno × externo (já esclarecido na ajuda aprovada) | Entra em Produto/Serviço, Unidade de valor e na exclusão da Capacidade; coerente com a definição de Produto/Serviço | **Manter** | Ajuda completa já aprovada (correção `semantica-p1-p16`); nenhuma ambiguidade nova |
| P2 | Resultado próprio e perceptível para o cliente? | Resultado próprio de uma solução (critério central de Produto/Serviço) | Três coisas se confundem: o resultado que um **processo produz**, o resultado que o **cliente percebe** e o resultado **próprio de uma solução independente** | A regra exige P2 = NÃO em Processo, Regra e Componente; P2 = SIM com P12 = SIM dá sempre "A validar" na v7 | **Manter** a pergunta; a explicação da diferença foi para **P12**, onde a dúvida aparece | A ajuda de P2 já trata cálculo, folha e análise como "não resultado próprio"; a orientação não prescreve resposta: explica os significados e o que acontece com a combinação |
| P3 | Entendido como solução ou oferta identificável? | Identidade de oferta | Baixa | Entra em Produto/Serviço e Unidade de valor | **Manter** | Ajuda completa existente |
| P4 | Fronteira clara: onde começa e termina? | Delimitação | Baixa | Entra em Produto/Serviço e Unidade de valor | **Manter** | Ajuda completa existente |
| P5 | Existe e entrega resultado de forma independente? | Autonomia estrutural | **Alta**: SIM aqui contradiz SIM em P13–P16 — antes só P5 × P16 era sinalizado na tela | Base da incoerência da v7; separa Produto/Serviço de Unidade de valor e das naturezas dependentes | **Melhorar texto** (aviso de incoerência com P13–P16) + aviso na tela calculado pelo motor | A contradição é real e frequente; a tela agora a mostra na hora (P5 × P13, P14, P15 ou P16), a partir da própria regra |
| P6 | Jornada ou ciclo de vida próprio? | Evidência de oferta | Não decide nada na v7 | Não entra em condição nenhuma | **Manter** | É evidência útil para a decisão humana; passar a usá-la seria mudança de motor sem necessidade demonstrada |
| P7 | Resultado mensurável de forma própria? | Evidência de resultado | Não decide nada na v7 | Não entra em condição nenhuma | **Manter** | Idem P6; ajuda já separa da Adequação à Squad (S3) |
| P8 | Poderia ser tratado de ponta a ponta como solução? | Coerência do todo | Baixa (ajuda aprovada tirou "dono/equipe") | Entra em Produto/Serviço, Unidade de valor e na exclusão da Capacidade | **Manter** | Ajuda completa aprovada |
| P9 | É principalmente um canal de acesso ou relacionamento? | Canal | Canal × Funcionalidade (um recurso dentro do app) | Definição oficial de Canal; recorte com qualquer outro teste | **Melhorar texto** | Antes só havia lista de exemplos; agora significado, quando SIM/NÃO, exemplo e contraexemplo, e a regra dos testes exclusivos |
| P10 | É principalmente documento, relatório ou informação entregue? | Informação × Documento | Artefato × processo que o produz × consulta que o mostra | Definições oficiais de Informação e Documento; conflito com Capacidade, Modalidade e Componente | **Melhorar texto**; a escolha Informação × Documento fica na **identificação orientada** | A pergunta não precisa decidir entre as duas: a diferenciação condicional já existe e grava o fundamento |
| P11 | É principalmente uma capacidade que a organização precisa possuir? | Capacidade organizacional | Capacidade × Processo × Componente | Exige P15 = NÃO e que o perfil não seja de Produto/Serviço | **Melhorar texto** | Ajuda nova separa "saber fazer contínuo" de entrega concreta, processo e componente |
| P12 | É principalmente um processo ou etapa de processo? | Processo × Etapa | **Alta**: P2 = SIM com P12 = SIM sempre dá "A validar" na v7; processo × capacidade × funcionalidade | Processo/Etapa exige P2 = NÃO, P5 = NÃO, P16 = NÃO; Unidade de valor exige P12 = NÃO | **Melhorar texto**: distingue o resultado que um processo produz, o que o cliente percebe e o resultado próprio de uma solução (P2), e diz que SIM nas duas pode ficar "A validar" (ver a prévia) — talvez sejam dois itens; Processo × Etapa na **identificação orientada** | Explica significados em vez de prescrever a resposta que a regra aceita; a combinação continua possível e o motor não muda — o "A validar" fica visível antes de concluir, com o próximo passo |
| P13 | É principalmente modalidade, opção ou configuração de outro produto? | Modalidade × Subproduto × Opção | Opção × Regra (regime tributário!) × Funcionalidade de escolha | Exige P5, P15, P16 = NÃO; Opção oficialmente só nesta classificação | **Melhorar texto**; a escolha entre as três fica na **identificação orientada** (com pendência quando não há distinção suficiente) | Ajuda nova separa a escolha (Opção) das condições do regime (Regra) e da tela da escolha (Funcionalidade) |
| P14 | É principalmente regra ou condição de outro produto? | Regra | **Alta**: "regime tributário" era exemplo de Regra sem distinguir a escolha entre regimes | Exige P2, P5, P16 = NÃO; Regra/Opção admite só Regra (Opção → reavaliação) | **Melhorar texto e exemplos**: "condições de um regime tributário" (Regra) × escolha entre regimes (Opção, P13) × tela da escolha (Funcionalidade, P16) | Segue a definição oficial de Regra ("norma ou condição imposta") e a de Opção ("alternativa escolhida entre as que uma regra permite"); "regime tributário" não é automaticamente Opção |
| P15 | É principalmente um elemento estrutural que compõe outro Produto/Serviço? | Componente | Componente × Capacidade × Processo × Funcionalidade | Exige P2, P5, P12, P14, P16 = NÃO; impede Capacidade e Modalidade | **Manter** | Ajuda e exemplo próprios já aprovados (correção `semantica-p1-p16`), cobrindo exatamente essas sobreposições |
| P16 | É principalmente funcionalidade ou operação dentro de outro Produto/Serviço? | Funcionalidade × Operação | P5 × P16 (incoerência); recurso × ação | Exige P5 = NÃO; antes das demais regras firmes | **Melhorar texto**; Funcionalidade × Operação na **identificação orientada** | Ajuda nova inclui a contradição com P5 e a tela de escolha ("escolher o regime tributário") como funcionalidade |

## Perguntas condicionais

- **Decisão: manter a diferenciação de naturezas como etapa condicional DEPOIS de P1–P16** (identificação orientada,
  `identificacao-naturezas.js`), mostrada só quando a classificação agrupa naturezas: Funcionalidade × Operação,
  Processo × Etapa, Informação × Documento, Modalidade × Subproduto × Opção e Regra (Opção → reavaliação P1–P16). Ela
  não altera a classificação técnica, só identifica a natureza dentro dela, com fundamento, pendência (recorte,
  evidência insuficiente, reavaliação) e vínculo com a versão da avaliação.
- **Nenhuma pergunta nova no motor (P17+).** Considerada e rejeitada, por ora, uma pergunta para resolver o caso
  "processo com P2 = SIM": a causa provável é o entendimento da P2 diante de um processo (ou um objeto que reúne
  processo e solução), que a explicação da P12 e a prévia tornam visível sem reclassificar 65.536 combinações. Se avaliações reais mostrarem que o caso persiste, a solução é uma versão nova do
  motor, com proposta, simulação de impacto e publicação governada — nunca um ajuste silencioso.

## O que NÃO mudou

Texto das perguntas, interpretações automáticas (SIM/NÃO), regras e versões do motor, O1–O9, S1–S8, Taxonomia e
avaliações já feitas. `teste-caminho1.js` prova: proposta aplicada → versão nova do questionário; a avaliação anterior
mantém a sua; as mesmas respostas dão a mesma classificação; a configuração do motor fica idêntica.
