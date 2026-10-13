/* Estruturas Organizacionais Concretas — Etapa 2: adaptador Firebase + regras do nó estruturas-concretas, no
 * EMULADOR real do Realtime Database (teste-rules.yml). Nada de banco oficial.
 *   A. o MESMO conjunto versionado de cenários (estruturas-concretas v1, executor compartilhado) roda pelo caso de uso
 *      compartilhado sobre o adaptador Firebase (forca-agil/estruturas-firebase.js), cada gravação feita pela sessão
 *      da pessoa do passo; o horário gravado tem de ser o do SERVIDOR; depois de cada cenário, a integridade
 *      estrutura ↔ evento ↔ operação é conferida no banco (mesmo horário nas três, último evento = estrutura gravada);
 *   B. autorização (quem grava, quem lê) e a leitura granular de posicionamento-classificacoes/<firme>/registradoEm;
 *   C. gravações diretas inválidas recusadas: partes sozinhas, evento adulterado, autoria e horário do cliente, tipo
 *      fora dos 8 firmes / sem ligação / conceito inativo, campos inválidos, imutáveis, revisão, nada a alterar,
 *      reativação, apagar ou editar estrutura, evento ou operação, repetir operação;
 *   D. concorrência: duas gravações a partir da mesma revisão → só uma entra; mesma operação em paralelo → uma vez;
 *   E. M3 do Mapa — vínculo item × estrutura responsável (nó estruturas-vinculos): o conjunto vinculos-responsavel v1
 *      pelo adaptador, autorização e trava, gravações diretas inválidas (V1–V5 conferidos no banco) e concorrência. */
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
const k = (e) => e.replace('@', '_').replace('.', '_');
const EC = 'estruturas-concretas';
const FIRMES = MOTOR.CODIGOS_FIRMES;
const casos = U.criar({ nucleo: N, codigosFirmes: FIRMES });

