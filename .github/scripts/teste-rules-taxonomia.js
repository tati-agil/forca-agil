/* ═════════════════════════════════════════════════════════════════
   Regras do banco da TAXONOMIA (taxonomia/arquitetural, taxonomia/organizacional, taxonomia/meta).

   Roda contra o EMULADOR real do Realtime Database (firebase emulators:exec) — o mesmo
   database.rules.json que vai para produção, nunca uma reimplementação em JS.

   O que se prova:
   1. DEFINIÇÃO OFICIAL VERSIONADA (modelo simplificado): admin publica versão 1, 2…; publicar sobre versão
      desatualizada é recusado; a definição não se apaga; o histórico não se reescreve; fontes e o ponteiro antigo
      não se gravam mais. (Concorrência, clique repetido, migração e reversão: teste-rules-taxonomia-definicoes.js.)
   3. ATOMICIDADE: um update multipath com conceito + definição + auditoria é rejeitado POR INTEIRO se qualquer parte
      viola a regra (sem estado parcial).
   4. AUDITORIA: só admin; só acréscimo (sem alterar nem apagar); e-mail do evento = usuário autenticado.
   5. PERFIL: ausência é ESTADO, nunca campo vazio. `registrado` exige valor + papel + origem; os demais
      estados não têm valor, papel nem origem.
   7. AUTORIZAÇÃO: nesta 1ª versão leitura, escrita e auditoria só para admin (o mesmo conceito de admin
      do sistema: e-mails fixos + fa-admins). Perfis da Avaliação (inclusive "Avaliação + Configuração")
      NÃO entram.
   ═════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const TD = require(path.join(__dirname, '..', '..', 'forca-agil', 'taxonomia-definicao.js'));

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

const SUPER = 'tatianefdirene@previ.com.br';           /* e-mail fixo de admin */
const ADMIN = 'admin.geral@previ.com.br';                /* fa-admins */
const AVAL = 'avaliacao@previ.com.br';                   /* tipo 'avaliacao' */
const ARQ = 'arquitetura@previ.com.br';                  /* tipo 'avaliacao-arquitetura' */
const SEM_ACESSO = 'sem.acesso@previ.com.br';

const ORG = 'taxonomia/organizacional';
const ARQT = 'taxonomia/arquitetural';

