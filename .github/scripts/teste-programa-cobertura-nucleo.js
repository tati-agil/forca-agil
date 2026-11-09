/* Painel do Programa — núcleo puro (forca-agil/programa-cobertura-nucleo.js).
 *
 * POR QUE ESTE TESTE EXISTE
 * O painel executivo responde "quanto realizamos, chegaremos a 100% até o prazo, o que impede e o que decidir". Um número
 * errado ali vira decisão errada. Este teste prova as regras aprovadas pela dona, com as funções REAIS de quem pode entrar
 * numa turma (turmas-util.js foraDoPublicoAtual e conflitosDeParticipacao, publicos-nucleo.js), sem navegador e sem rede.
 *   A. público e classificação única (base vigente, facilitadores fora, soma = público, técnicos/gestores por fa-gerentes);
 *   B. ausência pertence à turma, pendência à pessoa (falta → realiza depois; falta → nova inscrição; duas faltas);
 *   C. histórico: inscrição removida depois / antes do primeiro encontro / sem data;
 *   D. check-in por pessoa: turma sem registro, dia sem registro, frequência mínima do evento;
 *   E. ocupação operacional × pessoas únicas (inscrição dupla, interessados e registros de fora da base ocupam vaga);
 *   F. elegibilidade real (cargo, lista da turma e do evento, só diretores, participação anterior, público em conflito);
 *   G. turmas: cancelada, encerrada, passada sem encerrar, depois do prazo, em andamento, nova, vagas alteradas, data movida;
 *   H. calendário: dias úteis, feriado/dia sem expediente, antecedência, limite de simultâneas por horário, turma sem horário,
 *      programação dinâmica = força bruta em calendários sorteados (exato) e nunca abaixo do guloso;
 *   I. diagnóstico, cenário de expansão, conferências e decisões com os mesmos números das tabelas;
 *   J. prévia da importação da base (e-mail repetido, fora do domínio, nome repetido, outros públicos, facilitadores, diferença).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const ctx = { window: {}, console, firebase: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'publicos-nucleo.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'turmas-util.js'), 'utf8'), ctx);
const U = ctx.window.faTurmasUtil, P = ctx.window.faPublicosNucleo;
const N = require(path.join(RAIZ, 'programa-cobertura-nucleo.js'));

let oks = 0, falhas = 0;
const ok = (nome, cond, det) => { if (cond) { oks++; console.log('  ok    ' + nome); } else { falhas++; console.error('  FALHA ' + nome + (det !== undefined ? ' — ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); } };
const k = N.emailKey;
const INS = { status: 'inscrito', confirmedByAdmin: 'adm@previ.com.br' }, INT = { status: 'interessado' };

/* Um cenário mínimo: hoje 09/11/2026 (segunda), prazo 11/12/2026, evento de técnicos e de gestores, base de 4 pessoas. */
function cenario(m) {
  const E = {
    hoje: '2026-11-09',
    eventos: { evT: { nome: 'Técnicos', publicoDesc: 'Técnicos', vagasPorTurma: 10, percentualMinimo: 75 }, evG: { nome: 'Gestores', publicoDesc: 'Gerentes', vagasPorTurma: 5 }, evX: { nome: 'Fora', vagasPorTurma: 30 } },
    turmas: {
      a: { label: 'A', eventoKey: 'evT', dias: ['2026-09-01', '2026-09-02'], horarioInicio: '09:00', horarioFim: '13:00' },
      b: { label: 'B', eventoKey: 'evT', dias: ['2026-10-06', '2026-10-07'], horarioInicio: '09:00', horarioFim: '13:00' },
      c: { label: 'C', eventoKey: 'evT', dias: ['2026-11-24', '2026-11-25'], horarioInicio: '09:00', horarioFim: '13:00' },
      d: { label: 'D', eventoKey: 'evT', dias: ['2026-12-01', '2026-12-02'], horarioInicio: '09:00', horarioFim: '13:00' }
    },
    config: { a: { encerrada: true, dataConclusao: '2026-09-02' }, b: { encerrada: true, dataConclusao: '2026-10-07' } },
    interesse: {}, checkin: {}, users: {}, gerentes: {}, diretores: {}, publicosAtivo: true, eventosPublico: {}, turmasPublico: {},
    programa: { prazo: '2026-12-11', eventos: { evT: true, evG: true }, limiteParalelo: { tecnicos: 2, gestores: 1 }, antecedenciaDiasUteis: 0 },
    calendario: {},
    base: { pessoas: {} }
  };
  ['p', 'q', 'r', 's'].forEach((n, i) => { const e = n + '@previ.com.br'; E.base.pessoas[k(e)] = { email: e, nome: n.toUpperCase(), gerencia: 'G' + (i % 2), diretoria: i < 2 ? 'D1' : 'D2' }; E.users[k(e)] = { email: e }; });
  if (m) m(E);
  return E;
}
const calc = (E) => N.calcular(E, U, P);
const reg = (E, t, email, r) => { (E.interesse[t] = E.interesse[t] || {})[k(email)] = Object.assign({}, r); };
const pres = (E, t, dias, email) => dias.forEach((d) => { ((E.checkin[t] = E.checkin[t] || {})[d] = E.checkin[t][d] || {})[k(email)] = true; });
const outro = (E, t, dias) => dias.forEach((d) => { ((E.checkin[t] = E.checkin[t] || {})[d] = E.checkin[t][d] || {})['alguem_previ_com_br'] = true; });
const P1 = 'p@previ.com.br', Q = 'q@previ.com.br', R2 = 'r@previ.com.br', S = 's@previ.com.br';

