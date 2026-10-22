/* Responde a AVALIAÇÃO GUIADA (v22) pela interface, a partir do conjunto P1–P16 que o teste quer obter.
 *
 * guiadaDe(P) monta UMA resposta guiada possível para cada combinação de P1–P16 ('S' / 'N'; P6 e P7 também aceitam
 * '?' = "Não sei") — a tradução do módulo (faAvaliacaoGuiada.criterios) devolve exatamente o mesmo P1–P16, e isso é
 * provado nas 65.536 combinações por teste-avaliacao-guiada.js. responderGuiada(page, P) percorre as perguntas da
 * tela como uma pessoa: escolhe a alternativa, toca em Continuar, até chegar à revisão. Os testes que antes clicavam
 * SIM/NÃO no questionário antigo usam isto para criar avaliações novas. */
const ORDEM_IDS = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const CODIGOS = ORDEM_IDS.map((_, i) => 'P' + (i + 1));

/* máscara (bit i = SIM na pergunta i, na ordem P1..P16) → { P1: 'S'|'N', … } */
function pDaMascara(m) { const P = {}; CODIGOS.forEach((c, i) => { P[c] = (m >> i) & 1 ? 'S' : 'N'; }); return P; }
/* { necessidade: 'sim', … } (ids internos) → { P1: 'S', … } */
function pDosIds(valores) { const P = {}; ORDEM_IDS.forEach((id, i) => { P['P' + (i + 1)] = valores[id] === 'sim' ? 'S' : 'N'; }); return P; }

function guiadaDe(P) {
  const S = (k) => P[k] === 'S', oferta = S('P5'), r = {};
  ['P1', 'P3', 'P4', 'P6', 'P7', 'P8'].forEach((k) => { r[k] = P[k]; });
  r.P2 = P.P2; if (S('P2')) r.C2 = 'proprio';
  r.E1 = 'N'; r.P5 = oferta ? 'oferta' : 'parte'; if (oferta) r.C5 = 'entrega';
  if (S('P8')) r.C8 = 'entrega';
  r.P9 = S('P9') ? 'canal' : oferta ? 'oferta' : 'outro';
  r.F10I = S('P10') ? 'S' : 'N'; r.F10D = 'N';
  r.P11 = S('P11') ? 'capacidade' : oferta ? 'entrega' : 'tarefa';
  r.P12 = S('P12') ? 'trabalho' : 'entrega'; if (S('P12')) r.P12T = 'processo';
  /* P13: com oferta própria, pela oferta que faz parte de outra (a única forma sem contradição); sem, pela Modalidade */
  if (S('P13') && oferta) { r.F13M = 'oferta'; r.F13O = 'facilidade'; r.F13S = 'parte'; r.F13SP = 'oferta'; r.F13SN = 'Produto principal de teste'; }
  else if (S('P13')) { r.F13M = 'tipo'; r.F13O = 'outro'; r.F13S = 'outra'; }
  else { r.F13M = oferta ? 'oferta' : 'outro'; r.F13O = oferta ? 'facilidade' : 'outro'; r.F13S = oferta ? 'propria' : 'outra'; }
  r.F14R = S('P14') ? 'S' : 'N'; r.F14C = 'N';
  r.P15 = S('P15') ? 'componente' : oferta ? 'servico' : 'outro';
  r.F16F = S('P16') ? 'S' : 'N'; r.F16O = 'N';
  return r;
}

/* Responde pela tela até a revisão. P: { P1: 'S'|'N', … } (ou uma máscara). Devolve as respostas guiadas usadas. */
async function responderGuiada(page, P, opc) {
  opc = opc || {};
  if (typeof P === 'number') P = pDaMascara(P);
  const r = Object.assign(guiadaDe(P), opc.substituir || {});
  for (let n = 0; n < 60; n++) {
    await page.waitForSelector('#avpGuiadaCartao, #avpGuiadaRevisao');
    const passo = await page.evaluate(() => { const c = document.getElementById('avpGuiadaCartao'); return c ? c.getAttribute('data-passo') : null; });
    if (!passo) return r;
    const v = r[passo];
    if (v === undefined) throw new Error('responderGuiada: sem resposta para ' + passo);
    if (await page.locator('#avpGuiadaTexto').count()) await page.fill('#avpGuiadaTexto', v);
    else {
      const radio = page.locator('input[name="avpGuiadaResp"][value="' + v + '"]');
      if (!(await radio.isChecked())) {
        await radio.check();
        await page.waitForFunction((x) => { const c = document.getElementById('avpGuiadaCartao'); const i = c && c.querySelector('input[name="avpGuiadaResp"][value="' + x + '"]'); return !!(i && i.checked); }, v);
      }
    }
    await page.click('#avpGuiadaContinuarBtn');
    await page.waitForFunction((p) => { const c = document.getElementById('avpGuiadaCartao'); return !c || c.getAttribute('data-passo') !== p; }, passo);
  }
  throw new Error('responderGuiada: a revisão não chegou');
}

/* Na revisão: espera a prévia oficial liberar "Concluir" e conclui (o botão fica desabilitado enquanto calcula). */
async function concluirGuiada(page) {
  await page.waitForSelector('#avpConcluirBtn:not([disabled])', { timeout: 15000 });
  await page.click('#avpConcluirBtn');
}

module.exports = { ORDEM_IDS, CODIGOS, pDaMascara, pDosIds, guiadaDe, responderGuiada, concluirGuiada };
