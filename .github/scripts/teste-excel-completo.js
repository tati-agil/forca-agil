/* ADMIN › Eventos › "📊 Excel completo": um XLSX com Estado atual, Lista de espera e Histórico. Firebase falso; 1280 e 375 px.
 *
 * O QUE ELE EXIGE:
 *   1. um arquivo só, com as quatro abas nessa ordem; a Visão por pessoa junta inscrição, interesse e fila numa linha só e diz
 *      quem está inscrita e na espera ao mesmo tempo, no mesmo evento ou em outro; quem saiu não conta;
 *   2. Estado atual: interessadas e inscritas de todos os eventos, sem quem saiu, com evento, turma e situação;
 *   3. Lista de espera: só quem aguarda agora, de todos os eventos, com a origem;
 *   4. Histórico: a coluna "Fonte do dado" separa o que foi gravado como histórico do que vem do registro atual; confirmação e
 *      entrada na fila sem linha no histórico aparecem pelo registro, sem linha repetida quando a linha existe;
 *   5. o "↓ Histórico" em CSV continua sem as linhas novas;
 *   6. aba vazia mantém o cabeçalho; falha ao carregar a biblioteca avisa e devolve o botão;
 *   7. nada é gravado; sem rolagem lateral da página; nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br';
const mail = (n) => n + '@previ.com.br';
const pessoa = (n) => ({ name: n.toUpperCase(), email: mail(n), area: 'GECAT' });

function banco(semFila) {
  const interesse = {
    tX: {
      /* confirmada com linha no histórico */
      [chave(mail('ana'))]: { ...pessoa('ana'), status: 'inscrito', confirmedByAdmin: ADM, confirmedByAdminName: 'ADMIN', confirmedDate: '2026-10-02T10:00:00.000Z', removed: false, date: '2026-10-01T10:00:00.000Z' },
      /* ＋ Participante como Inscrita: nada no histórico, só o registro */
      [chave(mail('bia'))]: { ...pessoa('bia'), status: 'inscrito', confirmedByAdmin: ADM, confirmedByAdminName: 'ADMIN', confirmedDate: '2026-10-03T10:00:00.000Z', addedByAdmin: ADM, addedByAdminName: 'ADMIN', removed: false, date: '2026-10-03T10:00:00.000Z' },
      /* removida pelo painel */
      [chave(mail('caio'))]: { ...pessoa('caio'), status: 'interessado', removed: true, removedDate: '2026-10-05T10:00:00.000Z', removedByAdminName: 'ADMIN', removedReason: 'Pediu para sair', date: '2026-10-01T11:00:00.000Z' },
      /* saiu sozinha: a linha está no histórico */
      [chave(mail('duda'))]: { ...pessoa('duda'), status: 'removido', removed: true, removedDate: '2026-10-06T10:00:00.000Z', date: '2026-10-01T12:00:00.000Z' },
      /* interesse sem linha no histórico (registro antigo) */
      [chave(mail('hugo'))]: { ...pessoa('hugo'), status: 'interessado', removed: false, date: '2026-06-01T12:00:00.000Z' }
    },
    tY: { [chave(mail('iris'))]: { ...pessoa('iris'), status: 'interessado', removed: false, date: '2026-10-07T10:00:00.000Z' } }
  };
  const log = {
    tX: {
      [chave(mail('ana'))]: { a: { ...pessoa('ana'), action: 'registrado', date: '2026-10-01T10:00:00.000Z' }, b: { ...pessoa('ana'), action: 'confirmado', date: '2026-10-02T10:00:00.000Z', adminName: 'ADMIN' } },
      [chave(mail('caio'))]: { a: { ...pessoa('caio'), action: 'registrado', date: '2026-10-01T11:00:00.000Z' } },
      [chave(mail('duda'))]: { a: { ...pessoa('duda'), action: 'registrado', date: '2026-10-01T12:00:00.000Z' }, b: { ...pessoa('duda'), action: 'removido', date: '2026-10-06T10:00:00.000Z' } }
    },
    tY: { [chave(mail('iris'))]: { a: { ...pessoa('iris'), action: 'registrado', date: '2026-10-07T10:00:00.000Z' } } }
  };
  const espera = semFila ? {} : {
    /* inscrita na TURMA X (evX) e na fila de outro evento */
    [chave(mail('ana'))]: { 'lista:evY': { ...pessoa('ana'), eventoKey: 'evY', date: '2026-09-05T10:00:00.000Z', removed: false } },
    /* inscrita na TURMA X e na fila do mesmo evento */
    [chave(mail('bia'))]: { 'lista:evX': { ...pessoa('bia'), eventoKey: 'evX', date: '2026-09-06T10:00:00.000Z', removed: false } },
    [chave(mail('elisa'))]: { tX: { ...pessoa('elisa'), eventoKey: 'evX', date: '2026-09-01T10:00:00.000Z', migratedAt: '2026-09-20T10:00:00.000Z', migratedFrom: 'tX', migratedByName: 'ADMIN', motivoEntrada: 'sem_vagas', removed: false } },
    [chave(mail('fabi'))]: { 'lista:evY': { ...pessoa('fabi'), eventoKey: 'evY', date: '2026-09-02T10:00:00.000Z', removed: false } },
    [chave(mail('gabi'))]: { 'lista:evY': { ...pessoa('gabi'), eventoKey: 'evY', date: '2026-09-03T10:00:00.000Z', removed: true, removedBySelf: true, removedDate: '2026-09-04T10:00:00.000Z' } }
  };
  return {
    'fa-users': { [chave(ADM)]: { name: 'ADMIN', email: ADM, area: 'INFOR' } }, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-gerentes': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': espera,
    eventos: { evX: { nome: 'EPISÓDIO X', order: 1, publicado: true, cargaHoraria: '3' }, evY: { nome: 'EPISÓDIO Y', order: 2, publicado: true, cargaHoraria: '3' } },
    turmas: { tX: { label: 'TURMA X', eventoKey: 'evX', order: 1, dias: ['2027-11-03'] }, tY: { label: 'TURMA Y', eventoKey: 'evY', order: 2, dias: ['2027-12-01'] } },
    'turmas-interesse': interesse, 'turmas-interesse-log': log, 'turmas-config': { tX: { finalizada: true } }, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

async function abrir(browser, opt, semFila) {
  const ctx = await browser.newContext({ ...opt, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(semFila), user: { email: ADM, emailVerified: true, uid: 'u-adm' }, delayDefault: 5 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => /Eventos/i.test(x.textContent)), null, { limite: 15000, descricao: 'aba Eventos' });
  await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click());
  await esperarCondicao(page, () => !!document.querySelector('#exportExcelCompletoBtn'), null, { limite: 15000, descricao: 'o botão Excel completo' });
  return { ctx, page, erros };
}