console.log('\n== A. público e classificação ==');
{
  let r = calc(cenario());
  ok('A1 público = base vigente', r.N === 4);
  ok('A2 soma das 5 situações = público', Object.values(r.porSit).reduce((a, b) => a + b, 0) === r.N && !r.inconsistencias.length, r.inconsistencias);
  r = calc(cenario((E) => { E.programa.facilitadores = { [k(S)]: S }; }));
  ok('A3 facilitador configurado sai do público, da cobertura e das pendências', r.N === 3 && r.excluidosFacilitadores === 1);
  r = calc(cenario((E) => { E.gerentes[k(Q)] = { email: Q }; }));
  ok('A4 gestor = está em fa-gerentes; técnicos + gestores = público', r.porGrupo.gestores.total === 1 && r.porGrupo.tecnicos.total === 3);
  r = calc(cenario((E) => { delete E.users[k(S)]; }));
  ok('A5 sem cadastro continua no público', r.porSit['sem-cadastro'] === 1 && r.N === 4);
  r = calc(cenario((E) => { reg(E, 'c', 'fora@previ.com.br', INS); }));
  ok('A6 pessoa fora da base não entra no cálculo de pessoas', r.N === 4 && r.porSit.inscrita === 0);
  r = calc(cenario((E) => { reg(E, 'c', P1, INT); reg(E, 'd', Q, INS); }));
  ok('A7 interessada ≠ inscrita; inscrição ≠ realização', r.porSit.interessada === 1 && r.porSit.inscrita === 1 && r.realizou === 0);
  r = calc(cenario((E) => { E.interesse.c = {}; }));
  ok('A8 lista de espera não existe para o painel (só turmas-interesse conta)', r.porSit.inscrita === 0);
}

console.log('\n== B. ausência é da turma; pendência é da pessoa ==');
{
  let r = calc(cenario((E) => { reg(E, 'a', P1, INS); outro(E, 'a', ['2026-09-01', '2026-09-02']); reg(E, 'b', P1, INS); pres(E, 'b', ['2026-10-06', '2026-10-07'], P1); }));
  ok('B1 faltou na A e realizou na B: realizou, conta 1 vez', r.realizou === 1 && r.porSit.realizou === 1);
  ok('B2 a ausência da A continua registrada e conta como recuperada', r.ausencias.ocorrencias === 1 && r.ausencias.recuperadas === 1 && r.ausencias.pendentes === 0);
  r = calc(cenario((E) => { reg(E, 'a', P1, INS); outro(E, 'a', ['2026-09-01', '2026-09-02']); reg(E, 'c', P1, INS); }));
  ok('B3 faltou e se reinscreveu: pendente como inscrita; a falta não soma às pendências', r.porSit.inscrita === 1 && r.pendentes === 4 && r.ausencias.pendentesComNovaInscricao === 1);
  r = calc(cenario((E) => { reg(E, 'a', P1, INS); reg(E, 'b', P1, INS); outro(E, 'a', ['2026-09-01', '2026-09-02']); outro(E, 'b', ['2026-10-06', '2026-10-07']); }));
  ok('B4 duas ausências: 2 ocorrências, 1 pessoa', r.ausencias.ocorrencias === 2 && r.ausencias.pessoas === 1);
  ok('B5 ausência por turma listada', r.ausenciasPorTurma.length === 2);
}

