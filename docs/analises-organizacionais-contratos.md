# Análise Organizacional (Porta 2): contratos do núcleo

Núcleo puro `forca-agil/analises-organizacionais-nucleo.js` (`window.faAnalisesOrganizacionaisNucleo` /
`module.exports`). Entrou na **PR 1** da especificação aprovada ("Da classificação ao desenho organizacional", revisão 3); a **PR A** acrescentou a persistência, as regras, a tela e o marcador de homologação (ver o fim deste documento).

Situação atual:

- Nenhuma tela carrega o núcleo: ele não está no `index.html`.
- Não há regras de banco nem nós novos.
- Banco, vínculos, Taxonomia, Mapa e motores não mudam.
- A prova é `.github/scripts/teste-analises-organizacionais-nucleo.js`.
- Os casos de estresse da TI estão em `.github/scripts/cenarios/analises-organizacionais-ti.v1.json`. São dados fictícios, que poderão ser reaproveitados pelos executores do Firebase e do PostgreSQL.

## O que o núcleo é, e o que não é

- **É** a jornada orientadora:
  - a matriz F1–F17;
  - as regras de avanço, aprofundamento e lacunas;
  - a delimitação de responsabilidades;
  - os fatos descritivos de quem executa e de quem responde;
  - a situação formal calculada;
  - a proposta de composição;
  - a referência à aprovação institucional.
- **Não é** um classificador:
  - não importa nem reproduz o motor O1–O9;
  - não cita nenhum código nem nome de posicionamento (o teste confere isso no próprio arquivo);
  - não toca na v2.
- **Não cria** estrutura, vínculo, conceito da Taxonomia, caixa do Mapa nem pessoa. `aplicar()` recusa qualquer entidade fora de `analise`, `proposta` e `aprovacao`.

## Contrato de execução

O contrato é o mesmo de `estruturas-nucleo.js`:

- **Entradas:** `estado = { analises, propostas, aprovacoes }` e `ctx = { operacaoId, novoId?, usuario: { id, email? }, agora }`. O horário e os identificadores vêm de quem chama, nunca do núcleo.
- **Saída de cada operação:** `{ ok: true, mudancas, eventos }` ou `{ ok: false, erros: [{ codigo }] }`. A operação nunca altera o estado recebido.
- **`aplicar(estado, mudancas)`:** tudo ou nada, com conferência de revisão (`CONFLITO_DE_REVISAO`).

## Regras aprovadas que o núcleo garante

| Regra | Onde |
|---|---|
| Agrupar nunca é automático. A mesma forma ou o mesmo destinatário só **sugerem comparar**; o mesmo responsável sozinho não basta, porque quase todas as entregas de uma estrutura o compartilham. | `sugestoesDeComparacao` |
| A identidade é investigada por sete critérios: finalidade, resultado, objeto, limites e autonomia, riscos, obrigação de responder, governança ou especialização. A conclusão é da pessoa. Concluir "mesma" ou "integradas" contra os indícios de distinção exige justificativa. | `compararEntregas`, `interpretarComparacao` |
| Duas entregas só entram no mesmo recorte com comparação concluída como "mesma" ou "integradas". Regressão: políticas de SI × diretrizes contratuais continuam separadas. | `definirRecorte` (`AGRUPAMENTO_SEM_COMPARACAO`) |
| A entrega executada para a responsabilidade de outra estrutura (F7) não abre recorte próprio. | `ENTREGA_E_EXECUCAO_PARA_OUTRA` |
| N5: o O1–O9 exige delimitação suficiente (nome, resultado, forma, destinatário e evidência ou marca de hipótese), não um responsável formal conhecido. | `prontaParaO1O9` |
| Uma atuação tem no máximo uma análise de origem, imutável. Outras análises só a referenciam (N:N) e ela não é contada duas vezes. | `associarAtuacao`, `referenciarResponsabilidade`, `contagens` |
| Um recorte já avaliado não é reescrito: rever a delimitação cria outro recorte. | `RECORTE_JA_AVALIADO_DEFINA_OUTRO` |
| N2/N4: quem executa e quem responde formalmente são fatos descritivos da análise, com caráter (confirmado, declarado ou hipótese), fonte e data. Nunca são vínculo. | `registrarFatos`, `exercidasPelaEstrutura` |
| A situação formal é calculada pela ligação oficial código → conceito (a mesma regra V3 das Estruturas). Um vínculo de tipo diferente nunca é tratado como compatível. | `situacaoFormal` |
| N3: nenhuma alternativa reclassifica nem força vínculo. | `ALTERNATIVAS_RECUSADAS`, `registrarProposta` |
| N1: a aprovação é referência a ato externo (autoridade, referência, data, objeto aprovado). A autoria é só do registro. Uma proposta pendente não se aprova. | `registrarAprovacao` |
| D6: o objeto amplo delimitado vira agrupador e sai das contagens de pendência. | `objetoAmploDelimitado`, `contagens` |
| D2: a capacidade é só uma referência estável. Uma fonte oficial só é aceita se quem chama a informar. | `validarCapacidades` |

