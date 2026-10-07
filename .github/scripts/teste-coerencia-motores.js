/* Coerência entre o motor arquitetural (P1–P16) e o motor de Squad (S1–S8).
 *
 * Princípio verificado: identificar a natureza de um objeto não implica criar
 * estrutura organizacional para ele, e vice-versa. Os dois motores respondem
 * perguntas diferentes e nenhum lê o que o outro decide.
 *
 * Carrega os arquivos REAIS (forca-agil/motor-arquitetura.js e
 * forca-agil/motor-squad.js) num vm, sem navegador, sem rede, sem Firebase
 * real, e prova:
 *   1. o motor P1–P16 ignora qualquer coisa fora de P1–P16 (respostas S1–S8,
 *      indicação de squad, "linha", "coe"…) nas 65.536 combinações, e o
 *      validador do editor recusa uma regra que use S1–S8;
 *   2. o motor S1–S8 ignora P1–P16 e a classificação arquitetural nas 256
 *      combinações;
 *   3. o vocabulário de saída de cada motor não contém o do outro nem o do
 *      Mapa da Floresta (Linha, Squad, CoE, Área Especializada, Plataforma);
 *   4. qualquer classificação convive com qualquer indicação de squad — os
 *      10 casos do diagnóstico, rodados nos dois motores;
 *   5. fatos das regras de squad que o diagnóstico cita (A2 inclui S4 e S5 =
 *      NÃO; o eixo B só pesa quando o eixo A é "demonstrada");
 *   6. não há escrita no banco.
 * Linhas "info" registram o que o diagnóstico aponta sem que seja falha (o
 * validador de squad não recusa nome de pergunta desconhecido).
 * Não muda regra nenhuma do site. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const D = require('./diagnostico-motor-v6.js');

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (cond || detalhe === undefined ? '' : ' — ' + detalhe)); if (!cond) falhas++; }
function info(msg) { console.log('  info  ' + msg); }
const copia = (x) => JSON.parse(JSON.stringify(x));

/* ---- motores reais */
const { M, escritas } = D.carregarMotor();
const v5 = D.regrasV5(M);
const escritasSquad = [];
const ctxS = {
  window: {}, Date, console: { error() {}, log() {}, warn() {} },
  firebase: { database: () => ({ ref: () => ({ on() {}, once() {}, off() {},
    transaction() { escritasSquad.push('transaction'); }, update() { escritasSquad.push('update'); }, set() { escritasSquad.push('set'); },
    push() { escritasSquad.push('push'); return { key: 'k' }; } }) }) }
};
vm.createContext(ctxS);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'motor-squad.js'), 'utf8'), ctxS, { filename: 'motor-squad.js' });
const S = ctxS.window.faMotorSquad;
const regrasSquad = copia(S.PADRAO_REGRAS);
const SQ = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

function arq(sims, extra) {
  const c = {}; D.CAMPOS.forEach((k) => { c[k] = sims.includes(k) ? 'SIM' : 'NAO'; });
  return M.identificarCamada(Object.assign(c, extra || {}), { regras: copia(v5) });
}
function squad(sims, extra) {
  const r = {}; SQ.forEach((k) => { r[k] = { resposta: sims.includes(k) ? 'sim' : 'nao' }; });
  return S.identificarAdequacaoSquad(Object.assign(r, extra || {}), copia(regrasSquad), true);
}

console.log('\n-- 1. P1–P16 não lê nada de fora --');
{
  const extraSim = { linha: 'Linha de Negócios', coe: 'SIM', squad: 'FORTE_ADERENCIA_SQUAD_DEDICADA', indicacaoOrganizacional: 'C1' };
  const extraNao = { linha: '', coe: 'NAO', squad: 'NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA', indicacaoOrganizacional: 'C5' };
  SQ.forEach((k) => { extraSim[k] = 'SIM'; extraNao[k] = 'NAO'; });
  let dif = 0;
  for (let n = 0; n < D.TOTAL; n++) {
    const base = D.combinacao(n);
    const a = M.identificarCamada(base, { regras: copia(v5) });
    const b = M.identificarCamada(Object.assign({}, base, n & 1 ? extraSim : extraNao), { regras: copia(v5) });
    if (a.camada !== b.camada || a.regraAplicada !== b.regraAplicada) dif++;
  }
  afirma(dif === 0, 'com S1–S8, indicação de squad, Linha e CoE no contexto, as 65.536 decisões não mudam', dif);
  const recusas = SQ.filter((k) => {
    const r = copia(v5); r.find((x) => x.codigo === 'PRODUTO_SERVICO_PRINCIPAL').condicoes.all.push({ campo: k, valor: 'SIM' });
    return M.validarRegras({ regras: r }).some((e) => e.indexOf('Pergunta desconhecida "' + k + '"') !== -1);
  });
  afirma(recusas.length === 8, 'o validador do editor recusa uma regra arquitetural que use qualquer S1–S8', recusas.join(','));
}

