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
    await p.click('[data-estrutura="' + idNeg + '"]');
    await p.waitForFunction((id) => location.hash.indexOf('e=' + id) !== -1, idNeg);
    const det = await texto(p, '#mfmDetalhe');
    afirma(/Linha de Investimentos/.test(det) && /Sem subagrupador/.test(det) && /LINV/.test(det) && /Organização por Squads\s*Admitida para este tipo de estrutura/.test(det) && /Squads vinculados\s*Informação ainda indisponível/.test(det), 'clicar na estrutura mostra natureza, caminho, sigla e Squads (possível × vinculados, sem inventar)', det.slice(0, 200));

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
    console.log('\n10. Celular (375 px) e computador');
    afirma(await semRolagemLateral(p), 'computador: Mapa sem rolagem lateral');
    const m = await sessao('configuracao', 375);
    for (const [rot, hash, sel] of [['lista', '#admin?arq=estruturas', '#estLista'], ['ficha', '#admin?arq=estruturas&e=' + idNeg, '#estFicha'], ['Mapa', '#avaliacoes?mf=mapa', '#mfmMapa'], ['detalhe no Mapa', '#avaliacoes?mf=mapa&e=' + idCoe, '#mfmDetalhe']]) {
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
