/* ═════════════════════════════════════════════════════════════════
   Regras do banco — ATIVAÇÃO DOS PÚBLICOS (Entrega B; montar-regras-inscricoes.js + montar-regras-outros-publicos.js, com a
   tabela de forca-agil/publicos-nucleo.js). Roda contra o EMULADOR real (teste-rules.yml). Dados 100% sintéticos. Prova:
   D. DESLIGADA (o padrão, sem publicos-config): tudo como antes — Técnicos = quem não é gerente (diretor e estagiário
      entram num evento de Técnicos), Diretores e as categorias novas são só descrição;
   K. publicos-config: só os super-admins ligam/desligam, assinando com o próprio e-mail; admin comum e a pessoa não;
      qualquer conta @previ lê;
   L. LIGADA: Técnicos fora de Gerentes, Diretores e das sete categorias; cada categoria, os dois agrupados (Conselheiros
      sem o COAUD), Assessores e Diretores restringem; Empregados continua aberto; o "Público" da turma (só técnicos)
      segue a classificação nova;
   X. o ADMIN inclui um assessor num evento de Gerentes (e uma estagiária num de Técnicos) só com a exceção — a da #464;
   H. registros que já existem continuam editáveis e a pessoa continua saindo deles; quem entrou ACIMA DAS VAGAS sai pelo
      site (correção: o campo-objeto acimaDasVagas comparado campo a campo);
   V. desligar volta tudo a como era.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const AGORA = '2026-11-03T10:00:00.000Z';

const SUPER = 'tatianefdirene@previ.com.br', ADMIN = 'admin.pub@previ.com.br';
const GER = 'gerente.pub@previ.com.br', DIR = 'diretor.pub@previ.com.br', TEC = 'tecnico.pub@previ.com.br', EST = 'estagiaria.pub@previ.com.br';
const APR = 'aprendiz.pub@previ.com.br', COA = 'coaud.pub@previ.com.br', CDL = 'conselheira.pub@previ.com.br', ASS = 'assessor.pub@previ.com.br';
const SAI = 'acima.pub@previ.com.br', HIS = 'historico.pub@previ.com.br';

const ti = (t, e) => 'turmas-interesse/' + t + '/' + emailKey(e);
const interesse = (e) => ({ name: 'P ' + e.split('@')[0].toUpperCase(), email: e, area: 'TI', date: AGORA, removed: false, status: 'interessado' });
const inscrita = (e) => Object.assign(interesse(e), { status: 'inscrito', confirmedByAdmin: ADMIN, confirmedByAdminName: 'ADMIN', confirmedDate: AGORA, addedByAdmin: true });
const exc = (turma, regras) => ({ regras: Object.fromEntries(regras.map((r) => [r, true])), motivo: 'Assessor convidado pela diretoria', por: ADMIN, porNome: 'ADMIN', em: AGORA, turma });
const outro = (e, cs) => ({ email: e, name: 'X', categorias: Object.fromEntries(cs.map((c) => [c, true])), addedAt: AGORA, addedBy: SUPER });

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-publicos', database: { rules } });
  const db = (e) => (e ? env.authenticatedContext('u' + emailKey(e), { email: e, email_verified: true }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'NEGADO: ' + String(x.message || x).slice(0, 160)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'foi ACEITO'); } }
  /* a pessoa registra o próprio interesse (o set do site) e, para repetir o caso, o registro é limpo sem regras */
  const registra = (e, t) => db(e).ref(ti(t, e)).set(interesse(e));
  const limpar = () => semear(async (r) => { for (const t of TURMAS) await r.ref('turmas-interesse/' + t).remove(); });
  async function caso(rotulo, ok, e, t) { await limpar(); await (ok ? pode : nega)(rotulo, registra(e, t)); }

  const EVENTOS = { evTec: 'Técnicos', evGer: 'Gerentes', evDir: 'Diretores', evEst: 'Estagiários', evEA: 'Estagiários e menores aprendizes',
    evCons: 'Conselheiros', evAss: 'Assessores', evCDL: 'Conselho Deliberativo', evCoaud: 'Membros do COAUD', evEmp: '' };
  const TURMAS = Object.keys(EVENTOS).map((e) => 't' + e.slice(2)).concat(['tTurmaTec']);
  await semear(async (r) => {
    await r.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: 'ADMIN' });
    await r.ref('fa-gerentes/' + emailKey(GER)).set({ email: GER, name: 'G' });
    await r.ref('fa-diretores/' + emailKey(DIR)).set({ email: DIR, name: 'D' });
    for (const [e, c] of [[EST, ['estagiario']], [APR, ['menorAprendiz']], [COA, ['coaud']], [CDL, ['conselhoDeliberativo']], [ASS, ['assessor']]]) {
      await r.ref('fa-outros-publicos/' + emailKey(e)).set(outro(e, c));
    }
    for (const ek of Object.keys(EVENTOS)) {
      await r.ref('eventos/' + ek).set(Object.assign({ nome: ek, publicado: true }, EVENTOS[ek] ? { publicoDesc: EVENTOS[ek] } : {}));
      await r.ref('turmas/t' + ek.slice(2)).set({ label: 'T', dias: ['2027-11-03'], order: 1, eventoKey: ek });
    }
    await r.ref('turmas/tTurmaTec').set({ label: 'T', dias: ['2027-11-03'], order: 1, eventoKey: 'evEmp', publicoCargo: 'tecnicos' });
  });

  console.log('\n== D. desligada: tudo como antes ==');
  await caso('D1 estagiária entra num evento de Técnicos (técnico = não gerente)', true, EST, 'tTec');
  await caso('D2 diretor entra num evento de Técnicos', true, DIR, 'tTec');
  await caso('D3 assessor entra num evento de Técnicos', true, ASS, 'tTec');
  await caso('D4 gerente NÃO entra num evento de Técnicos', false, GER, 'tTec');
  await caso('D5 técnico NÃO entra num evento de Gerentes', false, TEC, 'tGer');
  await caso('D6 "Diretores" é só descrição: técnico entra', true, TEC, 'tDir');
  await caso('D7 "Estagiários" é só descrição: técnico entra', true, TEC, 'tEst');
  await caso('D8 turma "só técnicos": estagiária entra', true, EST, 'tTurmaTec');

  console.log('\n== K. quem liga a ativação ==');
  const cfg = (por, ativo) => ({ ativo, em: AGORA, por, porNome: 'X' });
  await nega('K1 admin comum NÃO liga', db(ADMIN).ref('publicos-config').set(cfg(ADMIN, true)));
  await nega('K2 a pessoa NÃO liga', db(TEC).ref('publicos-config').set(cfg(TEC, true)));
  await nega('K3 super-admin assinando com outro e-mail', db(SUPER).ref('publicos-config').set(cfg(ADMIN, true)));
  await nega('K4 formato inválido (ativo não booleano / campo inventado)', db(SUPER).ref('publicos-config').set(Object.assign(cfg(SUPER, 'sim'))));
  await nega('K4 campo inventado', db(SUPER).ref('publicos-config').set(Object.assign(cfg(SUPER, true), { liberaAcesso: true })));
  await pode('K5 super-admin liga, assinando com o próprio e-mail', db(SUPER).ref('publicos-config').set(cfg(SUPER, true)));
  await pode('K6 qualquer conta @previ lê a ativação', db(TEC).ref('publicos-config/ativo').once('value'));
  await nega('K7 sem login não lê', db(null).ref('publicos-config/ativo').once('value'));

  console.log('\n== L. ligada: cada público ==');
  await caso('L1 técnico (fora de tudo) entra num evento de Técnicos', true, TEC, 'tTec');
  for (const [e, n] of [[EST, 'estagiária'], [APR, 'aprendiz'], [COA, 'membro do COAUD'], [CDL, 'conselheira'], [ASS, 'assessor'], [DIR, 'diretor'], [GER, 'gerente']]) {
    await caso('L2 ' + n + ' NÃO entra num evento de Técnicos', false, e, 'tTec');
  }
  await caso('L3 estagiária entra em "Estagiários"', true, EST, 'tEst');
  await caso('L3 técnico NÃO entra em "Estagiários"', false, TEC, 'tEst');
  await caso('L3 aprendiz NÃO entra em "Estagiários" (categoria própria)', false, APR, 'tEst');
  await caso('L4 "Estagiários e menores aprendizes": estagiária entra', true, EST, 'tEA');
  await caso('L4 "Estagiários e menores aprendizes": aprendiz entra', true, APR, 'tEA');
  await caso('L4 "Estagiários e menores aprendizes": COAUD NÃO', false, COA, 'tEA');
  await caso('L5 "Conselheiros": conselheira do Deliberativo entra', true, CDL, 'tCons');
  await caso('L5 "Conselheiros": membro do COAUD NÃO (agrupado sem o COAUD)', false, COA, 'tCons');
  await caso('L5 "Membros do COAUD": membro do COAUD entra', true, COA, 'tCoaud');
  await caso('L5 "Conselho Deliberativo": conselheira entra; COAUD não', true, CDL, 'tCDL');
  await caso('L5 "Conselho Deliberativo": COAUD NÃO', false, COA, 'tCDL');
  await caso('L6 "Assessores": assessor entra', true, ASS, 'tAss');
  await caso('L6 "Assessores": gerente NÃO', false, GER, 'tAss');
  await caso('L7 "Diretores": diretor entra', true, DIR, 'tDir');
  await caso('L7 "Diretores": técnico NÃO', false, TEC, 'tDir');
  await caso('L8 Empregados (só descrição): técnico entra', true, TEC, 'tEmp');
  await caso('L8 Empregados (só descrição): estagiária entra', true, EST, 'tEmp');
  await caso('L9 turma "só técnicos": estagiária NÃO (classificação nova)', false, EST, 'tTurmaTec');
  await caso('L9 turma "só técnicos": técnico entra', true, TEC, 'tTurmaTec');
  await caso('L10 gerente continua entrando em evento de Gerentes', true, GER, 'tGer');

  console.log('\n== X. exceção do ADMIN (a da #464) ==');
  const a = db(ADMIN);
  await limpar();
  await nega('X1 assessor num evento de Gerentes, SEM exceção', a.ref(ti('tGer', ASS)).set(inscrita(ASS)));
  await pode('X2 assessor num evento de Gerentes, COM exceção { cargo } — continua assessor', a.ref(ti('tGer', ASS)).set(Object.assign(inscrita(ASS), { excecaoAdmin: exc('tGer', ['cargo']) })));
  await nega('X3 estagiária num evento de Técnicos, SEM exceção', a.ref(ti('tTec', EST)).set(inscrita(EST)));
  await pode('X4 estagiária num evento de Técnicos, COM exceção', a.ref(ti('tTec', EST)).set(Object.assign(inscrita(EST), { excecaoAdmin: exc('tTec', ['cargo']) })));
  await pode('X5 técnico num evento de Técnicos: sem exceção', a.ref(ti('tTec', TEC)).set(inscrita(TEC)));

  console.log('\n== H. registros que já existem ==');
  await semear(async (r) => {
    await r.ref(ti('tTec', HIS)).set(inscrita(HIS));
    await r.ref('fa-outros-publicos/' + emailKey(HIS)).set(outro(HIS, ['estagiario']));
    await r.ref(ti('tEmp', SAI)).set(Object.assign(interesse(SAI), { acimaDasVagas: { motivo: 'Turma lotada, convidada', vagas: 1, ocupadas: 1, por: ADMIN, porNome: 'ADMIN', em: AGORA } }));
  });
  await pode('H1 estagiária já inscrita num evento de Técnicos continua editável (renomear)', a.ref(ti('tTec', HIS) + '/name').set('NOME NOVO'));
  await pode('H2 ...e ela continua saindo pelo site', db(HIS).ref(ti('tTec', HIS)).update({ removed: true, removedDate: AGORA, status: 'removido' }));
  await pode('H3 quem entrou ACIMA DAS VAGAS sai pelo site (update do app)', db(SAI).ref(ti('tEmp', SAI)).update({ removed: true, removedDate: AGORA, status: 'removido' }));
  let saiu; await semear(async (r) => { saiu = (await r.ref(ti('tEmp', SAI)).once('value')).val(); });
  anota('H3 a justificativa original continua no registro', !!(saiu && saiu.removed === true && saiu.acimaDasVagas && saiu.acimaDasVagas.motivo === 'Turma lotada, convidada'), JSON.stringify(saiu));
  await semear(async (r) => { await r.ref(ti('tEmp', SAI)).set(Object.assign(interesse(SAI), { acimaDasVagas: { motivo: 'Turma lotada, convidada', vagas: 1, ocupadas: 1, por: ADMIN, porNome: 'ADMIN', em: AGORA } })); });
  await nega('H4 sair apagando ou mudando a justificativa: recusado', db(SAI).ref(ti('tEmp', SAI)).set(Object.assign(interesse(SAI), { removed: true, status: 'removido', removedDate: AGORA })));
  await nega('H4 mudar o motivo do acima das vagas: recusado', db(SAI).ref(ti('tEmp', SAI)).update({ removed: true, status: 'removido', removedDate: AGORA, 'acimaDasVagas/motivo': 'outro' }));

  console.log('\n== V. desligar volta a como era ==');
  await pode('V1 super-admin desliga', db(SUPER).ref('publicos-config').set(cfg(SUPER, false)));
  await caso('V2 estagiária volta a entrar num evento de Técnicos', true, EST, 'tTec');
  await caso('V3 "Estagiários" volta a ser só descrição', true, TEC, 'tEst');

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
