/* Turmas: COMUNICAÇÃO das restrições de participação (só exibição).
 *
 * POR QUE ESTE TESTE EXISTE
 * Público decide quem VÊ (PR #452); restrição de participação (participação anterior, uma turma por pessoa, vagas,
 * inscrições encerradas) decide se quem vê pode manifestar interesse — e só explica, nunca esconde. Quando a mesma
 * restrição vale para várias turmas do evento, a explicação vai UMA vez para o cabeçalho do evento e os cards só remetem
 * a ela; a participação anterior cita TODOS os eventos bloqueadores em que a pessoa tem registro, pelo nome só quando ela
 * pode ver o evento. Nenhuma regra muda: o mesmo botão bloqueado, a mesma ordem das verificações.
 *
 * Firebase falso, dados 100% sintéticos (eventos, turmas e pessoas criados só aqui). O QUE ELE EXIGE:
 *   1. fora do público: o evento de cargo continua invisível (PR #452); "Mostrar para todos": o aviso de público de
 *      sempre, e a mensagem de cargo NÃO vira aviso de evento;
 *   2. sem impedimento: os botões de sempre; "Inscrições encerradas" sem dizer que as vagas acabaram;
 *   3. participação anterior: o evento e as turmas continuam visíveis, nenhum botão disponível, a explicação UMA vez no
 *      evento e os cards remetendo a ela;
 *   4. dois eventos bloqueadores: os dois citados, distinguindo inscrição confirmada de interesse registrado;
 *   5. bloqueador que ela não pode ver (lista restrita sem vínculo, ou despublicado): citado como "outro evento
 *      anterior", sem o nome;
 *   6. interesse anterior não removido continua bloqueando; removido, não (regra de sempre);
 *   7. turma lotada só numa turma: a mensagem fica naquele card, sem aviso geral;
 *   8. outra turma do grupo: o próprio vínculo intacto (Remover interesse / inscrita) e a regra de troca, uma vez;
 *   9. duas restrições juntas: vale a prioridade de sempre (participação antes de vagas);
 *  10. rede lenta: nada de aviso enquanto há "Verificando…"; leitura que falha: o botão continua bloqueado, a mensagem
 *      nova de falha no card, nenhum aviso geral;
 *  11. participação histórica (PR #452) intacta;
 *  12. nenhuma gravação, nenhum erro de JS, sem rolagem lateral; 1280 e 375 px.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
function dia(o) { const d = new Date(); d.setDate(d.getDate() + o); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

const P = {
  livre: 'livre.rp@previ.com.br', part1: 'part1.rp@previ.com.br', part2: 'part2.rp@previ.com.br', priv: 'priv.rp@previ.com.br',
  removido: 'removido.rp@previ.com.br', velho: 'velho.rp@previ.com.br', umaTurma: 'umaturma.rp@previ.com.br', inscrita: 'inscrita.rp@previ.com.br',
};
const nome = (e) => e.split('@')[0].toUpperCase().replace(/\./g, ' ');
const reg = (e, extra) => Object.assign({ name: nome(e), email: e, area: 'TI', status: 'interessado', removed: false, date: '2026-09-01T10:00:00.000Z' }, extra || {});
const insc = (e, extra) => reg(e, Object.assign({ status: 'inscrito', confirmedByAdmin: 'adm.rp@previ.com.br' }, extra || {}));
const ev = (n, order, extra) => Object.assign({ nome: n, order, publicado: true, esperaAtiva: false, missaoTexto: 'Sobre ' + n + '.' }, extra || {});
const tu = (label, eventoKey, order, dias, extra) => Object.assign({ label, eventoKey, order, dias, horarioInicio: '09:00', horarioFim: '12:00' }, extra || {});

function banco() {
  const users = {}; Object.values(P).forEach((e) => { users[chave(e)] = { name: nome(e), email: e, area: 'TI', emailConfirmado: true }; });
  const ocupa = (n) => ({ [n + '_x']: reg(n + '@outro.previ.com.br') });
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-gerentes': {}, 'fa-facilitadores': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      evB1: ev('BLOQUEADOR UM SINTETICO', 1),
      evB2: ev('BLOQUEADOR DOIS SINTETICO', 2),
      evBPriv: ev('BLOQUEADOR PRIVADO SINTETICO', 3, { publicoRestrito: true }),
      evBOff: ev('BLOQUEADOR DESPUBLICADO SINTETICO', 4, { publicado: false }),
      evAlvo: ev('ALVO SINTETICO', 5, { bloqueiaParticipantesDe: { evB1: true, evB2: true, evBPriv: true, evBOff: true }, umaTurmaPorPessoa: true, vagasPorTurma: 3 }),
      evGerTodos: ev('SO GERENTES VISIVEL A TODOS', 6, { publicoDesc: 'Gerentes', visibilidade: 'todos' }),
      evGer: ev('SO GERENTES PADRAO', 7, { publicoDesc: 'Gerentes' }),
    },
    turmas: {
      tB1: tu('B1 T1', 'evB1', 1, [dia(-30)]),
      tB2: tu('B2 T1', 'evB2', 1, [dia(40)]),
      tBPriv: tu('PRIV T1', 'evBPriv', 1, [dia(-30)]),
      tBOff: tu('OFF T1', 'evBOff', 1, [dia(-30)]),
      tA1: tu('ALVO T1', 'evAlvo', 1, [dia(20)]), tA2: tu('ALVO T2', 'evAlvo', 2, [dia(21)]), tA3: tu('ALVO T3', 'evAlvo', 3, [dia(22)]),
      tA4: tu('ALVO T4', 'evAlvo', 4, [dia(23)]),
      tG1: tu('GT T1', 'evGerTodos', 1, [dia(20)]), tG2: tu('GT T2', 'evGerTodos', 2, [dia(21)]),
      tGP: tu('GP T1', 'evGer', 1, [dia(20)]),
    },
    'turmas-config': { tA4: { finalizada: true } },
    'turmas-interesse': {
      tB1: { [chave(P.part1)]: insc(P.part1), [chave(P.part2)]: insc(P.part2), [chave(P.priv)]: insc(P.priv), [chave(P.removido)]: reg(P.removido, { status: 'removido', removed: true }) },
      tB2: { [chave(P.part2)]: reg(P.part2), [chave(P.velho)]: reg(P.velho) },
      tBPriv: { [chave(P.priv)]: reg(P.priv) },
      tBOff: { [chave(P.priv)]: insc(P.priv) },
      tA1: { [chave(P.umaTurma)]: reg(P.umaTurma), [chave(P.inscrita)]: insc(P.inscrita) },
      tA2: Object.assign(ocupa('ocupa1'), ocupa('ocupa2'), ocupa('ocupa3')),
    },
    'turmas-interesse-log': {}, 'turmas-checkin': {}, 'turmas-sorteio': {}, 'turmas-equipe': {},
    'turmas-publico': {}, 'eventos-publico': { evBPriv: {} }, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrir(browser, email, vp, mob, rede) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: !!mob, hasTouch: !!mob });
  const page = await ctx.newPage(); const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 20 }, rede || {})) + ';');
  /* A página pinta a grade uma vez ANTES de o login assentar (sem sessão não há conferência nenhuma) e de novo depois.
     A tela só está "pronta" depois que alguma conferência da pessoa começou — senão o teste leria a pintura sem sessão. */
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver((ms) => { if (ms.some((m) => m.target.hasAttribute && m.target.hasAttribute('data-verificando'))) window.__conferiu = true; })
        .observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-verificando'] });
    });
  });
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#turmas', { waitUntil: 'domcontentloaded' });
  await esperarCondicao(page, () => !!document.querySelector('.turma-card-new[data-turma-key="tA1"]'), null, { limite: 15000, descricao: 'o evento-alvo na vitrine' });
  return { ctx, page, erros };
}
const assentar = (page) => esperarCondicao(page, () => window.__conferiu && !document.querySelector('.btn--interest[data-verificando]') &&
  !Array.from(document.querySelectorAll('.btn--interest')).some((b) => b.offsetParent !== null && /Verificando/.test(b.textContent)), null, { limite: 15000, descricao: 'todas as conferências respondidas' });

