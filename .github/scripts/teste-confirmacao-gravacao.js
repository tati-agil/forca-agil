/* Defeito da homologação (2026-10-13): com a conexão parada, a ficha do Posicionamento mostrava conclusão e decisão
 * que o servidor nunca recebeu (o SDK aplica a gravação pendente no cache local e os ouvintes a entregam na hora) e o
 * vínculo da estrutura responsável ficava para sempre em "Salvando…" (leitura once() sem prazo).
 *
 * Prova contra um Firebase Emulator DE VERDADE (banco + login, regras reais) e o SDK REAL do site — a conexão é
 * derrubada e devolvida com goOffline()/goOnline(), que é exatamente o "o servidor não responde" do SDK. Nunca toca o
 * banco oficial. Cenários:
 *   1. Conexão normal: iniciar, responder e salvar o rascunho.
 *   2. Rede lenta: a confirmação chega depois de alguns segundos (dentro do prazo) → "Rascunho salvo".
 *   3. Gravação não confirmada e RECARREGAR a página: aviso claro, o texto digitado continua na tela, o navegador pede
 *      confirmação antes de sair; depois de recarregar, a tela mostra só o que o servidor tem.
 *   4. Desconexão durante a CONCLUSÃO: aviso "não confirmada", a ficha NÃO aparece como concluída, o servidor continua
 *      com o rascunho; a conexão volta → a mesma gravação entra uma vez só (um vigente, uma auditoria de conclusão).
 *   5. Desconexão durante a DECISÃO FINAL: aviso, "não conta como registrada", a justificativa digitada continua; a
 *      conexão volta → uma decisão, uma auditoria.
 *   6. Leitura do vínculo sem resposta: o botão sai de "Salvando…" com a mensagem de prazo (20 s), nada gravado; a
 *      conexão volta → salvar de novo grava um vínculo só.
 *   7. Celular (375 px): o aviso cabe sem rolagem lateral.
 *
 * Uso (Docker com a imagem fa-emulador-regras:local; Playwright em NODE_PATH):
 *   node .github/scripts/teste-confirmacao-gravacao.js */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync, spawn } = require('child_process');
const { chromium } = require('playwright');
const { esperarCondicaoAte } = require('./esperas');

const RAIZ = path.resolve(__dirname, '..', '..');
const PORTA_BANCO = 9120, PORTA_LOGIN = 9129, PORTA_SITE = 8819;
process.env.FA_PORTA_BANCO = String(PORTA_BANCO); process.env.FA_PORTA_LOGIN = String(PORTA_LOGIN);
const S = require('./ambiente-local/semente');
const CONTEINER = 'fa-confirmacao-gravacao-' + process.pid;
const IMAGEM = process.env.FA_IMAGEM_EMULADOR || 'fa-emulador-regras:local';
const ENDERECO = 'http://127.0.0.1:' + PORTA_SITE + '/index.html';
const MOTOR_P = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;

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
  throw new Error('o emulador não subiu');
}
function derrubarEmulador() { try { execFileSync('docker', ['rm', '-f', CONTEINER], { stdio: 'ignore' }); } catch (e) { /* já saiu */ } }
process.on('uncaughtException', (e) => { console.error('ERRO', e && e.stack || e); derrubarEmulador(); process.exit(1); });

/* o que o SERVIDOR tem (REST do emulador), nunca o cache da página */
const servidor = async (c) => (await S.banco('GET', c)).corpo;

