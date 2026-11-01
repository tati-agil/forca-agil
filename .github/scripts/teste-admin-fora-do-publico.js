/* ADMIN › Eventos: selo "Fora do público atual" — o sistema SINALIZA, o admin decide.
 *
 * POR QUE ESTE TESTE EXISTE
 * Quem manifestou interesse ou foi inscrita quando era do público pode deixar de ser (o cargo mudou, o público do evento
 * ou da turma mudou, saiu de uma lista). Ninguém é removido por isso: o painel só mostra, na linha da pessoa, o selo
 * "Fora do público atual" com o(s) motivo(s), e no card um aviso para os motivos que não são de lista (as listas já têm o
 * aviso próprio, com "Incluir na lista"). Turma realizada não gera alerta. O risco é duplo: acusar quem está certo
 * (falta de dado ≠ incompatível) ou calar quem está fora (falha de leitura ≠ compatível).
 *
 * Firebase falso, dados 100% sintéticos, eventos e turmas criados só aqui (nenhum nome, chave ou data de produção).
 * O QUE ELE EXIGE:
 *   1. cada motivo, calculado da configuração vigente: cargo do evento, cargo da turma, lista do evento, lista da turma,
 *      só diretores — e vários ao mesmo tempo;
 *   2. interessada e inscrita fora do público recebem o selo; quem continua no público, não;
 *   3. turma por vir e em andamento sinalizam; turma realizada (dias passados) e encerrada pelo admin, não;
 *   4. interesse removido e inscrição cancelada nunca recebem o selo;
 *   5. aviso do card só para cargo/diretores (sem repetir o de lista, que continua com "Incluir na lista");
 *   6. leitura de gerentes/diretores que falha: nenhum selo de cargo, aviso de "não consegui verificar"; o motivo de lista
 *      (lido à parte) continua; leitura lenta: nenhuma acusação antes de chegar;
 *   7. mudar o público do evento pelo ADMIN faz o selo aparecer, e "Incluir na lista" faz o de lista sumir — sem mexer em
 *      nenhum registro de participante;
 *   8. abrir o painel não grava nada; as ações de sempre (Confirmar, Remover) continuam na linha; Confirmar quem é do
 *      público grava o mesmo de sempre;
 *   9. desktop e 375 px sem rolagem lateral, sem erro de JS.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
function dia(o) { const d = new Date(); d.setDate(d.getDate() + o); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

const ADM = 'admin.fp@previ.com.br';
const P = {
  exGerInt: 'exger.interesse.fp@previ.com.br',   /* interesse; deixou de ser gerente */
  exGerIns: 'exger.inscrita.fp@previ.com.br',    /* inscrita; deixou de ser gerente */
  ger: 'gerente.fp@previ.com.br',                /* gerente: continua no público */
  removida: 'removida.fp@previ.com.br',          /* retirou o interesse */
  cancelada: 'cancelada.fp@previ.com.br',        /* inscrição cancelada */
  foraLista: 'foralista.fp@previ.com.br',        /* fora das listas do evento e da turma */
  gerEmTec: 'gerente.emtec.fp@previ.com.br',     /* gerente numa turma "só técnicos" */
  naoDir: 'naodiretor.fp@previ.com.br',          /* evento só de diretores, sem ser diretor */
  dir: 'diretor.fp@previ.com.br',                /* diretor: continua no público */
  multi: 'multi.fp@previ.com.br',                /* vários motivos ao mesmo tempo */
  aberto: 'aberto.fp@previ.com.br',              /* turma sem restrição nenhuma */
  mudara: 'mudara.fp@previ.com.br',              /* técnica num evento aberto que o admin vai mudar para Gerentes */
};
const nome = (e) => e.split('@')[0].toUpperCase().replace(/\./g, ' ');
const pessoa = (e) => ({ email: e, name: nome(e) });
const reg = (e, extra) => Object.assign({ name: nome(e), email: e, area: 'TI', status: 'interessado', removed: false, date: '2026-10-01T10:00:00.000Z' }, extra || {});
const inscrita = (e, extra) => reg(e, Object.assign({ status: 'inscrito', confirmedByAdmin: ADM, confirmedByAdminName: 'ADMIN' }, extra || {}));
const ev = (n, order, extra) => Object.assign({ nome: n, order, publicado: true, esperaAtiva: false }, extra || {});
const tu = (label, eventoKey, order, dias, extra) => Object.assign({ label, eventoKey, order, dias, horarioInicio: '09:00', horarioFim: '12:00' }, extra || {});

