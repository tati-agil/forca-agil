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
     - Taxonomia Arquitetural: a audiência da Avaliação lê só nome, ativo,
       ponteiro da definição vigente e o texto da fonte apontada — de
       qualquer conceito arquitetural, sem lista de códigos; nunca grava.
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


  console.log('\n== Mapa da Floresta configurável (arquitetura-definicoes/MAPA_FLORESTA) ==');
  await base();
  const def = (extra) => Object.assign({ titulo: 'Mapa da Floresta', definicao: 'Definição vigente.', nota: 'Nota auxiliar.',
    criadoEm: '2026-10-06T10:00:00.000Z', criadoPor: { name: 'Arq', email: ARQ }, atualizadoEm: '2026-10-06T10:00:00.000Z', atualizadoPor: { name: 'Arq', email: ARQ } }, extra || {});
  const audDef = (id, tipo, extra) => Object.assign({ tipo: tipo || 'criada', definicaoId: id, titulo: 'Mapa da Floresta', valorAnterior: null, valorNovo: '{}', usuario: { name: 'Arq', email: ARQ }, dataHora: '2026-10-06T10:00:00.000Z' }, extra || {});
  const gravarDef = (email, id, extraDef, chaveAud, tipo) => { const u = {}; u['arquitetura-definicoes/' + id] = def(extraDef); u['arquitetura-definicoes-auditoria/' + (chaveAud || id + 'a')] = audDef(id, tipo); return db(email).ref().update(u); };
  await naoPode('"Avaliação" não registra a definição', gravarDef(AVAL, 'MAPA_FLORESTA'));
  await pode('"Avaliação + Arquitetura" registra a definição (estado vigente + linha do histórico, juntos)', gravarDef(ARQ, 'MAPA_FLORESTA'));
  await pode('admin geral altera a definição (com uma linha "alterada")', gravarDef(ADMIN, 'MAPA_FLORESTA', { definicao: 'Outra redação.', atualizadoPor: { name: 'Adm', email: ADMIN } }, 'b2', 'alterada'));
  await pode('"Avaliação + Arquitetura" lê a definição', db(ARQ).ref('arquitetura-definicoes/MAPA_FLORESTA').once('value'));
  await pode('…e o histórico dela', db(ARQ).ref('arquitetura-definicoes-auditoria').once('value'));
  await naoPode('"Avaliação" não lê a definição', db(AVAL).ref('arquitetura-definicoes').once('value'));
  await naoPode('quem não está na lista não lê', db(SEM).ref('arquitetura-definicoes').once('value'));
  await naoPode('não apaga MAPA_FLORESTA', db(ADMIN).ref('arquitetura-definicoes/MAPA_FLORESTA').remove());
  await naoPode('não apaga o nó inteiro', db(ADMIN).ref('arquitetura-definicoes').remove());
  await naoPode('não troca a data de criação', db(ARQ).ref('arquitetura-definicoes/MAPA_FLORESTA/criadoEm').set('2020-01-01T00:00:00.000Z'));
  await naoPode('não troca quem criou', db(ARQ).ref('arquitetura-definicoes/MAPA_FLORESTA/criadoPor/email').set('outro@previ.com.br'));
  await naoPode('definição vazia é recusada', db(ARQ).ref('arquitetura-definicoes/MAPA_FLORESTA/definicao').set(''));
  await naoPode('título vazio é recusado', db(ARQ).ref('arquitetura-definicoes/MAPA_FLORESTA/titulo').set(''));
  await naoPode('link sem https é recusado', db(ARQ).ref('arquitetura-definicoes/MAPA_FLORESTA/link').set('http://exemplo.com/mapa.pdf'));
  await pode('link https é aceito', db(ARQ).ref('arquitetura-definicoes/MAPA_FLORESTA/link').set('https://exemplo.sharepoint.com/mapa.pdf'));
  await naoPode('campo desconhecido é recusado', db(ARQ).ref('arquitetura-definicoes/MAPA_FLORESTA/versaoInterna').set(2));
  await naoPode('chave fora do padrão (minúsculas) é recusada', gravarDef(ARQ, 'mapa_floresta'));
  await naoPode('histórico: não reescreve uma linha', db(ARQ).ref('arquitetura-definicoes-auditoria/MAPA_FLORESTAa').set(audDef('MAPA_FLORESTA', 'alterada')));
  await naoPode('histórico: não apaga uma linha', db(ADMIN).ref('arquitetura-definicoes-auditoria/MAPA_FLORESTAa').remove());
  await naoPode('histórico: não apaga o histórico inteiro', db(ADMIN).ref('arquitetura-definicoes-auditoria').remove());
  await naoPode('histórico: tipo desconhecido é recusado', db(ARQ).ref('arquitetura-definicoes-auditoria/x1').set(audDef('MAPA_FLORESTA', 'apagada')));
  await naoPode('histórico: linha de definição que não existe é recusada', db(ARQ).ref('arquitetura-definicoes-auditoria/x2').set(audDef('OUTRA_DEF')));
  await naoPode('histórico: "Avaliação" não acrescenta linha', db(AVAL).ref('arquitetura-definicoes-auditoria/x3').set(audDef('MAPA_FLORESTA', 'alterada')));

  /* Fonte única dos nomes das classificações: a audiência da Avaliação (admin geral, "Avaliação",
     "Avaliação + Arquitetura") lê da Taxonomia ARQUITETURAL, de QUALQUER conceito (não há lista de
     códigos nas regras), SÓ nome, ativo e o ponteiro da definição vigente — e, das fontes, só o TEXTO
     da fonte apontada por definicaoVigenteFonteId. Nada mais (nem outra fonte, nem outro campo da
     vigente, nem critérios/observações, nem o conceito ou o nó inteiro, nem a auditoria, nem o domínio
     organizacional) e não grava nada. Admin geral continua lendo e gravando tudo. */
  console.log('\n== Taxonomia Arquitetural: nome e definição vigente para a Avaliação ==');
  await base();
  const TX = 'taxonomia/arquitetural';
  await semear(async (a) => {
    const u = {};
    ['produto-principal', 'canal', 'componente', 'conceito-qualquer'].forEach((c, i) => {
      u[TX + '/conceitos/' + c] = { nome: 'Nome ' + c, ordem: i + 1, ativo: true, situacaoDefinicao: 'registrada', definicaoVigenteFonteId: 'fA', observacoes: 'obs', criterios: { k1: { texto: 'crit', ordem: 1 } } };
      u[TX + '/fontes/' + c + '/fA'] = { texto: 'Definição A de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito', rotulo: 'r' };
      /* B também marcada 'vigente' (estado inconsistente semeado à força): só o PONTEIRO decide */
      u[TX + '/fontes/' + c + '/fB'] = { texto: 'Definição B de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' };
      u[TX + '/fontes/' + c + '/f0'] = { texto: 'Redação antiga de ' + c, contexto: 'PREVI', situacao: 'histórica/contextual', tipoRedacao: 'Conceito' };
    });
    u[TX + '/conceitos/sem-vigente'] = { nome: 'Sem vigente', ordem: 9, ativo: false, situacaoDefinicao: 'ainda não registrada' };
    u[TX + '/fontes/sem-vigente/fX'] = { texto: 'Em validação', contexto: 'PREVI', situacao: 'em validação', tipoRedacao: 'proposta' };
    u[TX + '/auditoria/canal/a1'] = { tipo: 'alteracao_conceito', campo: 'nome', dataHora: '2026-10-06T10:00:00.000Z' };
    u['taxonomia/organizacional/conceitos/SQUAD'] = { nome: 'Squad', ordem: 1, ativo: true, situacaoDefinicao: 'registrada', camada: 'A', definicaoVigenteFonteId: 'f1' };
    u['taxonomia/organizacional/fontes/SQUAD/f1'] = { texto: 'Squad é…', contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' };
    await a.ref().update(u);
  });
  for (const [quem, email] of [['"Avaliação"', AVAL], ['"Avaliação + Arquitetura"', ARQ], ['admin geral', ADMIN]]) {
    await pode(quem + ': lê o nome de um conceito', db(email).ref(TX + '/conceitos/produto-principal/nome').once('value'));
    await pode(quem + ': lê o nome de QUALQUER conceito arquitetural (sem lista de códigos nas regras)', db(email).ref(TX + '/conceitos/conceito-qualquer/nome').once('value'));
    await pode(quem + ': lê "ativo"', db(email).ref(TX + '/conceitos/canal/ativo').once('value'));
    await pode(quem + ': lê o ponteiro da definição vigente', db(email).ref(TX + '/conceitos/canal/definicaoVigenteFonteId').once('value'));
    await pode(quem + ': lê o texto da fonte APONTADA (fA)', db(email).ref(TX + '/fontes/canal/fA/texto').once('value'));
    const lido = (await db(email).ref(TX + '/fontes/canal/fA/texto').once('value')).val();
    anota(quem + ': o texto lido é o da fonte apontada ("' + lido + '")', lido === 'Definição A de canal');
    await pode(quem + ': lê o nome de um conceito sem definição vigente', db(email).ref(TX + '/conceitos/sem-vigente/nome').once('value'));
  }
  for (const [quem, email] of [['"Avaliação"', AVAL], ['"Avaliação + Arquitetura"', ARQ]]) {
    await naoPode(quem + ': NÃO lê outra fonte do mesmo conceito, mesmo marcada vigente (fB)', db(email).ref(TX + '/fontes/canal/fB/texto').once('value'));
    await naoPode(quem + ': NÃO lê fonte histórica (f0)', db(email).ref(TX + '/fontes/canal/f0/texto').once('value'));
    await naoPode(quem + ': NÃO lê fonte de conceito sem ponteiro', db(email).ref(TX + '/fontes/sem-vigente/fX/texto').once('value'));
    await naoPode(quem + ': NÃO lê a fonte apontada inteira', db(email).ref(TX + '/fontes/canal/fA').once('value'));
    await naoPode(quem + ': NÃO lê outro campo da fonte apontada (situacao)', db(email).ref(TX + '/fontes/canal/fA/situacao').once('value'));
    await naoPode(quem + ': NÃO lê outro campo da fonte apontada (contexto)', db(email).ref(TX + '/fontes/canal/fA/contexto').once('value'));
    await naoPode(quem + ': NÃO lê as fontes de um conceito', db(email).ref(TX + '/fontes/canal').once('value'));
    await naoPode(quem + ': NÃO lê o nó de fontes inteiro', db(email).ref(TX + '/fontes').once('value'));
    await naoPode(quem + ': NÃO lê o nó de conceitos inteiro', db(email).ref(TX + '/conceitos').once('value'));
    await naoPode(quem + ': NÃO lê um conceito inteiro', db(email).ref(TX + '/conceitos/canal').once('value'));
    await naoPode(quem + ': NÃO lê os critérios', db(email).ref(TX + '/conceitos/canal/criterios').once('value'));
    await naoPode(quem + ': NÃO lê as observações', db(email).ref(TX + '/conceitos/canal/observacoes').once('value'));
    await naoPode(quem + ': NÃO lê a situação da definição', db(email).ref(TX + '/conceitos/canal/situacaoDefinicao').once('value'));
    await naoPode(quem + ': NÃO lê a auditoria/histórico da Taxonomia', db(email).ref(TX + '/auditoria/canal').once('value'));
    await naoPode(quem + ': NÃO lê o domínio organizacional (nome)', db(email).ref('taxonomia/organizacional/conceitos/SQUAD/nome').once('value'));
    await naoPode(quem + ': NÃO lê o domínio organizacional (texto da vigente)', db(email).ref('taxonomia/organizacional/fontes/SQUAD/f1/texto').once('value'));
    await naoPode(quem + ': NÃO lê a Taxonomia arquitetural inteira', db(email).ref(TX).once('value'));
    await naoPode(quem + ': NÃO lê a Taxonomia inteira', db(email).ref('taxonomia').once('value'));
    await naoPode(quem + ': NÃO renomeia um conceito', db(email).ref(TX + '/conceitos/canal/nome').set('Outro nome'));
    await naoPode(quem + ': NÃO desativa um conceito', db(email).ref(TX + '/conceitos/canal/ativo').set(false));
    await naoPode(quem + ': NÃO troca o ponteiro da definição vigente', db(email).ref(TX + '/conceitos/canal/definicaoVigenteFonteId').set('fB'));
    await naoPode(quem + ': NÃO altera o texto da fonte apontada', db(email).ref(TX + '/fontes/canal/fA/texto').set('Outra definição'));
    await naoPode(quem + ': NÃO grava na auditoria da Taxonomia', db(email).ref(TX + '/auditoria/canal/a9').set({ tipo: 'alteracao_conceito', usuario: email, dataHora: '2026-10-06T10:00:00.000Z' }));
  }
  /* trocar o ponteiro (gravação do admin) muda qual texto a Avaliação pode ler */
  const troca = {};
  troca[TX + '/conceitos/componente/definicaoVigenteFonteId'] = 'f2';
  troca[TX + '/fontes/componente/fA/situacao'] = 'histórica/contextual';
  troca[TX + '/fontes/componente/fB/situacao'] = 'histórica/contextual';
  troca[TX + '/fontes/componente/f2'] = { texto: 'Nova definição de componente', contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' };
  await semear((a) => a.ref().update(troca));
  await pode('"Avaliação" lê o texto da NOVA vigente', db(AVAL).ref(TX + '/fontes/componente/f2/texto').once('value'));
  await naoPode('"Avaliação" deixa de ler o texto da antiga', db(AVAL).ref(TX + '/fontes/componente/fA/texto').once('value'));
  await naoPode('quem não está na lista não lê o nome', db(SEM).ref(TX + '/conceitos/canal/nome').once('value'));
  await naoPode('quem não está na lista não lê o ponteiro', db(SEM).ref(TX + '/conceitos/canal/definicaoVigenteFonteId').once('value'));
  await naoPode('quem não está na lista não lê o texto da vigente', db(SEM).ref(TX + '/fontes/canal/fA/texto').once('value'));
  await pode('admin geral continua lendo o nó de conceitos inteiro', db(ADMIN).ref(TX + '/conceitos').once('value'));
  await pode('admin geral continua lendo as fontes inteiras', db(ADMIN).ref(TX + '/fontes/canal').once('value'));
  await pode('admin geral continua lendo a auditoria', db(ADMIN).ref(TX + '/auditoria/canal').once('value'));
  await pode('admin geral continua lendo o domínio organizacional', db(ADMIN).ref('taxonomia/organizacional/conceitos').once('value'));
  await pode('admin geral continua renomeando um conceito', db(ADMIN).ref(TX + '/conceitos/canal/nome').set('Canal renomeado'));
  await testEnv.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
