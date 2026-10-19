/* ═════════════════════════════════════════════════════════════════
   Reconciliação do índice da versão vigente (reconciliar-versao-vigente.js) — prova antes de qualquer uso real.

   1. Planejamento PURO (sem banco): cadeias simples, reavaliação em andamento, excluída, bifurcada, circular,
      índice já certo, divergente, órfão — cada uma na classe certa; só "criar" vira gravação.
   2. Aplicação no EMULADOR com as regras reais: simulação não grava nada; gravação grava só os "criar", numa
      gravação, sem tocar em avaliações; a validação relê e confirma; rodar de novo é inofensivo (idempotente);
      depois dela, o item antigo passa a aceitar a E4 pela versão vigente e continua recusando a antiga.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const REC = require('./reconciliar-versao-vigente.js');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const itens = (lista) => lista.map((x) => x.item).sort().join(',');

/* ===== 1. Planejamento puro ===== */
console.log('1. Planejamento (puro)');
const P = {
  simples: { itemId: 'simples', status: 'concluido' },
  semItemId: { status: 'concluido' },                                        /* 1ª versão antiga, sem itemId */
  cad1: { itemId: 'cad', status: 'concluido' }, cad2: { itemId: 'cad', versaoAnteriorKey: 'cad1', status: 'concluido' },
  and1: { itemId: 'and', status: 'concluido' }, and2: { itemId: 'and', versaoAnteriorKey: 'and1', status: 'rascunho' },
  exc1: { itemId: 'exc', status: 'concluido' }, exc2: { itemId: 'exc', versaoAnteriorKey: 'exc1', status: 'concluido', excluido: true },
  bif1: { itemId: 'bif', status: 'concluido' }, bifA: { itemId: 'bif', versaoAnteriorKey: 'bif1' }, bifB: { itemId: 'bif', versaoAnteriorKey: 'bif1' },
  cirA: { itemId: 'cir', versaoAnteriorKey: 'cirB' }, cirB: { itemId: 'cir', versaoAnteriorKey: 'cirA' },
  ok1: { itemId: 'okk', status: 'concluido' },
  div1: { itemId: 'div', status: 'concluido' }, div2: { itemId: 'div', versaoAnteriorKey: 'div1' },
};
const I = { okk: 'ok1', div: 'div1', fantasma: 'xx', apontaRuim: 'nada', outro: 'cad2' };
const PL = REC.planejar(P, I);
anota('a criar: simples, sem itemId, cadeia, em andamento (ponta = rascunho) e excluída (ponta = excluída)', itens(PL.criar) === 'and,cad,exc,semItemId,simples', itens(PL.criar));
anota('cadeia → índice na ponta (cad2)', PL.criar.some((x) => x.item === 'cad' && x.ponta === 'cad2'));
anota('em andamento → índice no rascunho (a ponta), não na concluída anterior', PL.criar.some((x) => x.item === 'and' && x.ponta === 'and2'));
anota('excluída → índice na excluída (a ponta), não na anterior', PL.criar.some((x) => x.item === 'exc' && x.ponta === 'exc2'));
anota('já certo → ok', itens(PL.ok) === 'okk');
anota('divergente → listado, não corrigido', itens(PL.divergente) === 'div' && PL.divergente[0].ponta === 'div2');
anota('bifurcada e circular → ambíguos, nenhuma ponta escolhida', itens(PL.ambiguo) === 'bif,cir' && !PL.criar.some((x) => x.item === 'bif' || x.item === 'cir'));
anota('órfãos: item sem versão, aponta para inexistente, aponta para outro item', itens(PL.orfao) === 'apontaRuim,fantasma,outro', itens(PL.orfao));
const G = REC.gravacoes(PL);
anota('gravações = só os índices a criar, nada em avaliacoes-produto', Object.keys(G).length === 5 && Object.keys(G).every((k) => k.indexOf(REC.PONTA + '/') === 0));
anota('banco vazio → nada a fazer', REC.planejar(null, null).criar.length === 0 && REC.planejar(null, null).totalItens === 0);
anota('relatório resume as classes', /a criar: 5/.test(REC.relatorio(PL)) && /ambíguo: bif/.test(REC.relatorio(PL)));

