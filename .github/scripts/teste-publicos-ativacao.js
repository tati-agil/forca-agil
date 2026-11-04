/* ENTREGA B — ativação dos públicos, no navegador (Firebase falso, dados 100% sintéticos, 1280 e 375 px).
 *
 * POR QUE ESTE TESTE EXISTE
 * "Técnicos" deixava estagiários, menores aprendizes, conselheiros, assessores e diretores entrarem como técnicos, e as
 * categorias de Outros públicos não decidiam nada. A Entrega B liga essas regras — mas só quando um super-admin LIGA a
 * ativação (publicos-config/ativo), depois de conferir os cadastros: até lá, tudo exatamente como antes.
 *
 * O QUE ELE EXIGE:
 *   A. formulário Novo/Editar Evento: nenhuma explicação longa à vista; um ⓘ por parâmetro que tem explicação; abrir uma
 *      fecha a outra; "Fechar explicação" e Esc fecham SÓ a explicação (o formulário fica, com o que foi preenchido);
 *      "Público-alvo" separa o que restringe do que só descreve; antes da ativação, os públicos novos aparecem
 *      desabilitados e "Visível só para diretores" continua; nada é gravado ao abrir/fechar ajudas;
 *   B. ADMIN › Outros públicos (super-admin): a ativação aparece DESLIGADA, com a prévia do impacto em números (técnicos
 *      antes/depois, quem deixa de ser técnico por Diretores e por Outros públicos, vínculos que ficariam fora do público,
 *      eventos afetados); ligar pede confirmação e grava só publicos-config { ativo, em, por = quem está logado };
 *   C. depois de ligar: o formulário oferece os públicos novos e esconde "Visível só para diretores" (o mesmo que
 *      "Público-alvo = Diretores"); ＋ Participante de uma estagiária num evento de Técnicos pede a exceção, dizendo que ela
 *      está em Outros públicos; nada é gravado sem o motivo;
 *   D. vitrine (pessoa), com a ativação ligada: a técnica vê o evento de Técnicos e não o de Estagiários; a estagiária, o
 *      contrário; se a leitura de Outros públicos falhar, o evento de Técnicos NÃO aparece como se ela fosse técnica — a
 *      página pede para recarregar; desligada, a estagiária volta a ver o de Técnicos (como sempre);
 *   F. ADMIN › Outros públicos legível: a ativação em uma linha ("Ativação dos públicos — Desligada/Ligada") e uma frase; os
 *      números em "Ver impacto da ativação", recolhido e que abre e fecha; "Sobre esta lista" recolhido; letra de leitura
 *      (≥ 14 px) e sem rolagem lateral em 375 px; filtros, tabela e formulário de inclusão continuam;
 *   G. "Público da turma": a turma herda o público-alvo do evento — o seletor não aparece numa turma sem valor próprio, e
 *      salvar a turma não grava nenhum público nela (o mesmo de sempre);
 *   H. formulário Criar/Editar Turma com as MESMAS ajudas ⓘ do evento: nenhuma explicação longa à vista; ⓘ em Vagas e em
 *      "Lista de convidados da turma" (opções "Sem lista específica (padrão)" × "Restringir a uma lista específica de
 *      e-mails", os mesmos campos e ids); uma explicação por vez; Esc e "Fechar explicação" fecham só a ajuda, sem perder o
 *      que foi digitado; salvar grava o mesmo de antes;
 *   E. em todas as etapas: nenhuma escrita fora de publicos-config; nenhuma operação de Auth além do login; cadastros,
 *      admins, gerentes, diretores, Outros públicos e inscrições iguais; sem erro de JS, sem rolagem lateral.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
function dia(o) { const d = new Date(); d.setDate(d.getDate() + o); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

const ADM = 'tatianefdirene@previ.com.br';
const P = { ger: 'gerente.pa@previ.com.br', dir: 'diretor.pa@previ.com.br', tec: 'tecnica.pa@previ.com.br', est: 'estagiaria.pa@previ.com.br', ass: 'assessor.pa@previ.com.br' };
const nome = (e) => e.split('@')[0].toUpperCase().replace(/\./g, ' ');
const ev = (n, order, extra) => Object.assign({ nome: n, order, publicado: true, esperaAtiva: false }, extra || {});
const tu = (label, eventoKey, order, dias) => ({ label, eventoKey, order, dias, horarioInicio: '09:00', horarioFim: '12:00' });

function banco(ativo) {
  const users = {}; Object.values(P).concat([ADM]).forEach((e) => { users[chave(e)] = { name: nome(e), email: e, area: 'TI', emailConfirmado: true }; });
  const b = {
    'fa-users': users, 'fa-admins': {},
    'fa-gerentes': { [chave(P.ger)]: { email: P.ger, name: nome(P.ger) } },
    'fa-diretores': { [chave(P.dir)]: { email: P.dir, name: nome(P.dir) } },
    'fa-outros-publicos': {
      [chave(P.est)]: { email: P.est, name: nome(P.est), categorias: { estagiario: true }, addedAt: '2026-11-01T10:00:00.000Z', addedBy: ADM },
      [chave(P.ass)]: { email: P.ass, name: nome(P.ass), categorias: { assessor: true }, addedAt: '2026-11-01T10:00:00.000Z', addedBy: ADM },
    },
    'fa-facilitadores': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      evTec: ev('EVENTO TECNICOS PA', 1, { publicoDesc: 'Técnicos' }),
      evEst: ev('EVENTO ESTAGIARIOS PA', 2, { publicoDesc: 'Estagiários' }),
      evDir: ev('EVENTO DIRETORES PA', 3, { publicoDesc: 'Diretores' }),
    },
    turmas: { tTec: tu('TEC TURMA', 'evTec', 1, [dia(20)]), tEst: tu('EST TURMA', 'evEst', 1, [dia(21)]), tDir: tu('DIR TURMA', 'evDir', 1, [dia(22)]) },
    'turmas-config': {},
    'turmas-interesse': { tTec: { [chave(P.est)]: { name: nome(P.est), email: P.est, area: 'TI', date: '2026-10-01T10:00:00.000Z', removed: false, status: 'interessado' } } },
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-interesse-log': {}, 'turmas-checkin': {}, 'turmas-sorteio': {}, 'turmas-equipe': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
  if (ativo) b['publicos-config'] = { ativo: true, em: '2026-11-03T10:00:00.000Z', por: ADM, porNome: 'ADMIN' };
  return b;
}
const INTACTOS = ['fa-users', 'fa-admins', 'fa-gerentes', 'fa-diretores', 'fa-outros-publicos', 'turmas-interesse', 'eventos', 'turmas'];

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }

async function abrir(browser, email, rota, mob, extra) {
  const ctx = await browser.newContext(mob ? Object.assign({}, devices['Pixel 5'], { viewport: { width: 375, height: 760 } }) : { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(false), user: { email, emailVerified: true, uid: 'u' + chave(email) }, delayDefault: 15 }, extra || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#' + rota, { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros };
}
const aba = async (page, re) => {
  await esperarCondicao(page, (r) => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => new RegExp(r, 'i').test(x.textContent)), re, { limite: 15000, descricao: 'aba ' + re });
  await page.evaluate((r) => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => new RegExp(r, 'i').test(x.textContent)).click(), re);
};
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).map((e) => e.path).filter((p) => !/^roteiro-tipos-atividade$|^treinamentos\/[^/]+$/.test(p)));
const lerNo = (page, no) => page.evaluate((n) => firebase.database().ref(n).once('value').then((s) => s.val()), no);
async function menuTurma(page, tk, re) {
  await page.evaluate((k) => { const c = document.getElementById('turma-card-' + k); const ev = c.closest('[data-ev-key]'); const ic = ev && ev.querySelector('.ev-toggle-icon');
    if (c.offsetParent === null && ic) ic.click(); }, tk);
  await page.waitForSelector('#turma-card-' + tk + ' .taa-more-btn', { timeout: 10000 });
  await page.click('#turma-card-' + tk + ' .taa-more-btn');
  await page.evaluate(([k, src]) => { Array.from(document.querySelectorAll('#turma-card-' + k + ' .taa-dropdown button')).find((b) => new RegExp(src).test(b.textContent)).click(); }, [tk, re.source]);
}
const largura = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

async function abrirNovoEvento(page) {
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('button')).some((b) => /Novo evento/i.test(b.textContent)), null, { limite: 15000, descricao: 'botão Novo evento' });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => /Novo evento/i.test(b.textContent)).click());
  await esperarCondicao(page, () => !!document.querySelector('#eventoFormNome'), null, { limite: 10000, descricao: 'o formulário de evento' });
}
const formulario = (page) => page.evaluate(() => {
  const box = document.querySelector('#eventoFormNome').closest('.modal-box');
  const vis = (el) => !!(el && !el.closest('[hidden]') && el.getClientRects().length);
  const ajudas = Array.from(box.querySelectorAll('.ajuda-campo'));
  const sel = box.querySelector('#eventoFormPublicoDesc');
  return {
    botoes: box.querySelectorAll('.ajuda-campo-btn').length, ajudas: ajudas.length, abertas: ajudas.filter(vis).map((a) => a.id),
    paragrafosLongos: Array.from(box.querySelectorAll('p')).filter((p) => vis(p) && p.textContent.length > 140).length, longos: Array.from(box.querySelectorAll('p')).filter((p) => vis(p) && p.textContent.length > 140).map((p) => (p.id || p.className) + ':' + p.textContent.slice(0, 60)),
    grupos: Array.from(sel.querySelectorAll('optgroup')).map((g) => g.label + ':' + Array.from(g.querySelectorAll('option')).map((o) => o.textContent + (o.disabled ? '[x]' : '')).join('|')),
    diretoresCaixa: vis(box.querySelector('#eventoFormRestritoDiretores')),
    nome: box.querySelector('#eventoFormNome').value, aberto: !!document.querySelector('#eventoFormNome'),
    largura: box.scrollWidth > box.clientWidth + 1,
  };
});

(async () => {
  const browser = await chromium.launch();
  try {
    for (const mob of [false, true]) {
      const f = mob ? '375' : '1280';
      console.log('\n== ' + f + ' px — A/B/C: ADMIN (super-admin) ==');
      const { ctx, page, erros } = await abrir(browser, ADM, 'admin', mob);
      await aba(page, 'Eventos');
      await abrirNovoEvento(page);
      let fo = await formulario(page);
      anota(f + ': A1 nenhuma explicação longa à vista; um ⓘ por explicação (' + fo.botoes + ')', fo.paragrafosLongos === 0 && fo.abertas.length === 0 && fo.botoes >= 9 && fo.botoes === fo.ajudas, JSON.stringify(fo));
      await page.fill('#eventoFormNome', 'EVENTO DIGITADO');
      await page.click('.ajuda-campo-btn[aria-controls="ajudaEvVagas"]');
      fo = await formulario(page);
      const txtVagas = await page.textContent('#ajudaEvVagas');
      anota(f + ': A2 o ⓘ abre a explicação completa daquele campo', JSON.stringify(fo.abertas) === '["ajudaEvVagas"]' && /Vazio = sem limite/.test(txtVagas), JSON.stringify(fo.abertas));
      await page.click('.ajuda-campo-btn[aria-controls="ajudaEvCmflex"]');
      fo = await formulario(page);
      anota(f + ': A3 abrir outra fecha a anterior (uma por vez)', JSON.stringify(fo.abertas) === '["ajudaEvCmflex"]', JSON.stringify(fo.abertas));
      await page.click('#ajudaEvCmflex .ajuda-campo-fechar');
      fo = await formulario(page);
      anota(f + ': A4 "Fechar explicação" fecha e devolve o foco ao ⓘ', !fo.abertas.length && (await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-controls'))) === 'ajudaEvCmflex');
      await page.focus('.ajuda-campo-btn[aria-controls="ajudaEvDivulgar"]');
      await page.keyboard.press('Enter');
      fo = await formulario(page);
      const abriuTeclado = JSON.stringify(fo.abertas) === '["ajudaEvDivulgar"]';
      await page.keyboard.press('Escape');
      fo = await formulario(page);
      anota(f + ': A5 teclado: Enter abre; Esc fecha SÓ a explicação — o formulário fica, com o nome digitado', abriuTeclado && !fo.abertas.length && fo.aberto && fo.nome === 'EVENTO DIGITADO', JSON.stringify(fo));
      anota(f + ': A6 Público-alvo separa o que restringe do que só descreve; antes da ativação, os novos desabilitados e Diretores escolhível',
        /^Restringem quem participa:Gerentes\|Técnicos\|Gerentes executivos\|Gerentes de núcleo$/.test(fo.grupos[0]) && /Diretores \(hoje só descrição\)\|Estagiários \(após a ativação\)\[x\]/.test(fo.grupos[1]) &&
        /Assessores \(após a ativação\)\[x\]/.test(fo.grupos[1]) && /^Só descrição \(não restringem\):Empregados\|Executivos\|Cedidos\|Quadro próprio\|Interno\|Externo$/.test(fo.grupos[2]), JSON.stringify(fo.grupos));
      anota(f + ': A7 antes da ativação, "Visível só para diretores" continua no formulário', fo.diretoresCaixa);
      anota(f + ': A8 o formulário cabe na tela; abrir/fechar ajuda não grava nada', !fo.largura && !(await escritas(page)).length, JSON.stringify(await escritas(page)));
      await page.evaluate(() => document.querySelector('#eventoFormNome').closest('.modal-box').querySelector('.admin-modal-cancel-btn').click());

      /* B. a ativação, em Outros públicos */
      await aba(page, 'Outros públicos');
      await esperarCondicao(page, () => !!document.querySelector('[data-ativacao-previa]'), null, { limite: 15000, descricao: 'a prévia da ativação' });
      const tela = await page.evaluate(() => {
        const c = document.getElementById('adminOutrosPublicos'), det = c.querySelector('[data-ativacao-detalhes]'), frase = c.querySelector('[data-ativacao-situacao]');
        return { titulo: c.querySelector('.outros-ativacao-titulo').textContent, frase: frase.textContent, fonte: parseFloat(getComputedStyle(frase).fontSize),
          fonteLista: parseFloat(getComputedStyle(c.querySelector('[data-ativacao-previa]')).fontSize), impactoAberto: det.open, impactoVisivel: c.querySelector('[data-ativacao-previa]').checkVisibility(),
          sobreAberto: c.querySelector('.outros-sobre').open, filtros: !!c.querySelector('#outrosBusca') && !!c.querySelector('#outrosFiltro'), tabela: !!c.querySelector('table'), inclusao: !!c.querySelector('#outrosAddBtn'),
          lateral: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      anota(f + ': F1 a ativação em uma linha e uma frase; impacto e "Sobre esta lista" recolhidos; letra ≥ 14 px; filtros, tabela e inclusão continuam',
        tela.titulo === 'Ativação dos públicos — Desligada' && /ainda não valem/.test(tela.frase) && tela.fonte >= 14 && !tela.impactoAberto && !tela.impactoVisivel &&
        !tela.sobreAberto && tela.filtros && tela.tabela && tela.inclusao && !tela.lateral, JSON.stringify(tela));
      await page.click('[data-ativacao-detalhes] > summary');
      const abriu = await page.evaluate(() => ({ aberto: document.querySelector('[data-ativacao-detalhes]').open, visivel: document.querySelector('[data-ativacao-previa]').checkVisibility(),
        fonte: parseFloat(getComputedStyle(document.querySelector('[data-ativacao-previa]')).fontSize), lateral: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
      await page.click('[data-ativacao-detalhes] > summary');
      const fechou = await page.evaluate(() => !document.querySelector('[data-ativacao-detalhes]').open);
      anota(f + ': F2 "Ver impacto da ativação" abre (números legíveis, sem rolagem lateral) e fecha', abriu.aberto && abriu.visivel && abriu.fonte >= 14 && !abriu.lateral && fechou, JSON.stringify(abriu));
      const prev = await page.evaluate(() => ({ sit: document.querySelector('[data-ativacao-situacao]').getAttribute('data-ativacao-situacao'),
        txt: document.querySelector('[data-ativacao-previa]').textContent.replace(/\s+/g, ' '), vinc: document.querySelector('[data-ativacao-vinculos]').getAttribute('data-ativacao-vinculos'),
        botao: (document.querySelector('[data-ativacao-botao]') || {}).textContent }));
      /* técnicos de antes = todos menos o gerente (ADM, DIR, TEC, EST, ASS = 5); depois = ADM e TEC (2): 1 por Diretores, 2 por Outros públicos */
      anota(f + ': B1 desligada, com a prévia em números (5 → 2 técnicos; 1 de Diretores e 2 de Outros públicos; 1 vínculo; evento de Diretores)',
        prev.sit === 'desligada' && /5<\/b>|5 pela regra de antes/.test(prev.txt.replace(/<[^>]+>/g, '')) && /: 5 pela regra de antes; 2 com a ativação — deixam de ser técnicos 1 de Diretores e 2 de Outros públicos/.test(prev.txt) &&
        prev.vinc === '1' && /EVENTO DIRETORES PA/.test(prev.txt) && /Ligar/.test(prev.botao), JSON.stringify(prev));
      await page.evaluate(() => document.querySelector('[data-ativacao-botao]').click());
      await esperarCondicao(page, () => !!document.querySelector('.admin-modal-confirm-btn'), null, { limite: 8000, descricao: 'a confirmação' });
      const conf = await page.evaluate(() => document.querySelector('.admin-modal-confirm-btn').closest('.modal-box').textContent);
      await page.evaluate(() => document.querySelector('.admin-modal-confirm-btn').click());
      await esperarCondicao(page, () => (document.querySelector('[data-ativacao-situacao]') || {}).getAttribute && document.querySelector('[data-ativacao-situacao]').getAttribute('data-ativacao-situacao') === 'ligada', null, { limite: 10000, descricao: 'a ativação ligada' });
      anota(f + ': F3 depois de ligar: "Ativação dos públicos — Ligada", com a frase de que os públicos estão valendo',
        (await page.textContent('.outros-ativacao-titulo')) === 'Ativação dos públicos — Ligada' && /estão valendo/.test(await page.textContent('[data-ativacao-situacao]')));
      const cfg = await lerNo(page, 'publicos-config');
      anota(f + ': B2 ligar pede confirmação (com o impacto) e grava só publicos-config, assinado por quem está logado',
        /Acessos ao site não mudam/.test(conf) && cfg && cfg.ativo === true && cfg.por === ADM && JSON.stringify(await escritas(page)) === '["publicos-config"]', JSON.stringify({ cfg, e: await escritas(page) }));

      /* C. depois de ligar */
      await aba(page, 'Eventos');
      await abrirNovoEvento(page);
      fo = await formulario(page);
      anota(f + ': C1 ligada: os públicos novos restringem, e "Visível só para diretores" sai (é o mesmo que Público-alvo = Diretores)',
        /^Restringem quem participa:Gerentes\|Técnicos\|Gerentes executivos\|Gerentes de núcleo\|Diretores\|Estagiários\|Menores aprendizes\|Estagiários e menores aprendizes\|Membros do COAUD\|Conselho Deliberativo\|Conselho Fiscal\|Conselho Consultivo\|Conselheiros\|Assessores$/.test(fo.grupos[0]) &&
        fo.grupos.length === 2 && !fo.diretoresCaixa, JSON.stringify(fo));
      await page.evaluate(() => document.querySelector('#eventoFormNome').closest('.modal-box').querySelector('.admin-modal-cancel-btn').click());
      await esperarCondicao(page, () => !!document.querySelector('#turma-card-tTec'), null, { limite: 15000, descricao: 'o card da turma de Técnicos' });
      const nAntes = (await escritas(page)).length;
      await menuTurma(page, 'tTec', /Participante/);
      await page.waitForSelector('#addPartSearch', { timeout: 10000 });
      await page.fill('#addPartSearch', 'ASSESSOR PA');
      await page.waitForSelector('#addPartResults li', { timeout: 10000 });
      await page.click('#addPartResults li');
      await page.selectOption('#addPartStatus', 'interessado');
      await page.click('.modal-box .admin-modal-add-btn');
      await esperarCondicao(page, () => !!document.querySelector('[data-pedido-excecao]'), null, { limite: 10000, descricao: 'o pedido de exceção' });
      const pedido = await page.evaluate(() => document.querySelector('[data-pedido-excecao]').textContent.replace(/\s+/g, ' '));
      anota(f + ': C2 ＋ Participante do assessor num evento de Técnicos: pede a exceção e diz que ele está em Outros públicos', /Outros públicos/.test(pedido) && /só para técnicos/.test(pedido), pedido.slice(0, 300));
      await page.evaluate(() => document.querySelector('[data-pedido-excecao] .admin-modal-cancel-btn').click());
      await page.waitForTimeout(300);
      anota(f + ': C3 cancelado o pedido, nada é gravado', (await escritas(page)).length === nAntes, JSON.stringify(await escritas(page)));
      await page.evaluate(() => { const b = document.querySelector('.modal-box .admin-modal-cancel-btn'); if (b) b.click(); });
      await page.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()); Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click(); });
      await esperarCondicao(page, () => Array.from(document.querySelectorAll('#turma-card-tTec tr')).length > 0, null, { limite: 15000, descricao: 'as linhas da turma de Técnicos' }).catch(() => {});
      const selo = await page.evaluate(() => Array.from(document.querySelectorAll('#turma-card-tTec tr')).map((tr) => tr.textContent).join(' | ').replace(/\s+/g, ' '));
      anota(f + ': C4 o interesse da estagiária na turma de Técnicos ganha o selo "Fora do público atual" (só técnicos)', /Fora do público atual/.test(selo) && /só técnicos/.test(selo), selo.slice(0, 300));
      /* G. "Público da turma" herdado do evento */
      const nG = (await escritas(page)).length;
      await menuTurma(page, 'tTec', /Editar turma/);
      await esperarCondicao(page, () => !!document.querySelector('#turmaFormPublicoCargo'), null, { limite: 10000, descricao: 'o formulário da turma' });
      const campoVisivel = await page.evaluate(() => !!document.querySelector('#turmaFormPublicoCargoBox').getClientRects().length);
      /* H. as ajudas ⓘ do formulário de turma */
      const turmaForm = () => page.evaluate(() => {
        const box = document.querySelector('#turmaFormVagas').closest('.modal-box');
        const vis = (el) => !!(el && el.checkVisibility());
        return { botoes: Array.from(box.querySelectorAll('.ajuda-campo-btn')).map((b) => b.getAttribute('aria-controls')),
          abertas: Array.from(box.querySelectorAll('.ajuda-campo')).filter(vis).map((a) => a.id),
          longos: Array.from(box.querySelectorAll('p, span')).filter((p) => vis(p) && !p.closest('.ajuda-campo') && p.textContent.length > 140).length,
          opcoes: (box.querySelector('#turmaFormPublicoEvento').closest('fieldset').textContent || '').replace(/\s+/g, ' '),
          lista: box.querySelector('#turmaFormPublicoRestrito').checked, padrao: box.querySelector('#turmaFormPublicoEvento').checked,
          vagas: box.querySelector('#turmaFormVagas').value, aberto: !!document.querySelector('#turmaFormVagas'),
          lateral: box.scrollWidth > box.clientWidth + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      let tf = await turmaForm();
      anota(f + ': H1 Editar turma: nenhuma explicação longa à vista; ⓘ em Vagas e na Lista de convidados; opções e valores de sempre',
        JSON.stringify(tf.botoes) === '["ajudaTuVagas","ajudaTuLista"]' && !tf.abertas.length && !tf.longos && /Lista de convidados da turma/.test(tf.opcoes) &&
        /Sem lista específica \(padrão\)/.test(tf.opcoes) && /Restringir a uma lista específica de e-mails/.test(tf.opcoes) && tf.padrao && !tf.lista && tf.vagas === '' && !tf.lateral, JSON.stringify(tf));
      await page.fill('#turmaFormVagas', '15');
      await page.click('.ajuda-campo-btn[aria-controls="ajudaTuVagas"]');
      const umaV = (await turmaForm()).abertas, txtV = await page.textContent('#ajudaTuVagas');
      await page.click('.ajuda-campo-btn[aria-controls="ajudaTuLista"]');
      const umaL = (await turmaForm()).abertas, txtL = await page.textContent('#ajudaTuLista');
      anota(f + ': H2 cada ⓘ abre a sua explicação completa, uma por vez (Vagas: lotação e motivo; Lista: herda o evento, soma-se, exceção do ADMIN)',
        JSON.stringify(umaV) === '["ajudaTuVagas"]' && /pede um motivo/.test(txtV) && JSON.stringify(umaL) === '["ajudaTuLista"]' &&
        /segue o público-alvo do evento/.test(txtL) && /nunca as substitui/.test(txtL) && /exceção do ADMIN/.test(txtL), JSON.stringify({ umaV, umaL }));
      await page.keyboard.press('Escape');
      tf = await turmaForm();
      const aposEsc = tf;
      await page.click('.ajuda-campo-btn[aria-controls="ajudaTuVagas"]');
      await page.click('#ajudaTuVagas .ajuda-campo-fechar');
      tf = await turmaForm();
      anota(f + ': H3 Esc e "Fechar explicação" fecham só a ajuda: o formulário fica e o valor digitado (15) continua',
        !aposEsc.abertas.length && aposEsc.aberto && aposEsc.vagas === '15' && !tf.abertas.length && tf.vagas === '15', JSON.stringify({ aposEsc, tf }));
      await page.fill('#turmaFormVagas', '');  /* volta ao valor de antes: salvar tem de gravar o mesmo de sempre */
      await page.evaluate(() => document.querySelector('#turmaFormPublicoCargo').closest('.modal-box').querySelector('.admin-modal-save-btn').click());
      await esperarCondicao(page, () => !document.querySelector('#turmaFormPublicoCargo'), null, { limite: 10000, descricao: 'o formulário salvo' });
      const tTec = await lerNo(page, 'turmas/tTec');
      const novas = (await escritas(page)).slice(nG);
      /* H4. Nova turma: as mesmas ajudas, fechadas; Cancelar não grava nada */
      const nN = (await escritas(page)).length;
      await page.evaluate(() => { const c = document.getElementById('turma-card-tTec').closest('[data-ev-key]'); const b = Array.from(c.querySelectorAll('button')).find((x) => /Nova turma/.test(x.textContent)); b.click(); });
      await esperarCondicao(page, () => !!document.querySelector('#turmaFormVagas'), null, { limite: 10000, descricao: 'o formulário de Nova turma' });
      const nova = await turmaForm();
      await page.click('.ajuda-campo-btn[aria-controls="ajudaTuLista"]');
      const novaAberta = (await turmaForm()).abertas;
      await page.evaluate(() => document.querySelector('#turmaFormVagas').closest('.modal-box').querySelector('.admin-modal-cancel-btn').click());
      anota(f + ': H4 Nova turma: as mesmas ajudas, fechadas, sem explicação longa; abre a da lista; Cancelar não grava nada',
        JSON.stringify(nova.botoes) === '["ajudaTuVagas","ajudaTuLista"]' && !nova.abertas.length && !nova.longos && nova.padrao && !nova.lateral &&
        JSON.stringify(novaAberta) === '["ajudaTuLista"]' && (await escritas(page)).length === nN, JSON.stringify(nova));
      anota(f + ': G1 "Público da turma" não aparece (a turma segue o evento); salvar não grava público na turma e só toca turmas/tTec',
        !campoVisivel && tTec && !tTec.publicoCargo && tTec.eventoKey === 'evTec' && novas.length > 0 && novas.every((p) => p === 'turmas/tTec'), JSON.stringify({ campoVisivel, tTec, novas }));
      const muda = [];
      for (const n of INTACTOS) {
        const atual = await lerNo(page, n), orig = banco(false)[n];
        if (n === 'turmas') { const a = Object.assign({}, atual), o = Object.assign({}, orig); delete a.tTec; delete o.tTec; if (JSON.stringify(a) !== JSON.stringify(o)) muda.push(n); continue; }
        if (JSON.stringify(atual) !== JSON.stringify(orig)) muda.push(n);
      }
      anota(f + ': E1 cadastros, admins, gerentes, diretores, Outros públicos, inscrições, eventos e turmas iguais', !muda.length, JSON.stringify(muda));
      anota(f + ': E2 nenhuma operação de Auth além do login', !(await page.evaluate(() => (window.__CFG.__eventosAuth || []).filter((x) => !/^entrar:|^sair$/.test(x)).length)));
      anota(f + ': E3 sem rolagem lateral, sem erro de JS (ADMIN)', !(await largura(page)) && !erros.length, JSON.stringify(erros));
      await ctx.close();

      console.log('\n== ' + f + ' px — D: vitrine com a ativação ==');
      const turmasVistas = async (email, ativo, extra) => {
        const x = await abrir(browser, email, 'turmas', mob, Object.assign({ db: banco(ativo) }, extra || {}));
        await esperarCondicao(x.page, () => !!(window.faAuth && window.faAuth.getSession()) && !!document.querySelector('.turmas-eventos'), null, { limite: 15000, descricao: 'a vitrine' });
        await x.page.waitForTimeout(1500);
        const r = await x.page.evaluate(() => ({ turmas: Array.from(document.querySelectorAll('.turmas-eventos .turma-card-new[data-turma-key]')).map((c) => c.getAttribute('data-turma-key')).sort(),
          nota: (document.querySelector('[data-cargo-pendente]') || { getAttribute: () => '' }).getAttribute('data-cargo-pendente') }));
        r.largura = await largura(x.page); r.erros = x.erros; r.escritas = await escritas(x.page);
        await x.ctx.close(); return r;
      };
      const tec = await turmasVistas(P.tec, true), est = await turmasVistas(P.est, true);
      anota(f + ': D1 ligada: a técnica vê o evento de Técnicos e não o de Estagiários', tec.turmas.includes('tTec') && !tec.turmas.includes('tEst') && !tec.turmas.includes('tDir'), JSON.stringify(tec));
      anota(f + ': D2 ligada: a estagiária vê o de Estagiários e o de Técnicos só porque tem vínculo nele (interesse)', est.turmas.includes('tEst') && est.turmas.includes('tTec') && !est.turmas.includes('tDir'), JSON.stringify(est));
      const ass = await turmasVistas(P.ass, true);
      anota(f + ': D3 ligada: o assessor não vê Técnicos nem Estagiários', !ass.turmas.includes('tTec') && !ass.turmas.includes('tEst'), JSON.stringify(ass));
      const falhou = await turmasVistas(P.tec, true, { fail: ['fa-outros-publicos'] });
      anota(f + ': D4 leitura de Outros públicos falhou: o evento de Técnicos NÃO aparece como se ela fosse técnica, e a página pede para recarregar',
        !falhou.turmas.includes('tTec') && falhou.nota === 'falhou', JSON.stringify(falhou));
      const assDesl = await turmasVistas(P.ass, false);
      anota(f + ': D5 desligada: o assessor vê o evento de Técnicos, como sempre (técnico = não gerente)', assDesl.turmas.includes('tTec'), JSON.stringify(assDesl));
      anota(f + ': E4 vitrine: nenhuma escrita, sem rolagem lateral nem erro de JS',
        [tec, est, ass, falhou, assDesl].every((r) => !r.largura && !r.erros.length && !r.escritas.length), JSON.stringify([tec, est, ass, falhou, assDesl].map((r) => [r.erros, r.escritas])));
    }
  } finally { await browser.close(); }
  console.log('\n' + total + ' ok/falha: ' + (total - falhas) + ' ok, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
