/* ═════════════════════════════════════════════════════════════════
   POSICIONAMENTO ORGANIZACIONAL — TABELA ÚNICA DAS 25 REGRAS DO MOTOR v1 (PR E).

   Fonte única de duas coisas que precisam concordar com o motor (forca-agil/motor-posicionamento.js):
     1. a PROVA: para cada um dos 531.441 estados (O1–O9 em SIM/NAO/ausente × diagnóstico N1–N3 em
        mesma/distintas/ausente), EXATAMENTE UMA regra desta tabela vale, e a saída que ela descreve é
        idêntica à do motor (teste-regras-posicionamento-tabela.js);
     2. o TRECHO das regras do banco (database.rules.json, nó avaliacoes-posicionamento) que confere uma
        avaliação CONCLUÍDA: o resultado gravado tem de ser exatamente o que esta tabela (= o motor v1)
        produz para aquelas respostas e diagnósticos. O teste compara o trecho gerado aqui com o publicado.

   Escrita À PARTE do motor (não chama o motor): cada regra é uma condição sobre as respostas e uma
   descrição da saída. O acoplamento à versão 1 é intencional — motor v2 = regras novas, introduzidas
   conscientemente (PR H). Não há fallback para versão desconhecida.

   Uso: node .github/scripts/regras-posicionamento-tabela.js --imprimir   (mostra o trecho gerado)
   ═════════════════════════════════════════════════════════════════ */
'use strict';

