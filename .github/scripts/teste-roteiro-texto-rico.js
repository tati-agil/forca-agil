/* Roteiro: abrir e salvar sem tocar num campo não pode corromper o texto.
 *
 * POR QUE ESTE TESTE EXISTE
 * As caixas de texto rico (Objetivo, Resultado esperado etc.) decidem se um
 * valor já é HTML "de verdade" (produzido pelo próprio editor) ou texto
 * puro antigo (de antes desta funcionalidade existir) olhando só se tem
 * alguma tag reconhecida — nunca se já tem uma entidade HTML (&amp; &nbsp;
 * etc.). Um valor sem NENHUMA tag mas com um "&" literal (um "&nbsp;"
 * digitado à mão, ou um "Riscos & Oportunidades" de verdade) cai sempre no
 * ramo "é texto puro" e é escapado de novo — TODA vez que a atividade é
 * aberta e salva, mesmo sem mexer naquele campo. Isso empilha: depois de
 * duas rodadas, "Texto &nbsp;Mostrar algo" virava "Texto &amp;amp;nbsp;
 * Mostrar algo" na tela — um "&amp;nbsp;" literal em vez de um espaço, sem
 * nenhum erro em lugar nenhum. Corrigido tornando o escape idempotente
 * (esc(esc(x)) === esc(x)): um "&" que já introduz uma entidade de verdade
 * não vira "&amp;" de novo.
 *
 * Roda com o Firebase falso (stateful — a escrita muda o banco de verdade e
 * os listeners são notificados), nos dois formatos de tela. Editar duas
 * vezes SEM tocar no campo é o próprio teste: se o valor mudar entre a
 * primeira e a segunda rodada, o escape não é idempotente.
 *
 * O QUE ELE EXIGE, em desktop e celular:
 *   1. um "&nbsp;" digitado à mão (texto puro antigo) abre, mostra um
 *      espaço de verdade (não o texto "&nbsp;" nem "&amp;nbsp;"), e depois
 *      de abrir+salvar 3 vezes sem editar, o valor gravado no banco é
 *      idêntico da 1ª à 3ª vez;
 *   2. um "&" de verdade (ex.: "Riscos & Oportunidades") continua exibindo
 *      "&" (não "&amp;") na tela, e o valor gravado também não muda entre
 *      as rodadas;
 *   3. nenhum erro de JavaScript não tratado.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');

const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br';

/* Duas atividades no mesmo dia: uma com "&nbsp;" digitado à mão (o caso que
   quebrava), outra com um "&" de verdade num texto comum — as duas sem
   NENHUMA tag HTML, que é justamente o que engana o "parece HTML?". */
function banco() {
  const users = {}; users[chave(ADM)] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  const admins = {}; admins[chave(ADM)] = { email: ADM };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev1: { nome: 'EVENTO TESTE', order: 1, publicado: true, cargaHoraria: '8' } },
    turmas: {},
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
    'roteiros-evento': {
      ev1: {
        dias: { d1: { ordem: 10, titulo: '' } },
        atividades: {
          a1: {
            diaKey: 'd1', ordem: 10, titulo: 'Atividade com nbsp digitado',
            tipo: 'Dinâmica', horaInicio: '09:00', horaFim: '09:20', duracaoMinutos: 20,
            objetivo: 'Texto &nbsp;Mostrar algo e como a falta de alinhamento atrapalha.',
          },
          a2: {
            diaKey: 'd1', ordem: 20, titulo: 'Atividade com & de verdade',
            tipo: 'Dinâmica', horaInicio: '09:20', horaFim: '09:40', duracaoMinutos: 20,
            objetivo: 'Riscos & Oportunidades da mudança.',
          },
        },
      },
    },
  };
}

async function abrirRoteiroBase(browser, formato) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(), user: { email: ADM, emailVerified: true, uid: 'u1' }, delayDefault: 15,
  }) + ';');
  await page.route('**/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
  await page.waitForTimeout(400);
  /* Clica no ÍCONE de expandir (▸), não na seção inteira: no celular o nome
     do evento fica espremido a largura 0 pelos botões do cabeçalho, e um
     clique no "centro" da seção inteira pode cair sobre "Editar evento" em
     vez de alternar a seção. O ícone sempre tem tamanho, nome ou não. */
  await page.locator('[data-ev-key="ev1"] .ev-toggle-icon').click();
  await page.waitForTimeout(300);
  await page.locator('[data-ev-key="ev1"] button', { hasText: 'Roteiro' }).first().click();
  await page.waitForTimeout(400);
  return { ctx, page, erros };
}