## PR A: persistência, regras, tela e marcador

- **Adaptador** `forca-agil/analises-organizacionais-firebase.js`: o resultado do núcleo vira uma gravação multipath (horário do servidor, autoria, evento de auditoria apontado pela análise). A atuação criada a partir de um recorte vai na mesma gravação que o recorte ligado e o índice de origem. O nó das atuações não muda.
- **Regras** dos 7 nós novos, montadas por `.github/scripts/montar-regras-analises-organizacionais.js` e provadas no emulador por `teste-rules-analises-organizacionais.js`:
  - o marcador `analises-organizacionais-config/habilitacao` vale nas operações de dados (ausente = DESLIGADO);
  - revisão + 1;
  - origem única;
  - propostas imutáveis em sequência;
  - aprovação só do admin geral, como referência a ato externo.
- **Tela** `forca-agil/analises-organizacionais.js` (`#avaliacoes?an=`), provada por `teste-analises-organizacionais-tela.js`:
  - as jornadas A, B e C pela interface, com o O1–O9 respondido na tela de sempre;
  - os três estados do marcador nos três perfis;
  - 375 px.
- **Limite das regras:** o RTDB não percorre listas. A regra "duas entregas só ficam juntas depois de comparadas" é garantida pelo núcleo (o mesmo arquivo nas telas e nos testes), não pelas regras. As regras garantem autorização, imutabilidade, sequência, origem e histórico.

## Correção de usabilidade (sem mudar regras nem nós)