console.log('\n-- 2. S1–S8 não lê nada de fora --');
{
  let dif = 0;
  for (let n = 0; n < 256; n++) {
    const sims = SQ.filter((_, i) => (n >> i) & 1);
    const a = squad(sims);
    const extra = { camadaSugerida: { id: n & 1 ? 'produto-principal' : 'componente' }, resultadoAutomatico: n & 1 ? 'produto' : 'nao-produto' };
    D.CAMPOS.forEach((k) => { extra[k] = { resposta: n & 2 ? 'sim' : 'nao' }; });
    const b = squad(sims, extra);
    if (a.indicacaoOrganizacional !== b.indicacaoOrganizacional || a.necessidadeCapacidadeDedicada !== b.necessidadeCapacidadeDedicada || a.condicoesParaSquad !== b.condicoesParaSquad) dif++;
  }
  afirma(dif === 0, 'com P1–P16 e a classificação arquitetural junto das respostas, as 256 decisões não mudam', dif);
  const r = copia(regrasSquad); r.eixoB.find((x) => x.codigo === 'B2').condicoes.all.push({ not: { campo: 'P5', valor: 'SIM' } });
  const v = S.validarRegrasCompletas(r);
  info('o validador de squad ' + (v.valida ? 'ACEITA' : 'recusa') + ' uma regra com "P5" (P5 é sempre lida como vazia ali, então não decide nada; o validador arquitetural, ao contrário, recusa nome desconhecido)');
}

console.log('\n-- 3. vocabulário de saída --');
{
  const ORGANIZACIONAL = /linha|squad|coe\b|centro de excel|área especializada|area especializada|plataforma|gestão corporativa/i;
  const camadas = Array.from(M.CAMADAS_VALIDAS);
  const nomesCamadas = camadas.map((c) => (M.PADRAO_TEXTOS[c] && M.PADRAO_TEXTOS[c].rotulo) || c);
  afirma(camadas.length === 11 && !nomesCamadas.concat(camadas).some((t) => ORGANIZACIONAL.test(t)), 'as 11 classificações P1–P16 não usam termos do Mapa da Floresta', nomesCamadas.join(' | '));
  const resultadosSquad = ['eixoA', 'eixoB', 'combinacao'].flatMap((g) => regrasSquad[g].map((r) => r.resultado));
  afirma(!resultadosSquad.some((r) => camadas.includes(r.toLowerCase())), 'nenhum resultado de squad é uma classificação arquitetural');
  const textosSquad = Object.values(S.PADRAO_TEXTOS).map((t) => t.rotulo + ' ' + t.interpretacao).join(' ');
  afirma(!/produto\/servi|produto principal|componente|capacidade organizacional/i.test(textosSquad), 'nenhum rótulo ou interpretação de squad afirma o que o objeto é');
}

