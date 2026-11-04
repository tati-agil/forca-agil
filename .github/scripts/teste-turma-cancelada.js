/* Turma cancelada (turmas-config/<turma>/cancelamento) x turma concluída (encerrada). Firebase falso; 1280 e 375 px.
 *
 * O QUE ELE EXIGE:
 *   1. ADMIN: cancelar pede o motivo ("Outro" exige justificativa), vale com o interesse aberto e grava só o cancelamento, com
 *      data e responsável: nem encerrada, nem dataConclusao, nem pessoas, nem histórico, nem fila;
 *   2. o cartão mostra TURMA CANCELADA, motivo, data e responsável, sem nada que ponha gente na turma; a turma encerrada antes
 *      aparece como TURMA CONCLUÍDA e não pode ser cancelada;
 *   3. página Turmas: quem tem vínculo ativo vê "Turma cancelada", sem botão e sem o motivo: na posição normal se o evento tem outra
 *      turma à vista; senão, na seção final "Turmas canceladas". Sem vínculo, removida, transferida e só na fila não veem; evento
 *      despublicado fica fora da página; a concluída continua "Turma realizada"; leitura lenta ou que falha deixa a turma escondida;
 *   4. Minha Área: inscrição em "Canceladas" e interesse no mesmo agrupamento, com o aviso; sem certificado, sem frequência, sem o
 *      motivo; quem não tem vínculo ativo não vê; a turma concluída continua com certificado;
 *   5. regras de entrada: registro em turma cancelada não impede outra turma nem evento (regrasDeEntrada e
 *      conflitosDeParticipacao concordam); em turma não cancelada continua impedindo;
 *   6. confirmar em outra turma não mexe na inscrição da cancelada; a cancelada não é destino de movimentação;
 *   7. Dashboard: quem está em turma cancelada não conta como participante;
 *   8. check-in recusa; a área do facilitador mostra a cancelada em "Canceladas", sem "Abrir roteiro";
 *   9. os motivos do site são os mesmos das regras do banco;
 *  10. sem rolagem lateral; nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br', ANA = 'ana@previ.com.br', BIA = 'bia@previ.com.br', CAIO = 'caio@previ.com.br',
  NOVO = 'novo@previ.com.br', REM = 'rem@previ.com.br', TRA = 'tra@previ.com.br', FILAO = 'filao@previ.com.br';
const AGORA = '2026-10-01T10:00:00.000Z';
const CANC = { motivo: 'falta-quorum', em: AGORA, por: ADM, porNome: 'ADMIN' };
const inscrita = (e, n) => ({ name: n, email: e, area: 'GECAT', status: 'inscrito', confirmedByAdmin: ADM, confirmedByAdminName: 'ADMIN', confirmedDate: AGORA, removed: false, date: AGORA });
const interesse = (e, n) => ({ name: n, email: e, area: 'GECAT', status: 'interessado', removed: false, date: AGORA });

/* tJaCanc: já cancelada, com data passada. tConcl: encerrada antes do cancelamento existir. tAberta: interesse aberto, a cancelar.
   tOutra: destino. evGrupo tem "uma turma por pessoa"; evDepois não aceita quem participou de evAntes. */