- **F2b coerente:** `responder` recusa estrutura com resposta diferente de "Está cadastrada" (`ESTRUTURA_INCOMPATIVEL_COM_RESPOSTA`) e, ao trocar a resposta, grava `estruturaReferidaId = null`. Registro legado incoerente é corrigido só na próxima gravação da própria análise (`abrirAlteracao`), com antes e depois na mudança — nada é limpo em lote. `cadastroReferido(analise)` é a leitura coerente para as telas.
- **Entregas:** `editarEntrega` (só descrição e exemplo; recusada se a entrega está numa responsabilidade que já virou atuação — `ENTREGA_EM_RESPONSABILIDADE_AVALIADA`) e `descartarEntrega` (motivo opcional; `situacao: descartada` + `descarte`, nunca apagada; recusada dentro de uma responsabilidade delimitada — `ENTREGA_EM_RESPONSABILIDADE`). Eventos `entrega.editada` e `entrega.descartada`.
- **Retrocompatibilidade:** as duas operações gravam a análise inteira pela mesma gravação de sempre (revisão + 1, evento novo); as regras não validam o conteúdo das entregas nem o tipo do evento, então nada nas regras nem nos nós muda. Registros existentes continuam válidos.
- **Responsabilidade Organizacional no modelo simples:** `definirRecorte` com `descricao` (o texto como a pessoa escreveu — pode ser uma atribuição literal; `nome` repete a descrição, campo técnico) e, opcional, `separacao: { valor: 'nao' | 'sim' | 'nao-sei', observacao? }` — resposta a "Essa descrição reúne trabalhos diferentes que precisam ser avaliados separadamente?" (atenção: "nao" é que NÃO precisa separar). Sem resultado, finalidade, entregas ou destinatário obrigatórios; com entregas, a regra de comparação continua. Sem `descricao` vale a regra anterior (nome, resultado, justificativa e entregas comparadas) — é assim que os registros existentes continuam. `prontaParaO1O9` exige `separacao.valor = 'nao'` (faltas `SEPARACAO_NAO_RESPONDIDA` / `SEPARACAO_PENDENTE`); uma pendente não bloqueia as outras. A resposta é uma confirmação da pessoa, não prova: o O1–O9 continua podendo indicar "A validar".
- **Mudar a resposta e separar:** `revisarResponsabilidade` (descrição e resposta, só antes de avaliar; `recorte.revisado` com antes e depois) é o único jeito de mudar a resposta — o detalhamento por entregas nunca a converte. `desdobrarResponsabilidade` (só com "sim"; duas ou mais partes informadas pela pessoa, cada uma com a sua resposta; `ctx.novosIds`): a original fica `desdobrado`, com `desdobramento.partes`, e nunca é avaliada; cada parte guarda `origemRecorteId`; evento `recorte.desdobrado`.
- **Lote:** `registrarResponsabilidadesEmLote` (até 100 textos, `ctx.novosIds`): numa única gravação, na ordem informada (`ordem`), sem resposta sobre separar (pendentes de delimitação), sem dividir, juntar, reescrever ou associar núcleo; uma linha inválida recusa o lote inteiro; evento `recortes.registrados-em-lote`.
- **Núcleos atuais:** `informarNucleosAtuais` (um ou vários; `estruturaId` do cadastro do ADMIN ou `texto` para o que não está nele; sem repetição; lista vazia = "não informado"; corrigível também depois da avaliação): grava `fatos.execucao` com caráter "declarado", fonte e data — a mesma informação descritiva de "quem executa hoje", que já alimenta "Exerce, segundo as análises" na ficha da estrutura —, nunca vínculo formal nem estrutura nova; evento `nucleos.informados` com antes e depois. Não influencia o O1–O9.
- **Cadastro da Porta 2 (objeto organizacional):** as regras exigem nome (até 200), descrição e finalidade. `faObjetosOrganizacionaisNucleo.dadosSimplificados` preenche os três com a descrição informada, pede um nome curto só quando a descrição passa de 200 caracteres e escreve no contexto quais campos repetem a descrição ("nada foi inferido"). Usado pela avaliação a partir da análise e pelo Caminho A simplificado (com a Análise Organizacional liberada para quem grava; "Sim" e "Não sei" levam a responsabilidade para uma análise nova — duas gravações).
- **Retrocompatibilidade:** `descricao`, `separacao`, `ordem`, `desdobramento` e `origemRecorteId` são campos novos dentro do recorte e o estado `desdobrado` é um valor novo de `situacao`; as regras não validam o conteúdo do recorte (só a imutabilidade do `objetoId` e o índice de origem) nem o tipo do evento, então nada nas regras nem nos nós muda — provado no emulador pela seção E2 de `teste-rules-analises-organizacionais.js` (responsabilidade só com a descrição, revisão, separação e criação do objeto da Porta 2).
- **Tela:** lista única por área com situação e ação; lote; núcleos; composição por núcleo — provados por `teste-analises-organizacionais-usabilidade.js` (cenário GECON); o núcleo, pelas seções K, L e M de `teste-analises-organizacionais-nucleo.js`; o modo detalhado, pelas jornadas A, B e C de `teste-analises-organizacionais-tela.js`; `dadosSimplificados`, por `teste-objetos-organizacionais-nucleo.js`.

## Reservado às próximas ondas

- **Onda 2:** registro governado de execução, separado de `estruturas-vinculos`.
- **Onda 3:** vista de proposta separada do Mapa vigente.
- **Onda 4:** pessoas e alocações.
- **À parte:** a ativação da v2 segue o rito de governança existente.
