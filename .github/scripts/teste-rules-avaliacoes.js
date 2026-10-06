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
  /* Linhas de auditoria no formato EXATO que a aplicação grava (ver questionarios-config.js publicarConteudo,
     motor-arquitetura.js/motor-squad.js publicarRegras/salvarTextos/registrarConflitoPublicacao,
     avaliacao-produto.js reconciliação e salvarNatureza, naturezas-config.js salvarOpcao). */
  const quem = (email) => ({ name: email, email });
  const QUEST = 'CLASSIFICACAO_ARQUITETURAL';
  const audQuest = (email, extra) => Object.assign({ pergunta: 'P5', campo: 'texto', valorAnterior: 'antes', valorNovo: 'depois',
    usuario: quem(email || ARQ), dataHora: '2026-10-01T10:00:00.000Z', versaoAnterior: 1, novaVersao: 2 }, extra || {});
  const audMotor = (tipo, email, extra) => {
    const base = { tipo, campo: null, valorAnterior: null, valorNovo: null, usuario: quem(email || ARQ), dataHora: '2026-10-01T10:00:00.000Z' };
    if (tipo === 'regra' || tipo === 'texto') Object.assign(base, { campo: 'R1', valorAnterior: '{"a":1}', valorNovo: '{"a":2}', versaoAnterior: 1, novaVersao: tipo === 'regra' ? 2 : 1 });
    if (tipo === 'sem_alteracao') Object.assign(base, { versaoAnterior: 1, novaVersao: 1 });
    if (tipo === 'conflito_publicacao') Object.assign(base, { versaoBase: 1, versaoAtual: 2, origem: 'tentativa_publicacao' });
    if (tipo === 'reconciliacao_versao_equivalente') Object.assign(base, { avaliacaoId: 'conc1', avaliacaoNome: 'Item concluído', versaoAnterior: 3, versaoNova: 4,
      equivalenciaComprovada: true, diferencasSemanticas: [], combinacoesAnalisadas: 65536 });
    return Object.assign(base, extra || {});
  };
  const audNatAval = (avaliacaoId, email, extra) => Object.assign({ tipo: 'alteracao_natureza_complementar', avaliacaoId, avaliacaoNome: 'Item concluído',
    valorAnterior: null, valorNovo: { codigo: 'PROGRAMA_TRANSVERSAL', nome: 'Programa transversal' }, usuario: quem(email || AVAL), dataHora: '2026-10-01T10:00:00.000Z' }, extra || {});
  const audNatCat = (codigo, campo, email, extra) => Object.assign({ tipo: 'alteracao_catalogo_natureza', codigo, campo, valorAnterior: null, valorNovo: 'x',
    usuario: quem(email || ARQ), dataHora: '2026-10-01T10:00:00.000Z' }, extra || {});
  const opcaoNat = (codigo, extra) => Object.assign({ codigoEstavel: codigo, nome: 'Opção ' + codigo, descricao: 'Descrição', ativo: true, ordem: 3,
    atualizadoEm: '2026-10-01T10:00:00.000Z', atualizadoPor: quem(ARQ) }, extra || {});

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
      await a.ref('questionarios-auditoria/' + QUEST + '/a1').set(audQuest(ARQ));
      await a.ref('motor-arquitetura-config').set({ versaoPublicada: 1 });
      await a.ref('motor-arquitetura-auditoria/a1').set(audMotor('regra'));
      await a.ref('motor-squad-config').set({ versaoPublicada: 1 });
      await a.ref('motor-squad-auditoria/a1').set(audMotor('regra'));
      await a.ref('avaliacoes-squad/s1').set({ nome: 'Squad 1', status: 'concluido' });
      await a.ref('naturezas-complementares-config/PROGRAMA_TRANSVERSAL').set(opcaoNat('PROGRAMA_TRANSVERSAL', { nome: 'Programa transversal', ordem: 1 }));
      await a.ref('naturezas-complementares-auditoria/conc1/p1').set(audNatAval('conc1'));
      await a.ref('naturezas-complementares-auditoria/catalogo/c1').set(audNatCat('PROGRAMA_TRANSVERSAL', 'nome'));
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
        await assertSucceeds(db(email).ref('naturezas-complementares-auditoria/conc1/' + emailKey(email)).set(audNatAval('conc1', email)));
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
    /* [nó lido, caminho gravado, valor gravado]: configurações aceitam qualquer filho; as auditorias só aceitam
       uma linha NOVA no formato que a aplicação grava, e o catálogo de naturezas só uma opção válida (ver seções abaixo) */
    const NOS_ARQ = [
      ['questionarios-config/CLASSIFICACAO_ARQUITETURAL', (k) => 'questionarios-config/CLASSIFICACAO_ARQUITETURAL/__teste', () => ({ x: 1 })],
      ['questionarios-auditoria', (k) => 'questionarios-auditoria/' + QUEST + '/nova-' + k, (e) => audQuest(e)],
      ['motor-arquitetura-config', (k) => 'motor-arquitetura-config/__teste', () => ({ x: 1 })],
      ['motor-arquitetura-auditoria', (k) => 'motor-arquitetura-auditoria/nova-' + k, (e) => audMotor('regra', e)],
      ['motor-squad-config', (k) => 'motor-squad-config/__teste', () => ({ x: 1 })],
      ['motor-squad-auditoria', (k) => 'motor-squad-auditoria/nova-' + k, (e) => audMotor('regra', e)],
      ['avaliacoes-squad', (k) => 'avaliacoes-squad/__teste', () => ({ x: 1 })],
      ['naturezas-complementares-config', (k) => 'naturezas-complementares-config/TESTE_' + k.toUpperCase(), (e, k) => opcaoNat('TESTE_' + k.toUpperCase())],
    ];
    for (const [rotulo, email, , arq] of MATRIZ) {
      let leu = 0, gravou = 0;
      const k = emailKey(email);
      for (const [no, caminho, valor] of NOS_ARQ) {
        try { await assertSucceeds(db(email).ref(no).once('value')); leu++; } catch (e) { /* esperado para quem não tem */ }
        try { await assertSucceeds(db(email).ref(caminho(k)).set(valor(email, k))); gravou++; } catch (e) { /* idem */ }
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
    await assertSucceeds(db(AVAL).ref('motor-arquitetura-auditoria/rec1').set(audMotor('reconciliacao_versao_equivalente', AVAL)));
    await assertFails(db(AVAL).ref('motor-arquitetura-auditoria/rec2').set(audMotor('regra', AVAL)));
    for (const tipo of ['texto', 'sem_alteracao', 'conflito_publicacao']) {
      await assertFails(db(AVAL).ref('motor-arquitetura-auditoria/rec-' + tipo).set(audMotor(tipo, AVAL)));
    }
    anota('tipo "Avaliação": só acrescenta a linha de reconciliação (nunca outra auditoria)', true);
    await assertFails(db(AVAL).ref('motor-arquitetura-auditoria/rec1').set(audMotor('reconciliacao_versao_equivalente', AVAL, { versaoNova: 9 })));
    await assertFails(db(AVAL).ref('motor-arquitetura-auditoria/rec1').remove());
    await assertFails(db(AVAL).ref('motor-arquitetura-auditoria/rec3').set(audMotor('reconciliacao_versao_equivalente', AVAL, { equivalenciaComprovada: false })));
    anota('tipo "Avaliação": não reescreve nem apaga a própria linha de reconciliação, e não registra equivalência não comprovada', true);

    /* Cada asserção é registrada com nome e o teste SEGUE depois de uma falha — a prova inversa
       (regra antiga restaurada) mostra exatamente quais garantias deixam de valer. */
    async function espera(rotulo, deveGravar, promessa) {
      try {
        if (deveGravar) await assertSucceeds(promessa); else await assertFails(promessa);
        anota(rotulo, true);
      } catch (e) {
        anota(rotulo, false, (deveGravar ? 'recusou' : 'aceitou') + ' — ' + String((e && e.message) || e).split('\n')[0]);
      }
    }
    const lerSemRegras = async (caminho) => {
      let valor;
      await testEnv.withSecurityRulesDisabled(async (c) => { valor = (await c.database().ref(caminho).once('value')).val(); });
      return valor;
    };
    const QUEM_GRAVA_CONFIG = [['super-admin', SUPER], ['admin geral', ADMIN], ['tipo "Avaliação + Arquitetura"', ARQ]];
    const QUEM_NAO_GRAVA_CONFIG = [['tipo "Avaliação"', AVAL], ['perfil antigo GESTOR', GESTOR_ANTIGO], ['usuário comum', SEM_ACESSO], ['sem login', null]];

    console.log('\n== Auditorias de configuração: só ACRESCENTAR linha (questionários, motores, naturezas) ==');
    await semearBase();
    /* [rótulo, raiz, caminho de uma linha nova, linha válida, linha já existente, ancestrais que não podem ser apagados, linhas inválidas, outras recusas] */
    const AUDITORIAS = [
      ['questionarios-auditoria', 'questionarios-auditoria', (k) => 'questionarios-auditoria/' + QUEST + '/' + k, (e) => audQuest(e),
        'questionarios-auditoria/' + QUEST + '/a1', ['questionarios-auditoria/' + QUEST],
        [['sem a pergunta', audQuest(ARQ, { pergunta: null })], ['sem as versões', audQuest(ARQ, { versaoAnterior: null, novaVersao: null })],
          ['sem data', audQuest(ARQ, { dataHora: null })], ['qualquer objeto', { x: 1 }]],
        [['código de questionário inválido', 'questionarios-auditoria/minusculo/x1', audQuest(ARQ)]]],
      ['motor-arquitetura-auditoria', 'motor-arquitetura-auditoria', (k) => 'motor-arquitetura-auditoria/' + k, (e) => audMotor('regra', e),
        'motor-arquitetura-auditoria/a1', [],
        [['tipo desconhecido', audMotor('regra', ARQ, { tipo: 'inventado' })], ['regra sem o campo', audMotor('regra', ARQ, { campo: null })],
          ['regra sem as versões', audMotor('regra', ARQ, { versaoAnterior: null })], ['conflito com origem desconhecida', audMotor('conflito_publicacao', ARQ, { origem: 'outra' })],
          ['sem data', audMotor('sem_alteracao', ARQ, { dataHora: null })], ['qualquer objeto', { x: 1 }]], []],
      ['motor-squad-auditoria', 'motor-squad-auditoria', (k) => 'motor-squad-auditoria/' + k, (e) => audMotor('regra', e),
        'motor-squad-auditoria/a1', [],
        [['tipo desconhecido', audMotor('regra', ARQ, { tipo: 'inventado' })], ['reconciliação (só existe no motor de arquitetura)', audMotor('reconciliacao_versao_equivalente', ARQ)],
          ['texto sem os valores', audMotor('texto', ARQ, { valorAnterior: null, valorNovo: null })], ['conflito sem a versão atual', audMotor('conflito_publicacao', ARQ, { versaoAtual: null })],
          ['qualquer objeto', { x: 1 }]], []],
      ['naturezas-complementares-auditoria (catálogo)', 'naturezas-complementares-auditoria', (k) => 'naturezas-complementares-auditoria/catalogo/' + k, (e) => audNatCat('PROGRAMA_TRANSVERSAL', 'ordem', e),
        'naturezas-complementares-auditoria/catalogo/c1', ['naturezas-complementares-auditoria/catalogo'],
        [['linha de avaliação no catálogo', audNatAval('conc1', ARQ)], ['campo fora dos quatro', audNatCat('PROGRAMA_TRANSVERSAL', 'codigoEstavel')],
          ['código inválido', audNatCat('minusculo', 'nome')], ['sem data', audNatCat('PROGRAMA_TRANSVERSAL', 'nome', ARQ, { dataHora: null })], ['qualquer objeto', { x: 1 }]], []],
      ['naturezas-complementares-auditoria (avaliação)', 'naturezas-complementares-auditoria', (k) => 'naturezas-complementares-auditoria/conc1/' + k, (e) => audNatAval('conc1', e),
        'naturezas-complementares-auditoria/conc1/p1', ['naturezas-complementares-auditoria/conc1'],
        [['avaliacaoId diferente da chave', audNatAval('rasc1', ARQ)], ['linha do catálogo', audNatCat('PROGRAMA_TRANSVERSAL', 'nome')],
          ['sem data', audNatAval('conc1', ARQ, { dataHora: null })], ['qualquer objeto', { x: 1 }]], []],
    ];
    for (const [rotulo, raiz, nova, valida, existente, ancestrais, invalidas, extras] of AUDITORIAS) {
      const antes = await lerSemRegras(existente);
      for (const [quemRot, email] of QUEM_GRAVA_CONFIG) {
        const k = 'n-' + emailKey(email);
        const r = rotulo + ' — ' + quemRot;
        await espera(r + ': acrescenta uma linha nova válida', true, db(email).ref(nova(k)).set(valida(email)));
        await espera(r + ': NÃO reescreve a linha que acabou de criar', false, db(email).ref(nova(k)).set(Object.assign(valida(email), { dataHora: '2030-01-01T00:00:00.000Z' })));
        await espera(r + ': NÃO reescreve uma linha existente', false, db(email).ref(existente).set(Object.assign({}, antes, { dataHora: '2030-01-01T00:00:00.000Z' })));
        await espera(r + ': NÃO altera um campo de uma linha existente', false, db(email).ref(existente + '/dataHora').set('2030-01-01T00:00:00.000Z'));
        await espera(r + ': NÃO apaga uma linha existente (remove)', false, db(email).ref(existente).remove());
        await espera(r + ': NÃO apaga uma linha existente (update com null)', false, db(email).ref(raiz).update({ [existente.slice(raiz.length + 1)]: null }));
        await espera(r + ': NÃO apaga o nó inteiro', false, db(email).ref(raiz).remove());
        await espera(r + ': NÃO sobrescreve o nó inteiro', false, db(email).ref(raiz).set({ x: valida(email) }));
        for (const anc of ancestrais) {
          await espera(r + ': NÃO apaga ' + anc, false, db(email).ref(anc).remove());
        }
        for (const [invRot, inv] of invalidas) {
          await espera(r + ': linha inválida recusada (' + invRot + ')', false, db(email).ref(nova(k + '-inv')).set(inv));
        }
        for (const [exRot, caminho, valor] of extras) {
          await espera(r + ': recusada (' + exRot + ')', false, db(email).ref(caminho).set(valor));
        }
      }
      const depois = await lerSemRegras(existente);
      anota(rotulo + ': a linha existente continua EXATAMENTE como estava', JSON.stringify(depois) === JSON.stringify(antes), JSON.stringify(depois));
      const daAvaliacao = /\(avaliação\)/.test(rotulo);
      for (const [quemRot, email] of QUEM_NAO_GRAVA_CONFIG) {
        /* a linha da natureza de UMA avaliação também é gravada pelo tipo "Avaliação" (quem edita a avaliação) — provado à parte */
        if (daAvaliacao && email === AVAL) continue;
        await espera(rotulo + ' — ' + quemRot + ': NÃO acrescenta linha', false, db(email).ref(nova('x-' + emailKey(email || 'anon'))).set(valida(email || ARQ)));
      }
    }
    /* todos os tipos que a aplicação grava são aceitos */
    for (const tipo of ['regra', 'texto', 'sem_alteracao', 'conflito_publicacao']) {
      await espera('motor-squad-auditoria: aceita o tipo ' + tipo, true, db(ARQ).ref('motor-squad-auditoria/t-' + tipo).set(audMotor(tipo)));
      await espera('motor-arquitetura-auditoria: aceita o tipo ' + tipo, true, db(ARQ).ref('motor-arquitetura-auditoria/t-' + tipo).set(audMotor(tipo)));
    }
    await espera('motor-arquitetura-auditoria: aceita a reconciliação gravada por admin', true, db(ADMIN).ref('motor-arquitetura-auditoria/t-rec').set(audMotor('reconciliacao_versao_equivalente', ADMIN)));
    await espera('motor-squad-auditoria: aceita conflito de no-op', true, db(ARQ).ref('motor-squad-auditoria/t-noop').set(audMotor('conflito_publicacao', ARQ, { origem: 'tentativa_noop' })));
    /* valor anterior/usuário ausentes (a aplicação grava null → o campo não existe) continuam aceitos */
    await espera('questionarios-auditoria: aceita linha sem valor anterior (campo novo)', true, db(ARQ).ref('questionarios-auditoria/' + QUEST + '/sem-ant').set(audQuest(ARQ, { valorAnterior: null })));
    await espera('motor-squad-auditoria: aceita linha sem usuário (sessão ausente grava null)', true, db(ARQ).ref('motor-squad-auditoria/sem-usu').set(audMotor('sem_alteracao', ARQ, { usuario: null })));
    /* tipo "Avaliação": grava a linha da avaliação, nunca o catálogo, e não reescreve a própria linha */
    await espera('naturezas-auditoria — tipo "Avaliação": acrescenta linha da avaliação', true, db(AVAL).ref('naturezas-complementares-auditoria/conc1/av1').set(audNatAval('conc1', AVAL)));
    await espera('naturezas-auditoria — tipo "Avaliação": NÃO reescreve a própria linha', false, db(AVAL).ref('naturezas-complementares-auditoria/conc1/av1').set(audNatAval('conc1', AVAL, { valorNovo: null })));
    await espera('naturezas-auditoria — tipo "Avaliação": NÃO apaga a linha', false, db(AVAL).ref('naturezas-complementares-auditoria/conc1/av1').remove());
    await espera('naturezas-auditoria — tipo "Avaliação": NÃO grava no catálogo', false, db(AVAL).ref('naturezas-complementares-auditoria/catalogo/av2').set(audNatCat('PROGRAMA_TRANSVERSAL', 'nome', AVAL)));
    /* leitura: a trilha de UMA avaliação é lida pela ficha (tipo "Avaliação"); o catálogo e o nó inteiro, só por quem administra */
    await espera('naturezas-auditoria — tipo "Avaliação": lê a trilha da avaliação', true, db(AVAL).ref('naturezas-complementares-auditoria/conc1').once('value'));
    await espera('naturezas-auditoria — tipo "Avaliação": NÃO lê a auditoria do catálogo', false, db(AVAL).ref('naturezas-complementares-auditoria/catalogo').once('value'));
    await espera('naturezas-auditoria — tipo "Avaliação": NÃO lê o nó inteiro', false, db(AVAL).ref('naturezas-complementares-auditoria').once('value'));
    for (const [quemRot, email] of QUEM_GRAVA_CONFIG) {
      await espera('naturezas-auditoria — ' + quemRot + ': lê o nó inteiro (catálogo incluído)', true, db(email).ref('naturezas-complementares-auditoria').once('value'));
    }
    for (const [quemRot, email] of [['perfil antigo GESTOR', GESTOR_ANTIGO], ['usuário comum', SEM_ACESSO], ['sem login', null]]) {
      await espera('naturezas-auditoria — ' + quemRot + ': NÃO lê a trilha de uma avaliação', false, db(email).ref('naturezas-complementares-auditoria/conc1').once('value'));
    }
    /* gravações conjuntas, exatamente como a aplicação faz (config + linhas de auditoria num único update) */
    const pubQuest = {};
    pubQuest['questionarios-config/' + QUEST + '/versaoPublicada'] = 2;
    pubQuest['questionarios-config/' + QUEST + '/versoes/2'] = { perguntas: [{ codigoEstavel: 'P5', texto: 'depois' }], publicadoEm: '2026-10-01T10:00:00.000Z', publicadoPor: quem(ARQ) };
    pubQuest['questionarios-config/' + QUEST + '/rascunho'] = null;
    pubQuest['questionarios-auditoria/' + QUEST + '/pub1'] = audQuest(ARQ);
    pubQuest['questionarios-auditoria/' + QUEST + '/pub2'] = audQuest(ARQ, { campo: 'titulo', valorAnterior: null });
    await espera('questionários: publicar (config + auditoria num único update) continua gravando', true, db(ARQ).ref().update(pubQuest));
    const textos = {};
    textos['motor-squad-config/textos/ADEQUADO'] = { rotulo: 'Adequado', interpretacao: 'x' };
    textos['motor-squad-auditoria/tx1'] = audMotor('texto');
    await espera('motor-squad: salvar textos (config + auditoria num único update) continua gravando', true, db(ARQ).ref().update(textos));
    const textosArq = {};
    textosArq['motor-arquitetura-config/textos/canal'] = { rotulo: 'Canal' };
    textosArq['motor-arquitetura-auditoria/tx1'] = audMotor('texto', ADMIN);
    await espera('motor de arquitetura: salvar textos (config + auditoria num único update) continua gravando', true, db(ADMIN).ref().update(textosArq));
    const sobrescreve = {};
    sobrescreve['motor-squad-config/textos/ADEQUADO'] = { rotulo: 'Outro' };
    sobrescreve['motor-squad-auditoria/a1'] = audMotor('texto');
    await espera('motor-squad: update que reescreve uma linha antiga junto com a config é recusado INTEIRO', false, db(ARQ).ref().update(sobrescreve));
    anota('…e a config não mudou (nada do update recusado entrou)', ((await lerSemRegras('motor-squad-config/textos/ADEQUADO')) || {}).rotulo === 'Adequado');

    console.log('\n== Catálogo de naturezas (naturezas-complementares-config): opção válida, código imutável, nunca apagada ==');
    await semearBase();
    const NAT = 'naturezas-complementares-config';
    for (const [quemRot, email] of QUEM_GRAVA_CONFIG) {
      const cod = 'NOVA_' + emailKey(email).toUpperCase();
      const opc = (extra) => opcaoNat(cod, Object.assign({ atualizadoPor: quem(email) }, extra || {}));
      await espera(quemRot + ': cria opção nova', true, db(email).ref(NAT + '/' + cod).set(opc()));
      await espera(quemRot + ': renomeia (objeto inteiro, como a tela)', true, db(email).ref(NAT + '/' + cod).set(opc({ nome: 'Nome novo' })));
      await espera(quemRot + ': desativa', true, db(email).ref(NAT + '/' + cod).set(opc({ nome: 'Nome novo', ativo: false })));
      await espera(quemRot + ': reativa e reordena', true, db(email).ref(NAT + '/' + cod).set(opc({ nome: 'Nome novo', ativo: true, ordem: 7 })));
      await espera(quemRot + ': altera só um campo (ordem)', true, db(email).ref(NAT + '/' + cod + '/ordem').set(8));
      await espera(quemRot + ': grava opção com descrição vazia e sem autor (sessão ausente)', true, db(email).ref(NAT + '/' + cod).set({ codigoEstavel: cod, nome: 'Só o básico', descricao: '', ativo: true, ordem: 0 }));
    }
    /* exatamente o que naturezas-config.js salvarOpcao grava: a opção + uma linha por campo alterado, num único update */
    const salvar = {};
    salvar[NAT + '/PROGRAMA_TRANSVERSAL'] = opcaoNat('PROGRAMA_TRANSVERSAL', { nome: 'Programa transversal (novo)', ativo: false, ordem: 2 });
    salvar['naturezas-complementares-auditoria/catalogo/s1'] = audNatCat('PROGRAMA_TRANSVERSAL', 'nome', ARQ, { valorAnterior: 'Programa transversal', valorNovo: 'Programa transversal (novo)' });
    salvar['naturezas-complementares-auditoria/catalogo/s2'] = audNatCat('PROGRAMA_TRANSVERSAL', 'ativo', ARQ, { valorAnterior: true, valorNovo: false });
    salvar['naturezas-complementares-auditoria/catalogo/s3'] = audNatCat('PROGRAMA_TRANSVERSAL', 'ordem', ARQ, { valorAnterior: 1, valorNovo: 2 });
    salvar['naturezas-complementares-auditoria/catalogo/s4'] = audNatCat('PROGRAMA_TRANSVERSAL', 'descricao', ARQ, { valorAnterior: null, valorNovo: '' });
    await espera('salvar opção como a tela (opção + auditoria do catálogo num único update)', true, db(ARQ).ref().update(salvar));
    for (const cod of ['minusculo', '1COMECA_COM_NUMERO', 'COM-HIFEN', '_SUBLINHADO', 'A'.repeat(61)]) {
      await espera('código inválido recusado: "' + (cod.length > 20 ? cod.slice(0, 8) + '…(' + cod.length + ' caracteres)' : cod) + '"', false, db(ADMIN).ref(NAT + '/' + cod).set(opcaoNat(cod)));
    }
    await espera('código com 60 caracteres (o máximo da tela) é aceito', true, db(ADMIN).ref(NAT + '/' + 'A'.repeat(60)).set(opcaoNat('A'.repeat(60))));
    await espera('codigoEstavel diferente da chave na criação é recusado', false, db(ADMIN).ref(NAT + '/OUTRA_CHAVE').set(opcaoNat('PROGRAMA_TRANSVERSAL')));
    await espera('codigoEstavel não pode ser trocado (objeto inteiro)', false, db(ADMIN).ref(NAT + '/PROGRAMA_TRANSVERSAL').set(opcaoNat('OUTRO_CODIGO')));
    await espera('codigoEstavel não pode ser trocado (só o campo)', false, db(ADMIN).ref(NAT + '/PROGRAMA_TRANSVERSAL/codigoEstavel').set('OUTRO_CODIGO'));
    await espera('codigoEstavel não pode ser apagado', false, db(ADMIN).ref(NAT + '/PROGRAMA_TRANSVERSAL/codigoEstavel').remove());
    await espera('opção não pode ser apagada (remove)', false, db(ADMIN).ref(NAT + '/PROGRAMA_TRANSVERSAL').remove());
    await espera('opção não pode ser apagada (update com null)', false, db(ADMIN).ref(NAT).update({ PROGRAMA_TRANSVERSAL: null }));
    await espera('o catálogo inteiro não pode ser apagado', false, db(SUPER).ref(NAT).remove());
    await espera('o catálogo inteiro não pode ser sobrescrito', false, db(SUPER).ref(NAT).set({ SO_ESTA: opcaoNat('SO_ESTA') }));
    await espera('campo desconhecido recusado', false, db(ADMIN).ref(NAT + '/PROGRAMA_TRANSVERSAL').set(opcaoNat('PROGRAMA_TRANSVERSAL', { cor: 'azul' })));
    await espera('campo desconhecido recusado (gravado sozinho)', false, db(ADMIN).ref(NAT + '/PROGRAMA_TRANSVERSAL/cor').set('azul'));
    await espera('sem nome recusado', false, db(ADMIN).ref(NAT + '/SEM_NOME').set(opcaoNat('SEM_NOME', { nome: null })));
    await espera('nome vazio recusado', false, db(ADMIN).ref(NAT + '/NOME_VAZIO').set(opcaoNat('NOME_VAZIO', { nome: '' })));
    await espera('sem "ativo" recusado', false, db(ADMIN).ref(NAT + '/SEM_ATIVO').set(opcaoNat('SEM_ATIVO', { ativo: null })));
    await espera('"ativo" que não é verdadeiro/falso recusado', false, db(ADMIN).ref(NAT + '/ATIVO_TEXTO').set(opcaoNat('ATIVO_TEXTO', { ativo: 'sim' })));
    await espera('sem "ordem" recusado', false, db(ADMIN).ref(NAT + '/SEM_ORDEM').set(opcaoNat('SEM_ORDEM', { ordem: null })));
    await espera('"ordem" que não é número recusada', false, db(ADMIN).ref(NAT + '/ORDEM_TEXTO').set(opcaoNat('ORDEM_TEXTO', { ordem: '1' })));
    await espera('valor que não é objeto recusado', false, db(ADMIN).ref(NAT + '/SO_TEXTO').set('Programa'));
    for (const [quemRot, email] of QUEM_NAO_GRAVA_CONFIG) {
      await espera(quemRot + ': NÃO cria opção', false, db(email).ref(NAT + '/DE_FORA').set(opcaoNat('DE_FORA')));
      await espera(quemRot + ': NÃO altera opção', false, db(email).ref(NAT + '/PROGRAMA_TRANSVERSAL/ativo').set(true));
    }
    await espera('tipo "Avaliação": continua lendo o catálogo (a ficha usa)', true, db(AVAL).ref(NAT).once('value'));
    const pt = await lerSemRegras(NAT + '/PROGRAMA_TRANSVERSAL');
    anota('PROGRAMA_TRANSVERSAL continua existindo, com o mesmo código, depois de todas as tentativas', !!pt && pt.codigoEstavel === 'PROGRAMA_TRANSVERSAL' && pt.nome === 'Programa transversal (novo)', JSON.stringify(pt));

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