function banco() {
  const users = {}; Object.values(P).concat([ADM]).forEach((e) => { users[chave(e)] = { name: nome(e), email: e, area: 'TI', emailConfirmado: true }; });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: pessoa(ADM) },
    'fa-gerentes': { [chave(P.ger)]: pessoa(P.ger), [chave(P.gerEmTec)]: pessoa(P.gerEmTec) },
    'fa-diretores': { [chave(P.dir)]: pessoa(P.dir) },
    'fa-facilitadores': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      evG: ev('EVENTO SINTETICO DE GERENTES', 1, { publicoDesc: 'Gerentes' }),
      evL: ev('EVENTO SINTETICO DE LISTA', 2, { publicoRestrito: true }),
      evD: ev('EVENTO SINTETICO DE DIRETORES', 3, { restritoADiretores: true }),
      evA: ev('EVENTO SINTETICO ABERTO', 4),
      evM: ev('EVENTO SINTETICO RESTRITO EM TUDO', 5, { publicoDesc: 'Gerentes', publicoRestrito: true, restritoADiretores: true }),
    },
    turmas: {
      tGFut: tu('G POR VIR', 'evG', 1, [dia(20)]),
      tGAnd: tu('G EM ANDAMENTO', 'evG', 2, [dia(-1), dia(1)]),
      tGReal: tu('G REALIZADA', 'evG', 3, [dia(-15)]),
      tGEnc: tu('G ENCERRADA PELO ADMIN', 'evG', 4, [dia(25)]),
      tLFut: tu('L POR VIR', 'evL', 1, [dia(20)], { publicoRestrito: true }),
      tDFut: tu('D POR VIR', 'evD', 1, [dia(20)]),
      tATec: tu('A SO TECNICOS', 'evA', 1, [dia(20)], { publicoCargo: 'tecnicos' }),
      tAAberta: tu('A ABERTA', 'evA', 2, [dia(21)]),
      tMFut: tu('M POR VIR', 'evM', 1, [dia(20)], { publicoRestrito: true }),
    },
    'turmas-config': { tGEnc: { encerrada: true, dataConclusao: dia(-1) } },
    'turmas-interesse': {
      tGFut: { [chave(P.exGerInt)]: reg(P.exGerInt), [chave(P.exGerIns)]: inscrita(P.exGerIns), [chave(P.ger)]: reg(P.ger),
        [chave(P.removida)]: reg(P.removida, { status: 'removido', removed: true, removedDate: '2026-10-02T10:00:00.000Z' }),
        [chave(P.cancelada)]: inscrita(P.cancelada, { removed: true, removedDate: '2026-10-03T10:00:00.000Z' }) },
      tGAnd: { [chave(P.exGerIns)]: inscrita(P.exGerIns) },
      tGReal: { [chave(P.exGerIns)]: inscrita(P.exGerIns) },
      tGEnc: { [chave(P.exGerIns)]: inscrita(P.exGerIns) },
      tLFut: { [chave(P.foraLista)]: reg(P.foraLista) },
      tDFut: { [chave(P.naoDir)]: reg(P.naoDir), [chave(P.dir)]: inscrita(P.dir) },
      tATec: { [chave(P.gerEmTec)]: inscrita(P.gerEmTec) },
      tAAberta: { [chave(P.aberto)]: reg(P.aberto), [chave(P.mudara)]: reg(P.mudara) },
      tMFut: { [chave(P.multi)]: reg(P.multi) },
    },
    'turmas-interesse-log': {}, 'turmas-checkin': {}, 'turmas-sorteio': {}, 'turmas-equipe': {},
    'turmas-publico': { tLFut: {}, tMFut: {} }, 'eventos-publico': { evL: {}, evM: {} },
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrir(browser, viewport, mobile, rede) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'adm' }, delayDefault: 20 }, rede || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => /Eventos/i.test(x.textContent)), null, { limite: 15000, descricao: 'aba Eventos do ADMIN' });
  await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click());
  return { ctx, page, erros };
}
const esperarCards = (page, limite) => esperarCondicao(page, () => !!document.querySelector('#turma-card-tGFut .participantes-table') && !!document.querySelector('#turma-card-tMFut .participantes-table'), null, { limite: limite || 15000, descricao: 'os cards das turmas com a tabela de participantes' });

