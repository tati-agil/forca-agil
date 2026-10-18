# Estruturas Organizacionais Concretas — contratos do núcleo

**Núcleo de Avaliação, Taxonomia e Mapa da Floresta.** Arquivo: `forca-agil/estruturas-nucleo.js`
(`window.faEstruturasNucleo` no navegador, `module.exports` em Node). Prova: `.github/scripts/teste-estruturas-nucleo.js`.

O núcleo é **domínio puro**: não lê nem grava em banco, não conhece Firebase, SQL, NestJS, tela, autenticação,
relógio ou gerador de identificadores. Quem integra (hoje o site; amanhã um backend) lê os dados, chama a operação
e grava o resultado. Este documento é o que essa integração precisa cumprir.

## 1. Entradas

### Estado — o que a persistência leu

```
estado = { estruturas: { <id>: Estrutura }, relacoes: { <id>: Relacao }, vinculos: { <id>: Vinculo } }
```

### Referências oficiais — lidas por quem chama, nunca pelo núcleo

| Campo | Origem | Uso |
|---|---|---|
| `conceitos` `{ <codigo>: { ativo, pai? } }` | Taxonomia Organizacional | conceito existe e está ativo; cadeia de pais |
| `relacoesConceituais` `[ { de, tipo, para, ativa } ]` | relações oficiais da Taxonomia | compatibilidade das relações entre estruturas |
| `herancaPeloPai` (padrão `false`) | regra oficial da Taxonomia | só com `true` uma relação do conceito pai vale para o filho |
| `ligacoes` `{ <códigoMotor>: <conceito> }` | correspondência oficial código do motor ↔ conceito | tipos admitidos e compatibilidade do responsável principal |
| `codigosFirmes` `[ … ]` | motor de Posicionamento | quais códigos são firmes |
| `conceitosTrabalho` `[ … ]` | Taxonomia | os conceitos oficiais de Squad e Capítulo |

### Posicionamento vigente de um objeto — quando a operação precisa dele

```
{ avaliacaoId, recomendacao: { codigoResultado }, decisao?: { codigoFinal } }   // null = sem Posicionamento vigente
```

### Contexto de execução — fornecido por quem executa

```
ctx = { operacaoId, novoId?, usuario: { id, email? }, agora: <milissegundos UTC> | '<ISO 8601>' }
```

`novoId` é exigido nas operações que criam algo (`criar…`, `vincular…`, `substituir…`, `alterarRelacao`). O
núcleo não gera identificador, autor nem horário: recusa a operação sem eles.

## 2. Saídas

Toda operação devolve, sem alterar o estado recebido, um resultado imutável:

```
{ ok: true,  mudancas: [ Mudanca … ], eventos: [ Evento … ] }
{ ok: false, erros: [ { codigo, … } … ] }
```

**Mudanca** (semântica, sem caminho de banco):

```
{ entidade: 'estrutura' | 'relacao' | 'vinculo', id, antes: <objeto | null>, depois: <objeto>, revisaoAnterior: <n | null> }
```

**Evento** — histórico e auditoria, só acréscimo:

```
{ id: '<operacaoId>:<n>', operacaoId, tipo, entidade, entidadeId, antes, depois, usuario, em, motivo?, justificativa?, campos? }
```

Os tipos de evento são:

- `estrutura.criada`, `estrutura.alterada`, `estrutura.encerrada`;
- `relacao.criada`, `relacao.encerrada`;
- `vinculo.criado`, `vinculo.encerrado`.

Uma substituição gera dois eventos com o mesmo `operacaoId`.

**Horário.** O formato canônico de `agora` é o instante em **milissegundos UTC desde a época Unix** (inteiro positivo),
sempre fornecido pelo **servidor**. Por compatibilidade com os registros e o backend já existentes, texto ISO 8601 continua
aceito. O núcleo só registra o horário recebido (nunca decide nada com ele); `historico()` ordena pelo instante real,
com os dois formatos misturados; `instante(v)` converte os dois para milissegundos. Horário inválido (0, negativo,
fracionário, texto sem data) é recusado com `CONTEXTO_SEM_HORARIO`. Prova: seção G de `teste-estruturas-nucleo.js`.

## 3. O contrato de persistência

`aplicar(estado, mudancas)` é a referência em memória do que qualquer persistência precisa garantir:

