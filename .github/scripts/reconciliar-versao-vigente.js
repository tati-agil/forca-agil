/* ═════════════════════════════════════════════════════════════════
   RECONCILIAÇÃO do índice da VERSÃO VIGENTE de cada item P1–P16 (avaliacoes-produto-ponta, alternativa B).

   Por que existe: as regras do banco passaram a exigir, na E4 (relações e naturezas individuais), que a base seja a
   versão vigente do item — a ponta da cadeia de reavaliações, registrada em avaliacoes-produto-ponta/<itemId>. Itens
   novos já nascem com o índice (avaliacao-produto.js grava versão + índice juntos). Os itens anteriores à regra não
   têm índice: até esta reconciliação, a E4 os recusa (falha fechada) — e nada mais muda para eles.

   O que faz (o mesmo código roda contra produção, com firebase-admin, e contra o emulador nos testes):
   1. DIAGNÓSTICO (sempre): lê avaliacoes-produto e o índice; para cada item (itemId, ou a própria chave na 1ª
      versão), a ponta = a versão que nenhuma outra aponta como versaoAnteriorKey. Classifica:
        ok          — índice já aponta para a ponta;
        criar       — sem índice e com UMA ponta → o índice a gravar;
        divergente  — índice aponta para outra versão (não é corrigido sozinho: listado para decisão);
        ambiguo     — nenhuma ou mais de uma ponta (cadeia quebrada ou bifurcada): listado, nunca escolhido;
        orfao       — índice de item sem versão, ou apontando para registro inexistente/de outro item.
   2. SIMULAÇÃO (padrão): mostra exatamente as gravações que faria. Nada é gravado.
   3. GRAVAÇÃO (só com RECONCILIAR_CONFIRMAR=sim): grava SÓ os índices "criar", numa gravação atômica; nunca toca em
      avaliações, nunca apaga nada, nunca corrige "divergente"/"ambiguo"/"orfao".
   4. VALIDAÇÃO (depois de gravar): relê e confirma que todo item "criar" ficou "ok" e que nada mais mudou.

   Disparo manual em produção: workflow "Avaliações — índice da versão vigente" (simulação por padrão).
   Teste: teste-reconciliar-versao-vigente.js (planejamento puro + aplicação no emulador, com as regras reais).
   ═════════════════════════════════════════════════════════════════ */
'use strict';

const PROD = 'avaliacoes-produto', PONTA = 'avaliacoes-produto-ponta';

/* Pura: dado o que está no banco, o diagnóstico e o plano. */
function planejar(produtos, indice) {
  produtos = produtos || {}; indice = indice || {};
  const porItem = {}, apontadas = {};
  Object.keys(produtos).forEach((k) => {
    const r = produtos[k]; if (!r || typeof r !== 'object') return;
    const item = r.itemId || k;
    (porItem[item] = porItem[item] || []).push(k);
    if (r.versaoAnteriorKey) apontadas[r.versaoAnteriorKey] = true;
  });
  const res = { ok: [], criar: [], divergente: [], ambiguo: [], orfao: [], totalItens: Object.keys(porItem).length };
  Object.keys(porItem).sort().forEach((item) => {
    const pontas = porItem[item].filter((k) => !apontadas[k]).sort();
    const atual = indice[item];
    if (pontas.length !== 1) { res.ambiguo.push({ item, pontas, versoes: porItem[item].length, indice: atual || null }); return; }
    const ponta = pontas[0];
    if (atual === undefined || atual === null) res.criar.push({ item, ponta });
    else if (atual === ponta) res.ok.push({ item, ponta });
    else res.divergente.push({ item, indice: atual, ponta, indiceExiste: !!produtos[atual] });
  });
  Object.keys(indice).forEach((item) => {
    const k = indice[item], r = produtos[k];
    if (!porItem[item]) res.orfao.push({ item, indice: k, motivo: 'item sem nenhuma versão' });
    else if (!r) res.orfao.push({ item, indice: k, motivo: 'aponta para registro inexistente' });
    else if ((r.itemId || k) !== item) res.orfao.push({ item, indice: k, motivo: 'aponta para registro de outro item' });
  });
  return res;
}
function gravacoes(plano) { const c = {}; plano.criar.forEach((x) => { c[PONTA + '/' + x.item] = x.ponta; }); return c; }

async function ler(db, caminho) { return (await db.ref(caminho).once('value')).val(); }

/* Lê, planeja, (se confirmar) grava só os "criar" numa gravação, e valida relendo. */
async function aplicar(db, opcoes) {
  opcoes = opcoes || {};
  const [produtos, indice] = await Promise.all([ler(db, PROD), ler(db, PONTA)]);
  const plano = planejar(produtos, indice), c = gravacoes(plano);
  if (!opcoes.confirmar || !Object.keys(c).length) return { plano, gravou: false, gravacoes: c };
  await db.ref().update(c);
  const depois = planejar(await ler(db, PROD), await ler(db, PONTA));
  const faltou = plano.criar.filter((x) => !depois.ok.some((y) => y.item === x.item && y.ponta === x.ponta));
  return { plano, gravou: true, gravacoes: c, validacao: { ok: !faltou.length && depois.criar.length === 0, faltou, depois } };
}
function relatorio(plano) {
  const l = [];
  l.push('Itens: ' + plano.totalItens + ' · ok: ' + plano.ok.length + ' · a criar: ' + plano.criar.length + ' · divergentes: ' + plano.divergente.length + ' · ambíguos: ' + plano.ambiguo.length + ' · órfãos: ' + plano.orfao.length);
  plano.criar.forEach((x) => l.push('  + ' + PONTA + '/' + x.item + ' = ' + x.ponta));
  plano.divergente.forEach((x) => l.push('  ! divergente: ' + x.item + ' — índice ' + x.indice + (x.indiceExiste ? '' : ' (inexistente)') + ', ponta calculada ' + x.ponta + ' (não corrigido sozinho)'));
  plano.ambiguo.forEach((x) => l.push('  ? ambíguo: ' + x.item + ' — ' + (x.pontas.length ? x.pontas.length + ' pontas: ' + x.pontas.join(', ') : 'nenhuma ponta (cadeia circular)') + ' (não escolhido)'));
  plano.orfao.forEach((x) => l.push('  ? órfão: ' + x.item + ' → ' + x.indice + ' (' + x.motivo + ')'));
  return l.join('\n');
}

module.exports = { planejar, gravacoes, aplicar, relatorio, PROD, PONTA };

if (require.main === module) {
  (async () => {
    const admin = require('firebase-admin');
    const confirmar = process.env.RECONCILIAR_CONFIRMAR === 'sim';
    admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL: process.env.FA_DATABASE_URL || 'https://kyber-agil-default-rtdb.firebaseio.com' });
    const r = await aplicar(admin.database(), { confirmar });
    console.log('Modo: ' + (confirmar ? 'GRAVAÇÃO' : 'diagnóstico e simulação (nada é gravado)'));
    console.log(relatorio(r.plano));
    if (r.gravou) console.log('Gravado: ' + Object.keys(r.gravacoes).length + ' índice(s), numa gravação só. Validação: ' + (r.validacao.ok ? 'OK — todos os índices criados conferem.' : 'FALHOU — ' + JSON.stringify(r.validacao.faltou)));
    else console.log(confirmar ? 'Nada a gravar.' : 'Simulação concluída. Para gravar, dispare de novo com "Confirmar gravação" marcado.');
    process.exit(r.gravou && !r.validacao.ok ? 1 : 0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
