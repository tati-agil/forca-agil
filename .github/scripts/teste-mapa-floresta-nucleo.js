/* Catálogo preparatório do Mapa da Floresta — a parte PURA de mapa-floresta.js (window.faMapaFlorestaCatalogo),
 * sem navegador e sem banco. Carrega os arquivos REAIS (avaliacao-produto.js expõe faBaseProdutoServico;
 * avaliacao-posicionamento.js, gateDoItem; estruturas-nucleo.js, posicionamentoEfetivo; o núcleo do motor, os códigos
 * firmes e o invariante Linha × Squad) e prova:
 *   A. As três categorias vêm do motor: Linha = os 6 códigos firmes que formam Squads; Área Especializada e CoE não.
 *   B. Sem as quatro leituras não há catálogo (pronto = false em todas as 15 combinações com alguma faltando).
 *   C. Precedência, em todas as combinações (9 recomendações × sem decisão + 8 decisões): decisão final > recomendação
 *      firme > A VALIDAR (nunca firme sem decisão).
 *   D. Situações sem Posicionamento: sem base (não concluída, reavaliação em andamento, ambígua, motor desatualizado),
 *      sem Posicionamento (gate atual), verificando (motor não carregado — nem pendência nem avanço).
 *   E. Um objeto por item (versões agrupadas, nome da ponta), sem os da Lixeira; alerta quando a base mudou.
 *   F. Guarda estática: o módulo não grava nada e nunca chama, do núcleo de Estruturas, o que concluiria "sem
 *      responsável" a partir de coleções vazias; index.html carrega estruturas-nucleo.js antes de mapa-floresta.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = process.env.FA_RAIZ || path.join(__dirname, '..', '..', 'forca-agil');
let total = 0, falhas = 0;
function anota(linha, ok, detalhe) {
  total++;
  if (ok) { console.log('  ok    ' + linha); return; }
  falhas++;
  console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : ''));
}

function carregar() {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); }, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  for (const f of ['questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js', 'motor-posicionamento.js', 'motor-posicionamento-nucleo.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
  delete ctx.document;
  for (const f of ['avaliacao-posicionamento.js', 'estruturas-nucleo.js', 'mapa-floresta.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
const ctx = carregar();
const C = ctx.faMapaFlorestaCatalogo, B = ctx.faBaseProdutoServico, N = ctx.faMotorPosicionamentoNucleo;
const MOTOR = (fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8').match(/\n  var MOTOR_VERSION = '([^']+)';/) || [])[1];
/* contexto do motor de P1–P16 carregado na versão 2 (o mesmo formato que contextoMotorAtual devolve) */
const MOTOR_OK = { motorVersion: MOTOR, configCarregada: () => true, versaoAtual: () => 2, equivalencia: () => false };
function deps(ctxMotor) {
  return { B, ctxMotor: ctxMotor === undefined ? MOTOR_OK : ctxMotor, gateDoItem: ctx.faAvaliacaoPosicionamentoNucleo.gateDoItem,
    posicionamentoEfetivo: ctx.faEstruturasNucleo.posicionamentoEfetivo, codigosFirmes: N.CODIGOS_FIRMES };
}
const prod = (itemId, nome, extra) => Object.assign({ itemId, nome, status: 'concluido', motorVersion: MOTOR, motorVersionArquitetura: 2, excluido: false, versao: 1 }, extra || {});
const pos = (itemId, codigo, extra) => Object.assign({ itemId, status: 'concluido', versao: 1, avaliacaoArquiteturalId: itemId, resultadoAutomatico: { codigoResultado: codigo } }, extra || {});
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

anota('módulo puro exposto e congelado', !!C && Object.isFrozen(C) && typeof C.montarCatalogo === 'function');
anota('MOTOR_VERSION lida de avaliacao-produto.js', !!MOTOR);