(async () => {
  let site = null, navegador = null;
  try {
    await subirEmulador();
    await S.semear(() => {});
    const RESP = {}; ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade']
      .forEach((q, i) => { RESP[q] = { valor: 'sim', justificativaAuto: 'interpretação', codigoPergunta: 'P' + (i + 1), textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
    /* dados de TESTE no emulador descartável: um item com Avaliação de Produto/Serviço concluída e Motor atual, e uma
       Área Especializada ativa para o vínculo */
    await S.banco('PATCH', '', {
      'avaliacoes-produto/item-cg': { itemId: 'item-cg', nome: 'Produto Teste', descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', versao: 1, excluido: false,
        motorVersion: MOTOR_P, motorVersionArquitetura: 1, questionnaireContentVersion: 1, resultadoAutomatico: 'produto', decisaoFinal: 'produto', camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' },
        respostas: RESP, justificativaAutomatica: 'j', criteriosAtendidos: 5, criadoEm: '2026-10-01T09:00:00.000Z', atualizadoEm: '2026-10-01T09:00:00.000Z', responsavel: { name: 'Teste', email: 'teste@previ.com.br' } },
      'estruturas-concretas/registros/ae-1': { id: 'ae-1', tipo: 'AREA_ESPECIALIZADA', nome: 'Jurídico de Teste', situacao: 'ativa', revisao: 1, criadaEm: 1791713600000, criadaPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'semente-cg' }
    });
    site = spawn(process.execPath, [path.join(__dirname, 'ambiente-local', 'servidor.js'), RAIZ, String(PORTA_SITE)], { env: Object.assign({}, process.env, { SEM_NAVEGADOR: '1' }), stdio: 'ignore' });
    for (let i = 0; i < 20 && !(await aberto(PORTA_SITE)); i++) await espera(300);
    navegador = await chromium.launch();
    const externos = [], erros = [], dialogos = [];
    async function sessao(largura) {
      const ctx = await navegador.newContext({ viewport: { width: largura || 1280, height: 900 } });
      const p = await ctx.newPage();
      p.on('request', (r) => { let u; try { u = new URL(r.url()); } catch (e) { return; } if (/(^|\.)(firebaseio\.com|firebasedatabase\.app|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|cloudfunctions\.net|firebaseapp\.com)$/.test(u.hostname) || /kyber-agil/.test(u.href)) externos.push(u.href); });
      p.on('pageerror', (e) => erros.push(e.message));
      p.on('dialog', (d) => { dialogos.push(d.type()); d.accept(); });
      await entrar(p, '#home');
      return p;
    }
    async function entrar(p, hash) {
      await p.goto(ENDERECO + hash);
      await p.waitForFunction(() => window.firebase && window.faAuth && window.faAmbiente, null, { timeout: 20000 });
      if (!(await p.evaluate(() => !!(firebase.auth().currentUser)))) await p.evaluate((c) => firebase.auth().signInWithEmailAndPassword(c.email, c.senha), { email: S.CONTAS.configuracao.email, senha: S.SENHA });
      await p.waitForFunction(() => window.faAuth.isAvaliacaoReady && window.faAuth.isAvaliacaoReady() && window.faAuth.getSession && window.faAuth.getSession(), null, { timeout: 20000 });
    }
    const ir = async (p, hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await espera(400); };
    const texto = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
    const valor = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.value : null; }, sel);
    const offline = (p) => p.evaluate(() => firebase.database().goOffline());
    const online = (p) => p.evaluate(() => firebase.database().goOnline());
    const aviso = (p, limite) => esperarCondicaoAte(p, () => !!document.getElementById('poNaoConfirmada'), undefined, { limite: limite || 20000 });
    const semAviso = (p, limite) => esperarCondicaoAte(p, () => !document.getElementById('poNaoConfirmada'), undefined, { limite: limite || 20000 });
    const semRolagemLateral = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    const responder = async (p, q, v) => { await p.click('#avaliacoesPosicionamento .po-resp[data-q="' + q + '"][data-v="' + v + '"]'); await espera(150); };
    const auditorias = async (key, tipo) => Object.values((await servidor('posicionamento-auditoria/' + key)) || {}).filter((a) => a.tipo === tipo || a.acao === tipo || a.evento === tipo).length;

    const p = await sessao();
    let key = null;
    async function cenario(nome, fn) {
      try { await fn(); } catch (e) {
        afirma(false, 'cenário ' + nome + ' interrompido', String(e && e.message || e).split('\n')[0]);
        try { await online(p); } catch (e2) { /* a página pode ter fechado */ }
      }
    }

    /* ===== 1. Conexão normal ===== */
    await cenario('1', async () => {
      console.log('\n1. Conexão normal');
      await ir(p, '#avaliacoes?po=escolher&item=item-cg');
      await p.waitForSelector('#poIniciarBtn', { timeout: 20000 });
      await p.click('#poIniciarBtn');
      await p.waitForSelector('#poSalvarBtn', { timeout: 20000 });
      key = await p.evaluate(() => (/[?&]po=([^&]+)/.exec(location.hash) || [])[1]);
      afirma(!!key && (await servidor('avaliacoes-posicionamento/' + key + '/status')) === 'rascunho', 'iniciar grava o rascunho no servidor', key);
      await responder(p, 'O1', 'NAO'); await responder(p, 'O2', 'SIM'); await responder(p, 'O3', 'NAO');
      await p.click('#poSalvarBtn');
      await p.waitForSelector('#poFlash', { timeout: 15000 });
      afirma(/Rascunho salvo/.test(await texto(p, '#poFlash')) && (await servidor('avaliacoes-posicionamento/' + key + '/revisao')) === 2 && (await servidor('avaliacoes-posicionamento/' + key + '/respostas/O2/resposta')) === 'SIM',
        'salvar: "Rascunho salvo" só depois de o servidor gravar (revisão 2, respostas no servidor)');
    });

    /* ===== 2. Rede lenta (confirma dentro do prazo) ===== */
    await cenario('2', async () => {
      console.log('\n2. Rede lenta');
      await p.fill('#poObsO2', 'observação na rede lenta'); await espera(150);
      await offline(p);
      await p.click('#poSalvarBtn');
      await espera(3000);
      afirma(/SALVANDO/.test(await texto(p, '#poSalvarBtn')) && !(await p.$('#poNaoConfirmada')) && !(await p.$('#poFlash')), 'enquanto a confirmação não chega: "Salvando…", sem sucesso e sem aviso antes do prazo');
      afirma((await servidor('avaliacoes-posicionamento/' + key + '/revisao')) === 2, 'o servidor ainda não tem a gravação');
      await online(p);
      await esperarCondicaoAte(p, () => !/SALVANDO/.test(document.getElementById('poSalvarBtn').textContent), undefined, { limite: 15000 });
      afirma(/Rascunho salvo/.test(await texto(p, '#poFlash')) && (await servidor('avaliacoes-posicionamento/' + key + '/revisao')) === 3 && (await servidor('avaliacoes-posicionamento/' + key + '/respostas/O2/observacao')) === 'observação na rede lenta',
        'a conexão volta dentro do prazo: "Rascunho salvo" com a gravação no servidor (revisão 3)');
    });

    /* ===== 3. Não confirmada + recarregar ===== */
    await cenario('3', async () => {
      console.log('\n3. Gravação não confirmada e recarregar a página');
      await p.fill('#poObsO2', 'texto que o servidor nunca recebeu'); await espera(150);
      await offline(p);
      await p.click('#poSalvarBtn');
      afirma(await aviso(p), 'prazo vencido: aviso "Gravação não confirmada"');
      const tAviso = await texto(p, '#poNaoConfirmada');
      afirma(/Gravação não confirmada/.test(tAviso) && /o rascunho de “Produto Teste”/.test(tAviso) && /nada disso conta como salvo/.test(tAviso) && /Não recarregue/.test(tAviso), 'o aviso diz o que não foi confirmado, que não conta como salvo e que não se deve recarregar', tAviso);
      afirma(!(await p.$('#poFlash')) || !/Rascunho salvo/.test(await texto(p, '#poFlash')), 'nenhum "Rascunho salvo" sem confirmação');
      afirma((await valor(p, '#poObsO2')) === 'texto que o servidor nunca recebeu', 'o texto digitado continua na tela');
      afirma(await p.evaluate(() => document.getElementById('poSalvarBtn').disabled && document.getElementById('poConcluirBtn').disabled && document.getElementById('poObsO2').disabled && !/SALVANDO/.test(document.getElementById('poSalvarBtn').textContent)),
        'enquanto não confirma: nada mais é gravado (botões e campos travados) e o botão não fica em "Salvando…"');
      afirma((await servidor('avaliacoes-posicionamento/' + key + '/revisao')) === 3, 'o servidor continua com a revisão 3');
      dialogos.length = 0;
      await p.reload();
      await entrar(p, '#avaliacoes?po=' + key);
      afirma(dialogos.indexOf('beforeunload') !== -1, 'recarregar com gravação não confirmada: o navegador pede confirmação antes de sair (nada se perde em silêncio)', JSON.stringify(dialogos));
      await ir(p, '#avaliacoes?po=' + key);
      await p.waitForSelector('#poObsO2', { timeout: 20000 });
      afirma((await valor(p, '#poObsO2')) === 'observação na rede lenta' && !(await p.$('#poNaoConfirmada')), 'depois de recarregar: a tela mostra só o que o servidor tem (a observação confirmada), sem aviso');
    });

    /* ===== 4. Desconexão durante a conclusão ===== */
    await cenario('4', async () => {
      console.log('\n4. Desconexão durante a conclusão');
      await offline(p);
      await p.click('#poConcluirBtn');
      afirma(await aviso(p), 'prazo vencido na conclusão: aviso "Gravação não confirmada"');
      afirma(/a conclusão de “Produto Teste”/.test(await texto(p, '#poNaoConfirmada')), 'o aviso diz que a conclusão não foi confirmada');
      afirma(!!(await p.$('#poConcluirBtn')) && !(await p.$('#poDecisaoForm')) && !(await p.$('#poSemDecisao')), 'a ficha NÃO aparece como concluída (continua o formulário, sem bloco de decisão)');
      afirma(await p.evaluate(() => ['O1', 'O2', 'O3'].every((q) => !!document.querySelector('.po-resp.ativa[data-q="' + q + '"]'))), 'as respostas continuam marcadas na tela');
      afirma((await servidor('avaliacoes-posicionamento/' + key + '/status')) === 'rascunho' && (await servidor('posicionamento-vigente-por-item/item-cg')) === null, 'o servidor continua com o rascunho e sem vigente');
      await ir(p, '#avaliacoes?po=lista'); await espera(500);
      afirma(!!(await p.$('#poNaoConfirmada')), 'na lista, o aviso continua (o que a lista mostra desta avaliação ainda não foi confirmado)');
      await ir(p, '#avaliacoes?po=' + key); await espera(500);
      afirma(!(await p.$('#poDecidirBtn')) || await p.evaluate(() => document.getElementById('poDecidirBtn').disabled), 'nenhuma decisão pode ser registrada sobre a conclusão não confirmada');
      await online(p);
      afirma(await semAviso(p), 'a conexão volta: o aviso some quando o servidor confirma');
      await p.waitForSelector('#poDecisaoForm', { timeout: 15000 });
      afirma((await servidor('avaliacoes-posicionamento/' + key + '/status')) === 'concluido' && (await servidor('posicionamento-vigente-por-item/item-cg')) === key, 'a mesma conclusão entrou no servidor (concluída e vigente)');
      afirma((await auditorias(key, 'conclusao')) === 1 && (await auditorias(key, 'criacao')) === 1, 'sem duplicar: uma auditoria de conclusão e uma de criação', JSON.stringify(await servidor('posicionamento-auditoria/' + key)));
    });

    /* ===== 5. Desconexão durante a decisão final ===== */
    await cenario('5', async () => {
      console.log('\n5. Desconexão durante a decisão final');
      await p.selectOption('#poCodigoFinal', 'AREA_ESPECIALIZADA');
      await p.fill('#poJustificativaInput', 'justificativa digitada pela pessoa'); await espera(150);
      await offline(p);
      await p.click('#poDecidirBtn');
      await p.waitForSelector('.po-modal .po-modal-sim'); await p.click('.po-modal .po-modal-sim');
      afirma(await aviso(p), 'prazo vencido na decisão: aviso "Gravação não confirmada"');
      afirma(/a decisão final de “Produto Teste”/.test(await texto(p, '#poNaoConfirmada')) && /não conta como registrada/.test(await texto(p, '#poSemDecisao')) && !(await p.$('#poDecisaoFinal')),
        'a decisão NÃO aparece como registrada ("não conta como registrada")');
      afirma((await valor(p, '#poJustificativaInput')) === 'justificativa digitada pela pessoa' && await p.evaluate(() => document.getElementById('poDecidirBtn').disabled), 'a justificativa digitada continua; o botão fica travado até a resposta');
      afirma((await servidor('posicionamento-decisoes/' + key)) === null, 'o servidor não tem decisão');
      await online(p);
      await p.waitForSelector('#poDecisaoFinal', { timeout: 15000 });
      const dec = await servidor('posicionamento-decisoes/' + key);
      afirma(!(await p.$('#poNaoConfirmada')) && /Decisão registrada/.test(await texto(p, '#poFlash')) && dec && dec.codigoFinal === 'AREA_ESPECIALIZADA' && dec.justificativa === 'justificativa digitada pela pessoa',
        'a conexão volta: "Decisão registrada" só com a decisão no servidor', JSON.stringify(dec));
      afirma((await auditorias(key, 'decisao')) === 1, 'sem duplicar: uma auditoria de decisão');
    });

    /* ===== 6. Vínculo: leitura sem resposta ===== */
    await cenario('6', async () => {
      console.log('\n6. Vínculo da estrutura responsável com a leitura sem resposta');
      await p.waitForSelector('#poRespVincular', { timeout: 20000 });
      await p.click('#poRespVincular');
      await p.waitForSelector('#poRespEstruturaSel');
      await p.selectOption('#poRespEstruturaSel', 'ae-1');
      await offline(p);
      const t0 = Date.now();
      await p.click('#poRespSalvar');
      await espera(1000);
      afirma(/Salvando/i.test(await texto(p, '#poRespSalvar')), 'durante a espera, o botão diz "Salvando…"');
      const saiu = await esperarCondicaoAte(p, () => !!document.getElementById('poRespErros'), undefined, { limite: 30000 });
      const dt = Date.now() - t0;
      afirma(saiu && dt < 28000 && /não respondeu a tempo/.test(await texto(p, '#poRespErros')) && !/Salvando/i.test(await texto(p, '#poRespSalvar')),
        'leitura sem resposta: em ~20 s o botão sai de "Salvando…" com a mensagem de prazo', dt + ' ms · ' + await texto(p, '#poRespErros'));
      afirma((await servidor('estruturas-vinculos/registros')) === null, 'nada gravado no servidor');
      await online(p); await espera(1500);
      await p.click('#poRespSalvar');
      await p.waitForSelector('#poRespFlash', { timeout: 25000 });
      const vs = Object.values((await servidor('estruturas-vinculos/registros')) || {});
      afirma(vs.length === 1 && vs[0].estruturaId === 'ae-1' && vs[0].situacao === 'ativa' && Object.keys((await servidor('estruturas-vinculos/operacoes')) || {}).length === 1,
        'a conexão volta: salvar de novo grava UM vínculo, uma operação', JSON.stringify(vs));
    });

    /* ===== 7. Celular ===== */
    await cenario('7', async () => {
      console.log('\n7. Celular (375 px)');
      const cel = await sessao(375);
      await ir(cel, '#avaliacoes?po=' + key);
      await cel.waitForSelector('#poReavaliarBtn', { timeout: 20000 });
      await offline(cel);
      await cel.click('#poReavaliarBtn');
      await cel.waitForSelector('#poMotivoReavaliacaoInput');
      await cel.fill('#poMotivoReavaliacaoInput', 'motivo da reavaliação');
      await cel.click('.po-modal .po-modal-sim');
      afirma(await aviso(cel), '375 px: aviso de gravação não confirmada');
      afirma(await semRolagemLateral(cel), '375 px: o aviso cabe sem rolagem lateral');
      await online(cel);
      afirma(await semAviso(cel), '375 px: a conexão volta e o aviso some');
      afirma(Object.keys((await servidor('posicionamento-rascunho-por-item')) || {}).length === 1, 'a reavaliação entrou uma vez só');
      await cel.context().close();

    });

    console.log('\n8. Banco oficial e erros');
    afirma(externos.length === 0, 'nenhuma requisição ao Firebase oficial', externos.slice(0, 3).join(' '));
    afirma(erros.length === 0, 'nenhum erro de página', erros.slice(0, 3).join(' | '));
  } catch (e) {
    falhas++; console.error('ERRO', e && e.stack || e);
  } finally {
    if (navegador) await navegador.close();
    if (site) site.kill();
    derrubarEmulador();
  }
  console.log('\n============================\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
