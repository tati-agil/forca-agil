/* ============================================================
   Força Ágil — NÚCLEO DECLARATIVO do Motor de Posicionamento Organizacional O1–O9
   (window.faMotorPosicionamentoNucleo; em Node, module.exports)

   H1.1: o algoritmo do motor lendo a versão como DADOS (uma "definição"). A definição v1 reproduz EXATAMENTE
   forca-agil/motor-posicionamento.js nos 531.441 estados (teste-motor-posicionamento-nucleo.js).
   H1-B (H1.2 + H1.3): validarDefinicao, enumeração estruturada, simulação entre versões, o contrato de
   compatibilidade motor × conteúdo do questionário e a definição lógica v2 — INATIVA: a versão em vigor continua
   a 1 (versaoEmVigor).
   H1-Final: o index.html carrega este arquivo (antes de questionarios-config.js) e avaliacao-posicionamento.js o
   usa como motor, com a definição da versão do REGISTRO (versaoMotor; ausente = 1). Nada no site cria registro v2.

   SÓ SIGNIFICADO E REGRAS — NENHUM TEXTO HUMANO. Pergunta, ajuda, exemplos, interpretações, D1, D2 e os rótulos
   das opções são CONTEÚDO do questionário (Questionários e versões, editável e versionado no ADMIN). Aqui ficam só
   os códigos e o que cada um significa; o texto se liga a eles pelo código, e conteudoCompativel prova que um
   conteúdo tem EXATAMENTE a estrutura que a versão do motor exige.

   O SIGNIFICADO DE CADA CÓDIGO É FIXO (regra de domínio, igual para toda versão): O1 é o sinal que leva a LINHA,
   O2 a AREA_ESPECIALIZADA, … (SINAIS); cada opção de D2 aponta sempre para o mesmo papel (OPCOES_PREDOMINANCIA).
   Editar a redação de O1 não muda o que O1 significa; mudar o significado é mudar o motor (este código).

   PURO: sem DOM, sem Firebase, sem autenticação, sem banco; determinístico. Não muda o estado recebido.

   REGRAS FIXAS DE DOMÍNIO (no código; validarDefinicao recusa qualquer definição que as viole):
     - catálogo: 8 resultados firmes; LINHA e PLATAFORMA só como intermediários; 4 tipos de A_VALIDAR;
     - invariante Linha × Squad: Linhas são formadas por Squads; Área Especializada e CoE não. Os 6 firmes do ramo
       Linha → liberaSquad true; AREA_ESPECIALIZADA e COE → false; A_VALIDAR → só com nível LINHA/PLATAFORMA
       confirmado. Nenhuma definição carrega liberaSquad;
     - hierarquia N1 → N2 → N3 e o significado de cada pergunta e de cada opção de D2;
     - ordem do algoritmo: completude do nível antes de tudo; incoerência (SIM fora do caminho) vence qualquer
       conclusão; D1 "distintas" → recorte; D2 só escolhe papel do nível que recebeu SIM; NAO_DETERMINAVEL →
       conflito; N2 sem SIM só encaminha ao N3 (Plataforma só se caracteriza por O6–O9).
   ============================================================ */
