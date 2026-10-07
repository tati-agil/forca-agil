/* Motor de Squad — o validador só aceita S1–S8 nos eixos e os resultados de eixo na combinação.
 *
 * validarRegrasCompletas (trava de publicação e aviso da simulação) checava
 * resultado e cobertura das 256 combinações, mas aceitava qualquer nome de
 * pergunta: uma condição com "P5" ou "LINHA" era lida como vazia e nunca
 * valia, sem aviso. O validador do motor arquitetural já recusava nome
 * desconhecido; agora o de squad também. É validação ESTRUTURAL: as regras
 * A1–A3, B1–B3 e C1–C5 e os 256 resultados continuam os mesmos.
 *
 * Carrega o forca-agil/motor-squad.js real num vm (sem navegador, sem rede,
 * sem Firebase real) e prova:
 *   - as regras de fábrica continuam válidas e com os mesmos 256 resultados;
 *   - eixoA/eixoB recusam P1–P16, CLASSIFICACAO, LINHA, SQUAD, COE,
 *     AREA_ESPECIALIZADA e um nome inexistente, inclusive escondidos em
 *     not/any (onde a cobertura sozinha não pegaria);
 *   - eixoA/eixoB recusam valor que não seja SIM/NÃO;
 *   - a combinação só aceita necessidadeCapacidadeDedicada/condicoesParaSquad
 *     com um resultado que exista no eixo correspondente, e recusa S1–S8 lido
 *     direto (a combinação nunca lê as perguntas);
 *   - a mensagem diz qual regra, qual nome e por quê;
 *   - publicarRegras recusa sem tocar no banco. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (cond || detalhe === undefined ? '' : ' — ' + detalhe)); if (!cond) falhas++; }
const copia = (x) => JSON.parse(JSON.stringify(x));

let acessosBanco = 0;
const ctx = {
  window: {}, Date, console: { error() {}, log() {}, warn() {} },
  firebase: { database: () => { acessosBanco++; return { ref: () => ({ on() {}, once() {}, transaction() {}, update() {}, set() {}, push: () => ({ key: 'k' }) }) }; } }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'motor-squad.js'), 'utf8'), ctx, { filename: 'motor-squad.js' });
const M = ctx.window.faMotorSquad;
const fabrica = copia(M.PADRAO_REGRAS);
const SQ = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

console.log('\n-- regras de fábrica --');
{
  const v = M.validarRegrasCompletas(copia(fabrica));
  afirma(v.valida && v.estrutura.length === 0, 'continuam válidas', JSON.stringify(v.estrutura));
  /* os 256 resultados contra a regra escrita aqui, à parte (a mesma do pedido) */
  const sim = (r, k) => r[k].resposta === 'sim';
  let dif = 0, forte = 0;
  for (let n = 0; n < 256; n++) {
    const r = {}; SQ.forEach((k, i) => { r[k] = { resposta: (n >> i) & 1 ? 'sim' : 'nao' }; });
    const A = sim(r, 'S1') && sim(r, 'S2') ? (sim(r, 'S4') && sim(r, 'S5') ? 'DEMONSTRADA' : 'PARCIALMENTE_DEMONSTRADA') : 'NAO_DEMONSTRADA';
    const B = !sim(r, 'S7') ? 'LIMITADAS_PELA_AUTONOMIA' : (sim(r, 'S3') && sim(r, 'S6') && sim(r, 'S8') ? 'PRESENTES' : 'PARCIAIS');
    const C = A === 'DEMONSTRADA' ? { PRESENTES: 'FORTE_ADERENCIA_SQUAD_DEDICADA', PARCIAIS: 'JUSTIFICA_CAPACIDADE_COM_CONDICOES_A_DESENVOLVER', LIMITADAS_PELA_AUTONOMIA: 'JUSTIFICA_CAPACIDADE_MAS_AUTONOMIA_PRECISA_SER_TRATADA' }[B]
      : A === 'PARCIALMENTE_DEMONSTRADA' ? 'AVALIAR_MODELO_GESTAO_ANTES_DE_SQUAD_EXCLUSIVA' : 'NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA';
    const x = M.identificarAdequacaoSquad(r, copia(fabrica), true);
    if (x.necessidadeCapacidadeDedicada !== A || x.condicoesParaSquad !== B || x.indicacaoOrganizacional !== C) dif++;
    if (C === 'FORTE_ADERENCIA_SQUAD_DEDICADA') forte++;
  }
  afirma(dif === 0 && forte === 1, 'os 256 resultados (eixo A, eixo B, indicação) continuam iguais à regra aprovada', dif + ' diferenças');
}

function comFolha(grupo, codigo, folha, envolver) {
  const r = copia(fabrica);
  const regra = r[grupo].find((x) => x.codigo === codigo);
  const vizinha = grupo === 'combinacao' ? { campo: 'necessidadeCapacidadeDedicada', valor: 'DEMONSTRADA' } : { campo: 'S1', valor: 'SIM' };
  const nova = envolver === 'not' ? { not: folha } : envolver === 'any' ? { any: [folha, vizinha] } : folha;
  if (Array.isArray(regra.condicoes.all)) regra.condicoes.all.push(nova); else regra.condicoes = { all: [regra.condicoes, nova] };
  return r;
}

