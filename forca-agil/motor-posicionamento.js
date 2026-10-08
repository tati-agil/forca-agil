/* ============================================================
   Força Ágil — Motor de POSICIONAMENTO ORGANIZACIONAL O1–O9
   (window.faMotorPosicionamento)

   Responde: "qual TIPO de estrutura organizacional deve sustentar, de forma permanente, a responsabilidade
   associada a este objeto?" O resultado é um POSICIONAMENTO RECOMENDADO — nunca "o objeto é uma Linha/Área/CoE",
   e nunca uma estrutura concreta (NEGOCIOS = "recomendação: Linha de Negócios", não QUAL Linha de Negócios; a
   associação à estrutura concreta é uma etapa posterior, de curadoria).

   MOTOR PURO: sem DOM, sem Firebase, sem Taxonomia. Trabalha só com CÓDIGOS estáveis; nome e definição oficiais
   de cada código virão da Taxonomia Organizacional (posicionamentos.js, PR D). Determinístico e hierárquico:
   sem pontuação, peso, maioria ou soma — a primeira conclusão válida no caminho decide.

   ÁRVORE (só se desce quando o nível de cima confirmou UM papel):
     Nível 1  O1 Linha · O2 Área Especializada · O3 CoE
     Nível 2  (só com Linha)      O4 Estratégia de Clientes · O5 Negócios · (O4=NAO e O5=NAO → ramo Plataforma)
     Nível 3  (só com Plataforma) O6 Canais · O7 Habilitadora de Negócios · O8 Habilitadora de Tecnologia ·
                                  O9 Gestão Corporativa
   PRINCÍPIO DE COMPLETUDE DO NÍVEL (decisão de 08/10/2026): todo nível alcançado precisa estar COMPLETAMENTE
   respondido antes de produzir classificação, conflito ou recorte. Qualquer pergunta ausente no nível alcançado →
   A_VALIDAR / EVIDENCIA_INSUFICIENTE, motivo RESPOSTA_FALTANDO, MESMO quando as respostas presentes parecem tornar
   a categoria inevitável (ex.: N3 com 3 SIM + 1 ausente continua insuficiente — ainda não se sabe se são 3 ou 4
   papéis). Resposta ausente nunca é interpretada como NAO.
   Em cada nível alcançado e completo:
     - 3 ou mais SIM → A_VALIDAR / RECORTE;
     - exatamente 2 SIM → diagnóstico DIAG_CONFLITO_RECORTE daquele nível: "mesma" → CONFLITO; "distintas" →
       RECORTE; sem resposta → EVIDENCIA_INSUFICIENTE com motivo DIAGNOSTICO_PENDENTE;
     - 1 SIM → o papel (no Nível 1, "Linha" só confirma o nível e abre o Nível 2; no Nível 2, NAO/NAO abre o 3);
     - nenhum SIM → A_VALIDAR / EVIDENCIA_INSUFICIENTE (sem papel).
   DEFENSIVO: qualquer SIM gravado FORA do caminho alcançado → A_VALIDAR / INCOERENCIA (vence tudo). NAO ou
   ausência fora do caminho é resíduo e é ignorado; diagnóstico fora da sua condição de uso também. O motor não
   limpa nada: só classifica o estado recebido.

   nivelConfirmado: o último nível que terminou com UM papel — null (nada confirmado), 'LINHA' ou 'PLATAFORMA'
   (com pelo menos um SIM no Nível 3). liberaSquad = a avaliação S1–S8 PODE ser feita (não cria nem associa
   Squad): Área/CoE → false; resultado firme de Linha → true; A_VALIDAR → só com nivelConfirmado LINHA/PLATAFORMA.

   VERSÃO: as regras ficam no código (VERSOES); cada resultado registra versaoMotor. A publicação/simulação de
   versões novas (governança, como nos motores P1–P16 e S1–S8) vem no PR H; até lá a versão em vigor é a 1.
   ============================================================ */