console.log('\n== C. histórico de inscrições removidas ==');
{
  let r = calc(cenario((E) => { reg(E, 'a', P1, Object.assign({ removed: true, removedDate: '2026-09-10T12:00:00Z' }, INS)); outro(E, 'a', ['2026-09-01', '2026-09-02']); }));
  ok('C1 removida DEPOIS da turma: a ausência continua no histórico', r.ausencias.ocorrencias === 1);
  r = calc(cenario((E) => { reg(E, 'a', P1, Object.assign({ removed: true, removedDate: '2026-09-10T12:00:00Z' }, INS)); pres(E, 'a', ['2026-09-01', '2026-09-02'], P1); }));
  ok('C2 removida depois e com presença: a realização vale (e é sinalizada)', r.realizou === 1 && r.qualidade.realizacoesComInscricaoRemovida === 1);
  r = calc(cenario((E) => { reg(E, 'a', P1, Object.assign({ removed: true, removedDate: '2026-08-20T12:00:00Z' }, INS)); outro(E, 'a', ['2026-09-01', '2026-09-02']); }));
  ok('C3 removida ANTES do primeiro encontro: não é falta', r.ausencias.ocorrencias === 0);
  r = calc(cenario((E) => { reg(E, 'a', P1, Object.assign({ removed: true }, INS)); outro(E, 'a', ['2026-09-01', '2026-09-02']); }));
  ok('C4 removida sem data: histórico incerto, nem falta nem realização', r.ausencias.ocorrencias === 0 && r.realizou === 0 && r.qualidade.historicoIncerto === 1);
}

console.log('\n== D. check-in por pessoa ==');
{
  let r = calc(cenario((E) => { reg(E, 'a', P1, INS); }));
  ok('D1 turma encerrada sem nenhum check-in: não verificável (nem realizou nem faltou)', r.realizou === 0 && r.ausencias.ocorrencias === 0 && r.qualidade.naoVerificaveisPendentes === 1 && r.qualidade.turmasSemRegistro.length === 1);
  r = calc(cenario((E) => { reg(E, 'a', P1, INS); pres(E, 'a', ['2026-09-01'], P1); }));
  ok('D2 2º dia sem NENHUM registro: não vira frequência insuficiente', r.ausencias.frequenciaInsuficiente === 0 && r.qualidade.naoVerificaveisPendentes === 1 && r.qualidade.turmasParciais.length === 1);
  r = calc(cenario((E) => { reg(E, 'a', P1, INS); pres(E, 'a', ['2026-09-01'], P1); outro(E, 'a', ['2026-09-02']); }));
  ok('D3 dia registrado sem ela: frequência insuficiente confirmada (50% < 75%)', r.ausencias.frequenciaInsuficiente === 1);
  r = calc(cenario((E) => { E.eventos.evT.percentualMinimo = 50; reg(E, 'a', P1, INS); pres(E, 'a', ['2026-09-01'], P1); outro(E, 'a', ['2026-09-02']); }));
  ok('D4 usa a frequência mínima do EVENTO (50%: realizou)', r.realizou === 1);
  r = calc(cenario((E) => { reg(E, 'a', P1, INS); pres(E, 'a', ['2026-09-01', '2026-09-02'], P1); delete E.config.a; }));
  ok('D5 turma que já passou sem estar encerrada: não gera realização e pede encerramento', r.realizou === 0 && r.qualidade.turmasPassadasAbertas.length === 1);
  r = calc(cenario((E) => { reg(E, 'a', P1, INT); pres(E, 'a', ['2026-09-01', '2026-09-02'], P1); }));
  ok('D6 interesse sem confirmação não comprova participação, nem com presença', r.realizou === 0);
}

