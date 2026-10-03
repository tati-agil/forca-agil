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
  console.log('\n== 6b. promoção a vigente: só de fonte promovível (A0 — segurança da curadoria) ==');
  const promove = (dom, cod, id, extra) => Object.assign({ [dom + '/fontes/' + cod + '/' + id + '/situacao']: 'vigente', [dom + '/conceitos/' + cod + '/definicaoVigenteFonteId']: id }, extra || {});
  await semearBase();
  await nega('(A0-1) MULTIPATH promover PLACEHOLDER a vigente (+ ponteiro) → NEGADO pelo banco', admin().ref().update(promove(ORG, 'C1', 'F_PLACEHOLDER')));
  await semearBase();
  await nega('(A0-2) MULTIPATH promover "não localizado" a vigente (+ ponteiro) → NEGADO pelo banco', admin().ref().update(promove(ORG, 'C1', 'F_NAOLOC')));
  anota('(A0-2) nada mudou: sem ponteiro e a fonte continua "não localizado"',
    !(await ler(ORG + '/conceitos/C1/definicaoVigenteFonteId')) && (await ler(ORG + '/fontes/C1/F_NAOLOC/situacao')) === 'não localizado');
  await semearBase();
  await nega('(A0-3) gravação DIRETA do nó inteiro da fonte placeholder já como vigente (+ ponteiro)',
    admin().ref().update({ [ORG + '/fontes/C1/F_PLACEHOLDER']: fonte('vigente', { contexto: 'indefinido', tipoRedacao: 'Significado v2' }), [ORG + '/conceitos/C1/definicaoVigenteFonteId']: 'F_PLACEHOLDER' }));
  await semearBase();
  await nega('(A0-4) promover placeholder acompanhado de auditoria bem formada continua NEGADO (a auditoria não "abona")',
    admin().ref().update(promove(ORG, 'C1', 'F_PLACEHOLDER', { [ORG + '/auditoria/C1/-Kx0']: auditoria(ADMIN, { tipo: 'definicao_vigente', fonteNovaId: 'F_PLACEHOLDER', fonteAnteriorId: null }) })));
  await semearBase();
  await nega('(A0-5) a SUPER-admin (e-mail fixo) também é barrada: não é questão de perfil', db(SUPER).ref().update(promove(ORG, 'C1', 'F_PLACEHOLDER')));
  /* domínio arquitetural: a mesma proteção */
  const semearArq = () => semear(async (a) => {
    await a.ref(ARQT + '/fontes/componente/A_PH').set(fonte('placeholder', { contexto: 'indefinido', tipoRedacao: 'Significado v2' }));
    await a.ref(ARQT + '/fontes/componente/A_NL').set(fonte('não localizado', { contexto: 'indefinido', tipoRedacao: 'Significado v2' }));
    await a.ref(ARQT + '/fontes/componente/A_VAL').set(fonte('em validação', { tipoRedacao: 'proposta' }));
  });
  await semearBase(); await semearArq();
  await nega('(A0-6) ARQUITETURAL: promover placeholder → NEGADO', admin().ref().update(promove(ARQT, 'componente', 'A_PH')));
  await semearBase(); await semearArq();
  await nega('(A0-7) ARQUITETURAL: promover "não localizado" → NEGADO', admin().ref().update(promove(ARQT, 'componente', 'A_NL')));
  await semearBase(); await semearArq();
  await pode('(A0-8) ARQUITETURAL: promover "em validação" continua PERMITIDO', admin().ref().update(promove(ARQT, 'componente', 'A_VAL')));

  console.log('\n== 6c. o que continua funcionando ==');
  await semearBase();
  await pode('(A0-9) promover "histórica/contextual" (+ ponteiro) → PERMITIDO', admin().ref().update(promove(ORG, 'C1', 'F_HIST')));
  anota('(A0-9) ficou coerente: fonte vigente e ponteiro iguais', (await ler(ORG + '/fontes/C1/F_HIST/situacao')) === 'vigente' && (await ler(ORG + '/conceitos/C1/definicaoVigenteFonteId')) === 'F_HIST');
  await semearBase();
  await pode('(A0-10) promover "em validação" (+ ponteiro) → PERMITIDO', admin().ref().update(promove(ORG, 'C1', 'F_VALIDACAO')));
  await semearBase();
  await pode('(A0-11) placeholder reclassificado por decisão humana ("em validação") continua possível…', R(admin(), ORG + '/fontes/C1/F_PLACEHOLDER/situacao').set('em validação'));
  await pode('(A0-11) …e SÓ ENTÃO pode ser promovido (dois passos explícitos, ambos auditáveis)', admin().ref().update(promove(ORG, 'C1', 'F_PLACEHOLDER')));
  await semearBase();
  await pode('(A0-12) criar uma fonte JÁ vigente com o ponteiro (caso da importação, sem estado anterior) segue permitido',
    admin().ref().update({ [ORG + '/fontes/C1/F_NOVA']: fonte('vigente'), [ORG + '/conceitos/C1/definicaoVigenteFonteId']: 'F_NOVA' }));

  console.log('\n== 6d. troca e remoção da definição vigente: atômicas e auditadas ==');
  await semearBase({ ponteiro: true });
  const troca = {
    [ORG + '/fontes/C1/F_VIG/situacao']: 'histórica/contextual', [ORG + '/fontes/C1/F_HIST/situacao']: 'vigente',
    [ORG + '/conceitos/C1/definicaoVigenteFonteId']: 'F_HIST', [ORG + '/conceitos/C1/situacaoDefinicao']: 'registrada',
    [ORG + '/auditoria/C1/-Kx1']: auditoria(ADMIN, { tipo: 'definicao_vigente', campo: 'definição vigente', valorAnterior: 'Conceito (PREVI)', valorNovo: 'Significado v1 (BB)', fonteAnteriorId: 'F_VIG', fonteNovaId: 'F_HIST' })
  };
  await pode('(A0-13) TROCA: rebaixa a anterior + promove a nova + ponteiro + auditoria, numa gravação só', admin().ref().update(troca));
  const ev = await ler(ORG + '/auditoria/C1/-Kx1');
  anota('(A0-13) estado final: nova vigente, anterior histórica, ponteiro na nova, só UMA vigente',
    (await ler(ORG + '/fontes/C1/F_HIST/situacao')) === 'vigente' && (await ler(ORG + '/fontes/C1/F_VIG/situacao')) === 'histórica/contextual' && (await ler(ORG + '/conceitos/C1/definicaoVigenteFonteId')) === 'F_HIST');
  anota('(A0-13) o evento identifica claramente a fonte ANTERIOR e a NOVA (id e rótulo) e quem fez', !!ev && ev.fonteAnteriorId === 'F_VIG' && ev.fonteNovaId === 'F_HIST' && ev.valorAnterior === 'Conceito (PREVI)' && ev.valorNovo === 'Significado v1 (BB)' && ev.usuario.email === ADMIN);
  await semearBase({ ponteiro: true });
  await nega('(A0-14) TROCA para um PLACEHOLDER recusada POR INTEIRO: nada muda (a anterior continua vigente)', admin().ref().update(Object.assign({}, troca, {
    [ORG + '/fontes/C1/F_HIST/situacao']: 'histórica/contextual', [ORG + '/fontes/C1/F_PLACEHOLDER/situacao']: 'vigente', [ORG + '/conceitos/C1/definicaoVigenteFonteId']: 'F_PLACEHOLDER' })));
  anota('(A0-14) a vigente anterior segue intacta', (await ler(ORG + '/fontes/C1/F_VIG/situacao')) === 'vigente' && (await ler(ORG + '/conceitos/C1/definicaoVigenteFonteId')) === 'F_VIG' && !(await ler(ORG + '/auditoria/C1/-Kx1')));
  await semearBase({ ponteiro: true });
  await pode('(A0-15) REMOVER a vigência: fonte volta a histórica + ponteiro limpo + auditoria com a fonte anterior', admin().ref().update({
    [ORG + '/fontes/C1/F_VIG/situacao']: 'histórica/contextual', [ORG + '/conceitos/C1/definicaoVigenteFonteId']: null, [ORG + '/conceitos/C1/situacaoDefinicao']: 'em revisão',
    [ORG + '/auditoria/C1/-Kx2']: auditoria(ADMIN, { tipo: 'definicao_vigente', campo: 'definição vigente', valorAnterior: 'Conceito (PREVI)', valorNovo: null, fonteAnteriorId: 'F_VIG', fonteNovaId: null }) }));
  anota('(A0-15) sem ponteiro e sem nenhuma fonte vigente', !(await ler(ORG + '/conceitos/C1/definicaoVigenteFonteId')) && (await ler(ORG + '/fontes/C1/F_VIG/situacao')) === 'histórica/contextual');
  await semearBase({ ponteiro: true });
  await nega('(A0-16) remover só o ponteiro deixando a fonte vigente continua NEGADO', R(admin(), ORG + '/conceitos/C1/definicaoVigenteFonteId').remove());
  await pode('(A0-17) a troca é gravada…', admin().ref().update(troca));
  await nega('(A0-17) …e o evento dela não pode ser reescrito depois (auditoria só de acréscimo)', admin().ref(ORG + '/auditoria/C1/-Kx1/fonteNovaId').set('OUTRA'));

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
  anota('importação: ALFA nasceu com ponteiro = a1 e a1 vigente (equivalência)', (await ler(ORG + '/conceitos/ALFA/definicaoVigenteFonteId')) === 'a1' && (await ler(ORG + '/fontes/ALFA/a1/situacao')) === 'vigente');
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
  anota('a aplicação lê fontes, perfis, relações e AUDITORIA (admin)', D.detalhe && !Object.keys(D.detalhe.erros).length, JSON.stringify(D.detalhe && D.detalhe.erros));
  const vigentes = async (cod) => Object.values((await ler(ORG + '/fontes/' + cod)) || {}).filter((f) => f.situacao === 'vigente').length;
  await opera('TORNAR VIGENTE (b1) — fonte promovida + ponteiro + situação do conceito + auditoria numa gravação', () => I.tornarVigente('organizacional', 'BETA', 'b1'),
    async () => (await ler(ORG + '/conceitos/BETA/definicaoVigenteFonteId')) === 'b1' && (await vigentes('BETA')) === 1);
  I.carregarDetalhe('organizacional', 'BETA'); await ate(() => D.detalhe && !D.detalhe.carregando); I.carregarDominio('organizacional'); await ate(() => D.estado === 'ok');
  await opera('TROCAR a vigente (b1 → b3): rebaixa a anterior e promove a nova', () => I.tornarVigente('organizacional', 'BETA', 'b3'),
    async () => (await ler(ORG + '/conceitos/BETA/definicaoVigenteFonteId')) === 'b3' && (await ler(ORG + '/fontes/BETA/b1/situacao')) === 'histórica/contextual' && (await vigentes('BETA')) === 1);
  I.carregarDetalhe('organizacional', 'BETA'); await ate(() => D.detalhe && !D.detalhe.carregando); I.carregarDominio('organizacional'); await ate(() => D.estado === 'ok');
  await opera('REMOVER a vigência: limpa o ponteiro e rebaixa a fonte', () => I.removerVigencia('organizacional', 'BETA'),
    async () => !(await ler(ORG + '/conceitos/BETA/definicaoVigenteFonteId')) && (await vigentes('BETA')) === 0 && (await ler(ORG + '/conceitos/BETA/situacaoDefinicao')) === 'em revisão');
  I.carregarDetalhe('organizacional', 'BETA'); await ate(() => D.detalhe && !D.detalhe.carregando); I.carregarDominio('organizacional'); await ate(() => D.estado === 'ok');
  D.edicao = { tipo: 'novaFonte', chave: 'BETA', valores: { rotulo: 'Nova', texto: 'Texto novo.', contexto: 'PREVI', tipoRedacao: 'Significado v1', situacao: 'em validação' }, erro: null };
  await opera('NOVA FONTE (em validação)', () => I.salvarFonte('organizacional', 'BETA'), async () => Object.keys((await ler(ORG + '/fontes/BETA')) || {}).length === 4);
  I.carregarDetalhe('organizacional', 'BETA'); await ate(() => D.detalhe && !D.detalhe.carregando); I.carregarDominio('organizacional'); await ate(() => D.estado === 'ok');
  D.edicao = { tipo: 'fonte', chave: 'b2', valores: { rotulo: '', texto: 'Placeholder revisado.', contexto: 'indefinido', tipoRedacao: 'Significado v2', situacao: 'não localizado' }, erro: null };
  await opera('EDITAR FONTE (texto e situação)', () => I.salvarFonte('organizacional', 'BETA'), async () => (await ler(ORG + '/fontes/BETA/b2/situacao')) === 'não localizado');
  I.carregarDetalhe('organizacional', 'BETA'); await ate(() => D.detalhe && !D.detalhe.carregando); I.carregarDominio('organizacional'); await ate(() => D.estado === 'ok');
  D.edicao = { tipo: 'conceito', chave: 'BETA', valores: { nome: 'Beta Revisado', observacoes: 'Obs.', perguntaDiscriminadora: 'P2?', notaDeAplicacao: 'N2.', criterios: 'x1\nx2\nx3', ativo: true }, erro: null };
  await opera('EDITAR CONCEITO (nome, pergunta, nota, critérios, observações)', () => I.salvarConceito('organizacional', 'BETA'),
    async () => (await ler(ORG + '/conceitos/BETA/nome')) === 'Beta Revisado' && Object.keys((await ler(ORG + '/conceitos/BETA/criterios')) || {}).length === 3);
  I.carregarDetalhe('organizacional', 'BETA'); await ate(() => D.detalhe && !D.detalhe.carregando); I.carregarDominio('organizacional'); await ate(() => D.estado === 'ok');
  D.edicao = { tipo: 'conceito', chave: 'BETA', valores: { nome: 'Beta Revisado', observacoes: 'Obs.', perguntaDiscriminadora: 'P2?', notaDeAplicacao: 'N2.', criterios: 'x1\nx2\nx3', ativo: false }, erro: null };
  await opera('DESATIVAR o conceito (desativação lógica)', () => I.salvarConceito('organizacional', 'BETA'), async () => (await ler(ORG + '/conceitos/BETA/ativo')) === false);
  I.carregarDetalhe('organizacional', 'BETA'); await ate(() => D.detalhe && !D.detalhe.carregando); I.carregarDominio('organizacional'); await ate(() => D.estado === 'ok');
  D.edicao = { tipo: 'perfil', chave: 'ALCANCE', valores: { estado: 'registrado', valor: 'específica', papel: 'definidor', origem: 'inferência' }, erro: null };
  await opera('PERFIL registrado (valor + papel + origem)', () => I.salvarPerfil('organizacional', 'BETA'), async () => (await ler(ORG + '/perfis/BETA/ALCANCE/estado')) === 'registrado');
  I.carregarDetalhe('organizacional', 'BETA'); await ate(() => D.detalhe && !D.detalhe.carregando);
  D.edicao = { tipo: 'perfil', chave: 'ALCANCE', valores: { estado: 'não aplicável', valor: '', papel: 'definidor', origem: 'inferência' }, erro: null };
  await opera('PERFIL com ausência explícita (só o estado; sem valor/papel/origem)', () => I.salvarPerfil('organizacional', 'BETA'),
    async () => { const p = await ler(ORG + '/perfis/BETA/ALCANCE'); return p.estado === 'não aplicável' && p.valor === undefined && p.papel === undefined && p.origem === undefined; });
  /* domínio arquitetural: a mesma aplicação, o mesmo banco */
  I.carregarDominio('arquitetural'); await ate(() => I.st.d.arquitetural.estado === 'ok');
  I.st.dominio = 'arquitetural'; const DA = I.st.d.arquitetural; DA.selecionado = 'componente'; I.carregarDetalhe('arquitetural', 'componente'); await ate(() => DA.detalhe && !DA.detalhe.carregando);
  await opera('ARQUITETURAL: TORNAR VIGENTE a proposta (promovível: "em validação")', () => I.tornarVigente('arquitetural', 'componente', 'c1'),
    async () => (await ler(ARQT + '/conceitos/componente/definicaoVigenteFonteId')) === 'c1' && (await ler(ARQT + '/fontes/componente/c1/situacao')) === 'vigente');
  I.st.dominio = 'organizacional';
  /* não admin: as mesmas operações são recusadas pelo banco, mesmo chamando o código direto */
  const intruso = carregarApp(ARQ)._interno;
  intruso.carregarDominio('organizacional'); await ate(() => intruso.st.d.organizacional.estado !== 'carregando');
  anota('"Avaliação + Arquitetura" (não admin) NÃO consegue LER a Taxonomia pela aplicação (sem acesso)', intruso.st.d.organizacional.estado === 'sem-acesso');
  intruso.st.d.organizacional.conceitos = { BETA: { nome: 'x' } }; intruso.st.d.organizacional.selecionado = 'BETA';
  intruso.st.d.organizacional.detalhe = { codigo: 'BETA', carregando: false, fontes: { b1: { situacao: 'histórica/contextual', texto: 't', contexto: 'BB', tipoRedacao: 'Conceito' } }, perfis: {}, relacoes: {}, auditoria: {}, erros: {} };
  intruso.st.flash = null; intruso.tornarVigente('organizacional', 'BETA', 'b1');
  await ate(() => !intruso.st.salvando && intruso.st.flash !== null);
  anota('mesmo chamando o código direto, a GRAVAÇÃO de quem não é admin é recusada pelo banco', intruso.st.flash && intruso.st.flash.erro === true && !(await ler(ORG + '/conceitos/BETA/definicaoVigenteFonteId')));

  console.log('\n== 10. Gravação SEM confirmação do servidor (SDK real, cliente sem conexão) ==');
  await testEnv.clearDatabase();
  await semear(async (a) => {
    await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: ADMIN });
    await a.ref(ORG + '/conceitos/SQ2').set({ nome: 'Squad fictício', camada: 'A', ordem: 1, ativo: true, situacaoDefinicao: 'registrada', definicaoVigenteFonteId: 'f1' });
    await a.ref(ORG + '/fontes/SQ2/f1').set(fonte('vigente', { rotulo: 'Conceito', criadoEm: '2026-10-03T10:00:00.000Z', criadoPor: ADMIN }));
    await a.ref(ORG + '/fontes/SQ2/f2').set(fonte('histórica/contextual', { contexto: 'BB', tipoRedacao: 'Significado v1', criadoEm: '2026-10-03T10:00:01.000Z', criadoPor: ADMIN }));
  });
  const appOff = carregarApp(ADMIN), Io = appOff._interno, dbOff = appOff._dbTeste, DO = Io.st.d.organizacional;
  Io.espera.gravacao = 600; Io.espera.leitura = 1500; Io.espera.reverificar = 300;
  Io.carregarDominio('organizacional'); await ate(() => DO.estado === 'ok');
  DO.selecionado = 'SQ2'; Io.carregarDetalhe('organizacional', 'SQ2'); await ate(() => DO.detalhe && !DO.detalhe.carregando);
  const eventos = async () => Object.values((await ler(ORG + '/auditoria/SQ2')) || {}).filter((a) => a.tipo === 'definicao_vigente').length;
  anota('partida: SQ2 tem a definição vigente f1', (await ler(ORG + '/conceitos/SQ2/definicaoVigenteFonteId')) === 'f1' && DO.conceitos.SQ2.definicaoVigenteFonteId === 'f1');
  dbOff.goOffline();
  Io.st.flash = null; Io.removerVigencia('organizacional', 'SQ2');
  const semResp = await ate(() => Io.st.pendente && Io.st.pendente.semResposta, 4000);
  anota('sem conexão: passado o prazo, a gravação vira "sem resposta" (a tela não finge sucesso nem erro)', semResp);
  await ate(() => Io.st.pendente && Io.st.pendente.estado !== '', 4000);
  const est = Io.st.pendente && Io.st.pendente.estado;
  anota('a conferência (REST, fora do SDK) diz a verdade: "' + est + '" — nunca "foi aplicada" só por causa da gravação otimista local', est === 'nao-consta');
  const marcador = Io.st.pendente && Io.st.pendente.marcador;
  const viaSdk = await dbOff.ref(marcador).get().then((sn) => (sn.val() ? 'EXISTE (gravação otimista local)' : 'inexistente'), () => 'rejeitou');
  const viaRest = await new Promise((r) => Io.leitores.servidor(marcador, r));
  anota('achado que motivou o REST: com a gravação pendente, o get() do SDK responde "' + viaSdk + '", enquanto o servidor, lido por REST, não tem o evento', viaRest.ok === true && viaRest.valor === null);
  anota('o servidor realmente ainda NÃO tem a alteração', (await ler(ORG + '/conceitos/SQ2/definicaoVigenteFonteId')) === 'f1' && (await eventos()) === 0);
  Io.st.flash = null; Io.removerVigencia('organizacional', 'SQ2');
  anota('repetir a operação enquanto isso é BLOQUEADO (aviso, nenhuma segunda gravação enfileirada)', !!Io.st.flash && /Aguarde/.test(Io.st.flash.texto));
  dbOff.goOnline();
  const resolveu = await ate(() => !Io.st.pendente && Io.st.flash && /FOI aplicada/.test(Io.st.flash.texto), 8000);
  anota('ao reconectar, a confirmação chega e a tela informa que a alteração FOI aplicada', resolveu, Io.st.flash ? Io.st.flash.texto : 'sem mensagem');
  await ate(() => DO.estado === 'ok' && DO.conceitos.SQ2 && !DO.conceitos.SQ2.definicaoVigenteFonteId, 5000);
  anota('a tela foi reconciliada: o conceito aparece sem definição vigente', !!DO.conceitos.SQ2 && !DO.conceitos.SQ2.definicaoVigenteFonteId);
  anota('banco: sem ponteiro, fonte rebaixada, situação "em revisão" (equivalência mantida)', !(await ler(ORG + '/conceitos/SQ2/definicaoVigenteFonteId')) && (await ler(ORG + '/fontes/SQ2/f1/situacao')) === 'histórica/contextual' && (await ler(ORG + '/conceitos/SQ2/situacaoDefinicao')) === 'em revisão');
  anota('UM só evento de auditoria (nenhuma repetição)', (await eventos()) === 1);

  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  await testEnv.cleanup();
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