console.log('\n== A. categorias derivadas do motor ==');
const cats = C.categorias(N);
const linha = cats.find((c) => c.id === 'LINHA');
anota('três categorias, na ordem Linha, Área Especializada, CoE', igual(cats.map((c) => c.id), ['LINHA', 'AREA_ESPECIALIZADA', 'COE']), JSON.stringify(cats.map((c) => c.id)));
anota('Linha = os 6 códigos firmes que formam Squads', linha.codigos.length === 6 && linha.codigos.every((c) => N.liberaSquadParaCodigoFirme(c) === true) && linha.formaSquads === true);
anota('Área Especializada e CoE não formam Squads', cats.filter((c) => c.id !== 'LINHA').every((c) => c.formaSquads === false && N.liberaSquadParaCodigoFirme(c.id) === false));
anota('as categorias cobrem exatamente os 8 códigos firmes', igual(cats.reduce((a, c) => a.concat(c.codigos), []).sort(), N.CODIGOS_FIRMES.slice().sort()));

console.log('\n== B. sem as quatro leituras, não há catálogo ==');
const cheio = { produtos: { p: prod('p', 'P') }, registros: {}, vigentes: {}, decisoes: {} };
let combinacoes = 0, recusadas = 0;
for (let m = 1; m < 16; m++) {
  const d = Object.assign({}, cheio);
  ['produtos', 'registros', 'vigentes', 'decisoes'].forEach((k, i) => { if (m & (1 << i)) d[k] = undefined; });
  combinacoes++;
  const r = C.montarCatalogo(d, deps());
  if (r.pronto === false && r.itens.length === 0) recusadas++;
}
anota('pronto = false e nenhum item em ' + combinacoes + ' combinações com leitura faltando (' + recusadas + ')', recusadas === combinacoes);
anota('com as quatro leituras: pronto', C.montarCatalogo(cheio, deps()).pronto === true);
anota('banco sem nenhuma avaliação: catálogo pronto e vazio (ausência comprovada)', igual(C.montarCatalogo({ produtos: {}, registros: {}, vigentes: {}, decisoes: {} }, deps()), { pronto: true, itens: [] }));

console.log('\n== C. precedência: decisão final > recomendação firme > A VALIDAR ==');
const AUTOS = N.CODIGOS_FIRMES.concat(['A_VALIDAR']);
let casos = 0, certos = 0; const erros = [];
AUTOS.forEach((auto) => [null].concat(N.CODIGOS_FIRMES).forEach((final) => {
  const d = { produtos: { p: prod('p', 'P') }, registros: { g: pos('p', auto) }, vigentes: { p: 'g' }, decisoes: final ? { g: { codigoFinal: final } } : {} };
  const x = C.situacaoDoItem('p', d, deps());
  const esperado = final ? { situacao: 'firme', codigo: final, origem: 'decisao' } : auto !== 'A_VALIDAR' ? { situacao: 'firme', codigo: auto, origem: 'recomendacao' } : { situacao: 'a-validar', codigo: null, origem: null };
  const obtido = { situacao: x.situacao, codigo: x.efetivo ? x.efetivo.codigo : null, origem: x.efetivo ? x.efetivo.origem : null };
  casos++;
  if (igual(obtido, esperado)) certos++; else erros.push(auto + '/' + final + ': ' + JSON.stringify(obtido));
}));
anota('esperado em ' + casos + ' combinações (' + certos + ')', certos === casos, erros.slice(0, 3).join(' | '));
const semVig = C.situacaoDoItem('p', { produtos: { p: prod('p', 'P') }, registros: { g: pos('p', 'NEGOCIOS') }, vigentes: {}, decisoes: {} }, deps());
anota('avaliação concluída que NÃO é a vigente não conta como Posicionamento', semVig.situacao === 'sem-posicionamento' && !semVig.efetivo);
const rasc = C.situacaoDoItem('p', { produtos: { p: prod('p', 'P') }, registros: { g: pos('p', 'NEGOCIOS', { status: 'rascunho' }) }, vigentes: {}, decisoes: {} }, deps());
anota('rascunho de Posicionamento: sem Posicionamento concluído, com o rascunho indicado', rasc.situacao === 'sem-posicionamento' && rasc.rascunhoId === 'g');