console.log('\n== E. ocupação operacional × pessoas únicas ==');
{
  let r = calc(cenario((E) => { reg(E, 'c', P1, INS); reg(E, 'd', P1, INS); }));
  const tc = r.turmas.find((t) => t.key === 'c'), td = r.turmas.find((t) => t.key === 'd');
  ok('E1 inscrita em duas turmas: as duas vagas ocupadas na operação', tc.ocupacao === 1 && td.ocupacao === 1 && r.vagasLivres === 18);
  ok('E2 e conta UMA pessoa no potencial', r.potencial === 1);
  ok('E3 a segunda vaga aparece como presa por duplicidade', r.vagasPresas === 1);
  r = calc(cenario((E) => { reg(E, 'c', 'fora@previ.com.br', INS); reg(E, 'c', Q, INT); }));
  ok('E4 inscrito de fora da base e interessado ocupam vaga (10 − 2 = 8 livres na C)', r.turmas.find((t) => t.key === 'c').livres === 8);
  r = calc(cenario((E) => { for (let i = 0; i < 12; i++) reg(E, 'c', 'x' + i + '@previ.com.br', INS); }));
  ok('E5 turma acima da lotação: alerta, nenhuma vaga livre', r.alertas.some((a) => a.tipo === 'turma-acima-da-lotacao') && r.turmas.find((t) => t.key === 'c').livres === 0);
  r = calc(cenario((E) => { E.turmas.c.vagas = 1; E.turmas.d.vagas = 1; }));
  ok('E6 máximo nas planejadas usa as vagas de verdade (2 vagas → 2 pessoas, 2 de déficit)', r.maxPlanejado === 2 && r.deficitVagas === 2);
}

console.log('\n== F. elegibilidade real ==');
{
  let r = calc(cenario((E) => { E.gerentes[k(P1)] = { email: P1 }; E.gerentes[k(Q)] = { email: Q }; }));
  ok('F1 gestores não cabem em turma de técnicos', r.cap.gestores.maximo === 0 && r.cap.tecnicos.maximo === 2);
  r = calc(cenario((E) => { E.turmas.c.publicoRestrito = true; E.turmas.d.publicoRestrito = true; E.turmasPublico.c = { [k(P1)]: true }; }));
  ok('F2 lista da turma: só quem está nela é alocado', r.maxPlanejado === 1);
  r = calc(cenario((E) => { E.eventos.evT.publicoRestrito = true; E.eventosPublico.evT = { [k(Q)]: true }; }));
  ok('F3 lista do evento', r.maxPlanejado === 1);
  r = calc(cenario((E) => { E.eventos.evT.publicoDesc = ''; E.eventos.evT.restritoADiretores = true; E.diretores[k(R2)] = { email: R2 }; }));
  ok('F4 só diretores (evento sem cargo)', r.maxPlanejado === 1);
  r = calc(cenario((E) => { E.eventos.evT.restritoADiretores = true; E.diretores[k(R2)] = { email: R2 }; }));
  ok('F4b "só técnicos" + "só diretores": ninguém entra (com os públicos ativados, diretor não é técnico — igual ao site)', r.maxPlanejado === 0);
  r = calc(cenario((E) => { E.eventos.evT.bloqueiaParticipantesDe = { evX: true }; E.turmas.x = { label: 'X', eventoKey: 'evX', dias: ['2026-10-20'] }; reg(E, 'x', P1, INT); }));
  ok('F5 participação anterior bloqueia a vaga', r.maxPlanejado === 3);
  r = calc(cenario((E) => { E.turmas.d.publicoCargo = 'gerentes'; }));
  ok('F6 público da turma contradiz o do evento: ninguém entra, alerta', r.turmas.find((t) => t.key === 'd').valida === false && r.alertas.some((a) => a.tipo === 'turma-publico-conflito'));
}