(function () {
  'use strict';

  var SIM = 'SIM', NAO = 'NAO';
  var MESMA = 'mesma', DISTINTAS = 'distintas';
  var A_VALIDAR = 'A_VALIDAR';
  var TIPOS_A_VALIDAR = ['INCOERENCIA', 'CONFLITO', 'RECORTE', 'EVIDENCIA_INSUFICIENTE'];
  var CODIGOS_FIRMES = ['AREA_ESPECIALIZADA', 'COE', 'ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS',
    'PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA'];
  var CODIGOS_INTERMEDIARIOS = ['LINHA', 'PLATAFORMA'];
  var DE_LINHA = ['ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS',
    'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA'];
  var DIAGNOSTICO = 'DIAG_CONFLITO_RECORTE';

  /* As perguntas, por nível, e o papel que o SIM de cada uma marca. */
  var NIVEIS = [
    { id: 'N1', perguntas: ['O1', 'O2', 'O3'] },
    { id: 'N2', perguntas: ['O4', 'O5'] },
    { id: 'N3', perguntas: ['O6', 'O7', 'O8', 'O9'] }
  ];
  var PAPEL = {
    O1: 'LINHA', O2: 'AREA_ESPECIALIZADA', O3: 'COE', O4: 'ESTRATEGIA_CLIENTES', O5: 'NEGOCIOS',
    O6: 'PLATAFORMA_CANAIS', O7: 'PLATAFORMA_HABILITADORA_NEGOCIOS', O8: 'PLATAFORMA_HABILITADORA_TECNOLOGIA',
    O9: 'PLATAFORMA_CORPORATIVA'
  };
  var PERGUNTAS = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9'];

  /* Identificadores estáveis das regras (o que cada resultado registra em "regra"). */
  var REGRAS = {
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
  };
  /* Motivos estáveis (o "porquê" do resultado, em código — nunca um texto como chave lógica). */
  var MOTIVOS = ['SIM_FORA_DO_CAMINHO', 'RESPOSTA_FALTANDO', 'TRES_OU_MAIS_PAPEIS', 'DIAGNOSTICO_MESMA',
    'DIAGNOSTICO_DISTINTAS', 'DIAGNOSTICO_PENDENTE', 'PAPEL_UNICO', 'SEM_PAPEL'];

  function resp(respostas, q) {
    var v = respostas && respostas[q];
    return v === SIM || v === NAO ? v : null;
  }
  function diag(diagnosticos, nivel) {
    var v = diagnosticos && diagnosticos[nivel];
    return v === MESMA || v === DISTINTAS ? v : null;
  }

  /* ---------- versão 1 ---------- */
  function avaliarV1(respostas, diagnosticos) {
    var nivelConfirmado = null, conclusao = null, alcancados = [];
    for (var i = 0; i < NIVEIS.length && !conclusao; i++) {
      var N = NIVEIS[i], ps = N.perguntas;
      alcancados.push(N.id);
      var sims = ps.filter(function (q) { return resp(respostas, q) === SIM; });
      var papeis = sims.map(function (q) { return PAPEL[q]; });
      /* no Nível 3, um SIM já é evidência positiva de Plataforma (mesmo que o nível não feche) */
      if (N.id === 'N3' && sims.length) nivelConfirmado = 'PLATAFORMA';
      if (ps.some(function (q) { return resp(respostas, q) === null; })) {
        conclusao = aValidar('EVIDENCIA_INSUFICIENTE', 'RESPOSTA_FALTANDO', N.id + '_RESPOSTA_FALTANDO', papeis); break;
      }
      if (sims.length >= 3) { conclusao = aValidar('RECORTE', 'TRES_OU_MAIS_PAPEIS', N.id + '_RECORTE', papeis); break; }
      if (sims.length === 2) {
        var d = diag(diagnosticos, N.id);
        conclusao = d === MESMA ? aValidar('CONFLITO', 'DIAGNOSTICO_MESMA', N.id + '_CONFLITO', papeis)
          : d === DISTINTAS ? aValidar('RECORTE', 'DIAGNOSTICO_DISTINTAS', N.id + '_RECORTE_DIAGNOSTICO', papeis)
          : aValidar('EVIDENCIA_INSUFICIENTE', 'DIAGNOSTICO_PENDENTE', N.id + '_DIAGNOSTICO_PENDENTE', papeis);
        break;
      }
      if (N.id === 'N1') {
        if (!sims.length) { conclusao = aValidar('EVIDENCIA_INSUFICIENTE', 'SEM_PAPEL', 'N1_SEM_PAPEL', []); break; }
        if (sims[0] === 'O1') { nivelConfirmado = 'LINHA'; continue; }   /* Linha: confirma e desce */
        conclusao = firme(PAPEL[sims[0]], 'N1_' + PAPEL[sims[0]]); break;
      }
      if (N.id === 'N2') {
        if (!sims.length) continue;                                       /* NAO/NAO: ramo Plataforma */
        conclusao = firme(PAPEL[sims[0]], 'N2_' + PAPEL[sims[0]]); break;
      }
      /* N3 */
      if (!sims.length) { conclusao = aValidar('EVIDENCIA_INSUFICIENTE', 'SEM_PAPEL', 'N3_SEM_PAPEL', []); break; }
      conclusao = firme(PAPEL[sims[0]], 'N3_' + PAPEL[sims[0]]);
    }
    /* DEFENSIVO: SIM gravado num nível que o caminho não alcançou → incoerência (vence qualquer conclusão) */
    var fora = [];
    NIVEIS.forEach(function (N) {
      if (alcancados.indexOf(N.id) !== -1) return;
      N.perguntas.forEach(function (q) { if (resp(respostas, q) === SIM) fora.push(q); });
    });
    if (fora.length) {
      return montar({ codigoResultado: A_VALIDAR, tipoAValidar: 'INCOERENCIA', motivo: 'SIM_FORA_DO_CAMINHO', regra: 'DEF_SIM_FORA_DO_CAMINHO',
        papeisDetectados: fora.map(function (q) { return PAPEL[q]; }), perguntasForaDoCaminho: fora }, null, alcancados);
    }
    return montar(conclusao, conclusao.codigoResultado === A_VALIDAR ? nivelConfirmado : null, alcancados);
  }
  function aValidar(tipo, motivo, regra, papeis) {
    return { codigoResultado: A_VALIDAR, tipoAValidar: tipo, motivo: motivo, regra: regra, papeisDetectados: papeis.slice() };
  }
  function firme(codigo, regra) {
    return { codigoResultado: codigo, tipoAValidar: null, motivo: 'PAPEL_UNICO', regra: regra, papeisDetectados: [codigo] };
  }
  function montar(c, nivelConfirmado, alcancados) {
    var r = {
      codigoResultado: c.codigoResultado,
      tipoAValidar: c.tipoAValidar,
      motivo: c.motivo,
      nivelConfirmado: nivelConfirmado,
      papeisDetectados: c.papeisDetectados,
      regra: c.regra,
      versaoMotor: 1,
      liberaSquad: false,
      niveisAlcancados: alcancados.slice(),
      perguntasForaDoCaminho: c.perguntasForaDoCaminho || []
    };
    r.liberaSquad = calcularLiberaSquad(r);
    return r;
  }
  /* liberaSquad = a Adequação à Gestão por Squad (S1–S8) PODE ser feita. Nunca cria nem associa uma Squad. */
  function calcularLiberaSquad(r) {
    if (r.codigoResultado === A_VALIDAR) return r.nivelConfirmado === 'LINHA' || r.nivelConfirmado === 'PLATAFORMA';
    return DE_LINHA.indexOf(r.codigoResultado) !== -1;
  }

  var VERSOES = { 1: { avaliar: avaliarV1, desde: '2026-10-08' } };
  var versaoEmVigor = 1;   /* a publicação/escolha de versão pelo ADMIN vem no PR H */

  /* API pública.
     avaliar(respostas, diagnosticos, opcoes?)
       respostas: { O1..O9: 'SIM' | 'NAO' | ausente/null }
       diagnosticos: { N1|N2|N3: 'mesma' | 'distintas' | ausente/null }   (DIAG_CONFLITO_RECORTE de cada nível)
       opcoes.versao: número da versão a usar (padrão: a em vigor)
     → { codigoResultado, tipoAValidar, motivo, nivelConfirmado, papeisDetectados, regra, versaoMotor, liberaSquad,
         niveisAlcancados, perguntasForaDoCaminho } */
  function avaliar(respostas, diagnosticos, opcoes) {
    var v = (opcoes && opcoes.versao) || versaoEmVigor;
    if (!VERSOES[v]) throw new Error('Versão do motor de posicionamento desconhecida: ' + v);
    var r = VERSOES[v].avaliar(respostas || {}, diagnosticos || {});
    r.versaoMotor = v;
    return r;
  }
  /* Perguntas do caminho alcançado (a tela futura mostra só estas; o resto é "não se aplica"). */
  function perguntasDoCaminho(respostas, diagnosticos) {
    var r = avaliar(respostas, diagnosticos);
    var out = [];
    NIVEIS.forEach(function (N) { if (r.niveisAlcancados.indexOf(N.id) !== -1) out = out.concat(N.perguntas); });
    return out;
  }

  var api = {
    avaliar: avaliar,
    perguntasDoCaminho: perguntasDoCaminho,
    versaoAtual: function () { return versaoEmVigor; },
    versoes: function () { return Object.keys(VERSOES).map(Number); },
    PERGUNTAS: PERGUNTAS.slice(),
    NIVEIS: JSON.parse(JSON.stringify(NIVEIS)),
    PAPEL_POR_PERGUNTA: JSON.parse(JSON.stringify(PAPEL)),
    CODIGOS_FIRMES: CODIGOS_FIRMES.slice(),
    CODIGOS_INTERMEDIARIOS: CODIGOS_INTERMEDIARIOS.slice(),
    TIPOS_A_VALIDAR: TIPOS_A_VALIDAR.slice(),
    MOTIVOS: MOTIVOS.slice(),
    REGRAS: JSON.parse(JSON.stringify(REGRAS)),
    DIAGNOSTICO: DIAGNOSTICO,
    RESPOSTAS: [SIM, NAO],
    RESPOSTAS_DIAGNOSTICO: [MESMA, DISTINTAS],
    A_VALIDAR: A_VALIDAR
  };
  if (typeof window !== 'undefined') window.faMotorPosicionamento = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
