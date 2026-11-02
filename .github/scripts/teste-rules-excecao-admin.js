/* ═════════════════════════════════════════════════════════════════
   Regras do banco — EXCEÇÃO DO ADMIN em turmas-interesse (excecaoAdmin; montar-regras-inscricoes.js).
   Roda contra o EMULADOR real do Realtime Database (teste-rules.yml) com o database.rules.json do repositório (ou
   RULES_PATH). Dados 100% sintéticos. Prova, pelo BANCO — não pela tela:
   E. o admin só põe na turma alguém FORA do público que o banco confere (cargo do evento/turma, lista do evento/turma,
      só diretores) com a exceção registrada; dentro do público, nada muda; a exceção precisa de formato válido
      (regras conhecidas, motivo de 5 a 500, por @previ, turma = a própria, nenhum campo inventado);
   C. Confirmar (interesse → inscrição) de quem está fora do público pede a exceção — ou aproveita a que o registro já tem;
   M. manutenção de registros que já existem (renomear, motivo, desconfirmar, remover) não pede nada — participantes
      históricos fora do público continuam intocáveis e editáveis; reativar um removido fora do público pede a exceção;
   P. a pessoa: registra o próprio interesse como sempre; não cria nem muda exceção; ao sair, a exceção fica;
   R. a correção de e-mail do ADMIN (cadastro e registros movidos juntos) continua valendo sem exceção; mover um
      registro fora do público SEM o cadastro novo, não; a exceção movida junto mantém o autor original;
   A. AUTORIA: quem autorizou (excecaoAdmin.por) é quem está gravando — exceção nova em nome de outro admin é recusada
      (＋ Participante e Confirmar); a própria identidade passa (maiúsculas não importam); exceção antiga de outro admin
      continua valendo para Confirmar, renomear e desconfirmar.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const AGORA = '2026-11-02T10:00:00.000Z';

const ADMIN = 'admin.ex@previ.com.br', GER = 'gerente.rex@previ.com.br', ASS = 'assessor.rex@previ.com.br', ASS2 = 'assessor.dois.rex@previ.com.br';
const ASS3 = 'assessor.tres.rex@previ.com.br', HIST = 'historico.rex@previ.com.br', FUT = 'futuro.rex@previ.com.br', NOVA = 'futuro.corrigido.rex@previ.com.br';
const ADMIN2 = 'outro.admin.ex@previ.com.br', ASS4 = 'assessor.quatro.rex@previ.com.br', MOV = 'movido.rex@previ.com.br', MOVN = 'movido.corrigido.rex@previ.com.br';
const PESSOA = 'pessoa.rex@previ.com.br', GER2 = 'gerente.dois.rex@previ.com.br';

const ti = (t, e) => 'turmas-interesse/' + t + '/' + emailKey(e);
const interesse = (e) => ({ name: 'P ' + e.split('@')[0].toUpperCase(), email: e, area: 'TI', date: AGORA, removed: false, status: 'interessado' });
const inscrita = (e) => Object.assign(interesse(e), { status: 'inscrito', confirmedByAdmin: ADMIN, confirmedByAdminName: 'ADMIN', confirmedDate: AGORA, addedByAdmin: true });
const exc = (turma, regras, extra) => Object.assign({ regras: Object.fromEntries(regras.map((r) => [r, true])), motivo: 'Assessor convidado', por: ADMIN, porNome: 'ADMIN', em: AGORA, turma }, extra || {});

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-excecao-admin', database: { rules } });
  const db = (e) => (e ? env.authenticatedContext('u' + emailKey(e), { email: e, email_verified: true }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'NEGADO: ' + String(x.message || x).slice(0, 160)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'foi ACEITO'); } }
  const a = db(ADMIN);

  await semear(async (r) => {
    await r.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: 'ADMIN' });
    await r.ref('fa-admins/' + emailKey(ADMIN2)).set({ email: ADMIN2, name: 'OUTRO ADMIN' });
    await r.ref('fa-gerentes/' + emailKey(GER)).set({ email: GER, name: 'G' });
    await r.ref('fa-gerentes/' + emailKey(GER2)).set({ email: GER2, name: 'G2' });
    await r.ref('eventos').set({
      evG: { nome: 'GERENTES', publicoDesc: 'Gerentes', publicado: true }, evD: { nome: 'DIRETORES', restritoADiretores: true, publicado: true },
      evL: { nome: 'LISTA EVENTO', publicoRestrito: true, publicado: true }, evLivre: { nome: 'LIVRE', publicado: true },
    });
    const tu = (ev, extra) => Object.assign({ label: 'T', dias: ['2027-11-03'], order: 1, eventoKey: ev }, extra || {});
    await r.ref('turmas').set({ tG: tu('evG'), tD: tu('evD'), tL: tu('evL'), tTL: tu('evLivre', { publicoRestrito: true }), tLivre: tu('evLivre'),
      tHist: tu('evG', { dias: ['2026-09-10'] }) });
    await r.ref('turmas-config/tHist').set({ encerrada: true, dataConclusao: '2026-09-11' });
    await r.ref(ti('tG', ASS2)).set(interesse(ASS2));                                         /* interesse antigo, fora do público */
    await r.ref(ti('tG', ASS3)).set(Object.assign(interesse(ASS3), { excecaoAdmin: exc('tG', ['cargo'], { por: ADMIN2, porNome: 'OUTRO ADMIN' }) })); /* já com exceção, autorizada por OUTRO admin */
    await r.ref(ti('tG', MOV)).set(Object.assign(inscrita(MOV), { excecaoAdmin: exc('tG', ['cargo'], { por: ADMIN2, porNome: 'OUTRO ADMIN' }) }));
    await r.ref('fa-users/' + emailKey(MOV)).set({ email: MOV, name: 'MOVIDO', area: 'TI', emailVerificationRequired: false, createdAt: AGORA });
    await r.ref(ti('tHist', HIST)).set(inscrita(HIST));                                        /* participante histórico, fora do público */
    await r.ref(ti('tG', FUT)).set(inscrita(FUT));                                              /* futuro, fora do público, sem exceção */
    await r.ref(ti('tLivre', PESSOA)).set(Object.assign(interesse(PESSOA), { excecaoAdmin: exc('tLivre', ['participacao']) }));
    await r.ref('fa-users/' + emailKey(FUT)).set({ email: FUT, name: 'FUTURO', area: 'TI', emailVerificationRequired: false, createdAt: AGORA });
  });
  const histAntes = await ler(ti('tHist', HIST));

  console.log('\n== E. entrar na turma fora do público: só com a exceção ==');
  await nega('E1 assessor em evento de Gerentes, SEM exceção', a.ref(ti('tG', ASS)).set(inscrita(ASS)));
  await pode('E2 assessor em evento de Gerentes, COM exceção { cargo }', a.ref(ti('tG', ASS)).set(Object.assign(inscrita(ASS), { excecaoAdmin: exc('tG', ['cargo']) })));
  await pode('E3 gerente em evento de Gerentes: dentro do público, sem exceção', a.ref(ti('tG', GER)).set(inscrita(GER)));
  await nega('E4 só diretores, sem exceção', a.ref(ti('tD', ASS)).set(inscrita(ASS)));
  await pode('E4 só diretores, com exceção { diretores } (substituto)', a.ref(ti('tD', ASS)).set(Object.assign(inscrita(ASS), { excecaoAdmin: exc('tD', ['diretores']) })));
  await nega('E5 lista do evento, sem exceção', a.ref(ti('tL', ASS)).set(inscrita(ASS)));
  await pode('E5 lista do evento, com exceção { lista-evento }', a.ref(ti('tL', ASS)).set(Object.assign(inscrita(ASS), { excecaoAdmin: exc('tL', ['lista-evento']) })));
  await nega('E6 lista da turma, sem exceção (inclusive só como interesse)', a.ref(ti('tTL', ASS)).set(interesse(ASS)));
  await pode('E6 lista da turma, com exceção { lista-turma }', a.ref(ti('tTL', ASS)).set(Object.assign(interesse(ASS), { excecaoAdmin: exc('tTL', ['lista-turma']) })));
  await pode('E7 turma sem restrição: nada a pedir', a.ref(ti('tLivre', ASS)).set(inscrita(ASS)));
  for (const [rot, e] of [['motivo curto', exc('tG', ['cargo'], { motivo: 'abc' })], ['regra inventada', exc('tG', ['tudo'])], ['turma diferente', exc('tD', ['cargo'])],
    ['campo inventado', exc('tG', ['cargo'], { liberaAcesso: true })], ['sem quem autorizou', (() => { const x = exc('tG', ['cargo']); delete x.por; return x; })()],
    ['quem autorizou fora de @previ', exc('tG', ['cargo'], { por: 'alguem@gmail.com' })], ['sem regras', Object.assign(exc('tG', []), { regras: {} })]]) {
    await nega('E8 exceção malformada (' + rot + ')', a.ref(ti('tG', 'outro.' + emailKey(rot).slice(0, 8) + '@previ.com.br')).set(Object.assign(inscrita('outro.' + emailKey(rot).slice(0, 8) + '@previ.com.br'), { excecaoAdmin: e })));
  }

  console.log('\n== C. Confirmar ==');
  const confirmar = (e, extra) => a.ref().update(Object.assign({ [ti('tG', e) + '/status']: 'inscrito', [ti('tG', e) + '/confirmedByAdmin']: ADMIN,
    [ti('tG', e) + '/confirmedByAdminName']: 'ADMIN', [ti('tG', e) + '/confirmedDate']: AGORA }, extra || {}));
  await nega('C1 confirmar interesse antigo fora do público, SEM exceção', confirmar(ASS2));
  await pode('C2 confirmar com a exceção na mesma gravação', confirmar(ASS2, { [ti('tG', ASS2) + '/excecaoAdmin']: exc('tG', ['cargo']) }));
  await pode('C3 confirmar quem já tem exceção no registro (autorizada por outro admin, antes)', confirmar(ASS3));

  console.log('\n== M. manutenção de registros que já existem ==');
  await pode('M1 renomear participante histórico fora do público', a.ref(ti('tHist', HIST) + '/name').set('NOME CORRIGIDO'));
  await pode('M2 registrar motivo de saída', a.ref().update({ [ti('tHist', HIST) + '/motivoNaoConfirmado']: 'ja_participou', [ti('tHist', HIST) + '/motivoRegistradoEm']: AGORA }));
  await pode('M3 desconfirmar', a.ref().update({ [ti('tG', FUT) + '/status']: 'interessado', [ti('tG', FUT) + '/confirmedByAdmin']: null, [ti('tG', FUT) + '/confirmedByAdminName']: null, [ti('tG', FUT) + '/confirmedDate']: null }));
  await pode('M4 remover (soft-delete)', a.ref().update({ [ti('tG', FUT) + '/removed']: true, [ti('tG', FUT) + '/removedDate']: AGORA, [ti('tG', FUT) + '/status']: 'removido' }));
  await nega('M5 reativar quem foi removido, fora do público, SEM exceção', a.ref().update({ [ti('tG', FUT) + '/removed']: false, [ti('tG', FUT) + '/status']: 'interessado' }));
  await pode('M5 reativar com exceção', a.ref().update({ [ti('tG', FUT) + '/removed']: false, [ti('tG', FUT) + '/status']: 'interessado', [ti('tG', FUT) + '/excecaoAdmin']: exc('tG', ['cargo']) }));
  const hist = await ler(ti('tHist', HIST));
  anota('M6 o histórico só mudou no que o admin editou (nome e motivo); status e confirmação intactos',
    hist.status === histAntes.status && hist.confirmedByAdmin === histAntes.confirmedByAdmin && hist.removed === false && !hist.excecaoAdmin, JSON.stringify(hist));

  console.log('\n== P. a pessoa ==');
  await pode('P1 gerente registra o próprio interesse em evento de Gerentes (como sempre)', db(GER2).ref(ti('tG', GER2)).set(interesse(GER2)));
  await nega('P2 a pessoa não registra o próprio interesse já com exceção', db(PESSOA).ref(ti('tTL', PESSOA)).set(Object.assign(interesse(PESSOA), { excecaoAdmin: exc('tTL', ['lista-turma'], { por: PESSOA }) })));
  await nega('P3 a pessoa não muda a própria exceção', db(PESSOA).ref(ti('tLivre', PESSOA) + '/excecaoAdmin/motivo').set('mudei'));
  await nega('P3 a pessoa não apaga a própria exceção', db(PESSOA).ref(ti('tLivre', PESSOA) + '/excecaoAdmin').remove());
  await nega('P4 sair regravando o registro inteiro sem a exceção', db(PESSOA).ref(ti('tLivre', PESSOA)).set(Object.assign(interesse(PESSOA), { removed: true, status: 'removido', removedDate: AGORA })));
  await pode('P5 sair (o caminho do site) mantém a exceção', db(PESSOA).ref(ti('tLivre', PESSOA)).update({ removed: true, status: 'removido', removedDate: AGORA }));
  const depois = await ler(ti('tLivre', PESSOA));
  await nega('P6 voltar sozinha à turma em que entrou por exceção (o set() do site apagaria a exceção)', db(PESSOA).ref(ti('tLivre', PESSOA)).set(interesse(PESSOA)));
  anota('P5 depois de sair, a exceção continua no registro', !!(depois && depois.excecaoAdmin && depois.excecaoAdmin.motivo === 'Assessor convidado'), JSON.stringify(depois));

  console.log('\n== R. correção de e-mail do ADMIN ==');
  await semear(async (r) => { await r.ref(ti('tG', FUT)).set(inscrita(FUT)); });
  const novoCadastro = { email: NOVA, name: 'FUTURO', area: 'TI', emailVerificationRequired: false, createdAt: AGORA, emailCorrigidoDe: FUT };
  await nega('R1 mover o registro fora do público para outra chave SEM o cadastro novo', a.ref().update({ [ti('tG', FUT)]: null, [ti('tG', NOVA)]: Object.assign(inscrita(NOVA)) }));
  await pode('R2 a correção de e-mail (cadastro + registro movidos juntos) vale sem exceção', a.ref().update({ [ti('tG', FUT)]: null, [ti('tG', NOVA)]: inscrita(NOVA),
    ['fa-users/' + emailKey(FUT)]: null, ['fa-users/' + emailKey(NOVA)]: novoCadastro }));
  anota('R2 o vínculo continua, na chave nova', !!(await ler(ti('tG', NOVA))) && !(await ler(ti('tG', FUT))));
  await nega('R3 com o cadastro já existente na chave nova, um registro fora do público não passa como correção', a.ref().update({ [ti('tD', NOVA)]: inscrita(NOVA),
    ['fa-users/' + emailKey(NOVA) + '/emailCorrigidoDe']: FUT }));

  await pode('R4 a correção de e-mail move a exceção de OUTRO admin com o autor original', a.ref().update({ [ti('tG', MOV)]: null,
    [ti('tG', MOVN)]: Object.assign(inscrita(MOVN), { excecaoAdmin: exc('tG', ['cargo'], { por: ADMIN2, porNome: 'OUTRO ADMIN' }) }),
    ['fa-users/' + emailKey(MOV)]: null, ['fa-users/' + emailKey(MOVN)]: { email: MOVN, name: 'MOVIDO', area: 'TI', emailVerificationRequired: false, createdAt: AGORA, emailCorrigidoDe: MOV } }));
  anota('R4 o autor original continua no registro movido', ((await ler(ti('tG', MOVN))) || { excecaoAdmin: {} }).excecaoAdmin.por === ADMIN2);

  console.log('\n== A. autoria da exceção ==');
  const comExc = (e, extra) => Object.assign(inscrita(e), { excecaoAdmin: exc('tG', ['cargo'], extra) });
  await nega('A1 ＋ Participante: exceção nova atribuída a OUTRO admin', a.ref(ti('tG', ASS4)).set(comExc(ASS4, { por: ADMIN2, porNome: 'OUTRO ADMIN' })));
  await nega('A1 o outro admin, gravando, também não assina pelo primeiro', db(ADMIN2).ref(ti('tG', ASS4)).set(comExc(ASS4, { por: ADMIN })));
  await pode('A2 ＋ Participante: exceção com a identidade de quem grava (maiúsculas não importam)', a.ref(ti('tG', ASS4)).set(comExc(ASS4, { por: ADMIN.toUpperCase().replace('@PREVI.COM.BR', '@previ.com.br') })));
  await semear(async (r) => { await r.ref(ti('tG', 'assessor.cinco.rex@previ.com.br')).set(interesse('assessor.cinco.rex@previ.com.br')); });
  const C5 = 'assessor.cinco.rex@previ.com.br';
  await nega('A3 Confirmar com exceção atribuída a OUTRO admin', confirmar(C5, { [ti('tG', C5) + '/excecaoAdmin']: exc('tG', ['cargo'], { por: ADMIN2 }) }));
  await pode('A3 Confirmar com a exceção de quem grava', confirmar(C5, { [ti('tG', C5) + '/excecaoAdmin']: exc('tG', ['cargo']) }));
  await nega('A4 trocar o autor de uma exceção já gravada', a.ref(ti('tG', ASS3) + '/excecaoAdmin/por').set(ADMIN2.replace('outro', 'terceiro')));
  await pode('A5 renomear quem tem exceção antiga de outro admin', a.ref(ti('tG', ASS3) + '/name').set('NOME NOVO'));
  await pode('A5 desconfirmar quem tem exceção antiga de outro admin', a.ref().update({ [ti('tG', ASS3) + '/status']: 'interessado', [ti('tG', ASS3) + '/confirmedByAdmin']: null,
    [ti('tG', ASS3) + '/confirmedByAdminName']: null, [ti('tG', ASS3) + '/confirmedDate']: null }));
  anota('A5 a exceção antiga continua com o autor original', ((await ler(ti('tG', ASS3))) || { excecaoAdmin: {} }).excecaoAdmin.por === ADMIN2);

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
