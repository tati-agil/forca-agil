/* ═════════════════════════════════════════════════════════════════
   Regras do banco — GOVERNANÇA DA TAXONOMIA (Etapa 5).

   Roda contra o EMULADOR real do Realtime Database (firebase emulators:exec) — o mesmo
   database.rules.json que vai para produção, nunca uma reimplementação em JS.

   O que se prova (pelo BANCO, não pela tela):
   A. avaliacao-classificacoes/<codigo> — a ligação canônica "classificação do motor da Avaliação ↔ conceito
      arquitetural de mesmo código": só admin geral lê e grava; nasce uma vez, com o conceito existente e ativo e
      com a linha de auditoria NOVA da mesma gravação; depois nunca muda nem é apagada (nesta etapa não existe
      "encerrar ligação"); o histórico dela só aceita acréscimo e não existe sem a ligação.
   B. Inativação: conceito arquitetural ligado NÃO pode ser inativado (e a tentativa não deixa histórico);
      os demais exigem motivo + auditoria nova apontada; reativar também fica registrado; nada é apagado.
   C. Relações: criar exige histórico nas DUAS pontas (mesma chave, mesmo operacaoId); depois só ENCERRAR
      (motivo, data, autor, histórico); nunca alterar, apagar, duplicar nem recriar uma idêntica encerrada.
   D. As operações REAIS da aplicação (taxonomia.js) passam nessas regras — e as que a tela recusa não gravam.
   E. Camada: "Tipo organizacional" (A) e "Organização do trabalho" só trocam entre si, com motivo e auditoria nova
      da mesma gravação; conceito com pai não troca; a última troca não é reescrita nem apagada; relações intactas.
      Conceito com FILHOS (ativos ou inativos) não troca — provado pelo BANCO via índice reverso
      taxonomia/organizacional/filhos/<pai>/<filho> (coerente com conceito.pai) e a marca meta/indiceFilhos; antes
      do índice existir a troca falha fechada; a primeira troca pela tela constrói o índice na mesma gravação.
   ═════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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

const SUPER = 'tatianefdirene@previ.com.br';   /* e-mail fixo de admin geral */
const ADMIN = 'admin.geral@previ.com.br';        /* fa-admins (admin geral) */
const AVAL = 'avaliacao@previ.com.br';           /* tipo 'avaliacao' */
const ARQ = 'arquitetura@previ.com.br';          /* tipo 'avaliacao-arquitetura' */
const SEM_ACESSO = 'sem.acesso@previ.com.br';

const ORG = 'taxonomia/organizacional';
const ARQT = 'taxonomia/arquitetural';
const LIG = 'avaliacao-classificacoes';
const LIGA = 'avaliacao-classificacoes-auditoria';
const QUANDO = '2026-10-06T12:00:00.000Z';