console.log('\n-- 4. qualquer natureza convive com qualquer indicação --');
{
  const S_NENHUM = [], S_TODOS = SQ.slice();
  const NUCLEO = ['P1', 'P2', 'P3', 'P4', 'P5', 'P8'];
  const casos = [
    ['1. Produto/Serviço sem Squad dedicada', NUCLEO, S_NENHUM, 'produto-principal', 'NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA'],
    ['2. Produto/Serviço com Squad dedicada', NUCLEO, S_TODOS, 'produto-principal', 'FORTE_ADERENCIA_SQUAD_DEDICADA'],
    ['3. Componente sem Squad dedicada', ['P15'], S_NENHUM, 'componente', 'NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA'],
    ['4. Componente com Squad dedicada', ['P15'], S_TODOS, 'componente', 'FORTE_ADERENCIA_SQUAD_DEDICADA'],
    ['5. Regra sem Squad', ['P14'], S_NENHUM, 'regra-condicao', 'NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA'],
    ['6. Capacidade com Squad', ['P4', 'P11'], S_TODOS, 'capacidade-organizacional', 'FORTE_ADERENCIA_SQUAD_DEDICADA']
  ];
  casos.forEach(([nome, p, s, camada, indicacao]) => {
    const a = arq(p), b = squad(s);
    afirma(a.camada === camada && b.indicacaoOrganizacional === indicacao, nome + ': ' + camada + ' + ' + indicacao, a.camada + ' + ' + b.indicacaoOrganizacional);
  });
  /* 7. vários Produtos/Serviços compartilhando uma Squad: três itens Produto/Serviço;
     a Adequação respondida para o domínio que os reúne indica squad, sem que nenhum
     dos três precise de squad própria nem mude de natureza. */
  const tres = [NUCLEO, NUCLEO.concat(['P6']), NUCLEO.concat(['P7'])].map((p) => arq(p).camada);
  const dominio = squad(S_TODOS), cadaUm = squad(['S1', 'S3', 'S7', 'S8']);
  afirma(tres.every((c) => c === 'produto-principal') && dominio.indicacaoOrganizacional === 'FORTE_ADERENCIA_SQUAD_DEDICADA' && cadaUm.indicacaoOrganizacional === 'NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA',
    '7. três Produtos/Serviços; cada um sozinho não justifica squad, o domínio que os reúne justifica — nenhuma natureza muda');
  /* 8–10: Linha, CoE e Área Especializada não são entrada nem saída de nenhum motor (provado em 1, 2 e 3);
     aqui, a mesma natureza com e sem "estrutura organizacional" informada. */
  const comOrg = (extra) => ['P15', 'P14', 'P11'].map((p) => arq([p, 'P4'], extra).camada);
  const semOrg = comOrg();
  afirma(JSON.stringify(comOrg({ linha: 'Linha de Plataforma Habilitadora de Negócios', squads: '3' })) === JSON.stringify(semOrg), '8. várias Squads formando uma Linha: informar a Linha não muda a natureza de nada');
  afirma(JSON.stringify(comOrg({ coe: 'CoE de Dados', apoia: 'SIM' })) === JSON.stringify(semOrg), '9. CoE apoiando objetos: a natureza de cada objeto continua a mesma');
  afirma(JSON.stringify(comOrg({ areaEspecializada: 'Jurídico', linhasApoiadas: '4' })) === JSON.stringify(semOrg), '10. Área Especializada apoiando várias Linhas: idem');
}

console.log('\n-- 5. fatos das regras de squad citados no diagnóstico --');
{
  const a2 = squad(['S1', 'S2']);
  afirma(a2.necessidadeCapacidadeDedicada === 'PARCIALMENTE_DEMONSTRADA', 'A2 vale com S1 e S2 SIM mesmo com S4 e S5 = NÃO (não exige "pelo menos um entre S4 e S5")', a2.necessidadeCapacidadeDedicada);
  let bIgnorado = true;
  for (let n = 0; n < 256; n++) {
    const sims = SQ.filter((_, i) => (n >> i) & 1);
    const r = squad(sims);
    if (r.necessidadeCapacidadeDedicada !== 'DEMONSTRADA') {
      const outroB = squad(sims.filter((k) => !['S3', 'S6', 'S7', 'S8'].includes(k)).concat(['S3', 'S6', 'S7', 'S8']));
      if (outroB.indicacaoOrganizacional !== r.indicacaoOrganizacional) { bIgnorado = false; break; }
    }
  }
  afirma(bIgnorado, 'quando o eixo A não é "demonstrada", o eixo B (S3, S6, S7, S8) não muda a indicação');
}

console.log('\n-- 6. nada é gravado --');
afirma(escritas.length === 0 && escritasSquad.length === 0, 'nenhuma escrita no banco falso', JSON.stringify(escritas.concat(escritasSquad)));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