(async () => {
  const rules = fs.readFileSync(process.env.FA_REGRAS || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-estruturas', database: { rules } });
  const semRegras = (f) => env.withSecurityRulesDisabled((c) => f(c.database()));
  /* withSecurityRulesDisabled não devolve o valor da função: guarda-se o lido */
  const bruto = async (c) => { let v; await semRegras(async (db) => { v = (await db.ref(c).once('value')).val(); }); return v; };
  const sessao = (u) => env.authenticatedContext(u.id, { email: u.email }).database();
  const { conj } = R.carregar();
  const ARQ = conj.usuarios.arq, ADM = conj.usuarios.adm;
  const AVAL = { id: 'u-avaliacao', email: 'avaliacao@exemplo.com' }, OUTRA = { id: 'u-outra', email: 'outra@exemplo.com' };

  /* perfis + referências oficiais como a Taxonomia e a governança as gravam */
  async function semear(ref) {
    await env.clearDatabase();
    await semRegras(async (db) => {
      const raiz = { 'fa-admins': { [k(ADM.email)]: true },
        'fa-avaliacao-autorizados': { [k(ARQ.email)]: { tipo: 'avaliacao-arquitetura' }, [k(AVAL.email)]: { tipo: 'avaliacao' } },
        taxonomia: { organizacional: { conceitos: {} } }, 'posicionamento-classificacoes': {}, 'posicionamento-classificacoes-auditoria': { NEGOCIOS: { a1: { tipo: 'ligacao_registrada' } } },
        'estruturas-concretas-config': { gravacaoHabilitada: true } /* trava de produção ligada (como o emulador do ambiente de testes) */ };
      Object.keys(ref.conceitos || {}).forEach((c) => { raiz.taxonomia.organizacional.conceitos[c] = { nome: 'Conceito ' + c, ordem: 1, ativo: ref.conceitos[c].ativo, situacaoDefinicao: 'registrada', camada: 'A' }; });
      Object.keys(ref.ligacoes || {}).forEach((c) => {
        if (ref.ligacoes[c] !== c) throw new Error('no banco oficial a ligação canônica é sempre de MESMO código: ' + c);
        raiz['posicionamento-classificacoes'][c] = { registradoEm: '2026-10-01T12:00:00.000Z', registradoPor: ADM.email, auditoriaId: 'a1' };
      });
      await db.ref().set(raiz);
    });
  }
  /* integridade no banco: estrutura ↔ último evento ↔ operação, mesmo horário do servidor nas três */
  async function conferirIntegridade(rotulo) {
    const v = (await bruto(EC)) || {}, regs = v.registros || {}, evs = v.eventos || {}, ops = v.operacoes || {};
    const lista = Object.values(evs).sort((a, b) => a.em - b.em || (a.id < b.id ? -1 : 1));
    let ok = Object.keys(ops).length === lista.length, det = '';
    const ultimo = {};
    lista.forEach((ev) => {
      const op = ops[ev.operacaoId];
      if (!op || op.em !== ev.em || op.estruturaId !== ev.entidadeId) { ok = false; det = 'operação ≠ evento ' + ev.id; }
      const campo = { 'estrutura.criada': ev.depois.criadaEm, 'estrutura.alterada': ev.depois.alteradaEm, 'estrutura.encerrada': ev.depois.encerramento && ev.depois.encerramento.em }[ev.tipo];
      if (campo !== ev.em) { ok = false; det = 'horário do evento ≠ horário gravado na estrutura ' + ev.id; }
      if ('antes' in ev) { ok = false; det = '"antes" gravado ' + ev.id; }
      ultimo[ev.entidadeId] = ev;
    });
    Object.keys(regs).forEach((id) => {
      const e = clone(regs[id]), ev = ultimo[id]; const opId = e.ultimaOperacao; delete e.ultimaOperacao;
      if (!ev || ev.operacaoId !== opId || JSON.stringify(R_ordenado(e)) !== JSON.stringify(R_ordenado(ev.depois))) { ok = false; det = 'estrutura ≠ último evento ' + id; }
    });
    afirma(ok, rotulo + ': no banco, cada estrutura = depois do seu último evento, e evento, operação e estrutura têm o MESMO horário do servidor', det);
  }
  const R_ordenado = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = R_ordenado(x[kk]); return o; }, {}) : x);

  /* ===== A. cenários v1 pelo adaptador Firebase ===== */
  console.log('A. cenários de negócio v1 pelo adaptador Firebase (emulador)');
  const inicio = Date.now() - 2000;
  let anterior = null;
  const ra = await R.executar({
    rotulo: 'Firebase Emulator (adaptador estruturas-firebase.js)',
    normalizarHorario: (gravado, doCenario) => {
      if (doCenario === undefined) return gravado; /* campo que não devia existir continua aparecendo como diferença */
      return typeof gravado === 'number' && gravado >= inicio && gravado <= Date.now() + 2000 ? doCenario : 'NÃO É HORÁRIO DO SERVIDOR: ' + JSON.stringify(gravado);
    },
    criarPortas: async (referencias) => {
      if (anterior) await conferirIntegridade(anterior);
      await semear(referencias);
      anterior = 'cenário';
      const porPessoa = {};
      const portasDe = (u) => (porPessoa[u.id] = porPessoa[u.id] || FB.criarPortas({ db: sessao(u), codigosFirmes: FIRMES }));
      const leitura = portasDe(ARQ);
      /* cada gravação é feita pela sessão de quem age (autoria = token) */
      return Object.assign({}, leitura, { gravar: (op) => portasDe(op.usuario).gravar(op) });
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
  const chaves = (multi) => ({ reg: Object.keys(multi).find((c) => c.indexOf('/registros/') !== -1), ev: Object.keys(multi).find((c) => c.indexOf('/eventos/') !== -1), op: Object.keys(multi).find((c) => c.indexOf('/operacoes/') !== -1) });
  function adulterar(multi, f) { const m = clone(multi); f(m, chaves(m)); return m; }
  const criar = (id, tipo, extra) => Object.assign({ tipo: tipo || 'NEGOCIOS', nome: 'Estrutura ' + id }, extra || {});

  await semear(conj.referencias.padrao);
  await semRegras((db) => db.ref('posicionamento-classificacoes/LINHA').set({ registradoEm: '2026-10-01T12:00:00.000Z', registradoPor: ADM.email, auditoriaId: 'a1' }));

  /* ===== B. autorização e leitura granular ===== */
  console.log('\nB. autorização');
  const c1 = await preparar(ARQ, 'criarEstrutura', criar('B1'), { novoId: 'B-1' });
  await caso('perfil avaliacao (só consulta) NÃO grava uma estrutura válida', gravarComo(AVAL, adulterar(c1.multi, (m, c) => { m[c.reg].criadaPor = { id: AVAL.id, email: AVAL.email }; m[c.ev].usuario = { id: AVAL.id, email: AVAL.email }; m[c.ev].depois.criadaPor = { id: AVAL.id, email: AVAL.email }; m[c.op].usuario = { id: AVAL.id, email: AVAL.email }; })), false);
  await caso('pessoa sem perfil NÃO grava', gravarComo(OUTRA, adulterar(c1.multi, (m, c) => { m[c.reg].criadaPor = { id: OUTRA.id, email: OUTRA.email }; m[c.ev].usuario = { id: OUTRA.id, email: OUTRA.email }; m[c.ev].depois.criadaPor = { id: OUTRA.id, email: OUTRA.email }; m[c.op].usuario = { id: OUTRA.id, email: OUTRA.email }; })), false);
  await caso('avaliacao-arquitetura grava a estrutura válida (estrutura + evento + operação)', gravarComo(ARQ, c1.multi), true);
  const c2 = await preparar(ADM, 'criarEstrutura', criar('B2', 'COE'), { novoId: 'B-2' });
  await caso('admin geral grava', gravarComo(ADM, c2.multi), true);
  for (const sub of ['registros', 'eventos', 'operacoes']) {
    await caso('avaliacao (consulta) lê ' + sub, sessao(AVAL).ref(EC + '/' + sub).once('value'), true);
    await caso('pessoa sem perfil NÃO lê ' + sub, sessao(OUTRA).ref(EC + '/' + sub).once('value'), false);
    await caso('sem login NÃO lê ' + sub, env.unauthenticatedContext().database().ref(EC + '/' + sub).once('value'), false);
  }
  console.log('\nB2. leitura granular da ligação canônica (só registradoEm, só os 8 firmes, só quem cadastra)');
  await caso('avaliacao-arquitetura lê posicionamento-classificacoes/NEGOCIOS/registradoEm', sessao(ARQ).ref('posicionamento-classificacoes/NEGOCIOS/registradoEm').once('value'), true);
  for (const c of ['posicionamento-classificacoes/NEGOCIOS/registradoPor', 'posicionamento-classificacoes/NEGOCIOS/auditoriaId', 'posicionamento-classificacoes/NEGOCIOS', 'posicionamento-classificacoes', 'posicionamento-classificacoes/LINHA/registradoEm', 'posicionamento-classificacoes-auditoria', 'posicionamento-classificacoes-auditoria/NEGOCIOS/a1'])
    await caso('avaliacao-arquitetura NÃO lê ' + c, sessao(ARQ).ref(c).once('value'), false);
  await caso('avaliacao (consulta) NÃO lê registradoEm', sessao(AVAL).ref('posicionamento-classificacoes/NEGOCIOS/registradoEm').once('value'), false);
  await caso('pessoa sem perfil NÃO lê registradoEm', sessao(OUTRA).ref('posicionamento-classificacoes/NEGOCIOS/registradoEm').once('value'), false);
  await caso('admin geral continua lendo o nó inteiro', sessao(ADM).ref('posicionamento-classificacoes').once('value'), true);

  /* ===== C. gravações diretas inválidas ===== */
  console.log('\nC0. trava de produção (estruturas-concretas-config/gravacaoHabilitada)');
  const tr = await preparar(ARQ, 'criarEstrutura', criar('TR'), { novoId: 'T-R' });
  await semRegras((db) => db.ref(FB.TRAVA_PRODUCAO).remove());
  await caso('sem o marcador (como no banco oficial), uma gravação válida é recusada', gravarComo(ARQ, tr.multi), false);
  await caso('admin geral não liga o marcador pelo cliente', sessao(ADM).ref(FB.TRAVA_PRODUCAO).set(true), false);
  await caso('avaliacao-arquitetura não liga o marcador pelo cliente', sessao(ARQ).ref(FB.TRAVA_PRODUCAO).set(true), false);
  await caso('ninguém lê o marcador pelo cliente', sessao(ADM).ref(FB.TRAVA_PRODUCAO).once('value'), false);
  await semRegras((db) => db.ref(FB.TRAVA_PRODUCAO).set(true));
  await caso('com o marcador ligado (só console/conta de serviço), a mesma gravação entra', gravarComo(ARQ, tr.multi), true);

  console.log('\nC1. nunca sem auditoria: partes da operação sozinhas');
  const c3 = await preparar(ARQ, 'criarEstrutura', criar('C3'), { novoId: 'C-3' });
  const so = (multi, partes) => { const c = chaves(multi), m = {}; partes.forEach((p) => { m[c[p]] = multi[c[p]]; }); return m; };
  for (const partes of [['reg'], ['ev'], ['op'], ['reg', 'ev'], ['reg', 'op'], ['ev', 'op']])
    await caso('só ' + partes.join(' + ') + ' é recusado', gravarComo(ARQ, so(c3.multi, partes)), false);

  console.log('\nC2. evento fiel e do servidor');
  const mut = [
    ['evento com "depois" diferente da estrutura', (m, c) => { m[c.ev].depois.nome = 'Outro nome'; }],
    ['evento com "antes" gravado', (m, c) => { m[c.ev].antes = { id: 'x' }; }],
    ['evento com tipo errado', (m, c) => { m[c.ev].tipo = 'estrutura.alterada'; }],
    ['evento de outra pessoa', (m, c) => { m[c.ev].usuario = { id: ADM.id, email: ADM.email }; }],
    ['evento com horário do cliente', (m, c) => { m[c.ev].em = Date.now(); }],
    ['evento com campo a mais', (m, c) => { m[c.ev].extra = 1; }],
    ['evento com motivo numa criação', (m, c) => { m[c.ev].motivo = 'x'; }],
    ['operação com horário do cliente', (m, c) => { m[c.op].em = Date.now(); }],
    ['operação de outra pessoa', (m, c) => { m[c.op].usuario = { id: ADM.id, email: ADM.email }; }],
    ['operação com tipo que não corresponde ao evento', (m, c) => { m[c.op].tipo = 'alterarEstrutura'; }],
    ['estrutura de outra pessoa (criadaPor)', (m, c) => { m[c.reg].criadaPor.id = ADM.id; m[c.ev].depois.criadaPor.id = ADM.id; }],
    ['estrutura com e-mail de outra pessoa', (m, c) => { m[c.reg].criadaPor.email = ADM.email; m[c.ev].depois.criadaPor.email = ADM.email; }],
    ['estrutura com horário do cliente', (m, c) => { const t = Date.now(); m[c.reg].criadaEm = t; m[c.ev].depois.criadaEm = t; }],
    ['estrutura nascendo na revisão 2', (m, c) => { m[c.reg].revisao = 2; m[c.ev].depois.revisao = 2; }],
    ['estrutura nascendo encerrada', (m, c) => { m[c.reg].situacao = 'encerrada'; m[c.ev].depois.situacao = 'encerrada'; }],
    ['estrutura com campo a mais', (m, c) => { m[c.reg].extra = 1; }],
    ['estrutura com id diferente da chave', (m, c) => { m[c.reg].id = 'outro'; m[c.ev].depois.id = 'outro'; }],
    ['nome vazio', (m, c) => { m[c.reg].nome = ''; m[c.ev].depois.nome = ''; }],
    ['nome com espaço na ponta', (m, c) => { m[c.reg].nome = ' X'; m[c.ev].depois.nome = ' X'; }],
    ['nome com 201 caracteres', (m, c) => { m[c.reg].nome = 'a'.repeat(201); m[c.ev].depois.nome = 'a'.repeat(201); }],
    ['nome com tabulação no começo', (m, c) => { m[c.reg].nome = '\tX'; m[c.ev].depois.nome = '\tX'; }],
    ['nome com quebra de linha no fim', (m, c) => { m[c.reg].nome = 'X\n'; m[c.ev].depois.nome = 'X\n'; }],
    ['nome com retorno de carro no fim', (m, c) => { m[c.reg].nome = 'X\r'; m[c.ev].depois.nome = 'X\r'; }]
  ];
  for (const [nome, f] of mut) await caso(nome + ' é recusado', gravarComo(ARQ, adulterar(c3.multi, f)), false);
  /* as letras t, n e r nas pontas são nomes válidos (a regra confere caracteres de espaço, não letras) */
  for (const [nomeEst, id] of [['rede de canais tn', 'C-6'], ['Tecnologia Rest', 'C-7'], ['nova plataforma Gen', 'C-8']]) {
    const v = await preparar(ARQ, 'criarEstrutura', criar('x', 'NEGOCIOS', { nome: nomeEst }), { novoId: id });
    await caso('nome "' + nomeEst + '" (t, n ou r nas pontas) entra', gravarComo(ARQ, v.multi), true);
  }

  console.log('\nC3. só os 8 tipos firmes, com ligação canônica e conceito ativo (conferidos na gravação)');
  for (const t of ['SQUAD', 'LINHA', 'PLATAFORMA', 'A_VALIDAR', 'XYZ'])
    await caso('tipo ' + t + ' é recusado', gravarComo(ARQ, adulterar(c3.multi, (m, c) => { m[c.reg].tipo = t; m[c.ev].depois.tipo = t; })), false);
  const coe = await preparar(ARQ, 'criarEstrutura', criar('C4', 'COE'), { novoId: 'C-4' });
  const ae = await preparar(ARQ, 'criarEstrutura', criar('C5', 'AREA_ESPECIALIZADA'), { novoId: 'C-5' });
  const ligCoe = await bruto('posicionamento-classificacoes/COE');
  await semRegras((db) => Promise.all([db.ref('posicionamento-classificacoes/COE').remove(), db.ref('taxonomia/organizacional/conceitos/AREA_ESPECIALIZADA/ativo').set(false)]));
  await caso('CoE sem ligação canônica registrada é recusado', gravarComo(ARQ, coe.multi), false);
  await caso('Área Especializada com conceito inativo é recusada', gravarComo(ARQ, ae.multi), false);
  await semRegras((db) => Promise.all([db.ref('posicionamento-classificacoes/COE').set(ligCoe), db.ref('taxonomia/organizacional/conceitos/AREA_ESPECIALIZADA/ativo').set(true)]));
  await caso('com as referências restauradas, a mesma gravação de CoE entra', gravarComo(ARQ, coe.multi), true);
  await caso('a gravação válida C-3 entra', gravarComo(ARQ, c3.multi), true);

  console.log('\nC4. alterar: imutáveis, revisão, campos alterados, nada a alterar');
  const alt = await preparar(ARQ, 'alterarEstrutura', { id: 'C-3', alteracoes: { nome: 'Novo nome', sigla: 'NN' }, justificativa: 'Ajuste' });
  const mutAlt = [
    ['trocar o tipo', (m, c) => { m[c.reg].tipo = 'COE'; m[c.ev].depois.tipo = 'COE'; }],
    ['trocar criadaEm', (m, c) => { m[c.reg].criadaEm = 1; m[c.ev].depois.criadaEm = 1; }],
    ['trocar criadaPor', (m, c) => { m[c.reg].criadaPor.id = ADM.id; m[c.ev].depois.criadaPor.id = ADM.id; }],
    ['pular revisão (+2)', (m, c) => { m[c.reg].revisao = 3; m[c.ev].depois.revisao = 3; }],
    ['manter a revisão', (m, c) => { m[c.reg].revisao = 1; m[c.ev].depois.revisao = 1; }],
    ['alteradaEm do cliente', (m, c) => { const t = Date.now(); m[c.reg].alteradaEm = t; m[c.ev].depois.alteradaEm = t; }],
    ['evento que esconde um campo alterado (campos sem sigla)', (m, c) => { m[c.ev].campos = ['nome']; }],
    ['evento que lista campo não alterado', (m, c) => { m[c.ev].campos = ['nome', 'sigla', 'descricao']; }],
    ['nada a alterar (mesmos valores)', (m, c) => { m[c.reg].nome = 'Estrutura C3'; delete m[c.reg].sigla; m[c.ev].depois.nome = 'Estrutura C3'; delete m[c.ev].depois.sigla; m[c.ev].campos = ['descricao']; }],
    ['encerramento junto com alteração', (m, c) => { const e = { motivo: 'x', em: { '.sv': 'timestamp' }, por: { id: ARQ.id, email: ARQ.email } }; m[c.reg].encerramento = e; m[c.ev].depois.encerramento = e; }]
  ];
  for (const [nome, f] of mutAlt) await caso(nome + ' é recusado', gravarComo(ARQ, adulterar(alt.multi, f)), false);
  await caso('a alteração válida entra', gravarComo(ARQ, alt.multi), true);
  await caso('repetir a MESMA operação é recusado (não duplica)', gravarComo(ARQ, alt.multi), false);

  console.log('\nC5. encerrar, sem reativação, sem apagar, sem editar a auditoria');
  const enc = await preparar(ARQ, 'encerrarEstrutura', { id: 'C-3', motivo: 'Fusão' });
  await caso('encerramento com horário do cliente é recusado', gravarComo(ARQ, adulterar(enc.multi, (m, c) => { const t = Date.now(); m[c.reg].encerramento.em = t; m[c.ev].depois.encerramento.em = t; })), false);
  await caso('encerramento que muda o nome é recusado', gravarComo(ARQ, adulterar(enc.multi, (m, c) => { m[c.reg].nome = 'Outro'; m[c.ev].depois.nome = 'Outro'; })), false);
  await caso('evento com motivo diferente do encerramento é recusado', gravarComo(ARQ, adulterar(enc.multi, (m, c) => { m[c.ev].motivo = 'Outro motivo'; })), false);
  await caso('o encerramento válido entra', gravarComo(ARQ, enc.multi), true);
  const atual = await bruto(EC + '/registros/C-3');
  const reativar = adulterar(alt.multi, (m, c) => {
    const e = clone(atual); delete e.encerramento; e.situacao = 'ativa'; e.revisao = atual.revisao + 1; e.alteradaEm = { '.sv': 'timestamp' }; e.ultimaOperacao = 'opx-reativa';
    const dep = clone(e); delete dep.ultimaOperacao;
    Object.keys(m).forEach((kk) => delete m[kk]);
    m[EC + '/registros/C-3'] = e;
    m[EC + '/eventos/opx-reativa:1'] = { id: 'opx-reativa:1', operacaoId: 'opx-reativa', tipo: 'estrutura.alterada', entidade: 'estrutura', entidadeId: 'C-3', usuario: { id: ARQ.id, email: ARQ.email }, em: { '.sv': 'timestamp' }, depois: dep, campos: ['nome'] };
    m[EC + '/operacoes/opx-reativa'] = { tipo: 'alterarEstrutura', estruturaId: 'C-3', usuario: { id: ARQ.id, email: ARQ.email }, em: { '.sv': 'timestamp' } };
  });
  await caso('reativar uma estrutura encerrada é recusado', gravarComo(ARQ, reativar), false);
  const r2 = await bruto(EC + '/registros/C-3');
  afirma(r2.situacao === 'encerrada' && r2.revisao === 3, 'a estrutura continua encerrada na revisão 3');
  const ev1 = Object.keys((await bruto(EC + '/eventos')) || {})[0];
  for (const [nome, c, v] of [
    ['apagar uma estrutura', EC + '/registros/B-1', null], ['apagar todas as estruturas', EC + '/registros', null], ['apagar o nó inteiro', EC, null],
    ['apagar um evento', EC + '/eventos/' + ev1, null], ['editar um evento', EC + '/eventos/' + ev1 + '/depois/nome', 'X'], ['apagar a auditoria inteira', EC + '/eventos', null],
    ['apagar uma operação', EC + '/operacoes/' + ev1.replace(/:1$/, ''), null], ['editar uma operação', EC + '/operacoes/' + ev1.replace(/:1$/, '') + '/tipo', 'encerrarEstrutura'],
    ['editar um campo da estrutura direto', EC + '/registros/B-1/nome', 'Direto']
  ]) await caso(nome + ' é recusado (até para admin geral)', sessao(ADM).ref(c).set(v), false);

  /* ===== D. concorrência ===== */
  console.log('\nD. concorrência');
  const a1 = await preparar(ARQ, 'alterarEstrutura', { id: 'B-1', alteracoes: { nome: 'Pela arquitetura' } });
  const a2 = await preparar(ADM, 'alterarEstrutura', { id: 'B-1', alteracoes: { nome: 'Pelo admin' } });
  const rs = await Promise.allSettled([gravarComo(ARQ, a1.multi), gravarComo(ADM, a2.multi)]);
  const b1 = await bruto(EC + '/registros/B-1');
  afirma(rs.filter((x) => x.status === 'fulfilled').length === 1 && b1.revisao === 2, 'duas alterações a partir da mesma revisão: só uma entra (revisão 2)', JSON.stringify(rs.map((x) => x.status)) + ' rev ' + b1.revisao);
  const n1 = await preparar(ARQ, 'criarEstrutura', criar('D1'), { novoId: 'D-1' });
  const n2 = await preparar(ADM, 'criarEstrutura', criar('D1b', 'COE'), { novoId: 'D-1' });
  const rn = await Promise.allSettled([gravarComo(ARQ, n1.multi), gravarComo(ADM, n2.multi)]);
  afirma(rn.filter((x) => x.status === 'fulfilled').length === 1, 'duas criações com o mesmo identificador: só uma entra', JSON.stringify(rn.map((x) => x.status)));
  const m1 = await preparar(ARQ, 'criarEstrutura', criar('D2'), { novoId: 'D-2' });
  const rm = await Promise.allSettled([gravarComo(ARQ, m1.multi), gravarComo(ARQ, m1.multi), gravarComo(ARQ, m1.multi)]);
  afirma(rm.filter((x) => x.status === 'fulfilled').length === 1, 'a mesma operação enviada três vezes em paralelo: entra uma vez', JSON.stringify(rm.map((x) => x.status)));
  /* pelo adaptador: conflito vira CONFLITO_DE_REVISAO e repetição vira "repetida" */
  const perdeu = rs[0].status === 'fulfilled' ? { prep: a2, quem: ADM } : { prep: a1, quem: ARQ };
  const conf = await FB.criarPortas({ db: sessao(perdeu.quem), codigosFirmes: FIRMES }).gravar(perdeu.prep.op).then((x) => x.situacao, (e) => e.codigo);
  afirma(conf === 'CONFLITO_DE_REVISAO', 'o adaptador devolve CONFLITO_DE_REVISAO a quem perdeu a corrida', conf);
  const pa = FB.criarPortas({ db: sessao(ARQ), codigosFirmes: FIRMES });
  const rep = await pa.gravar(m1.op).then((x) => x.situacao, (e) => e.codigo);
  afirma(rep === 'repetida', 'o adaptador reconhece a operação já aplicada como "repetida"', rep);
  await conferirIntegridade('depois das gravações diretas e da concorrência');

  /* ===== E. M3 do Mapa: vínculo item × estrutura responsável principal (nó estruturas-vinculos) ===== */
  console.log('\nE. vínculos item × estrutura responsável (M3) — conjunto vinculos-responsavel v1, autorização, adulterações e concorrência');
  const EV = 'estruturas-vinculos';
  const semNulos = (v) => (Array.isArray(v) ? v.map(semNulos) : v && typeof v === 'object' ? Object.keys(v).reduce((o, kk) => { if (v[kk] !== null && v[kk] !== undefined) o[kk] = semNulos(v[kk]); return o; }, {}) : v);
  /* perfis, ligações, estruturas e o Posicionamento VIGENTE e concluído de cada item, como as telas os gravam */
  async function semearVinculos(ref, ini) {
    await semear(ref);
    const e = ini || {}, m = {};
    Object.keys(e.estruturas || {}).forEach((id) => { m[EC + '/registros/' + id] = semNulos(e.estruturas[id]); });
    Object.keys(e.posicionamentos || {}).forEach((item) => {
      const p = e.posicionamentos[item];
      m['posicionamento-vigente-por-item/' + item] = p.avaliacaoId;
      m['avaliacoes-posicionamento/' + p.avaliacaoId] = { status: 'concluido', itemId: item, resultadoAutomatico: { codigoResultado: p.recomendacao.codigoResultado } };
      if (p.decisao) m['posicionamento-decisoes/' + p.avaliacaoId] = { codigoFinal: p.decisao.codigoFinal };
    });
    if (Object.keys(m).length) await semRegras((db) => db.ref().update(m));
  }
  /* integridade: vínculo = "depois" do seu último evento; mesmo horário em evento e operação; índice = vínculos ativos */
  async function integridadeVinculos(rotulo) {
    const v = (await bruto(EV)) || {}, regs = v.registros || {}, evs = v.eventos || {}, ops = v.operacoes || {};
    let ok = true, det = '';
    Object.values(evs).forEach((ev) => {
      const op = ops[ev.operacaoId];
      if (!op || op.em !== ev.em || op.objetoId !== ev.depois.objetoId) { ok = false; det = 'operação ≠ evento ' + ev.id; }
      if ('antes' in ev) { ok = false; det = '"antes" gravado ' + ev.id; }
    });
    Object.keys(regs).forEach((id) => {
      const r = clone(regs[id]), ev = evs[r.ultimoEvento];
      delete r.ultimaOperacao; delete r.ultimoEvento;
      if (!ev || JSON.stringify(ord(r)) !== JSON.stringify(ord(ev.depois))) { ok = false; det = 'vínculo ≠ último evento ' + id; }
    });
    const idx = v['ativo-por-objeto'] || {}, ativos = Object.values(regs).filter((x) => x.situacao === 'ativa');
    if (Object.keys(idx).length !== ativos.length || ativos.some((x) => idx[x.objetoId] !== x.id)) { ok = false; det = 'índice ≠ vínculos ativos'; }
    afirma(ok, rotulo + ': no banco, vínculo = depois do seu último evento, mesmo horário em evento e operação, índice = vínculos ativos', det);
  }
  const ord = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = ord(x[kk]); return o; }, {}) : x);

  /* E1. o conjunto versionado, pelo caso de uso sobre o adaptador Firebase */
  const conjV = R.carregar(R.ARQUIVO_VINCULOS).conj;
  const inicioV = Date.now() - 2000;
  let anteriorV = null;
  const rv = await R.executar({
    arquivo: R.ARQUIVO_VINCULOS, rotulo: 'Firebase Emulator (adaptador estruturas-firebase.js)',
    normalizarHorario: (gravado, doCenario) => {
      if (doCenario === undefined) return gravado;
      return typeof gravado === 'number' && gravado >= inicioV && gravado <= Date.now() + 2000 ? doCenario : 'NÃO É HORÁRIO DO SERVIDOR: ' + JSON.stringify(gravado);
    },
    criarPortas: async (referencias, estadoInicial) => {
      if (anteriorV) await integridadeVinculos(anteriorV);
      await semearVinculos(referencias, estadoInicial);
      anteriorV = 'cenário';
      const porPessoa = {};
      const portasDe = (u) => (porPessoa[u.id] = porPessoa[u.id] || FB.criarPortas({ db: sessao(u), codigosFirmes: FIRMES }));
      return Object.assign({}, portasDe(ARQ), { gravar: (op) => portasDe(op.usuario).gravar(op) });
    }
  });
  await integridadeVinculos('último cenário');
  total += rv.total; falhas += rv.falhas;

  /* base para as gravações diretas: o estado comum do conjunto (com as pessoas resolvidas) */
  const pessoas = { arq: ARQ, adm: ADM };
  const resolver = (v) => (Array.isArray(v) ? v.map(resolver) : v && typeof v === 'object' ? Object.keys(v).reduce((o, kk) => { o[kk] = ['criadaPor', 'por'].indexOf(kk) !== -1 && typeof v[kk] === 'string' ? pessoas[v[kk]] : resolver(v[kk]); return o; }, {}) : v);
  const comum = resolver(clone(conjV.estados.comum));
  await semearVinculos(conjV.referencias.padrao, comum);
  const chV = (multi, parte) => Object.keys(multi).filter((c) => c.indexOf(EV + '/' + parte + '/') === 0);
  const umV = (multi, parte) => chV(multi, parte)[0];

  /* E2. autorização e trava */
  console.log('\nE2. autorização e trava de produção');
  const w1 = await preparar(ARQ, 'vincularResponsavel', { objetoId: 'item-a', estruturaId: 'L-1' }, { novoId: 'W1' });
  const comoV = (u) => adulterar(w1.multi, (m) => { const p = { id: u.id, email: u.email }; m[umV(m, 'registros')].criadoPor = p; m[umV(m, 'eventos')].usuario = p; m[umV(m, 'eventos')].depois.criadoPor = p; m[umV(m, 'operacoes')].usuario = p; });
  await caso('perfil avaliacao (só consulta) NÃO grava vínculo', gravarComo(AVAL, comoV(AVAL)), false);
  await caso('pessoa sem perfil NÃO grava vínculo', gravarComo(OUTRA, comoV(OUTRA)), false);
  await semRegras((db) => db.ref('estruturas-concretas-config/gravacaoHabilitada').remove());
  await caso('trava desligada (marcador ausente, como no banco oficial): nem admin geral grava vínculo', gravarComo(ADM, comoV(ADM)), false);
  await semRegras((db) => db.ref('estruturas-concretas-config/gravacaoHabilitada').set(true));
  await caso('avaliacao-arquitetura grava (vínculo + índice + evento + operação)', gravarComo(ARQ, w1.multi), true);
  for (const sub of ['registros', 'ativo-por-objeto', 'eventos', 'operacoes']) {
    await caso('avaliacao (consulta) lê ' + sub, sessao(AVAL).ref(EV + '/' + sub).once('value'), true);
    await caso('pessoa sem perfil NÃO lê ' + sub, sessao(OUTRA).ref(EV + '/' + sub).once('value'), false);
  }

  /* E3. gravações diretas inválidas (cada uma a partir de uma gravação VÁLIDA montada pelo caso de uso) */
  console.log('\nE3. gravações diretas inválidas');
  const w2 = await preparar(ADM, 'vincularResponsavel', { objetoId: 'item-c', estruturaId: 'C-1' }, { novoId: 'W2' });
  const partes = (multi, manter) => Object.keys(multi).filter((c) => manter.some((p) => c.indexOf(EV + '/' + p + '/') === 0)).reduce((o, c) => { o[c] = multi[c]; return o; }, {});
  for (const [nome, manter] of [['só o vínculo', ['registros']], ['vínculo sem o índice', ['registros', 'eventos', 'operacoes']], ['vínculo sem evento', ['registros', 'ativo-por-objeto', 'operacoes']], ['vínculo sem operação', ['registros', 'ativo-por-objeto', 'eventos']]]) {
    await caso(nome + ' é recusado', gravarComo(ADM, partes(w2.multi, manter)), false);
  }
  const reg2 = (m) => m[umV(m, 'registros')], ev2 = (m) => m[umV(m, 'eventos')];
  const ambos = (m, f) => { f(reg2(m)); f(ev2(m).depois); };
  for (const [nome, f] of [
    ['código efetivo forjado (CoE vira Negócios)', (m) => ambos(m, (x) => { x.base.codigo = 'NEGOCIOS'; })],
    ['origem forjada (decisão vira recomendação)', (m) => ambos(m, (x) => { x.base.origem = 'recomendacao'; })],
    ['base em outra avaliação (não é a vigente)', (m) => ambos(m, (x) => { x.base.avaliacaoId = 'pa1'; })],
    ['estrutura de outro tipo (Linha para um CoE)', (m) => ambos(m, (x) => { x.estruturaId = 'L-2'; })],
    ['estrutura encerrada', (m) => ambos(m, (x) => { x.estruturaId = 'L-9'; })],
    ['papel diferente de responsável principal', (m) => ambos(m, (x) => { x.papel = 'outro'; })],
    ['horário do cliente', (m) => ambos(m, (x) => { x.criadoEm = 1; })],
    ['autoria de outra pessoa', (m) => ambos(m, (x) => { x.criadoPor = { id: ARQ.id, email: ARQ.email }; })],
    ['já nasce encerrado', (m) => ambos(m, (x) => { x.situacao = 'encerrada'; x.encerramento = { motivo: 'x', em: { '.sv': 'timestamp' }, por: { id: ADM.id, email: ADM.email } }; })],
    ['campo a mais', (m) => ambos(m, (x) => { x.extra = 'x'; })],
    ['evento com "antes"', (m) => { ev2(m).antes = { id: 'W2' }; }],
    ['evento de criação com motivo (sem substituição)', (m) => { ev2(m).motivo = 'x'; }],
    ['operação de outro item', (m) => { m[umV(m, 'operacoes')].objetoId = 'item-a'; }]
  ]) await caso(nome + ' é recusado', gravarComo(ADM, adulterar(w2.multi, f)), false);
  /* item sem posicionamento firme (A_VALIDAR sem decisão): forjar um código firme não passa */
  const w3 = adulterar(w2.multi, (m) => {
    ambos(m, (x) => { x.objetoId = 'item-b'; x.base = { avaliacaoId: 'pb1', codigo: 'COE', origem: 'recomendacao' }; });
    m[umV(m, 'operacoes')].objetoId = 'item-b';
    const ci = umV(m, 'ativo-por-objeto'); m[EV + '/ativo-por-objeto/item-b'] = m[ci]; delete m[ci];
  });
  await caso('item com recomendação A_VALIDAR e sem decisão: vínculo forjado é recusado', gravarComo(ADM, w3), false);
  /* segundo responsável ativo para item-a (W1 ativo): mesmo montando tudo, o índice já aponta para W1 */
  const w4 = adulterar(w1.multi, (m) => {
    const trocar = (o) => JSON.parse(JSON.stringify(o).split('W1').join('W4').split(w1.op.id).join('opx-dup'));
    Object.keys(m).forEach((c) => { const v = m[c]; delete m[c]; m[c.split('W1').join('W4').split(w1.op.id).join('opx-dup')] = trocar(v); });
  });
  await caso('segundo responsável principal ativo para o mesmo item é recusado (índice)', gravarComo(ARQ, w4), false);
  await caso('gravação válida (CoE pela decisão) entra', gravarComo(ADM, w2.multi), true);
  /* encerrar: só com motivo, sem mudar o que é imutável, sem reativar, sem apagar */
  const e1 = await preparar(ARQ, 'encerrarVinculo', { vinculoId: 'W1', motivo: 'Item descontinuado' });
  for (const [nome, f] of [
    ['encerrar sem motivo', (m) => ambos(m, (x) => { delete x.encerramento.motivo; })],
    ['encerrar trocando a estrutura', (m) => ambos(m, (x) => { x.estruturaId = 'L-2'; })],
    ['encerrar mantendo o índice no vínculo', (m) => { delete m[umV(m, 'ativo-por-objeto')]; }],
    ['encerrar pulando revisão', (m) => ambos(m, (x) => { x.revisao = 3; })]
  ]) await caso(nome + ' é recusado', gravarComo(ARQ, adulterar(e1.multi, f)), false);
  await caso('encerrar com motivo entra', gravarComo(ARQ, e1.multi), true);
  const reativarV = adulterar(e1.multi, (m) => {
    const ren = (c) => c.split(e1.op.id).join('opx-reat');
    Object.keys(m).forEach((c) => { const v = m[c]; delete m[c]; m[ren(c)] = JSON.parse(JSON.stringify(v).split(e1.op.id).join('opx-reat')); });
    ambos(m, (x) => { x.situacao = 'ativa'; x.revisao = 3; delete x.encerramento; });
    m[EV + '/ativo-por-objeto/item-a'] = 'W1';
  });
  await caso('reativar vínculo encerrado é recusado', gravarComo(ARQ, reativarV), false);
  for (const [nome, c, v] of [
    ['apagar vínculo', EV + '/registros/W2', null],
    ['apagar o índice de um vínculo ativo', EV + '/ativo-por-objeto/item-c', null],
    ['editar evento gravado', EV + '/eventos/' + w2.op.id + ':1/motivo', 'x'],
    ['apagar operação', EV + '/operacoes/' + w2.op.id, null],
    ['editar um campo do vínculo direto', EV + '/registros/W2/estruturaId', 'C-1']
  ]) await caso(nome + ' é recusado (até para admin geral)', sessao(ADM).ref(c).set(v), false);

  /* E4. concorrência direta: o mesmo item, duas pessoas, ao mesmo tempo */
  console.log('\nE4. concorrência');
  const x1 = await preparar(ARQ, 'vincularResponsavel', { objetoId: 'item-a', estruturaId: 'L-1' }, { novoId: 'X1' });
  const x2 = await preparar(ADM, 'vincularResponsavel', { objetoId: 'item-a', estruturaId: 'L-2' }, { novoId: 'X2' });
  const rx = await Promise.allSettled([gravarComo(ARQ, x1.multi), gravarComo(ADM, x2.multi)]);
  afirma(rx.filter((x) => x.status === 'fulfilled').length === 1, 'dois vínculos do mesmo item ao mesmo tempo: só um entra', JSON.stringify(rx.map((x) => x.status)));
  const perdeuV = rx[0].status === 'fulfilled' ? { prep: x2, quem: ADM } : { prep: x1, quem: ARQ };
  const confV = await FB.criarPortas({ db: sessao(perdeuV.quem), codigosFirmes: FIRMES }).gravar(perdeuV.prep.op).then((x) => x.situacao, (e) => e.codigo);
  afirma(confV === 'CONFLITO_DE_REVISAO', 'o adaptador devolve CONFLITO_DE_REVISAO a quem perdeu a corrida do vínculo', confV);
  await integridadeVinculos('depois das gravações diretas e da concorrência');

  await env.cleanup();
  console.log('\n============================\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e && e.stack || e); process.exit(1); });
