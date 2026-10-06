/* Motor de Squad — as 256 combinações de S1–S8, uma por uma.
 *
 * Carrega o forca-agil/motor-squad.js REAL (o mesmo arquivo que o site serve)
 * num vm, sem navegador e sem Firebase, e compara Eixo A, Eixo B e indicação
 * organizacional de TODAS as 2^8 combinações completas de respostas com uma
 * expectativa escrita aqui, à parte, a partir da regra aprovada — nunca
 * copiada das regras do motor:
 *
 *   Eixo A (S1, S2, S4, S5): S1 e S2 SIM → (S4 e S5 SIM → demonstrada;
 *     senão parcial); S1 ou S2 NÃO → não demonstrada.
 *   Eixo B (S3, S6, S7, S8): S7 NÃO → limitada pela autonomia (decide
 *     sozinho); S7 SIM → (S3, S6 e S8 SIM → presentes; senão parciais).
 *   Combinação: A demonstrada + B presentes → C1; + B parciais → C2;
 *     + B autonomia → C3; A parcial (qualquer B) → C4; A não demonstrada
 *     (qualquer B) → C5.
 *
 * Também prova:
 *   - nenhuma combinação completa termina em INDETERMINADO, e todas as 11
 *     regras (A1–A3, B1–B3, C1–C5) são alcançadas;
 *   - a trava de publicação: validarRegrasCompletas aceita as regras de
 *     fábrica e recusa cada uma das trocas de SIM/NÃO que o editor permite e
 *     que abrem combinações sem resultado; publicarRegras recusa sem tocar no
 *     banco;
 *   - PROVA INVERSA: com uma regra adulterada (C2 e C3 trocados), a mesma
 *     comparação acusa as combinações exatas que divergiram — a checagem não
 *     passa por vazio.
 * Hermético: sem rede, sem navegador, sem segredo. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

const ARQUIVO = path.join(__dirname, '..', '..', 'forca-agil', 'motor-squad.js');
const errosConsole = [];
let acessosBanco = 0;
const ctx = {
  window: {},
  console: { error: (...a) => errosConsole.push(a), log: () => {}, warn: () => {} },
  /* "banco" que só conta acessos e nunca responde: se a trava falhar e
     publicarRegras chegar a ele, o teste acusa (em vez de quebrar no meio) */
  firebase: { database: () => { acessosBanco++; return { ref: () => ({ transaction() {}, update() {}, push: () => ({ key: 'k' }) }) }; } },
  Date
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ARQUIVO, 'utf8'), ctx, { filename: 'motor-squad.js' });
const M = ctx.window.faMotorSquad;
const copia = (x) => JSON.parse(JSON.stringify(x));

const PERGUNTAS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
/* A expectativa — escrita a partir da regra aprovada, em linguagem própria. */
function esperado(s) {
  const sim = (c) => s[c] === 'SIM';
  const A = sim('S1') && sim('S2') ? (sim('S4') && sim('S5') ? 'DEMONSTRADA' : 'PARCIALMENTE_DEMONSTRADA') : 'NAO_DEMONSTRADA';
  const B = !sim('S7') ? 'LIMITADAS_PELA_AUTONOMIA' : (sim('S3') && sim('S6') && sim('S8') ? 'PRESENTES' : 'PARCIAIS');
  let C;
  if (A === 'DEMONSTRADA') C = { PRESENTES: 'C1', PARCIAIS: 'C2', LIMITADAS_PELA_AUTONOMIA: 'C3' }[B];
  else if (A === 'PARCIALMENTE_DEMONSTRADA') C = 'C4';
  else C = 'C5';
  return { A, B, C };
}
const CODIGO_C = {
  FORTE_ADERENCIA_SQUAD_DEDICADA: 'C1',
  JUSTIFICA_CAPACIDADE_COM_CONDICOES_A_DESENVOLVER: 'C2',
  JUSTIFICA_CAPACIDADE_MAS_AUTONOMIA_PRECISA_SER_TRATADA: 'C3',
  AVALIAR_MODELO_GESTAO_ANTES_DE_SQUAD_EXCLUSIVA: 'C4',
  NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA: 'C5'
};
function combinacao(n) {
  const s = {}, respostas = {};
  PERGUNTAS.forEach((c, i) => {
    const v = ((n >> (7 - i)) & 1) ? 'SIM' : 'NAO';
    s[c] = v;
    respostas[c] = { resposta: v === 'SIM' ? 'sim' : 'nao' }; /* como a tela grava */
  });
  return { s, respostas, rotulo: PERGUNTAS.map((c) => c + '=' + (s[c] === 'SIM' ? 'S' : 'N')).join(' ') };
}
/* Compara as 256 combinações de um conjunto de regras com a expectativa. */
function comparar(regras) {
  const divergentes = [], indeterminados = [], resultados = [];
  for (let n = 0; n < 256; n++) {
    const { s, respostas, rotulo } = combinacao(n);
    const r = M.identificarAdequacaoSquad(respostas, regras, true);
    const obtido = { A: r.necessidadeCapacidadeDedicada, B: r.condicoesParaSquad, C: CODIGO_C[r.indicacaoOrganizacional] || r.indicacaoOrganizacional };
    const e = esperado(s);
    resultados.push(obtido);
    if ([obtido.A, obtido.B, obtido.C].includes('INDETERMINADO')) indeterminados.push(rotulo);
    if (obtido.A !== e.A || obtido.B !== e.B || obtido.C !== e.C) divergentes.push({ rotulo, esperado: e, obtido });
  }
  return { divergentes, indeterminados, resultados };
}

