/* Seções recolhidas do ADMIN › Avaliação e Mapa (details[data-det]): a governança da v2 em Motores, as correções
 * editoriais e a redação da v2 dentro dos cartões de Questionários. Os testes que conferem o CONTEÚDO dessas seções as
 * abrem como a pessoa faria — assim que aparecem, uma vez por elemento, disparando o 'toggle' que a tela lembra
 * (state.detAbertos) — e seguem conferindo o mesmo conteúdo de antes. O recolhimento em si é provado em
 * teste-admin-usabilidade.js.
 *   await ctx.addInitScript(abrirRecolhidas(['#avpPosAvancado']));   // um ou mais seletores de <details> */
function abrirRecolhidas(seletores) {
  const sel = JSON.stringify(seletores.join(', '));
  return '(function () { var abrir = function () { document.querySelectorAll(' + sel + ').forEach(function (d) {' +
    ' if (d.tagName !== "DETAILS" || d.hasAttribute("data-teste-aberta")) return; d.setAttribute("data-teste-aberta", ""); if (!d.open) d.open = true; }); };' +
    ' new MutationObserver(abrir).observe(document, { childList: true, subtree: true }); })();';
}
module.exports = { abrirRecolhidas };
