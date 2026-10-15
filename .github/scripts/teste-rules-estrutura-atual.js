/* ═════════════════════════════════════════════════════════════════
   Regras do banco — ESTRUTURA ORGANIZACIONAL ATUAL. Roda contra o EMULADOR real do Realtime Database (teste-rules.yml)
   com o database.rules.json de produção. As gravações são as que o código real monta (estrutura-atual-nucleo.js:
   operação → payload multipath). Prova, pelo BANCO:
   A. Marcador próprio: ausente = DESLIGADO (ninguém grava); só o admin geral o muda, com motivo e auditoria; o
      marcador da Análise Organizacional NÃO libera nada aqui.
   B. LIBERADO: gravam admin geral e Avaliação + Configuração; Avaliação só lê; sem perfil e sem login, nada.
   C. Unidade: revisão + 1 (gravação velha recusada), horário do servidor, autoria do token, criação fixa.
   D. Superior: inexistente, encerrada, ela mesma ou ciclo (payload forjado, sem passar pelo núcleo) — recusados.
   E. CONCORRÊNCIA REAL: duas pessoas leem o mesmo estado e mandam, ao mesmo tempo, mudanças válidas sozinhas que
      juntas formariam um ciclo (2 e 3 unidades): só uma entra e a hierarquia gravada continua sem ciclo; duas
      edições da mesma unidade a partir da mesma revisão: só uma entra.
   F. Encerramento: com subordinada ativa é recusado (inclusive criar subordinada e encerrar ao mesmo tempo, nas
      duas ordens); encerrada é final; nada se apaga; histórico só de acréscimo.
   G. Índice de subordinadas: entrada forjada, entrada faltando ou removida de unidade ativa — recusadas.
   H. Voltar a DESLIGADO: nada é apagado; a leitura continua; a gravação para.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');
const N = require(path.join(RAIZ, 'forca-agil', 'estrutura-atual-nucleo.js'));

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_');
const SUPER = 'tatianefdirene@previ.com.br', ADMIN = 'admin.geral@previ.com.br', ARQ = 'arquitetura@previ.com.br', AVAL = 'avaliacao@previ.com.br', SEM = 'sem.acesso@previ.com.br';
const TS = { '.sv': 'timestamp' };
const js = (v) => JSON.parse(JSON.stringify(v));
let seq = 0;
const chave = (p) => p + '-' + (++seq);
const ctxDe = (e, novoId) => ({ novoId, auditoriaId: chave('aud'), usuario: { uid: emailKey(e), email: e }, agora: Date.now() });

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-estrutura-atual', database: { rules } });
  const db = (e) => (e ? env.authenticatedContext(emailKey(e), { email: e }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  const up = (e, w) => db(e).ref().update(js(w));
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'NEGADO: ' + String(e.message || e).slice(0, 200)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi ACEITO'); } }
  const estado = async () => ({ unidades: (await ler(N.NOS.unidades)) || {} });
  /* estado atual → núcleo → payload (o mesmo caminho da tela) */
  function payloadDe(r) { if (!r.ok) throw new Error('núcleo recusou: ' + JSON.stringify(r.erro)); return N.payload(r, TS); }
  async function criar(e, id, dados, est) { return payloadDe(N.criarUnidade(est || await estado(), dados, ctxDe(e, id))); }
  async function superior(e, id, sup, est) { return payloadDe(N.mudarSuperior(est || await estado(), id, sup, {}, ctxDe(e))); }
  const habilitar = async (e, nova, motivo) => {
    const atual = (await ler(N.NOS.config + '/habilitacao')) || 'DESLIGADO';
    const r = N.payloadHabilitacao(atual, nova, motivo || 'Teste', ctxDe(e), TS);
    return up(e, r.payload);
  };
  const semCiclo = async () => { const est = await estado(); return Object.keys(est.unidades).every((k) => N.ancestrais(est, k).indexOf(k) === -1); };

  await semear(async (a) => {
    await a.ref('fa-admins/' + emailKey(ADMIN)).set(true);
    await a.ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).set({ tipo: 'avaliacao-arquitetura' });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).set({ tipo: 'avaliacao' });
  });
  const GECON = { nome: 'Gerência de Contabilidade e Controladoria', sigla: 'GECON', nivel: 'gerencia', fonte: 'Regimento (dado fictício de teste)', vigenciaInicio: '2026-01-01' };
  const NUC = (sigla, nome) => ({ nome, sigla, nivel: 'nucleo', superiorId: 'gecon' });

  console.log('A. Marcador próprio (ausente = DESLIGADO)');
  await nega('marcador ausente: Avaliação + Configuração não cria unidade', up(ARQ, await criar(ARQ, 'gecon', GECON)));
  await nega('marcador ausente: nem o admin geral cria unidade', up(ADMIN, await criar(ADMIN, 'gecon', GECON)));
  await semear(async (a) => { await a.ref('analises-organizacionais-config').set({ habilitacao: 'LIBERADO_PARA_PERFIS_AUTORIZADOS' }); });
  await nega('o marcador da Análise Organizacional LIBERADO não libera a Estrutura Atual', up(ARQ, await criar(ARQ, 'gecon', GECON)));
  await nega('Avaliação + Configuração não muda o marcador', habilitar(ARQ, 'LIBERADO'));
  const semAud = N.payloadHabilitacao('DESLIGADO', 'LIBERADO', 'x', ctxDe(SUPER), TS).payload; delete semAud[N.NOS.configAuditoria + '/' + Object.keys(semAud).find((k) => k.indexOf(N.NOS.configAuditoria) === 0).split('/')[1]];
  await nega('marcador sem auditoria: recusado', up(SUPER, semAud));
  await pode('admin geral libera, com motivo e auditoria', habilitar(SUPER, 'LIBERADO', 'Homologação no emulador'));
  const audCfg = await ler(N.NOS.configAuditoria);
  anota('auditoria do marcador: anterior DESLIGADO → LIBERADO, com motivo', Object.keys(audCfg).length === 1 && audCfg[Object.keys(audCfg)[0]].anterior === 'DESLIGADO' && audCfg[Object.keys(audCfg)[0]].motivo === 'Homologação no emulador');

  console.log('B. LIBERADO: quem grava e quem lê');
  await nega('Avaliação (só consulta) não cria', up(AVAL, await criar(AVAL, 'gecon', GECON)));
  await nega('sem perfil não cria', up(SEM, await criar(SEM, 'gecon', GECON)));
  await pode('Avaliação + Configuração cria a GECON', up(ARQ, await criar(ARQ, 'gecon', GECON)));
  for (const [id, s, n] of [['nutes', 'NUTES', 'Núcleo de Tesouraria'], ['conta', 'CONTA', 'Núcleo de Contabilidade'], ['nutri', 'NUTRI', 'Núcleo Tributário'], ['nucot', 'NUCOT', 'Núcleo de Controle']]) {
    await pode('cria ' + s + ' subordinado à GECON (pela ficha da superior)', up(id === 'nucot' ? ADMIN : ARQ, await criar(id === 'nucot' ? ADMIN : ARQ, id, NUC(s, n))));
  }
  anota('índice: as 4 subordinadas ativas da GECON', Object.keys((await ler(N.NOS.filhos + '/gecon')) || {}).sort().join() === 'conta,nucot,nutes,nutri');
  await pode('Avaliação lê as unidades', db(AVAL).ref(N.NOS.unidades).once('value'));
  await pode('Avaliação lê o histórico', db(AVAL).ref(N.NOS.auditoria).once('value'));
  await nega('sem perfil não lê as unidades', db(SEM).ref(N.NOS.unidades).once('value'));
  await nega('sem login não lê', db(null).ref(N.NOS.unidades).once('value'));
  const outro = { nome: 'Comitê de teste', nivel: 'outro' };
  anota('núcleo: nível "Outro" exige o texto', N.criarUnidade(await estado(), outro, ctxDe(ARQ, 'x1')).erro.codigo === 'NIVEL_OUTRO_OBRIGATORIO');
  const wOutro = await criar(ARQ, 'comite', Object.assign({ nivelOutro: 'Comitê' }, outro)); delete wOutro[N.NOS.unidades + '/comite'].nivelOutro;
  await nega('banco: nível "Outro" sem o texto, recusado', up(ARQ, wOutro));
  const wNivel = await criar(ARQ, 'comite', { nome: 'X', nivel: 'nucleo' }); wNivel[N.NOS.unidades + '/comite'].nivel = 'linha';
  await nega('banco: nível fora da lista do domínio (ex.: tipo arquitetural), recusado', up(ARQ, wNivel));

  console.log('C. Revisão, horário e autoria');
  const est1 = await estado();
  const alt = N.alterarUnidade(est1, 'conta', { nome: 'Núcleo de Contabilidade Geral', sigla: 'CONTA', nivel: 'nucleo' }, ctxDe(ARQ));
  const wAlt = N.payload(alt, TS);
  const wVelha = js(wAlt); wVelha[N.NOS.unidades + '/conta'].revisao = 1;
  await nega('revisão que não é anterior + 1: recusada', up(ARQ, wVelha));
  const wHora = js(wAlt); wHora[N.NOS.unidades + '/conta'].atualizadaEm = Date.now();
  await nega('horário do cliente: recusado', up(ARQ, wHora));
  const wAutor = js(wAlt); wAutor[N.NOS.unidades + '/conta'].atualizadaPor = { uid: emailKey(ADMIN), email: ADMIN };
  await nega('autoria de outra pessoa: recusada', up(ARQ, wAutor));
  const wCriada = js(wAlt); wCriada[N.NOS.unidades + '/conta'].criadaEm = 1;
  await nega('data de criação alterada: recusada', up(ARQ, wCriada));
  const wSemAud = js(wAlt); Object.keys(wSemAud).filter((k) => k.indexOf(N.NOS.auditoria) === 0).forEach((k) => delete wSemAud[k]);
  await nega('gravação sem o evento de histórico: recusada', up(ARQ, wSemAud));
  await pode('edição válida (revisão 2, com histórico)', up(ARQ, wAlt));
  await nega('a mesma gravação reenviada (revisão velha): recusada', up(ARQ, wAlt));

  console.log('D. Superior: inexistente, ela mesma, ciclo forjado');
  const est2 = await estado();
  const base = (id, sup) => { const r = N.alterarUnidade(est2, id, Object.assign({}, est2.unidades[id], { fonte: 'forjada ' + (++seq) }), ctxDe(ARQ)); const w = N.payload(r, TS); w[N.NOS.unidades + '/' + id].superiorId = sup; return w; };
  await nega('superior inexistente: recusada', up(ARQ, Object.assign(base('nutri', 'nao-existe'), { [N.NOS.filhos + '/nao-existe/nutri']: true, [N.NOS.filhos + '/gecon/nutri']: null })));
  await nega('superior = ela mesma: recusada', up(ARQ, Object.assign(base('gecon', 'gecon'), { [N.NOS.filhos + '/gecon/gecon']: true })));
  await nega('ciclo direto forjado (GECON subordinada à CONTA, que é dela): recusado', up(ARQ, Object.assign(base('gecon', 'conta'), { [N.NOS.filhos + '/conta/gecon']: true })));
  anota('núcleo: o mesmo ciclo é recusado antes de gravar', N.mudarSuperior(est2, 'gecon', 'conta', {}, ctxDe(ARQ)).erro.codigo === 'CICLO_NA_HIERARQUIA');

  console.log('E. Concorrência real: ciclos e edições simultâneas');
  await pode('cria a Diretoria A (raiz)', up(ARQ, await criar(ARQ, 'dir-a', { nome: 'Diretoria A (teste)', nivel: 'diretoria' })));
  await pode('cria a Diretoria B (raiz)', up(ADMIN, await criar(ADMIN, 'dir-b', { nome: 'Diretoria B (teste)', nivel: 'diretoria' })));
  const mesmo = await estado();
  const w1 = await superior(ARQ, 'dir-a', 'dir-b', mesmo), w2 = await superior(ADMIN, 'dir-b', 'dir-a', mesmo);
  anota('núcleo: no estado lido, cada mudança sozinha é válida', !!w1 && !!w2);
  const r12 = await Promise.allSettled([up(ARQ, w1), up(ADMIN, w2)]);
  anota('duas mudanças simultâneas A→B e B→A: só uma entra', r12.filter((x) => x.status === 'fulfilled').length === 1, r12.map((x) => x.status).join());
  anota('a hierarquia gravada continua sem ciclo', await semCiclo());
  /* ciclo de 3: X ← Y (Y subordinada a X); ao mesmo tempo, X → Z e Z → Y */
  await pode('cria X', up(ARQ, await criar(ARQ, 'x', { nome: 'Unidade X (teste)', nivel: 'gerencia' })));
  await pode('cria Y subordinada a X', up(ARQ, await criar(ARQ, 'y', { nome: 'Unidade Y (teste)', nivel: 'nucleo', superiorId: 'x' })));
  await pode('cria Z', up(ARQ, await criar(ARQ, 'z', { nome: 'Unidade Z (teste)', nivel: 'gerencia' })));
  const mesmo3 = await estado();
  const wa = await superior(ARQ, 'x', 'z', mesmo3), wb = await superior(ADMIN, 'z', 'y', mesmo3);
  const r3 = await Promise.allSettled([up(ARQ, wa), up(ADMIN, wb)]);
  anota('ciclo de três unidades por duas mudanças simultâneas: só uma entra', r3.filter((x) => x.status === 'fulfilled').length === 1, r3.map((x) => x.status).join());
  anota('a hierarquia gravada continua sem ciclo (3 unidades)', await semCiclo());
  /* nas duas ordens, sequenciais, a partir do mesmo estado lido: a segunda é sempre recusada */
  await pode('cria P', up(ARQ, await criar(ARQ, 'p', { nome: 'P (teste)', nivel: 'gerencia' })));
  await pode('cria Q', up(ARQ, await criar(ARQ, 'q', { nome: 'Q (teste)', nivel: 'gerencia' })));
  const mesmoPQ = await estado();
  const wp = await superior(ARQ, 'p', 'q', mesmoPQ), wq = await superior(ADMIN, 'q', 'p', mesmoPQ);
  await pode('P → Q entra', up(ARQ, wp));
  await nega('Q → P, calculado no estado antigo, é recusado pelo servidor (veria o ciclo)', up(ADMIN, wq));
  const mesmoEd = await estado();
  const e1 = N.payload(N.alterarUnidade(mesmoEd, 'nutes', { nome: 'Núcleo de Tesouraria (1)', sigla: 'NUTES', nivel: 'nucleo' }, ctxDe(ARQ)), TS);
  const e2 = N.payload(N.alterarUnidade(mesmoEd, 'nutes', { nome: 'Núcleo de Tesouraria (2)', sigla: 'NUTES', nivel: 'nucleo' }, ctxDe(ADMIN)), TS);
  const rEd = await Promise.allSettled([up(ARQ, e1), up(ADMIN, e2)]);
  anota('duas edições simultâneas da mesma unidade, mesma revisão: só uma entra', rEd.filter((x) => x.status === 'fulfilled').length === 1, rEd.map((x) => x.status).join());
  anota('a unidade fica com a revisão 2 e o histórico com dois eventos (criação + a edição que entrou)', (await ler(N.NOS.unidades + '/nutes/revisao')) === 2 && Object.keys(await ler(N.NOS.auditoria + '/nutes')).length === 2);

  console.log('F. Encerramento');
  const estF = await estado();
  anota('núcleo: encerrar a GECON com subordinadas ativas é recusado', N.encerrarUnidade(estF, 'gecon', { motivo: 'teste' }, ctxDe(ARQ)).erro.codigo === 'TEM_SUBORDINADAS_ATIVAS');
  const forjada = js(estF); forjada.unidades = Object.assign({}, forjada.unidades); ['nutes', 'conta', 'nutri', 'nucot'].forEach((k) => delete forjada.unidades[k]);
  const wEncG = N.payload(N.encerrarUnidade(forjada, 'gecon', { motivo: 'forjado' }, ctxDe(ARQ)), TS);
  await nega('banco: encerrar a GECON com subordinadas ativas (payload forjado) é recusado', up(ARQ, wEncG));
  anota('núcleo: encerrar exige motivo', N.encerrarUnidade(estF, 'nucot', {}, ctxDe(ARQ)).erro.codigo === 'MOTIVO_OBRIGATORIO');
  const wEncSemMotivo = N.payload(N.encerrarUnidade(estF, 'nucot', { motivo: 'x' }, ctxDe(ARQ)), TS); delete wEncSemMotivo[N.NOS.unidades + '/nucot'].encerramento;
  await nega('banco: encerrada sem o registro de encerramento, recusada', up(ARQ, wEncSemMotivo));
  /* criar subordinada e encerrar ao mesmo tempo, a partir do mesmo estado: as duas ordens */
  await pode('cria W (sem subordinadas)', up(ARQ, await criar(ARQ, 'w', { nome: 'W (teste)', nivel: 'gerencia' })));
  const estW = await estado();
  const wEncW = N.payload(N.encerrarUnidade(estW, 'w', { motivo: 'Unidade extinta' }, ctxDe(ARQ)), TS);
  const wSubW = await criar(ADMIN, 'w1', { nome: 'W1 (teste)', nivel: 'nucleo', superiorId: 'w' }, estW);
  await pode('encerrar W entra', up(ARQ, wEncW));
  await nega('criar subordinada de W (calculado antes) é recusado: superior encerrada', up(ADMIN, wSubW));
  await pode('cria V', up(ARQ, await criar(ARQ, 'v', { nome: 'V (teste)', nivel: 'gerencia' })));
  const estV = await estado();
  const wSubV = await criar(ADMIN, 'v1', { nome: 'V1 (teste)', nivel: 'nucleo', superiorId: 'v' }, estV);
  const wEncV = N.payload(N.encerrarUnidade(estV, 'v', { motivo: 'Unidade extinta' }, ctxDe(ARQ)), TS);
  await pode('criar subordinada de V entra', up(ADMIN, wSubV));
  await nega('encerrar V (calculado antes) é recusado: agora tem subordinada ativa', up(ARQ, wEncV));
  const estW2 = await estado();
  const wDepois = N.payload(N.alterarUnidade(js(Object.assign({}, estW2, { unidades: Object.assign({}, estW2.unidades, { w: Object.assign({}, estW2.unidades.w, { situacao: 'ativa' }) }) })), 'w', { nome: 'W reaberta', nivel: 'gerencia' }, ctxDe(ARQ)), TS);
  delete wDepois[N.NOS.unidades + '/w'].encerramento;
  await nega('encerrada é final: não volta a ativa nem muda', up(ARQ, wDepois));
  await nega('nada se apaga: remover uma unidade é recusado', db(SUPER).ref(N.NOS.unidades + '/nucot').remove());
  const audK = Object.keys(await ler(N.NOS.auditoria + '/gecon'))[0];
  await nega('histórico só de acréscimo: alterar um evento é recusado', db(SUPER).ref(N.NOS.auditoria + '/gecon/' + audK + '/tipo').set('alteracao'));

  console.log('G. Índice de subordinadas');
  await nega('entrada forjada (unidade que não é subordinada): recusada', db(ARQ).ref(N.NOS.filhos + '/gecon/dir-a').set(true));
  await nega('remover a entrada de uma subordinada ativa: recusado', db(ARQ).ref(N.NOS.filhos + '/gecon/conta').remove());
  const wSemIdx = await criar(ARQ, 'nusem', NUC('NUSEM', 'Núcleo sem índice')); delete wSemIdx[N.NOS.filhos + '/gecon/nusem'];
  await nega('subordinada nova sem a entrada no índice: recusada', up(ARQ, wSemIdx));
  const estG = await estado();
  const wMov = N.payload(N.mudarSuperior(estG, 'nucot', 'dir-b', { motivo: 'Reorganização (teste)' }, ctxDe(ARQ)), TS);
  const wMovSuja = js(wMov); delete wMovSuja[N.NOS.filhos + '/gecon/nucot'];
  await nega('mudar de superior deixando a entrada antiga no índice: recusado', up(ARQ, wMovSuja));
  await pode('mudar de superior (sai de um índice, entra no outro, mesmo evento)', up(ARQ, wMov));
  anota('índice atualizado: NUCOT sob a Diretoria B, fora da GECON', (await ler(N.NOS.filhos + '/dir-b/nucot')) === true && (await ler(N.NOS.filhos + '/gecon/nucot')) === null);

  console.log('H. Voltar a DESLIGADO');
  await pode('admin geral desliga, com motivo', habilitar(ADMIN, 'DESLIGADO', 'Fim da homologação'));
  await nega('DESLIGADO: Avaliação + Configuração não grava mais', up(ARQ, N.payload(N.alterarUnidade(await estado(), 'conta', { nome: 'Outro nome', nivel: 'nucleo' }, ctxDe(ARQ)), TS)));
  await pode('DESLIGADO: a leitura continua (nada foi apagado)', db(AVAL).ref(N.NOS.unidades + '/gecon').once('value'));
  anota('as unidades continuam no banco', Object.keys(await ler(N.NOS.unidades)).length >= 10);

  await env.cleanup();
  console.log('\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
