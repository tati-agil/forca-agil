/* ══════════════════════════════════════════════════════════════════
   Regras do banco dos ACESSOS da Avaliação de Produto/Serviço.

   Roda contra o EMULADOR real do Realtime Database (firebase
   emulators:exec), nunca contra uma reimplementação das regras —
   database.rules.json é o mesmo arquivo que vai para produção. A
   autorização de verdade mora AQUI (não nos botões escondidos da tela):
   quem chama o banco direto, sem passar pela interface, cai nestas regras.

   Modelo (fa-avaliacao-autorizados/<emailKey>.tipo), independente de
   qualquer outro acesso do site:
     avaliacao             — usa a aba AVALIAÇÃO; NÃO entra em ADMIN > ARQUITETURA
     avaliacao-arquitetura — aba AVALIAÇÃO + SOMENTE ADMIN > ARQUITETURA
     (fora da lista)       — nenhum acesso novo
   Admin geral continua com acesso total por ser admin. O perfil antigo
   (fa-avaliacao-acessos: consulta/avaliador/gestor) não concede NADA daqui
   e fica congelado (ninguém grava), com os dados preservados.
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
const ADMIN = 'admin.geral@previ.com.br';              /* fa-admins */
const AVAL = 'avaliacao@previ.com.br';                  /* tipo 'avaliacao' */
const ARQ = 'arquitetura@previ.com.br';                 /* tipo 'avaliacao-arquitetura' */
const GESTOR_ANTIGO = 'gestor.antigo@previ.com.br';     /* perfil antigo 'gestor', fora da lista nova */
const AVALIADOR_ANTIGO = 'avaliador.antigo@previ.com.br';
const CONSULTA_ANTIGO = 'consulta.antigo@previ.com.br';
const SEM_ACESSO = 'sem.acesso@previ.com.br';
const OUTRO = 'outro@previ.com.br';

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
  const registro = (email, tipo) => ({ email, nome: email, tipo, concedidoPor: SUPER, concedidoEm: '2026-10-01T10:00:00.000Z' });

  async function semearBase() {
    await testEnv.clearDatabase();
    await semear(async (a) => {
      await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: ADMIN });
      await a.ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).set(registro(AVAL, 'avaliacao'));
      await a.ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).set(registro(ARQ, 'avaliacao-arquitetura'));
      /* perfis ANTIGOS: preservados, mas não concedem nada do modelo novo */
      const antigo = (email, perfil) => a.ref('fa-avaliacao-acessos/' + emailKey(email)).set({ email, nome: email, perfil, atribuidoEm: '2026-09-30T10:00:00.000Z' });
      await antigo(GESTOR_ANTIGO, 'gestor');
      await antigo(AVALIADOR_ANTIGO, 'avaliador');
      await antigo(CONSULTA_ANTIGO, 'consulta');
      await a.ref(NODE + '/conc1').set(concluida());
      await a.ref(NODE + '/rasc1').set(rascunho());
      await a.ref('questionarios-config/CLASSIFICACAO_ARQUITETURAL').set({ versaoPublicada: 1 });
      await a.ref('questionarios-auditoria/a1').set({ acao: 'publicado' });
      await a.ref('motor-arquitetura-config').set({ versaoPublicada: 1 });
      await a.ref('motor-arquitetura-auditoria/a1').set({ tipo: 'regra' });
      await a.ref('motor-squad-config').set({ versaoPublicada: 1 });
      await a.ref('motor-squad-auditoria/a1').set({ tipo: 'regra' });
      await a.ref('avaliacoes-squad/s1').set({ nome: 'Squad 1', status: 'concluido' });
      await a.ref('naturezas-complementares-config/PROGRAMA_TRANSVERSAL').set({ nome: 'Programa transversal', ativo: true, ordem: 1 });
      await a.ref('naturezas-complementares-auditoria/conc1/p1').set({ acao: 'definida' });
      await a.ref('fa-users/' + emailKey(OUTRO)).set({ email: OUTRO, name: 'Outro' });
    });
  }

  /* quem pode o quê: [rótulo, e-mail, aba AVALIAÇÃO?, ADMIN > ARQUITETURA?] */
  const MATRIZ = [
    ['super-admin', SUPER, true, true],
    ['admin geral (fa-admins)', ADMIN, true, true],
    ['tipo "Avaliação"', AVAL, true, false],
    ['tipo "Avaliação + Arquitetura"', ARQ, true, true],
    ['perfil antigo GESTOR (fora da lista nova)', GESTOR_ANTIGO, false, false],
    ['perfil antigo AVALIADOR (fora da lista nova)', AVALIADOR_ANTIGO, false, false],
    ['perfil antigo CONSULTA (fora da lista nova)', CONSULTA_ANTIGO, false, false],
    ['usuário comum, sem nada', SEM_ACESSO, false, false],
  ];

  try {
    console.log('== ABA AVALIAÇÃO: leitura e escrita das avaliações ==');
    await semearBase();
    await assertFails(db(null).ref(NODE).once('value'));
    anota('sem login: não lê nada', true);
    for (const [rotulo, email, aval] of MATRIZ) {
      if (aval) {
        const s = await assertSucceeds(db(email).ref(NODE).once('value'));
        anota(rotulo + ': lê a lista, inclusive rascunhos', !!(s.val() && s.val().rasc1));
        await assertSucceeds(db(email).ref(NODE + '/novo-' + emailKey(email)).set(rascunho({ itemId: 'n' })));
        await assertSucceeds(db(email).ref(NODE + '/conc1/excluido').set(true));
        await assertSucceeds(db(email).ref(NODE + '/conc1/excluido').set(null));
        anota(rotulo + ': cria, exclui e restaura (funcionalidades operacionais da aba)', true);
        await assertSucceeds(db(email).ref('naturezas-complementares-auditoria/conc1/' + emailKey(email)).set({ acao: 'definida' }));
        anota(rotulo + ': registra a auditoria da natureza ao editar a avaliação', true);
        await assertSucceeds(db(email).ref('questionarios-config').once('value'));
        await assertSucceeds(db(email).ref('motor-arquitetura-config').once('value'));
        await assertSucceeds(db(email).ref('naturezas-complementares-config').once('value'));
        anota(rotulo + ': lê questionários, motor e naturezas (a ficha precisa deles)', true);
      } else {
        await assertFails(db(email).ref(NODE).once('value'));
        await assertFails(db(email).ref(NODE).orderByChild('status').equalTo('concluido').once('value'));
        await assertFails(db(email).ref(NODE + '/conc1').once('value'));
        await assertFails(db(email).ref(NODE + '/novo').set(rascunho({ itemId: 'n' })));
        await assertFails(db(email).ref(NODE + '/conc1/excluido').set(true));
        await assertFails(db(email).ref('questionarios-config').once('value'));
        await assertFails(db(email).ref('motor-arquitetura-config').once('value'));
        anota(rotulo + ': NÃO lê nem grava a aba AVALIAÇÃO (nem consulta filtrada, nem por chave)', true);
      }
    }
    await assertFails(db(AVAL).ref(NODE + '/conc1/decisaoFinal').set('produto'));
    anota('invariante mantida para todos: decisão final diferente do resultado automático exige decisão manual', true);
    await assertSucceeds(db(AVAL).ref(NODE + '/conc1').update({ decisaoFinal: 'produto', decisaoManual: true }));
    anota('…e com decisão manual a gravação passa', true);

    console.log('\n== ADMIN > ARQUITETURA: configurações e adequação à Squad ==');
    await semearBase();
    const NOS_ARQ = ['questionarios-config/CLASSIFICACAO_ARQUITETURAL', 'questionarios-auditoria', 'motor-arquitetura-config', 'motor-arquitetura-auditoria',
      'motor-squad-config', 'motor-squad-auditoria', 'avaliacoes-squad', 'naturezas-complementares-config'];
    for (const [rotulo, email, , arq] of MATRIZ) {
      let leu = 0, gravou = 0;
      for (const no of NOS_ARQ) {
        try { await assertSucceeds(db(email).ref(no).once('value')); leu++; } catch (e) { /* esperado para quem não tem */ }
        try { await assertSucceeds(db(email).ref(no + '/__teste').set({ x: 1 })); gravou++; } catch (e) { /* idem */ }
      }
      if (arq) anota(rotulo + ': lê e grava TODOS os nós da Arquitetura (' + NOS_ARQ.length + ')', leu === NOS_ARQ.length && gravou === NOS_ARQ.length, 'leu ' + leu + ', gravou ' + gravou);
      else {
        /* o tipo "Avaliação" lê (não grava) questionários/motor/naturezas, que a ficha usa; nunca a Squad nem a auditoria */
        const gravaConfig = gravou;
        anota(rotulo + ': NÃO grava nenhum nó da Arquitetura', gravaConfig === 0, 'gravou ' + gravou);
      }
    }
    await assertFails(db(AVAL).ref('avaliacoes-squad').once('value'));
    await assertFails(db(AVAL).ref('motor-squad-config').once('value'));
    await assertFails(db(AVAL).ref('questionarios-auditoria').once('value'));
    await assertFails(db(AVAL).ref('motor-arquitetura-auditoria').once('value'));
    anota('tipo "Avaliação": não lê a Squad nem as auditorias de configuração', true);
    await assertSucceeds(db(AVAL).ref('motor-arquitetura-auditoria/rec1').set({ tipo: 'reconciliacao_versao_equivalente' }));
    await assertFails(db(AVAL).ref('motor-arquitetura-auditoria/rec2').set({ tipo: 'regra' }));
    anota('tipo "Avaliação": só acrescenta a linha de reconciliação (nunca outra auditoria)', true);

    console.log('\n== "Avaliação + Arquitetura" NÃO é admin geral: nada do resto do ADMIN ==');
    await semearBase();
    await semear(async (a) => {
      await a.ref('fa-admins/' + emailKey(OUTRO)).remove();
      await a.ref('fa-diretores/x').set({ email: 'x@previ.com.br' });
    });
    const OUTROS_NOS_ADMIN = ['fa-admins', 'fa-facilitadores', 'fa-diretores'];
    for (const no of OUTROS_NOS_ADMIN) {
      await assertFails(db(ARQ).ref(no + '/__teste').set({ email: 'x@previ.com.br', name: 'X' }));
    }
    anota('não grava os nós restritos do ADMIN (administradores, facilitadores, diretores)', true);
    await assertFails(db(ARQ).ref('fa-admins/' + emailKey(ARQ)).set({ email: ARQ, name: ARQ }));
    anota('não consegue se tornar admin geral', true);
    await assertFails(db(ARQ).ref('fa-avaliacao-autorizados').once('value'));
    await assertFails(db(ARQ).ref('fa-avaliacao-autorizados/' + emailKey(SEM_ACESSO)).set(registro(SEM_ACESSO, 'avaliacao')));
    await assertFails(db(ARQ).ref('fa-avaliacao-autorizados/' + emailKey(ARQ) + '/tipo').set('avaliacao'));
    anota('não lê a lista de autorizados nem concede/rebaixa acesso (nem o próprio)', true);

    console.log('\n== Lista de autorizados (fa-avaliacao-autorizados) ==');
    await semearBase();
    for (const email of [AVAL, ARQ, GESTOR_ANTIGO, SEM_ACESSO]) {
      await assertFails(db(email).ref('fa-avaliacao-autorizados').once('value'));
    }
    anota('só admin geral lê a lista inteira', true);
    const sLista = await assertSucceeds(db(ADMIN).ref('fa-avaliacao-autorizados').once('value'));
    anota('admin geral lê a lista', Object.keys(sLista.val() || {}).length === 2);
    await assertSucceeds(db(AVAL).ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).once('value'));
    await assertSucceeds(db(SEM_ACESSO).ref('fa-avaliacao-autorizados/' + emailKey(SEM_ACESSO)).once('value'));
    await assertFails(db(AVAL).ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).once('value'));
    anota('cada pessoa lê o PRÓPRIO registro (a tela precisa), e só o próprio', true);
    await assertFails(db(AVAL).ref('fa-avaliacao-autorizados/' + emailKey(AVAL) + '/tipo').set('avaliacao-arquitetura'));
    await assertFails(db(SEM_ACESSO).ref('fa-avaliacao-autorizados/' + emailKey(SEM_ACESSO)).set(registro(SEM_ACESSO, 'avaliacao')));
    anota('ninguém se promove nem se concede acesso sem ser admin geral', true);
    await assertSucceeds(db(ADMIN).ref('fa-avaliacao-autorizados/' + emailKey(SEM_ACESSO)).set(registro(SEM_ACESSO, 'avaliacao')));
    await assertSucceeds(db(SUPER).ref('fa-avaliacao-autorizados/' + emailKey(SEM_ACESSO) + '/tipo').set('avaliacao-arquitetura'));
    anota('admin geral concede e altera o tipo (quem abre a tela consegue gravar)', true);
    await assertFails(db(ADMIN).ref('fa-avaliacao-autorizados/' + emailKey(OUTRO)).set(registro(OUTRO, 'gestor')));
    await assertFails(db(ADMIN).ref('fa-avaliacao-autorizados/' + emailKey(OUTRO)).set(registro(OUTRO, 'consulta')));
    anota('tipo fora dos dois é recusado (os perfis antigos não existem no modelo novo)', true);
    await assertSucceeds(db(ADMIN).ref('fa-avaliacao-autorizados/' + emailKey(SEM_ACESSO)).set(null));
    await assertFails(db(SEM_ACESSO).ref(NODE).once('value'));
    anota('remover só retira a autorização — o acesso some na hora', true);

    console.log('\n== Histórico (fa-avaliacao-autorizados-auditoria) ==');
    const aud = { acao: 'concedido', email: SEM_ACESSO, nome: 'Fulana', tipoNovo: 'avaliacao', por: SUPER, em: '2026-10-01T10:00:00.000Z' };
    await assertSucceeds(db(ADMIN).ref('fa-avaliacao-autorizados-auditoria/h1').set(aud));
    await assertFails(db(ADMIN).ref('fa-avaliacao-autorizados-auditoria/h1').set(Object.assign({}, aud, { acao: 'removido' })));
    await assertFails(db(ADMIN).ref('fa-avaliacao-autorizados-auditoria/h1').remove());
    anota('admin geral só ACRESCENTA linhas ao histórico (não reescreve nem apaga)', true);
    await assertFails(db(ADMIN).ref('fa-avaliacao-autorizados-auditoria/h2').set(Object.assign({}, aud, { acao: 'inventado' })));
    anota('ação fora de concedido/alterado/removido é recusada', true);
    for (const email of [AVAL, ARQ, SEM_ACESSO]) {
      await assertFails(db(email).ref('fa-avaliacao-autorizados-auditoria').once('value'));
      await assertFails(db(email).ref('fa-avaliacao-autorizados-auditoria/h3').set(aud));
    }
    anota('autorizados e usuários comuns não leem nem escrevem o histórico', true);
    /* gravação conjunta (como a tela faz): registro + histórico no mesmo update */
    const up = {};
    up['fa-avaliacao-autorizados/' + emailKey(OUTRO)] = registro(OUTRO, 'avaliacao');
    up['fa-avaliacao-autorizados-auditoria/h4'] = Object.assign({}, aud, { email: OUTRO });
    await assertSucceeds(db(ADMIN).ref().update(up));
    anota('registro + histórico gravam juntos num único update (atômico)', true);

    console.log('\n== Perfil ANTIGO (fa-avaliacao-acessos): preservado, congelado, sem efeito ==');
    await semearBase();
    await assertFails(db(ADMIN).ref('fa-avaliacao-acessos/' + emailKey(OUTRO)).set({ email: OUTRO, perfil: 'gestor' }));
    await assertFails(db(ADMIN).ref('fa-avaliacao-acessos/' + emailKey(GESTOR_ANTIGO)).remove());
    anota('ninguém grava nem apaga o perfil antigo (os registros ficam intactos)', true);
    const sAntigo = await assertSucceeds(db(ADMIN).ref('fa-avaliacao-acessos').once('value'));
    anota('admin ainda consegue ler os registros antigos', Object.keys(sAntigo.val() || {}).length === 3);
    await assertFails(db(GESTOR_ANTIGO).ref(NODE).once('value'));
    await assertFails(db(GESTOR_ANTIGO).ref('motor-squad-config').once('value'));
    anota('perfil antigo "gestor" não dá acesso à aba nem à Arquitetura', true);

    console.log('\n== Auditoria da Curadoria e da Decisão final (curadoria-auditoria) ==');
    await semearBase();
    const linhaCur = (tipo) => ({ tipo, avaliacaoId: 'conc1', valorAnterior: null, valorNovo: 'x', usuario: { name: 'P', email: AVAL }, dataHora: '2026-10-01T12:00:00.000Z' });
    for (const [rotulo, email] of [['admin geral', ADMIN], ['super-admin', SUPER], ['tipo "Avaliação"', AVAL], ['tipo "Avaliação + Arquitetura"', ARQ]]) {
      await assertSucceeds(db(email).ref('curadoria-auditoria/conc1/' + emailKey(email)).set(linhaCur('alteracao_especializacao')));
      const s1 = await assertSucceeds(db(email).ref('curadoria-auditoria/conc1').once('value'));
      anota(rotulo + ': acrescenta e lê a auditoria da curadoria', !!(s1.val() && s1.val()[emailKey(email)]));
    }
    await assertSucceeds(db(AVAL).ref('curadoria-auditoria/conc1/dec1').set(linhaCur('alteracao_decisao_final')));
    await assertSucceeds(db(AVAL).ref('curadoria-auditoria/conc1/pap1').set(linhaCur('alteracao_papel_estrutural')));
    anota('as três ações da curadoria/decisão são aceitas', true);
    await assertFails(db(AVAL).ref('curadoria-auditoria/conc1/dec1').set(linhaCur('alteracao_especializacao')));
    await assertFails(db(ADMIN).ref('curadoria-auditoria/conc1/dec1').remove());
    await assertFails(db(ARQ).ref('curadoria-auditoria/conc1').remove());
    anota('só acrescenta: ninguém, nem admin geral, reescreve ou apaga uma linha (nem a lista)', true);
    await assertFails(db(AVAL).ref('curadoria-auditoria/conc1/inv1').set(linhaCur('tipo_inventado')));
    await assertFails(db(AVAL).ref('curadoria-auditoria/conc1/inv2').set({ tipo: 'alteracao_decisao_final', dataHora: 'x' }));
    anota('linha com tipo desconhecido ou sem usuário/data é recusada', true);
    for (const [rotulo, email] of [['perfil antigo GESTOR', GESTOR_ANTIGO], ['usuário comum', SEM_ACESSO]]) {
      await assertFails(db(email).ref('curadoria-auditoria/conc1/x').set(linhaCur('alteracao_decisao_final')));
      await assertFails(db(email).ref('curadoria-auditoria/conc1').once('value'));
      anota(rotulo + ': não lê nem grava a auditoria', true);
    }
    await assertFails(db(null).ref('curadoria-auditoria/conc1').once('value'));
    anota('sem login: nada', true);
    /* origem: decisão de pessoa x reprocessamento automático (precisa dizer o motor) */
    await assertSucceeds(db(AVAL).ref('curadoria-auditoria/conc1/orig1').set(Object.assign(linhaCur('alteracao_decisao_final'), { origem: 'usuario' })));
    await assertSucceeds(db(AVAL).ref('curadoria-auditoria/conc1/orig2').set(Object.assign(linhaCur('alteracao_decisao_final'), { origem: 'reprocessamento-automatico', motorVersion: '2026.10.01-1', reprocessamento: 'lote' })));
    await assertFails(db(AVAL).ref('curadoria-auditoria/conc1/orig3').set(Object.assign(linhaCur('alteracao_decisao_final'), { origem: 'reprocessamento-automatico' })));
    await assertFails(db(AVAL).ref('curadoria-auditoria/conc1/orig4').set(Object.assign(linhaCur('alteracao_decisao_final'), { origem: 'sistema-misterioso', motorVersion: 'x' })));
    anota('origem "reprocessamento-automatico" exige a versão do motor; origem desconhecida é recusada', true);
    /* gravação conjunta, como a tela faz: decisão + linha de histórico no mesmo update */
    const conj = {};
    conj[NODE + '/conc1/decisaoFinal'] = 'produto'; conj[NODE + '/conc1/decisaoManual'] = true; conj[NODE + '/conc1/justificativaDecisao'] = 'porque sim';
    conj['curadoria-auditoria/conc1/conj1'] = linhaCur('alteracao_decisao_final');
    await assertSucceeds(db(AVAL).ref().update(conj));
    anota('decisão + histórico gravam juntos num único update (atômico)', true);

    console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  } finally {
    await testEnv.cleanup();
  }
  if (falhas) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