const ler = (page) => page.evaluate(() => {
  const g = (k) => document.querySelector('.turmas-evento-grupo[data-evento-key="' + k + '"]');
  const card = (tk) => { const c = document.querySelector('.turma-card-new[data-turma-key="' + tk + '"]'); if (!c) return null;
    const b = c.querySelector('.btn--interest');
    return { botao: !b ? 'sem' : b.offsetParent === null ? 'oculto' : b.disabled ? 'desabilitado' : 'ativo', texto: b ? b.textContent.trim() : '',
      msg: ((c.querySelector('.turma-intent-msg') || {}).textContent || '').trim(), status: ((c.querySelector('.turma-status-msg') || {}).textContent || '').trim() }; };
  const avisos = (k) => { const x = g(k); return x ? Array.from(x.querySelectorAll('[data-restricao-evento]')).map((p) => ({ regra: p.getAttribute('data-restricao-evento'), texto: p.textContent })) : null; };
  return { eventos: Array.from(document.querySelectorAll('.turmas-evento-grupo[data-evento-key]')).map((x) => x.getAttribute('data-evento-key')).filter(Boolean),
    alvo: { avisos: avisos('evAlvo'), t1: card('tA1'), t2: card('tA2'), t3: card('tA3'), t4: card('tA4') },
    gerTodos: { avisos: avisos('evGerTodos'), publico: !!(g('evGerTodos') && g('evGerTodos').querySelector('[data-fora-do-publico]')), g1: card('tG1'), g2: card('tG2') },
    b1: card('tB1'), texto: document.querySelector('.turmas-eventos').textContent,
    escritas: (window.__ESCRITAS || []).map((e) => e.path), largura: document.documentElement.scrollWidth > document.documentElement.clientWidth };
});
const REMETE = 'Indisponível para você — veja o aviso do evento, acima.';

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (r, ok, d) => { if (ok) console.log('  ok    ' + r); else { falhas++; console.error('  FALHA ' + r + (d ? ' → ' + d : '')); } };
  const fim = (q, e, erros) => anota(q + ': nenhuma gravação, sem erro de JS, sem rolagem lateral', !e.escritas.length && !erros.length && !e.largura, JSON.stringify({ e: e.escritas, erros, l: e.largura }));
  const D = [['1280', { width: 1280, height: 900 }, false], ['375', { width: 375, height: 812 }, true]];

  console.log('\n== sem impedimento; fora do público; "Mostrar para todos"; inscrições encerradas ==');
  for (const [fmt, vp, mob] of D) {
    const { ctx, page, erros } = await abrir(browser, P.livre, vp, mob); await assentar(page); const e = await ler(page); const q = 'livre @' + fmt;
    anota(q + ': botões de sempre nas turmas abertas; turma lotada com a mensagem dela (só naquele card)', e.alvo.t1.botao === 'ativo' && e.alvo.t3.botao === 'ativo' && e.alvo.t2.botao === 'oculto' && /Turma lotada/.test(e.alvo.t2.msg), JSON.stringify(e.alvo));
    anota(q + ': nenhum aviso geral quando o impedimento é de uma turma só', igualVazio(e.alvo.avisos), JSON.stringify(e.alvo.avisos));
    anota(q + ': "Inscrições encerradas" sem afirmar que as vagas acabaram, com as datas', /As manifestações de interesse para esta turma foram encerradas\. Ela será realizada no dia/.test(e.alvo.t4.status) && !/vagas/.test(e.alvo.t4.status), e.alvo.t4.status);
    anota(q + ': fora do público, o evento de cargo segue invisível (PR #452)', !e.eventos.includes('evGer'));
    anota(q + ': "Mostrar para todos": aviso de público de sempre; a mensagem de cargo não vira aviso de evento', e.gerTodos.publico && igualVazio(e.gerTodos.avisos) && e.gerTodos.g1.botao === 'oculto' && !!e.gerTodos.g1.msg, JSON.stringify(e.gerTodos));
    fim(q, e, erros); await ctx.close();
  }

  console.log('\n== participação anterior ==');
  for (const [fmt, vp, mob] of D) {
    const { ctx, page, erros } = await abrir(browser, P.part1, vp, mob); await assentar(page); const e = await ler(page); const q = 'participou de um bloqueador @' + fmt;
    anota(q + ': o evento e as turmas continuam visíveis', e.eventos.includes('evAlvo') && !!e.alvo.t1 && !!e.alvo.t2 && !!e.alvo.t3 && !!e.alvo.t4);
    anota(q + ': nenhum botão disponível nas turmas abertas', ['t1', 't2', 't3'].every((t) => e.alvo[t].botao === 'oculto'), JSON.stringify(e.alvo));
    anota(q + ': a explicação UMA vez no evento, citando o bloqueador e a inscrição confirmada', e.alvo.avisos.length === 1 && e.alvo.avisos[0].regra === 'participacao' && e.alvo.avisos[0].texto === 'Estas turmas são para quem ainda não participou de BLOQUEADOR UM SINTETICO. Você já tem inscrição confirmada lá.', JSON.stringify(e.alvo.avisos));
    anota(q + ': os cards remetem ao aviso (sem repetir a explicação); a turma lotada também — participação vem antes de vagas', ['t1', 't2', 't3'].every((t) => e.alvo[t].msg === REMETE), JSON.stringify([e.alvo.t1.msg, e.alvo.t2.msg]));
    anota(q + ': a participação histórica dela continua visível (PR #452)', !!e.b1 && e.eventos.includes('evB1'));
    fim(q, e, erros); await ctx.close();
  }
  {
    const { ctx, page, erros } = await abrir(browser, P.part2, { width: 1280, height: 900 }); await assentar(page); const e = await ler(page);
    anota('dois bloqueadores: os dois citados, distinguindo inscrição confirmada de interesse registrado', e.alvo.avisos.length === 1 && e.alvo.avisos[0].texto === 'Estas turmas são para quem ainda não participou de BLOQUEADOR UM SINTETICO e BLOQUEADOR DOIS SINTETICO. Você já tem inscrição confirmada em BLOQUEADOR UM SINTETICO e interesse registrado em BLOQUEADOR DOIS SINTETICO.', JSON.stringify(e.alvo.avisos));
    fim('dois bloqueadores', e, erros); await ctx.close();
  }
  {
    const { ctx, page, erros } = await abrir(browser, P.priv, { width: 375, height: 812 }, true); await assentar(page); const e = await ler(page);
    anota('bloqueador que ela não pode ver (lista sem vínculo; despublicado): "outros eventos anteriores", sem o nome', e.alvo.avisos.length === 1 && e.alvo.avisos[0].texto === 'Estas turmas são para quem ainda não participou de BLOQUEADOR UM SINTETICO e 2 outros eventos anteriores. Você já tem inscrição confirmada em BLOQUEADOR UM SINTETICO e registro em 2 outros eventos anteriores.', JSON.stringify(e.alvo.avisos));
    anota('nenhum nome de evento privado ou despublicado na página', !/PRIVADO|DESPUBLICADO/.test(e.texto));
    fim('bloqueador privado', e, erros); await ctx.close();
  }
  {
    const { ctx, page, erros } = await abrir(browser, P.velho, { width: 1280, height: 900 }); await assentar(page); const e = await ler(page);
    anota('interesse anterior não removido continua bloqueando (regra de sempre), dito como interesse registrado', e.alvo.t1.botao === 'oculto' && e.alvo.avisos.length === 1 && /Você já tem interesse registrado lá\./.test(e.alvo.avisos[0].texto), JSON.stringify(e.alvo.avisos));
    fim('interesse anterior', e, erros); await ctx.close();
  }
  {
    const { ctx, page, erros } = await abrir(browser, P.removido, { width: 1280, height: 900 }); await assentar(page); const e = await ler(page);
    anota('interesse anterior REMOVIDO não bloqueia (regra de sempre): botões disponíveis, sem aviso', e.alvo.t1.botao === 'ativo' && igualVazio(e.alvo.avisos), JSON.stringify(e.alvo));
    fim('interesse removido', e, erros); await ctx.close();
  }

  console.log('\n== uma turma por pessoa; inscrita ==');
  for (const [quem, email, estado] of [['interesse em outra turma', P.umaTurma, /Interesse registrado/], ['inscrita em outra turma', P.inscrita, /Inscrita/i]]) {
    const { ctx, page, erros } = await abrir(browser, email, { width: 1280, height: 900 }); await assentar(page);
    /* o estado da própria turma chega pela leitura de sempre (checkInterestState), depois da conferência */
    await esperarCondicao(page, (re) => { const c = document.querySelector('.turma-card-new[data-turma-key="tA1"]'); return new RegExp(re, 'i').test(c.textContent); }, estado.source, { descricao: 'o estado da turma dela' });
    const e = await ler(page);
    anota(quem + ': o próprio vínculo intacto na turma dela', estado.test(e.alvo.t1.texto) || estado.test(e.alvo.t1.msg), JSON.stringify(e.alvo.t1));
    anota(quem + ': a regra de troca UMA vez no evento; os outros cards remetem a ela', e.alvo.avisos.length === 1 && e.alvo.avisos[0].regra === 'umaTurma' && /Só é possível participar de uma turma por vez/.test(e.alvo.avisos[0].texto) && e.alvo.t2.msg === REMETE && e.alvo.t3.msg === REMETE, JSON.stringify({ a: e.alvo.avisos, t2: e.alvo.t2.msg }));
    fim(quem, e, erros); await ctx.close();
  }

  console.log('\n== rede lenta e leitura que falha ==');
  {
    const { ctx, page, erros } = await abrir(browser, P.part1, { width: 375, height: 812 }, true, { delays: { 'turmas-interesse/': 3000 } });
    await esperarCondicao(page, () => !!document.querySelector('.btn--interest[data-verificando]'), null, { descricao: 'as conferências pendentes' });
    const cedo = await ler(page);
    anota('lento: enquanto há "Verificando…", nenhum aviso geral e nenhum botão disponível', igualVazio(cedo.alvo.avisos) && ['t1', 't2', 't3'].every((t) => cedo.alvo[t].botao !== 'ativo'), JSON.stringify(cedo.alvo));
    await assentar(page); const e = await ler(page);
    anota('lento: quando tudo responde, o aviso aparece uma vez', e.alvo.avisos.length === 1);
    fim('lento', e, erros); await ctx.close();
  }
  {
    const { ctx, page, erros } = await abrir(browser, P.part1, { width: 1280, height: 900 }, false, { fail: ['turmas-interesse/'] });
    await assentar(page); const e = await ler(page);
    anota('falha: o botão continua bloqueado, com a mensagem nova de falha no card', ['t1', 't2', 't3'].every((t) => e.alvo[t].botao === 'oculto' && e.alvo[t].msg === 'Não foi possível verificar agora se você pode manifestar interesse nesta turma. Recarregue a página e tente de novo.'), JSON.stringify(e.alvo.t1));
    anota('falha: nenhum aviso geral (não há conclusão)', igualVazio(e.alvo.avisos), JSON.stringify(e.alvo.avisos));
    fim('falha', e, erros); await ctx.close();
  }

  await browser.close();
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTUDO OK.');
})();
function igualVazio(a) { return Array.isArray(a) && a.length === 0; }