console.log('\n== D. situações sem Posicionamento ==');
const SB = {
  'nao-concluida': { p: prod('p', 'P', { status: 'rascunho' }) },
  'reavaliacao-em-andamento': { p: prod('p', 'P'), p2: prod('p', 'P', { versao: 2, versaoAnteriorKey: 'p', status: 'rascunho' }) },
  indefinida: { p: prod('p', 'P'), p2: prod('p', 'P', { versao: 2 }) },
  desatualizado: { p: prod('p', 'P', { motorVersion: 'antigo' }) }
};
Object.keys(SB).forEach((motivo) => {
  const x = C.situacaoDoItem('p', { produtos: SB[motivo], registros: {}, vigentes: {}, decisoes: {} }, deps());
  anota('sem base: ' + motivo, x.situacao === 'sem-base' && x.motivo === motivo, JSON.stringify({ s: x.situacao, m: x.motivo }));
});
anota('gate atual sem Posicionamento: sem Posicionamento concluído', C.situacaoDoItem('p', cheio, deps()).situacao === 'sem-posicionamento');
anota('motor de P1–P16 ainda não carregado: "verificando" (nem pendência nem avanço)', C.situacaoDoItem('p', cheio, deps(null)).situacao === 'verificando');
const vigVerif = C.situacaoDoItem('p', { produtos: { p: prod('p', 'P') }, registros: { g: pos('p', 'COE') }, vigentes: { p: 'g' }, decisoes: {} }, deps(null));
anota('com Posicionamento vigente, o motor pendente não esconde o posicionamento nem inventa alerta', vigVerif.situacao === 'firme' && vigVerif.alertaBase === null);

console.log('\n== E. um objeto por item, sem Lixeira; alerta de base ==');
const dados = {
  produtos: { a1: prod('a1', 'Antigo nome'), a2: prod('a1', 'Nome atual', { versao: 2, versaoAnteriorKey: 'a1' }), z: prod('z', 'Zeta'), x: prod('x', 'Na Lixeira', { excluido: true }) },
  registros: { gA: pos('a1', 'NEGOCIOS', { avaliacaoArquiteturalId: 'a1' }) }, vigentes: { a1: 'gA' }, decisoes: {}
};
const cat = C.montarCatalogo(dados, deps());
anota('itens: a1 (uma vez, nome da ponta) e z; o da Lixeira fica fora', igual(cat.itens.map((i) => [i.itemId, i.nome]), [['a1', 'Nome atual'], ['z', 'Zeta']]), JSON.stringify(cat.itens.map((i) => [i.itemId, i.nome])));
anota('Posicionamento feito sobre versão anterior de P1–P16: alerta "base-anterior"', cat.itens[0].situacao === 'firme' && cat.itens[0].alertaBase === 'base-anterior');
const f = C.filtrar(cat.itens, { posicionamento: 'LINHA' }, cats);
anota('filtro por categoria Linha encontra Negócios', igual(f.map((i) => i.itemId), ['a1']));
anota('contagem por situação', igual(C.contarPorSituacao(cat.itens), { verificando: 0, 'sem-base': 0, 'sem-posicionamento': 1, 'a-validar': 0, firme: 1 }));

