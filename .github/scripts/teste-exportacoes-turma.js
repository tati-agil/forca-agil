/* Exportações por turma do painel (Estado atual, ↓ CSV da turma, Histórico, Sorteios) e o cabeçalho da turma.
 *
 * Toda exportação por turma traz, logo depois de "Turma", as colunas da turma: Data da turma, Horário, Sala e Público
 * (o "Quem participa" do evento; vazio no evento = Empregados). A frequência sai como "1 de 2 (50%)" — antes era "1/2",
 * que o Excel abria como DATA (1º de fevereiro). O cabeçalho da turma no painel mostra também o horário e o público.
 * Roda com o Firebase falso; baixa os arquivos de verdade e lê o CSV. Só desktop (fluxo de admin; o cabeçalho em 375 px
 * é conferido por imagem no PR).
 *
 * O QUE ELE EXIGE:
 *   1. "Estado atual": colunas da turma depois de "Turma", valores certos, público padrão "Empregados", e a frequência
 *      "1 de 2 (50%)" (nunca "1/2");
 *   2. "↓ CSV" da turma: as mesmas colunas e a frequência no mesmo formato;
 *   3. "Histórico": as colunas da turma em cada linha;
 *   4. "Sorteios": as colunas da turma sorteada;
 *   5. o cabeçalho da turma no painel mostra horário e público;
 *   6. nenhum erro de JavaScript não tratado. */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { esperarSessaoAssentada } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br', P1 = 'presente@previ.com.br';
const COLS = ['Turma', 'Data da turma', 'Horário', 'Sala', 'Público'];

function banco() {
  const users = { [chave(ADM)]: { name: 'ADMIN', email: ADM, area: 'INFOR' }, [chave(P1)]: { name: 'PRESENTE UM', email: P1, area: 'GECAT' } };
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-gerentes': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      evX: { nome: 'EPISÓDIO X', order: 1, publicado: true, cargaHoraria: '3', esperaAtiva: false, publicoDesc: 'Gerentes' },
      evY: { nome: 'EPISÓDIO Y', order: 2, publicado: true, cargaHoraria: '3', esperaAtiva: false }
    },
    turmas: {
      tX: { label: 'TURMA X', eventoKey: 'evX', order: 1, dias: ['2027-11-05', '2027-11-03'], horarioInicio: '09:30', horarioFim: '12:00', sala: 'Sala de Treinamento GETHO' },
      tY: { label: 'TURMA Y', eventoKey: 'evY', order: 2, dias: ['2027-12-01'] }
    },
    'turmas-interesse': {
      tX: { [chave(P1)]: { name: 'PRESENTE UM', email: P1, area: 'GECAT', status: 'inscrito', confirmedByAdmin: ADM, removed: false, date: '2026-10-20T10:00:00.000Z' } },
      tY: { [chave(P1)]: { name: 'PRESENTE UM', email: P1, area: 'GECAT', status: 'interessado', removed: false, date: '2026-10-21T10:00:00.000Z' } }
    },
    'turmas-interesse-log': { tX: { [chave(P1)]: { l1: { name: 'PRESENTE UM', email: P1, area: 'GECAT', action: 'registrado', date: '2026-10-20T10:00:00.000Z' } } } },
    'turmas-config': { tX: { finalizada: true } },
    'turmas-checkin': { tX: { '2027-11-03': { [chave(P1)]: { name: 'PRESENTE UM', source: 'qr' } } } },
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'turmas-sorteio': { tX: { s1: { ganhadores: [{ name: 'PRESENTE UM', email: P1 }], quando: '2026-10-22T10:00:00.000Z', sorteadoPorNome: 'ADMIN' } } },
    avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

