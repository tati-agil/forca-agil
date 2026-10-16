/* Ajudantes de navegação na Taxonomia redesenhada (três espaços: Catálogo, Administração, Integridade e
   configurações) para os testes de tela. Só navegam e esperam o estado pedido — nunca gravam nada.
   Nenhum clique é repetido: antes de cada interação espera-se a tela ESTÁVEL (sem leitura do domínio ou do conceito
   em curso, sem gravação, sem redesenho por um instante); depois, um clique só, e se ele não produzir o efeito
   esperado o teste falha dizendo o estado em que a tela estava. */
const { esperarCondicao, esperarCondicaoAte } = require('./esperas');

const QUIETO_MS = 250;
/* Tela estável: nada sendo lido (domínio aberto, conceito aberto na Administração), nenhuma gravação em curso e nenhum
   redesenho da Taxonomia por QUIETO_MS seguidos. Leituras de outras áreas (vínculos dos motores) não contam: uma
   leitura que nunca responde não pode impedir a navegação. */
async function esperarTelaEstavel(page, antesDe) {
  await esperarCondicao(page, () => {
    const I = window.faTaxonomia && window.faTaxonomia._interno, s = I && I.st;
    if (!s || !document.getElementById('adminTaxonomia')) return false;
    const D = s.d[s.dominio];
    if (s.salvando || D.estado === 'carregando' || D.estado === 'ocioso') return false;
    return !(s.espaco === 'admin' && D.detalhe && D.detalhe.carregando);
  }, null, { limite: 10000, descricao: 'tela estável (sem leitura nem gravação em curso) antes de: ' + antesDe });
  const quieta = await page.evaluate((ms) => new Promise((resolve) => {
    const raiz = document.getElementById('adminTaxonomia');
    let t = null, feito = false;
    const fim = (v) => { if (feito) return; feito = true; obs.disconnect(); clearTimeout(t); clearTimeout(limite); resolve(v); };
    const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => fim(true), ms); });
    obs.observe(raiz, { childList: true, subtree: true });
    t = setTimeout(() => fim(true), ms);
    const limite = setTimeout(() => fim(false), 6000);
  }), QUIETO_MS);
  if (!quieta) throw new Error('A Taxonomia não parou de se redesenhar (6 s) antes de: ' + antesDe + ' — ' + await diagnostico(page));
}
async function diagnostico(page) {
  return page.evaluate(() => {
    const I = window.faTaxonomia && window.faTaxonomia._interno, s = I && I.st, raiz = document.getElementById('adminTaxonomia');
    if (!s) return 'módulo da Taxonomia indisponível';
    const D = s.d[s.dominio];
    return JSON.stringify({ espaco: s.espaco, dominio: s.dominio, aba: s.aba, estadoDominio: D.estado, selecionado: D.selecionado, abaAdmin: D.adminAba, detalheCarregando: !!(D.detalhe && D.detalhe.carregando), salvando: !!s.salvando, tela: raiz ? raiz.innerText.replace(/\s+/g, ' ').slice(0, 240) : '' });
  });
}
/* Espera a tela estável, clica UMA vez e confere o efeito; sem efeito, falha com o estado da tela. */
async function clicarEsperando(page, seletor, cond, arg, descricao) {
  await esperarTelaEstavel(page, descricao);
  await page.click(seletor, { timeout: 4000 });
  if (!(await esperarCondicaoAte(page, cond, arg, { limite: 8000 }))) {
    throw new Error('O clique em ' + seletor + ' não produziu o efeito esperado (' + descricao + '). Estado da tela: ' + await diagnostico(page));
  }
}

