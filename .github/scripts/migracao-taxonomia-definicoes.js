/* MIGRAÇÃO da Taxonomia para o modelo simplificado da definição (dois domínios: arquitetural e organizacional).
 *
 * Modelo antigo: taxonomia/<dom>/fontes/<c>/<id> (vários textos-fonte, com situação, rótulo, tipo de redação,
 * arquivamento) + conceitos/<c>/definicaoVigenteFonteId (o ponteiro) + conceitos/<c>/situacaoDefinicao.
 * Modelo novo: conceitos/<c>/definicao = { texto, versao, publicadaEm, publicadaPor } + definicoes/<c>/v<n> (histórico).
 *
 * Regras da migração (todas verificadas ANTES de gravar; qualquer inconsistência recusa a migração inteira):
 *   - a definição vigente de cada conceito é EXATAMENTE a fonte apontada pelo ponteiro, que precisa existir, estar
 *     "vigente", não arquivada e ser a ÚNICA vigente do conceito; vira a versão 1 (origem 'migracao', com a referência
 *     ao texto-fonte de origem em `legado`);
 *   - fontes que nunca foram a vigente (em validação, históricas, placeholder, arquivadas) NÃO viram versões: vão
 *     inteiras para taxonomia-arquivo-migracao/<dom>/fontes, junto com os ponteiros antigos (ponteiros/<c>);
 *   - conceito sem ponteiro fica sem definição (o texto que ele tinha fica no arquivo);
 *   - conceito que já tem `definicao` não é tocado (idempotente);
 *   - tudo numa gravação só (multipath): arquivo + definições + histórico + remoção do modelo antigo + marca + auditoria.
 * A auditoria antiga (inclusive as trocas 'definicao_vigente') fica onde está: é só acréscimo e continua no histórico.
 *
 * Uso (conta de serviço; ver .github/workflows/taxonomia-migracao-definicoes.yml):
 *   MODO=exportar  → grava o backup completo (taxonomia + arquivo) em taxonomia-backup-<data>.json
 *   MODO=simular   → mostra o plano e as inconsistências; não grava nada (padrão)
 *   MODO=executar  CONFIRMAR=sim → exporta o backup e migra
 *   MODO=verificar → confere o resultado contra o arquivo
 *   MODO=reverter  CONFIRMAR=sim → volta ao modelo antigo a partir do arquivo (recusado se já houver versão 2+)
 * As funções são puras e exportadas para o teste no emulador (teste-migracao-taxonomia-definicoes.js). */
'use strict';
const DOMS = ['arquitetural', 'organizacional'];
const ARQ = 'taxonomia-arquivo-migracao';
const chaves = (o) => (o && typeof o === 'object' ? Object.keys(o) : []);

function planejar(tax) {
  tax = tax || {};
  const plano = { dominios: {}, erros: [], resumo: { migrar: 0, semDefinicao: 0, jaMigrado: 0, fontesArquivadas: 0, naoVigentes: 0 } };
  DOMS.forEach((d) => {
    const D = tax[d] || {}, conceitos = D.conceitos || {}, fontes = D.fontes || {}, itens = [];
    chaves(conceitos).forEach((c) => {
      const k = conceitos[c] || {}, fs = fontes[c] || {}, ids = chaves(fs);
      const vig = ids.filter((id) => fs[id] && fs[id].situacao === 'vigente');
      const ptr = k.definicaoVigenteFonteId || null;
      const item = { codigo: c, fontes: ids.length, naoVigentes: ids.filter((id) => id !== ptr).length };
      if (k.definicao) { item.acao = 'ja-migrado'; plano.resumo.jaMigrado++; }
      else if (vig.length > 1) { item.acao = 'erro'; plano.erros.push(d + ' › ' + c + ': mais de uma fonte vigente (' + vig.join(', ') + ').'); }
      else if (ptr && (!fs[ptr] || fs[ptr].situacao !== 'vigente' || fs[ptr].arquivada)) { item.acao = 'erro'; plano.erros.push(d + ' › ' + c + ': o ponteiro aponta para uma fonte inexistente, não vigente ou arquivada (' + ptr + ').'); }
      else if (!ptr && vig.length) { item.acao = 'erro'; plano.erros.push(d + ' › ' + c + ': há fonte vigente sem o ponteiro (' + vig[0] + ').'); }
      else if (ptr && (typeof fs[ptr].texto !== 'string' || !fs[ptr].texto.trim())) { item.acao = 'erro'; plano.erros.push(d + ' › ' + c + ': a fonte vigente não tem texto.'); }
      else if (ptr) { item.acao = 'migrar'; item.fonteId = ptr; item.texto = fs[ptr].texto; plano.resumo.migrar++; }
      else { item.acao = 'sem-definicao'; plano.resumo.semDefinicao++; }
      plano.resumo.fontesArquivadas += ids.length; plano.resumo.naoVigentes += item.naoVigentes;
      itens.push(item);
    });
    chaves(fontes).forEach((c) => { if (!conceitos[c]) plano.erros.push(d + ' › ' + c + ': há fontes para um conceito que não existe.'); });
    plano.dominios[d] = itens;
  });
  return plano;
}