/* selos por turma: { turma: { emailKey: 'motivo motivo' } }, avisos do card e se a linha manteve as ações */
const ler = (page) => page.evaluate(() => {
  const out = { selos: {}, avisos: {}, falha: {}, acoes: {}, texto: {} };
  document.querySelectorAll('[id^="turma-card-"]').forEach((card) => {
    const tk = card.id.replace('turma-card-', '');
    card.querySelectorAll('.participantes-table tbody tr').forEach((tr) => {
      const btn = tr.querySelector('.cf-confirm-btn, .cf-unconfirm-btn');
      const k = btn && btn.dataset.ekey;
      if (!k) return;
      const selo = tr.querySelector('.motivo-fora-publico');
      if (selo) { (out.selos[tk] = out.selos[tk] || {})[k] = selo.getAttribute('data-fora-publico'); (out.texto[tk] = out.texto[tk] || {})[k] = (tr.querySelector('.fora-publico-motivos') || {}).textContent || ''; }
      (out.acoes[tk] = out.acoes[tk] || {})[k] = !!btn && !!tr.querySelector('.ck-remove-btn');
    });
    const a = card.querySelector('[data-aviso-fora-publico="1"]'); if (a) out.avisos[tk] = a.textContent;
    const f = card.querySelector('[data-aviso-fora-publico="falha"]'); if (f) out.falha[tk] = f.textContent;
  });
  /* o painel SEMEIA, ao abrir com o banco vazio, roteiro-tipos-atividade e um treinamento padrão (anterior a esta
     mudança, como em teste-editar-cadastro.js): só essas duas sementes são toleradas; qualquer outra gravação reprova */
  out.escritas = (window.__ESCRITAS || []).map((e) => e.path).filter((p) => !/^roteiro-tipos-atividade$|^treinamentos\/[^/]+$/.test(p));
  out.largura = document.documentElement.scrollWidth > document.documentElement.clientWidth;
  return out;
});

