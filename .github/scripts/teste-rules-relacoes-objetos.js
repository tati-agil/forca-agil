/* ═════════════════════════════════════════════════════════════════
   Regras do banco — E4: RELAÇÕES ENTRE OBJETOS ARQUITETURAIS e NATUREZAS INDIVIDUAIS.

   Roda contra o EMULADOR real do Realtime Database (teste-rules.yml) com o database.rules.json de produção. As
   gravações são as que o código real monta: forca-agil/relacoes-objetos-nucleo.js. Prova, pelo BANCO:
   A. Leitura: os três perfis da Avaliação; sem perfil e sem login, não.
   B. Taxonomia: só a administração geral cria o conceito de uma natureza individual, e só com definição publicada e
      naturezaDe = a camada do motor que a contém; naturezaDe não muda nem se apaga; auditoria 'conceito_criado'.
   C. Natureza individual de um objeto: só "Avaliação + Configuração" e admin geral, com o marcador ligado; só com o
      conceito oficial válido; só dentro da camada da avaliação que vale (concluída, não excluída, Motor atual, decisão
      "não produto"); revisão + 1 com auditoria nova na mesma gravação; auditoria só de acréscimo.
   D. Relação: só os pares da matriz; natureza de cada ponta conferida (Porta 2 ativa ou avaliação P1–P16 válida e,
      nas camadas conjuntas, natureza registrada); sem autorrelação; horário do servidor; autoria do token; evento e
      operação na mesma gravação; "Avaliação" e quem não tem perfil não gravam; marcador desligado → ninguém grava.
   E. Duplicidade e concorrência: a mesma relação ativa só uma vez (inclusive gravações simultâneas); "compõe" com o
      contador de versão do grafo — duas criações sobre a mesma versão: só uma entra.
   F. Encerrar: motivo obrigatório, final, libera o índice; nada se apaga; a relação pode ser registrada de novo.
   G. Eventos e operações só de acréscimo.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');
const R = require(path.join(RAIZ, 'forca-agil', 'relacoes-objetos-nucleo.js'));
const MOTOR = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_');
const ADMIN = 'admin.geral@previ.com.br', ARQ = 'arquitetura@previ.com.br', AVAL = 'avaliacao@previ.com.br', SEM = 'sem.acesso@previ.com.br';
const TS = { '.sv': 'timestamp' };
const js = (v) => JSON.parse(JSON.stringify(v));
const usuario = (e) => ({ id: emailKey(e), email: e });
let seq = 0;
const novaChave = (p) => p + (++seq) + 'x';

/* avaliações P1–P16 de teste: concluídas, com Motor atual (o que as regras conferem) */
const AV = (camada, decisao, extra) => Object.assign({ status: 'concluido', excluido: false, motorVersion: MOTOR, resultadoAutomatico: decisao, decisaoFinal: decisao, camadaSugerida: { id: camada } }, extra || {});
const ITENS = {
  pProd: AV('componente', 'produto'), pComp: AV('componente', 'nao-produto'), pComp2: AV('componente', 'nao-produto'), pCanal: AV('canal', 'nao-produto'),
  pCap: AV('capacidade-organizacional', 'nao-produto'), pFunc: AV('funcionalidade-operacao', 'nao-produto'), pFunc2: AV('funcionalidade-operacao', 'nao-produto'), pOper: AV('funcionalidade-operacao', 'nao-produto'),
  pProc: AV('processo-etapa', 'nao-produto'), pEtapa: AV('processo-etapa', 'nao-produto'), pRegra: AV('regra-condicao', 'nao-produto'),
  pDoc: AV('documento-informacao', 'nao-produto'), pAval: AV('a-validar', 'a-validar'), pExcl: AV('componente', 'nao-produto', { excluido: true }),
  pVelho: AV('componente', 'nao-produto', { motorVersion: 'v-antiga' }), pIncoer: AV('produto-principal', 'nao-produto')
};
const CONCEITOS = ['funcionalidade', 'operacao', 'processo', 'etapa', 'regra', 'documento']; /* 'informacao' e 'opcao' ficam sem conceito */

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-relacoes', database: { rules } });
  const db = (e) => (e ? env.authenticatedContext(emailKey(e), { email: e }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  const up = (e, w) => db(e).ref().update(js(w));
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'NEGADO: ' + String(e.message || e).slice(0, 220)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi ACEITO'); } }
  const marcador = (v) => semear((a) => a.ref(R.MARCADOR).set(v));

  await env.clearDatabase();
  await semear(async (a) => {
    await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
    for (const k of Object.keys(ITENS)) await a.ref('avaliacoes-produto/' + k).set(Object.assign({ itemId: k, nome: 'Item ' + k }, ITENS[k]));
    /* cada item tem uma versão só: ela é a vigente (índice reconciliado) */
    for (const k of Object.keys(ITENS)) await a.ref(R.PONTA + '/' + k).set(k);
    await a.ref('objetos-organizacionais/o1').set({ nome: 'Atendimento (teste)', situacao: 'ativo' });
    await a.ref('objetos-organizacionais/o2').set({ nome: 'Antiga (teste)', situacao: 'encerrado' });
  });
  await marcador(true);

  /* ===== A. Leitura ===== */
  console.log('A. Leitura');
  for (const [e, rot] of [[ADMIN, 'admin geral'], [ARQ, 'Avaliação + Configuração'], [AVAL, 'Avaliação']]) {
    await pode(rot + ' lê as relações', db(e).ref(R.RAIZ).once('value'));
    await pode(rot + ' lê as naturezas registradas', db(e).ref(R.NAT).once('value'));
    await pode(rot + ' lê o marcador', db(e).ref(R.MARCADOR).once('value'));
  }
  await nega('sem perfil não lê as relações', db(SEM).ref(R.RAIZ).once('value'));
  await nega('sem login não lê as relações', db(null).ref(R.RAIZ).once('value'));
  await nega('ninguém grava o marcador (nem admin geral)', db(ADMIN).ref(R.MARCADOR).set(false));

  /* ===== B. Taxonomia: conceitos das naturezas individuais ===== */
  console.log('B. Taxonomia');
  const conceito = (cod, e, ajuste) => {
    const r = R.criarConceitoNatureza(cod, 'Nome de ' + cod, 'Definição aprovada de ' + cod + ' (teste).', { email: e, agoraIso: '2026-10-18T12:00:00.000Z', auditoriaKey: novaChave('aud'), ordem: 50 });
    const c = js(r.caminhos);
    if (ajuste) ajuste(c, 'taxonomia/arquitetural/conceitos/' + cod);
    return c;
  };
  await nega('Avaliação + Configuração não cria conceito da Taxonomia', up(ARQ, conceito('funcionalidade', ARQ)));
  await nega('conceito de natureza individual sem naturezaDe é recusado', up(ADMIN, conceito('funcionalidade', ADMIN, (c, b) => { delete c[b].naturezaDe; })));
  await nega('naturezaDe diferente da camada que contém a natureza é recusado', up(ADMIN, conceito('funcionalidade', ADMIN, (c, b) => { c[b].naturezaDe = 'processo-etapa'; })));
  await nega('conceito de natureza individual sem definição é recusado', up(ADMIN, conceito('funcionalidade', ADMIN, (c, b) => { delete c[b].definicao; Object.keys(c).filter((k) => k.indexOf('/definicoes/') !== -1).forEach((k) => delete c[k]); })));
  /* C41: o cadastro é administração da Taxonomia — vale com o marcador da E4 ausente, false ou true */
  const SITUACAO_MARCADOR = [null, false, true];
  for (let i = 0; i < CONCEITOS.length; i++) {
    const cod = CONCEITOS[i], m = SITUACAO_MARCADOR[Math.min(i, 2)];
    await semear((a) => a.ref(R.MARCADOR).set(m));
    await pode('admin geral cria o conceito "' + cod + '" com definição e naturezaDe (marcador da E4 ' + (m === null ? 'ausente' : String(m)) + ')', up(ADMIN, conceito(cod, ADMIN)));
  }
  await marcador(true);
  const antesDup = await ler('taxonomia/arquitetural/conceitos/funcionalidade');
  await nega('cadastro duplicado: criar de novo um conceito que já existe é recusado', up(ADMIN, conceito('funcionalidade', ADMIN, (c, b) => { c[b].nome = 'Outro nome'; })));
  await semear((a) => a.ref(R.MARCADOR).remove());
  await nega('cadastro duplicado também é recusado com o marcador ausente', up(ADMIN, conceito('operacao', ADMIN)));
  await marcador(true);
  anota('o conceito existente ficou intacto', JSON.stringify(await ler('taxonomia/arquitetural/conceitos/funcionalidade')) === JSON.stringify(antesDup));
  await nega('Avaliação + Configuração não cria conceito, nem com o marcador ausente', (async () => { await semear((a) => a.ref(R.MARCADOR).remove()); try { await up(ARQ, conceito('informacao', ARQ)); } finally { await marcador(true); } })());
  await nega('perfil Avaliação não cria conceito', up(AVAL, conceito('informacao', AVAL)));
  await nega('naturezaDe não muda depois de criado', db(ADMIN).ref('taxonomia/arquitetural/conceitos/funcionalidade/naturezaDe').set('processo-etapa'));
  await nega('naturezaDe não se apaga', db(ADMIN).ref('taxonomia/arquitetural/conceitos/funcionalidade/naturezaDe').remove());
  anota('a auditoria registra "conceito_criado"', Object.values((await ler('taxonomia/arquitetural/auditoria/funcionalidade')) || {}).some((a) => a.tipo === 'conceito_criado'));
  await pode('Avaliação lê naturezaDe do conceito', db(AVAL).ref('taxonomia/arquitetural/conceitos/operacao/naturezaDe').once('value'));

  /* ===== C. Natureza individual ===== */
  console.log('C. Natureza individual');
  const gate = async (k) => ({ situacao: 'atual', libera: true, chave: k, avaliacao: await ler('avaliacoes-produto/' + k) });
  const conc = async (cod) => { const c = await ler('taxonomia/arquitetural/conceitos/' + cod); return c ? { ativo: c.ativo, naturezaDe: c.naturezaDe, temDefinicao: !!(c.definicao && c.definicao.texto) } : null; };
  const natW = async (obj, nat, e, opcoes) => {
    opcoes = opcoes || {};
    const g = opcoes.gate || await gate(obj);
    const r = R.registrarNatureza(obj, nat, g, await ler(R.NAT + '/' + obj), opcoes.conceito || (await conc(nat)) || { ativo: true, naturezaDe: R.NATUREZAS[nat] && R.NATUREZAS[nat].camada, temDefinicao: true }, { auditoriaId: novaChave('na'), usuario: usuario(e), agora: TS });
    if (!r.ok) throw new Error('núcleo recusou: ' + JSON.stringify(r.erros));
    const c = js(r.caminhos);
    if (opcoes.ajuste) opcoes.ajuste(c);
    return c;
  };
  await nega('Avaliação não registra natureza', up(AVAL, await natW('pFunc', 'funcionalidade', AVAL)));
  await marcador(false);
  await nega('marcador desligado: ninguém registra natureza', up(ARQ, await natW('pFunc', 'funcionalidade', ARQ)));
  await marcador(true);
  await nega('sem conceito oficial (Informação) a natureza não é registrada', up(ARQ, await natW('pDoc', 'informacao', ARQ)));
  await semear((a) => a.ref('taxonomia/arquitetural/conceitos/informacao').set({ nome: 'Informação', ordem: 1, ativo: false, naturezaDe: 'documento-informacao', definicao: { texto: 'x', versao: 1, publicadaEm: 'x', publicadaPor: ADMIN } }));
  await nega('conceito oficial INATIVO não permite registrar a natureza', up(ARQ, await natW('pDoc', 'informacao', ARQ, { conceito: { ativo: true, naturezaDe: 'documento-informacao', temDefinicao: true } })));
  await semear((a) => a.ref('taxonomia/arquitetural/conceitos/informacao').set({ nome: 'Informação', ordem: 1, ativo: true, naturezaDe: 'documento-informacao' }));
  await nega('conceito oficial SEM definição publicada (dado legado) não permite registrar a natureza', up(ARQ, await natW('pDoc', 'informacao', ARQ, { conceito: { ativo: true, naturezaDe: 'documento-informacao', temDefinicao: true } })));
  await semear((a) => a.ref('taxonomia/arquitetural/conceitos/informacao').remove());
  await nega('natureza fora da camada da avaliação (Processo num item de Funcionalidade/Operação) é recusada', up(ARQ, await natW('pFunc', 'processo', ARQ, { gate: { situacao: 'atual', libera: true, chave: 'pFunc', avaliacao: Object.assign({}, ITENS.pFunc, { camadaSugerida: { id: 'processo-etapa' } }) } })));
  await nega('avaliação excluída não serve de base', up(ARQ, await natW('pExcl', 'funcionalidade', ARQ, { gate: { situacao: 'atual', libera: true, chave: 'pExcl', avaliacao: Object.assign({}, ITENS.pExcl, { excluido: false, camadaSugerida: { id: 'funcionalidade-operacao' } }) } })));
  await nega('autoria de outra pessoa é recusada', up(ARQ, await natW('pFunc', 'funcionalidade', ARQ, { ajuste: (c) => { c[R.NAT + '/pFunc'].registradaPor.email = ADMIN; } })));
  await nega('horário que não é o do servidor é recusado', up(ARQ, await natW('pFunc', 'funcionalidade', ARQ, { ajuste: (c) => { c[R.NAT + '/pFunc'].registradaEm = 1; } })));
  await nega('sem a auditoria na mesma gravação é recusado', up(ARQ, await natW('pFunc', 'funcionalidade', ARQ, { ajuste: (c) => { Object.keys(c).filter((k) => k.indexOf(R.NAT_AUD) === 0).forEach((k) => delete c[k]); } })));
  for (const [obj, nat] of [['pFunc', 'operacao'], ['pOper', 'operacao'], ['pProc', 'processo'], ['pEtapa', 'etapa'], ['pRegra', 'regra'], ['pDoc', 'documento']]) await pode('Avaliação + Configuração registra "' + nat + '" para ' + obj, up(ARQ, await natW(obj, nat, ARQ)));
  await pode('corrigir a natureza registrada (Operação → Funcionalidade): revisão + 1, com auditoria "alteracao"', up(ARQ, await natW('pFunc', 'funcionalidade', ARQ)));
  const nf = await ler(R.NAT + '/pFunc'), audF = Object.values((await ler(R.NAT_AUD + '/pFunc')) || {});
  anota('o registro guarda revisão 2 e a auditoria guarda o valor anterior', nf.revisao === 2 && audF.some((a) => a.tipo === 'alteracao' && a.anterior === 'operacao' && a.natureza === 'funcionalidade'), JSON.stringify([nf, audF]));
  await nega('auditoria da natureza só de acréscimo', db(ADMIN).ref(R.NAT_AUD + '/pFunc/' + Object.keys(await ler(R.NAT_AUD + '/pFunc'))[0] + '/natureza').set('processo'));
  await nega('a natureza registrada não se apaga', db(ADMIN).ref(R.NAT + '/pFunc').remove());

  /* ===== D. Relação ===== */
  console.log('D. Relação');
  const natureza = async (obj) => {
    const o = await ler('objetos-organizacionais/' + obj);
    if (o) return R.naturezaDoObjeto({ porta2: o });
    return R.naturezaDoObjeto({ gate: await gate(obj), registro: await ler(R.NAT + '/' + obj) });
  };
  const relW = async (o, t, d, e, opcoes) => {
    opcoes = opcoes || {};
    const estado = { registros: (await ler(R.RAIZ + '/registros')) || {} };
    const nat = { origem: opcoes.natOrigem || await natureza(o), destino: opcoes.natDestino || await natureza(d) };
    const versao = opcoes.versao !== undefined ? opcoes.versao : ((await ler(R.RAIZ + '/versao-compoe')) || 0);
    const r = R.criarRelacao(opcoes.estado || estado, { origem: o, tipo: t, destino: d, observacao: opcoes.obs }, nat, { relacaoId: opcoes.id || novaChave('rel'), operacaoId: novaChave('op'), usuario: usuario(e), agora: TS, versaoCompoe: versao });
    if (!r.ok) { if (opcoes.forcar) return opcoes.forcar(); throw new Error('núcleo recusou: ' + JSON.stringify(r.erros)); }
    const c = js(r.caminhos);
    if (opcoes.ajuste) opcoes.ajuste(c, r.relacao.id);
    return c;
  };
  await pode('Componente compõe Produto/Serviço (par 1) — Avaliação + Configuração', up(ARQ, await relW('pComp', 'compoe', 'pProd', ARQ)));
  const regs = (await ler(R.RAIZ + '/registros')) || {}, r1 = Object.values(regs)[0];
  anota('a relação guarda as naturezas, as bases, a versão da matriz, horário e autoria', r1 && r1.naturezaOrigem === 'componente' && r1.naturezaDestino === 'produto' && r1.baseOrigem === 'pComp' && r1.baseDestino === 'pProd' && r1.versaoMatriz === R.VERSAO_MATRIZ && typeof r1.criadaEm === 'number' && r1.criadaPor.email === ARQ, JSON.stringify(r1));
  anota('o contador de versão do grafo de "compõe" foi a 1', (await ler(R.RAIZ + '/versao-compoe')) === 1);
  await nega('Avaliação não cria relação', up(AVAL, await relW('pFunc', 'usa', 'pOper', AVAL)));
  await nega('sem perfil não cria relação', up(SEM, await relW('pFunc', 'usa', 'pOper', SEM)));
  await marcador(false);
  await nega('marcador desligado: ninguém cria relação', up(ADMIN, await relW('pFunc', 'usa', 'pOper', ADMIN)));
  await marcador(true);
  await pode('admin geral cria Funcionalidade usa Operação (par 17)', up(ADMIN, await relW('pFunc', 'usa', 'pOper', ADMIN)));
  for (const [o, t, d, rot] of [['pOper', 'usa', 'pComp', 'Operação usa Componente (2)'], ['pOper', 'usa', 'pCap', 'Operação usa Capacidade (3)'], ['pRegra', 'governa', 'pProc', 'Regra governa Processo (6)'],
    ['pDoc', 'expressa', 'pRegra', 'Documento expressa Regra (7)'], ['pOper', 'dispara', 'pProc', 'Operação dispara Processo (8)'], ['pProc', 'produz', 'pDoc', 'Processo produz Documento (9)'],
    ['pCap', 'exerce-por-meio-de', 'pCanal', 'Capacidade exerce-se por meio de Canal (12)'], ['pCanal', 'da-acesso', 'pFunc', 'Canal dá acesso a Funcionalidade (13)'],
    ['pEtapa', 'compoe', 'pProc', 'Etapa compõe Processo (16)'], ['pCanal', 'da-acesso', 'pProd', 'Canal dá acesso a Produto/Serviço (19)'], ['pRegra', 'governa', 'pProd', 'Regra governa Produto/Serviço (20)']])
    await pode(rot, up(ARQ, await relW(o, t, d, ARQ)));
  await pode('Porta 2: responsabilidade ativa atua sobre um Processo', up(ARQ, await relW('o1', 'atua-sobre', 'pProc', ARQ)));
  /* pares fora da matriz e naturezas que o banco não confirma (gravações adulteradas: o núcleo recusaria) */
  const adulterar = async (rot, o, t, d, mexer) => nega(rot, up(ARQ, await relW(o, t, d, ARQ, { ajuste: mexer })));
  await adulterar('par fora da matriz (Produto/Serviço compõe Componente) é recusado', 'pComp2', 'compoe', 'pProd', (c, id) => {
    const r = c[R.RAIZ + '/registros/' + id]; const k0 = R.chaveAtiva(r.origem, r.tipo, r.destino);
    [r.origem, r.destino] = ['pProd', 'pComp2']; [r.naturezaOrigem, r.naturezaDestino] = ['produto', 'componente']; [r.baseOrigem, r.baseDestino] = ['pProd', 'pComp2'];
    delete c[R.RAIZ + '/ativa-por-chave/' + k0]; c[R.RAIZ + '/ativa-por-chave/' + R.chaveAtiva('pProd', 'compoe', 'pComp2')] = id;
    const ev = c[R.RAIZ + '/eventos/' + r.ultimoEvento]; ev.depois = JSON.parse(JSON.stringify(r));
  });
  await adulterar('natureza declarada diferente da avaliação (Componente declarado Canal) é recusada', 'pComp2', 'compoe', 'pProd', (c, id) => {
    const r = c[R.RAIZ + '/registros/' + id]; r.naturezaOrigem = 'canal'; c[R.RAIZ + '/eventos/' + r.ultimoEvento].depois.naturezaOrigem = 'canal';
  });
  await adulterar('base de outro item é recusada', 'pComp2', 'compoe', 'pProd', (c, id) => { c[R.RAIZ + '/registros/' + id].baseOrigem = 'pComp'; });
  await adulterar('base excluída é recusada', 'pComp2', 'compoe', 'pProd', (c, id) => { c[R.RAIZ + '/registros/' + id].baseOrigem = 'pExcl'; c[R.RAIZ + '/registros/' + id].origem = 'pExcl'; });
  await adulterar('base com motor antigo é recusada', 'pComp2', 'compoe', 'pProd', (c, id) => {
    const r = c[R.RAIZ + '/registros/' + id]; const k0 = R.chaveAtiva(r.origem, r.tipo, r.destino); r.origem = 'pVelho'; r.baseOrigem = 'pVelho';
    delete c[R.RAIZ + '/ativa-por-chave/' + k0]; c[R.RAIZ + '/ativa-por-chave/' + R.chaveAtiva('pVelho', 'compoe', 'pProd')] = id; c[R.RAIZ + '/eventos/' + r.ultimoEvento].depois.origem = 'pVelho';
  });
  await adulterar('avaliação "não produto" com camada Produto/Serviço não autoriza (decisão incoerente)', 'pComp2', 'compoe', 'pProd', (c, id) => {
    const r = c[R.RAIZ + '/registros/' + id]; const k0 = R.chaveAtiva(r.origem, r.tipo, r.destino); r.destino = 'pIncoer'; r.baseDestino = 'pIncoer';
    delete c[R.RAIZ + '/ativa-por-chave/' + k0]; c[R.RAIZ + '/ativa-por-chave/' + R.chaveAtiva('pComp2', 'compoe', 'pIncoer')] = id; c[R.RAIZ + '/eventos/' + r.ultimoEvento].depois.destino = 'pIncoer';
  });
  await adulterar('autorrelação é recusada', 'pComp2', 'compoe', 'pProd', (c, id) => {
    const r = c[R.RAIZ + '/registros/' + id]; const k0 = R.chaveAtiva(r.origem, r.tipo, r.destino); r.destino = 'pComp2'; r.baseDestino = 'pComp2'; r.naturezaDestino = 'componente';
    delete c[R.RAIZ + '/ativa-por-chave/' + k0]; c[R.RAIZ + '/ativa-por-chave/' + R.chaveAtiva('pComp2', 'compoe', 'pComp2')] = id;
  });
  await adulterar('horário que não é o do servidor é recusado', 'pComp2', 'compoe', 'pProd', (c, id) => { c[R.RAIZ + '/registros/' + id].criadaEm = 1; });
  await adulterar('autoria de outra pessoa é recusada', 'pComp2', 'compoe', 'pProd', (c, id) => { c[R.RAIZ + '/registros/' + id].criadaPor.email = ADMIN; });
  await adulterar('sem o evento na mesma gravação é recusado', 'pComp2', 'compoe', 'pProd', (c) => { Object.keys(c).filter((k) => k.indexOf('/eventos/') !== -1).forEach((k) => delete c[k]); });
  await adulterar('sem a operação na mesma gravação é recusado', 'pComp2', 'compoe', 'pProd', (c) => { Object.keys(c).filter((k) => k.indexOf('/operacoes/') !== -1).forEach((k) => delete c[k]); });
  await adulterar('sem o índice de relação ativa é recusado', 'pComp2', 'compoe', 'pProd', (c) => { Object.keys(c).filter((k) => k.indexOf('/ativa-por-chave/') !== -1).forEach((k) => delete c[k]); });
  await adulterar('"compõe" sem incrementar o contador do grafo é recusado', 'pComp2', 'compoe', 'pProd', (c) => { delete c[R.RAIZ + '/versao-compoe']; });
  await adulterar('Porta 2 encerrada não atua sobre nada', 'o1', 'atua-sobre', 'pRegra', (c, id) => {
    const r = c[R.RAIZ + '/registros/' + id]; const k0 = R.chaveAtiva(r.origem, r.tipo, r.destino); r.origem = 'o2';
    delete c[R.RAIZ + '/ativa-por-chave/' + k0]; c[R.RAIZ + '/ativa-por-chave/' + R.chaveAtiva('o2', 'atua-sobre', 'pRegra')] = id; c[R.RAIZ + '/eventos/' + r.ultimoEvento].depois.origem = 'o2';
  });
  await adulterar('Porta 2 com base P1–P16 é recusada (a Porta 2 não depende de P1–P16)', 'o1', 'atua-sobre', 'pRegra', (c, id) => { c[R.RAIZ + '/registros/' + id].baseOrigem = 'pRegra'; });
  await adulterar('natureza individual não registrada não autoriza (Funcionalidade declarada num item sem registro)', 'pCanal', 'da-acesso', 'pProc', (c, id) => {
    const r = c[R.RAIZ + '/registros/' + id]; const k0 = R.chaveAtiva(r.origem, r.tipo, r.destino); r.destino = 'pDoc'; r.baseDestino = 'pDoc'; r.naturezaDestino = 'funcionalidade';
    delete c[R.RAIZ + '/ativa-por-chave/' + k0]; c[R.RAIZ + '/ativa-por-chave/' + R.chaveAtiva('pCanal', 'da-acesso', 'pDoc')] = id;
    Object.assign(c[R.RAIZ + '/eventos/' + r.ultimoEvento].depois, { destino: 'pDoc', naturezaDestino: 'funcionalidade' });
  });

  await adulterar('item de Funcionalidade/Operação SEM natureza registrada não autoriza', 'pCanal', 'da-acesso', 'pProc', (c, id) => {
    const r = c[R.RAIZ + '/registros/' + id]; const k0 = R.chaveAtiva(r.origem, r.tipo, r.destino); r.destino = 'pFunc2'; r.baseDestino = 'pFunc2'; r.naturezaDestino = 'funcionalidade';
    delete c[R.RAIZ + '/ativa-por-chave/' + k0]; c[R.RAIZ + '/ativa-por-chave/' + R.chaveAtiva('pCanal', 'da-acesso', 'pFunc2')] = id;
    Object.assign(c[R.RAIZ + '/eventos/' + r.ultimoEvento].depois, { destino: 'pFunc2', naturezaDestino: 'funcionalidade' });
  });
  await adulterar('natureza declarada diferente da REGISTRADA (Operação declarada Funcionalidade) é recusada', 'pCanal', 'da-acesso', 'pProc', (c, id) => {
    const r = c[R.RAIZ + '/registros/' + id]; const k0 = R.chaveAtiva(r.origem, r.tipo, r.destino); r.destino = 'pOper'; r.baseDestino = 'pOper'; r.naturezaDestino = 'funcionalidade';
    delete c[R.RAIZ + '/ativa-por-chave/' + k0]; c[R.RAIZ + '/ativa-por-chave/' + R.chaveAtiva('pCanal', 'da-acesso', 'pOper')] = id;
    Object.assign(c[R.RAIZ + '/eventos/' + r.ultimoEvento].depois, { destino: 'pOper', naturezaDestino: 'funcionalidade' });
  });

  /* ===== E. Duplicidade e concorrência ===== */
  console.log('E. Duplicidade e concorrência');
  await nega('a mesma relação ativa não entra duas vezes', up(ARQ, await relW('pFunc', 'usa', 'pOper', ARQ, { estado: { registros: {} } })));
  {
    const a = await relW('pCanal', 'da-acesso', 'pDoc', ARQ), b = await relW('pCanal', 'da-acesso', 'pDoc', ADMIN);
    const res = await Promise.allSettled([up(ARQ, a), up(ADMIN, b)]);
    const regsDoc = Object.values((await ler(R.RAIZ + '/registros')) || {}).filter((r) => r.origem === 'pCanal' && r.destino === 'pDoc' && r.situacao === 'ativa');
    anota('duas gravações simultâneas da mesma relação: só uma entra', res.filter((x) => x.status === 'fulfilled').length === 1 && regsDoc.length === 1, JSON.stringify(res.map((x) => x.status)));
  }
  {
    const v0 = (await ler(R.RAIZ + '/versao-compoe')) || 0;
    const a = await relW('pComp2', 'compoe', 'pProd', ARQ, { versao: v0 }), b = await relW('pFunc', 'compoe', 'pProd', ADMIN, { versao: v0 });
    const res = await Promise.allSettled([up(ARQ, a), up(ADMIN, b)]);
    anota('duas criações de "compõe" sobre a mesma versão do grafo: só uma entra', res.filter((x) => x.status === 'fulfilled').length === 1 && (await ler(R.RAIZ + '/versao-compoe')) === v0 + 1, JSON.stringify(res.map((x) => x.status)));
    const recusada = res[0].status === 'rejected' ? ['pComp2', ARQ] : ['pFunc', ADMIN];
    await pode('a recusada entra quando refeita sobre a versão nova (a verificação do grafo é refeita)', up(recusada[1], await relW(recusada[0], 'compoe', 'pProd', recusada[1])));
  }
  await nega('o contador do grafo não pula versão', db(ARQ).ref(R.RAIZ + '/versao-compoe').set(((await ler(R.RAIZ + '/versao-compoe')) || 0) + 2));
  await nega('o contador do grafo não volta', db(ARQ).ref(R.RAIZ + '/versao-compoe').set(0));

  /* ===== F. Encerrar ===== */
  console.log('F. Encerrar');
  const relDe = async (o, t, d) => Object.values((await ler(R.RAIZ + '/registros')) || {}).filter((r) => r.origem === o && r.tipo === t && r.destino === d && r.situacao === 'ativa')[0];
  const encW = async (id, motivo, e, ajuste) => {
    const r = R.encerrarRelacao({ registros: (await ler(R.RAIZ + '/registros')) || {} }, id, motivo, { operacaoId: novaChave('op'), usuario: usuario(e), agora: TS });
    if (!r.ok) throw new Error('núcleo recusou: ' + JSON.stringify(r.erros));
    const c = js(r.caminhos); if (ajuste) ajuste(c); return c;
  };
  const alvo = await relDe('pRegra', 'governa', 'pProc');
  await nega('Avaliação não encerra', up(AVAL, await encW(alvo.id, 'Motivo (teste)', AVAL)));
  await nega('encerrar sem motivo é recusado', up(ARQ, await encW(alvo.id, 'Motivo (teste)', ARQ, (c) => { delete c[R.RAIZ + '/registros/' + alvo.id].encerramento.motivo; })));
  await nega('encerrar sem liberar o índice é recusado', up(ARQ, await encW(alvo.id, 'Motivo (teste)', ARQ, (c) => { Object.keys(c).filter((k) => k.indexOf('/ativa-por-chave/') !== -1).forEach((k) => delete c[k]); })));
  await nega('encerrar mudando a relação (outro destino) é recusado', up(ARQ, await encW(alvo.id, 'Motivo (teste)', ARQ, (c) => { c[R.RAIZ + '/registros/' + alvo.id].destino = 'pEtapa'; })));
  await pode('Avaliação + Configuração encerra com motivo', up(ARQ, await encW(alvo.id, 'Regra revogada (teste)', ARQ)));
  const enc = await ler(R.RAIZ + '/registros/' + alvo.id);
  anota('a relação continua registrada, encerrada, com motivo, horário e autoria; o índice foi liberado', enc.situacao === 'encerrada' && enc.encerramento.motivo === 'Regra revogada (teste)' && typeof enc.encerramento.em === 'number' && !(await ler(R.RAIZ + '/ativa-por-chave/' + R.chaveAtiva('pRegra', 'governa', 'pProc'))));
  await nega('relação encerrada não reabre', db(ADMIN).ref(R.RAIZ + '/registros/' + alvo.id + '/situacao').set('ativa'));
  await nega('relação não se apaga', db(ADMIN).ref(R.RAIZ + '/registros/' + alvo.id).remove());
  await nega('índice de relação ativa não se apaga sozinho', db(ADMIN).ref(R.RAIZ + '/ativa-por-chave/' + R.chaveAtiva('pComp', 'compoe', 'pProd')).remove());
  await pode('a mesma relação pode ser registrada de novo depois de encerrada', up(ARQ, await relW('pRegra', 'governa', 'pProc', ARQ)));

  /* ===== G. Histórico ===== */
  console.log('G. Histórico');
  const evs = (await ler(R.RAIZ + '/eventos')) || {}, ops = (await ler(R.RAIZ + '/operacoes')) || {};
  const ev0 = Object.keys(evs)[0], op0 = Object.keys(ops)[0];
  anota('cada gravação deixou evento e operação', Object.keys(evs).length >= 10 && Object.keys(ops).length === Object.keys(evs).length);
  await nega('evento não se reescreve', db(ADMIN).ref(R.RAIZ + '/eventos/' + ev0 + '/tipo').set('relacao.encerrada'));
  await nega('evento não se apaga', db(ADMIN).ref(R.RAIZ + '/eventos/' + ev0).remove());
  await nega('operação não se reescreve', db(ADMIN).ref(R.RAIZ + '/operacoes/' + op0 + '/tipo').set('encerrarRelacao'));

  /* ===== H. E5: Modalidade e Subproduto (naturezas individuais de modalidade-subproduto) ===== */
  console.log('H. E5 — Modalidade e Subproduto');
  await semear(async (a) => {
    await a.ref('avaliacoes-produto/pMod').set(Object.assign({ itemId: 'pMod', nome: 'Item pMod' }, AV('modalidade-subproduto', 'nao-produto')));
    await a.ref(R.PONTA + '/pMod').set('pMod');
  });
  await nega('sem o conceito oficial de Modalidade, a natureza não é registrada', up(ARQ, await natW('pMod', 'modalidade', ARQ, { conceito: { ativo: true, naturezaDe: 'modalidade-subproduto', temDefinicao: true } })));
  await nega('conceito de Modalidade sem definição é recusado', up(ADMIN, conceito('modalidade', ADMIN, (c, b) => { delete c[b].definicao; Object.keys(c).filter((k) => k.indexOf('/definicoes/') !== -1).forEach((k) => delete c[k]); })));
  await nega('conceito de Modalidade ligado a outra classificação é recusado', up(ADMIN, conceito('modalidade', ADMIN, (c, b) => { c[b].naturezaDe = 'regra-condicao'; })));
  await nega('Avaliação + Configuração não cria o conceito de Subproduto', up(ARQ, conceito('subproduto', ARQ)));
  await pode('admin geral cria o conceito "modalidade" (definição e naturezaDe = modalidade-subproduto)', up(ADMIN, conceito('modalidade', ADMIN)));
  await pode('admin geral cria o conceito "subproduto", distinto de Modalidade', up(ADMIN, conceito('subproduto', ADMIN)));
  await nega('cadastro duplicado de Modalidade é recusado', up(ADMIN, conceito('modalidade', ADMIN)));
  await nega('Modalidade não é registrável num item de Regra/Opção (regra-condicao)', up(ARQ, await natW('pRegra', 'modalidade', ARQ, { gate: { situacao: 'atual', libera: true, chave: 'pRegra', avaliacao: Object.assign({}, ITENS.pRegra, { camadaSugerida: { id: 'modalidade-subproduto' } }) } })));
  await pode('Avaliação + Configuração registra "Modalidade" num item de modalidade-subproduto (escolha explícita)', up(ARQ, await natW('pMod', 'modalidade', ARQ)));
  anota('a natureza registrada é Modalidade, na classificação modalidade-subproduto, com a avaliação vigente', ((await ler(R.NAT + '/pMod')) || {}).natureza === 'modalidade' && ((await ler(R.NAT + '/pMod')) || {}).avaliacaoId === 'pMod');
  await pode('responsabilidade da Porta 2 "atua sobre" a Modalidade', up(ARQ, await relW('o1', 'atua-sobre', 'pMod', ARQ)));
  anota('pares com Modalidade/Subproduto além de "atua sobre" não existem na matriz até serem aprovados', !R.PARES.some((p) => (p.de === 'modalidade' || p.para === 'modalidade' || p.de === 'subproduto' || p.para === 'subproduto') && p.tipo !== 'atua-sobre'));

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
