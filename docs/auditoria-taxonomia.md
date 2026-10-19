# Auditoria da Taxonomia — 19/10/2026

Fonte: exportação real `Taxonomia_exportacao_2026-10-18 (1).xlsx` (exportada em 2026-10-19T00:54Z por
tatianefdirene@previ.com.br), com 32 registros em `taxonomia/*/conceitos`, 37 versões de definição, 9 relações
organizacionais e 203 eventos de histórico. Também usados os diagnósticos só de leitura (`taxonomia-diagnostico-naturezas.yml`).
Nada foi alterado no banco. "Evidência" = o que o próprio registro comprova (versão, autoria, data, origem); a
aprovação das 8 naturezas individuais está nas decisões de 18/10/2026 (texto das definições aprovado pela dona).

## Resultado

| | Situação |
|---|---|
| Naturezas previstas | 15 — só Produto/Serviço conjunta |
| Naturezas cadastradas | 13, uma identidade cada, definição vigente publicada |
| Reservadas à E5 | Modalidade, Subproduto (sem cadastro) |
| Classificações técnicas históricas | 6 registros técnicos preservados (código, ligação, histórico, auditoria) |
| Conceitos organizacionais | 13 |
| Duplicidade por código ou nome | nenhuma |
| Problema estrutural comprovado | as 6 classificações técnicas eram **apresentadas como conceitos oficiais** (catálogo, ficha "O que é?", Comparar, Visão consolidada, abas Conceitos/Definições do Excel, `conceitosConsolidados` do JSON) e a descrição delas aparecia na ficha P1–P16 **como definição oficial** — concorrendo com as definições das naturezas individuais |

## Matriz — Arquitetural: classificações técnicas históricas do motor (6)

| Objeto | Identidade | Função real | Texto vigente (resumo) | Evidência | Inconsistência | Impacto | Correção |
|---|---|---|---|---|---|---|---|
| Funcionalidade/Operação | `funcionalidade-operacao` | código de saída do motor P1–P16 (P16) | "ação ou mecanismo realizado dentro de um Produto/Serviço…" | v1, migração, 04/10 | apresentado como conceito oficial; texto concorre com as definições de Funcionalidade e Operação | duas definições "oficiais" para o mesmo objeto | deixa de ser conceito: fora do catálogo/Comparar/consolidada; ficha e Excel/JSON como "descrição técnica histórica"; P1–P16 mostra as naturezas oficiais correspondentes |
| Processo/Etapa de processo | `processo-etapa` | código do motor (P12) | "sequência organizada de atividades ou uma parte dessa sequência…" | v1, migração | idem, com Processo e Etapa | idem | idem |
| Regra/Opção | `regra-condicao` | código do motor (P14) | "condição, parâmetro, escolha ou regra…" | v1, migração | idem; o texto inclui "escolha", que pertence a Opção (Opção corresponde só a Modalidade/Subproduto) | objeto em Regra/Opção que é Opção | idem; a orientação de reavaliação explícita (decisão do Conflito 2) continua |
| Modalidade/Subproduto | `modalidade-subproduto` | código do motor (P13) | "variação, opção ou configuração de um Produto/Serviço principal…" | v1, migração | idem; concorre com Opção e antecipa Modalidade/Subproduto (E5) | idem | idem; Modalidade e Subproduto seguem só previstas (E5) |
| Informação/Documento | `documento-informacao` | código do motor (P10) | "conteúdo, registro ou artefato informacional…" | v1, migração | idem, com Informação e Documento | idem | idem |
| A validar | `a-validar` | resultado provisório do motor | "classificação provisória aplicada quando as evidências são insuficientes…" | v1, migração | apresentado como conceito; é estado, não natureza | idem | idem; na ficha P1–P16: "resultado provisório do motor: ainda não há natureza" |

Os 6 registros **permanecem fisicamente** no banco: as regras protegem a ligação canônica (`avaliacao-classificacoes`,
nunca alterada nem apagada), o conceito ligado não pode ser inativado e as fontes são imutáveis. O nome registrado
continua sendo o rótulo de "o que o motor classificou" (histórico, PDF, Excel), nunca uma natureza.

## Matriz — Arquitetural: naturezas cadastradas (13)

| Natureza | Identidade | Definição vigente | Evidência | Inconsistência | Correção |
|---|---|---|---|---|---|
| Produto/Serviço (conjunta) | `produto-principal` | "Produto/Serviço principal é uma solução que pode ser reconhecida e gerenciada como uma solução própria…" | v1, migração, 04/10 | o texto ainda diz "Produto/Serviço principal" enquanto o nome é "Produto/Serviço" (só redação) | nenhuma automática — pendência de redação para a dona (nova versão pela Taxonomia, se quiser) |
| Unidade de Valor Associada | `unidade-valor-associada` | "unidade reconhecível e gerenciável… depende estruturalmente de um Produto/Serviço principal" | v1, migração | nenhuma (nome com minúsculas, só grafia) | — |
| Componente | `componente` | "elemento estrutural que compõe ou sustenta uma solução maior…" | v1, migração, 08/10 | nenhuma | — |
| Capacidade Organizacional | `capacidade-organizacional` | "aptidão que a organização precisa desenvolver e sustentar…" | v1, migração | nenhuma (distinta das estruturas organizacionais: domínio diferente) | — |
| Canal | `canal` | "meio de acesso, interação ou relacionamento…" | v1, migração | nenhuma (distinto de "Linhas de Plataforma de Canais", que é tipo de estrutura) | — |
| Funcionalidade | `funcionalidade` | "Recurso que o público usa dentro de um Produto/Serviço…" | v1, publicação, 19/10 00:42 — texto aprovado em 18/10 | nenhuma (distinta de Operação: recurso usado × ação executável) | — |
| Operação | `operacao` | "Ação delimitada e executável…" | v1, publicação, 19/10 | nenhuma | — |
| Processo | `processo` | "Encadeamento de atividades no tempo que produz um resultado." | v1, publicação, 19/10 | nenhuma | — |
| Etapa | `etapa` | "Parte de um processo, com resultado intermediário próprio…" | v1, publicação, 19/10 | nenhuma | — |
| Regra | `regra` | "Norma ou condição imposta que determina elegibilidade, prazo, limite ou comportamento…" | v1, publicação, 19/10 | nenhuma | — |
| Opção | `opcao` | "Alternativa que o participante escolhe entre as que uma regra permite…" | **v2**, publicação, 19/10 00:54, motivo "Correção da definição incompleta no cadastro inicial" (v1 = "Opção", preservada no histórico) | nenhuma | — |
| Documento | `documento` | "Artefato com forma própria entregue ao público…" | v1, publicação, 19/10 | nenhuma | — |
| Informação | `informacao` | "Conteúdo informacional disponibilizado ao público…" (redação ajustada) | v1, publicação, 19/10 | nenhuma | — |

