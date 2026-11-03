/* Níveis de Gerentes (fa-gerentes/<chave>/nivel = 'executivo' | 'nucleo'; ausente = Não informado) e os públicos
 * "Gerentes executivos" e "Gerentes de núcleo". Uma lista só (a aba Gerentes), um nível por pessoa, nada deduzido.
 * Firebase falso (escritas em window.__ESCRITAS), desktop e 375 px. As regras do banco têm a mesma prova no emulador
 * (teste-rules-inscricoes.js, seção G) e a tabela, no núcleo (teste-publicos-nucleo.js, seção N).
 *
 * O QUE ELE EXIGE:
 *   1. aba Gerentes: a coluna Nível, o resumo por nível e quantos estão sem classificação (Não informado);
 *   2. filtro por nível (executivo, núcleo, Não informado) e a exportação com o nível e quem o definiu;
 *   3. nível individual: confirma antes; Cancelar não grava e volta o seletor; Confirmar grava SÓ o nível (com quando e
 *      quem), sem mexer em turma nenhuma;
 *   4. lote: o resumo antes de gravar separa quem passa para o nível, quem já tem OUTRO nível (só muda marcando), quem já
 *      está nele e quem não está na lista de Gerentes (nada é gravado para eles); gravar só o que o resumo disse;
 *   5. adicionar gerentes já com um nível (padrão: Não informado);
 *   6. regras de entrada (faTurmasUtil.regrasDeEntrada, a mesma das portas do painel e do card): "Gerentes executivos" e
 *      "Gerentes de núcleo" só admitem o próprio nível; Não informado e técnico ficam fora; "Gerentes" abrange os três;
 *      "Técnicos" não muda; "Executivos" continua só descrição; a mensagem do ADMIN diz o nível atual;
 *   7. a vitrine (página Turmas) da gerente de núcleo mostra a turma do nível dela e esconde a do outro nível; o
 *      "Ver esta tela como" da admin mostra o mesmo;
 *   8. quem já estava numa turma de nível e mudou de nível continua nela (o painel só sinaliza "Fora do público atual");
 *   9. 375 px: a aba (resumo, filtro, tabela e o resumo do lote) cabe sem rolagem lateral da página;
 *  10. nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br';
const GEX = 'gerente.executivo@previ.com.br', GNU = 'gerente.nucleo@previ.com.br', GNI = 'gerente.semnivel@previ.com.br';
const GNI2 = 'outro.semnivel@previ.com.br', TEC = 'tecnica@previ.com.br', MUDOU = 'mudou.nivel@previ.com.br';
const NOMES = { [ADM]: 'ADMIN', [GEX]: 'GERENTE EXECUTIVO', [GNU]: 'GERENTE NUCLEO', [GNI]: 'GERENTE SEM NIVEL', [GNI2]: 'OUTRO SEM NIVEL', [TEC]: 'TECNICA UM', [MUDOU]: 'MUDOU DE NIVEL' };
const reg = (e, extra) => Object.assign({ email: e, name: NOMES[e], addedAt: '2026-10-22T10:00:00.000Z' }, extra || {});

function banco() {
  const users = {};
  Object.keys(NOMES).forEach((e) => { users[chave(e)] = { name: NOMES[e], email: e, area: 'INFOR' }; });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-gerentes': {
      [chave(GEX)]: reg(GEX, { nivel: 'executivo', nivelEm: '2026-10-30T10:00:00.000Z', nivelPorNome: 'ADMIN' }),
      [chave(GNU)]: reg(GNU, { nivel: 'nucleo' }), [chave(GNI)]: reg(GNI), [chave(GNI2)]: reg(GNI2),
      /* estava como executivo, entrou na turma de executivos e virou núcleo depois */
      [chave(MUDOU)]: reg(MUDOU, { nivel: 'nucleo' })
    },
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {}, 'publicos-config': { ativo: true },
    eventos: {
      evGex: { nome: 'EPISÓDIO EXECUTIVOS', order: 1, publicado: true, cargaHoraria: '3', esperaAtiva: false, publicoDesc: 'Gerentes executivos' },
      evGnu: { nome: 'EPISÓDIO NÚCLEO', order: 2, publicado: true, cargaHoraria: '3', esperaAtiva: false, publicoDesc: 'Gerentes de núcleo' },
      evGer: { nome: 'EPISÓDIO GERENTES', order: 3, publicado: true, cargaHoraria: '3', esperaAtiva: false, publicoDesc: 'Gerentes' },
      evTec: { nome: 'EPISÓDIO TÉCNICOS', order: 4, publicado: true, cargaHoraria: '3', esperaAtiva: false, publicoDesc: 'Técnicos' },
      evExe: { nome: 'EPISÓDIO EXECUTIVOS DESCRIÇÃO', order: 5, publicado: true, cargaHoraria: '3', esperaAtiva: false, publicoDesc: 'Executivos' }
    },
    turmas: {
      tGex: { label: 'TURMA EXECUTIVOS', eventoKey: 'evGex', order: 1, dias: ['2027-11-03'] },
      tGnu: { label: 'TURMA NUCLEO', eventoKey: 'evGnu', order: 2, dias: ['2027-11-04'] },
      tGer: { label: 'TURMA GERENTES', eventoKey: 'evGer', order: 3, dias: ['2027-11-05'] },
      tTec: { label: 'TURMA TECNICOS', eventoKey: 'evTec', order: 4, dias: ['2027-11-06'] },
      tExe: { label: 'TURMA EXECUTIVOS DESCRICAO', eventoKey: 'evExe', order: 5, dias: ['2027-11-07'] }
    },
    /* a gerente de núcleo tem interesse na turma de Gerentes (é o que a põe no seletor do "Ver como") */
    'turmas-interesse': { tGer: { [chave(GNU)]: { name: NOMES[GNU], email: GNU, area: 'INFOR', status: 'interessado', removed: false, date: '2026-10-26T10:00:00.000Z' } }, tGex: { [chave(MUDOU)]: { name: NOMES[MUDOU], email: MUDOU, area: 'INFOR', status: 'inscrito', confirmedByAdmin: ADM, removed: false, date: '2026-10-25T10:00:00.000Z' } } },
    'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

