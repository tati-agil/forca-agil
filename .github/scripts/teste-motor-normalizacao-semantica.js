/* Normalização semântica de diffRegras — diferença ESTRUTURAL nunca pode
 * virar uma versão nova do motor; só diferença LÓGICA pode.
 *
 * POR QUE ESTE TESTE EXISTE
 * diffRegras (motor-arquitetura.js e motor-squad.js) comparava
 * JSON.stringify(regraAntiga) com JSON.stringify(regraNova) — o que faz
 * duas fontes de diferença puramente estrutural, sem NENHUM significado
 * para o executor (avaliarCondicao/executarRegras), aparecerem como se
 * fossem mudança de regra de negócio:
 *   1. ordem das PROPRIEDADES de um objeto (ex.: {codigo,ordem,resultado}
 *      vs {resultado,codigo,ordem} é a mesma regra);
 *   2. ordem dos ELEMENTOS dentro de all/any (ex.: P1=SIM,P2=SIM é a MESMA
 *      condição que P2=SIM,P1=SIM — E/OU lógico não depende de ordem).
 * Este teste prova as duas coisas (nenhuma das duas versiona) e, ao mesmo
 * tempo, prova que o que DEVE continuar versionando continua: precedência
 * entre regras diferentes, remoção de regra, e mudança de condição — para
 * garantir que normalizarRegraParaComparacao não "esconde" mudança real
 * nenhuma ao ficar tolerante com diferença estrutural.
 *
 * Roda com o Firebase SUBSTITUÍDO pelo falso (firebase-falso.js): hermético,
 * sem segredo, sem rede. Chama window.faMotorArquitetura/window.faMotorSquad
 * diretamente — os mesmos caminhos que os botões da UI chamam.
 */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

async function abrirApp(browser) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': {}, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10 };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida + 800 ms fixos) */
  await page.evaluate(() => { window.faMotorArquitetura.onMudanca(function () {}); window.faMotorSquad.onMudanca(function () {}); });
  await page.waitForTimeout(300);
  return { ctx, page, erros };
}

function publicarArq(page, regras) {
  return page.evaluate((rs) => new Promise((resolve) => {
    var v = window.faMotorArquitetura.versaoAtual();
    window.faMotorArquitetura.publicarRegras(rs, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ v: v, err: err, info: info, versao: window.faMotorArquitetura.versaoAtual() }), 200);
    });
  }), regras);
}
function publicarSquad(page, regras) {
  return page.evaluate((rs) => new Promise((resolve) => {
    var v = window.faMotorSquad.versaoAtual();
    window.faMotorSquad.publicarRegras(rs, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ v: v, err: err, info: info, versao: window.faMotorSquad.versaoAtual() }), 200);
    });
  }), regras);
}

