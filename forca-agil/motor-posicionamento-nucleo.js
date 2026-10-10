/* ============================================================
   Força Ágil — NÚCLEO DECLARATIVO do Motor de Posicionamento Organizacional O1–O9 (H1.1)
   (window.faMotorPosicionamentoNucleo; em Node, module.exports)

   O MESMO algoritmo do motor, lendo a versão como DADOS (uma "definição"): níveis, perguntas, o papel que o SIM
   de cada pergunta marca, o que um nível faz com 0, 1, 2 ou 3+ SIM e os identificadores de regra/motivo que cada
   saída registra. A definição da v1 abaixo reproduz EXATAMENTE forca-agil/motor-posicionamento.js (a referência
   comportamental): teste-motor-posicionamento-nucleo.js compara os 531.441 estados, objeto completo, e o digest
   congelado de teste-motor-posicionamento-api.js.

   LADO A LADO (H1.1): nenhum consumidor usa este arquivo ainda — a tela, as regras do banco e as exportações
   continuam no motor atual; ele não está no index.html. É a base da migração (H1.2 em diante).

   PURO: sem DOM, sem Firebase, sem autenticação, sem banco; determinístico (mesma definição + mesmas respostas →
   mesma saída). Não muda o estado recebido.

   O QUE NÃO É DEFINIÇÃO (regra fixa de domínio, no código deste núcleo, igual para toda versão):
     - o catálogo de códigos firmes, intermediários e tipos de A_VALIDAR;
     - o invariante Linha × Squad (liberaSquad): Linhas são formadas por Squads; Área Especializada e CoE não.
       Os 6 firmes do ramo Linha → true; AREA_ESPECIALIZADA e COE → false; A_VALIDAR → só com nível LINHA ou
       PLATAFORMA confirmado. Nenhuma definição carrega liberaSquad;
     - a ordem do algoritmo: completude do nível antes de tudo, depois 3+ SIM, 2 SIM (diagnóstico), 0 SIM e 1 SIM;
       incoerência (SIM fora do caminho) vence qualquer conclusão.
   A validação de uma definição contra essas regras (validarDefinicao) é o H1.2.
   ============================================================ */
(function () {
  'use strict';

  var SIM = 'SIM', NAO = 'NAO';
  var A_VALIDAR = 'A_VALIDAR';

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

  function congelar(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.keys(o).forEach(function (k) { congelar(o[k]); });
      Object.freeze(o);
    }
    return o;
  }

  /* ---------- a definição da v1 (dados) ----------
     niveis[], na ordem do caminho. Por nível:
       perguntas: [{ codigo, papel, regraUnico? , aoUnico? }]
         papel      — o que o SIM daquela pergunta marca;
         regraUnico — regra da saída firme quando ela é o ÚNICO SIM do nível;
         aoUnico    — em vez de concluir, { desce: true, confirma: <nível> } (Linha no N1).
       confirmaComSim  — com pelo menos um SIM neste nível, o nível confirmado passa a ser este (Plataforma no N3),
                         mesmo que o nível não feche;
       semSim          — 0 SIM: { desce: true } ou { aValidar: { tipo, motivo, regra } };
       respostaFaltando, tresOuMais, diagnostico (2 SIM): { tipo, motivo, regra } por desfecho. */
  var V1 = congelar({
    versao: 1,
    desde: '2026-10-08',
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
  var DEFINICOES = { 1: V1 };

  function definicao(versao) {
    var d = DEFINICOES[versao];
    if (!d) throw new Error('Versão do motor de posicionamento desconhecida: ' + versao);
    return d;
  }
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

  /* ---------- o algoritmo (fixo; só lê a definição) ---------- */
  function percorrer(def, respostas, diagnosticos) {
    var nivelConfirmado = null, conclusao = null, alcancados = [];
    for (var i = 0; i < def.niveis.length && !conclusao; i++) {
      var N = def.niveis[i];
      alcancados.push(N.id);
      var simsP = N.perguntas.filter(function (p) { return resposta(def, respostas, p.codigo) === SIM; });
      var papeis = simsP.map(function (p) { return p.papel; });
      if (N.confirmaComSim && simsP.length) nivelConfirmado = N.confirmaComSim;
      if (N.perguntas.some(function (p) { return resposta(def, respostas, p.codigo) === null; })) {
        conclusao = aValidar(N.respostaFaltando, papeis); break;
      }
      if (simsP.length >= 3) { conclusao = aValidar(exigir(N.tresOuMais, N.id, '3 ou mais SIM'), papeis); break; }
      if (simsP.length === 2) {
        var dg = exigir(N.diagnostico, N.id, '2 SIM'), d = respostaDiagnostico(def, diagnosticos, N.id);
        conclusao = aValidar(d === 'mesma' ? dg.mesma : d === 'distintas' ? dg.distintas : dg.ausente, papeis);
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
  function exigir(saida, nivel, caso) {
    if (!saida) throw new Error('Definição sem saída para ' + caso + ' no nível ' + nivel);
    return saida;
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

  /* avaliar(def, respostas, diagnosticos) → o mesmo objeto do motor atual */
  function avaliar(def, respostas, diagnosticos) {
    exigirDefinicao(def);
    var p = percorrer(def, respostas, diagnosticos);
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
  /* perguntas dos níveis alcançados (a tela mostra só estas) */
  function perguntasDoCaminho(def, respostas, diagnosticos) {
    var r = avaliar(def, respostas, diagnosticos), out = [];
    def.niveis.forEach(function (N) { if (r.niveisAlcancados.indexOf(N.id) !== -1) out = out.concat(codigosDo(N)); });
    return out;
  }
  /* níveis cujo diagnóstico faz parte da avaliação: alcançado, completo e com exatamente 2 SIM
     (a mesma condição de diagnosticoNecessario em avaliacao-posicionamento.js) */
  function diagnosticosNecessarios(def, respostas, diagnosticos) {
    var r = avaliar(def, respostas, diagnosticos);
    return def.niveis.filter(function (N) {
      if (r.niveisAlcancados.indexOf(N.id) === -1) return false;
      var qs = codigosDo(N);
      if (qs.some(function (q) { return resposta(def, respostas, q) === null; })) return false;
      return qs.filter(function (q) { return resposta(def, respostas, q) === SIM; }).length === 2;
    }).map(function (N) { return N.id; });
  }

  var api = {
    avaliar: avaliar,
    perguntasDoCaminho: perguntasDoCaminho,
    diagnosticosNecessarios: diagnosticosNecessarios,
    definicao: definicao,
    versoes: function () { return Object.keys(DEFINICOES).map(Number); },
    liberaSquadParaCodigoFirme: liberaSquadParaCodigoFirme,
    CODIGOS_FIRMES: CODIGOS_FIRMES.slice(),
    CODIGOS_INTERMEDIARIOS: CODIGOS_INTERMEDIARIOS.slice(),
    TIPOS_A_VALIDAR: TIPOS_A_VALIDAR.slice(),
    A_VALIDAR: A_VALIDAR
  };
  congelar(api);
  if (typeof window !== 'undefined') window.faMotorPosicionamentoNucleo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