async function main() {
  const regrasArq = process.env.RULES_PATH || path.join(__dirname, '..', '..', 'database.rules.json');
  const rules = fs.readFileSync(regrasArq, 'utf8');
  const PROJ = 'demo-kyber-agil-rules-governanca';
  const testEnv = await initializeTestEnvironment({ projectId: PROJ, database: { rules } });
  const ctx = (email) => (email ? testEnv.authenticatedContext(emailKey(email), { email }) : testEnv.unauthenticatedContext());
  const db = (email) => ctx(email).database();
  const semear = (fn) => testEnv.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (caminho) => { let v; await semear(async (a) => { v = (await a.ref(caminho).once('value')).val(); }); return v; };
  const conta = async (caminho) => Object.keys((await ler(caminho)) || {}).length;

  async function pode(rotulo, promessa) { try { await assertSucceeds(promessa); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi NEGADO: ' + String(e.message || e).slice(0, 140)); } }
  async function nega(rotulo, promessa) { try { await assertFails(promessa); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi PERMITIDO (deveria negar)'); } }

  const arq = (nome, ativo) => ({ nome, ordem: 1, ativo, situacaoDefinicao: 'ainda não registrada' });
  const org = (nome, extra) => Object.assign({ nome, ordem: 1, ativo: true, situacaoDefinicao: 'em revisão', camada: 'B' }, extra || {});
  async function semearBase() {
    await testEnv.clearDatabase();
    await semear(async (a) => {
      await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: ADMIN });
      await a.ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
      await a.ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
      await a.ref(ARQT + '/conceitos/produto-principal').set(arq('Produto ou Serviço', true));
      await a.ref(ARQT + '/conceitos/canal').set(arq('Canal', true));
      await a.ref(ARQT + '/conceitos/componente').set(arq('Componente', true));
      await a.ref(ARQT + '/conceitos/documento-informacao').set(arq('Documento', false));
      await a.ref(ORG + '/conceitos/LINHA').set(org('Linha', { camada: 'A' }));
      await a.ref(ORG + '/conceitos/C1').set(org('Squad', { pai: 'LINHA' }));
      await a.ref(ORG + '/conceitos/C2').set(org('CoE'));
      await a.ref(ORG + '/conceitos/C3').set(org('Antigo', { ativo: false }));
      await a.ref('taxonomia/meta/cargaInicial').set({ feitaEm: QUANDO, feitaPor: ADMIN });
    });
  }
  const admin = () => db(ADMIN);
  const R = (a, p) => a.ref(p);

  /* payloads válidos, montados como a aplicação monta */
  const ligar = (cod, k, email) => ({
    [LIG + '/' + cod]: { registradoEm: QUANDO, registradoPor: email || ADMIN, auditoriaId: k },
    [LIGA + '/' + cod + '/' + k]: { tipo: 'ligacao_registrada', codigo: cod, usuario: { email: email || ADMIN }, dataHora: QUANDO }
  });
  const audC = (dom, cod, k, tipo, extra) => ({ ['taxonomia/' + dom + '/auditoria/' + cod + '/' + k]: Object.assign({ tipo, conceito: cod, campo: 'ativo', usuario: { email: ADMIN }, dataHora: QUANDO }, extra || {}) });
  const inativar = (dom, cod, k, motivo) => Object.assign({
    ['taxonomia/' + dom + '/conceitos/' + cod + '/ativo']: false,
    ['taxonomia/' + dom + '/conceitos/' + cod + '/inativacao']: { motivo: motivo === undefined ? 'Fora de uso' : motivo, em: QUANDO, por: ADMIN, auditoriaId: k }
  }, audC(dom, cod, k, 'inativacao'));
  const relK = (de, tipo, para) => de + '__' + tipo + '__' + para;
  /* altera UM campo de um registro do payload (sem misturar caminho e subcaminho na mesma gravação) */
  const sem = (payload, chave) => { const p = Object.assign({}, payload); delete p[chave]; return p; };
  const mexe = (payload, chave, campo, valor) => { const p = JSON.parse(JSON.stringify(payload)); p[chave][campo] = valor; return p; };
  const audR = (r, k, tipo, op, extra) => {
    const out = {};
    for (const ponta of ['de', 'para']) out[ORG + '/auditoria/' + r[ponta] + '/' + k] = Object.assign({ tipo, conceito: r[ponta], relacao: relK(r.de, r.tipo, r.para), operacaoId: op || k, usuario: { email: ADMIN }, dataHora: QUANDO }, extra || {});
    return out;
  };
  const criarRel = (r, k) => Object.assign({ [ORG + '/relacoes/' + relK(r.de, r.tipo, r.para)]: Object.assign({}, r, { criadaEm: QUANDO, criadaPor: ADMIN, auditoriaId: k }) }, audR(r, k, 'relacao_criada'));
  const encerrarRel = (r, k, motivo) => Object.assign({ [ORG + '/relacoes/' + relK(r.de, r.tipo, r.para) + '/encerrada']: { motivo: motivo === undefined ? 'Não se aplica mais' : motivo, em: QUANDO, por: ADMIN, auditoriaId: k } }, audR(r, k, 'relacao_encerrada'));

  /* ───────────────────────── A. avaliacao-classificacoes ───────────────────────── */
  console.log('== A. Ligação canônica avaliacao-classificacoes ==');
  await semearBase();
  await nega('ligação SEM a auditoria da mesma gravação', R(admin(), LIG + '/produto-principal').set({ registradoEm: QUANDO, registradoPor: ADMIN, auditoriaId: 'k1' }));
  await nega('ligação apontando para auditoria de outro tipo', admin().ref().update(mexe(ligar('produto-principal', 'k1'), LIGA + '/produto-principal/k1', 'tipo', 'outro')));
  await nega('ligação para conceito que NÃO existe na Taxonomia Arquitetural', admin().ref().update(ligar('modalidade-subproduto', 'k1')));
  await nega('ligação para conceito INATIVO', admin().ref().update(ligar('documento-informacao', 'k1')));
  await nega('ligação com registradoPor de outra pessoa', admin().ref().update(ligar('produto-principal', 'k1', SUPER)));
  await nega('auditoria "solta", sem a ligação que a aponta', R(admin(), LIGA + '/canal/k9').set({ tipo: 'ligacao_registrada', codigo: 'canal', usuario: { email: ADMIN }, dataHora: QUANDO }));
  for (const [quem, email] of [['"Avaliação"', AVAL], ['"Avaliação + Arquitetura"', ARQ], ['sem acesso', SEM_ACESSO]]) {
    await nega('(9) ' + quem + ' NÃO cria ligação (só admin geral mantém)', db(email).ref().update(ligar('canal', 'k2', email)));
    await nega('(9) ' + quem + ' NÃO lê as ligações', R(db(email), LIG).once('value'));
    await nega('(9) ' + quem + ' NÃO lê o histórico das ligações', R(db(email), LIGA).once('value'));
  }
  await nega('(9) sem login NÃO cria ligação', db(null).ref().update(ligar('canal', 'k2')));
  await pode('admin geral (fa-admins) registra a ligação + auditoria numa gravação só', admin().ref().update(ligar('produto-principal', 'k1')));
  await pode('admin geral (e-mail fixo) registra outra ligação', db(SUPER).ref().update(ligar('canal', 'k3', SUPER)));
  await pode('várias ligações numa gravação só (carga inicial)', admin().ref().update(Object.assign(ligar('componente', 'k4'))));
  await pode('admin geral lê as ligações e o histórico', Promise.all([R(admin(), LIG).once('value'), R(admin(), LIGA).once('value')]));
  await nega('ligação existente NÃO é reescrita (mesmo com auditoria nova)', admin().ref().update(ligar('produto-principal', 'k5')));
  await nega('ligação existente NÃO é alterada (campo)', R(admin(), LIG + '/produto-principal/registradoEm').set('2026-10-07T00:00:00.000Z'));
  await nega('ligação existente NÃO é "encerrada" (campo novo)', R(admin(), LIG + '/produto-principal/encerrada').set({ motivo: 'x' }));
  await nega('ligação NÃO é apagada', R(admin(), LIG + '/produto-principal').remove());
  await nega('o nó inteiro de ligações NÃO é apagado', R(db(SUPER), LIG).remove());
  await nega('(10) histórico da ligação NÃO é alterado', R(admin(), LIGA + '/produto-principal/k1/tipo').set('ligacao_registrada_editada'));
  await nega('(10) histórico da ligação NÃO é reescrito', R(admin(), LIGA + '/produto-principal/k1').set({ tipo: 'ligacao_registrada', usuario: { email: ADMIN }, dataHora: 'x' }));
  await nega('(10) histórico da ligação NÃO é apagado', R(admin(), LIGA + '/produto-principal/k1').remove());
  await nega('(10) histórico inteiro das ligações NÃO é apagado', R(db(SUPER), LIGA).remove());
  anota('estado: 3 ligações, cada uma com 1 linha de histórico', (await conta(LIG)) === 3 && (await conta(LIGA + '/produto-principal')) === 1 && (await conta(LIGA + '/canal')) === 1);
  await nega('ligar e inativar o conceito NA MESMA gravação', admin().ref().update(Object.assign(ligar('componente', 'kX'), inativar('arquitetural', 'componente', 'iX'))));

  /* ───────────────────────── B. Inativação ───────────────────────── */
  console.log('\n== B. Inativação de conceitos ==');
  const audAntes = await conta(ARQT + '/auditoria/produto-principal');
  await nega('(1) conceito LIGADO à Avaliação NÃO pode ser inativado (mesmo com motivo e auditoria)', admin().ref().update(inativar('arquitetural', 'produto-principal', 'i1')));
  await nega('(1) …nem só gravando ativo=false', R(admin(), ARQT + '/conceitos/produto-principal/ativo').set(false));
  await nega('(1) …nem reescrevendo o conceito inteiro inativo', R(db(SUPER), ARQT + '/conceitos/produto-principal').set(Object.assign(arq('Produto ou Serviço', false), { inativacao: { motivo: 'x', em: QUANDO, por: SUPER, auditoriaId: 'i2' } })));
  anota('(2) a tentativa recusada NÃO gerou histórico nem mudou o conceito', (await conta(ARQT + '/auditoria/produto-principal')) === audAntes && (await ler(ARQT + '/conceitos/produto-principal/ativo')) === true);
  await pode('conceito ligado continua editável (renomear)', R(admin(), ARQT + '/conceitos/produto-principal/nome').set('Produto/Serviço'));
  await semear(async (a) => { await a.ref(ARQT + '/conceitos/regra-condicao').set(arq('Regra', true)); });
  await nega('inativar SEM motivo', admin().ref().update(inativar('arquitetural', 'regra-condicao', 'i3', '')));
  await nega('inativar SEM o bloco inativacao', admin().ref().update(Object.assign({ [ARQT + '/conceitos/regra-condicao/ativo']: false }, audC('arquitetural', 'regra-condicao', 'i3', 'inativacao'))));
  await nega('inativar SEM a auditoria apontada', R(admin(), ARQT + '/conceitos/regra-condicao').update({ ativo: false, inativacao: { motivo: 'x', em: QUANDO, por: ADMIN, auditoriaId: 'i3' } }));
  await nega('inativar apontando auditoria de OUTRO tipo', admin().ref().update(Object.assign(inativar('arquitetural', 'regra-condicao', 'i3'), audC('arquitetural', 'regra-condicao', 'i3', 'alteracao_conceito'))));
  await nega('inativar com "por" de outra pessoa', admin().ref().update(mexe(inativar('arquitetural', 'regra-condicao', 'i3'), ARQT + '/conceitos/regra-condicao/inativacao', 'por', SUPER)));
  await pode('(3) conceito arquitetural NÃO ligado: inativado com motivo + auditoria', admin().ref().update(inativar('arquitetural', 'regra-condicao', 'i3')));
  anota('(3) o conceito ficou inativo, com motivo, e com 1 linha de histórico do tipo inativacao', (await ler(ARQT + '/conceitos/regra-condicao/ativo')) === false && (await ler(ARQT + '/conceitos/regra-condicao/inativacao/motivo')) === 'Fora de uso' && (await ler(ARQT + '/auditoria/regra-condicao/i3/tipo')) === 'inativacao');
  await nega('conceito inativo: o motivo NÃO pode ser reescrito', R(admin(), ARQT + '/conceitos/regra-condicao/inativacao/motivo').set('Outro motivo'));
  await nega('conceito inativo: o bloco inativacao NÃO pode ser removido mantendo inativo', R(admin(), ARQT + '/conceitos/regra-condicao/inativacao').remove());
  await pode('conceito inativo continua editável (nome) — histórico preservado', R(admin(), ARQT + '/conceitos/regra-condicao/nome').set('Regra/Condição'));
  await nega('reativar SEM registro', R(admin(), ARQT + '/conceitos/regra-condicao').update({ ativo: true, inativacao: null }));
  await nega('reativar mantendo o bloco inativacao', admin().ref().update(Object.assign({ [ARQT + '/conceitos/regra-condicao/ativo']: true, [ARQT + '/conceitos/regra-condicao/reativacao']: { em: QUANDO, por: ADMIN, auditoriaId: 'r1' } }, audC('arquitetural', 'regra-condicao', 'r1', 'reativacao'))));
  await pode('reativar com registro + auditoria (o bloco inativacao sai; o histórico fica)', admin().ref().update(Object.assign({ [ARQT + '/conceitos/regra-condicao/ativo']: true, [ARQT + '/conceitos/regra-condicao/inativacao']: null, [ARQT + '/conceitos/regra-condicao/reativacao']: { em: QUANDO, por: ADMIN, auditoriaId: 'r1' } }, audC('arquitetural', 'regra-condicao', 'r1', 'reativacao'))));
  await nega('inativar de novo REUSANDO uma auditoria que já existia', admin().ref().update({ [ARQT + '/conceitos/regra-condicao/ativo']: false, [ARQT + '/conceitos/regra-condicao/reativacao']: null, [ARQT + '/conceitos/regra-condicao/inativacao']: { motivo: 'x', em: QUANDO, por: ADMIN, auditoriaId: 'i3' } }));
  await pode('(3) conceito ORGANIZACIONAL inativado com motivo + auditoria (filhos/relações não bloqueiam)', admin().ref().update(inativar('organizacional', 'LINHA', 'i4')));
  await nega('conceito NÃO é apagado (arquitetural)', R(admin(), ARQT + '/conceitos/regra-condicao').remove());
  await nega('conceito NÃO é apagado (organizacional)', R(admin(), ORG + '/conceitos/C2').remove());
  await nega('não admin ("Avaliação + Arquitetura") NÃO inativa', db(ARQ).ref().update(inativar('arquitetural', 'componente', 'i5')));
  await nega('(10) histórico do conceito NÃO é alterado', R(admin(), ARQT + '/auditoria/regra-condicao/i3/motivo').set('editado'));
  await nega('(10) histórico do conceito NÃO é apagado', R(admin(), ARQT + '/auditoria/regra-condicao/i3').remove());

  /* ───────────────────────── C. Relações ───────────────────────── */
  console.log('\n== C. Relações: criar, encerrar, nunca apagar ==');
  await semearBase();
  const r1 = { de: 'C1', tipo: 'compoe', para: 'C2' };
  await nega('criar SEM a auditoria do DESTINO', admin().ref().update(sem(criarRel(r1, 'a1'), ORG + '/auditoria/C2/a1')));
  await nega('criar SEM a auditoria da ORIGEM', admin().ref().update(sem(criarRel(r1, 'a1'), ORG + '/auditoria/C1/a1')));
  await nega('criar com operacaoId DIFERENTE nas duas pontas', admin().ref().update(mexe(criarRel(r1, 'a1'), ORG + '/auditoria/C2/a1', 'operacaoId', 'outra')));
  await nega('criar com auditoria de OUTRO tipo', admin().ref().update(mexe(criarRel(r1, 'a1'), ORG + '/auditoria/C1/a1', 'tipo', 'alteracao_relacao')));
  await nega('criar com auditoria citando OUTRA relação', admin().ref().update(mexe(criarRel(r1, 'a1'), ORG + '/auditoria/C1/a1', 'relacao', 'X__compoe__Y')));
  await nega('criar com tipo desconhecido', admin().ref().update(criarRel({ de: 'C1', tipo: 'herda', para: 'C2' }, 'a1')));
  await nega('criar com conceito INATIVO', admin().ref().update(criarRel({ de: 'C1', tipo: 'atende', para: 'C3' }, 'a1')));
  await nega('criar com conceito inexistente', admin().ref().update(criarRel({ de: 'C1', tipo: 'atende', para: 'FANTASMA' }, 'a1')));
  await nega('criar de um conceito para ele mesmo', admin().ref().update(criarRel({ de: 'C1', tipo: 'atende', para: 'C1' }, 'a1')));
  await nega('criar já "encerrada"', admin().ref().update(mexe(criarRel(r1, 'a1'), ORG + '/relacoes/C1__compoe__C2', 'encerrada', { motivo: 'x', em: QUANDO, por: ADMIN, auditoriaId: 'a1' })));
  await nega('não admin ("Avaliação + Arquitetura") NÃO cria relação', db(ARQ).ref().update(criarRel(r1, 'a1')));
  await pode('(4) criar relação válida, com histórico nas duas pontas (mesma chave e operacaoId)', admin().ref().update(criarRel(r1, 'a1')));
  anota('(4) o histórico da criação ficou nas DUAS pontas, com o mesmo operacaoId', (await ler(ORG + '/auditoria/C1/a1/tipo')) === 'relacao_criada' && (await ler(ORG + '/auditoria/C2/a1/operacaoId')) === (await ler(ORG + '/auditoria/C1/a1/operacaoId')));
  await nega('(7) relação duplicada ATIVA (mesma de/tipo/para) é recusada', admin().ref().update(criarRel(r1, 'a2')));
  await nega('relação ativa: tipo/nota NÃO são alterados em silêncio', R(admin(), ORG + '/relacoes/C1__compoe__C2/nota').set('nova nota'));
  await nega('relação ativa: autor NÃO é reescrito', R(admin(), ORG + '/relacoes/C1__compoe__C2/criadaPor').set(SUPER));
  await nega('(6) relação ativa NÃO é apagada', R(admin(), ORG + '/relacoes/C1__compoe__C2').remove());
  await nega('encerrar SEM motivo', admin().ref().update(encerrarRel(r1, 'e1', '')));
  await nega('encerrar SEM a auditoria do destino', admin().ref().update(sem(encerrarRel(r1, 'e1'), ORG + '/auditoria/C2/e1')));
  await nega('encerrar mudando a nota junto', admin().ref().update(Object.assign(encerrarRel(r1, 'e1'), { [ORG + '/relacoes/C1__compoe__C2/nota']: 'x' })));
  await pode('(5) encerrar com motivo, data, autor e histórico nas duas pontas', admin().ref().update(encerrarRel(r1, 'e1')));
  const rel = await ler(ORG + '/relacoes/C1__compoe__C2');
  anota('(5) a relação encerrada CONTINUA registrada (de/tipo/para/autor) com o encerramento', !!rel && rel.de === 'C1' && rel.criadaPor === ADMIN && rel.encerrada && rel.encerrada.motivo === 'Não se aplica mais' && (await ler(ORG + '/auditoria/C2/e1/tipo')) === 'relacao_encerrada');
  await nega('(6) relação ENCERRADA NÃO é apagada', R(admin(), ORG + '/relacoes/C1__compoe__C2').remove());
  await nega('encerrar de novo (outro motivo)', admin().ref().update(encerrarRel(r1, 'e2', 'Outro')));
  await nega('"reabrir" tirando o encerramento', R(admin(), ORG + '/relacoes/C1__compoe__C2/encerrada').remove());
  await nega('(8) relação IDÊNTICA a uma encerrada NÃO pode ser criada de novo', admin().ref().update(criarRel(r1, 'a3')));
  const r2 = { de: 'C1', tipo: 'atende', para: 'C2' }, r3 = { de: 'C1', tipo: 'aloca-em', para: 'C2' };
  await pode('criar r2', admin().ref().update(criarRel(r2, 'a4')));
  await pode('"Alterar" = encerrar a antiga + criar a nova NA MESMA gravação (mesmo operacaoId nas quatro linhas)',
    admin().ref().update(Object.assign(encerrarRel(r2, 'e3'), audR(r2, 'e3', 'relacao_encerrada', 'e3'), criarRel(r3, 'a5'), audR(r3, 'a5', 'relacao_criada', 'e3'))));
  anota('após "Alterar": a antiga encerrada e a nova ativa', !!(await ler(ORG + '/relacoes/C1__atende__C2/encerrada')) && (await ler(ORG + '/relacoes/C1__aloca-em__C2/de')) === 'C1' && !(await ler(ORG + '/relacoes/C1__aloca-em__C2/encerrada')));
  await nega('carga inicial já feita: relação "à moda antiga" (sem histórico) é recusada', R(admin(), ORG + '/relacoes/C2__compoe__LINHA').set({ de: 'C2', tipo: 'compoe', para: 'LINHA' }));
  await nega('(10) histórico de relação NÃO é alterado', R(admin(), ORG + '/auditoria/C1/a1/relacao').set('x'));
  await nega('(10) histórico de relação NÃO é apagado', R(admin(), ORG + '/auditoria/C2/e1').remove());
  await nega('o nó inteiro de relações NÃO é apagado', R(db(SUPER), ORG + '/relacoes').remove());
  await testEnv.clearDatabase();
  await semear(async (a) => { await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: ADMIN }); await a.ref(ORG + '/conceitos/AA').set(org('A')); await a.ref(ORG + '/conceitos/BB').set(org('B')); });
  await pode('carga inicial (uma vez): relações sem histórico individual entram junto com a marca da carga', admin().ref().update({ [ORG + '/relacoes/AA__compoe__BB']: { de: 'AA', tipo: 'compoe', para: 'BB' }, 'taxonomia/meta/cargaInicial': { feitaEm: QUANDO, feitaPor: ADMIN } }));
  const rLeg = { de: 'AA', tipo: 'compoe', para: 'BB' };
  await pode('relação da carga (sem criadaEm/auditoria) pode ser encerrada normalmente', admin().ref().update(encerrarRel(rLeg, 'e9')));

  /* ───────────────────────── E. Camada "Organização do trabalho" ───────────────────────── */
  console.log('\n== E. Camada: Tipo organizacional ⇄ Organização do trabalho ==');
  const trocaCamada = (cod, k, de, para, extra) => Object.assign({
    [ORG + '/conceitos/' + cod + '/camada']: para,
    [ORG + '/conceitos/' + cod + '/camadaAlteracao']: Object.assign({ de, para, motivo: 'Organização do trabalho, não posicionamento', em: QUANDO, por: ADMIN, auditoriaId: k }, extra || {}),
    [ORG + '/auditoria/' + cod + '/' + k]: { tipo: 'alteracao_camada', conceito: cod, campo: 'camada', usuario: { email: (extra && extra.por) || ADMIN }, dataHora: QUANDO }
  });
  const IDX = 'taxonomia/meta/indiceFilhos';
  const marca = (email) => ({ [IDX]: { criadoEm: QUANDO, criadoPor: email || ADMIN } });
  /* estado depois da construção do índice: marca + filhos/<pai>/<filho> de todo conceito com pai */
  async function semearCamadas(semIndice) {
    await semearBase();
    await semear(async (a) => {
      await a.ref(ORG + '/conceitos/SQUAD').set(org('Squad', { camada: 'A' }));
      await a.ref(ORG + '/conceitos/CAPITULO').set(org('Capítulo', { camada: 'A' }));
      await a.ref(ORG + '/conceitos/FILHO_A').set(org('Com pai', { camada: 'A', pai: 'LINHA' }));
      await a.ref(ORG + '/conceitos/AREA').set(org('Área', { camada: 'A' }));
      await a.ref(ORG + '/conceitos/ESP_INATIVA').set(org('Especialização inativa', { pai: 'AREA', ativo: false }));
      await a.ref(ORG + '/relacoes/SQUAD__compoe__LINHA').set({ de: 'SQUAD', tipo: 'compoe', para: 'LINHA' });
      if (!semIndice) {
        await a.ref(ORG + '/filhos').set({ LINHA: { C1: true, FILHO_A: true } });  /* ESP_INATIVA (inativa) não entra */
        await a.ref(IDX).set({ criadoEm: QUANDO, criadoPor: ADMIN });
      }
    });
  }

  console.log('-- E1. Antes do índice de filhos existir: a troca falha fechada --');
  await semearCamadas(true);
  await nega('sem o índice (meta/indiceFilhos), a troca é recusada mesmo sem filhos', admin().ref().update(trocaCamada('SQUAD', 'c1', 'A', 'trabalho')));
  await nega('…e LINHA (com filhos) também — "ainda não sei" não vira "pode"', admin().ref().update(trocaCamada('LINHA', 'c1', 'A', 'trabalho')));
  await nega('cliente NÃO cria a marca do índice depois da carga inicial (nem com o índice completo)', admin().ref().update(Object.assign(marca(),
    { [ORG + '/filhos/LINHA/C1']: true, [ORG + '/filhos/LINHA/FILHO_A']: true })));
  await nega('entrada no índice para filho INATIVO é recusada (o índice só guarda filhos ativos)', R(admin(), ORG + '/filhos/AREA/ESP_INATIVA').set(true));
  await nega('cliente NÃO cria a marca omitindo filhos para trocar LINHA na mesma gravação', admin().ref().update(Object.assign(marca(), trocaCamada('LINHA', 'c1', 'A', 'trabalho'))));
  await nega('…nem o e-mail fixo de admin geral', db(SUPER).ref().update(marca(SUPER)));
  await pode('antes da marca, entradas do índice coerentes com conceito.pai podem ser gravadas (não provam nada sozinhas)', R(admin(), ORG + '/filhos/LINHA/FILHO_A').set(true));
  await nega('…e continuam sem liberar a troca', admin().ref().update(trocaCamada('SQUAD', 'c1', 'A', 'trabalho')));

  /* construção única (workflow, conta de serviço): o MESMO script, contra o emulador, sem regras como o admin SDK */
  const IND = require('./construir-indice-filhos.js');
  let res;
  await semear(async (a) => { res = await IND.aplicar(a, { confirmar: false, agora: QUANDO }); });
  anota('construção: a simulação lista só filhos ATIVOS (C1 falta; FILHO_A já existia; ESP_INATIVA fica fora) e NÃO grava', !res.gravou && res.plano.total === 2 && res.plano.faltam.join(',') === 'LINHA/C1' && res.plano.sobrando.length === 0 && !(await ler(IDX)), JSON.stringify(res && res.plano));
  await semear(async (a) => { res = await IND.aplicar(a, { confirmar: true, agora: QUANDO }); });
  const histGeral = Object.values((await ler(ORG + '/auditoria/_catalogo')) || {}).filter((e) => e.tipo === 'indice_filhos');
  anota('construção: grava entradas + marca + histórico geral, numa gravação (sem o filho inativo)', res.gravou && (await ler(ORG + '/filhos/LINHA/C1')) === true && (await ler(ORG + '/filhos/AREA/ESP_INATIVA')) === null && (await ler(IDX + '/criadoPor')) === IND.AUTOR && histGeral.length === 1 && histGeral[0].total === 2 && histGeral[0].gravadas === 1);
  anota('construção: não toca em conceitos nem relações', (await ler(ORG + '/conceitos/LINHA/camada')) === 'A' && (await ler(ORG + '/relacoes/SQUAD__compoe__LINHA/de')) === 'SQUAD');
  await semear(async (a) => { res = await IND.aplicar(a, { confirmar: true, agora: QUANDO }); });
  anota('construção: rodar de novo não grava nada (a marca já existe)', !res.gravou && res.plano.jaConstruido && Object.values((await ler(ORG + '/auditoria/_catalogo')) || {}).filter((e) => e.tipo === 'indice_filhos').length === 1);
  const pl = IND.planejar({ X: { pai: 'P', ativo: true }, Y: { pai: 'P', ativo: false } }, { Q: { X: true }, P: { Y: true } }, null);
  anota('construção: entradas que não são de filho ativo daquele pai saem na mesma gravação', pl.pode && pl.faltam.join() === 'P/X' && pl.sobrando.join() === 'P/Y,Q/X', JSON.stringify(pl));
  await nega('depois da construção: LINHA (com filhos) NÃO troca', admin().ref().update(trocaCamada('LINHA', 'c1', 'A', 'trabalho')));
  await pode('depois da construção: SQUAD (sem filhos) troca', admin().ref().update(trocaCamada('SQUAD', 'c1', 'A', 'trabalho')));
  await nega('a marca do índice NÃO é reescrita', R(admin(), IDX).set({ criadoEm: 'outro', criadoPor: ADMIN }));
  await nega('a marca do índice NÃO é apagada', R(admin(), IDX).remove());

  console.log('-- E1b. Banco novo: a carga inicial já nasce com índice completo --');
  await testEnv.clearDatabase();
  await semear(async (a) => { await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: ADMIN }); });
  const carga = (comIndice) => Object.assign({
    'taxonomia/meta/cargaInicial': { feitaEm: QUANDO, feitaPor: ADMIN },
    [ORG + '/conceitos/PAI']: org('Pai', { camada: 'A' }), [ORG + '/conceitos/FILHO']: org('Filho', { pai: 'PAI' })
  }, marca(), comIndice ? { [ORG + '/filhos/PAI/FILHO']: true } : {});
  await nega('carga inicial com a marca mas SEM a entrada do filho é recusada (índice incompleto não passa)', admin().ref().update(carga(false)));
  await pode('carga inicial com conceitos, índice e marca na mesma gravação', admin().ref().update(carga(true)));
  await nega('depois da carga, PAI (com filho) não troca de camada', admin().ref().update(trocaCamada('PAI', 'c1', 'A', 'trabalho')));

  console.log('-- E2. Com o índice: filhos (ativos ou inativos) bloqueiam a troca no banco --');
  await semearCamadas();
  await nega('(bloqueio no BANCO) LINHA com filho ativo NÃO troca de camada (gravação direta)', admin().ref().update(trocaCamada('LINHA', 'c1', 'A', 'trabalho')));
  await nega('…nem pelo e-mail fixo de admin geral', db(SUPER).ref().update(trocaCamada('LINHA', 'c1', 'A', 'trabalho', { por: SUPER })));
  await pode('(filho inativo NÃO bloqueia) AREA, só com filho inativo, troca de camada', admin().ref().update(trocaCamada('AREA', 'c1', 'A', 'trabalho')));
  await pode('…e volta (o filho inativo e o histórico continuam lá)', admin().ref().update(trocaCamada('AREA', 'c2', 'trabalho', 'A')));
  anota('o filho inativo continua registrado, apontando para AREA', (await ler(ORG + '/conceitos/ESP_INATIVA/pai')) === 'AREA' && (await ler(ORG + '/conceitos/ESP_INATIVA/ativo')) === false);
  /* inativar/reativar um filho mantém o índice — o banco obriga, na mesma gravação */
  await nega('inativar FILHO_A SEM tirar a entrada do índice', admin().ref().update(inativar('organizacional', 'FILHO_A', 'i1')));
  await pode('inativar FILHO_A tirando a entrada do índice na mesma gravação', admin().ref().update(Object.assign(inativar('organizacional', 'FILHO_A', 'i1'), { [ORG + '/filhos/LINHA/FILHO_A']: null })));
  await nega('LINHA ainda tem C1 ativo: continua sem trocar', admin().ref().update(trocaCamada('LINHA', 'c1', 'A', 'trabalho')));
  const reativar = (cod, k, comEntrada) => Object.assign({
    [ORG + '/conceitos/' + cod + '/ativo']: true, [ORG + '/conceitos/' + cod + '/inativacao']: null,
    [ORG + '/conceitos/' + cod + '/reativacao']: { em: QUANDO, por: ADMIN, auditoriaId: k }
  }, audC('organizacional', cod, k, 'reativacao'), comEntrada ? { [ORG + '/filhos/LINHA/' + cod]: true } : {});
  await nega('reativar FILHO_A SEM recolocar a entrada do índice', admin().ref().update(reativar('FILHO_A', 'r1', false)));
  await pode('reativar FILHO_A recolocando a entrada do índice', admin().ref().update(reativar('FILHO_A', 'r1', true)));
  await nega('apagar a entrada do índice enquanto o filho ainda aponta para o pai', R(admin(), ORG + '/filhos/LINHA/FILHO_A').remove());
  await nega('apagar a entrada do índice e trocar a camada do pai na mesma gravação', admin().ref().update(Object.assign({ [ORG + '/filhos/LINHA/FILHO_A']: null, [ORG + '/filhos/LINHA/C1']: null }, trocaCamada('LINHA', 'c1', 'A', 'trabalho'))));
  await nega('apagar o índice inteiro de um pai', R(admin(), ORG + '/filhos/LINHA').remove());
  await nega('entrada falsa no índice (o filho não aponta para esse pai)', R(admin(), ORG + '/filhos/SQUAD/C2').set(true));
  await nega('entrada com valor diferente de true', R(admin(), ORG + '/filhos/LINHA/FILHO_A').set('sim'));
  await nega('com o índice construído, conceito NOVO com pai exige a entrada no índice', R(admin(), ORG + '/conceitos/NOVO_FILHO').set(org('Novo filho', { pai: 'AREA' })));
  await pode('conceito NOVO com pai + entrada no índice, na mesma gravação', admin().ref().update({ [ORG + '/conceitos/NOVO_FILHO']: org('Novo filho', { pai: 'AREA' }), [ORG + '/filhos/AREA/NOVO_FILHO']: true }));
  await nega('trocar o pai de um conceito sem a entrada nova no índice', R(admin(), ORG + '/conceitos/NOVO_FILHO/pai').set('LINHA'));
  await pode('trocar o pai com a entrada nova no índice (a antiga pode sair quando ele deixa de apontar)', admin().ref().update({ [ORG + '/conceitos/NOVO_FILHO/pai']: 'LINHA', [ORG + '/filhos/LINHA/NOVO_FILHO']: true, [ORG + '/filhos/AREA/NOVO_FILHO']: null }));
  await pode('conceito com pai indexado continua editável (nome)', R(admin(), ORG + '/conceitos/FILHO_A/nome').set('Com pai (renomeado)'));
  await nega('"Avaliação + Arquitetura" (não admin) NÃO grava no índice', R(db(ARQ), ORG + '/filhos/LINHA/X').set(true));
  await pode('SEM filhos: SQUAD troca normalmente', admin().ref().update(trocaCamada('SQUAD', 'c0', 'A', 'trabalho')));
  await semearCamadas();

  await nega('trocar camada SEM a auditoria da mesma gravação', admin().ref().update(sem(trocaCamada('SQUAD', 'c1', 'A', 'trabalho'), ORG + '/auditoria/SQUAD/c1')));
  await nega('trocar camada SEM o registro camadaAlteracao', admin().ref().update(sem(trocaCamada('SQUAD', 'c1', 'A', 'trabalho'), ORG + '/conceitos/SQUAD/camadaAlteracao')));
  await nega('trocar camada só gravando o campo camada', R(admin(), ORG + '/conceitos/SQUAD/camada').set('trabalho'));
  await nega('trocar camada SEM motivo', admin().ref().update(trocaCamada('SQUAD', 'c1', 'A', 'trabalho', { motivo: '' })));
  await nega('trocar camada apontando auditoria de OUTRO tipo', admin().ref().update(mexe(trocaCamada('SQUAD', 'c1', 'A', 'trabalho'), ORG + '/auditoria/SQUAD/c1', 'tipo', 'alteracao_conceito')));
  await nega('trocar camada com "de" que não é a camada atual', admin().ref().update(trocaCamada('SQUAD', 'c1', 'trabalho', 'trabalho')));
  await nega('trocar camada com "para" diferente da camada gravada', admin().ref().update(mexe(trocaCamada('SQUAD', 'c1', 'A', 'trabalho'), ORG + '/conceitos/SQUAD/camadaAlteracao', 'para', 'A')));
  await nega('trocar camada com "por" de outra pessoa', admin().ref().update(mexe(trocaCamada('SQUAD', 'c1', 'A', 'trabalho'), ORG + '/conceitos/SQUAD/camadaAlteracao', 'por', SUPER)));
  await nega('Especialização (B) NÃO vai para Organização do trabalho', admin().ref().update(trocaCamada('C2', 'c1', 'B', 'trabalho')));
  await nega('Tipo organizacional (A) NÃO vai para Especialização (B) por esta via', admin().ref().update(trocaCamada('SQUAD', 'c1', 'A', 'B')));
  await nega('conceito COM pai NÃO troca de camada', admin().ref().update(trocaCamada('FILHO_A', 'c1', 'A', 'trabalho')));
  await nega('camada inexistente é recusada', R(admin(), ORG + '/conceitos/SQUAD/camada').set('Z'));
  await nega('"Avaliação + Arquitetura" (não admin) NÃO troca camada', db(ARQ).ref().update(trocaCamada('SQUAD', 'c1', 'A', 'trabalho')));
  await pode('admin: SQUAD de Tipo organizacional para Organização do trabalho, com motivo + auditoria', admin().ref().update(trocaCamada('SQUAD', 'c1', 'A', 'trabalho')));
  anota('SQUAD: camada trabalho, nome e relação "SQUAD compõe LINHA" intactos',
    (await ler(ORG + '/conceitos/SQUAD/camada')) === 'trabalho' && (await ler(ORG + '/conceitos/SQUAD/nome')) === 'Squad' && (await ler(ORG + '/relacoes/SQUAD__compoe__LINHA/de')) === 'SQUAD');
  await pode('admin: CAPITULO também (e-mail fixo)', db(SUPER).ref().update(trocaCamada('CAPITULO', 'c2', 'A', 'trabalho', { por: SUPER })));
  await nega('o motivo da última troca NÃO é reescrito', R(admin(), ORG + '/conceitos/SQUAD/camadaAlteracao/motivo').set('Outro motivo'));
  await nega('o registro da última troca NÃO é apagado', R(admin(), ORG + '/conceitos/SQUAD/camadaAlteracao').remove());
  await pode('conceito trocado continua editável (nome)', R(admin(), ORG + '/conceitos/SQUAD/nome').set('Squad (time)'));
  await nega('trocar de novo REUSANDO uma auditoria existente', admin().ref().update(sem(trocaCamada('SQUAD', 'c1', 'trabalho', 'A'), ORG + '/auditoria/SQUAD/c1')));
  await pode('desfazer: Organização do trabalho de volta para Tipo organizacional, com auditoria nova', admin().ref().update(trocaCamada('SQUAD', 'c3', 'trabalho', 'A')));
  anota('o histórico do SQUAD guarda as duas trocas', Object.values((await ler(ORG + '/auditoria/SQUAD')) || {}).filter((e) => e.tipo === 'alteracao_camada').length === 2);
  await nega('(10) histórico da troca NÃO é alterado', R(admin(), ORG + '/auditoria/SQUAD/c1/tipo').set('outro'));
  await nega('(10) histórico da troca NÃO é apagado', R(admin(), ORG + '/auditoria/SQUAD/c1').remove());
  await nega('conceito NOVO não nasce com camadaAlteracao', R(admin(), ORG + '/conceitos/NOVO').set(org('Novo', { camada: 'trabalho', camadaAlteracao: { de: 'A', para: 'trabalho', motivo: 'x', em: QUANDO, por: ADMIN, auditoriaId: 'c9' } })));
  await pode('conceito NOVO pode nascer na camada trabalho (importação)', R(admin(), ORG + '/conceitos/NOVO').set(org('Novo', { camada: 'trabalho' })));
  await nega('camadaAlteracao NÃO existe no domínio arquitetural', R(admin(), ARQT + '/conceitos/canal/camadaAlteracao').set({ de: 'A', para: 'trabalho', motivo: 'x', em: QUANDO, por: ADMIN, auditoriaId: 'c9' }));

  /* ───────────────────────── D. Operações REAIS da aplicação ───────────────────────── */
  console.log('\n== D. As operações reais de taxonomia.js nas regras reais ==');
  const SRC_TAX = fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'taxonomia.js'), 'utf8');
  const MOTOR = ['produto-principal', 'canal', 'componente', 'documento-informacao', 'modalidade-subproduto'];
  function carregarApp(email) {
    const dbEmu = db(email);
    const el = { addEventListener() {}, innerHTML: '', contains() { return true; }, querySelector() { return null; } };
    const c = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN, innerWidth: 1280 };
    c.window = c;
    c.fetch = fetch; c.URL = URL;
    c.document = { getElementById: (id) => (id === 'adminTaxonomia' ? el : null), querySelector: () => null, addEventListener() {} };
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const tok = () => { const uid = emailKey(email), t = Math.floor(Date.now() / 1000);
      return b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ iss: 'https://securetoken.google.com/' + PROJ, aud: PROJ, sub: uid, user_id: uid, email, iat: t, auth_time: t, exp: t + 3600, firebase: { identities: {}, sign_in_provider: 'custom' } }) + '.'; };
    const hostEmu = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
    c.firebase = { database: () => dbEmu, auth: () => ({ currentUser: { email, getIdToken: () => Promise.resolve(tok()) } }),
      app: () => ({ options: { databaseURL: 'http://' + hostEmu + '?ns=' + PROJ + '-default-rtdb' } }) };
    c.window.faAuth = { getSession: () => ({ email, name: 'Admin Teste' }), isAdmin: () => true, isAdminReady: () => true };
    c.window.faClassificacoes = { codigos: () => MOTOR.slice() };
    vm.createContext(c);
    vm.runInContext(SRC_TAX, c, { filename: 'taxonomia.js' });
    return c.window.faTaxonomia._interno;
  }
  const ate = async (cond, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 6000)) { if (cond()) return true; await new Promise((r) => setTimeout(r, 25)); } return false; };
  await semearBase();
  const I = carregarApp(ADMIN);
  async function opera(rotulo, fn, cond) {
    I.st.flash = null; I.st.salvando = false;
    fn();
    const fim = await ate(() => !I.st.salvando && I.st.flash !== null);
    anota(rotulo + ' — aceito pelo banco', fim && I.st.flash && I.st.flash.erro === false, I.st.flash ? I.st.flash.texto : 'sem resposta');
    if (cond) anota(rotulo + ' — estado gravado coerente', await cond());
  }
  async function abreConceito(dom, cod) {
    I.carregarDominio(dom); await ate(() => I.st.d[dom].estado === 'ok');
    I.st.d[dom].selecionado = cod; I.carregarDetalhe(dom, cod); await ate(() => I.st.d[dom].detalhe && !I.st.d[dom].detalhe.carregando);
  }
  I.carregarLigacoes(); await ate(() => I.st.lig.estado === 'ok');
  I.carregarDominio('arquitetural'); await ate(() => I.st.d.arquitetural.estado === 'ok');
  const prev = I.previaLigacoes();
  const sit = (cod) => (prev.find((x) => x.codigo === cod) || {}).situacao;
  anota('prévia: ligar os ativos; ausente e inativo "não podem ser ligados"', sit('produto-principal') === 'ligar' && sit('canal') === 'ligar' && sit('componente') === 'ligar' && sit('documento-informacao') === 'inativo' && sit('modalidade-subproduto') === 'sem-conceito', JSON.stringify(prev));
  I.st.cargaLig = { erro: null };
  await opera('registrarLigacoes (carga controlada)', () => I.registrarLigacoes(), async () => (await conta(LIG)) === 3 && (await conta(LIGA + '/canal')) === 1);
  await ate(() => I.st.lig.estado === 'ok' && Object.keys(I.st.lig.mapa).length === 3);
  anota('idempotente: depois da carga, a prévia não propõe nada', I.previaLigacoes().filter((x) => x.situacao === 'ligar').length === 0);
  I.st.cargaLig = { erro: null }; I.registrarLigacoes(); await new Promise((r) => setTimeout(r, 300));
  anota('idempotente: rodar de novo NÃO grava nada (nem histórico)', (await conta(LIG)) === 3 && (await conta(LIGA + '/canal')) === 1 && /nada foi gravado/.test(I.st.cargaLig.erro || ''), I.st.cargaLig && I.st.cargaLig.erro);

  await abreConceito('arquitetural', 'canal');
  const audCanal = await conta(ARQT + '/auditoria/canal');
  I.st.d.arquitetural.inativando = { codigo: 'canal', motivo: 'Tentativa', erro: null };
  I.inativarConceito('arquitetural', 'canal'); await new Promise((r) => setTimeout(r, 300));
  anota('tela: conceito ligado — mostra a mensagem combinada e NÃO grava nada',
    I.st.d.arquitetural.inativando.erro === 'Este conceito está ligado à classificação "Canal" da Avaliação e não pode ser inativado enquanto essa ligação estiver ativa.' &&
    (await ler(ARQT + '/conceitos/canal/ativo')) === true && (await conta(ARQT + '/auditoria/canal')) === audCanal, I.st.d.arquitetural.inativando.erro);
  I.st.lig.estado = 'erro';
  I.inativarConceito('arquitetural', 'canal'); await new Promise((r) => setTimeout(r, 200));
  anota('tela: sem saber se está ligado ("ainda não sei"), NÃO grava', /Não foi possível confirmar/.test(I.st.d.arquitetural.inativando.erro) && (await ler(ARQT + '/conceitos/canal/ativo')) === true);
  I.carregarLigacoes(); await ate(() => I.st.lig.estado === 'ok');

  await semear(async (a) => { await a.ref(ARQT + '/conceitos/regra-condicao').set(arq('Regra', true)); });
  await abreConceito('arquitetural', 'regra-condicao');
  I.st.d.arquitetural.inativando = { codigo: 'regra-condicao', motivo: '   ', erro: null };
  I.inativarConceito('arquitetural', 'regra-condicao'); await new Promise((r) => setTimeout(r, 200));
  anota('tela: motivo em branco é recusado sem gravar', /motivo/.test(I.st.d.arquitetural.inativando.erro) && (await ler(ARQT + '/conceitos/regra-condicao/ativo')) === true);
  I.st.d.arquitetural.inativando = { codigo: 'regra-condicao', motivo: 'Não é usado', erro: null };
  await opera('inativarConceito (não ligado)', () => I.inativarConceito('arquitetural', 'regra-condicao'), async () => (await ler(ARQT + '/conceitos/regra-condicao/ativo')) === false && (await ler(ARQT + '/conceitos/regra-condicao/inativacao/motivo')) === 'Não é usado');
  await abreConceito('arquitetural', 'regra-condicao');
  await opera('reativarConceito', () => I.reativarConceito('arquitetural', 'regra-condicao'), async () => (await ler(ARQT + '/conceitos/regra-condicao/ativo')) === true && (await ler(ARQT + '/conceitos/regra-condicao/inativacao')) === null && !!(await ler(ARQT + '/conceitos/regra-condicao/reativacao/auditoriaId')));
  const tiposRegra = Object.values((await ler(ARQT + '/auditoria/regra-condicao')) || {}).map((e) => e.tipo).sort().join(',');
  anota('histórico do conceito: inativacao + reativacao', tiposRegra === 'inativacao,reativacao', tiposRegra);

  await abreConceito('organizacional', 'C1');
  const D = I.st.d.organizacional;
  D.relForm = { modo: 'nova', direcao: 'saida', tipo: 'compoe', outro: 'C2', nota: 'Teste', erro: null };
  await opera('salvarRelacao (nova)', () => I.salvarRelacao('C1'), async () => (await ler(ORG + '/relacoes/C1__compoe__C2/nota')) === 'Teste');
  const evC1 = Object.values((await ler(ORG + '/auditoria/C1')) || {}).filter((e) => e.tipo === 'relacao_criada');
  const evC2 = Object.values((await ler(ORG + '/auditoria/C2')) || {}).filter((e) => e.tipo === 'relacao_criada');
  anota('nova relação: histórico na origem E no destino, com o MESMO operacaoId', evC1.length === 1 && evC2.length === 1 && evC1[0].operacaoId === evC2[0].operacaoId && evC1[0].ponta === 'origem' && evC2[0].ponta === 'destino');
  await abreConceito('organizacional', 'C1');
  D.relForm = { modo: 'nova', direcao: 'saida', tipo: 'compoe', outro: 'C2', nota: '', erro: null };
  I.salvarRelacao('C1'); await new Promise((r) => setTimeout(r, 200));
  anota('tela: relação duplicada é recusada sem gravar', D.relForm.erro === 'Esta relação já existe.');
  D.relForm = { modo: 'nova', direcao: 'saida', tipo: 'atende', outro: 'C3', nota: '', erro: null };
  I.salvarRelacao('C1'); await new Promise((r) => setTimeout(r, 200));
  anota('tela: relação com conceito inativo é recusada sem gravar', /ativos/.test(D.relForm.erro || ''));
  D.relForm = { modo: 'alterar', base: 'C1__compoe__C2', direcao: 'saida', tipo: 'atende', outro: 'C2', nota: 'Nova', motivo: 'Tipo errado', erro: null };
  await opera('salvarRelacao (alterar = encerrar + criar)', () => I.salvarRelacao('C1'), async () => !!(await ler(ORG + '/relacoes/C1__compoe__C2/encerrada')) && (await ler(ORG + '/relacoes/C1__atende__C2/nota')) === 'Nova');
  const opAlt = Object.values((await ler(ORG + '/auditoria/C2')) || {}).filter((e) => e.relacao === 'C1__compoe__C2' && e.tipo === 'relacao_encerrada' || e.relacao === 'C1__atende__C2');
  anota('alterar: as linhas de encerrar e criar (nas duas pontas) compartilham o operacaoId', opAlt.length === 2 && opAlt[0].operacaoId === opAlt[1].operacaoId);
  await abreConceito('organizacional', 'C1');
  D.relForm = { modo: 'nova', direcao: 'saida', tipo: 'compoe', outro: 'C2', nota: '', erro: null };
  I.salvarRelacao('C1'); await new Promise((r) => setTimeout(r, 200));
  anota('tela: relação idêntica a uma encerrada é recusada sem gravar', /já existiu e foi encerrada/.test(D.relForm.erro || ''), D.relForm.erro);
  D.relForm = null;
  D.encerrando = { chave: 'C1__atende__C2', motivo: 'Fim do vínculo', erro: null };
  await opera('encerrarRelacao', () => I.encerrarRelacao('C1'), async () => (await ler(ORG + '/relacoes/C1__atende__C2/encerrada/motivo')) === 'Fim do vínculo' && (await ler(ORG + '/relacoes/C1__atende__C2/de')) === 'C1');
  await abreConceito('organizacional', 'LINHA');
  I.st.d.organizacional.inativando = { codigo: 'LINHA', motivo: 'Reorganização', erro: null };
  await opera('inativarConceito (organizacional, com filho ativo)', () => I.inativarConceito('organizacional', 'LINHA'), async () => {
    const ev = Object.values((await ler(ORG + '/auditoria/LINHA')) || {}).find((e) => e.tipo === 'inativacao');
    return (await ler(ORG + '/conceitos/LINHA/ativo')) === false && ev && ev.filhosAtivos === 'C1' && (await ler(ORG + '/conceitos/C1/ativo')) === true;
  });
  /* com o índice construído, a tela tira/recoloca a entrada do filho ao inativar/reativar — e o banco aceita */
  await abreConceito('organizacional', 'C1');
  I.st.d.organizacional.inativando = { codigo: 'C1', motivo: 'Fora de uso', erro: null };
  await opera('inativarConceito (filho com pai, índice construído)', () => I.inativarConceito('organizacional', 'C1'),
    async () => (await ler(ORG + '/conceitos/C1/ativo')) === false && (await ler(ORG + '/filhos/LINHA/C1')) === null);
  await abreConceito('organizacional', 'C1');
  await opera('reativarConceito (filho com pai, índice construído)', () => I.reativarConceito('organizacional', 'C1'),
    async () => (await ler(ORG + '/conceitos/C1/ativo')) === true && (await ler(ORG + '/filhos/LINHA/C1')) === true);

  /* camada pela tela: só A ⇄ trabalho, com motivo; sem o índice construído, ou com pai/filhos, recusa sem gravar */
  await semear(async (a) => { await a.ref(ORG + '/conceitos/SQUAD').set(org('Squad', { camada: 'A' })); });
  await abreConceito('organizacional', 'SQUAD');
  I.carregarIndiceFilhos(); await ate(() => I.st.indiceFilhos.estado === 'ok');
  I.st.d.organizacional.camadaMudando = { codigo: 'SQUAD', motivo: 'Teste', erro: null };
  I.alterarCamada('organizacional', 'SQUAD'); await new Promise((r) => setTimeout(r, 200));
  anota('tela: sem o índice de filhos construído, a troca é recusada sem gravar', /índice de conceitos filhos ainda não foi construído/.test(I.st.d.organizacional.camadaMudando.erro || '') && (await ler(ORG + '/conceitos/SQUAD/camada')) === 'A', I.st.d.organizacional.camadaMudando.erro);
  await semear(async (a) => { await IND.aplicar(a, { confirmar: true, agora: QUANDO }); });
  I.carregarIndiceFilhos(); await ate(() => I.st.indiceFilhos.estado === 'ok' && I.st.indiceFilhos.existe);
  I.st.d.organizacional.camadaMudando = { codigo: 'SQUAD', motivo: '  ', erro: null };
  I.alterarCamada('organizacional', 'SQUAD'); await new Promise((r) => setTimeout(r, 200));
  anota('tela: troca de camada sem motivo é recusada sem gravar', /motivo/.test(I.st.d.organizacional.camadaMudando.erro || '') && (await ler(ORG + '/conceitos/SQUAD/camada')) === 'A');
  I.st.d.organizacional.camadaMudando = { codigo: 'SQUAD', motivo: 'Squad é organização do trabalho', erro: null };
  await opera('alterarCamada (SQUAD → Organização do trabalho)', () => I.alterarCamada('organizacional', 'SQUAD'), async () => {
    const ev = Object.values((await ler(ORG + '/auditoria/SQUAD')) || {}).find((e) => e.tipo === 'alteracao_camada');
    const ca = await ler(ORG + '/conceitos/SQUAD/camadaAlteracao');
    return (await ler(ORG + '/conceitos/SQUAD/camada')) === 'trabalho' && ca && ca.de === 'A' && ca.para === 'trabalho' && ca.auditoriaId && ev && ev.motivo === 'Squad é organização do trabalho' && ev.valorAnterior === 'Tipo organizacional' && ev.valorNovo === 'Organização do trabalho';
  });
  await abreConceito('organizacional', 'C1');
  I.st.d.organizacional.camadaMudando = { codigo: 'C1', motivo: 'x', erro: null };
  I.alterarCamada('organizacional', 'C1'); await new Promise((r) => setTimeout(r, 200));
  anota('tela: Especialização (B) não troca de camada, sem gravar', /só conceitos da camada/i.test(I.st.d.organizacional.camadaMudando.erro || '') && (await ler(ORG + '/conceitos/C1/camada')) === 'B', I.st.d.organizacional.camadaMudando.erro);

  await abreConceito('organizacional', 'LINHA');
  I.st.d.organizacional.camadaMudando = { codigo: 'LINHA', motivo: 'x', erro: null };
  I.alterarCamada('organizacional', 'LINHA'); await new Promise((r) => setTimeout(r, 200));
  anota('tela: conceito com filhos ativos não troca de camada, sem gravar', /conceitos filhos ativos \(C1\)/.test(I.st.d.organizacional.camadaMudando.erro || '') && (await ler(ORG + '/conceitos/LINHA/camada')) === 'A', I.st.d.organizacional.camadaMudando.erro);
  /* exportação: relação encerrada nunca sai como se estivesse ativa */
  const bruto = await ler('taxonomia');
  const linhas = I.linhasExportacao(bruto);
  const rowEnc = (linhas['Relações'] || []).find((l) => l[1] === 'C1__compoe__C2'), rowAtv = (linhas['Relações'] || []).find((l) => l[1] === 'C1__atende__C2');
  anota('exportação (aba Relações): a encerrada sai como "encerrada", com data, autor e motivo', !!rowEnc && rowEnc[9] === 'encerrada' && rowEnc[11] === ADMIN && rowEnc[12] === 'Tipo errado', JSON.stringify(rowEnc));
  anota('exportação (aba Relações): situação de cada relação', !!rowAtv && rowAtv[9] === 'encerrada' && (linhas['Relações'] || []).every((l) => l[9] === 'ativa' || l[9] === 'encerrada'));
  const cons = I.consolidarConceitos(bruto).find((k) => k.dominio === 'organizacional' && k.codigo === 'C1');
  anota('exportação (consolidado/JSON): relacoesSaida traz o encerramento', !!cons && cons.relacoesSaida.some((r) => r.id === 'C1__compoe__C2' && r.encerrada && r.encerrada.motivo === 'Tipo errado'));

  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  await testEnv.cleanup();
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
