/* Subagrupadores das Linhas de Negócios (Etapa 5) — adaptador Firebase + regras do nó mapa-subagrupadores, no
 * EMULADOR real do Realtime Database (teste-rules.yml). Nada de banco oficial.
 *   A. o conjunto versionado mapa-subagrupadores v1 (executor compartilhado) pelo caso de uso sobre o adaptador
 *      Firebase, com as Linhas do estado inicial de cada cenário; horário gravado = do servidor; integridade
 *      registro ↔ evento ↔ operação conferida no banco;
 *   B. autorização (quem grava, quem lê);
 *   C. gravações diretas inválidas recusadas: partes sozinhas, autoria e horário do cliente, bloco ≠ Linhas de
 *      Negócios, revisão, campos inválidos, reativação, associação de estrutura que não é Linha de Negócios ativa ou a
 *      subagrupador encerrado, duas associações ativas da mesma Linha, índice sem associação, troca forjada,
 *      apagar/editar registro, evento ou operação;
 *   D. concorrência: a mesma Linha associada por duas pessoas ao mesmo tempo → só uma; o adaptador devolve
 *      CONFLITO_DE_REVISAO a quem perdeu e "repetida" à operação já aplicada. */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');
const N = require(path.join(RAIZ, 'forca-agil', 'estruturas-nucleo.js'));
const U = require(path.join(RAIZ, 'forca-agil', 'estruturas-casos-de-uso.js'));
const FB = require(path.join(RAIZ, 'forca-agil', 'estruturas-firebase.js'));
const MOTOR = require(path.join(RAIZ, 'forca-agil', 'motor-posicionamento-nucleo.js'));
const R = require('./estruturas-cenarios');

