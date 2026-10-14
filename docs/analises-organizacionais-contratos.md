# Análise Organizacional (Porta 2): contratos do núcleo

Núcleo puro `forca-agil/analises-organizacionais-nucleo.js` (`window.faAnalisesOrganizacionaisNucleo` /
`module.exports`). É a **PR 1** da especificação aprovada ("Da classificação ao desenho organizacional", revisão 3).

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

## Reservado às próximas PRs e ondas

- **PR 2:** nós e regras do Firebase atrás de um marcador desligado (`analises-organizacionais`, auditoria, propostas, aprovações e `analises-por-objeto`). A permissão do admin geral para a aprovação (N1) fica nas regras, não no núcleo.
- **PRs 3–6:** telas das etapas, painel, aprofundamento de "A validar", composição, ficha da estrutura e Jornada.
- **Onda 2:** registro governado de execução, separado de `estruturas-vinculos`.
- **Onda 3:** vista de proposta separada do Mapa vigente.
- **Onda 4:** pessoas e alocações.
- **À parte:** a ativação da v2 segue o rito de governança existente.