console.log('\n== As 256 combinações com as regras vigentes (versão ' + M.versaoAtual() + ', de fábrica) ==');
const vigentes = M.regrasDaVersao(M.versaoAtual());
const base = comparar(vigentes);
afirma(base.resultados.length === 256, '256 combinações avaliadas');
afirma(base.divergentes.length === 0, '256/256 iguais à regra aprovada (Eixo A, Eixo B e indicação)' +
  (base.divergentes.length ? ' — divergentes: ' + base.divergentes.slice(0, 5).map((d) => d.rotulo).join(' | ') : ''));
afirma(base.indeterminados.length === 0, 'nenhuma combinação completa termina em INDETERMINADO (' + base.indeterminados.length + ')');
afirma(errosConsole.length === 0, 'o motor não reclamou de "nenhuma regra aplicável" em nenhuma combinação');

const contagem = {};
base.resultados.forEach((r) => { contagem[r.A + ' + ' + r.B + ' → ' + r.C] = (contagem[r.A + ' + ' + r.B + ' → ' + r.C] || 0) + 1; });
Object.keys(contagem).sort().forEach((k) => console.log('        ' + String(contagem[k]).padStart(3) + '  ' + k));
const porC = {};
base.resultados.forEach((r) => { porC[r.C] = (porC[r.C] || 0) + 1; });
afirma(porC.C1 === 1 && porC.C2 === 7 && porC.C3 === 8 && porC.C4 === 48 && porC.C5 === 192,
  'distribuição C1–C5 = 1 / 7 / 8 / 48 / 192 (' + ['C1', 'C2', 'C3', 'C4', 'C5'].map((c) => porC[c] || 0).join(' / ') + ')');

console.log('\n== Todas as regras são alcançadas ==');
const alcancados = { A: new Set(base.resultados.map((r) => r.A)), B: new Set(base.resultados.map((r) => r.B)), C: new Set(base.resultados.map((r) => r.C)) };
['eixoA', 'eixoB', 'combinacao'].forEach((grupo, i) => {
  const eixo = ['A', 'B', 'C'][i];
  vigentes[grupo].forEach((regra) => {
    const codigo = eixo === 'C' ? CODIGO_C[regra.resultado] : regra.resultado;
    afirma(alcancados[eixo].has(codigo), 'regra ' + regra.codigo + ' (' + regra.resultado + ') decide pelo menos uma combinação');
  });
});

console.log('\n== Cada pergunta mexe só no eixo dela ==');
/* Inverter UMA resposta muda o Eixo A só para S1/S2/S4/S5 e o Eixo B só
   para S3/S6/S7/S8 — nenhuma pergunta atravessa de eixo. */
const mudou = {};
PERGUNTAS.forEach((c) => { mudou[c] = { A: 0, B: 0 }; });
for (let n = 0; n < 256; n++) {
  const a = M.identificarAdequacaoSquad(combinacao(n).respostas, vigentes, true);
  PERGUNTAS.forEach((c, i) => {
    const b = M.identificarAdequacaoSquad(combinacao(n ^ (1 << (7 - i))).respostas, vigentes, true);
    if (a.necessidadeCapacidadeDedicada !== b.necessidadeCapacidadeDedicada) mudou[c].A++;
    if (a.condicoesParaSquad !== b.condicoesParaSquad) mudou[c].B++;
  });
}
afirma(['S1', 'S2', 'S4', 'S5'].every((c) => mudou[c].A > 0 && mudou[c].B === 0), 'S1, S2, S4 e S5 só mudam o Eixo A');
afirma(['S3', 'S6', 'S7', 'S8'].every((c) => mudou[c].B > 0 && mudou[c].A === 0), 'S3, S6, S7 e S8 só mudam o Eixo B');