const ESPERADO = {
  tGFut: { [chave(P.exGerInt)]: 'cargo-evento', [chave(P.exGerIns)]: 'cargo-evento' },
  tGAnd: { [chave(P.exGerIns)]: 'cargo-evento' },
  tLFut: { [chave(P.foraLista)]: 'lista-evento lista-turma' },
  tDFut: { [chave(P.naoDir)]: 'diretores' },
  tATec: { [chave(P.gerEmTec)]: 'cargo-turma' },
  tMFut: { [chave(P.multi)]: 'cargo-evento lista-evento lista-turma diretores' },
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ordenado = (o) => JSON.stringify(Object.keys(o).sort().reduce((x, k) => { x[k] = typeof o[k] === 'object' ? JSON.parse(ordenado(o[k])) : o[k]; return x; }, {}));

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (r, ok, d) => { if (ok) console.log('  ok    ' + r); else { falhas++; console.error('  FALHA ' + r + (d ? ' → ' + d : '')); } };

  for (const [fmt, vp, mob] of [['1280', { width: 1280, height: 900 }, false], ['375', { width: 375, height: 812 }, true]]) {
    console.log('\n== ' + fmt + ' px ==');
    const { ctx, page, erros } = await abrir(browser, vp, mob);
    await esperarCards(page);
    const e = await ler(page);
    anota('cada motivo e cada combinação, da configuração vigente (cargo do evento e da turma, listas, diretores, vários juntos)', ordenado(e.selos) === ordenado(ESPERADO), JSON.stringify(e.selos));
    anota('quem continua no público (gerente, diretor, turma aberta) não recebe selo', !(e.selos.tGFut || {})[chave(P.ger)] && !(e.selos.tDFut || {})[chave(P.dir)] && !e.selos.tAAberta);
    anota('turma em andamento sinaliza; realizada e encerrada pelo admin NÃO', !!(e.selos.tGAnd || {})[chave(P.exGerIns)] && !e.selos.tGReal && !e.selos.tGEnc);
    anota('interesse removido e inscrição cancelada nunca recebem selo', !Object.values(e.selos).some((m) => m[chave(P.removida)] || m[chave(P.cancelada)]));
    anota('o motivo vem por extenso ao lado do selo (sem depender de passar o mouse)', /cargo incompatível com o público do evento \(só gerentes\)/.test(e.texto.tGFut[chave(P.exGerInt)]) && /cargo incompatível com o público da turma \(só técnicos\)/.test(e.texto.tATec[chave(P.gerEmTec)]) && /fora do público de diretores/.test(e.texto.tDFut[chave(P.naoDir)]), JSON.stringify(e.texto));
    anota('aviso do card só para cargo/diretores, sem repetir lista (a lista tem o aviso próprio)', !!e.avisos.tGFut && /2 pessoas estão fora do público atual/.test(e.avisos.tGFut) && !!e.avisos.tDFut && !e.avisos.tLFut && !e.avisos.tGReal && !/lista restrita/.test(e.avisos.tMFut || ''), JSON.stringify(e.avisos));
    const listaAviso = await page.evaluate(() => { const c = document.querySelector('#turma-card-tLFut'); return { aviso: Array.from(c.querySelectorAll('.turma-aviso-publico')).map((x) => x.textContent).join(' | '), botao: Array.from(c.querySelectorAll('button')).some((b) => /Incluir esta pessoa na lista/.test(b.textContent)) }; });
    anota('o aviso de lista de sempre continua, com "Incluir na lista"', /sem estar no público restrito/.test(listaAviso.aviso) && listaAviso.botao, JSON.stringify(listaAviso));
    anota('as ações de sempre (Confirmar/Desconfirmar e Remover) continuam na linha de quem tem selo', Object.keys(ESPERADO).every((tk) => Object.keys(ESPERADO[tk]).every((k) => e.acoes[tk][k])), JSON.stringify(e.acoes));
    anota('abrir o painel não grava nada; sem erro de JS; sem rolagem lateral', !e.escritas.length && !erros.length && !e.largura, JSON.stringify({ escritas: e.escritas, erros, largura: e.largura }));
    if (fmt === '375') {
      /* o card aberto, com o selo: a linha cabe (a tabela rola dentro do próprio quadro, nunca a página) */
      await page.evaluate(() => document.querySelector('#turma-card-tGFut .turma-admin-title').click());
      await esperarCondicao(page, () => getComputedStyle(document.querySelector('#turma-card-tGFut .turma-admin-body')).display !== 'none', null, { descricao: 'o card aberto' });
      const l = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      anota('375 px: card aberto com o selo, sem rolagem lateral da página', !l);
    }
    await ctx.close();
  }

  console.log('\n== leitura de gerentes/diretores que falha ==');
  {
    const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, false, { fail: ['fa-gerentes', 'fa-diretores'] });
    await esperarCards(page);
    const e = await ler(page);
    anota('falha: nenhum selo de cargo ou de diretores (falta de dado não é acusação)', !e.selos.tGFut && !e.selos.tGAnd && !e.selos.tDFut && !e.selos.tATec, JSON.stringify(e.selos));
    anota('falha: o card diz que não conseguiu verificar (não absolve ninguém)', !!e.falha.tGFut && /Não consegui ler a lista de gerentes ou de diretores/.test(e.falha.tGFut) && !!e.falha.tDFut, JSON.stringify(e.falha));
    anota('falha: o motivo de lista (lido à parte) continua valendo', igual(e.selos.tLFut, { [chave(P.foraLista)]: 'lista-evento lista-turma' }) && igual(e.selos.tMFut, { [chave(P.multi)]: 'lista-evento lista-turma' }), JSON.stringify({ l: e.selos.tLFut, m: e.selos.tMFut }));
    anota('falha: turma sem restrição de cargo nem de diretores não ganha aviso de falha', !e.falha.tAAberta && !e.falha.tLFut);
    anota('falha: nenhuma gravação, sem erro de JS', !e.escritas.length && !erros.length, JSON.stringify({ escritas: e.escritas, erros }));
    await ctx.close();
  }

  console.log('\n== leitura lenta: nenhuma acusação antes de chegar ==');
  {
    const { ctx, page, erros } = await abrir(browser, { width: 375, height: 812 }, true, { delays: { 'fa-gerentes': 4000 } });
    await page.waitForTimeout(1500);
    const antes = await page.evaluate(() => document.querySelectorAll('.motivo-fora-publico').length);
    anota('lento: antes de a lista de gerentes chegar, nenhum selo na tela', antes === 0, String(antes));
    await esperarCards(page, 20000);
    const e = await ler(page);
    anota('lento: quando chega, os selos esperados', ordenado(e.selos) === ordenado(ESPERADO), JSON.stringify(e.selos));
    anota('lento: nenhuma gravação, sem erro de JS', !e.escritas.length && !erros.length);
    await ctx.close();
  }

  console.log('\n== mudança de público pelo ADMIN: o selo acompanha, nenhum registro de participante muda ==');
  {
    const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, false);
    await esperarCards(page);
    /* o evento aberto passa a ser de Gerentes: quem está nele e não é gerente ganha o selo, sem perder nada */
    await page.evaluate(() => { window.__ESCRITAS = []; });
    await esperarCondicao(page, () => !!document.querySelector('[data-ev-key="evA"]'), null, { descricao: 'o evento aberto no ADMIN' });
    await page.evaluate(() => Array.from(document.querySelectorAll('[data-ev-key="evA"] button')).find((x) => /Editar evento/.test(x.textContent)).click());
    await esperarCondicao(page, () => !!document.querySelector('#eventoFormPublicoDesc'), null, { descricao: 'o formulário do evento' });
    await page.selectOption('#eventoFormPublicoDesc', 'Gerentes');
    await page.click('.modal-box .admin-modal-save-btn');
    await esperarCondicao(page, (k) => !!document.querySelector('#turma-card-tAAberta .motivo-fora-publico') && Array.from(document.querySelectorAll('#turma-card-tAAberta .motivo-fora-publico')).length === 2, null, { limite: 15000, descricao: 'o selo depois da mudança do público do evento' });
    const e1 = await ler(page);
    anota('público do evento mudou: as duas técnicas da turma aberta ganham o selo (cargo do evento)', igual(e1.selos.tAAberta, { [chave(P.aberto)]: 'cargo-evento', [chave(P.mudara)]: 'cargo-evento' }), JSON.stringify(e1.selos.tAAberta));
    anota('público do evento mudou: gravado SÓ eventos/evA — nenhum registro de participante, lista, cargo ou histórico', igual(e1.escritas, ['eventos/evA']), JSON.stringify(e1.escritas));
    /* "Incluir na lista" (ação de sempre): o selo de lista some sozinho, e a gravação é só na lista */
    await page.evaluate(() => { window.__ESCRITAS = []; });
    await page.evaluate(() => Array.from(document.querySelectorAll('#turma-card-tLFut button')).filter((b) => /Incluir esta pessoa na lista/.test(b.textContent))[0].click());
    await esperarCondicao(page, () => { const s = document.querySelector('#turma-card-tLFut .motivo-fora-publico'); return !!s && s.getAttribute('data-fora-publico') !== 'lista-evento lista-turma'; }, null, { limite: 15000, descricao: 'o selo de lista mudar depois de incluir na lista' });
    const e2 = await ler(page);
    anota('"Incluir na lista" de sempre: o motivo daquela lista some, sem mexer no registro da pessoa', igual(e2.selos.tLFut, { [chave(P.foraLista)]: 'lista-evento' }) && e2.escritas.every((p) => /^(turmas|eventos)-publico\//.test(p)), JSON.stringify({ selo: e2.selos.tLFut, escritas: e2.escritas }));
    /* Confirmar quem é do público: a porta de sempre, gravando o de sempre */
    await page.evaluate(() => { window.__ESCRITAS = []; });
    await page.evaluate((k) => document.querySelector('#turma-card-tGFut .cf-confirm-btn[data-ekey="' + k + '"]').click(), chave(P.ger));
    await esperarCondicao(page, () => Array.from(document.querySelectorAll('.modal-box')).some((b) => /Confirmar/.test(b.textContent) && b.querySelector('.admin-modal-confirm-btn')), null, { descricao: 'a confirmação de sempre' });
    await page.evaluate(() => Array.from(document.querySelectorAll('.modal-box')).find((b) => b.querySelector('.admin-modal-confirm-btn')).querySelector('.admin-modal-confirm-btn').click());
    await esperarCondicao(page, () => (window.__ESCRITAS || []).some((x) => /^turmas-interesse-log\//.test(x.path)), null, { descricao: 'a gravação da confirmação' });
    const e3 = await ler(page);
    const k = chave(P.ger);
    anota('Confirmar quem é do público: grava só o registro dela e o histórico, como sempre', e3.escritas.length > 0 && e3.escritas.every((p) => p.indexOf('turmas-interesse/tGFut/' + k + '/') === 0 || p.indexOf('turmas-interesse-log/tGFut/' + k) === 0), JSON.stringify(e3.escritas));
    anota('mudanças pelo ADMIN: sem erro de JS', !erros.length, erros[0]);
    await ctx.close();
  }

  await browser.close();
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTUDO OK.');
})();
