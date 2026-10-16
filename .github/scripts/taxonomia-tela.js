/* Ajudantes de navegação na Taxonomia redesenhada (três espaços: Catálogo, Administração, Integridade e
   configurações) para os testes de tela. Só navegam e esperam o estado pedido — nunca gravam nada. */
const { esperarCondicao, esperarCondicaoAte } = require('./esperas');

/* abre o conceito no CATÁLOGO (a partir de qualquer espaço; no celular, volta à lista antes, se preciso) */
async function abrirConceito(page, codigo) {
  if (await page.locator('#taxAdmin, #taxIntegridade').count()) await voltarCatalogo(page);
  const item = page.locator('.tax-item[data-codigo="' + codigo + '"]');
  if (!(await item.isVisible())) {
    const voltar = page.locator('.tax-ficha [data-tax="voltar-lista"]').first();
    if (await voltar.isVisible()) await voltar.click();
  }
  await page.click('.tax-item[data-codigo="' + codigo + '"]');
  await esperarCondicao(page, (c) => {
    const it = document.querySelector('.tax-item--ativo');
    return !!it && it.getAttribute('data-codigo') === c && !!document.querySelector('.tax-ficha .tax-titulo');
  }, codigo, { descricao: 'ficha de ' + codigo + ' no catálogo' });
}
/* espera a Administração assentada (detalhe do conceito lido) */
async function adminAssentada(page) {
  await esperarCondicao(page, () => !!document.getElementById('taxAdmin') && !document.querySelector('#taxAdmin .loading-msg'), null, { descricao: 'administração do conceito assentada' });
}
/* um clique dado no instante em que a tela se redesenha (o fim de uma gravação, uma leitura que chega) se perde:
   clica e confere o efeito; sem efeito, clica de novo (no máximo 4 vezes) */
async function clicarAte(page, seletor, cond, arg, descricao) {
  for (let i = 0; i < 4; i++) {
    if (await page.locator(seletor).count()) await page.click(seletor, { timeout: 4000 });
    if (await esperarCondicaoAte(page, cond, arg, { limite: 1500 })) return;
  }
  await esperarCondicao(page, cond, arg, { limite: 3000, descricao });
}
/* "Administrar conceito" no conceito aberto; opcionalmente vai direto a uma aba */
async function administrar(page, aba) {
  await clicarAte(page, '#taxAdministrarBtn', () => !!document.getElementById('taxAdmin'), null, 'administração aberta');
  await adminAssentada(page);
  if (aba && aba !== 'conteudo') await abaAdmin(page, aba);
}
async function abaAdmin(page, aba) {
  await clicarAte(page, '#taxAba_' + aba, (a) => { const b = document.getElementById('taxAba_' + a); return !!b && b.getAttribute('aria-selected') === 'true' && !document.querySelector('#taxAdmin .loading-msg'); }, aba, 'aba ' + aba + ' da administração');
}
/* abre o conceito no catálogo e entra na administração dele */
async function abrirAdmin(page, codigo, aba) { await abrirConceito(page, codigo); await administrar(page, aba); }
async function voltarCatalogo(page) {
  await clicarAte(page, '#taxVoltarCatalogo', () => !!document.querySelector('.tax-dominios') && !document.getElementById('taxAdmin') && !document.getElementById('taxIntegridade'), null, 'de volta ao Catálogo');
}
async function irIntegridade(page) {
  if (await page.locator('#taxIntegridade').count()) return;
  if (await page.locator('#taxAdmin').count()) await voltarCatalogo(page);
  await clicarAte(page, '#taxIntegridadeLink', () => !!document.getElementById('taxIntegridade'), null, 'Integridade e configurações');
}
async function dominio(page, d) {
  if (await page.locator('#taxAdmin, #taxIntegridade').count()) await voltarCatalogo(page);
  await clicarAte(page, '.tax-dominio[data-dominio="' + d + '"]', (x) => { const b = document.querySelector('.tax-dominio[data-dominio="' + x + '"]'); return !!b && b.getAttribute('aria-selected') === 'true' && !document.getElementById('taxCarregando'); }, d, 'domínio ' + d);
}
module.exports = { abrirConceito, administrar, abaAdmin, abrirAdmin, adminAssentada, voltarCatalogo, irIntegridade, dominio };