console.log('\n== G. turmas que mudam ==');
{
  let r0 = calc(cenario());
  let r = calc(cenario((E) => { E.config.c = { cancelamento: { motivo: 'outro', em: 'x' } }; }));
  ok('G1 turma cancelada sai da capacidade futura', r.turmas.find((t) => t.key === 'c').valida === false && r.vagasLivres === r0.vagasLivres - 10);
  r = calc(cenario((E) => { E.turmas.e = { label: 'E', eventoKey: 'evT', dias: ['2026-12-07', '2026-12-08'], horarioInicio: '14:00', horarioFim: '18:00' }; }));
  ok('G2 nova turma válida entra sozinha', r.vagasLivres === r0.vagasLivres + 10);
  r = calc(cenario((E) => { E.turmas.c.vagas = 3; }));
  ok('G3 vagas alteradas mudam os indicadores', r.vagasLivres === r0.vagasLivres - 7);
  r = calc(cenario((E) => { E.turmas.d.dias = ['2026-12-14', '2026-12-15']; }));
  ok('G4 turma movida para depois do prazo deixa de somar vagas, mas ocupa o calendário', r.turmas.find((t) => t.key === 'd').valida === false && r.vagasLivres === r0.vagasLivres - 10);
  r = calc(cenario((E) => { E.programa.prazo = '2026-11-30'; }));
  ok('G5 prazo mudou: turma que termina depois sai da conta', r.turmas.find((t) => t.key === 'd').valida === false);
  r = calc(cenario((E) => { E.hoje = '2026-11-25'; reg(E, 'c', P1, INS); outro(E, 'c', ['2026-11-24']); }));
  ok('G6 turma em andamento: não recebe ninguém novo; quem já faltou demais sai do potencial', r.turmas.find((t) => t.key === 'c').livres === 0 && r.potencial === 0);
  r = calc(cenario((E) => { E.programa.eventos = { evG: true }; }));
  ok('G7 evento fora do programa não entra', r.turmas.length === 0);
}

