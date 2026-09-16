/* Painel Admin: dá para ALCANÇAR a lista de público restrito da turma.
 *
 * POR QUE ESTE TESTE EXISTE
 * Numa turma de público restrito, "＋ Participante" se recusa a achar quem
 * não está na lista dela — é o comportamento certo. O problema era o que
 * vinha depois: o modal mandava "feche isto e use 👥 Público restrito no
 * menu ⋯ da turma", e esse botão era o único caminho, escondido dentro do
 * ⋯. O selo "PÚBLICO RESTRITO DESTA TURMA · N", que é onde a mão vai, era
 * um <span> inerte: clicar nele não fazia nada.
 *
 * Aconteceu de verdade em 16/09/2026, com o evento FORÇA ÁGIL - EXECUTIVOS:
 * a admin já tinha incluído a pessoa na lista do EVENTO, não achou a lista
 * da TURMA, e a busca ainda dizia "Nenhum cadastro encontrado" + "peça que
 * ela faça o cadastro no site primeiro" — apontando para a causa errada,
 * porque a pessoa tinha cadastro havia semanas. A conclusão de quem lia
 * aquilo era esperar por um cadastro que já existia.
 *
 * Roda com o Firebase SUBSTITUÍDO pelo falso (.github/scripts/firebase-falso.js):
 * não precisa de segredo, de rede nem do banco real.
 *
 * O QUE ELE EXIGE, nos dois formatos de tela:
 *   1. o selo de público restrito da turma é um botão de verdade e abre a
 *      lista DA TURMA (não a do evento);
 *   2. clicar no selo não recolhe o card da turma embaixo do modal;
 *   3. na busca de "＋ Participante" que não acha ninguém, o texto não culpa
 *      a falta de cadastro quando a lista é que está barrando;
 *   4. o aviso de público restrito leva à lista por um botão, em vez de
 *      mandar procurar no menu ⋯;
 *   5. o caminho inteiro funciona: incluir na lista pelo botão do aviso faz
 *      a pessoa passar a aparecer na busca de participante;
 *   6. nenhum erro de JavaScript não tratado.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM     = 'adm@previ.com.br';
const NATALIA = 'natalia.kinhirin@previ.com.br';
/* Está na lista DA TURMA e fora da lista DO EVENTO: o caso que a matrícula
   em massa tem de recusar, porque as duas listas se somam. */
const ADRIANA = 'adriana.pizarro@previ.com.br';
const EV      = 'evExec';
const TURMA   = 'tExec';
const EV2     = 'evOutro';
const TOUTRA  = 'tOutra';

/* O cenário real: NATALIA tem cadastro no site e já está na lista do EVENTO,
   mas não na lista da TURMA. As duas listas se somam, então ela fica de fora
   da busca — e é justamente aí que a admin precisa alcançar a lista da turma. */
function banco() {
  const users = {};
  users[chave(ADM)]     = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  users[chave(NATALIA)] = { name: 'NATALIA KINHIRIN', email: NATALIA, area: 'PRESI' };
  users[chave(ADRIANA)] = { name: 'ADRIANA PIZARRO', email: ADRIANA, area: 'DISEG' };
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };

  const naTurma = {};
  ['debora', 'ricardo', 'vitor', 'xaiane', 'anderson', 'dalton'].forEach((n, i) => {
    const e = n + '@previ.com.br';
    users[chave(e)] = { name: n.toUpperCase() + ' DA SILVA', email: e, area: 'GETHO' };
    naTurma[chave(e)] = { name: n.toUpperCase() + ' DA SILVA', email: e, area: 'GETHO', order: i };
  });

  const publicoEvento = {};
  publicoEvento[chave(NATALIA)] = { name: 'NATALIA KINHIRIN', email: NATALIA, area: 'PRESI' };
  Object.keys(naTurma).forEach((k) => { publicoEvento[k] = naTurma[k]; });
  /* ADRIANA entra só na lista da TURMA — de propósito. */
  const publicoTurma = Object.assign({}, naTurma);
  publicoTurma[chave(ADRIANA)] = { name: 'ADRIANA PIZARRO', email: ADRIANA, area: 'DISEG' };

  /* DEBORA já é inscrita noutra turma: a matrícula em massa tem de remover
     essa inscrição, como o "＋ Participante" faz — ninguém fica em duas. */
  const interesseOutra = {};
  interesseOutra[chave('debora@previ.com.br')] = {
    name: 'DEBORA DA SILVA', email: 'debora@previ.com.br', area: 'GETHO',
    status: 'inscrito', confirmedByAdmin: ADM, confirmedByAdminName: 'ADMIN',
    confirmedDate: '2026-09-01T10:00:00.000Z', date: '2026-09-01T10:00:00.000Z',
  };

  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      [EV]:  { nome: 'FORÇA ÁGIL - EXECUTIVOS', order: 1, publicado: true, cargaHoraria: '3.5', publicoRestrito: true },
      [EV2]: { nome: 'FORÇA ÁGIL - ABERTO', order: 2, publicado: true, cargaHoraria: '3.5' },
    },
    turmas: {
      [TURMA]:  { label: 'EXPERIÊNCIA EXECUTIVA MENTALIDADE ÁGIL + IA', eventoKey: EV, order: 1, dias: ['2027-09-16'], publicoRestrito: true },
      [TOUTRA]: { label: 'TURMA ABERTA', eventoKey: EV2, order: 1, dias: ['2027-10-20'] },
    },
    'turmas-interesse': { [TOUTRA]: interesseOutra },
    'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': { [TURMA]: publicoTurma }, 'eventos-publico': { [EV]: publicoEvento },
    'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

