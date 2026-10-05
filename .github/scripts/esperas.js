/* Esperas dos testes Playwright: sempre pelo EFEITO real, nunca em silêncio.
 *
 * Por que existe (diagnóstico da suíte, PR 2): parte do tempo e da falta de prova da suíte vinha
 * de esperas que estouravam CALADAS — `waitFor…(…).catch(() => {})` — e de um erro de assinatura
 * do Playwright: `page.waitForFunction(fn, { timeout })` passa o objeto como ARGUMENTO da função,
 * não como opção, e o limite vira o padrão de 30 s (no teste-tela-preta, 6 esperas de 30 s em vez
 * de 16 s). Aqui a assinatura é sempre a certa e cada espera diz o que esperava.
 *
 *   esperarCondicao(page, fn, arg, { limite, descricao })
 *       espera fn(arg) ficar verdadeira na página; se não ficar, FALHA com a descrição.
 *   esperarCondicaoAte(page, fn, arg, { limite })
 *       para quando chegar ao limite é um resultado legítimo (ex.: "a rede nunca responde"):
 *       devolve true/false — só o estouro do limite vira false; qualquer outro erro sobe.
 *   esperarAusencia(page, seletor, { janela, motivo })
 *       a ÚNICA forma de afirmar que algo NÃO aparece: observa a janela inteira (documentada no
 *       motivo) e devolve true se o seletor não apareceu nela.
 *
 * teste-guarda-esperas.js impede a volta dos dois padrões em código novo. */

function erroDeLimite(e) {
  return !!e && (e.name === 'TimeoutError' || /Timeout \d+ms exceeded/.test(String(e.message || e)));
}

async function esperarCondicao(page, fn, arg, opcoes) {
  const o = opcoes || {};
  const limite = o.limite || 8000;
  try {
    await page.waitForFunction(fn, arg === undefined ? null : arg, { timeout: limite });
  } catch (e) {
    if (erroDeLimite(e)) throw new Error('Esperado e não aconteceu em ' + limite + ' ms: ' + (o.descricao || String(fn).slice(0, 120)));
    throw e;
  }
}

async function esperarCondicaoAte(page, fn, arg, opcoes) {
  const limite = (opcoes || {}).limite || 8000;
  try {
    await page.waitForFunction(fn, arg === undefined ? null : arg, { timeout: limite });
    return true;
  } catch (e) {
    if (erroDeLimite(e)) return false;
    throw e;
  }
}

async function esperarAusencia(page, seletor, opcoes) {
  const o = opcoes || {};
  if (!o.motivo) throw new Error('esperarAusencia precisa de um motivo (por que a janela de ' + (o.janela || '?') + ' ms basta)');
  try {
    await page.waitForSelector(seletor, { state: 'attached', timeout: o.janela || 1000 });
    return false;
  } catch (e) {
    if (erroDeLimite(e)) return true;
    throw e;
  }
}

module.exports = { esperarCondicao, esperarCondicaoAte, esperarAusencia, erroDeLimite };
