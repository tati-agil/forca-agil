/* ══════════════════════════════════════════════════════════════════
   Regras do banco da AVALIAÇÃO DE PRODUTO/SERVIÇO por perfil.

   Roda contra o EMULADOR real do Realtime Database (firebase
   emulators:exec), nunca contra uma reimplementação das regras —
   database.rules.json é o mesmo arquivo que vai para produção. A
   autorização de verdade mora AQUI (não nos botões escondidos da tela):
   quem chama o banco direto, sem passar pela interface, cai nestas regras.

   Perfis (fa-avaliacao-acessos/<emailKey>.perfil), independentes de ser admin:
     consulta  — lê SOMENTE avaliações concluídas (consulta filtrada por status)
     avaliador — consulta + cria, continua e reavalia
     gestor    — avaliador + decisão manual, excluir/restaurar, natureza,
                 especialização, reprocessar e auditoria
     nenhum    — sem acesso (registro explícito)
   Transição: admin SEM registro continua como gestor (não tira o acesso de
   quem já trabalhava); registro explícito, inclusive "nenhum", sempre vence.
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
function emailKey(email) {
  return String(email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
}

const SUPER = 'tatianefdirene@previ.com.br';
const ADMIN_LEGADO = 'admin.legado@previ.com.br';   /* fa-admins, SEM registro de acesso → gestor (transição) */
const ADMIN_NENHUM = 'admin.nenhum@previ.com.br';   /* fa-admins + perfil 'nenhum' → sem acesso operacional */
const ADMIN_CONSULTA = 'admin.consulta@previ.com.br'; /* fa-admins + perfil 'consulta' */
const SEM_ACESSO = 'sem.acesso@previ.com.br';
const CONSULTA = 'consulta@previ.com.br';
const AVALIADOR = 'avaliador@previ.com.br';
const GESTOR = 'gestor@previ.com.br';
const PERFIL_NENHUM = 'perfil.nenhum@previ.com.br';  /* registro explícito 'nenhum', não admin */

const NODE = 'avaliacoes-produto';

