/* AMBIENTE DE TESTES — semente do Firebase Emulator (nunca do banco oficial).
 * Cria, se ainda não existirem, as contas de teste (só existem no emulador de login) e grava as referências
 * oficiais de TESTE que o cadastro de Estruturas exige: perfis, conceitos organizacionais ativos dos 10 códigos do
 * Posicionamento e a ligação canônica código ↔ conceito. NÃO apaga nem reescreve estruturas cadastradas.
 * Recusa rodar se o endereço não for 127.0.0.1/localhost ou se o projeto não for "demo-".
 *
 *   node .github/scripts/ambiente-local/semente.js            (usa 127.0.0.1:9000 e 127.0.0.1:9099)
 *   exporta CONTAS e PROJETO para os testes. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJETO = 'demo-forca-agil-local';
const NS = PROJETO + '-default-rtdb';
/* portas do emulador: as do atalho (9000/9099) ou outras, para um emulador separado (teste da jornada) */
const BANCO = { host: '127.0.0.1', porta: +process.env.FA_PORTA_BANCO || 9000 }, LOGIN = { host: '127.0.0.1', porta: +process.env.FA_PORTA_LOGIN || 9099 };
const SENHA = 'teste123';
/* contas FICTÍCIAS, só no emulador (o site só aceita e-mail @previ.com.br no login) */
const CONTAS = Object.freeze({
  configuracao: { email: 'teste.configuracao@previ.com.br', nome: 'Teste — Avaliação + Configuração', perfil: 'avaliacao-arquitetura' },
  consulta: { email: 'teste.consulta@previ.com.br', nome: 'Teste — Avaliação (só consulta)', perfil: 'avaliacao' },
  admin: { email: 'teste.admin@previ.com.br', nome: 'Teste — Admin geral', perfil: null }
});
const chave = (e) => e.replace(/[@.]/g, '_'); /* igual a emailKey (auth.js) e ao replace das regras, que troca todas as ocorrências */

function pedir(alvo, metodo, caminho, corpo, cabecalhos) {
  if (alvo.host !== '127.0.0.1' && alvo.host !== 'localhost') return Promise.reject(new Error('semente só fala com o emulador local'));
  return new Promise((ok, erro) => {
    const dados = corpo === undefined ? null : JSON.stringify(corpo);
    const req = http.request({ host: alvo.host, port: alvo.porta, method: metodo, path: caminho,
      headers: Object.assign({ 'Content-Type': 'application/json' }, dados ? { 'Content-Length': Buffer.byteLength(dados) } : {}, cabecalhos || {}) }, (res) => {
      let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => ok({ status: res.statusCode, corpo: b ? JSON.parse(b) : null }));
    });
    req.on('error', erro); req.setTimeout(10000, () => req.destroy(new Error('sem resposta do emulador')));
    if (dados) req.write(dados); req.end();
  });
}
const banco = (metodo, caminho, corpo) => pedir(BANCO, metodo, '/' + caminho + '.json?ns=' + NS, corpo, { Authorization: 'Bearer owner' });

/* rótulos de fábrica dos posicionamentos (fonte única: forca-agil/posicionamentos.js) como nome dos conceitos de teste */
function rotulosDeFabrica() {
  const fonte = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'forca-agil', 'posicionamentos.js'), 'utf8');
  const bloco = /ROTULO_FABRICA\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(fonte);
  const out = {};
  (bloco ? bloco[1] : '').replace(/([A-Z_]+):\s*'([^']*)'/g, (m, c, n) => { out[c] = n; return m; });
  if (Object.keys(out).length !== 10) throw new Error('não li os 10 rótulos de fábrica de posicionamentos.js');
  return out;
}

async function semear(log) {
  log = log || console.log;
  /* 1. contas de teste no emulador de login */
  for (const c of Object.values(CONTAS)) {
    const r = await pedir(LOGIN, 'POST', '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=chave-do-emulador', { email: c.email, password: SENHA, returnSecureToken: true });
    if (r.status !== 200 && !(r.corpo && r.corpo.error && /EMAIL_EXISTS/.test(r.corpo.error.message))) throw new Error('não consegui criar ' + c.email + ': ' + JSON.stringify(r.corpo));
  }
  /* 2. perfis e referências oficiais de TESTE (PATCH em cada caminho: o resto do banco fica como está) */
  const ROT = rotulosDeFabrica();
  const quando = new Date().toISOString();
  const usuarios = {}, autorizados = {};
  Object.values(CONTAS).forEach((c) => { usuarios[chave(c.email)] = { name: c.nome, area: 'Ambiente de testes' }; if (c.perfil) autorizados[chave(c.email)] = { tipo: c.perfil, email: c.email }; });
  const conceitos = {}, ligacoes = {};
  Object.keys(ROT).forEach((cod, i) => {
    conceitos[cod] = { nome: ROT[cod], ordem: i + 1, ativo: true, situacaoDefinicao: 'ainda não registrada', camada: 'A' };
    ligacoes[cod] = { registradoEm: quando, registradoPor: CONTAS.admin.email, auditoriaId: 'semente-teste' };
  });
  for (const [caminho, valor] of [
    ['fa-users', usuarios], ['fa-avaliacao-autorizados', autorizados], ['fa-admins', { [chave(CONTAS.admin.email)]: { email: CONTAS.admin.email } }],
    ['taxonomia/organizacional/conceitos', conceitos], ['posicionamento-classificacoes', ligacoes]
  ]) {
    const r = await banco('PATCH', caminho, valor);
    if (r.status !== 200) throw new Error('não consegui gravar ' + caminho + ' no emulador: ' + r.status);
  }
  /* trava de produção (estruturas-firebase.js › TRAVA_PRODUCAO): no emulador local, a gravação do cadastro fica ligada */
  const trava = require(path.join(__dirname, '..', '..', '..', 'forca-agil', 'estruturas-firebase.js')).TRAVA_PRODUCAO;
  const rt = await banco('PUT', trava, true);
  if (rt.status !== 200) throw new Error('não consegui ligar a gravação do cadastro no emulador: ' + rt.status);
  log('Ambiente de testes pronto (projeto ' + PROJETO + '): ' + Object.values(CONTAS).map((c) => c.email).join(', ') + ' - senha ' + SENHA);
}

module.exports = { semear, CONTAS, SENHA, PROJETO, NS, BANCO, LOGIN, banco, pedir };
/* espera o emulador responder (o contêiner leva alguns segundos para subir) */
function aguardar(segundos) {
  const fim = Date.now() + (segundos || 120) * 1000;
  const tenta = (alvo) => new Promise((ok) => { const r = http.get({ host: alvo.host, port: alvo.porta, path: '/' }, (res) => { res.resume(); ok(true); }); r.on('error', () => ok(false)); r.setTimeout(1500, () => { r.destroy(); ok(false); }); });
  return (async function laco() {
    while (Date.now() < fim) { if (await tenta(BANCO) && await tenta(LOGIN)) return; await new Promise((r) => setTimeout(r, 1000)); }
    throw new Error('o emulador não respondeu em ' + (segundos || 120) + ' segundos');
  })();
}

module.exports.aguardar = aguardar;
if (require.main === module) {
  console.log('Aguardando o emulador ficar pronto...');
  aguardar(180).then(() => semear()).catch((e) => { console.error('ERRO: ' + (e && e.message || e)); process.exit(1); });
}