function banco() {
  const ti = {
    tJaCanc: { [chave(ANA)]: inscrita(ANA, 'ANA LIMA'), [chave(BIA)]: inscrita(BIA, 'BIA NEVES'),
      [chave(REM)]: Object.assign(inscrita(REM, 'REM SAIU'), { removed: true, removedDate: AGORA }),
      [chave(TRA)]: Object.assign(interesse(TRA, 'TRA MOVIDA'), { removed: true, removedDate: AGORA, removedParaTurma: 'tOutra', removedParaTurmaLabel: 'TURMA OUTRA' }) },
    tOffCanc: { [chave(ANA)]: interesse(ANA, 'ANA LIMA') },
    tConcl: { [chave(ANA)]: inscrita(ANA, 'ANA LIMA') },
    tAberta: { [chave(BIA)]: interesse(BIA, 'BIA NEVES') },
    tOutra: { [chave(BIA)]: interesse(BIA, 'BIA NEVES'), [chave(TRA)]: interesse(TRA, 'TRA MOVIDA') },
    tAntesCanc: { [chave(ANA)]: inscrita(ANA, 'ANA LIMA') },
    tAntesVale: { [chave(BIA)]: inscrita(BIA, 'BIA NEVES') },
    /* inscrita só em turma cancelada, e na fila: para a Visão por pessoa do Excel completo */
    tSoCanc: { [chave(CAIO)]: inscrita(CAIO, 'CAIO REIS'), [chave(ANA)]: interesse(ANA, 'ANA LIMA') }
  };
  return {
    'fa-users': { [chave(ADM)]: { name: 'ADMIN', email: ADM, area: 'INFOR' }, [chave(ANA)]: { name: 'ANA LIMA', email: ANA, area: 'GECAT' }, [chave(BIA)]: { name: 'BIA NEVES', email: BIA, area: 'GECAT' } },
    'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-gerentes': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {},
    'fa-facilitadores': { [chave(ANA)]: { email: ANA, name: 'ANA LIMA', ativo: true } },
    'fa-espera': { [chave(FILAO)]: { tJaCanc: { name: 'FILA SO', email: FILAO, area: 'GECAT', eventoKey: 'evGrupo', date: AGORA, removed: false, migratedFrom: 'tJaCanc' } }, [chave(CAIO)]: { 'lista:evGrupo': { name: 'CAIO REIS', email: CAIO, area: 'GECAT', eventoKey: 'evGrupo', date: AGORA, removed: false } }, [chave('fila@previ.com.br')]: { 'lista:evGrupo': { name: 'NA FILA', email: 'fila@previ.com.br', area: 'GECAT', eventoKey: 'evGrupo', date: AGORA, removed: false } } },
    eventos: {
      evGrupo: { nome: 'EPISÓDIO GRUPO', order: 1, publicado: true, cargaHoraria: '3', umaTurmaPorPessoa: true, percentualMinimo: 0 },
      evAntes: { nome: 'EPISÓDIO ANTES', order: 2, publicado: true, cargaHoraria: '3' },
      evDepois: { nome: 'EPISÓDIO DEPOIS', order: 3, publicado: true, cargaHoraria: '3', bloqueiaParticipantesDe: { evAntes: true } },
      evSoCanc: { nome: 'EPISÓDIO SÓ CANCELADO', order: 4, publicado: true, cargaHoraria: '3', esperaAtiva: false },
      evFilaCanc: { nome: 'EPISÓDIO FILA LIGADA', order: 6, publicado: true, cargaHoraria: '3', esperaAtiva: true },
      evOff: { nome: 'EPISÓDIO DESPUBLICADO', order: 7, publicado: false, cargaHoraria: '3' },
      evConcl: { nome: 'EPISÓDIO CONCLUÍDO', order: 5, publicado: true, cargaHoraria: '3', percentualMinimo: 0 }
    },
    turmas: {
      tJaCanc: { label: 'TURMA JA CANCELADA', eventoKey: 'evGrupo', order: 1, dias: ['2026-01-10'], avaliacaoHabilitada: false },
      tConcl: { label: 'TURMA CONCLUIDA', eventoKey: 'evConcl', order: 2, dias: ['2026-01-11'] },
      tAberta: { label: 'TURMA ABERTA', eventoKey: 'evGrupo', order: 3, dias: ['2027-11-03'], avaliacaoHabilitada: true },
      tOutra: { label: 'TURMA OUTRA', eventoKey: 'evGrupo', order: 4, dias: ['2027-11-04'] },
      tAntesCanc: { label: 'ANTES CANCELADA', eventoKey: 'evAntes', order: 5, dias: ['2027-05-01'] },
      tAntesVale: { label: 'ANTES VALE', eventoKey: 'evAntes', order: 6, dias: ['2027-05-02'] },
      tDepois: { label: 'TURMA DEPOIS', eventoKey: 'evDepois', order: 7, dias: ['2027-11-05'] },
      tSoCanc: { label: 'TURMA SO CANCELADA', eventoKey: 'evSoCanc', order: 8, dias: ['2027-11-06'] },
      tFilaCanc: { label: 'TURMA FILA CANCELADA', eventoKey: 'evFilaCanc', order: 9, dias: ['2027-11-07'] },
      tOffCanc: { label: 'TURMA OFF CANCELADA', eventoKey: 'evOff', order: 10, dias: ['2027-11-08'] }
    },
    'turmas-interesse': ti,
    'turmas-interesse-log': {},
    'turmas-config': {
      tJaCanc: { cancelamento: CANC },
      tConcl: { finalizada: true, encerrada: true, dataConclusao: '2026-01-11' },
      tAntesCanc: { cancelamento: CANC },
      tSoCanc: { cancelamento: CANC },
      tFilaCanc: { cancelamento: CANC },
      tOffCanc: { cancelamento: CANC }
    },
    'turmas-checkin': { tConcl: {} }, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {},
    'turmas-equipe': { tJaCanc: { [chave(ANA)]: { email: ANA, name: 'ANA LIMA', papel: 'facilitador' } }, tConcl: { [chave(ANA)]: { email: ANA, name: 'ANA LIMA', papel: 'facilitador' } } }
  };
}

async function abrir(browser, opt, email, rota, extra) {
  const ctx = await browser.newContext(opt);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 5, ...(extra || {}) }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#' + rota, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const tocar = (page, seletor) => page.evaluate((s) => document.querySelector(s).click(), seletor);