/* CSV do painel: separador ";", aspas duplas, BOM UTF-8 */
function lerCsv(texto) {
  const linhas = [], s = texto.replace(/^﻿/, '');
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (aspas) { if (c === '"' && s[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c; continue; }
    if (c === '"') aspas = true;
    else if (c === ';') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); }
  const cab = linhas.shift() || [];
  return { cab, linhas: linhas.map((l) => Object.fromEntries(cab.map((h, i) => [h, l[i]]))) };
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (linha, ok, detalhe) => { if (ok) console.log('  ok    ' + linha); else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); } };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
    await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'u-adm' }, delayDefault: 20 }) + ';');
    await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
    await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**fonts.gstatic.com**', (r) => r.abort());
    await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
    await esperarSessaoAssentada(page);
    const baixar = async (clicar) => {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), clicar()]);
      const arq = path.join(os.tmpdir(), 'exp-' + process.pid + '-' + Date.now() + '.csv');
      await dl.saveAs(arq);
      const t = fs.readFileSync(arq, 'utf8'); fs.unlinkSync(arq);
      return lerCsv(t);
    };
    const comecaComColunas = (cab) => JSON.stringify(cab.slice(0, 5)) === JSON.stringify(COLS);
    const valoresX = (l) => l['Data da turma'] === '03/11/2027, 05/11/2027' && l['Horário'] === '09:30–12:00' && l['Sala'] === 'Sala de Treinamento GETHO' && l['Público'] === 'Gerentes';

    await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)); if (b) b.click(); });
    await page.waitForSelector('#turma-card-tX', { state: 'attached', timeout: 15000 });

    /* 5. cabeçalho */
    const hdr = await page.$eval('#turma-card-tX .turma-admin-title', (e) => e.textContent.replace(/\s+/g, ' '));
    anota('5. o cabeçalho da turma mostra horário e público', /9h30/.test(hdr) && /12h/.test(hdr) && /Gerentes/.test(hdr), hdr);
    const hdrY = await page.$eval('#turma-card-tY .turma-admin-title', (e) => e.textContent.replace(/\s+/g, ' '));
    anota('5. evento sem "Quem participa": o cabeçalho mostra "Empregados"', /Empregados/.test(hdrY), hdrY);

    /* 1. Estado atual */
    const estado = await baixar(() => page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => /Estado atual/.test(b.textContent)).click()));
    const lx = estado.linhas.find((l) => l.Turma === 'TURMA X') || {}, ly = estado.linhas.find((l) => l.Turma === 'TURMA Y') || {};
    anota('1. Estado atual: Data da turma, Horário, Sala e Público logo depois de "Turma"', comecaComColunas(estado.cab) && estado.cab.includes('Frequência'), estado.cab.join(' | '));
    anota('1. Estado atual: os valores da turma', valoresX(lx), JSON.stringify(lx));
    anota('1. Estado atual: frequência "1 de 2 (50%)", nunca "1/2"', lx['Frequência'] === '1 de 2 (50%)', lx['Frequência']);
    anota('1. Estado atual: evento sem "Quem participa" sai como "Empregados"; turma sem sala, sala vazia', ly['Público'] === 'Empregados' && ly['Sala'] === '' && ly['Horário'] === '09:00–13:00', JSON.stringify(ly));

    /* 2. ↓ CSV da turma */
    if (!(await page.isVisible('#turma-card-tX .taa-more-btn'))) await page.click('[data-ev-key="evX"] .ev-toggle-icon');
    await page.waitForSelector('#turma-card-tX .taa-more-btn', { timeout: 10000 });
    await page.click('#turma-card-tX .taa-more-btn');
    const turma = await baixar(() => page.evaluate(() => Array.from(document.querySelectorAll('#turma-card-tX .taa-dropdown button')).find((b) => /CSV/.test(b.textContent)).click()));
    const tl = turma.linhas[0] || {};
    anota('2. "↓ CSV" da turma: as colunas da turma e a frequência "1 de 2 (50%)"', comecaComColunas(turma.cab) && valoresX(tl) && tl['Frequência'] === '1 de 2 (50%)', turma.cab.join(' | ') + ' / ' + JSON.stringify(tl));

    /* 3. Histórico */
    const hist = await baixar(() => page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => /Histórico/.test(b.textContent)).click()));
    const hl = hist.linhas.find((l) => l.Turma === 'TURMA X') || {};
    anota('3. Histórico: as colunas da turma em cada linha', comecaComColunas(hist.cab) && valoresX(hl) && hl['Ação'] === 'Interesse registrado', hist.cab.join(' | ') + ' / ' + JSON.stringify(hl));

    /* 4. Sorteios */
    await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => x.textContent.trim() === 'Sorteios').click());
    await page.waitForSelector('.sorteios-export', { timeout: 15000 });
    const sort = await baixar(() => page.click('.sorteios-export'));
    const sl = sort.linhas[0] || {};
    anota('4. Sorteios: as colunas da turma sorteada', JSON.stringify(sort.cab.slice(0, 7)) === JSON.stringify(['Quando', 'Evento', 'Turma', 'Data da turma', 'Horário', 'Sala', 'Público']) && valoresX(sl) && sl['Nome sorteado'] === 'PRESENTE UM',
      sort.cab.join(' | ') + ' / ' + JSON.stringify(sl));

    anota('6. sem erro de JavaScript', !erros.length, erros[0]);
    await ctx.close();
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