/* Abre "Editar" da N-ésima atividade da lista (0 = primeira), SEM tocar em
   nenhum campo, e clica Salvar — exatamente o caminho que reproduz o bug
   (editar outra coisa, ou só reabrir pra conferir, sem mexer no Objetivo). */
async function reabrirESalvarSemEditar(page, indiceAtividade) {
  await page.locator('.modal-box button', { hasText: 'Editar' }).nth(indiceAtividade).click();
  await page.waitForTimeout(250);
  const visivel = await page.locator('#rfObjetivo').innerText();
  await page.locator('.roteiro-form-salvar').click();
  await page.waitForTimeout(300);
  return visivel;
}

function lerObjetivoDoBanco(page, atividadeKey) {
  return page.evaluate((k) => window.__CFG.db['roteiros-evento'].ev1.atividades[k].objetivo, atividadeKey);
}

async function testarCaso(browser, formato, atividadeKey, indiceAtividade, rotulo) {
  const { ctx, page, erros } = await abrirRoteiroBase(browser, formato);
  const visiveis = [];
  const salvos = [];
  for (let i = 0; i < 3; i++) {
    visiveis.push(await reabrirESalvarSemEditar(page, indiceAtividade));
    salvos.push(await lerObjetivoDoBanco(page, atividadeKey));
  }
  await ctx.close();

  if (erros.length) throw new Error(`[${formato.nome}] ${rotulo}: erro de JS não tratado: ${erros[0]}`);

  for (let i = 1; i < salvos.length; i++) {
    if (salvos[i] !== salvos[0]) {
      throw new Error(
        `[${formato.nome}] ${rotulo}: o valor gravado MUDOU entre abrir+salvar sem editar (rodada 1: ${JSON.stringify(salvos[0])} · rodada ${i + 1}: ${JSON.stringify(salvos[i])}) — o escape não é idempotente, cada rodada acrescenta mais uma camada.`
      );
    }
  }
  return { visiveis, salvos };
}

(async () => {
  const FORMATOS = [
    { nome: 'desktop', opts: { viewport: { width: 1280, height: 800 } } },
    { nome: 'iPhone', opts: devices['iPhone 12'] },
  ];

  let falhas = 0;
  for (const formato of FORMATOS) {
    const browser = await chromium.launch();
    try {
      console.log(`\n== ${formato.nome} ==`);

      const nbsp = await testarCaso(browser, formato, 'a1', 0, '"&nbsp;" digitado à mão');
      if (/&amp;/.test(nbsp.visiveis[0]) || /&nbsp;/.test(nbsp.visiveis[0])) {
        throw new Error(`"&nbsp;" digitado deveria virar um espaço de verdade na tela, mas mostrou ${JSON.stringify(nbsp.visiveis[0])}`);
      }
      console.log(`  ok    "&nbsp;" digitado: mostra espaço de verdade, e ${JSON.stringify(nbsp.salvos[0])} se mantém idêntico em 3 rodadas`);

      const amp = await testarCaso(browser, formato, 'a2', 1, '"&" de verdade');
      if (!/Riscos & Oportunidades/.test(amp.visiveis[0]) || /&amp;/.test(amp.visiveis[0])) {
        throw new Error(`"&" de verdade deveria continuar mostrando "&" na tela, mas mostrou ${JSON.stringify(amp.visiveis[0])}`);
      }
      console.log(`  ok    "&" de verdade: continua mostrando "&", e ${JSON.stringify(amp.salvos[0])} se mantém idêntico em 3 rodadas`);
    } catch (e) {
      falhas++;
      console.error(`  FALHA [${formato.nome}]: ${e.message}`);
    } finally {
      await browser.close();
    }
  }

  if (falhas) { console.error(`\n${falhas} falha(s).`); process.exit(1); }
  console.log('\nTudo certo nos dois formatos.');
})();