/* CLAUDE.md: 375px é a referência de celular deste repo, e nenhuma entrega
   está pronta se só funciona num dos dois formatos. */
const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1280, height: 900 } } },
  { nome: 'celular', opts: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
];

/* index.html já traz modais estáticos escondidos: "o modal" é sempre o
   visível, nunca o primeiro que o seletor encontrar. */
const AJUDANTE = `window.__boxVis = function () {
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.modal-overlay .modal-box'));
  for (var i = boxes.length - 1; i >= 0; i--) {
    var r = boxes[i].getBoundingClientRect();
    if (r.height > 0 && r.width > 0 && getComputedStyle(boxes[i]).display !== 'none') return boxes[i];
  }
  return null;
};`;

const esperarModal = (page) => page.waitForFunction(() => !!window.__boxVis(), { timeout: 10000 });

const textoDoModal = (page) => page.evaluate(() => {
  const box = window.__boxVis();
  return box ? (box.textContent || '').replace(/\s+/g, ' ').trim() : '';
});

const botaoDoModal = (page, re) => page.evaluate((fonte) => {
  const box = window.__boxVis();
  if (!box) return false;
  const b = Array.from(box.querySelectorAll('button')).find((x) => new RegExp(fonte, 'i').test(x.textContent || ''));
  if (!b) return false;
  b.click();
  return true;
}, re.source);

const fecharModal = async (page) => {
  await page.evaluate(() => {
    const box = window.__boxVis();
    const b = box && box.querySelector('.admin-modal-cancel-btn');
    if (b) b.click();
  });
  await page.waitForFunction(() => !window.__boxVis(), { timeout: 10000 });
};

/* Abre "＋ Participante" pelo menu ⋯ da turma (o caminho que já existia). */
const abrirAddParticipante = async (page) => {
  await page.evaluate((tk) => {
    document.querySelector('#turma-card-' + tk + ' .taa-more-btn').click();
  }, TURMA);
  await page.evaluate((tk) => {
    const b = Array.from(document.querySelectorAll('#turma-card-' + tk + ' .taa-dropdown button'))
      .find((x) => /Participante/.test(x.textContent || ''));
    b.click();
  }, TURMA);
  await esperarModal(page);
};

const buscarNaModal = async (page, seletor, termo) => {
  await page.fill(seletor, termo);
  await page.waitForTimeout(150);
};

/* A busca de "＋ Participante" aceita digitação antes de fa-users chegar.
   Medir nesse intervalo dá falso "não achou" — espera o campo sair do
   estado de carregamento antes de concluir qualquer coisa. */