console.log('\n-- eixos A e B: só S1–S8 --');
{
  const proibidos = [];
  for (let i = 1; i <= 16; i++) proibidos.push('P' + i);
  proibidos.push('CLASSIFICACAO', 'LINHA', 'SQUAD', 'COE', 'AREA_ESPECIALIZADA', 'S9', 'demandaContinua', 'camadaSugerida');
  for (const grupo of ['eixoA', 'eixoB']) {
    const codigo = grupo === 'eixoA' ? 'A1' : 'B2';
    const aceitos = [];
    for (const campo of proibidos) for (const envolver of ['direto', 'not', 'any']) {
      const v = M.validarRegrasCompletas(comFolha(grupo, codigo, { campo, valor: 'SIM' }, envolver));
      const temMsg = v.estrutura.some((m) => m.indexOf('A regra ' + codigo + ' (' + grupo + ')') === 0 && m.indexOf('"' + campo + '"') !== -1);
      if (v.valida || !temMsg) aceitos.push(campo + '/' + envolver);
    }
    afirma(aceitos.length === 0, grupo + ': recusa ' + proibidos.length + ' nomes fora de S1–S8, direto, em "não" e em "qualquer"', aceitos.join(', '));
  }
  const vP = M.validarRegrasCompletas(comFolha('eixoB', 'B2', { campo: 'P5', valor: 'SIM' }, 'not'));
  afirma(vP.estrutura.some((m) => /P5.*motor arquitetural/.test(m)), 'a mensagem de P5 diz que é pergunta do motor arquitetural', vP.estrutura.join(' | '));
  const vL = M.validarRegrasCompletas(comFolha('eixoA', 'A1', { campo: 'LINHA', valor: 'SIM' }, 'not'));
  afirma(vL.estrutura.some((m) => /LINHA.*estrutura organizacional/.test(m)), 'a mensagem de LINHA diz que é estrutura organizacional', vL.estrutura.join(' | '));
  const vV = M.validarRegrasCompletas(comFolha('eixoA', 'A1', { campo: 'S3', valor: 'TALVEZ' }, 'not'));
  afirma(!vV.valida && vV.estrutura.some((m) => /S3.*TALVEZ.*SIM ou NÃO/.test(m)), 'valor fora de SIM/NÃO é recusado', vV.estrutura.join(' | '));
  const vMin = M.validarRegrasCompletas(comFolha('eixoA', 'A1', { campo: 'S3', valor: 'sim' }, 'not'));
  afirma(!vMin.estrutura.some((m) => /S3/.test(m)), '"sim" em minúsculas continua aceito (o executor normaliza)', vMin.estrutura.join(' | '));
}

console.log('\n-- combinação: só os resultados dos eixos --');
{
  const aceitos = [];
  for (const campo of SQ.concat(['P5', 'CLASSIFICACAO', 'LINHA', 'necessidade'])) {
    const v = M.validarRegrasCompletas(comFolha('combinacao', 'C1', { campo, valor: 'SIM' }, 'not'));
    if (v.valida || !v.estrutura.some((m) => m.indexOf('"' + campo + '"') !== -1)) aceitos.push(campo);
  }
  afirma(aceitos.length === 0, 'recusa S1–S8 lidos direto e qualquer outro nome', aceitos.join(', '));
  const vS = M.validarRegrasCompletas(comFolha('combinacao', 'C1', { campo: 'S4', valor: 'SIM' }, 'not'));
  afirma(vS.estrutura.some((m) => /"S4", que é pergunta/.test(m)), 'a mensagem de S4 na combinação diz que perguntas só entram nos eixos', vS.estrutura.join(' | '));
  const vR = M.validarRegrasCompletas(comFolha('combinacao', 'C1', { campo: 'condicoesParaSquad', valor: 'DEMONSTRADA' }, 'not'));
  afirma(vR.estrutura.some((m) => /condicoesParaSquad.*DEMONSTRADA/.test(m)), 'recusa comparar condicoesParaSquad com um resultado do eixo A', vR.estrutura.join(' | '));
  const vOk = M.validarRegrasCompletas(comFolha('combinacao', 'C1', { campo: 'condicoesParaSquad', valor: 'PRESENTES' }, 'any'));
  afirma(vOk.estrutura.length === 0, 'aceita condicoesParaSquad = PRESENTES (resultado real do eixo B)', vOk.estrutura.join(' | '));
}

console.log('\n-- publicar recusa sem tocar no banco --');
{
  const antes = acessosBanco;
  let resposta = null;
  M.publicarRegras(comFolha('eixoB', 'B2', { campo: 'P5', valor: 'SIM' }, 'not'), 'teste', (err, info) => { resposta = { err, info }; }, 1);
  afirma(resposta && resposta.err === 'regras-invalidas' && acessosBanco === antes, 'publicarRegras devolve "regras-invalidas" e não acessa o banco', JSON.stringify(resposta && resposta.err));
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