1. **Tudo ou nada.** As mudanças de uma operação são gravadas juntas, ou nenhuma é.
2. **Controle de concorrência por revisão.**
   - Uma criação (`antes: null`) só entra se o identificador ainda não existe.
   - Uma alteração só entra se a entidade ainda está em `revisaoAnterior`. Se não estiver, `CONFLITO_DE_REVISAO`: nada é gravado.
3. **Eventos gravados com as mudanças**, na mesma unidade de gravação, e nunca alterados nem apagados.
4. **Nada se apaga.** Encerrar é uma alteração (`situacao: 'encerrada'` + `encerramento`).

### Invariantes que dependem de outros registros

Na integração com qualquer banco, a persistência precisa garantir **atomicamente**, na mesma unidade de gravação, não
só as revisões das entidades alteradas, mas também os invariantes que dependem de **outros** registros:

- **Um único responsável principal ativo por objeto**, inclusive sob operações concorrentes.
- **Nenhuma relação ativa duplicada** (mesma origem, tipo e destino).
- **Nenhum ciclo na composição hierárquica** (`compõe`).
- **Mudanças e eventos de auditoria gravados juntos**: ou entram todos, ou nenhum.

O controle de revisão de registros individuais, isoladamente, não garante essas condições. Duas operações podem ler
o mesmo estado, constatar que não há responsável principal (ou relação, ou caminho que forme ciclo) e criar registros
**diferentes** ao mesmo tempo. Nenhuma das duas altera um registro que a outra também altera, então as revisões não
conflitam, e as duas seriam confirmadas.

A persistência precisa recusar a segunda gravação, revalidando o invariante dentro da própria gravação ou
serializando as operações que o afetam. O núcleo valida esses invariantes sobre o estado que recebe; a garantia sob
concorrência é responsabilidade da persistência. A referência em memória (`aplicar()`) é sequencial e não substitui
essa garantia.

**Implementação atual:** o backend local (`backend/`, módulo `estruturas`, migração `0001_estruturas_concretas.sql`)
cumpre este contrato no PostgreSQL: transação serializável que lê o estado, chama o núcleo e grava operação, mudanças
e eventos juntos; índices únicos parciais para relação ativa duplicada e responsável principal ativo; gatilhos que
recusam exclusão, reativação, troca do que é imutável e alteração de eventos. Prova: `backend/test/integracao/`.

**Casos de uso compartilhados e portas** (`forca-agil/estruturas-casos-de-uso.js`): a orquestração única do cadastro
(criar, alterar e encerrar estrutura — os 8 tipos firmes no 1º cadastro), usada pelo site e pelo backend, e o contrato
de persistência comum em forma de portas: `lerReferencias`, `lerEstado`, `gravar` (tudo ou nada; revisão; mesma
operação repetida não duplica), `conferirOperacao` (antes de decidir e depois de "sem resposta") e `lerEventos`.
`CAMPOS_DE_HORARIO` lista onde o horário aparece (estrutura e cópias antes/depois no evento), para o adaptador Firebase
gravar o horário do servidor. `persistenciaEmMemoria` é a referência do contrato.

**Cenários de negócio versionados** (`.github/scripts/cenarios/estruturas-concretas.v1.json`, executor compartilhado
`.github/scripts/estruturas-cenarios.js`): o mesmo conjunto roda contra a referência em memória
(`teste-estruturas-cenarios-referencia.js`), o Firebase Emulator e o PostgreSQL; o relatório identifica conjunto, versão
e sha256.

Leitura: a persistência precisa poder devolver o estado acima (ou o recorte necessário) e os eventos de uma
entidade, que `historico(eventos, entidade, id)` ordena.

## 4. Operações

