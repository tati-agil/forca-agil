/* ══════════════════════════════════════════════════════════════════
   Regras do banco: AVALIAR × CURAR/DECIDIR, e Adequação à Squad na área
   AVALIAÇÃO.

   Roda contra o EMULADOR real do Realtime Database (firebase
   emulators:exec, ver teste-rules.yml) com o database.rules.json de
   produção — a tela só esconde botões; quem barra de verdade é isto.

   Decisão da dona (pacote ADMIN > Arquitetura):
     - "Avaliação" avalia (cria, conclui, reavalia, reprocessa) mas NÃO cura
       nem decide: em avaliacoes-produto não muda nenhum campo de curadoria
       (especialização, papel estrutural, natureza complementar) nem de
       decisão final (decisaoManual, decisaoConfirmada, justificativa,
       alteradoPor/Em). Numa versão nova (reavaliação) só HERDA os da
       versão anterior; numa avaliação nova, nascem vazios.
     - "Avaliação + Arquitetura" e o admin geral curam e decidem.
     - em curadoria-auditoria, "Avaliação" só grava a linha da reavaliação e
       a do reprocessamento automático — nunca uma de curadoria/decisão.
     - A avaliação de Squad mora na área AVALIAÇÃO: "Avaliação" lê e grava
       avaliacoes-squad e lê o motor de squad (para concluir); a
       configuração do motor continua só da Arquitetura.
   ══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

let total = 0, falhas = 0;
function anota(linha, ok, detalhe) {
  total++;
  if (ok) { console.log('  ok    ' + linha); return; }
  falhas++;
  console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : ''));
}
async function pode(linha, promessa) {
  try { await assertSucceeds(promessa); anota(linha, true); } catch (e) { anota(linha, false, e.message); }
}
async function naoPode(linha, promessa) {
  try { await assertFails(promessa); anota(linha, true); } catch (e) { anota(linha, false, 'o banco ACEITOU'); }
}
function emailKey(email) {
  return String(email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
}

const ADMIN = 'admin.geral@previ.com.br';
const AVAL = 'avaliacao@previ.com.br';
const ARQ = 'arquitetura@previ.com.br';
const SEM = 'sem.acesso@previ.com.br';
const NODE = 'avaliacoes-produto';

const concluida = (extra) => Object.assign({
  nome: 'Item', status: 'concluido', resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', decisaoManual: false,
  decisaoConfirmada: false, respostas: { P1: { resposta: 'sim' } }, camadaSugerida: { id: 'canal', label: 'Canal' },
  itemId: 'v1', versao: 1, atualizadoEm: '2026-10-01T10:00:00.000Z'
}, extra || {});
const CURADORIA = {
  especializacaoCadastrada: 'Instituto previdenciário', especializacaoCamadaConfirmada: 'canal',
  papelEstruturalCadastrado: 'essencial', papelEstruturalCamadaConfirmada: 'canal',
  naturezaComplementarCodigo: 'PLATAFORMA', naturezaComplementarNomeNaEpoca: 'Plataforma',
  naturezaComplementarDefinidaPor: { name: 'Arq', email: ARQ }, naturezaComplementarDefinidaEm: '2026-10-01T10:00:00.000Z'
};
const linhaAud = (tipo, extra) => Object.assign({ tipo, usuario: { name: 'x', email: 'x@previ.com.br' }, dataHora: '2026-10-06T10:00:00.000Z' }, extra || {});

async function main() {
  const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8');
  const testEnv = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-perfis', database: { rules } });
  const db = (email) => testEnv.authenticatedContext(emailKey(email), { email }).database();
  const semear = (fn) => testEnv.withSecurityRulesDisabled((c) => fn(c.database()));

  async function base() {
    await testEnv.clearDatabase();
    await semear(async (a) => {
      await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN });
      await a.ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).set({ email: AVAL, nome: AVAL, tipo: 'avaliacao' });
      await a.ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).set({ email: ARQ, nome: ARQ, tipo: 'avaliacao-arquitetura' });
      await a.ref(NODE + '/v1').set(concluida(CURADORIA));
      await a.ref(NODE + '/semCur').set(concluida({ itemId: 'semCur' }));
      await a.ref('motor-squad-config').set({ versaoPublicada: 1 });
      await a.ref('avaliacoes-squad/s1').set({ itemNome: 'Squad 1', status: 'concluido' });
    });
  }

  console.log('\n== "Avaliação" avalia ==');
  await base();
  await pode('cria uma avaliação nova sem curadoria nem decisão', db(AVAL).ref(NODE + '/nova').set(concluida({ itemId: 'nova' })));
  await pode('conclui um rascunho seu (status, resultado automático)', db(AVAL).ref(NODE + '/nova').update({ status: 'concluido', resultadoAutomatico: 'produto', decisaoFinal: 'produto' }));
  await pode('reprocessa: muda o resultado automático e a decisão que o acompanha (não manual)',
    db(AVAL).ref(NODE + '/semCur').update({ resultadoAutomatico: 'produto', decisaoFinal: 'produto', motorVersion: 'v2' }));
  await pode('cria a reavaliação (v2) herdando a curadoria da v1, sem decisão',
    db(AVAL).ref(NODE + '/v2').set(concluida(Object.assign({ itemId: 'v1', versao: 2, versaoAnteriorKey: 'v1', status: 'rascunho' }, CURADORIA))));
  await pode('reprocessa uma avaliação COM curadoria (a curadoria fica como está)',
    db(AVAL).ref(NODE + '/v1').update({ resultadoAutomatico: 'produto', decisaoFinal: 'produto', motorVersion: 'v2' }));
  await semear((a) => a.ref(NODE + '/comDec').set(concluida({ itemId: 'comDec', decisaoManual: true, decisaoFinal: 'produto', decisaoConfirmada: true, justificativaDecisao: 'x', alteradoPor: { name: 'Arq', email: ARQ }, alteradoEm: '2026-10-01T10:00:00.000Z' })));
  await pode('exclui uma avaliação que já tem decisão manual (a decisão fica como está)', db(AVAL).ref(NODE + '/comDec').update({ excluido: true }));
  await naoPode('…mas não troca quem decidiu', db(AVAL).ref(NODE + '/comDec/alteradoPor/email').set(AVAL));
  await pode('exclui (marca como excluída) uma avaliação', db(AVAL).ref(NODE + '/semCur').update({ excluido: true, excluidoEm: '2026-10-06T10:00:00.000Z' }));
  await pode('grava a linha de auditoria da reavaliação',
    db(AVAL).ref('curadoria-auditoria/v2/p1').set(linhaAud('alteracao_decisao_final', { origem: 'usuario', reavaliacao: { deKey: 'v1', deVersao: 1, paraVersao: 2 } })));
  await pode('grava a linha de auditoria do reprocessamento automático',
    db(AVAL).ref('curadoria-auditoria/semCur/p1').set(linhaAud('alteracao_decisao_final', { origem: 'reprocessamento-automatico', motorVersion: 'v2' })));

  console.log('\n== "Avaliação" NÃO cura nem decide ==');
  await base();
  await naoPode('não registra decisão manual', db(AVAL).ref(NODE + '/semCur').update({ decisaoManual: true, decisaoFinal: 'produto', justificativaDecisao: 'porque sim', alteradoPor: { name: 'a', email: AVAL } }));
  await naoPode('não "aceita a recomendação" (decisaoConfirmada)', db(AVAL).ref(NODE + '/semCur').update({ decisaoConfirmada: true }));
  await naoPode('não muda a especialização cadastrada', db(AVAL).ref(NODE + '/v1').update({ especializacaoCadastrada: 'Outra' }));
  await naoPode('não apaga a especialização cadastrada', db(AVAL).ref(NODE + '/v1/especializacaoCadastrada').remove());
  await naoPode('não muda o papel estrutural', db(AVAL).ref(NODE + '/v1').update({ papelEstruturalCadastrado: 'opcional' }));
  await naoPode('não define natureza complementar', db(AVAL).ref(NODE + '/semCur').update({ naturezaComplementarCodigo: 'PLATAFORMA', naturezaComplementarNomeNaEpoca: 'Plataforma' }));
  await naoPode('não regrava o registro inteiro trocando a curadoria', db(AVAL).ref(NODE + '/v1').set(concluida(Object.assign({}, CURADORIA, { especializacaoCadastrada: 'Trocada' }))));
  await naoPode('avaliação NOVA não nasce com curadoria', db(AVAL).ref(NODE + '/nova2').set(concluida(Object.assign({ itemId: 'nova2' }, CURADORIA))));
  await naoPode('avaliação NOVA não nasce com decisão manual', db(AVAL).ref(NODE + '/nova3').set(concluida({ itemId: 'nova3', decisaoManual: true, decisaoFinal: 'produto', justificativaDecisao: 'x' })));
  await naoPode('reavaliação não troca a curadoria herdada',
    db(AVAL).ref(NODE + '/v2b').set(concluida(Object.assign({ itemId: 'v1', versao: 2, versaoAnteriorKey: 'v1' }, CURADORIA, { papelEstruturalCadastrado: 'opcional' }))));
  await naoPode('reavaliação não inventa curadoria que a anterior não tinha',
    db(AVAL).ref(NODE + '/v2c').set(concluida(Object.assign({ itemId: 'semCur', versao: 2, versaoAnteriorKey: 'semCur' }, CURADORIA))));
  await naoPode('não grava linha de auditoria de especialização', db(AVAL).ref('curadoria-auditoria/v1/p9').set(linhaAud('alteracao_especializacao', { origem: 'usuario' })));
  await naoPode('não grava linha de auditoria de papel estrutural', db(AVAL).ref('curadoria-auditoria/v1/p8').set(linhaAud('alteracao_papel_estrutural', { origem: 'usuario' })));
  await naoPode('não grava linha de decisão final feita por pessoa', db(AVAL).ref('curadoria-auditoria/v1/p7').set(linhaAud('alteracao_decisao_final', { origem: 'usuario' })));

  console.log('\n== "Avaliação + Arquitetura" e admin geral curam e decidem ==');
  for (const [quem, email] of [['Avaliação + Arquitetura', ARQ], ['admin geral', ADMIN]]) {
    await base();
    await pode(quem + ': registra decisão manual', db(email).ref(NODE + '/semCur').update({ decisaoManual: true, decisaoFinal: 'produto', decisaoConfirmada: true, justificativaDecisao: 'motivo', alteradoPor: { name: 'a', email }, alteradoEm: '2026-10-06T10:00:00.000Z' }));
    await pode(quem + ': muda a especialização', db(email).ref(NODE + '/v1').update({ especializacaoCadastrada: 'Outra' }));
    await pode(quem + ': define a natureza complementar', db(email).ref(NODE + '/semCur').update({ naturezaComplementarCodigo: 'PLATAFORMA', naturezaComplementarNomeNaEpoca: 'Plataforma' }));
    await pode(quem + ': grava a auditoria da curadoria', db(email).ref('curadoria-auditoria/v1/p9').set(linhaAud('alteracao_especializacao', { origem: 'usuario' })));
  }

  console.log('\n== Adequação à Squad na área AVALIAÇÃO ==');
  await base();
  await pode('"Avaliação" lê as avaliações de squad', db(AVAL).ref('avaliacoes-squad').once('value'));
  await pode('"Avaliação" grava uma avaliação de squad', db(AVAL).ref('avaliacoes-squad/s2').set({ itemNome: 'Squad 2', status: 'rascunho' }));
  await pode('"Avaliação" lê o motor de squad (para concluir)', db(AVAL).ref('motor-squad-config').once('value'));
  await naoPode('"Avaliação" NÃO altera o motor de squad', db(AVAL).ref('motor-squad-config/versaoPublicada').set(2));
  await pode('"Avaliação + Arquitetura" altera o motor de squad', db(ARQ).ref('motor-squad-config/rascunho').set({ regras: { eixoA: [] } }));
  await naoPode('quem não está na lista não lê avaliações de squad', db(SEM).ref('avaliacoes-squad').once('value'));
  await naoPode('quem não está na lista não grava avaliação de squad', db(SEM).ref('avaliacoes-squad/s3').set({ itemNome: 'x' }));
  await naoPode('quem não está na lista não lê o motor de squad', db(SEM).ref('motor-squad-config').once('value'));

  console.log('\n== Documentação e mapas de Arquitetura (Mapa da Floresta) ==');
  await base();
  const doc = (extra) => Object.assign({ titulo: 'Mapa da Floresta', descricao: 'Mapa', link: 'https://exemplo.sharepoint.com/mapa.pdf',
    autor: { name: 'Arq', email: ARQ }, criadoEm: '2026-10-06T10:00:00.000Z', atualizadoEm: '2026-10-06T10:00:00.000Z',
    atualizadoPor: { name: 'Arq', email: ARQ }, arquivado: false }, extra || {});
  const audDoc = (id, tipo) => ({ tipo: tipo || 'criado', documentoId: id, titulo: 'Mapa da Floresta', valorAnterior: null, valorNovo: '{}', usuario: { name: 'Arq', email: ARQ }, dataHora: '2026-10-06T10:00:00.000Z' });
  const criarDoc = (email, id, extra) => { const u = {}; u['arquitetura-documentos/' + id] = doc(extra); u['arquitetura-documentos-auditoria/' + id + 'a'] = audDoc(id); return db(email).ref().update(u); };
  await pode('"Avaliação + Arquitetura" registra um documento (com a linha do histórico, juntos)', criarDoc(ARQ, 'd1'));
  await pode('admin geral registra um documento', criarDoc(ADMIN, 'd2'));
  await naoPode('"Avaliação" não registra documento', criarDoc(AVAL, 'd3'));
  await naoPode('"Avaliação" não lê a documentação da Arquitetura', db(AVAL).ref('arquitetura-documentos').once('value'));
  await naoPode('quem não está na lista não lê', db(SEM).ref('arquitetura-documentos').once('value'));
  await pode('"Avaliação + Arquitetura" lê a documentação', db(ARQ).ref('arquitetura-documentos').once('value'));
  await pode('edita título, descrição e link', db(ARQ).ref('arquitetura-documentos/d1').update({ titulo: 'Mapa da Floresta v2', link: 'https://exemplo.sharepoint.com/v2.pdf', atualizadoEm: '2026-10-06T11:00:00.000Z' }));
  await pode('arquiva (sem apagar)', db(ARQ).ref('arquitetura-documentos/d1').update({ arquivado: true }));
  await naoPode('não apaga um documento', db(ARQ).ref('arquitetura-documentos/d1').remove());
  await naoPode('não apaga a lista inteira', db(ADMIN).ref('arquitetura-documentos').remove());
  await naoPode('não troca o autor', db(ARQ).ref('arquitetura-documentos/d1/autor/email').set('outro@previ.com.br'));
  await naoPode('não troca a data de criação', db(ARQ).ref('arquitetura-documentos/d1/criadoEm').set('2020-01-01T00:00:00.000Z'));
  await naoPode('link sem https é recusado', criarDoc(ARQ, 'd4', { link: 'http://exemplo.com/x' }));
  await naoPode('link que não é endereço é recusado', criarDoc(ARQ, 'd5', { link: 'javascript:alert(1)' }));
  await naoPode('título vazio é recusado', criarDoc(ARQ, 'd6', { titulo: '' }));
  await naoPode('campo desconhecido é recusado', criarDoc(ARQ, 'd7', { tamanhoArquivo: 10 }));
  await naoPode('histórico: não reescreve uma linha', db(ARQ).ref('arquitetura-documentos-auditoria/d1a').set(audDoc('d1', 'alterado')));
  await naoPode('histórico: não apaga uma linha', db(ADMIN).ref('arquitetura-documentos-auditoria/d1a').remove());
  await naoPode('histórico: tipo desconhecido é recusado', db(ARQ).ref('arquitetura-documentos-auditoria/x1').set(audDoc('d1', 'apagado')));
  await naoPode('histórico: linha de documento que não existe é recusada', db(ARQ).ref('arquitetura-documentos-auditoria/x2').set(audDoc('naoExiste')));

  await testEnv.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