let total = 0, falhas = 0;
const afirma = (c, msg, det) => { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + det : '')); if (!c) falhas++; };
async function caso(nome, p, deve) {
  total++;
  try { await (deve ? assertSucceeds(p) : assertFails(p)); console.log('  ok    ' + nome); }
  catch (e) { falhas++; console.log('  FALHA ' + nome + ' → ' + String((e && e.message) || e).split('\n')[0]); }
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const k = (e) => e.replace(/[@.]/g, '_');
const SG = 'mapa-subagrupadores';
const FIRMES = MOTOR.CODIGOS_FIRMES;
const casos = U.criar({ nucleo: N, codigosFirmes: FIRMES });
const semNulos = (v) => (Array.isArray(v) ? v.map(semNulos) : v && typeof v === 'object' ? Object.keys(v).reduce((o, kk) => { if (v[kk] !== null && v[kk] !== undefined) o[kk] = semNulos(v[kk]); return o; }, {}) : v);

(async () => {
  const rules = fs.readFileSync(process.env.FA_REGRAS || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-subagrupadores', database: { rules } });
  const semRegras = (f) => env.withSecurityRulesDisabled((c) => f(c.database()));
  const bruto = async (c) => { let v; await semRegras(async (db) => { v = (await db.ref(c).once('value')).val(); }); return v; };
  const sessao = (u) => env.authenticatedContext(u.id, { email: u.email }).database();
  const { conj } = R.carregar(R.ARQUIVO_SUBAGRUPADORES);
  const ARQ = conj.usuarios.arq, ADM = conj.usuarios.adm;
  const AVAL = { id: 'u-avaliacao', email: 'avaliacao@exemplo.com' }, OUTRA = { id: 'u-outra', email: 'outra@exemplo.com' };

  async function semear(estadoInicial) {
    await env.clearDatabase();
    await semRegras((db) => db.ref().set({
      'fa-admins': { [k(ADM.email)]: true },
      'fa-avaliacao-autorizados': { [k(ARQ.email)]: { tipo: 'avaliacao-arquitetura' }, [k(AVAL.email)]: { tipo: 'avaliacao' } },
      'estruturas-concretas': { registros: semNulos(clone((estadoInicial && estadoInicial.estruturas) || {})) },
      'estruturas-concretas-config': { gravacaoHabilitada: true } /* trava de produção ligada, como no emulador do ambiente de testes */
    }));
  }
  async function conferirIntegridade(rotulo) {
    const v = (await bruto(SG)) || {}, regs = Object.assign({}, v.registros || {}, v.associacoes || {}), evs = v.eventos || {}, ops = v.operacoes || {};
    let ok = true, det = '';
    Object.values(evs).forEach((ev) => {
      const op = ops[ev.operacaoId];
      if (!op || op.em !== ev.em) { ok = false; det = 'operação ≠ evento ' + ev.id; }
      if ('antes' in ev) { ok = false; det = '"antes" gravado ' + ev.id; }
    });
    Object.keys(regs).forEach((id) => {
      const r = clone(regs[id]), ev = evs[r.ultimoEvento];
      delete r.ultimaOperacao; delete r.ultimoEvento;
      if (!ev || JSON.stringify(R_ord(r)) !== JSON.stringify(R_ord(ev.depois))) { ok = false; det = 'registro ≠ último evento ' + id; }
    });
    const idx = v['ativa-por-estrutura'] || {}, ativas = Object.values(v.associacoes || {}).filter((a) => a.situacao === 'ativa');
    if (Object.keys(idx).length !== ativas.length || ativas.some((a) => idx[a.estruturaId] !== a.id)) { ok = false; det = 'índice ≠ associações ativas'; }
    afirma(ok, rotulo + ': no banco, registro = depois do seu último evento, mesmo horário em evento e operação, índice = associações ativas', det);
  }
  const R_ord = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = R_ord(x[kk]); return o; }, {}) : x);

  /* ===== A. cenários v1 ===== */
  console.log('A. cenários mapa-subagrupadores v1 pelo adaptador Firebase (emulador)');
  const inicio = Date.now() - 2000;
  let anterior = null;
  const ra = await R.executar({
    arquivo: R.ARQUIVO_SUBAGRUPADORES, rotulo: 'Firebase Emulator (adaptador estruturas-firebase.js)',
    normalizarHorario: (gravado, doCenario) => {
      if (doCenario === undefined) return gravado;
      return typeof gravado === 'number' && gravado >= inicio && gravado <= Date.now() + 2000 ? doCenario : 'NÃO É HORÁRIO DO SERVIDOR: ' + JSON.stringify(gravado);
    },
    criarPortas: async (referencias, estadoInicial) => {
      if (anterior) await conferirIntegridade(anterior);
      await semear(estadoInicial);
      anterior = 'cenário';
      const porPessoa = {};
      const portasDe = (u) => (porPessoa[u.id] = porPessoa[u.id] || FB.criarPortas({ db: sessao(u), codigosFirmes: FIRMES }));
      return Object.assign({}, portasDe(ARQ), { gravar: (op) => portasDe(op.usuario).gravar(op) });
    }
  });
  await conferirIntegridade('último cenário');
  total += ra.total; falhas += ra.falhas;

  /* ===== preparar gravações válidas pelo próprio caso de uso, para adulterar ===== */
  let seq = 0;
  async function preparar(u, operacao, entrada, extraCtx) {
    let capturada = null;
    const p = FB.criarPortas({ db: sessao(u), codigosFirmes: FIRMES });
    const ctx = Object.assign({ operacaoId: 'opx-' + (++seq), usuario: { id: u.id, email: u.email }, agora: Date.now() }, extraCtx || {});
    const r = await casos.executar(operacao, entrada, ctx, Object.assign({}, p, { gravar: (op) => { capturada = op; return Promise.resolve({ situacao: 'gravada' }); } }));
    if (!r.ok) throw new Error('preparar ' + operacao + ': ' + JSON.stringify(r.erros));
    return { op: capturada, multi: FB.montarGravacao(capturada) };
  }
  const gravarComo = (u, multi) => sessao(u).ref().update(multi);
  const ch = (multi, tipo) => Object.keys(multi).filter((c) => c.indexOf('/' + tipo + '/') !== -1);
  const um = (multi, tipo) => ch(multi, tipo)[0];
  function adulterar(multi, f) { const m = clone(multi); f(m); return m; }
  const estrut = (id, tipo, situacao) => ({ id, tipo, nome: id, situacao: situacao || 'ativa', criadaEm: 1, criadaPor: { id: ARQ.id, email: ARQ.email }, revisao: situacao === 'encerrada' ? 2 : 1 });
  await semear({ estruturas: { L1: estrut('L1', 'NEGOCIOS'), L2: estrut('L2', 'NEGOCIOS'), AE: estrut('AE', 'AREA_ESPECIALIZADA'), LC: estrut('LC', 'PLATAFORMA_CANAIS'), LX: estrut('LX', 'NEGOCIOS', 'encerrada') } });

  /* ===== B. autorização ===== */
  console.log('\nB. autorização');
  const c1 = await preparar(ARQ, 'criarSubagrupador', { nome: 'Previdência' }, { novoId: 'SG1' });
  const comoOutro = (u) => adulterar(c1.multi, (m) => { const p = { id: u.id, email: u.email }; m[um(m, 'registros')].criadoPor = p; m[um(m, 'eventos')].usuario = p; m[um(m, 'eventos')].depois.criadoPor = p; m[um(m, 'operacoes')].usuario = p; });
  await caso('perfil avaliacao (só consulta) NÃO grava', gravarComo(AVAL, comoOutro(AVAL)), false);
  await caso('pessoa sem perfil NÃO grava', gravarComo(OUTRA, comoOutro(OUTRA)), false);
  await caso('avaliacao-arquitetura grava (subagrupador + evento + operação)', gravarComo(ARQ, c1.multi), true);
  const c2 = await preparar(ADM, 'criarSubagrupador', { nome: 'Crédito' }, { novoId: 'SG2' });
  await caso('admin geral grava', gravarComo(ADM, c2.multi), true);
  for (const sub of ['registros', 'associacoes', 'ativa-por-estrutura', 'eventos', 'operacoes']) {
    await caso('avaliacao (consulta) lê ' + sub, sessao(AVAL).ref(SG + '/' + sub).once('value'), true);
    await caso('pessoa sem perfil NÃO lê ' + sub, sessao(OUTRA).ref(SG + '/' + sub).once('value'), false);
  }

  /* ===== C. gravações diretas inválidas ===== */
  console.log('\nC0. trava de produção (o mesmo marcador das Estruturas)');
  const tr = await preparar(ARQ, 'criarSubagrupador', { nome: 'Trava' }, { novoId: 'SGT' });
  await semRegras((db) => db.ref(FB.TRAVA_PRODUCAO).remove());
  await caso('sem o marcador (como no banco oficial), criar subagrupador é recusado', gravarComo(ARQ, tr.multi), false);
  await caso('sem o marcador, admin geral também não grava', gravarComo(ADM, adulterar(tr.multi, (m) => { const p = { id: ADM.id, email: ADM.email }; m[um(m, 'registros')].criadoPor = p; m[um(m, 'eventos')].usuario = p; m[um(m, 'eventos')].depois.criadoPor = p; m[um(m, 'operacoes')].usuario = p; })), false);
  await caso('sem o marcador, ocupar o índice de associação direto é recusado', sessao(ARQ).ref(SG + '/ativa-por-estrutura/L2').set('qualquer'), false);
  await caso('admin geral não liga o marcador pelo cliente', sessao(ADM).ref(FB.TRAVA_PRODUCAO).set(true), false);
  await semRegras((db) => db.ref(FB.TRAVA_PRODUCAO).set(true));
  await caso('com o marcador ligado, a mesma gravação entra', gravarComo(ARQ, tr.multi), true);

  console.log('\nC1. subagrupador: nunca sem auditoria, autoria e horário do servidor, só Linhas de Negócios');
  const c3 = await preparar(ARQ, 'criarSubagrupador', { nome: 'Proteção' }, { novoId: 'SG3' });
  const so = (multi, tipos) => tipos.reduce((m, t) => { ch(multi, t).forEach((c) => { m[c] = multi[c]; }); return m; }, {});
  for (const partes of [['registros'], ['eventos'], ['operacoes'], ['registros', 'eventos'], ['registros', 'operacoes'], ['eventos', 'operacoes']])
    await caso('só ' + partes.join(' + ') + ' é recusado', gravarComo(ARQ, so(c3.multi, partes)), false);
  const mutS = [
    ['bloco diferente de Linhas de Negócios', (m) => { m[um(m, 'registros')].bloco = 'COE'; m[um(m, 'eventos')].depois.bloco = 'COE'; }],
    ['criadoEm do cliente', (m) => { const t = Date.now(); m[um(m, 'registros')].criadoEm = t; m[um(m, 'eventos')].depois.criadoEm = t; }],
    ['nascendo na revisão 2', (m) => { m[um(m, 'registros')].revisao = 2; m[um(m, 'eventos')].depois.revisao = 2; }],
    ['nascendo encerrado', (m) => { m[um(m, 'registros')].situacao = 'encerrado'; m[um(m, 'eventos')].depois.situacao = 'encerrado'; }],
    ['nome vazio', (m) => { m[um(m, 'registros')].nome = ''; m[um(m, 'eventos')].depois.nome = ''; }],
    ['nome com espaço na ponta', (m) => { m[um(m, 'registros')].nome = ' X'; m[um(m, 'eventos')].depois.nome = ' X'; }],
    ['campo a mais', (m) => { m[um(m, 'registros')].icone = 'x'; }],
    ['evento com "depois" diferente do registro', (m) => { m[um(m, 'eventos')].depois.nome = 'Outro'; }],
    ['evento com tipo errado', (m) => { m[um(m, 'eventos')].tipo = 'subagrupador.alterado'; }],
    ['evento com "antes" gravado', (m) => { m[um(m, 'eventos')].antes = { id: 'x' }; }],
    ['evento com horário do cliente', (m) => { m[um(m, 'eventos')].em = Date.now(); }],
    ['ultimoEvento apontando para outro evento', (m) => { m[um(m, 'registros')].ultimoEvento = 'opx-zzz:1'; }]
  ];
  for (const [nome, f] of mutS) await caso(nome + ' é recusado', gravarComo(ARQ, adulterar(c3.multi, f)), false);
  await caso('a gravação válida SG3 entra', gravarComo(ARQ, c3.multi), true);

  console.log('\nC2. renomear/ordenar e encerrar: revisão, imutáveis, sem reativação');
  const alt = await preparar(ARQ, 'alterarSubagrupador', { id: 'SG3', alteracoes: { ordem: 1 } });
  await caso('trocar o bloco na alteração é recusado', gravarComo(ARQ, adulterar(alt.multi, (m) => { m[um(m, 'registros')].bloco = 'X'; m[um(m, 'eventos')].depois.bloco = 'X'; })), false);
  await caso('pular revisão é recusado', gravarComo(ARQ, adulterar(alt.multi, (m) => { m[um(m, 'registros')].revisao = 3; m[um(m, 'eventos')].depois.revisao = 3; })), false);
  await caso('evento que esconde o campo alterado é recusado', gravarComo(ARQ, adulterar(alt.multi, (m) => { m[um(m, 'eventos')].campos = ['nome']; })), false);
  await caso('a alteração válida (ordem) entra', gravarComo(ARQ, alt.multi), true);
  const enc = await preparar(ARQ, 'encerrarSubagrupador', { id: 'SG3', motivo: 'Extinto.' });
  await caso('encerramento com motivo diferente no evento é recusado', gravarComo(ARQ, adulterar(enc.multi, (m) => { m[um(m, 'eventos')].motivo = 'Outro'; })), false);
  await caso('encerramento válido entra', gravarComo(ARQ, enc.multi), true);
  const atual = await bruto(SG + '/registros/SG3');
  const reat = clone(alt.multi); Object.keys(reat).forEach((kk) => delete reat[kk]);
  const reg = clone(atual); delete reg.encerramento; reg.situacao = 'ativo'; reg.revisao = atual.revisao + 1; reg.ordem = atual.ordem + 1; /* muda a ordem: só a proibição de reativar pode barrar */ reg.alteradoEm = { '.sv': 'timestamp' }; reg.ultimaOperacao = 'opx-reativa'; reg.ultimoEvento = 'opx-reativa:1';
  const dep = clone(reg); delete dep.ultimaOperacao; delete dep.ultimoEvento;
  reat[SG + '/registros/SG3'] = reg;
  reat[SG + '/eventos/opx-reativa:1'] = { id: 'opx-reativa:1', operacaoId: 'opx-reativa', tipo: 'subagrupador.alterado', entidade: 'subagrupador', entidadeId: 'SG3', usuario: { id: ARQ.id, email: ARQ.email }, em: { '.sv': 'timestamp' }, depois: dep, campos: ['ordem'] };
  reat[SG + '/operacoes/opx-reativa'] = { tipo: 'alterarSubagrupador', usuario: { id: ARQ.id, email: ARQ.email }, em: { '.sv': 'timestamp' } };
  await caso('reativar um subagrupador encerrado é recusado', gravarComo(ARQ, reat), false);

  console.log('\nC3. associação: só Linha de Negócios ativa, só subagrupador ativo, uma ativa por Linha');
  const a1 = await preparar(ARQ, 'associarLinha', { estruturaId: 'L1', subagrupadorId: 'SG1' }, { novoId: 'A1' });
  const trocaEst = (est) => (m) => { m[um(m, 'associacoes')].estruturaId = est; m[um(m, 'eventos')].depois.estruturaId = est; const ix = um(m, 'ativa-por-estrutura'); const v = m[ix]; delete m[ix]; m[SG + '/ativa-por-estrutura/' + est] = v; };
  await caso('associar Área Especializada é recusado', gravarComo(ARQ, adulterar(a1.multi, trocaEst('AE'))), false);
  await caso('associar Linha de outra especialização (Canais) é recusado', gravarComo(ARQ, adulterar(a1.multi, trocaEst('LC'))), false);
  await caso('associar Linha encerrada é recusado', gravarComo(ARQ, adulterar(a1.multi, trocaEst('LX'))), false);
  await caso('associar a subagrupador encerrado é recusado', gravarComo(ARQ, adulterar(a1.multi, (m) => { m[um(m, 'associacoes')].subagrupadorId = 'SG3'; m[um(m, 'eventos')].depois.subagrupadorId = 'SG3'; })), false);
  await caso('associação sem ocupar o índice é recusada', gravarComo(ARQ, adulterar(a1.multi, (m) => { delete m[um(m, 'ativa-por-estrutura')]; })), false);
  await caso('associação com troca forjada (substitui inexistente) é recusada', gravarComo(ARQ, adulterar(a1.multi, (m) => { m[um(m, 'associacoes')].substitui = 'A9'; m[um(m, 'eventos')].depois.substitui = 'A9'; })), false);
  await caso('a associação válida entra', gravarComo(ARQ, a1.multi), true);
  const a2 = await preparar(ARQ, 'associarLinha', { estruturaId: 'L2', subagrupadorId: 'SG2' }, { novoId: 'A2' });
  await caso('segunda associação ativa da MESMA Linha (L1), tomando o índice, é recusada', gravarComo(ARQ, adulterar(a2.multi, trocaEst('L1'))), false);
  await caso('índice apontando para associação de outra Linha é recusado', sessao(ARQ).ref(SG + '/ativa-por-estrutura/L2').set('A1'), false);
  await caso('liberar o índice sem encerrar a associação é recusado', sessao(ARQ).ref(SG + '/ativa-por-estrutura/L1').set(null), false);
  const des = await preparar(ARQ, 'desassociarLinha', { associacaoId: 'A1' });
  await caso('encerrar a associação sem liberar o índice é recusado', gravarComo(ARQ, adulterar(des.multi, (m) => { delete m[um(m, 'ativa-por-estrutura')]; })), false);
  const sub = await preparar(ARQ, 'substituirAssociacao', { associacaoId: 'A1', subagrupadorId: 'SG2' }, { novoId: 'A3' });
  await caso('troca válida (encerra A1, cria A3, índice para A3) entra', gravarComo(ARQ, sub.multi), true);
  const a1b = await bruto(SG + '/associacoes/A1'), a3 = await bruto(SG + '/associacoes/A3'), ix = await bruto(SG + '/ativa-por-estrutura/L1');
  afirma(a1b.situacao === 'encerrada' && a1b.encerramento.substituidaPor === 'A3' && a3.substitui === 'A1' && ix === 'A3', 'a troca fica rastreável nas duas pontas e o índice aponta para a nova');
  await caso('reabrir uma associação encerrada é recusado', sessao(ARQ).ref(SG + '/associacoes/A1/situacao').set('ativa'), false);

  console.log('\nC4. nada se apaga nem se edita depois');
  const ev1 = Object.keys((await bruto(SG + '/eventos')) || {})[0];
  for (const [nome, c, v] of [['apagar um subagrupador', SG + '/registros/SG1', null], ['apagar todos', SG + '/registros', null], ['apagar o nó inteiro', SG, null],
    ['apagar uma associação', SG + '/associacoes/A1', null], ['apagar um evento', SG + '/eventos/' + ev1, null], ['editar um evento', SG + '/eventos/' + ev1 + '/depois/nome', 'X'],
    ['apagar uma operação', SG + '/operacoes/' + ev1.replace(/:\d$/, ''), null], ['renomear direto no registro', SG + '/registros/SG1/nome', 'Direto']])
    await caso(nome + ' é recusado (até para admin geral)', sessao(ADM).ref(c).set(v), false);

  /* ===== D. concorrência ===== */
  console.log('\nD. concorrência');
  const n1 = await preparar(ARQ, 'associarLinha', { estruturaId: 'L2', subagrupadorId: 'SG1' }, { novoId: 'C1' });
  const n2 = await preparar(ADM, 'associarLinha', { estruturaId: 'L2', subagrupadorId: 'SG2' }, { novoId: 'C2' });
  const rs = await Promise.allSettled([gravarComo(ARQ, n1.multi), gravarComo(ADM, n2.multi)]);
  afirma(rs.filter((x) => x.status === 'fulfilled').length === 1, 'duas associações da mesma Linha ao mesmo tempo: só uma entra', JSON.stringify(rs.map((x) => x.status)));
  const perdeu = rs[0].status === 'fulfilled' ? { prep: n2, quem: ADM } : { prep: n1, quem: ARQ };
  const conf = await FB.criarPortas({ db: sessao(perdeu.quem), codigosFirmes: FIRMES }).gravar(perdeu.prep.op).then((x) => x.situacao, (e) => e.codigo);
  afirma(conf === 'CONFLITO_DE_REVISAO', 'o adaptador devolve CONFLITO_DE_REVISAO a quem perdeu a corrida', conf);
  const venceu = rs[0].status === 'fulfilled' ? n1 : n2;
  const rep = await FB.criarPortas({ db: sessao(rs[0].status === 'fulfilled' ? ARQ : ADM), codigosFirmes: FIRMES }).gravar(venceu.op).then((x) => x.situacao, (e) => e.codigo);
  afirma(rep === 'repetida', 'a operação já aplicada é reconhecida como "repetida"', rep);
  await conferirIntegridade('depois das gravações diretas e da concorrência');

  await env.cleanup();
  console.log('\n============================\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e && e.stack || e); process.exit(1); });
