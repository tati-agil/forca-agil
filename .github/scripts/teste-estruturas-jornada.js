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
    afirma(/Informação ainda indisponível/.test(await texto(p, '#mfmSemObjetos')), 'produtos e serviços: informação indisponível (nenhuma associação inventada)');
    afirma(/Definição oficial\s*Definição vigente indisponível/.test(await texto(p, '#mfmDetalhe')), 'detalhe no Mapa: tipo sem definição vigente na Taxonomia → "indisponível", sem texto substituto (M2)');
    await p.click('[data-estrutura="' + idNeg + '"]');
    await p.waitForFunction((id) => location.hash.indexOf('e=' + id) !== -1, idNeg);
    const det = await texto(p, '#mfmDetalhe');
    afirma(/Linha de Investimentos/.test(det) && /Sem subagrupador/.test(det) && /LINV/.test(det) && /Organização por Squads\s*Admitida para este tipo de estrutura/.test(det) && /Squads vinculados\s*Informação ainda indisponível/.test(det), 'clicar na estrutura mostra natureza, caminho, sigla e Squads (possível × vinculados, sem inventar)', det.slice(0, 200));
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

    console.log('\n10. Celular (375 px) e computador');
    afirma(await semRolagemLateral(p), 'computador: Mapa sem rolagem lateral');
    const m = await sessao('configuracao', 375);
    for (const [rot, hash, sel] of [['lista', '#admin?arq=estruturas', '#estLista'], ['ficha', '#admin?arq=estruturas&e=' + idNeg, '#estFicha'], ['subagrupadores', '#admin?arq=estruturas&sg=lista', '#sgLista'], ['ficha com subagrupador', '#admin?arq=estruturas&e=' + idNeg, '#estSubagrupador'], ['Mapa', '#avaliacoes?mf=mapa', '#mfmMapa'], ['detalhe no Mapa', '#avaliacoes?mf=mapa&e=' + idCoe, '#mfmDetalhe']]) {
      await ir(m, hash); await m.waitForSelector(sel, { timeout: 15000 });
      afirma(await semRolagemLateral(m), '375 px: ' + rot + ' sem rolagem lateral');
    }
    await ir(m, '#admin?arq=estruturas'); await m.waitForSelector('#estNova'); await m.click('#estNova'); await m.waitForSelector('#estForm');
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
