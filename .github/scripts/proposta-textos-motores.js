/* PROPOSTA de textos para os questionários P1–P16 e S1–S8 — NÃO aplicada.
 *
 * Só dados. O site não lê este arquivo. Mesmo formato "de → para" das
 * correções editoriais de forca-agil/questionarios-config.js
 * (CORRECOES_EDITORIAIS), para poder ser entregue depois como versão nova do
 * questionário, sem tocar em regra de motor. "de" é o texto de fábrica
 * (PADRAO); a versão publicada no Firebase pode ter outro texto, e nesse caso
 * a correção editorial marca o ajuste como "divergente" e não o aplica.
 *
 * Objetivo de cada ajuste: separar natureza do objeto (P1–P16) de
 * capacidade dedicada e gestão por Squad (S1–S8). Nenhum muda regra.
 * campo com ponto (textoAjuda.significado) = subcampo do objeto textoAjuda.
 *
 * teste-coerencia-motores.js confere que todo "de" bate com o texto de
 * fábrica e que trocar todos os textos não muda nenhuma decisão dos motores. */
module.exports = [
  {
    id: 'semantica-p1-p16',
    codigo: 'CLASSIFICACAO_ARQUITETURAL',
    titulo: 'P1, P5, P7 e P8 falam só da natureza do objeto',
    ajustes: [
      { pergunta: 'P1', campo: 'textoAjuda.significado',
        de: 'Este critério verifica se existe alguém para quem a solução faz sentido e uma necessidade que justifica sua existência.',
        para: 'Verifica se existe um cliente ou público identificável com uma necessidade concreta que o item atende. O destinatário pode ser externo (participantes, assistidos, patrocinadores) ou interno à PREVI (áreas, empregados). Ter um destinatário identificável não determina onde o item fica na organização nem qual estrutura cuida dele.' },
      { pergunta: 'P1', campo: 'textoAjuda.quandoSim',
        de: 'Existe um cliente/público identificável e uma necessidade concreta atendida pelo item.',
        para: 'É possível dizer quem é o público, externo ou interno, e qual necessidade dele o item atende.' },
      { pergunta: 'P1', campo: 'textoAjuda.quandoNao',
        de: 'O item existe principalmente por uma necessidade interna, administrativa, tecnológica ou operacional, sem uma necessidade de cliente claramente identificável.',
        para: 'Não há um público identificável: o item existe por exigência técnica ou operacional, sem alguém que o reconheça como algo que atende a uma necessidade sua. Se o item entrega resultado próprio a esse público, isso é avaliado em P2.' },
      { pergunta: 'P5', campo: 'textoAjuda.significado',
        de: 'Resultado próprio, fronteira e mensuração não bastam: uma funcionalidade dentro de outro Produto/Serviço também pode ter tudo isso sem ser, ela mesma, uma solução independente. Este critério verifica a autonomia estrutural.',
        para: 'Resultado próprio, fronteira e mensuração não bastam: uma funcionalidade dentro de outro Produto/Serviço também pode ter tudo isso sem ser, ela mesma, uma solução independente. Este critério verifica a autonomia estrutural. Avalie o objeto, não a equipe que cuida dele: se essa equipe depende de outras squads, isso é a Autonomia da equipe (S7), na Adequação à Squad.' },
      { pergunta: 'P7', campo: 'textoAjuda.significado',
        de: 'O objetivo não é apenas medir quantidade de tarefas ou volume operacional. Deve ser possível medir se a solução está gerando seu resultado.',
        para: 'O objetivo não é apenas medir quantidade de tarefas ou volume operacional. Deve ser possível medir se a solução está gerando seu resultado. Não é necessário que o indicador exista atualmente nem que alguma equipe seja responsável por acompanhá-lo; isso é avaliado em Indicadores próprios (S3), na Adequação à Squad.' },
      { pergunta: 'P8', campo: 'textoAjuda.significado',
        de: 'Avalie se seria possível atribuir responsabilidade sobre a evolução da solução, seu resultado, suas regras, sua experiência e seu desempenho.',
        para: 'Avalie a coerência do objeto: se propósito, regras, experiência e resultado pertencem a um mesmo todo, a ponto de o item poder ser tratado como uma solução completa. Não avalie se existe hoje um responsável, uma equipe ou uma Squad; isso é tratado na Adequação à Squad.' },
      { pergunta: 'P8', campo: 'textoAjuda.quandoSim',
        de: 'Existe uma unidade coerente passível de gestão ponta a ponta.',
        para: 'Propósito, regras, experiência e resultado do item formam uma unidade coerente, que pode ser tratada como uma solução.' },
      { pergunta: 'P8', campo: 'exemplo',
        de: 'Um cartão consignado pode ter um dono responsável pela sua evolução; "processamento de pagamentos" em geral é transversal demais para isso.',
        para: 'Um cartão consignado reúne contratação, regras, uso e resultado num mesmo todo; "processamento de pagamentos" atravessa várias soluções e não forma um todo próprio.' }
    ]
  },
  {
    id: 'semantica-s1-s8',
    codigo: 'ADEQUACAO_SQUAD',
    titulo: 'S1, S3, S6, S7 e S8 falam de trabalho e equipe, não do que o item é',
    ajustes: [
      { pergunta: 'S1', campo: 'texto',
        de: 'Existe demanda contínua e relevante para essa solução?',
        para: 'Existe demanda contínua e relevante de trabalho sobre este item ou domínio?' },
      { pergunta: 'S1', campo: 'textoAjuda.significado',
        de: 'Avalia se existe fluxo contínuo e relevante de demanda para a solução.',
        para: 'Avalia se há fluxo contínuo e relevante de trabalho (mudanças, melhorias, solicitações) sobre o item ou domínio. Não é a necessidade do cliente, avaliada em P1.' },
      { pergunta: 'S1', campo: 'justSim',
        de: 'SIM — Existe demanda contínua e relevante para esta solução.',
        para: 'SIM — Existe demanda contínua e relevante de trabalho sobre este item ou domínio.' },
      { pergunta: 'S3', campo: 'textoAjuda.significado',
        de: 'Avalia se a equipe conseguiria influenciar diretamente indicadores de resultado próprios.',
        para: 'Avalia se a equipe conseguiria influenciar diretamente indicadores de resultado próprios. Este critério não define a natureza arquitetural do item: um resultado pode existir e ser mensurável (P2, P7) sem um indicador que uma squad consiga mover.' },
      { pergunta: 'S6', campo: 'titulo',
        de: 'Conhecimento/capacidades relativamente estáveis',
        para: 'Conhecimentos e especialidades relativamente estáveis da equipe' },
      { pergunta: 'S6', campo: 'texto',
        de: 'Existe um conjunto relativamente estável de conhecimentos e capacidades necessário para evoluir essa solução?',
        para: 'Existe um conjunto relativamente estável de conhecimentos e especialidades necessário para evoluir este item ou domínio?' },
      { pergunta: 'S6', campo: 'justSim',
        de: 'SIM — Existe um conjunto relativamente estável de conhecimentos e capacidades necessário.',
        para: 'SIM — Existe um conjunto relativamente estável de conhecimentos e especialidades necessário.' },
      { pergunta: 'S6', campo: 'justNao',
        de: 'NÃO — Não existe um conjunto relativamente estável de conhecimentos e capacidades necessário.',
        para: 'NÃO — Não existe um conjunto relativamente estável de conhecimentos e especialidades necessário.' },
      { pergunta: 'S7', campo: 'textoAjuda.significado',
        de: 'Avalia se uma squad conseguiria melhorar o resultado sem depender continuamente de outras squads para praticamente todas as decisões ou entregas.',
        para: 'Avalia se uma squad conseguiria melhorar o resultado sem depender continuamente de outras squads para praticamente todas as decisões ou entregas. Avalie a equipe, não o objeto: um item sem autonomia estrutural (P5 = NÃO), como um Componente, pode ser cuidado por uma equipe autônoma, e um Produto/Serviço autônomo pode ser cuidado por uma equipe que depende de outras squads.' },
      { pergunta: 'S8', campo: 'texto',
        de: 'Existe um responsável claro pelo resultado dessa solução?',
        para: 'Existe um responsável claro pelo resultado deste item ou domínio?' },
      { pergunta: 'S8', campo: 'textoAjuda.significado',
        de: 'Avalia se existe alguém ou uma estrutura de responsabilidade clara pelo resultado da solução.',
        para: 'Avalia se existe hoje alguém ou uma estrutura de responsabilidade clara pelo resultado do item ou domínio. Não confunda com P8, que pergunta se o objeto forma uma solução coerente: um Produto/Serviço pode estar sem responsável claro.' },
      { pergunta: 'S8', campo: 'justSim',
        de: 'SIM — Existe um responsável claro pelo resultado desta solução.',
        para: 'SIM — Existe um responsável claro pelo resultado deste item ou domínio.' },
      { pergunta: 'S8', campo: 'justNao',
        de: 'NÃO — Não existe um responsável claro pelo resultado desta solução.',
        para: 'NÃO — Não existe um responsável claro pelo resultado deste item ou domínio.' }
    ]
  }
];