const abaAdmin = async (page, nome) => {
  await esperarCondicao(page, (n) => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => new RegExp(n, 'i').test(x.textContent)), nome, { limite: 15000, descricao: 'a aba ' + nome });
  await page.evaluate((n) => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => new RegExp(n, 'i').test(x.textContent)).click(), nome);
};
const cartao = (page, tk, fn) => page.evaluate(([k, f]) => {
  const c = document.querySelector('#turma-actions-' + k).closest('.turma-admin-card') || document.querySelector('#turma-actions-' + k).parentElement.parentElement;
  return (new Function('c', 'return (' + f + ')(c)'))(c);
}, [tk, fn.toString()]);

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  try {
    for (const [nome, opt] of [
      ['1280 px', { viewport: { width: 1280, height: 800 } }],
      ['375 px', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]
    ]) {
      /* ── ADMIN ── */
      {
        const { ctx, page, erros } = await abrir(browser, opt, ADM, 'admin');
        await abaAdmin(page, 'Eventos');
        await esperarCondicao(page, () => !!document.querySelector('#turma-actions-tAberta'), null, { limite: 15000, descricao: 'os cartões das turmas' });

        const jaCanc = await cartao(page, 'tJaCanc', (c) => ({ txt: c.innerText, botoes: Array.from(c.querySelectorAll('.taa-dropdown button, .taa-primary button')).map((b) => b.textContent.trim()), confirmar: c.querySelectorAll('.cf-confirm-btn').length }));
        anota(nome + ': o cartão da cancelada mostra o estado, o motivo e quem cancelou', jaCanc.txt.includes('TURMA CANCELADA') && jaCanc.txt.includes('Falta de quórum') && jaCanc.txt.includes('ADMIN'), jaCanc.txt.slice(0, 200));
        const proibidos = ['Participante', 'Encerrar interesse', 'Reabrir', 'Encerrar como concluída', 'Cancelar turma', 'Abrir check-in', 'Liberar avaliação', 'Sorteio'];
        anota(nome + ': a cancelada não oferece nada que ponha gente nela nem que a faça acontecer', !jaCanc.botoes.some((b) => proibidos.some((p) => b.includes(p))) && jaCanc.botoes.some((b) => b.includes('CSV')) && jaCanc.confirmar === 0, jaCanc.botoes.join(' | '));
        const concl = await cartao(page, 'tConcl', (c) => ({ txt: c.innerText, botoes: Array.from(c.querySelectorAll('.taa-dropdown button')).map((b) => b.textContent.trim()) }));
        anota(nome + ': a turma encerrada antes aparece como concluída e não pode ser cancelada', concl.txt.includes('TURMA CONCLUÍDA') && !concl.botoes.some((b) => b.includes('Cancelar turma')), concl.txt.slice(0, 160));

        /* cancelar a turma com o interesse aberto */
        const antes = await page.evaluate(() => (window.__ESCRITAS || []).length);
        await page.evaluate(() => document.querySelector('#turma-actions-tAberta .turma-cancelar-btn').click());
        await page.waitForSelector('[data-cancelar-turma]');
        const caixaCabe = await page.evaluate(() => { const r = document.querySelector('[data-cancelar-turma]').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; });
        anota(nome + ': a caixa cabe na tela', caixaCabe);
        if (process.env.FA_SHOTS) await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'canc-caixa-' + opt.viewport.width + '.png') });
        await tocar(page, '.turma-cancelar-confirmar');
        const erroSem = await page.evaluate(() => { const e = document.querySelector('[data-cancelar-turma] .admin-motivo-erro'); return !e.hidden && /motivo/i.test(e.textContent); });
        await page.selectOption('.turma-cancelar-motivo', 'outro');
        const campo = await page.evaluate(() => {
          const j = document.querySelector('.turma-cancelar-just'), s = document.querySelector('.turma-cancelar-motivo'), rj = j.getBoundingClientRect(), rs = s.getBoundingClientRect(), cj = getComputedStyle(j), cs = getComputedStyle(s);
          const rot = document.querySelector('.turma-cancelar-just-campo'), r = document.createRange(); r.selectNode(rot.firstChild);
          return { largura: Math.abs(rj.width - rs.width) <= 1, fundo: cj.backgroundColor === cs.backgroundColor, cor: cj.color === cs.color, abaixoDoRotulo: rj.top >= r.getBoundingClientRect().bottom - 1, fonte: cj.fontFamily === cs.fontFamily };
        });
        anota(nome + ': a justificativa segue o padrão do campo de motivo: mesma largura, fundo, cor e fonte, abaixo do rótulo', Object.values(campo).every(Boolean), JSON.stringify(campo));
        if (process.env.FA_SHOTS) {
          await page.fill('.turma-cancelar-just', 'Decisão da GETHO de priorizar a Turma de Gerentes Executivos');
          await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'canc-just-' + opt.viewport.width + '.png') });
          await page.fill('.turma-cancelar-just', '');
        }
        await tocar(page, '.turma-cancelar-confirmar');
        const erroJust = await page.evaluate(() => { const e = document.querySelector('[data-cancelar-turma] .admin-motivo-erro'); return !e.hidden && /justificativa/i.test(e.textContent) && !document.querySelector('.turma-cancelar-just-campo').hidden; });
        const nada = await page.evaluate((a) => (window.__ESCRITAS || []).length === a, antes);
        anota(nome + ': sem motivo, ou "Outro" sem justificativa, nada é gravado', erroSem && erroJust && nada);
        await page.fill('.turma-cancelar-just', 'Reforma da sala');
        await tocar(page, '.turma-cancelar-confirmar');
        await esperarCondicao(page, () => !document.querySelector('[data-cancelar-turma]'), null, { limite: 8000, descricao: 'a caixa fechar' });
        const esc = await page.evaluate((a) => (window.__ESCRITAS || []).slice(a).map((e) => ({ path: e.path, valor: e.valor })), antes);
        const c = (esc.find((e) => e.path === 'turmas-config/tAberta/cancelamento') || {}).valor || {};
        anota(nome + ': grava motivo, justificativa, data e responsável', c.motivo === 'outro' && c.justificativa === 'Reforma da sala' && c.por === ADM && c.porNome === 'ADMIN' && !!Date.parse(c.em), JSON.stringify(esc));
        anota(nome + ': não usa encerrada nem dataConclusao, e não toca em pessoas, histórico nem fila',
          !esc.some((e) => /encerrada|dataConclusao|turmas-interesse|fa-espera/.test(e.path)), JSON.stringify(esc.map((e) => e.path)));
        anota(nome + ': fecha a avaliação da turma', esc.some((e) => e.path === 'turmas/tAberta/avaliacaoHabilitada' && e.valor === false));
        await esperarCondicao(page, () => { const b = document.querySelector('#turma-actions-tAberta'); return b && (b.closest('.turma-admin-card') || b.parentElement.parentElement).innerText.includes('TURMA CANCELADA'); }, null, { limite: 8000, descricao: 'o cartão atualizado' });
        anota(nome + ': o cartão passa a mostrar a turma cancelada', true);
        if (process.env.FA_SHOTS) {
          await page.evaluate(() => {
            document.documentElement.style.scrollBehavior = 'auto';
            const a = document.querySelector('#turma-actions-tJaCanc');
            if (a.offsetParent === null) document.querySelector('[data-ev-key="evGrupo"] .ev-toggle-icon').click();
            a.scrollIntoView({ block: 'center' });
          });
          await page.waitForTimeout(200);
          await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'canc-cartao-' + opt.viewport.width + '.png') });
        }

        /* a pessoa da fila: a cancelada não aparece como destino */
        await esperarCondicao(page, () => !!document.querySelector('.espera-tirar-btn'), null, { limite: 8000, descricao: 'a lista de espera' });
        await page.evaluate(() => document.querySelector('.espera-tirar-btn').click());
        await esperarCondicao(page, () => !!document.querySelector('.modal-box .mov-destino'), null, { limite: 8000, descricao: 'a caixa de destino' });
        const destinos = await page.evaluate(() => Array.from(document.querySelectorAll('.modal-box option')).map((o) => o.value));
        anota(nome + ': turma cancelada não é destino de movimentação; a outra é', destinos.includes('tOutra') && !destinos.includes('tJaCanc') && !destinos.includes('tAberta'), destinos.join(','));
        await page.evaluate(() => document.querySelector('.modal-box .admin-modal-cancel-btn').click());

        /* regras: as duas portas, a do banco lido na hora e a pura */
        const regras = await page.evaluate(() => new Promise((res) => {
          const U = window.faTurmasUtil, ck = (e) => e.toLowerCase().replace(/[@.]/g, '_');
          U.regrasDeEntrada({ eventoKey: 'evDepois', eKey: ck('ana@previ.com.br'), turmaKey: 'tDepois' }, (a) => {
            U.regrasDeEntrada({ eventoKey: 'evDepois', eKey: ck('bia@previ.com.br'), turmaKey: 'tDepois' }, (b) => {
              U.regrasDeEntrada({ eventoKey: 'evGrupo', eKey: ck('ana@previ.com.br'), turmaKey: 'tOutra' }, (g) => {
                const db = window.__CFG.db, dados = { eventos: db.eventos, turmas: db.turmas, interesses: db['turmas-interesse'], config: db['turmas-config'] };
                res({ a: a.estado, b: b.estado + ':' + b.regra, g: g.estado,
                  puraAna: U.conflitosDeParticipacao(dados, 'evDepois', ck('ana@previ.com.br'), 'tDepois').participacao.length,
                  puraBia: U.conflitosDeParticipacao(dados, 'evDepois', ck('bia@previ.com.br'), 'tDepois').participacao.length,
                  puraGrupo: U.conflitosDeParticipacao(dados, 'evGrupo', ck('ana@previ.com.br'), 'tOutra').umaTurma.length });
              });
            });
          });
        }));
        anota(nome + ': inscrição em turma cancelada não impede outro evento; em turma que vale, continua impedindo', regras.a === 'livre' && regras.puraAna === 0 && regras.b === 'bloqueado:participacao', JSON.stringify(regras));
        anota(nome + ': "uma turma por pessoa": a cancelada não conta', regras.g === 'livre' && regras.puraGrupo === 0, JSON.stringify(regras));
        anota(nome + ': regra pura e regra lida do banco concordam', regras.puraBia === 1, JSON.stringify(regras));

        /* confirmar em outra turma: a inscrição da cancelada fica como está */
        const antes2 = await page.evaluate(() => (window.__ESCRITAS || []).length);
        await page.evaluate(() => document.querySelector('.cf-confirm-btn[data-turma="tOutra"]').click());
        await esperarCondicao(page, () => !!document.querySelector('.admin-modal-confirm-btn'), null, { limite: 8000, descricao: 'a confirmação' });
        await tocar(page, '.admin-modal-confirm-btn');
        await esperarCondicao(page, (a) => (window.__ESCRITAS || []).slice(a).some((e) => e.path.startsWith('turmas-interesse/tOutra')), antes2, { limite: 8000, descricao: 'a gravação' });
        const paths2 = await page.evaluate((a) => (window.__ESCRITAS || []).slice(a).map((e) => e.path), antes2);
        anota(nome + ': confirmar em outra turma não mexe na inscrição da turma cancelada', !paths2.some((p) => p.startsWith('turmas-interesse/tJaCanc')) && paths2.some((p) => p.startsWith('turmas-interesse/tOutra')), paths2.join(' | '));
        anota(nome + ': admin: sem rolagem lateral; nenhum erro de JavaScript', !erros.length && await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), erros.join(' | '));
        await ctx.close();
      }

      /* ── a página Turmas e a Minha Área, como a pessoa ── */
      {
        const { ctx, page, erros } = await abrir(browser, opt, ANA, 'turmas');
        await esperarCondicao(page, () => !!document.querySelector('[data-turma-key="tSoCanc"]'), null, { limite: 15000, descricao: 'os cards' });
        const cards = await page.evaluate(() => {
          const c = (k) => { const e = document.querySelector('[data-turma-key="' + k + '"]'); if (!e) return null;
            const g = e.closest('.turmas-evento-grupo'); return { t: e.innerText, botao: !!e.querySelector('button, a'), ev: g && g.getAttribute('data-evento-key'), fim: g && g.getAttribute('data-canceladas-evento') }; };
          const divs = Array.from(document.querySelectorAll('.turmas-periodo-divisor')), ult = divs[divs.length - 1];
          const so = document.querySelector('[data-turma-key="tSoCanc"]');
          return { canc: c('tJaCanc'), antes: c('tAntesCanc'), so: c('tSoCanc'), off: c('tOffCanc'), semVinculo: c('tFilaCanc'), concl: c('tConcl'), aberta: c('tOutra'), corpo: document.body.innerText,
            evSoNormal: !!document.querySelector('.turmas-evento-grupo[data-evento-key="evSoCanc"]'), evFila: !!document.querySelector('.turmas-evento-grupo[data-evento-key="evFilaCanc"]'),
            secaoUltima: !!ult && ult.textContent === 'Turmas canceladas' && !!(ult.compareDocumentPosition(so) & Node.DOCUMENT_POSITION_FOLLOWING) };
        });
        anota(nome + ': página Turmas: com vínculo ativo, "Turma cancelada", sem botão', /Turma cancelada/i.test(cards.canc && cards.canc.t) && /não será realizada/.test(cards.canc.t) && !cards.canc.botao, JSON.stringify(cards.canc));
        anota(nome + ': evento com outra turma à vista: posição normal', cards.canc.ev === 'evGrupo' && cards.antes && cards.antes.ev === 'evAntes' && cards.aberta !== null, JSON.stringify([cards.canc.ev, cards.antes]));
        anota(nome + ': sem outra turma à vista: seção final "Turmas canceladas", também para interesse', cards.so && cards.so.fim === 'evSoCanc' && !cards.so.botao && cards.secaoUltima && !cards.evSoNormal, JSON.stringify(cards.so));
        anota(nome + ': sem vínculo nela, não aparece; evento despublicado fica fora da página', cards.semVinculo === null && cards.off === null && cards.evFila, JSON.stringify([cards.semVinculo, cards.off]));
        anota(nome + ': a concluída continua "Turma realizada"; motivo e justificativa fora da tela', cards.concl && /Turma realizada/i.test(cards.concl.t) && !/quórum|Falta de/i.test(cards.corpo), JSON.stringify(cards.concl));
        if (process.env.FA_SHOTS) {
          await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('[data-turma-key="tJaCanc"]').scrollIntoView({ block: 'center' }); });
          await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'vinc-normal-' + opt.viewport.width + '.png') });
          await page.evaluate(() => Array.from(document.querySelectorAll('.turmas-periodo-divisor')).pop().scrollIntoView({ block: 'start' }));
          await page.evaluate(() => window.scrollBy(0, -90));
          await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'vinc-fim-' + opt.viewport.width + '.png') });
        }
        await page.evaluate(() => { location.hash = '#minha-area'; });
        await esperarCondicao(page, () => document.querySelectorAll('.aluno-grupo').length > 0, null, { limite: 15000, descricao: 'a Minha Área' });
        const area = await page.evaluate(() => {
          const g = Array.from(document.querySelectorAll('.aluno-grupo')).find((x) => x.textContent.includes('Canceladas'));
          return { grupos: Array.from(document.querySelectorAll('.aluno-grupo')).map((x) => x.textContent), cards: Array.from(document.querySelectorAll('.aluno-card--expansivel')).map((c) => c.textContent),
            canceladas: g ? Array.from(g.nextElementSibling.querySelectorAll('.aluno-card--expansivel')).map((c) => c.textContent) : [], corpo: document.querySelector('#page-minha-area').textContent,
            info: Array.from(document.querySelectorAll('.aluno-card--info')).map((c) => c.textContent), ocultar: Array.from(document.querySelectorAll('#page-minha-area button')).filter((b) => /ocultar|dispensar/i.test(b.textContent)).length };
        });
        const cardCanc = area.canceladas.find((c) => c.includes('TURMA JA CANCELADA')) || '', cardConcl = area.cards.find((c) => c.includes('TURMA CONCLUIDA')) || '';
        anota(nome + ': Minha Área: inscrição em "Canceladas", identificada, sem certificado e sem frequência', area.canceladas.length === 2 && /Turma cancelada/.test(cardCanc) && /não será realizada/.test(cardCanc) && !/Certificado liberado|Baixar PNG|Sua frequência|Avaliar/.test(cardCanc), cardCanc.slice(0, 240));
        const intCanc = area.info.find((c) => c.includes('TURMA SO CANCELADA')) || '', intOff = area.info.find((c) => c.includes('TURMA OFF CANCELADA')) || '';
        anota(nome + ': Minha Área: interesse no mesmo agrupamento, com o aviso e sem "a confirmação da vaga"; evento despublicado continua aqui', /Turma cancelada/.test(intCanc) && /não será realizada/.test(intCanc) && !/confirmação da vaga|Em análise/i.test(intCanc) && /Turma cancelada/.test(intOff), intCanc.slice(0, 240));
        anota(nome + ': Minha Área: sem o motivo e sem botão de ocultar', !/quórum|Falta de/i.test(area.corpo) && area.ocultar === 0);
        anota(nome + ': Minha Área: a concluída continua com o certificado', area.grupos.some((g) => g.includes('Concluídas')) && /Certificado/.test(cardConcl), cardConcl.slice(0, 200));
        if (process.env.FA_SHOTS) {
          await page.evaluate(() => { const g = Array.from(document.querySelectorAll('.aluno-grupo')).find((x) => x.textContent.includes('Canceladas')); document.documentElement.style.scrollBehavior = 'auto'; g.nextElementSibling.querySelector('summary').click(); g.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90); });
          await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'vinc-area-' + opt.viewport.width + '.png') });
        }
        anota(nome + ': pessoa: sem rolagem lateral; nenhum erro de JavaScript', !erros.length && await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), erros.join(' | '));
        await ctx.close();
      }

      /* ── check-in e facilitador ── */
      {
        const { ctx, page, erros } = await abrir(browser, opt, ANA, 'checkin?turma=tJaCanc');
        await esperarCondicao(page, () => /foi cancelada/.test(document.body.innerText), null, { limite: 15000, descricao: 'a recusa do check-in' });
        anota(nome + ': check-in recusa em turma cancelada', true);
        await page.evaluate(() => { location.hash = '#facilitador'; });
        await esperarCondicao(page, () => /Canceladas \(1\)/.test(document.body.innerText), null, { limite: 15000, descricao: 'o grupo Canceladas do facilitador' });
        const fac = await page.evaluate(() => {
          const h = Array.from(document.querySelectorAll('#page-facilitador h3')), grid = (n) => { const x = h.find((e) => e.textContent.startsWith(n)); return x ? x.nextElementSibling : null; };
          return { canc: grid('Canceladas').innerText, roteiroCanc: Array.from(grid('Canceladas').querySelectorAll('button')).filter((b) => /roteiro/i.test(b.textContent)).length, roteiroConcl: Array.from(grid('Concluídas').querySelectorAll('button')).filter((b) => /roteiro/i.test(b.textContent)).length };
        });
        anota(nome + ': área do facilitador: "Canceladas", identificada e sem "Abrir roteiro"; a outra turma mantém o roteiro', /TURMA JA CANCELADA/.test(fac.canc) && /Turma cancelada/.test(fac.canc) && !/quórum/i.test(fac.canc) && fac.roteiroCanc === 0 && fac.roteiroConcl === 1, JSON.stringify(fac));
        if (process.env.FA_SHOTS) {
          await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; Array.from(document.querySelectorAll('#page-facilitador h3')).find((e) => e.textContent.startsWith('Canceladas')).scrollIntoView({ block: 'center' }); });
          await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'vinc-fac-' + opt.viewport.width + '.png') });
        }
        anota(nome + ': check-in e facilitador: nenhum erro de JavaScript', !erros.length, erros.join(' | '));
        await ctx.close();
      }
    }

    /* ── quem não tem vínculo ativo: nada de turma cancelada ── */
    for (const [nome, opt] of [
      ['1280 px', { viewport: { width: 1280, height: 800 } }],
      ['375 px', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]
    ]) {
      for (const [quem, email] of [['sem vínculo', NOVO], ['removida', REM], ['transferida', TRA], ['só na fila, vinda da turma', FILAO]]) {
        const { ctx, page, erros } = await abrir(browser, opt, email, 'turmas');
        await esperarCondicao(page, () => !!document.querySelector('[data-turma-key="tOutra"]'), null, { limite: 15000, descricao: 'os cards' });
        await page.waitForTimeout(400);
        const pag = await page.evaluate(() => ({ cards: ['tJaCanc', 'tAntesCanc', 'tSoCanc', 'tFilaCanc', 'tOffCanc'].filter((k) => document.querySelector('[data-turma-key="' + k + '"]')), texto: /Turma cancelada|Turmas canceladas/i.test(document.body.innerText) }));
        anota(nome + ' · ' + quem + ': a página Turmas não mostra turma cancelada', !pag.cards.length && !pag.texto, JSON.stringify(pag));
        await page.evaluate(() => { location.hash = '#minha-area'; });
        await esperarCondicao(page, () => { const s = document.querySelector('#page-minha-area'); return !!s && !/Carregando/i.test(s.innerText) && s.innerText.length > 60; }, null, { limite: 15000, descricao: 'a Minha Área' });
        await page.waitForTimeout(300);
        const ma = await page.evaluate(() => document.querySelector('#page-minha-area').textContent);
        anota(nome + ' · ' + quem + ': a Minha Área não mostra turma cancelada', !/TURMA JA CANCELADA|Turma cancelada|Canceladas/.test(ma) && (email !== FILAO || /Lista de espera/.test(ma)), ma.slice(0, 200));
        anota(nome + ' · ' + quem + ': nenhum erro de JavaScript', !erros.length, erros.join(' | '));
        await ctx.close();
      }
    }

    /* ── leitura lenta e leitura que falha ── */
    for (const [nome, opt] of [
      ['1280 px', { viewport: { width: 1280, height: 800 } }],
      ['375 px', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]
    ]) {
      {
        const { ctx, page, erros } = await abrir(browser, opt, ANA, 'turmas', { delays: { 'turmas-interesse/tSoCanc': 14000 } });
        await esperarCondicao(page, () => !!document.querySelector('[data-turma-key="tOutra"]'), null, { limite: 15000, descricao: 'os cards' });
        const antes = await page.evaluate(() => !!document.querySelector('[data-turma-key="tSoCanc"]'));
        await esperarCondicao(page, () => !!document.querySelector('[data-turma-key="tSoCanc"]'), null, { limite: 25000, descricao: 'a cancelada depois da leitura lenta' });
        anota(nome + ': leitura lenta: a turma espera escondida, as outras não esperam, e ela aparece quando a resposta chega', !antes && !erros.length, erros.join(' | '));
        await ctx.close();
      }
      {
        const { ctx, page, erros } = await abrir(browser, opt, ANA, 'turmas', { fail: ['turmas-interesse/tSoCanc'] });
        await esperarCondicao(page, () => !!document.querySelector('[data-turma-key="tJaCanc"]'), null, { limite: 15000, descricao: 'a página' });
        await page.waitForTimeout(600);
        const r = await page.evaluate(() => ({ so: !!document.querySelector('[data-turma-key="tSoCanc"]'), outra: !!document.querySelector('[data-turma-key="tOutra"]'), rota: location.hash }));
        anota(nome + ': leitura que falha: só aquela turma fica escondida, sem expulsar nem quebrar', !r.so && r.outra && /turmas/.test(r.rota) && !erros.length, JSON.stringify(r) + erros.join(' | '));
        await ctx.close();
      }
      {
        const { ctx, page, erros } = await abrir(browser, opt, ANA, 'minha-area', { fail: ['turmas-interesse'] });
        await esperarCondicao(page, () => { const s = document.querySelector('#page-minha-area'); return !!s && !/Carregando/i.test(s.innerText); }, null, { limite: 20000, descricao: 'a Minha Área' });
        const r = await page.evaluate(() => ({ canc: /TURMA JA CANCELADA/.test(document.body.textContent), rota: location.hash }));
        anota(nome + ': Minha Área com leitura que falha: não mostra a turma, não expulsa, não quebra', !r.canc && /minha-area/.test(r.rota) && !erros.length, JSON.stringify(r) + erros.join(' | '));
        await ctx.close();
      }
    }

    /* ── Dashboard ── */
    {
      const { ctx, page, erros } = await abrir(browser, { viewport: { width: 1366, height: 900 } }, ADM, 'admin');
      await abaAdmin(page, 'Dashboard');
      await page.waitForSelector('.dash-stat-card', { timeout: 15000 });
      await page.waitForTimeout(200);
      const n = await page.evaluate(() => (document.body.innerText.match(/(\d+) inscritos?/i) || [])[1]);
      /* confirmadas fora de turma cancelada: tConcl (ANA) e tAntesVale (BIA). tJaCanc (2) e tAntesCanc (1) não contam */
      anota('Dashboard: quem está em turma cancelada não conta como participante', n === '2', 'lido: ' + n);
      /* Excel completo: as pessoas continuam na turma, e a situação diz que ela foi cancelada */
      await abaAdmin(page, 'Eventos');
      await esperarCondicao(page, () => !!document.querySelector('#exportExcelCompletoBtn'), null, { limite: 15000, descricao: 'o botão Excel completo' });
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.evaluate(() => document.querySelector('#exportExcelCompletoBtn').click())]);
      const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));
      const wb = XLSX.read(fs.readFileSync(await dl.path()), { type: 'buffer' });
      const est = XLSX.utils.sheet_to_json(wb.Sheets['Estado atual'], { defval: '' });
      const canc = est.filter((x) => x.Turma === 'TURMA JA CANCELADA'), concl = est.filter((x) => x.Turma === 'TURMA CONCLUIDA');
      anota('Excel completo: as pessoas seguem na turma cancelada, com a situação "Cancelada"; a concluída segue "Realizada"', canc.length === 2 && canc.every((x) => x['Situação da turma'] === 'Cancelada') && concl.length === 1 && concl[0]['Situação da turma'] === 'Realizada', JSON.stringify(canc.concat(concl).map((x) => x['Situação da turma'])));
      const vis = XLSX.utils.sheet_to_json(wb.Sheets['Visão por pessoa'], { defval: '' }), vCaio = vis.find((x) => x['E-mail'] === CAIO) || {};
      anota('Excel completo: Visão por pessoa mostra a inscrição como de turma cancelada, e ela não conta na classificação', vCaio['Inscrita em'] === 'EPISÓDIO SÓ CANCELADO › TURMA SO CANCELADA (turma cancelada)' && vCaio['Na lista de espera de'] === 'EPISÓDIO GRUPO (Entrou pela lista)' && vCaio['Interessada/Inscrita e na lista de espera?'] === 'Não', JSON.stringify(vCaio));
      anota('Dashboard: nenhum erro de JavaScript', !erros.length, erros.join(' | '));
      await ctx.close();
    }

    /* ── os motivos do site são os das regras ── */
    {
      const { ctx, page } = await abrir(browser, { viewport: { width: 1280, height: 800 } }, ADM, 'home');
      const chaves = await page.evaluate(() => window.faTurmasUtil.MOTIVOS_CANCELAMENTO.map((m) => m.key));
      await ctx.close();
      const regra = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8')).rules['turmas-config'].$turmaKey.cancelamento.motivo['.validate'];
      anota('os motivos do site são os mesmos das regras do banco', chaves.length === 4 && chaves.every((k) => regra.includes("'" + k + "'")) && (regra.match(/newData\.val\(\) ===/g) || []).length === 4, chaves.join(',') + ' / ' + regra);
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
