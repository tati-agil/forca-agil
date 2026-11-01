/* Vagas da turma e público "Só gerentes" / "Só técnicos" (lista de Gerentes por e-mail).
 *
 * Parâmetros da TURMA: turmas/<t>/vagas (interesse + inscrição não removidos ocupam vaga; ausente = sem limite) e
 * turmas/<t>/publicoCargo ('gerentes' só admite quem está em fa-gerentes; 'tecnicos' só quem NÃO está). O critério é o
 * único de faTurmasUtil.regrasDeEntrada (turmas-util.js), o mesmo das regras de evento. Roda com o Firebase falso
 * (escritas em window.__ESCRITAS) — prova o que chega ao banco, não só a tela. Só desktop.
 *
 * O QUE ELE EXIGE:
 *   1. ORDEM DO CARD: turma realizada e turma com interesse encerrado mostram o aviso delas (sem botão), mesmo lotadas —
 *      "Inscrições encerradas" e "Turma lotada" são mensagens distintas;
 *   2. turma lotada: quem está fora vê "Turma lotada", sem botão; quem já está nela vê "Remover interesse";
 *   3. "Só gerentes": quem não está na lista vê a explicação; gerente vê "Tenho interesse" e registra;
 *      "Só técnicos": gerente vê a explicação; técnico vê "Tenho interesse";
 *   4. painel — ＋ Participante numa turma lotada pede o motivo (sem motivo nada é gravado) e grava acimaDasVagas;
 *   5. painel — ＋ Participante de quem não é gerente numa turma "Só gerentes" recusa, sem gravar;
 *   6. aba Gerentes: e-mail fora de @previ.com.br recusa a lista inteira; lista colada grava os novos por e-mail (mesmo
 *      sem cadastro), avisa os que já estavam e mostra "Ainda sem cadastro";
 *   7. formulário da turma grava vagas e publicoCargo;
 *   8. Minha Área ("Turmas abertas no momento"): não convida para turma lotada nem para "Só gerentes" de quem não é;
 *   9. nenhum erro de JavaScript não tratado.
 *
 * CMFLEX (eventos/<ev>/dispensaCmflex — ausente = exige, como sempre foi):
 *  10. evento que não exige: depois do interesse o card diz que a organização confirma a vaga (sem CMFlex); o Confirmar
 *      do painel pergunta pela vaga, não pelo CMFlex; o formulário da turma esconde "Link do CMFlex";
 *  11. evento que exige: o card continua mandando para o CMFlex.
 *
 * "QUEM PARTICIPA" DO EVENTO (eventos/<ev>/publicoDesc = "Gerentes" | "Técnicos") também é regra, para todas as turmas:
 *  12. evento "Gerentes": quem não está na lista vê "só para gerentes"; evento "Técnicos": gerente vê "não é para
 *      gerentes"; técnico entra no evento "Técnicos".
 *
 * VAGAS POR TURMA NO EVENTO (eventos/<ev>/vagasPorTurma; a turma pode ter o próprio número por cima):
 *  13. turma sem número próprio num evento com "Vagas por turma" lota pelo número do evento; o formulário do evento grava
 *      vagasPorTurma.
 *
 * VISIBILIDADE: os eventos com turmas de cargo (ev5, ev7, ev8) estão em "Mostrar para todos" (visibilidade 'todos') —
 * no padrão, a turma de cargo nem aparece para quem está fora (teste-visibilidade-evento.js), e aqui o que se mede são
 * as mensagens e a recusa de quem vê a turma sem poder participar. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br', GER = 'gerente@previ.com.br', TEC = 'tecnica@previ.com.br', DENTRO = 'dentro@previ.com.br';
const OCUP = 'ocupa@previ.com.br', NOVO = 'nunca.veio@previ.com.br', SEMCAD = 'gerente.sem.cadastro@previ.com.br';

function banco() {
  const users = {}, admins = {};
  [[ADM, 'ADMIN'], [GER, 'GERENTE UM'], [TEC, 'TECNICA UM'], [DENTRO, 'JA ESTA DENTRO'], [OCUP, 'OCUPA VAGA'], [NOVO, 'NUNCA VEIO']]
    .forEach(([e, n]) => { users[chave(e)] = { name: n, email: e, area: 'INFOR' }; });
  admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };
  const reg = (e, n) => ({ name: n, email: e, status: 'interessado', removed: false, date: '2026-10-20T10:00:00.000Z' });
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-gerentes': { [chave(GER)]: { email: GER, name: 'GERENTE UM', addedAt: '2026-10-22T10:00:00.000Z' }, [chave(SEMCAD)]: { email: SEMCAD, name: '', addedAt: '2026-10-22T10:00:00.000Z' } },
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev5: { nome: 'EPISÓDIO V', order: 1, publicado: true, cargaHoraria: '3', esperaAtiva: false, dispensaCmflex: true, visibilidade: 'todos' },
      ev6: { nome: 'EPISÓDIO VI', order: 2, publicado: true, cargaHoraria: '3', esperaAtiva: false },
      ev7: { nome: 'EPISÓDIO VII', order: 3, publicado: true, cargaHoraria: '3', esperaAtiva: false, publicoDesc: 'Gerentes', visibilidade: 'todos' },
      ev8: { nome: 'EPISÓDIO VIII', order: 4, publicado: true, cargaHoraria: '3', esperaAtiva: false, publicoDesc: 'Técnicos', visibilidade: 'todos' },
      ev9: { nome: 'EPISÓDIO IX', order: 5, publicado: true, cargaHoraria: '3', esperaAtiva: false, vagasPorTurma: 1 } },
    turmas: {
      tL: { label: 'TURMA LOTADA', eventoKey: 'ev5', order: 1, dias: ['2027-11-03'], vagas: 2 },
      tG: { label: 'TURMA GERENTES', eventoKey: 'ev5', order: 2, dias: ['2027-11-05'], publicoCargo: 'gerentes' },
      tT: { label: 'TURMA TECNICOS', eventoKey: 'ev5', order: 3, dias: ['2027-11-06'], publicoCargo: 'tecnicos' },
      tR: { label: 'TURMA REALIZADA', eventoKey: 'ev5', order: 4, dias: ['2026-01-10'], vagas: 1 },
      tF: { label: 'TURMA ENCERRADA', eventoKey: 'ev5', order: 5, dias: ['2027-12-01'], vagas: 1 },
      tC: { label: 'TURMA COM CMFLEX', eventoKey: 'ev6', order: 6, dias: ['2027-12-03'] },
      tEG: { label: 'EVENTO GER T1', eventoKey: 'ev7', order: 7, dias: ['2027-12-06'] },
      tET: { label: 'EVENTO TEC T1', eventoKey: 'ev8', order: 8, dias: ['2027-12-07'] },
      tEV: { label: 'EVENTO VAGAS T1', eventoKey: 'ev9', order: 9, dias: ['2027-12-08'] }
    },
    'turmas-interesse': {
      tL: { [chave(OCUP)]: reg(OCUP, 'OCUPA VAGA'), [chave(DENTRO)]: reg(DENTRO, 'JA ESTA DENTRO') },
      tR: { [chave(OCUP)]: reg(OCUP, 'OCUPA VAGA') },
      tF: { [chave(OCUP)]: reg(OCUP, 'OCUPA VAGA') },
      tEV: { [chave(OCUP)]: reg(OCUP, 'OCUPA VAGA') }
    },
    'turmas-interesse-log': {}, 'turmas-config': { tF: { finalizada: true } }, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

async function abrir(browser, email, hash) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 20 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : ''; }, sel);
const visivel = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!(e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'); }, sel);
const escritasDe = (page, caminho) => page.evaluate((c) => (window.__ESCRITAS || []).filter((e) => e.path === c), caminho);
/* o botão da turma terminou de conferir: ou está escondido com a explicação, ou habilitado fora do "Verificando…" */
const final = (page, tk) => page.waitForFunction((k) => {
  const b = document.querySelector('.btn--interest[data-turma="' + k + '"]'), m = document.getElementById('intent-msg-' + k);
  return !!b && (b.style.display === 'none' ? !!(m && m.textContent) : (!/Verificando/.test(b.textContent) && !b.disabled));
}, tk, { timeout: 15000 });
/* espera a mensagem final esperada (o card nasce com "Tenho interesse" e só depois confere: ler antes engana) */
const msgFinal = (page, tk, re) => page.waitForFunction(([k, src]) => { const b = document.querySelector('.btn--interest[data-turma="' + k + '"]');
  return !!b && b.style.display === 'none' && new RegExp(src).test((document.getElementById('intent-msg-' + k) || {}).textContent || ''); }, [tk, re.source], { timeout: 15000 });
