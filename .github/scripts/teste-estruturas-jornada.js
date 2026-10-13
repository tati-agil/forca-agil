/* Estruturas Organizacionais — Etapa 4: a JORNADA completa no navegador, contra um Firebase Emulator DE VERDADE
 * (banco + login, regras reais de database.rules.json), nunca contra o banco oficial.
 *
 * Sobe o seu próprio emulador descartável (contêiner Docker, portas 9100/9199 — separado do ambiente de testes do
 * atalho, cujos dados ficam intactos), o servidor local com o modo de testes declarado e um Chromium (Playwright):
 *   1. Mapa vazio: "Nenhuma estrutura cadastrada" em cada categoria; demonstração separada.
 *   2. Cadastro: validação compreensível, tipos com referência oficial, salvar, confirmação visível, duplo clique
 *      não duplica.
 *   3. Mapa com estruturas: cada uma na posição da sua categoria/especialização; detalhes; Linhas de Negócios em
 *      "Sem subagrupador"; nada inventado (produtos: informação indisponível).
 *   4. Persistência depois de recarregar a página.
 *   5. Editar (histórico com antes → depois e justificativa) e encerrar (confirmação, motivo obrigatório, some do
 *      Mapa, fica na lista e no histórico com o motivo).
 *   6. Conflito: outra pessoa grava antes → mensagem clara, nada sobrescrito.
 *   7. Perfil só de consulta: vê o Mapa, não vê atalho de cadastro, não entra no ADMIN, e o banco recusa gravar.
 *   8. Demonstração × cadastradas nunca se misturam.
 *   9. Nenhuma requisição ao Firebase oficial em nenhum momento.
 *  10. Celular (375 px) e computador: sem rolagem horizontal nas telas da jornada.
 *
 * Uso (precisa de Docker e da imagem fa-emulador-regras:local; Playwright em NODE_PATH):
 *   node .github/scripts/teste-estruturas-jornada.js */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync, spawn } = require('child_process');
const { chromium } = require('playwright');
const { esperarCondicaoAte } = require('./esperas');

const RAIZ = path.resolve(__dirname, '..', '..');
const PORTA_BANCO = 9100, PORTA_LOGIN = 9199, PORTA_SITE = 8817;
process.env.FA_PORTA_BANCO = String(PORTA_BANCO); process.env.FA_PORTA_LOGIN = String(PORTA_LOGIN);
const S = require('./ambiente-local/semente');
const CONTEINER = 'fa-jornada-estruturas-' + process.pid;
const IMAGEM = process.env.FA_IMAGEM_EMULADOR || 'fa-emulador-regras:local';
const ENDERECO = 'http://127.0.0.1:' + PORTA_SITE + '/index.html';

let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + det : '')); if (!c) falhas++; }
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
function aberto(porta) { return new Promise((ok) => { const r = http.get({ host: '127.0.0.1', port: porta, path: '/' }, (res) => { res.resume(); ok(true); }); r.on('error', () => ok(false)); r.setTimeout(1500, () => { r.destroy(); ok(false); }); }); }