const buscarParticipante = async (page, termo) => {
  await page.fill('#addPartSearch', termo);
  await page.waitForFunction(() => {
    const el = document.querySelector('#addPartResults');
    return el && getComputedStyle(el).display !== 'none' &&
      !/Carregando cadastros/i.test(el.textContent || '');
  }, { timeout: 10000 });
};

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (linha, ok, detalhe) => {
    if (ok) console.log('  ok    ' + linha);
    else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); }
  };

  for (const formato of FORMATOS) {
    console.log('\n===== ' + formato.nome.toUpperCase() + ' =====');
    const ctx = await browser.newContext(formato.opts);
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
    await page.addInitScript('window.__CFG = ' + JSON.stringify({
      db: banco(), user: { email: ADM, emailVerified: true, uid: 'u1' }, delayDefault: 20,
    }) + ';' + AJUDANTE);
    await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
    await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**fonts.gstatic.com**', (r) => r.abort());

    try {
      await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
      await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent));
        if (b) b.click();
      });
      await page.waitForSelector('[data-ev-key="' + EV + '"]', { timeout: 15000 });
      /* Expande o evento para chegar no card da turma. */
      await page.evaluate((k) => document.querySelector('[data-ev-key="' + k + '"] > div:first-child').click(), EV);
      await page.waitForSelector('#turma-card-' + TURMA, { timeout: 10000 });
      /* Expande o card da turma: só assim dá para provar que abrir a lista
         pelo selo NÃO o recolhe. */
      await page.evaluate((tk) => document.querySelector('#turma-card-' + tk + ' .turma-admin-title').click(), TURMA);
      await page.waitForTimeout(150);

      /* ── 1 e 2: o selo é botão, abre a lista DA TURMA e não recolhe o card ── */
      const selo = await page.evaluate((tk) => {
        const el = document.querySelector('#turma-card-' + tk + ' .js-pub-badge');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, texto: (el.textContent || '').trim(), altura: r.height, largura: r.width };
      }, TURMA);
      anota('o selo de público restrito da turma existe e é um botão',
        !!selo && selo.tag === 'BUTTON', selo ? 'veio <' + selo.tag + '>' : 'selo não encontrado');
      anota('o selo tem alvo de toque utilizável no celular (≥ 28px de altura)',
        !!selo && selo.altura >= 28, selo ? selo.altura + 'px' : '—');

      const corpoAntes = await page.evaluate((tk) =>
        getComputedStyle(document.querySelector('#turma-card-' + tk + ' .turma-admin-body')).display, TURMA);

      await page.click('#turma-card-' + TURMA + ' .js-pub-badge');
      await esperarModal(page);
      const txtSelo = await textoDoModal(page);
      anota('clicar no selo abre a lista DA TURMA',
        /Público restrito da turma/i.test(txtSelo), txtSelo.slice(0, 90));
      anota('a lista aberta pelo selo é a da turma, não a do evento',
        !/Público restrito do evento/i.test(txtSelo), txtSelo.slice(0, 90));

      const corpoDepois = await page.evaluate((tk) =>
        getComputedStyle(document.querySelector('#turma-card-' + tk + ' .turma-admin-body')).display, TURMA);
      anota('clicar no selo não recolhe o card da turma',
        corpoAntes === corpoDepois, 'antes=' + corpoAntes + ' depois=' + corpoDepois);
      await fecharModal(page);

      /* ── 3 e 4: a busca que não acha ninguém não culpa o cadastro, e o
            aviso leva à lista em vez de mandar procurar ── */
      await abrirAddParticipante(page);
      await buscarParticipante(page, 'nat');
      const semResultado = await page.evaluate(() =>
        (document.querySelector('#addPartResults').textContent || '').replace(/\s+/g, ' ').trim());
      anota('a busca realmente não oferece quem está fora da lista da turma',
        !/NATALIA/i.test(semResultado), semResultado.slice(0, 90));
      anota('o resultado vazio não culpa a falta de cadastro',
        !/cadastro/i.test(semResultado), semResultado.slice(0, 90));

      const txtAdd = await textoDoModal(page);
      anota('o modal não manda mais caçar o botão no menu ⋯',
        !/menu ⋯/i.test(txtAdd), txtAdd.slice(0, 140));
      anota('o texto de "não encontrou" não pede cadastro a quem já tem',
        !/Peça que ela faça o cadastro no site primeiro/i.test(txtAdd), txtAdd.slice(0, 140));

      /* ── 5: o caminho inteiro, do bloqueio até a pessoa aparecer na busca ── */
      const clicouLista = await botaoDoModal(page, /Abrir a lista desta turma/);
      anota('o aviso da turma traz um botão que abre a lista', clicouLista);
      await page.waitForFunction(() => {
        const box = window.__boxVis();
        return box && /Público restrito da turma/i.test(box.textContent || '');
      }, { timeout: 10000 });

      await page.waitForSelector('#pubSearch', { timeout: 10000 });
      await buscarNaModal(page, '#pubSearch', 'nat');
      const achouNaLista = await page.evaluate(() =>
        /NATALIA/i.test(document.querySelector('#pubResults').textContent || ''));
      anota('a lista da turma oferece quem tem cadastro e está fora dela', achouNaLista);

      await page.evaluate(() => {
        const li = Array.from(document.querySelectorAll('#pubResults li'))
          .find((x) => /NATALIA/i.test(x.textContent || ''));
        li.click();
      });
      /* A inclusão só conta quando ela reaparece na TABELA da lista (o modal
         recarrega do banco depois de gravar), não no resultado da busca. */
      await page.waitForFunction(() => {
        const box = window.__boxVis();
        const tabela = box && box.querySelector('.admin-table');
        return !!tabela && /NATALIA/i.test(tabela.textContent || '');
      }, { timeout: 10000 });
      await fecharModal(page);

      await page.waitForSelector('#turma-card-' + TURMA + ' .js-pub-badge', { timeout: 10000 });
      await page.waitForTimeout(300);
      await abrirAddParticipante(page);
      await buscarParticipante(page, 'nat');
      const agoraAparece = await page.evaluate(() =>
        /NATALIA/i.test(document.querySelector('#addPartResults').textContent || ''));
      anota('depois de incluída na lista, a pessoa aparece na busca de participante', agoraAparece);
      await fecharModal(page);

      /* ── 6: matricular de uma vez quem está na lista e não está na turma ──
         Porta nova para o estado "inscrita": tem de repetir as exigências das
         outras três (skill criterio-de-estado), não encurtá-las por ser em
         massa. Neste ponto a lista da turma tem 8 pessoas e a turma está
         vazia; ADRIANA está fora da lista do EVENTO e DEBORA já é inscrita
         noutra turma. */
      await page.evaluate(() => { window.__ESCRITAS = []; });
      await page.click('#turma-card-' + TURMA + ' .js-pub-badge');
      await esperarModal(page);
      /* O modal aparece já com "Carregando…": medir antes da tabela existir
         é medir a tela errada. */
      await page.waitForFunction(() => {
        const box = window.__boxVis();
        return !!(box && box.querySelector('.admin-table'));
      }, { timeout: 10000 });

      const rotuloBulk = await page.evaluate(() => {
        const box = window.__boxVis();
        const b = Array.from(box.querySelectorAll('button'))
          .find((x) => /Adicionar à turma/i.test(x.textContent || ''));
        return b ? (b.textContent || '').trim() : '';
      });
      anota('a lista oferece matricular de uma vez quem ainda não está na turma',
        /Adicionar à turma/i.test(rotuloBulk), rotuloBulk || 'botão não encontrado');
      anota('o botão conta as 8 que estão na lista e fora da turma',
        /\b8\b/.test(rotuloBulk), rotuloBulk);

      await botaoDoModal(page, /Adicionar à turma/);
      await page.waitForFunction(() => {
        const box = window.__boxVis();
        return box && /INSCRITAS\?/i.test(box.textContent || '');
      }, { timeout: 10000 });
      const txtConfirma = await textoDoModal(page);
      anota('a confirmação avisa que quem está fora da lista do EVENTO fica de fora',
        /ADRIANA/i.test(txtConfirma), txtConfirma.slice(0, 200));
      anota('a confirmação avisa que a inscrição em outra turma será removida',
        /DEBORA/i.test(txtConfirma) && /TURMA ABERTA/i.test(txtConfirma), txtConfirma.slice(0, 260));
      anota('a confirmação diz que são 7 (as 8 menos quem o evento barra)',
        /\b7\b/.test(txtConfirma), txtConfirma.slice(0, 120));

      await page.evaluate(() => window.__boxVis().querySelector('.admin-modal-confirm-btn').click());
      await page.waitForFunction(() => {
        const box = window.__boxVis();
        const tabela = box && box.querySelector('.admin-table');
        return !!tabela && (tabela.textContent.match(/Inscrita/g) || []).length >= 7;
      }, { timeout: 10000 });

      /* A prova numérica que a skill exige: o registro gravado pela porta
         nova, lido do próprio banco falso, tem de satisfazer o critério
         completo — status 'inscrito' E confirmedByAdmin — senão nasce gente
         "inscrita" sem acesso a nada, em silêncio (PR #113). */
      const escritas = await page.evaluate((t) => {
        const todas = window.__ESCRITAS || [];
        const novos = todas.filter((e) => e.path.indexOf('turmas-interesse/' + t + '/') === 0);
        return {
          novos: novos.map((e) => ({ path: e.path, v: e.valor })),
          removidas: todas.filter((e) => /\/removed$/.test(e.path)).map((e) => e.path),
        };
      }, TURMA);

      const completos = escritas.novos.filter((r) => r.v && r.v.status === 'inscrito' &&
        r.v.confirmedByAdmin && r.v.confirmedByAdminName && r.v.confirmedDate && !r.v.removed);
      anota('gravou 7 registros novos na turma', escritas.novos.length === 7, 'foram ' + escritas.novos.length);
      anota('TODOS os registros gravados passam no critério completo de inscrição',
        completos.length === escritas.novos.length,
        completos.length + ' de ' + escritas.novos.length + ' — ' + JSON.stringify(escritas.novos[0] && escritas.novos[0].v));
      anota('não gravou ninguém que o público restrito do evento barra',
        !escritas.novos.some((r) => r.path.indexOf(chave(ADRIANA)) !== -1),
        'ADRIANA foi gravada');
      anota('removeu a inscrição anterior em outra turma (ninguém fica em duas)',
        escritas.removidas.some((p) => p.indexOf(TOUTRA) !== -1 && p.indexOf(chave('debora@previ.com.br')) !== -1),
        JSON.stringify(escritas.removidas));

      await fecharModal(page);
      /* O leitor de verdade: o cabeçalho conta por inscricaoValida, que exige
         os dois campos. Se faltasse um, aqui apareceria 0 confirmados. */
      await page.waitForFunction((tk) => {
        const c = document.querySelector('#turma-card-' + tk);
        return c && /7 confirmados/.test(c.textContent || '');
      }, TURMA, { timeout: 10000 }).then(
        () => anota('o painel passa a contar as 7 como confirmadas', true),
        () => anota('o painel passa a contar as 7 como confirmadas', false,
          'cabeçalho não chegou a "7 confirmados"'));

      if (erros.length) anota('nenhum erro de JavaScript', false, erros[0]);
      else anota('nenhum erro de JavaScript', true);
    } catch (e) {
      falhas++;
      console.error('  FALHA inesperada (' + formato.nome + '): ' + e.message);
    } finally {
      await ctx.close();
    }
  }

  /* ── Rede lenta: "ainda não sei" não pode ser dito como "não tem" ──
     Com fa-users demorando, a busca abre vazia e aceita digitação. Antes,
     nesse intervalo, ela afirmava "Nenhum cadastro encontrado" sobre uma
     lista que ainda não tinha chegado — a mesma confusão que fez procurar
     problema no cadastro da pessoa em vez de esperar a leitura. */
  console.log('\n===== REDE LENTA (fa-users a 1,2s) =====');
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
    await page.addInitScript('window.__CFG = ' + JSON.stringify({
      db: banco(), user: { email: ADM, emailVerified: true, uid: 'u1' },
      delayDefault: 20, delays: { 'fa-users': 1200 },
    }) + ';' + AJUDANTE);
    await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
    await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**fonts.gstatic.com**', (r) => r.abort());

    try {
      await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.admin-tab-btn', { timeout: 20000 });
      await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent));
        if (b) b.click();
      });
      await page.waitForSelector('[data-ev-key="' + EV + '"]', { timeout: 20000 });
      await page.evaluate((k) => document.querySelector('[data-ev-key="' + k + '"] > div:first-child').click(), EV);
      await page.waitForSelector('#turma-card-' + TURMA, { timeout: 15000 });

      await abrirAddParticipante(page);
      await page.fill('#addPartSearch', 'deb');
      const enquantoCarrega = await page.evaluate(() =>
        (document.querySelector('#addPartResults').textContent || '').trim());
      anota('enquanto carrega, a busca diz que está carregando',
        /Carregando/i.test(enquantoCarrega), enquantoCarrega.slice(0, 80));
      anota('enquanto carrega, a busca NÃO afirma que não encontrou ninguém',
        !/Nenhum cadastro|Ninguém com esse nome/i.test(enquantoCarrega), enquantoCarrega.slice(0, 80));

      await page.waitForFunction(() =>
        /DEBORA/i.test(document.querySelector('#addPartResults').textContent || ''), { timeout: 15000 });
      anota('quando a leitura chega, o resultado aparece sozinho (sem redigitar)', true);

      anota('nenhum erro de JavaScript (rede lenta)', erros.length === 0, erros[0]);
    } catch (e) {
      falhas++;
      console.error('  FALHA inesperada (rede lenta): ' + e.message);
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTudo certo: a lista de público restrito da turma se alcança pelo selo e pelo próprio aviso que barra.');
})();