/* ctx: { agora (ISO), por (e-mail da conta que executa), audKey(dom) } */
function payloadExecucao(tax, plano, ctx) {
  if (plano.erros.length) throw new Error('migração recusada: ' + plano.erros.length + ' inconsistência(s)');
  const p = {};
  DOMS.forEach((d) => {
    const D = tax[d] || {}, conceitos = D.conceitos || {}, fontes = D.fontes || {};
    if (chaves(fontes).length) p[ARQ + '/' + d + '/fontes'] = fontes;
    plano.dominios[d].forEach((it) => {
      const k = conceitos[it.codigo] || {}, base = 'taxonomia/' + d;
      if (it.acao === 'ja-migrado') return;
      if (k.definicaoVigenteFonteId !== undefined || k.situacaoDefinicao !== undefined) {
        p[ARQ + '/' + d + '/ponteiros/' + it.codigo] = { definicaoVigenteFonteId: k.definicaoVigenteFonteId || null, situacaoDefinicao: k.situacaoDefinicao || null };
        p[base + '/conceitos/' + it.codigo + '/definicaoVigenteFonteId'] = null;
        p[base + '/conceitos/' + it.codigo + '/situacaoDefinicao'] = null;
      }
      if (it.acao !== 'migrar') return;
      const f = fontes[it.codigo][it.fonteId];
      const em = f.criadoEm || ctx.agora, por = f.criadoPor || ctx.por;
      p[base + '/conceitos/' + it.codigo + '/definicao'] = { texto: f.texto, versao: 1, publicadaEm: em, publicadaPor: por };
      const legado = { fonteId: it.fonteId };
      ['contexto', 'tipoRedacao', 'rotulo', 'criadoEm', 'criadoPor'].forEach((x) => { if (f[x] !== undefined) legado[x] = f[x]; });
      p[base + '/definicoes/' + it.codigo + '/v1'] = { texto: f.texto, versao: 1, publicadaEm: em, publicadaPor: por, origem: 'migracao', legado };
    });
    if (chaves(fontes).length) p['taxonomia/' + d + '/fontes'] = null;
    const r = plano.dominios[d].reduce((a, it) => { a[it.acao] = (a[it.acao] || 0) + 1; return a; }, {});
    p['taxonomia/' + d + '/auditoria/_catalogo/' + ctx.audKey(d)] = { tipo: 'migracao_definicoes', usuario: { email: ctx.por }, dataHora: ctx.agora,
      valorNovo: 'Migração para a definição única versionada — ' + (r.migrar || 0) + ' com definição vigente (versão 1), ' + (r['sem-definicao'] || 0) + ' sem definição; textos-fonte arquivados em ' + ARQ + '.' };
  });
  p['taxonomia/meta/migracaoDefinicoes'] = { feitaEm: ctx.agora, feitaPor: ctx.por, resumo: plano.resumo };
  return p;
}

/* confere o estado DEPOIS da migração contra o arquivo: lista de problemas (vazia = ok) */
function verificar(tax, arquivo) {
  const prob = [];
  if (!tax || !tax.meta || !tax.meta.migracaoDefinicoes) prob.push('marca da migração ausente');
  DOMS.forEach((d) => {
    const D = (tax || {})[d] || {}, A = (arquivo || {})[d] || {};
    if (D.fontes) prob.push(d + ': o nó antigo de fontes ainda existe');
    chaves(D.conceitos).forEach((c) => { const k = D.conceitos[c]; if (k.definicaoVigenteFonteId !== undefined || k.situacaoDefinicao !== undefined) prob.push(d + ' › ' + c + ': campos do modelo antigo ainda no conceito'); });
    chaves(A.ponteiros).forEach((c) => {
      const ptr = A.ponteiros[c].definicaoVigenteFonteId, k = (D.conceitos || {})[c] || {};
      if (!ptr) return;
      const f = ((A.fontes || {})[c] || {})[ptr];
      if (!f) { prob.push(d + ' › ' + c + ': a fonte vigente não está no arquivo'); return; }
      if (!k.definicao || k.definicao.texto !== f.texto) prob.push(d + ' › ' + c + ': a definição não corresponde ao texto vigente arquivado');
      const v1 = ((D.definicoes || {})[c] || {}).v1;
      if (!v1 || v1.texto !== f.texto || v1.origem !== 'migracao') prob.push(d + ' › ' + c + ': a versão 1 do histórico não corresponde');
    });
  });
  return prob;
}