As 8 individuais não têm critérios nem observações (as definições aprovadas bastam; não é defeito).

## Matriz — Organizacional (13)

| Conceito | Identidade | Camada | Evidência | Inconsistência | Correção |
|---|---|---|---|---|---|
| Linha | `LINHA` | Tipo organizacional | v1, 06/10 | nenhuma | — |
| Linhas de Negócios | `NEGOCIOS` | Especialização de Linha | v2, 16/10 | nenhuma | — |
| Linhas de Estratégia de Clientes | `ESTRATEGIA_CLIENTES` | Especialização | v2, 16/10 | nenhuma | — |
| Linhas de Plataforma | `PLATAFORMA` | Especialização | v1, 04/10 | redação: "Linha que disponibiliza…" no singular, enquanto as irmãs dizem "Conjunto de linhas…" (só estilo) | pendência de redação para a dona |
| Linhas de Plataforma de Canais | `PLATAFORMA_CANAIS` | Subespecialização | v1 | nenhuma | — |
| Linhas de Plataforma de Gestão Corporativa | `PLATAFORMA_CORPORATIVA` | Subespecialização | v1 | nenhuma | — |
| Linhas de Plataforma Habilitadora de Negócios | `PLATAFORMA_HABILITADORA_NEGOCIOS` | Subespecialização | v1 | texto sem ponto final (só grafia) | — |
| Linhas de Plataforma Habilitadora de Tecnologia | `PLATAFORMA_HABILITADORA_TECNOLOGIA` | Subespecialização | v1 | nenhuma | — |
| Squad | `SQUAD` | Organização do trabalho | v1 | nenhuma (coerente com "Squad compõe Linha" e o invariante Linha × Squad) | — |
| Centro de Excelência (CoE) | `COE` | Tipo organizacional | v2, 16/10 | a definição v2 ficou mais ampla (referência técnica e metodológica, capacidades, conformidade…), mas o **critério** e a **observação** ainda descrevem o foco da v1 ("existe principalmente para desenvolver… uma disciplina") | **pendência para a dona**: alinhar critério/observação à v2 ou confirmar — não alterado por interpretação |
| Capítulo | `CAPITULO` | Organização do trabalho | v1 | nenhuma | — |
| Área Especializada | `AREA_ESPECIALIZADA` | Tipo organizacional | v2, 16/10 | a observação registra que a relação com o MOA "ainda não está estruturada na Taxonomia" (pendência já declarada pela dona) | — |
| Disciplina | `DISCIPLINA` | Conceito auxiliar | v1 | nenhuma (auxiliar, sem pergunta discriminadora, declarado) | — |

Relações organizacionais (9): Squad compõe Linha; Capítulo aloca em Linha e em Squad; Capítulo pertence à Disciplina;
CoE desenvolve a Disciplina; Plataforma atende Linha e Squad; Plataforma Habilitadora de Tecnologia atende Área
Especializada e CoE — todas coerentes com as definições; nenhuma liga domínios diferentes nem usa classificação técnica.

## Coerência entre áreas

| Área | Antes | Depois |
|---|---|---|
| Catálogo arquitetural | as 6 técnicas num grupo do catálogo, com ficha "O que é?", Comparar e Administrar | fora do catálogo e da busca; só em Verificações (dado técnico); ficha "Descrição técnica histórica (não é definição oficial)", sem Comparar nem Administrar |
| Ficha P1–P16 | "Camada identificada: Funcionalidade/Operação" + a descrição da classificação como definição oficial | o mesmo rótulo do motor + "Classificação técnica do motor — não é natureza nem conceito oficial. Naturezas oficiais correspondentes: Funcionalidade, Operação." (nomes da Taxonomia); nas 5 naturezas diretas, a definição oficial continua |
| Excel | 32 linhas em "Conceitos" e "Visão consolidada", 37 definições | 26 conceitos oficiais; definições só dos oficiais; aba própria "Classificações técnicas" (papel, naturezas correspondentes, descrição técnica histórica) |
| JSON | `conceitosConsolidados` com as 32 | só os oficiais, com `papel`; `classificacoesTecnicas` à parte; nó `taxonomia` intacto |
| E4, Trabalhos, Posicionamento, Squad, Mapa | mostram só o nome da classificação do motor (sem definição) e a natureza registrada | sem mudança necessária |
| Motores P1–P16, O1–O9, S1–S8; avaliações; vínculos; regras do banco | — | nada alterado |
