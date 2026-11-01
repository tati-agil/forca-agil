/* ═════════════════════════════════════════════════════════════════
   Regras do banco — INSCRIÇÕES EM TURMAS (turmas, turmas-config, turmas-equipe, turmas-interesse,
   turmas-interesse-log; montar-regras-inscricoes.js). Etapa B — segurança das inscrições.
   Roda contra o EMULADOR real do Realtime Database (teste-rules.yml) com o database.rules.json do repositório (ou
   RULES_PATH). Dados 100% sintéticos. Prova, pelo BANCO — não pela tela:
   P. a pessoa registra o próprio interesse quando cabe em TODAS as restrições do evento e da turma (lista da turma,
      lista do evento, diretores, gerentes/técnicos do evento e da turma, inscrições abertas); turma sem evento e
      sem configuração própria segue aberta; e-mail com hífen, +, apóstrofo e mais de 64 caracteres; remove o
      próprio registro (inclusive uma inscrição antiga que ficou fora de um público que mudou); reativa depois de
      remover; acrescenta o próprio histórico;
   N. recusado: fora da lista da turma ou do evento; lista vazia/ausente; gerente em evento ou turma de Técnicos
      (mesmo na lista da turma); técnico em Gerentes; turma contraditória; não diretor em evento de diretores;
      inscrições encerradas; turma inexistente; chave de outra pessoa; chave da regra antiga; autoinscrição como
      confirmada (status, confirmedByAdmin, update); campo inventado; e-mail falso; remover mexendo na confirmação
      ou sem status 'removido'; apagar o registro; reativar fora do público; sobrescrever uma inscrição ativa;
      gravar a turma inteira; multipath que esconde uma gravação proibida; não admin em turmas, turmas-config e
      turmas-equipe (todos os perfis); histórico de outra pessoa, ação falsa, mudar ou apagar item; sem login;
   A. o admin (lista fixa e fa-admins) faz tudo o que o painel faz: ＋ Participante, Confirmar, Desconfirmar,
      Mover da fila, Mover para a espera, matrícula em massa, renomear, corrigir e-mail, excluir participante,
      excluir turma, editar turma/config/equipe, histórico;
   I. preservação: as tentativas recusadas não mudam nenhum registro existente.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const AGORA = '2026-11-01T10:00:00.000Z';

const ADMIN = 'admin.geral@previ.com.br', ADMIN_FIXO = 'tatianefdirene@previ.com.br';
const TEC = 'tecnica.ok@previ.com.br', OUTRA = 'outra.pessoa@previ.com.br', GER = 'gerente.um@previ.com.br';
const DIR = 'diretor.um@previ.com.br', ANTIGO = 'antigo.inscrito@previ.com.br', ANTIGA_INT = 'antiga.interessada@previ.com.br';
const PRESERVADO = 'registro.preservado@previ.com.br';
const ESPECIAIS = { 'hífen': 'maria-silva@previ.com.br', '+': 'ana+turma@previ.com.br', 'apóstrofo': "joao.d'avila@previ.com.br",
  'mais de 64': 'd'.repeat(70) + '@previ.com.br' };
const PERFIS = { 'facilitadora': ['fac@previ.com.br', 'fa-facilitadores'], 'diretor': [DIR, 'fa-diretores'],
  'gerente': [GER, 'fa-gerentes'], 'avaliação': ['aval@previ.com.br', 'fa-avaliacao-autorizados', { tipo: 'avaliacao' }],
  'pessoa comum': [OUTRA] };

const interesse = (e) => ({ name: 'PESSOA ' + e.split('@')[0].toUpperCase(), email: e, area: 'GETHO', date: AGORA, removed: false, status: 'interessado' });
const inscrita = (e, por) => ({ name: 'PESSOA ' + e.split('@')[0].toUpperCase(), email: e, area: 'GETHO', date: '2026-09-01T10:00:00.000Z',
  removed: false, status: 'inscrito', confirmedByAdmin: por || ADMIN, confirmedByAdminName: 'ADMIN', confirmedDate: '2026-09-02T10:00:00.000Z' });
const REMOCAO = { removed: true, removedDate: AGORA, status: 'removido' };
const itemLog = (e, action) => ({ name: 'PESSOA', email: e, area: 'GETHO', action, date: AGORA });

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-inscricoes', database: { rules } });
  const db = (e) => (e ? env.authenticatedContext('u' + emailKey(e), { email: e, email_verified: true }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'NEGADO: ' + String(x.message || x).slice(0, 160)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'foi ACEITO'); } }
  const ti = (t, e) => 'turmas-interesse/' + t + '/' + emailKey(e);
  const registrar = (quem, t, e, v) => db(quem).ref(ti(t, e || quem)).set(v || interesse(e || quem));
  const remover = (quem, t, e) => db(quem).ref(ti(t, e || quem)).update(REMOCAO);

  async function reiniciar() {
    await env.clearDatabase();
    await semear(async (a) => {
      await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: 'ADMIN' });
      for (const t of Object.keys(PERFIS)) { const [e, no, v] = PERFIS[t]; if (no) await a.ref(no + '/' + emailKey(e)).set(Object.assign({ email: e, name: t.toUpperCase() }, v)); }
      await a.ref('fa-gerentes/' + emailKey(GER)).set({ email: GER, name: 'GERENTE UM' });
      await a.ref('eventos').set({
        evLivre: { nome: 'LIVRE', publicado: true }, evTec: { nome: 'TECNICOS', publicoDesc: 'Técnicos' },
        evGer: { nome: 'GERENTES', publicoDesc: 'Gerentes' }, evLista: { nome: 'LISTA DO EVENTO', publicoRestrito: true },
        evDir: { nome: 'DIRETORES', restritoADiretores: true }, evOutros: { nome: 'EMPREGADOS', publicoDesc: 'Empregados' },
      });
      await a.ref('eventos-publico/evLista/' + emailKey(TEC)).set({ email: TEC, name: 'TECNICA' });
      const tu = (ev, extra) => Object.assign({ label: 'T', dias: ['2027-11-03'], order: 1, eventoKey: ev }, extra || {});
      await a.ref('turmas').set({
        tLivre: tu('evLivre'), tSemEvento: tu(''), tSemCampo: { label: 'SEM CAMPO', dias: ['2027-11-03'] },
        tTec: tu('evTec'), tGer: tu('evGer'), tOutros: tu('evOutros'),
        tLista: tu('evLivre', { publicoRestrito: true }), tListaVazia: tu('evLivre', { publicoRestrito: true }),
        tTecLista: tu('evTec', { publicoRestrito: true }), tConflito: tu('evTec', { publicoCargo: 'gerentes' }),
        tCargoTec: tu('evLivre', { publicoCargo: 'tecnicos' }), tEvLista: tu('evLista'), tDir: tu('evDir'),
        tFinal: tu('evLivre'), tEnc: tu('evLivre'), tAntiga: tu('evLivre', { publicoRestrito: true }), tOutra: tu('evLivre'),
        tEventoSumiu: tu('evQueNaoExiste'),
      });
      await a.ref('turmas-publico').set({
        tLista: { [emailKey(TEC)]: { email: TEC }, [emailKey(GER)]: { email: GER } },
        tTecLista: { [emailKey(TEC)]: { email: TEC }, [emailKey(GER)]: { email: GER } },
      });
      await a.ref('turmas-config').set({ tFinal: { finalizada: true }, tEnc: { encerrada: true, dataConclusao: '2026-10-01' } });
      await a.ref('turmas-equipe/tLivre/' + emailKey('fac@previ.com.br')).set({ email: 'fac@previ.com.br', papel: 'facilitador' });
      /* a lista da tAntiga mudou depois: estas pessoas já estavam lá e NÃO estão na lista */
      await a.ref(ti('tAntiga', ANTIGO)).set(inscrita(ANTIGO));
      /* com campos administrativos de verdade (os que existem nos registros reais) */
      await a.ref(ti('tAntiga', ANTIGA_INT)).set(Object.assign(interesse(ANTIGA_INT), { addedByAdmin: ADMIN, addedByAdminName: 'ADMIN',
        motivoNaoConfirmado: 'sem_vagas', motivoRegistradoEm: '2026-09-03T10:00:00.000Z', motivoRegistradoPor: ADMIN,
        jaParticipouTurma: 'tOutra', jaParticipouTurmaLabel: 'OUTRA', fromEspera: true }));
      await a.ref(ti('tAntiga', PRESERVADO)).set(inscrita(PRESERVADO));
      await a.ref(ti('tOutra', TEC)).set(inscrita(TEC));
      await a.ref('turmas-interesse-log/tLivre/' + emailKey(OUTRA) + '/item1').set(itemLog(OUTRA, 'registrado'));
      await a.ref('turmas-interesse-log/tLivre/' + emailKey(TEC) + '/item1').set(itemLog(TEC, 'registrado'));
    });
  }

  await reiniciar();
  const preservadoAntes = await ler(ti('tAntiga', PRESERVADO));
  const antigoAntes = await ler(ti('tAntiga', ANTIGO));

  console.log('\n== P. a pessoa registra quando cabe em todas as restrições ==');
  await pode('P1 turma sem nenhuma restrição', registrar(TEC, 'tLivre'));
  await pode('P2 turma com eventoKey vazio (sem evento)', registrar(TEC, 'tSemEvento'));
  await pode('P2 turma sem o campo eventoKey', registrar(TEC, 'tSemCampo'));
  await pode('P2 turma cujo evento não existe mais', registrar(TEC, 'tEventoSumiu'));
  await pode('P3 na lista da turma', registrar(TEC, 'tLista'));
  await pode('P4 técnico em evento de Técnicos', registrar(TEC, 'tTec'));
  await pode('P5 gerente em evento de Gerentes', registrar(GER, 'tGer'));
  await pode('P5 "Quem participa" que é só descrição (Empregados) não restringe', registrar(GER, 'tOutros'));
  await pode('P6 técnico na lista de turma de evento de Técnicos', registrar(TEC, 'tTecLista'));
  await pode('P7 na lista do evento', registrar(TEC, 'tEvLista'));
  await pode('P8 diretor em evento só de diretores', registrar(DIR, 'tDir'));
  await pode('P9 técnico em turma "Só técnicos"', registrar(TEC, 'tCargoTec'));
  for (const k of Object.keys(ESPECIAIS)) await pode('P10 e-mail com ' + k + ' registra na própria chave do site', registrar(ESPECIAIS[k], 'tLivre'));
  await pode('P11 remove o próprio interesse', remover(TEC, 'tLivre'));
  await pode('P12 reativa depois de remover (set, como o "Tenho interesse")', registrar(TEC, 'tLivre'));
  await pode('P16 regravar o próprio interesse ativo (clique repetido noutra aba)', registrar(TEC, 'tLivre'));
  await pode('P13 inscrição antiga, hoje FORA da lista da turma: a pessoa ainda remove o próprio registro', remover(ANTIGO, 'tAntiga'));
  const antigoDepois = await ler(ti('tAntiga', ANTIGO));
  anota('P13 a remoção preserva a confirmação e os dados do admin', !!antigoDepois && antigoDepois.removed === true && antigoDepois.status === 'removido' &&
    antigoDepois.confirmedByAdmin === antigoAntes.confirmedByAdmin && antigoDepois.confirmedDate === antigoAntes.confirmedDate, JSON.stringify(antigoDepois));
  const intAntes = await ler(ti('tAntiga', ANTIGA_INT));
  await nega('N17 "remover" o interesse antigo regravando o registro inteiro (apagaria as anotações do admin)',
    db(ANTIGA_INT).ref(ti('tAntiga', ANTIGA_INT)).set(Object.assign(interesse(ANTIGA_INT), REMOCAO)));
  await pode('P14 interesse antigo, hoje FORA da lista: remove o próprio registro', remover(ANTIGA_INT, 'tAntiga'));
  const intDepois = await ler(ti('tAntiga', ANTIGA_INT));
  anota('P14 a remoção mantém todas as anotações do admin (motivo, origem, quem incluiu)', !!intDepois && intDepois.removed === true &&
    ['addedByAdmin', 'addedByAdminName', 'motivoNaoConfirmado', 'motivoRegistradoEm', 'motivoRegistradoPor', 'jaParticipouTurma', 'jaParticipouTurmaLabel', 'fromEspera']
      .every((c) => JSON.stringify(intDepois[c]) === JSON.stringify(intAntes[c])), JSON.stringify(intDepois));
  await pode('P15 acrescenta "registrado" no próprio histórico', db(TEC).ref('turmas-interesse-log/tLivre/' + emailKey(TEC)).push(itemLog(TEC, 'registrado')));
  await pode('P15 acrescenta "removido" no próprio histórico', db(TEC).ref('turmas-interesse-log/tLivre/' + emailKey(TEC)).push(itemLog(TEC, 'removido')));
  await pode('P15 histórico com e-mail de hífen', db(ESPECIAIS['hífen']).ref('turmas-interesse-log/tLivre/' + emailKey(ESPECIAIS['hífen'])).push(itemLog(ESPECIAIS['hífen'], 'registrado')));
  await pode('P17 todos leem turmas-interesse, como antes', db(OUTRA).ref('turmas-interesse/tAntiga').once('value'));

  console.log('\n== N. recusado pelo banco ==');
  await nega('N1 fora da lista da turma', registrar(OUTRA, 'tLista'));
  await nega('N2 turma restrita com lista vazia/ausente: ninguém entra', registrar(TEC, 'tListaVazia'));
  await nega('N3 fora da lista do evento', registrar(OUTRA, 'tEvLista'));
  await nega('N3 na lista do evento não basta para turma restrita fora da lista dela', registrar(OUTRA, 'tTecLista'));
  await nega('N4 gerente em evento de Técnicos', registrar(GER, 'tTec'));
  await nega('N5 gerente NA LISTA da turma de evento de Técnicos', registrar(GER, 'tTecLista'));
  await nega('N6 técnico em evento de Gerentes', registrar(TEC, 'tGer'));
  await nega('N7 turma contraditória (Só gerentes em evento de Técnicos): técnico', registrar(TEC, 'tConflito'));
  await nega('N7 turma contraditória: gerente', registrar(GER, 'tConflito'));
  await nega('N8 não diretor em evento só de diretores', registrar(TEC, 'tDir'));
  await nega('N9 inscrições encerradas (finalizada)', registrar(TEC, 'tFinal'));
  await nega('N10 turma realizada (encerrada)', registrar(TEC, 'tEnc'));
  await nega('N11 gerente em turma "Só técnicos"', registrar(GER, 'tCargoTec'));
  await nega('N12 turma que não existe', registrar(TEC, 'tNaoExiste'));
  await nega('N13 registrar na chave de outra pessoa', registrar(OUTRA, 'tLivre', TEC, interesse(TEC)));
  await nega('N13 remover o registro de outra pessoa', remover(OUTRA, 'tAntiga', PRESERVADO));
  await nega('N13 mudar um campo do registro de outra pessoa', db(OUTRA).ref(ti('tAntiga', PRESERVADO) + '/name').set('OUTRO NOME'));
  await nega('N13 chave da regra antiga (hífen sem remover)', db(ESPECIAIS['hífen']).ref('turmas-interesse/tLivre/maria-silva_previ_com_br').set(interesse(ESPECIAIS['hífen'])));
  await nega('N13 chave sem o corte em 64', db(ESPECIAIS['mais de 64']).ref('turmas-interesse/tLivre/' + ESPECIAIS['mais de 64'].replace(/[@.]/g, '_')).set(interesse(ESPECIAIS['mais de 64'])));
  await nega('N14 autoinscrição: status "inscrito"', registrar(OUTRA, 'tLivre', OUTRA, Object.assign(interesse(OUTRA), { status: 'inscrito' })));
  await nega('N14 autoinscrição: interesse com confirmedByAdmin', registrar(OUTRA, 'tLivre', OUTRA, Object.assign(interesse(OUTRA), { confirmedByAdmin: ADMIN })));
  await nega('N14 autoinscrição: status "inscrito" + confirmação completa', registrar(OUTRA, 'tLivre', OUTRA, inscrita(OUTRA)));
  await pode('(preparo) a pessoa registra interesse legítimo', registrar(OUTRA, 'tLivre'));
  await nega('N14 autoconfirmação por update (status)', db(OUTRA).ref(ti('tLivre', OUTRA)).update({ status: 'inscrito' }));
  await nega('N14 autoconfirmação por update (confirmedByAdmin)', db(OUTRA).ref(ti('tLivre', OUTRA)).update({ confirmedByAdmin: OUTRA, confirmedDate: AGORA }));
  await nega('N14 autoconfirmação gravando só o campo', db(OUTRA).ref(ti('tLivre', OUTRA) + '/confirmedByAdmin').set(ADMIN));
  await nega('N14 campo administrativo falso (acimaDasVagas)', db(OUTRA).ref(ti('tLivre', OUTRA)).update({ acimaDasVagas: { motivo: 'x' } }));
  await nega('N15 campo inventado', registrar(OUTRA, 'tLivre', OUTRA, Object.assign(interesse(OUTRA), { vip: true })));
  await nega('N16 e-mail de outra pessoa dentro do próprio registro', registrar(OUTRA, 'tLivre', OUTRA, Object.assign(interesse(OUTRA), { email: TEC })));
  await nega('N17 "remover" uma inscrição apagando a confirmação (set do registro inteiro)', db(TEC).ref(ti('tOutra', TEC)).set(Object.assign(interesse(TEC), REMOCAO)));
  await nega('N21 "remover" sem status removido', db(OUTRA).ref(ti('tLivre', OUTRA)).update({ removed: true }));
  await nega('N21 "remover" com status inventado', db(OUTRA).ref(ti('tLivre', OUTRA)).update({ removed: true, status: 'inscrito' }));
  await nega('N18 apagar o próprio registro', db(OUTRA).ref(ti('tLivre', OUTRA)).remove());
  await nega('N19 reativar fora do público (inscrição antiga removida, lista mudou)', registrar(ANTIGO, 'tAntiga'));
  await nega('N20 sobrescrever a própria inscrição ativa com interesse', registrar(TEC, 'tOutra'));
  await nega('N22 gravar a turma inteira de turmas-interesse', db(OUTRA).ref('turmas-interesse/tLivre').set({ [emailKey(OUTRA)]: interesse(OUTRA) }));
  await nega('N22 apagar a turma inteira de turmas-interesse', db(OUTRA).ref('turmas-interesse/tAntiga').remove());
  const mp1 = {}; mp1[ti('tLista', OUTRA)] = interesse(OUTRA); mp1['turmas/tLista/publicoRestrito'] = false;
  await nega('N23 multipath: desligar a restrição da turma junto com o próprio interesse', db(OUTRA).ref().update(mp1));
  const mp2 = {}; mp2[ti('tSemEvento', OUTRA)] = interesse(OUTRA); mp2[ti('tAntiga', PRESERVADO) + '/removed'] = true;
  await nega('N23 multipath: interesse legítimo + mexer no registro de outra pessoa', db(OUTRA).ref().update(mp2));
  const mp3 = {}; mp3[ti('tTecLista', GER)] = interesse(GER); mp3['fa-gerentes/' + emailKey(GER)] = null;
  await nega('N23 multipath: gerente sai de fa-gerentes junto com o interesse', db(GER).ref().update(mp3));
  const mp4 = {}; mp4[ti('tLista', OUTRA)] = interesse(OUTRA); mp4['turmas-publico/tLista/' + emailKey(OUTRA)] = { email: OUTRA };
  await nega('N23 multipath: entrar na lista da turma junto com o interesse', db(OUTRA).ref().update(mp4));
  for (const p of Object.keys(PERFIS)) {
    const e = PERFIS[p][0];
    await nega('N24 ' + p + ': editar turma (desligar publicoRestrito)', db(e).ref('turmas/tLista/publicoRestrito').set(false));
    await nega('N24 ' + p + ': criar turma', db(e).ref('turmas/tNova').set({ label: 'NOVA', eventoKey: 'evLivre' }));
    await nega('N24 ' + p + ': reabrir inscrições (turmas-config)', db(e).ref('turmas-config/tFinal/finalizada').set(false));
    await nega('N24 ' + p + ': abrir check-in (turmas-config diaAtivo)', db(e).ref('turmas-config/tLivre/diaAtivo').set('2027-11-03'));
    await nega('N24 ' + p + ': entrar na equipe da turma', db(e).ref('turmas-equipe/tLivre/' + emailKey(e)).set({ email: e, papel: 'responsavel' }));
  }
  await nega('N25 histórico: escrever no de outra pessoa', db(OUTRA).ref('turmas-interesse-log/tLivre/' + emailKey(TEC)).push(itemLog(TEC, 'registrado')));
  await nega('N25 histórico: ação falsa ("confirmado")', db(OUTRA).ref('turmas-interesse-log/tLivre/' + emailKey(OUTRA)).push(itemLog(OUTRA, 'confirmado')));
  await nega('N25 histórico: e-mail de outra pessoa no próprio', db(OUTRA).ref('turmas-interesse-log/tLivre/' + emailKey(OUTRA)).push(itemLog(TEC, 'registrado')));
  await nega('N25 histórico: campo inventado', db(OUTRA).ref('turmas-interesse-log/tLivre/' + emailKey(OUTRA)).push(Object.assign(itemLog(OUTRA, 'registrado'), { confirmedByAdmin: ADMIN })));
  await nega('N25 histórico: mudar um item existente', db(OUTRA).ref('turmas-interesse-log/tLivre/' + emailKey(OUTRA) + '/item1/action').set('confirmado'));
  await nega('N25 histórico: apagar um item', db(OUTRA).ref('turmas-interesse-log/tLivre/' + emailKey(OUTRA) + '/item1').remove());
  await nega('N25 histórico: apagar o próprio histórico inteiro', db(OUTRA).ref('turmas-interesse-log/tLivre/' + emailKey(OUTRA)).remove());
  await nega('N26 sem login: registrar', db(null).ref(ti('tLivre', OUTRA)).set(interesse(OUTRA)));
  await nega('N26 sem login: ler', db(null).ref('turmas-interesse').once('value'));

  console.log('\n== I. preservação ==');
  const preservadoDepois = await ler(ti('tAntiga', PRESERVADO));
  anota('I1 o registro de terceiros alvo das tentativas continua idêntico', JSON.stringify(preservadoDepois) === JSON.stringify(preservadoAntes), JSON.stringify(preservadoDepois));
  anota('I2 a inscrição ativa não foi sobrescrita', (await ler(ti('tOutra', TEC))).status === 'inscrito');
  anota('I3 a restrição da turma continua ligada', (await ler('turmas/tLista/publicoRestrito')) === true);
  anota('I4 as inscrições da turma encerrada continuam fechadas', (await ler('turmas-config/tFinal/finalizada')) === true);
  anota('I5 o histórico de terceiros não ganhou item', Object.keys((await ler('turmas-interesse-log/tLivre/' + emailKey(TEC))) || {}).length === 3);

  console.log('\n== A. o admin faz tudo o que o painel faz ==');
  for (const adm of [ADMIN, ADMIN_FIXO]) {
    await reiniciar();
    const qual = adm === ADMIN ? '(fa-admins)' : '(lista fixa)';
    const a = db(adm);
    await pode('A1 ' + qual + ' ＋ Participante como Inscrita, fora da lista e do cargo', a.ref(ti('tTecLista', GER)).set(Object.assign(inscrita(GER, adm), { addedByAdmin: adm })));
    await pode('A2 ' + qual + ' Confirmar', a.ref().update({ [ti('tAntiga', ANTIGA_INT) + '/status']: 'inscrito', [ti('tAntiga', ANTIGA_INT) + '/confirmedByAdmin']: adm,
      [ti('tAntiga', ANTIGA_INT) + '/confirmedByAdminName']: 'ADMIN', [ti('tAntiga', ANTIGA_INT) + '/confirmedDate']: AGORA }));
    await pode('A2 ' + qual + ' Confirmar removendo a inscrição em outra turma (multipath)', a.ref().update({ [ti('tLivre', TEC)]: inscrita(TEC, adm),
      [ti('tOutra', TEC) + '/removed']: true, [ti('tOutra', TEC) + '/removedDate']: AGORA, [ti('tOutra', TEC) + '/removedReason']: 'Inscrita automaticamente' }));
    await pode('A3 ' + qual + ' Desconfirmar', a.ref().update({ [ti('tAntiga', ANTIGO) + '/status']: 'interessado', [ti('tAntiga', ANTIGO) + '/confirmedByAdmin']: null,
      [ti('tAntiga', ANTIGO) + '/confirmedByAdminName']: null, [ti('tAntiga', ANTIGO) + '/confirmedDate']: null }));
    await pode('A4 ' + qual + ' Mover da fila (registro novo com acimaDasVagas)', a.ref().update({ [ti('tLista', OUTRA)]: Object.assign(inscrita(OUTRA, adm), { acimaDasVagas: { motivo: 'm', vagas: 1, ocupadas: 1, por: adm, em: AGORA } }),
      ['fa-espera/' + emailKey(OUTRA)]: null }));
    await pode('A5 ' + qual + ' Mover para a espera', a.ref().update({ [ti('tAntiga', PRESERVADO) + '/removed']: true, [ti('tAntiga', PRESERVADO) + '/removedDate']: AGORA,
      [ti('tAntiga', PRESERVADO) + '/removedReason']: 'Movida para lista de espera', [ti('tAntiga', PRESERVADO) + '/movedToEspera']: true,
      [ti('tAntiga', PRESERVADO) + '/removedByAdmin']: adm, [ti('tAntiga', PRESERVADO) + '/removedByAdminName']: 'ADMIN',
      ['fa-espera/' + emailKey(PRESERVADO)]: { evLivre: { email: PRESERVADO, eventoKey: 'evLivre', date: AGORA } } }));
    await pode('A6 ' + qual + ' matrícula em massa (multipath)', a.ref().update({ [ti('tLista', TEC)]: inscrita(TEC, adm), [ti('tLista', GER)]: inscrita(GER, adm) }));
    await pode('A7 ' + qual + ' renomear participante', a.ref().update({ [ti('tAntiga', ANTIGO) + '/name']: 'NOME CORRIGIDO' }));
    await pode('A8 ' + qual + ' corrigir e-mail (mover o registro de chave)', a.ref().update({ [ti('tAntiga', ANTIGA_INT)]: null, [ti('tAntiga', 'nova.chave@previ.com.br')]: interesse('nova.chave@previ.com.br') }));
    await pode('A9 ' + qual + ' excluir participante (registro + histórico)', a.ref().update({ [ti('tOutra', TEC)]: null, ['turmas-interesse-log/tOutra/' + emailKey(TEC)]: null }));
    await pode('A10 ' + qual + ' editar turma / config / equipe', a.ref().update({ 'turmas/tLista/publicoRestrito': false, 'turmas-config/tFinal/finalizada': false,
      'turmas-config/tLivre/diaAtivo': '2027-11-03', ['turmas-equipe/tLivre/' + emailKey('fac@previ.com.br') + '/papel']: 'responsavel' }));
    await pode('A10 ' + qual + ' criar turma (push)', a.ref('turmas').push({ label: 'NOVA', eventoKey: 'evLivre', dias: ['2027-12-01'], order: 9 }));
    await pode('A11 ' + qual + ' histórico do painel ("confirmado")', a.ref('turmas-interesse-log/tLivre/' + emailKey(TEC)).push({ action: 'confirmado', by: adm, date: AGORA }));
    await pode('A12 ' + qual + ' excluir turma (multipath de todos os nós dela)', a.ref().update({ 'turmas/tAntiga': null, 'turmas-config/tAntiga': null,
      'turmas-interesse/tAntiga': null, 'turmas-interesse-log/tAntiga': null, 'turmas-equipe/tAntiga': null, 'turmas-publico/tAntiga': null }));
  }

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