(function () {
  'use strict';

  var SIM = 'SIM', NAO = 'NAO';
  var A_VALIDAR = 'A_VALIDAR';
  var QUESTIONARIO = 'POSICIONAMENTO_ORGANIZACIONAL';
  var VERSAO_EM_VIGOR = 1;   /* a troca de versão em vigor é governança (H2), nunca este arquivo sozinho */

  /* ---------- regras fixas de domínio ---------- */
  var CODIGOS_FIRMES = ['AREA_ESPECIALIZADA', 'COE', 'ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS',
    'PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA'];
  var CODIGOS_INTERMEDIARIOS = ['LINHA', 'PLATAFORMA'];
  var TIPOS_A_VALIDAR = ['INCOERENCIA', 'CONFLITO', 'RECORTE', 'EVIDENCIA_INSUFICIENTE'];
  /* invariante Linha × Squad: o ramo Linha é formado por Squads */
  var RAMO_LINHA = ['ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS',
    'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA'];
  function liberaSquadParaCodigoFirme(codigo) {
    if (CODIGOS_FIRMES.indexOf(codigo) === -1) throw new Error('Não é um posicionamento firme: ' + codigo);
    return RAMO_LINHA.indexOf(codigo) !== -1;
  }
  function liberaSquadDoResultado(codigo, nivelConfirmado) {
    if (codigo === A_VALIDAR) return nivelConfirmado === 'LINHA' || nivelConfirmado === 'PLATAFORMA';
    return liberaSquadParaCodigoFirme(codigo);
  }
  /* o significado fixo de cada pergunta: nível e o papel que o SIM sinaliza */
  var NIVEIS_FIXOS = ['N1', 'N2', 'N3'];
  var SINAIS = {
    O1: { nivel: 'N1', papel: 'LINHA' }, O2: { nivel: 'N1', papel: 'AREA_ESPECIALIZADA' }, O3: { nivel: 'N1', papel: 'COE' },
    O4: { nivel: 'N2', papel: 'ESTRATEGIA_CLIENTES' }, O5: { nivel: 'N2', papel: 'NEGOCIOS' },
    O6: { nivel: 'N3', papel: 'PLATAFORMA_CANAIS' }, O7: { nivel: 'N3', papel: 'PLATAFORMA_HABILITADORA_NEGOCIOS' },
    O8: { nivel: 'N3', papel: 'PLATAFORMA_HABILITADORA_TECNOLOGIA' }, O9: { nivel: 'N3', papel: 'PLATAFORMA_CORPORATIVA' }
  };
  /* D1 e D2: códigos estáveis; o significado de cada opção de D2 (o papel para o qual aponta) é fixo */
  var D1 = 'DIAG_CONFLITO_RECORTE';
  var D1_RESPOSTAS = ['mesma', 'distintas'];
  var NAO_DETERMINAVEL = 'NAO_DETERMINAVEL';
  var D2_POR_NIVEL = { N1: 'DIAG_PREDOMINANCIA_N1', N2: 'DIAG_PREDOMINANCIA_N2', N3: 'DIAG_PREDOMINANCIA_N3' };
  var OPCOES_PREDOMINANCIA = {
    N1: { RESULTADO_INTEGRADO: 'LINHA', EXECUCAO_ESPECIALIZADA: 'AREA_ESPECIALIZADA', CAPACIDADE_NOS_OUTROS: 'COE' },
    N2: { ESTRATEGIA_PARA_CLIENTES: 'ESTRATEGIA_CLIENTES', RESULTADO_DE_NEGOCIO: 'NEGOCIOS' },
    N3: { INTERACAO_ACESSO_DISTRIBUICAO: 'PLATAFORMA_CANAIS', CAPACIDADE_DE_NEGOCIO: 'PLATAFORMA_HABILITADORA_NEGOCIOS',
      CAPACIDADE_TECNOLOGICA: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', CAPACIDADE_INTERNA_CORPORATIVA: 'PLATAFORMA_CORPORATIVA' }
  };
  /* tipos estruturais das perguntas do questionário (os mesmos de questionarios-config.js; o de D2 é novo) */
  var TIPO_BINARIA = 'binaria', TIPO_D1 = 'diagnostico-conflito-recorte', TIPO_D2 = 'diagnostico-predominancia';
  /* motivos conhecidos pelo domínio (v1 histórica + v2) e o tipo de A_VALIDAR que cada um exige */
  var MOTIVO_TIPO = {
    SIM_FORA_DO_CAMINHO: 'INCOERENCIA', RESPOSTA_FALTANDO: 'EVIDENCIA_INSUFICIENTE', SEM_PAPEL: 'EVIDENCIA_INSUFICIENTE',
    DIAGNOSTICO_PENDENTE: 'EVIDENCIA_INSUFICIENTE', PREDOMINANCIA_PENDENTE: 'EVIDENCIA_INSUFICIENTE',
    TRES_OU_MAIS_PAPEIS: 'RECORTE', DIAGNOSTICO_DISTINTAS: 'RECORTE', DIAGNOSTICO_MESMA: 'CONFLITO', PREDOMINANCIA_INDEFINIDA: 'CONFLITO',
    PAPEL_UNICO: null, PREDOMINANCIA: null   /* motivos de resultado firme */
  };

  function congelar(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.keys(o).forEach(function (k) { congelar(o[k]); });
      Object.freeze(o);
    }
    return o;
  }

  /* ---------- as definições (dados lógicos; nenhum texto humano) ----------
     niveis[], na ordem do caminho. Por nível:
       perguntas: [{ codigo, papel, regraUnico?, aoUnico? }] — papel = o que o SIM sinaliza (fixo: SINAIS);
         regraUnico = regra da saída firme quando ela é o ÚNICO SIM do nível; aoUnico = { desce, confirma } (O1);
       confirmaComSim — com algum SIM neste nível, o nível confirmado passa a ser este (Plataforma no N3);
       semSim — 0 SIM: { desce: true } ou { aValidar: { tipo, motivo, regra } };
       respostaFaltando, tresOuMais (só v1) — { tipo, motivo, regra };
       diagnostico (D1) — aplicaCom 'dois' (v1: exatamente 2 SIM; 3+ é tresOuMais) ou 'doisOuMais' (v2);
         mesma → saída A_VALIDAR (v1) ou { predominancia: true } (v2: vai para D2); distintas; ausente;
       predominancia (D2, só v2) — opcoes [{ codigo, papel, regra? | desce+confirma }], indeterminado, pendente.
     regras: catálogo dos identificadores que a versão registra (v1 traz também a descrição histórica). */
  var V1 = congelar({
    versao: 1,
    desde: '2026-10-08',
    questionario: 'POSICIONAMENTO_ORGANIZACIONAL',
    respostas: [SIM, NAO],
    diagnostico: { codigo: 'DIAG_CONFLITO_RECORTE', respostas: ['mesma', 'distintas'] },
    incoerencia: { tipo: 'INCOERENCIA', motivo: 'SIM_FORA_DO_CAMINHO', regra: 'DEF_SIM_FORA_DO_CAMINHO' },
    niveis: [
      { id: 'N1',
        perguntas: [
          { codigo: 'O1', papel: 'LINHA', aoUnico: { desce: true, confirma: 'LINHA' } },
          { codigo: 'O2', papel: 'AREA_ESPECIALIZADA', regraUnico: 'N1_AREA_ESPECIALIZADA' },
          { codigo: 'O3', papel: 'COE', regraUnico: 'N1_COE' }
        ],
        respostaFaltando: { tipo: 'EVIDENCIA_INSUFICIENTE', motivo: 'RESPOSTA_FALTANDO', regra: 'N1_RESPOSTA_FALTANDO' },
        tresOuMais: { tipo: 'RECORTE', motivo: 'TRES_OU_MAIS_PAPEIS', regra: 'N1_RECORTE' },
        diagnostico: {
          aplicaCom: 'dois',
          mesma: { tipo: 'CONFLITO', motivo: 'DIAGNOSTICO_MESMA', regra: 'N1_CONFLITO' },
          distintas: { tipo: 'RECORTE', motivo: 'DIAGNOSTICO_DISTINTAS', regra: 'N1_RECORTE_DIAGNOSTICO' },
          ausente: { tipo: 'EVIDENCIA_INSUFICIENTE', motivo: 'DIAGNOSTICO_PENDENTE', regra: 'N1_DIAGNOSTICO_PENDENTE' }
        },
        semSim: { aValidar: { tipo: 'EVIDENCIA_INSUFICIENTE', motivo: 'SEM_PAPEL', regra: 'N1_SEM_PAPEL' } } },
      { id: 'N2',
        perguntas: [
          { codigo: 'O4', papel: 'ESTRATEGIA_CLIENTES', regraUnico: 'N2_ESTRATEGIA_CLIENTES' },
          { codigo: 'O5', papel: 'NEGOCIOS', regraUnico: 'N2_NEGOCIOS' }
        ],
        respostaFaltando: { tipo: 'EVIDENCIA_INSUFICIENTE', motivo: 'RESPOSTA_FALTANDO', regra: 'N2_RESPOSTA_FALTANDO' },
        diagnostico: {
          aplicaCom: 'dois',
          mesma: { tipo: 'CONFLITO', motivo: 'DIAGNOSTICO_MESMA', regra: 'N2_CONFLITO' },
          distintas: { tipo: 'RECORTE', motivo: 'DIAGNOSTICO_DISTINTAS', regra: 'N2_RECORTE_DIAGNOSTICO' },
          ausente: { tipo: 'EVIDENCIA_INSUFICIENTE', motivo: 'DIAGNOSTICO_PENDENTE', regra: 'N2_DIAGNOSTICO_PENDENTE' }
        },
        semSim: { desce: true } },
      { id: 'N3',
        confirmaComSim: 'PLATAFORMA',
        perguntas: [
          { codigo: 'O6', papel: 'PLATAFORMA_CANAIS', regraUnico: 'N3_PLATAFORMA_CANAIS' },
          { codigo: 'O7', papel: 'PLATAFORMA_HABILITADORA_NEGOCIOS', regraUnico: 'N3_PLATAFORMA_HABILITADORA_NEGOCIOS' },
          { codigo: 'O8', papel: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', regraUnico: 'N3_PLATAFORMA_HABILITADORA_TECNOLOGIA' },
          { codigo: 'O9', papel: 'PLATAFORMA_CORPORATIVA', regraUnico: 'N3_PLATAFORMA_CORPORATIVA' }
        ],
        respostaFaltando: { tipo: 'EVIDENCIA_INSUFICIENTE', motivo: 'RESPOSTA_FALTANDO', regra: 'N3_RESPOSTA_FALTANDO' },
        tresOuMais: { tipo: 'RECORTE', motivo: 'TRES_OU_MAIS_PAPEIS', regra: 'N3_RECORTE' },
        diagnostico: {
          aplicaCom: 'dois',
          mesma: { tipo: 'CONFLITO', motivo: 'DIAGNOSTICO_MESMA', regra: 'N3_CONFLITO' },
          distintas: { tipo: 'RECORTE', motivo: 'DIAGNOSTICO_DISTINTAS', regra: 'N3_RECORTE_DIAGNOSTICO' },
          ausente: { tipo: 'EVIDENCIA_INSUFICIENTE', motivo: 'DIAGNOSTICO_PENDENTE', regra: 'N3_DIAGNOSTICO_PENDENTE' }
        },
        semSim: { aValidar: { tipo: 'EVIDENCIA_INSUFICIENTE', motivo: 'SEM_PAPEL', regra: 'N3_SEM_PAPEL' } } }
    ],
    /* catálogo (o que a v1 pode registrar) — descrições para leitura humana, nunca chave lógica */
    regras: {
      DEF_SIM_FORA_DO_CAMINHO: 'Algum SIM gravado fora do caminho alcançado → incoerência',
      N1_RESPOSTA_FALTANDO: 'Nível 1 incompleto → evidência insuficiente',
      N1_RECORTE: 'Nível 1 com O1, O2 e O3 = SIM → recorte',
      N1_CONFLITO: 'Nível 1 com 2 papéis, diagnóstico "mesma" → conflito',
      N1_RECORTE_DIAGNOSTICO: 'Nível 1 com 2 papéis, diagnóstico "distintas" → recorte',
      N1_DIAGNOSTICO_PENDENTE: 'Nível 1 com 2 papéis, sem diagnóstico → evidência insuficiente',
      N1_AREA_ESPECIALIZADA: 'Só O2 = SIM → Área Especializada',
      N1_COE: 'Só O3 = SIM → CoE',
      N1_SEM_PAPEL: 'O1, O2 e O3 = NAO → evidência insuficiente',
      N2_RESPOSTA_FALTANDO: 'Linha confirmada, Nível 2 incompleto → evidência insuficiente',
      N2_CONFLITO: 'O4 e O5 = SIM, diagnóstico "mesma" → conflito',
      N2_RECORTE_DIAGNOSTICO: 'O4 e O5 = SIM, diagnóstico "distintas" → recorte',
      N2_DIAGNOSTICO_PENDENTE: 'O4 e O5 = SIM, sem diagnóstico → evidência insuficiente',
      N2_ESTRATEGIA_CLIENTES: 'Linha + só O4 = SIM → Linha de Estratégia de Clientes',
      N2_NEGOCIOS: 'Linha + só O5 = SIM → Linha de Negócios',
      N3_RESPOSTA_FALTANDO: 'Ramo Plataforma, Nível 3 incompleto → evidência insuficiente',
      N3_RECORTE: 'Nível 3 com 3 ou mais papéis → recorte',
      N3_CONFLITO: 'Nível 3 com 2 papéis, diagnóstico "mesma" → conflito',
      N3_RECORTE_DIAGNOSTICO: 'Nível 3 com 2 papéis, diagnóstico "distintas" → recorte',
      N3_DIAGNOSTICO_PENDENTE: 'Nível 3 com 2 papéis, sem diagnóstico → evidência insuficiente',
      N3_PLATAFORMA_CANAIS: 'Ramo Plataforma + só O6 = SIM → Plataforma de Canais',
      N3_PLATAFORMA_HABILITADORA_NEGOCIOS: 'Ramo Plataforma + só O7 = SIM → Plataforma Habilitadora de Negócios',
      N3_PLATAFORMA_HABILITADORA_TECNOLOGIA: 'Ramo Plataforma + só O8 = SIM → Plataforma Habilitadora de Tecnologia',
      N3_PLATAFORMA_CORPORATIVA: 'Ramo Plataforma + só O9 = SIM → Plataforma de Gestão Corporativa',
      N3_SEM_PAPEL: 'Ramo Plataforma com O6–O9 = NAO → evidência insuficiente'
    },
    motivos: ['SIM_FORA_DO_CAMINHO', 'RESPOSTA_FALTANDO', 'TRES_OU_MAIS_PAPEIS', 'DIAGNOSTICO_MESMA',
      'DIAGNOSTICO_DISTINTAS', 'DIAGNOSTICO_PENDENTE', 'PAPEL_UNICO', 'SEM_PAPEL']
  });

  /* v2 (H1-B) — INATIVA. D1 com 2 ou mais SIM; "mesma" → D2 de predominância; 3+ SIM não é mais recorte direto. */
  function saida(tipo, motivo, regra) { return { tipo: tipo, motivo: motivo, regra: regra }; }
  function nivelV2(id, perguntas, opcoes, extra) {
    var n = {
      id: id,
      perguntas: perguntas,
      respostaFaltando: saida('EVIDENCIA_INSUFICIENTE', 'RESPOSTA_FALTANDO', id + '_RESPOSTA_FALTANDO'),
      diagnostico: {
        aplicaCom: 'doisOuMais',
        mesma: { predominancia: true },
        distintas: saida('RECORTE', 'DIAGNOSTICO_DISTINTAS', id + '_RECORTE_DIAGNOSTICO'),
        ausente: saida('EVIDENCIA_INSUFICIENTE', 'DIAGNOSTICO_PENDENTE', id + '_DIAGNOSTICO_PENDENTE')
      },
      predominancia: {
        opcoes: opcoes,
        indeterminado: saida('CONFLITO', 'PREDOMINANCIA_INDEFINIDA', id + '_PREDOMINANCIA_INDEFINIDA'),
        pendente: saida('EVIDENCIA_INSUFICIENTE', 'PREDOMINANCIA_PENDENTE', id + '_PREDOMINANCIA_PENDENTE')
      }
    };
    Object.keys(extra).forEach(function (k) { n[k] = extra[k]; });
    return n;
  }
  var V2 = congelar({
    versao: 2,
    desde: null,                       /* inativa: nunca entrou em vigor */
    questionario: QUESTIONARIO,
    respostas: [SIM, NAO],
    diagnostico: { codigo: D1, respostas: D1_RESPOSTAS.slice() },
    incoerencia: saida('INCOERENCIA', 'SIM_FORA_DO_CAMINHO', 'DEF_SIM_FORA_DO_CAMINHO'),
    niveis: [
      nivelV2('N1', [
        { codigo: 'O1', papel: 'LINHA', aoUnico: { desce: true, confirma: 'LINHA' } },
        { codigo: 'O2', papel: 'AREA_ESPECIALIZADA', regraUnico: 'N1_AREA_ESPECIALIZADA' },
        { codigo: 'O3', papel: 'COE', regraUnico: 'N1_COE' }
      ], [
        { codigo: 'RESULTADO_INTEGRADO', papel: 'LINHA', desce: true, confirma: 'LINHA' },
        { codigo: 'EXECUCAO_ESPECIALIZADA', papel: 'AREA_ESPECIALIZADA', regra: 'N1_PREDOMINANCIA_AREA_ESPECIALIZADA' },
        { codigo: 'CAPACIDADE_NOS_OUTROS', papel: 'COE', regra: 'N1_PREDOMINANCIA_COE' }
      ], { semSim: { aValidar: saida('EVIDENCIA_INSUFICIENTE', 'SEM_PAPEL', 'N1_SEM_PAPEL') } }),
      nivelV2('N2', [
        { codigo: 'O4', papel: 'ESTRATEGIA_CLIENTES', regraUnico: 'N2_ESTRATEGIA_CLIENTES' },
        { codigo: 'O5', papel: 'NEGOCIOS', regraUnico: 'N2_NEGOCIOS' }
      ], [
        { codigo: 'ESTRATEGIA_PARA_CLIENTES', papel: 'ESTRATEGIA_CLIENTES', regra: 'N2_PREDOMINANCIA_ESTRATEGIA_CLIENTES' },
        { codigo: 'RESULTADO_DE_NEGOCIO', papel: 'NEGOCIOS', regra: 'N2_PREDOMINANCIA_NEGOCIOS' }
      ], { semSim: { desce: true } }),   /* candidato a Plataforma: nada é confirmado aqui */
      nivelV2('N3', [
        { codigo: 'O6', papel: 'PLATAFORMA_CANAIS', regraUnico: 'N3_PLATAFORMA_CANAIS' },
        { codigo: 'O7', papel: 'PLATAFORMA_HABILITADORA_NEGOCIOS', regraUnico: 'N3_PLATAFORMA_HABILITADORA_NEGOCIOS' },
        { codigo: 'O8', papel: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', regraUnico: 'N3_PLATAFORMA_HABILITADORA_TECNOLOGIA' },
        { codigo: 'O9', papel: 'PLATAFORMA_CORPORATIVA', regraUnico: 'N3_PLATAFORMA_CORPORATIVA' }
      ], [
        { codigo: 'INTERACAO_ACESSO_DISTRIBUICAO', papel: 'PLATAFORMA_CANAIS', regra: 'N3_PREDOMINANCIA_PLATAFORMA_CANAIS' },
        { codigo: 'CAPACIDADE_DE_NEGOCIO', papel: 'PLATAFORMA_HABILITADORA_NEGOCIOS', regra: 'N3_PREDOMINANCIA_PLATAFORMA_HABILITADORA_NEGOCIOS' },
        { codigo: 'CAPACIDADE_TECNOLOGICA', papel: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', regra: 'N3_PREDOMINANCIA_PLATAFORMA_HABILITADORA_TECNOLOGIA' },
        { codigo: 'CAPACIDADE_INTERNA_CORPORATIVA', papel: 'PLATAFORMA_CORPORATIVA', regra: 'N3_PREDOMINANCIA_PLATAFORMA_CORPORATIVA' }
      ], { confirmaComSim: 'PLATAFORMA', semSim: { aValidar: saida('EVIDENCIA_INSUFICIENTE', 'SEM_PAPEL', 'N3_SEM_PAPEL') } })
    ],
    regras: ['DEF_SIM_FORA_DO_CAMINHO',
      'N1_RESPOSTA_FALTANDO', 'N1_SEM_PAPEL', 'N1_AREA_ESPECIALIZADA', 'N1_COE', 'N1_DIAGNOSTICO_PENDENTE', 'N1_RECORTE_DIAGNOSTICO',
      'N1_PREDOMINANCIA_PENDENTE', 'N1_PREDOMINANCIA_INDEFINIDA', 'N1_PREDOMINANCIA_AREA_ESPECIALIZADA', 'N1_PREDOMINANCIA_COE',
      'N2_RESPOSTA_FALTANDO', 'N2_ESTRATEGIA_CLIENTES', 'N2_NEGOCIOS', 'N2_DIAGNOSTICO_PENDENTE', 'N2_RECORTE_DIAGNOSTICO',
      'N2_PREDOMINANCIA_PENDENTE', 'N2_PREDOMINANCIA_INDEFINIDA', 'N2_PREDOMINANCIA_ESTRATEGIA_CLIENTES', 'N2_PREDOMINANCIA_NEGOCIOS',
      'N3_RESPOSTA_FALTANDO', 'N3_SEM_PAPEL', 'N3_PLATAFORMA_CANAIS', 'N3_PLATAFORMA_HABILITADORA_NEGOCIOS',
      'N3_PLATAFORMA_HABILITADORA_TECNOLOGIA', 'N3_PLATAFORMA_CORPORATIVA', 'N3_DIAGNOSTICO_PENDENTE', 'N3_RECORTE_DIAGNOSTICO',
      'N3_PREDOMINANCIA_PENDENTE', 'N3_PREDOMINANCIA_INDEFINIDA', 'N3_PREDOMINANCIA_PLATAFORMA_CANAIS',
      'N3_PREDOMINANCIA_PLATAFORMA_HABILITADORA_NEGOCIOS', 'N3_PREDOMINANCIA_PLATAFORMA_HABILITADORA_TECNOLOGIA',
      'N3_PREDOMINANCIA_PLATAFORMA_CORPORATIVA'],
    motivos: ['SIM_FORA_DO_CAMINHO', 'RESPOSTA_FALTANDO', 'SEM_PAPEL', 'DIAGNOSTICO_PENDENTE', 'DIAGNOSTICO_DISTINTAS',
      'PREDOMINANCIA_PENDENTE', 'PREDOMINANCIA_INDEFINIDA', 'PAPEL_UNICO', 'PREDOMINANCIA']
  });

  function exigirDefinicao(def) {
    if (!def || typeof def !== 'object' || typeof def.versao !== 'number' || !Array.isArray(def.niveis)) {
      throw new Error('Definição do motor de posicionamento inválida');
    }
    return def;
  }

  /* ---------- leitura das entradas (ausente/inválido = ausente; nunca vira NAO) ---------- */
  function resposta(def, respostas, q) {
    var v = respostas && respostas[q];
    return def.respostas.indexOf(v) !== -1 ? v : null;
  }
  function respostaDiagnostico(def, diagnosticos, nivel) {
    var v = diagnosticos && diagnosticos[nivel];
    return def.diagnostico.respostas.indexOf(v) !== -1 ? v : null;
  }
  function codigosDo(N) { return N.perguntas.map(function (p) { return p.codigo; }); }
  function papelDe(def, q) {
    for (var i = 0; i < def.niveis.length; i++) {
      for (var j = 0; j < def.niveis[i].perguntas.length; j++) if (def.niveis[i].perguntas[j].codigo === q) return def.niveis[i].perguntas[j].papel;
    }
    throw new Error('Pergunta fora da definição: ' + q);
  }
  /* o diagnóstico D1 entra com quantos SIM: exatamente 2 (v1) ou 2 ou mais (v2) */
  function d1Aplica(N, nSims) {
    if (!N.diagnostico) return false;
    return N.diagnostico.aplicaCom === 'doisOuMais' ? nSims >= 2 : nSims === 2;
  }
  /* a opção de D2 escolhida, só se for NAO_DETERMINAVEL ou a de um papel que recebeu SIM; senão, ausente */
  function opcaoD2(N, predominancias, papeisSim) {
    var v = predominancias && predominancias[N.id];
    if (v === NAO_DETERMINAVEL) return { indeterminado: true };
    var op = N.predominancia.opcoes.filter(function (o) { return o.codigo === v; })[0];
    return op && papeisSim.indexOf(op.papel) !== -1 ? op : null;
  }

  /* ---------- o algoritmo (fixo; só lê a definição) ---------- */
  function percorrer(def, respostas, diagnosticos, predominancias) {
    var nivelConfirmado = null, conclusao = null, alcancados = [];
    for (var i = 0; i < def.niveis.length && !conclusao; i++) {
      var N = def.niveis[i];
      alcancados.push(N.id);
      var simsP = N.perguntas.filter(function (p) { return resposta(def, respostas, p.codigo) === SIM; });
      var papeis = simsP.map(function (p) { return p.papel; });
      if (N.confirmaComSim && simsP.length) nivelConfirmado = N.confirmaComSim;
      /* completude do nível antes de tudo */
      if (N.perguntas.some(function (p) { return resposta(def, respostas, p.codigo) === null; })) {
        conclusao = aValidar(N.respostaFaltando, papeis); break;
      }
      if (simsP.length >= 3 && !d1Aplica(N, simsP.length)) { conclusao = aValidar(exigir(N.tresOuMais, N.id, '3 ou mais SIM'), papeis); break; }
      if (d1Aplica(N, simsP.length)) {
        var dg = N.diagnostico, d = respostaDiagnostico(def, diagnosticos, N.id);
        if (d === 'distintas') { conclusao = aValidar(dg.distintas, papeis); break; }
        if (d !== 'mesma') { conclusao = aValidar(dg.ausente, papeis); break; }
        if (!dg.mesma.predominancia) { conclusao = aValidar(dg.mesma, papeis); break; }
        /* D2: qual natureza predomina, entre as que receberam SIM */
        var op = opcaoD2(N, predominancias, papeis);
        if (!op) { conclusao = aValidar(N.predominancia.pendente, papeis); break; }
        if (op.indeterminado) { conclusao = aValidar(N.predominancia.indeterminado, papeis); break; }
        if (op.desce) { nivelConfirmado = op.confirma; continue; }
        conclusao = { codigoResultado: op.papel, tipoAValidar: null, motivo: 'PREDOMINANCIA', regra: op.regra, papeisDetectados: papeis.slice() };
        break;
      }
      if (!simsP.length) {
        if (N.semSim.desce) continue;
        conclusao = aValidar(N.semSim.aValidar, []); break;
      }
      var unico = simsP[0];
      if (unico.aoUnico && unico.aoUnico.desce) { nivelConfirmado = unico.aoUnico.confirma; continue; }
      conclusao = { codigoResultado: unico.papel, tipoAValidar: null, motivo: 'PAPEL_UNICO', regra: unico.regraUnico, papeisDetectados: [unico.papel] };
    }
    if (!conclusao) throw new Error('A definição terminou o caminho sem conclusão');
    return { conclusao: conclusao, nivelConfirmado: nivelConfirmado, alcancados: alcancados };
  }
  function exigir(s, nivel, caso) {
    if (!s) throw new Error('Definição sem saída para ' + caso + ' no nível ' + nivel);
    return s;
  }
  function aValidar(s, papeis) {
    return { codigoResultado: A_VALIDAR, tipoAValidar: s.tipo, motivo: s.motivo, regra: s.regra, papeisDetectados: papeis.slice() };
  }
  function montar(def, c, nivelConfirmado, alcancados) {
    return {
      codigoResultado: c.codigoResultado,
      tipoAValidar: c.tipoAValidar,
      motivo: c.motivo,
      nivelConfirmado: nivelConfirmado,
      papeisDetectados: c.papeisDetectados,
      regra: c.regra,
      versaoMotor: def.versao,
      liberaSquad: liberaSquadDoResultado(c.codigoResultado, nivelConfirmado),
      niveisAlcancados: alcancados.slice(),
      perguntasForaDoCaminho: c.perguntasForaDoCaminho || []
    };
  }

  /* avaliar(def, respostas, diagnosticos, predominancias?) → o mesmo objeto do motor atual.
     respostas { O1..O9: SIM|NAO }; diagnosticos { N1..N3: mesma|distintas } (D1); predominancias { N1..N3: código
     da opção de D2 ou NAO_DETERMINAVEL } (só lido por definição com D2; a v1 o ignora). */
  function avaliar(def, respostas, diagnosticos, predominancias) {
    exigirDefinicao(def);
    var p = percorrer(def, respostas, diagnosticos, predominancias);
    /* SIM num nível que o caminho não alcançou → incoerência (vence qualquer conclusão) */
    var fora = [];
    def.niveis.forEach(function (N) {
      if (p.alcancados.indexOf(N.id) !== -1) return;
      codigosDo(N).forEach(function (q) { if (resposta(def, respostas, q) === SIM) fora.push(q); });
    });
    if (fora.length) {
      return montar(def, { codigoResultado: A_VALIDAR, tipoAValidar: def.incoerencia.tipo, motivo: def.incoerencia.motivo, regra: def.incoerencia.regra,
        papeisDetectados: fora.map(function (q) { return papelDe(def, q); }), perguntasForaDoCaminho: fora }, null, p.alcancados);
    }
    var c = p.conclusao;
    return montar(def, c, c.codigoResultado === A_VALIDAR ? p.nivelConfirmado : null, p.alcancados);
  }
  function perguntasDoCaminho(def, respostas, diagnosticos, predominancias) {
    var r = avaliar(def, respostas, diagnosticos, predominancias), out = [];
    def.niveis.forEach(function (N) { if (r.niveisAlcancados.indexOf(N.id) !== -1) out = out.concat(codigosDo(N)); });
    return out;
  }
  function simsDoNivelCompleto(def, N, respostas) {
    var qs = codigosDo(N);
    if (qs.some(function (q) { return resposta(def, respostas, q) === null; })) return null;
    return N.perguntas.filter(function (p) { return resposta(def, respostas, p.codigo) === SIM; });
  }
  /* níveis cujo D1 faz parte da avaliação: alcançado, completo e com os SIM que acionam D1 */
  function diagnosticosNecessarios(def, respostas, diagnosticos, predominancias) {
    var r = avaliar(def, respostas, diagnosticos, predominancias);
    return def.niveis.filter(function (N) {
      if (r.niveisAlcancados.indexOf(N.id) === -1) return false;
      var s = simsDoNivelCompleto(def, N, respostas);
      return !!s && d1Aplica(N, s.length);
    }).map(function (N) { return N.id; });
  }
  /* D2 que faz parte da avaliação: D1 necessário e respondido "mesma", numa definição com D2; com as opções que a
     tela pode oferecer (só as dos papéis que receberam SIM, mais NAO_DETERMINAVEL) */
  function predominanciasNecessarias(def, respostas, diagnosticos, predominancias) {
    var precisa = diagnosticosNecessarios(def, respostas, diagnosticos, predominancias);
    return def.niveis.filter(function (N) {
      return precisa.indexOf(N.id) !== -1 && N.predominancia && N.diagnostico.mesma.predominancia && respostaDiagnostico(def, diagnosticos, N.id) === 'mesma';
    }).map(function (N) {
      var papeis = simsDoNivelCompleto(def, N, respostas).map(function (p) { return p.papel; });
      return { nivel: N.id, opcoes: N.predominancia.opcoes.filter(function (o) { return papeis.indexOf(o.papel) !== -1; }).map(function (o) { return o.codigo; }).concat([NAO_DETERMINAVEL]) };
    });
  }

  /* ============================================================
     validarDefinicao(def) → { valida, erros: [{ codigo, onde, detalhe }] }
     Recusa qualquer definição que viole as regras fixas de domínio. Campos fora do contrato (texto humano,
     liberaSquad, ramo Linha, qualquer outro) são recusados — a definição é só lógica.
     ============================================================ */
  var CAMPOS = {
    raiz: ['versao', 'desde', 'questionario', 'respostas', 'diagnostico', 'incoerencia', 'niveis', 'regras', 'motivos'],
    nivel: ['id', 'perguntas', 'respostaFaltando', 'tresOuMais', 'diagnostico', 'predominancia', 'semSim', 'confirmaComSim'],
    pergunta: ['codigo', 'papel', 'regraUnico', 'aoUnico'],
    saida: ['tipo', 'motivo', 'regra'],
    d1: ['aplicaCom', 'mesma', 'distintas', 'ausente'],
    d2: ['opcoes', 'indeterminado', 'pendente'],
    opcao: ['codigo', 'papel', 'regra', 'desce', 'confirma']
  };
  function validarDefinicao(def) {
    var erros = [];
    function erro(codigo, onde, detalhe) { erros.push({ codigo: codigo, onde: onde, detalhe: detalhe || null }); }
    function soCampos(o, lista, onde) {
      if (!o || typeof o !== 'object' || Array.isArray(o)) { erro('E_ESTRUTURA', onde, 'esperado objeto'); return false; }
      Object.keys(o).forEach(function (k) {
        if (/libera|squad|ramo|delinha/i.test(k)) erro('E_LINHA_SQUAD', onde + '.' + k, 'o invariante Linha × Squad não é configurável');
        else if (lista.indexOf(k) === -1) erro('E_CAMPO_DESCONHECIDO', onde + '.' + k, 'fora do contrato da definição (texto e configuração não entram aqui)');
      });
      return true;
    }
    var regrasUsadas = [], motivosUsados = {};
    function conferirSaida(s, onde, tipo, motivo) {
      if (!soCampos(s, CAMPOS.saida, onde)) return;
      if (TIPOS_A_VALIDAR.indexOf(s.tipo) === -1) erro('E_TIPO', onde, s.tipo);
      if (!Object.prototype.hasOwnProperty.call(MOTIVO_TIPO, s.motivo)) erro('E_MOTIVO', onde, s.motivo);
      else if (MOTIVO_TIPO[s.motivo] !== s.tipo) erro('E_MOTIVO_TIPO', onde, s.motivo + ' exige ' + MOTIVO_TIPO[s.motivo]);
      if (tipo && s.tipo !== tipo) erro('E_DESFECHO', onde, 'exigido ' + tipo + ', veio ' + s.tipo);
      if (motivo && s.motivo !== motivo) erro('E_DESFECHO', onde, 'exigido motivo ' + motivo + ', veio ' + s.motivo);
      regrasUsadas.push([s.regra, onde]); motivosUsados[s.motivo] = true;
    }
    /* dados puros: nada de função, undefined, NaN, Infinity ou ciclo (determinismo) */
    var vistos = [];
    (function puro(o, onde) {
      if (typeof o === 'function' || typeof o === 'symbol' || typeof o === 'bigint' || o === undefined) { erro('E_DADOS', onde, typeof o); return; }
      if (typeof o === 'number' && !isFinite(o)) { erro('E_DADOS', onde, String(o)); return; }
      if (o && typeof o === 'object') {
        if (vistos.indexOf(o) !== -1) { erro('E_DADOS', onde, 'ciclo'); return; }
        vistos.push(o);
        Object.keys(o).forEach(function (k) { puro(o[k], onde + '.' + k); });
      }
    })(def, 'def');
    if (erros.length) return { valida: false, erros: erros };
    if (!soCampos(def, CAMPOS.raiz, 'def')) return { valida: false, erros: erros };
    if (typeof def.versao !== 'number' || def.versao < 1 || Math.floor(def.versao) !== def.versao) erro('E_VERSAO', 'def.versao', def.versao);
    if (def.questionario !== QUESTIONARIO) erro('E_QUESTIONARIO', 'def.questionario', def.questionario);
    if (JSON.stringify(def.respostas) !== JSON.stringify([SIM, NAO])) erro('E_RESPOSTAS', 'def.respostas');
    if (soCampos(def.diagnostico, ['codigo', 'respostas'], 'def.diagnostico')) {
      if (def.diagnostico.codigo !== D1 || JSON.stringify(def.diagnostico.respostas) !== JSON.stringify(D1_RESPOSTAS)) erro('E_D1', 'def.diagnostico', 'D1 tem código e respostas fixos');
    }
    conferirSaida(def.incoerencia, 'def.incoerencia', 'INCOERENCIA', 'SIM_FORA_DO_CAMINHO');
    if (!Array.isArray(def.niveis) || JSON.stringify(def.niveis.map(function (N) { return N && N.id; })) !== JSON.stringify(NIVEIS_FIXOS)) {
      erro('E_HIERARQUIA', 'def.niveis', 'exatamente N1, N2, N3, nesta ordem');
      return { valida: false, erros: erros };
    }
    var codigosVistos = {};
    def.niveis.forEach(function (N, i) {
      var onde = 'def.niveis[' + N.id + ']';
      if (!soCampos(N, CAMPOS.nivel, onde)) return;
      /* perguntas: o significado de cada código é fixo */
      if (!Array.isArray(N.perguntas)) { erro('E_ESTRUTURA', onde + '.perguntas'); return; }
      var esperadas = Object.keys(SINAIS).filter(function (q) { return SINAIS[q].nivel === N.id; });
      N.perguntas.forEach(function (p, j) {
        var op = onde + '.perguntas[' + j + ']';
        if (!soCampos(p, CAMPOS.pergunta, op)) return;
        if (codigosVistos[p.codigo]) erro('E_CODIGO_DUPLICADO', op, p.codigo);
        codigosVistos[p.codigo] = true;
        if (!SINAIS[p.codigo] || SINAIS[p.codigo].nivel !== N.id || SINAIS[p.codigo].papel !== p.papel) erro('E_SINAL', op, p.codigo + ' → ' + p.papel + ' não é o significado fixo do código');
        if (p.papel === 'LINHA') {
          if (p.regraUnico || !p.aoUnico || p.aoUnico.desce !== true || p.aoUnico.confirma !== 'LINHA' || Object.keys(p.aoUnico).length !== 2) erro('E_INTERMEDIARIO', op, 'LINHA só confirma o nível e desce; nunca é resultado');
        } else {
          if (p.aoUnico) erro('E_INTERMEDIARIO', op, 'só O1 (LINHA) desce');
          if (CODIGOS_FIRMES.indexOf(p.papel) === -1 || !p.regraUnico) erro('E_FIRME', op, 'papel único precisa ser firme e ter regra');
          else regrasUsadas.push([p.regraUnico, op]);
        }
      });
      if (JSON.stringify(N.perguntas.map(function (p) { return p && p.codigo; })) !== JSON.stringify(esperadas)) erro('E_SINAL', onde + '.perguntas', 'o nível precisa ter exatamente ' + esperadas.join(', '));
      /* completude */
      conferirSaida(N.respostaFaltando, onde + '.respostaFaltando', 'EVIDENCIA_INSUFICIENTE', 'RESPOSTA_FALTANDO');
      /* Plataforma: só o N3 confirma, e só com SIM em O6–O9 */
      if (N.confirmaComSim !== undefined && !(N.id === 'N3' && N.confirmaComSim === 'PLATAFORMA')) erro('E_PLATAFORMA', onde + '.confirmaComSim', 'só o N3 confirma PLATAFORMA, com SIM em O6–O9');
      if (N.id === 'N3' && N.confirmaComSim !== 'PLATAFORMA') erro('E_PLATAFORMA', onde, 'o N3 confirma PLATAFORMA com qualquer SIM');
      /* 0 SIM: N2 só encaminha (candidato a Plataforma); N1 e N3 são evidência insuficiente */
      if (soCampos(N.semSim, ['desce', 'aValidar'], onde + '.semSim')) {
        if (N.id === 'N2') { if (N.semSim.desce !== true || Object.keys(N.semSim).length !== 1) erro('E_PLATAFORMA', onde + '.semSim', 'N2 sem SIM só encaminha ao N3; não confirma nem conclui'); }
        else if (N.semSim.desce || !N.semSim.aValidar) erro('E_SEM_PAPEL', onde + '.semSim', 'N1/N3 sem SIM → evidência insuficiente');
        else conferirSaida(N.semSim.aValidar, onde + '.semSim.aValidar', 'EVIDENCIA_INSUFICIENTE', 'SEM_PAPEL');
      }
      /* D1 */
      var dg = N.diagnostico;
      if (!soCampos(dg, CAMPOS.d1, onde + '.diagnostico')) return;
      if (dg.aplicaCom !== 'dois' && dg.aplicaCom !== 'doisOuMais') erro('E_D1', onde + '.diagnostico.aplicaCom', dg.aplicaCom);
      if (dg.aplicaCom === 'dois' && N.perguntas.length >= 3) {
        if (!N.tresOuMais) erro('E_D1', onde, 'com D1 só para 2 SIM, 3+ SIM precisa de saída');
        else conferirSaida(N.tresOuMais, onde + '.tresOuMais', 'RECORTE', 'TRES_OU_MAIS_PAPEIS');
      } else if (N.tresOuMais !== undefined) erro('E_D1', onde + '.tresOuMais', dg.aplicaCom === 'doisOuMais' ? '3+ SIM passa por D1 (não é recorte direto)' : 'o nível não chega a 3 SIM');
      conferirSaida(dg.distintas, onde + '.diagnostico.distintas', 'RECORTE', 'DIAGNOSTICO_DISTINTAS');
      conferirSaida(dg.ausente, onde + '.diagnostico.ausente', 'EVIDENCIA_INSUFICIENTE', 'DIAGNOSTICO_PENDENTE');
      var comD2 = !!(dg.mesma && dg.mesma.predominancia);
      if (comD2) {
        if (JSON.stringify(dg.mesma) !== JSON.stringify({ predominancia: true })) erro('E_D1', onde + '.diagnostico.mesma', 'mesma → D2, sem mais nada');
      } else conferirSaida(dg.mesma, onde + '.diagnostico.mesma', 'CONFLITO', 'DIAGNOSTICO_MESMA');
      if (comD2 && dg.aplicaCom !== 'doisOuMais') erro('E_D1', onde, 'com D2, D1 vale para 2 ou mais SIM');
      /* D2 */
      if (!comD2) { if (N.predominancia !== undefined) erro('E_D2', onde + '.predominancia', 'D2 só existe quando D1 "mesma" leva a ele'); return; }
      var pd = N.predominancia;
      if (!soCampos(pd, CAMPOS.d2, onde + '.predominancia')) return;
      conferirSaida(pd.indeterminado, onde + '.predominancia.indeterminado', 'CONFLITO', 'PREDOMINANCIA_INDEFINIDA');
      conferirSaida(pd.pendente, onde + '.predominancia.pendente', 'EVIDENCIA_INSUFICIENTE', 'PREDOMINANCIA_PENDENTE');
      motivosUsados.PREDOMINANCIA = true;
      var fixas = OPCOES_PREDOMINANCIA[N.id], vistasOp = {};
      if (!Array.isArray(pd.opcoes)) { erro('E_D2', onde + '.predominancia.opcoes'); return; }
      pd.opcoes.forEach(function (o, j) {
        var oo = onde + '.predominancia.opcoes[' + j + ']';
        if (!soCampos(o, CAMPOS.opcao, oo)) return;
        if (vistasOp[o.codigo]) erro('E_CODIGO_DUPLICADO', oo, o.codigo);
        vistasOp[o.codigo] = true;
        if (fixas[o.codigo] !== o.papel) erro('E_D2', oo, o.codigo + ' → ' + o.papel + ' não é o significado fixo da opção');
        if (o.papel === 'LINHA') {
          if (o.desce !== true || o.confirma !== 'LINHA' || o.regra !== undefined) erro('E_INTERMEDIARIO', oo, 'Linha predominante confirma o nível e desce');
        } else {
          if (o.desce !== undefined || o.confirma !== undefined) erro('E_INTERMEDIARIO', oo, 'só Linha desce');
          if (CODIGOS_FIRMES.indexOf(o.papel) === -1 || !o.regra) erro('E_FIRME', oo, 'predominância firme precisa de regra');
          else regrasUsadas.push([o.regra, oo]);
        }
      });
      if (JSON.stringify(Object.keys(vistasOp).sort()) !== JSON.stringify(Object.keys(fixas).sort())) erro('E_D2', onde + '.predominancia.opcoes', 'exatamente as opções do nível: ' + Object.keys(fixas).join(', '));
    });
    /* catálogo de regras e motivos: exatamente o que a definição registra */
    var catalogo = Array.isArray(def.regras) ? def.regras.slice() : (def.regras && typeof def.regras === 'object' ? Object.keys(def.regras) : null);
    if (!catalogo) erro('E_REGRA', 'def.regras', 'catálogo ausente');
    else {
      var porRegra = {};
      regrasUsadas.forEach(function (x) {
        if (porRegra[x[0]]) erro('E_REGRA', x[1], x[0] + ' já usada em ' + porRegra[x[0]]);
        porRegra[x[0]] = x[1];
        if (catalogo.indexOf(x[0]) === -1) erro('E_REGRA', x[1], x[0] + ' fora do catálogo');
      });
      catalogo.forEach(function (r) { if (!porRegra[r]) erro('E_REGRA', 'def.regras', r + ' no catálogo e nunca registrada'); });
      if (new Set(catalogo).size !== catalogo.length) erro('E_CODIGO_DUPLICADO', 'def.regras');
    }
    motivosUsados.PAPEL_UNICO = true;
    var motivos = Array.isArray(def.motivos) ? def.motivos : [];
    if (new Set(motivos).size !== motivos.length) erro('E_CODIGO_DUPLICADO', 'def.motivos');
    if (JSON.stringify(motivos.slice().sort()) !== JSON.stringify(Object.keys(motivosUsados).sort())) erro('E_MOTIVO', 'def.motivos', 'exatamente os motivos que a definição registra: ' + Object.keys(motivosUsados).sort().join(', '));
    return { valida: !erros.length, erros: erros };
  }

  /* ============================================================
     enumerarEstados(def) — os estados SEMANTICAMENTE VÁLIDOS: respostas só nos níveis alcançados (o que sai do
     caminho a tela limpa), D1 só onde é exigido, D2 só depois de D1 "mesma" e só com as opções dos papéis que
     receberam SIM. Inclui os estados incompletos (perguntas ausentes no nível alcançado) e os de diagnóstico
     pendente. Ordem fixa e reproduzível: SIM, NAO, ausente; D1 mesma, distintas, ausente; D2 nas opções da
     definição, depois NAO_DETERMINAVEL, depois ausente. Cada estado: { respostas, diagnosticos, predominancias }.
     ============================================================ */
  function enumerarEstados(def) {
    exigirDefinicao(def);
    var out = [];
    function copia(e) { return { respostas: Object.assign({}, e.respostas), diagnosticos: Object.assign({}, e.diagnosticos), predominancias: Object.assign({}, e.predominancias) }; }
    function nivel(i, e) {
      if (i >= def.niveis.length) throw new Error('enumeração passou do último nível');
      var N = def.niveis[i], qs = codigosDo(N), total = Math.pow(3, qs.length);
      for (var k = 0; k < total; k++) {
        var x = k, f = copia(e), falta = false;
        for (var j = qs.length - 1; j >= 0; j--) {   /* a 1ª pergunta varia mais devagar: SIM, NAO, ausente */
          var v = [SIM, NAO, null][x % 3]; x = Math.floor(x / 3);
          if (v) f.respostas[qs[j]] = v; else falta = true;
        }
        if (falta) { out.push(f); continue; }
        var sims = N.perguntas.filter(function (p) { return f.respostas[p.codigo] === SIM; });
        if (sims.length >= 3 && !d1Aplica(N, sims.length)) { out.push(f); continue; }
        if (d1Aplica(N, sims.length)) {
          ['mesma', 'distintas', null].forEach(function (d) {
            var g = copia(f);
            if (d) g.diagnosticos[N.id] = d;
            if (d !== 'mesma' || !N.diagnostico.mesma.predominancia) { out.push(g); return; }
            var papeis = sims.map(function (p) { return p.papel; });
            N.predominancia.opcoes.filter(function (o) { return papeis.indexOf(o.papel) !== -1; }).map(function (o) { return o; })
              .concat([{ codigo: NAO_DETERMINAVEL }, { codigo: null }]).forEach(function (o) {
                var h = copia(g);
                if (o.codigo) h.predominancias[N.id] = o.codigo;
                if (o.desce) nivel(i + 1, h); else out.push(h);
              });
          });
          continue;
        }
        if (!sims.length) { if (N.semSim.desce) nivel(i + 1, f); else out.push(f); continue; }
        if (sims[0].aoUnico && sims[0].aoUnico.desce) nivel(i + 1, f); else out.push(f);
      }
    }
    nivel(0, { respostas: {}, diagnosticos: {}, predominancias: {} });
    return out;
  }
  function chaveEstado(e) {
    var o = function (m) { return Object.keys(m || {}).sort().map(function (k) { return k + '=' + m[k]; }).join(','); };
    return o(e.respostas) + '|' + o(e.diagnosticos) + '|' + o(e.predominancias);
  }
  function rotulo(r) { return r.codigoResultado === A_VALIDAR ? 'A_VALIDAR/' + r.tipoAValidar : r.codigoResultado; }
  function canon(o) { return JSON.stringify(Object.keys(o).sort().map(function (k) { return [k, o[k]]; })); }

  /* ============================================================
     simular(defA, defB, opcoes?) — compara duas versões em todos os estados semanticamente válidos de cada uma
     (a união, sem repetição). Puro e determinístico. opcoes.exemplos = quantos exemplos por transição (padrão 3).
     ============================================================ */
  function simular(defA, defB, opcoes) {
    var maxEx = (opcoes && opcoes.exemplos) || 3;
    var estados = [], vistos = {};
    enumerarEstados(defA).concat(enumerarEstados(defB)).forEach(function (e) {
      var k = chaveEstado(e);
      if (!vistos[k]) { vistos[k] = true; estados.push(e); }
    });
    estados.sort(function (x, y) { var a = chaveEstado(x), b = chaveEstado(y); return a < b ? -1 : a > b ? 1 : 0; });
    var rel = { versaoA: defA.versao, versaoB: defB.versao, totalEstados: estados.length, identicos: 0, mantidos: 0, alterados: 0,
      soRegraOuMotivo: 0, transicoes: {}, mudancasTipoAValidar: {}, mudancasMotivo: {}, mudancasLiberaSquad: 0,
      violacoesLinhaSquad: 0, distribuicaoA: {}, distribuicaoB: {} };
    function cont(m, k) { m[k] = (m[k] || 0) + 1; }
    function respeitaInvariante(r) { return r.liberaSquad === liberaSquadDoResultado(r.codigoResultado, r.nivelConfirmado); }
    estados.forEach(function (e) {
      var a = avaliar(defA, e.respostas, e.diagnosticos, e.predominancias), b = avaliar(defB, e.respostas, e.diagnosticos, e.predominancias);
      var la = rotulo(a), lb = rotulo(b);
      cont(rel.distribuicaoA, la); cont(rel.distribuicaoB, lb);
      if (!respeitaInvariante(a) || !respeitaInvariante(b)) rel.violacoesLinhaSquad++;
      if (canon(a) === canon(b)) rel.identicos++;
      if (la === lb) { rel.mantidos++; if (a.regra !== b.regra || a.motivo !== b.motivo) rel.soRegraOuMotivo++; }
      else {
        rel.alterados++;
        var t = la + ' → ' + lb, tr = rel.transicoes[t] || (rel.transicoes[t] = { de: la, para: lb, quantidade: 0, exemplos: [] });
        tr.quantidade++;
        if (tr.exemplos.length < maxEx) tr.exemplos.push({ estado: e, a: { regra: a.regra, motivo: a.motivo }, b: { regra: b.regra, motivo: b.motivo } });
      }
      if (a.tipoAValidar && b.tipoAValidar && a.tipoAValidar !== b.tipoAValidar) cont(rel.mudancasTipoAValidar, a.tipoAValidar + ' → ' + b.tipoAValidar);
      if (a.motivo !== b.motivo) cont(rel.mudancasMotivo, a.motivo + ' → ' + b.motivo);
      if (a.liberaSquad !== b.liberaSquad) rel.mudancasLiberaSquad++;
    });
    return rel;
  }

  /* ============================================================
     CONTRATO MOTOR × CONTEÚDO DO QUESTIONÁRIO (só estrutura; o texto é livre e fica fora do motor)
     contratoDoQuestionario(def) → { questionario, itens: [{ codigoEstavel, tipo, opcoes? }] } — exatamente o que um
       conteúdo precisa ter para servir a esta versão do motor.
     conteudoCompativel(def, conteudo) → { compativel, vinculo, erros } — o conteúdo tem EXATAMENTE essa estrutura
       (nada faltando, nada sobrando, mesmos tipos, mesmo conjunto de opções) e está VINCULADO a esta versão:
       conteudo.motorCompativel === def.versao. O vínculo é atribuído pelo sistema ao criar/publicar a versão de
       conteúdo (nunca um campo editorial — a barreira é do H2). Ausência do vínculo = conteúdo legado, compatível
       só com o motor v1. O texto (pergunta, ajuda, rótulos) não é conferido aqui.
     podeEntrarEmVigor(def, conteudosPublicados) → { pode, conteudo, motivo } — só com um conteúdo PUBLICADO e
       compatível; sem fallback para texto de fábrica, conteúdo de outra versão ou "parecido".
     ============================================================ */
  function contratoDoQuestionario(def) {
    exigirDefinicao(def);
    var itens = [];
    def.niveis.forEach(function (N) { N.perguntas.forEach(function (p) { itens.push({ codigoEstavel: p.codigo, tipo: TIPO_BINARIA }); }); });
    itens.push({ codigoEstavel: def.diagnostico.codigo, tipo: TIPO_D1 });
    def.niveis.forEach(function (N) {
      if (!N.predominancia) return;
      itens.push({ codigoEstavel: D2_POR_NIVEL[N.id], tipo: TIPO_D2, opcoes: N.predominancia.opcoes.map(function (o) { return o.codigo; }).concat([NAO_DETERMINAVEL]) });
    });
    return { questionario: def.questionario, itens: itens };
  }
  function conteudoCompativel(def, conteudo) {
    var erros = [];
    function erro(codigo, detalhe) { erros.push({ codigo: codigo, detalhe: detalhe || null }); }
    var contrato = contratoDoQuestionario(def);
    if (!conteudo || typeof conteudo !== 'object') return { compativel: false, vinculo: null, erros: [{ codigo: 'C_SEM_CONTEUDO', detalhe: null }] };
    if (conteudo.codigo !== contrato.questionario) erro('C_QUESTIONARIO', conteudo.codigo);
    var temVinculo = Object.prototype.hasOwnProperty.call(conteudo, 'motorCompativel') && conteudo.motorCompativel !== null && conteudo.motorCompativel !== undefined;
    var vinculo = temVinculo ? 'declarado' : 'legado';
    if (temVinculo) { if (conteudo.motorCompativel !== def.versao) erro('C_VINCULO', 'conteúdo vinculado ao motor ' + conteudo.motorCompativel + ', não ao ' + def.versao); }
    else if (def.versao !== 1) erro('C_VINCULO', 'conteúdo sem vínculo é legado: só serve ao motor 1');
    var pergs = Array.isArray(conteudo.perguntas) ? conteudo.perguntas : null;
    if (!pergs) { erro('C_ESTRUTURA', 'perguntas'); return { compativel: false, vinculo: vinculo, erros: erros }; }
    var porCodigo = {};
    pergs.forEach(function (p, i) {
      var c = p && p.codigoEstavel;
      if (typeof c !== 'string') { erro('C_ESTRUTURA', 'item ' + i + ' sem codigoEstavel'); return; }
      if (porCodigo[c]) erro('C_DUPLICADO', c);
      porCodigo[c] = p;
    });
    var esperados = {};
    contrato.itens.forEach(function (it) {
      esperados[it.codigoEstavel] = true;
      var p = porCodigo[it.codigoEstavel];
      if (!p) { erro('C_FALTANDO', it.codigoEstavel); return; }
      var tipo = p.tipo || TIPO_BINARIA;   /* ausência de tipo = binária, como em questionarios-config.js */
      if (tipo !== it.tipo) erro('C_TIPO', it.codigoEstavel + ': ' + tipo + ' (esperado ' + it.tipo + ')');
      if (it.opcoes) {
        var ops = Array.isArray(p.opcoes) ? p.opcoes.map(function (o) { return o && o.codigo; }) : null;
        if (!ops) erro('C_OPCOES', it.codigoEstavel + ' sem opções');
        else {
          if (new Set(ops).size !== ops.length) erro('C_OPCOES', it.codigoEstavel + ': opção repetida');
          if (JSON.stringify(ops.slice().sort()) !== JSON.stringify(it.opcoes.slice().sort())) erro('C_OPCOES', it.codigoEstavel + ': ' + ops.join(',') + ' (esperado ' + it.opcoes.join(',') + ')');
        }
      } else if (p.opcoes !== undefined) erro('C_OPCOES', it.codigoEstavel + ' não tem opções');
    });
    Object.keys(porCodigo).forEach(function (c) { if (!esperados[c]) erro('C_SOBRANDO', c); });
    return { compativel: !erros.length, vinculo: vinculo, erros: erros };
  }
  function podeEntrarEmVigor(def, conteudosPublicados) {
    var v = validarDefinicao(def);
    if (!v.valida) return { pode: false, conteudo: null, motivo: 'definicao-invalida' };
    var lista = (Array.isArray(conteudosPublicados) ? conteudosPublicados : []).filter(function (c) { return c && c.publicado === true; });
    var compat = lista.filter(function (c) { return conteudoCompativel(def, c).compativel; });
    /* versão nova do motor exige conteúdo com vínculo DECLARADO; legado só vale para a v1 */
    if (def.versao !== 1) compat = compat.filter(function (c) { return conteudoCompativel(def, c).vinculo === 'declarado'; });
    if (!compat.length) return { pode: false, conteudo: null, motivo: lista.length ? 'sem-conteudo-compativel' : 'sem-conteudo-publicado' };
    compat.sort(function (a, b) { return (b.versao || 0) - (a.versao || 0); });
    return { pode: true, conteudo: compat[0].versao || null, motivo: null };
  }

  var DEFINICOES = { 1: V1, 2: V2 };
  /* toda definição embarcada precisa passar nas regras fixas — senão o arquivo nem carrega */
  Object.keys(DEFINICOES).forEach(function (v) {
    var r = validarDefinicao(DEFINICOES[v]);
    if (!r.valida) throw new Error('Definição ' + v + ' do motor de posicionamento viola regra de domínio: ' + JSON.stringify(r.erros));
  });

  function definicao(versao) {
    var d = DEFINICOES[versao];
    if (!d) throw new Error('Versão do motor de posicionamento desconhecida: ' + versao);
    return d;
  }

  var api = {
    avaliar: avaliar,
    perguntasDoCaminho: perguntasDoCaminho,
    diagnosticosNecessarios: diagnosticosNecessarios,
    predominanciasNecessarias: predominanciasNecessarias,
    validarDefinicao: validarDefinicao,
    enumerarEstados: enumerarEstados,
    simular: simular,
    contratoDoQuestionario: contratoDoQuestionario,
    conteudoCompativel: conteudoCompativel,
    podeEntrarEmVigor: podeEntrarEmVigor,
    definicao: definicao,
    versoes: function () { return Object.keys(DEFINICOES).map(Number); },
    versaoEmVigor: function () { return VERSAO_EM_VIGOR; },
    liberaSquadParaCodigoFirme: liberaSquadParaCodigoFirme,
    CODIGOS_FIRMES: CODIGOS_FIRMES.slice(),
    CODIGOS_INTERMEDIARIOS: CODIGOS_INTERMEDIARIOS.slice(),
    TIPOS_A_VALIDAR: TIPOS_A_VALIDAR.slice(),
    SINAIS: JSON.parse(JSON.stringify(SINAIS)),
    OPCOES_PREDOMINANCIA: JSON.parse(JSON.stringify(OPCOES_PREDOMINANCIA)),
    D2_POR_NIVEL: JSON.parse(JSON.stringify(D2_POR_NIVEL)),
    NAO_DETERMINAVEL: NAO_DETERMINAVEL,
    A_VALIDAR: A_VALIDAR
  };
  congelar(api);
  if (typeof window !== 'undefined') window.faMotorPosicionamentoNucleo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