const NIVEIS = { N1: ['O1', 'O2', 'O3'], N2: ['O4', 'O5'], N3: ['O6', 'O7', 'O8', 'O9'] };
const ORDEM_NIVEIS = ['N1', 'N2', 'N3'];
const PERGUNTAS = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9'];
const PAPEL = { O1: 'LINHA', O2: 'AREA_ESPECIALIZADA', O3: 'COE', O4: 'ESTRATEGIA_CLIENTES', O5: 'NEGOCIOS',
  O6: 'PLATAFORMA_CANAIS', O7: 'PLATAFORMA_HABILITADORA_NEGOCIOS', O8: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', O9: 'PLATAFORMA_CORPORATIVA' };
const DE_LINHA = ['ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS',
  'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA'];
const VERSAO_MOTOR = 1;

/* ---------- condições (pequena linguagem: avaliada em JS para a prova e compilada para as regras) ---------- */
const S = (q) => ({ t: 'resp', q, v: 'SIM' });
const N = (q) => ({ t: 'resp', q, v: 'NAO' });
const A = (q) => ({ t: 'resp', q, v: null });
const D = (n, v) => ({ t: 'diag', n, v });
const e = (...xs) => ({ t: 'e', xs });
const ou = (...xs) => ({ t: 'ou', xs });
const nao = (x) => ({ t: 'nao', x });

function combinacoes(lista, k) {
  if (k === 0) return [[]];
  if (lista.length < k) return [];
  const [p, ...resto] = lista;
  return combinacoes(resto, k - 1).map((c) => [p].concat(c)).concat(combinacoes(resto, k));
}
const completo = (n) => e(...NIVEIS[n].map((q) => ou(S(q), N(q))));
const algumaAusente = (n) => ou(...NIVEIS[n].map(A));
/* nível completo com exatamente k SIM (os outros NAO) */
const exatamenteSim = (n, k) => ou(...combinacoes(NIVEIS[n], k).map((c) => e(...NIVEIS[n].map((q) => (c.includes(q) ? S(q) : N(q))))));
const peloMenosSim = (n, k) => ou(...[k, k + 1, k + 2, k + 3].filter((x) => x <= NIVEIS[n].length).map((x) => exatamenteSim(n, x)));
const alcN2 = e(S('O1'), N('O2'), N('O3'));
const alcN3 = e(alcN2, N('O4'), N('O5'));
const algumSim = (qs) => ou(...qs.map(S));
/* SIM gravado num nível que o caminho não alcançou */
const simForaDoCaminho = ou(e(nao(alcN2), algumSim(NIVEIS.N2.concat(NIVEIS.N3))), e(alcN2, nao(alcN3), algumSim(NIVEIS.N3)));
const so = (n, q) => e(...NIVEIS[n].map((x) => (x === q ? S(x) : N(x))));

/* ---------- as 25 regras ----------
   saida: codigoResultado, tipoAValidar, motivo; nivel: como se acha nivelConfirmado; papeis: de onde vêm;
   nivelRegra: o nível em que a regra conclui (dá niveisAlcancados); conclusao: true se a tela operacional pode
   CONCLUIR com esta regra (dados completos — ajuste 9: falta de resposta/diagnóstico não conclui; SIM fora do
   caminho nem chega a ser gravado). */
const AV = 'A_VALIDAR';
function regra(id, condicao, codigo, tipo, motivo, nivelRegra, nivel, papeis, conclusao) {
  return { id, condicao, codigo, tipo, motivo, nivelRegra, nivel, papeis, conclusao };
}
const REGRAS = [
  regra('DEF_SIM_FORA_DO_CAMINHO', simForaDoCaminho, AV, 'INCOERENCIA', 'SIM_FORA_DO_CAMINHO', null, 'nulo', 'fora', false),
  regra('N1_RESPOSTA_FALTANDO', e(nao(simForaDoCaminho), algumaAusente('N1')), AV, 'EVIDENCIA_INSUFICIENTE', 'RESPOSTA_FALTANDO', 'N1', 'nulo', 'simsDoNivel', false),
  regra('N1_RECORTE', e(nao(simForaDoCaminho), exatamenteSim('N1', 3)), AV, 'RECORTE', 'TRES_OU_MAIS_PAPEIS', 'N1', 'nulo', 'simsDoNivel', true),
  regra('N1_CONFLITO', e(nao(simForaDoCaminho), exatamenteSim('N1', 2), D('N1', 'mesma')), AV, 'CONFLITO', 'DIAGNOSTICO_MESMA', 'N1', 'nulo', 'simsDoNivel', true),
  regra('N1_RECORTE_DIAGNOSTICO', e(nao(simForaDoCaminho), exatamenteSim('N1', 2), D('N1', 'distintas')), AV, 'RECORTE', 'DIAGNOSTICO_DISTINTAS', 'N1', 'nulo', 'simsDoNivel', true),
  regra('N1_DIAGNOSTICO_PENDENTE', e(nao(simForaDoCaminho), exatamenteSim('N1', 2), D('N1', null)), AV, 'EVIDENCIA_INSUFICIENTE', 'DIAGNOSTICO_PENDENTE', 'N1', 'nulo', 'simsDoNivel', false),
  regra('N1_AREA_ESPECIALIZADA', e(nao(simForaDoCaminho), so('N1', 'O2')), 'AREA_ESPECIALIZADA', null, 'PAPEL_UNICO', 'N1', 'nulo', 'codigo', true),
  regra('N1_COE', e(nao(simForaDoCaminho), so('N1', 'O3')), 'COE', null, 'PAPEL_UNICO', 'N1', 'nulo', 'codigo', true),
  regra('N1_SEM_PAPEL', e(nao(simForaDoCaminho), exatamenteSim('N1', 0)), AV, 'EVIDENCIA_INSUFICIENTE', 'SEM_PAPEL', 'N1', 'nulo', 'nenhum', true),
  regra('N2_RESPOSTA_FALTANDO', e(nao(simForaDoCaminho), alcN2, algumaAusente('N2')), AV, 'EVIDENCIA_INSUFICIENTE', 'RESPOSTA_FALTANDO', 'N2', 'LINHA', 'simsDoNivel', false),
  regra('N2_CONFLITO', e(nao(simForaDoCaminho), alcN2, exatamenteSim('N2', 2), D('N2', 'mesma')), AV, 'CONFLITO', 'DIAGNOSTICO_MESMA', 'N2', 'LINHA', 'simsDoNivel', true),
  regra('N2_RECORTE_DIAGNOSTICO', e(nao(simForaDoCaminho), alcN2, exatamenteSim('N2', 2), D('N2', 'distintas')), AV, 'RECORTE', 'DIAGNOSTICO_DISTINTAS', 'N2', 'LINHA', 'simsDoNivel', true),
  regra('N2_DIAGNOSTICO_PENDENTE', e(nao(simForaDoCaminho), alcN2, exatamenteSim('N2', 2), D('N2', null)), AV, 'EVIDENCIA_INSUFICIENTE', 'DIAGNOSTICO_PENDENTE', 'N2', 'LINHA', 'simsDoNivel', false),
  regra('N2_ESTRATEGIA_CLIENTES', e(nao(simForaDoCaminho), alcN2, so('N2', 'O4')), 'ESTRATEGIA_CLIENTES', null, 'PAPEL_UNICO', 'N2', 'nulo', 'codigo', true),
  regra('N2_NEGOCIOS', e(nao(simForaDoCaminho), alcN2, so('N2', 'O5')), 'NEGOCIOS', null, 'PAPEL_UNICO', 'N2', 'nulo', 'codigo', true),
  regra('N3_RESPOSTA_FALTANDO', e(nao(simForaDoCaminho), alcN3, algumaAusente('N3')), AV, 'EVIDENCIA_INSUFICIENTE', 'RESPOSTA_FALTANDO', 'N3', 'plataformaSeSimN3', 'simsDoNivel', false),
  regra('N3_RECORTE', e(nao(simForaDoCaminho), alcN3, peloMenosSim('N3', 3)), AV, 'RECORTE', 'TRES_OU_MAIS_PAPEIS', 'N3', 'plataformaSeSimN3', 'simsDoNivel', true),
  regra('N3_CONFLITO', e(nao(simForaDoCaminho), alcN3, exatamenteSim('N3', 2), D('N3', 'mesma')), AV, 'CONFLITO', 'DIAGNOSTICO_MESMA', 'N3', 'plataformaSeSimN3', 'simsDoNivel', true),
  regra('N3_RECORTE_DIAGNOSTICO', e(nao(simForaDoCaminho), alcN3, exatamenteSim('N3', 2), D('N3', 'distintas')), AV, 'RECORTE', 'DIAGNOSTICO_DISTINTAS', 'N3', 'plataformaSeSimN3', 'simsDoNivel', true),
  regra('N3_DIAGNOSTICO_PENDENTE', e(nao(simForaDoCaminho), alcN3, exatamenteSim('N3', 2), D('N3', null)), AV, 'EVIDENCIA_INSUFICIENTE', 'DIAGNOSTICO_PENDENTE', 'N3', 'plataformaSeSimN3', 'simsDoNivel', false),
  regra('N3_PLATAFORMA_CANAIS', e(nao(simForaDoCaminho), alcN3, so('N3', 'O6')), 'PLATAFORMA_CANAIS', null, 'PAPEL_UNICO', 'N3', 'nulo', 'codigo', true),
  regra('N3_PLATAFORMA_HABILITADORA_NEGOCIOS', e(nao(simForaDoCaminho), alcN3, so('N3', 'O7')), 'PLATAFORMA_HABILITADORA_NEGOCIOS', null, 'PAPEL_UNICO', 'N3', 'nulo', 'codigo', true),
  regra('N3_PLATAFORMA_HABILITADORA_TECNOLOGIA', e(nao(simForaDoCaminho), alcN3, so('N3', 'O8')), 'PLATAFORMA_HABILITADORA_TECNOLOGIA', null, 'PAPEL_UNICO', 'N3', 'nulo', 'codigo', true),
  regra('N3_PLATAFORMA_CORPORATIVA', e(nao(simForaDoCaminho), alcN3, so('N3', 'O9')), 'PLATAFORMA_CORPORATIVA', null, 'PAPEL_UNICO', 'N3', 'nulo', 'codigo', true),
  regra('N3_SEM_PAPEL', e(nao(simForaDoCaminho), alcN3, exatamenteSim('N3', 0)), AV, 'EVIDENCIA_INSUFICIENTE', 'SEM_PAPEL', 'N3', 'plataformaSeSimN3', 'nenhum', true)
];

/* ---------- avaliação em JS (para a prova) ---------- */
function vale(c, est) {
  switch (c.t) {
    case 'resp': { const v = est.respostas[c.q]; return c.v === null ? (v !== 'SIM' && v !== 'NAO') : v === c.v; }
    case 'diag': { const v = est.diagnosticos[c.n]; return c.v === null ? (v !== 'mesma' && v !== 'distintas') : v === c.v; }
    case 'e': return c.xs.every((x) => vale(x, est));
    case 'ou': return c.xs.some((x) => vale(x, est));
    case 'nao': return !vale(c.x, est);
    default: throw new Error('condição desconhecida: ' + c.t);
  }
}
function regrasQueValem(est) { return REGRAS.filter((r) => vale(r.condicao, est)); }
/* niveisAlcancados (para DEF: os alcançados pelo próprio estado) */
function alcancados(est) {
  const out = ['N1'];
  if (vale(alcN2, est)) out.push('N2');
  if (vale(alcN3, est)) out.push('N3');
  return out;
}
function foraDoCaminho(est) {
  const alc = alcancados(est), fora = [];
  ORDEM_NIVEIS.forEach((n) => { if (!alc.includes(n)) NIVEIS[n].forEach((q) => { if (est.respostas[q] === 'SIM') fora.push(q); }); });
  return fora;
}
/* Saída completa que a regra descreve para o estado (o mesmo formato de faMotorPosicionamento.avaliar). */
function saida(r, est) {
  const niveis = r.nivelRegra ? ORDEM_NIVEIS.slice(0, ORDEM_NIVEIS.indexOf(r.nivelRegra) + 1) : alcancados(est);
  const fora = r.papeis === 'fora' ? foraDoCaminho(est) : [];
  const papeis = r.papeis === 'fora' ? fora.map((q) => PAPEL[q])
    : r.papeis === 'codigo' ? [r.codigo]
      : r.papeis === 'nenhum' ? []
        : NIVEIS[r.nivelRegra].filter((q) => est.respostas[q] === 'SIM').map((q) => PAPEL[q]);
  const nivel = r.nivel === 'nulo' ? null : r.nivel === 'LINHA' ? 'LINHA'
    : NIVEIS.N3.some((q) => est.respostas[q] === 'SIM') ? 'PLATAFORMA' : 'LINHA';
  const libera = r.codigo === AV ? (nivel === 'LINHA' || nivel === 'PLATAFORMA') : DE_LINHA.includes(r.codigo);
  return { codigoResultado: r.codigo, tipoAValidar: r.tipo, motivo: r.motivo, nivelConfirmado: nivel, papeisDetectados: papeis,
    regra: r.id, versaoMotor: VERSAO_MOTOR, liberaSquad: libera, niveisAlcancados: niveis, perguntasForaDoCaminho: fora };
}

/* ---------- estados completos que podem ser CONCLUÍDOS (só o caminho; fora dele, nada gravado) ---------- */
function estadosConcluiveis() {
  const out = [];
  const vals = ['SIM', 'NAO'];
  function niveis(respostas, nivelIdx) {
    const n = ORDEM_NIVEIS[nivelIdx], qs = NIVEIS[n];
    const total = Math.pow(2, qs.length);
    for (let m = 0; m < total; m++) {
      const r = Object.assign({}, respostas);
      qs.forEach((q, i) => { r[q] = vals[(m >> i) & 1]; });
      const sims = qs.filter((q) => r[q] === 'SIM');
      const desce = (n === 'N1' && sims.length === 1 && sims[0] === 'O1') || (n === 'N2' && sims.length === 0);
      if (desce) { niveis(r, nivelIdx + 1); continue; }
      const diags = sims.length === 2 ? ['mesma', 'distintas'] : [null];
      diags.forEach((d) => {
        const est = { respostas: r, diagnosticos: d ? { [n]: d } : {} };
        out.push(est);
      });
    }
  }
  niveis({}, 0);
  return out.map((est) => {
    const rs = regrasQueValem(est);
    if (rs.length !== 1) throw new Error('estado sem regra única: ' + JSON.stringify(est));
    if (!rs[0].conclusao) throw new Error('estado concluível com regra não concluível: ' + rs[0].id);
    return { est, regra: rs[0], saida: saida(rs[0], est) };
  });
}

/* ---------- geração do trecho das regras do banco ----------
   Tudo a partir do registro da avaliação (o nível $id): newData = a avaliação inteira. */
const R = (q) => "newData.child('respostas/" + q + "/resposta').val()";
const RE = (q) => "newData.child('respostas/" + q + "').exists()";
const DG = (n) => "newData.child('diagnosticos/" + n + "/resposta').val()";
const RA = (campo) => "newData.child('resultadoAutomatico/" + campo + "')";
const str = (v) => "'" + v + "'";
const conj = (xs) => xs.filter(Boolean).join(' && ');
function lista(campo, valores) {
  return conj(valores.map((v, i) => RA(campo + '/' + i) + '.val() === ' + str(v)).concat(['!' + RA(campo + '/' + valores.length) + '.exists()']));
}
/* respostas que o caminho alcança: ALC2 = Linha confirmada no N1; ALC3 = ramo Plataforma */
const ALC2 = conj([R('O1') + " === 'SIM'", R('O2') + " === 'NAO'", R('O3') + " === 'NAO'"]);
const ALC3 = conj([ALC2, R('O4') + " === 'NAO'", R('O5') + " === 'NAO'"]);

/* (a) CAMINHO, em qualquer status: resposta só em pergunta do caminho alcançado; diagnóstico só no nível
   alcançado, completo e com exatamente 2 SIM — e com os 2 papéis (papeis/0, papeis/1) desses SIM. */
function trechoCaminho() {
  const partes = [];
  partes.push('(!' + RE('O4') + ' && !' + RE('O5') + ' || (' + ALC2 + '))');
  partes.push('(!' + RE('O6') + ' && !' + RE('O7') + ' && !' + RE('O8') + ' && !' + RE('O9') + ' || (' + ALC3 + '))');
  ORDEM_NIVEIS.forEach((n) => {
    const pre = n === 'N1' ? null : n === 'N2' ? ALC2 : ALC3;
    const combos = combinacoes(NIVEIS[n], 2).map((c) => '(' + conj([pre].concat(NIVEIS[n].map((q) => R(q) + ' === ' + (c.includes(q) ? "'SIM'" : "'NAO'")),
      ["newData.child('diagnosticos/" + n + "/papeis/0').val() === " + str(PAPEL[c[0]]),
        "newData.child('diagnosticos/" + n + "/papeis/1').val() === " + str(PAPEL[c[1]]),
        "!newData.child('diagnosticos/" + n + "/papeis/2').exists()"])) + ')');
    partes.push("(!newData.child('diagnosticos/" + n + "').exists() || " + combos.join(' || ') + ')');
  });
  return conj(partes);
}

/* (b) RESULTADO de uma avaliação concluída: igual ao que a regra (= motor v1) produz para estas respostas.
   Agrupado por regra: o que é igual em todos os estados da regra fica no prefixo. */
function trechoResultado() {
  const porRegra = {};
  estadosConcluiveis().forEach((x) => { (porRegra[x.regra.id] = porRegra[x.regra.id] || []).push(x); });
  const blocos = REGRAS.filter((r) => r.conclusao).map((r) => {
    const xs = porRegra[r.id] || [];
    if (!xs.length) throw new Error('regra concluível sem estado: ' + r.id);
    const s0 = xs[0].saida;
    const fixos = [
      RA('regra') + '.val() === ' + str(r.id),
      RA('codigoResultado') + '.val() === ' + str(s0.codigoResultado),
      s0.tipoAValidar ? RA('tipoAValidar') + '.val() === ' + str(s0.tipoAValidar) : '!' + RA('tipoAValidar') + '.exists()',
      RA('motivo') + '.val() === ' + str(s0.motivo),
      RA('versaoMotor') + '.val() === ' + VERSAO_MOTOR,
      lista('niveisAlcancados', s0.niveisAlcancados),
      '!' + RA('perguntasForaDoCaminho') + '.exists()'
    ];
    const termos = xs.map((x) => {
      const qs = PERGUNTAS.filter((q) => x.est.respostas[q]);
      const nivel = x.saida.nivelConfirmado;
      return qs.map((q) => R(q) + ' === ' + str(x.est.respostas[q]))
        .concat(Object.keys(x.est.diagnosticos).map((n) => DG(n) + ' === ' + str(x.est.diagnosticos[n])))
        .concat([nivel ? RA('nivelConfirmado') + '.val() === ' + str(nivel) : '!' + RA('nivelConfirmado') + '.exists()',
          RA('liberaSquad') + '.val() === ' + x.saida.liberaSquad,
          lista('papeisDetectados', x.saida.papeisDetectados)]);
    });
    /* o que vale em TODOS os estados da regra vai para o prefixo; só o que varia fica por estado */
    const comuns = termos[0].filter((t) => termos.every((ts) => ts.includes(t)));
    const casos = termos.map((ts) => ts.filter((t) => !comuns.includes(t))).filter((ts) => ts.length);
    return '(' + conj(fixos.concat(comuns)) + (casos.length ? ' && (' + casos.map((ts) => '(' + conj(ts) + ')').join(' || ') + ')' : '') + ')';
  });
  return '(' + blocos.join(' || ') + ')';
}

module.exports = { NIVEIS, PERGUNTAS, PAPEL, REGRAS, VERSAO_MOTOR, vale, regrasQueValem, saida, estadosConcluiveis, trechoCaminho, trechoResultado, combinacoes };

if (require.main === module && process.argv.includes('--imprimir')) {
  const c = trechoCaminho(), r = trechoResultado();
  console.log('caminho: ' + c.length + ' caracteres; resultado: ' + r.length + ' caracteres; estados concluíveis: ' + estadosConcluiveis().length);
}