console.log('\n== F. guarda estática ==');
const fonte = fs.readFileSync(path.join(RAIZ, 'mapa-floresta.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
anota('nenhuma gravação no módulo: não usa gravar/novaChave/executar da interface de serviços nem o Firebase direto', !/\.(gravar|novaChave|executar|agoraServidor)\s*\(/.test(fonte) && !/firebase\s*\.|\.ref\s*\(|\.(update|set|transaction|remove)\s*\(/.test(fonte));
anota('só lê pela interface de serviços (ouvir)', /S\(\)\.ouvir\(/.test(fonte));
anota('nunca usa situacaoResponsavel, responsavelAtivo, vincular*, aplicar nem relacoesDaEstrutura (sem coleções fictícias para objetos reais)', !/situacaoResponsavel|responsavelAtivo|vincular|\.aplicar\(|relacoesDaEstrutura/.test(fonte));
/* o Mapa visual lê estruturas e objetos com as consultas do núcleo — SÓ sobre D.estado, D = dados(): OU o estado
   demonstrativo explícito (mapa-floresta-demo.js) OU (Etapa 4, ambiente de testes) um estado só com as estruturas
   CADASTRADAS, sem relações, vínculos nem objetos — nunca as duas juntas, nunca montado com as coleções do Catálogo */
const consultas = fonte.match(/(estruturasDoTipo|objetosDaEstrutura)\(([^,)]*)/g) || [];
const corpoDados = (/function dados\(\) \{([\s\S]*?)\n    \}/.exec(fonte) || [])[1] || '';
anota('estruturasDoTipo e objetosDaEstrutura só sobre D.estado, D = dados() = demonstração OU estruturas e subagrupadores cadastrados (sem relações, vínculos nem objetos; nada do Catálogo)', consultas.length > 0 && consultas.every((x) => /\(D\.estado$/.test(x)) &&
  /* demo() só devolve um cenário do próprio módulo de demonstração (habitual ou populoso), nunca dado real */
  /function demo\(\) \{ return window\.faMapaFlorestaDemo && window\.faMapaFlorestaDemo\.cenario\(cenarioDemo\); \}/.test(fonte) &&
  /* dados(): fora do cadastro, a demonstração; no cadastro, SÓ as estruturas persistidas — nunca as duas, nunca o Catálogo */
  /if \(fonte !== 'cadastro'\) return demo\(\);/.test(corpoDados) &&
  /estado: \{ estruturas: cadastro\.estruturas, relacoes: \{\}, vinculos: \{\} \}, subagrupadores: subagrupadoresCadastrados\(\), associacoesSubagrupador: associacoesCadastradas\(\), objetos: \{\}/.test(corpoDados) &&
  /* Etapa 5: subagrupadores e associações vêm SÓ do cadastro (cadastro.*), calculados pelo núcleo — nunca do Catálogo */
  !/state\./.test(((/function subagrupadoresCadastrados\(\) \{([\s\S]*?)\n    \}/.exec(fonte) || [])[1] || 'state.') + ((/function associacoesCadastradas\(\) \{([\s\S]*?)\n    \}/.exec(fonte) || [])[1] || 'state.')) &&
  /function estadoSubagrupadores\(\) \{ return \{ estruturas: cadastro\.estruturas, subagrupadores: cadastro\.subagrupadores, associacoesSubagrupador: cadastro\.associacoes \}; \}/.test(fonte) &&
  !/state\./.test(corpoDados) && !/var D = demo\(\)/.test(fonte) && (fonte.match(/var D = dados\(\)/g) || []).length >= 2, consultas.join(' | '));
const html = fs.readFileSync(path.join(RAIZ, '..', 'index.html'), 'utf8');
const iPos = html.indexOf('forca-agil/avaliacao-posicionamento.js'), iEst = html.indexOf('forca-agil/estruturas-nucleo.js'), iMapa = html.indexOf('forca-agil/mapa-floresta.js');
anota('index.html: avaliacao-posicionamento.js → estruturas-nucleo.js → mapa-floresta.js', iPos !== -1 && iPos < iEst && iEst < iMapa);

console.log('\n' + (total - falhas) + '/' + total + ' verificações' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ' — tudo certo.'));
process.exit(falhas ? 1 : 0);