async function main() {
  const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8');
  const testEnv = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-avaliacoes', database: { rules } });
  const ctx = (email) => (email ? testEnv.authenticatedContext(emailKey(email), { email }) : testEnv.unauthenticatedContext());
  const db = (email) => ctx(email).database();
  const semear = (fn) => testEnv.withSecurityRulesDisabled((c) => fn(c.database()));

  const concluida = (extra) => Object.assign({
    nome: 'Item concluído', status: 'concluido', resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', decisaoManual: false,
    respostas: { necessidade: { valor: 'sim' } }, camadaSugerida: { id: 'canal', label: 'Canal' },
    motorVersion: 'v1', itemId: 'conc1', versao: 1, atualizadoEm: '2026-09-01T10:00:00.000Z'
  }, extra || {});
  const rascunho = (extra) => Object.assign({ nome: 'Item rascunho', status: 'rascunho', respostas: {}, itemId: 'rasc1', versao: 1, atualizadoEm: '2026-09-02T10:00:00.000Z' }, extra || {});

  async function semearBase() {
    await testEnv.clearDatabase();
    await semear(async (a) => {
      for (const e of [ADMIN_LEGADO, ADMIN_NENHUM, ADMIN_CONSULTA]) await a.ref('fa-admins/' + emailKey(e)).set({ email: e, name: e });
      const acesso = (email, perfil) => a.ref('fa-avaliacao-acessos/' + emailKey(email)).set({ email, nome: email, perfil, atribuidoEm: '2026-09-30T10:00:00.000Z' });
      await acesso(ADMIN_NENHUM, 'nenhum');
      await acesso(ADMIN_CONSULTA, 'consulta');
      await acesso(PERFIL_NENHUM, 'nenhum');
      await acesso(CONSULTA, 'consulta');
      await acesso(AVALIADOR, 'avaliador');
      await acesso(GESTOR, 'gestor');
      await a.ref(NODE + '/conc1').set(concluida());
      await a.ref(NODE + '/conc2').set(concluida({ nome: 'Outra concluída', itemId: 'conc2' }));
      await a.ref(NODE + '/rasc1').set(rascunho());
      await a.ref(NODE + '/excl1').set(concluida({ nome: 'Excluída', itemId: 'excl1', excluido: true, excluidoEm: '2026-09-05T10:00:00.000Z' }));
      await a.ref(NODE + '/nat1').set(concluida({
        nome: 'Com natureza', itemId: 'nat1', naturezaComplementarCodigo: 'PROGRAMA_TRANSVERSAL', naturezaComplementarNomeNaEpoca: 'Programa transversal',
        naturezaComplementarDefinidaEm: '2026-09-06T10:00:00.000Z'
      }));
      await a.ref('questionarios-config/CLASSIFICACAO_ARQUITETURAL').set({ versaoPublicada: 1 });
      await a.ref('motor-arquitetura-config').set({ versaoPublicada: 1 });
      await a.ref('naturezas-complementares-config/PROGRAMA_TRANSVERSAL').set({ nome: 'Programa transversal', ativo: true, ordem: 1 });
    });
  }
  const consultaConcluidas = (email) => db(email).ref(NODE).orderByChild('status').equalTo('concluido').once('value');

  try {
    console.log('== LEITURA das avaliações ==');
    await semearBase();
    await assertFails(db(null).ref(NODE).once('value'));
    anota('sem login: não lê nada', true);

    await assertFails(db(SEM_ACESSO).ref(NODE).once('value'));
    await assertFails(consultaConcluidas(SEM_ACESSO));
    await assertFails(db(SEM_ACESSO).ref(NODE + '/conc1').once('value'));
    anota('usuário sem perfil: não lê a lista, nem só as concluídas, nem uma avaliação por chave', true);

    await assertFails(db(PERFIL_NENHUM).ref(NODE).once('value'));
    await assertFails(consultaConcluidas(PERFIL_NENHUM));
    anota('perfil explícito "nenhum": sem acesso', true);

    const snapC = await assertSucceeds(consultaConcluidas(CONSULTA));
    const chavesC = Object.keys(snapC.val() || {}).sort();
    anota('CONSULTA: consulta filtrada por status = concluido funciona e devolve só concluídas (nunca o rascunho)',
      chavesC.indexOf('rasc1') === -1 && chavesC.indexOf('conc1') !== -1 && chavesC.indexOf('conc2') !== -1, chavesC.join(','));
    await assertFails(db(CONSULTA).ref(NODE).once('value'));
    anota('CONSULTA: NÃO consegue ler a lista inteira (que traria os rascunhos)', true);
    await assertFails(db(CONSULTA).ref(NODE).orderByChild('status').equalTo('rascunho').once('value'));
    anota('CONSULTA: NÃO consegue pedir os rascunhos por consulta filtrada', true);
    await assertSucceeds(db(CONSULTA).ref(NODE + '/conc1').once('value'));
    await assertFails(db(CONSULTA).ref(NODE + '/rasc1').once('value'));
    anota('CONSULTA: lê uma concluída por chave, mas não um rascunho', true);

    for (const [rotulo, email] of [['AVALIADOR', AVALIADOR], ['GESTOR', GESTOR], ['admin legado (sem registro = gestor)', ADMIN_LEGADO], ['super-admin (sem registro = gestor)', SUPER]]) {
      const s = await assertSucceeds(db(email).ref(NODE).once('value'));
      anota(rotulo + ': lê a lista inteira, inclusive rascunhos', !!(s.val() && s.val().rasc1));
    }
    await assertFails(db(ADMIN_NENHUM).ref(NODE).once('value'));
    anota('ADMIN com perfil explícito "nenhum": NÃO lê avaliações (admin e avaliador são permissões independentes)', true);
    const sAdmC = await assertSucceeds(consultaConcluidas(ADMIN_CONSULTA));
    await assertFails(db(ADMIN_CONSULTA).ref(NODE).once('value'));
    anota('ADMIN com perfil "consulta": só as concluídas, como qualquer consulta', !!(sAdmC.val() && !sAdmC.val().rasc1));

    console.log('\n== GRAVAÇÃO: quem cria, continua e reavalia ==');
    await semearBase();
    for (const [rotulo, email] of [['sem perfil', SEM_ACESSO], ['perfil "nenhum"', PERFIL_NENHUM], ['CONSULTA', CONSULTA], ['admin com perfil "nenhum"', ADMIN_NENHUM], ['admin com perfil "consulta"', ADMIN_CONSULTA]]) {
      await assertFails(db(email).ref(NODE + '/novaX').set(rascunho({ itemId: 'novaX' })));
      await assertFails(db(email).ref(NODE + '/rasc1/nome').set('alterado'));
      await assertFails(db(email).ref().update({ [NODE + '/novaY']: rascunho({ itemId: 'novaY' }) }));
      anota(rotulo + ': NÃO cria nem altera avaliação (nem por set, nem por update na raiz)', true);
    }

    await assertSucceeds(db(AVALIADOR).ref(NODE + '/nova1').set(rascunho({ itemId: 'nova1', nome: 'Nova pelo avaliador' })));
    anota('AVALIADOR: cria uma avaliação (rascunho)', true);
    await assertSucceeds(db(AVALIADOR).ref(NODE + '/nova1').update({ nome: 'Nome ajustado', atualizadoEm: '2026-09-30T11:00:00.000Z' }));
    anota('AVALIADOR: continua (altera) um rascunho', true);
    await assertSucceeds(db(AVALIADOR).ref(NODE + '/nova1').update({ status: 'concluido', resultadoAutomatico: 'produto', decisaoFinal: 'produto', decisaoManual: false, camadaSugerida: { id: 'produto-principal' } }));
    anota('AVALIADOR: conclui (a decisão final acompanha o resultado automático)', true);
    await assertSucceeds(db(AVALIADOR).ref(NODE + '/reav1').set(concluida({
      itemId: 'nat1', versao: 2, versaoAnteriorKey: 'nat1', naturezaComplementarCodigo: 'PROGRAMA_TRANSVERSAL',
      naturezaComplementarNomeNaEpoca: 'Programa transversal', naturezaComplementarDefinidaEm: '2026-09-06T10:00:00.000Z'
    })));
    anota('AVALIADOR: reavalia (registro NOVO, herdando a natureza da versão anterior)', true);
    await assertSucceeds(db(AVALIADOR).ref().update({ [NODE + '/viaRaiz']: rascunho({ itemId: 'viaRaiz' }) }));
    anota('AVALIADOR: também cria pelo update() multi-caminho na raiz (o que a tela usa)', true);

    console.log('\n== O que o AVALIADOR NÃO pode fazer (só o gestor) ==');
    await assertFails(db(AVALIADOR).ref(NODE + '/conc1/excluido').set(true));
    anota('AVALIADOR: não exclui uma avaliação', true);
    await assertFails(db(AVALIADOR).ref(NODE + '/excl1/excluido').set(false));
    anota('AVALIADOR: não restaura uma avaliação excluída', true);
    await assertFails(db(AVALIADOR).ref(NODE + '/criaExcluida').set(rascunho({ itemId: 'criaExcluida', excluido: true })));
    anota('AVALIADOR: não cria já "excluída" (burlar a regra pelo create)', true);
    await assertFails(db(AVALIADOR).ref(NODE + '/conc1').update({ decisaoManual: true, decisaoFinal: 'produto', justificativaDecisao: 'x' }));
    anota('AVALIADOR: não registra decisão manual', true);
    await assertFails(db(AVALIADOR).ref(NODE + '/conc1/decisaoFinal').set('produto'));
    anota('AVALIADOR: não muda a decisão final para divergir do resultado automático (sem marcar manual)', true);
    await assertFails(db(AVALIADOR).ref(NODE + '/criaDivergente').set(concluida({ itemId: 'criaDivergente', decisaoFinal: 'produto' })));
    anota('AVALIADOR: não cria concluída com decisão final divergente do resultado automático', true);
    await assertFails(db(AVALIADOR).ref(NODE + '/conc1/resultadoAutomatico').set('produto'));
    anota('AVALIADOR: não altera o resultado de uma avaliação JÁ concluída (reavaliar cria outra)', true);
    await assertFails(db(AVALIADOR).ref(NODE + '/conc1/status').set('rascunho'));
    anota('AVALIADOR: não "reabre" uma concluída para reescrevê-la', true);
    await assertFails(db(AVALIADOR).ref(NODE + '/nat1/naturezaComplementarCodigo').set('OUTRA'));
    await assertFails(db(AVALIADOR).ref(NODE + '/conc1').update({ naturezaComplementarCodigo: 'PROGRAMA_TRANSVERSAL', naturezaComplementarNomeNaEpoca: 'Programa transversal', naturezaComplementarDefinidaEm: '2026-09-30T12:00:00.000Z' }));
    anota('AVALIADOR: não define nem altera a natureza complementar de uma avaliação existente', true);
    await assertFails(db(AVALIADOR).ref(NODE + '/conc1/especializacaoCadastrada').set('Qualquer'));
    await assertFails(db(AVALIADOR).ref(NODE + '/conc1/papelEstruturalCadastrado').set('x'));
    anota('AVALIADOR: não altera especialização/papel estrutural cadastrados', true);
    await assertFails(db(AVALIADOR).ref(NODE + '/conc1/bloqueadaParaReprocessamentoAutomatico').set(true));
    anota('AVALIADOR: não bloqueia reprocessamento', true);
    await assertFails(db(AVALIADOR).ref(NODE + '/conc1').set(null));
    anota('AVALIADOR: não apaga uma avaliação do banco', true);

    console.log('\n== O que o GESTOR pode fazer ==');
    await semearBase();
    await assertSucceeds(db(GESTOR).ref(NODE + '/conc1').update({ excluido: true, excluidoEm: '2026-09-30T12:00:00.000Z', justificativaExclusao: 'duplicada' }));
    await assertSucceeds(db(GESTOR).ref(NODE + '/conc1').update({ excluido: false }));
    anota('GESTOR: exclui e restaura', true);
    await assertSucceeds(db(GESTOR).ref(NODE + '/conc2').update({ decisaoManual: true, decisaoFinal: 'produto', justificativaDecisao: 'justificativa', decisaoConfirmada: true }));
    anota('GESTOR: registra decisão manual (divergindo do resultado automático)', true);
    await assertSucceeds(db(GESTOR).ref(NODE + '/conc2').update({ decisaoManual: false, decisaoFinal: 'nao-produto', justificativaDecisao: null }));
    anota('GESTOR: volta a aceitar a recomendação do sistema', true);
    await assertSucceeds(db(GESTOR).ref(NODE + '/nat1').update({ naturezaComplementarCodigo: 'PLATAFORMA_BENEFICIOS_PARCERIAS', naturezaComplementarNomeNaEpoca: 'Plataforma', naturezaComplementarDefinidaEm: '2026-09-30T12:00:00.000Z' }));
    anota('GESTOR: altera a natureza complementar', true);
    await assertSucceeds(db(GESTOR).ref(NODE + '/conc1').update({ especializacaoCadastrada: 'Material educativo', bloqueadaParaReprocessamentoAutomatico: true }));
    anota('GESTOR: cadastra especialização e bloqueia reprocessamento', true);
    await assertSucceeds(db(GESTOR).ref(NODE + '/conc1').update({ resultadoAutomatico: 'produto', decisaoFinal: 'produto', motorVersion: 'v2' }));
    anota('GESTOR: reprocessa (recalcula o resultado automático de uma concluída)', true);

    console.log('\n== Natureza complementar: gravação atômica com auditoria ==');
    await semearBase();
    const audKey = 'pushKey1';
    const multi = {};
    multi[NODE + '/conc1/naturezaComplementarCodigo'] = 'PROGRAMA_TRANSVERSAL';
    multi[NODE + '/conc1/naturezaComplementarNomeNaEpoca'] = 'Programa transversal';
    multi[NODE + '/conc1/naturezaComplementarDefinidaEm'] = '2026-09-30T12:00:00.000Z';
    multi['naturezas-complementares-auditoria/conc1/' + audKey] = { tipo: 'alteracao_natureza_complementar', avaliacaoId: 'conc1', dataHora: '2026-09-30T12:00:00.000Z' };
    await assertFails(db(AVALIADOR).ref().update(multi));
    anota('AVALIADOR: a gravação de natureza + auditoria é recusada por inteiro', true);
    await assertSucceeds(db(GESTOR).ref().update(multi));
    anota('GESTOR: grava natureza + linha de auditoria na mesma operação', true);
    const nat = (await db(GESTOR).ref(NODE + '/conc1/naturezaComplementarCodigo').once('value')).val();
    anota('  a natureza ficou gravada', nat === 'PROGRAMA_TRANSVERSAL', nat);
    await assertFails(db(GESTOR).ref('naturezas-complementares-auditoria/conc1/' + audKey + '/tipo').set('adulterado'));
    await assertFails(db(GESTOR).ref('naturezas-complementares-auditoria/conc1/' + audKey).set(null));
    anota('GESTOR: não altera nem apaga uma linha de auditoria já gravada (nada é sobrescrito em silêncio)', true);
    await assertFails(db(GESTOR).ref('naturezas-complementares-auditoria/catalogo/x1').set({ tipo: 'alteracao_catalogo_natureza' }));
    await assertSucceeds(db(ADMIN_LEGADO).ref('naturezas-complementares-auditoria/catalogo/x1').set({ tipo: 'alteracao_catalogo_natureza' }));
    anota('auditoria do CATÁLOGO: só admin grava', true);
    await assertFails(db(AVALIADOR).ref('naturezas-complementares-auditoria/conc1/outra').set({ tipo: 'alteracao_natureza_complementar' }));
    await assertFails(db(CONSULTA).ref('naturezas-complementares-auditoria/conc1').once('value'));
    anota('AVALIADOR não grava auditoria; CONSULTA não a lê', true);
    await assertSucceeds(db(GESTOR).ref('naturezas-complementares-auditoria/conc1').once('value'));
    anota('GESTOR lê o histórico de auditoria', true);

    console.log('\n== Configurações: lê quem avalia; grava só o admin ==');
    for (const cfg of ['questionarios-config/CLASSIFICACAO_ARQUITETURAL', 'motor-arquitetura-config', 'naturezas-complementares-config']) {
      for (const [rotulo, email] of [['CONSULTA', CONSULTA], ['AVALIADOR', AVALIADOR], ['GESTOR', GESTOR]]) {
        await assertSucceeds(db(email).ref(cfg).once('value'));
        await assertFails(db(email).ref(cfg + '/x').set('x'));
      }
      await assertFails(db(SEM_ACESSO).ref(cfg).once('value'));
      await assertSucceeds(db(ADMIN_NENHUM).ref(cfg).once('value'));
      await assertSucceeds(db(ADMIN_LEGADO).ref(cfg + '/teste').set('ok'));
      anota(cfg + ': consulta/avaliador/gestor leem e NÃO gravam; sem perfil não lê; admin lê e grava (mesmo com perfil "nenhum")', true);
    }
    await assertFails(db(GESTOR).ref('questionarios-auditoria/CLASSIFICACAO_ARQUITETURAL').once('value'));
    await assertFails(db(GESTOR).ref('motor-squad-config').once('value'));
    await assertFails(db(GESTOR).ref('avaliacoes-squad').once('value'));
    anota('o gestor NÃO ganha acesso às áreas administrativas (auditoria de questionários, motor e avaliações de squad)', true);

    console.log('\n== Auditoria do motor: o gestor só ACRESCENTA reconciliações ==');
    await semearBase();
    await assertSucceeds(db(GESTOR).ref('motor-arquitetura-auditoria/a1').set({ tipo: 'reconciliacao_versao_equivalente', avaliacaoId: 'conc1' }));
    anota('GESTOR: acrescenta uma linha de reconciliação (precisa, ao reconciliar em lote)', true);
    await assertFails(db(GESTOR).ref('motor-arquitetura-auditoria/a2').set({ tipo: 'publicacao', campo: 'x' }));
    await assertFails(db(GESTOR).ref('motor-arquitetura-auditoria/a1/tipo').set('outro'));
    await assertFails(db(GESTOR).ref('motor-arquitetura-auditoria/a1').set(null));
    anota('GESTOR: não grava outro tipo de linha, não altera nem apaga as existentes', true);
    await assertFails(db(AVALIADOR).ref('motor-arquitetura-auditoria/a3').set({ tipo: 'reconciliacao_versao_equivalente' }));
    await assertFails(db(GESTOR).ref('motor-arquitetura-auditoria').once('value'));
    await assertSucceeds(db(ADMIN_LEGADO).ref('motor-arquitetura-auditoria').once('value'));
    anota('AVALIADOR não grava; só admin lê a auditoria do motor', true);

    console.log('\n== fa-avaliacao-acessos (quem tem qual perfil) ==');
    await semearBase();
    await assertSucceeds(db(ADMIN_LEGADO).ref('fa-avaliacao-acessos').once('value'));
    await assertFails(db(GESTOR).ref('fa-avaliacao-acessos').once('value'));
    await assertFails(db(CONSULTA).ref('fa-avaliacao-acessos').once('value'));
    anota('só admin lista os perfis', true);
    await assertSucceeds(db(CONSULTA).ref('fa-avaliacao-acessos/' + emailKey(CONSULTA)).once('value'));
    await assertFails(db(CONSULTA).ref('fa-avaliacao-acessos/' + emailKey(GESTOR)).once('value'));
    anota('cada pessoa lê o PRÓPRIO perfil, e só o próprio', true);
    await assertFails(db(CONSULTA).ref('fa-avaliacao-acessos/' + emailKey(CONSULTA) + '/perfil').set('gestor'));
    await assertFails(db(GESTOR).ref('fa-avaliacao-acessos/' + emailKey(AVALIADOR) + '/perfil').set('gestor'));
    anota('ninguém se promove nem promove outra pessoa sem ser admin (nem o próprio gestor)', true);
    await assertSucceeds(db(ADMIN_LEGADO).ref('fa-avaliacao-acessos/' + emailKey(SEM_ACESSO)).set({ email: SEM_ACESSO, nome: 'Fulana', perfil: 'avaliador' }));
    await assertSucceeds(db(SUPER).ref('fa-avaliacao-acessos/' + emailKey(SEM_ACESSO) + '/perfil').set('consulta'));
    anota('qualquer admin atribui/altera o perfil (quem abre a tela consegue gravar)', true);
    await assertFails(db(ADMIN_LEGADO).ref('fa-avaliacao-acessos/' + emailKey(SEM_ACESSO) + '/perfil').set('superusuario'));
    anota('perfil fora da lista é recusado', true);
    await assertSucceeds(db(ADMIN_LEGADO).ref('fa-avaliacao-acessos/' + emailKey(SEM_ACESSO)).set(null));
    anota('admin remove o acesso', true);

    console.log('\n== Transição: admin sem registro = gestor; registro explícito vence ==');
    await semearBase();
    await assertSucceeds(db(ADMIN_LEGADO).ref(NODE + '/adminCria').set(rascunho({ itemId: 'adminCria' })));
    await assertSucceeds(db(ADMIN_LEGADO).ref(NODE + '/conc1/excluido').set(true));
    anota('admin legado (sem registro): continua criando e excluindo, como hoje', true);
    await assertFails(db(ADMIN_NENHUM).ref(NODE + '/adminCria2').set(rascunho({ itemId: 'adminCria2' })));
    anota('o mesmo admin, depois de receber perfil "nenhum", perde o acesso operacional', true);
    await semear((a) => a.ref('fa-avaliacao-acessos/' + emailKey(ADMIN_LEGADO)).set({ email: ADMIN_LEGADO, perfil: 'avaliador' }));
    await assertSucceeds(db(ADMIN_LEGADO).ref(NODE + '/adminCria3').set(rascunho({ itemId: 'adminCria3' })));
    await assertFails(db(ADMIN_LEGADO).ref(NODE + '/conc2/excluido').set(true));
    anota('admin com perfil "avaliador": cria, mas não exclui (perfil explícito substitui a transição)', true);

    console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  } finally {
    await testEnv.cleanup();
  }
  if (falhas) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