/* abre o conceito no CATÁLOGO (a partir de qualquer espaço; no celular, volta à lista antes, se preciso) */
async function abrirConceito(page, codigo) {
  if (await page.locator('#taxAdmin, #taxIntegridade').count()) await voltarCatalogo(page);
  await esperarTelaEstavel(page, 'abrir ' + codigo + ' no catálogo');
  if (!(await page.locator('.tax-item[data-codigo="' + codigo + '"]').isVisible())) {
    const voltar = page.locator('.tax-ficha [data-tax="voltar-lista"]').first();
    if (await voltar.isVisible()) await clicarEsperando(page, '.tax-ficha [data-tax="voltar-lista"] >> nth=0', (c) => { const it = document.querySelector('.tax-item[data-codigo="' + c + '"]'); return !!it && it.offsetParent !== null; }, codigo, 'voltar à lista para achar ' + codigo);
  }
  await clicarEsperando(page, '.tax-item[data-codigo="' + codigo + '"]', (c) => {
    const it = document.querySelector('.tax-item--ativo');
    return !!it && it.getAttribute('data-codigo') === c && !!document.querySelector('.tax-ficha .tax-titulo');
  }, codigo, 'ficha de ' + codigo + ' no catálogo');
}
/* espera a Administração assentada (detalhe do conceito lido) */
async function adminAssentada(page) {
  await esperarCondicao(page, () => !!document.getElementById('taxAdmin') && !document.querySelector('#taxAdmin .loading-msg'), null, { descricao: 'administração do conceito assentada' });
}
/* "Administrar conceito" no conceito aberto; opcionalmente vai direto a uma aba */
async function administrar(page, aba) {
  await clicarEsperando(page, '#taxAdministrarBtn', () => !!document.getElementById('taxAdmin'), null, 'abrir a administração');
  await adminAssentada(page);
  if (aba && aba !== 'conteudo') await abaAdmin(page, aba);
}
async function abaAdmin(page, aba) {
  await clicarEsperando(page, '#taxAba_' + aba, (a) => { const b = document.getElementById('taxAba_' + a); return !!b && b.getAttribute('aria-selected') === 'true' && !document.querySelector('#taxAdmin .loading-msg'); }, aba, 'aba ' + aba + ' da administração');
}
/* abre o conceito no catálogo e entra na administração dele */
async function abrirAdmin(page, codigo, aba) { await abrirConceito(page, codigo); await administrar(page, aba); }
async function voltarCatalogo(page) {
  await clicarEsperando(page, '#taxVoltarCatalogo', () => !!document.querySelector('.tax-dominios') && !document.getElementById('taxAdmin') && !document.getElementById('taxIntegridade'), null, 'voltar ao Catálogo');
}
/* Administração do conceito selecionado (ou do primeiro da lista): é onde fica o acesso às Verificações do sistema */
async function abrirAdminQualquer(page) {
  if (await page.locator('#taxAdmin').count()) return;
  await esperarTelaEstavel(page, 'escolher um conceito para administrar');
  const cod = await page.evaluate(() => { const s = window.faTaxonomia._interno.st, D = s.d[s.dominio]; if (D.selecionado && D.conceitos[D.selecionado]) return D.selecionado; const it = document.querySelector('.tax-item'); return it ? it.getAttribute('data-codigo') : null; });
  if (!cod) throw new Error('Sem conceito para administrar — ' + await diagnostico(page));
  await abrirAdmin(page, cod);
}
/* Verificações do sistema (antes "Integridade e configurações"): fora do Catálogo — o acesso fica na Administração
   ("Verificações do sistema e dados"); com o catálogo vazio, pelo link da carga inicial. Sem conceito aberto, abre a
   administração do selecionado (ou do primeiro da lista) só para chegar lá. */
async function irIntegridade(page) {
  if (await page.locator('#taxIntegridade').count()) return;
  const paraVerificacoes = () => !!document.getElementById('taxIntegridade');
  if (!(await page.locator('#taxAdmin').count())) {
    await esperarTelaEstavel(page, 'procurar o acesso às Verificações do sistema');
    if (await page.locator('#taxVazioCarga [data-tax="integridade"]').count()) {
      await clicarEsperando(page, '#taxVazioCarga [data-tax="integridade"]', paraVerificacoes, null, 'abrir Verificações do sistema (catálogo vazio)');
      return;
    }
    await abrirAdminQualquer(page);
  }
  await clicarEsperando(page, '#taxVerificacoesLink', paraVerificacoes, null, 'abrir Verificações do sistema');
}
async function dominio(page, d) {
  if (await page.locator('#taxAdmin, #taxIntegridade').count()) await voltarCatalogo(page);
  await clicarEsperando(page, '.tax-dominio[data-dominio="' + d + '"]', (x) => { const b = document.querySelector('.tax-dominio[data-dominio="' + x + '"]'); return !!b && b.getAttribute('aria-selected') === 'true' && !document.getElementById('taxCarregando'); }, d, 'trocar para o domínio ' + d);
}
module.exports = { abrirAdminQualquer, abrirConceito, administrar, abaAdmin, abrirAdmin, adminAssentada, voltarCatalogo, irIntegridade, dominio, esperarTelaEstavel, diagnostico };