console.log('\n== Trava de publicação: validarRegrasCompletas ==');
const vFabrica = M.validarRegrasCompletas(vigentes);
afirma(vFabrica.valida && vFabrica.invalidas.length === 0 && vFabrica.totalCombinacoes === 256, 'as regras de fábrica passam (256 combinações com resultado)');
/* Cada troca de SIM/NÃO que o editor permite, uma por vez. */
const folhas = [];
function percorrer(cond, caminho) {
  if (cond.all) cond.all.forEach((x, i) => percorrer(x, caminho.concat('all', i)));
  else if (cond.any) cond.any.forEach((x, i) => percorrer(x, caminho.concat('any', i)));
  else if (cond.not) percorrer(cond.not, caminho.concat('not'));
  else if (/^S[1-8]$/.test(cond.campo)) folhas.push(caminho);
}
['eixoA', 'eixoB'].forEach((g) => vigentes[g].forEach((r, i) => percorrer(r.condicoes, [g, i, 'condicoes'])));
let recusadas = 0;
const exemplosRecusa = [];
folhas.forEach((caminho) => {
  const regras = copia(vigentes);
  let folha = regras;
  caminho.forEach((k) => { folha = folha[k]; });
  folha.valor = folha.valor === 'SIM' ? 'NAO' : 'SIM';
  const v = M.validarRegrasCompletas(regras);
  /* a trava e a comparação independente concordam sobre QUAIS combinações ficam sem resultado */
  const semResultado = comparar(regras).indeterminados.length;
  if (!v.valida && v.invalidas.length === semResultado) recusadas++;
  if (exemplosRecusa.length < 3) exemplosRecusa.push(regras[caminho[0]][caminho[1]].codigo + ' ' + folha.campo + '→' + folha.valor + ': ' + v.invalidas.length + ' sem resultado, ex.: ' + (v.invalidas[0] || {}).respostas);
});
afirma(folhas.length === 19 && recusadas === folhas.length, 'as ' + folhas.length + ' trocas isoladas de SIM/NÃO que abrem buraco são todas recusadas, com a contagem exata (' + recusadas + ')');
exemplosRecusa.forEach((x) => console.log('        ' + x));
const resultadoDesconhecido = copia(vigentes);
resultadoDesconhecido.combinacao[0].resultado = 'SQUAD_INVENTADA';
const vDesconhecido = M.validarRegrasCompletas(resultadoDesconhecido);
afirma(!vDesconhecido.valida && vDesconhecido.estrutura.some((m) => /C1/.test(m) && /desconhecido/.test(m)), 'um resultado que não existe é recusado como estrutura inválida');
const semGrupo = copia(vigentes);
delete semGrupo.eixoB;
afirma(!M.validarRegrasCompletas(semGrupo).valida, 'um conjunto sem o Eixo B é recusado');

console.log('\n== publicarRegras recusa sem tocar no banco ==');
const invalida = copia(vigentes);
invalida.eixoB[0].condicoes.all[0].valor = 'SIM'; /* B1: S7 → SIM — S7=NÃO fica sem regra */
let resposta = null;
M.publicarRegras(invalida, { email: 'teste@previ.com.br' }, (err, info) => { resposta = { err, info }; }, 1);
afirma(resposta && resposta.err === 'regras-invalidas' && resposta.info.invalidas.length === 128,
  'regras com buraco: callback "regras-invalidas" com as 128 combinações sem resultado (' + (resposta && resposta.info && resposta.info.invalidas.length) + ')');
afirma(acessosBanco === 0, 'nenhum acesso ao banco antes de recusar (nada gravado, nenhuma versão criada)');

console.log('\n== PROVA INVERSA: regra adulterada ==');
/* C2 e C3 com os resultados trocados — um erro plausível de edição. A
   comparação tem de acusar exatamente as combinações A demonstrada + B
   parciais/autonomia (7 + 8 = 15) e nomear cada uma. */
const adulterada = copia(vigentes);
const c2 = adulterada.combinacao.find((r) => r.codigo === 'C2');
const c3 = adulterada.combinacao.find((r) => r.codigo === 'C3');
[c2.resultado, c3.resultado] = [c3.resultado, c2.resultado];
const prova = comparar(adulterada);
afirma(prova.divergentes.length === 15, 'a regra adulterada diverge em 15 combinações (' + prova.divergentes.length + ')');
const exemplo = prova.divergentes.find((d) => d.rotulo === 'S1=S S2=S S3=N S4=S S5=S S6=S S7=S S8=S');
afirma(!!exemplo && exemplo.esperado.C === 'C2' && exemplo.obtido.C === 'C3', 'e aponta a combinação exata: S1=S S2=S S3=N S4=S S5=S S6=S S7=S S8=S esperava C2, deu C3');
afirma(M.validarRegrasCompletas(adulterada).valida, '(a trava não pega isso — toda combinação tem resultado; é a comparação com a regra aprovada que pega)');

console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
process.exit(falhas ? 1 : 0);