async function emulador() {
  const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
  const R = require(path.join(RAIZ, 'forca-agil', 'relacoes-objetos-nucleo.js'));
  const MOTOR = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-reconciliar', database: { rules } });
  const ek = (e) => String(e).toLowerCase().replace(/[@.]/g, '_');
  const ARQ = 'arquitetura@previ.com.br';
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  const versao = (itemId, v, camada, extra) => Object.assign({ nome: 'Item ' + itemId, itemId, versao: v, status: 'concluido', excluido: false, motorVersion: MOTOR,
    resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', camadaSugerida: { id: camada } }, extra || {});

  console.log('2. Aplicação no emulador (regras reais)');
  await env.clearDatabase();
  await semear(async (a) => {
    await a.ref('fa-avaliacao-autorizados/' + ek(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await a.ref(R.MARCADOR).set(true);
    await a.ref('taxonomia/arquitetural/conceitos/operacao').set({ nome: 'Operação', ordem: 1, ativo: true, naturezaDe: 'funcionalidade-operacao', definicao: { texto: 'Definição (teste)', versao: 1, publicadaEm: 'x', publicadaPor: 'x' } });
    /* dados anteriores ao índice: duas versões do mesmo item, mais um item de uma versão só, e um bifurcado */
    await a.ref(REC.PROD).set({
      ant1: versao('ant', 1, 'funcionalidade-operacao'),
      ant2: versao('ant', 2, 'funcionalidade-operacao', { versaoAnteriorKey: 'ant1' }),
      uni: versao('uni', 1, 'componente'),
      b1: versao('b', 1, 'componente'), bA: versao('b', 2, 'componente', { versaoAnteriorKey: 'b1' }), bB: versao('b', 2, 'componente', { versaoAnteriorKey: 'b1' }),
    });
  });
  const antes = await ler(REC.PROD);
  /* E4 antes da reconciliação: recusada (falha fechada) */
  const db = env.authenticatedContext(ek(ARQ), { email: ARQ }).database();
  let nAud = 0;
  const natureza = async (base) => JSON.parse(JSON.stringify(R.registrarNatureza('ant', 'operacao', { situacao: 'atual', libera: true, chave: base, avaliacao: await ler(REC.PROD + '/' + base) }, null,
    { ativo: true, naturezaDe: 'funcionalidade-operacao', temDefinicao: true }, { auditoriaId: 'aud' + (++nAud), usuario: { id: ek(ARQ), email: ARQ }, agora: { '.sv': 'timestamp' } }).caminhos));
  async function aceita(rotulo, p) { try { await assertSucceeds(p); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'NEGADO: ' + String(e.message || e).slice(0, 160)); } }
  async function recusa(rotulo, p) { try { await assertFails(p); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi ACEITO'); } }
  const sondaNat = async (base) => { try { await db.ref().update(await natureza(base)); return true; } catch (e) { return false; } };
  anota('antes: E4 recusa o item antigo sem índice (mesmo pela versão vigente)', !(await sondaNat('ant2')));

  let r;
  const interrompe = async (opcoes) => { let erro = null; await semear(async (a) => { try { await REC.aplicar(a, opcoes); } catch (e) { erro = e; } }); return erro; };
  await semear(async (a) => { r = await REC.aplicar(a, { confirmar: false }); });
  anota('simulação: planeja 2 índices (ant → ant2, uni → uni) e 1 ambíguo (b)', itens(r.plano.criar) === 'ant,uni' && itens(r.plano.ambiguo) === 'b');
  anota('simulação: não grava nada e imprime a assinatura do plano', !r.gravou && (await ler(REC.PONTA)) === null && /^[0-9a-f]{64}$/.test(r.assinatura));
  const assComAmbiguo = r.assinatura;

  /* travas: com ambíguo presente, nada é gravado — nem os inequívocos */
  let e1 = await interrompe({ confirmar: true, assinatura: assComAmbiguo });
  anota('trava: com ambíguo, interrompe ANTES de qualquer gravação', !!e1 && /INTERROMPIDO ANTES/.test(e1.message) && /1 ambíguo/.test(e1.message) && (await ler(REC.PONTA)) === null, e1 && e1.message);
  /* resolve o ambíguo (no teste: a bifurcação some) */
  await semear((a) => a.ref(REC.PROD + '/bB').remove());
  const antes2 = await ler(REC.PROD);
  await semear(async (a) => { r = await REC.aplicar(a, { confirmar: false }); });
  const ass = r.assinatura;
  anota('nova simulação: 3 a criar (ant, b, uni), zero divergentes/ambíguos/órfãos', itens(r.plano.criar) === 'ant,b,uni' && !r.plano.ambiguo.length && !r.plano.divergente.length && !r.plano.orfao.length);
  let e2 = await interrompe({ confirmar: true });
  anota('trava: sem assinatura, interrompe sem gravar', !!e2 && /assinatura do plano validado não informada/.test(e2.message) && (await ler(REC.PONTA)) === null);
  let e3 = await interrompe({ confirmar: true, assinatura: assComAmbiguo });
  anota('trava: assinatura de outro conjunto (os dados mudaram desde a validação), interrompe sem gravar', !!e3 && /mudou desde a validação/.test(e3.message) && (await ler(REC.PONTA)) === null);
  anota('a assinatura é determinística (mesma entrada, mesma assinatura)', REC.assinatura(r.plano) === ass && REC.assinatura({ criar: r.plano.criar.slice().reverse() }) === ass);

  await semear(async (a) => { r = await REC.aplicar(a, { confirmar: true, assinatura: ass }); });
  anota('gravação: grava os 3 índices, todos conferidos na releitura', r.gravou && r.validacao.ok && r.validacao.gravados === 3 && r.validacao.conferidos === 3 && !r.validacao.jaExistiam.length, JSON.stringify(r.validacao));
  const ponta = await ler(REC.PONTA);
  anota('índice: ant → ant2 (ponta), uni → uni, b → bA', ponta && ponta.ant === 'ant2' && ponta.uni === 'uni' && ponta.b === 'bA' && Object.keys(ponta).length === 3, JSON.stringify(ponta));
  anota('nenhuma avaliação foi tocada (hash idêntico antes e depois)', r.validacao.avaliacoesIntactas && JSON.stringify(await ler(REC.PROD)) === JSON.stringify(antes2));
  anota('depois: tudo ok, nada a criar', r.validacao.depois.ok.length === 3 && r.validacao.depois.criar.length === 0);

  let e4 = await interrompe({ confirmar: true, assinatura: ass });
  anota('rodar de novo: nada a criar → interrompe sem gravar (idempotente)', !!e4 && /nada a criar/.test(e4.message) && JSON.stringify(await ler(REC.PONTA)) === JSON.stringify(ponta));

  await recusa('depois: E4 continua recusando a versão antiga (ant1)', natureza('ant1').then((w) => db.ref().update(w)));
  anota('depois: E4 aceita o item pela versão vigente (ant2)', await sondaNat('ant2'));
  await aceita('depois: a próxima reavaliação segue pelo índice (ant3 a partir de ant2)', db.ref().update(JSON.parse(JSON.stringify({
    [REC.PROD + '/ant3']: { nome: 'Item ant', itemId: 'ant', versao: 3, versaoAnteriorKey: 'ant2', status: 'rascunho' }, [REC.PONTA + '/ant']: 'ant3' }))));
  /* corrida: entre a validação e a escrita, uma reavaliação do site cria o índice de um item → ele não é sobrescrito */
  await semear(async (a) => { await a.ref(REC.PROD + '/novo1').set(versao('novo1', 1, 'componente')); await a.ref(REC.PROD + '/novo2').set(versao('novo2', 1, 'componente')); });
  await semear(async (a) => { r = await REC.aplicar(a, { confirmar: false }); });
  const assCorrida = r.assinatura;
  await semear(async (a) => {
    const intercepta = { ref: (p) => { const ref = a.ref(p); if (p !== REC.PONTA + '/novo1') return ref;
      return { transaction: async (fn) => { await a.ref(REC.PROD + '/novo1v2').set(versao('novo1', 2, 'componente', { versaoAnteriorKey: 'novo1' })); await a.ref(p).set('novo1v2'); return ref.transaction(fn); } }; } };
    r = await REC.aplicar(intercepta, { confirmar: true, assinatura: assCorrida });
  });
  anota('corrida: o índice criado pelo site no meio tempo NÃO é sobrescrito; o item é relatado', (await ler(REC.PONTA + '/novo1')) === 'novo1v2' && r.validacao.jaExistiam.length === 1 && r.validacao.jaExistiam[0].item === 'novo1' && !r.validacao.ok);
  anota('corrida: o outro item é gravado normalmente', (await ler(REC.PONTA + '/novo2')) === 'novo2' && r.validacao.gravados === 1);
  await env.cleanup();
}

(async () => {
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) await emulador();
  else console.log('(sem emulador: só o planejamento puro — no CI de regras roda também a aplicação)');
  console.log('\n' + (falhas ? 'FALHAS: ' + falhas + ' de ' + total : 'TUDO OK — ' + total + ' verificações'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