async function main() {
  const regrasArq = process.env.RULES_PATH || path.join(__dirname, '..', '..', 'database.rules.json');
  const rules = fs.readFileSync(regrasArq, 'utf8');
  const testEnv = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-taxonomia', database: { rules } });
  const ctx = (email) => (email ? testEnv.authenticatedContext(emailKey(email), { email }) : testEnv.unauthenticatedContext());
  const db = (email) => ctx(email).database();
  const semear = (fn) => testEnv.withSecurityRulesDisabled((c) => fn(c.database()));
  /* withSecurityRulesDisabled não devolve o retorno do callback: captura por fora */
  const ler = async (caminho) => { let v; await semear(async (a) => { v = (await a.ref(caminho).once('value')).val(); }); return v; };

  async function pode(rotulo, promessa) { try { await assertSucceeds(promessa); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi NEGADO: ' + String(e.message || e).slice(0, 140)); } }
  async function nega(rotulo, promessa) { try { await assertFails(promessa); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi PERMITIDO (deveria negar)'); } }

  const conceito = (extra) => Object.assign({ nome: 'Conceito', ordem: 1, ativo: true, camada: 'B' }, extra || {});
  const def = (texto, versao) => ({ texto, versao, publicadaEm: '2026-10-03T10:00:00.000Z', publicadaPor: ADMIN });
  const fonte = (situacao, extra) => Object.assign({ texto: 'Texto da fonte.', contexto: 'PREVI', situacao, tipoRedacao: 'Conceito' }, extra || {});
  const auditoria = (email, extra) => Object.assign({ tipo: 'alteracao_conceito', conceito: 'C1', usuario: { nome: 'Alguém', email }, dataHora: '2026-10-03T10:00:00.000Z' }, extra || {});

  /* Estado-base: C1 (organizacional), com ou sem definição vigente; atributos no catálogo.
     Semeado FORA das regras (é o estado de partida de cada cenário). */
  async function semearBase(opcoes) {
    opcoes = opcoes || {};
    await testEnv.clearDatabase();
    await semear(async (a) => {
      await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: ADMIN });
      await a.ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
      await a.ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
      await a.ref(ORG + '/conceitos/LINHA').set(conceito({ nome: 'Linha', camada: 'A' }));
      await a.ref(ORG + '/conceitos/C1').set(conceito({ pai: 'LINHA' }));
      await a.ref(ORG + '/atributos/ALCANCE').set({ nome: 'Alcance de atuação', grupo: 'alcance', tipoValor: 'lista', ordem: 1, ativo: true });
      await a.ref(ARQT + '/conceitos/componente').set({ nome: 'Componente', ordem: 1, ativo: true });
      if (opcoes.definicao) {
        await a.ref(ORG + '/conceitos/C1/definicao').set(def('Definição v1.', 1));
        await a.ref(ORG + '/definicoes/C1/v1').set(Object.assign(def('Definição v1.', 1), { origem: 'publicacao' }));
      }
    });
  }
  const admin = () => db(ADMIN);
  const R = (a, p) => a.ref(p);

  /* ───────────────────────── 1. DEFINIÇÃO VERSIONADA ───────────────────────── */
  console.log('== 1. definição oficial versionada ==');
  await semearBase();
  const pubC1 = (email, atual, texto) => TD.payloadPublicacao({ dom: 'organizacional', codigo: 'C1', atual, novoTexto: texto, email, agora: new Date().toISOString(), audKey: 'k' + Math.random().toString(36).slice(2, 10) }).caminhos;
  await pode('admin publica a versão 1 (definição + histórico + auditoria numa gravação)', admin().ref().update(pubC1(ADMIN, null, 'Definição v1.')));
  const v1 = await ler(ORG + '/conceitos/C1/definicao');
  await pode('admin publica a versão 2', admin().ref().update(pubC1(ADMIN, v1, 'Definição v2.')));
  await nega('publicar de novo sobre a versão 1 (desatualizada): recusado', admin().ref().update(pubC1(ADMIN, v1, 'Outra v2.')));
  await nega('a definição vigente não se apaga', R(admin(), ORG + '/conceitos/C1/definicao').remove());
  await nega('o histórico não se reescreve', R(admin(), ORG + '/definicoes/C1/v1/texto').set('Reescrito'));
  await nega('fontes (modelo antigo) não se gravam mais', R(admin(), ORG + '/fontes/C1/F1').set(fonte('em validação')));
  await nega('o ponteiro antigo não se grava mais', R(admin(), ORG + '/conceitos/C1/definicaoVigenteFonteId').set('F1'));
  await nega('situacaoDefinicao (modelo antigo) não se grava mais', R(admin(), ORG + '/conceitos/C1/situacaoDefinicao').set('registrada'));

  /* ───────────────────────── 3. ATOMICIDADE ───────────────────────── */
  console.log('\n== 3. atomicidade do multipath (conceito + definição + auditoria) ==');
  await semearBase({ definicao: true });
  const antes = JSON.stringify(await ler('taxonomia'));
  const base1 = await ler(ORG + '/conceitos/C1/definicao');
  const comAutor = (w, email) => { Object.keys(w).forEach((k) => { if (/\/auditoria\//.test(k)) w[k].usuario = { email }; }); return w; };
  await nega('conceito + definição + auditoria com e-mail FALSIFICADO: rejeitado por inteiro', admin().ref().update(Object.assign(comAutor(pubC1(ADMIN, base1, 'Nova.'), 'outra.pessoa@previ.com.br'), { [ORG + '/conceitos/C1/nome']: 'Nome novo' })));
  anota('nada foi gravado (nenhum estado parcial)', JSON.stringify(await ler('taxonomia')) === antes);
  await nega('a parte inválida é o CONCEITO (campo desconhecido): definição e auditoria também não entram', admin().ref().update(Object.assign(pubC1(ADMIN, base1, 'Nova.'), { [ORG + '/conceitos/C1/campoInventado']: 'x' })));
  anota('nada foi gravado', JSON.stringify(await ler('taxonomia')) === antes);
  await pode('as partes válidas entram TODAS juntas', admin().ref().update(Object.assign(pubC1(ADMIN, base1, 'Nova definição.'), { [ORG + '/conceitos/C1/nome']: 'Nome novo' })));
  anota('conceito, definição, histórico e auditoria gravados', (await ler(ORG + '/conceitos/C1/nome')) === 'Nome novo' && (await ler(ORG + '/conceitos/C1/definicao/versao')) === 2 && !!(await ler(ORG + '/definicoes/C1/v2')));

  /* ───────────────────────── 4. AUDITORIA ───────────────────────── */
  console.log('\n== 4. auditoria ==');
  await semearBase();
  await pode('admin (e-mail fixo) cria uma linha de auditoria', R(db(SUPER), ORG + '/auditoria/C1/e1').set(auditoria(SUPER)));
  await pode('admin (fa-admins) cria uma linha de auditoria', R(admin(), ORG + '/auditoria/C1/e2').set(auditoria(ADMIN)));
  await pode('auditoria de catálogo (_catalogo)', R(admin(), ORG + '/auditoria/_catalogo/e3').set(auditoria(ADMIN, { tipo: 'alteracao_atributo' })));
  await pode('auditoria do domínio arquitetural', R(admin(), ARQT + '/auditoria/componente/e4').set(auditoria(ADMIN, { conceito: 'componente' })));
  await nega('(10) falsificar autoria: e-mail do evento diferente do usuário autenticado', R(admin(), ORG + '/auditoria/C1/f1').set(auditoria('outra.pessoa@previ.com.br')));
  await nega('autoria sem e-mail', R(admin(), ORG + '/auditoria/C1/f2').set(auditoria(ADMIN, { usuario: { nome: 'Sem e-mail' } })));
  await nega('tipo de evento desconhecido', R(admin(), ORG + '/auditoria/C1/f3').set(auditoria(ADMIN, { tipo: 'invencao' })));
  await nega('alterar um evento ANTIGO', R(admin(), ORG + '/auditoria/C1/e2').set(auditoria(ADMIN, { campo: 'adulterado' })));
  await nega('alterar só um campo de um evento antigo', R(admin(), ORG + '/auditoria/C1/e2/dataHora').set('2020-01-01T00:00:00.000Z'));
  await nega('EXCLUIR um evento', R(admin(), ORG + '/auditoria/C1/e2').remove());
  await nega('excluir TODA a auditoria de um conceito', R(admin(), ORG + '/auditoria/C1').remove());
  await nega('"Avaliação + Configuração" não escreve auditoria', R(db(ARQ), ORG + '/auditoria/C1/g1').set(auditoria(ARQ)));
  await nega('"Avaliação" não escreve auditoria', R(db(AVAL), ORG + '/auditoria/C1/g2').set(auditoria(AVAL)));
  await nega('usuário comum não escreve auditoria', R(db(SEM_ACESSO), ORG + '/auditoria/C1/g3').set(auditoria(SEM_ACESSO)));
  await nega('sem login não escreve auditoria', R(db(null), ORG + '/auditoria/C1/g4').set(auditoria(SEM_ACESSO)));
  await pode('admin LÊ a auditoria', R(admin(), ORG + '/auditoria/C1').once('value'));
  for (const [rotulo, email] of [['"Avaliação + Configuração"', ARQ], ['"Avaliação"', AVAL], ['usuário comum', SEM_ACESSO], ['sem login', null]]) {
    await nega(rotulo + ' NÃO lê a auditoria', R(db(email), ORG + '/auditoria/C1').once('value'));
  }

  /* ───────────────────────── 5. PERFIL ───────────────────────── */
  console.log('\n== 5. perfil: ausência é estado, nunca campo vazio ==');
  await semearBase();
  const P = (a, atributo, valor) => R(a, ORG + '/perfis/C1/' + atributo).set(valor);
  await pode('registrado COM valor + papel + origem', P(admin(), 'ALCANCE', { estado: 'registrado', valor: 'transversal', papel: 'observado', origem: 'fonte' }));
  await nega('registrado SEM valor', P(admin(), 'ALCANCE', { estado: 'registrado', papel: 'observado', origem: 'fonte' }));
  await nega('registrado SEM papel', P(admin(), 'ALCANCE', { estado: 'registrado', valor: 'transversal', origem: 'fonte' }));
  await nega('registrado SEM origem', P(admin(), 'ALCANCE', { estado: 'registrado', valor: 'transversal', papel: 'observado' }));
  await nega('registrado com valor VAZIO ("")', P(admin(), 'ALCANCE', { estado: 'registrado', valor: '', papel: 'observado', origem: 'fonte' }));
  for (const origem of ['fonte', 'inferência', 'decisão']) await pode('origem "' + origem + '" aceita', P(admin(), 'ALCANCE', { estado: 'registrado', valor: 'v', papel: 'definidor', origem }));
  await nega('origem fora da lista', P(admin(), 'ALCANCE', { estado: 'registrado', valor: 'v', papel: 'definidor', origem: 'palpite' }));
  for (const papel of ['definidor', 'típico', 'observado']) await pode('papel "' + papel + '" aceito', P(admin(), 'ALCANCE', { estado: 'registrado', valor: 'v', papel, origem: 'fonte' }));
  await nega('papel fora da lista', P(admin(), 'ALCANCE', { estado: 'registrado', valor: 'v', papel: 'principal', origem: 'fonte' }));
  for (const estado of ['não consta na fonte', 'não aplicável', 'ainda não definido', 'fonte não localizada']) {
    await pode('estado "' + estado + '" SEM valor e SEM origem (origem não é exigida)', P(admin(), 'ALCANCE', { estado }));
    await nega('estado "' + estado + '" COM valor preenchido', P(admin(), 'ALCANCE', { estado, valor: 'algo' }));
    await nega('estado "' + estado + '" COM valor vazio (campo vazio não representa ausência)', P(admin(), 'ALCANCE', { estado, valor: '' }));
    await nega('estado "' + estado + '" COM origem', P(admin(), 'ALCANCE', { estado, origem: 'fonte' }));
    await nega('estado "' + estado + '" COM papel', P(admin(), 'ALCANCE', { estado, papel: 'observado' }));
  }
  await nega('estado desconhecido', P(admin(), 'ALCANCE', { estado: 'talvez' }));
  await nega('"inferência" NÃO é estado (só origem)', P(admin(), 'ALCANCE', { estado: 'inferência' }));
  await nega('perfil sem estado (objeto vazio / só valor)', P(admin(), 'ALCANCE', { valor: 'x' }));
  await nega('perfil de atributo que NÃO existe no catálogo', P(admin(), 'INEXISTENTE', { estado: 'ainda não definido' }));
  await nega('perfil de conceito que NÃO existe', R(admin(), ORG + '/perfis/SEM_CONCEITO/ALCANCE').set({ estado: 'ainda não definido' }));
  await nega('perfil com campo desconhecido', P(admin(), 'ALCANCE', { estado: 'ainda não definido', extra: 1 }));
  await nega('o domínio arquitetural NÃO tem perfis', R(admin(), ARQT + '/perfis/componente/ALCANCE').set({ estado: 'ainda não definido' }));

  console.log('\n== 7. conceito, atributo, relação e carga inicial ==');
  await semearBase();
  await nega('conceito organizacional NOVO com pai, sem a entrada no índice de filhos', R(admin(), ORG + '/conceitos/NOVO').set(conceito({ nome: 'Novo', pai: 'LINHA' })));
  await pode('conceito organizacional válido (com a entrada filhos/<pai>/<filho> na mesma gravação)', admin().ref().update({ [ORG + '/conceitos/NOVO']: conceito({ nome: 'Novo', pai: 'LINHA' }), [ORG + '/filhos/LINHA/NOVO']: true }));
  await pode('conceito sem situacaoDefinicao (modelo simplificado: a definição é conceito.definicao)', R(admin(), ORG + '/conceitos/N2').set({ nome: 'x', ordem: 1, ativo: true, camada: 'A' }));
  await nega('situacaoDefinicao (campo do modelo antigo) é recusado', R(admin(), ORG + '/conceitos/N3').set(conceito({ situacaoDefinicao: 'registrada' })));
  await nega('conceito organizacional sem camada', R(admin(), ORG + '/conceitos/N4').set({ nome: 'x', ordem: 1, ativo: true }));
  await nega('camada desconhecida', R(admin(), ORG + '/conceitos/N5').set(conceito({ camada: 'Z' })));
  await nega('"pai" que não existe', R(admin(), ORG + '/conceitos/N6').set(conceito({ pai: 'FANTASMA' })));
  await nega('código de conceito inválido', R(admin(), ORG + '/conceitos/_x').set(conceito()));
  await nega('conceito com campo desconhecido', R(admin(), ORG + '/conceitos/N7').set(conceito({ abrangencia: 'x' })));
  await pode('conceito arquitetural válido (sem camada)', R(admin(), ARQT + '/conceitos/canal').set({ nome: 'Canal', ordem: 9, ativo: true }));
  await nega('conceito arquitetural COM camada (campo do domínio organizacional)', R(admin(), ARQT + '/conceitos/regra').set({ nome: 'Regra', ordem: 1, ativo: true, camada: 'A' }));
  await nega('o domínio arquitetural NÃO tem atributos', R(admin(), ARQT + '/atributos/X').set({ nome: 'x', grupo: 'alcance', tipoValor: 'texto', ordem: 1, ativo: true }));
  await nega('o domínio arquitetural NÃO tem relações', R(admin(), ARQT + '/relacoes/a__compoe__b').set({ de: 'a', tipo: 'compoe', para: 'b' }));
  await pode('atributo válido', R(admin(), ORG + '/atributos/FORMA').set({ nome: 'Forma de entrega/consumo', grupo: 'entrega', tipoValor: 'lista', ordem: 2, ativo: true, valoresPermitidos: { v1: { texto: 'serviço', ordem: 1 } } }));
  await nega('valor permitido de atributo sem "texto"', R(admin(), ORG + '/atributos/G3').set({ nome: 'x', grupo: 'alcance', tipoValor: 'lista', ordem: 1, ativo: true, valoresPermitidos: { v1: { ordem: 1 } } }));
  await pode('critérios do conceito (mapa ordenado)', R(admin(), ORG + '/conceitos/C1/criterios').set({ k1: { texto: 'Critério 1', ordem: 1 } }));
  await nega('critério sem ordem', R(admin(), ORG + '/conceitos/C1/criterios/k2').set({ texto: 'Critério 2' }));
  await pode('pergunta discriminadora e nota de aplicação', R(admin(), ORG + '/conceitos/C1').update({ perguntaDiscriminadora: 'Pergunta?', notaDeAplicacao: 'Nota de aplicação.', ordemDaPergunta: 7 }));
  await nega('atributo com grupo desconhecido', R(admin(), ORG + '/atributos/G2').set({ nome: 'x', grupo: 'abrangencia', tipoValor: 'texto', ordem: 1, ativo: true }));
  /* Etapa 5: relação nova exige histórico nas duas pontas na MESMA gravação (provado em teste-rules-taxonomia-governanca.js);
     a forma antiga — só { de, tipo, para } — passa a ser recusada fora da carga inicial. */
  await nega('relação SEM histórico (só de/tipo/para, fora da carga inicial) é recusada', R(admin(), ORG + '/relacoes/C1__compoe__LINHA').set({ de: 'C1', tipo: 'compoe', para: 'LINHA' }));
  await nega('relação com chave diferente da combinação', R(admin(), ORG + '/relacoes/qualquer').set({ de: 'C1', tipo: 'compoe', para: 'LINHA' }));
  await nega('relação com tipo desconhecido', R(admin(), ORG + '/relacoes/C1__herda__LINHA').set({ de: 'C1', tipo: 'herda', para: 'LINHA' }));
  await nega('relação para conceito inexistente', R(admin(), ORG + '/relacoes/C1__compoe__FANTASMA').set({ de: 'C1', tipo: 'compoe', para: 'FANTASMA' }));
  await pode('carga inicial: grava a marca UMA vez', R(admin(), 'taxonomia/meta/cargaInicial').set({ feitaEm: '2026-10-03T10:00:00.000Z', feitaPor: ADMIN }));
  await nega('carga inicial: NOVA carga é recusada pelo banco', R(admin(), 'taxonomia/meta/cargaInicial').set({ feitaEm: '2026-10-04T10:00:00.000Z', feitaPor: ADMIN }));
  await nega('carga inicial: marca com autor diferente do autenticado', R(db(SUPER), 'taxonomia/meta/cargaInicial2').set({ feitaEm: 'x', feitaPor: ADMIN }));

  /* ───────────────────────── 8. AUTORIZAÇÃO ───────────────────────── */
  console.log('\n== 8. autorização: só admin lê e escreve ==');
  await semearBase({ definicao: true });
  await semear(async (a) => {
    await a.ref(ORG + '/perfis/C1/ALCANCE').set({ estado: 'ainda não definido' });
    await a.ref(ORG + '/relacoes/C1__compoe__LINHA').set({ de: 'C1', tipo: 'compoe', para: 'LINHA' });
    await a.ref(ORG + '/auditoria/C1/e1').set(auditoria(ADMIN));
    await a.ref('taxonomia/meta/cargaInicial').set({ feitaEm: 'x', feitaPor: ADMIN });
  });
  const LEITURAS = [ORG + '/conceitos', ORG + '/conceitos/C1', ORG + '/definicoes/C1', ORG + '/atributos', ORG + '/perfis/C1', ORG + '/relacoes', ORG + '/auditoria/C1', ARQT + '/conceitos', 'taxonomia/meta/cargaInicial', 'taxonomia'];
  for (const [rotulo, email] of [['admin (e-mail fixo)', SUPER], ['admin (fa-admins)', ADMIN]]) {
    for (const cam of LEITURAS.filter((c) => c !== 'taxonomia')) await pode(rotulo + ' lê ' + cam, R(db(email), cam).once('value'));
    await pode(rotulo + ' escreve conceito', R(db(email), ORG + '/conceitos/C1/nome').set('Escrito por ' + rotulo));
  }
  await nega('a raiz "taxonomia" inteira não é lida em bloco (leitura é por ramo)', R(admin(), 'taxonomia').once('value'));
  for (const [rotulo, email] of [['"Avaliação + Configuração" (escreve naturezas, mas NÃO a Taxonomia)', ARQ], ['"Avaliação"', AVAL], ['usuário comum', SEM_ACESSO], ['sem login', null]]) {
    /* C4 (M6/M7 do Mapa): os perfis da Avaliação leem as relações conceituais (só leitura); quem não tem perfil, não */
    const perfilAvaliacao = email === ARQ || email === AVAL;
    for (const cam of LEITURAS.filter((c) => c !== 'taxonomia')) {
      if (perfilAvaliacao && cam === ORG + '/relacoes') await pode(rotulo + ' lê ' + cam + ' (C4, só leitura)', R(db(email), cam).once('value'));
      else await nega(rotulo + ' NÃO lê ' + cam, R(db(email), cam).once('value'));
    }
    await nega(rotulo + ' NÃO escreve relação conceitual', R(db(email), ORG + '/relacoes/C1__atende__LINHA').set({ de: 'C1', tipo: 'atende', para: 'LINHA' }));
    await nega(rotulo + ' NÃO escreve conceito', R(db(email), ORG + '/conceitos/C1/nome').set('invasão'));
    await nega(rotulo + ' NÃO publica definição', R(db(email), ORG + '/conceitos/C1/definicao/texto').set('invasão'));
    await nega(rotulo + ' NÃO escreve perfil', R(db(email), ORG + '/perfis/C1/ALCANCE').set({ estado: 'ainda não definido' }));
    await nega(rotulo + ' NÃO escreve no domínio arquitetural', R(db(email), ARQT + '/conceitos/componente/nome').set('invasão'));
  }

  /* ───────────────────────── 9. O QUE A APLICAÇÃO GRAVA, O BANCO ACEITA ─────────────────────────
     Roda o código REAL de forca-agil/taxonomia.js (as mesmas operações da tela) contra o emulador, com as
     regras de verdade e um admin autenticado. Se o payload de qualquer operação violar a regra, a operação
     dá erro (st.flash.erro) — "quem abre a edição consegue gravar" é provado aqui, não suposto. */
  console.log('\n== 9. As operações REAIS da aplicação passam nas regras reais ==');
  const vm = require('vm');
  const SRC_TAX = fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'taxonomia.js'), 'utf8');
  function carregarApp(email) {
    const dbEmu = db(email);
    const el = { addEventListener() {}, innerHTML: '', contains() { return true; }, querySelector() { return null; } };
    const c = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN, innerWidth: 1280 };
    c.window = c;
    c.fetch = fetch; c.URL = URL; /* a conferência do estado real usa REST (fora do SDK) */
    c.document = { getElementById: (id) => (id === 'adminTaxonomia' ? el : null), querySelector: () => null, addEventListener() {} };
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const tokenSemAssinatura = () => { const uid = emailKey(email), t = Math.floor(Date.now() / 1000);
      return b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ iss: 'https://securetoken.google.com/demo-kyber-agil-rules-taxonomia', aud: 'demo-kyber-agil-rules-taxonomia', sub: uid, user_id: uid, email, iat: t, auth_time: t, exp: t + 3600, firebase: { identities: {}, sign_in_provider: 'custom' } }) + '.'; };
    const hostEmu = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
    c.firebase = { database: () => dbEmu, auth: () => ({ currentUser: { email, getIdToken: () => Promise.resolve(tokenSemAssinatura()) } }),
      app: () => ({ options: { databaseURL: 'http://' + hostEmu + '?ns=demo-kyber-agil-rules-taxonomia-default-rtdb' } }) };
    c.window.faAuth = { getSession: () => ({ email, name: 'Admin Teste' }), isAdmin: () => true, isAdminReady: () => true };
    vm.createContext(c);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'taxonomia-definicao.js'), 'utf8'), c, { filename: 'taxonomia-definicao.js' });
    vm.runInContext(SRC_TAX, c, { filename: 'taxonomia.js' });
    c.window.faTaxonomia._dbTeste = dbEmu;
    return c.window.faTaxonomia;
  }
  const ate = async (cond, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 6000)) { if (cond()) return true; await new Promise((r) => setTimeout(r, 25)); } return false; };
  const arquivo = {
    dominios: {
      organizacional: {
        conceitos: { ALFA: { nome: 'Alfa', camada: 'A', ordem: 1 }, BETA: { nome: 'Beta', camada: 'B', pai: 'ALFA', ordem: 2, perguntaDiscriminadora: 'P?', notaDeAplicacao: 'N.', criterios: ['c1', 'c2'] }, DISC: { nome: 'Disc', camada: 'auxiliar', ordem: 3 } },
        fontes: {
          ALFA: [{ id: 'a1', texto: 'T vigente', contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' }, { id: 'a2', texto: 'T hist', contexto: 'BB', situacao: 'histórica/contextual', tipoRedacao: 'Significado v1' }],
          BETA: [{ id: 'b1', texto: 'T b1', contexto: 'BB', situacao: 'histórica/contextual', tipoRedacao: 'Significado v1' }, { id: 'b2', texto: 'T b2', contexto: 'indefinido', situacao: 'placeholder', tipoRedacao: 'Significado v2' }, { id: 'b3', texto: 'Proposta', contexto: 'PREVI', situacao: 'em validação', tipoRedacao: 'proposta' }]
        },
        atributos: { ALCANCE: { nome: 'Alcance de atuação', grupo: 'alcance', tipoValor: 'lista', ordem: 1, valoresPermitidos: ['específica', 'transversal'] }, BENEF: { nome: 'Beneficiário indireto', grupo: 'quem-recebe', tipoValor: 'texto', ordem: 2 } },
        perfis: { ALFA: { ALCANCE: { estado: 'registrado', valor: 'transversal', papel: 'observado', origem: 'decisão' }, BENEF: { estado: 'não consta na fonte' } } },
        relacoes: [{ de: 'BETA', tipo: 'compoe', para: 'ALFA' }, { de: 'ALFA', tipo: 'desenvolve-disciplina', para: 'DISC' }]
      },
      arquitetural: { conceitos: { componente: { nome: 'Componente', ordem: 1 } }, fontes: { componente: [{ id: 'c1', texto: 'Texto', contexto: 'PREVI', situacao: 'em validação', tipoRedacao: 'proposta' }] } }
    }
  };
  await testEnv.clearDatabase();
  await semear(async (a) => { await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: ADMIN }); });
  const app = carregarApp(ADMIN), I = app._interno;
  const prep = app.prepararImportacao(arquivo, { organizacional: {}, arquitetural: {} });
  anota('importador: o arquivo fictício é válido (sem erros)', prep.erros.length === 0, prep.erros.join(' | '));
  await pode('IMPORTAÇÃO: o payload atômico gerado pela aplicação (conceitos, fontes, atributos, perfis, relações, meta e auditoria) é ACEITO pelas regras', admin().ref().update(JSON.parse(JSON.stringify(prep.caminhos))));
  anota('importação: a marca da carga inicial entrou', !!(await ler('taxonomia/meta/cargaInicial')));
  anota('importação: ALFA nasceu com a definição vigente (versão 1, origem carga inicial); os textos que não eram a vigente não entraram', (await ler(ORG + '/conceitos/ALFA/definicao/texto')) === 'T vigente' && (await ler(ORG + '/definicoes/ALFA/v1/origem')) === 'carga-inicial' && !(await ler(ORG + '/fontes')) && !(await ler(ORG + '/conceitos/BETA/definicao')));
  const prep2 = app.prepararImportacao({ dominios: { organizacional: { conceitos: { OUTRO: { nome: 'Outro', camada: 'A' } } } } }, { organizacional: {}, arquitetural: {} });
  await nega('NOVA carga inicial é recusada pelo banco (marca já existe)', admin().ref().update(JSON.parse(JSON.stringify(prep2.caminhos))));

  async function opera(rotulo, fn, cond) {
    I.st.flash = null; I.st.salvando = false;
    fn();
    const fim = await ate(() => !I.st.salvando && (I.st.flash !== null));
    anota(rotulo + ' — aceito pelo banco', fim && I.st.flash && I.st.flash.erro === false, I.st.flash ? I.st.flash.texto : 'sem resposta');
    if (cond) anota(rotulo + ' — estado gravado coerente', await cond());
  }
  I.carregarDominio('organizacional');
  await ate(() => I.st.d.organizacional.estado === 'ok');
  anota('a aplicação LÊ a Taxonomia com as regras reais (admin)', I.st.d.organizacional.estado === 'ok' && Object.keys(I.st.d.organizacional.conceitos).length === 3);
  const D = I.st.d.organizacional;
  D.selecionado = 'BETA'; I.carregarDetalhe('organizacional', 'BETA');
  await ate(() => D.detalhe && !D.detalhe.carregando);
  anota('a aplicação lê o histórico da definição, perfis, relações e AUDITORIA (admin)', D.detalhe && !Object.keys(D.detalhe.erros).length, JSON.stringify(D.detalhe && D.detalhe.erros));
  const pubOp = (dom, cod, texto, motivo) => { const Dd = I.st.d[dom], c = Dd.conceitos[cod] || {}; Dd.atualizando = { codigo: cod, etapa: 'conferir', texto, motivo: motivo || '', erro: null, versaoBase: c.definicao ? c.definicao.versao : 0 }; I.publicarDefinicao(dom, cod); };
  const recarrega = async (dom, cod) => { const Dd = I.st.d[dom]; I.carregarDominio(dom); await ate(() => Dd.estado === 'ok'); Dd.selecionado = cod; I.carregarDetalhe(dom, cod); await ate(() => Dd.detalhe && Dd.detalhe.codigo === cod && !Dd.detalhe.carregando); };
  await opera('REGISTRAR a primeira definição (BETA não tinha vigente na carga): versão 1 + histórico + auditoria', () => pubOp('organizacional', 'BETA', 'Definição de Beta.'),
    async () => (await ler(ORG + '/conceitos/BETA/definicao/versao')) === 1 && (await ler(ORG + '/definicoes/BETA/v1/origem')) === 'publicacao' && Object.values((await ler(ORG + '/auditoria/BETA')) || {}).some((e) => e.tipo === 'definicao_publicada'));
  await recarrega('organizacional', 'ALFA');
  await opera('ATUALIZAR DEFINIÇÃO (ALFA): versão 2 com motivo; a versão 1 (da carga) preservada', () => pubOp('organizacional', 'ALFA', 'T vigente, revisado.', 'Revisão de teste'),
    async () => (await ler(ORG + '/conceitos/ALFA/definicao/versao')) === 2 && (await ler(ORG + '/definicoes/ALFA/v1/texto')) === 'T vigente' && (await ler(ORG + '/definicoes/ALFA/v2/motivo')) === 'Revisão de teste');
  await recarrega('organizacional', 'ALFA');
  I.st.flash = null; D.atualizando = { codigo: 'ALFA', etapa: 'conferir', texto: 'Versão desatualizada.', motivo: '', erro: null, versaoBase: 1 }; I.publicarDefinicao('organizacional', 'ALFA');
  anota('módulo: versão vigente mudou desde que o fluxo abriu → a tela recusa antes de gravar', !!D.atualizando.erro && /alterada por outra pessoa/.test(D.atualizando.erro) && (await ler(ORG + '/conceitos/ALFA/definicao/versao')) === 2);
  D.conceitos.ALFA.definicao = { texto: 'T vigente', versao: 1 }; /* a tela "não viu" a versão 2 */
  I.st.flash = null; D.atualizando = { codigo: 'ALFA', etapa: 'conferir', texto: 'Concorrente desatualizada.', motivo: '', erro: null, versaoBase: 1 }; I.publicarDefinicao('organizacional', 'ALFA');
  await ate(() => !I.st.salvando && I.st.flash !== null);
  anota('banco: publicar sobre a versão que outra pessoa já substituiu é recusado (nada muda)', I.st.flash && I.st.flash.erro === true && (await ler(ORG + '/conceitos/ALFA/definicao/texto')) === 'T vigente, revisado.' && !(await ler(ORG + '/definicoes/ALFA/v3')));
  D.selecionado = 'BETA';
  await recarrega('organizacional', 'BETA');
  D.edicao = { tipo: 'conceito', chave: 'BETA', valores: { nome: 'Beta Revisado', observacoes: 'Obs.', perguntaDiscriminadora: 'P2?', notaDeAplicacao: 'N2.', criterios: 'x1\nx2\nx3', ativo: true }, erro: null };
  await opera('EDITAR CONCEITO (nome, pergunta, nota, critérios, observações)', () => I.salvarConceito('organizacional', 'BETA'),
    async () => (await ler(ORG + '/conceitos/BETA/nome')) === 'Beta Revisado' && Object.keys((await ler(ORG + '/conceitos/BETA/criterios')) || {}).length === 3);
  I.carregarDetalhe('organizacional', 'BETA'); await ate(() => D.detalhe && !D.detalhe.carregando); I.carregarDominio('organizacional'); await ate(() => D.estado === 'ok');
  /* Etapa 5: desativar deixou de ser a caixa do formulário — é a operação própria, com motivo e histórico apontado */
  D.inativando = { codigo: 'BETA', motivo: 'Conceito substituído (teste)', erro: null };
  await opera('INATIVAR o conceito (desativação lógica, com motivo)', () => I.inativarConceito('organizacional', 'BETA'), async () => (await ler(ORG + '/conceitos/BETA/ativo')) === false && (await ler(ORG + '/conceitos/BETA/inativacao/motivo')) === 'Conceito substituído (teste)');
  I.carregarDetalhe('organizacional', 'BETA'); await ate(() => D.detalhe && !D.detalhe.carregando); I.carregarDominio('organizacional'); await ate(() => D.estado === 'ok');
  /* Gerenciar perfil: vários atributos numa gravação só (um evento de auditoria por atributo) — nas regras reais */
  let L = I.novoPerfilLote('BETA', D.detalhe, I.atributosOrdenados(D));
  L.valores.ALCANCE = { estado: 'registrado', valor: 'específica', papel: 'definidor', origem: 'inferência' };
  L.valores.BENEF = { estado: 'não consta na fonte', valor: '', papel: 'observado', origem: '' };
  D.perfilLote = L;
  await opera('PERFIL integrado: dois atributos numa gravação (registrado + ausência)', () => I.salvarPerfilLote('organizacional', 'BETA'), async () => {
    const aud = Object.values((await ler(ORG + '/auditoria/BETA')) || {}).filter((e) => e.tipo === 'alteracao_perfil');
    return (await ler(ORG + '/perfis/BETA/ALCANCE/estado')) === 'registrado' && (await ler(ORG + '/perfis/BETA/BENEF/estado')) === 'não consta na fonte' && aud.some((e) => e.campo === 'Alcance de atuação') && aud.some((e) => e.campo === 'Beneficiário indireto');
  });
  I.carregarDetalhe('organizacional', 'BETA'); await ate(() => D.detalhe && !D.detalhe.carregando);
  L = I.novoPerfilLote('BETA', D.detalhe, I.atributosOrdenados(D));
  L.valores.ALCANCE = { estado: 'não aplicável', valor: '', papel: 'definidor', origem: 'inferência' };
  D.perfilLote = L;
  await opera('PERFIL com ausência explícita (só o estado; sem valor/papel/origem)', () => I.salvarPerfilLote('organizacional', 'BETA'),
    async () => { const p = await ler(ORG + '/perfis/BETA/ALCANCE'); return p.estado === 'não aplicável' && p.valor === undefined && p.papel === undefined && p.origem === undefined; });
  /* domínio arquitetural: a mesma aplicação, o mesmo banco */
  I.carregarDominio('arquitetural'); await ate(() => I.st.d.arquitetural.estado === 'ok');
  I.st.dominio = 'arquitetural'; const DA = I.st.d.arquitetural; DA.selecionado = 'componente'; I.carregarDetalhe('arquitetural', 'componente'); await ate(() => DA.detalhe && !DA.detalhe.carregando);
  await opera('ARQUITETURAL: REGISTRAR a definição de componente (a proposta da carga não virou definição)', () => pubOp('arquitetural', 'componente', 'Definição de componente.'),
    async () => (await ler(ARQT + '/conceitos/componente/definicao/versao')) === 1 && (await ler(ARQT + '/definicoes/componente/v1/texto')) === 'Definição de componente.' && !(await ler(ARQT + '/fontes')));
  I.st.dominio = 'organizacional';
  /* não admin: as mesmas operações são recusadas pelo banco, mesmo chamando o código direto */
  const intruso = carregarApp(ARQ)._interno;
  intruso.carregarDominio('organizacional'); await ate(() => intruso.st.d.organizacional.estado !== 'carregando');
  anota('"Avaliação + Configuração" (não admin) NÃO consegue LER a Taxonomia pela aplicação (sem acesso)', intruso.st.d.organizacional.estado === 'sem-acesso');
  intruso.st.d.organizacional.conceitos = { BETA: { nome: 'x' } }; intruso.st.d.organizacional.selecionado = 'BETA';
  intruso.st.d.organizacional.atualizando = { codigo: 'BETA', etapa: 'conferir', texto: 'Invasão.', motivo: '', erro: null, versaoBase: 0 };
  intruso.st.flash = null; intruso.publicarDefinicao('organizacional', 'BETA');
  await ate(() => !intruso.st.salvando && intruso.st.flash !== null);
  anota('mesmo chamando o código direto, a GRAVAÇÃO de quem não é admin é recusada pelo banco', intruso.st.flash && intruso.st.flash.erro === true && (await ler(ORG + '/conceitos/BETA/definicao/texto')) === 'Definição de Beta.');
  /* EXPORTAÇÃO: a leitura ramo a ramo que a aplicação faz passa nas regras reais para admin (a raiz inteira
     não é legível em bloco) e é recusada para quem não é admin; e não grava nada. */
  const antesExp = JSON.stringify(await ler('taxonomia'));
  const exp = await new Promise((r) => I.lerTudoParaExportar(r));
  anota('EXPORTAÇÃO (admin): todos os ramos lidos com as regras reais', exp.ok === true, exp.falhas && exp.falhas.join('; '));
  anota('EXPORTAÇÃO (admin): traz conceitos, definições, atributos, perfis, relações, auditoria e meta', exp.ok && !!exp.bruto.organizacional.conceitos.ALFA && !!exp.bruto.organizacional.definicoes.ALFA && !!exp.bruto.organizacional.atributos && !!exp.bruto.organizacional.auditoria && !!exp.bruto.meta);
  anota('EXPORTAÇÃO: o que a aplicação leu é exatamente o que está no banco (por ramo)', exp.ok && JSON.stringify(exp.bruto.organizacional.definicoes) === JSON.stringify(await ler(ORG + '/definicoes')) && JSON.stringify(exp.bruto.organizacional.conceitos) === JSON.stringify(await ler(ORG + '/conceitos')));
  anota('EXPORTAÇÃO: nada foi gravado', JSON.stringify(await ler('taxonomia')) === antesExp);
  const expIntruso = await new Promise((r) => intruso.lerTudoParaExportar(r));
  anota('EXPORTAÇÃO: "Avaliação + Configuração" (não admin) é recusada pelo banco (sem acesso, nada lido)', expIntruso.ok === false && expIntruso.falhas.length === 10 && expIntruso.falhas.every((f) => /sem acesso/.test(f)), JSON.stringify(expIntruso.falhas));

  console.log('\n== 10. Gravação SEM confirmação do servidor (SDK real, cliente sem conexão) ==');
  await testEnv.clearDatabase();
  await semear(async (a) => {
    await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: ADMIN });
    await a.ref(ORG + '/conceitos/SQ2').set({ nome: 'Squad fictício', camada: 'A', ordem: 1, ativo: true, definicao: def('Definição v1 de SQ2.', 1) });
    await a.ref(ORG + '/definicoes/SQ2/v1').set(Object.assign(def('Definição v1 de SQ2.', 1), { origem: 'publicacao' }));
  });
  const appOff = carregarApp(ADMIN), Io = appOff._interno, dbOff = appOff._dbTeste, DO = Io.st.d.organizacional;
  Io.espera.gravacao = 600; Io.espera.leitura = 1500; Io.espera.reverificar = 300;
  Io.carregarDominio('organizacional'); await ate(() => DO.estado === 'ok');
  DO.selecionado = 'SQ2'; Io.carregarDetalhe('organizacional', 'SQ2'); await ate(() => DO.detalhe && !DO.detalhe.carregando);
  const eventos = async () => Object.values((await ler(ORG + '/auditoria/SQ2')) || {}).filter((a) => a.tipo === 'definicao_publicada').length;
  const publicarOff = () => { DO.atualizando = { codigo: 'SQ2', etapa: 'conferir', texto: 'Definição v2 de SQ2.', motivo: '', erro: null, versaoBase: 1 }; Io.publicarDefinicao('organizacional', 'SQ2'); };
  anota('partida: SQ2 tem a definição vigente na versão 1', (await ler(ORG + '/conceitos/SQ2/definicao/versao')) === 1 && DO.conceitos.SQ2.definicao.versao === 1);
  dbOff.goOffline();
  Io.st.flash = null; publicarOff();
  const semResp = await ate(() => Io.st.pendente && Io.st.pendente.semResposta, 4000);
  anota('sem conexão: passado o prazo, a gravação vira "sem resposta" (a tela não finge sucesso nem erro)', semResp);
  await ate(() => Io.st.pendente && Io.st.pendente.estado !== '', 4000);
  const est = Io.st.pendente && Io.st.pendente.estado;
  anota('a conferência (REST, fora do SDK) diz a verdade: "' + est + '" — nunca "foi aplicada" só por causa da gravação otimista local', est === 'nao-consta');
  const marcador = Io.st.pendente && Io.st.pendente.marcador;
  const viaSdk = await dbOff.ref(marcador).get().then((sn) => (sn.val() ? 'EXISTE (gravação otimista local)' : 'inexistente'), () => 'rejeitou');
  const viaRest = await new Promise((r) => Io.leitores.servidor(marcador, r));
  anota('achado que motivou o REST: com a gravação pendente, o get() do SDK responde "' + viaSdk + '", enquanto o servidor, lido por REST, não tem o evento', viaRest.ok === true && viaRest.valor === null);
  anota('o servidor realmente ainda NÃO tem a alteração', (await ler(ORG + '/conceitos/SQ2/definicao/versao')) === 1 && (await eventos()) === 0);
  Io.st.flash = null; publicarOff();
  anota('repetir a operação enquanto isso é BLOQUEADO (aviso, nenhuma segunda gravação enfileirada)', !!Io.st.flash && /Aguarde/.test(Io.st.flash.texto));
  dbOff.goOnline();
  const resolveu = await ate(() => !Io.st.pendente && Io.st.flash && /FOI aplicada/.test(Io.st.flash.texto), 8000);
  anota('ao reconectar, a confirmação chega e a tela informa que a alteração FOI aplicada', resolveu, Io.st.flash ? Io.st.flash.texto : 'sem mensagem');
  await ate(() => DO.estado === 'ok' && DO.conceitos.SQ2 && DO.conceitos.SQ2.definicao && DO.conceitos.SQ2.definicao.versao === 2, 5000);
  anota('a tela foi reconciliada: a definição vigente é a versão 2', !!DO.conceitos.SQ2 && DO.conceitos.SQ2.definicao.versao === 2);
  anota('banco: versão 2 e o histórico com v1 e v2', (await ler(ORG + '/conceitos/SQ2/definicao/texto')) === 'Definição v2 de SQ2.' && Object.keys((await ler(ORG + '/definicoes/SQ2')) || {}).sort().join() === 'v1,v2');
  anota('UM só evento de auditoria (nenhuma repetição)', (await eventos()) === 1);

  console.log('\n== 11. Histórico global: a consulta real (orderByKey + endAt + limitToLast) e as regras ==');
  await testEnv.clearDatabase();
  const keyH = (i) => '-P3B' + String(100000 + i);
  await semear(async (a) => {
    await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: ADMIN });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    const lote = {};
    for (let i = 0; i < 60; i++) lote[ORG + '/auditoria/_catalogo/' + keyH(i)] = { tipo: i === 0 ? 'carga_inicial' : 'alteracao_atributo', campo: 'a' + i, dataHora: '2026-10-03T10:' + String(i).padStart(2, '0') + ':00.000Z', usuario: { email: ADMIN } };
    lote[ARQT + '/auditoria/_catalogo/' + keyH(0)] = { tipo: 'carga_inicial', campo: 'carga inicial', dataHora: '2026-10-03T10:00:00.002Z', usuario: { email: ADMIN } };
    await a.ref().update(lote);
  });
  const appHG = carregarApp(ADMIN), IH = appHG._interno;
  const hgPronto = () => ate(() => !IH.st.hg.carregando, 6000);
  IH.carregarHG(() => true); await hgPronto();
  anota('admin: 1ª página = 25 do Organizacional + 1 do Arquitetural', IH.st.hg.itens.length === 26 && IH.st.hg.doms.organizacional.temMais === true && IH.st.hg.doms.arquitetural.temMais === false, IH.st.hg.itens.length + ' itens');
  anota('a página traz os MAIS RECENTES (a15 … a59), não os mais antigos', IH.st.hg.itens.some((e) => e.campo === 'a59') && !IH.st.hg.itens.some((e) => e.campo === 'a34'));
  IH.carregarHG((x) => x.estado === 'ok' && x.temMais); await hgPronto();
  anota('"carregar mais": +25 (51 no total), sem repetir ninguém', IH.st.hg.itens.length === 51 && new Set(IH.st.hg.itens.map((e) => e._dom + '/' + e._chave)).size === 51, IH.st.hg.itens.length + ' itens');
  IH.carregarHG((x) => x.estado === 'ok' && x.temMais); await hgPronto();
  anota('última página: 61 eventos no total e sem mais páginas', IH.st.hg.itens.length === 61 && IH.st.hg.doms.organizacional.temMais === false, IH.st.hg.itens.length + ' itens');
  const dts = IH.st.hg.itens.map((e) => e.dataHora);
  anota('ordenado do mais recente para o mais antigo', dts.every((d, i) => i === 0 || d <= dts[i - 1]));
  const admDb = db(ADMIN), arqDb = db(ARQ), anonDb = ctx(null).database();
  await pode('o admin consegue a consulta paginada direto no banco (sem índice, sem mudar regra)', admDb.ref(ORG + '/auditoria/_catalogo').orderByKey().endAt(keyH(40)).limitToLast(26).once('value'));
  await nega('"Avaliação + Configuração" (consulta) NÃO lê o histórico global', arqDb.ref(ORG + '/auditoria/_catalogo').orderByKey().limitToLast(26).once('value'));
  await nega('sem login NÃO lê o histórico global', anonDb.ref(ARQT + '/auditoria/_catalogo').orderByKey().limitToLast(26).once('value'));

  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  await testEnv.cleanup();
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