console.log('\n== H. calendário e simultaneidade ==');
{
  const ut = N.diasUteis('2026-11-16', '2026-11-27', { '2026-11-20': 'feriado' });
  ok('H1 dias úteis: sem sábado, domingo e dia indisponível', ut.length === 9 && ut.indexOf('2026-11-20') === -1 && ut.indexOf('2026-11-21') === -1);
  let r = calc(cenario((E) => { E.calendario = { '2026-11-20': { motivo: 'Consciência Negra' } }; }));
  ok('H2 nenhum encontro simulado em dia indisponível', !r.cap.tecnicos.turmasAbrir.some((t) => t.indexOf('2026-11-20') !== -1) && r.uteis.indexOf('2026-11-20') === -1);
  r = calc(cenario((E) => { E.programa.antecedenciaDiasUteis = 5; }));
  ok('H3 antecedência: nenhuma turma nova antes da primeira data possível', r.primeiraData === '2026-11-16' && r.uteis[0] === '2026-11-16');
  ok('H4 nenhuma turma simulada termina depois do prazo', r.cap.tecnicos.turmasAbrir.every((t) => t[t.length - 1] <= '2026-12-11'));
  /* simultaneidade: duas turmas de técnicos já às 9h em 24–25/11 → nenhuma terceira às 9h nesses dias */
  const janela = (E) => { E.hoje = '2026-11-23'; E.programa.prazo = '2026-11-25'; E.turmas.c2 = { label: 'C2', eventoKey: 'evT', dias: ['2026-11-24', '2026-11-25'], horarioInicio: '09:00', horarioFim: '13:00' }; for (let i = 0; i < 40; i++) E.base.pessoas['z' + i] = { email: 'z' + i + '@previ.com.br', diretoria: 'D3', gerencia: 'G9' }; };
  r = calc(cenario(janela));
  ok('H5 terceira turma de técnicos no mesmo horário é recusada', r.cap.tecnicos.cabem === 0, r.cap.tecnicos);
  r = calc(cenario((E) => { janela(E); E.programa.formatos = { tecnicos: { encontros: 2, horarioInicio: '13:00', horarioFim: '17:00', vagas: 10 } }; }));
  ok('H6 horários que só se encostam (13h/13h) não são simultâneos: 2 turmas novas à tarde', r.cap.tecnicos.cabem === 2, r.cap.tecnicos);
  r = calc(cenario((E) => { E.turmas.g1 = { label: 'G1', eventoKey: 'evG', dias: ['2026-11-24', '2026-11-25'], horarioInicio: '09:00', horarioFim: '13:00' }; E.gerentes[k(P1)] = {}; E.gerentes[k(Q)] = {}; for (let i = 0; i < 12; i++) { E.base.pessoas['g' + i] = { email: 'g' + i + '@previ.com.br', diretoria: 'D3', gerencia: 'G9' }; E.gerentes['g' + i] = {}; } }));
  ok('H7 segunda turma de gestores sobreposta é recusada', !r.cap.gestores.turmasAbrir.some((t) => t.indexOf('2026-11-24') !== -1 || t.indexOf('2026-11-25') !== -1) && r.cap.gestores.abrir > 0);
  r = calc(cenario((E) => { delete E.turmas.c.horarioInicio; delete E.turmas.c.horarioFim; }));
  ok('H8 turma sem horário ocupa o dia todo e gera aviso', r.alertas.some((a) => a.tipo === 'turma-sem-horario'));
  r = calc(cenario((E) => { E.turmas.c3 = { label: 'C3', eventoKey: 'evT', dias: ['2026-11-24'], horarioInicio: '09:00', horarioFim: '13:00' }; E.turmas.c4 = { label: 'C4', eventoKey: 'evT', dias: ['2026-11-24'], horarioInicio: '10:00', horarioFim: '12:00' }; }));
  ok('H9 turmas já planejadas acima do limite: alerta, sem descartar', r.alertas.some((a) => a.tipo === 'paralelismo-excedido') && r.turmas.some((t) => t.key === 'c4' && t.valida));
  r = calc(cenario((E) => { E.turmas = {}; E.config = {}; }));
  ok('H10 sem turma-modelo nem formato: turmas necessárias = indeterminado, não zero', r.cap.tecnicos.necessarias === null && r.indeterminado === true);
  /* programação dinâmica exata = força bruta, e nunca abaixo do guloso */
  const bruta = (cap, n, lim) => {
    const S = cap.length - n + 1; if (S < 1) return 0; let best = 0; const x = new Array(S).fill(0);
    (function rec(i) {
      if (i === S) { for (let d = 0; d < cap.length; d++) { let s = 0; for (let st = Math.max(0, d - n + 1); st <= Math.min(d, S - 1); st++) s += x[st]; if (s > cap[d]) return; } best = Math.max(best, x.reduce((a, b) => a + b, 0)); return; }
      for (let v = 0; v <= lim; v++) { x[i] = v; rec(i + 1); } x[i] = 0;
    })(0);
    return best;
  };
  let semente = 7, iguais = 0, total = 0, nuncaAbaixo = true;
  const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
  for (let c = 0; c < 300; c++) {
    const L = 3 + Math.floor(rnd() * 7), n = 1 + Math.floor(rnd() * 3), lim = 1 + Math.floor(rnd() * 2);
    const cap = Array.from({ length: L }, () => Math.floor(rnd() * (lim + 1)));
    const dp = N.maximoDeJanelas(cap, n, lim), bf = bruta(cap, n, lim), gu = N.gulosoJanelas(cap, n, lim);
    total++; if (dp.total === bf) iguais++; if (dp.total < gu.total) nuncaAbaixo = false;
    /* o plano devolvido respeita a capacidade de cada dia */
    const uso = cap.map(() => 0); dp.inicios.forEach((s) => { for (let d = s; d < s + n; d++) uso[d]++; });
    if (uso.some((u, d) => u > cap[d]) || dp.inicios.length !== dp.total) { iguais = -9999; }
  }
  ok('H11 encaixe exato = força bruta em 300 calendários sorteados, com plano válido', iguais === total, iguais + '/' + total);
  ok('H12 encaixe exato nunca abaixo do guloso', nuncaAbaixo);
}