| Operação | Regras |
|---|---|
| `criarEstrutura(estado, { tipo, nome, sigla?, descricao? }, ctx, ref)` | tipo admitido e ativo; identificador nunca reaproveitado |
| `alterarEstrutura(estado, id, { nome?, sigla?, descricao? }, ctx, { justificativa?, revisaoEsperada? })` | só ativa; tipo imutável; registra campos, antes e depois |
| `encerrarEstrutura(estado, id, motivo, ctx, { revisaoEsperada? })` | motivo obrigatório; sem exclusão, reativação ou cascata |
| `criarRelacao(estado, { origem, tipo, destino, justificativa? }, ctx, ref)` | 5 tipos; Taxonomia admite; sem duplicidade ativa, autorrelação ou ciclo em `compõe` |
| `alterarRelacao(estado, id, { origem?, tipo?, destino?, justificativa? }, motivo, ctx, ref)` | encerra a antiga e cria a nova (mesmas regras), com motivo |
| `encerrarRelacao(estado, id, motivo, ctx)` | motivo obrigatório |
| `vincularResponsavel(estado, { objetoId, estruturaId, justificativa?, divergencia? }, posicionamento, ctx, ref)` | um responsável principal ativo; posicionamento efetivo firme; estrutura de um tipo de posicionamento (nunca Squad: `TIPO_NAO_ALOCAVEL`); tipo igual ao da ligação oficial do código efetivo **ou**, por decisão organizacional, outro tipo com `divergencia` { motivo da lista `MOTIVOS_DIVERGENCIA`, justificativa, autoridade?, referencia? } (E2: `DIVERGENCIA_SEM_JUSTIFICATIVA`, `MOTIVO_DIVERGENCIA_INVALIDO`, `DIVERGENCIA_INDEVIDA` num vínculo compatível); base registrada |
| `vincularColaboradora(estado, { objetoId, estruturaId, justificativa }, posicionamento, ctx, ref)` | E3: mesmo registro, `papel: 'colaboradora'`; exige principal ativo (`SEM_RESPONSAVEL_PRINCIPAL`) de outra estrutura (`COLABORADORA_E_PRINCIPAL`), justificativa e nenhuma colaboradora ativa da mesma estrutura (`COLABORADORA_JA_EXISTE`); sem regra de tipo nem divergência; sem limite fixo |
| `substituirResponsavel(estado, vinculoId, { estruturaId, justificativa?, divergencia? }, motivo, posicionamento, ctx, ref)` | só do principal; encerra o atual e cria o novo, com motivo; a MESMA estrutura = reconfirmar sobre a base nova (E2) |
| `encerrarVinculo(estado, id, motivo, ctx)` | motivo obrigatório |

### Consultas e situações calculadas (não gravam nada)

- `posicionamentoEfetivo(posicionamento, ref)`: decisão final, senão recomendação firme, senão nenhum.
- `situacaoResponsavel(estado, objetoId, posicionamento, ref)` → `valido` | `divergencia-deliberada` | `ausente` | `precisa-revisao` | `nao-aplicavel`, com motivos; `divergenciaResolvida` { codigoAtual, avaliacaoId, origem } quando uma reavaliação passou a coincidir com o tipo de uma alocação divergente (a divergência e a base originais continuam no vínculo).
- `situacaoColaboradoras(estado, objetoId, posicionamento, ref)` → cada colaboradora ativa: `ativa` | `precisa-revisao` (`ESTRUTURA_ENCERRADA`, `SEM_RESPONSAVEL_PRINCIPAL`, posicionamento sem valer); mudança de código efetivo não a afeta.
  - Mesmo código efetivo em outra avaliação continua válido (`baseEmOutraAvaliacao`).
- `situacaoRelacao(estado, id, ref)` → `valida` | `a-revisar` | `encerrada`.
- `responsavelAtivo`, `estruturasDoTipo`, `relacoesDaEstrutura`, `objetosDaEstrutura`, `relacoesPossiveis`, `historico`, `tiposAdmitidos`, `relacaoConceitualAdmite`.

### Subagrupadores das Linhas de Negócios (Etapa 5)

Agrupamento de APRESENTAÇÃO do Mapa da Floresta (decisão A aprovada): não é estrutura organizacional concreta nem
conceito da Taxonomia; só para estruturas do tipo Linha de Negócios (`NEGOCIOS`).
- `criarSubagrupador(estado, { nome, ordem? }, ctx)` — sem ordem, vai para o fim; `alterarSubagrupador(estado, id,
  { nome?, ordem? }, ctx, { justificativa?, revisaoEsperada? })` — só nome e ordem; `encerrarSubagrupador(estado, id,
  motivo, ctx, { revisaoEsperada? })` — motivo obrigatório; encerrado não muda nem reativa; identificador nunca
  reaproveitado.
- `associarLinha(estado, { estruturaId, subagrupadorId }, ctx, { justificativa? })` — Linha de Negócios ativa,
  subagrupador ativo, no máximo uma associação ativa por Linha (`LINHA_JA_ASSOCIADA`); `substituirAssociacao(estado,
  associacaoId, subagrupadorId, ctx, …)` — encerra a atual e cria a nova na mesma operação (`substituidaPor` ×
  `substitui`); `desassociarLinha(estado, associacaoId, ctx, …)`.
- Encerrar um subagrupador NÃO encerra associações em cascata: `subagrupadorDaLinha()` calcula `associada` /
  `subagrupador-encerrado` / `sem-subagrupador` / `nao-se-aplica`; no Mapa, só `associada` fica dentro do grupo.