/* volta ao modelo antigo a partir do arquivo. Recusa se alguém já publicou versão 2+ (perderia a publicação) */
function payloadReversao(tax, arquivo, ctx) {
  const p = {}, recusas = [];
  DOMS.forEach((d) => {
    const D = (tax || {})[d] || {}, A = (arquivo || {})[d] || {};
    chaves(D.definicoes).forEach((c) => { chaves(D.definicoes[c]).forEach((v) => { if (D.definicoes[c][v].origem !== 'migracao') recusas.push(d + ' › ' + c + ': ' + v + ' publicada depois da migração'); }); });
  });
  if (recusas.length) return { ok: false, recusas };
  DOMS.forEach((d) => {
    const D = (tax || {})[d] || {}, A = (arquivo || {})[d] || {};
    if (A.fontes) p['taxonomia/' + d + '/fontes'] = A.fontes;
    chaves(A.ponteiros).forEach((c) => {
      if (!(D.conceitos || {})[c]) return;
      p['taxonomia/' + d + '/conceitos/' + c + '/definicaoVigenteFonteId'] = A.ponteiros[c].definicaoVigenteFonteId;
      p['taxonomia/' + d + '/conceitos/' + c + '/situacaoDefinicao'] = A.ponteiros[c].situacaoDefinicao;
    });
    chaves(D.conceitos).forEach((c) => { if (D.conceitos[c].definicao) p['taxonomia/' + d + '/conceitos/' + c + '/definicao'] = null; });
    if (D.definicoes) p['taxonomia/' + d + '/definicoes'] = null;
    p['taxonomia/' + d + '/auditoria/_catalogo/' + ctx.audKey(d)] = { tipo: 'migracao_revertida', usuario: { email: ctx.por }, dataHora: ctx.agora, valorNovo: 'Migração da definição revertida a partir de ' + ARQ + '.' };
  });
  p['taxonomia/meta/migracaoDefinicoes'] = null;
  return { ok: true, caminhos: p };
}

module.exports = { DOMS, ARQ, planejar, payloadExecucao, verificar, payloadReversao };

if (require.main === module) {
  const admin = require('firebase-admin');
  const fs = require('fs');
  const MODO = process.env.MODO || 'simular', CONFIRMAR = process.env.CONFIRMAR === 'sim';
  admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL: process.env.FA_DATABASE_URL || 'https://kyber-agil-default-rtdb.firebaseio.com' });
  const db = admin.database();
  const ler = async (p) => (await db.ref(p).once('value')).val();
  const ctx = { agora: new Date().toISOString(), por: 'migracao@conta-de-servico', audKey: () => db.ref('taxonomia').push().key };
  (async () => {
    const tax = await ler('taxonomia'), arq = await ler(ARQ);
    const exportar = () => { const nome = 'taxonomia-backup-' + ctx.agora.replace(/[:.]/g, '-') + '.json'; fs.writeFileSync(nome, JSON.stringify({ taxonomia: tax, [ARQ]: arq }, null, 2)); console.log('backup: ' + nome); };
    if (MODO === 'exportar') { exportar(); process.exit(0); }
    if (MODO === 'verificar') { const prob = verificar(tax, arq); console.log(prob.length ? 'PROBLEMAS:\n- ' + prob.join('\n- ') : 'verificação OK'); process.exit(prob.length ? 1 : 0); }
    if (MODO === 'reverter') {
      const r = payloadReversao(tax, arq, ctx);
      if (!r.ok) { console.log('REVERSÃO RECUSADA:\n- ' + r.recusas.join('\n- ')); process.exit(1); }
      console.log('reversão: ' + Object.keys(r.caminhos).length + ' caminhos');
      if (!CONFIRMAR) { console.log('(simulação: nada gravado)'); process.exit(0); }
      exportar(); await db.ref().update(r.caminhos); console.log('revertido'); process.exit(0);
    }
    const plano = planejar(tax);
    DOMS.forEach((d) => { console.log('== ' + d); plano.dominios[d].forEach((it) => console.log('  ' + it.codigo + ': ' + it.acao + (it.fonteId ? ' (fonte ' + it.fonteId + ')' : '') + ' · ' + it.fontes + ' fonte(s), ' + it.naoVigentes + ' nunca vigente(s)')); });
    console.log('resumo: ' + JSON.stringify(plano.resumo));
    if (plano.erros.length) { console.log('INCONSISTÊNCIAS (nada será gravado):\n- ' + plano.erros.join('\n- ')); process.exit(1); }
    if (MODO !== 'executar' || !CONFIRMAR) { console.log('(simulação: nada gravado)'); process.exit(0); }
    if (tax && tax.meta && tax.meta.migracaoDefinicoes) { console.log('a migração já foi feita: nada a fazer'); process.exit(0); }
    exportar();
    await db.ref().update(payloadExecucao(tax, plano, ctx));
    const prob = verificar(await ler('taxonomia'), await ler(ARQ));
    console.log(prob.length ? 'MIGRADO, MAS A VERIFICAÇÃO ACUSOU:\n- ' + prob.join('\n- ') : 'migrado e verificado');
    process.exit(prob.length ? 1 : 0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