async function abrir(browser, email, hash, opt) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }, opt || {}));
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 15 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const lerNo = (page, no) => page.evaluate((n) => firebase.database().ref(n).once('value').then((s) => s.val()), no);
const gravouEm = (page, prefixo) => page.evaluate((p) => (window.__ESCRITAS || []).filter((e) => e.path.indexOf(p) === 0 || (e.path === '' && Object.keys(e.valor || {}).some((k) => k.indexOf(p) === 0))).length, prefixo);

async function abaGerentes(page) {
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => x.textContent.trim() === 'Gerentes'), null, { limite: 15000, descricao: 'a aba Gerentes' });
  await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => x.textContent.trim() === 'Gerentes').click());
  await esperarCondicao(page, () => !!document.querySelector('#adminGerentes [data-gerentes-resumo]'), null, { limite: 15000, descricao: 'o resumo da aba Gerentes' });
}
const resumo = (page) => page.evaluate(() => { const r = document.querySelector('#adminGerentes [data-gerentes-resumo]');
  return { ex: +r.querySelector('[data-conta="executivo"]').textContent, nu: +r.querySelector('[data-conta="nucleo"]').textContent, sem: +r.querySelector('[data-conta="sem"]').textContent, txt: r.textContent }; });
const linhas = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#adminGerentes tbody tr')).map((tr) => ({ email: tr.children[1].textContent, nivel: tr.querySelector('.gerentes-nivel-sel').value })));
async function filtrar(page, v) {
  await page.selectOption('#gerentesFiltro', v);
  /* render() relê e redesenha: espera a tabela já filtrada */
  await esperarCondicao(page, (x) => { const sels = Array.from(document.querySelectorAll('#adminGerentes .gerentes-nivel-sel'));
    return (document.getElementById('gerentesFiltro') || {}).value === x && sels.length > 0 && (x === 'todos' ? sels.length >= 5 : sels.every((q) => q.value === x)); }, v, { limite: 10000, descricao: 'o filtro ' + v });
}
async function conferirLote(page, emails, nivel) {
  /* a aba já redesenhada (depois de uma gravação, o resumo antigo some com o render novo) */
  await esperarCondicao(page, () => !!document.querySelector('#gerentesLoteResumo[hidden]'), null, { limite: 10000, descricao: 'a aba pronta para o lote' });
  await page.fill('#gerentesLoteEmails', emails.join('\n'));
  await page.selectOption('#gerentesLoteNivel', nivel);
  await page.click('#gerentesLoteConferirBtn');
  await esperarCondicao(page, () => !!document.querySelector('#gerentesLoteResumo:not([hidden]) #gerentesLoteGravar'), null, { limite: 8000, descricao: 'o resumo do lote' });
  return page.evaluate(() => { const r = document.getElementById('gerentesLoteResumo'); const n = (k) => r.querySelectorAll('[data-lote="' + k + '"] li').length;
    return { muda: n('muda'), outro: n('outro'), igual: n('igual'), fora: n('fora'), txt: r.textContent }; });
}
/* regras de entrada pela função única (as portas do painel e o card usam esta) */
const entrada = (page, email, turma) => page.evaluate(([k, t, ev]) => new Promise((res) => window.faTurmasUtil.regrasDeEntrada({ eventoKey: ev, eKey: k, turmaKey: t }, (r) => res(r))),
  [chave(email), turma, { tGex: 'evGex', tGnu: 'evGnu', tGer: 'evGer', tTec: 'evTec', tExe: 'evExe' }[turma]]);

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  try {
    /* ── ADMIN, desktop ─────────────────────────────────────────────────── */
    const A = await abrir(browser, ADM, '#admin');
    const page = A.page;
    await abaGerentes(page);
    const r1 = await resumo(page), l1 = await linhas(page);
    anota('1. resumo por nível e quantos estão sem classificação', r1.ex === 1 && r1.nu === 2 && r1.sem === 2 && /Sem classificação \(Não informado\): 2/.test(r1.txt), JSON.stringify(r1));
    anota('1. a coluna Nível mostra o nível de cada um (ausente = Não informado)',
      l1.length === 5 && l1.find((x) => x.email === GEX).nivel === 'executivo' && l1.find((x) => x.email === GNU).nivel === 'nucleo' && l1.find((x) => x.email === GNI).nivel === '', JSON.stringify(l1));

    /* 2. filtro e exportação */
    await filtrar(page, 'nucleo');
    const lNu = await linhas(page);
    await filtrar(page, '');
    const lSem = await linhas(page);
    anota('2. filtro por nível: núcleo e Não informado', lNu.length === 2 && lNu.every((x) => x.nivel === 'nucleo') && lSem.length === 2 && lSem.every((x) => x.nivel === ''), JSON.stringify({ lNu, lSem }));
    await filtrar(page, 'todos');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#gerentesExportBtn')]);
    const arq = path.join(os.tmpdir(), 'ger-' + process.pid + '.csv'); await dl.saveAs(arq);
    const csv = fs.readFileSync(arq, 'utf8').replace(/^﻿/, ''); fs.unlinkSync(arq);
    const cab = csv.split(/\r?\n/)[0].split(';');
    anota('2. exportação com Nível e quem o definiu', cab.indexOf('Nível') !== -1 && cab.indexOf('Nível definido por') !== -1 &&
      /gerente\.executivo@previ\.com\.br;Gerente executivo/.test(csv) && /gerente\.semnivel@previ\.com\.br;Não informado/.test(csv), csv.slice(0, 300));

    /* 3. nível individual — Cancelar e Confirmar */
    const antesTurmas = await gravouEm(page, 'turmas-interesse');
    const sel = (e) => '#adminGerentes .gerentes-nivel-sel[data-key="' + chave(e) + '"]';
    await page.selectOption(sel(GNI), 'executivo');
    await esperarCondicao(page, () => Array.from(document.querySelectorAll('.modal-box')).some((b) => /Mudar o nível de GERENTE SEM NIVEL/.test(b.textContent)), null, { limite: 8000, descricao: 'a confirmação do nível' });
    const txtConf = await page.evaluate(() => Array.from(document.querySelectorAll('.modal-box')).find((b) => /Mudar o nível/.test(b.textContent)).textContent);
    await page.evaluate(() => Array.from(document.querySelectorAll('.modal-box')).find((b) => /Mudar o nível/.test(b.textContent)).querySelector('.admin-modal-cancel-btn').click());
    const voltou = await page.$eval(sel(GNI), (s) => s.value);
    anota('3. Cancelar não grava e volta o seletor; a pergunta diz que ninguém sai de turma',
      voltou === '' && (await gravouEm(page, 'fa-gerentes/' + chave(GNI))) === 0 && /Não tira a pessoa de nenhuma turma/.test(txtConf) && /"Não informado" para "Gerente executivo"/.test(txtConf), voltou + ' ' + txtConf);
    await page.selectOption(sel(GNI), 'executivo');
    await esperarCondicao(page, () => Array.from(document.querySelectorAll('.modal-box')).some((b) => /Mudar o nível/.test(b.textContent)), null, { limite: 8000, descricao: 'a confirmação do nível' });
    await page.evaluate(() => Array.from(document.querySelectorAll('.modal-box')).find((b) => /Mudar o nível/.test(b.textContent)).querySelector('.admin-modal-confirm-btn').click());
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === '' ? Object.keys(e.valor || {}).indexOf('fa-gerentes/' + k + '/nivel') !== -1 : e.path === 'fa-gerentes/' + k + '/nivel'), chave(GNI), { limite: 10000, descricao: 'a gravação do nível' });
    const g3 = await lerNo(page, 'fa-gerentes/' + chave(GNI));
    anota('3. Confirmar grava só o nível, com quando e quem; o registro de Gerentes continua; nenhuma turma é tocada',
      g3.nivel === 'executivo' && !!g3.nivelEm && g3.nivelPor === ADM && g3.email === GNI && g3.addedAt === '2026-10-22T10:00:00.000Z' && (await gravouEm(page, 'turmas-interesse')) === antesTurmas, JSON.stringify(g3));
    await esperarCondicao(page, () => !!document.querySelector('#adminGerentes [data-gerentes-resumo]') && +document.querySelector('[data-conta="sem"]').textContent === 1, null, { limite: 10000, descricao: 'o resumo atualizado' });

    /* 4. lote */
    const lote = await conferirLote(page, [GNI2, GNU, GEX, 'nao.existe@previ.com.br', GNI2], 'executivo');
    anota('4. o resumo separa: passa (1), já tem outro nível (1), já está nele (1), fora da lista (1) — sem gravar nada',
      lote.muda === 1 && lote.outro === 1 && lote.igual === 1 && lote.fora === 1 && /nao\.existe@previ\.com\.br/.test(lote.txt) && /hoje: Gerente de núcleo/.test(lote.txt) &&
      (await gravouEm(page, 'fa-gerentes/' + chave(GNI2))) === 0, JSON.stringify(lote));
    await page.click('#gerentesLoteGravar');
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'fa-gerentes/' + k + '/nivel'), chave(GNI2), { limite: 10000, descricao: 'a gravação do lote' });
    const n2 = await lerNo(page, 'fa-gerentes/' + chave(GNI2) + '/nivel'), nNu = await lerNo(page, 'fa-gerentes/' + chave(GNU) + '/nivel');
    anota('4. sem marcar "Trocar também", só quem estava Não informado muda; quem tem outro nível continua; ninguém é criado',
      n2 === 'executivo' && nNu === 'nucleo' && (await lerNo(page, 'fa-gerentes/' + chave('nao.existe@previ.com.br'))) === null, JSON.stringify({ n2, nNu }));
    await esperarCondicao(page, () => /classificado/.test((document.getElementById('gerentesMsg') || {}).textContent || ''), null, { limite: 10000, descricao: 'a mensagem do lote' });
    await conferirLote(page, [GNU], 'executivo');
    await page.check('#gerentesLoteTrocar');
    await page.click('#gerentesLoteGravar');
    await esperarCondicao(page, (k) => firebase.database().ref('fa-gerentes/' + k + '/nivel').once('value').then((v) => v.val() === 'executivo'), chave(GNU), { limite: 10000, descricao: 'a troca do nível' });
    anota('4. marcando "Trocar também", quem tinha outro nível passa para o escolhido (um nível só)', (await lerNo(page, 'fa-gerentes/' + chave(GNU) + '/nivel')) === 'executivo');
    /* volta a gerente de núcleo para o que o resto do teste espera */
    await esperarCondicao(page, () => !!document.querySelector('#gerentesLoteConferirBtn'), null, { limite: 10000, descricao: 'a aba redesenhada' });
    await conferirLote(page, [GNU], 'nucleo');
    await page.check('#gerentesLoteTrocar');
    await page.click('#gerentesLoteGravar');
    await esperarCondicao(page, (k) => firebase.database().ref('fa-gerentes/' + k + '/nivel').once('value').then((s) => s.val() === 'nucleo'), chave(GNU), { limite: 10000, descricao: 'a volta para núcleo' });

    /* 5. adicionar já com nível — depois de a aba terminar de redesenhar (resumo do lote fechado e a mensagem dele) */
    await esperarCondicao(page, () => !!document.querySelector('#gerentesLoteResumo[hidden]') && /classificado/.test((document.getElementById('gerentesMsg') || {}).textContent || ''),
      null, { limite: 10000, descricao: 'a aba redesenhada depois do lote' });
    await page.fill('#gerentesEmails', 'Nova.Nucleo@previ.com.br');
    await page.selectOption('#gerentesNovoNivel', 'nucleo');
    await page.click('#gerentesAddBtn');
    await esperarCondicao(page, () => /adicionado/.test((document.getElementById('gerentesMsg') || {}).textContent || ''), null, { limite: 10000, descricao: 'a mensagem de adicionar' });
    const novo = await lerNo(page, 'fa-gerentes/' + chave('nova.nucleo@previ.com.br'));
    anota('5. adicionar com nível: grava o registro e o nível juntos', novo && novo.email === 'nova.nucleo@previ.com.br' && novo.nivel === 'nucleo' && novo.nivelPor === ADM, JSON.stringify(novo));

    /* 6. regras de entrada */
    const m = {};
    for (const [e, t] of [[GEX, 'tGex'], [GNU, 'tGex'], [GNI2, 'tGnu'], [TEC, 'tGex'], [GNU, 'tGnu'], [GEX, 'tGnu'], [GEX, 'tGer'], [GNU, 'tGer'], [GNI, 'tGer'], [GEX, 'tTec'], [TEC, 'tTec'], [TEC, 'tExe']]) {
      m[e.split('@')[0] + '>' + t] = (await entrada(page, e, t)).estado;
    }
    anota('6. cada nível só no próprio; Não informado e técnico fora; Gerentes abrange; Técnicos e "Executivos" como sempre',
      m['gerente.executivo>tGex'] === 'livre' && m['gerente.nucleo>tGex'] === 'bloqueado' && m['tecnica>tGex'] === 'bloqueado' &&
      m['gerente.nucleo>tGnu'] === 'livre' && m['gerente.executivo>tGnu'] === 'bloqueado' && m['outro.semnivel>tGnu'] === 'bloqueado' &&
      m['gerente.executivo>tGer'] === 'livre' && m['gerente.nucleo>tGer'] === 'livre' && m['gerente.semnivel>tGer'] === 'livre' &&
      m['gerente.executivo>tTec'] === 'bloqueado' && m['tecnica>tTec'] === 'livre' && m['tecnica>tExe'] === 'livre', JSON.stringify(m));
    const msgAdm = await page.evaluate((k) => new Promise((res) => window.faTurmasUtil.regrasDeEntrada({ eventoKey: 'evGex', eKey: k, turmaKey: 'tGex' },
      (r) => res(window.faTurmasUtil.mensagemRegraAdmin(r, 'GERENTE NUCLEO')))), chave(GNU));
    anota('6. a mensagem do ADMIN diz o nível atual e o caminho', /nível "Gerente de núcleo"/.test(msgAdm) && /só para gerentes executivos/.test(msgAdm) && /aba Gerentes/.test(msgAdm), msgAdm);

    /* 8. quem mudou de nível continua na turma; o painel só sinaliza */
    await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click());
    await esperarCondicao(page, () => !!document.querySelector('#turma-card-tGex [data-fora-publico]'), null, { limite: 15000, descricao: 'o selo "Fora do público atual"' });
    const r8 = await lerNo(page, 'turmas-interesse/tGex/' + chave(MUDOU));
    anota('8. mudou de nível: a inscrição continua e o painel só sinaliza "Fora do público atual"', r8.status === 'inscrito' && !r8.removed && (await gravouEm(page, 'turmas-interesse/tGex')) === 0, JSON.stringify(r8));

    /* 7b. "Ver esta tela como" a gerente de núcleo */
    await page.evaluate(() => { location.hash = '#turmas'; });
    await esperarCondicao(page, (em) => Array.from(document.querySelectorAll('.turmas-vercomo .aluno-vercomo-sel option')).some((o) => o.dataset.email === em), GNU, { limite: 15000, descricao: 'a pessoa no "Ver como"' });
    const valor = await page.$eval('.turmas-vercomo .aluno-vercomo-sel', (el, em) => Array.from(el.options).find((o) => o.dataset.email === em).value, GNU);
    await page.selectOption('.turmas-vercomo .aluno-vercomo-sel', valor);
    const rotulos = () => page.evaluate(() => Array.from(document.querySelectorAll('#page-turmas .turma-card-new .tc-label')).map((x) => x.textContent));
    await esperarCondicao(page, () => Array.from(document.querySelectorAll('#page-turmas .turma-card-new .tc-label')).some((x) => x.textContent === 'TURMA NUCLEO') &&
      !Array.from(document.querySelectorAll('#page-turmas .turma-card-new .tc-label')).some((x) => x.textContent === 'TURMA TECNICOS'), null, { limite: 15000, descricao: 'a vitrine como a gerente de núcleo' });
    const vc = await rotulos();
    anota('7. "Ver como" a gerente de núcleo: vê a turma de núcleo e a de Gerentes, não a de executivos nem a de Técnicos',
      vc.indexOf('TURMA NUCLEO') !== -1 && vc.indexOf('TURMA GERENTES') !== -1 && vc.indexOf('TURMA EXECUTIVOS') === -1 && vc.indexOf('TURMA TECNICOS') === -1, JSON.stringify(vc));
    anota('10. admin: nenhum erro de JavaScript', !A.erros.length, A.erros.join(' | '));
    await A.ctx.close();

    /* ── 7. a vitrine da própria pessoa (login dela) ─────────────────────── */
    for (const [quem, ve, naoVe] of [[GNU, 'TURMA NUCLEO', 'TURMA EXECUTIVOS'], [GEX, 'TURMA EXECUTIVOS', 'TURMA NUCLEO'], [GNI, 'TURMA GERENTES', 'TURMA NUCLEO']]) {
      const P = await abrir(browser, quem, '#turmas');
      await esperarCondicao(P.page, (r) => Array.from(document.querySelectorAll('#page-turmas .turma-card-new .tc-label')).some((x) => x.textContent === r), ve, { limite: 15000, descricao: 'a turma ' + ve });
      const rs = await P.page.evaluate(() => Array.from(document.querySelectorAll('#page-turmas .turma-card-new .tc-label')).map((x) => x.textContent));
      const extra = quem === GNI ? rs.indexOf('TURMA EXECUTIVOS') === -1 : true;
      anota('7. vitrine de ' + quem.split('@')[0] + ': vê "' + ve + '", não vê "' + naoVe + '"', rs.indexOf(ve) !== -1 && rs.indexOf(naoVe) === -1 && extra, JSON.stringify(rs));
      if (quem === GNU) {
        const tk = 'tGnu';
        await esperarCondicao(P.page, (k) => { const b = document.querySelector('.btn--interest[data-turma="' + k + '"]'); return !!b && b.style.display !== 'none' && !/Verificando/.test(b.textContent) && !b.disabled; }, tk, { limite: 15000, descricao: 'o botão da turma de núcleo' });
        anota('7. a gerente de núcleo pode manifestar interesse na turma de núcleo', true);
      }
      anota('10. ' + quem.split('@')[0] + ': nenhum erro de JavaScript', !P.erros.length, P.erros.join(' | '));
      await P.ctx.close();
    }

    /* ── 7c. Minha Área: a prévia "Turmas abertas no momento" de quem nunca participou (gerente Não informado; banco novo) ── */
    {
      const M = await abrir(browser, GNI2, '#minha-area');
      await esperarCondicao(M.page, () => !!document.querySelector('.aluno-abertas'), null, { limite: 15000, descricao: 'a prévia da Minha Área' });
      const lista = await M.page.$eval('.aluno-abertas', (e) => e.textContent);
      anota('7. Minha Área de um gerente Não informado: convida para Gerentes, não para os níveis nem para Técnicos',
        /TURMA GERENTES/.test(lista) && !/TURMA NUCLEO/.test(lista) && !/TURMA EXECUTIVOS —/.test(lista) && !/TURMA TECNICOS/.test(lista), lista);
      anota('10. Minha Área: nenhum erro de JavaScript', !M.erros.length, M.erros.join(' | '));
      await M.ctx.close();
    }

    /* ── 9. 375 px ───────────────────────────────────────────────────────── */
    const C = await abrir(browser, ADM, '#admin', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await abaGerentes(C.page);
    await C.page.fill('#gerentesLoteEmails', [GNI, GNU, 'nao.existe@previ.com.br'].join('\n'));
    await C.page.selectOption('#gerentesLoteNivel', 'nucleo');
    await C.page.click('#gerentesLoteConferirBtn');
    await esperarCondicao(C.page, () => !!document.querySelector('#gerentesLoteResumo:not([hidden]) #gerentesLoteGravar'), null, { limite: 8000, descricao: 'o resumo do lote no celular' });
    const med = await C.page.evaluate(() => {
      const larg = window.innerWidth, fora = (el) => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > larg + 1; };
      return { pagina: document.documentElement.scrollWidth <= larg + 1, resumo: !fora(document.querySelector('[data-gerentes-resumo]')), filtro: !fora(document.getElementById('gerentesFiltro')),
        lote: !fora(document.getElementById('gerentesLoteResumo')), gravar: !fora(document.getElementById('gerentesLoteGravar')) };
    });
    anota('9. 375 px: resumo, filtro e o resumo do lote cabem, sem rolagem lateral da página', Object.values(med).every(Boolean), JSON.stringify(med));
    anota('10. 375 px: nenhum erro de JavaScript', !C.erros.length, C.erros.join(' | '));
    await C.ctx.close();
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})();
