/* ═════════════════════════════════════════════════════════════════
   Regras do banco — ANÁLISE ORGANIZACIONAL (Porta 2, PR A). Roda contra o EMULADOR real do Realtime Database
   (teste-rules.yml) com o database.rules.json de produção. As gravações são as que o código real monta: o núcleo
   (analises-organizacionais-nucleo.js), o adaptador (analises-organizacionais-firebase.js) e, para a atuação criada a
   partir de um recorte, o núcleo das atuações (objetos-organizacionais-nucleo.js). Prova, pelo BANCO:
   A. Acesso pelos PERFIS OFICIAIS, sem controle de disponibilidade: leem os três perfis (admin geral, Avaliação +
      Configuração, Avaliação); gravam admin geral e Avaliação + Configuração; Avaliação só lê; sem perfil e sem login,
      nada. O antigo marcador e a auditoria dele: os perfis ainda os leem (histórico), ninguém os grava.
   B. Qualquer estado antigo do marcador gravado (SOMENTE_ADMIN_GERAL, DESLIGADO) não muda o acesso de ninguém.
   D. Análise: revisão + 1 (gravação velha recusada), horário do servidor, autoria do token, evento novo na mesma
      gravação, criação/escopo/objeto amplo fixos, auditoria só de acréscimo, descartada é final.
   E. Atuação criada a partir de um recorte: uma gravação com objeto + recorte ligado + índice de origem; a ligação
      nunca muda; uma atuação tem uma só origem; índice sem atuação é recusado.
   F. Proposta: imutável; versão = vigente + 1 na mesma gravação da análise; pular versão recusado; só alternativas
      aprovadas (reclassificar recusado); pendente exige pendência.
   G. Aprovação: só admin geral, referência a ato externo (natureza fixa), só da proposta vigente e não pendente, uma
      por versão, com evento de auditoria.
   H. Nada foi apagado nem gravado fora do lugar: análises, propostas, aprovação e atuação continuam no banco.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');
const N = require(path.join(RAIZ, 'forca-agil', 'analises-organizacionais-nucleo.js'));
const F = require(path.join(RAIZ, 'forca-agil', 'analises-organizacionais-firebase.js'));
const O = require(path.join(RAIZ, 'forca-agil', 'objetos-organizacionais-nucleo.js'));

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_');
const SUPER = 'tatianefdirene@previ.com.br', ADMIN = 'admin.geral@previ.com.br', ARQ = 'arquitetura@previ.com.br', AVAL = 'avaliacao@previ.com.br', SEM = 'sem.acesso@previ.com.br';
const NOS = F.NOS;
const TS = { '.sv': 'timestamp' };
const js = (v) => JSON.parse(JSON.stringify(v));
const usuario = (e) => ({ uid: emailKey(e), email: e, name: 'Pessoa ' + e.split('@')[0] });
let seq = 0;
const chave = (p) => p + (++seq);
const ctxDe = (e, novoId) => ({ operacaoId: chave('op'), novoId, usuario: { id: emailKey(e), email: e }, agora: Date.now() });

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-analises', database: { rules } });
  const db = (e) => (e ? env.authenticatedContext(emailKey(e), { email: e }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  const up = (e, w) => db(e).ref().update(js(w));
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'NEGADO: ' + String(e.message || e).slice(0, 200)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi ACEITO'); } }
  /* estado atual (lido sem regras) → núcleo → payload pelo adaptador */
  async function estado() { return F.estadoDoBanco({ analises: await ler(NOS.analises), propostas: await ler(NOS.propostas), aprovacoes: await ler(NOS.aprovacoes) }); }
  async function op(e, fn, mexer) {
    const r = fn(await estado(), ctxDe(e, chave('n')));
    if (!r.ok) throw new Error('núcleo recusou: ' + JSON.stringify(r.erros));
    const w = F.payloadOperacao(r, { audId: chave('ev'), usuario: usuario(e), agora: TS });
    if (mexer) mexer(w);
    return w;
  }
  const MARCADOR_ANTIGO = { habilitacao: 'SOMENTE_ADMIN_GERAL', alteradoEm: 1, alteradoPor: { uid: 'x', email: SUPER }, motivo: 'Homologação (registro antigo)', auditoriaId: 'cfg0' };
  const AUD_ANTIGA = { habilitacao: 'SOMENTE_ADMIN_GERAL', anterior: 'DESLIGADO', motivo: 'Homologação (registro antigo)', usuario: { uid: 'x', email: SUPER }, dataHora: 1 };

  await env.clearDatabase();
  await semear(async (a) => {
    await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
  });

  console.log('\n== A. Acesso pelos perfis oficiais (sem marcador gravado) ==');
  const criarAnalise = (e, id, dados) => op(e, (est, c) => N.criarAnalise(est, Object.assign({ nome: 'Núcleo de Governança de TI', tipoEscopo: 'estrutura' }, dados || {}), Object.assign(c, { novoId: id })));
  await pode('admin geral cria análise (sem nada a ativar)', up(SUPER, await criarAnalise(SUPER, 'anA')));
  for (const e of [SUPER, ADMIN, ARQ, AVAL]) await pode(e.split('@')[0] + ' lê análises', db(e).ref(NOS.analises).once('value'));
  await nega('sem perfil NÃO lê', db(SEM).ref(NOS.analises).once('value'));
  await nega('sem login NÃO lê', db(null).ref(NOS.analises).once('value'));
  await pode('Avaliação + Configuração cria análise', up(ARQ, await criarAnalise(ARQ, 'anC')));
  await nega('Avaliação NÃO cria', up(AVAL, await criarAnalise(AVAL, 'anD')));
  await nega('Avaliação NÃO altera', up(AVAL, await op(AVAL, (est, c) => N.adicionarEntrega(est, 'anC', { descricao: 'x' }, c))));
  await nega('sem perfil NÃO cria', up(SEM, await criarAnalise(SEM, 'anS')));
  /* o antigo marcador: ninguém grava (nem o admin geral); o histórico continua legível pelos perfis */
  await nega('admin geral NÃO grava mais o marcador', db(SUPER).ref(NOS.config).set(MARCADOR_ANTIGO));
  await nega('admin geral NÃO grava mais a auditoria do marcador', db(SUPER).ref(NOS.configAuditoria + '/cfgN').set(AUD_ANTIGA));
  await semear((a) => a.ref(NOS.configAuditoria + '/cfg0').set(AUD_ANTIGA));
  for (const e of [SUPER, ARQ, AVAL]) await pode(e.split('@')[0] + ' lê o histórico antigo do marcador', db(e).ref(NOS.configAuditoria).once('value'));
  await nega('sem perfil NÃO lê o histórico do marcador', db(SEM).ref(NOS.configAuditoria).once('value'));

  console.log('\n== B. O estado antigo de homologação não decide mais nada ==');
  await pode('Avaliação + Configuração cria outra análise (anB)', up(ARQ, await criarAnalise(ARQ, 'anB')));
  for (const antigo of ['SOMENTE_ADMIN_GERAL', 'DESLIGADO']) {
    await semear((a) => a.ref(NOS.config).set(Object.assign({}, MARCADOR_ANTIGO, { habilitacao: antigo })));
    await pode(antigo + ' gravado: Avaliação + Configuração continua lendo', db(ARQ).ref(NOS.analises).once('value'));
    await pode(antigo + ' gravado: Avaliação continua lendo', db(AVAL).ref(NOS.analises).once('value'));
    await pode(antigo + ' gravado: Avaliação + Configuração continua registrando', up(ARQ, await op(ARQ, (est, c) => N.adicionarEntrega(est, 'anB', { descricao: 'Entrega com marcador ' + antigo }, Object.assign(c, { novoId: 'eAnt' + antigo.slice(0, 3) })))));
    await nega(antigo + ' gravado: Avaliação continua sem registrar', up(AVAL, await criarAnalise(AVAL, 'anDx' + antigo.slice(0, 3))));
  }
  await semear((a) => a.ref(NOS.config).remove());

  console.log('\n== D. Ciclo da análise ==');
  const anC = await ler(NOS.analises + '/anC');
  anota('criada: revisão 1, aberta, horário do servidor, autoria do token, evento apontado', anC.revisao === 1 && anC.situacao === 'aberta' && typeof anC.criadaEm === 'number' && anC.criadaPor.id === emailKey(ARQ) &&
    (await ler(NOS.auditoria + '/anC/' + anC.auditoriaId + '/tipo')) === 'analise.criada');
  const wE1 = await op(ARQ, (est, c) => N.adicionarEntrega(est, 'anC', { descricao: 'Políticas de SI' }, Object.assign(c, { novoId: 'e1' })));
  const wVelha = await op(ARQ, (est, c) => N.adicionarEntrega(est, 'anC', { descricao: 'Concorrente' }, Object.assign(c, { novoId: 'eX' })));
  await pode('adicionar entrega (revisão 2)', up(ARQ, wE1));
  await nega('gravação sobre a revisão velha (concorrência): recusada', up(ARQ, wVelha));
  await nega('sem o evento de auditoria: recusado', up(ARQ, await op(ARQ, (est, c) => N.adicionarEntrega(est, 'anC', { descricao: 'x' }, Object.assign(c, { novoId: 'e2' })), (w) => { Object.keys(w).filter((k) => k.indexOf(NOS.auditoria) === 0).forEach((k) => delete w[k]); })));
  await nega('horário do cliente: recusado', up(ARQ, await op(ARQ, (est, c) => N.adicionarEntrega(est, 'anC', { descricao: 'x' }, Object.assign(c, { novoId: 'e2' })), (w) => { w[NOS.analises + '/anC/atualizadoEm'] = 1791713600000; })));
  await nega('trocar o escopo: recusado', up(ARQ, await op(ARQ, (est, c) => N.adicionarEntrega(est, 'anC', { descricao: 'x' }, Object.assign(c, { novoId: 'e2' })), (w) => { w[NOS.analises + '/anC/tipoEscopo'] = 'capacidade'; })));
  await nega('trocar quem criou: recusado', up(ARQ, await op(ARQ, (est, c) => N.adicionarEntrega(est, 'anC', { descricao: 'x' }, Object.assign(c, { novoId: 'e2' })), (w) => { w[NOS.analises + '/anC/criadaPor'] = { id: 'outra' }; })));
  await nega('autoria de outra pessoa: recusada', up(ARQ, await op(SUPER, (est, c) => N.adicionarEntrega(est, 'anC', { descricao: 'x' }, Object.assign(c, { novoId: 'e2' })))));
  await nega('apagar a análise: recusado', db(ARQ).ref(NOS.analises + '/anC').remove());
  const evento0 = (await ler(NOS.analises + '/anC')).auditoriaId;
  await nega('auditoria só de acréscimo (reescrever um evento): recusado', db(ARQ).ref(NOS.auditoria + '/anC/' + evento0).set({ tipo: 'x', em: TS, por: { uid: emailKey(ARQ), email: ARQ } }));

  console.log('\n== E. Atuação criada a partir de um recorte ==');
  for (const [q, v] of [['F4', 'politica-norma'], ['F5', 'cliente-interno'], ['F6', { valor: 'esta-estrutura', certeza: 'conhecido' }], ['F8', { valor: 'evidencia', texto: 'Política publicada' }]]) {
    await pode('responder ' + q, up(ARQ, await op(ARQ, (est, c) => N.responder(est, 'anC', { pergunta: q, entregaId: 'e1', valor: v }, c))));
  }
  await pode('definir recorte', up(ARQ, await op(ARQ, (est, c) => N.definirRecorte(est, 'anC', { nome: 'Políticas de SI', resultado: 'Políticas vigentes', justificativa: 'Resultado próprio', entregas: ['e1'] }, Object.assign(c, { novoId: 'r1' })))));
  const criarAtuacao = async (e, objetoId, recorteId, analiseId, mexer) => {
    const est = await estado();
    const assoc = N.associarAtuacao(est, analiseId || 'anC', recorteId || 'r1', objetoId, ctxDe(e));
    if (!assoc.ok) throw new Error(JSON.stringify(assoc.erros));
    const objetoPayload = O.payloadCriacao({ id: objetoId, audId: chave('oa'), dados: { nome: 'Políticas de SI', descricao: 'Políticas vigentes', finalidade: 'Resultado próprio' }, usuario: usuario(e), agora: TS });
    const w = F.payloadCriarAtuacao({ objetoPayload, associacao: assoc, analiseId: analiseId || 'anC', recorteId: recorteId || 'r1', objetoId, audId: chave('ev'), usuario: usuario(e), agora: TS });
    if (mexer) mexer(w);
    return w;
  };
  await nega('índice de origem sem a atuação: recusado', up(ARQ, await criarAtuacao(ARQ, 'objR1', 'r1', 'anC', (w) => { Object.keys(w).filter((k) => k.indexOf('objetos-organizacionais') === 0).forEach((k) => delete w[k]); })));
  await nega('recorte ligado sem o índice: recusado', up(ARQ, await criarAtuacao(ARQ, 'objR1', 'r1', 'anC', (w) => { delete w[NOS.porObjeto + '/objR1']; })));
  await pode('atuação + recorte ligado + índice, numa gravação', up(ARQ, await criarAtuacao(ARQ, 'objR1')));
  anota('o objeto é uma atuação normal da Porta 2 (ativa, revisão 1) e o índice aponta a origem', (await ler('objetos-organizacionais/objR1/situacao')) === 'ativo' && (await ler(NOS.porObjeto + '/objR1/recorteId')) === 'r1');
  await nega('trocar a atuação de um recorte avaliado: recusado', up(ARQ, await op(ARQ, (est, c) => N.adicionarEntrega(est, 'anC', { descricao: 'x' }, Object.assign(c, { novoId: 'e9' })), (w) => { w[NOS.analises + '/anC/recortes/r1/objetoId'] = 'outroObj'; })));
  await nega('reescrever o índice de origem: recusado', db(ARQ).ref(NOS.porObjeto + '/objR1').set({ analiseId: 'anC', recorteId: 'r9' }));
  await nega('apagar o índice de origem: recusado', db(ARQ).ref(NOS.porObjeto + '/objR1').remove());

  console.log('\n== E2. Responsabilidade só com a descrição ("precisa separar?"; regras e nós sem mudança) ==');
  await pode('registrar "Gerir o processo contábil" sem entregas, com "Não sei"', up(ARQ, await op(ARQ, (est, c) => N.definirRecorte(est, 'anC', { descricao: 'Gerir o processo contábil', separacao: { valor: 'nao-sei' } }, Object.assign(c, { novoId: 'r2' })))));
  await pode('revisar para "Não precisa separar", explicitamente', up(ARQ, await op(ARQ, (est, c) => N.revisarResponsabilidade(est, 'anC', 'r2', { descricao: 'Gerir o processo contábil', separacao: { valor: 'nao' } }, c))));
  await pode('objeto da Porta 2 da responsabilidade + recorte ligado + índice, numa gravação', up(ARQ, await criarAtuacao(ARQ, 'objR2', 'r2')));
  anota('a responsabilidade só com a descrição fica ligada ao objeto, com a resposta gravada', (await ler(NOS.porObjeto + '/objR2/recorteId')) === 'r2' && (await ler(NOS.analises + '/anC/recortes/r2/separacao/valor')) === 'nao' && (await ler(NOS.analises + '/anC/recortes/r2/descricao')) === 'Gerir o processo contábil' && !(await ler(NOS.analises + '/anC/recortes/r2/entregas')));
  await pode('registrar uma descrição que precisa separar ("Sim")', up(ARQ, await op(ARQ, (est, c) => N.definirRecorte(est, 'anC', { descricao: 'Gerir o orçamento e atender fornecedores', separacao: { valor: 'sim' } }, Object.assign(c, { novoId: 'r3' })))));
  await pode('separar em duas partes informadas pela pessoa, numa gravação', up(ARQ, await op(ARQ, (est, c) => N.desdobrarResponsabilidade(est, 'anC', 'r3', { partes: [{ descricao: 'Gerir o planejamento e execução orçamentária', separacao: { valor: 'nao' } }, { descricao: 'Atender fornecedores', separacao: { valor: 'nao-sei' } }] }, Object.assign(c, { novosIds: ['r3a', 'r3b'] })))));
  anota('a original fica desdobrada, com o vínculo às partes; cada parte guarda a origem', (await ler(NOS.analises + '/anC/recortes/r3/situacao')) === 'desdobrado' && (await ler(NOS.analises + '/anC/recortes/r3a/origemRecorteId')) === 'r3' && (await ler(NOS.analises + '/anC/recortes/r3/descricao')) === 'Gerir o orçamento e atender fornecedores');
  await nega('trocar a atuação da responsabilidade sem entregas: recusado', up(ARQ, await op(ARQ, (est, c) => N.adicionarEntrega(est, 'anC', { descricao: 'x' }, Object.assign(c, { novoId: 'e8' })), (w) => { w[NOS.analises + '/anC/recortes/r2/objetoId'] = 'outroObj'; })));

  console.log('\n== F. Proposta de composição ==');
  const propor = (e, dados, mexer) => op(e, (est, c) => N.registrarProposta(est, 'anC', Object.assign({ alternativa: 'manter-consciente', recortes: ['r1'], justificativa: 'Sem ganho em separar' }, dados || {}), c), mexer);
  await nega('Avaliação NÃO propõe', up(AVAL, await propor(AVAL)));
  await nega('alternativa "reclassificar" (fora da lista) gravada à força: recusada', up(ARQ, await propor(ARQ, {}, (w) => { w[NOS.propostas + '/anC/v1'].alternativa = 'reclassificar'; })));
  await nega('proposta sem a análise apontar a versão: recusada', up(ARQ, await propor(ARQ, {}, (w) => { delete w[NOS.analises + '/anC/propostaVigente']; })));
  await nega('pular versão (v2 sem v1): recusado', up(ARQ, await propor(ARQ, {}, (w) => { const p = w[NOS.propostas + '/anC/v1']; delete w[NOS.propostas + '/anC/v1']; p.versao = 2; w[NOS.propostas + '/anC/v2'] = p; w[NOS.analises + '/anC/propostaVigente'] = 2; })));
  await nega('pendente sem a pendência: recusado', up(ARQ, await propor(ARQ, { alternativa: 'pendente', pendencia: { falta: 'a', proximaAcao: 'b', quemDecide: 'c' } }, (w) => { delete w[NOS.propostas + '/anC/v1'].pendencia; })));
  await pode('proposta v1 (Avaliação + Configuração)', up(ARQ, await propor(ARQ)));
  await nega('reescrever a proposta v1: recusado', db(ARQ).ref(NOS.propostas + '/anC/v1/justificativa').set('outra'));

  console.log('\n== G. Aprovação: referência a ato externo ==');
  const ato = { autoridade: 'Diretoria Executiva', referencia: 'Ata 12/2026, item 3', dataDoAto: 1791900000000, objetoAprovado: 'Proposta v1' };
  const aprovar = (e, versao, mexer) => op(e, (est, c) => N.registrarAprovacao(est, 'anC', versao, ato, c), mexer);
  await nega('Avaliação + Configuração NÃO registra aprovação', up(ARQ, await aprovar(ARQ, 1)));
  await nega('natureza diferente de "referência a ato externo": recusada', up(SUPER, await aprovar(SUPER, 1, (w) => { w[NOS.aprovacoes + '/anC/v1'].natureza = 'aprovada-pelo-admin'; })));
  await nega('aprovação sem o evento de auditoria: recusada', up(SUPER, await aprovar(SUPER, 1, (w) => { Object.keys(w).filter((k) => k.indexOf(NOS.auditoria) === 0).forEach((k) => delete w[k]); })));
  await pode('admin geral registra a referência ao ato externo', up(SUPER, await aprovar(SUPER, 1)));
  const ap = await ler(NOS.aprovacoes + '/anC/v1');
  anota('registro: natureza fixa, autoridade da instância, autoria só do registro, horário do servidor', ap.natureza === 'referencia-a-ato-externo' && ap.autoridade === 'Diretoria Executiva' && ap.registradoPor.id === emailKey(SUPER) && typeof ap.registradoEm === 'number');
  await nega('segunda aprovação da mesma versão: recusada', db(SUPER).ref(NOS.aprovacoes + '/anC/v1/autoridade').set('Outra'));
  await pode('proposta v2 pendente', up(ARQ, await propor(ARQ, { alternativa: 'pendente', pendencia: { falta: 'Evidência de segregação', proximaAcao: 'Reunião', quemDecide: 'Diretoria' } })));
  const forcada = F.payloadOperacao({ ok: true, mudancas: [{ entidade: 'aprovacao', id: 'anC~2', antes: null, depois: { id: 'anC~2', analiseId: 'anC', versaoProposta: 2, natureza: 'referencia-a-ato-externo', autoridade: 'x', referencia: 'y', dataDoAto: 1791900000000, objetoAprovado: 'z', revisao: 1 }, revisaoAnterior: null }], eventos: [{ tipo: 'aprovacao.registrada', operacaoId: 'op', detalhe: {} }] }, { audId: chave('ev'), usuario: usuario(SUPER), agora: TS });
  await nega('aprovar a proposta pendente forçando a gravação: recusado', up(SUPER, forcada));
  const forcadaVelha = F.payloadOperacao({ ok: true, mudancas: [{ entidade: 'aprovacao', id: 'anC~1', antes: null, depois: { id: 'anC~1', analiseId: 'anC', versaoProposta: 1, natureza: 'referencia-a-ato-externo', autoridade: 'x', referencia: 'y', dataDoAto: 1791900000000, objetoAprovado: 'z', revisao: 1 }, revisaoAnterior: null }], eventos: [{ tipo: 'aprovacao.registrada', operacaoId: 'op', detalhe: {} }] }, { audId: chave('ev'), usuario: usuario(SUPER), agora: TS });
  await nega('aprovar versão que já não é a vigente: recusado', up(SUPER, forcadaVelha));

  console.log('\n== D2. Descarte ==');
  await pode('descartar com motivo', up(ARQ, await op(ARQ, (est, c) => N.descartarAnalise(est, 'anA', { motivo: 'Aberta para teste' }, c))));
  const anA = await ler(NOS.analises + '/anA');
  anota('descartada, com o motivo', anA.situacao === 'descartada' && anA.descarte.motivo === 'Aberta para teste');
  await nega('descartada é final (nada mais se grava)', up(ARQ, F.payloadOperacao({ ok: true, mudancas: [{ entidade: 'analise', id: 'anA', antes: anA, depois: Object.assign({}, anA, { revisao: anA.revisao + 1, situacao: 'aberta', descarte: null }), revisaoAnterior: anA.revisao }], eventos: [{ tipo: 'x', operacaoId: 'op', detalhe: {} }] }, { audId: chave('ev'), usuario: usuario(ARQ), agora: TS })));

  console.log('\n== H. Nada apagado ==');
  anota('nada foi apagado: análises, propostas, aprovação e a atuação continuam no banco', !!(await ler(NOS.analises + '/anC')) && !!(await ler(NOS.propostas + '/anC/v2')) && !!(await ler(NOS.aprovacoes + '/anC/v1')) && (await ler('objetos-organizacionais/objR1/situacao')) === 'ativo');
  anota('nenhuma estrutura, vínculo ou conceito foi gravado', !(await ler('estruturas-concretas')) && !(await ler('estruturas-vinculos')) && !(await ler('taxonomia')));

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
