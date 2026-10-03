/* ═════════════════════════════════════════════════════════════════
   Regras do banco da TAXONOMIA (taxonomia/arquitetural, taxonomia/organizacional, taxonomia/meta).

   Roda contra o EMULADOR real do Realtime Database (firebase emulators:exec) — o mesmo
   database.rules.json que vai para produção, nunca uma reimplementação em JS.

   O que se prova:
   1. VALIDAÇÃO CRUZADA conceito ↔ fonte: `definicaoVigenteFonteId` só aponta para uma fonte
      EXISTENTE com situacao = vigente, inclusive numa gravação MULTIPATH (a regra enxerga o
      estado pós-gravação: tornar a fonte vigente e apontar o conceito para ela, juntos, passa).
      Fonte referenciada não pode deixar de ser vigente nem ser apagada.
   2. UMA ÚNICA FONTE VIGENTE: o banco NÃO consegue CONTAR filhos (regras do Firebase não têm
      agregação nem iteração). Em vez de simular contagem, o desenho usa uma EQUIVALÊNCIA verificável
      campo a campo: `situacao = vigente` ⇔ "é a fonte apontada pelo conceito". Como o ponteiro tem um
      valor só, nunca há duas vigentes por gravações válidas. O que o banco NÃO detecta: um estado
      legado/semeado FORA das regras com duas vigentes (a aplicação confere — teste hermético próprio).
   3. ATOMICIDADE: um update multipath com conceito + fonte + auditoria é rejeitado POR INTEIRO se
      qualquer parte viola a regra (sem estado parcial).
   4. AUDITORIA: só admin; só acréscimo (sem alterar nem apagar); e-mail do evento = usuário autenticado.
   5. PERFIL: ausência é ESTADO, nunca campo vazio. `registrado` exige valor + papel + origem; os demais
      estados não têm valor, papel nem origem.
   6. FONTE: situação ∈ {vigente, em validação, histórica/contextual, placeholder, não localizado};
      tipoRedacao ∈ {Conceito, Significado v1, Significado v2, proposta} — campos separados.
   7. AUTORIZAÇÃO: nesta 1ª versão leitura, escrita e auditoria só para admin (o mesmo conceito de admin
      do sistema: e-mails fixos + fa-admins). Perfis da Avaliação (inclusive "Avaliação + Arquitetura")
      NÃO entram.
   ═════════════════════════════════════════════════════════════════ */
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

  const conceito = (extra) => Object.assign({ nome: 'Conceito', ordem: 1, ativo: true, situacaoDefinicao: 'em revisão', camada: 'B' }, extra || {});
  const fonte = (situacao, extra) => Object.assign({ texto: 'Texto da fonte.', contexto: 'PREVI', situacao, tipoRedacao: 'Conceito' }, extra || {});
  const auditoria = (email, extra) => Object.assign({ tipo: 'alteracao_conceito', conceito: 'C1', usuario: { nome: 'Alguém', email }, dataHora: '2026-10-03T10:00:00.000Z' }, extra || {});

  /* Estado-base: C1 (organizacional) com fontes em cada situação, SEM ponteiro; atributos no catálogo.
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
      await a.ref(ARQT + '/conceitos/componente').set({ nome: 'Componente', ordem: 1, ativo: true, situacaoDefinicao: 'ainda não registrada' });
      await a.ref(ORG + '/fontes/C1/F_HIST').set(fonte('histórica/contextual', { contexto: 'BB', tipoRedacao: 'Significado v1' }));
      await a.ref(ORG + '/fontes/C1/F_VALIDACAO').set(fonte('em validação', { tipoRedacao: 'proposta' }));
      await a.ref(ORG + '/fontes/C1/F_PLACEHOLDER').set(fonte('placeholder', { tipoRedacao: 'Significado v2', contexto: 'indefinido' }));
      await a.ref(ORG + '/fontes/C1/F_NAOLOC').set(fonte('não localizado', { tipoRedacao: 'Significado v2', contexto: 'indefinido' }));
      await a.ref(ORG + '/fontes/C1/F_VIG').set(fonte(opcoes.vigenteSemPonteiro ? 'vigente' : 'histórica/contextual', { tipoRedacao: 'Conceito' }));
      if (opcoes.ponteiro) {
        await a.ref(ORG + '/fontes/C1/F_VIG').update({ situacao: 'vigente' });
        await a.ref(ORG + '/conceitos/C1/definicaoVigenteFonteId').set('F_VIG');
      }
      await a.ref(ORG + '/fontes/C1/F_OUTRA').set(fonte('histórica/contextual', { tipoRedacao: 'Significado v1' }));
    });
  }
  const admin = () => db(ADMIN);
  const R = (a, p) => a.ref(p);

  /* ───────────────────────── 1. VALIDAÇÃO CRUZADA ───────────────────────── */
  console.log('== 1. definicaoVigenteFonteId × fonte vigente ==');
  await semearBase({ vigenteSemPonteiro: true });
  await pode('(1)(2) fonte JÁ existente e vigente → atualizar o conceito para apontar para ela', R(admin(), ORG + '/conceitos/C1/definicaoVigenteFonteId').set('F_VIG'));

  await semearBase();
  await pode('(3) MULTIPATH: tornar uma fonte vigente + apontar o conceito para essa MESMA fonte, numa gravação só',
    admin().ref().update({ [ORG + '/fontes/C1/F_OUTRA/situacao']: 'vigente', [ORG + '/conceitos/C1/definicaoVigenteFonteId']: 'F_OUTRA' }));
  anota('(3) o estado gravado ficou coerente (fonte vigente e ponteiro iguais)',
    (await ler(ORG + '/fontes/C1/F_OUTRA/situacao')) === 'vigente' && (await ler(ORG + '/conceitos/C1/definicaoVigenteFonteId')) === 'F_OUTRA');

  await semearBase();
  await nega('(3b) multipath que aponta o conceito para uma fonte que NÃO foi tornada vigente → negado',
    admin().ref().update({ [ORG + '/conceitos/C1/definicaoVigenteFonteId']: 'F_OUTRA', [ORG + '/fontes/C1/F_OUTRA/texto']: 'Outro texto.' }));
  await nega('(4) apontar para fonte INEXISTENTE', R(admin(), ORG + '/conceitos/C1/definicaoVigenteFonteId').set('NAO_EXISTE'));
  await nega('(5) apontar para fonte histórica/contextual', R(admin(), ORG + '/conceitos/C1/definicaoVigenteFonteId').set('F_HIST'));
  await nega('(6) apontar para fonte em validação', R(admin(), ORG + '/conceitos/C1/definicaoVigenteFonteId').set('F_VALIDACAO'));
  await nega('(7) apontar para placeholder', R(admin(), ORG + '/conceitos/C1/definicaoVigenteFonteId').set('F_PLACEHOLDER'));
  await nega('(8) apontar para não localizado', R(admin(), ORG + '/conceitos/C1/definicaoVigenteFonteId').set('F_NAOLOC'));
  await nega('apontar com chave inválida (barra)', R(admin(), ORG + '/conceitos/C1/definicaoVigenteFonteId').set('F/VIG'));
  await nega('apontar para fonte de OUTRO conceito (a chave é relida sob o mesmo conceito)', admin().ref().update({ [ORG + '/conceitos/LINHA/definicaoVigenteFonteId']: 'F_VIG' }));

  console.log('\n== 1b. a fonte referenciada não pode perder a vigência nem sumir (9) ==');
  await semearBase({ ponteiro: true });
  await nega('(9a) deixar de torná-la vigente (histórica) com o ponteiro ainda apontando', R(admin(), ORG + '/fontes/C1/F_VIG/situacao').set('histórica/contextual'));
  await nega('(9b) rebaixá-la para "em validação" ainda referenciada', R(admin(), ORG + '/fontes/C1/F_VIG/situacao').set('em validação'));
  await nega('(9c) APAGAR a fonte referenciada', R(admin(), ORG + '/fontes/C1/F_VIG').remove());
  await nega('(9d) limpar o ponteiro deixando a fonte ainda vigente (sobraria vigente sem referência)', R(admin(), ORG + '/conceitos/C1/definicaoVigenteFonteId').remove());
  await nega('(9e) mover o ponteiro para outra fonte sem rebaixar a anterior (ficariam duas vigentes)',
    admin().ref().update({ [ORG + '/fontes/C1/F_OUTRA/situacao']: 'vigente', [ORG + '/conceitos/C1/definicaoVigenteFonteId']: 'F_OUTRA' }));
  await pode('(9f) trocar a definição vigente corretamente: rebaixa a antiga + torna a nova vigente + move o ponteiro (multipath)',
    admin().ref().update({ [ORG + '/fontes/C1/F_VIG/situacao']: 'histórica/contextual', [ORG + '/fontes/C1/F_OUTRA/situacao']: 'vigente', [ORG + '/conceitos/C1/definicaoVigenteFonteId']: 'F_OUTRA' }));
  await semearBase({ ponteiro: true });
  await pode('(9g) deixar o conceito SEM definição vigente: limpa o ponteiro + rebaixa a fonte (multipath)',
    admin().ref().update({ [ORG + '/fontes/C1/F_VIG/situacao']: 'histórica/contextual', [ORG + '/conceitos/C1/definicaoVigenteFonteId']: null }));
  await semearBase({ ponteiro: true });
  await pode('(9h) apagar a fonte referenciada JUNTO com a limpeza do ponteiro (multipath)',
    admin().ref().update({ [ORG + '/fontes/C1/F_VIG']: null, [ORG + '/conceitos/C1/definicaoVigenteFonteId']: null }));
  await semearBase({ ponteiro: true });
  await pode('editar o TEXTO da fonte vigente (sem mudar a situação) continua permitido', R(admin(), ORG + '/fontes/C1/F_VIG/texto').set('Texto revisado.'));
  await pode('apagar uma fonte NÃO referenciada (cadastro errado)', R(admin(), ORG + '/fontes/C1/F_OUTRA').remove());
  await nega('apagar o CONCEITO', R(admin(), ORG + '/conceitos/C1').remove());

  /* ───────────────────────── 2. UMA ÚNICA FONTE VIGENTE ───────────────────────── */
  console.log('\n== 2. uma única fonte vigente por conceito ==');
  await semearBase({ ponteiro: true });
  await nega('uma SEGUNDA fonte vigente sozinha (o ponteiro só tem um valor): negada pelo banco, sem contar nada',
    R(admin(), ORG + '/fontes/C1/F_OUTRA/situacao').set('vigente'));
  await nega('criar uma fonte NOVA já vigente com o conceito apontando para outra', R(admin(), ORG + '/fontes/C1/F_NOVA').set(fonte('vigente')));
  await pode('criar uma fonte NOVA não vigente (histórica) ao lado da vigente', R(admin(), ORG + '/fontes/C1/F_NOVA').set(fonte('histórica/contextual')));
  /* LIMITE REAL: estado semeado fora das regras (legado) com duas vigentes — o banco não enxerga contagem */
  await semearBase({ ponteiro: true });
  await semear((a) => a.ref(ORG + '/fontes/C1/F_OUTRA/situacao').set('vigente'));
  await pode('LIMITE conhecido: o banco NÃO detecta um estado legado com DUAS vigentes (não existe contagem nas regras) — a aplicação confere',
    R(admin(), ORG + '/conceitos/C1/nome').set('Renomeado'));

  /* ───────────────────────── 3. ATOMICIDADE ───────────────────────── */
  console.log('\n== 3. atomicidade do multipath (conceito + fonte + auditoria) ==');
  await semearBase({ ponteiro: true });
  const antes = JSON.stringify(await ler('taxonomia'));
  await nega('conceito + fonte + auditoria com e-mail FALSIFICADO: rejeitado por inteiro',
    admin().ref().update({
      [ORG + '/conceitos/C1/nome']: 'Nome novo', [ORG + '/fontes/C1/F_VIG/texto']: 'Texto novo.',
      [ORG + '/auditoria/C1/a1']: auditoria('outra.pessoa@previ.com.br')
    }));
  anota('nada foi gravado (nenhum estado parcial)', JSON.stringify(await ler('taxonomia')) === antes);
  await nega('a parte inválida é a FONTE (situação desconhecida): o conceito e a auditoria também não entram',
    admin().ref().update({
      [ORG + '/conceitos/C1/nome']: 'Nome novo', [ORG + '/fontes/C1/F_OUTRA/situacao']: 'quase-vigente',
      [ORG + '/auditoria/C1/a2']: auditoria(ADMIN)
    }));
  anota('nada foi gravado', JSON.stringify(await ler('taxonomia')) === antes);
  await nega('a parte inválida é o CONCEITO (campo desconhecido): fonte e auditoria também não entram',
    admin().ref().update({
      [ORG + '/conceitos/C1/campoInventado']: 'x', [ORG + '/fontes/C1/F_VIG/texto']: 'Texto novo.',
      [ORG + '/auditoria/C1/a3']: auditoria(ADMIN)
    }));
  anota('nada foi gravado', JSON.stringify(await ler('taxonomia')) === antes);
  await pode('as três partes válidas entram TODAS juntas',
    admin().ref().update({
      [ORG + '/conceitos/C1/nome']: 'Nome novo', [ORG + '/fontes/C1/F_VIG/texto']: 'Texto novo.',
      [ORG + '/auditoria/C1/a4']: auditoria(ADMIN)
    }));
  anota('conceito, fonte e auditoria gravados',
    (await ler(ORG + '/conceitos/C1/nome')) === 'Nome novo' && (await ler(ORG + '/fontes/C1/F_VIG/texto')) === 'Texto novo.' && !!(await ler(ORG + '/auditoria/C1/a4')));

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
  await nega('"Avaliação + Arquitetura" não escreve auditoria', R(db(ARQ), ORG + '/auditoria/C1/g1').set(auditoria(ARQ)));
  await nega('"Avaliação" não escreve auditoria', R(db(AVAL), ORG + '/auditoria/C1/g2').set(auditoria(AVAL)));
  await nega('usuário comum não escreve auditoria', R(db(SEM_ACESSO), ORG + '/auditoria/C1/g3').set(auditoria(SEM_ACESSO)));
  await nega('sem login não escreve auditoria', R(db(null), ORG + '/auditoria/C1/g4').set(auditoria(SEM_ACESSO)));
  await pode('admin LÊ a auditoria', R(admin(), ORG + '/auditoria/C1').once('value'));
  for (const [rotulo, email] of [['"Avaliação + Arquitetura"', ARQ], ['"Avaliação"', AVAL], ['usuário comum', SEM_ACESSO], ['sem login', null]]) {
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

  /* ───────────────────────── 6. FONTE ───────────────────────── */
  console.log('\n== 6. fonte: situações e tipo de redação ==');
  await semearBase();
  for (const sit of ['em validação', 'histórica/contextual', 'placeholder', 'não localizado']) {
    await pode('situação "' + sit + '" aceita', R(admin(), ORG + '/fontes/C1/N_' + emailKey(sit).slice(0, 10)).set(fonte(sit)));
  }
  await nega('situação desconhecida', R(admin(), ORG + '/fontes/C1/N_X').set(fonte('quase-vigente')));
  await nega('"proposta" NÃO é situação (é tipo de redação)', R(admin(), ORG + '/fontes/C1/N_Y').set(fonte('proposta')));
  for (const tipo of ['Conceito', 'Significado v1', 'Significado v2', 'proposta']) {
    await pode('tipoRedacao "' + tipo + '" aceito (campo separado da situação)', R(admin(), ORG + '/fontes/C1/T_' + emailKey(tipo).slice(0, 12)).set(fonte('histórica/contextual', { tipoRedacao: tipo })));
  }
  await pode('proposta em validação (o caso do conceito-pai Plataforma): situação "em validação" + tipoRedacao "proposta"', R(admin(), ORG + '/fontes/C1/PROP').set(fonte('em validação', { tipoRedacao: 'proposta' })));
  await nega('tipoRedacao desconhecido', R(admin(), ORG + '/fontes/C1/T_X').set(fonte('histórica/contextual', { tipoRedacao: 'Significado v3' })));
  await nega('"em validação" NÃO é tipo de redação', R(admin(), ORG + '/fontes/C1/T_Y').set(fonte('histórica/contextual', { tipoRedacao: 'em validação' })));
  await nega('fonte sem tipoRedacao', R(admin(), ORG + '/fontes/C1/T_Z').set({ texto: 'x', contexto: 'PREVI', situacao: 'placeholder' }));
  await nega('contexto desconhecido', R(admin(), ORG + '/fontes/C1/T_W').set(fonte('placeholder', { contexto: 'BRADESCO' })));
  for (const ctxto of ['PREVI', 'BB', 'indefinido']) await pode('contexto "' + ctxto + '" aceito', R(admin(), ORG + '/fontes/C1/K_' + ctxto).set(fonte('placeholder', { contexto: ctxto })));
  await nega('fonte de um conceito que NÃO existe', R(admin(), ORG + '/fontes/NAO_EXISTE/F1').set(fonte('placeholder')));
  await nega('fonte com texto vazio', R(admin(), ORG + '/fontes/C1/V1').set(fonte('placeholder', { texto: '' })));
  await nega('fonte com campo desconhecido', R(admin(), ORG + '/fontes/C1/V2').set(fonte('placeholder', { extra: 1 })));

  /* ───────────────────────── 7. CONCEITO, ATRIBUTO, RELAÇÃO, META ───────────────────────── */
  console.log('\n== 7. conceito, atributo, relação e carga inicial ==');
  await semearBase();
  await pode('conceito organizacional válido', R(admin(), ORG + '/conceitos/NOVO').set(conceito({ nome: 'Novo', pai: 'LINHA' })));
  await nega('conceito sem situação da definição', R(admin(), ORG + '/conceitos/N2').set({ nome: 'x', ordem: 1, ativo: true, camada: 'A' }));
  await nega('situação da definição fora da lista', R(admin(), ORG + '/conceitos/N3').set(conceito({ situacaoDefinicao: 'publicada' })));
  await pode('situações da definição aceitas: registrada, em revisão, ainda não registrada', Promise.all(['registrada', 'em revisão', 'ainda não registrada'].map((s, i) => R(admin(), ORG + '/conceitos/S' + i + 'X').set(conceito({ situacaoDefinicao: s })))));
  await nega('conceito organizacional sem camada', R(admin(), ORG + '/conceitos/N4').set({ nome: 'x', ordem: 1, ativo: true, situacaoDefinicao: 'em revisão' }));
  await nega('camada desconhecida', R(admin(), ORG + '/conceitos/N5').set(conceito({ camada: 'Z' })));
  await nega('"pai" que não existe', R(admin(), ORG + '/conceitos/N6').set(conceito({ pai: 'FANTASMA' })));
  await nega('código de conceito inválido', R(admin(), ORG + '/conceitos/_x').set(conceito()));
  await nega('conceito com campo desconhecido', R(admin(), ORG + '/conceitos/N7').set(conceito({ abrangencia: 'x' })));
  await pode('conceito arquitetural válido (sem camada)', R(admin(), ARQT + '/conceitos/canal').set({ nome: 'Canal', ordem: 9, ativo: true, situacaoDefinicao: 'ainda não registrada' }));
  await nega('conceito arquitetural COM camada (campo do domínio organizacional)', R(admin(), ARQT + '/conceitos/regra').set({ nome: 'Regra', ordem: 1, ativo: true, situacaoDefinicao: 'ainda não registrada', camada: 'A' }));
  await nega('o domínio arquitetural NÃO tem atributos', R(admin(), ARQT + '/atributos/X').set({ nome: 'x', grupo: 'alcance', tipoValor: 'texto', ordem: 1, ativo: true }));
  await nega('o domínio arquitetural NÃO tem relações', R(admin(), ARQT + '/relacoes/a__compoe__b').set({ de: 'a', tipo: 'compoe', para: 'b' }));
  await pode('atributo válido', R(admin(), ORG + '/atributos/FORMA').set({ nome: 'Forma de entrega/consumo', grupo: 'entrega', tipoValor: 'lista', ordem: 2, ativo: true, valoresPermitidos: { v1: { texto: 'serviço', ordem: 1 } } }));
  await nega('valor permitido de atributo sem "texto"', R(admin(), ORG + '/atributos/G3').set({ nome: 'x', grupo: 'alcance', tipoValor: 'lista', ordem: 1, ativo: true, valoresPermitidos: { v1: { ordem: 1 } } }));
  await pode('critérios do conceito (mapa ordenado)', R(admin(), ORG + '/conceitos/C1/criterios').set({ k1: { texto: 'Critério 1', ordem: 1 } }));
  await nega('critério sem ordem', R(admin(), ORG + '/conceitos/C1/criterios/k2').set({ texto: 'Critério 2' }));
  await pode('pergunta discriminadora e nota de aplicação', R(admin(), ORG + '/conceitos/C1').update({ perguntaDiscriminadora: 'Pergunta?', notaDeAplicacao: 'Nota de aplicação.', ordemDaPergunta: 7 }));
  await nega('atributo com grupo desconhecido', R(admin(), ORG + '/atributos/G2').set({ nome: 'x', grupo: 'abrangencia', tipoValor: 'texto', ordem: 1, ativo: true }));
  await pode('relação válida (chave = de__tipo__para)', R(admin(), ORG + '/relacoes/C1__compoe__LINHA').set({ de: 'C1', tipo: 'compoe', para: 'LINHA' }));
  await nega('relação com chave diferente da combinação', R(admin(), ORG + '/relacoes/qualquer').set({ de: 'C1', tipo: 'compoe', para: 'LINHA' }));
  await nega('relação com tipo desconhecido', R(admin(), ORG + '/relacoes/C1__herda__LINHA').set({ de: 'C1', tipo: 'herda', para: 'LINHA' }));
  await nega('relação para conceito inexistente', R(admin(), ORG + '/relacoes/C1__compoe__FANTASMA').set({ de: 'C1', tipo: 'compoe', para: 'FANTASMA' }));
  await pode('carga inicial: grava a marca UMA vez', R(admin(), 'taxonomia/meta/cargaInicial').set({ feitaEm: '2026-10-03T10:00:00.000Z', feitaPor: ADMIN }));
  await nega('carga inicial: NOVA carga é recusada pelo banco', R(admin(), 'taxonomia/meta/cargaInicial').set({ feitaEm: '2026-10-04T10:00:00.000Z', feitaPor: ADMIN }));
  await nega('carga inicial: marca com autor diferente do autenticado', R(db(SUPER), 'taxonomia/meta/cargaInicial2').set({ feitaEm: 'x', feitaPor: ADMIN }));

  /* ───────────────────────── 8. AUTORIZAÇÃO ───────────────────────── */
  console.log('\n== 8. autorização: só admin lê e escreve ==');
  await semearBase({ ponteiro: true });
  await semear(async (a) => {
    await a.ref(ORG + '/perfis/C1/ALCANCE').set({ estado: 'ainda não definido' });
    await a.ref(ORG + '/relacoes/C1__compoe__LINHA').set({ de: 'C1', tipo: 'compoe', para: 'LINHA' });
    await a.ref(ORG + '/auditoria/C1/e1').set(auditoria(ADMIN));
    await a.ref('taxonomia/meta/cargaInicial').set({ feitaEm: 'x', feitaPor: ADMIN });
  });
  const LEITURAS = [ORG + '/conceitos', ORG + '/conceitos/C1', ORG + '/fontes/C1', ORG + '/atributos', ORG + '/perfis/C1', ORG + '/relacoes', ORG + '/auditoria/C1', ARQT + '/conceitos', 'taxonomia/meta/cargaInicial', 'taxonomia'];
  for (const [rotulo, email] of [['admin (e-mail fixo)', SUPER], ['admin (fa-admins)', ADMIN]]) {
    for (const cam of LEITURAS.filter((c) => c !== 'taxonomia')) await pode(rotulo + ' lê ' + cam, R(db(email), cam).once('value'));
    await pode(rotulo + ' escreve conceito', R(db(email), ORG + '/conceitos/C1/nome').set('Escrito por ' + rotulo));
  }
  await nega('a raiz "taxonomia" inteira não é lida em bloco (leitura é por ramo)', R(admin(), 'taxonomia').once('value'));
  for (const [rotulo, email] of [['"Avaliação + Arquitetura" (escreve naturezas, mas NÃO a Taxonomia)', ARQ], ['"Avaliação"', AVAL], ['usuário comum', SEM_ACESSO], ['sem login', null]]) {
    for (const cam of LEITURAS.filter((c) => c !== 'taxonomia')) await nega(rotulo + ' NÃO lê ' + cam, R(db(email), cam).once('value'));
    await nega(rotulo + ' NÃO escreve conceito', R(db(email), ORG + '/conceitos/C1/nome').set('invasão'));
    await nega(rotulo + ' NÃO escreve fonte', R(db(email), ORG + '/fontes/C1/F_INV').set(fonte('placeholder')));
    await nega(rotulo + ' NÃO escreve perfil', R(db(email), ORG + '/perfis/C1/ALCANCE').set({ estado: 'ainda não definido' }));
    await nega(rotulo + ' NÃO escreve no domínio arquitetural', R(db(email), ARQT + '/conceitos/componente/nome').set('invasão'));
  }

  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  await testEnv.cleanup();
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