const cardDe = (page, rotulo) => page.evaluate((r) => {
  const c = Array.from(document.querySelectorAll('#page-turmas .turma-card-new')).find((x) => (x.querySelector('.tc-label') || {}).textContent === r);
  return c ? { texto: c.textContent.replace(/\s+/g, ' '), botao: !!c.querySelector('.btn--interest') } : null;
}, rotulo);

async function abrirMenuTurma(page, tk) {
  await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)); if (b) b.click(); });
  await page.waitForSelector('[data-ev-key="ev5"]', { timeout: 15000 });
  await page.waitForSelector('#turma-card-' + tk + ' .taa-more-btn', { state: 'attached', timeout: 10000 });
  if (!(await page.isVisible('#turma-card-' + tk + ' .taa-more-btn'))) await page.click('[data-ev-key="ev5"] .ev-toggle-icon');
  await page.waitForSelector('#turma-card-' + tk + ' .taa-more-btn', { timeout: 10000 });
  await page.click('#turma-card-' + tk + ' .taa-more-btn');
}
async function participante(page, tk, busca) {
  await abrirMenuTurma(page, tk);
  await page.evaluate((k) => { Array.from(document.querySelectorAll('#turma-card-' + k + ' .taa-dropdown button')).find((b) => /Participante/.test(b.textContent)).click(); }, tk);
  await page.waitForSelector('#addPartSearch', { timeout: 10000 });
  await page.fill('#addPartSearch', busca);
  await page.waitForSelector('#addPartResults li', { timeout: 10000 });
  await page.click('#addPartResults li');
  await page.selectOption('#addPartStatus', 'interessado');
  await page.click('.modal-box .admin-modal-add-btn');
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (linha, ok, detalhe) => { if (ok) console.log('  ok    ' + linha); else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); } };
  try {
    /* 1–3. técnica (não está na lista de Gerentes, fora da turma lotada) */
    {
      const { ctx, page, erros } = await abrir(browser, TEC, '#turmas');
      await msgFinal(page, 'tL', /Turma lotada/); await msgFinal(page, 'tG', /gerentes/); await final(page, 'tT');
      const mL = await texto(page, '#intent-msg-tL'), mG = await texto(page, '#intent-msg-tG');
      anota('2. turma lotada: quem está fora vê "Turma lotada", sem botão', !(await visivel(page, '.btn--interest[data-turma="tL"]')) && /Turma lotada — as 2 vagas já foram preenchidas/.test(mL), mL);
      anota('3. "Só gerentes": quem não está na lista vê a explicação, sem botão', !(await visivel(page, '.btn--interest[data-turma="tG"]')) && /só para gerentes/.test(mG), mG);
      anota('3. "Só técnicos": técnica vê "Tenho interesse"', await visivel(page, '.btn--interest[data-turma="tT"]') && /Tenho interesse/.test(await texto(page, '.btn--interest[data-turma="tT"]')));
      const r = await cardDe(page, 'TURMA REALIZADA'), f = await cardDe(page, 'TURMA ENCERRADA');
      anota('1. turma realizada (mesmo lotada): "Turma realizada", sem botão e sem "Turma lotada"', !!r && !r.botao && /Turma realizada/.test(r.texto) && !/lotada/i.test(r.texto), r && r.texto);
      anota('1. interesse encerrado (mesmo lotada): "Inscrições encerradas", sem botão — distinta de "Turma lotada"', !!f && !f.botao && /Inscrições encerradas/.test(f.texto) && !/Turma lotada/.test(f.texto), f && f.texto);
      await msgFinal(page, 'tEG', /gerentes/); await final(page, 'tET');
      anota('12. evento com "Quem participa" = Gerentes: técnica vê "só para gerentes", sem botão', /só para gerentes/.test(await texto(page, '#intent-msg-tEG')));
      anota('12. evento com "Quem participa" = Técnicos: técnica vê "Tenho interesse"', await visivel(page, '.btn--interest[data-turma="tET"]') && /Tenho interesse/.test(await texto(page, '.btn--interest[data-turma="tET"]')));
      await msgFinal(page, 'tEV', /Turma lotada/);
      anota('13. turma sem número próprio num evento com "Vagas por turma" = 1: lotada pelo número do evento', /as 1 vagas já foram preenchidas/.test(await texto(page, '#intent-msg-tEV')), await texto(page, '#intent-msg-tEV'));
      anota('sem erro de JavaScript (técnica)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 2. quem já está na turma lotada */
    {
      const { ctx, page, erros } = await abrir(browser, DENTRO, '#turmas');
      await page.waitForFunction(() => /Remover interesse/.test((document.querySelector('.btn--interest[data-turma="tL"]') || {}).textContent || ''), null, { timeout: 15000 });
      anota('2. quem já está na turma lotada vê "Remover interesse" (nenhuma regra esconde o próprio registro)', /Remover interesse/.test(await texto(page, '.btn--interest[data-turma="tL"]')));
      anota('sem erro de JavaScript (dentro)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 3. gerente */
    {
      const { ctx, page, erros } = await abrir(browser, GER, '#turmas');
      await msgFinal(page, 'tT', /não é para gerentes/); await final(page, 'tG');
      const mT = await texto(page, '#intent-msg-tT');
      anota('3. "Só técnicos": gerente vê a explicação, sem botão', !(await visivel(page, '.btn--interest[data-turma="tT"]')) && /não é para gerentes/.test(mT), mT);
      await page.click('.btn--interest[data-turma="tG"]');
      await page.waitForFunction((c) => (window.__ESCRITAS || []).some((e) => e.path === c), 'turmas-interesse/tG/' + chave(GER), { timeout: 10000 });
      anota('3. "Só gerentes": gerente registra interesse (o clique confere a lista e grava)', (await escritasDe(page, 'turmas-interesse/tG/' + chave(GER))).some((e) => e.valor && e.valor.status === 'interessado'));
      await page.waitForFunction(() => /Remover interesse/.test((document.querySelector('.btn--interest[data-turma="tG"]') || {}).textContent || ''), null, { timeout: 10000 });
      const semCm = await texto(page, '#intent-msg-tG');
      anota('10. evento que não exige o CMFlex: depois do interesse, "a organização confirma sua vaga", sem CMFlex', /A organização confirma sua vaga/.test(semCm) && !/CMFlex/.test(semCm), semCm);
      await final(page, 'tC');
      await page.click('.btn--interest[data-turma="tC"]');
      await page.waitForFunction(() => /CMFlex/.test((document.getElementById('intent-msg-tC') || {}).textContent || ''), null, { timeout: 10000 });
      const comCm = await texto(page, '#intent-msg-tC');
      anota('11. evento que exige: o card continua mandando para o CMFlex e aponta a Minha Área', /realize a inscrição no CMFlex/.test(comCm) && /acompanhe pela Minha Área/.test(comCm), comCm);
      await msgFinal(page, 'tET', /não é para gerentes/);
      anota('12. evento com "Quem participa" = Técnicos: gerente vê "não é para gerentes", sem botão', !(await visivel(page, '.btn--interest[data-turma="tET"]')));
      anota('sem erro de JavaScript (gerente)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 4–7. painel */
    {
      const { ctx, page, erros } = await abrir(browser, ADM, '#admin');
      /* 4. turma lotada pede motivo */
      await participante(page, 'tL', 'TECNICA');
      await page.waitForSelector('.admin-vagas-motivo', { timeout: 10000 });
      const pedido = await page.evaluate(() => document.querySelector('.admin-vagas-motivo').closest('.modal-box').textContent);
      await page.click('.admin-vagas-confirm-btn');
      const semMotivo = await page.evaluate(() => { const e = document.querySelector('.admin-vagas-motivo').closest('.modal-box').querySelector('.admin-motivo-erro'); return e && !e.hidden ? e.textContent : ''; });
      anota('4. ＋ Participante em turma lotada pede o motivo; sem motivo, recusa e nada é gravado',
        /lotada \(2 de 2 vagas\)/.test(pedido) && /Escreva o motivo/.test(semMotivo) && !(await escritasDe(page, 'turmas-interesse/tL/' + chave(TEC))).length, pedido + ' | ' + semMotivo);
      await page.fill('.admin-vagas-motivo', 'Indicação da diretoria');
      await page.click('.admin-vagas-confirm-btn');
      await page.waitForFunction((c) => (window.__ESCRITAS || []).some((e) => e.path === c), 'turmas-interesse/tL/' + chave(TEC), { timeout: 10000 });
      const gravado = (await escritasDe(page, 'turmas-interesse/tL/' + chave(TEC))).pop();
      const av = gravado && gravado.valor && gravado.valor.acimaDasVagas;
      anota('4. com motivo, grava a pessoa com acimaDasVagas (motivo, vagas, ocupadas, quem)',
        !!av && av.motivo === 'Indicação da diretoria' && av.vagas === 2 && av.ocupadas === 2 && av.por === ADM, JSON.stringify(av));
      /* 5. "Só gerentes" recusa quem não é gerente */
      await page.keyboard.press('Escape');
      await participante(page, 'tG', 'JA ESTA');
      await page.waitForFunction(() => /lista de Gerentes/.test((document.getElementById('addPartErr') || {}).textContent || ''), null, { timeout: 10000 });
      const err = await texto(page, '#addPartErr');
      anota('5. ＋ Participante de quem não é gerente numa turma "Só gerentes": recusa com o motivo e nada é gravado',
        /não está na lista de Gerentes/.test(err) && !(await escritasDe(page, 'turmas-interesse/tG/' + chave(DENTRO))).length, err);
      await page.click('.modal-box .admin-modal-cancel-btn');
      /* 10. Confirmar numa turma de evento sem CMFlex */
      await page.waitForSelector('#turma-card-tL .cf-confirm-btn[data-ekey="' + chave(OCUP) + '"]', { state: 'attached', timeout: 10000 });
      await page.evaluate((k) => document.querySelector('#turma-card-tL .cf-confirm-btn[data-ekey="' + k + '"]').click(), chave(OCUP));
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.modal-box')).some((b) => /Confirmar a vaga de/.test(b.textContent)), null, { timeout: 10000 });
      const conf = await page.evaluate(() => Array.from(document.querySelectorAll('.modal-box')).find((b) => /Confirmar a vaga de/.test(b.textContent)).textContent);
      anota('10. Confirmar (evento sem CMFlex) pergunta pela vaga, sem falar em CMFlex', /Confirmar a vaga de OCUPA VAGA/.test(conf) && !/CMFlex/.test(conf), conf);
      await page.evaluate(() => Array.from(document.querySelectorAll('.modal-box')).find((b) => /Confirmar a vaga de/.test(b.textContent)).querySelector('.admin-modal-cancel-btn').click());
      /* 7. formulário da turma */
      await abrirMenuTurma(page, 'tT');
      await page.evaluate(() => { Array.from(document.querySelectorAll('#turma-card-tT .taa-dropdown button')).find((b) => /Editar turma/.test(b.textContent)).click(); });
      await page.waitForSelector('#turmaFormVagas', { timeout: 10000 });
      anota('7. o formulário abre com o público gravado ("Só técnicos") e vagas vazias (sem limite)', (await page.$eval('#turmaFormPublicoCargo', (s) => s.value)) === 'tecnicos' && (await page.$eval('#turmaFormVagas', (i) => i.value)) === '');
      anota('10. evento sem CMFlex: o formulário da turma não mostra "Link do CMFlex"', !(await visivel(page, '#turmaFormCmflex')));
      await page.selectOption('#turmaFormEvento', 'ev6');
      const comLink = await visivel(page, '#turmaFormCmflex');
      await page.selectOption('#turmaFormEvento', 'ev5');
      anota('11. trocando para um evento que exige, o campo volta', comLink);
      await page.fill('#turmaFormVagas', '20');
      await page.selectOption('#turmaFormPublicoCargo', 'gerentes');
      await page.click('.modal-box .admin-modal-save-btn');
      await page.waitForFunction(() => (window.__ESCRITAS || []).some((e) => e.path === 'turmas/tT'), null, { timeout: 10000 });
      const t = (await escritasDe(page, 'turmas/tT')).pop();
      anota('7. salvar grava vagas = 20 e publicoCargo = "gerentes"', !!t && t.valor.vagas === 20 && t.valor.publicoCargo === 'gerentes', JSON.stringify(t && t.valor));
      /* 13. formulário do evento: "Vagas por turma" */
      await page.keyboard.press('Escape');
      await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click());
      await page.waitForSelector('[data-ev-key="ev9"]', { timeout: 10000 });
      await page.evaluate(() => Array.from(document.querySelectorAll('[data-ev-key="ev9"] button')).find((x) => /Editar evento/.test(x.textContent)).click());
      await page.waitForSelector('#eventoFormVagas', { timeout: 10000 });
      anota('13. o formulário do evento abre com as vagas gravadas', (await page.$eval('#eventoFormVagas', (i) => i.value)) === '1');
      await page.fill('#eventoFormVagas', '20');
      await page.click('.modal-box .admin-modal-save-btn');
      await page.waitForFunction(() => (window.__ESCRITAS || []).some((e) => e.path === 'eventos/ev9' && e.valor && e.valor.vagasPorTurma === 20), null, { timeout: 10000 });
      anota('13. salvar o evento grava vagasPorTurma = 20', true);
      /* 6. aba Gerentes */
      await page.evaluate(() => { Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => x.textContent.trim() === 'Gerentes').click(); });
      await page.waitForSelector('#gerentesEmails', { timeout: 10000 });
      const tabela = await texto(page, '#adminGerentes');
      anota('6. a aba lista os gerentes, com "Ainda sem cadastro" para quem não se cadastrou', /gerente\.sem\.cadastro@previ\.com\.br/.test(tabela) && /Ainda sem cadastro/.test(tabela) && /GERENTE UM/.test(tabela));
      const antes = await page.evaluate(() => (window.__ESCRITAS || []).filter((e) => /^fa-gerentes/.test(e.path)).length);
      await page.fill('#gerentesEmails', 'novo.gerente@previ.com.br; fulano@gmail.com');
      await page.click('#gerentesAddBtn');
      const msgInval = await texto(page, '#gerentesMsg');
      const depoisInval = await page.evaluate(() => (window.__ESCRITAS || []).filter((e) => /^fa-gerentes/.test(e.path)).length);
      anota('6. um e-mail fora de @previ.com.br recusa a lista inteira (nada é gravado)', /fulano@gmail\.com/.test(msgInval) && depoisInval === antes, msgInval);
      await page.fill('#gerentesEmails', 'Novo.Gerente@previ.com.br\n' + GER + ', outra.gerente@previ.com.br');
      await page.click('#gerentesAddBtn');
      await page.waitForFunction(() => /2 adicionado/.test((document.getElementById('gerentesMsg') || {}).textContent || ''), null, { timeout: 10000 });
      const novo = (await escritasDe(page, 'fa-gerentes/' + chave('novo.gerente@previ.com.br'))).pop() || (await page.evaluate((k) => {
        const u = (window.__ESCRITAS || []).filter((e) => e.path === '' || e.path === '/').pop(); return u ? { valor: u.valor['fa-gerentes/' + k] } : null; }, chave('novo.gerente@previ.com.br')));
      const msgOk = await texto(page, '#gerentesMsg');
      anota('6. lista colada: grava os novos pela chave do e-mail (minúsculo) e avisa quem já estava',
        !!(novo && novo.valor && novo.valor.email === 'novo.gerente@previ.com.br') && /Já estavam na lista: 1/.test(msgOk), msgOk + ' ' + JSON.stringify(novo));
      anota('sem erro de JavaScript (painel)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 8. Minha Área: prévia das turmas abertas */
    {
      const { ctx, page, erros } = await abrir(browser, NOVO, '#minha-area');
      await page.waitForSelector('.aluno-abertas', { timeout: 15000 });
      const lista = await texto(page, '.aluno-abertas');
      anota('8. "Turmas abertas no momento" convida para a turma de técnicos, não para a lotada nem para a de gerentes',
        /TURMA TECNICOS/.test(lista) && !/TURMA LOTADA/.test(lista) && !/TURMA GERENTES/.test(lista), lista);
      anota('sem erro de JavaScript (Minha Área)', !erros.length, erros[0]);
      await ctx.close();
    }
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