async function baixar(page, seletor, ext) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.evaluate((s) => document.querySelector(s).click(), seletor)]);
  const arq = path.join(os.tmpdir(), 'completo-' + process.pid + '-' + Date.now() + ext);
  await dl.saveAs(arq);
  const b = fs.readFileSync(arq); fs.unlinkSync(arq);
  return { nome: dl.suggestedFilename(), b };
}
const abaJson = (wb, n) => XLSX.utils.sheet_to_json(wb.Sheets[n] || {}, { defval: '' });

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  try {
    for (const [nome, opt] of [
      ['1280 px', { viewport: { width: 1280, height: 800 } }],
      ['375 px', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]
    ]) {
      const { ctx, page, erros } = await abrir(browser, opt, false);
      const escritas = () => page.evaluate(() => (window.__ESCRITAS || []).filter((e) => /^(fa-espera|turmas|eventos)/.test(e.path)).length);
      const antes = await escritas();

      const { nome: arq, b } = await baixar(page, '#exportExcelCompletoBtn', '.xlsx');
      const wb = XLSX.read(b, { type: 'buffer' });
      anota(nome + ': um XLSX com as quatro abas, na ordem', /^forca-agil-excel-completo-\d{4}-\d{2}-\d{2}\.xlsx$/.test(arq) && JSON.stringify(wb.SheetNames) === JSON.stringify(['Visão por pessoa', 'Estado atual', 'Lista de espera', 'Histórico']), arq + ' ' + wb.SheetNames);

      const est = abaJson(wb, 'Estado atual'), fila = abaJson(wb, 'Lista de espera'), hist = abaJson(wb, 'Histórico');
      const emails = (l) => l.map((x) => x['E-mail'].split('@')[0]).join(',');
      const vis = abaJson(wb, 'Visão por pessoa'), v = (n) => vis.find((x) => x['E-mail'] === mail(n)) || {};
      anota(nome + ': Visão por pessoa: uma linha por pessoa, em ordem de nome, sem quem saiu', emails(vis) === 'ana,bia,elisa,fabi,hugo,iris', emails(vis));
      anota(nome + ': inscrita numa turma e na fila de outro evento, na mesma linha', v('ana')['Inscrita em'] === 'EPISÓDIO X › TURMA X' && v('ana')['Na lista de espera de'] === 'EPISÓDIO Y (Entrou pela lista)' && v('ana')['Inscrita e na espera?'] === 'Sim, em eventos diferentes', JSON.stringify(v('ana')));
      anota(nome + ': inscrita e na fila do mesmo evento', v('bia')['Inscrita e na espera?'] === 'Sim, no mesmo evento', JSON.stringify(v('bia')));
      anota(nome + ': só na fila, ou interessada e na fila, não é apontada', v('elisa')['Inscrita e na espera?'] === 'Não' && v('elisa')['Na lista de espera de'] === 'EPISÓDIO X (TURMA X)' && v('iris')['Interessada em'] === 'EPISÓDIO Y › TURMA Y' && v('iris')['Inscrita e na espera?'] === 'Não', JSON.stringify([v('elisa'), v('iris')]));
      anota(nome + ': Estado atual traz todos os eventos, sem quem saiu', emails(est) === 'ana,bia,hugo,iris', emails(est));
      const ana = est[0] || {};
      anota(nome + ': a linha identifica evento, turma, situação e confirmação',
        ana.Evento === 'EPISÓDIO X' && ana.Turma === 'TURMA X' && ana['Data da turma'] === '03/11/2027' && ana['Situação da turma'] === 'Inscrições encerradas' && ana['Situação'] === 'Inscrita' && ana['Registrado por'] === 'Participante' && ana['Confirmado por'] === 'ADMIN' && !!ana['Data da confirmação'], JSON.stringify(ana));
      anota(nome + ': interessada aparece como Interessada; adição pelo painel mostra quem adicionou',
        est.find((x) => x['E-mail'] === mail('iris'))['Situação'] === 'Interessada' && est.find((x) => x['E-mail'] === mail('bia'))['Registrado por'] === 'Admin — ADMIN');

      anota(nome + ': Lista de espera só com quem aguarda, de todos os eventos', emails(fila) === 'bia,elisa,ana,fabi', emails(fila));
      const fe = fila.find((x) => x['E-mail'] === mail('elisa')) || {}, ff = fila.find((x) => x['E-mail'] === mail('fabi')) || {};
      anota(nome + ': a fila mostra evento, origem e situação',
        fe.Evento === 'EPISÓDIO X' && fe.Origem === 'TURMA X' && fe['Situação'] === 'Aguardando' && !!fe['Data remoção'] && ff.Evento === 'EPISÓDIO Y' && ff.Origem === 'Entrou pela lista' && ff['Data remoção'] === '', JSON.stringify(fila));

      const de = (n, acao) => hist.filter((x) => x['E-mail'] === mail(n) && x['Ação'] === acao);
      anota(nome + ': confirmação com linha no histórico não se repete', de('ana', 'Confirmado como inscrita').length === 1 && de('ana', 'Confirmado como inscrita')[0]['Fonte do dado'] === 'Linha do histórico');
      anota(nome + ': confirmação sem linha vem do registro, e diz isso', de('bia', 'Confirmado como inscrita').length === 1 && de('bia', 'Confirmado como inscrita')[0]['Fonte do dado'] === 'Registro da turma' && de('bia', 'Confirmado como inscrita')[0]['Responsável'] === 'Admin — ADMIN');
      anota(nome + ': interesse sem linha vem do registro; com linha não se repete', de('hugo', 'Interesse registrado').length === 1 && de('hugo', 'Interesse registrado')[0]['Fonte do dado'] === 'Registro da turma' && de('ana', 'Interesse registrado').length === 1 && de('bia', 'Interesse registrado').length === 0);
      anota(nome + ': remoção pelo painel e saída da própria pessoa', de('caio', 'Removido da turma').length === 1 && de('caio', 'Removido da turma')[0].Motivo === 'Pediu para sair' && de('duda', 'Interesse removido').length === 1 && de('duda', 'Removido da turma').length === 0);
      anota(nome + ': entrada na fila vem do registro da fila, com responsável quando há', de('elisa', 'Entrou na lista de espera').length === 1 && de('elisa', 'Entrou na lista de espera')[0]['Fonte do dado'] === 'Registro da fila' && de('elisa', 'Entrou na lista de espera')[0]['Responsável'] === 'Admin — ADMIN' && de('fabi', 'Entrou na lista de espera')[0]['Responsável'] === 'Participante');
      anota(nome + ': saída da fila aparece junto da entrada, sob o evento certo', de('gabi', 'Entrou na lista de espera').length === 1 && de('gabi', 'Saiu da lista de espera').length === 1 && de('gabi', 'Saiu da lista de espera')[0].Evento === 'EPISÓDIO Y' && de('gabi', 'Saiu da lista de espera')[0]['Responsável'] === 'Participante');
      anota(nome + ': toda linha do Histórico tem evento e fonte', hist.length > 0 && hist.every((x) => x.Evento && x['Fonte do dado']), JSON.stringify(hist.filter((x) => !x.Evento || !x['Fonte do dado'])));

      /* o CSV antigo não muda: mesmas colunas, sem as linhas novas */
      const btnCsv = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes('Histórico') && x.textContent.includes('↓')); b.id = 'csvHist'; return !!b; });
      const csv = (await baixar(page, '#csvHist', '.csv')).b.toString('utf8');
      anota(nome + ': o "↓ Histórico" em CSV continua igual', btnCsv && csv.split('\r\n')[0].replace(/^﻿/, '') === 'Turma;Data da turma;Horário;Sala;Público;Nome;E-mail;Área;Data;Hora;Ação;Origem;Motivo;Destino' && !csv.includes('Entrou na lista de espera') && !csv.includes(mail('hugo')) && csv.includes('Saiu da lista de espera'), csv.slice(0, 200));

      anota(nome + ': nada foi gravado; o botão volta ao normal; sem rolagem lateral',
        (await escritas()) === antes && await page.evaluate(() => { const x = document.querySelector('#exportExcelCompletoBtn'); return !x.disabled && x.textContent.includes('Excel completo') && document.documentElement.scrollWidth <= window.innerWidth + 1; }));
      anota(nome + ': nenhum erro de JavaScript', !erros.length, erros.join(' | '));
      await ctx.close();
    }

    /* fila vazia: a aba existe, só com o cabeçalho */
    {
      const { ctx, page } = await abrir(browser, { viewport: { width: 1280, height: 800 } }, true);
      const wb = XLSX.read((await baixar(page, '#exportExcelCompletoBtn', '.xlsx')).b, { type: 'buffer' });
      const lin = XLSX.utils.sheet_to_json(wb.Sheets['Lista de espera'], { header: 1 });
      anota('fila vazia: a aba Lista de espera existe, só com o cabeçalho', lin.length === 1 && lin[0][0] === 'Evento' && lin[0].includes('Nome'), JSON.stringify(lin));
      await ctx.close();
    }

    /* a biblioteca não carrega (rede ruim): avisa, sem ficar em "Gerando…" */
    {
      const { ctx, page } = await abrir(browser, { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }, false);
      await page.route('**/xlsx.mini.min.js*', (r) => r.abort());
      await page.evaluate(() => document.querySelector('#exportExcelCompletoBtn').click());
      await esperarCondicao(page, () => !document.querySelector('#exportExcelCompletoBtn').disabled, null, { limite: 15000, descricao: 'o botão de volta' });
      const t = await page.evaluate(() => document.body.innerText.includes('Não foi possível gerar o arquivo agora') && document.querySelector('#exportExcelCompletoBtn').textContent.includes('Excel completo'));
      anota('falha ao carregar a biblioteca: avisa e devolve o botão', t);
      await ctx.close();
    }
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})();