(async () => {
  const browser = await chromium.launch();
  const { ctx, page, erros } = await abrirApp(browser);

  console.log('== MOTOR ARQUITETURAL ==');

  console.log('\n-- 1. Mesmas propriedades, ORDEM diferente no objeto da regra -> nenhuma mudança, nenhuma versão nova --');
  const t1 = await publicarArq(page, await page.evaluate(() => {
    var v = window.faMotorArquitetura.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v).regras));
    var idx = regras.findIndex((r) => r.codigo === 'CANAL');
    var original = regras[idx];
    // Reescreve o MESMO conteúdo com as propriedades em outra ordem —
    // JSON.parse de uma string escrita à mão preserva essa ordem de chaves.
    regras[idx] = JSON.parse('{"conflito":' + JSON.stringify(original.conflito) +
      ',"resultado":"' + original.resultado + '","motivos":' + JSON.stringify(original.motivos) +
      ',"codigo":"' + original.codigo + '","incoerencia":' + original.incoerencia +
      ',"ordem":' + original.ordem + ',"condicoes":' + JSON.stringify(original.condicoes) + '}');
    return regras;
  }));
  afirma(!t1.err, 'publicação com ordem de propriedades trocada não gerou erro');
  afirma(t1.versao === t1.v, 'versão NÃO avançou só por causa da ordem das propriedades: ' + t1.v + ' -> ' + t1.versao);
  afirma(!!(t1.info && t1.info.semMudanca), 'callback sinaliza semMudanca:true (ordem de propriedades é irrelevante)');

  console.log('\n-- 2. Mesmas condições dentro de "all", ORDEM diferente -> nenhuma mudança --');
  const t2 = await publicarArq(page, await page.evaluate(() => {
    var v = window.faMotorArquitetura.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v).regras));
    var principal = regras.filter((r) => r.codigo === 'PRODUTO_SERVICO_PRINCIPAL')[0];
    // Inverte a ordem visual dos 5 leaves + o bloco "not" dentro do "all" —
    // P1=SIM,P2=SIM,...,not(...) vira not(...),...,P2=SIM,P1=SIM: mesmo "E"
    // lógico, ordem totalmente diferente.
    principal.condicoes.all.reverse();
    return regras;
  }));
  afirma(!t2.err, 'publicação com ordem de "all" invertida não gerou erro');
  afirma(t2.versao === t2.v, 'versão NÃO avançou só por inverter a ordem dentro de "all": ' + t2.v + ' -> ' + t2.versao);
  afirma(!!(t2.info && t2.info.semMudanca), 'callback sinaliza semMudanca:true (ordem dentro de "all" é irrelevante)');

  console.log('\n-- 3. Mesmas condições dentro de "any", ORDEM diferente -> nenhuma mudança --');
  const t3 = await publicarArq(page, await page.evaluate(() => {
    var v = window.faMotorArquitetura.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v).regras));
    var componente = regras.filter((r) => r.codigo === 'COMPONENTE')[0];
    var anyNode = componente.condicoes.all.filter((c) => Array.isArray(c.any))[0];
    anyNode.any.reverse(); // P15=SIM,P13=SIM vira P13=SIM,P15=SIM — mesmo "OU"
    return regras;
  }));
  afirma(!t3.err, 'publicação com ordem de "any" invertida não gerou erro');
  afirma(t3.versao === t3.v, 'versão NÃO avançou só por inverter a ordem dentro de "any": ' + t3.v + ' -> ' + t3.versao);
  afirma(!!(t3.info && t3.info.semMudanca), 'callback sinaliza semMudanca:true (ordem dentro de "any" é irrelevante)');

  console.log('\n-- 4. Mudança só de metadado NÃO lido pelo executor ("motivos") -> nenhuma mudança lógica --');
  const t4 = await publicarArq(page, await page.evaluate(() => {
    var v = window.faMotorArquitetura.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v).regras));
    var canal = regras.filter((r) => r.codigo === 'CANAL')[0];
    canal.motivos = ['P9', 'P1', 'P2']; // motivos é só pra compor justificativa, nunca lido por avaliarCondicao
    return regras;
  }));
  afirma(!t4.err, 'publicação com "motivos" alterado não gerou erro');
  afirma(t4.versao === t4.v, 'versão NÃO avançou só por mudar "motivos" (metadado não usado pelo executor): ' + t4.v + ' -> ' + t4.versao);
  afirma(!!(t4.info && t4.info.semMudanca), 'callback sinaliza semMudanca:true (motivos é editorial, não lógico)');

  console.log('\n-- 5. Trocar a PRECEDÊNCIA entre duas regras (mesmas condições de cada uma) -> versiona --');
  const t5 = await publicarArq(page, await page.evaluate(() => {
    var v = window.faMotorArquitetura.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v).regras));
    var a = regras.filter((r) => r.codigo === 'UNIDADE_VALOR_ASSOCIADA')[0];
    var b = regras.filter((r) => r.codigo === 'CONFLITO_PROCESSO_CAPACIDADE')[0];
    var tmp = a.ordem; a.ordem = b.ordem; b.ordem = tmp;
    return regras;
  }));
  afirma(!t5.err, 'publicação da troca de precedência não gerou erro');
  afirma(t5.versao === t5.v + 1, 'versão AVANÇOU por trocar a precedência: ' + t5.v + ' -> ' + t5.versao);
  afirma(t5.info && t5.info.alteradas && t5.info.alteradas.length === 2, 'diffRegras aponta as duas regras afetadas pela troca de precedência');

  console.log('\n-- 6. Remover uma regra por inteiro -> versiona --');
  const t6 = await publicarArq(page, await page.evaluate(() => {
    var v = window.faMotorArquitetura.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v).regras));
    return regras.filter((r) => r.codigo !== 'CAPACIDADE_ORGANIZACIONAL');
  }));
  afirma(!t6.err, 'publicação com uma regra removida não gerou erro (fallback ainda cobre tudo)');
  afirma(t6.versao === t6.v + 1, 'versão AVANÇOU por remover uma regra inteira: ' + t6.v + ' -> ' + t6.versao);
  afirma(t6.info && t6.info.alteradas.length === 1 && t6.info.alteradas[0].novo === null, 'diffRegras aponta a regra removida com novo:null');

  console.log('\n-- 7. Mudar o valor esperado de uma condição de verdade -> versiona --');
  const t7 = await publicarArq(page, await page.evaluate(() => {
    var v = window.faMotorArquitetura.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v).regras));
    var modalidade = regras.filter((r) => r.codigo === 'MODALIDADE_SUBPRODUTO')[0];
    /* P15 (era NAO): mudança lógica real que mantém a regra alcançável. Inverter P16 tornaria
       MODALIDADE inalcançável (FUNCIONALIDADE_OPERACAO já pega P16=SIM+P5=NAO), e regra
       inalcançável agora é bloqueada pela validação — não é isso que este passo testa. */
    var leafP15 = modalidade.condicoes.all.filter((c) => c.campo === 'P15')[0];
    leafP15.valor = 'SIM'; // era NAO
    return regras;
  }));
  afirma(!t7.err, 'publicação da mudança de condição não gerou erro');
  afirma(t7.versao === t7.v + 1, 'versão AVANÇOU por mudar o valor esperado de uma condição: ' + t7.v + ' -> ' + t7.versao);
  afirma(t7.info && t7.info.alteradas.length === 1 && t7.info.alteradas[0].codigo === 'MODALIDADE_SUBPRODUTO', 'diffRegras aponta só a regra cuja condição mudou');

  console.log('\n== MOTOR DE SQUAD ==');

  console.log('\n-- 8. Mesmas propriedades, ORDEM diferente no objeto da regra (squad) -> nenhuma mudança --');
  const s1 = await publicarSquad(page, await page.evaluate(() => {
    var v = window.faMotorSquad.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorSquad.regrasDaVersao(v)));
    var original = regras.combinacao.filter((r) => r.codigo === 'C5')[0];
    var reordenada = JSON.parse('{"resultado":"' + original.resultado + '","condicoes":' + JSON.stringify(original.condicoes) +
      ',"ordem":' + original.ordem + ',"codigo":"' + original.codigo + '"}');
    regras.combinacao[regras.combinacao.findIndex((r) => r.codigo === 'C5')] = reordenada;
    return regras;
  }));
  afirma(!s1.err, 'publicação (squad) com ordem de propriedades trocada não gerou erro');
  afirma(s1.versao === s1.v, 'motorSquadVersion NÃO avançou só por causa da ordem das propriedades: ' + s1.v + ' -> ' + s1.versao);
  afirma(!!(s1.info && s1.info.semMudanca), 'callback (squad) sinaliza semMudanca:true');

  console.log('\n-- 9. Mesmas condições dentro de "all"/"any", ORDEM diferente (squad) -> nenhuma mudança --');
  const s2 = await publicarSquad(page, await page.evaluate(() => {
    var v = window.faMotorSquad.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorSquad.regrasDaVersao(v)));
    var a1 = regras.eixoA.filter((r) => r.codigo === 'A1')[0];
    a1.condicoes.all.reverse(); // S1,S2,S4,S5 (all) vira S5,S4,S2,S1 — mesmo "E"
    var b3 = regras.eixoB.filter((r) => r.codigo === 'B3')[0];
    var anyNode = b3.condicoes.all.filter((c) => Array.isArray(c.any))[0];
    anyNode.any.reverse(); // mesmo "OU", ordem diferente
    return regras;
  }));
  afirma(!s2.err, 'publicação (squad) com ordem de all/any invertida não gerou erro');
  afirma(s2.versao === s2.v, 'motorSquadVersion NÃO avançou só por inverter ordem dentro de all/any: ' + s2.v + ' -> ' + s2.versao);
  afirma(!!(s2.info && s2.info.semMudanca), 'callback (squad) sinaliza semMudanca:true');

  console.log('\n-- 10. Trocar a PRECEDÊNCIA entre duas regras do mesmo grupo (squad) -> versiona --');
  const s3 = await publicarSquad(page, await page.evaluate(() => {
    var v = window.faMotorSquad.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorSquad.regrasDaVersao(v)));
    var c1 = regras.combinacao.filter((r) => r.codigo === 'C1')[0];
    var c2 = regras.combinacao.filter((r) => r.codigo === 'C2')[0];
    var tmp = c1.ordem; c1.ordem = c2.ordem; c2.ordem = tmp;
    return regras;
  }));
  afirma(!s3.err, 'publicação (squad) da troca de precedência não gerou erro');
  afirma(s3.versao === s3.v + 1, 'motorSquadVersion AVANÇOU por trocar a precedência: ' + s3.v + ' -> ' + s3.versao);
  afirma(s3.info && s3.info.alteradas.length === 2, 'diffRegras (squad) aponta as duas regras afetadas pela troca de precedência');

  console.log('\n-- 11. Remover uma regra por inteiro (squad) -> versiona --');
  const s4 = await publicarSquad(page, await page.evaluate(() => {
    var v = window.faMotorSquad.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorSquad.regrasDaVersao(v)));
    regras.eixoB = regras.eixoB.filter((r) => r.codigo !== 'B3');
    return regras;
  }));
  afirma(!s4.err, 'publicação (squad) com uma regra removida não gerou erro');
  afirma(s4.versao === s4.v + 1, 'motorSquadVersion AVANÇOU por remover uma regra inteira: ' + s4.v + ' -> ' + s4.versao);
  afirma(s4.info && s4.info.alteradas.length === 1 && s4.info.alteradas[0].novo === null && s4.info.alteradas[0].codigo === 'B3', 'diffRegras (squad) aponta a regra removida com novo:null');

  afirma(erros.length === 0, 'nenhum erro de JS durante todo o fluxo (encontrados: ' + erros.length + ')');
  await ctx.close();
  await browser.close();

  console.log(falhas === 0
    ? '\n============================\nOK — diferença estrutural (ordem de propriedades, ordem dentro de all/any, metadado editorial) nunca versiona; mudança lógica de verdade (precedência, remoção, condição) sempre versiona.'
    : '\n============================\n' + falhas + ' FALHA(S)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