async function subirEmulador() {
  const cache = process.env.FA_CACHE_EMULADOR || path.join(require('os').tmpdir(), 'fa-cache-emulador');
  execFileSync('docker', ['run', '-d', '--rm', '--name', CONTEINER, '-p', '127.0.0.1:' + PORTA_BANCO + ':9000', '-p', '127.0.0.1:' + PORTA_LOGIN + ':9099',
    '-v', RAIZ + ':/src:ro', '-v', cache + ':/root/.cache/firebase', IMAGEM, 'sh', '-c',
    'mkdir -p /work && cp /src/database.rules.json /src/.github/scripts/ambiente-local/firebase.json /work/ && cd /work && exec /deps/node_modules/.bin/firebase emulators:start --only database,auth --project ' + S.PROJETO], { stdio: 'ignore', env: Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1' }) });
  for (let i = 0; i < 90; i++) { if (await aberto(PORTA_BANCO) && await aberto(PORTA_LOGIN)) return; await espera(1000); }
  throw new Error('o emulador da jornada não subiu');
}
function derrubarEmulador() { try { execFileSync('docker', ['rm', '-f', CONTEINER], { stdio: 'ignore' }); } catch (e) { /* já saiu */ } }

/* qualquer erro fora do fluxo principal também derruba o contêiner descartável */
process.on('uncaughtException', (e) => { console.error('ERRO', e && e.stack || e); derrubarEmulador(); process.exit(1); });

(async () => {
  let servidor = null, navegador = null;
  try {
    await subirEmulador();
    await S.semear(() => {});
    /* M2: definição vigente de TESTE só para NEGOCIOS (emulador próprio desta jornada); os outros tipos ficam sem → "indisponível" */
    await S.banco('PATCH', 'taxonomia/organizacional', { 'conceitos/NEGOCIOS/definicaoVigenteFonteId': 'f-teste', 'fontes/NEGOCIOS/f-teste': { texto: 'Definição de teste — NEGOCIOS', contexto: 'teste', situacao: 'vigente', tipoRedacao: 'Conceito' } });
    servidor = spawn(process.execPath, [path.join(__dirname, 'ambiente-local', 'servidor.js'), RAIZ, String(PORTA_SITE)], { env: Object.assign({}, process.env, { SEM_NAVEGADOR: '1' }), stdio: 'ignore' });
    for (let i = 0; i < 20 && !(await aberto(PORTA_SITE)); i++) await espera(300);
    navegador = await chromium.launch();
    const externos = [], erros = [];
    async function sessao(conta, largura) {
      const ctx = await navegador.newContext({ viewport: { width: largura || 1280, height: 900 } });
      const p = await ctx.newPage();
      /* banco, login ou funções FORA do emulador local (o login do emulador usa o mesmo caminho, mas em 127.0.0.1) */
      p.on('request', (r) => { let u; try { u = new URL(r.url()); } catch (e) { return; } if (/(^|\.)(firebaseio\.com|firebasedatabase\.app|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|firebaseinstallations\.googleapis\.com|cloudfunctions\.net|firebaseapp\.com)$/.test(u.hostname) || /kyber-agil/.test(u.href)) externos.push(u.href); });
      p.on('pageerror', (e) => erros.push(conta + ': ' + e.message));
      p.on('dialog', (d) => d.accept());
      await p.goto(ENDERECO + '#home');
      await p.waitForFunction(() => window.firebase && window.faAuth && window.faAmbiente, null, { timeout: 20000 });
      await p.evaluate((c) => firebase.auth().signInWithEmailAndPassword(c.email, c.senha), { email: S.CONTAS[conta].email, senha: S.SENHA });
      await p.waitForFunction(() => window.faAuth.isAvaliacaoReady && window.faAuth.isAvaliacaoReady() && window.faAuth.getSession && window.faAuth.getSession(), null, { timeout: 20000 });
      return p;
    }
    const ir = async (p, hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await espera(400); };
    const texto = (p, sel) => p.locator(sel).first().innerText().catch(() => '');
    const semRolagemLateral = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

    /* ===== 1. Mapa vazio ===== */
    console.log('1. Mapa vazio e ambiente de testes');
    const p = await sessao('configuracao');
    afirma(await p.locator('#faFaixaAmbienteTestes').count() === 1, 'a faixa "AMBIENTE DE TESTES" aparece');
    afirma(await p.evaluate(() => window.faAmbiente.testes && window.faAmbiente.projeto === 'demo-forca-agil-local'), 'o site está ligado ao projeto de testes "demo-"');
    await ir(p, '#avaliacoes?mf=mapa');
    await p.waitForSelector('#mfmMapa', { timeout: 15000 });
    const vazios = await p.locator('#mfmMapa .mfm-vazio').allInnerTexts();
    afirma(vazios.length >= 7 && vazios.every((t) => t === 'Nenhuma estrutura cadastrada'), 'cada categoria vazia mostra "Nenhuma estrutura cadastrada" (' + vazios.length + ')');
    afirma(/Ambiente de testes/.test(await texto(p, '#mfmFaixa')), 'o Mapa diz que os dados são do ambiente de testes');
    afirma(await p.locator('#mfmMapa .mfm-caixa').count() === 0, 'nenhuma caixa (nada inventado)');

    /* ===== 2. Cadastro ===== */
    console.log('\n2. Cadastro');
    await p.click('#mfmIrCadastro');
    await p.waitForSelector('#adminEstruturas:not([hidden]) #estVazio', { timeout: 15000 });
    afirma(/Nenhuma estrutura cadastrada/.test(await texto(p, '#estVazio')), 'lista vazia com orientação');
    await p.click('#estNova');
    await p.waitForSelector('#estTipos input[name="estTipo"]');
    await p.waitForFunction(() => !document.querySelector('#estTipos .loading-msg'), null, { timeout: 15000 });
    afirma(await p.locator('#estTipos input[name="estTipo"]').count() === 8, 'os 8 tipos firmes estão disponíveis para escolha');
    afirma(await p.locator('#estTipos input[name="estTipo"]:disabled').count() === 0, 'com as referências oficiais de teste, nenhum tipo indisponível');
    await p.click('#estSalvar');
    await p.waitForSelector('#estErros');
    const errs = await texto(p, '#estErros');
    afirma(/Escolha o tipo/.test(errs) && /Preencha o campo Nome/.test(errs), 'salvar vazio explica o que falta (tipo e nome)', errs);
    afirma(await p.locator('#estNome[aria-invalid="true"]').count() === 1, 'o campo Nome fica marcado como inválido');
    async function cadastrar(tipo, nome, sigla, descricao, duplo) {
      if (!(await p.locator('#estForm').count())) { await p.click('#estNova'); await p.waitForSelector('#estTipos input[name="estTipo"]'); }
      await p.check('#estTipos input[value="' + tipo + '"]');
      await p.fill('#estNome', nome); if (sigla) await p.fill('#estSigla', sigla); if (descricao) await p.fill('#estDescricao', descricao);
      if (duplo) await p.locator('#estSalvar').dblclick(); else await p.click('#estSalvar');
      await p.waitForSelector('#estFlash', { timeout: 15000 });
      return p.evaluate(() => (/[?&]e=([^&]+)/.exec(location.hash) || [])[1]);
    }
    const idNeg = await cadastrar('NEGOCIOS', 'Linha de Investimentos', 'LINV', 'Linha de negócios de investimentos.\nSegunda linha da descrição.', true);
    afirma(/Estrutura cadastrada/.test(await texto(p, '#estFlash')), 'confirmação visível depois de salvar');
    afirma(!!idNeg, 'a ficha abre no endereço da estrutura (&e=…)');
    afirma(/Linha/.test(await texto(p, '#estFicha')) && /Linha de Negócios/.test(await texto(p, '#estFicha')) && /LINV/.test(await texto(p, '#estFicha')), 'ficha com natureza, especialização e sigla');
    await esperarCondicaoAte(p, () => /Definição de teste — NEGOCIOS/.test((document.querySelector('#estDefinicaoTipo') || {}).textContent || ''), undefined, { limite: 15000 });
    afirma(/Definição oficial\s*Definição de teste — NEGOCIOS/.test(await texto(p, '#estFicha')), 'ficha: definição oficial vigente do tipo, lida da Taxonomia (M2)');
    const nRegs = await S.banco('GET', 'estruturas-concretas/registros').then((r) => Object.keys(r.corpo || {}).length);
    afirma(nRegs === 1, 'duplo clique em salvar gravou UMA estrutura', nRegs);
    await p.click('#estFlashOutra');
    const idCoe = await cadastrar('COE', 'CoE de Dados');
    await p.click('#estFlashOutra');
    const idAe = await cadastrar('AREA_ESPECIALIZADA', 'Área de Riscos');
    await p.click('#estFlashOutra');
    const idPlat = await cadastrar('PLATAFORMA_HABILITADORA_TECNOLOGIA', 'Plataforma de Nuvem');

    /* ===== 3. Mapa com estruturas ===== */
    console.log('\n3. Mapa com as estruturas cadastradas');
    await p.click('#estFlashMapa');
    await p.waitForSelector('#mfmDetalhe', { timeout: 15000 });
    const noBloco = async (bloco, id) => p.locator('[data-bloco="' + bloco + '"] [data-estrutura="' + id + '"]').count();
    afirma(await noBloco('plataformas', idPlat) === 1 && await p.locator('[data-codigo="PLATAFORMA_HABILITADORA_TECNOLOGIA"] [data-estrutura="' + idPlat + '"]').count() === 1, 'Plataforma de Nuvem na especialização Habilitadora de Tecnologia');
    afirma(await noBloco('negocios', idNeg) === 1 && await p.locator('[data-bloco="negocios"] [data-subagrupador=""] [data-estrutura="' + idNeg + '"]').count() === 1, 'Linha de Investimentos em Linhas de Negócios › "Sem subagrupador"');
    afirma(await noBloco('coe', idCoe) === 1, 'CoE de Dados em Centros de Excelência');
    afirma(await noBloco('ae', idAe) === 1, 'Área de Riscos em Áreas Especializadas');
    afirma(/Plataforma de Nuvem/.test(await texto(p, '#mfmDetalhe')) && /Estrutura cadastrada/.test(await texto(p, '#mfmDetalhe')), 'a estrutura salva abre com os detalhes no Mapa');
    await esperarCondicaoAte(p, () => !!document.getElementById('mfmSemObjetos'), undefined, { limite: 15000 });
    afirma(/Nenhum produto ou serviço vinculado/.test(await texto(p, '#mfmSemObjetos')), 'produtos e serviços: nenhum vínculo cadastrado → diz que não há (nada inventado; M4)');
    afirma(/Definição oficial\s*Definição vigente indisponível/.test(await texto(p, '#mfmDetalhe')), 'detalhe no Mapa: tipo sem definição vigente na Taxonomia → "indisponível", sem texto substituto (M2)');
    await p.click('[data-estrutura="' + idNeg + '"]');
    await p.waitForFunction((id) => location.hash.indexOf('e=' + id) !== -1, idNeg);
    await esperarCondicaoAte(p, () => { const q = document.getElementById('mfmSquads'); return !!q && !/Carregando/.test(q.innerText); }, undefined, { limite: 15000 });
    const det = await texto(p, '#mfmDetalhe');
    afirma(/Linha de Investimentos/.test(det) && /Sem subagrupador/.test(det) && /LINV/.test(det) && /Organização por Squads\s*Admitida para este tipo de estrutura/.test(det) && /Squads vinculados\s*Nenhum Squad vinculado/.test(det), 'clicar na estrutura mostra natureza, caminho, sigla e Squads (possível × vinculados, sem inventar)', det.slice(0, 200));
    afirma(/Definição oficial\s*Definição de teste — NEGOCIOS/.test(det), 'detalhe no Mapa: definição oficial vigente do tipo (M2)', det.slice(0, 300));

    /* ===== 4. Persistência ===== */
    console.log('\n4. Persistência');
    await p.reload();
    await p.waitForFunction(() => window.faAuth && window.faAuth.getSession && window.faAuth.getSession(), null, { timeout: 20000 });
    await p.waitForSelector('#mfmDetalhe', { timeout: 20000 });
    afirma(/Linha de Investimentos/.test(await texto(p, '#mfmDetalhe')) && await p.locator('#mfmMapa .mfm-caixa').count() === 4, 'depois de recarregar, as 4 estruturas e o detalhe aberto continuam lá');

    /* ===== 4b. Navegação Mapa ↔ ficha ↔ edição (reproduzida, não presumida) ===== */
    console.log('\n4b. Navegação Mapa ↔ ficha ↔ edição');
    await ir(p, '#avaliacoes?mf=mapa&e=' + idCoe);
    await p.waitForSelector('#mfmAbrirCadastro', { timeout: 15000 });
    afirma(/Abrir a ficha no cadastro/.test(await texto(p, '#mfmAbrirCadastro')), 'o link do Mapa diz que leva à ficha no cadastro');
    await p.click('#mfmAbrirCadastro');
    await p.waitForSelector('#estFicha', { timeout: 15000 });
    afirma((await p.evaluate(() => location.hash)).indexOf('e=' + idCoe) !== -1 && (await texto(p, '#estTitulo')) === 'CoE de Dados', 'chega à ficha da MESMA estrutura (identificador preservado no endereço)');
    afirma(/Voltar para a lista de estruturas/i.test(await texto(p, '#estVoltarLista')), 'o voltar da ficha diz o destino (a lista de estruturas)');
    await p.click('#estEditar');
    await p.fill('#estNome', 'Nome digitado e não salvo');
    afirma(/Voltar para a ficha/i.test(await texto(p, '#estVoltarFicha')), 'o voltar da edição diz o destino (a ficha)');
    await p.click('#estCancelar'); /* confirma o descarte (diálogo aceito) */
    await p.waitForSelector('#estFicha');
    afirma((await texto(p, '#estTitulo')) === 'CoE de Dados' && (await S.banco('GET', 'estruturas-concretas/registros/' + idCoe)).corpo.nome === 'CoE de Dados', 'cancelar a edição volta à ficha com os dados salvos intactos');
    await p.reload();
    await p.waitForFunction(() => window.faAuth && window.faAuth.getSession && window.faAuth.getSession(), null, { timeout: 20000 });
    await p.waitForSelector('#estFicha', { timeout: 20000 });
    afirma((await texto(p, '#estTitulo')) === 'CoE de Dados', 'recarregar na ficha reabre a mesma estrutura');
    await p.goBack();
    await p.waitForSelector('#mfmDetalhe', { timeout: 15000 });
    afirma(/CoE de Dados/.test(await texto(p, '#mfmDetalhe')), 'o Voltar do navegador devolve ao Mapa com a mesma estrutura aberta');
    await ir(p, '#avaliacoes?mf=mapa&e=' + idNeg);
    await p.waitForFunction(() => /Linha de Investimentos/.test((document.querySelector('#mfmDetalhe') || {}).innerText || ''), null, { timeout: 15000 });

    /* ===== 5. Editar e encerrar ===== */
    console.log('\n5. Editar e encerrar');
    await p.click('#mfmAbrirCadastro');
    await p.waitForSelector('#estFicha', { timeout: 15000 });
    await p.click('#estEditar');
    await p.fill('#estNome', 'Linha de Investimentos e Previdência');
    await p.fill('#estJustificativa', 'Nome oficial atualizado.');
    await p.click('#estSalvar');
    await p.waitForSelector('#estFlash');
    afirma(/Alterações salvas/.test(await texto(p, '#estFlash')), 'alteração confirmada');
    await p.click('#estHistorico summary');
    const hist = await texto(p, '#estHistorico');
    const mudNome = p.locator('#estHistorico .est-evento--alterada .est-mudanca[data-campo="nome"]');
    const antesNome = await mudNome.locator('.est-valor--antes .est-valor-texto').innerText().catch(() => '');
    const depoisNome = await mudNome.locator('.est-valor--depois .est-valor-texto').innerText().catch(() => '');
    afirma(/Histórico — 2 alterações/i.test(hist) && antesNome === 'Linha de Investimentos' && depoisNome === 'Linha de Investimentos e Previdência' &&
      /Justificativa\s*Nome oficial atualizado/i.test(hist), 'histórico: campo Nome com "Antes" e "Depois" separados e a justificativa em destaque', hist.slice(0, 300));
    await p.click('#estVerNoMapa');
    await p.waitForSelector('#mfmDetalhe', { timeout: 15000 });
    afirma(/Linha de Investimentos e Previdência/.test(await texto(p, '[data-estrutura="' + idNeg + '"]')), 'o Mapa mostra o nome novo');
    await ir(p, '#admin?arq=estruturas&e=' + idAe);
    await p.waitForSelector('#estFicha', { timeout: 15000 });
    await p.click('#estEncerrar');
    await p.waitForSelector('.est-confirmacao');
    afirma(/Confirme o encerramento/.test(await texto(p, '.est-confirmacao')), 'encerrar pede confirmação e explica as consequências');
    await p.click('#estSalvar');
    await p.waitForSelector('#estErros');
    afirma(/motivo/.test(await texto(p, '#estErros')), 'sem motivo, o encerramento é recusado com explicação');
    await p.fill('#estMotivo', 'Área incorporada ao CoE de Dados.');
    await p.click('#estSalvar');
    await p.waitForSelector('#estFlash');
    afirma(/Estrutura encerrada/.test(await texto(p, '#estFlash')) && /Encerrada/.test(await texto(p, '#estFicha')) && /Área incorporada ao CoE de Dados/.test(await texto(p, '#estFicha')), 'encerrada, com o motivo na ficha');
    afirma(await p.locator('#estEditar, #estEncerrar').count() === 0, 'estrutura encerrada não oferece editar nem encerrar');
    await p.click('#estHistorico summary');
    afirma(/Encerrada/.test(await texto(p, '#estHistorico')) && /Motivo do encerramento\s*Área incorporada/i.test(await texto(p, '#estHistorico')), 'o histórico guarda o encerramento e o motivo');
    await ir(p, '#avaliacoes?mf=mapa');
    await p.waitForSelector('#mfmMapa');
    afirma(await p.locator('[data-estrutura="' + idAe + '"]').count() === 0 && /Nenhuma estrutura cadastrada/.test(await texto(p, '[data-bloco="ae"]')), 'a estrutura encerrada sai do Mapa');
    await ir(p, '#admin?arq=estruturas');
    await p.waitForSelector('#estLista');
    afirma(await p.locator('.est-item[data-estrutura="' + idAe + '"]').count() === 0, 'a lista mostra só as ativas por padrão');
    await p.check('#estMostrarEncerradas');
    afirma(/Encerrada/.test(await texto(p, '.est-item[data-estrutura="' + idAe + '"]')), '"Mostrar encerradas" traz a encerrada, marcada como Encerrada');
    /* legibilidade: contraste medido (WCAG, ≥ 4,5:1) do nome e do tipo contra o fundo do cartão, ativa e encerrada;
       ativa × encerrada diferentes também fora da etiqueta (faixa lateral e fundo) */
    const contraste = await p.evaluate((ids) => {
      const rgb = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = (c) => { const v = rgb(c).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      return ids.map((id) => {
        const card = document.querySelector('.est-item[data-estrutura="' + id + '"]'), fundo = getComputedStyle(card).backgroundColor;
        return { nome: razao(getComputedStyle(card.querySelector('.est-item-nome')).color, fundo), tipo: razao(getComputedStyle(card.querySelector('.est-item-tipo')).color, fundo),
          faixa: getComputedStyle(card).borderLeftColor, fundo: fundo, peso: getComputedStyle(card.querySelector('.est-item-nome')).fontWeight };
      });
    }, [idCoe, idAe]);
    afirma(contraste.every((c) => c.nome >= 4.5 && c.tipo >= 4.5), 'cartões legíveis: nome e tipo com contraste ≥ 4,5:1 (ativa e encerrada)', JSON.stringify(contraste.map((c) => [c.nome.toFixed(1), c.tipo.toFixed(1)])));
    afirma(contraste[0].faixa !== contraste[1].faixa && contraste[0].fundo !== contraste[1].fundo, 'ativa × encerrada diferentes também na faixa lateral e no fundo do cartão');
    afirma(+contraste[0].peso >= 600, 'o nome da estrutura é o destaque do cartão');
    await p.click('.est-item[data-estrutura="' + idAe + '"]');
    await p.waitForSelector('#estFicha');
    const secoes = await p.locator('#adminEstruturas .est-secao-titulo').allInnerTexts();
    afirma(['IDENTIFICAÇÃO', 'SITUAÇÃO E CONTROLE'].every((t) => secoes.some((s) => s.toUpperCase().indexOf(t) === 0)) && secoes.some((s) => /^Histórico/i.test(s)), 'ficha em três grupos: Identificação, Situação e controle, Histórico', secoes.join(' | '));
    afirma(await p.locator('#estEditar, #estEncerrar').count() === 0 && /reativada/.test(await texto(p, '#estEncerradaAviso')), 'ficha da encerrada: só consulta, sem editar nem reativar');
    await ir(p, '#admin?arq=estruturas');
    await p.waitForSelector('#estLista');

    /* ===== 6. Conflito ===== */
    console.log('\n6. Conflito');
    await ir(p, '#admin?arq=estruturas&e=' + idCoe);
    await p.waitForSelector('#estEditar');
    await p.click('#estEditar');
    await p.fill('#estNome', 'CoE de Dados e Analytics');
    const adm = await sessao('admin');
    const r2 = await adm.evaluate(async (id) => {
      const casos = faEstruturasCasosDeUso.criar({ nucleo: faEstruturasNucleo, codigosFirmes: faMotorPosicionamentoNucleo.CODIGOS_FIRMES });
      const u = firebase.auth().currentUser;
      return casos.executar('alterarEstrutura', { id: id, alteracoes: { sigla: 'CDD' } }, { operacaoId: firebase.database().ref().push().key, usuario: { id: u.uid, email: u.email }, agora: Date.now() },
        faEstruturasFirebase.criarPortas({ db: firebase.database(), codigosFirmes: faMotorPosicionamentoNucleo.CODIGOS_FIRMES }));
    }, idCoe);
    afirma(r2.ok, 'outra pessoa (admin geral) alterou a mesma estrutura antes');
    await espera(800);
    await p.click('#estSalvar');
    await p.waitForSelector('#estErros', { timeout: 15000 });
    afirma(/Outra pessoa alterou esta estrutura/.test(await texto(p, '#estErros')), 'quem salvou depois recebe a explicação do conflito, sem sobrescrever');
    const coe = (await S.banco('GET', 'estruturas-concretas/registros/' + idCoe)).corpo;
    afirma(coe.nome === 'CoE de Dados' && coe.sigla === 'CDD' && coe.revisao === 2, 'no banco ficou só a alteração que chegou primeiro', JSON.stringify({ nome: coe.nome, sigla: coe.sigla, revisao: coe.revisao }));
    await adm.context().close();

    /* ===== 6b. Subagrupadores das Linhas de Negócios (Etapa 5) ===== */
    console.log('\n6b. Subagrupadores das Linhas de Negócios (Etapa 5)');
    /* a edição do conflito ficou aberta com alteração não salva: a tela não sai sozinha por endereço — cancela antes */
    await p.click('#estCancelar'); await p.waitForSelector('#estFicha');
    await ir(p, '#admin?arq=estruturas');
    await p.waitForSelector('#estAbaSubagrupadores', { timeout: 15000 });
    await p.click('#estAbaSubagrupadores');
    await p.waitForSelector('#sgVazio', { timeout: 15000 });
    afirma(/Sem subagrupador/.test(await texto(p, '#sgVazio')) && /sg=lista/.test(await p.evaluate(() => location.hash)), 'aba própria, com endereço (&sg=lista); sem subagrupadores, as Linhas ficam em "Sem subagrupador"');
    async function novoSg(nome) {
      await p.click('#sgNovo'); await p.waitForSelector('#sgNome');
      await p.fill('#sgNome', nome); await p.click('#sgSalvar');
      await p.waitForSelector('#estFlash', { timeout: 15000 });
      return p.evaluate(() => decodeURIComponent((/[?&]sg=([^&]+)/.exec(location.hash) || [])[1] || ''));
    }
    await p.click('#sgNovo'); await p.waitForSelector('#sgNome'); await p.click('#sgSalvar');
    await p.waitForSelector('#estErros');
    afirma(/Preencha o campo Nome/.test(await texto(p, '#estErros')), 'subagrupador sem nome: explica o que falta');
    await p.click('#sgCancelar'); await p.waitForSelector('#sgVazio');
    const sgPrev = await novoSg('Previdência');
    afirma(!!sgPrev && /Subagrupador criado/.test(await texto(p, '#estFlash')), 'subagrupador criado, com confirmação e ficha própria');
    await p.click('#sgVoltarLista'); await p.waitForSelector('#sgLista');
    const sgCred = await novoSg('Crédito');
    await ir(p, '#avaliacoes?mf=mapa');
    await p.waitForSelector('#mfmMapa', { timeout: 15000 });
    const ordemMapa = async () => p.$$eval('[data-bloco="negocios"] [data-subagrupador]', (els) => els.map((e) => e.getAttribute('data-subagrupador')));
    afirma(JSON.stringify(await ordemMapa()) === JSON.stringify([sgPrev, sgCred, '']), 'o Mapa mostra Previdência, Crédito e "Sem subagrupador", nessa ordem', JSON.stringify(await ordemMapa()));
    afirma(/Nenhuma Linha associada/.test(await texto(p, '[data-subagrupador="' + sgPrev + '"]')) && await p.locator('[data-subagrupador=""] [data-estrutura="' + idNeg + '"]').count() === 1, 'subagrupador vazio diz "Nenhuma Linha associada"; a Linha continua em "Sem subagrupador"');
    /* marco: associar uma Linha e vê-la no lugar certo */
    await ir(p, '#admin?arq=estruturas&e=' + idNeg);
    await p.waitForSelector('#estSubagrupador #estSgEscolha', { timeout: 15000 });
    afirma(/Sem subagrupador/.test(await texto(p, '#estSgAtual')), 'a ficha da Linha de Negócios mostra onde ela está no Mapa');
    await p.selectOption('#estSgEscolha', sgPrev);
    await p.fill('#estSgJustificativa', 'Portfólio de previdência.');
    await p.click('#estSgAssociar');
    await p.waitForFunction(() => /agora aparece no subagrupador/.test((document.querySelector('#estFlash') || {}).innerText || ''), null, { timeout: 15000 });
    const sgAtualTxt = await texto(p, '#estSgAtual'), sgFlashTxt = await texto(p, '#estFlash');
    afirma(/Previdência/.test(sgAtualTxt) && /agora aparece no subagrupador "Previdência"/.test(sgFlashTxt), 'associada: a ficha confirma e mostra o subagrupador', JSON.stringify({ atual: sgAtualTxt, flash: sgFlashTxt }));
    await ir(p, '#avaliacoes?mf=mapa&e=' + idNeg);
    await p.waitForSelector('#mfmDetalhe', { timeout: 15000 });
    afirma(await p.locator('[data-bloco="negocios"] [data-subagrupador="' + sgPrev + '"] [data-estrutura="' + idNeg + '"]').count() === 1 && await p.locator('[data-subagrupador=""] [data-estrutura="' + idNeg + '"]').count() === 0, 'MARCO: a Linha aparece dentro de Previdência no Mapa (e não mais em "Sem subagrupador")');
    afirma(/Linhas de Negócios › Previdência/.test(await texto(p, '#mfmDetalhe .mfm-caminho')) && (await texto(p, '#mfmSubagrupador')) === 'Previdência', 'o detalhe no Mapa mostra o caminho e o subagrupador');
    /* trocar */
    await ir(p, '#admin?arq=estruturas&e=' + idNeg);
    await p.waitForSelector('#estSgEscolha');
    await p.selectOption('#estSgEscolha', sgCred);
    await p.click('#estSgAssociar');
    await p.waitForFunction(() => /Crédito/.test((document.querySelector('#estSgAtual') || {}).innerText || ''), null, { timeout: 15000 });
    await p.click('#estHistorico summary');
    const histSg = await texto(p, '#estHistorico');
    afirma(/Passou para o subagrupador Crédito/.test(histSg) && /Saiu do subagrupador Previdência \(troca\)/.test(histSg) && /Associada ao subagrupador Previdência/.test(histSg) && /Portfólio de previdência/.test(histSg), 'a troca fica no histórico da Linha (associada, saiu, passou para), com a justificativa', histSg.slice(0, 300));
    /* ordenar: Crédito sobe */
    await ir(p, '#admin?arq=estruturas&sg=lista');
    await p.waitForSelector('#sgLista');
    await p.click('.sg-subir[data-subagrupador="' + sgCred + '"]');
    await p.waitForFunction(() => /Ordem atualizada/.test((document.querySelector('#estFlash') || {}).innerText || ''), null, { timeout: 15000 });
    await ir(p, '#avaliacoes?mf=mapa');
    await p.waitForSelector('#mfmMapa');
    afirma(JSON.stringify(await ordemMapa()) === JSON.stringify([sgCred, sgPrev]), 'subir na lista muda a ordem no Mapa (Crédito antes de Previdência; sem Linha solta, não há "Sem subagrupador")', JSON.stringify(await ordemMapa()));
    /* renomear */
    await ir(p, '#admin?arq=estruturas&sg=' + sgCred);
    await p.waitForSelector('#sgRenomear', { timeout: 15000 });
    await p.click('#sgRenomear'); await p.fill('#sgNome', 'Crédito Consignado'); await p.click('#sgSalvar');
    await p.waitForSelector('#estFlash');
    await ir(p, '#avaliacoes?mf=mapa');
    await p.waitForSelector('#mfmMapa');
    afirma(/Crédito Consignado/.test(await texto(p, '[data-subagrupador="' + sgCred + '"]')) && await p.locator('[data-subagrupador="' + sgCred + '"] [data-estrutura="' + idNeg + '"]').count() === 1, 'renomear aparece no Mapa, com a Linha dentro');
    /* encerrar com a Linha associada: nada em cascata, a Linha vai para "Sem subagrupador" */
    await ir(p, '#admin?arq=estruturas&sg=' + sgCred);
    await p.waitForSelector('#sgEncerrar');
    await p.click('#sgEncerrar');
    await p.waitForSelector('.est-confirmacao');
    afirma(/1 Linha associada passa a aparecer em "Sem subagrupador"/.test(await texto(p, '.est-confirmacao')), 'encerrar avisa que a Linha associada vai para "Sem subagrupador"');
    await p.click('#sgSalvar'); await p.waitForSelector('#estErros');
    afirma(/motivo/i.test(await texto(p, '#estErros')), 'encerrar sem motivo é recusado com explicação');
    await p.fill('#sgMotivo', 'Crédito consignado passa a ser tratado no subagrupador Previdência.'); await p.click('#sgSalvar');
    await p.waitForSelector('#sgEncerradoAviso', { timeout: 15000 });
    afirma(await p.locator('#sgRenomear, #sgEncerrar').count() === 0, 'subagrupador encerrado: só consulta, sem renomear nem reativar');
    await ir(p, '#avaliacoes?mf=mapa');
    await p.waitForSelector('#mfmMapa');
    afirma(JSON.stringify(await ordemMapa()) === JSON.stringify([sgPrev, '']) && await p.locator('[data-subagrupador=""] [data-estrutura="' + idNeg + '"]').count() === 1, 'no Mapa, o subagrupador encerrado some e a Linha volta para "Sem subagrupador"', JSON.stringify(await ordemMapa()));
    await ir(p, '#admin?arq=estruturas&e=' + idNeg);
    await p.waitForSelector('#estSgAtual');
    afirma(/Sem subagrupador/.test(await texto(p, '#estSgAtual')) && /foi encerrado/.test(await texto(p, '#estSgAtual')), 'a ficha da Linha explica: sem subagrupador porque o anterior foi encerrado');
    const assocs = (await S.banco('GET', 'mapa-subagrupadores/associacoes')).corpo || {};
    afirma(Object.values(assocs).filter((a) => a.estruturaId === idNeg).length === 2 && Object.values(assocs).some((a) => a.estruturaId === idNeg && a.situacao === 'ativa' && a.subagrupadorId === sgCred), 'no banco: a associação anterior ficou no histórico e a atual continua registrada (nada em cascata)');
    await ir(p, '#admin?arq=estruturas&e=' + idCoe);
    await p.waitForSelector('#estFicha');
    afirma(await p.locator('#estSubagrupador').count() === 0, 'CoE (não é Linha de Negócios): a ficha não oferece subagrupador');

    /* ===== 7. Perfil só de consulta ===== */
    console.log('\n7. Perfil só de consulta');
    const c = await sessao('consulta');
    await ir(c, '#avaliacoes?mf=mapa');
    await c.waitForSelector('#mfmMapa', { timeout: 15000 });
    afirma(await c.locator('#mfmMapa .mfm-caixa').count() === 3, 'a consulta vê as 3 estruturas ativas no Mapa');
    afirma(await c.locator('#mfmIrCadastro').count() === 0, 'a consulta não vê o atalho de cadastro');
    await c.click('[data-estrutura="' + idCoe + '"]');
    await c.waitForSelector('#mfmDetalhe');
    afirma(await c.locator('#mfmAbrirCadastro').count() === 0, 'no detalhe, a consulta não vê "Abrir no cadastro"');
    await ir(c, '#admin?arq=estruturas');
    await espera(1500);
    afirma(await c.locator('#adminEstruturas:not([hidden])').count() === 0, 'a consulta não entra no cadastro pelo endereço');
    const r3 = await c.evaluate(async () => {
      const casos = faEstruturasCasosDeUso.criar({ nucleo: faEstruturasNucleo, codigosFirmes: faMotorPosicionamentoNucleo.CODIGOS_FIRMES });
      const u = firebase.auth().currentUser;
      return casos.executar('criarEstrutura', { tipo: 'COE', nome: 'Gravação indevida' }, { operacaoId: firebase.database().ref().push().key, novoId: firebase.database().ref().push().key, usuario: { id: u.uid, email: u.email }, agora: Date.now() },
        faEstruturasFirebase.criarPortas({ db: firebase.database(), codigosFirmes: faMotorPosicionamentoNucleo.CODIGOS_FIRMES }));
    });
    afirma(!r3.ok, 'mesmo pelo código, o banco recusa a gravação da consulta', JSON.stringify(r3.erros || r3.situacao));
    const r4 = await c.evaluate(async () => {
      const casos = faEstruturasCasosDeUso.criar({ nucleo: faEstruturasNucleo, codigosFirmes: faMotorPosicionamentoNucleo.CODIGOS_FIRMES });
      const u = firebase.auth().currentUser;
      return casos.executar('criarSubagrupador', { nome: 'Indevido' }, { operacaoId: firebase.database().ref().push().key, novoId: firebase.database().ref().push().key, usuario: { id: u.uid, email: u.email }, agora: Date.now() },
        faEstruturasFirebase.criarPortas({ db: firebase.database(), codigosFirmes: faMotorPosicionamentoNucleo.CODIGOS_FIRMES }));
    });
    afirma(!r4.ok, 'a consulta também não cria subagrupador (o banco recusa)', JSON.stringify(r4.erros || r4.situacao));
    await ir(c, '#avaliacoes?mf=mapa');
    await c.waitForSelector('#mfmMapa', { timeout: 15000 });
    afirma(await c.locator('[data-bloco="negocios"] [data-subagrupador]').count() === 2, 'a consulta vê o subagrupador ativo e "Sem subagrupador" no Mapa');
    await c.context().close();

    /* ===== 8. Demonstração × cadastradas ===== */
    console.log('\n8. Demonstração separada');
    await ir(p, '#avaliacoes?mf=mapa');
    await p.waitForSelector('#mfmMapa');
    await p.click('.mfm-fonte[data-fonte="demo"]');
    await p.waitForSelector('#mfmMapa');
    const demoTxt = await texto(p, '#mfmMapa');
    afirma(/Demonstração/.test(await texto(p, '#mfmFaixa')) && !/CoE de Dados|Plataforma de Nuvem|Linha de Investimentos/.test(demoTxt), 'a demonstração não mostra nenhuma estrutura cadastrada');
    afirma(/fonte=demo/.test(await p.evaluate(() => location.hash)), 'a demonstração tem endereço próprio (&fonte=demo)');
    await p.click('.mfm-fonte[data-fonte="cadastro"]');
    await p.waitForSelector('#mfmMapa .mfm-caixa');
    const cadTxt = await texto(p, '#mfmMapa');
    afirma(/CoE de Dados/.test(cadTxt) && await p.locator('#mfmMapa .mfm-caixa').count() === 3, 'de volta às cadastradas: só elas, nenhum exemplo fictício');

    /* ===== 10. Celular ===== */
    /* ===== 8b. Estrutura responsável (M3 do Mapa) ===== */
    console.log('\n8b. Estrutura responsável na ficha do Posicionamento (M3)');
    {
      /* um item com Posicionamento VIGENTE e concluído (resultado exato do motor v1: Negócios) e uma segunda Linha de
         Negócios ativa — dados de TESTE no emulador próprio desta jornada */
      const M = require(path.join(RAIZ, 'forca-agil', 'motor-posicionamento.js'));
      const QUANDO = '2026-10-01T09:00:00.000Z', outra = { name: 'Outra', email: 'o@previ.com.br' };
      const respostas = { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'SIM' }, res = M.avaliar(respostas, {}), ra = {};
      Object.keys(res).forEach((c) => { const v = res[c]; if (v !== null && !(Array.isArray(v) && !v.length)) ra[c] = v; });
      const reg = { itemId: 'item-m3', itemNome: 'Produto Delta', avaliacaoArquiteturalId: 'item-m3', questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'concluido', revisao: 2,
        respostas: {}, criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, auditoriaCriacaoId: 'ac-m3', concluidoPor: outra, concluidoEm: QUANDO, auditoriaConclusaoId: 'az-m3', resultadoAutomatico: ra };
      Object.keys(respostas).forEach((q) => { reg.respostas[q] = { resposta: respostas[q], codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO, textoPerguntaNaEpoca: 'Texto de ' + q }; });
      await S.banco('PATCH', '', { 'avaliacoes-posicionamento/pos-m3': reg, 'posicionamento-vigente-por-item/item-m3': 'pos-m3',
        'estruturas-concretas/registros/neg-2': { id: 'neg-2', tipo: 'NEGOCIOS', nome: 'Linha de Crédito', situacao: 'ativa', revisao: 1, criadaEm: 1791713600000, criadaPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'semente-m3' } });
      afirma(ra.codigoResultado === 'NEGOCIOS', 'Posicionamento de teste concluído com o resultado do motor v1: Negócios', ra.codigoResultado);
      const situacao = (pg) => pg.evaluate(() => (document.getElementById('poRespSituacao') || {}).textContent || '');
      const prontoBloco = (pg) => esperarCondicaoAte(pg, () => { const el = document.getElementById('poResponsavel'); return !!el && !!document.getElementById('poRespSituacao'); }, undefined, { limite: 15000 });
      const vinculos = async () => ((await S.banco('GET', 'estruturas-vinculos/registros')).corpo) || {};
      await ir(p, '#avaliacoes?po=pos-m3');
      afirma(await prontoBloco(p), 'a ficha do Posicionamento vigente mostra o bloco "Estrutura responsável"');
      afirma((await situacao(p)) === 'Sem estrutura responsável' && /Negócios|Linha de Negócios/.test(await texto(p, '#poRespAusente')), 'sem vínculo: situação "Sem estrutura responsável", com o posicionamento efetivo do item', await texto(p, '#poResponsavel'));
      await p.click('#poRespVincular');
      await p.waitForSelector('#poRespEstruturaSel');
      const opcoes = await p.$$eval('#poRespEstruturaSel option', (os) => os.map((o) => o.value).filter(Boolean).sort());
      afirma(JSON.stringify(opcoes) === JSON.stringify([idNeg, 'neg-2'].sort()), 'só aparecem estruturas ATIVAS do tipo do posicionamento efetivo (nenhum CoE nem Área)', JSON.stringify(opcoes));
      await p.click('#poRespSalvar');
      await p.waitForSelector('#poRespErros');
      afirma(/Escolha a estrutura responsável/.test(await texto(p, '#poRespErros')) && Object.keys(await vinculos()).length === 0, 'salvar sem escolher explica o que falta e não grava nada');
      await p.selectOption('#poRespEstruturaSel', idNeg);
      await p.fill('#poRespJustificativa', 'Linha dona da jornada do produto');
      await p.click('#poRespSalvar');
      await p.waitForSelector('#poRespFlash', { timeout: 15000 });
      let vs = await vinculos(), ativos = Object.values(vs).filter((v) => v.situacao === 'ativa');
      afirma((await situacao(p)) === 'Válido' && /Linha de Investimentos/.test(await texto(p, '#poRespEstrutura')) && ativos.length === 1 && ativos[0].estruturaId === idNeg && ativos[0].base.codigo === 'NEGOCIOS' && ativos[0].base.origem === 'recomendacao',
        'vincular: grava um responsável principal com a base do Posicionamento; a situação passa a "Válido"', JSON.stringify(ativos));
      const idx = (await S.banco('GET', 'estruturas-vinculos/ativo-por-objeto/item-m3')).corpo;
      afirma(idx === ativos[0].id, 'o índice do item aponta para o vínculo ativo');
      await p.click('#poRespSubstituir');
      await p.waitForSelector('#poRespEstruturaSel');
      afirma(JSON.stringify(await p.$$eval('#poRespEstruturaSel option', (os) => os.map((o) => o.value).filter(Boolean))) === '["neg-2"]', 'substituir: a estrutura atual não aparece de novo');
      await p.selectOption('#poRespEstruturaSel', 'neg-2');
      await p.click('#poRespSalvar');
      await p.waitForSelector('#poRespErros');
      afirma(/Informe o motivo/.test(await texto(p, '#poRespErros')), 'substituir sem motivo é recusado (motivo obrigatório)');
      await p.fill('#poRespMotivo', 'Reorganização das Linhas');
      await p.click('#poRespSalvar');
      await p.waitForSelector('#poRespFlash', { timeout: 15000 });
      vs = await vinculos(); ativos = Object.values(vs).filter((v) => v.situacao === 'ativa');
      const antigo = Object.values(vs).find((v) => v.situacao === 'encerrada');
      afirma(ativos.length === 1 && ativos[0].estruturaId === 'neg-2' && antigo && antigo.encerramento.motivo === 'Reorganização das Linhas' && antigo.encerramento.substituidoPor === ativos[0].id && ativos[0].substitui === antigo.id,
        'substituir: encerra o atual (com o motivo) e cria o novo na mesma operação; nada é apagado', JSON.stringify(vs));
      /* D: a estrutura responsável encerrada → "Precisa de revisão", calculado pelo núcleo; nada muda sozinho */
      await S.banco('PATCH', 'estruturas-concretas/registros/neg-2', { situacao: 'encerrada', revisao: 2, encerramento: { motivo: 'Teste', em: 1791713700000, por: { id: 'semente', email: 'semente@teste' } } });
      await esperarCondicaoAte(p, () => (document.getElementById('poRespSituacao') || {}).textContent === 'Precisa de revisão', undefined, { limite: 15000 });
      afirma((await situacao(p)) === 'Precisa de revisão' && /a estrutura responsável foi encerrada/.test(await texto(p, '#poRespRevisao')) && Object.values(await vinculos()).filter((v) => v.situacao === 'ativa').length === 1,
        'estrutura responsável encerrada: "Precisa de revisão" com o motivo; o vínculo continua registrado (nada muda sozinho)');
      await p.click('#poRespEncerrar');
      await p.waitForSelector('#poRespMotivo');
      await p.click('#poRespSalvar');
      await p.waitForSelector('#poRespErros');
      afirma(/Informe o motivo/.test(await texto(p, '#poRespErros')), 'encerrar sem motivo é recusado');
      await p.fill('#poRespMotivo', 'A Linha foi encerrada');
      await p.click('#poRespSalvar');
      await p.waitForSelector('#poRespFlash', { timeout: 15000 });
      vs = await vinculos();
      afirma((await situacao(p)) === 'Sem estrutura responsável' && Object.values(vs).length === 2 && Object.values(vs).every((v) => v.situacao === 'encerrada') && (await S.banco('GET', 'estruturas-vinculos/ativo-por-objeto/item-m3')).corpo === null,
        'encerrar: o item fica sem responsável; os dois vínculos continuam registrados, encerrados');
      afirma(await semRolagemLateral(p), 'computador: ficha com o bloco sem rolagem lateral');
      /* perfil só de consulta: vê, não mexe */
      const cq = await sessao('consulta');
      await ir(cq, '#avaliacoes?po=pos-m3');
      afirma(await prontoBloco(cq), 'perfil avaliacao (consulta) vê o bloco');
      afirma(await cq.locator('#poRespVincular, #poRespSubstituir, #poRespEncerrar, #poRespForm').count() === 0, 'perfil avaliacao (consulta) não tem botão nem formulário de vínculo');
      await cq.context().close();
      /* celular: vincular de novo, em 375 px */
      const cel = await sessao('configuracao', 375);
      await ir(cel, '#avaliacoes?po=pos-m3');
      afirma(await prontoBloco(cel), '375 px: o bloco aparece');
      await cel.click('#poRespVincular'); await cel.waitForSelector('#poRespEstruturaSel');
      const alvoSel = await cel.locator('#poRespEstruturaSel').boundingBox(), alvoBtn = await cel.locator('#poRespSalvar').boundingBox();
      afirma(alvoSel && alvoSel.height >= 40 && alvoBtn && alvoBtn.height >= 40, '375 px: seleção e botão com área de toque adequada', JSON.stringify([alvoSel && alvoSel.height, alvoBtn && alvoBtn.height]));
      afirma(await semRolagemLateral(cel), '375 px: formulário de vínculo sem rolagem lateral');
      await cel.selectOption('#poRespEstruturaSel', idNeg);
      await cel.click('#poRespSalvar');
      await cel.waitForSelector('#poRespFlash', { timeout: 15000 });
      afirma((await situacao(cel)) === 'Válido' && await semRolagemLateral(cel), '375 px: vincular funciona e a ficha continua sem rolagem lateral');
      await cel.context().close();
    }

    /* ===== 8c. M4 + M5: vínculos no Catálogo, no Mapa e na ficha da estrutura; sinais de revisão ===== */
    console.log('\n8c. Vínculos no Catálogo, no Mapa e na ficha da estrutura; sinais de revisão (M4 + M5)');
    {
      /* a Avaliação de Produto/Serviço do item, reprocessada DEPOIS da conclusão do Posicionamento, com a classificação
         mudando de Produto/Serviço principal para Componente (dados de TESTE no emulador desta jornada) */
      const MOTOR_P = (fs.readFileSync(path.join(RAIZ, 'forca-agil', 'avaliacao-produto.js'), 'utf8').match(/\n  var MOTOR_VERSION = '([^']+)';/) || [])[1];
      await S.banco('PATCH', '', { 'avaliacoes-produto/item-m3': { itemId: 'item-m3', nome: 'Produto Delta', status: 'concluido', versao: 1, excluido: false, motorVersion: MOTOR_P, motorVersionArquitetura: 2,
        resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', camadaSugerida: { id: 'componente', label: 'Componente' }, respostas: {}, criadoEm: '2026-09-30T09:00:00.000Z', atualizadoEm: '2026-10-02T09:00:00.000Z',
        reprocessedAt: '2026-10-02T09:00:00.000Z', historicoMotor: [{ resultadoAutomatico: 'produto', camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' }, processadoEm: '2026-09-30T09:00:00.000Z' }] } });
      await ir(p, '#avaliacoes?po=pos-m3');
      await esperarCondicaoAte(p, () => !!document.getElementById('poBaseRevisao') && !!document.getElementById('poRespSituacao'), undefined, { limite: 15000 });
      afirma(/foi reprocessada depois da conclusão e a classificação mudou/.test(await texto(p, '#poBaseRevisao')) && /nada foi alterado automaticamente/.test(await texto(p, '#poBaseRevisao')),
        'ficha do Posicionamento: "Precisa de revisão" quando a base foi reprocessada e a classificação mudou; nada alterado', await texto(p, '#poBaseRevisao'));
      afirma((await texto(p, '#poRespSituacao')) === 'Válido' && /não muda a situação do vínculo/.test(await texto(p, '#poRespBase')),
        'bloco da estrutura responsável: o vínculo continua "Válido" e mostra só o aviso da base (decisão D)');
      /* Catálogo */
      await ir(p, '#avaliacoes?mf=catalogo');
      const itemCat = '#mfCatalogo .mf-item[data-item="item-m3"]';
      await esperarCondicaoAte(p, (sel) => { const el = document.querySelector(sel); return !!el && !!el.querySelector('.mf-vinculo [data-situacao]'); }, itemCat, { limite: 15000 });
      const tCat = await texto(p, itemCat);
      afirma(/Precisa de revisão/.test(tCat) && /classificação mudou/.test(tCat), 'Catálogo: o item mostra o sinal da base reprocessada', tCat.slice(0, 400));
      afirma(/Estrutura responsável/.test(tCat) && /Linha de Investimentos/.test(tCat) && /Válido/.test(tCat) && /Aviso: a base do Posicionamento precisa de revisão/.test(tCat), 'Catálogo: a estrutura responsável do item, a situação do vínculo e o aviso', tCat.slice(0, 400));
      afirma(/Ambiente de testes/.test(await texto(p, '#mfAvisoEstruturas')), 'Catálogo: no ambiente de testes, o aviso diz de onde vêm estruturas e vínculos');
      /* Mapa: os produtos e serviços sob a estrutura */
      await ir(p, '#avaliacoes?mf=mapa&e=' + idNeg);
      await esperarCondicaoAte(p, () => !!document.querySelector('#mfmObjetos .mfm-objeto[data-objeto="item-m3"]'), undefined, { limite: 15000 });
      const tObj = await texto(p, '#mfmObjetos .mfm-objeto[data-objeto="item-m3"]');
      afirma(/Produto Delta/.test(tObj) && /Válido/.test(tObj) && /Aviso: a base do Posicionamento precisa de revisão/.test(tObj) &&
        (await p.getAttribute('#mfmObjetos .mfm-objeto[data-objeto="item-m3"] .mfm-abrir-po', 'href')) === '#avaliacoes?po=pos-m3', 'Mapa: o produto aparece na estrutura responsável, com a situação, o aviso e o atalho para o Posicionamento', tObj);
      afirma(await p.locator('#mfmMapa .mfm-caixa[data-objeto]').count() === 0, 'Mapa: o produto não vira caixa do Mapa');
      /* ficha da estrutura */
      await ir(p, '#admin?arq=estruturas&e=' + idNeg);
      await esperarCondicaoAte(p, () => !!document.querySelector('#estProdutos .est-produto[data-objeto="item-m3"] [data-situacao]'), undefined, { limite: 15000 });
      const tFicha = await texto(p, '#estProdutos .est-produto[data-objeto="item-m3"]');
      afirma(/Produto Delta/.test(tFicha) && /Válido/.test(tFicha) && (await p.getAttribute('#estProdutos .est-produto[data-objeto="item-m3"] .est-abrir-po', 'href')) === '#avaliacoes?po=pos-m3',
        'ficha da estrutura: os produtos e serviços sob ela, com a situação e o atalho para o Posicionamento (só consulta)', tFicha);
      afirma(await p.locator('#estProdutos button').count() === 0, 'ficha da estrutura: nenhuma ação de vínculo (administrado só no Posicionamento)');
      /* D: mudar só o nome da estrutura não invalida o vínculo */
      await S.banco('PATCH', 'estruturas-concretas/registros/' + idNeg, { nome: 'Linha de Investimentos (novo nome)' });
      await esperarCondicaoAte(p, () => /novo nome/.test((document.getElementById('estFicha') || {}).innerText || ''), undefined, { limite: 15000 });
      afirma(/Válido/.test(await texto(p, '#estProdutos .est-produto[data-objeto="item-m3"]')), 'só o nome da estrutura mudou: o vínculo continua "Válido" (decisão D)');
      afirma(await semRolagemLateral(p), 'computador: ficha da estrutura com os produtos, sem rolagem lateral');
      /* perfil só de consulta: não lê as ligações oficiais — a situação continua "Válido", sem "tipo não corresponde" */
      const cq2 = await sessao('consulta');
      await ir(cq2, '#avaliacoes?po=pos-m3');
      await esperarCondicaoAte(cq2, () => !!document.getElementById('poRespSituacao'), undefined, { limite: 15000 });
      afirma((await texto(cq2, '#poRespSituacao')) === 'Válido', 'perfil avaliacao (consulta): o vínculo aparece "Válido" (sem as ligações, a situação não confere o tipo — nunca um falso "Precisa de revisão")', await texto(cq2, '#poResponsavel'));
      await ir(cq2, '#avaliacoes?mf=catalogo');
      await esperarCondicaoAte(cq2, (sel) => { const el = document.querySelector(sel); return !!el && !!el.querySelector('.mf-vinculo [data-situacao]'); }, itemCat, { limite: 15000 });
      afirma(/Válido/.test(await texto(cq2, itemCat)), 'perfil avaliacao (consulta): o Catálogo mostra a mesma situação "Válido"');
      await cq2.context().close();
      /* celular */
      const cel2 = await sessao('configuracao', 375);
      for (const [rot, hash, sel] of [['Catálogo com vínculos', '#avaliacoes?mf=catalogo', itemCat + ' .mf-vinculo [data-situacao]'], ['Mapa com os produtos da estrutura', '#avaliacoes?mf=mapa&e=' + idNeg, '#mfmObjetos .mfm-objeto[data-objeto="item-m3"]'],
        ['ficha da estrutura com os produtos', '#admin?arq=estruturas&e=' + idNeg, '#estProdutos .est-produto[data-objeto="item-m3"] [data-situacao]'], ['ficha do Posicionamento com o sinal', '#avaliacoes?po=pos-m3', '#poBaseRevisao']]) {
        await ir(cel2, hash); await cel2.waitForSelector(sel, { timeout: 15000 });
        afirma(await semRolagemLateral(cel2), '375 px: ' + rot + ' sem rolagem lateral');
      }
      await cel2.context().close();
    }

    /* ===== 8d. M6/M7: Squad e relações entre estruturas ===== */
    console.log('\n8d. Squad e relações entre estruturas (M6/M7)');
    {
      /* Taxonomia de TESTE: Squad (camada de trabalho) compõe Negócios; CoE atende Negócios; e uma segunda Linha ativa */
      const T = 'taxonomia/organizacional/', Q = '2026-10-01T12:00:00.000Z', ADMIN_T = S.CONTAS.admin.email;
      await S.banco('PATCH', '', {
        [T + 'conceitos/SQUAD']: { nome: 'Squad', ordem: 20, ativo: true, situacaoDefinicao: 'ainda não registrada', camada: 'trabalho' },
        [T + 'relacoes/SQUAD__compoe__NEGOCIOS']: { de: 'SQUAD', tipo: 'compoe', para: 'NEGOCIOS', criadaEm: Q, criadaPor: ADMIN_T, auditoriaId: 't1' },
        [T + 'relacoes/COE__atende__NEGOCIOS']: { de: 'COE', tipo: 'atende', para: 'NEGOCIOS', criadaEm: Q, criadaPor: ADMIN_T, auditoriaId: 't2' },
        'estruturas-concretas/registros/neg-3': { id: 'neg-3', tipo: 'NEGOCIOS', nome: 'Linha de Previdência', situacao: 'ativa', revisao: 1, criadaEm: 1791713600000, criadaPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'semente-m7' }
      });
      const relacoesGravadas = async () => Object.values(((await S.banco('GET', 'estruturas-relacoes/registros')).corpo) || {});
      /* C1: Squad cadastrável */
      await ir(p, '#admin?arq=estruturas'); await p.waitForSelector('#estNova', { timeout: 15000 }); await p.click('#estNova');
      await p.waitForSelector('#estTipos input[name="estTipo"]');
      await esperarCondicaoAte(p, () => !!document.querySelector('#estTipos input[value="SQUAD"]'), undefined, { limite: 15000 });
      afirma(/Organização do trabalho/.test(await texto(p, '#estTipos')) && /Squad/.test(await texto(p, '#estTipos')), 'cadastro: o Squad aparece como tipo, no grupo "Organização do trabalho", com o nome da Taxonomia (C1)');
      await p.check('#estTipos input[value="SQUAD"]'); await p.fill('#estNome', 'Squad Alfa'); await p.click('#estSalvar');
      await p.waitForSelector('#estFlash', { timeout: 15000 });
      const idSq = await p.evaluate(() => (/[?&]e=([^&]+)/.exec(location.hash) || [])[1]);
      afirma(!!idSq && /Organização do trabalho/.test(await texto(p, '#estFicha')), 'Squad cadastrado, com natureza "Organização do trabalho" e sem exigir vínculo (C3)');
      await p.waitForSelector('#estRelacoes #estSemRelacoes', { timeout: 15000 });
      /* C2: Squad compõe Linha — só as combinações que a Taxonomia admite */
      await p.click('#estRelNova'); await p.waitForSelector('#estRelEscolha', { timeout: 15000 });
      const opc = await p.$$eval('#estRelEscolha option', (os) => os.map((o) => o.value).filter(Boolean).sort());
      afirma(JSON.stringify(opc) === JSON.stringify(['compoe|' + idNeg, 'compoe|neg-3'].sort()), 'nova relação: só "compõe" as Linhas ativas que a Taxonomia admite (nenhum CoE, Área ou Plataforma)', JSON.stringify(opc));
      await p.selectOption('#estRelEscolha', 'compoe|' + idNeg); await p.click('#estRelSalvar');
      await p.waitForSelector('#estFlash', { timeout: 15000 });
      await esperarCondicaoAte(p, () => !!document.querySelector('#estRelacoesLista .est-relacao[data-tipo="compoe"]'), undefined, { limite: 15000 });
      afirma(/compõe/.test(await texto(p, '#estRelacoesLista')) && /Válida/.test(await texto(p, '#estRelacoesLista')), 'Squad compõe Linha: gravada e "Válida"');
      /* C3: sem segunda Linha */
      await p.click('#estRelNova'); await p.waitForSelector('#estRelForm', { timeout: 15000 });
      const opc2 = await p.$$eval('#estRelEscolha option', (os) => os.map((o) => o.value).filter(Boolean)).catch(() => []);
      afirma(!opc2.some((v) => /^compoe\|/.test(v)), 'C3: com uma Linha ativa, a ficha não oferece compor uma segunda Linha', JSON.stringify(opc2));
      await p.click('#estRelCancelar');
      /* C3: trocar de Linha = substituir com motivo */
      await p.waitForSelector('.est-rel-trocar'); await p.click('.est-rel-trocar'); await p.waitForSelector('#estRelEscolha', { timeout: 15000 });
      await p.selectOption('#estRelEscolha', 'neg-3'); await p.click('#estRelSalvar');
      await p.waitForSelector('#estErros');
      afirma(/Informe o motivo/.test(await texto(p, '#estErros')), 'trocar de Linha sem motivo é recusado');
      await p.fill('#estRelMotivo', 'Squad passou para a Previdência'); await p.click('#estRelSalvar');
      await p.waitForSelector('#estFlash', { timeout: 15000 });
      let rels = await relacoesGravadas();
      const ativa = rels.find((r) => r.situacao === 'ativa' && r.tipo === 'compoe'), antiga = rels.find((r) => r.situacao === 'encerrada' && r.tipo === 'compoe');
      afirma(ativa && ativa.destino === 'neg-3' && antiga && antiga.encerramento.motivo === 'Squad passou para a Previdência' && antiga.encerramento.substituidaPor === ativa.id, 'trocar de Linha: encerra a composição anterior (com o motivo) e cria a nova na mesma operação; nada apagado', JSON.stringify(rels));
      afirma(/Relações encerradas — 1/.test(await texto(p, '#estRelacoesEncerradas')), 'a composição anterior continua consultável em "Relações encerradas"');
      /* Mapa: o Squad dentro do detalhe da Linha, nunca como caixa */
      await ir(p, '#avaliacoes?mf=mapa&e=neg-3');
      await esperarCondicaoAte(p, () => /Squad Alfa/.test((document.getElementById('mfmSquads') || {}).innerText || ''), undefined, { limite: 15000 });
      afirma(/Squad Alfa/.test(await texto(p, '#mfmSquads')) && await p.locator('#mfmMapa .mfm-caixa[data-estrutura="' + idSq + '"]').count() === 0, 'Mapa: o Squad aparece dentro do detalhe da Linha ("Squads vinculados") e não vira caixa (C1)');
      await ir(p, '#avaliacoes?mf=mapa&e=' + idNeg);
      await esperarCondicaoAte(p, () => !!document.getElementById('mfmSquads') && !/Carregando/.test(document.getElementById('mfmSquads').innerText), undefined, { limite: 15000 });
      afirma(/Nenhum Squad vinculado/.test(await texto(p, '#mfmSquads')), 'Mapa: a Linha anterior fica sem o Squad depois da troca');
      /* relação não hierárquica admitida: CoE atende Linha; depois, encerrar com motivo */
      await ir(p, '#admin?arq=estruturas&e=' + idCoe);
      await p.waitForSelector('#estRelNova', { timeout: 15000 }); await p.click('#estRelNova'); await p.waitForSelector('#estRelEscolha', { timeout: 15000 });
      const opcCoe = await p.$$eval('#estRelEscolha option', (os) => os.map((o) => o.value).filter(Boolean));
      afirma(opcCoe.indexOf('atende|neg-3') !== -1 && !opcCoe.some((v) => /^compoe\|/.test(v)), 'CoE: oferece "atende" (admitido pela Taxonomia) e nenhum "compõe" (C2)', JSON.stringify(opcCoe));
      await p.selectOption('#estRelEscolha', 'atende|neg-3'); await p.fill('#estRelJustificativa', 'Atende a Previdência'); await p.click('#estRelSalvar');
      await p.waitForSelector('#estFlash', { timeout: 15000 });
      await ir(p, '#avaliacoes?mf=mapa&e=neg-3');
      await esperarCondicaoAte(p, () => /CoE de Dados atende esta estrutura/.test((document.getElementById('mfmRelacoes') || {}).innerText || ''), undefined, { limite: 15000 });
      afirma(/CoE de Dados atende esta estrutura/.test(await texto(p, '#mfmRelacoes')), 'Mapa: as demais relações aparecem no detalhe, só para consulta');
      await ir(p, '#admin?arq=estruturas&e=' + idCoe);
      await p.waitForSelector('.est-rel-encerrar', { timeout: 15000 }); await p.click('.est-rel-encerrar'); await p.waitForSelector('#estRelMotivo');
      await p.click('#estRelSalvar'); await p.waitForSelector('#estErros');
      afirma(/Informe o motivo/.test(await texto(p, '#estErros')), 'encerrar relação sem motivo é recusado');
      await p.fill('#estRelMotivo', 'Deixou de atender'); await p.click('#estRelSalvar'); await p.waitForSelector('#estFlash', { timeout: 15000 });
      rels = await relacoesGravadas();
      afirma(rels.some((r) => r.tipo === 'atende' && r.situacao === 'encerrada' && r.encerramento.motivo === 'Deixou de atender'), 'encerrar: a relação fica registrada, encerrada, com o motivo');
      afirma(await semRolagemLateral(p), 'computador: ficha com relações sem rolagem lateral');
      /* perfil só de consulta (C4): não entra no cadastro (ADMIN); vê Squads e relações no Mapa, e o banco recusa gravar */
      const cq3 = await sessao('consulta');
      await ir(cq3, '#avaliacoes?mf=mapa&e=neg-3');
      await esperarCondicaoAte(cq3, () => /Squad Alfa/.test((document.getElementById('mfmSquads') || {}).innerText || ''), undefined, { limite: 15000 });
      afirma(/Squad Alfa/.test(await texto(cq3, '#mfmSquads')) && await cq3.locator('#mfmDetalhe button:not(#mfmFechar), #mfmAbrirCadastro').count() === 0, 'perfil avaliacao (consulta): vê os Squads da Linha no Mapa, sem nenhuma ação (C4)');
      const rq = await cq3.evaluate(async (ids) => {
        const M = faMotorPosicionamentoNucleo, linha = M.CODIGOS_FIRMES.filter((c) => M.liberaSquadParaCodigoFirme(c) === true), u = firebase.auth().currentUser;
        const casos = faEstruturasCasosDeUso.criar({ nucleo: faEstruturasNucleo, codigosFirmes: M.CODIGOS_FIRMES, codigosLinha: linha });
        return casos.executar('encerrarRelacao', { relacaoId: ids.rel, motivo: 'Indevido' }, { operacaoId: firebase.database().ref().push().key, usuario: { id: u.uid, email: u.email }, agora: Date.now() },
          faEstruturasFirebase.criarPortas({ db: firebase.database(), codigosFirmes: M.CODIGOS_FIRMES, codigosLinha: linha }));
      }, { rel: ativa.id });
      afirma(!rq.ok, 'perfil avaliacao: mesmo pelo código, o banco recusa mexer numa relação', JSON.stringify(rq.erros || rq.situacao));
      await cq3.context().close();
      /* celular */
      const cel3 = await sessao('configuracao', 375);
      for (const [rot, hash, sel] of [['ficha do Squad com relações', '#admin?arq=estruturas&e=' + idSq, '#estRelacoesLista .est-relacao'], ['Mapa com os Squads da Linha', '#avaliacoes?mf=mapa&e=neg-3', '#mfmSquads .mfm-squad']]) {
        await ir(cel3, hash); await cel3.waitForSelector(sel, { timeout: 15000 });
        afirma(await semRolagemLateral(cel3), '375 px: ' + rot + ' sem rolagem lateral');
      }
      await ir(cel3, '#admin?arq=estruturas&e=' + idSq); await cel3.waitForSelector('.est-rel-trocar', { timeout: 15000 });
      const bt = await cel3.locator('.est-rel-trocar').boundingBox();
      afirma(bt && bt.height >= 40, '375 px: botões das relações com área de toque adequada', bt && bt.height);
      await cel3.context().close();
    }

    /* ===== 8e. M8: validação integrada (decisão final × vínculo × Catálogo/Mapa/ficha; separação; trava pela tela) =====
       capturas opcionais: FA_M8_FOTOS=<pasta> */
    console.log('\nM8. Validação integrada: decisão final × vínculo × Catálogo/Mapa/ficha; separação dos dados; trava pela tela');
    {
      const SPM8 = process.env.FA_M8_FOTOS;
      const foto = async (pg, sel, nome) => { if (!SPM8) return; await pg.waitForTimeout(600); try { await pg.locator(sel).first().screenshot({ path: SPM8 + '/' + nome }); } catch (e) { /* captura é só evidência */ } };
      const ler = async (c) => ((await S.banco('GET', c)).corpo) || null;
      const NOS_AVALIACAO = ['avaliacoes-produto', 'avaliacoes-posicionamento', 'avaliacoes-squad', 'posicionamento-vigente-por-item'];
      const antes = {}; for (const n of NOS_AVALIACAO) antes[n] = JSON.stringify(await ler(n));
      const decisoesAntes = (await ler('posicionamento-decisoes')) || {};
      const vincAtivo = async () => Object.values((await ler('estruturas-vinculos/registros')) || {}).find((v) => v.objetoId === 'item-m3' && v.situacao === 'ativa');
      const v0 = await vincAtivo();
      afirma(v0 && v0.estruturaId === idNeg && v0.base.codigo === 'NEGOCIOS' && v0.base.origem === 'recomendacao', 'estado de partida: Produto Delta com estrutura responsável Linha (Negócios, pela recomendação)', JSON.stringify(v0));
      /* 1. decisão final pela tela, divergindo da recomendação (CoE) — G/D: o vínculo vira "Precisa de revisão", nada muda sozinho */
      await ir(p, '#avaliacoes?po=pos-m3');
      await p.waitForSelector('#poCodigoFinal', { timeout: 15000 });
      await p.selectOption('#poCodigoFinal', 'COE');
      await p.fill('#poJustificativaInput', 'Responsabilidade é de um CoE (validação M8)');
      await p.click('#poDecidirBtn'); await p.waitForSelector('.po-modal-sim', { timeout: 10000 }); await p.click('.po-modal-sim');
      await esperarCondicaoAte(p, () => !!document.getElementById('poDecisaoFinal') && !document.getElementById('poDecisaoForm'), undefined, { limite: 15000 });
      const dec = Object.values((await ler('posicionamento-decisoes')) || {}).find((d) => d.itemId === 'item-m3');
      afirma(dec && dec.codigoFinal === 'COE' && dec.tipoDecisao === 'DIVERGENCIA' && dec.liberaSquad === false, 'decisão final gravada pela tela (DIVERGENCIA → CoE; não libera Squad pela tabela fixa)', JSON.stringify(dec));
      await esperarCondicaoAte(p, () => (document.getElementById('poRespSituacao') || {}).textContent === 'Precisa de revisão', undefined, { limite: 15000 });
      const motivosBloco = await texto(p, '#poRespRevisao');
      afirma(/posicionamento efetivo do item mudou/.test(motivosBloco) && /tipo da estrutura não corresponde/.test(motivosBloco), 'bloco: "Precisa de revisão" com os motivos do núcleo (código efetivo mudou; tipo não corresponde)', motivosBloco);
      const v1 = await vincAtivo();
      afirma(JSON.stringify(v1) === JSON.stringify(v0), 'nada muda sozinho: o vínculo continua ativo, igual, até alguém substituí-lo ou encerrá-lo (D)');
      await foto(p, '#poResultado', 'm8-posicionamento-revisao-desktop.png');
      /* Catálogo, Mapa e ficha mostram a mesma situação */
      await ir(p, '#avaliacoes?mf=catalogo');
      const itemCat = '#mfCatalogo .mf-item[data-item="item-m3"]';
      await esperarCondicaoAte(p, (sel) => { const el = document.querySelector(sel); return !!el && !!el.querySelector('.mf-vinculo [data-situacao]'); }, itemCat, { limite: 15000 });
      const tCat = await texto(p, itemCat);
      afirma(/Precisa de revisão/.test(tCat) && /decisão final/.test(tCat), 'Catálogo: posicionamento efetivo pela decisão final e o vínculo "Precisa de revisão"', tCat.slice(0, 500));
      await foto(p, itemCat, 'm8-catalogo-revisao-desktop.png');
      await ir(p, '#avaliacoes?mf=mapa&e=' + idNeg);
      await esperarCondicaoAte(p, () => !!document.querySelector('#mfmObjetos .mfm-objeto[data-objeto="item-m3"] [data-situacao]'), undefined, { limite: 15000 });
      afirma(/Precisa de revisão/.test(await texto(p, '#mfmObjetos .mfm-objeto[data-objeto="item-m3"]')), 'Mapa: o produto continua sob a Linha, com "Precisa de revisão" (nada é movido sozinho)');
      await ir(p, '#admin?arq=estruturas&e=' + idNeg);
      await esperarCondicaoAte(p, () => !!document.querySelector('#estProdutos .est-produto[data-objeto="item-m3"] [data-situacao]'), undefined, { limite: 15000 });
      afirma(/Precisa de revisão/.test(await texto(p, '#estProdutos .est-produto[data-objeto="item-m3"]')), 'ficha da Linha: a mesma situação');
      /* 2. substituir pela estrutura do tipo novo (CoE), com motivo — volta a "Válido", base = decisão final */
      await ir(p, '#avaliacoes?po=pos-m3');
      await p.waitForSelector('#poRespSubstituir', { timeout: 15000 }); await p.click('#poRespSubstituir'); await p.waitForSelector('#poRespEstruturaSel');
      const opcCoe = await p.$$eval('#poRespEstruturaSel option', (os) => os.map((o) => o.value).filter(Boolean));
      afirma(JSON.stringify(opcCoe) === JSON.stringify([idCoe]), 'substituir: só estruturas ativas do tipo do posicionamento efetivo (o CoE)', JSON.stringify(opcCoe));
      await p.selectOption('#poRespEstruturaSel', idCoe); await p.fill('#poRespMotivo', 'Decisão final passou a CoE'); await p.click('#poRespSalvar');
      await p.waitForSelector('#poRespFlash', { timeout: 15000 });
      const v2 = await vincAtivo();
      afirma(v2 && v2.estruturaId === idCoe && v2.base.codigo === 'COE' && v2.base.origem === 'decisao' && v2.substitui === v0.id && (await texto(p, '#poRespSituacao')) === 'Válido', 'substituído com motivo: CoE, base pela decisão final, "Válido"; o anterior fica encerrado', JSON.stringify(v2));
      await ir(p, '#avaliacoes?mf=mapa&e=' + idCoe);
      await esperarCondicaoAte(p, () => !!document.querySelector('#mfmObjetos .mfm-objeto[data-objeto="item-m3"] [data-situacao]'), undefined, { limite: 15000 });
      const tCoe = await texto(p, '#mfmDetalhe');
      afirma(/Produto Delta/.test(tCoe) && /Válido/.test(tCoe) && /Não se aplica: Áreas Especializadas e Centros de Excelência não formam Squads/.test(tCoe), 'Mapa: o produto agora sob o CoE ("Válido"); o CoE não forma Squads (regra fixa Linha × Squad)');
      await foto(p, '#mfmDetalhe', 'm8-mapa-coe-desktop.png');
      /* 3. separação: nenhuma avaliação (P1–P16, O1–O9, S1–S8) foi tocada pelas operações de estruturas, vínculos e relações */
      let iguais = true, mudou = '';
      for (const n of NOS_AVALIACAO) { if (JSON.stringify(await ler(n)) !== antes[n]) { iguais = false; mudou += n + ' '; } }
      const decisoesDepois = (await ler('posicionamento-decisoes')) || {};
      const novas = Object.keys(decisoesDepois).filter((k) => !(k in decisoesAntes));
      afirma(iguais && novas.length === 1 && Object.keys(decisoesAntes).every((k) => JSON.stringify(decisoesAntes[k]) === JSON.stringify(decisoesDepois[k])), 'separação: avaliações P1–P16, O1–O9 e S1–S8 intactas; só a decisão final feita pela pessoa foi gravada', mudou);
      /* 4. habilitação operacional (D2), pela tela e só no emulador: o marcador em três estados */
      const TRAVA = 'estruturas-concretas-config/gravacaoHabilitada';
      const fotosDb = async () => JSON.stringify([await ler('estruturas-relacoes/registros'), await ler('estruturas-concretas/registros'), await ler('estruturas-vinculos/registros'), await ler('mapa-subagrupadores/registros')]);
      const dbAntes = await fotosDb();
      /* false: só consulta — os dados aparecem, nenhum controle de edição, aviso de gravação suspensa */
      await S.banco('PUT', TRAVA, false);
      await ir(p, '#avaliacoes?po=pos-m3');
      await esperarCondicaoAte(p, () => !!document.getElementById('poRespSituacao') && /Gravação suspensa/.test((document.getElementById('poResponsavel') || {}).innerText || ''), undefined, { limite: 15000 });
      afirma((await texto(p, '#poRespSituacao')) === 'Válido' && await p.locator('#poRespVincular, #poRespSubstituir, #poRespEncerrar, #poRespForm').count() === 0,
        'marcador false: a ficha do Posicionamento mostra a estrutura responsável, sem nenhuma ação, com "Gravação suspensa"');
      await ir(p, '#admin?arq=estruturas&e=' + idCoe);
      await esperarCondicaoAte(p, () => !!document.getElementById('estFicha') && /Gravação suspensa/.test((document.getElementById('estAmbiente') || {}).innerText || ''), undefined, { limite: 15000 });
      afirma(await p.locator('#estEditar, #estEncerrar, #estRelNova, .est-rel-encerrar, .est-rel-trocar').count() === 0 && /Produto Delta/.test(await texto(p, '#estProdutos')), 'marcador false: a ficha da estrutura mostra os dados (produtos, relações) e nenhum botão de edição');
      await ir(p, '#admin?arq=estruturas');
      await esperarCondicaoAte(p, () => !!document.getElementById('estLista'), undefined, { limite: 15000 });
      afirma(await p.locator('#estNova').count() === 0, 'marcador false: a lista não oferece "Cadastrar estrutura"');
      await ir(p, '#avaliacoes?mf=mapa');
      await esperarCondicaoAte(p, () => /Gravação suspensa/.test((document.getElementById('mfmFaixa') || {}).innerText || ''), undefined, { limite: 15000 });
      afirma(await p.locator('#mfmMapa .mfm-caixa[data-estrutura="' + idCoe + '"]').count() === 1 && /só consulta/.test(await texto(p, '#mfmIrCadastro')), 'marcador false: o Mapa mostra as estruturas reais, com "Gravação suspensa" e o cadastro só para consulta');
      const cq4 = await sessao('consulta');
      await ir(cq4, '#avaliacoes?mf=mapa&e=neg-3');
      await esperarCondicaoAte(cq4, () => /Squad Alfa/.test((document.getElementById('mfmSquads') || {}).innerText || ''), undefined, { limite: 15000 });
      afirma(/Squad Alfa/.test(await texto(cq4, '#mfmSquads')), 'marcador false: o perfil de consulta continua vendo o Mapa real');
      await cq4.context().close();
      const cel4 = await sessao('configuracao', 375);
      for (const [rot, hash, sel] of [['Posicionamento só consulta', '#avaliacoes?po=pos-m3', '#poRespSituacao'], ['ficha da estrutura só consulta', '#admin?arq=estruturas&e=' + idCoe, '#estFicha']]) {
        await ir(cel4, hash); await cel4.waitForSelector(sel, { timeout: 15000 });
        afirma(await semRolagemLateral(cel4), '375 px: ' + rot + ' sem rolagem lateral');
      }
      await cel4.context().close();
      /* ausente: volta ao estado de antes da operação — demonstração, cartão e bloco desligados */
      await S.banco('DELETE', TRAVA);
      await esperarCondicaoAte(p, () => /Demonstração/.test((document.getElementById('mfmFaixa') || {}).innerText || ''), undefined, { limite: 15000 });
      afirma(/Demonstração/.test(await texto(p, '#mfmFaixa')), 'marcador ausente: o Mapa volta à demonstração (sem recarregar)');
      await ir(p, '#avaliacoes?po=pos-m3');
      await esperarCondicaoAte(p, () => !!document.getElementById('poResultado'), undefined, { limite: 15000 });
      await espera(800);
      afirma(await p.locator('#poBlocoResponsavel').count() === 0, 'marcador ausente: a ficha do Posicionamento não mostra o bloco de estrutura responsável');
      await ir(p, '#avaliacoes?mf=catalogo');
      await esperarCondicaoAte(p, () => !!document.getElementById('mfAvisoEstruturas'), undefined, { limite: 15000 });
      afirma(/informação indisponível/.test(await texto(p, '#mfAvisoEstruturas')) && await p.locator('.mf-vinculo').count() === 0, 'marcador ausente: o Catálogo volta a dizer que as estruturas estão indisponíveis');
      afirma(await fotosDb() === dbAntes, 'nos estados false e ausente nada foi gravado em estruturas, subagrupadores, vínculos ou relações');
      /* true de novo: a operação volta sem recarregar */
      await S.banco('PUT', TRAVA, true);
      await ir(p, '#avaliacoes?mf=mapa');
      await esperarCondicaoAte(p, (id) => !!document.querySelector('#mfmMapa .mfm-caixa[data-estrutura="' + id + '"]'), idCoe, { limite: 15000 });
      afirma(await p.locator('#mfmMapa .mfm-caixa[data-estrutura="' + idCoe + '"]').count() === 1 && !/Gravação suspensa/.test(await texto(p, '#mfmFaixa')), 'marcador true de novo: o Mapa volta às estruturas, com manutenção');
      /* 5. celular: ficha do Posicionamento com decisão + bloco, e Mapa do CoE */
      const cel8 = await sessao('configuracao', 375);
      for (const [rot, hash, sel] of [['Posicionamento com decisão e estrutura responsável', '#avaliacoes?po=pos-m3', '#poRespSituacao'], ['Mapa do CoE com o produto', '#avaliacoes?mf=mapa&e=' + idCoe, '#mfmObjetos .mfm-objeto[data-objeto="item-m3"] [data-situacao]'], ['Catálogo', '#avaliacoes?mf=catalogo', itemCat + ' .mf-vinculo [data-situacao]']]) {
        await ir(cel8, hash); await cel8.waitForSelector(sel, { timeout: 15000 });
        afirma(await semRolagemLateral(cel8), '375 px: ' + rot + ' sem rolagem lateral');
      }
      await foto(cel8, '#avaliacoesPosicionamento', 'm8-posicionamento-375.png');
      await cel8.context().close();
    }

    console.log('\n10. Celular (375 px) e computador');
    afirma(await semRolagemLateral(p), 'computador: Mapa sem rolagem lateral');
    const m = await sessao('configuracao', 375);
    for (const [rot, hash, sel] of [['lista', '#admin?arq=estruturas', '#estLista'], ['ficha', '#admin?arq=estruturas&e=' + idNeg, '#estFicha'], ['subagrupadores', '#admin?arq=estruturas&sg=lista', '#sgLista'], ['ficha com subagrupador', '#admin?arq=estruturas&e=' + idNeg, '#estSubagrupador'], ['Mapa', '#avaliacoes?mf=mapa', '#mfmMapa'], ['detalhe no Mapa', '#avaliacoes?mf=mapa&e=' + idCoe, '#mfmDetalhe']]) {
      await ir(m, hash); await m.waitForSelector(sel, { timeout: 15000 });
      afirma(await semRolagemLateral(m), '375 px: ' + rot + ' sem rolagem lateral');
    }
    await ir(m, '#admin?arq=estruturas'); await m.waitForSelector('#estNova'); await m.click('#estNova'); await m.waitForSelector('#estForm');
    /* como na seção 2: mede depois que a conferência das referências oficiais terminou (ela redesenha o formulário) */
    await esperarCondicaoAte(m, () => !!document.querySelector('#estTipos input') && !document.querySelector('#estTipos .loading-msg'), undefined, { limite: 15000 });
    afirma(await semRolagemLateral(m), '375 px: formulário de cadastro sem rolagem lateral');
    const alvo = await m.locator('#estSalvar').boundingBox();
    afirma(alvo && alvo.height >= 40, '375 px: botão salvar com área de toque adequada', alvo && alvo.height);
    await m.context().close();

    /* ===== 9. Produção ===== */
    console.log('\n9. Banco oficial');
    afirma(externos.length === 0, 'nenhuma requisição ao Firebase oficial durante toda a jornada', externos.slice(0, 3).join(' '));
    afirma(erros.length === 0, 'nenhum erro de página', erros.slice(0, 3).join(' | '));
  } catch (e) {
    falhas++; console.error('ERRO', e && e.stack || e);
  } finally {
    if (navegador) await navegador.close();
    if (servidor) servidor.kill();
    derrubarEmulador();
  }
  console.log('\n============================\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