console.log('\n== I. diagnóstico, expansão, conferências e decisões ==');
{
  const grande = (E) => { for (let i = 0; i < 120; i++) E.base.pessoas['z' + i] = { email: 'z' + i + '@previ.com.br', diretoria: i < 60 ? 'D3' : 'D4', gerencia: 'G' + (i % 3) }; };
  let r = calc(cenario(grande));
  ok('I1 projeções em ordem e nunca acima do público', r.realizou + r.potencial <= r.realizou + r.maxPlanejado && r.maxPlanejado <= r.maxExpansao && r.realizou + r.maxExpansao <= r.N);
  ok('I2 capacidade insuficiente detectada', r.fatores.capacidade === true);
  ok('I3 déficit de calendário = necessárias − a abrir, nunca negativo', ['tecnicos', 'gestores'].every((g) => r.cap[g].deficitCalendario === null || (r.cap[g].deficitCalendario >= 0 && r.cap[g].deficitCalendario === r.cap[g].necessarias - r.cap[g].abrir)));
  r = calc(cenario((E) => { grande(E); E.programa.prazo = '2026-11-13'; }));
  ok('I4 prazo curto: calendário insuficiente vira o impedimento principal', r.fatores.calendario && r.principal === 'calendario' && r.combinado);
  const dm = r.decisoes.find((d) => d.tipo === 'prazo');
  ok('I5 o texto da decisão usa os mesmos números do resultado', dm && dm.texto.indexOf(String(r.N - r.realizou - r.maxExpansao)) !== -1);
  ok('I6 no máximo três decisões', r.decisoes.length <= 3);
  r = calc(cenario((E) => { Object.keys(E.base.pessoas).forEach((x) => { E.base.pessoas[x].diretoria = 'UNICA'; }); delete E.users[k(P1)]; }));
  ok('I7 uma diretoria só não quebra (decisão de mobilização)', r.decisoes.some((d) => d.tipo === 'mobilizar'));
  r = calc(cenario((E) => { delete E.users[k(P1)]; delete E.users[k(Q)]; }));
  const mob = r.decisoes.find((d) => d.tipo === 'mobilizar');
  const top2 = r.diretorias.slice().sort((a, b) => b.semMobilizacao - a.semMobilizacao).slice(0, 2), soma2 = top2[0].semMobilizacao + top2[1].semMobilizacao, total = r.porSit['sem-cadastro'] + r.porSit['sem-engajamento'];
  const esperado = soma2 + ' delas (' + (Math.round(soma2 / total * 1000) / 10).toFixed(1).replace('.', ',') + '%)';
  ok('I8 o número e o percentual de diretorias na decisão de mobilização saem da mesma tabela', mob && mob.texto.indexOf(esperado) !== -1, mob && mob.texto + ' × ' + esperado);
  ok('I9 gerência com menos de 5 pessoas fica agrupada', r.diretorias.every((d) => d.gerencias.every((g) => g.total >= 5 || g.agrupada)));
  r = calc(cenario((E) => { delete E.programa.prazo; }));
  ok('I10 sem prazo: pendência de configuração, sem número inventado', r.pendencias.indexOf('prazo') !== -1 && r.uteis.length === 0);
  r = calc(cenario((E) => { E.base.pessoas = {}; }));
  ok('I11 base vazia: pendência, não zero válido', r.pendencias.indexOf('base') !== -1 && r.N === 0);
  r = calc(cenario((E) => { reg(E, 'a', P1, INS); reg(E, 'a', Q, INS); reg(E, 'a', R2, INS); }));
  ok('I12 não verificáveis ≥ 1 p.p. disparam o alerta executivo', r.qualidade.alertaExecutivo === true);
}

console.log('\n== K. margem e composição do público ==');
{
  const grande = (E) => { for (let i = 0; i < 40; i++) E.base.pessoas['z' + i] = { email: 'z' + i + '@previ.com.br', diretoria: 'D3', gerencia: 'G1' }; };
  const r0 = calc(cenario(grande));
  let r = calc(cenario((E) => { grande(E); E.programa.margem = 6; }));
  ok('K1 meta = público − margem; faltam = meta − realizados', r.meta === r.N - 6 && r.margem === 6 && r.faltamParaMeta === r.meta - r.realizou);
  ok('K2 a margem reduz o déficit que as turmas extras cobrem', r.cap.tecnicos.deficitMeta === r0.cap.tecnicos.deficitVagas - 6 && r.cap.tecnicos.margemUsada === 6, [r.cap.tecnicos.deficitMeta, r0.cap.tecnicos.deficitVagas]);
  ok('K3 o déficit para 100% continua o mesmo (só a meta muda)', r.deficitVagas === r0.deficitVagas);
  r = calc(cenario((E) => { E.programa.margem = 999; }));
  ok('K4 margem maior que o público fica limitada ao público', r.margem === r.N && r.meta === 0);
  r = calc(cenario((E) => { E.turmas.c.vagas = 1; E.turmas.d.vagas = 1; E.programa.margem = 2; }));
  ok('K5 com a margem cobrindo o déficit, capacidade deixa de ser impedimento e nenhuma turma extra é pedida', r.deficitVagas === 2 && r.fatores.capacidade === false && r.cap.tecnicos.necessarias === 0);
  r = calc(cenario((E) => { E.programa.composicao = { total: 82, situacaoInativa: 6, cargoIncompativel: 72 }; }));
  ok('K6 composição que fecha (6 + 72 + 4 = 82)', r.composicao && r.composicao.fecha === true && !r.alertas.some((a) => a.tipo === 'composicao-nao-fecha'));
  r = calc(cenario((E) => { E.programa.composicao = { total: 81, situacaoInativa: 6, cargoIncompativel: 72 }; }));
  ok('K7 composição que não fecha: alerta com a diferença', r.composicao.fecha === false && r.composicao.diferenca === -1 && r.alertas.some((a) => a.tipo === 'composicao-nao-fecha'));
  r = calc(cenario());
  ok('K8 sem total configurado, nenhuma conferência; sem margem, meta = público', r.composicao === null && r.margem === 0 && r.meta === r.N);
}