- `subagrupadoresAtivos()` (ordem, depois nome), `linhasDoSubagrupador()`.
- Unicidade sob concorrência (no máximo uma associação ativa por Linha) é da PERSISTÊNCIA: `violacoesDeUnicidade()`
  na referência em memória, índice `ativa-por-estrutura` conferido pelas regras no Firebase, índice único parcial no
  PostgreSQL (Etapa 3).
- Cenários versionados: `.github/scripts/cenarios/mapa-subagrupadores.v1.json` (formato 2: estado inicial e estado
  final por coleção).

### Relações entre estruturas — M6/M7 do Mapa (decisões C1–C4 aprovadas em 2026-10-13)

- **C1:** o Squad é estrutura concreta cadastrável (conceito da camada "Organização do trabalho" que a Taxonomia admite
  compor uma Linha), mostrado dentro do detalhe da Linha — nunca caixa do Mapa. Capítulo fica fora desta entrega.
- **C2:** no site, `compõe` só de Squad para uma das 6 especializações de Linha, e só se a Taxonomia admitir a combinação;
  todo `compõe` geral continua bloqueado (as regras do banco garantem; por construção não há ciclo).
- **C3:** um Squad compõe no máximo UMA Linha ativa (`COMPOSICAO_ATIVA_JA_EXISTE`, regra do núcleo); trocar = substituir
  (`alterarRelacao`), com motivo e histórico; o cadastro do Squad não exige vínculo.
- **C4:** admin geral e `avaliacao-arquitetura` mantêm as relações admitidas; `avaliacao` só consulta; leitura mínima das
  relações conceituais e de camada/ativo/nome do Squad, sem ampliar escrita.
- Os outros quatro tipos (não hierárquicos) valem entre quaisquer estruturas cujos tipos a Taxonomia admita — o conteúdo
  oficial dessas relações conceituais é governança da Taxonomia, não do código. Herança pelo conceito-pai continua só
  com previsão oficial (não presumida): uma relação conceitual registrada só para um conceito-pai (ex.: "Squad compõe
  Linha") não admite as especializações.

### Pendências de governança — relações entre estruturas (Item 2, situação anterior às decisões C1–C4)

O núcleo já sabe validar relações entre estruturas (os 5 tipos da Taxonomia, só se a Taxonomia admitir entre os
conceitos dos tipos; `compõe` sem ciclo; sem duplicata), mas NADA disso é gravado no site ainda. Faltam decisões que
não podem ser presumidas:
1. **`compõe` (estrutura pertencente a outra)**: bloqueada no site pelo requisito de paridade (integridade
   equivalente Firebase × PostgreSQL, inclusive sob concorrência — `docs/paridade-firebase-postgresql.md`). Depende da
   Etapa 3 e de uma solução de ciclo demonstrada nos dois bancos.
2. **Semântica entre os tipos firmes**: a documentação aprovada não define quando uma Linha, uma Área Especializada ou
   um CoE "aloca em", "atende", "desenvolve a disciplina" ou "pertence à disciplina" de outra estrutura. As relações
   conceituais da Taxonomia Organizacional decidem a admissibilidade, mas o conteúdo oficial delas entre os 8 conceitos
   firmes precisa ser confirmado pela governança.
3. **Leitura das relações conceituais**: hoje só o admin geral lê `taxonomia/organizacional/relacoes`; quem cadastra
   (Avaliação + Configuração) precisaria de leitura granular — decisão de permissão.
4. **"Níveis organizacionais"**: não existe esse conceito no modelo aprovado (nem na Taxonomia nem no núcleo).
5. **Squads e Capítulos** como estruturas: o núcleo os admite, mas a implementação foi adiada (regra confirmada: só
   Linhas são constituídas por Squads; precisa ser garantida no núcleo e na persistência quando entrar).

## 5. O que fica fora do núcleo

- **Ler a Taxonomia, o motor e o Posicionamento:** quem chama lê e passa como `ref` ou `posicionamento`.
- **Permissões:** quem pode executar cada operação é verificado por quem chama e pela persistência. O núcleo registra o autor recebido em `ctx`.
- **Liberação para Squad (I2):** continua no núcleo do Posicionamento e não é lida aqui.
- **Pontos em aberto:** unicidade de nome e sigla, e carga inicial das estruturas reais. Nada disso é imposto. (A cardinalidade da composição foi decidida em C3: um Squad, no máximo uma Linha ativa.)
