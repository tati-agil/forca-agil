/* ═════════════════════════════════════════════════════════════════
   Regras do banco — VERSÃO VIGENTE de cada item P1–P16 (índice avaliacoes-produto-ponta, alternativa B, 18/10/2026).

   Roda contra o EMULADOR real com o database.rules.json de produção. As gravações de avaliação são as do site
   (avaliacao-produto.js › salvarRegistro: a versão + o índice na mesma gravação) e as da E4 vêm do núcleo
   (relacoes-objetos-nucleo.js). Prova, pelo BANCO, independentemente da tela:
   A. Item novo: a primeira versão só nasce com o índice apontando para ela, na mesma gravação.
   B. Reavaliação: a nova versão só nasce a partir da PONTA atual e movendo o índice para ela, na mesma gravação;
      reavaliar a partir de versão antiga (bifurcar a cadeia) é recusado; duas reavaliações simultâneas da mesma
      ponta → só uma entra.
   C. Índice protegido: não volta, não pula, não aponta para registro de outro item nem inexistente, não se apaga;
      salvar de novo a mesma versão não muda nada; quem não grava avaliações não grava o índice.
   D. Histórico preservado: nenhuma versão se apaga (nem a antiga, nem a vigente); exclusão lógica (Lixeira) mantém o
      índice na versão excluída.
   E. E4: relação e natureza individual só com a versão VIGENTE — a antiga (superada) é recusada; reavaliação em
      andamento (a ponta é rascunho) bloqueia; versão excluída bloqueia; item antigo sem índice é recusado até a
      reconciliação (ou a próxima reavaliação, que cria o índice).
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
const ek = (e) => String(e).toLowerCase().replace(/[@.]/g, '_');
const ARQ = 'arquitetura@previ.com.br', AVAL = 'avaliacao@previ.com.br', SEM = 'sem.acesso@previ.com.br';
const PROD = 'avaliacoes-produto', PONTA = R.PONTA, TS = { '.sv': 'timestamp' };
const js = (v) => JSON.parse(JSON.stringify(v));
/* uma versão como o site grava (rascunho ou concluída, Motor atual quando concluída) */
const versao = (itemId, v, camada, extra) => Object.assign({ nome: 'Item ' + itemId, itemId, versao: v, status: 'concluido', excluido: false, motorVersion: MOTOR,
  resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', camadaSugerida: { id: camada } }, extra || {});
const rascunho = (itemId, v, anterior) => ({ nome: 'Item ' + itemId, itemId, versao: v, versaoAnteriorKey: anterior, status: 'rascunho' });
const salvar = (chave, reg, indice) => { const w = {}; w[PROD + '/' + chave] = reg; if (indice !== undefined) w[PONTA + '/' + reg.itemId] = indice; return w; };

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-versao-vigente', database: { rules } });
  const db = (e) => env.authenticatedContext(ek(e), { email: e }).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  const up = (e, w) => db(e).ref().update(js(w));
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'NEGADO: ' + String(e.message || e).slice(0, 200)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi ACEITO'); } }

  await env.clearDatabase();
  await semear(async (a) => {
    await a.ref('fa-avaliacao-autorizados/' + ek(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await a.ref('fa-avaliacao-autorizados/' + ek(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
    await a.ref(R.MARCADOR).set(true);
    await a.ref('taxonomia/arquitetural/conceitos/operacao').set({ nome: 'Operação', ordem: 1, ativo: true, naturezaDe: 'funcionalidade-operacao', definicao: { texto: 'Definição (teste)', versao: 1, publicadaEm: 'x', publicadaPor: 'x' } });
    /* item antigo, anterior ao índice (sem entrada em avaliacoes-produto-ponta) */
    await a.ref(PROD + '/legado').set(versao('legado', 1, 'componente'));
    await a.ref(PROD + '/pProd').set(versao('pProd', 1, 'componente', { decisaoFinal: 'produto', resultadoAutomatico: 'produto' }));
    await a.ref(PONTA + '/pProd').set('pProd');
  });

  /* ===== A. Item novo ===== */
  console.log('A. Item novo');
  await nega('primeira versão sem o índice é recusada', up(AVAL, salvar('it1', versao('it1', 1, 'componente'))));
  await nega('primeira versão com o índice apontando para outra chave é recusada', up(AVAL, salvar('it1', versao('it1', 1, 'componente'), 'outra')));
  await nega('sem perfil da Avaliação não grava', up(SEM, salvar('it1', versao('it1', 1, 'componente'), 'it1')));
  await pode('primeira versão + índice na mesma gravação (perfil Avaliação, como o site)', up(AVAL, salvar('it1', versao('it1', 1, 'componente'), 'it1')));
  anota('o índice aponta para a primeira versão', (await ler(PONTA + '/it1')) === 'it1');
  await nega('outra "primeira versão" do mesmo item, com o índice já existente, é recusada', up(AVAL, salvar('it1b', versao('it1', 1, 'canal'), 'it1b')));

  /* ===== B. Reavaliação ===== */
  console.log('B. Reavaliação');
  await nega('reavaliação sem mover o índice é recusada', up(ARQ, salvar('it1v2', rascunho('it1', 2, 'it1'))));
  await nega('reavaliação movendo o índice para outra chave é recusada', up(ARQ, salvar('it1v2', rascunho('it1', 2, 'it1'), 'it1')));
  await pode('reavaliação a partir da ponta, movendo o índice na mesma gravação (rascunho)', up(ARQ, salvar('it1v2', rascunho('it1', 2, 'it1'), 'it1v2')));
  anota('o índice aponta para a reavaliação em andamento (a ponta, mesmo rascunho)', (await ler(PONTA + '/it1')) === 'it1v2');
  await pode('salvar de novo o rascunho (o índice não muda)', up(ARQ, salvar('it1v2', Object.assign(rascunho('it1', 2, 'it1'), { nome: 'Item it1 (editado)' }), 'it1v2')));
  await pode('concluir a reavaliação (o índice não muda)', up(ARQ, salvar('it1v2', versao('it1', 2, 'funcionalidade-operacao', { versaoAnteriorKey: 'it1' }), 'it1v2')));
  await nega('reavaliar a partir da versão ANTIGA (bifurcar a cadeia) é recusado', up(ARQ, salvar('it1v3x', rascunho('it1', 3, 'it1'), 'it1v3x')));
  {
    const a = salvar('it1v3a', rascunho('it1', 3, 'it1v2'), 'it1v3a'), b = salvar('it1v3b', rascunho('it1', 3, 'it1v2'), 'it1v3b');
    const res = await Promise.allSettled([up(ARQ, a), up(AVAL, b)]);
    const ponta = await ler(PONTA + '/it1');
    anota('duas reavaliações simultâneas da mesma ponta: só uma entra, e o índice aponta para ela', res.filter((x) => x.status === 'fulfilled').length === 1 && (ponta === 'it1v3a' || ponta === 'it1v3b'), JSON.stringify(res.map((x) => x.status)) + ' ' + ponta);
    const perdedora = ponta === 'it1v3a' ? 'it1v3b' : 'it1v3a';
    anota('a reavaliação recusada não deixou registro (nada pela metade)', (await ler(PROD + '/' + perdedora)) === null);
  }

  /* ===== C. Índice protegido ===== */
  console.log('C. Índice protegido');
  const pontaIt1 = await ler(PONTA + '/it1');
  await nega('o índice não volta para uma versão antiga', db(ARQ).ref(PONTA + '/it1').set('it1'));
  await nega('o índice não volta para a versão anterior imediata', db(ARQ).ref(PONTA + '/it1').set('it1v2'));
  await nega('o índice não aponta para registro de outro item', db(ARQ).ref(PONTA + '/it1').set('pProd'));
  await nega('o índice não aponta para registro inexistente', db(ARQ).ref(PONTA + '/it1').set('nao-existe'));
  await nega('o índice não se apaga', db(ARQ).ref(PONTA + '/it1').remove());
  await nega('sem perfil não grava o índice', db(SEM).ref(PONTA + '/it1').set(pontaIt1));
  anota('o índice continua na ponta', (await ler(PONTA + '/it1')) === pontaIt1);

  /* ===== D. Histórico preservado ===== */
  console.log('D. Histórico preservado');
  await nega('a versão antiga não se apaga', db(ARQ).ref(PROD + '/it1').remove());
  await nega('a versão vigente não se apaga', db(ARQ).ref(PROD + '/' + pontaIt1).remove());
  await nega('a versão antiga não se apaga nem por gravação múltipla', up(ARQ, { [PROD + '/it1']: null }));
  anota('as versões antigas continuam intactas', (await ler(PROD + '/it1')).versao === 1 && (await ler(PROD + '/it1v2')).versao === 2);
  await pode('exclusão lógica da versão vigente (Lixeira): só o campo, o índice fica', db(ARQ).ref(PROD + '/pProd/excluido').set(true));
  anota('o índice continua na versão excluída (a ponta não muda por exclusão)', (await ler(PONTA + '/pProd')) === 'pProd');
  await pode('restaurar da Lixeira', db(ARQ).ref(PROD + '/pProd/excluido').set(false));

  /* ===== E. E4 só com a versão vigente ===== */
  console.log('E. E4 só com a versão vigente');
  /* it2: v1 (Componente) superada por v2 (Componente, vigente e concluída) */
  await up(AVAL, salvar('it2', versao('it2', 1, 'componente'), 'it2'));
  await up(AVAL, salvar('it2v2', versao('it2', 2, 'componente', { versaoAnteriorKey: 'it2' }), 'it2v2'));
  const gate = async (k) => ({ situacao: 'atual', libera: true, chave: k, avaliacao: await ler(PROD + '/' + k) });
  const relW = async (item, base, id) => {
    const r = R.criarRelacao({ registros: (await ler(R.RAIZ + '/registros')) || {} }, { origem: item, tipo: 'compoe', destino: 'pProd' },
      { origem: R.naturezaDoObjeto({ gate: await gate(base) }), destino: R.naturezaDoObjeto({ gate: await gate('pProd') }) },
      { relacaoId: id, operacaoId: 'op' + id, usuario: { id: ek(ARQ), email: ARQ }, agora: TS, versaoCompoe: (await ler(R.RAIZ + '/versao-compoe')) || 0 });
    if (!r.ok) throw new Error('núcleo recusou: ' + JSON.stringify(r.erros));
    return r.caminhos;
  };
  await nega('relação com a avaliação ANTIGA (superada) é recusada', up(ARQ, await relW('it2', 'it2', 'rAntiga')));
  await pode('relação com a avaliação VIGENTE é aceita', up(ARQ, await relW('it2', 'it2v2', 'rVigente')));
  /* reavaliação em andamento: a ponta é rascunho → nem a anterior concluída serve */
  await up(ARQ, salvar('it2v3', rascunho('it2', 3, 'it2v2'), 'it2v3'));
  await semear((a) => a.ref(R.RAIZ + '/registros/rVigente').remove()); /* libera o par para a tentativa seguinte */
  await semear((a) => a.ref(R.RAIZ + '/ativa-por-chave/' + R.chaveAtiva('it2', 'compoe', 'pProd')).remove());
  await nega('com reavaliação em andamento, a versão anterior (concluída) não serve de base', up(ARQ, await relW('it2', 'it2v2', 'rDuranteReav')));
  /* versão vigente excluída */
  await up(AVAL, salvar('it3', versao('it3', 1, 'componente'), 'it3'));
  await semear((a) => a.ref(PROD + '/it3/excluido').set(true));
  await nega('versão vigente excluída não serve de base', up(ARQ, await relW('it3', 'it3', 'rExcluida')));
  /* item antigo, sem índice */
  await nega('item antigo sem índice: a relação é recusada até a reconciliação', up(ARQ, await relW('legado', 'legado', 'rLegado')));
  await pode('a próxima reavaliação do item antigo cria o índice (transição)', up(ARQ, salvar('legadoV2', versao('legado', 2, 'componente', { versaoAnteriorKey: 'legado' }), 'legadoV2')));
  await pode('com o índice criado, a relação com a versão vigente é aceita', up(ARQ, await relW('legado', 'legadoV2', 'rLegadoV2')));
  /* natureza individual */
  await up(AVAL, salvar('it4', versao('it4', 1, 'funcionalidade-operacao'), 'it4'));
  await up(AVAL, salvar('it4v2', versao('it4', 2, 'funcionalidade-operacao', { versaoAnteriorKey: 'it4' }), 'it4v2'));
  const natW = async (base, aud) => R.registrarNatureza('it4', 'operacao', await gate(base), null, { ativo: true, naturezaDe: 'funcionalidade-operacao', temDefinicao: true }, { auditoriaId: aud, usuario: { id: ek(ARQ), email: ARQ }, agora: TS }, { versao: 1, pergunta: 'Pergunta de teste', alternativa: 'alt', rotulo: 'Alternativa de teste', justificativa: 'Justificativa de teste' }).caminhos;
  await nega('natureza individual com a avaliação ANTIGA é recusada', up(ARQ, await natW('it4', 'aAntiga')));
  await pode('natureza individual com a avaliação VIGENTE é aceita', up(ARQ, await natW('it4v2', 'aVigente')));
  /* a tela usa o índice: a natureza com a avaliação antiga nem é oferecida */
  anota('a tela (núcleo com o índice) também não aceita a versão antiga', R.naturezaDoObjeto({ gate: await gate('it2'), indice: await ler(PONTA + '/it2') }).motivo === 'VERSAO_VIGENTE_NAO_CONFIRMADA');

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
