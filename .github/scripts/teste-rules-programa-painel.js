/* ═════════════════════════════════════════════════════════════════
   Regras do banco — PAINEL DO PROGRAMA (fa-painel-convidados, programa-config, programa-config-auditoria,
   programa-calendario, programa-publico-alvo). Roda contra o EMULADOR real do Realtime Database (teste-rules.yml) com o
   database.rules.json do repositório (ou RULES_PATH). Dados 100% sintéticos. Prova, pelo BANCO — não pela tela:
   C. convidados: qualquer admin de verdade (fixos + fa-admins) inclui e remove; pessoa comum e o próprio convidado não;
      a lista inteira só admin lê; o convidado lê o PRÓPRIO registro (é assim que o site sabe que ele entra);
   L. leitura dos dados do painel (configuração, calendário, base oficial): admin e convidado sim; pessoa comum, perfil
      de Avaliação e sem login, não;
   E. edição = gravação: admin grava configuração, calendário e base; convidado e pessoa comum não gravam nada;
   V. validação: data, eventos que existem, limites, horários, campos inventados, autoria com o próprio e-mail;
   H. histórico: auditoria só de acréscimo (não muda nem apaga); versão da base imutável depois de gravada; "vigente" só
      aponta para versão que existe;
   P. preservação: gravar aqui não mexe em turmas, inscrições, presença nem cadastros.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const SUPER = 'tatianefdirene@previ.com.br', ADMIN = 'admin.painel@previ.com.br', CONV = 'convidado@previ.com.br', COMUM = 'pessoa@previ.com.br', AVAL = 'avaliadora@previ.com.br';
const SERVER = { '.sv': 'timestamp' };
const conv = (e, por) => ({ email: e, name: 'CONVIDADO', addedAt: '2026-11-10T12:00:00.000Z', addedBy: por });

async function main() {
  const regras = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-painel', database: { rules: regras } });
  const db = (e) => (e ? env.authenticatedContext('u' + emailKey(e), { email: e, email_verified: true }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'NEGADO: ' + String(x.message || x).slice(0, 160)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'foi ACEITO'); } }

  await semear(async (a) => {
    await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: 'ADMIN' });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
    await a.ref('eventos/evT').set({ nome: 'T' });
    await a.ref('turmas/t1').set({ label: 'T1', eventoKey: 'evT', dias: ['2026-12-01'] });
    await a.ref('turmas-interesse/t1/' + emailKey(COMUM)).set({ email: COMUM, status: 'interessado' });
    await a.ref('turmas-checkin/t1/2026-12-01/' + emailKey(COMUM)).set(true);
    await a.ref('fa-users/' + emailKey(COMUM)).set({ email: COMUM, name: 'P' });
  });
  const antes = {}; for (const n of ['turmas', 'turmas-interesse', 'turmas-checkin', 'fa-users', 'eventos']) antes[n] = JSON.stringify(await ler(n));

  console.log('\n== C. convidados ==');
  await pode('C1 super-admin inclui convidado', db(SUPER).ref('fa-painel-convidados/' + emailKey(CONV)).set(conv(CONV, SUPER)));
  await pode('C2 admin de fa-admins inclui convidado', db(ADMIN).ref('fa-painel-convidados/' + emailKey('outro@previ.com.br')).set(conv('outro@previ.com.br', ADMIN)));
  await nega('C3 pessoa comum não se inclui', db(COMUM).ref('fa-painel-convidados/' + emailKey(COMUM)).set(conv(COMUM, COMUM)));
  await nega('C4 convidado não inclui outra pessoa', db(CONV).ref('fa-painel-convidados/' + emailKey('x@previ.com.br')).set(conv('x@previ.com.br', CONV)));
  await nega('C5 admin não assina como outra pessoa', db(ADMIN).ref('fa-painel-convidados/' + emailKey('y@previ.com.br')).set(conv('y@previ.com.br', SUPER)));
  await nega('C6 e-mail fora de @previ.com.br recusado', db(ADMIN).ref('fa-painel-convidados/' + emailKey('z@gmail.com')).set(conv('z@gmail.com', ADMIN)));
  await nega('C7 campo inventado recusado', db(ADMIN).ref('fa-painel-convidados/' + emailKey('w@previ.com.br')).set(Object.assign(conv('w@previ.com.br', ADMIN), { admin: true })));
  await pode('C8 admin lê a lista inteira', db(ADMIN).ref('fa-painel-convidados').once('value'));
  await nega('C9 convidado não lê a lista inteira', db(CONV).ref('fa-painel-convidados').once('value'));
  await pode('C10 convidado lê o próprio registro', db(CONV).ref('fa-painel-convidados/' + emailKey(CONV)).once('value'));
  await nega('C11 pessoa comum não lê o registro de um convidado', db(COMUM).ref('fa-painel-convidados/' + emailKey(CONV)).once('value'));
  await pode('C12 pessoa comum lê o próprio (vazio): o site descobre que ela não é convidada', db(COMUM).ref('fa-painel-convidados/' + emailKey(COMUM)).once('value'));
  await nega('C13 convidado não se remove nem remove outros', db(CONV).ref('fa-painel-convidados/' + emailKey('outro@previ.com.br')).remove());
  await pode('C14 admin remove convidado', db(ADMIN).ref('fa-painel-convidados/' + emailKey('outro@previ.com.br')).remove());

  console.log('\n== E/V. configuração ==');
  const cfg = { prazo: '2026-12-11', eventos: { evT: true }, facilitadores: { [emailKey('f@previ.com.br')]: 'f@previ.com.br' }, antecedenciaDiasUteis: 5,
    limiteParalelo: { tecnicos: 2, gestores: 1 }, formatos: { tecnicos: { encontros: 4, horarioInicio: '09:00', horarioFim: '13:00', vagas: 25 } }, atualizadoEm: SERVER, atualizadoPor: ADMIN };
  await pode('E1 admin grava a configuração', db(ADMIN).ref('programa-config').set(cfg));
  await nega('E2 convidado não grava a configuração', db(CONV).ref('programa-config/prazo').set('2027-01-01'));
  await nega('E3 pessoa comum não grava a configuração', db(COMUM).ref('programa-config/prazo').set('2027-01-01'));
  await nega('V1 prazo que não é data', db(ADMIN).ref('programa-config').set(Object.assign({}, cfg, { prazo: '11/12/2026' })));
  await nega('V2 evento que não existe', db(ADMIN).ref('programa-config').set(Object.assign({}, cfg, { eventos: { evNada: true } })));
  await nega('V3 limite zero', db(ADMIN).ref('programa-config').set(Object.assign({}, cfg, { limiteParalelo: { tecnicos: 0, gestores: 1 } })));
  await nega('V4 antecedência negativa', db(ADMIN).ref('programa-config').set(Object.assign({}, cfg, { antecedenciaDiasUteis: -1 })));
  await nega('V5 formato com término antes do início', db(ADMIN).ref('programa-config').set(Object.assign({}, cfg, { formatos: { tecnicos: { encontros: 4, horarioInicio: '13:00', horarioFim: '09:00', vagas: 25 } } })));
  await nega('V6 formato de público inventado', db(ADMIN).ref('programa-config').set(Object.assign({}, cfg, { formatos: { diretores: { encontros: 1, horarioInicio: '09:00', horarioFim: '10:00', vagas: 5 } } })));
  await nega('V7 campo inventado na configuração', db(ADMIN).ref('programa-config').set(Object.assign({}, cfg, { publico: 430 })));
  await nega('V8 autoria com outro e-mail', db(ADMIN).ref('programa-config').set(Object.assign({}, cfg, { atualizadoPor: SUPER })));

  console.log('\n== H. auditoria ==');
  const aud = { campo: 'prazo', antes: '', depois: '2026-12-11', em: SERVER, por: ADMIN };
  await pode('H1 admin acrescenta um registro de auditoria', db(ADMIN).ref('programa-config-auditoria/a1').set(aud));
  await nega('H2 auditoria não muda depois de gravada', db(ADMIN).ref('programa-config-auditoria/a1/depois').set('2027-01-01'));
  await nega('H3 auditoria não se apaga', db(ADMIN).ref('programa-config-auditoria/a1').remove());
  await nega('H4 convidado não lê a auditoria', db(CONV).ref('programa-config-auditoria').once('value'));

  console.log('\n== calendário ==');
  await pode('K1 admin cadastra dia indisponível', db(ADMIN).ref('programa-calendario/2026-11-20').set({ motivo: 'Consciência Negra', em: SERVER, por: ADMIN }));
  await nega('K2 chave que não é data', db(ADMIN).ref('programa-calendario/vinte').set({ motivo: 'x', em: SERVER, por: ADMIN }));
  await nega('K3 convidado não cadastra', db(CONV).ref('programa-calendario/2026-11-21').set({ motivo: 'x', em: SERVER, por: CONV }));
  await pode('K4 admin retira um dia', db(ADMIN).ref('programa-calendario/2026-11-20').remove());

  console.log('\n== base oficial ==');
  const versao = { importadaEm: SERVER, importadaPor: ADMIN, total: 2, origem: 'TOTAL.xlsx', pessoas: { [emailKey('a@previ.com.br')]: { email: 'a@previ.com.br', nome: 'A', gerencia: 'GECON', diretoria: 'DIRAD' }, [emailKey('b@adcmflex.com.br')]: { email: 'b@adcmflex.com.br', nome: 'B', gerencia: 'INFOR', diretoria: 'DISEG' } } };
  await nega('B1 "vigente" não aponta para versão que não existe', db(ADMIN).ref('programa-publico-alvo/vigente').set(1));
  await pode('B2 admin grava a versão 1 e a torna vigente na mesma gravação', db(ADMIN).ref('programa-publico-alvo').update({ 'versoes/1': versao, vigente: 1 }));
  await nega('B3 versão gravada não muda', db(ADMIN).ref('programa-publico-alvo/versoes/1/total').set(3));
  await nega('B4 versão gravada não se apaga', db(ADMIN).ref('programa-publico-alvo/versoes/1').remove());
  await nega('B5 convidado não importa', db(CONV).ref('programa-publico-alvo/versoes/2').set(versao));
  await nega('B6 pessoa com campo inventado recusada', db(ADMIN).ref('programa-publico-alvo/versoes/2').set(Object.assign({}, versao, { pessoas: { x: { email: 'x@previ.com.br', cpf: '1' } } })));

  console.log('\n== L. leitura dos dados do painel ==');
  for (const no of ['programa-config', 'programa-calendario', 'programa-publico-alvo']) {
    await pode('L ' + no + ': admin lê', db(ADMIN).ref(no).once('value'));
    await pode('L ' + no + ': convidado lê', db(CONV).ref(no).once('value'));
    await nega('L ' + no + ': pessoa comum não lê', db(COMUM).ref(no).once('value'));
    await nega('L ' + no + ': perfil de Avaliação não lê', db(AVAL).ref(no).once('value'));
    await nega('L ' + no + ': sem login não lê', db(null).ref(no).once('value'));
  }

  console.log('\n== P. preservação ==');
  let iguais = true; for (const n of Object.keys(antes)) if (JSON.stringify(await ler(n)) !== antes[n]) iguais = false;
  anota('P1 turmas, inscrições, presença, cadastros e eventos intocados', iguais);

  await env.cleanup();
  console.log('\n' + (total - falhas) + ' de ' + total + ' ok');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