console.log('\n== J. prévia da importação da base ==');
{
  const linhas = [
    { nome: 'Ana', email: 'ana@previ.com.br', gerencia: 'gecon', diretoria: 'dirad' },
    { nome: 'Bia', email: 'BIA@previ.com.br', gerencia: 'GERAT', diretoria: 'DISEG' },
    { nome: 'Ana', email: 'ana2@previ.com.br', gerencia: 'GEPRO', diretoria: 'DIPLA' },
    { nome: 'Caio', email: 'ana@previ.com.br', gerencia: 'X', diretoria: 'Y' },
    { nome: 'Dani', email: 'dani@adcmflex.com.br', gerencia: 'INFOR', diretoria: 'DISEG' },
    { nome: 'Eva', email: 'sem-arroba', gerencia: 'X', diretoria: 'Y' },
    { nome: 'Fabi', email: '', gerencia: 'X', diretoria: 'Y' }
  ];
  const pr = N.previaBase(linhas, { users: { [k('ana@previ.com.br')]: {} }, gerentes: { [k('bia@previ.com.br')]: {} }, outrosPublicos: { [k('ana2@previ.com.br')]: {} }, facilitadores: { [k('dani@adcmflex.com.br')]: 'dani@adcmflex.com.br' }, vigente: { pessoas: { [k('ana@previ.com.br')]: { email: 'ana@previ.com.br', nome: 'Ana', gerencia: 'GECON', diretoria: 'DIRAD' }, [k('zz@previ.com.br')]: { email: 'zz@previ.com.br' } } } });
  ok('J1 e-mail repetido, inválido e vazio apontados, sem excluir os válidos', pr.validas === 4 && pr.problemas.emailRepetido.length === 1 && pr.problemas.emailInvalido.length === 1 && pr.problemas.semEmail.length === 1);
  ok('J2 e-mail fora de @previ sinalizado (não corrigido)', pr.problemas.foraDoDominio.length === 1 && pr.pessoas[k('dani@adcmflex.com.br')]);
  ok('J3 nome repetido com e-mails diferentes sinalizado', pr.problemas.nomeRepetido.length === 1);
  ok('J4 gestores pela lista de Gerentes; técnicos o resto', pr.gestores === 1 && pr.tecnicos === 3);
  ok('J5 quem está em Outros públicos aparece para conferência', pr.outrosPublicos.length === 1);
  ok('J6 facilitadores na base saem do público efetivo', pr.facilitadoresNaBase.length === 1 && pr.publicoEfetivo === 3);
  ok('J7 diferença para a versão vigente (entram, saem, mudam)', pr.diferenca.entram.length === 3 && pr.diferenca.saem.length === 1 && pr.diferenca.mudam.length === 0);
  ok('J8 sigla em maiúsculas, e-mail em minúsculas', pr.pessoas[k('ana@previ.com.br')].diretoria === 'DIRAD' && pr.pessoas[k('bia@previ.com.br')].email === 'bia@previ.com.br');
}

console.log('\n' + oks + ' ok, ' + falhas + ' falha(s)');
process.exit(falhas ? 1 : 0);
